#!/bin/bash
# tokenjuice installer — friendly for humans, safe for agents (non-interactive)
set -e
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="${SWIFTBAR_PLUGIN_DIR:-$HOME/.swiftbar-plugins}"
SOURCE_PLUGIN="claude-codex-battery.5s.js"
PLUGIN="tokenjuice-battery.5s.js"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
dim()  { printf "\033[2m%s\033[0m\n" "$1"; }

# This installer is macOS-only: it needs Homebrew and SwiftBar, and it registers a
# launch agent. Stop early with the right pointer instead of failing halfway and
# leaving a half-configured machine behind — an agent handed the wrong command
# should be told where to go, not left guessing.
case "$(uname -s)" in
  Darwin) ;;
  Linux)
    if grep -qi microsoft /proc/version 2>/dev/null; then
      bold "This is WSL, and SwiftBar is macOS-only."
      dim  "For a Windows tray icon, run windows\\install.ps1 from PowerShell — not WSL."
      dim  "(A tray icon started inside WSL can't reach the Windows taskbar, and WSL"
      dim  " has its own ~/.claude, so it would report the Linux-side usage.)"
    else
      bold "No tray build for Linux."
      dim  "Use the CLI and feed it into your bar (waybar, polybar, i3blocks):"
    fi
    dim  "  bun claude-codex-battery.5s.js --text"
    dim  "  bun claude-codex-battery.5s.js --json"
    exit 1
    ;;
  *)
    bold "install.sh is for macOS."
    dim  "On Windows, use PowerShell:  cd windows;  .\\install.ps1"
    dim  "See AGENTS.md for the per-OS instructions."
    exit 1
    ;;
esac

bold "🔋 Installing tokenjuice"
echo

# ── 1. bun ──────────────────────────────────────────────
# Non-interactive safe: if stdin isn't a TTY (agent/CI) OR CCB_YES=1, auto-install bun.
echo "① Checking bun runtime..."
if ! command -v bun >/dev/null; then
  do_install=0
  if [ "$CCB_YES" = "1" ] || [ ! -t 0 ]; then
    do_install=1
    dim "   bun not found — installing automatically (non-interactive)"
  else
    printf "   bun not found. Install it now? [Y/n] "
    read -r ans
    [[ ! "$ans" =~ ^[Nn]$ ]] && do_install=1
  fi
  if [ "$do_install" = "1" ]; then
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  else
    echo "   ❌ bun is required. See https://bun.sh then re-run."
    exit 1
  fi
fi
dim "   ✓ bun $(bun --version)"

# ── 2. SwiftBar ─────────────────────────────────────────
echo "② Checking SwiftBar..."
if [ ! -d "/Applications/SwiftBar.app" ]; then
  if command -v brew >/dev/null; then
    echo "   Installing SwiftBar via Homebrew..."
    brew install --cask swiftbar
  else
    echo "   ❌ SwiftBar not found and Homebrew is unavailable."
    echo "      Grab it from https://github.com/swiftbar/SwiftBar/releases and re-run."
    exit 1
  fi
fi
dim "   ✓ SwiftBar"

# ── 3. Install the plugin ───────────────────────────────
echo "③ Installing plugin..."
mkdir -p "$PLUGIN_DIR"
BUN_PATH="$(command -v bun)"
# Rewrite shebang to bun's absolute path — SwiftBar is a GUI app with a limited PATH.
sed "1s|.*|#!$BUN_PATH|" "$SELF_DIR/$SOURCE_PLUGIN" > "$PLUGIN_DIR/$PLUGIN"
chmod +x "$PLUGIN_DIR/$PLUGIN"
# Installs before the rename used the source filename. Leaving it would draw
# two batteries side by side.
rm -f "$PLUGIN_DIR/$SOURCE_PLUGIN"
dim "   ✓ $PLUGIN_DIR/$PLUGIN"

# ── 4. Point SwiftBar at the folder + launch ────────────
echo "④ Configuring & launching SwiftBar..."
BID=$(defaults read /Applications/SwiftBar.app/Contents/Info CFBundleIdentifier 2>/dev/null || echo "com.ameba.SwiftBar")
defaults write "$BID" PluginDirectory -string "$PLUGIN_DIR"
defaults write "$BID" SUEnableAutomaticChecks -bool false 2>/dev/null || true
open -a SwiftBar

# ── 5. Launch at login (so it survives reboots) ─────────
echo "⑤ Registering launch-at-login..."
LOGIN_AGENT="$HOME/Library/LaunchAgents/com.tokenjuice.swiftbar.plist"
mkdir -p "$HOME/Library/LaunchAgents"
# Login-item state can be reset by macOS after an app update or migration.
# `open -a` is idempotent, so this fallback does not create a second process.
cat > "$LOGIN_AGENT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.tokenjuice.swiftbar</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/open</string><string>-a</string><string>/Applications/SwiftBar.app</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
EOF
chmod 644 "$LOGIN_AGENT"
launchctl bootout "gui/$(id -u)/com.tokenjuice.swiftbar" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$LOGIN_AGENT" >/dev/null 2>&1 || true
if osascript -e 'tell application "System Events" to get the name of every login item' 2>/dev/null | grep -qi swiftbar; then
  dim "   ✓ already a login item"
elif osascript -e 'tell application "System Events" to make login item at end with properties {path:"/Applications/SwiftBar.app", hidden:false}' >/dev/null 2>&1; then
  dim "   ✓ registered (auto-starts after reboot)"
else
  dim "   ⓘ login item permission unavailable; LaunchAgent fallback installed"
fi
dim "   ✓ fallback agent: $LOGIN_AGENT"

# SwiftBar can keep showing a stale (or hidden) battery after sleep/wake. A small
# helper (scripts/ensure-swiftbar-visible.sh) restarts SwiftBar if needed and,
# only after a wake or a restart, re-runs every plugin once (debounced) via the
# supported swiftbar://refreshallplugins URL.
HELPER_DIR="$HOME/Library/Application Support/TokenJuice"
HELPER="$HELPER_DIR/ensure-swiftbar-visible.sh"
VIS_AGENT="$HOME/Library/LaunchAgents/com.tokenjuice.visibility.plist"
mkdir -p "$HELPER_DIR"
cp "$SELF_DIR/scripts/ensure-swiftbar-visible.sh" "$HELPER"
chmod +x "$HELPER"
cat > "$VIS_AGENT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.tokenjuice.visibility</string>
  <key>ProgramArguments</key><array><string>$HELPER</string></array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>15</integer>
</dict>
</plist>
EOF
chmod 644 "$VIS_AGENT"
launchctl bootout "gui/$(id -u)/com.tokenjuice.visibility" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$VIS_AGENT" >/dev/null 2>&1 || true
dim "   ✓ wake refresh agent: $VIS_AGENT"

# ── Done ────────────────────────────────────────────────
echo
bold "✅ Done!  Look at the top-right of your menu bar (refreshes every 5s)"
echo
echo "Two things to remember:"
echo "  1. 🔑 If macOS shows a keychain prompt  →  click 'Always Allow'"
echo "     (used to read your Claude usage; no token is ever stored)"
echo "  2. If the battery says 'log in first'  →  run  claude  in a terminal and sign in"
echo
dim "Issues? https://github.com/kendrick-na/tokenjuice/issues"
