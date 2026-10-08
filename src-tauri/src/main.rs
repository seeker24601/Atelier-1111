#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;
mod updates;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            updates::update_check,
            updates::update_install
        ])
        .setup(|app| {
            // The window opens only once the backend is serving the page.
            let port = backend::start(app)?;
            let url = format!("http://127.0.0.1:{port}").parse()?;
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Atelier 1111")
                .inner_size(1440.0, 940.0)
                .min_inner_size(960.0, 640.0)
                .on_navigation(|url| url.host_str() == Some("127.0.0.1"))
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Could not start Atelier 1111");
    app.run(|app, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            backend::stop(app);
        }
    });
}
