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
& $py -m pip install --quiet --upgrade pyinstaller -r (Join-Path $here 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'pip install failed.' }

if ($Clean) {
  foreach ($d in @('build', 'dist', '__pycache__')) {
    $p = Join-Path $here $d
    if (Test-Path $p) { Remove-Item -Recurse -Force $p }
  }
}

Push-Location $here
try {
  New-Item -ItemType Directory -Force (Join-Path $here 'build') | Out-Null
  $icon = Join-Path $here 'build/tokenjuice.ico'
  & $py -c 'import sys; import tokenjuice_tray as t; t.render_icon([{"label":"C","color":t.CLAUDE_ORANGE,"bars":[75.0]}]).save(sys.argv[1],format="ICO",sizes=[(16,16),(24,24),(32,32)])' $icon
  if ($LASTEXITCODE -ne 0) { throw 'Could not build the shared battery app icon.' }
  Write-Host 'Building...'
  # --noconsole: tray app, no terminal window.
  # --onefile:   single portable exe.
  & $py -m PyInstaller `
    --noconfirm --clean --onefile --noconsole `
    --name tokenjuice `
    --icon $icon `
    --hidden-import pystray._win32 `
    --collect-all windows_toasts `
    --copy-metadata windows-toasts `
    --collect-submodules winrt `
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
