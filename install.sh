#!/bin/bash
# tokenjuice 설치 스크립트 — 처음 쓰는 사람도 안 헤매게
set -e
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$HOME/.swiftbar-plugins"
PLUGIN="claude-codex-battery.5s.js"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
dim()  { printf "\033[2m%s\033[0m\n" "$1"; }

bold "🔋 tokenjuice 설치를 시작합니다"
echo

# ── 1. bun ──────────────────────────────────────────────
echo "① bun 런타임 확인..."
if ! command -v bun >/dev/null; then
  echo "   bun이 없습니다. 지금 설치할까요? [y/N]"
  read -r ans
  if [[ "$ans" =~ ^[Yy]$ ]]; then
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  else
    echo "   ❌ bun 없이는 실행할 수 없습니다. https://bun.sh 참고 후 다시 실행하세요."
    exit 1
  fi
fi
dim "   ✓ bun $(bun --version)"

# ── 2. SwiftBar ─────────────────────────────────────────
echo "② SwiftBar 확인..."
if [ ! -d "/Applications/SwiftBar.app" ]; then
  if command -v brew >/dev/null; then
    echo "   SwiftBar 설치 중 (brew)..."
    brew install --cask swiftbar
  else
    echo "   ❌ SwiftBar가 없고 Homebrew도 없습니다."
    echo "      https://github.com/swiftbar/SwiftBar/releases 에서 받아 설치 후 다시 실행하세요."
    exit 1
  fi
fi
dim "   ✓ SwiftBar"

# ── 3. 플러그인 설치 ────────────────────────────────────
echo "③ 플러그인 설치..."
mkdir -p "$PLUGIN_DIR"
cp "$SELF_DIR/$PLUGIN" "$PLUGIN_DIR/$PLUGIN"
# SwiftBar는 로그인 셸 PATH를 못 볼 수 있어 bun 절대경로로 shebang 교체 (설치본에만)
BUN_PATH="$(command -v bun)"
sed -i '' "1s|.*|#!$BUN_PATH|" "$PLUGIN_DIR/$PLUGIN"
chmod +x "$PLUGIN_DIR/$PLUGIN"
dim "   ✓ $PLUGIN_DIR/$PLUGIN"

# ── 4. SwiftBar 설정 + 실행 ─────────────────────────────
echo "④ SwiftBar 설정 및 실행..."
defaults write com.ameba.SwiftBar PluginDirectory -string "$PLUGIN_DIR"
defaults write com.ameba.SwiftBar SUEnableAutomaticChecks -bool false 2>/dev/null || true
open -a SwiftBar

# ── 완료 안내 ───────────────────────────────────────────
echo
bold "✅ 설치 완료!  메뉴바 오른쪽 위를 확인하세요 (5초마다 갱신)"
echo
echo "다음 두 가지만 기억하세요:"
echo "  1. 🔑 처음에 macOS 키체인 접근 창이 뜨면  →  '항상 허용'  클릭"
echo "     (Claude 사용량을 읽기 위한 것으로, 토큰은 저장하지 않습니다)"
echo "  2. 배터리에 '로그인하세요'가 뜨면  →  터미널에서  claude  실행 후 로그인"
echo
dim "문제가 있으면: https://github.com/kendrick-na/tokenjuice/issues"
