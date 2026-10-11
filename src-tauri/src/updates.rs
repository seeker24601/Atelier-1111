//! Check for and install signed updates from the GitHub release feed. Both are
//! commands the local page may call; nothing else of the updater is exposed.
//!
//! Two channels. The default reads the latest published release. "test" reads
//! the test-channel feed, which carries the newest build of any kind: every
//! tagged build is a pre-release there first, and becomes the latest release
//! when it is promoted. Either way the update must carry the release key's
//! signature.

use tauri::{AppHandle, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

const TEST_FEED: &str =
    "https://github.com/seeker24601/Atelier-1111/releases/download/test-channel/latest.json";

#[derive(serde::Serialize)]
pub struct UpdateStatus {
    current: String,
    available: Option<String>,
    notes: Option<String>,
}

async fn latest(app: &AppHandle, channel: Option<&str>) -> Result<Option<Update>, String> {
    let updater = if channel == Some("test") {
        let feed = Url::parse(TEST_FEED).map_err(|e| e.to_string())?;
        app.updater_builder()
            .endpoints(vec![feed])
            .map_err(|e| e.to_string())?
            .build()
            .map_err(|e| e.to_string())?
    } else {
        app.updater().map_err(|e| e.to_string())?
    };
    updater.check().await.map_err(|e| match e {
        // The feed URL answers 404 until the first release exists, which
        // the plugin reports as an invalid release file.
        tauri_plugin_updater::Error::ReleaseNotFound => {
            "No release has been published yet.".to_string()
        }
        e => e.to_string(),
    })
}

/// What is installed, and what the chosen feed offers, if anything newer.
#[tauri::command]
pub async fn update_check(app: AppHandle, channel: Option<String>) -> Result<UpdateStatus, String> {
    let update = latest(&app, channel.as_deref()).await?;
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
pub async fn update_install(app: AppHandle, channel: Option<String>) -> Result<(), String> {
    let update = latest(&app, channel.as_deref())
        .await?
        .ok_or("Already up to date.")?;
    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;
    crate::backend::stop(&app);
    let _ = update.install(bytes);
    app.restart();
}
