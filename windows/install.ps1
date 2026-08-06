<#
  tokenjuice — Windows installer

  Checks bun + Python, installs the two Python deps, registers a
  start-at-login shortcut, and launches the tray.

    .\install.ps1              # install and start
    .\install.ps1 -NoAutostart # skip the start-at-login shortcut
    .\install.ps1 -Yes         # never prompt (for agents / CI)
#>
[CmdletBinding()]
param(
  [switch]$NoAutostart,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here
$tray = Join-Path $here 'tokenjuice_tray.py'
$engine = Join-Path $repo 'claude-codex-battery.5s.js'

function Say($m) { Write-Host $m }
function Ok($m) { Write-Host "  OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  !   $m" -ForegroundColor Yellow }
function Die($m) { Write-Host "  X   $m" -ForegroundColor Red; exit 1 }

# Non-interactive (no console to prompt into) auto-proceeds, like install.sh does.
$auto = $Yes -or $env:CCB_YES -eq '1' -or -not [Environment]::UserInteractive
function Confirm($prompt) {
  if ($auto) { return $true }
  $a = Read-Host "$prompt [Y/n]"
  return ($a -eq '' -or $a -match '^[Yy]')
}

Say ''
Say 'tokenjuice - Windows setup'
Say ''

if (-not (Test-Path $tray))   { Die "tokenjuice_tray.py not found next to this script." }
if (-not (Test-Path $engine)) { Die "Engine not found at $engine (run this from inside the repo)." }

# ── 1. bun (the engine runtime) ──────────────────────────────────────────
Say '[1/4] bun'
$bun = (Get-Command bun -ErrorAction SilentlyContinue).Source
if (-not $bun) {
  $cand = Join-Path $env:USERPROFILE '.bun\bin\bun.exe'
  if (Test-Path $cand) { $bun = $cand }
}
if (-not $bun) {
  Warn 'bun is not installed. It runs the usage engine.'
  if (Confirm '      Install bun now?') {
    powershell -NoProfile -Command 'irm bun.sh/install.ps1 | iex'
    $cand = Join-Path $env:USERPROFILE '.bun\bin\bun.exe'
    if (Test-Path $cand) { $bun = $cand } else { Die 'bun install finished but bun.exe was not found.' }
  } else {
    Die 'bun is required. See https://bun.sh'
  }
}
Ok "bun -> $bun"

# ── 2. Python ────────────────────────────────────────────────────────────
Say '[2/4] Python'
$py = $null
foreach ($c in @('python', 'python3', 'py')) {
  $g = Get-Command $c -ErrorAction SilentlyContinue
  if (-not $g) { continue }
  # The Microsoft Store stub resolves but is not a usable interpreter.
  try {
    $v = & $g.Source -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
    if ($LASTEXITCODE -eq 0 -and $v) { $py = $g.Source; $pyv = $v; break }
  } catch { }
}
if (-not $py) {
  Die "Python 3.9+ not found. Install it from https://python.org (tick 'Add python.exe to PATH')."
}
if ([version]$pyv -lt [version]'3.9') { Die "Python $pyv is too old; 3.9+ required." }
Ok "Python $pyv -> $py"

# ── 3. deps ──────────────────────────────────────────────────────────────
Say '[3/4] Python packages (pystray, pillow)'
& $py -c "import pystray, PIL" 2>$null
if ($LASTEXITCODE -ne 0) {
  & $py -m pip install --user --quiet --upgrade pystray pillow
  if ($LASTEXITCODE -ne 0) { Die 'pip install failed.' }
}
Ok 'pystray + pillow ready'

# ── 4. autostart ─────────────────────────────────────────────────────────
Say '[4/4] Start at login'
if ($NoAutostart) {
  Warn 'skipped (-NoAutostart)'
} else {
  # pythonw.exe runs without a console window; fall back to python.exe.
  $pyw = Join-Path (Split-Path -Parent $py) 'pythonw.exe'
  if (-not (Test-Path $pyw)) { $pyw = $py }
  $startup = [Environment]::GetFolderPath('Startup')
  $lnk = Join-Path $startup 'tokenjuice.lnk'
  $ws = New-Object -ComObject WScript.Shell
  $s = $ws.CreateShortcut($lnk)
  $s.TargetPath = $pyw
  $s.Arguments = "`"$tray`""
  $s.WorkingDirectory = $here
  $s.WindowStyle = 7
  $s.Description = 'tokenjuice - Claude Code / Codex usage in the tray'
  $s.Save()
  Ok "shortcut -> $lnk"
}

# ── smoke test ───────────────────────────────────────────────────────────
Say ''
Say 'Checking the engine can read your usage...'
& $py $tray --once
if ($LASTEXITCODE -ne 0) {
  Warn 'Could not read usage yet.'
  Warn 'Sessions and Codex read local files; Claude limits may need you to run `claude` and sign in first.'
} else {
  Ok 'engine works'
}

# ── launch ───────────────────────────────────────────────────────────────
$pyw = Join-Path (Split-Path -Parent $py) 'pythonw.exe'
if (-not (Test-Path $pyw)) { $pyw = $py }
Get-Process -Name 'pythonw','python' -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*tokenjuice_tray*' } |
  ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath $pyw -ArgumentList "`"$tray`"" -WorkingDirectory $here -WindowStyle Hidden
Say ''
Ok 'tokenjuice is running - look for the battery in your system tray.'
Say '     (Windows hides new tray icons: click the ^ arrow, or drag it onto the taskbar to pin it.)'
Say ''
