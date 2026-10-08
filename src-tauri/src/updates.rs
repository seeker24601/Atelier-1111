//! Check for and install signed updates from the GitHub release feed. Both are
//! commands the local page may call; nothing else of the updater is exposed.

use tauri::AppHandle;
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(serde::Serialize)]
pub struct UpdateStatus {
    current: String,
    available: Option<String>,
    notes: Option<String>,
}

async fn latest(app: &AppHandle) -> Result<Option<Update>, String> {
    app.updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| match e {
            // The feed URL answers 404 until the first release exists, which
            // the plugin reports as an invalid release file.
            tauri_plugin_updater::Error::ReleaseNotFound => {
                "No release has been published yet.".to_string()
            }
            e => e.to_string(),
        })
}

/// What is installed, and what the release feed offers, if anything newer.
#[tauri::command]
pub async fn update_check(app: AppHandle) -> Result<UpdateStatus, String> {
    let update = latest(&app).await?;
    Ok(UpdateStatus {
        current: app.package_info().version.to_string(),
        available: update.as_ref().map(|u| u.version.clone()),
        notes: update.and_then(|u| u.body).filter(|n| !n.trim().is_empty()),
    })
}

/// Download and verify the signed update, then install it and restart.
/// The backend is stopped between the two: the installer replaces the bundled
/// Node runtime, which Windows will not overwrite while it is running. The app
/// restarts even if installing fails, so it comes back on the old version
/// rather than sitting there without a backend. On Windows the installer exits
/// the app itself and starts the new version when it finishes.
#[tauri::command]
pub async fn update_install(app: AppHandle) -> Result<(), String> {
    let update = latest(&app).await?.ok_or("Already up to date.")?;
    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;
    crate::backend::stop(&app);
    let _ = update.install(bytes);
    app.restart();
}
