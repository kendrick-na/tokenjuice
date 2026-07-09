# Claude Codex Battery 🔋

맥 메뉴바에 **Claude Code / Codex 사용량 + 세션 컨텍스트 잔량**을 배터리 아이콘으로 띄우는 SwiftBar 플러그인.

![demo](docs/demo.gif)

```
 C [95][99]  ┊  S [30][79]  ┊  X [100][83]  ┊  L [63]
```

- **C** (주황, Anthropic 브랜드) — Claude Code 5시간·주간 사용 한도 잔량
- **S** (세션색) — 지금 작업 중인 세션의 컨텍스트 창(200k/1M) 잔량
- **X** (보라, Codex 브랜드) — Codex 5시간·주간 사용 한도 잔량

배터리 숫자 = **남은 %**. 20% 미만은 빨강 경고.

## 설치

```bash
./install.sh
```

bun·SwiftBar(brew) 자동 확인 후 `~/.swiftbar-plugins/`에 등록하고 SwiftBar를 띄운다.
처음 실행 시 키체인 접근 확인창이 뜨면 **"항상 허용"**을 누른다.

## 갱신 주기

파일명이 `claude-codex-battery.5s.js` → **5초마다** 갱신.
- **세션 컨텍스트**: 매 실행마다 로컬 트랜스크립트 파일을 직접 읽어 사실상 실시간.
- **Claude/Codex 사용량 API**: 레이트리밋 보호를 위해 캐시 TTL 60초 (5초마다 돌아도 API는 분당 1회).

더 빠르게(2초) 하려면 파일명을 `.2s.js`로, 느리게는 `.30s.js` 등으로 바꾸면 된다.

## 데이터 출처

| 그룹 | 출처 |
|------|------|
| Claude 한도 | `api.anthropic.com/api/oauth/usage` (키체인 OAuth 토큰) |
| 세션 컨텍스트 | `~/.claude/projects/*/*.jsonl` 마지막 usage 합산 |
| Codex 한도 | `~/.codex/sessions/**/*.jsonl` 최신 `rate_limits` |

## 세션 구분 (S)

- **Claude Code와 Codex 세션을 함께** 최근순으로 병합해 표시 (드롭다운에 🟠 Claude / 🟣 Codex 아이콘).
- 15분 내 활동한 세션을 메뉴바에 최대 2개, 드롭다운엔 최근 5개 표시.
- 각 세션은 **teal / pink / sky / lime** 고유색 — 메뉴바 배터리색과 드롭다운 `■` 색이 일치.
- 드롭다운에 플랫폼 · 프로젝트명 · **세션 주제**(첫 메시지/요약) · git 브랜치 · 모델 · 토큰(사용/창) · 세션 ID 표시.
- Claude 컨텍스트 창은 200k(1M 베타 자동 감지), Codex는 272k 기준.
- 컨텍스트 80% 이상 쓰면 `⚠️컴팩트 임박` 경고.

## 세션이 많을 때 (여러 세션 동시)

메뉴바는 가로 공간이 좁으니 **가장 위험한(컨텍스트가 적게 남은) 세션 3개**를 우선 배터리로 띄우고,
나머지는 `+N` 배지로 요약한다. **전부 보려면 드롭다운**을 열면 된다 — 세로라 개수 제한 없이
최근 8개까지 플랫폼·프로젝트·주제·브랜치·모델·토큰까지 나열된다.
곧 컴팩트될 세션을 놓치지 않도록 "위험순 우선" 노출이 기본이다.

## Letsur (게이트웨이 월 한도)

Letsur는 "남은 잔액" API가 없고 호출 응답의 `estimated_cost`(unit)만 준다. 그래서 **월 한도 대비 누적**으로 잔량을 계산한다.

`~/.config/claude-codex-battery/letsur.json`:
```json
{ "monthlyLimit": 100, "currency": "unit", "label": "Letsur" }
```

⚠️ **unit이 달러/원/크레딧 중 무엇인지는 공급자(대시보드/KAIST 창업원)에게 확인**해야 한다.
공개 문서엔 unit 환율 정의가 없다. 배터리는 "한도 대비 %"만 보여주므로 통화 정의와 무관하게 동작한다.

누적 입력 2가지:
```bash
# 1) 호출할 때마다 프록시/래퍼가 비용 적립
bun claude-codex-battery.5s.js letsur add 0.42
# 2) config.usageFile 에 {"spent": <누적>} JSON을 두면 그대로 읽음
```
매월 1일 자동 리셋. `letsur reset`으로 수동 초기화, `letsur status`로 현재 상태 확인.

## Windows / Linux

**데이터 읽기 로직은 크로스플랫폼**이지만, **메뉴바 표시는 macOS(SwiftBar) 전용**이다.
- macOS 전용 부분은 자동 분기 처리됨: 자격증명은 Windows/Linux에서 키체인 대신
  `~/.claude/.credentials.json` 평문 파일에서 읽고, 다크모드 감지도 스킵한다.
- Windows에서 쓰려면 메뉴바 호스트를 따로 붙여야 한다. 옵션:
  - **TrayBar / Traybar** 등 SwiftBar 유사 트레이 앱에 이 스크립트를 물리거나,
  - 스크립트를 `--json` 모드로 돌려 자체 트레이 앱(예: Electron·Tauri 트레이)에서 렌더.
  - (현재 스크립트는 SwiftBar 출력 포맷 고정. Windows 트레이용 포팅은 별도 작업 필요.)

**크로스플랫폼 CLI 모드** (메뉴바 없이 어디서나):
```bash
bun claude-codex-battery.5s.js --text   # 사람이 읽는 배터리 텍스트
bun claude-codex-battery.5s.js --json    # 다른 도구/트레이 위젯이 파싱할 JSON
```
이 CLI 출력을 각 OS의 기존 트레이/바 도구(Windows 트레이 유틸, Linux Waybar/polybar)에 물리면 된다.

## 여러 계정 쓰는 사람

**전략: config-dir 분리 + 자동 라벨링.**

맥 키체인은 서비스명(`Claude Code-credentials`)당 계정을 1개만 저장한다. 그래서
`claude /login`으로 계정만 바꾸는 방식은 **"지금 로그인된 1개"**만 보인다.

여러 계정을 **동시에** 배터리로 보려면 계정별로 설정 폴더를 나눈다:

```bash
# 회사 계정용 별도 폴더
CLAUDE_CONFIG_DIR=~/.claude-work claude   # 여기서 회사 계정 로그인
```

그러면 `~/.claude`(개인)와 `~/.claude-work`(회사)가 각각 하나의 계정으로 자동 감지되고,
각 폴더의 `.claude.json` → `oauthAccount`에서 **조직명/이메일을 읽어 라벨을 자동 생성**한다.
(예: `C[개인]  O[OverEdge]` 처럼 첫 글자 배지로 구분)

### 수동 지정 (완전 커스텀)

`~/.config/claude-codex-battery/accounts.json`:

```json
[
  { "name": "개인" },
  { "name": "회사", "credFile": "~/.claude-work/.credentials.json" }
]
```

이 파일이 있으면 자동 감지를 무시하고 이 목록만 쓴다.

## 라이선스

MIT
