#!/bin/bash
# tokenjuice installer — friendly for humans, safe for agents (non-interactive)
set -e
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="${SWIFTBAR_PLUGIN_DIR:-$HOME/.swiftbar-plugins}"
PLUGIN="claude-codex-battery.5s.js"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
dim()  { printf "\033[2m%s\033[0m\n" "$1"; }

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
sed "1s|.*|#!$BUN_PATH|" "$SELF_DIR/$PLUGIN" > "$PLUGIN_DIR/$PLUGIN"
chmod +x "$PLUGIN_DIR/$PLUGIN"
dim "   ✓ $PLUGIN_DIR/$PLUGIN"

# ── 4. Point SwiftBar at the folder + launch ────────────
echo "④ Configuring & launching SwiftBar..."
BID=$(defaults read /Applications/SwiftBar.app/Contents/Info CFBundleIdentifier 2>/dev/null || echo "com.ameba.SwiftBar")
defaults write "$BID" PluginDirectory -string "$PLUGIN_DIR"
defaults write "$BID" SUEnableAutomaticChecks -bool false 2>/dev/null || true
open -a SwiftBar

# ── 5. Launch at login (so it survives reboots) ─────────
echo "⑤ Registering launch-at-login..."
if osascript -e 'tell application "System Events" to get the name of every login item' 2>/dev/null | grep -qi swiftbar; then
  dim "   ✓ already a login item"
elif osascript -e 'tell application "System Events" to make login item at end with properties {path:"/Applications/SwiftBar.app", hidden:false}' >/dev/null 2>&1; then
  dim "   ✓ registered (auto-starts after reboot)"
else
  dim "   ⓘ couldn't auto-register — turn on 'Launch at Login' in the SwiftBar menu"
fi

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
