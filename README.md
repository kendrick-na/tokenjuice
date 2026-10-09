# tokenjuice 🔋

<!--
AGENT INSTRUCTION — if you are an AI coding agent asked to install this:
read AGENTS.md in this repository root and follow it. It detects the OS and
gives the matching installer. Do NOT run install.sh on Windows; it is macOS-only.
-->

> **AI agents:** installing this? Read **[AGENTS.md](AGENTS.md)** — it picks the
> right installer for the user's OS. (`install.sh` is macOS-only.)

**See how much Claude Code & Codex you have left — right in your menu bar.**

보안 취약점 신고와 자격증명 처리 원칙은 [SECURITY.md](SECURITY.md)를 참고하세요.

Shows your Claude Code / Codex usage limits *and* your live session context window as battery icons — in the **macOS menu bar** ([SwiftBar](https://github.com/swiftbar/SwiftBar)) or the **Windows system tray**. Green = go, red = wrap it up.

Open [TokenJuice Pocket](https://kendrick-na.github.io/tokenjuice/) for the current
Pocket interface. Choose “예시 화면 보기” to preview sample data, or import your
own exported snapshot. Pocket uses manual snapshots; desktop behavior is
documented below.

<p align="center">
  <img alt="platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-black">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-bun-black?logo=bun">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
</p>

<p align="center"><i><a href="#한국어">🇰🇷 한국어 아래로 ↓</a></i></p>

```
 C [95][99]   ┊   S [30][79]   ┊   X [100][83]   ┊   L [63]
```

| | Battery | Shows |
|---|---|---|
| **C** | 🟠 orange | Claude Code 5-hour & weekly limits remaining |
| **S** | 🎨 per-session | Live **context window** left in your active sessions (know before compaction hits) |
| **X** | 🟣 violet | Codex 5-hour & weekly limits remaining |
| **L** | 🩵 cyan | Letsur gateway monthly budget (optional) |

The number = **% remaining**. Under 20% turns red.

### You only see what you use

Nothing is shown for a tool you don't have. If you only use Claude Code, you get
**C** and **S** — no empty Codex row taking up space.

| Battery | Appears when | Claude-only user |
|---|---|---|
| **C** | you're logged in to Claude Code | ✅ |
| **S** | a session was active in the last 15 min | ✅ |
| **X** | `~/.codex` exists (Codex has been run) | — hidden |
| **L** | you configured Letsur yourself | — hidden |

If **C** is blank, the menu says why and how to fix it — usually [API mode](#privacy--security)
is off, which is the default. Sessions and Codex work regardless.

---

> **On Windows?** Jump to [Windows](#windows) — there's a native system-tray build.

## Requirements

- **macOS** or **Windows 10 1809+ / 11** (Linux: CLI only, see [Linux](#linux))
- **[bun](https://bun.sh)** — the runtime (installer offers to set it up for you)
- **[SwiftBar](https://github.com/swiftbar/SwiftBar)** — macOS only, the menu bar host. The installer fetches it with **[Homebrew](https://brew.sh)**, so on macOS you need Homebrew unless SwiftBar is already installed.
- **Claude Code and/or Codex installed & used** — tokenjuice reads their local files (no login step needed unless you opt into API mode; see [Privacy & security](#privacy--security))

## Install (macOS)

```bash
git clone https://github.com/kendrick-na/tokenjuice.git
cd tokenjuice
./install.sh
```

The installer checks bun & SwiftBar (auto-installing what's missing), registers the plugin, launches SwiftBar, and adds it to your login items plus a per-user LaunchAgent fallback so it survives reboots.

If the menu-bar battery is not visible, run the read-only installation doctor from the repository root:

```bash
./install.sh --doctor
```

It checks Bun, SwiftBar, the installed plugin, source freshness, process state, and whether the local engine can start. It does not launch SwiftBar, change permissions, access the Keychain, or send provider requests — even if API mode is enabled in your normal config.

> **No keychain prompt by default.** Sessions & Codex work from local files immediately. Claude limits only need the keychain if you turn on [API mode](#privacy--security) — and only then does macOS ask you to *Always Allow*.

### Update / uninstall

The installer *copies* the engine into place, so `git pull` alone leaves your menu
bar on the old version. Re-run the installer after pulling:

```bash
cd tokenjuice && git pull && ./install.sh      # macOS
cd tokenjuice && git pull && cd windows && .\install.ps1   # Windows (PowerShell)
```

Check whether you're running stale code (skip line 1 — the installer rewrites the
shebang to bun's absolute path, so a plain `diff` always reports a difference):
```bash
diff <(tail -n +2 ~/.swiftbar-plugins/tokenjuice-battery.5s.js) \
     <(tail -n +2 ./claude-codex-battery.5s.js) && echo "up to date"
```

To remove it: delete `~/.swiftbar-plugins/tokenjuice-battery.5s.js`, `~/Library/LaunchAgents/com.tokenjuice.visibility.plist`, `~/Library/Application Support/TokenJuice/` and
`~/Library/LaunchAgents/com.tokenjuice.swiftbar.plist` (macOS), or
`tokenjuice.lnk` from your Startup folder (`shell:startup`, Windows). Nothing else
is left behind — the only other traces are `~/.cache/claude-codex-battery` and
`~/.config/claude-codex-battery`, both safe to delete.

### Install it with an AI agent

Paste this to Claude Code, Codex, Cursor, or any coding agent. This is enough —
the agent finds [`AGENTS.md`](AGENTS.md) itself, detects your OS, and runs the
matching installer:

> Install tokenjuice from https://github.com/kendrick-na/tokenjuice

Both installers auto-proceed with no TTY (or `CCB_YES=1`), so an agent can run
them end to end. Neither needs a login or keychain step by default.

If your agent ignores `AGENTS.md` and reaches for `install.sh` on Windows, point
it at the file explicitly: *"follow AGENTS.md in the repo root."* `install.sh`
also refuses to run on non-macOS and says where to go instead, so the worst case
is a wasted step rather than a broken install.

> On macOS, the one thing an agent **can't** do is click *Always Allow* on the
> keychain prompt — and that only appears if you opt into API mode later.

## Refresh rate

The filename `claude-codex-battery.5s.js` → refreshes every **5 seconds**.
- **Session context** is read from local transcript files every run → effectively real-time.
- **Claude/Codex limit APIs** are cached for 60s (so a 5s loop still calls the API only ~once/min).

Rename to `.2s.js` for faster, `.30s.js` for slower.

## Where the data comes from

| Group | Source |
|-------|--------|
| Claude limits | **①** local cache `~/.claude/**/usage-cache.json` (real-time, no network, **no keychain**) if present → **②** *opt-in* API mode: `api.anthropic.com/api/oauth/usage` (60s cache) |
| Session context | `~/.claude/projects/*/*.jsonl` — last usage totals (local files) |
| Codex context | `~/.codex/sessions/**/*.jsonl` — latest `last_token_usage` + `model_context_window` (local files) |
| Codex limits | `~/.codex/sessions/**/*.jsonl` — latest `rate_limits` (local files) |

## Privacy & security

Everything reads **your own local files** and renders locally. Specifically:

- **By default, tokenjuice never touches your keychain.** Sessions and Codex read local files only. Claude limits read a local cache file if your Claude Code version writes one.
- **API mode is strictly opt-in.** Some Claude Code versions don't write a local usage cache. Only then, *and only if you explicitly turn it on* (`export CCB_API=1` or `config.json {"api": true}`), does tokenjuice read the Claude OAuth token from your keychain to call the **read-only** usage endpoint. The token is used in-memory for that one request — never stored, never sent anywhere else.
- **Nothing leaves your machine** except that optional usage call to Anthropic's own API.
- **It's one auditable file** (~35 KB of plain JS, no dependencies). Read it before you run it.

## Sessions (S)

- Merges **Claude Code + Codex** sessions, newest first (🟠 Claude / 🟣 Codex in the dropdown).
- Codex session context uses the session log's own `model_context_window` when available, so the remaining percentage tracks the active window instead of a fixed guess.
- Menu bar shows the **3 most at-risk** sessions (least context left) + a `+N` badge; the dropdown lists up to 8 with project, topic, git branch, model, tokens.
- Each session gets a distinct color — menu bar battery matches the `■` swatch in the dropdown.
- `⚠️ compaction imminent` warning above 80% context used.

## Letsur (optional gateway budget)

Letsur has no "remaining balance" API — responses only carry `estimated_cost`. So tokenjuice tracks **cumulative spend vs a monthly limit** you set.

`~/.config/claude-codex-battery/letsur.json`:
```json
{ "monthlyLimit": 100, "currency": "unit", "label": "Letsur" }
```
Feed spend via `bun claude-codex-battery.5s.js letsur add <cost>` (from a proxy/wrapper), or point `usageFile` at a `{ "spent": <n> }` JSON. Auto-resets on the 1st of each month.

## GitHub Copilot Premium requests (optional)

TokenJuice can show the **monthly Premium-request spend** from GitHub's official
usage API. It is intentionally a cost line, not a battery or a “requests left”
claim: GitHub's report is monetary and does not provide a personal quota percent.
It is off until you explicitly configure it, and it never searches the keychain,
Git credential helper, or an existing `GH_TOKEN`.

```json
// ~/.config/claude-codex-battery/config.json
{
  "copilot": {
    "enabled": true,
    "username": "your-github-login",
    "tokenEnv": "TOKENJUICE_GITHUB_TOKEN",
    "monthlyBudgetUsd": 20
  }
}
```

Set `TOKENJUICE_GITHUB_TOKEN` only in the environment that launches TokenJuice.
Use a GitHub fine-grained personal access token with the documented billing/Plan
read permission. `monthlyBudgetUsd` is your own alerting budget, not a GitHub
limit; omit it to display only the reported spend. The response is cached for
15 minutes, and an error hides the number rather than showing a stale cost.

## Multiple accounts

Split config dirs and tokenjuice auto-detects each + labels it from `.claude.json` → `oauthAccount` (org/email):
```bash
CLAUDE_CONFIG_DIR=~/.claude-work claude   # log into your work account here
```
`~/.claude` and `~/.claude-work` then show as separate battery groups. Manual override: `~/.config/claude-codex-battery/accounts.json`.

## Windows

Same batteries, in the system tray. Both platforms run the **same engine**
(`claude-codex-battery.5s.js`) — only the drawing layer differs, so the numbers
can't drift between them.

### Option A — from source (2 commands)

```powershell
git clone https://github.com/kendrick-na/tokenjuice.git
cd tokenjuice\windows
.\install.ps1
```

`install.ps1` checks bun and Python (offering to install bun if missing),
installs the two Python packages, registers a start-at-login shortcut, runs a
smoke test, and launches the tray.

### Option B — the exe

Grab `tokenjuice.exe` from [Releases](https://github.com/kendrick-na/tokenjuice/releases),
keep `claude-codex-battery.5s.js` **in the same folder**, and double-click.
Python is bundled; you still need [bun](https://bun.sh):

Every release is built and smoke-tested on a real Windows runner by
[CI](.github/workflows/windows-build.yml) — the exe is only published if it
starts and runs.

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

> **Can't see the icon?** Windows hides new tray icons by default. Click the
> **^** arrow next to the clock, then drag tokenjuice onto the taskbar to pin it.

### Will it run on my machine?

`install.ps1` checks all of this before touching anything and tells you if not.

| Your machine | Works? |
|---|---|
| Windows 11 (any) | ✅ |
| Windows 10 **1809+** (Oct 2018 or newer), AVX2 CPU | ✅ |
| Windows 10 older than 1809 | ❌ bun needs 1809+ |
| Windows 7 / 8 / 8.1 | ❌ bun unsupported |
| **x64 CPU without AVX2** (pre-2013 Intel, pre-2015 AMD) | ❌ see below |
| Windows on ARM (Snapdragon) | ✅ bun ships a native arm64 build |
| Windows Server 2019+ | ✅ |
| Inside WSL | ✅ but that's the Linux path — use the CLI |

In practice: **any Windows laptop from roughly 2014 onward is fine.**

> **The AVX2 catch.** bun's x64 build needs AVX2, and its fallback for older CPUs
> currently crashes on startup ([oven-sh/bun#28399](https://github.com/oven-sh/bun/issues/28399),
> open). So a pre-2013-era CPU can't run tokenjuice until that's fixed upstream —
> nothing we can work around from here. `install.ps1` detects it and says so
> rather than letting you hit the panic. Such a machine can still use the
> [CLI](#linux) output if it has any working JS runtime.

**Requirements:** Windows 10 1809+ / 11 · [bun](https://bun.sh) · Python 3.9+ (only for Option A)

<details>
<summary><b>Why does it need bun? Can't it be one file?</b></summary>

Both platforms run the *same* engine, and bun is what runs it. The alternative —
reimplementing the usage calculations in Python so the exe stands alone — was
considered and rejected: two copies of that logic means one eventually goes
stale, and a stale copy reports a **wrong number**. Being told you have 20% left
and then getting cut off is worse than running one install command.

Bundling bun into the exe is possible but adds 94MB (that's the Bun runtime;
`--minify` doesn't help), which is also worse than a one-line install.

</details>

### How the tray icon differs from the menu bar

The Windows tray gives an app ~16×16 px — far less than a macOS menu bar. So
instead of the wide `C [95][99]` strip, the tray stacks the **three tightest
batteries** vertically and puts every number in the menu, where there's room to
read it. Hover for a one-line summary; click for the full breakdown.

| State | Icon |
|---|---|
| Healthy | green battery, mostly full |
| Under 50% | yellow |
| Under 20% | red |
| Exhausted (0%) | red battery with an ✕ through it |
| No data yet | grey outline |
| Engine error | red ✕ (open the menu for the reason) |

### Windows-specific commands

```powershell
python tokenjuice_tray.py            # run in the foreground
python tokenjuice_tray.py --once     # print one reading and exit (debugging)
.\build-exe.ps1                      # build dist\tokenjuice.exe yourself
.\install.ps1 -NoAutostart           # install without start-at-login
```

To remove it: delete `tokenjuice.lnk` from your Startup folder
(`shell:startup`) and quit from the tray menu.

## Linux

No tray build. The engine is cross-platform, so feed the CLI into your own bar
(Waybar, polybar, i3blocks):

```bash
bun claude-codex-battery.5s.js --text   # human-readable
bun claude-codex-battery.5s.js --json   # structured, for tray widgets
bun claude-codex-battery.5s.js --statusline # compact shell/statusline, opt-in
```

## Privacy: session topics

A session's "topic" is **your raw prompt text**. Since a menu bar and a tray are
both visible in screen shares and screenshots, topics are **hidden by default**
on every platform, and stripped from `--json` entirely rather than merely
hidden at render time.

Turn them on only if you want them:

```bash
export CCB_TOPICS=1                                   # macOS / Linux
bun claude-codex-battery.5s.js --json --topics         # one-off
```
On Windows, use **Show prompt topics** in the tray menu. Or set
`{"topics": true}` in `~/.config/claude-codex-battery/config.json`.

## License

MIT

---

<a name="한국어"></a>

# tokenjuice 🔋 (한국어)

**Claude Code & Codex 얼마나 남았는지 — 맥 메뉴바에서 배터리로.**

Claude Code / Codex 사용 한도와 **지금 세션의 컨텍스트 잔량**을 배터리로 보여주는 [SwiftBar](https://github.com/swiftbar/SwiftBar) 플러그인. 초록=여유, 빨강=곧 소진.

최신 Pocket 화면은 [TokenJuice Pocket](https://kendrick-na.github.io/tokenjuice/)에서 확인하세요. **예시 화면 보기**로 샘플 데이터를 살펴보거나 내보낸 스냅샷을 가져올 수 있습니다. Pocket은 수동 스냅샷 방식이며 데스크톱 동작은 아래 안내를 따릅니다.

| | 배터리 | 표시 |
|---|---|---|
| **C** | 🟠 주황 | Claude Code 5시간·주간 한도 잔량 |
| **S** | 🎨 세션색 | 지금 작업 중인 세션의 **컨텍스트 창** 잔량 (컴팩트 전에 미리 앎) |
| **X** | 🟣 보라 | Codex 5시간·주간 한도 잔량 |
| **L** | 🩵 청록 | Letsur 게이트웨이 월 한도 (선택) |

배터리 숫자 = **남은 %**. 20% 미만은 빨강 경고.

### 안 쓰는 건 안 뜬다

없는 도구는 아예 표시되지 않는다. Claude Code만 쓰면 **C·S만** 뜨고, 빈 Codex 칸이
자리를 차지하지 않는다.

| 배터리 | 뜨는 조건 | 클로드만 쓰면 |
|---|---|---|
| **C** | Claude Code 로그인됨 | ✅ |
| **S** | 최근 15분 내 세션 활동 | ✅ |
| **X** | `~/.codex` 존재 (Codex 실행한 적 있음) | — 숨김 |
| **L** | Letsur를 직접 설정 | — 숨김 |

**C**가 비어 있으면 메뉴가 이유와 해결법을 알려준다 — 대개 [API 모드](#privacy--security)가
꺼져 있어서인데, 그게 기본값이다. 세션·Codex는 그것과 무관하게 작동한다.

## 준비물

- **macOS** 또는 **Windows 10/11** (리눅스는 CLI 모드)
- **[bun](https://bun.sh)** — 런타임 (설치 스크립트가 자동 설치 제안)
- **[SwiftBar](https://github.com/swiftbar/SwiftBar)** — 맥 전용, 메뉴바 호스트 (설치 스크립트가 brew로 설치)
- **Claude Code에 로그인돼 있어야 함** (터미널에서 `claude`) — 사용량 데이터 출처

> **윈도우 사용자는** 아래 [윈도우](#윈도우) 섹션으로. 시스템 트레이 전용 빌드가 있다.

## 설치 (macOS)

```bash
git clone https://github.com/kendrick-na/tokenjuice.git
cd tokenjuice
./install.sh
```

bun·SwiftBar를 확인(없으면 자동 설치)하고 플러그인을 등록한 뒤 SwiftBar를 띄우고, **로그인 항목에 등록해 재부팅 후에도 자동 실행**되게 한다.

메뉴바에 배터리가 보이지 않으면 설치 폴더에서 아래 읽기 전용 진단을 실행한다. Bun·SwiftBar·플러그인·실행 상태·엔진 시작 가능 여부를 단계별로 확인하며, 앱을 새로 실행하거나 권한을 바꾸지 않고, 기존 설정에 API 모드가 켜져 있어도 키체인·제공자 요청을 사용하지 않는다.

```bash
./install.sh --doctor
```

> **기본은 키체인 접근 없음.** 세션·Codex는 로컬 파일만 읽어 바로 뜬다. Claude 한도는 로컬 캐시가 없는 버전에서만, 그리고 **직접 API 모드를 켤 때만**(`export CCB_API=1`) 키체인 토큰을 읽는다. 그때만 macOS가 "항상 허용"을 묻는다.

**개인정보/보안**: 전부 **내 로컬 파일**만 읽어 로컬에서 렌더. 기본값은 키체인 미접근. API 모드는 옵트인이며, 켜도 토큰은 **읽기 전용 조회 1회에 메모리에서만** 쓰고 저장·전송하지 않는다. 단일 파일(약 35KB, 의존성 0)이라 실행 전 직접 감사 가능.

**AI 에이전트로 설치**: 클로드 코드·Codex·커서 등에 **이 한 줄만** 붙여넣으면 된다.
에이전트가 [`AGENTS.md`](AGENTS.md)를 알아서 찾아 읽고, 내 OS를 판별해 맞는 설치본을 고른다.

> https://github.com/kendrick-na/tokenjuice 에서 tokenjuice를 설치해줘

양쪽 설치 스크립트 모두 비대화형(TTY 없거나 `CCB_YES=1`)에서 자동 진행되고, 기본
설치엔 **키체인·로그인 단계가 없다**.

혹시 에이전트가 `AGENTS.md`를 무시하고 윈도우에서 `install.sh`를 잡으면
**"저장소 루트의 AGENTS.md를 따라"**라고 한 마디 덧붙이면 된다. `install.sh` 자체도
맥이 아니면 실행을 거부하고 갈 곳을 알려주므로, 최악이라도 헛걸음 한 번이다.

> ⚠️ 맥에서 API 모드를 켠 경우에만 나오는 키체인 "항상 허용" 클릭은 **에이전트가 못 한다.**
> 그 외 단계는 전부 자동으로 끝난다.

## 갱신 주기

파일명 `...5s.js` → **5초마다**. 세션 컨텍스트는 로컬 파일이라 사실상 실시간, 사용량 API는 60초 캐싱(레이트리밋 보호). `.2s.js`로 더 빠르게, `.30s.js`로 느리게.

## 데이터 출처 · 세션 · 멀티계정 · Letsur

위 영문 섹션과 동일 — 요약: Claude 한도는 **로컬 캐시 우선 → API 폴백**, 세션은 Claude+Codex 병합·위험순 3개+`+N`, 멀티계정은 config-dir 자동 감지, Letsur는 월 한도 대비 누적.

## 처음 설정 · 신뢰도 · 알림

처음 설치한 뒤에는 메뉴바 배터리를 한 번 눌러 **데이터 출처·마지막 성공 시각·재시도 시각**을 확인한다. 숫자는 다음 원칙으로 표시된다.

| 상태 | 뜻 | 숫자 표시 |
|---|---|---|
| 최신 (`fresh`) | 방금 성공적으로 읽은 값 | 표시 |
| 대체값 (`fallback`) | Claude Desktop의 최근 표본 | 표시하되 대체값으로 라벨링 |
| 오래됨/인증 만료/요청 제한 | 현재 값이라고 보장할 수 없음 | 메뉴바·CLI에서 숫자를 숨김 |

Claude API 모드의 로그인 갱신은 **기본 수동**이다. 로그인 만료가 보이면 메뉴의
`Renew Claude login now`를 누른다. 자동 갱신을 원할 때만 아래처럼 명시적으로 켠다.

```json
// ~/.config/claude-codex-battery/config.json
{
  "api": true,
  "autoRenew": true,
  "notify": { "enabled": true, "threshold": 20, "reset": true },
  "forecast": { "enabled": true },
  "sessionStatus": { "enabled": true }
}
```

`autoRenew`는 Claude CLI를 백그라운드에서 실행할 수 있으므로, 동작을 이해한 경우에만 켠다.
`notify`도 기본 꺼짐이다. 켜면 최신(`fresh`) 한도만 기준으로 20% 이하 경고와 리셋 후 회복 알림을 한 번씩 보낸다.
메뉴의 `Alert settings`에서 알림 켜기/끄기, threshold(10/20/30%), reset 알림을
직접 바꿀 수 있다. 설정은 로컬 config.json에만 저장되고 서버로 전송되지 않는다.
pace forecast를 켠 경우 메뉴에서 최근 7일의 로컬 관측값을 JSON으로 내보낼 수도 있다.
원문 prompt·코드·credential은 포함하지 않는다.

개발자는 필요할 때만 `bun claude-codex-battery.5s.js --developer`를 실행해 source,
last success, forecast samples/pace, session context 근거를 확인할 수 있다. 이 모드는
읽기 전용이며 prompt/topic 원문과 credential을 출력하지 않고 기본 메뉴 동작에도 영향을 주지 않는다.
`forecast`는 최근의 **로컬 사용률 관측값**으로 소진 예상 시각을 계산한다. 제공자 공식 예측이 아니며,
관측이 두 개 이상 쌓인 뒤에만 표시된다.
`sessionStatus`는 Claude/Codex의 마지막 로컬 로그를 읽어 작업 중·입력 대기·완료 같은
상태를 **휴리스틱**으로 표시한다. 제공자나 에이전트의 공식 상태가 아니므로 기본값은 꺼짐이다.

출처별 상태와 호환 필드는 [데이터 계약](docs/DATA_CONTRACT.md)에 기록돼 있다. 외부 위젯이나
트레이를 만들 때는 `used` 값만 쓰지 말고 `kind`·`state`·`trust`를 함께 해석해야 한다.

## 휴대폰 companion — TokenJuice Pocket

[`companion/`](companion/)은 iPhone·Android 브라우저에 홈 화면으로 추가할 수 있는 정적 PWA다.
모바일에 계정·토큰·프롬프트를 보관하지 않는다. Mac 메뉴의 **Pocket으로 내보내고 열기**를 누르면
안전한 스냅샷을 만들고 Pocket을 연다. 파일을 직접 휴대폰으로 옮겨 Pocket에서 가져온다. 이 과정은
터미널·로그인·계정 생성을 요구하지 않으며 스냅샷을 서버로 업로드하지 않는다. CLI가 더 편한 경우에는
다음 명령으로 같은 스냅샷을 만들 수 있다.

```bash
bun claude-codex-battery.5s.js --export-widget-snapshot
```

스냅샷은 `~/.cache/claude-codex-battery/widget-snapshot.json`에 생성된다. 자동 동기화는
의도적으로 제공하지 않는다. 파일을 다른 서비스로 전달해야 한다면, 설정·캐시에 암호를
남기지 않는 선택적 암호화 번들을 만들 수 있다.

```bash
TOKENJUICE_SYNC_PASSPHRASE='긴 암호' \
  bun claude-codex-battery.5s.js --export-sync-bundle
```

`widget-sync.tokenjuice`는 AES-256-GCM 암호문이며 Pocket에서 암호를 입력할 때만 복호화한다.
CloudKit·계정·자동 업로드는 수행하지 않는다. 자세한 사용·호스팅 방법은
[companion 안내](companion/README.md)를 본다.

## Cursor·Antigravity 등 추가 provider (선택)

TokenJuice는 브라우저 쿠키·기존 access token·키체인·명령 실행을 이용해 다른 AI 서비스의
사용량을 억지로 수집하지 않는다. 대신 사용자가 신뢰하는 exporter가 만든 **로컬 JSON 파일**을
명시적으로 지정하는 quota-file adapter를 제공한다. 예를 들어 Cursor exporter가 다음 파일을
갱신한다고 가정한다.

```json
// ~/Exports/cursor-usage.json
{
  "observedAt": 1791390000000,
  "items": [{ "name": "Monthly", "used": 42, "resets": "2026-10-31T00:00:00.000Z" }]
}
```

그 뒤 `~/.config/claude-codex-battery/config.json`에 이 파일만 연결한다.

```json
{
  "providers": [{
    "id": "cursor",
    "label": "Cursor",
    "usageFile": "~/Exports/cursor-usage.json"
  }]
}
```

파일의 `observedAt`이 15분을 넘으면 stale로 표시하고, 2시간을 넘기면 숫자를 숨긴다.
이 adapter는 네트워크·토큰·cookie·browser session·명령 실행을 전혀 사용하지 않는다. 따라서
Antigravity 등도 같은 안전한 파일 계약을 제공할 때만 추가한다.

## 프로젝트 컨텍스트·비용 리포트 (선택)

`bun claude-codex-battery.5s.js --project-report`는 최근 6시간 Claude/Codex 세션의
프로젝트별 context 상태를 JSON으로 출력한다. 비용은 기본적으로 계산하지 않는다. 제공자
가격은 변경될 수 있고 Codex 로그에는 완전한 token split이 항상 없기 때문이다.

Claude Code의 기록된 usage에 대해 비용을 보고 싶다면, 사용자가 확인한 가격을 직접
`config.json`에 USD/백만 토큰 단위로 입력한다. 값은 네트워크에서 내려받거나 추정하지 않는다.

```json
{
  "pricing": {
    "claude-sonnet-4": {
      "inputUsdPerM": 3,
      "outputUsdPerM": 15,
      "cacheCreationUsdPerM": 3.75,
      "cacheReadUsdPerM": 0.3
    }
  }
}
```

가격표와 token class가 모두 있는 Claude turn만 `available` 비용이 된다. 모델 또는 token
class가 빠진 turn, Codex 등 완전한 분해가 없는 프로젝트는 `partial` 또는 `unavailable`로
표시한다. 따라서 이 리포트의 비용은 제공자 청구서가 아니라 사용자가 입력한 가격표 기반의
로컬 계산값이다.

<a name="윈도우"></a>
## 윈도우

같은 배터리를 시스템 트레이에 띄운다. **엔진(`claude-codex-battery.5s.js`)은
맥과 완전히 동일**하고 그리는 층만 다르다 — 그래서 두 OS의 숫자가 어긋날 수 없다.

### 방법 A — 소스에서 (명령 2줄)

```powershell
git clone https://github.com/kendrick-na/tokenjuice.git
cd tokenjuice\windows
.\install.ps1
```

`install.ps1`이 bun·파이썬을 확인(bun 없으면 설치 제안)하고, 파이썬 패키지 2개를
깔고, **시작프로그램에 등록**하고, 동작 테스트를 한 뒤 트레이를 띄운다.

### 방법 B — exe

[Releases](https://github.com/kendrick-na/tokenjuice/releases)에서 `tokenjuice.exe`를
받고, `claude-codex-battery.5s.js`를 **같은 폴더에** 두고 더블클릭.
파이썬은 exe에 들어있고, [bun](https://bun.sh)만 따로 필요하다:

모든 릴리스는 [CI가 실제 윈도우에서 빌드·검증](.github/workflows/windows-build.yml)한다 —
exe가 실행되는 것까지 확인돼야 배포된다.

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

> **아이콘이 안 보이면** — 윈도우는 새 트레이 아이콘을 기본으로 숨긴다.
> 시계 옆 **^** 화살표를 누르고, tokenjuice를 작업표시줄로 끌어다 고정하면 된다.

### 내 컴퓨터에서 돌아갈까?

`install.ps1`이 **설치 전에 미리 확인**하고, 안 되면 이유를 알려준다.

| 내 환경 | 가능? |
|---|---|
| 윈도우 11 (전부) | ✅ |
| 윈도우 10 **1809 이상** (2018년 10월 이후), AVX2 CPU | ✅ |
| 윈도우 10 1809 미만 | ❌ bun이 1809+ 요구 |
| 윈도우 7 / 8 / 8.1 | ❌ bun 미지원 |
| **AVX2 없는 x64 CPU** (2013년 이전 인텔, 2015년 이전 AMD) | ❌ 아래 참고 |
| ARM 윈도우 (스냅드래곤) | ✅ bun arm64 정식 지원 |
| 윈도우 서버 2019+ | ✅ |
| WSL 안에서 | ✅ 단 리눅스 경로 → CLI 사용 |

현실적으로: **2014년 이후 윈도우 노트북이면 거의 다 된다.**

> ⚠️ **AVX2 함정.** bun의 x64 빌드는 AVX2가 필요하고, 구형 CPU용 대체 빌드는
> 지금 실행 즉시 크래시한다([oven-sh/bun#28399](https://github.com/oven-sh/bun/issues/28399), 미해결).
> 그래서 **2013년 이전 CPU는 bun 쪽이 고쳐질 때까지 못 쓴다** — 우리가 우회할 수
> 있는 문제가 아니다. `install.ps1`이 이걸 미리 감지해서 크래시 대신 안내를 띄운다.

**준비물**: 윈도우 10 1809+ / 11 · [bun](https://bun.sh) · 파이썬 3.9+ (방법 A만)

<details>
<summary><b>왜 bun이 필요한가? 파일 하나로 안 되나?</b></summary>

맥과 윈도우가 **같은 엔진**을 쓰고, 그 엔진을 돌리는 게 bun이다. 대안 — 계산 로직을
파이썬으로 다시 구현해 exe 하나로 만드는 것 — 은 검토했고 **기각했다**. 같은 계산이
두 벌이면 언젠가 한쪽이 낡고, 낡은 쪽은 **틀린 숫자**를 내놓는다. "20% 남았다"는 말을
믿고 쓰다가 갑자기 막히는 것이 설치 명령 한 줄보다 나쁘다.

bun을 exe에 넣는 것도 가능하지만 **94MB**가 붙는다(Bun 런타임 자체 크기이고
`--minify`로 줄지 않는다). 이것도 한 줄 설치보다 나쁘다.

</details>

### 트레이 아이콘이 메뉴바와 다른 이유

윈도우 트레이는 앱에 **16×16 픽셀**만 준다 — 맥 메뉴바보다 훨씬 좁다. 그래서
넓은 `C [95][99]` 띠 대신, **가장 빡빡한 배터리 3개**를 위아래로 쌓고 숫자는
전부 메뉴에 넣었다. 마우스를 올리면 한 줄 요약, 클릭하면 전체 내역이 나온다.

| 상태 | 아이콘 |
|---|---|
| 여유 | 초록 배터리, 거의 꽉 참 |
| 50% 미만 | 노랑 |
| 20% 미만 | 빨강 |
| 소진(0%) | 빨강 배터리에 ✕ |
| 데이터 없음 | 회색 테두리 |
| 엔진 오류 | 빨강 ✕ (메뉴 열면 이유 표시) |

### 윈도우 전용 명령

```powershell
python tokenjuice_tray.py            # 창에서 바로 실행
python tokenjuice_tray.py --once     # 한 번만 읽고 종료 (디버깅)
.\build-exe.ps1                      # exe 직접 빌드
.\install.ps1 -NoAutostart           # 시작프로그램 등록 없이 설치
```

삭제는 시작프로그램 폴더(`shell:startup`)에서 `tokenjuice.lnk`를 지우고 트레이
메뉴에서 종료하면 끝.

## 프라이버시: 세션 주제

세션 "주제"는 **내가 친 프롬프트 원문**이다. 메뉴바도 트레이도 화면공유·스크린샷에
그대로 찍히는 자리라서, **모든 OS에서 기본 숨김**이고 `--json`에서는 렌더만 막는
게 아니라 **키 자체를 빼버린다**.

보고 싶을 때만 켠다:

```bash
export CCB_TOPICS=1                                    # macOS / 리눅스
bun claude-codex-battery.5s.js --json --topics         # 일회성
```
윈도우는 트레이 메뉴의 **Show prompt topics**. 또는
`~/.config/claude-codex-battery/config.json`에 `{"topics": true}`.

## 라이선스

MIT
