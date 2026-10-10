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
The page has no direct Node access. It may ask the shell for three things,
listed in the `local-page` capability in `tauri.conf.json`: set the title bar
theme, check for an update, and install one.

## Updates

Settings → Updates checks the latest GitHub release and installs it. Updates
are signed; the app refuses any file not signed with the project's key.

- Public key: `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.
- Private key: `~/.tauri/atelier-1111.key`, never committed. Back it up. If it
  is lost, installed copies can no longer be updated in place.
- CI reads the private key from the `TAURI_SIGNING_PRIVATE_KEY` repository
  secret. The key has no password.

To publish a version, set `version` in `src-tauri/tauri.conf.json`, commit,
then push a matching tag, for example `v0.2.0`. The Release workflow builds
all three targets, signs them, and publishes a GitHub release with the
`latest.json` the app reads.

Desktop data uses the Tauri application-data directory for
`com.seeker24601.atelier1111`, outside the installed application.
The web version continues to use the repository's `data` directory.
Set `ATELIER_DATA_DIR` to override the backend's storage directory.
The installer never includes keys, galleries, `.env`, or development dependencies.

To migrate a web gallery, close both applications and copy the contents of its
`data` folder into the desktop data folder. Keep the original as a backup.
Copy SQLite WAL and SHM files with the database if they are present.

Version 0.2 qualifies stored model ids with their provider on first start and
writes a copy of the database and `settings.json` to `backups` inside the data
directory first. Before running 0.1 against that data again, run
`node scripts/downgrade-model-ids.mjs <data directory>`; it backs up the same
way. 0.2 also writes the OpenRouter key to 0.1's `openrouterApiKey` field, so
0.1 finds it either way.

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
