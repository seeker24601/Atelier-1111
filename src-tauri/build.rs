fn main() {
    // Declaring the app's own commands generates allow-<command> permissions,
    // which the window-theme capability grants to the local page.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["update_check", "update_install"]),
    ))
    .expect("failed to run tauri-build");
}
