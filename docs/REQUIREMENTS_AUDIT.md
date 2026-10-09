# TokenJuice 요구사항·증거 최종 감사

확인일: 2026-10-09

이 문서는 개발기획서의 요구사항을 현재 저장소의 코드·테스트·CI·release·실제
검증 gate로 분리해 매핑한다. `자동 통과`는 fixture/browser/CI 범위의 통과일 뿐이며,
실사용자·실기기·정책 결정을 대신하지 않는다.

기준 release asset은 `v1.2.2` (`12efce26b5eb6dafcb6aaf64f92ef7804ef1b487`)다.
2026-10-09 최신 public-beta 소스 기준은 `c08fa49`이며, 이 커밋의 Engine verification
`37885325573`, Windows build `37885325588`, Publish TokenJuice Pocket `37885325558`은 모두
성공했다. 이는 GitHub Pages의 PWA 소스 배포 증거이며, immutable macOS/Windows release asset이나
실기기 acceptance를 대체하지 않는다.

## 1. 단계별 완료 기준 감사

| 단계/기준 | 코드·자동 증거 | 실제 gate / 판정 |
|---|---|---|
| v1.1 신뢰성·진단·알림 | `claude-codex-battery.5s.js`, `tests/engine.test.js` 39 pass/195 expect, `scripts/release-verify.sh`, Engine CI `37885325573`, macOS notification dry-run | 실계정·OS notification presentation은 별도. 코드/자동 검증 완료 |
| v1.1.1 상품 표면·복구 UX | `companion/index.html`, `companion/app.js`, `tests/companion.test.py`, guide/Pocket browser test, Pages `37885325558` | 375px·desktop·a11y 기계 기준 완료, 스크린리더·5명 사용성 pending |
| v1.2 온보딩·계정·Windows | `guide.html`, `accounts.json` loader, Windows tray, Windows CI `37885325588`, release workflow | 신규 사용자 설치와 실제 Windows/macOS UI presentation pending |
| v2.0 확장 플랫폼·provider | Copilot/local quota adapter, metadata-only snapshot, encrypted manual bundle tests | 자동 CloudKit, team, additional OAuth/browser connector, widget/Watch selection pending |

## 2. R1–R20 요구사항 매핑

| ID | 요구사항 | 현재 evidence | 정확한 판정 |
|---|---|---|---|
| R1 | `fresh/stale/unavailable/rate_limited/auth_expired/fallback` 상태 모델 | `usageState()`, `usageStateForHttp()`, `stateLabel()`, engine state tests | 코드·fixture 완료; 실제 provider 형식 변화는 ongoing risk |
| R2 | last success/source/retry 시각 | `buildDiagnostics()`, menu recovery rows, developer mode; stale/429/401 tests | 코드·자동 검증 완료; 실제 계정 메시지 이해는 pending |
| R3 | 인증 만료를 명시 상태·사용자 실행 안내로 전환 | `autoRenew:false` 기본값; 명시적 `autoRenew:true`일 때만 401/403 이후 10분 제한 갱신; 메뉴 정책 표시와 `--renew-login`; `tests/engine.test.js` opt-in/opt-out/수동 실행 테스트 | 코드·자동 검증 완료. 0 model-call은 2026-10-05 Claude CLI 2.1.238 실측에 한정(버전 변경 시 재검증); 실제 계정 재로그인·Keychain 및 Claude Team/조직 정책 확인은 pending |
| R4 | 429 Retry-After·backoff | `fetchClaudeUsage()`, 429 tests | 자동 검증 완료 |
| R5 | wake refresh single debounce | `scripts/ensure-swiftbar-visible.sh`, wake helper test | 코드·fixture 완료; 실제 sleep/wake 장비는 pending |
| R6 | threshold/reset/forecast/reconnect 알림 | `runNotifications()`, target/account overrides, threshold/reset/reconnect tests | macOS payload·sender 구현; 실제 Notification Center presentation pending. Windows native toast는 현재 패키징 경계에서 안전한 sender 미구현 blocker |
| R7 | official quota와 local context/cost 분리 | `kind` contract, session/context/cost tests, Pocket cards | 코드·자동 검증 완료 |
| R8 | secret-free copyable diagnostics | `--diagnostics`, `--copy-diagnostics`, diagnostics privacy test | 자동 검증 완료; 실제 support workflow는 pending |
| R9 | first-run onboarding/permission/keychain choice | `--init-config`, `guide.html`, starter config test | artifact·자동 검증 완료; 신규 사용자 comprehension pending |
| R10 | multi-account aliases/status | `loadAccounts()`, multi-directory test, menu labels | 코드·fixture 완료; 실제 Team/personal 계정 사용성 pending |
| R11 | Windows/macOS meaning/alarm parity | shared JS engine, Windows build `37880424218`, Engine CI `37880424276` | tray/build/contract 완료; macOS·Windows tray 실제 presentation pending. Windows native toast는 앱 identity/shortcut 또는 새 WinRT 의존성이 필요해 현재 범위에서 blocked |
| R12 | mobile companion/widget | Pocket import/export/offline/encrypted bundle browser test, Pages `37812922149` | PWA local export 완료; native widget/retention pending |
| R13 | provider adapters | Copilot official-cost and local quota-file tests | 안전한 범위의 adapter 완료; extra provider policy/format validation pending |
| R14 | optional sync | passphrase-only AES-GCM manual bundle test | manual local transfer 완료; CloudKit/automatic sync intentionally pending |
| R15 | data contract/fixtures/regression | `docs/DATA_CONTRACT.md`, `tests/engine.test.js`, CI matrix | 자동 검증 완료; undocumented provider contracts remain risk |
| R16 | trust badges/source labels | `trustBadge()`, menu/Pocket source/freshness assertions | 코드·자동 검증 완료 |
| R17 | opt-in session status | `getAllSessions()`, session status test, snapshot/Pocket context | 코드·fixture 완료; 실제 agent 상태 정확도는 user/device pending |
| R18 | opt-in pace forecast | `forecastForItem()`, 7-day export/history test, Pocket forecast assertions | 코드·자동 검증 완료; 실제 행동 전환 pending |
| R19 | notch/compact view | `CCB_COMPACT`, compact test, Windows/macOS release build | 코드·CI 완료; 실제 notch clipping/legibility pending |
| R20 | project/context/cost report | project report and explicit rate-table tests | 코드·fixture 완료; 실제 user pricing setup/interpretation pending |

## 3. UX1–UX12 및 P0/P1/P2 성공 기준

| ID | 성공 기준 | Current evidence | 판정 |
|---|---|---|---|
| UX1 | shared state language/tokens across surfaces | `stateDisplayLabel()`, Pocket labels, shared engine, `tests/companion.test.py` | 코드 기준 완료; cross-OS visual parity pending |
| UX2 | urgent-first NOW view with reset/forecast/source/CTA | Pocket `NOW/WHY/NEXT`, priority/context cards, demo/import browser test | 코드·browser 완료; 10-second user metric pending |
| UX3 | stale/401/429/unavailable each has reason/action | engine state tests, menu recovery branches, Pocket recovery assertions | 코드·fixture 완료; real user recovery time pending |
| UX4 | <=3-step first-run onboarding and privacy promise | empty state steps, guide/install FAQ, browser text assertions | artifact/browser 완료; 5-person onboarding comprehension pending |
| UX5 | consumer Pocket empty/demo/import/offline/re-export flow | Pocket browser test, service worker/offline, checkpoint/privacy assertions | 코드·browser 완료; phone PWA/device acceptance pending |
| UX6 | contrast, 44px, keyboard, screen reader, 375px/desktop/dark/reduced motion | `tests/companion.test.py`, `docs/VALIDATION_KIT.md` §1/§3 | machine criteria pass; screen reader and 5-person gate pending |
| UX7 | local-labeled forecast/action language | forecast tests and Pocket “리셋 전 소진 예상” assertion | code pass; diary/action conversion pending |
| UX8 | per-account/window threshold/reset/reconnect and reason/next time | notification policy/override/reconnect tests; `CCB_TEST_NOTIFY_LOG` | macOS engine contract·sender pass; OS presentation pending. Windows toast는 현재 `pystray`/Pillow 패키징만으로는 안전하게 구현할 수 없어 기능·설치 경계 결정 전까지 blocked |
| UX9 | detailed menu/tray panel and compact/notch safety | menu output, compact test, Windows CI, installed source match | code/build pass; physical notch and OS visual pending |
| UX10 | value/install/privacy/OS/FAQ/release landing | `guide.html`, Pages CI `37812922149`, Pages HTTP 200 | artifact/deploy pass; new-user 5-person gate pending |
| UX11 | choose native mobile platform only after PWA usage/waitlist evidence | PWA exists; no native implementation | intentionally pending; requires usage/waitlist evidence |
| UX12 | validate free/paid boundary before payments | no payment/cloud code; strategy docs | intentionally pending; requires product/pricing/privacy decision |
| P0 | Work Continuity Slice | Pocket decision hierarchy, metadata checkpoint, trust/context separation | code/test pass; user behavior gate pending |
| P1 | Usage Coach/history/compact surfaces | history export, developer evidence, statusline, forecast | safe local subset implemented; coach/trend behavior evidence pending |
| P2 | developer integrations/widgets/providers | JSON/history/statusline/local adapter/manual bundle | webhook/native widget/Watch/extra policy-gated connectors pending |

## 4. Mismatch corrections made by this audit

- “완료”는 실제 사용자·실기기 acceptance까지 포함하지 않는다. 개발기획서 §17의
  v1.1/v1.2/UX1~UX10 상태를 코드·자동 검증 완료와 외부 gate pending으로 분리한다.
- `tests/companion.test.py`의 automated accessibility pass는 실제 VoiceOver/NVDA,
  Dynamic Type, 손가락 hit slop, notification permission, notch hardware를 증명하지 않는다.
- `v1.2.2` release asset은 `12efce2` tag에서 생성된 immutable asset이다. 문서-only
  `0064b72`는 release asset이나 CI 결과를 변경하지 않는다.
- light preference는 별도 light theme를 제공한다는 뜻이 아니다. 현재 제품은 dark token set을
  유지하며 light preference에서도 palette가 바뀌지 않는 회귀만 검사한다.

## 5. 남은 gate와 준비된 실행 절차

| gate | 주체/필요 입력 | 준비된 절차 |
|---|---|---|
| 5명 UX6/UX10 | 제품 담당자 + 참가자 5명 | `docs/VALIDATION_KIT.md` §1, synthetic demo, P01~P05 표 |
| 10명 interview + 14일 diary | 제품 담당자 + 동의한 참가자 10명 | `docs/VALIDATION_KIT.md` §2, I01~I10, 최소 diary fields |
| macOS notification/notch | TokenJuice 담당자 + macOS/notch 장비 보유자 | `scripts/notification-smoke.sh` dry-run으로 contract를 먼저 검증; 실제 Notification Center/notch는 `docs/VALIDATION_KIT.md` §3에서 별도 관찰 |
| Windows tray UI | v1.2.2 Windows 장비 보유자 | `docs/VALIDATION_KIT.md` §3, 기존 실행본의 icon·tooltip·menu 관찰 |
| Windows toast | 제품·설치 경계 결정자 + TokenJuice 구현 담당자 | 현재는 `blocked: implementation boundary`. 앱 identity/AUMID·Start Menu shortcut 또는 WinRT 의존성 선택과 event contract/격리 fixture 승인이 먼저다. 그 결정 이후에만 sender 회귀와 OS 실기기 presentation gate를 연다 |
| native widget/Watch | 제품 의사결정자 + PWA usage/waitlist 데이터 | UX11 기준; 구현·결제는 보류 |
| CloudKit/team/webhook/payment | 제품·보안·법무 의사결정자 | 현재 구현하지 않으며 정책 결정 후 별도 설계 |

## 6. 2026-10-09 Windows native toast feasibility

- `windows/tokenjuice_tray.py`의 현재 배포 경계는 `pystray`와 `Pillow`뿐이며, 설치기는 Python 의존성과 사용자 Startup shortcut만 관리한다.
- Windows unpackaged toast는 앱 identity/AUMID와 Start Menu shortcut 등록이 필요하거나 별도 WinRT toast 패키지가 필요하다. 이는 현재 설치·패키징·권한 경계를 바꾸거나 새 외부 의존성을 추가한다.
- 기존 엔진의 notification contract는 `CCB_TEST_NOTIFY_LOG`로 격리할 수 있지만, Windows OS 발화를 tray renderer가 안전하게 재사용할 이벤트 계약은 아직 없다. 이를 복제해 Python에서 다시 판단하면 macOS 엔진과 중복·불일치 위험이 생긴다.
- 따라서 이번 감사에서는 native toast를 구현하지 않았다. 기존 tray icon·tooltip·menu는 유지하며, Windows toast는 제품·설치 경계를 명시적으로 승인하고 event contract/fixture를 설계한 뒤 별도 작업으로 진행한다.
- 실제 Windows toast를 발화하거나 권한·설정을 변경하지 않았다. 현재 판정은 `blocked: implementation boundary`, 실기기 presentation은 별도 pending gate다.

### 제품·보안 의사결정 gate (코드 자동화와 분리)

| 제안 | 필요한 근거·결정 | 현재 판정 |
|---|---|---|
| native widget/Watch | 실제 PWA 사용률·반복 사용·waitlist 수치로 플랫폼을 하나 선택 | 데이터·의사결정자 입력 전까지 구현 보류 |
| Usage Coach/trend | 동의한 10명 interview + 14일 diary; §16.4 반증 조건과 §2 metric 정의 적용 | 행동 전환 근거 전까지 우선순위/화면 확정 보류 |
| CloudKit/team | 데이터 항목·암호화·접근권한·삭제/보존·서버수집 범위에 대한 제품·보안 승인 | 승인 전 구현 금지 |
| webhook | 전송 목적지·동의·인증·최소 데이터·철회/삭제·실패 정책의 보안 검토 | 승인 전 구현 금지 |
| payment | free/paid 경계·가격·환불·지원·세금·개인정보 범위에 대한 제품·법무 결정 | 승인 전 결제 코드 금지 |

v1.2.2 Pocket PWA의 로컬 브라우저 회귀는 2026-10-09에 `webapp-testing` helper로
정적 companion 서버를 띄워 `tests/companion.test.py`를 재실행해 통과했다. 이는 Playwright
브라우저 검증이며 실제 전화기/PWA 설치 acceptance를 뜻하지 않는다.

2026-10-09 release-verify 재실행에서 수동 `--renew-login` 테스트의 고정 300ms 대기가
detached child 로그보다 먼저 끝나는 재현 가능한 race가 드러났다. 수동 갱신 코드의 응답은
정상(`renew started`)이었고, 대응 테스트만 형제 자동 갱신 테스트처럼 관측 가능한 로그를
조건 대기하도록 바꿨다. targeted test와 전체 `scripts/release-verify.sh`가 모두 통과했다
(38 pass / 190 assertions 포함). 이는 테스트 안정화이지 갱신 구현 변경은 아니다.

## 6. 2026-10-09 SwiftBar 실기기 관찰 시도

- 환경: notch 지원 Mac14,5 / macOS 15.6.1.
- CUA 앱 inventory에서 SwiftBar가 노출되지 않았고, `SystemUIServer`는 실행 중이 아닌 것으로 보고됐다.
- `cua.getApp("SwiftBar")`는 server error `-10005` (`timeoutReached`)로 종료됐다.
- 이 시도에서는 설정, 알림 권한·발화, 설치 파일을 변경하지 않았다.
- 따라서 live 메뉴바/notch 렌더링은 여전히 pending이다. compact 출력·CI·설치본 비교의 자동 증거를 물리적 시각 pass로 승격하지 않는다.
- 다음 안전한 절차는 SwiftBar가 실제로 실행 중인 데스크톱 세션에서 `docs/VALIDATION_KIT.md` §3 체크리스트만 수행하는 것이다. 개인정보가 포함된 화면 캡처는 요구하지 않는다.

추가 read-only CUA inventory도 SwiftBar를 실행 중 앱으로 노출하지 않았고 SystemUIServer를
비활성으로 표시했다. 플러그인이 실제 자격증명을 읽을 가능성 때문에 앱 실행/플러그인 refresh는
하지 않았다. 따라서 notch 상태는 여전히 pending이다.

### 6.1 2026-10-09 설치 doctor 재검증

현재 작업 Mac에서 `./install.sh --doctor`를 읽기 전용으로 실행했다. Bun `1.3.14`, SwiftBar 설치,
`tokenjuice-battery.5s.js` 존재, 설치본·소스 일치, SwiftBar 프로세스 실행, TokenJuice 엔진 실행 가능을
모두 확인해 exit 0을 받았다. 이 결과는 현재 작업 환경의 설치·프로세스 경계가 정상이라는 증거이며,
사용자의 별도 노트북이나 실제 메뉴바 픽셀 표시·notch 가독성의 acceptance로 승격하지 않는다.

이후 doctor의 로컬 전용 API 차단을 추가하면서 소스가 변경되어, 현재 설치본은 의도적으로 `outdated`로
검출되고 `scripts/release-verify.sh`의 설치본 일치 gate는 exit 1이다. 이는 새 소스가 실제 메뉴바에
배포됐다고 오인하지 않도록 하는 정상 gate다. 릴리스 후보 커밋이 확정된 뒤에만 사용자가 설치 절차를
실행하고, 같은 doctor와 release verify를 다시 통과시킨다.

이 문서는 현 시점 코드 감사와 실행 준비 상태를 기록할 뿐, 목표 완료나 사용자 성공을
선언하지 않는다.
