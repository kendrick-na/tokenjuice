#!/usr/bin/env bash
set -euo pipefail

# Safe macOS notification contract smoke test.
# Default mode captures payloads in a throwaway HOME and never calls osascript.
# OS presentation requires BOTH --allow-os-notification and an exact confirmation
# phrase. Do not use that mode in CI or against a normal user profile.

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'SKIP: macOS notification smoke requires Darwin; no notification was sent.\n'
  exit 0
fi

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENGINE="$ROOT/claude-codex-battery.5s.js"
BUN=${BUN:-$(command -v bun || true)}
OS_MODE=0

if [[ "${1:-}" == "--allow-os-notification" ]]; then
  OS_MODE=1
  if [[ "${TOKENJUICE_CONFIRM_OS_NOTIFICATION:-}" != "I_UNDERSTAND_TOKENJUICE_WILL_NOTIFY" ]]; then
    printf 'Refusing OS notification mode. Set TOKENJUICE_CONFIRM_OS_NOTIFICATION=I_UNDERSTAND_TOKENJUICE_WILL_NOTIFY as a second explicit opt-in.\n' >&2
    exit 2
  fi
fi

if [[ -z "$BUN" || ! -x "$BUN" ]]; then
  printf 'SKIP: bun is unavailable; no notification was sent.\n'
  exit 0
fi

if [[ ! -f "$ENGINE" ]]; then
  printf 'FAIL: engine not found: %s\n' "$ENGINE" >&2
  exit 1
fi

HOME_DIR=$(mktemp -d "${TMPDIR:-/tmp}/tokenjuice-notify.XXXXXX")
trap 'rm -rf "$HOME_DIR"' EXIT

mkdir -p "$HOME_DIR/.config/claude-codex-battery"
printf '%s\n' '{"api":true,"autoRenew":false,"notify":{"enabled":true,"threshold":20,"reset":true,"overrides":{"claude:0":{"reconnect":true}}}}' > "$HOME_DIR/.config/claude-codex-battery/config.json"

FIXTURE="$HOME_DIR/usage-fixture.json"
NOTIFY_LOG="$HOME_DIR/notify.log"
write_fixture() {
  local status="$1" five="$2" week="$3"
  printf '{"status":%s,"body":{"five_hour":{"utilization":%s,"resets_at":"2030-01-01T00:00:00Z"},"seven_day":{"utilization":%s,"resets_at":"2030-01-02T00:00:00Z"}},"headers":{}}\n' "$status" "$five" "$week" > "$FIXTURE"
}

run_engine() {
  HOME="$HOME_DIR" USERPROFILE="$HOME_DIR" \
    CCB_API=1 CCB_COMPACT=0 CCB_TOPICS= \
    CCB_TEST_USAGE_FIXTURE="$FIXTURE" \
    CCB_CLAUDE_BIN="$HOME_DIR/no-claude" \
    "$@" "$BUN" "$ENGINE" >/dev/null
}

if (( OS_MODE == 0 )); then
  export CCB_TEST_NOTIFY_LOG="$NOTIFY_LOG"
else
  printf 'WARNING: OS notification mode is enabled for this isolated temporary HOME.\n'
  unset CCB_TEST_NOTIFY_LOG
fi

# Threshold: one alert, even across an identical refresh.
write_fixture 200 85 10
run_engine
run_engine

# Reset: invalidate only the throwaway cache, then verify one recovery alert.
# Keep the file inside the temporary HOME so the harness never deletes user data.
mkdir -p "$HOME_DIR/.cache/claude-codex-battery"
printf '{}\n' > "$HOME_DIR/.cache/claude-codex-battery/claude-0.json"
write_fixture 200 5 10
run_engine
run_engine

# Reconnect: account opt-in, one alert, no loop. The fixture replaces network
# and credential reads; auto renewal is explicitly disabled.
write_fixture 401 0 0
printf '{}\n' > "$HOME_DIR/.cache/claude-codex-battery/claude-0.json"
run_engine
run_engine

if (( OS_MODE == 0 )); then
  count=$(grep -c '^TokenJuice' "$NOTIFY_LOG" 2>/dev/null || true)
  [[ "$count" == 3 ]] || { printf 'FAIL: expected 3 captured notifications, got %s\n' "$count" >&2; sed -n '1,20p' "$NOTIFY_LOG" >&2; exit 1; }
  grep -q 'threshold alert' "$NOTIFY_LOG"
  grep -q 'reset alert' "$NOTIFY_LOG"
  grep -q 'reconnect required' "$NOTIFY_LOG"
  printf 'PASS: isolated dry-run captured threshold/reset/reconnect once each; osascript was suppressed.\n'
else
  printf 'PASS: isolated OS notification smoke completed; inspect Notification Center manually, then record only OS major/release/pass-fail.\n'
fi
