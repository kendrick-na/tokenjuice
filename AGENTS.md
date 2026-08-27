# AGENTS.md — installing tokenjuice

Instructions for a coding agent (Claude Code, Codex, Cursor, …) asked to install
this for a user. Follow the branch for the user's OS; do not run both.

**What this is:** a menu bar / system tray battery showing how much Claude Code
and Codex usage the user has left. macOS uses SwiftBar; Windows uses a Python
tray app. Both run the same engine, `claude-codex-battery.5s.js`.

## Step 0 — is it already installed?

Check before cloning. Cloning blindly next to an existing copy leaves two
checkouts and the user can no longer tell which one is live.

```bash
ls ~/.swiftbar-plugins/claude-codex-battery.5s.js   # macOS: installed?
ls "$(cygpath -u "$USERPROFILE" 2>/dev/null)/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/tokenjuice.lnk"  # Windows
```

If either exists, this is an **update**, not an install. Find the existing clone
(`git -C <path> remote -v` should show `tokenjuice`) and re-run the installer
there — both are idempotent and re-copy the current engine. Do **not** clone a
second copy.

`git pull` first only if the checkout is clean. Check `git status` — a user who
edited files locally should be asked before you touch their work.

## Step 1 — detect the OS

Do not assume. Windows and macOS have entirely separate installers, and running
the wrong one wastes the user's time.

| Signal | OS | Go to |
|---|---|---|
| `uname` prints `Darwin` | macOS | [macOS](#macos) |
| `$env:OS` is `Windows_NT`, or you're in PowerShell/cmd | Windows | [Windows](#windows) |
| `uname` prints `Linux` | Linux | [Linux](#linux) |

If the user is on Windows but you only have a bash shell, check whether it's WSL
(`uname -r` contains `microsoft`). **WSL is the Linux path, not the Windows one** —
a tray icon from inside WSL won't reach the Windows taskbar, and WSL has its own
`~/.claude`, so it reports the usage of the Linux-side Claude Code, not Windows'.
Ask which one the user means before continuing.

## macOS

**Ask the user where to clone** if they have a convention; otherwise clone into a
directory you know, not whatever the shell happens to be sitting in:

```bash
git clone https://github.com/kendrick-na/tokenjuice.git ~/tokenjuice
cd ~/tokenjuice
CCB_YES=1 ./install.sh
```

`install.sh` installs bun and SwiftBar via Homebrew if missing, registers the
plugin, launches SwiftBar, and adds a login item plus a per-user LaunchAgent
fallback. `CCB_YES=1` stops it prompting.

**Homebrew is required** unless SwiftBar is already installed — the installer
exits if SwiftBar is missing and `brew` isn't available. Install Homebrew first,
or install SwiftBar manually, if that's the case.

**Verify:** `bun claude-codex-battery.5s.js --text` prints battery lines. Then
tell the user to look for the batteries in their menu bar.

**You cannot finish one thing:** if the user later sets `CCB_API=1`, macOS shows a
keychain prompt needing a human click on *Always Allow*. Don't promise otherwise.

## Windows

Requires **PowerShell**. Do not use `install.sh` — it is macOS-only and will fail
or produce a broken setup.

```powershell
git clone https://github.com/kendrick-na/tokenjuice.git
cd tokenjuice\windows
$env:CCB_YES=1; .\install.ps1
```

If script execution is blocked, prefer a one-shot bypass over changing the
machine's policy permanently:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

`install.ps1` checks compatibility, installs bun if missing, installs the two
Python packages, registers a start-at-login shortcut, smoke-tests the engine, and
launches the tray.

**Verify:** `python tokenjuice_tray.py --once` prints battery lines. A tray icon
should appear; Windows hides new tray icons, so tell the user to click the **^**
arrow near the clock and drag tokenjuice onto the taskbar to pin it.

If something looks wrong, `python selftest.py` checks icon rendering, the ICO
conversion Windows consumes, and the degraded-data paths. Exit 0 means the tray
side is fine and the problem is elsewhere (usually bun or the engine).

### Hard blockers on Windows — check before promising it will work

`install.ps1` checks these itself and stops with a clear message, but knowing them
lets you tell the user immediately rather than after a clone:

| Condition | Result |
|---|---|
| Windows build < 17763 (older than Win10 1809) | **Cannot install.** bun requires 1809+. |
| x64 CPU without AVX2 (roughly pre-2013 Intel / pre-2015 AMD) | **Cannot install.** bun's baseline build crashes: [oven-sh/bun#28399](https://github.com/oven-sh/bun/issues/28399), open. Not fixable from here. |
| Python missing | Install Python 3.9+ first, with *Add python.exe to PATH* ticked. Or use the exe from Releases, which bundles Python. |
| bun missing | The installer offers to install it. Manual: `powershell -c "irm bun.sh/install.ps1 | iex"` |

If the user hits a hard blocker, say so plainly and offer the CLI instead
(`bun claude-codex-battery.5s.js --text`) rather than attempting workarounds.

## Linux

No tray build exists. Don't try to make one. Report the CLI and stop:

```bash
bun claude-codex-battery.5s.js --text   # human-readable
bun claude-codex-battery.5s.js --json   # for a bar/widget (waybar, polybar, …)
```

## Updating

The installers copy the engine into place, so an update is a pull plus a re-run.
The copy is what matters: pulling alone changes the checkout but leaves the
running menu bar / tray on the old engine.

```bash
# macOS
cd <existing clone> && git pull && CCB_YES=1 ./install.sh
```
```powershell
# Windows
cd <existing clone>; git pull; cd windows; .\install.ps1
```

To check whether a running install is stale, compare the installed copy against
the checkout. Skip line 1: the installer rewrites the shebang to bun's absolute
path, so a plain `diff` always reports a difference and looks like a false stale.

```bash
diff <(tail -n +2 ~/.swiftbar-plugins/claude-codex-battery.5s.js) \
     <(tail -n +2 ./claude-codex-battery.5s.js) && echo "up to date"
```

## Uninstalling

```bash
# macOS — removing the plugin is enough; SwiftBar keeps running with none.
rm ~/.swiftbar-plugins/claude-codex-battery.5s.js
```
The login item `install.sh` adds is **SwiftBar**, not tokenjuice. It also installs
`~/Library/LaunchAgents/com.tokenjuice.swiftbar.plist` as a fallback. Leave both
alone unless SwiftBar was installed only for this — in which case remove SwiftBar
from System Settings › General › Login Items, delete that plist, and
`brew uninstall --cask swiftbar`.
```powershell
# Windows: delete the startup shortcut, then quit from the tray menu
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\tokenjuice.lnk"
```

Neither leaves anything else behind: no daemons, no registry keys. The cache in
`~/.cache/claude-codex-battery` and any config in
`~/.config/claude-codex-battery` can be deleted too.

## Things that are true on every OS

- **Never enable `CCB_TOPICS`/`--topics` unless the user explicitly asks.** A
  session "topic" is the user's raw prompt text, and the tray and menu bar are
  both visible in screen shares and screenshots. Off is the default for that
  reason.
- **Empty batteries are usually not a bug.** `C` blank normally means API mode is
  off, which is the default; `S` needs a session active in the last 15 minutes;
  `X` only appears if `~/.codex` exists; `L` only if the user configured Letsur.
  Read the dropdown/menu text — it states the actual reason.
- **Don't reimplement the usage calculations.** If asked to remove the bun
  dependency by rewriting the engine in another language, don't. Two copies of
  that logic means one goes stale and reports a wrong number, and a battery that
  lies is worse than an extra install step. See `windows/README.md`.
- **Report honestly.** If a step fails, say which one and show the output. Don't
  claim the tray is running when you couldn't verify it.
