use std::process::{Command, Stdio};

pub fn run() -> i32 {
    match launch() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("Atelier MCP could not start: {error}");
            1
        }
    }
}

fn launch() -> Result<i32, Box<dyn std::error::Error>> {
    let executable = std::env::current_exe()?;
    let directory = executable
        .parent()
        .ok_or("Application directory unavailable")?;
    let resources = if cfg!(target_os = "macos") {
        directory.join("../Resources/backend")
    } else {
        directory.join("backend")
    };
    let node = resources
        .join("runtime")
        .join(if cfg!(windows) { "node.exe" } else { "node" });
    let mut command = Command::new(node);
    command
        .current_dir(resources)
        .arg("mcp/index.js")
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let status = command.status()?;
    Ok(status.code().unwrap_or(1))
}
