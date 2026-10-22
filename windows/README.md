# tokenjuice — Windows tray

Claude Code / Codex usage batteries in the Windows system tray.

Explicit local Codex profiles can be configured with `codexAccounts` and
`codexSelectedAccount` in the shared engine config; see the main README for
the schema. The menu shows each profile's alias/state and lets you choose the
profile used by the X icon and Pocket export. This changes display selection
only, never Codex login or credentials. Invalid profile configuration/selection
does not silently fall back to another account. Real account-to-root mapping
and physical Windows UI acceptance still require manual verification.

```powershell
.\install.ps1
```

Full docs: see the [Windows section](../README.md#windows) in the main README.

## Files

| File | What it is |
|---|---|
| `tokenjuice_tray.py` | The tray app. Renderer only — no usage logic. |
| `install.ps1` | Checks bun/Python, installs deps, registers autostart, launches. |
| `build-exe.ps1` | Builds `dist\tokenjuice.exe` via PyInstaller. |
| `requirements.txt` | `pystray` + `pillow`, Windows-only `windows-toasts==1.3.1` SDK bindings. |
| `native_notifications.py` / `native_shortcut.py` | Native toast transport and owned AUMID/protocol/shortcut registration. |
| `uninstall.ps1` | Remove matching startup/notification registration, keep user usage/config files. |

## Design note

All usage maths live in `../claude-codex-battery.5s.js` — the same engine the
macOS build uses. This app shells out to it with `--json` and draws the result.

**Do not reimplement the usage calculations here.** That is why bun is a
requirement instead of this app reading `~/.claude` itself in Python, which would
drop the dependency and make the exe ~8x smaller. It was considered and
rejected: two copies of "how much Claude do I have left" means one of them
eventually goes stale, and a stale copy shows a *wrong number* — a user who
believes they have 20% left and gets cut off was lied to by the battery. A
smaller download is not worth that.

The engine is the single source of truth; this file owns pixels and nothing else.
Bundling bun into the exe would also work but costs 94MB (the Bun runtime is
~94MB on its own, and `--minify` does not change that), which is worse than
asking for a one-line install.

Consequences worth knowing:

- **bun is required**, even for the exe. The exe bundles Python, not bun.
- **`claude-codex-battery.5s.js` must sit next to the exe** (or one directory up
  when running from source). See `find_engine()`.
- The engine is spawned every 5s with `CREATE_NO_WINDOW`; without that flag
  Windows flashes a console window on each poll.

## Known risks

Both platforms read Claude Code's local files, and Anthropic documents that
format as unstable:

> "The entry format is internal to Claude Code and changes between versions, so
> scripts that parse these files directly can break on any release."
> — [Claude Code docs, Manage sessions](https://code.claude.com/docs/en/sessions)

Session **context** batteries are the part that depends on it. If the format
changes, sessions are skipped silently and the limit batteries keep working —
verified by feeding the engine a transcript with the usage fields removed. So a
breaking release costs you the `S` batteries, not the whole app.

The `/api/oauth/usage` endpoint used by API mode is likewise undocumented (it is
what Claude Code's own `/status` calls) and is rate-limited per token, which is
why the engine caches responses for 60s and prefers the local cache.

## Debugging

### System notifications

The ready Windows tray requests opt-in notification events from the shared engine
and presents them through the existing `pystray.Icon.notify` API. No extra package,
registry entry, Start Menu identity or automatic login is added. Notifications stay
off unless the user enables the existing engine policy. Plain JSON and `--once`
do not consume alerts. Simultaneous events are batched into one bounded message.

### 네이티브 알림 (2026-10-22 개발 후보)

등록된 설치에서는 Windows SDK 토스트를 사용하며 알림 센터 기록·클릭 후 현재 상태
확인을 지원한다. Python 트레이와 공용 JS 엔진은 유지하고 .NET/로컬 모델을 추가하지 않는다.
기본 알림 정책은 여전히 꺼짐이며 등록만으로 알림을 켜거나 계정/로그인을 변경하지 않는다.

- 소스 설치: `install.ps1`에서 현재 사용자 전용 앱 ID·시작 메뉴 바로가기·프로토콜을 등록한다.
  `-NoNativeNotifications`로 등록을 생략할 수 있다.
- Portable EXE: 트레이의 **Windows 네이티브 알림 설정…**에서 변경 범위를 확인하고 등록한다.
  또는 `tokenjuice.exe --register-notifications`를 직접 실행한다.
- 알림은 발생 시점의 기록임을 표시하며, 클릭은 고정된 `tokenjuice-native://status`만 허용한다.
  과거 알림의 수치를 현재 값으로 재사용하지 않고 공용 엔진을 알림 소비 없이 다시 읽는다.
  새 상태 창은 이전 알림이나 대화를 넘기지 않고 자격/최신성 상태를 표시한다.
- Windows가 이 앱의 알림을 차단하면 balloon으로 우회하거나 이벤트를 미리 소비하지 않는다.
  등록/SDK가 없을 때만 기존 Win32 balloon 경로를 유지한다. 전송 결과가 불명확한 실패는
  재전송하지 않으며 실패 문구에 경로/SDK 원문 오류를 노출하지 않는다.
- **이 앱의 Windows 알림 기록 지우기**는 사용자 확인 후 TokenJuice AUMID 기록만 지운다.
  엔진 기록·설정·대화 파일은 지우지 않는다.
- 제거: 소스는 `uninstall.ps1`, Portable EXE는 `tokenjuice.exe --unregister-notifications`.
  수정된/타 앱 소유 프로토콜·바로가기·아이콘은 덮어쓰거나 광범위 삭제하지 않는다.
  사용자 변경 아이콘은 남길 수 있으며 데이터/설정 파일은 보존한다.

현재 Mac에서는 순수 계약/가짜 SDK·레지스트리·트레이 회귀를 검사한다. Windows CI에는 실제
SDK import와 임시 .lnk의 COM 저장/읽기·EXE 내 같은 검증을 연결한다. 이 테스트는 사용자
계정 등록·실제 토스트를 발화하지 않는다. 실제 Windows 10/11 표시·알림 센터·앱 종료 후 클릭·
DPI/접근성은 실기기 검증이 별도다. 코드/CI를 실제 사용자 화면 완료로 간주하지 않는다.

근거: [Microsoft 앱 알림](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/app-notifications-dotnet),
[Windows-Toasts SDK 문서](https://windows-toasts.readthedocs.io/en/latest/).

### Login recovery

If the tray reports an expired Claude login, sign in again in Claude Code yourself.
The Windows tray does not automatically renew login, including when the shared
config contains `autoRenew:true`; background renewal is disabled on both platforms. Its recovery
text is an instruction, not a button that runs the CLI or changes credentials.
Old successful values remain labelled as historical, never live after auth failure.

```powershell
python tokenjuice_tray.py --once            # one reading, as text
python tokenjuice_tray.py --once --topics   # include prompt topics
bun ..\claude-codex-battery.5s.js --json    # raw engine output
```

If `--once` works but the tray icon never appears, the icon is almost certainly
hidden: click the **^** arrow by the clock and drag tokenjuice to the taskbar.
