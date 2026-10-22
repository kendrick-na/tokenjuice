<# Removes only owned notification registration and the matching startup link.
   Does not delete engine, user config, conversations, cache or unrelated entries.
   Close TokenJuice yourself before running. No process is killed by this script. #>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$tray = Join-Path $here 'tokenjuice_tray.py'
$py = (Get-Command python -ErrorAction Stop).Source
& $py $tray --unregister-notifications
if ($LASTEXITCODE -ne 0) {
  throw 'Owned notification registration could not be removed. No broad registry cleanup was attempted.'
}
$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'tokenjuice.lnk'
if (Test-Path $lnk) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($lnk)
  $allowedTargets = @($py, (Join-Path (Split-Path -Parent $py) 'pythonw.exe'))
  if ($shortcut.Arguments -ne "`"$tray`"" -or $shortcut.TargetPath -notin $allowedTargets -or $shortcut.WorkingDirectory -ne $here) {
    throw 'Startup link does not match this source installation; leaving it unchanged.'
  }
  Remove-Item -LiteralPath $lnk
}
Write-Host 'Owned notification registration/startup removed. Usage files, settings and source files were kept.'
