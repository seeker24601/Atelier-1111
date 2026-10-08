//! The bundled Node backend: started before the window exists, stopped when
//! the app exits or an update is about to replace it.

use std::{
    error::Error,
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    time::Duration,
};
use tauri::{App, AppHandle, Manager};

struct Backend(Mutex<Child>);

/// Start the backend on an OS-assigned loopback port and wait until it says
/// it is ready. Returns the port. Data lives in the app-data directory, never
/// inside the installed application.
pub fn start(app: &App) -> Result<String, Box<dyn Error>> {
    let resources = app.path().resource_dir()?.join("backend");
    let data = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data)?;
    let log = std::fs::File::create(data.join("desktop-backend.log"))?;
    let node = resources
        .join("runtime")
        .join(if cfg!(windows) { "node.exe" } else { "node" });

    let mut command = Command::new(node);
    command
        .arg("scripts/desktop-entry.mjs")
        .current_dir(&resources)
        .env("ATELIER_DATA_DIR", &data)
        .env("ATELIER_DESKTOP", "1")
        .env("APP_PORT", "0")
        // The backend exits when this pipe closes, so it cannot outlive the app.
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::from(log));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
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
    Ok(port)
}

pub fn stop(app: &AppHandle) {
    if let Some(backend) = app.try_state::<Backend>() {
        if let Ok(mut child) = backend.0.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
