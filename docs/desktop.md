# Desktop application

System: Desktop shell. Tauri owns the window, backend lifecycle, and installers.
It reuses the existing React UI, Node API, generation queue, and gallery.

## Supported build targets

- Windows x64: NSIS installer and WebView2.
- macOS 13.5+ Apple Silicon: application bundle and DMG.
- macOS 13.5+ Intel: application bundle and DMG.

Build each target on its own OS and architecture. The preparation script copies
that machine's Node executable into the package. Users do not need Node installed.

## Build

Install Node 24 and the Tauri prerequisites for your OS.
Windows requires Rust and the Visual Studio C++ build tools.
macOS requires Rust and the Xcode command line tools.

```sh
npm ci
npm test
npm run desktop:build
```

Installers appear in `src-tauri/target/release/bundle`.
`npm run desktop:dev` runs the desktop shell for development.
Run it again after changing backend code to rebuild the bundled files.

The GitHub Actions desktop workflow builds all three targets.
It stores artifacts without publishing a release.
Unsigned Mac builds need local approval to open. Public distribution requires
Apple signing and notarization; credentials are not included in this repository.

## Data and lifecycle

The desktop backend uses an OS-assigned free loopback port.
The app waits for backend readiness before it creates the window.
Only one desktop instance runs at a time. Closing the app stops its backend.
The renderer has no shell permissions or direct Node access.

Desktop data uses the Tauri application-data directory for
`com.seeker24601.atelier1111`, outside the installed application.
The web version continues to use the repository's `data` directory.
Set `ATELIER_DATA_DIR` to override the backend's storage directory.
The installer never includes keys, galleries, `.env`, or development dependencies.

To migrate a web gallery, close both applications and copy the contents of its
`data` folder into the desktop data folder. Keep the original as a backup.
Copy SQLite WAL and SHM files with the database if they are present.

## Verification status

Windows verified on 2026-10-08:

- NSIS installer built and installed, about 26 MiB.
- Native window renders the existing gallery and reads the migrated settings.
- Closing the native window stops its Node backend.
- Launching twice keeps a single application window.
- All 64 existing tests pass.
- `node scripts/verify-desktop.mjs` passes against the bundled runtime.
- The storage check fails when the data-directory override is removed.
- Production npm dependencies have no reported audit vulnerabilities.

The macOS workflow is configured but has not run. Both Mac targets need a
native build and runtime check before release. Signing and notarization are
not configured.

On this Windows installation, the desktop launcher points to
`%LOCALAPPDATA%\Atelier 1111\atelier-1111.exe`.
The existing gallery and settings were copied using SQLite backup into
`%APPDATA%\com.seeker24601.atelier1111`. Original web data remains unchanged.
