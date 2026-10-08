#!/usr/bin/env bash
# TokenJuice release-candidate verifier.
# It never installs dependencies, changes settings, commits, or publishes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() { printf '✗ %s\n' "$*" >&2; exit 1; }
pass() { printf '✓ %s\n' "$*"; }

command -v bun >/dev/null || fail "bun이 필요합니다."
command -v python3 >/dev/null || fail "python3가 필요합니다."

bun test tests/engine.test.js
pass "엔진 회귀 테스트"

bun build claude-codex-battery.5s.js --target bun --outfile /tmp/tokenjuice-engine-release-check.js >/dev/null
pass "Bun 번들"

bash -n install.sh scripts/ensure-swiftbar-visible.sh scripts/release-verify.sh
pass "macOS 설치·복구 스크립트 문법"

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
  kill "$COMPANION_PID" 2>/dev/null || true
  wait "$COMPANION_PID" 2>/dev/null || true
  trap - EXIT
  pass "Companion 브라우저 동작"
else
  printf '! Playwright가 없어 Companion 브라우저 동작 검증은 건너뜁니다. CI에서 반드시 실행됩니다.\n'
fi

git diff --check
pass "공백 오류 없음"

if [[ "$(uname -s)" == "Darwin" ]]; then
  INSTALLED="$HOME/.swiftbar-plugins/tokenjuice-battery.5s.js"
  if [[ -f "$INSTALLED" ]]; then
    if diff -q <(tail -n +2 "$INSTALLED") <(tail -n +2 claude-codex-battery.5s.js) >/dev/null; then
      pass "SwiftBar 설치본이 소스와 일치"
    else
      fail "SwiftBar 설치본이 소스보다 오래됐습니다. 설치 절차를 실행한 뒤 다시 확인하세요."
    fi
  else
    printf '! SwiftBar 설치본이 없습니다. 새 설치 검증은 별도 macOS 환경에서 수행하세요.\n'
  fi
fi

printf '\n릴리스 후보 기본 검증을 통과했습니다. Windows 실제 트레이 테스트와 새 설치 검증은 CI/테스트 장비에서 별도로 확인해야 합니다.\n'
