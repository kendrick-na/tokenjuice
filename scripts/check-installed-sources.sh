#!/usr/bin/env bash
# Read-only installed-source comparison. Never executes a plugin/helper/installer.
# Optional explicit file paths support isolated tests; defaults match install.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="${1:-$HOME/.swiftbar-plugins/tokenjuice-battery.5s.js}"
WAKE_HELPER="${2:-$HOME/Library/Application Support/TokenJuice/ensure-swiftbar-visible.sh}"
failed=0

if [[ -f "$PLUGIN" ]]; then
  if cmp -s <(tail -n +2 "$PLUGIN") <(tail -n +2 "$ROOT/claude-codex-battery.5s.js"); then
    printf '✓ SwiftBar 설치본이 소스와 일치\n'
  else
    printf '✗ SwiftBar 플러그인 본문 불일치: 승인된 갱신 후 다시 확인하세요.\n' >&2
    failed=1
  fi
else
  printf '! SwiftBar 설치본 없음: 신규 설치·실기기 검증은 별도입니다.\n'
fi

if [[ -f "$WAKE_HELPER" ]]; then
  if cmp -s "$WAKE_HELPER" "$ROOT/scripts/ensure-swiftbar-visible.sh"; then
    printf '✓ SwiftBar 절전 복구 스크립트가 소스와 일치\n'
  else
    printf '✗ SwiftBar 절전 복구 스크립트 불일치: 기기 소유자의 갱신 승인 필요. 자동 설치/실행하지 않습니다.\n' >&2
    failed=1
  fi
else
  printf '! SwiftBar 절전 복구 스크립트 없음: 절전 복귀 검증은 미완료입니다.\n'
fi
exit "$failed"
