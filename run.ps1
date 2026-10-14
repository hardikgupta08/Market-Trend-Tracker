<#
.SYNOPSIS
  One-command launcher for Market Terminal.

.DESCRIPTION
  Creates the Python venv and installs dependencies if needed, installs npm packages if needed,
  rebuilds the frontend when its sources changed, then starts the server.

  Default mode: a single process on http://localhost:<Port> (FastAPI serves API + built UI).
  -Dev mode:    API with auto-reload + Vite dev server with hot reload, both in this window.

.EXAMPLE
  .\run.ps1                 # production-style, http://localhost:8000
  .\run.ps1 -Open           # same, and open the browser
  .\run.ps1 -Dev            # hot-reload development, http://localhost:5173
  .\run.ps1 -Port 9000 -RefreshMinutes 5
#>
param(
    [switch]$Dev,
    [switch]$Open,
    [switch]$Setup,           # force reinstall of dependencies
    [int]$Port = 8000,
    [int]$RefreshMinutes = 1
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }
function Check($what) { if ($LASTEXITCODE -ne 0) { Fail "$what failed (exit code $LASTEXITCODE)" } }

# ---------- prerequisites ----------
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) { Fail "Python 3.10+ not found on PATH. Install it from https://www.python.org/downloads/" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail "Node.js/npm not found on PATH. Install it from https://nodejs.org/" }

# ---------- backend ----------
if (-not (Test-Path $venvPy)) {
    Step "Creating Python virtual environment"
    & $python.Source -m venv (Join-Path $backend ".venv"); Check "venv creation"
    $Setup = $true
}
$reqStamp = Join-Path $backend ".venv\.requirements-installed"
$reqFile = Join-Path $backend "requirements.txt"
if ($Setup -or -not (Test-Path $reqStamp) -or (Get-Item $reqFile).LastWriteTime -gt (Get-Item $reqStamp).LastWriteTime) {
    Step "Installing backend dependencies"
    & $venvPy -m pip install --disable-pip-version-check -q -r $reqFile; Check "pip install"
    New-Item -ItemType File -Force $reqStamp | Out-Null
}

# ---------- frontend ----------
Push-Location $frontend
try {
    $lock = Join-Path $frontend "package-lock.json"
    $nmStamp = Join-Path $frontend "node_modules\.package-lock.json"
    if ($Setup -or -not (Test-Path $nmStamp) -or ((Test-Path $lock) -and (Get-Item $lock).LastWriteTime -gt (Get-Item $nmStamp).LastWriteTime)) {
        Step "Installing frontend dependencies"
        npm install --no-audit --no-fund; Check "npm install"
    }

    if (-not $Dev) {
        $dist = Join-Path $frontend "dist\index.html"
        $sources = @(Get-ChildItem (Join-Path $frontend "src") -Recurse -File) +
                   @(Get-Item (Join-Path $frontend "index.html"), (Join-Path $frontend "package.json"), (Join-Path $frontend "vite.config.ts"))
        $newest = ($sources | Measure-Object LastWriteTime -Maximum).Maximum
        if (-not (Test-Path $dist) -or $newest -gt (Get-Item $dist).LastWriteTime) {
            Step "Building frontend"
            npm run build; Check "frontend build"
        }
    }
} finally {
    Pop-Location
}

# ---------- port check ----------
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    $proc = Get-Process -Id $busy[0].OwningProcess -ErrorAction SilentlyContinue
    Fail "Port $Port is already in use by $($proc.ProcessName) (PID $($busy[0].OwningProcess)). Stop it or use -Port <n>."
}

# ---------- run ----------
$env:REFRESH_INTERVAL_MINUTES = "$RefreshMinutes"
$env:API_PORT = "$Port"   # read by vite.config.ts for the /api proxy in -Dev mode
$uvicornArgs = @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$Port")
$vite = $null

if ($Dev) {
    $url = "http://localhost:5173"
    $uvicornArgs += @("--reload", "--reload-dir", "app")
    Step "Starting Vite dev server (hot reload)"
    $vite = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev -- --strictPort" `
        -WorkingDirectory $frontend -NoNewWindow -PassThru
} else {
    $url = "http://localhost:$Port"
}

Write-Host ""
Write-Host "  Market Terminal  ->  $url" -ForegroundColor Green
Write-Host "  API docs         ->  http://localhost:$Port/docs" -ForegroundColor Green
Write-Host "  Data refresh every $RefreshMinutes min. Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

if ($Open) {
    Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 3; Start-Process $u } -ArgumentList $url | Out-Null
}

Push-Location $backend
try {
    & $venvPy @uvicornArgs
} finally {
    Pop-Location
    if ($vite -and -not $vite.HasExited) {
        # Kill the whole npm -> node tree.
        & taskkill /PID $vite.Id /T /F 2>&1 | Out-Null
    }
}
