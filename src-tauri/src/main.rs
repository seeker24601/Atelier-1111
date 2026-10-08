#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    time::Duration,
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

struct Backend(Mutex<Child>);

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let resources = app.path().resource_dir()?.join("backend");
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            let log = std::fs::File::create(data.join("desktop-backend.log"))?;
            let node =
                resources
                    .join("runtime")
                    .join(if cfg!(windows) { "node.exe" } else { "node" });
            let mut command = Command::new(node);
            command
                .arg("scripts/desktop-entry.mjs")
                .current_dir(&resources)
                .env("ATELIER_DATA_DIR", &data)
                .env("ATELIER_DESKTOP", "1")
                .env("APP_PORT", "0")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::from(log));
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            let mut child = command.spawn()?;
            let output = child.stdout.take().ok_or("Backend stdout unavailable")?;
            let (sender, receiver) = mpsc::channel();
            std::thread::spawn(move || {
                for line in BufReader::new(output).lines().map_while(Result::ok) {
                    if let Some(port) = line.strip_prefix("ATELIER_READY:") {
                        let _ = sender.send(port.to_string());
                    }
                }
            });
            let port = match receiver.recv_timeout(Duration::from_secs(30)) {
                Ok(port) => port,
                Err(error) => {
                    let _ = child.kill();
                    return Err(format!("Atelier backend could not start: {error}").into());
                }
            };
            app.manage(Backend(Mutex::new(child)));
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
            if let Some(backend) = app.try_state::<Backend>() {
                if let Ok(mut child) = backend.0.lock() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
    });
}
