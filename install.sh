#!/bin/bash
# Claude Codex Battery 설치 스크립트
set -e
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$HOME/.swiftbar-plugins"
PLUGIN="claude-codex-battery.5s.js"

echo "① bun 확인..."
command -v bun >/dev/null || { echo "bun이 없습니다: curl -fsSL https://bun.sh/install | bash"; exit 1; }

echo "② SwiftBar 확인..."
if [ ! -d "/Applications/SwiftBar.app" ]; then
  echo "   SwiftBar 설치 중 (brew)..."
  brew install --cask swiftbar
fi

echo "③ 플러그인 복사..."
mkdir -p "$PLUGIN_DIR"
cp "$SELF_DIR/$PLUGIN" "$PLUGIN_DIR/$PLUGIN"
# SwiftBar는 로그인 셸 PATH를 못 볼 수 있어 bun 절대경로로 shebang 교체 (설치본에만)
BUN_PATH="$(command -v bun)"
sed -i '' "1s|.*|#!$BUN_PATH|" "$PLUGIN_DIR/$PLUGIN"
chmod +x "$PLUGIN_DIR/$PLUGIN"

echo "④ SwiftBar 플러그인 폴더 지정..."
defaults write com.ameba.SwiftBar PluginDirectory -string "$PLUGIN_DIR"
defaults write com.ameba.SwiftBar SUEnableAutomaticChecks -bool false 2>/dev/null || true

echo "⑤ SwiftBar 실행..."
open -a SwiftBar

echo "✅ 완료! 메뉴바에 배터리가 나타납니다 (2분마다 갱신)."
echo "   ⚠️ 처음에 키체인 접근 확인창이 뜨면 '항상 허용'을 눌러주세요."
