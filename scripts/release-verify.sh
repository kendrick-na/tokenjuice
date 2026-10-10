#!/usr/bin/env bash
# TokenJuice release-candidate verifier.
# It never installs dependencies, changes settings, commits, or publishes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() { printf '✗ %s\n' "$*" >&2; exit 1; }
pass() { printf '✓ %s\n' "$*"; }
REQUIRE_BROWSER=0
case "${1:-}" in
  "") ;;
  --require-browser) REQUIRE_BROWSER=1 ;;
  *) fail "지원하지 않는 옵션: ${1}. 공개 후보 검증은 --require-browser를 사용하세요." ;;
esac

command -v bun >/dev/null || fail "bun이 필요합니다."
command -v python3 >/dev/null || fail "python3가 필요합니다."

bun test tests/
pass "엔진 회귀 테스트"

bun build claude-codex-battery.5s.js --target bun --outfile /tmp/tokenjuice-engine-release-check.js >/dev/null
pass "Bun 번들"

bash -n install.sh scripts/ensure-swiftbar-visible.sh scripts/notification-smoke.sh scripts/release-verify.sh scripts/check-installed-sources.sh
pass "macOS 설치·복구 스크립트 문법"

scripts/notification-smoke.sh
pass "macOS 알림 contract dry-run"

python3 -m py_compile windows/tokenjuice_tray.py windows/selftest.py
pass "Windows Python 문법"

python3 -m py_compile tests/companion.test.py
pass "Companion 브라우저 테스트 문법"

if python3 -c 'import playwright' >/dev/null 2>&1; then
  python3 -m http.server 4173 --directory companion >/tmp/tokenjuice-companion.log 2>&1 &
  COMPANION_PID=$!
  trap 'kill "$COMPANION_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 30); do
    curl -fsS http://127.0.0.1:4173/ >/dev/null 2>&1 && break
    sleep 0.1
  done
  python3 tests/companion.test.py
  python3 tests/work-summary.test.py
  kill "$COMPANION_PID" 2>/dev/null || true
  wait "$COMPANION_PID" 2>/dev/null || true
  trap - EXIT
  pass "Companion 브라우저 동작"
else
  if [[ "$REQUIRE_BROWSER" == 1 ]]; then
    fail "Playwright가 없어 브라우저 검증을 실행하지 못했습니다. 출시 후보 검증은 통과하지 않습니다."
  fi
  printf '! Playwright가 없어 Companion 브라우저 동작 검증은 건너뜁니다. CI에서 반드시 실행됩니다.\n'
fi

git diff --check
pass "공백 오류 없음"

if [[ "$(uname -s)" == "Darwin" ]]; then
  bash scripts/check-installed-sources.sh
fi

printf '\n자동 검증 범위만 통과했습니다. 실제 Claude/Codex 수집·신규 설치·절전 복귀·Windows 트레이·디자인/사용자 검증·스토어 출시는 별도 게이트이며 이 결과로 완료 처리하지 않습니다.\n'
