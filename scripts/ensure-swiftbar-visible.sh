#!/bin/sh
# TokenJuice wake helper (R5). launchd runs this every 15s
# (~/Library/LaunchAgents/com.tokenjuice.visibility.plist).
#
# It used to force swiftbar://refreshallplugins on every tick (4×/min forever).
# Now it refreshes only when something actually happened:
#   • a wake: the previous tick is more than WAKE_GAP seconds old, i.e. launchd
#     skipped ticks because the Mac was asleep;
#   • SwiftBar was not running and had to be started.
# and never twice within DEBOUNCE seconds, so a wake storm is one refresh.
#
# Test seams: TJ_STATE_DIR, TJ_NOW (epoch s), TJ_SWIFTBAR_RUNNING (1/0),
# TJ_DRY_RUN=1 prints actions instead of running them.

STATE_DIR="${TJ_STATE_DIR:-$HOME/Library/Application Support/TokenJuice}"
NOW="${TJ_NOW:-$(date +%s)}"
WAKE_GAP="${TJ_WAKE_GAP:-60}"
DEBOUNCE="${TJ_DEBOUNCE:-30}"
mkdir -p "$STATE_DIR" 2>/dev/null

run() {
  if [ "${TJ_DRY_RUN:-0}" = "1" ]; then echo "RUN $*"; else "$@"; fi
}

running="${TJ_SWIFTBAR_RUNNING:-}"
if [ -z "$running" ]; then
  if pgrep -x SwiftBar >/dev/null 2>&1; then running=1; else running=0; fi
fi

last_tick=$(cat "$STATE_DIR/last-tick" 2>/dev/null || echo 0)
last_refresh=$(cat "$STATE_DIR/last-refresh" 2>/dev/null || echo 0)
echo "$NOW" > "$STATE_DIR/last-tick"

reason=""
if [ "$running" != "1" ]; then
  run /usr/bin/open -a /Applications/SwiftBar.app
  reason="swiftbar-started"
elif [ $((NOW - last_tick)) -gt "$WAKE_GAP" ]; then
  reason="wake"
fi

[ -z "$reason" ] && exit 0
if [ $((NOW - last_refresh)) -lt "$DEBOUNCE" ]; then
  [ "${TJ_DRY_RUN:-0}" = "1" ] && echo "SKIP debounce ($reason)"
  exit 0
fi

# Status items can come back hidden after sleep/wake; keep them visible.
BID=$(/usr/bin/defaults read /Applications/SwiftBar.app/Contents/Info CFBundleIdentifier 2>/dev/null || echo "com.ameba.SwiftBar")
for key in 'NSStatusItem Visible Item-0' 'NSStatusItem Visible Item-1' 'NSStatusItem Visible Item-2' 'NSStatusItem Visible Item-3'; do
  run /usr/bin/defaults write "$BID" "$key" -bool true
done
# The supported way to make every loaded plugin run again.
run /usr/bin/open -g 'swiftbar://refreshallplugins'
echo "$NOW" > "$STATE_DIR/last-refresh"
echo "$NOW $reason" >> "$STATE_DIR/refresh.log"
# keep the log short
tail -n 50 "$STATE_DIR/refresh.log" > "$STATE_DIR/refresh.log.tmp" 2>/dev/null && mv "$STATE_DIR/refresh.log.tmp" "$STATE_DIR/refresh.log"
exit 0
