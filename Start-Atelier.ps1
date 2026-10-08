$ErrorActionPreference = 'Stop'

# One process on 127.0.0.1:5180 serving the UI and the API. Paths come from
# where this script lives, so the folder can be moved without editing it.
$root = $PSScriptRoot
$port = 5180
$url = "http://127.0.0.1:$port"
$logs = Join-Path $root 'data\logs'
New-Item -ItemType Directory -Force $logs | Out-Null

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) { throw 'Node.js 22.5 or newer is required: https://nodejs.org' }

function Test-Atelier {
    try { return (Invoke-RestMethod "$url/api/health" -TimeoutSec 2).ok } catch { return $false }
}

if (-not (Test-Atelier)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port is taken by something that is not Atelier."
    }
    Start-Process -FilePath $node `
        -ArgumentList '--env-file-if-exists=.env', 'scripts/start.mjs' `
        -WorkingDirectory $root -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logs 'atelier.log') `
        -RedirectStandardError (Join-Path $logs 'atelier-error.log')

    # A first start after an update includes a UI build, so allow for it.
    for ($i = 0; $i -lt 120 -and -not (Test-Atelier); $i++) { Start-Sleep -Milliseconds 500 }
    if (-not (Test-Atelier)) { throw "Atelier did not start. See $logs\atelier-error.log" }
}

Start-Process $url
