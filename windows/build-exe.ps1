<#
  Builds dist\tokenjuice.exe with PyInstaller.

  The exe bundles Python + pystray + pillow, so end users need neither.
  It does NOT bundle bun or the engine: the engine is plain JS that users
  should be able to read and audit, and it must sit next to the exe.

    .\build-exe.ps1

  Ship BOTH files from the same folder:
    dist\tokenjuice.exe
    claude-codex-battery.5s.js
#>
[CmdletBinding()]
param([switch]$Clean)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here
$engine = Join-Path $repo 'claude-codex-battery.5s.js'

if (-not (Test-Path $engine)) { throw "Engine not found: $engine" }

$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { $py = (Get-Command python3 -ErrorAction SilentlyContinue).Source }
if (-not $py) { throw 'Python not found.' }

Write-Host 'Installing build deps...'
& $py -m pip install --quiet --upgrade pyinstaller pystray pillow
if ($LASTEXITCODE -ne 0) { throw 'pip install failed.' }

if ($Clean) {
  foreach ($d in @('build', 'dist', '__pycache__')) {
    $p = Join-Path $here $d
    if (Test-Path $p) { Remove-Item -Recurse -Force $p }
  }
}

Push-Location $here
try {
  Write-Host 'Building...'
  # --noconsole: tray app, no terminal window.
  # --onefile:   single portable exe.
  & $py -m PyInstaller `
    --noconfirm --clean --onefile --noconsole `
    --name tokenjuice `
    --hidden-import pystray._win32 `
    tokenjuice_tray.py
  if ($LASTEXITCODE -ne 0) { throw 'PyInstaller failed.' }

  # The exe looks for the engine next to itself (see repo_root() in the tray).
  Copy-Item $engine (Join-Path $here 'dist') -Force
  Write-Host ''
  Write-Host "Built: $(Join-Path $here 'dist\tokenjuice.exe')" -ForegroundColor Green
  Write-Host 'Ship dist\tokenjuice.exe AND dist\claude-codex-battery.5s.js together.'
  Write-Host 'Users still need bun:  powershell -c "irm bun.sh/install.ps1 | iex"'
} finally {
  Pop-Location
}
