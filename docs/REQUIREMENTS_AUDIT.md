# TokenJuice 요구사항·증거 최종 감사

확인일: 2026-10-10

이 문서는 개발기획서의 요구사항을 현재 저장소의 코드·테스트·CI·release·실제
검증 gate로 분리해 매핑한다. `자동 통과`는 fixture/browser/CI 범위의 통과일 뿐이며,
실사용자·실기기·정책 결정을 대신하지 않는다.

기준 release asset은 `v1.2.2` (`12efce26b5eb6dafcb6aaf64f92ef7804ef1b487`)다.
2026-10-09 당시 배포된 Pocket PWA 소스 기준은 `49a012f`이며, 이 커밋의 Engine verification
`37943107693`, Windows build `37943107732`, Publish TokenJuice Pocket `37943107852`는 모두
성공했다. 이는 GitHub Pages의 PWA 소스 배포 증거이며, immutable macOS/Windows release asset이나
실기기 acceptance를 대체하지 않는다.

이전 desktop **소스 후보**는 `70abf9e85cd51f4a8d5ba32205606b0e538b3f3b`다.
프로필 엔진/브라우저 커밋 `862d50f41734ffc35321fddeb453854a27263427`의 Engine verification
`37950615407`·Windows build `37950615519`는 success다. 이후 Windows 구버전 menu fallback
수정 `70abf9e`의 Windows build `37950833358`도 selftest/exe 실행까지 success다.
이후 audit/기획서 문서-only 변경은 해당 CI 필터나 Pages 배포를 다시 실행하지 않는다.
당시 desktop release asset/설치본은 갱신하지 않았고, Pocket 배포는 `49a012f`였다.
Codex pace 구현의 증거는 아래 §9.5, 후속 수동 프로필의 증거는 §9.6이다. `70abf9e`는
Windows 경로만 변경해 Engine/Pages 재실행 대상이 아니다. CI를 실제 설치 성공으로 대체하지 않는다.

현재 공개 Pocket은 §9.23의 `0fff215`/sw v13, desktop 자산은 immutable `v1.2.2`다.
최신 로컬 후보에는 §9.10~§9.20의 관측 검사·실패 renderer 일치·Windows 수동 안내,
승인된 plugin 반영과 helper 상태 손상/독립 설치 검사를 추가했다. 아래 과거 커밋/테스트
수치는 각 단계의 기록이며 현재 설치본·PWA 소스와 같은 것으로 해석하지 않는다.

§9.18 이전 엔진 후보는 승인된 플러그인 한 파일 반영 뒤 release-verify exit 0이었다.
§9.20의 설치 helper 불일치는 §9.21의 한 파일 백업·갱신으로 해소했다.
현재 plugin/helper 모두 소스와 일치하며 전체 release-verify는 exit 0이다.
Mac 아이콘/클릭 패널 존재는 사용자 보고로 확인했다. 실제 수치·절전/재부팅·나머지
실기기·신규 사용자·스토어 gate는 계속 pending이다. 현행 엔진은 86 pass/1152 assertions,
별도 work-summary는 7 pass/31 assertions다. 아래 단계별 표의 과거 83개 수치는 §9.21 기준이다.

## 1. 단계별 완료 기준 감사

| 단계/기준 | 코드·자동 증거 | 실제 gate / 판정 |
|---|---|---|
| v1.1 신뢰성·진단·알림 | `claude-codex-battery.5s.js`, 로컬 `tests/engine.test.js` 83 pass/1146 expect, `scripts/release-verify.sh`, macOS notification dry-run | threshold/잔여량 회복·opt-in 리셋 임박 및 Claude/Codex local pace 예측 알림 구현. Claude API/local utilization·Desktop 표본/cache 관측과 Codex used_percent의 malformed 값 검사. 실계정·OS presentation은 별도; 최신 CI success·plugin/helper 일치로 release-verify exit 0(§9.21); 실제 UI pending |
| v1.1.1 상품 표면·복구 UX | `companion/index.html`, `companion/app.js`, `tests/companion.test.py`, guide/Pocket browser test, Pages `37885325558` | 375px·desktop·a11y 기계 기준 완료, 스크린리더·5명 사용성 pending |
| v1.2 온보딩·계정·Windows | `guide.html`, `accounts.json` loader, Windows tray, Windows CI `37885325588`, release workflow | 신규 사용자 설치와 실제 Windows/macOS UI presentation pending |
| v2.0 확장 플랫폼·provider | Copilot/local quota adapter, metadata-only snapshot, encrypted manual bundle tests | 자동 CloudKit, team, additional OAuth/browser connector, widget/Watch selection pending |

## 2. R1–R20 요구사항 매핑

| ID | 요구사항 | 현재 evidence | 정확한 판정 |
|---|---|---|---|
| R1 | `fresh/stale/unavailable/rate_limited/auth_expired/fallback` 상태 모델 | `usageState()`, `usageStateForHttp()`, `stateLabel()`, engine state tests | 코드·fixture 완료; 실제 provider 형식 변화는 ongoing risk |
| R2 | last success/source/retry 시각 | `buildDiagnostics()`, menu recovery rows, developer mode; stale/429/401 tests | 코드·자동 검증 완료; 실제 계정 메시지 이해는 pending |
| R3 | 인증 만료를 명시 상태·사용자 실행 안내로 전환 | macOS `autoRenew:false` 기본값; 명시적 `autoRenew:true`일 때만 401/403 이후 10분 제한 갱신; 메뉴 정책 표시와 `--renew-login`; `tests/engine.test.js` opt-in/opt-out/수동 실행 테스트 | macOS 코드·자동 검증 및 Windows 수동 설명 selftest 완료(§9.15). Windows 자동 갱신은 미지원. 0 model-call은 2026-10-05 Claude CLI 2.1.238 실측에 한정(버전 변경 시 재검증); 실제 계정 재로그인·Keychain 및 Claude Team/조직 정책 확인은 pending |
| R4 | 429 Retry-After·backoff | `fetchClaudeUsage()`, 429 tests | 자동 검증 완료 |
| R5 | wake refresh single debounce | `scripts/ensure-swiftbar-visible.sh`, 손상 tick/refresh 회복·debounce fixture, `scripts/check-installed-sources.sh`, §9.20 CI·§9.21 설치 | 코드·fixture·한 파일 백업/갱신 완료. 실제 sleep/wake 관찰 필요 |
| R6 | threshold/reset/forecast/reconnect 알림 | `runNotifications()`, target/account overrides, threshold/reset/reconnect·reset-soon·forecast tests, §9.56~9.61 | 지원 범위 구현: threshold·잔여량 회복·reconnect·별도 opt-in reset-soon/Claude 및 Codex local forecast 발화. Codex는 별도 수집/알림 동의와 유효 미래 reset 필요. Windows Win32 tray sender·실제 엔진 연결은 CI 통과; macOS/Windows 사용자 기기 presentation은 pending |
| R7 | official quota와 local context/cost 분리 | `kind` contract, session/context/cost tests, Pocket cards | 코드·자동 검증 완료 |
| R8 | secret-free copyable diagnostics | `--diagnostics`, `--copy-diagnostics`, diagnostics privacy test | 자동 검증 완료; 실제 support workflow는 pending |
| R9 | first-run onboarding/permission/keychain choice | `--init-config`, `guide.html`, starter config test | artifact·자동 검증 완료; 신규 사용자 comprehension pending |
| R10 | multi-account aliases/status | `loadAccounts()`, `loadCodexProfiles()`, selected legacy/additive JSON, macOS/Windows menu, 5 profile tests, Windows `37950833358` | Claude 및 수동 Codex root/alias/ID/표시 선택·계정별 상태/알림/history 계약 구현. Windows 메뉴 selftest/exe CI 통과. 실제 인증 계정 자동 식별·로그인 전환은 하지 않음. 실제 Team/personal mapping/사용성은 별도 검증 |
| R11 | Windows/macOS meaning/alarm parity | shared JS engine, Win32 sender/연결·EXE 검증 §9.56~9.61 | Win32 tray 알림·엔진 연결·EXE CI 통과. macOS/Windows 실제 presentation은 pending. AUMID/WinRT toast와 activation/history는 별도 미구현이며 tray 알림으로 전체 parity를 완료 처리하지 않음 |
| R12 | mobile companion/widget | Pocket import/export/offline/encrypted bundle browser test, Pages `37885325558` | PWA local export 완료; native widget/retention pending |
| R13 | provider adapters | Copilot official-cost and local quota-file tests | 안전한 범위의 adapter 완료; extra provider policy/format validation pending |
| R14 | optional sync | passphrase-only AES-GCM manual bundle test | manual local transfer 완료; CloudKit/automatic sync intentionally pending |
| R15 | data contract/fixtures/regression | `docs/DATA_CONTRACT.md`, `tests/engine.test.js`, CI matrix | 자동 검증 완료; undocumented provider contracts remain risk |
| R16 | trust badges/source labels | `trustBadge()`, menu/Pocket source/freshness assertions | 코드·자동 검증 완료 |
| R17 | opt-in session status | `getAllSessions()`, session status test, snapshot/Pocket context | 코드·fixture 완료; 실제 agent 상태 정확도는 user/device pending |
| R18 | opt-in pace forecast | `forecastForItem()`, `codexForecastForItem()`, 7-day export/history·primary/secondary·profile/privacy tests, Pocket forecast assertions | Claude/Codex quota 구현·자동 검증. Codex는 수동 프로필 ID로 분리하고 명시적 최근 이벤트 시각·미래 reset·충분한 표본 조건부. 실제 행동 전환 pending |
| R19 | notch/compact view | `CCB_COMPACT`, compact test, Windows/macOS release build | 코드·CI 완료; 실제 notch clipping/legibility pending |
| R20 | project/context/cost report | project report and explicit rate-table tests | 코드·fixture 완료; 실제 user pricing setup/interpretation pending |

## 3. UX1–UX12 및 P0/P1/P2 성공 기준

| ID | 성공 기준 | Current evidence | 판정 |
|---|---|---|---|
| UX1 | shared state language/tokens across surfaces | `stateDisplayLabel()`, Pocket labels, shared engine, `tests/companion.test.py` | 코드 기준 완료; cross-OS visual parity pending |
| UX2 | urgent-first NOW view with reset/forecast/source/CTA | Pocket `NOW/WHY/NEXT`, priority/context cards, demo/import browser test; menu NOW risk-direction regression | menu quota 잔여량 역순 점수를 사용률 점수로 수정하고 Claude/Codex/context·untrusted 우선 회귀 추가. 코드·browser 범위 확인; 10-second user metric pending |
| UX3 | stale/401/429/unavailable each has reason/action | engine state tests (`NEXT` recovery uniqueness), menu recovery branches, Pocket recovery assertions | stale/auth/rate-limit/missing-data는 단일 안내, 원인 불명 unavailable은 행동 미제안까지 코드·fixture 완료; real user recovery time pending |
| UX4 | <=3-step first-run onboarding and privacy promise | empty state steps, guide/install FAQ, browser text assertions | artifact/browser 완료; 5-person onboarding comprehension pending |
| UX5 | consumer Pocket empty/demo/import/offline/re-export flow | Pocket browser test, service worker/offline, checkpoint/privacy assertions | 코드·browser 완료; phone PWA/device acceptance pending |
| UX6 | contrast, 44px, keyboard, screen reader, 375px/desktop/dark/reduced motion | `6cacedb` Pocket disclosure + `tests/companion.test.py`; Engine/Windows/Publish runs `37886745999`/`37886745975`/`37886745971` success | machine criteria pass only; screen reader, physical notch/tray, and 5-person gate pending |
| UX7 | local-labeled forecast/action language | forecast tests and Pocket “리셋 전 소진 예상” assertion | code pass; diary/action conversion pending |
| UX8 | per-account/window threshold/reset/reconnect and reason/next time | desktop notification policy/override/reconnect tests; `CCB_TEST_NOTIFY_LOG` | macOS engine contract·sender pass; Pocket snapshot deliberately excludes overrides, so mobile settings are gated pending a product/security decision rather than writing Mac `config.json`. OS presentation pending. Windows toast는 현재 `pystray`/Pillow 패키징만으로는 안전하게 구현할 수 없어 기능·설치 경계 결정 전까지 blocked |
| UX9 | detailed menu/tray panel and compact/notch safety | menu output, compact test, Windows CI; 승인된 플러그인 갱신 후 release-verify 설치본 비교 일치 | code/build/source-install match pass; physical notch·OS visual pending |
| UX10 | value/install/privacy/OS/FAQ/release landing | `guide.html`, Pages CI `37885325558`, Pages HTTP 200 | artifact/deploy pass; new-user 5-person gate pending |
| UX11 | choose native mobile platform only after PWA usage/waitlist evidence | PWA exists; no native implementation | intentionally pending; requires usage/waitlist evidence |
| UX12 | validate free/paid boundary before payments | no payment/cloud code; strategy docs | intentionally pending; requires product/pricing/privacy decision |
| P0 | Work Continuity Slice | Pocket decision hierarchy, metadata checkpoint + read-only 재개 상세/import/copy/text download, trust/context separation | 안전한 metadata subset code/test pass; 의미 있는 작업 요약/파일 복원·user behavior gate는 미완료 |
| P1 | Usage Coach/history/compact surfaces | history export, developer evidence, statusline, forecast, 80%/90% local checkpoint handoff, `6cacedb` small-screen disclosure browser test | safe local subset implemented; coach/trend requires a real history/export contract and behavior evidence; Pocket settings are product/security-gated |
| P2 | developer integrations/widgets/providers | JSON/history/statusline/local adapter/manual bundle | webhook/native widget/Watch/extra policy-gated connectors pending |

## 4. Mismatch corrections made by this audit

- “완료”는 실제 사용자·실기기 acceptance까지 포함하지 않는다. 개발기획서 §17의
  v1.1/v1.2/UX1~UX10 상태를 코드·자동 검증 완료와 외부 gate pending으로 분리한다.
- `tests/companion.test.py`의 automated accessibility pass는 실제 VoiceOver/NVDA,
  Dynamic Type, 손가락 hit slop, notification permission, notch hardware를 증명하지 않는다.
- `17d02c8`은 README 이미지를 historical example로 표시하고, `016a60a`는 Pocket 설정의 제품·보안 gate를 기록한다. 두 커밋의 변경 경로와 `.github/workflows/{engine-verify,windows-build,companion-pages}.yml`의 push paths를 대조했다. README와 해당 계획·감사 문서는 어느 필터에도 포함되지 않으며 실제 run 목록에도 두 커밋 실행이 없다. 따라서 CI/Pages 성공을 새로 주장하지 않는다. 로컬 release-verify는 자동 단계 통과·마지막 SwiftBar 설치본 불일치(exit 1)이며 배포 증거와 구분한다.
- `v1.2.2` release asset은 `12efce2` tag에서 생성된 immutable asset이다. 문서-only
  `0064b72`는 release asset이나 CI 결과를 변경하지 않는다.
- light preference는 별도 light theme를 제공한다는 뜻이 아니다. 현재 제품은 dark token set을
  유지하며 light preference에서도 palette가 바뀌지 않는 회귀만 검사한다.

## 5. 남은 gate와 준비된 실행 절차

| gate | 주체/필요 입력 | 준비된 절차 |
|---|---|---|
| 5명 UX6/UX10 | 제품 담당자 + 참가자 5명 | `docs/VALIDATION_KIT.md` §1, synthetic demo, P01~P05 표 |
| 10명 interview + 14일 diary | 제품 담당자 + 동의한 참가자 10명 | `docs/VALIDATION_KIT.md` §2, I01~I10, 최소 diary fields |
| macOS notification/notch | TokenJuice 담당자 + macOS/notch 장비 보유자 | `./install.sh --doctor`로 baseline/source 불일치를 먼저 확인한다. 최신 source 설치는 기기 소유자가 명시적으로 승인할 때만 `CCB_YES=1 ./install.sh`를 실행하고 doctor source match 뒤 `scripts/notification-smoke.sh` dry-run 및 `docs/VALIDATION_KIT.md` §3 관찰을 진행 |
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

## 7. 2026-10-09 SwiftBar 실기기 관찰 시도

- 환경: notch 지원 Mac14,5 / macOS 15.6.1.
- CUA 앱 inventory에서 SwiftBar가 노출되지 않았고, `SystemUIServer`는 실행 중이 아닌 것으로 보고됐다.
- `cua.getApp("SwiftBar")`는 server error `-10005` (`timeoutReached`)로 종료됐다.
- 이 시도에서는 설정, 알림 권한·발화, 설치 파일을 변경하지 않았다.
- 따라서 live 메뉴바/notch 렌더링은 여전히 pending이다. compact 출력·CI·설치본 비교의 자동 증거를 물리적 시각 pass로 승격하지 않는다.
- 다음 안전한 절차는 SwiftBar가 실제로 실행 중인 데스크톱 세션에서 `docs/VALIDATION_KIT.md` §3 체크리스트만 수행하는 것이다. 개인정보가 포함된 화면 캡처는 요구하지 않는다.

추가 read-only CUA inventory도 SwiftBar를 실행 중 앱으로 노출하지 않았고 SystemUIServer를
비활성으로 표시했다. 플러그인이 실제 자격증명을 읽을 가능성 때문에 앱 실행/플러그인 refresh는
하지 않았다. 따라서 notch 상태는 여전히 pending이다.

### 7.1 2026-10-09 설치 doctor 재검증

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

## 8. 전체 연결 문서·추가 백로그 대조 범위

기획서 §6·§7·§13·§14·§15·§16·§17·§18·§19와 아래 연결 문서를
현재 코드·fixture·태그 이력에 대조했다. 경쟁사 조사 문단의 과거 가격·리뷰·stars를 새로
검증했다는 뜻은 아니며, 문서 체크박스가 자동 통과나 실기기 성공을 대신하지 않는다.

| 문서/범위 | 구현된 범위 | 남은 범위·정확한 성격 |
|---|---|---|
| master §6 R1~R20·UX1~UX12, §7 종료 조건 | 위 §2~§3 매핑 | R6 Claude/Codex 예측/reset-soon, R10 Codex 수동 로컬 프로필 subset 구현. 인증 계정/root mapping과 새 설치/OS UI는 별도 검증. R11 Windows toast는 설치 경계 결정 선행 |
| master §13 Phase A trust | 로컬 source/last success/상태 분류 | 독립 provider-health/outage 수집 없음. HTTP failure를 provider outage로 단정하지 않음 |
| master §13 Phase B continuity | context 80/90%, 프로젝트·브랜치 metadata checkpoint와 파일 다시 열기/재개 안내 copy/text download | 최근 파일·마지막 작업 의도를 담은 resume brief 및 수동 provider 전환 안내 전체는 미구현. §16.5는 이를 좁힌 안전한 slice일 뿐 Phase B 전체 완료가 아님 |
| master §13 Phase C~E | Claude/Codex local read, opt-in API, 암호화 수동 quota 전달 | 직접 reset-credit 실행·자동 checkpoint sync·push·team dashboard 없음. credentials/외부 전송·동의/보존 계약 또는 제품 선택 선행 |
| master §14~§15 디자인/Coach/P2 | urgent-first·state·local checkpoint·compact·export/statusline | 10초/30초 및 90%/80%/5%/30% 행동 지표 미측정. tool-call/file-read 분석·개인화 Coach·resume 효과는 미구현/행동 근거 대기 |
| `docs/UI_UX_RELEASE_PLAN.md` | P0 화면·복구·설치 문구, 상세 접기, checkpoint CTA, 오래된 README 이미지 제거 | 7-day 시계열 UI·Pocket 설정 계약, 스크린리더/큰 글자/notch/tray 실기기 확인 |
| `docs/LAUNCH_FEEDBACK_PLAN.md` | 공개 PWA·GitHub feedback 양식·doctor 경로 | 별도 노트북 핵심 경로, 5명 신규 설치, 10명 interview·14일 diary, 주간 이슈 분류와 10건 제보 미실행. 스토어/확장에는 현재 앱 패키지 없음 |
| `docs/VALIDATION_KIT.md` | synthetic 시나리오·빈 기록표·조건/분모 정의·격리 알림 harness | 실제 참가자·동의·관찰 입력 필요. 빈 결과를 성공 수치로 채우지 않음 |
| `docs/RELEASE_CHECKLIST.md` | 다음 후보용 사전 template | 과거 Pages 404/미등록 workflow 문단은 현재 상태가 아님. 다음 SHA별 CI 및 새 설치/제거/재시작 증거로 다시 판정 |
| `docs/RELEASE_EVIDENCE.md` | 1.1.0 historical record | 32 tests·당시 설치본 일치·Pages 404는 현행 증거가 아님 |
| `docs/DATA_CONTRACT.md`, `companion/README.md` | v2 engine/v1 export·manual encrypted transfer·가격표 조건 | 자동 sync/설정 쓰기/자격증명 수집 없음. Pocket의 기존 저장본 보존은 아래 새 회귀로 보강 |
| `README.md`, `windows/README.md`, `CHANGELOG.md`, `AGENTS.md` | 설치·소스 복사/엔진 공유·업데이트/기능 경계 | clone/pull만으로 installed copy나 exe 갱신 안 됨. 실제 장비와 release 자산은 별도 버전. 설치·OS 알림·Keychain을 이번 테스트에서 실행하지 않음 |

### 8.1 태그와 후속 업데이트를 분리한 판정

| 기준 | 포함된 변경 | 포함되지 않은 증거 |
|---|---|---|
| `v1.2.0` / `cf74513c0c886e5a31af2c8ecb7c5f9ccb9a9ff5` | 신뢰 상태·기본 threshold/reset·Claude 다중 계정·opt-in forecast/session 상태·snapshot/bundle·Windows renderer | 이후 main의 상세 NOW/WHY/NEXT·context checkpoint·7-day history/statusline·window override/reconnect·접근성 개선 없음 |
| `v1.2.1` / `f1a17763ab0ee004f7d6379f1ca03006def75163` | context checkpoint/history/developer/statusline·알림 override/reconnect·guide·대비 보정까지 | 이후 1.2.2 접근성 보강, 최신 공개 베타 복구/compact/menu/disclosure 개선 없음 |
| `v1.2.2` / `12efce26b5eb6dafcb6aaf64f92ef7804ef1b487` | 375px/desktop·큰 글자·keyboard/ARIA·44px·reduced-motion 보강 | 이후 main의 doctor/피드백/신뢰 문구·compact legend·menu NOW/단일 NEXT·80/90 CTA·Pocket 상세 접기·이번 손상 파일 수정 없음 |
| 이후 main / Pocket | 위 후속 소스 변경. 실제 Pages 배포는 해당 SHA의 workflow success로만 확인 | 새 태그/exe/설치본을 자동 생성하지 않으며 OS 실기기나 사용자 성공을 증명하지 않음 |

`git show`로 태그 소스와 `git log v1.2.0..HEAD`를 대조하고 `gh release list/view`로
v1.2.0~v1.2.2 공개 자산을 확인했다. release의 `targetCommitish:main` 대신 실제 태그가
가리키는 위 commit을 기준으로 한다.

## 9. 이번 안전 수정 및 후속 착수 큐

1. **이번 구현: Pocket 손상 파일 데이터 보존.** 기존 `valid()`는 envelope만 검사했고
   `load()`가 render 전에 Local Storage를 덮어썼다. 정상 envelope의 `claude:[null]`로
   저장본 보존 assertion이 실패하는 것을 먼저 재현했다. renderer가 소비하는 내부 구조를
   저장 경계에서 검사한 뒤, 내부 오류 14종의 기존 화면/저장본 보존·손상 저장본 startup
   복구·optional 필드 없는 이전 v1 호환·정상 암호화 상호운용 회귀가 통과했다.
2. **후속 로컬 코드:** R10의 Codex root/alias/표시 선택·stable notification key·호환 출력
   subset은 아래 §9.6에서 구현했다. 시각적 history·Phase B resume brief 등은 여전히 별도
   백로그다. 실제 계정 mapping/OS UI 성공을 fixture로 대체하지 않는다.
3. **외부 입력:** 현재 후보 source를 설치해도 되는지 기기 소유자의 승인, 실제 Mac UI/
   sleep-wake 관찰, Windows tray·스크린리더 장비, 5명/10명 참가자와 동의·diary가 필요하다.
   Windows sender/모바일 설정·스토어/외부 전송/유료화 결정은 위 gate와 분리한다.

기획서의 C/S/X 설명도 실제 출력에 맞게 `C=Claude quota`, `S=local session context`,
`X=Codex quota`로 정정했다. S를 Codex나 작업 잔여 시간으로 오해하는 설계 예시는 제거했다.

이번 수정의 `scripts/release-verify.sh`: engine 42 pass/217 assertions, Bun bundle,
shell/Python syntax, 격리 notification dry-run, 확장된 Pocket browser regression 및
`git diff --check`는 통과했다. 마지막 installed SwiftBar source mismatch로 전체 exit 1이며,
설치 파일·OS 권한·실계정은 변경하지 않았다. 새 CI/Pages 결과는 push 이후 별도로 확인한다.

### 9.1 이어서 수정한 Pocket 신뢰 상태와 CI race

- stale export에 과거 `items[]`가 남으면 카드가 이를 `65% 남음`으로 표시하는 것을
  browser assertion 실패로 재현했다. payload의 신뢰 상태와 무관하게 `map(metric)`을
  실행하던 것이 원인이다. 이제 fresh/fallback만 수치를 표시하며 stale/auth/rate-limit/
  unavailable은 이유·복구·last-success를 유지하고 과거 숫자와 forecast를 숨긴다.
  Claude/Codex/local-provider 12가지 차단 상태 및 fresh/fallback 유지 회귀를 추가했다.
- `bff96e7` Engine `37942483714`와 Windows `37942483804`는 성공했지만 Pages
  `37942483656`는 wrong-passphrase 검사에서 실패했다. 300ms 고정 대기 후 아직
  복호화가 끝나지 않은 메시지를 검사한 race이며 코드 import 결과 실패가 아니다.
  테스트를 input reset 완료 조건으로 바꾸고 복호화를 600ms 늦추는 회귀를 추가했다.
  실패한 run을 배포 성공으로 표시하거나 조건 없이 rerun하지 않았다.

수정 커밋 `49a012f`의 Engine `37943107693`, Windows `37943107732`, Pages
`37943107852`는 모두 success다. 공개 `app.js`의 nested validator와 state-gated metric,
`sw.js`의 v10을 HTTP 응답으로 확인했다. 이는 현재 PWA 배포 증거이지 desktop 자산
v1.2.2나 설치본 갱신 증거가 아니다.

### 9.2 R6 reset-soon 최소 구현

별도 기본 꺼짐 `notify.resetSoonMinutes`와 local CLI/menu toggle, window override,
fresh-only·ISO/Unix reset 처리·중복 방지·threshold 상태 보존을 구현했다. 추가 fixture
4개/21 assertions와 전체 46 tests/238 assertions가 통과했다. 정상 timestamp 변경,
설정 꺼짐/잘못된 설정·과거/불명/먼 reset, stale/401/429, read-only export 무발화를
검증했다. 전체 release-verify는 자동 단계 통과 후 installed-source mismatch로 exit 1이다.
실제 설치·OS 발화/권한을 변경하지 않았다. 이 reset-soon 단계 당시 forecast 소진 예측
알림은 미구현이었으며, 다음 §9.3에서 Claude 범위를 이어서 구현했다.

### 9.3 R6 Claude forecast 최소 구현

reset-soon 커밋 `f1ed2c6`의 Engine `37944170751`·Windows `37944170598`는 success다.
이후 Claude forecast 발화의 별도 opt-in, history opt-in 분리, fresh/최근 관측/표본/
미래 소진과 알려진 reset 조건, window override, 구간별 중복 방지와 local-estimate/next-action
문구를 구현했다. fixture 3개/14 assertions를 추가했다. Codex는 history/forecast 계산이
없어 포함하지 않으며 Windows native sender·실기기·사용자 acceptance는 완료가 아니다.

### 9.4 P0 menu NOW 위험 정렬 역전 수정

`parseUsageItems()`의 `utilization`, Codex의 `used_percent`는 사용률이다. 기존
quota score `100 - used`를 내림차순 정렬해, 90% 남은 창이 15% 남은 창 및 context
85%보다 먼저 표시되는 것을 fixture로 재현했다. 잘못된 순서를 고정한 기존 assertion도
수정했다. score만 `used`로 바꾸고 표시 문구는 remaining을 유지했다. 두 새 테스트에서
Claude 여러 창·Codex 98% 사용·높은 context·stale local cache·HTTP 실패 우선순위를
검증한다. 동일 단위의 사용률을 위험 순서로만 비교하며 quota와 context를 합산하지 않는다.

직전 forecast 커밋 `39c6579` Engine `37944984558`·Windows `37944984754`는 success다.
이 단계 당시 local release-verify는 engine 51 pass/259 assertions, browser·bundle·syntax·격리
notification 단계 통과 후 installed-source mismatch로 exit 1이다. 새 NOW 소스가
현재 SwiftBar 설치본 또는 v1.2.2 자산에 이미 반영됐다고 주장하지 않는다.

수정 커밋 `6f7184b`의 Engine `37945674193` 및 Windows `37945674232`는 모두
success임을 확인했다. 이번 engine/tests 변경은 Pages push paths 대상이 아니며, 성공한
Pocket 배포는 `49a012f`/`37943107852` 그대로다. 참가자 결과나 OS presentation 기록을
새로 생성하지 않았다. 다음 독립 코드 백로그는 Codex 다중 계정/안정적인 계정 키와 Codex
pace history였으며, 아래 §9.5에서 단일 프로필 pace slice를 먼저 구현했다.

### 9.5 Codex 단일 프로필 pace history / forecast

Claude와 독립적인 `codexForecast.enabled` 수집 동의와 `notify.codexForecast` 발화 동의를
추가했다. fresh `rate_limits`의 타임존 포함 이벤트 시각이 최근 15분 이내이고 창 길이와
미래 reset이 알려진 경우만 관측한다. file mtime을 pace 표본 시각으로 사용하지 않는다.
primary/secondary·reset 구간별 opaque key와 `{key,at,used}`만 별도 로컬 history에 저장한다.
계정 식별자·세션 경로·prompt 수집 또는 계정 전환 구분을 뜻하지 않으며 R10은 남아 있다.

3개 fixture/33 assertions로 별도 동의·표본 부족·불명/과거 reset·missing/old/future timestamp·
잘못된 사용률·동일 표시 이름의 두 창·reset 변경·stale·중복 억제·export 무발화·개인정보 제외·
Claude history 보존·메뉴/developer/widget 호환을 검증했다. 전체 54 pass/292 assertions,
bundle·syntax·격리 알림 dry-run·Pocket browser·diff 검증은 통과했다. release-verify 전체는
installed SwiftBar source mismatch로 exit 1이다. 설치본·OS 권한·실계정·공개 desktop 자산은
변경하지 않았다. `065d868`의 Engine [37948130019](https://github.com/kendrick-na/tokenjuice/actions/runs/37948130019)·Windows [37948130013](https://github.com/kendrick-na/tokenjuice/actions/runs/37948130013)는 모두 success다.

### 9.6 R10 수동 Codex 로컬 프로필 (2026-10-10)

최대 8개 explicit root/별칭/안정 ID, 선택 CLI 및 macOS/Windows 메뉴를 추가했다. 별칭·
순서 변경에도 ID를 유지하며 threshold/reset 키는 ID+역할, pace 키는 ID+역할+길이+reset을
구분한다. 기존 `.codex` 기본 동작과 override는 유지한다. 잘못된 manifest/선택은 다른
계정/default root로 fallback하지 않는다. root·인증 식별자·credential discovery/로그인
전환을 추가하지 않았고, diagnostics에는 공개 별칭/ID 대신 index만 표시한다.

legacy JSON/X header·Pocket export·Codex context는 선택 프로필을 유지하며 전체 quota는
additive `codexAccounts[]`에 제공한다. Pocket quota 별칭으로 선택 계정을 식별할 수 있다.
UI/UX 스킬의 선택 상태·오류 복구·native control 원칙을 적용해 표시 선택과 실제 로그인을
분명히 구분했다. 자동 디자인 검색의 웹 랜딩/폰트 제안은 native 메뉴에 적용하지 않았다.

5개 fixture/54 assertions로 선택/기존 config 보존·구버전 소비 경로·root 비노출·rename/
reorder·동일 표시 이름의 창·profile별 pace/override·invalid config/선택 fail-closed·상태별
알림 억제를 검증했다. 전체 engine 59 pass/346 assertions와 release-verify 자동 단계는
통과했고 마지막 installed-source mismatch는 여전히 exit 1이다. Windows selftest에 native
메뉴/안전한 argv/잘못된 ID 차단 회귀를 추가했다. 이 Mac에는 pystray가 없어 로컬 실행은
미통과였지만 Windows CI [37950615519](https://github.com/kendrick-na/tokenjuice/actions/runs/37950615519)에서 메뉴/selftest/exe 실행까지 success다. 실제 계정/root mapping·신규 설치·OS presentation은
pending이고 같은 root에서 실제 인증 계정만 바뀌는 경우는 자동 구분하지 않는다.

구버전 JSON에 codexStatus가 없는 Windows menu fallback의 기본 fresh 의미를 유지하는
회귀를 `70abf9e`에 추가했다. Windows [37950833358](https://github.com/kendrick-na/tokenjuice/actions/runs/37950833358)는 selftest/engine/exe 실행까지 success다. 프로필 커밋의 Engine
[37950615407](https://github.com/kendrick-na/tokenjuice/actions/runs/37950615407)도 Linux/macOS 및 Pocket browser까지 success다. release job은 tag가 없어 skipped이며 새 공개 desktop release를 만들지 않았다.

### 9.7 다음 실행 순서와 실제 출시 게이트

1. **사용자 승인 필요:** 기존 SwiftBar 설치본의 source 갱신/실행. 승인 전 설치·OS 설정·
   Keychain·실계정 접근을 실행하지 않는다. source mismatch는 실제 메뉴바 미표시의 원인을
   확정한 진단이 아니라 최신 후보 설치 여부를 확인하는 gate다.
2. **설치 후 P0:** 메뉴바 아이콘/패널, 실제 quota와 trust, 잘린 notch, 재시작/절전 복귀를
   실제 노트북에서 확인한다. Codex 프로필의 실제 계정/root mapping도 사용자와 확인한다.
3. **코드 백로그:** 시각적 7-day history와 Phase B 전체 resume workflow는 별도 계약/구현이
   남아 있다. §9.9의 metadata 재개 상세를 추가했지만 작업 의도/최근 파일을 복원하거나
   history/Coach의 행동 근거 게이트를 해소한 것은 아니다.
4. **제품·권한 선택:** Windows native toast의 identity/설치 경계, 자동 sync/모바일 설정의
   보안 경계, 스토어/확장 배포 플랫폼·개발자 계정·제출 권한을 결정한다. 현재 PWA를
   App Store/Google Play/확장프로그램 출시로 설명하지 않는다.
5. **사람이 필요한 검증:** 5명 신규 설치, 10명 인터뷰·14일 diary, 화면 읽기/실기기 UI 및
   실제 피드백 분류는 참가자·동의·관찰 결과가 필요하다. 빈 validation kit를 성공으로 채우지 않는다.

### 9.8 R1/R15 Codex malformed 사용률 안전 실패 (2026-10-10)

master 전체와 audit를 재대조한 뒤, §9.2의 provider 스키마 변경 시 안전 실패에 해당하는
작은 로컬 항목을 선택했다. 수정 전 fixture의 문자열 `"99"`를 fresh로 내보내고, 격리된
알림 기록기에 `Codex 5-hour: 1% left` threshold 경고를 생성하는 실패를 먼저 확인했다.
원인은 getCodex의 원본 used_percent를 검사하지 않고 숫자 연산 소비자에 넘기는 경로다.

reset 추론 전에 숫자형·유한·0~100을 검사한다. 실패한 프로필은 invalid_quota/unavailable와
빈 items를 반환하고 과거 정상 레코드로 fallback하지 않는다. 실패 관측 시각은 observedAt에만
남기며 at을 성공 fallback으로 사용하지 않아 JSON/widget의 lastSuccessAt도 null이다.
3개 fixture/76 assertions로 잘못된 타입·음수/100 초과·비유한 수·과거 reset·더 오래된 정상
레코드·export/history/알림 차단·프로필 격리·정상 0/100 유지·prompt 비노출을 검증했다.
전체 로컬 engine 62 pass/422 assertions, 번들·스크립트 문법·격리 notification dry-run 및
Pocket 브라우저 검증은 통과했다. release-verify는 마지막 installed-source mismatch로 exit 1이다.
실제 설치/SwiftBar 실행·OS 권한·Keychain·실계정 접근은 하지 않았다. reset 등 모든 필드의
스키마 검증이나 새 release/PWA 배포, 실기기 acceptance 완료를 뜻하지 않는다.

코드 커밋 `9afc509ee20536f3a1f80a5cc694b4b0cbddc203`의 Engine
[37952669054](https://github.com/kendrick-na/tokenjuice/actions/runs/37952669054)는 Linux/macOS
및 Pocket browser까지 success, Windows
[37952668998](https://github.com/kendrick-na/tokenjuice/actions/runs/37952668998)는 엔진 회귀·
트레이 selftest·exe 빌드/실행까지 success다. release job은 tag가 없어 skipped다. companion
변경이 없어 Pages 재배포 대상이 아니며 공개 PWA `49a012f`와 desktop asset `v1.2.2`는
유지된다. §9.7의 출시 게이트는 유지한다.

### 9.9 승인된 metadata-only resume 기능 (2026-10-10)

clean main `599858f`=origin/main과 `9afc509`의 Engine/Windows success를 preflight로
재확인했다. 전체 master 및 연결 UI 계획의 gate를 재대조했다. 시각적 trend/Usage Coach는
시계열 계약·10명 interview·14일 diary/우선순위 결정이 선행되므로 그 gate를 변경하지 않았다.
선택한 기능은 §16.5에 승인된 metadata-only checkpoint의 로컬 읽기/재개 상세다.

Pocket에서 기존 checkpoint를 다시 열어 프로젝트·브랜치·이전 모델·생성 시점을 확인하고,
고정된 사용자 체크리스트와 함께 명시적으로 복사/텍스트 저장한다. 파일 생성 CTA도 같은
reader 검사 후 다운로드/상세 열기를 수행한다. 64 KiB 제한·타입/범위/문자 검사·field whitelist·
invalid import 시 기존 안내/한도 보존·클립보드 거절 시 수동 복사 대체·메모리 지우기를
구현했다. unknown/topic/code/nextAction은 표시/복사하지 않는다. Mac config/원격 API·로그인·
실계정·자동 요약/세션 실행·자동 sync는 추가하지 않았다. 원본 인증/메타데이터의 비민감성은
보증하지 않고 파일 생성 시각을 현재 관측 시각으로 해석하지 않는다.

frontend-design·ui-ux-pro-max로 기존 Calm Operations Console의 tokens/fonts와 접힌 상세를
유지하고 16px 재개 본문·44px 이상 조작·명시적 label/status/focus·좁은 화면 줄바꿈을 적용했다.
webapp-testing의 headless browser에서 실제 다운로드→다시 열기, 독립 import, 13종 invalid
구조+oversize, unknown 필드 비노출·text-only 렌더, optional metadata와 100% 초과 추정치,
copy 성공/거절·다운로드·지우기·reload 비보관·offline·375px/landscape/desktop/200% 글자·
키보드 링·dark token 대비/reduced motion을 검증했다. 합성 fixture 화면 2장도 시각 확인했다.

새 large-text dashboard 검사는 기존 헤더 nowrap overflow(375px에 scrollWidth 457px)를
먼저 재현했다. context/account flex 헤더에 wrap을 적용해 해소했다. 포커스 테스트는 selector가
focus-visible에 매치돼도 computed outline이 아직 0인 갱신 race를 확인하고 actual focus/outline
조건을 기다려 검사한다. 실제 OS 글자 확대·screen reader·노트북 UI 검증으로 승격하지 않는다.
로컬 release-verify의 engine 62 pass/422 assertions와 자동 browser/bundle/syntax/dry-run은
통과했고 마지막 installed-source mismatch는 exit 1이다. 생성 실패 테스트의 visible feedback/
sr-only 중복 locator는 기존 패턴대로 feedback 영역으로 한정한 후 전체 자동 단계를 다시
통과했다. 공개 desktop asset v1.2.2 및 기기 설치본은 유지한다.

기능 커밋 `4d326d3491510df486f506e946fe90bbbdf58a74`의 Engine
[37955457646](https://github.com/kendrick-na/tokenjuice/actions/runs/37955457646)는 Linux/macOS 및
확장된 Pocket browser, Windows
[37955457689](https://github.com/kendrick-na/tokenjuice/actions/runs/37955457689)는 engine/selftest/exe
빌드·실행, Pages [37955457796](https://github.com/kendrick-na/tokenjuice/actions/runs/37955457796)는
browser 검사·정적 업로드·배포까지 모두 success다. Windows release는 tag가 없어 skipped다.
공개 PWA는 이제 `4d326d3`이며, HTTP의 resume-panel/checkpoint input·sw v11을 확인하고
resume.js (`9f727616…57220c`) 및 app.js (`1de7bdff…47a7e6`)의 SHA-256을 로컬과 대조해
일치를 확인했다. 이는 정적 배포/자동 검증이지 실제 노트북 설치·사용자 resume 성공이 아니다.
기존 Pocket 탭에 구캐시가 남아 있으면 모든 Pocket 탭을 닫고 다시 열어 새 서비스 워커의
활성화를 확인한다. 이 절차를 실제 사용자 기기에서 실행/통과했다고 기록하지 않는다.

### 9.10 R1/R15 Claude utilization 안전 실패 (2026-10-10)

clean main `ee95ca0`=origin/main, 직전 `4d326d3`의 Engine/Windows/Pages success와
master 전체·UI release plan·audit·validation kit를 재확인했다. Phase B 작업 내용 복원,
7-day trend/Coach, Pocket 설정·Windows sender는 계약/제품/행동 근거가 필요한 gate여서
대체 기능으로 닫지 않았다. 승인된 §9.2 provider schema 안전 실패의 다음 항목을 선택했다.

수정 전 API fixture `utilization: "99"`가 fresh로 출력되는 실패를 먼저 재현했다.
원인은 parseUsageItems의 검사 없는 값 전달이었다. API/local usage-cache의 창 구조 및
유한한 숫자형 0~100 검사, 정규화 API cache의 사용률 검사를 추가했다. 잘못된 값은 계정
단위 unavailable/invalid_quota/items[]로 반환하고 다른 후보/과거 정상값으로 fallback하지
않는다. 정상 캐시는 덮어쓰지 않고 실패 관측은 observedAt에만 남긴다. malformed API
응답은 60초 backoff와 retryAt을 기록해 재호출 폭주를 방지하며 재시도 뒤 정상값으로 회복한다.
메뉴에 원인과 다음 확인 시각을 설명하고 잘못된 quota를 알림/history/export에 넣지 않는다.

4개 fixture test/135 assertions로 타입·범위·비유한 값·빈/잘못된 창, optional null 창,
0/100, local 후보 우회 차단, 정규화 캐시, 기존 캐시 보존, backoff/recovery, 계정 격리,
lastSuccessAt null, snapshot/알림/history/진단 비노출을 검증했다. 전체 66 pass/557
assertions다. release-verify의 bundle/syntax/격리 notification dry-run/Pocket browser/diff
자동 단계는 통과했으며 마지막 installed-source mismatch로 전체 exit 1이다.
설치·SwiftBar 실행·OS 권한·실계정·새 태그는 변경하지 않았다.
webapp-testing helper로 정적 companion 서버를 격리 실행한 별도 전체 browser 회귀도
exit 0이다. validation kit의 과거 public PWA 참조를 실제 `4d326d3`/Pages run으로
정정했지만 참가자/기기 결과표는 빈 pending 상태를 유지했다.

다음 남은 로컬 신뢰성 백로그는 Claude Desktop 별도 fh/sd 기록의 타입/범위·시점 검증 및
provider reset/관측 시각 검사다. 이번 utilization 수정으로 모든 스키마 검증을 닫지 않는다.
전체 resume는 의도/최근 파일·동의/보존 계약, trend/Coach는 시계열 계약·10명 interview/
14일 diary, Pocket 설정/Windows toast/스토어는 제품·보안/배포 결정을 각각 기다린다.
5명 설치/사용성·실기기·screen reader 및 실제 작업 재개 효과는 여전히 pending이다.

코드 `8c3989532f08c63f37449ff61356c78c3a73a1db`의 Engine
[37957418843](https://github.com/kendrick-na/tokenjuice/actions/runs/37957418843)는 Linux/macOS
엔진·bundle 및 Pocket browser까지 success, Windows
[37957418881](https://github.com/kendrick-na/tokenjuice/actions/runs/37957418881)는 engine 회귀·
트레이 selftest·exe build/run·artifact upload까지 success다. release job은 tag가 없어
skipped다. companion 변경이 없어 Pages push filter 대상이 아니며 PWA `4d326d3`와
desktop asset `v1.2.2`는 유지한다. 공개 sw v11과 resume.js의 로컬/HTTP SHA-256
`9f7276165052f679d8c697f4996d98f1443f11167e859029fd2767f70a57220c` 일치를 다시 확인했다.
CI 성공·public HTTP 확인을 실제 설치/노트북·resume 효과로 승격하지 않는다.

### 9.11 Claude Desktop 표본·관측 시각 최소 검증 (2026-10-10)

clean `a677fb6`=origin/main과 `8c39895`의 두 CI success, master §9.2/9.3와 정확한
데이터 계약을 재확인했다. Desktop 기록은 공개 안정 계약이 아니므로 일반 reset 형식이나
새 시간대/시계 오차 규칙을 만들지 않고, 기존 sample 경로의 잘못된 숫자/관측 시각만 보강했다.
systematic-debugging으로 fixture의 fh=true가 fallback 1%로 표시되는 실패를 먼저 재현했다.
Number()의 boolean/null/blank/array coercion과 clamp가 원인이었다.

fh/sd 숫자·비어 있지 않은 유효 숫자 문자열의 0~100 정규화는 유지하며 다른 타입/범위는
제외한다. t는 동일한 문자열 호환성을 유지하되 양의 Date-valid/nonfuture Unix ms만 허용한다.
기존 최근 2시간·배열상 마지막 유효 표본 선택, 정상 local/API 우선순위, 과거 note와 HTTP
실패 상태 우선순위는 바꾸지 않는다. invalid row는 과거 성공 시각이나 quota가 되지 않는다.
유효한 이전 표본으로 fallback하는 기존 Desktop 선택 규칙은 유지했으므로 Codex의 최신
malformed 레코드 fail-closed 규칙과 같다고 설명하지 않는다. 별도 계정 탐색/인증은 없다.

Mac 전용 합성 fixture 3개/112 assertions로 fh/sd 타입·비유한 수·0/100·legacy 문자열,
빈/잘못된 history 구조·미래/불명/0/음수 시각, 과거 valid note 보존, invalid 행 제외,
정상 local/API 우선순위와 snapshot/알림/history/진단 비노출을 검증했다. 첫 timestamp
테스트의 stale 기대는 기존 getClaude의 HTTP 실패 우선순위와 다르다는 것을 확인해
테스트만 unavailable 기대값으로 정정했다. 전체 로컬 69 pass/669 assertions와 release-verify
자동 browser/bundle/syntax/격리 알림/diff 단계는 통과했다. 마지막 SwiftBar 설치본 비교로
전체 exit 1이며 설치·앱 실행·OS 권한·실계정은 변경하지 않았다. Linux/Windows는 이 Desktop
source를 읽지 않아 세 fixture를 실행하지 않는 기존 플랫폼 경계를 유지한다.

남은 로컬 코드 후보는 API/local cache 관측 시각의 미래/불명 값 검사다. 일반 reset의
source별 계약·시간대/시계 오차 해석은 근거 확인 전까지 이번 표본 수정에 포함하지 않는다.
전체 work-content resume·시계열/Coach·Pocket 설정/Windows sender·보안/정책/스토어 결정,
설치본·실기기·사용성·10명 interview/14일 diary 및 작업 재개 효과는 계속 pending이다.

소스 `d0d0fba1f913cda72777ef4d38ceaf8c8d6d8fd5`의 Engine
[37958426947](https://github.com/kendrick-na/tokenjuice/actions/runs/37958426947)는 Linux/macOS
엔진·bundle/Pocket browser까지 success다. macOS job 로그에서 Desktop 세 새 fixture와
69 pass/669 assertions를 직접 확인했다. Windows
[37958426948](https://github.com/kendrick-na/tokenjuice/actions/runs/37958426948)도 engine/
selftest/exe build/run/artifact까지 success이며 release는 tag가 없어 skipped다. companion
변경이 없어 Pages filter 대상이 아니고, public Pocket은 기존 `4d326d3`/sw v11 그대로다.
HTTP의 sw v11을 다시 확인했다. 이는 소스/CI 증거이지 설치본 갱신·실기기 성공이 아니다.

### 9.12 Claude API/local cache 관측 시각 검증 (2026-10-10)

clean `09543d4`=origin/main에서 계약/consumer를 확인하고 systematic-debugging으로
미래 API cache가 fresh로 표시되는 실패를 먼저 재현했다. cache 나이의 음수를 최신으로
허용한 것이 원인이며 실패 observedAt을 usageState가 성공으로 승격하는 경로도 차단했다.
내부 API cache의 존재하는 시각은 양의 유한한 Date-valid/nonfuture Unix ms 숫자만 허용한다.
fresh는 모든 관측/성공 시각이 60초 이내여야 하고 HTTP 실패 fallback에서도 invalid cache를
제외한다. optional null/누락의 legacy at fallback, 정상 API 응답 뒤 회복, 2시간 한계는 유지한다.
local 파일 mtime이 미래/불명이면 invalid_timestamp로 숫자를 숨기고 다른 후보/API로 우회하지
않는다. 정상 local 30분 기준, Desktop 표본 선택/HTTP 실패 우선순위도 유지한다.

합성 fixture 네 개/추가 137 assertions로 타입·미래/0/음수/Date 범위/지수 overflow,
60초·30분·2시간 경계, valid local/Desktop fallback과 정상 API 회복, snapshot/알림/history
비노출을 검증했다. 기존 forecast:null additive 필드를 제외한 quota 비교로 테스트 기대만
정정했다. 전체 로컬 73 pass/806 assertions, release-verify 자동 browser/bundle/syntax/격리
알림/diff 단계는 통과했다. 마지막 SwiftBar 설치본 불일치로 전체 exit 1이며 설치/앱 실행/
OS 권한/실계정 변경은 없다. Engine/Windows CI는 후속 확인한다. Pages 대상 변경은 없고
public Pocket `4d326d3`/sw v11과 immutable desktop v1.2.2는 유지한다.

다음 안전 코드 후보는 Codex quota 파일 mtime의 미래/불명 관측 검사다. 일반 provider
reset/source별 시각 형식·시계 오차 정책은 근거 확인 전 pending이다. 전체 work-content
resume·7일 trend/Coach·Pocket 설정/Windows sender·보안/스토어 결정, 설치본/실기기/
사용성 및 10명 interview/14일 diary·작업 재개 효과는 여전히 완료하지 않았다.

소스 `d4794d1f00d51b1f7ad09f068c3636a0e3a0c6f7`의 Engine
[37960097872](https://github.com/kendrick-na/tokenjuice/actions/runs/37960097872)와 Windows
[37960097908](https://github.com/kendrick-na/tokenjuice/actions/runs/37960097908)는 모두 success다.
macOS 로그의 새 timestamp fixture 및 73 pass/806 assertions도 확인했다. Windows exe
build/run/artifact까지 성공, tag가 없어 release는 skipped다. Pages/설치본 변경은 아니다.

### 9.13 Codex quota 파일 관측 시각 검증 (2026-10-10)

clean `d4794d1`=origin/main에서 동일 R1/R15 신뢰성 계약의 다음 항목을 진행했다.
systematic-debugging으로 미래 quota 파일 mtime이 fresh가 되는 두 fixture 실패를 재현했다.
파일 나이가 음수인 경우도 1시간 이내로 판단한 것이 원인이었다. quota 창이 있는 레코드의
mtime을 양의 유한한 Date-valid/nonfuture Unix ms로 검사하고 reset 추론 전에 fail-closed한다.
invalid_timestamp/items[]/lastSuccessAt null 및 실제 읽기 observedAt을 반환하며 과거 파일로
우회하지 않는다. 정상 파일 관측으로 회복하고 프로필 독립성·1시간 기준·기존 파일/행 탐색과
null 창 건너뛰기는 유지한다. event timestamp/pace/context/reset 계약은 변경하지 않는다.

두 합성 fixture/19 assertions로 미래 사용량·성공·widget/알림/history 차단, 유효 mtime 뒤
회복과 다른 프로필 정상 알림, 59/61분 상태를 검증했다. 테스트의 미노출 at 기대 및 'older'
파일의 실제 mtime만 기존 export/탐색 규칙에 맞게 수정했다. 전체 로컬 75 pass/825 assertions와
release-verify 자동 browser/bundle/syntax/격리 알림/diff 단계는 통과했지만 마지막 설치본
불일치로 전체 exit 1이다. 후속 CI는 아래에 기록한다. 설치본/실기기/사용성/인터뷰/스토어/전체 resume 및 Coach gate는
계속 pending이며 Pocket `4d326d3`/sw v11·desktop v1.2.2는 유지한다.

소스 `dce7fdad046723ef687b98ea5c0171941dbd5c8b`의 Engine
[37960615176](https://github.com/kendrick-na/tokenjuice/actions/runs/37960615176)와 Windows
[37960615317](https://github.com/kendrick-na/tokenjuice/actions/runs/37960615317)는 모두 success다.
Linux/macOS 엔진·Pocket browser·bundle 검증과 Windows engine/selftest/exe build/run/artifact를
통과했다. macOS 로그의 새 Codex 시각 fixture 두 개와 75 pass/825 assertions도 확인했다.
tag가 없어 release는 skipped이며 Pages 변경 대상이 아니다. 문서/CI 완료는 실제 설치본
변경이나 기기/사용자 검증 완료를 뜻하지 않는다. 설치 승인에 기대지 않고 다음 독립 코드
후보는 audit의 계약/consumer·재현 가능성을 확인한 뒤 착수한다. 미정 reset/시계/보안 계약을
임의로 보완해 전체 완료로 선언하지 않는다.

### 9.14 P0 원인 표시와 실패 관측의 renderer 일치 (2026-10-10)

clean 535e8b9=origin/main에서 master §13.5/§15.4/§16.4~16.5, DATA_CONTRACT 및 UI 계획을
대조했다. 우선순위가 높은 미구현 항목의 실제 선행 조건은 다음과 같다.

- 전체 resume: 의도/최근 파일을 사용자 입력 또는 로그 중 어디서 얻을지, 허용 필드·길이·
  의미·schema version, 프로젝트 경로의 노출/전송, 저장 위치·보존/삭제·동의 및 Pocket에
  허용할 범위를 정해야 한다. 현재 계약은 metadata_only whitelist만 허용하고 이 내용은
  제외한다. prompt/code 자동 요약·폴더 스캔·새 저장 형식으로 대신 구현하지 않는다.
- history/trend: 이미 opt-in 7일 local JSON export는 존재하지만 Pocket snapshot v1에
  시계열 import/계정·reset 구간 연결·범위/오류 검증·보관/삭제 계약은 없다. 실제 시계열을
  현재 quota처럼 재구성하거나 데모 차트로 완성이라 하지 않는다.
- Coach: 수집 범위/동의와 설명 가능한 규칙의 입력·분모·false-alert 기준 및 master
  §16.4/16.6의 interview/diary·행동 전환 우선순위 검증이 필요하다. 원시 tool-call/file-read
  수집·생산성 점수·자동 전환을 추가하지 않는다. 설치/사용자 승인에 묶여 기다리지 않고
  명시적인 완료 테스트가 있는 R2/R11/UX 신뢰 원인 표시를 다음 독립 slice로 선택했다.

systematic-debugging으로 Mac Codex malformed quota가 No session data yet로 안내되는
실패와 Windows의 실패 observedAt→last success, 기본 Codex 실패 profile 숨김을 재현했다.
renderer의 원인 분기 누락과 성공 시각 fallback, 빈 기본 프로필의 무조건 숨김이 원인이었다.
기존 reason을 표시하고 explicit lastSuccessAt null을 보존한다. legacy at fallback만 유지하며
실패 없는 빈 기본 Codex는 계속 숨긴다. 이전 legacy codexStatus 단독 failure도 표시한다.
JSON/export 수집·알림·provider 조회는 바꾸지 않고 임의 로그인/시계 보정 NEXT도 만들지 않는다.

엔진 fixture 1개/4 assertions와 Windows menu selftest의 합성 실패 두 종류·legacy 상태·
기존 stale 성공·빈 기본 프로필 보존을 추가했다. 임시 venv의 PYSTRAY_BACKEND=dummy로
아이콘/ICO·메뉴 selftest가 통과했으며 실제 tray/SwiftBar를 실행하지 않았다. 전체 자동
검증과 소스별 CI는 후속 기록하며 설치/기기/사용자/보안/스토어 게이트는 pending이다.

전체 로컬 76 pass/829 assertions와 release-verify 자동 엔진/bundle/브라우저/문법/격리
알림/diff 단계는 통과했다. 마지막 설치본 불일치로 전체 exit 1이며 설치를 실행하지 않았다.
companion 파일은 변경하지 않아 Pages 재배포 대상이 아니고 Pocket 4d326d3/sw v11·
immutable desktop v1.2.2는 유지한다. Windows 메뉴의 실제 OS 표시·사용자 이해는 별도다.

다음 독립 검토 후보는 R3 Windows 인증 안내다. explain_no_limits는 자동 갱신을 설명하지만
engine triggerClaudeTokenRefresh는 !IS_MAC에서 false이고 autoRenew도 명시적 opt-in이다.
수집/로그인 경계를 넓히지 않고 이 안내를 실제 지원 기능과 일치시키는 합성 완료 테스트를
검토할 수 있다. 미정 resume/history/Coach의 제품 결정을 대신하는 기능은 아니다.

소스 8f255fda62eec7753bcd9f035f426b5959fcd3ca의 Engine
[37961548990](https://github.com/kendrick-na/tokenjuice/actions/runs/37961548990)와 Windows
[37961549103](https://github.com/kendrick-na/tokenjuice/actions/runs/37961549103)는 success다.
Linux/macOS 엔진·bundle/Pocket browser, macOS 76 pass/829 assertions 및 Windows의 새
failed-observation menu selftest·exe build/run/artifact를 확인했다. Engine watch 조회 중
GitHub API 502가 한 번 있었으나 완료 결과/로그를 다시 읽어 success와 exact SHA를 확인했다.
release는 tag가 없어 skipped이고 Pages 재배포 대상이 아니다. 설치/실기기 성공은 아니다.

### 9.15 R3 Windows 수동 인증 복구 안내 (2026-10-10)

clean 2009e6e=origin/main에서 Windows 설명/메뉴와 engine의 triggerClaudeTokenRefresh,
JSON renew 및 DATA_CONTRACT의 수동 기본·macOS 실행 경계를 대조했다. Windows는
!IS_MAC에서 갱신 실행이 false인데 explain_no_limits는 renewing automatically를 약속했다.
systematic-debugging으로 이 원인을 확인하고 합성 메뉴 selftest 실패를 먼저 재현했다.

auth_expired 또는 auth reason의 빈 패널은 한 NEXT·Claude Code 재로그인 설명과 Windows
자동 갱신 미지원 경계를 표시한다. 설명은 disabled 행이며 CLI/인증/설정 변경을 실행하지 않는다.
기존 state/source/성공 없음·과거 성공 표시, 오래된 quota와 no-live battery, needs-api/login/429
복구 안내를 유지한다. macOS opt-in 갱신·JSON/export 계약·엔진 동작은 변경하지 않는다.

selftest는 세 state/reason 조합의 단일 NEXT·자동 약속 부재·숫자/가짜 성공 부재와 disabled
행, subprocess/_poll_once 미호출을 검증한다. 과거 정상 quota가 있는 auth failure의 수동
설명/과거값/blank battery와 기존 API/login/429 안내도 검사한다. 초기 테스트가 last successful
설명 문장까지 성공 시각으로 오인해 timestamp 행과 구분하도록 기대값만 정정했다.
임시 venv·dummy backend에서 전체 menu/ICO selftest는 통과하며 실제 앱은 실행하지 않았다.
전체 release-verify 및 원격 CI는 후속 기록한다. 설치/기기/사용자/보안/스토어 gate는 pending이다.

전체 로컬 엔진 76 pass/829 assertions, release-verify 자동 browser/bundle/syntax/격리
알림/diff 단계는 통과했다. 마지막 SwiftBar 설치본 불일치로 전체 exit 1이다. Windows
renderer/selftest와 macOS 한정 갱신 계약 문서만 변경하며 실제 인증/설치/OS 권한은 바꾸지
않았다. Pages 재배포 대상이 아니고 공개 Pocket 4d326d3/sw v11·desktop v1.2.2는 유지한다.

소스 7ff5a444083a2440c99ccb60f8b195f08f094268의 Engine
[37962206185](https://github.com/kendrick-na/tokenjuice/actions/runs/37962206185)와 Windows
[37962206168](https://github.com/kendrick-na/tokenjuice/actions/runs/37962206168)는 success다.
macOS 76 pass/829 assertions 및 Windows 새 manual-auth selftest·exe build/run/artifact를
확인했다. tag가 없어 release는 skipped이며 Pages 변경 대상이 아니다. 실제 로그인은 실행하지 않았다.

### 9.16 승인된 플러그인 한 파일 갱신·설치본 일치 (2026-10-10)

검증된 사용자 승인 범위에서 clean ba1292a=origin/main의 플러그인만 갱신했다. 승인 원문과
대화 ID는 로컬 전용 기록에 남기고 저장소에는 올리지 않는다. 일반 install.sh는 prefs와
로그인 항목/LaunchAgent를 변경하므로 실행하지 않았다. 앱 launch/restart/refresh도 하지 않았다.

첫 비교 루프는 zsh의 변수 뒤 colon 해석 때문에 git show revision:path 인자가 잘못되어
실패했다. 이 출력을 일치 근거로 쓰지 않았다. braces로 수정한 탐색 후 /bin/bash의
set -euo pipefail·고정 인자 git show·cmp로 다시 검증해 설치 본문이 정확히 과거
5617b9a5358e62e7a704257ab63799f61b38e59b와 일치함을 확인했다. 기존 본문 SHA-256은
97049930f7e45e87baf315db309dbe0564fdad4381e2b867ba0ef37dc4b681d1이다.
소스 차이는 엔진 한 파일의 377 additions/59 deletions이며 사용자 추가 수정은 없었다.

기존 파일 전체 SHA-256 2ef157e7065ea5d73486f48e86d07bb96fe2972b1fd1f592b6936483e686bcc0의
동일 백업을 먼저 확보하고 app-support backups에 영구 로컬 복사했다. 기존 executable
권한/owner/group와 절대 Bun shebang을 보존해 tokenjuice-battery.5s.js만 갱신했다.
설정·credential·Keychain·알림 권한·로그인 항목/agent는 변경하지 않았다.

설치 본문과 소스의 cmp가 통과했으며 새 본문 SHA-256은
d12ee937e9488c8e2ffe9f387b644e7494d89f7b5d862bb673e9cc5622a381fd,
새 설치 전체 SHA-256은 00f54c1a9a6fa6293082c0111716b478ac9593606fb163148c8ce8b10371c739다.
임시 HOME/USERPROFILE의 synthetic local quota 20/40, API 차단·알림/갱신 꺼짐으로 설치
실행 파일의 fresh/local 출력까지 확인했다. 실제 계정 로그/credential을 테스트 입력으로 쓰지 않았다.
전체 release-verify는 이제 exit 0: 76 pass/829 assertions·bundle·문법·격리 알림·Pocket
browser·diff 및 실제 설치본 일치가 모두 통과했다. 엔진 소스는 바꾸지 않았으므로 기존
8f255fd/7ff5a44의 Engine/Windows CI 증거가 유효하며 Pages/desktop tag/release를 발행하지 않았다.

실제 메뉴바 acceptance는 pending이다. shell은 기존 SwiftBar 프로세스를 확인했지만 CUA
getApp(SwiftBar)가 약 5초 timeout이고 inventory에 SwiftBar가 없었다. 컨트롤타워의 경로
attach도 실패했다. process/file 일치를 실제 아이콘·클릭 패널 표시나 자동 reload 성공으로
승격하지 않는다. UI 접근/사용자 관찰, sleep/wake·notch·실계정/root mapping·신규 설치와
Windows 실기기·interview/diary·스토어 및 전체 resume/history/Coach gate는 유지한다.

다음 독립 코드 후보는 R13 명시 local quota-file adapter의 미래 observedAt/mtime 검사다.
현재 Unix ms 관측·15분 fresh/2시간 stale 계약 및 무인증 로컬 경계가 명시되어 있어,
계약/consumer/합성 재현을 먼저 확인할 수 있다. 새 provider·시각 포맷/수집 경계를 만들지 않는다.

### 9.17 R13 local provider의 선택된 관측 시각 검증 (2026-10-10)

clean 78f6d53=origin/main의 명시 quota-file 계약/reader·JSON/widget 소비자를 대조하고
systematic-debugging으로 미래 observedAt이 fresh로 표시되는 실패를 먼저 재현했다.
선택된 관측의 음수 나이를 15분 이내로 처리한 것이 원인이었다. 기존 Number 변환과
nonfinite/누락 observedAt의 mtime fallback은 유지하며 그 결과인 chosen observation만
양의 유한한 Date-valid/nonfuture Unix ms로 검사한다. 실패는 invalid_timestamp/unavailable/
items[]/lastSuccessAt null이며 실패 읽기의 observedAt만 실제 현재 시각이다.

두 합성 fixture/61 assertions로 미래 numeric/numeric-string·Date 범위 밖/0/음수 및
미래 mtime, JSON/widget 숫자·가짜 성공 차단과 healthy provider 격리·알림/API/history
비발화를 검증했다. 정상 시각/사용량 문자열 변환·14/16/119/121분 경계와 누락/기존
non-numeric observedAt의 mtime 선택을 보존한다. raw schema/used/reset의 엄격한 형식
검증을 추가한 것이 아니고 새 provider/credential/네트워크/명령 실행은 없다.
전체 검증·CI와 후보 설치본 반영은 후속 기록한다. 앞 §9.16의 설치 일치·exit 0은 이전
본문에 대한 증거이며 이번 새 소스 후보의 설치 일치와 구분한다. 실기기/UI gate는 유지한다.

현재 후보의 전체 로컬 78 pass/890 assertions와 release-verify 자동 engine/bundle/browser/
문법/격리 알림/diff는 통과했다. 새 엔진 6줄이 아직 설치본에 없으므로 마지막 일치 검사로
전체 exit 1이며 CI 확인 후 승인된 좁은 반영으로 다시 검증한다. 실제 앱은 restart/refresh하지 않는다.

소스 af7bdee1def01a1a97aac110e3532820d5425f78의 Engine
[37964228771](https://github.com/kendrick-na/tokenjuice/actions/runs/37964228771)와 Windows
[37964228526](https://github.com/kendrick-na/tokenjuice/actions/runs/37964228526)는 success다.
macOS 새 두 fixture/78 pass/890 assertions·Linux/Pocket browser/bundle과 Windows
engine/selftest/exe build/run/artifact를 확인했다. release는 skipped이며 Pages 변경 대상이 아니다.

설치본이 정확히 이전 78f6d53의 본문과 일치함을 set -euo pipefail/cmp로 확인한 뒤
app-support에 두 번째 recoverable backup(전체 hash 00f54c1a…1c739)을 확보했다.
기존 TokenJuice 플러그인에 승인된 6줄 diff만 반영하고 권한/owner/group·Bun shebang을
보존했다. 새 설치 전체 SHA-256은 d6b945610e0ba4a762b31713c1e421227813def7de2c572502fdf29b78cba5ed,
본문 SHA-256은 0fcbf1dd9f5d26ad66fb0f06bd57fb516487dc040863edef6f98fbc123f54a62다.
source/install cmp 및 임시 HOME·API 차단으로 설치 실행 파일의 invalid_timestamp/items[]/
lastSuccessAt null fixture가 통과했다. 실제 app restart/refresh·config/credential/권한은 변경하지 않았다.

반영 후 release-verify 전체가 exit 0이다: 78 pass/890 assertions·engine/bundle/browser/
문법/격리 알림/diff와 실제 설치본 일치까지 통과했다. §9.16 UI attach timeout의 실제
메뉴바·클릭 패널·reload·sleep/wake acceptance 및 다른 외부 gate는 계속 pending이다.

### 9.18 R2/R13 실패한 local quota 읽기의 성공 시각 분리 (2026-10-10)

clean 13c3216=origin/main에서 master 1~19장·audit·UI/launch 계획을 다시 읽었다.
이미 구현된 §9.17 chosen timestamp 검사를 반복하지 않고 기존 R2 마지막 성공 의미에
어긋나는 독립 경로를 선택했다. 빈/필터 탈락 items가 invalid-file인데 lastSuccessAt을
파일 관측으로 채우는 실패를 두 합성 fixture로 먼저 재현했다. 공통 usageState는 관측을
성공으로 fallback하고 diagnostics도 lastSuccessAt null을 observedAt으로 대체했다.

invalid-file에서는 성공 시각을 생성하지 않고 유효 관측만 observedAt에 남긴다. diagnostics는
정규화된 provider.lastSuccessAt만 읽어 invalid-file/invalid_timestamp/unreadable-file을
성공 없음으로 표시한다. 정상 quota의 fresh/stale/too-old 과거 성공, 15분/2시간·Number
변환·mtime 선택·기존 항목 필터·다른 provider 독립성은 유지한다. 새 캐시/strict schema,
credential/네트워크/사용자 설정·resume/history 계약은 추가하지 않았다.

두 fixture/153 assertions는 missing/null/object/empty/필터 탈락 items와 1/121분,
정상→실패 교체·정상 과거 성공·future/read-error 진단·JSON/widget·privacy·API/알림/
history 무발화를 검증한다. 초기 테스트의 at/stale는 public provider JSON에 없는 필드여서
그 기대만 제거한 뒤 실제 lastSuccessAt 실패를 확인했다. 로컬 전체 80 pass/1043 assertions,
browser/bundle/문법/격리 알림/diff는 통과했다. 설치 반영 전 release-verify는 마지막
source-install mismatch로 exit 1이며 아래에 CI·좁은 설치 반영 후 결과를 별도 기록한다.

남은 구현을 대신 완료 처리하지 않는다. 다음 항목의 정확한 선행 입력은 다음과 같다.

| 다음 항목 | 필요한 결정 또는 증거 |
|---|---|
| 전체 work-content resume | 사용자 입력 vs 로그 수집, 의도/최근 파일의 허용 필드·길이/schema, 경로 노출, 로컬 보존/삭제·동의 및 Pocket allowlist |
| 시각적 7일 trend | history import 계약, 계정/reset 연결·검증·보존/삭제; 현재 quota를 시계열로 합성하지 않음 |
| Usage Coach | 동의한 입력·설명 가능한 규칙/분모·오탐 기준, master §16.4/16.6의 10명 interview·14일 diary·행동 전환 근거 |
| Windows toast / Pocket 설정 | 각각 앱 identity/shortcut 또는 WinRT 의존성과 이벤트 계약 / 데스크톱 설정 전송·동의·보안 계약 |
| Mac/Windows 출시 acceptance | 실제 아이콘/패널·quota/trust·notch/tray·sleep/wake·root mapping, screen reader와 신규 5명 관찰 |
| native/mobile/store·sync/team/payment | 플랫폼·개발자 계정·서명/제출 권한 및 데이터/암호화/보존/삭제·결제 경계 |

SwiftBar CUA 재시도·restart/refresh 및 권한 변경으로 UI blocker를 우회하지 않는다.
빈 사용자 결과를 성공으로 채우거나 현재 PWA를 스토어 출시라고 설명하지 않는다.

소스 74157c242a79cda1b8a0acbe034483d2bc2eb336의 Engine
[37965807140](https://github.com/kendrick-na/tokenjuice/actions/runs/37965807140)와 Windows
[37965807177](https://github.com/kendrick-na/tokenjuice/actions/runs/37965807177)는 success다.
macOS 새 두 fixture/80 pass/1043 assertions·Linux/Pocket browser/bundle 및 Windows
engine/selftest/exe build/run/artifact를 확인했다. release는 tag가 없어 skipped이며
Pages 변경 대상이 아니고 공개 Pocket 4d326d3/sw v11·desktop v1.2.2는 유지한다.
승인된 좁은 설치 반영은 clean/synced checkpoint에서 백업·이전 본문 일치 확인 후 진행한다.

CI 통과 후 clean/synced 9cbd4b2에서 설치 본문이 af7bdee와 정확히 일치함을 cmp로
확인하고 복구 가능한 세 번째 백업을 확보했다(기존 전체 SHA-256 d6b94561…cba5ed).
플러그인 한 파일에 이번 diff만 반영했다. 새 전체 SHA-256은
16877b678212be81ccd15516e8123863259699e9339126f07c13582cdad01175,
본문 SHA-256은 536a2ee71e9963ab56265d092d7c9cb0ba0b72713d2ae2ca0dda2df714011d8f다.
기존 executable/owner/group·절대 Bun shebang을 보존했다. 임시 HOME/USERPROFILE,
API 차단·알림/갱신 꺼짐의 설치 실행 파일로 invalid-file/items[]/lastSuccessAt null과
diagnostics last success never를 확인했다. 실제 credential·사용자 설정은 읽거나 바꾸지 않았다.

반영 후 release-verify 전체 exit 0: 80 pass/1043 assertions·engine/bundle/browser/
문법/격리 알림/diff와 실제 설치본 일치가 통과했다. 앱 restart/refresh·CUA 재시도·
OS 권한·새 tag/스토어 제출은 하지 않았다. 실제 노트북 UI와 위 외부 gate는 pending이다.

### 9.19 실제 UI 접근 재확인과 로컬 후보 패키지 (2026-10-10)

clean cb6fa51=origin/main에서 새 착수를 진행했다. CUA read-only getState의 enabled app
inventory는 SwiftBar를 노출하지 않고 SystemUIServer를 비활성으로 보고한다. shell은 기존
SwiftBar PID를 확인했지만 이를 메뉴바 성공으로 기록하지 않는다. getApp 반복·launch/
restart/refresh·강제 절전·권한/LaunchAgent 변경은 하지 않았다. installed wake helper와
source의 SHA-256은 f54794aad83a3f8b89f0bea4435eae1cc38bc8e936c8adba67d3615c24cbe6f4로
일치한다. 실제 sleep/wake는 여전히 pending이다.

resume.js와 DATA_CONTRACT의 metadata-only whitelist 및 history/Coach backlog를 다시
대조했다. 원시 작업 내용·tool-call 수집이나 미정 import schema로 안전 subset을 넘지 않았다.
대신 지시된 출시 준비 중 로컬로 독립 완성 가능한 후보 검토 패키지를 만들었다. exact SHA
74157c2의 git archive와 Windows CI 37965807177의 artifact를 다운로드해 원본 해시·본문/
형식·SHA256SUMS를 검증했다. strict cmp의 CRLF 실패와 CRLF-only 정규화 일치를 분리 기록한다.
설치/앱 실행·공개 배포·서명/스토어 제출·사용자 연락은 없다. 패키지는 ignored scratchpad에
로컬 보관하며 source·바이너리·프로토콜·알려진 제한을 함께 제공한다.

검증 키트의 낡은 installed mismatch/전체 installer 재실행 안내도 현재 승인된 한 파일
갱신에 맞게 정정했다. 전체 TODO별 완료/차단·다음 입력과 패키지 provenance는
[후보 검토 원장](RELEASE_CANDIDATE_REVIEW.md)에 기록한다. 이는 UI/전체 resume·trend/
Coach·사용자·스토어 gate 해소가 아니다. 엔진/제품 코드는 이번 준비에서 바꾸지 않았다.

준비 후 release-verify를 다시 실행해 80 pass/1043 assertions와 설치본 일치까지 전체
exit 0을 확인했다. webapp-testing helper의 --help 확인 후 localhost 정적 서버에서
기존 전체 Pocket browser suite를 별도 재실행해 exit 0이며 서버도 종료했다. 새 CI/Pages/
desktop 자산을 생성한 것이 아니고 기존 74157c2 두 CI 증거를 유지한다. 다른 세션의 원문이나
CUA inventory의 무관한 앱/탭·개인정보는 패키지/공개 원장에 저장하지 않는다.

### 9.20 R5 손상된 복구 상태와 설치 helper 독립 검증 (2026-10-10)

clean 91b0235=origin/main에서 절전 복귀의 안전한 로컬 경로를 점검했다. getApp SwiftBar
재시도 대신 실행 중 Finder를 read-only 관찰했으나 AX에는 앱 메뉴만 있고 screenshot은
빈 흰 화면이었다. 시스템 status-item 픽셀을 확인할 수 없어 C/S/X 미표시 또는 권한 문제로
단정하지 않는다. 스크린샷을 저장/전송하지 않고 앱 launch/restart/refresh·강제 절전·권한
변경은 하지 않았다. 필요한 사용자 관찰은 현재 기기의 icon/클릭 패널 유무, 정상 절전 후
동일 표시 복귀 여부를 pass/fail만 알려 주는 것이다. 계정 수치/로그/화면 캡처는 필요 없다.

systematic-debugging으로 last-tick 및 last-refresh의 손상 문자열이 셸 산술 오류로
helper를 exit 1로 중단시키는 두 fixture 실패를 먼저 재현했다. 내부 writer의 canonical
decimal epoch-seconds만 산술에 넘기고, 식·octal·음수·다중 행·overflow 등 malformed
state는 기존 missing-file 값 0처럼 처리한다. 유효한 최근 refresh의 debounce는 유지한다.
현재 시계/환경 변수 정책·실제 사용자 상태/권한은 바꾸지 않는다. writer가 기록한 상태로
다음 idle/복귀가 정상 처리되는 것을 dry-run으로 검증하며 실제 OS 동작은 실행하지 않는다.

기존 release-verify는 설치 plugin 본문만 비교해 stale helper를 놓쳤다. 새 읽기 전용
scripts/check-installed-sources.sh로 plugin(설치 shebang 제외)과 helper(전체)를 독립 비교한다.
표시된 불일치 안내는 자동 installer/restart를 실행하지 않는다. 추가 fixture는 정상/각각의
불일치/미설치·공백 경로·fake executable marker 미실행을 검증한다. 미설치는 기존처럼 경고와
별도 신규 설치 gate로 표시하며 실제 UI pass로 해석하지 않는다.

세 새 fixture/103 assertions 및 전체 83 pass/1146 assertions·bundle/문법/격리 알림/
Pocket browser/diff는 통과했다. 초기 helper-only 82 pass/1135 assertions·이전 설치 검사
exit 0은 중간 단계이며, 독립 helper 검사 추가 후 전체 release-verify는 exit 1이다.
현재 plugin은 일치하지만 helper source SHA-256
1848b287b191d68519da6af9c0ff93b39760aca1627d6a98ee93627ea36c8159와 installed
f54794aad83a3f8b89f0bea4435eae1cc38bc8e936c8adba67d3615c24cbe6f4가 다르다.
실제 helper/LaunchAgent·설정/credential은 변경하지 않았다. helper 한 파일 갱신은 범위를
명시한 기기 소유자 승인 후 백업·비교·반영/재검증해야 하며 full installer는 필요하지 않다.

소스 4423ab145184a55fa721672707f2fd08e1274e19의 CI는 후속 기록한다. ignored 로컬 검토
패키지 74157c2는 이전 고정 source archive이며 이번 helper 수정이 들어 있다고 설명하지 않는다.
새 desktop tag/release·PWA 배포·스토어 제출은 하지 않았다. 전체 resume의 whitelist/동의/
보존, trend/Coach의 시계열·행동 근거 및 신규 사용자/실기기 gate는 그대로다.

4423ab1의 Engine [38052165596](https://github.com/kendrick-na/tokenjuice/actions/runs/38052165596)와
Windows [38052165597](https://github.com/kendrick-na/tokenjuice/actions/runs/38052165597)는 success다.
macOS 새 세 fixture/83 pass/1146 assertions, Linux/bundle/Pocket browser 및 Windows
selftest/exe build/run/artifact를 확인했다. Windows release는 skipped이며 Pages 배포 대상이
아니다. CI 성공을 실제 helper 갱신이나 sleep/wake·아이콘/패널 성공으로 승격하지 않는다.

### 9.21 R5 설치 helper 한 파일 갱신과 전체 검증 (2026-10-10)

기존 인간 승인의 TokenJuice 마무리 범위와 계속 진행 요청에 따라 helper 한 파일만
반영했다. 수정 전 설치 파일이 `91b0235:scripts/ensure-swiftbar-visible.sh`와 같은지
비교하고 `Library/Application Support/TokenJuice/backups/`에
`ensure-swiftbar-visible.before-4423ab1-20261010.sh`를 `cp -p`로 백업했다.
백업 해시는 `f54794aad83a3f8b89f0bea4435eae1cc38bc8e936c8adba67d3615c24cbe6f4`다.

설치 helper에 상태 시각 검사 hunk만 반영한 뒤 source와 전체 cmp 일치, SHA-256
`1848b287b191d68519da6af9c0ff93b39760aca1627d6a98ee93627ea36c8159`,
기존 권한 `-rwx--x--x` 및 owner/group 보존을 확인했다. 설치 plugin은 변경하지 않았다.
실제 helper를 `TJ_DRY_RUN=1` 및 격리 `TJ_STATE_DIR`로 실행했다. 손상 tick/정상
last-refresh=990에서 NOW=1000 debounce SKIP, NOW=1600 wake refresh 1회,
NOW=1615 idle 억제·last-tick=1615·last-refresh=1600·로그 1행을 확인했다.
dry-run의 RUN은 출력뿐이며 실제 defaults write/open을 실행하지 않는다.

`bash scripts/check-installed-sources.sh` exit 0, 전체 `bash scripts/release-verify.sh`
exit 0을 확인했다. 엔진 83 pass/0 fail/1146 assertions, bundle·shell/Python 문법,
격리 알림·Pocket 브라우저·diff 및 plugin/helper 설치 일치 검증을 모두 통과했다.
§9.20의 exit 1은 갱신 전 기록으로 남긴다. full installer·앱 restart/refresh·설정·권한·
LaunchAgent·실제 상태 파일·credential은 이번 작업에서 수정하지 않았다.

기존 source 4423ab1의 CI 증거는 §9.20과 같다. 이번 문서 반영은 새 PWA/desktop
배포나 스토어 제출이 아니다. 실제 메뉴바/클릭 패널·정상 절전 후 복귀, Windows 실제
tray·신규 설치/사용성과 데이터 계약 미정인 확장 기능은 여전히 미완료다.

### 9.22 현행 검토 패키지와 읽기 전용 설치 확인 (2026-10-10)

기존 74157c2 패키지에는 R5 수정이 없으므로 현행 4423ab1의 source archive와 동일
head SHA Windows CI artifact로 `scratchpad/release-candidate-4423ab1/`를 별도 준비했다.
CI 38052165597 success·artifact ID 11669941223·expired=false를 API로 재확인했다.
archive helper는 설치 파일과 전체 cmp 일치, Windows engine은 원본 바이트를 보존하고
CRLF→LF만 정규화한 고정 소스 일치다. exe는 GUI x86-64 PE, Mac에서 실행하지 않았다.
8개 파일의 SHA256SUMS 모두 OK, 원본 해시/후보 경계는 RELEASE_CANDIDATE_REVIEW §1 참조.

`bash install.sh --doctor` exit 0: Bun 1.3.14·SwiftBar 설치/실행·plugin 소스 일치·
API를 비활성화한 엔진 실행 가능을 확인했다. defaults read로 PluginDirectory가 실제
설치 폴더와 같은지 비교했다. launchctl print의 visibility 작업 마지막 exit code는 0,
조회 순간 state=not running은 주기적 짧은 작업의 상태이지 앱 표시 실패 증거가 아니다.
앱 PID·설정·작업 종료 코드만으로 실제 메뉴바/클릭 패널·절전 복귀 성공을 주장하지 않는다.

이번 작업은 로컬 패키지 준비와 읽기 전용 진단이다. 설정/권한/LaunchAgent 변경·
앱 restart/refresh·실제 계정 수치 수집·외부 업로드·스토어 제출은 하지 않았다.
전체 목표는 미완료이며 실제 관찰/참여자, 작업 내용 및 시계열/Coach의 제품·데이터
계약과 스토어 플랫폼/계정 선택 없이 해당 gate를 통과 처리하지 않는다.

### 9.23 사용자 표시 확인과 자동 초안 개발 재개 (2026-10-11)

사용자는 아이콘이 보이고 누르면 기존 데이터가 표시된다고 보고했다. 이는 해당 Mac의
아이콘/클릭 패널 존재에 대한 사용자 관찰 증거다. 실제 수치 정확성·notch 잘림·절전/재부팅
복귀·Windows 표시/신규 5명 acceptance까지 통과했다고 확대하지 않는다.

사용자는 자동 요약 초안+사용자 확인 방향을 설명받은 뒤 “이제 알아서 해 목표 ㄱㄱ”로
개발 진행을 요청했다. 별도 Pocket 로컬 초안 기능을 구현한다. 사용자가 선택한 한 파일에서
Claude/Codex의 목표·완료 주장·막힘·다음 행동을 근거 추출하고 편집/검토 후 저장한다.
metadata-only checkpoint와 quota snapshot은 변경하지 않는다. 생성형 AI 요약을 구현한
것으로 표시하지 않으며 외부 전송/원문 영구 보관 없이 먼저 로컬 자동 추출을 구현했다.
세부 한계·보존/삭제·파일 범위는 DATA_CONTRACT의 신규 절을 따른다.

기능 테스트/브라우저 회귀/공개 배포 결과는 후속 확인해 기록한다. 전체 목표는 미완료이며
실제 재개 효과·생성형 요약·변경 파일 연결·Windows toast·모바일/스토어 게이트는 남는다.

로컬 검증: 기존 엔진 83 pass/1146 assertions, 새 초안 기능 6 pass/29 assertions,
기존 Pocket 전체 브라우저 및 새 초안 브라우저 모두 통과했다. 전체 release-verify exit 0.
새 브라우저 검증은 375px 가로 넘침 없음, 검토 전 저장 차단·편집 후 검토 해제,
편집값 export·재열기 시 재검토, 잘못된 파일에서 기존 초안 보존, memory clear,
Local Storage 미보관·업로드 요청 없음·pageerror 없음을 확인했다. synthetic 대화만 사용했다.
화면 캡처도 직접 확인해 기존 Calm Operations Console의 폰트·색·레이아웃을 유지했다.
CI/Pages 결과는 소스 push 이후 확인 전까지 pending이며 공개 배포 완료를 주장하지 않는다.

8cb7495의 Pocket [38063015428](https://github.com/kendrick-na/tokenjuice/actions/runs/38063015428)와
Windows [38063015436](https://github.com/kendrick-na/tokenjuice/actions/runs/38063015436)는 success다.
Engine [38063015418](https://github.com/kendrick-na/tokenjuice/actions/runs/38063015418)는 Linux/Pocket
성공·macOS 실패다. 실패 로그는 기존 24-case cache observation matrix가 5000ms를 넘어
중단됐음을 보였다. 동일 값을 검사하는 3개 필드별 테스트와 overflow/복구 테스트로 분리해
default timeout은 그대로 유지했다. 24값/기존 모든 assertions를 보존하며 각 필드별 알림·
history·호출수 검증을 추가했다. targeted 4 pass/109 assertions, 로컬 전체 engine
86 pass/1152 assertions 및 work-summary 7 pass/31 assertions를 확인했다.

공개 HTTP 응답에서 새 index/module 및 sw v12는 확인했지만 기존 IAB에서 새 화면이
반복 reload 후에도 보이지 않았다. 기존 install은 skipWaiting이 없어 열린 클라이언트가
새 worker의 활성화를 막는 경로가 있었다. precache 완료 후에만 skipWaiting을 호출하는
v13로 바꿨고 lifecycle fixture에서 cache 준비 전 0회/완료 후 1회를 검증했다.
자동 page reload/스냅샷 삭제는 추가하지 않는다. 관련 API 근거:
[MDN skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting).
v13 후속 CI·실제 브라우저 화면 확인은 성공 확인 이후 기록한다.

0fff215의 Engine [38063414849](https://github.com/kendrick-na/tokenjuice/actions/runs/38063414849),
Windows [38063414834](https://github.com/kendrick-na/tokenjuice/actions/runs/38063414834),
Pocket [38063414862](https://github.com/kendrick-na/tokenjuice/actions/runs/38063414862)는 모두 success다.
Mac/Linux·Pocket 브라우저·Windows exe build/run/artifact 통과, Windows release는 skipped다.
공개 work-summary.js 및 sw.js 전체가 로컬 소스와 cmp 일치했고 cache v13을 확인했다.
기존 IAB를 새로고침해 새 ‘대화에서 재개 초안 만들기’ 진입점의 실제 AX 표시를 확인했다.
작성 중 초안이 없는 agent-created 탭에서만 새로고침했으며 사용자 기존 스냅샷을 삭제하지 않았다.
전체 로컬 release-verify도 engine 86/1152 + summary 7/31, 양쪽 browser·설치 일치로 exit 0이다.
이번 공개 배포는 로컬 추출 초안 기능이며 생성형 AI 요약·자동 파일 복원·전체 목표 완료가 아니다.

### 9.24 Claude 연결 실패/복구 UX — 2026-10-11 로컬 변경

사용자 컴퓨터에서 api=true, autoRenew=false, 최근 실패 HTTP 401, 최신 표준 local quota cache 없음 확인. 마지막 API 성공은 10월 8일이다. token 본문/Keychain/API 요청 없이 메타데이터만 읽었다. 인증 만료인지 잘못된 계정 자격증명인지는 확정하지 않았다.

오류 시 SwiftBar 이미지 배터리 `?` 대신 짧은 `C 다시 연결 필요` 등의 상태 텍스트로 표시한다. 여러 quota/context는 클릭 메뉴에서 확인한다. 실패 계정에는 원인·마지막 성공·다음 확인·기존 단일 NEXT 동선을 표시한다. 정상 상태는 기존 배터리/숫자 유지. 실제 노치 폭/노트북 표시 검증은 pending이다.

Pocket 실패 카드에 원인·성공 시각·외부(Mac) 재로그인 안내를 노출한다. 실패 observedAt를 성공 시각으로 대신 표시하지 않는다. source는 details, 복구 근거는 기본 화면에 두고 중복 설명을 제거했다. 단순 401을 확정적인 ‘로그인 만료’로 단정하는 문구를 인증 실패로 고쳤다. 사용자 데이터/외부 전송/권한/자동 갱신 변경 없음. 로컬 worker는 v14 후보이며 공개 서비스는 여전히 v13이다.

검증: 새 엔진 회귀는 수정 전 실패→수정 후 통과. engine 87 pass/1159 assertions, summary 7 pass/31 assertions. 브라우저 4개 실패 상태×3 provider 종류에서 원인·성공 시각·복구 정보 노출과 잔여량 숫자 숨김 확인. 중복 문구가 기존 locator 검증을 깨뜨린 문제를 제거하고 재검증했다. release-verify exit 0; Windows 문법, notification dry-run, 두 browser suite, installed source check 포함. 실제 Windows tray/실계정 검증은 포함하지 않는다.

Mac 기존 plugin만 표시 코드 갱신, shebang/설정/권한/LaunchAgent 유지. 백업: `~/Library/Application Support/TokenJuice/backups/tokenjuice-battery.before-auth-ux-20261011.js`. 설치본 본문/절전 helper 소스 일치. SwiftBar 실제 메뉴 표시·Claude 재인증·새 성공값 대조는 아직 pending이다. 이번 변경은 미커밋 로컬 후보이며 push/새 CI/공개 Pages 배포/새 desktop release 없음.

경쟁 비교 근거와 나머지 개선 순서는 [격차 지도](COMPETITOR_GAP_MAP_2026-10-11.md)를 참조한다. ‘출시 완료’ 또는 ‘Claude 복구 완료’로 승격하지 않는다.

#### 같은 날 표시 회귀 신고 — 위 헤더 변경 취소

사용자가 변경 직후 ‘바가 아예 안 보임’을 신고했다. SwiftBar 프로세스 19384 실행, plugin 경로·설치본 일치, visible Item-0=true 확인. 실제 메뉴바 UI 자동 접근은 timeout이라 화면 확인 불가. 최근 변경의 고정폭 이미지→한국어 텍스트 헤더가 노트북 공간 부족을 악화시켰을 가능성을 검증하는 최소 rollback을 시행했다. 노치가 확정 원인이라는 증거는 아직 없다.

repo와 설치본에서 **헤더만 기존 이미지 방식으로 복원**했다. 메뉴의 인증 실패 원인·마지막 성공·retry·재로그인 안내 및 Pocket 카드 개선은 유지한다. 새 회귀 테스트는 PNG 헤더/폭 상한/오류 안내를 검사하고 변경 전 실패, 복원 후 통과(8 assertions)했다. 설치본 본문과 helper 일치 확인. SwiftBar의 refreshallplugins URL을 요청했고 OS 호출 exit 0; 실제 재표시는 사용자 확인 pending이다. 이전 ‘짧은 텍스트면 폭이 안전하다’는 판단을 철회한다. 재인증/실제 사용량 검증 역시 미완료다.

복원 후 전체 release-verify exit 0: engine 87/1160 assertions, summary 7/31, 두 browser suite와 설치본 일치. SwiftBar PID 유지 확인. 자동 검증 성공을 실제 바 재표시 성공으로 대체하지 않는다.

사용자 후속 답변 ‘다시 보임’을 받아 **아이콘 표시 복구만 사용자 확인 완료**로 기록한다. 기존 고정폭 아이콘을 유지하며, 실패 상태의 원인·성공 시각·retry·로그인 안내는 클릭 메뉴와 Pocket 카드에서 제공한다. 아이콘의 unknown 표시를 실제 quota 수치로 대체하지 않는다. 위 검증은 실제 인증 없이 fixture로 실행했다. Claude 최신 quota/reset 대조·절전 복귀·Pocket 공개 배포는 여전히 pending이다.

### 9.25 실제 Claude 수집 장애 조사와 statusLine bridge (2026-10-11)

- 실제 fail cache는 HTTP **429**, 재시도 금지는 KST 01:59:38까지다. 401 또는 만료 인증이라고 단정하지 않는다. backoff 파일 삭제/조기 재요청 없음.
- 공식 Claude Desktop Code 및 Settings 사용량 화면에서 세션 28% 사용·주간 17% 사용을 확인했다. 기존 `plan-usage-history.json`은 10/6 이후 갱신되지 않아 화면과 불일치한다. 화면을 열거나 사용량 세부 보기를 열어도 파일이 갱신되지 않았다.
- 공식 문서의 stdin `rate_limits`를 수신하는 `scripts/collect-claude-quota.mjs` 추가. 백업 후 기존 사용자 statusLine 스크립트에 호출만 삽입했고 기존 표시/설정은 유지했다. 프롬프트/컨텍스트/인증정보는 저장하지 않고 quota·reset·관측 시각만 0600 파일에 기록한다. 네트워크/키체인 호출 없음.
- 동일 payload 재표시로 관측 시각을 연장하지 않으며 expired reset 또는 30분 경과는 stale이다. stale bridge가 다른 fresh local cache를 막지 않는다. 엔진 소스와 설치본 본문 일치, 배터리 아이콘 고정폭 유지.
- 엔진 및 bridge 테스트 91 pass / 1177 assertions(추가 파일 지속성 테스트 이전). 이 수치는 synthetic fixture 검증이지 실제 복구 증거가 아니다.
- **실제 bridge 파일 아직 없음. 현재 Team 계정에서의 지원/실행 여부 미검증. `?` 해결 및 출시 승인 아님.** 공식 문서는 subscriber rate_limits를 Pro/Max로 설명하므로 Team에 확장 추정하지 않는다.
- 다음 단계: 정상 사용 중 실제 callback 유입 확인 또는 사용자의 명시적 승인을 받아 공식 웹 로그인 기반 quota-only 대체 연결을 설계한다. 쿠키/세션 접근을 임의로 추가하지 않는다. 공개 배포/commit/push 없음.

참조: https://code.claude.com/docs/en/statusline

### 9.26 전체 투두 실행 원장·검증 누락·429 수동 갱신 보호 (2026-10-11)

- 개발기획서 §20에 사용자 요청 전체(P0 실제 작동, P1 경쟁/UI, P2 자동 요약/가치, P3 실출시/피드백)와 완료 증거/승인 경계를 기록했다. 기존 전체 resume/trend/Coach/platform 요구사항은 유지한다.
- release-verify 및 macOS/Linux/Windows CI가 `bun test tests/`로 새 bridge 테스트를 포함한다. `--require-browser`는 브라우저 검증 생략을 실패 처리한다. 성공 메시지에서도 실수집/신규 설치/스토어 완료를 주장하지 않는다.
- **실제 결함 재현:** `--renew-login`이 활성 429 fail cache를 401/20초로 덮어쓸 수 있었다. 실패 fixture를 먼저 확인한 뒤 429 기간에는 명령을 대기하고 fail cache/CLI/API 호출을 보존하도록 수정했다. 기존 일반 수동 갱신과 중복 방지는 유지한다.
- 최신 Bun 101 pass / 1222 assertions 및 두 browser suite·bundle·문법·격리 알림이 통과했다. 엄격 release-verify 최종 단계는 새 8줄이 아직 설치되지 않아 source mismatch로 exit 1이었다. 설치본 갱신을 자동 검증 성공으로 숨기지 않는다. 현재 작업은 새 공개 배포가 아닌 로컬 checkpoint 후 기존 설치본 한 파일 수정 대상이다.
- 모바일/desktop 첫 화면·예시 화면 screenshot 기준선과 애니메이션 종료 대기를 추가, 실제 캡처를 직접 관찰했다. 새 디자인 완료나 실제 quota 복구 증거는 아니다.
- origin/main fetch 후 HEAD ahead/behind 0/0 확인. 다른 TokenJuice 활성 editor 없음. 변경들은 이 작업의 로컬 후보이며 공개 push/tag/Pages/스토어 제출 없음. 429 제한과 실제 callback·수치 복구는 계속 미완료다.

후속 검증(01:56 KST): 로컬 `e86799c` checkpoint 후 clean/ahead 1·behind 0을 확인하고 기존 설치본을 `backups/tokenjuice-battery.before-renew-backoff-e86799c.js`로 보존했다. 설치본에 새 429 보호 8줄만 반영, shebang·권한·고정폭 헤더를 유지했다. 실제 설치본 `--renew-login`은 `renew skipped (provider retry after 2026-10-10T16:59:38.829Z)`로 종료하고 원래 fail cache의 at/until/status를 그대로 보존했다. CLI/API 요청을 새로 강행하지 않았다.

엄격 `bash scripts/release-verify.sh --require-browser` 최종 exit 0: Bun 101 tests/1222 assertions, 두 browser suite, bundle/문법/격리 알림, plugin/helper 소스 일치. 별도 시각 capture 실행도 exit 0이다. 실제 설치본 JSON은 여전히 `state=rate_limited`, `errorCode=429`, `items=[]`; statusLine callback 파일 없음. **실제 Claude 복구·UI 품질 통과·공개 배포·전체 TODO 완료는 아니다.** 다음 안전한 단계는 제한 종료 후 정상 수집 결과 확인과 P1 화면 재설계이며, 웹 세션 접근은 여전히 명시적 승인 대기다.

### 9.27 Claude 실제 숫자 복구와 Pocket 디자인 후보 검증 (2026-10-11)

- 01:59:38 KST 제한 종료 뒤 정상 polling은 401을 반환했다. 기존 Keychain 자격증명의 만료 메타데이터를 확인했다. 토큰 본문을 출력하지 않았다.
- 기존 설치본 `--renew-login`으로 Claude Code CLI 갱신을 1회 실행, exit 0 및 새 만료 시각을 확인했다. autoRenew=false는 유지했다. 웹 쿠키 접근이나 추가 로그인 권한은 사용하지 않았다.
- 02:01 KST 실제 API 결과는 fresh, errorCode=null, retryAt=null, 세션 35% 사용·주간 18% 사용이었다. 공식 앱은 세션 35% 사용·39분 후 reset으로 표시했다. 02:04에는 API 세션 36% 사용·주간 18% 사용으로 새 관측 시각이 갱신됐다.
- 사용자 답변 **“실제 숫자가 보임”**으로 메뉴바 숫자 복구를 확인했다. statusLine bridge callback은 여전히 미확인이며 이번 복구의 원인으로 기록하지 않는다. 공식 주간 reset·계정 대조와 재부팅/절전/신규 설치는 남았다.
- Pocket 로컬 후보는 큰 잔여량 숫자·읽기 쉬운 reset·동일 폭 계정 카드로 개선했다. 오류 원인/복구를 유지하고 NOW/NEXT 중복 문구를 제거했다. 설치/데모/사용자 실제 데이터는 서로 구분한다. worker v15는 로컬 후보이며 공개 서비스는 v13이다.
- 엄격 release-verify exit 0: Bun 101 tests/1222 assertions, 두 browser suite, bundle/문법/격리 알림, 설치 plugin/helper 일치. 브라우저는 잔여량 36px 이상·reset 16px 이상·desktop 카드 정렬 및 NOW/NEXT 문구 분리를 추가 검증했다. 경쟁사 대비 품질 동등성이나 실제 사용자 5명 검증을 뜻하지 않는다.
- 인증 실패 시 자동 갱신 선택을 사용자에게 요청했다. 응답 전 설정을 바꾸지 않는다. 공개 배포·스토어 제출·전체 TODO 완료는 미완료다.

후속 화면 검증: 최신 NOW/NEXT 수정본으로 브라우저 테스트를 다시 실행해 exit 0을 확인했다. `/tmp/tokenjuice-ui-current.o7yiDV/`의 desktop/mobile 캡처를 직접 관찰했다. 이 캡처는 예시 데이터이며 사용자 실제 quota 증거가 아니다. LAUNCH_FEEDBACK_PLAN과 UI_UX_RELEASE_PLAN의 순서를 사용자가 요청한 공개 베타 후 피드백/인터뷰 흐름으로 맞췄다. 핵심 작동·안전·실기기 조건 및 5명/10명/14일 검증 목표는 유지한다.

### 9.28 디자인 후보 공개 베타 반영 (2026-10-11)

clean main에서 origin/main fetch 및 ahead 3/behind 0 확인 후 `6d9b3a1`을 push했다. 직전 엄격 release-verify는 101 tests/1222 assertions와 두 브라우저·설치 일치까지 exit 0이다. Engine [38070692259](https://github.com/kendrick-na/tokenjuice/actions/runs/38070692259), Windows [38070692262](https://github.com/kendrick-na/tokenjuice/actions/runs/38070692262), Pocket [38070692236](https://github.com/kendrick-na/tokenjuice/actions/runs/38070692236)는 모두 success다. 공개 app.css/app.js/sw.js 전체를 로컬과 cmp해 일치를 확인했다. 공개 offline cache는 이제 v15다.

이는 Pocket 디자인·오류 안내의 공개 베타 반영이다. desktop tag/release·실제 Windows tray·신규 설치/절전·사용자 인터뷰·스토어 제출은 완료하지 않았다. 자동 갱신은 권장 정책을 설명했지만 사용자가 활성화를 승인하지 않아 기존 false를 유지한다.

### 9.29 자동 갱신 선택 메뉴 배포와 설치 검증 (2026-10-11)

`ae0378e`는 설명을 읽고 직접 켜기/끄기를 선택하는 메뉴와 `--auto-renew-on/off` 명령을 추가한다. 설정 변경 자체는 로그인·API·쿠키 접근을 실행하지 않고 API opt-in도 켜지 않는다. 사용자 설정은 보존하며 잘못된 JSON/비객체 설정은 원본을 유지하고 실패한다. 0600 임시 파일과 rename으로 저장하며 오류 상태에서도 끄기가 가능하다. ui-ux-pro-max의 설명·상태·되돌릴 수 있는 선택 원칙을 적용했다.

Engine [38071027466](https://github.com/kendrick-na/tokenjuice/actions/runs/38071027466) 및 Windows [38071027388](https://github.com/kendrick-na/tokenjuice/actions/runs/38071027388)는 success다. 기존 설치본이 직전 소스와 일치함을 확인하고 `backups/tokenjuice-battery.before-renew-controls-ae0378e.js`로 백업 후 검토된 변경만 apply_patch로 반영했다. 절대 Bun shebang·사용자 설정·고정폭 아이콘을 유지했다. 실제 설치본 JSON은 fresh, 세션 41% 사용·주간 19% 사용, autoRenew=false였다. 설치본 메뉴 출력의 동의 문구·켜기 명령 경로도 확인했다.

엄격 release-verify 최종 exit 0: 105 tests/1250 assertions, 두 browser suite·bundle·스크립트 문법·격리 알림·plugin/helper 일치. 실제 메뉴 클릭·다음 인증 만료에서 자동 복구·장기 실행·새 설치·절전/재부팅은 여전히 미완료다. 자동 갱신 활성화를 승인받은 것으로 처리하지 않았으며 desktop 새 tag/release나 스토어 제출도 하지 않았다.

### 9.30 생성형 AI 작업 요약 코어 후보

backend-only `scripts/ai-work-summary.mjs`와 6개 합성 테스트를 추가했다. 선택된 한 대화의 전송 미리보기와 endpoint/model/본문/출력 한도 digest를 만들고, 정확한 승인 digest·직접 제공한 키 없이는 요청하지 않는다. 단일 Messages API 요청·redirect 거부·timeout·입출력 bounds·에러 비밀값 비노출·근거 번호 검증과 reviewed=false 반환을 구현했다. 사용자 로그·실제 키·실제 API는 사용하지 않았다.

엄격 release-verify exit 0: 111 tests/1279 assertions, 두 browser suite·bundle·스크립트 문법·격리 알림·설치본 일치. 별도 상세 계약은 DATA_CONTRACT의 클라우드 AI 작업 요약 코어 후보를 따른다. 미리보기/승인 UI와 서버 승인 세션, 모델/가격/금액 한도, 제공자 보존 정책 검수, 실제 의미 요약 품질·작업 재개 효과 및 검토 저장 연결은 남았다. **자동 AI 요약 출시/P2-03~04 완료 아님.** 기존 Pocket 로컬-only 동작과 사용자 설정은 변경하지 않았다.

### 9.31 AI 요약 예산 검사와 검토 저장 후보

동의 범위에 count_tokens endpoint와 가격/예산 정책을 추가했다. 정책이 없거나 모델 불일치·잘못된 가격·24시간 초과 확인 시각이면 실행을 거부한다. 동의 후 토큰 계산 1회, 입력 10%+256 tokens 여유분과 최대 출력 가격의 예산 검사 후 생성 1회만 실행한다. 사전 count는 추정치이므로 결제 절대 상한으로 홍보하지 않는다. 실제 가격 진위 검증과 동시/일별 예산 원장·제공자 결제 제한은 미완료다.

reviewedAiSummary는 직접 확인한 네 항목만 새 AI 요약 형식으로 반환하며 원문·근거·키·provider ID를 제외한다. 기존 로컬 추출로 오표기하지 않는다. 새 후보 8 tests/49 assertions 및 엄격 release-verify 전체 exit 0, 양쪽 browser·설치본 일치 확인. 테스트는 합성 transport만 사용했고 실제 대화·키·API 비용은 사용하지 않았다. 사용자 UI/승인 세션·저장 파일 재열기·실제 요약 평가·P2 전체 완료는 여전히 남았다.

### 9.32 AI 요약 승인 세션과 중복 실행 방지 후보

`scripts/ai-summary-sessions.mjs`는 owner-bound 무작위 ID·5분 만료·최대 3개 메모리 세션과 동기적 1회 승인 소비를 구현했다. 반복 클릭·동시 실행·완료/실패 승인 재사용을 거부하며, 완료 세션에서만 별도 검토 후 export한다. 실행 중 discard는 요청 취소로 가장하지 않고 거부한다. 실제 사용자 인증은 모듈이 수행하지 않으며 인증된 HTTP route에서 owner를 제공해야 한다.

합성 세션 테스트 3 pass/19 assertions: 다른 owner·미확인/변경 digest·만료는 provider 호출 0회, 동시 클릭은 count 1회+생성 1회만 실행, 실패는 1회 뒤 재사용 불가, 용량 제한·검토·private 필드 제외를 확인했다. 엄격 release-verify exit 0: 116 tests/1318 assertions, 두 browser suite·bundle·문법·격리 알림·설치 일치. 원문/키는 실제 사용자 데이터가 아닌 합성 fixture였다. 사용자 인증/CSRF·UI·보존/삭제 실운영·일별/동시 예산 원장·서버 재시작 예산 보존·실제 요약 품질·전체 출시 완료는 남았다.

### 9.33 스토어 계정 확인과 AI 요약 일일 예산 후보

공식 Google Play Console에서 ETERNAL EDITIONS 조직 개발자 계정과 기존 앱의 프로덕션 배포 상태를 확인했다. TokenJuice 앱 생성이나 제출은 하지 않았다. Chrome Web Store는 Google 재인증 화면, Apple Developer는 로그인 화면에서 멈췄으므로 두 플랫폼의 개발자 등록 여부는 미확인이다. 로그인 화면을 계정 미보유 증거로 취급하지 않는다.

AI 요약 승인 세션에 필수 예산 원장을 연결했다. provider 호출 이전에 승인된 요청 최대 비용 전액을 예약하고 실패에도 유지한다. POSIX 디스크 저장·배타 lock·정수 금액·UTC 날짜·재시작 시 예약액 유지·손상/lock/시계 역행 시 안전 실패를 구현했다. Windows ACL 저장·실제 프로세스 경합/전원 손실·분산 환경·운영 가격 검증과 제공자 결제 제한은 남았다. 현재 로컬 backend 후보이며 정적 Pocket·설치 엔진·사용자 설정은 변경하지 않는다. 실제 대화/키/유료 API는 사용하지 않는다.

예산 및 세션 합성 테스트 8 pass/37 assertions는 같은 저장소를 사용하는 객체 간 한도 유지, 날짜 rollover/rollback, 손상/잠금 보존, private mode/symlink 차단, 원장 미설정/소진 시 provider 호출 0회를 검증했다. 실제 서버 재시작/다중 프로세스 실운영 증거와 구분한다. P2 전체 요약 흐름과 P3 스토어 출시 완료를 뜻하지 않는다.

엄격 release-verify exit 0: Bun 121 tests/1336 assertions, 두 browser suite·bundle·문법·격리 알림·설치 plugin/helper 일치. 플랫폼 가드 후 변경된 예산/세션 테스트도 다시 8 pass/37 assertions를 확인했다. Windows에서 예산 저장 모듈은 명시적으로 지원 거부하며 POSIX 저장 테스트를 건너뛴다. Windows 실제 실행/스토어 제출이나 AI 요약 UI 배포 증거로 승격하지 않는다.

### 9.34 검토된 AI 요약 파일과 작업 인계 화면 연결

Pocket은 backend reviewedAiSummary 출력 파일을 다시 열고 클라우드 출처 표기와 로컬 추출을 구분한다. 출처는 파일의 표기이지 제공자 진위 검증이 아니며 reviewed=true를 현재 사용자 검토로 신뢰하지 않는다. 네 항목을 편집·재검토해야 복사/재저장할 수 있고 편집은 승인을 다시 해제한다. 재저장은 클라우드 형식/privacy를 보존하며 unknown/raw/evidence/key는 제외한다. 복사에는 네 항목과 실제 파일/테스트 대조 안내만 넣고 자동 실행하지 않는다. 클립보드 거절 시 파일 저장/직접 복사를 안내한다.

frontend-design의 기존 운영 계기판 스타일과 ui-ux-pro-max의 출처 설명·명확한 확인·키보드/터치 원칙을 적용했다. backend 출력→Pocket parser→편집 재저장 단위 테스트와 합성 브라우저 테스트로 재검토·편집·복사/거절·손상 파일 기존값 보존·unknown 제외·375px/landscape/desktop·44px 버튼·reduced motion·키보드 확인 해제·Local Storage 미보관·외부 upload 없음이 통과했다. 모바일 합성 화면을 직접 확인했다.

첫 전체 검증은 브라우저 테스트의 clipboard 거절 mock 설정 단계에서 실패했다. 함수 대입 표현식의 반환값이 Playwright에 의해 실행된 것이 원인이며, 설정을 블록 함수로 감싼 후 실제 복사 버튼의 거절 안내 테스트가 통과했다. 실제 사용자 파일/클립보드/API는 사용하지 않았다. 클라우드 생성 UI·인증/CSRF·품질 평가·변경 파일 연결·실제 작업 재개·스토어 출시는 여전히 미완료다. worker v16은 이번 후보이며 공개 상태는 배포 확인 후 별도로 기록한다.

수정 후 엄격 release-verify exit 0: 122 tests/1351 assertions, 두 브라우저 suite·번들·문법·격리 알림·설치본 일치. 이전 실패를 통과로 기록하지 않았다.

후속 공개 확인: clean main에서 origin fetch·ahead 5/behind 0을 확인하고 `970a8d3`을 push했다. [Pocket 38072675159](https://github.com/kendrick-na/tokenjuice/actions/runs/38072675159), [Engine 38072675170](https://github.com/kendrick-na/tokenjuice/actions/runs/38072675170), [Windows 38072675296](https://github.com/kendrick-na/tokenjuice/actions/runs/38072675296)는 모두 success다. 공개 index.html/privacy.html/work-summary.js/sw.js를 해당 로컬 파일과 byte 비교해 일치를 확인했다. 공개 Pocket worker는 v16이다. 미저장 초안이 있는 기존 탭은 자동 새로고침하지 않으며, 사용자가 저장/지운 뒤 직접 다시 열어 업데이트한다. desktop 새 release/tag·실제 요약 API·스토어 제출은 하지 않았다.

### 9.35 로컬 AI 요약 승인 HTTP 경로 후보

인증·CSRF 검사와 schema를 기존 승인 세션에 연결하는 ai-summary-api.mjs를 추가했다. 정확한 loopback origin/Host·Origin·Bearer 토큰·JSON POST를 요구하고 client owner/model/key override를 거부한다. 동시 요청 3개·읽기 5초·stream body 크기 제한, no-store·CORS 미허용·비공개 오류 응답 제외를 적용한다. listener/사용자 화면/토큰 전달 launcher는 아직 구현하지 않았고 factory가 bind 자체를 대신하지 않는다.

API 테스트 7 pass/69 assertions: 인증/타 origin/Fetch Metadata/Host/content type 차단, 승인 없는 생성 provider 0회, preview→승인→생성→검토→discard, 승인 재사용 거부, unknown 필드/본문 초과/손상 거부, 비공개 예외 비반사, 동시 3개 초과 차단/slot 반환을 확인했다. 실제 Bun loopback 포트를 열어 합성 HTTP 요청도 수행했고 가짜 provider는 count 1회+생성 1회만 실행했다. 테스트 listener는 종료했으며 실제 사용자 대화/키/유료 호출은 없다.

전체 strict 검증은 동시 요청 제한 추가 이전에 128 tests/1417 assertions와 두 browser suite·설치 일치까지 exit 0이었다. 이후 API 7 tests를 따로 재검증했고 최신 전체 검증 결과는 후속 기록한다. 공개 Pocket v16은 그대로이며 실제 생성 UI·운영 가격/모델·키 입력·Windows 예산 저장·품질/실제 재개·스토어 출시는 계속 미완료다.

후속 최신 strict 검증 exit 0: 129 tests/1420 assertions, 두 browser suite·번들·문법·격리 알림·설치 plugin/helper 일치. 현재 API adapter와 문서는 로컬 checkpoint이며 공개 실행 서버/API나 새 desktop release는 배포하지 않았다.

### 9.36 로컬 AI 요약 실행 서비스와 생성 화면

POSIX 로컬 launcher에 기존 인증 adapter·승인 세션·일일 예산을 연결했다. 서버는 127.0.0.1에만 bind하고 실행 환경의 별도 API 키를 사용한다. allowlist 정적 파일, same-origin POST bootstrap, 실행별 무작위 접근 토큰, CSP·no-store를 적용한다. 키는 화면/응답에 포함하지 않으며 실제 계정 자격증명은 읽지 않는다.

생성 화면은 한 대화 선택→발언·가격·JSON 미리보기→명시적인 이번 전송 동의→1회 생성→편집/재검토→로컬 저장을 연결한다. human-readable 발언을 먼저 보여주고 기술 JSON은 접는다. 요청별 일일 예약액과 토큰 계산 비용을 별도로 표시하며 청구서가 아님을 설명한다. 편집값은 서버에 재전송하지 않는다. 서버 만료 뒤에도 화면 초안을 저장할 수 있고, 새 파일 실패는 기존 초안을 보존한다. 서버 삭제 실패 시 화면은 비우되 서버 삭제 미확인을 안내한다. 다운로드 파일·비용 원장은 삭제하지 않는다.

합성 실제 loopback 서버 테스트와 가짜 provider 브라우저 검증을 수행했다. 승인 전 provider 요청 없음, 생성 1회, 재검토 해제/저장, whitelist export, 삭제 실패 안내, 브라우저 영구 저장 없음, 외부 브라우저 요청 없음, 375px/landscape/desktop 및 큰 글꼴 가로 넘침 없음이 통과했다. desktop/mobile 합성 화면도 직접 확인했다. 초기 CSP 테스트 실패는 문자열 평가를 locator 조건으로 바꾸고 보안 정책은 유지했다. 후속 접힌 JSON 확인 실패는 기술 정보를 실제로 펼쳐 읽도록 수정했으며 최종 검증을 다시 수행했다.

최신 strict release-verify exit 0: **132 tests / 1439 assertions**, 기존 두 Pocket 브라우저 suite와 새 로컬 생성 브라우저 suite, 번들·문법·격리 알림·설치 plugin/helper 일치. CI에도 생성 화면 검증을 추가했지만 원격 CI 결과는 아직 확인 전이다. 테스트 서버는 종료했다. 실제 사용자 파일·API 키·유료 요청은 사용하지 않았다.

현재 로컬 개발 후보이며 공개 Pocket v16, 사용자 메뉴바 설치본, desktop release/tag, 스토어 제출은 변경하지 않는다. 실제 모델 의미 요약/환각 평가·운영 가격/키 설정·실제 작업 재개·Windows ACL 예산·프로세스 경합/전원 손실·신규 사용자 검증은 이 단계에서 남았다. 후속 프로세스 검증은 아래를 따른다. P2/P3 전체 완료로 처리하지 않는다. 실행 계약은 LOCAL_AI_SUMMARY.md와 DATA_CONTRACT.md를 따른다.

### 9.37 별도 OS 프로세스의 일일 예약 한도 검증

`tests/ai-summary-process.test.js`는 private 임시 디렉터리와 합성 금액으로 실제 Bun 자식 프로세스를 실행한다. 예약 뒤 살아 있는 프로세스를 SIGKILL하고 새 프로세스를 시작해 이전 예약액 유지·초과 예약 거부·잔여 한도 소진을 확인했다. 12개 프로세스를 ready 신호에서 대기시킨 뒤 동시에 해제해 성공한 예약 합계와 디스크 원장 값이 일치하고 한도를 넘지 않는 것을 검사했다. 경합 실패는 lock unavailable 또는 한도 초과로만 허용한다.

실제 lock을 잡은 자식 프로세스를 SIGKILL한 뒤 새 프로세스의 예약이 차단되고 기존 원장·crash lock이 그대로 남는 것도 확인했다. 테스트는 자신이 만든 자식 핸들만 종료하고 자신이 만든 임시 디렉터리만 정리한다. 운영 원장과 사용자 프로세스는 건드리지 않는다. 물리적인 전원 손실·디스크 오류·분산 호스트·Windows ACL 검증으로 승격하지 않는다.

신규 프로세스 테스트 3 pass / 62 assertions. 최신 전체 strict release-verify exit 0: **135 tests / 1501 assertions**, 세 브라우저 suite·번들·스크립트 문법·격리 알림·설치 plugin/helper 일치. API 키·실제 대화·유료 제공자 요청은 사용하지 않았다. 실행 안내와 개발기획서의 예산 검증 상태를 갱신했으며 전체 자동 요약 품질/스토어 출시 완료는 아니다.

### 9.38 원격 브라우저 실패와 가져오기 준비 상태

`5337c8a` push의 [Engine 38074314887](https://github.com/kendrick-na/tokenjuice/actions/runs/38074314887)은 macOS/Linux 엔진 테스트가 통과했지만 Companion 브라우저 테스트가 실패했다. privacy→계기판 링크 직후 파일 선택에서 Personal 표시를 기다리다 timeout이 발생했고 새 생성 UI 단계는 실행되지 않았다. [Windows 38074314884](https://github.com/kendrick-na/tokenjuice/actions/runs/38074314884)는 success다. 이를 전체 CI 통과로 기록하지 않는다.

모듈 로딩을 의도적으로 보류하는 브라우저 회귀에서 가져오기 입력칸이 listener 준비 전에 활성화되는 것을 재현했다. 초기 HTML에서 입력을 비활성화하고 앱 초기화/handler 등록 뒤 활성화하며, 페이지 이동 후 테스트도 해당 준비 상태를 기다린다. 지연 회귀는 변경 전 실패/변경 후 통과했고 strict 검증은 135 tests/1501 assertions와 네 브라우저 suite를 포함해 exit 0이다. 원격 CI 실패의 동일 원인 확정과 해소 여부는 새 CI 결과로 재검증한다. timeout 증가나 테스트 재실행만으로 우회하지 않았다.

Pocket worker v17은 이번 코드 후보다. 기존 공개 v16/로컬 설치본과 구분하며 새 Pages 결과/공개 파일 확인 전에는 배포 성공으로 기록하지 않는다. 기존 탭을 자동 재로드하지 않아 미저장 작업을 보호한다. 사용자 원문·키·유료 API는 사용하지 않았다.

VibeUsage 공식 홈페이지/README 후속 조사로 로컬 분석과 quota 네트워크 경계, CLI 이름 불일치를 보존한 프로필에 추가했다. 실행 정확성/디자인 우열/유료 수요는 확인하지 않았다. Coach의 호출 비율과 토큰 절감률을 구분하는 기준을 개발기획서에 반영했다. 전체 경쟁사 조사·UX·스토어 완료로 승격하지 않는다.

후속 공개 확인: `640463a`의 Engine 38074650886, Windows 38074650906, Pocket 38074650888 모두 success. 공개 index.html/app.js/app.css/sw.js를 해당 커밋 파일과 byte 비교해 일치를 확인했다. 공개 worker v17이다. 브라우저 CI 실패는 이번 후보에서 해소됐으며 모듈 지연 회귀도 포함한다. 실제 신규 사용자/실기기/스토어 완료를 뜻하지 않는다.

### 9.39 로컬 7일 관측 그래프 후보

기존 엔진의 Claude/Codex history 내보내기에 Pocket 화면을 연결했다. 구간 선택→관측 점/연속 선→정확한 표를 제공한다. 7일 이전 제외, 320개/128구간/1 MiB 제한, future/숫자 범위/동일 시각 충돌 거부, 정렬/동일 값 중복 제거, 손상 파일 기존 화면 유지, unknown/key 비표시를 적용했다. Claude 슬롯을 실제 계정으로, Codex 익명 구간을 특정 창으로 식별하지 않는다. 오래된 관측을 현재 잔여량으로 표기하지 않는다.

frontend-design의 기존 운영 계기판 스타일과 ui-ux-pro-max의 axis/legend/표 대안/모바일 글자/터치 원칙을 적용했다. chart는 실제 관측 시작/끝을 보여주고 긴 공백·값 하락을 연결하지 않는다. 모바일 합성 화면을 직접 확인해 축 글자와 시각 표현을 조정했다. 로컬 메모리 전용이며 수집 opt-in/설치본/API/사용자 기록은 변경하지 않는다.

history 단위 5 tests/26 assertions는 parser와 실제 엔진 내보내기의 합성 격리 HOME/USERPROFILE 연결을 검증했다. 초기 연결 테스트는 URL-encoded 한글 경로를 실행 파일 경로로 사용해 module not found가 발생했으며 fileURLToPath로 수정 후 통과했다. 브라우저는 import/공백·하락/표/손상 보존/Codex 선택/375px·landscape·desktop·큰 글꼴/지우기/외부 요청·영구 저장 없음을 검증했다. UI 연결을 의미 요약·Coach·전체 trend·실사용 성과로 승격하지 않는다.

worker v18은 로컬 후보이며 공개 v17과 구분한다. 최신 strict release-verify exit 0: **140 tests / 1527 assertions**, 다섯 브라우저 suite·번들·문법·격리 알림·설치 plugin/helper 일치. 원격 배포 확인은 후속 기록한다. 실제 사용자 데이터/유료 호출은 사용하지 않았다.

후속 배포 확인: `fb4c44d`의 Engine 38075358019·Windows 38075358014·Pages 38075358033 모두 success. 공개 index.html/app.js/app.css/history.js/sw.js가 해당 커밋과 byte 일치하며 worker v18이다. 재실행 strict verifier는 140 tests/1531 assertions와 다섯 browser suite exit 0이었다. assertion 수는 프로세스 경합 테스트의 실행 경로에 따라 달라질 수 있어 고정된 제품 지표로 해석하지 않는다.

### 9.40 읽기 전용 피드백 분류

`scripts/feedback-triage.mjs --live`는 GitHub CLI에서 고정 저장소의 열린 이슈 메타데이터만 조회한다. 제목·본문·작성자·댓글을 요청하지 않으며 알려진 라벨만 영역/우선순위/진행 상태로 투영한다. 상충·미지정은 review, 7일 미갱신은 재검토 대상으로 남긴다. 201개 조회 시 200개 출력 및 범위 제한을 명시한다. 잘못된 메타데이터·중복 번호·다른 저장소 URL·미래 갱신·조회 오류는 fail closed다. 이슈·라벨·댓글·스케줄·릴리스는 변경하지 않는다.

6 tests/30 assertions로 안전한 투영·상충·범위 제한·조회 인자·CLI 실패를 검증했다. 실제 GitHub 메타데이터 조회 결과 열린 이슈 0건. 공개 저장소의 Issues 활성 및 feedback.yml 존재도 확인했고 미로그인 제보 진입점은 GitHub 로그인으로 이동했다. 이 결과는 사용자 제보 접수·개인정보 없는 실제 로그·주간 반복 운영·독립 두 사용자 재현을 증명하지 않는다. 운영 절차는 LAUNCH_FEEDBACK_PLAN의 운영자 이슈 검토에 반영했다.

로컬 strict release-verify exit 0: 146 tests/1557 assertions, 다섯 browser suite·번들·문법·격리 알림·설치본 일치. 이번 변경은 운영 도구/문서이며 Pocket 파일·엔진·사용자 설정·스토어 제출은 변경하지 않았다. 원격 CI는 push 이후 별도로 확인한다.

후속 `88fb7b2` Engine 38075708361 및 Windows 38075708411 모두 success. Windows는 exe 생성·실행·artifact 업로드까지 통과했으며 tag가 없어 release job은 skipped다. 실제 Windows 화면이나 스토어 출시를 뜻하지 않는다.

### 9.41 명시적 Git 변경 파일 관측 후보

`scripts/worktree-evidence.mjs`는 지정한 Git 루트와 --include-paths로 현재 미커밋 변경 파일의 상대 이름·상태·head·branch를 내보낸다. 원문/diff·remote·절대 루트·이전 rename 경로를 출력하지 않고 알려진 민감 경로를 제외한다. 최대 500개/1 MiB/명령 15초 제한, 잘못된 status·루트·동의 없음·HEAD 변경 거부를 적용했다. 자동 전송/설정/세션 실행은 없으며 사용자의 실제 프로젝트 파일을 개발 테스트에 입력하지 않았다.

5 tests/46 assertions로 NUL·공백·한글·rename·민감 이전 경로·잘못된/과다/중복 경로·동의 전 무실행·격리 실제 Git·인덱스/상태 보존·HEAD 변경을 검증했다. 초기 경합 테스트 fixture는 macOS /var의 realpath 정규화 차이로 실패했고 canonical fixture root로 맞춰 통과했다. pending 파일 관측은 최근 커밋·내용 복원·구현/테스트 완료의 증거가 아니다. Pocket 연결·검토된 인계 파일·실제 재개 효과는 남았다. 계약은 DATA_CONTRACT의 별도 Git 변경 파일 관측을 따른다.

로컬 strict release-verify exit 0: 151 tests/1603 assertions·다섯 browser suite·번들·문법·격리 알림·설치본 일치. 엔진/설치본/Pocket 파일/사용자 설정은 변경하지 않았다. 원격 검증은 push 이후 확인한다.

후속 `329f6d8`의 Engine 38076099925 success, Windows 38076099959 failure. Windows는 새 격리 Git 테스트의 repository_root_required에서 실패했다. macOS 자동 통과를 Windows 지원으로 승격하지 않는다.

### 9.42 요약과 선택 변경 파일의 인계 화면 후보

Pocket work-summary에 work-files를 연결했다. 미선택/미검토 가져오기·민감 이름 제외·과거 관측 안내·1~50개 공유 선택·프로젝트/상태/비밀값 확인·요약 재확인·합친 복사/JSON 저장·재열기·독립 취소를 제공한다. 네 항목 요약만 저장은 유지한다. 새 handoff 파일의 로컬/클라우드 provenance를 보존하고 raw/unknown/미선택 경로를 내보내지 않는다. 요약/선택 편집과 재열기는 확인을 초기화하며 지우기 중 pending read가 자료를 되살리지 않게 한다.

frontend-design의 기존 ink/teal/lime 스타일과 ui-ux-pro-max의 접근성/점진적 공개/터치 원칙을 적용했다. 모바일 screenshot을 직접 확인해 체크박스 정렬과 목록 지우기 48px를 조정했다. 합성 browser 검증은 인계/단독 요약 저장·복사·재검토·손상 보존·재열기·키보드·375px/landscape/desktop·큰 글꼴·지우기·외부 요청/영구 저장 없음을 확인한다. 실제 사용자 로그/프로젝트를 입력하거나 외부 제공자를 호출하지 않았다.

Windows root 비교는 strict string equality 대신 플랫폼의 path.relative로 canonical root 동일성을 확인하도록 후보 수정했다. Windows separator/case 동등성·child/sibling 거부 regression은 수정 전 실패→후 통과이며 실제 Windows CI는 push 후 확인한다. 경로 문자열 표현 차이라는 가설은 로컬 regression으로 검증했으나 이전 runner의 두 실제 root 문자열을 기록하지 않아 정확한 문자 차이는 확정하지 않는다. 형식/플랫폼 근거는 [Node path 문서](https://nodejs.org/api/path.html#pathrelativefrom-to).

worker v19는 로컬 후보이며 공개 v18과 구분한다. 전체 work continuity 효과·스토어/실기기 gate는 유지한다. 계약은 DATA_CONTRACT의 요약과 선택 파일의 검토된 인계에 반영했다.

전체 검사 첫 실행은 로컬 AI 요약 브라우저에서 file 입력이 disabled로 남아 exit 1이었다. 서비스 dependency HTTP 회귀를 추가해 /work-files.js 404를 재현했고 명시 static allowlist에 모듈을 추가했다. 재검증 strict exit 0: 156 tests/1633 assertions, 여섯 browser suite·번들·문법·격리 알림·설치본 일치. 새 파일 브라우저 검사는 읽기 중 초안 지우기 이후 자료가 되살아나지 않는 경계도 포함한다. 사용자 원문·유료 API·설치 설정은 사용/변경하지 않았다. 공개/Windows 후속 확인은 별도로 기록한다.

### 9.43 공개 인계 화면과 Windows 짧은 경로 문제

`22a67c7`의 [Engine 38076746348](https://github.com/kendrick-na/tokenjuice/actions/runs/38076746348)과 [Pocket 38076746338](https://github.com/kendrick-na/tokenjuice/actions/runs/38076746338)은 success다. 공개 index.html/app.css/app.js/resume.js/work-summary.js/work-files.js/history.js/sw.js의 SHA-256이 로컬 소스와 각각 일치하며 공개 worker는 v19다. 미저장 초안을 강제로 재로드하지 않는다.

[Windows 38076746341](https://github.com/kendrick-na/tokenjuice/actions/runs/38076746341)은 두 경로 테스트에서 실패했다. 합성 임시 저장소 경로만 진단하는 `b696f66`의 [Windows 38076997732](https://github.com/kendrick-na/tokenjuice/actions/runs/38076997732)에서도 재현됐다. realpathSync의 로컬 root에는 `RUNNER~1`, Git root에는 `runneradmin`이 남아 path.relative는 다른 경로로 판정했다. 기존 separator/case 수정만으로 해소되지 않았다. POSIX 분기도 플랫폼 기본 relative를 호출해 Windows에서 case-sensitive 비교가 잘못되는 별도 오류가 확인됐다.

수정 후보는 POSIX 분기를 명시 posix.relative로 바꾸고 Windows의 문자열 불일치에만 디렉터리 stat의 bigint dev/ino 동일성 검사를 적용한다. 두 경로가 실제 디렉터리이고 동일 장치·0이 아닌 동일 inode를 가질 때만 허용한다. 서로 다른 장치/inode·0 inode·일반 파일·조회 실패를 허용하지 않으며 이름의 접두어나 짧은 이름을 추측해 루트 검사를 생략하지 않는다. [Node Stats](https://nodejs.org/api/fs.html#class-fsstats)와 [플랫폼별 path](https://nodejs.org/api/path.html#windows-vs-posix)를 따른다. 로컬 경로 회귀 7 tests/67 assertions는 통과했고 실제 Windows 수정 검증은 후속 결과를 따른다. 실제 사용자 저장소/원문·자격증명·유료 호출·스토어 제출은 사용하지 않았다.

수정 후 strict release-verify exit 0: 157 tests/1650 assertions, 여섯 browser suite·번들·문법·격리 알림·설치 plugin/helper 일치. POSIX 원장 등 기존 Windows 미지원 13개 검사는 별도 한계이며 이 결과가 Windows 지원을 확대하지 않는다. 실제 Windows 수정 결과는 원격 CI로 확인한다.

후속 `0cbe94b`의 [Engine 38077200753](https://github.com/kendrick-na/tokenjuice/actions/runs/38077200753)과 [Windows 38077200963](https://github.com/kendrick-na/tokenjuice/actions/runs/38077200963) 모두 success다. Windows에서 동일한 `RUNNER~1`/`runneradmin` 차이가 남아 있는 실제 격리 저장소가 정상 통과했다. Windows 회귀 144 pass/13 skip/0 fail/1303 assertions, tray selftest/engine --once 및 15.8 MB exe 생성·실행(exit 0)·artifact 업로드를 확인했다. tag가 없어 release job은 skipped다. 이는 실제 Windows 사용자 화면·신규 설치·전체 AI 요약 서비스·스토어 출시 완료를 증명하지 않는다.

### 9.44 최근 커밋의 변경 파일 수집 후보

`scripts/commit-evidence.mjs`는 지정한 로컬 root의 first-parent 최대 5개 커밋을 별도 schema로 출력한다. 미커밋 관측의 root/HEAD/동의 검사를 재사용하고, hash와 A/D/M/T 상대 파일명·제외 건수만 내보낸다. commit 메시지·작성자·날짜·본문/diff·원격 주소는 요청하지 않는다. rename 탐지를 끄고 merge는 첫 부모 대비로 제한한다. 개별 출력 1 MiB/15초·전체 500개 한도와 민감 경로 필터를 적용한다. lazy fetch/replacement refs/터미널 인증을 막는 Git 환경도 공유했다.

합성 실제 Git root·첫 커밋·rename의 삭제/추가·5개 제한·pending 제외·merge first-parent·민감 이름·미공유 필드·index/status 보존을 검증했다. fake runner는 동의 전 무실행·HEAD race·잘못된/중복 hash·개별/전체 파일 한도·외부 diff/textconv 차단을 검사한다. 초기 인덱스 불일치는 fixture에서 ordinary status 이전에 기준 index를 읽은 순서 오류였다. 상태 조회 후 기준 bytes를 읽도록 바로잡고 읽기 전용 수집 전후 비교는 유지해 통과했다. 수집 경로 회귀 합계 11 tests/218 assertions다.

앞선 문서 checkpoint `5a3e88e`의 Engine 38077342748·Windows 38077342765 모두 success를 확인했다. 이번 최근 커밋 JSON은 현재 공개 Pocket v19의 worktree 입력과 다르며 아직 브라우저 선택/검토/저장에 연결하지 않았다. 새 public/tag/release·설치본/설정 변경·사용자 저장소 수집·유료 API·스토어 제출은 없다. 전체 작업 재개·실기기·사용자 gate는 미완료다.

후속 transport whitelist도 비워 원격 전송을 허용하지 않도록 하고 runner에서 인증 prompt 억제와 함께 검사했다. 최신 커밋 수집 회귀는 4 tests/201 assertions이며 전체 최신 검증은 후속 결과를 따른다.

최신 strict release-verify exit 0: 161 tests/1851 assertions, 여섯 browser suite·번들·문법·격리 알림·설치 plugin/helper 일치. 원격 CI와 실제 사용자 재개 효과는 별도 검증이다.

### 9.45 커밋과 미커밋 파일의 검토된 인계 화면

수집 후보 `0cc72b6`의 Engine 38077709703·Windows 38077709664 success를 확인했다. Pocket 화면에는 커밋 관측의 별도 검증·종류별 병행 import·선택·검토·복사·v2 저장/재열기를 추가했다. 각 소스 최대 500개/커밋 5개·공유 합계 50개, HEAD/scope/hash/시각/status/경로·민감 이름 제외·unknown 비표시를 적용한다. 재열기/편집/가져오기는 선택과 확인을 해제하며 커밋만 인계도 지원한다. 미커밋-only v1과 요약-only 저장·로컬/클라우드 provenance는 보존한다.

frontend-design/ui-ux-pro-max의 기존 ink/teal 스타일·터치/키보드·점진적 공개 원칙을 적용했다. 모바일 합성 화면을 확인해 긴 CLI 설명을 접고 출처 제목/관측 metadata 위계를 분리했다. 새 browser 검증은 두 종류 동시 import·기존 목록 보존·선택된 commit/path만 저장·v1/v2 재열기·커밋-only 저장·복사 경고·손상 보존·모바일/landscape/큰 글꼴·clear race·외부 요청/영구 저장 없음을 확인한다. 기존 단일 파일의 bounding_box 검사는 두 행을 동시에 조회해 strict locator 실패가 났으며 각 행을 독립 검사하도록 수정해 통과했다. 검사 기준을 낮추지 않았다.

worker v20은 로컬 후보이며 현재 공개 v19와 구분한다. 실제 사용자 대화/프로젝트·유료 호출·설치 설정·스토어 제출은 사용/변경하지 않았다. 전체 의미 요약 품질·파일 복원·실제 재개 시간/실기기·사용자 gate는 미완료다. 최신 전체 검증과 공개/Windows 확인은 후속 기록한다.

최종 로컬 strict release-verify exit 0: 163 tests/1884 assertions, 여섯 browser suite·번들·문법·격리 알림·설치 plugin/helper 일치. 모바일 캡처에서 접힌 사용법의 native 펼치기 표시를 확인했다. 원격 CI·공개 v20 반영·실제 사용자 작업 재개 효과는 이 결과로 완료 처리하지 않는다.

공개 후속 확인: `7a4031e`의 [Engine 38078400778](https://github.com/kendrick-na/tokenjuice/actions/runs/38078400778)·[Pages 38078400767](https://github.com/kendrick-na/tokenjuice/actions/runs/38078400767)·[Windows 38078400760](https://github.com/kendrick-na/tokenjuice/actions/runs/38078400760) 모두 success다. Windows tray selftest/engine --once·15.8 MB exe 생성/실행(exit 0)·artifact 업로드를 확인했으며 tag가 없어 release job은 skipped다. 배포 전 첫 공개 대조는 변경 파일 불일치였고, Pages 성공 후 재조회에서 index.html/app.css/app.js/resume.js/work-summary.js/work-files.js/history.js/sw.js 8개 모두 `7a4031e`와 SHA-256 일치했다. 현재 공개는 worker v20이며 설치본·desktop v1.2.2·스토어 상태는 변경하지 않았다. 실제 사용자 재개 효과·실기기·스토어 게이트는 계속 미완료다.

### 9.46 Git 수집 CLI와 Pocket 인계의 통합 검증

기존 work-files browser suite에 격리된 실제 Git 저장소의 CLI 출력 검증을 추가했다. 한글 파일의 두 커밋과 민감 파일·미추적 변경을 만들고, 두 수집 CLI를 실행한 실제 JSON을 화면에 가져온다. 선택한 최신 커밋 파일과 미커밋 파일만 v2로 저장되고 재열기에서 선택·요약/파일 확인이 모두 해제되는지 검사한다. 코드 본문·커밋 메시지·작성자·이메일·절대 root가 출력/저장에 없으며, 수집과 화면 처리 전후 Git status·index bytes가 같음을 확인했다.

임시 저장소만 사용하며 사용자 저장소·대화·자격증명·유료 호출·설치 설정은 사용/변경하지 않는다. 단독 browser suite exit 0이며 기존 Engine/Pages workflow와 strict verifier가 같은 suite를 실행한다. 전체 최신 검증은 후속 결과를 따른다. 이는 CLI와 화면 사이의 호환성 증거이며 실제 사용자 작업 복원·재개 시간 단축·스토어 완료 증거가 아니다. 공개 Pocket v20의 앱 코드는 변경하지 않았다.

후속 로컬 strict release-verify exit 0: 163 tests/1884 assertions와 확장된 Git→Pocket suite를 포함한 여섯 browser suite, 번들·문법·격리 알림·설치 plugin/helper 일치 확인. 원격 CI와 사용자/실기기 게이트는 별도다.

후속 `78b2116`의 Engine 38078730133·Windows 38078730058 success를 확인했다. 앱 코드/worker는 바뀌지 않았으며 공개 Pocket v20과 desktop v1.2.2는 유지한다.

### 9.47 현재 Claude 계정과 공식 사용량 대조

2026-10-11 04:10~04:12 KST에 실행 중인 공식 Claude 앱의 사용량 설정을 열어 현재 세션·주간 전체 모델과 reset 표시를 확인했다. 같은 시점 TokenJuice의 최신 수집 캐시에서 허용된 사용률·관측 시각·reset 필드만 읽어 대조했다. 세션/주간 값이 일치하고 세션 reset의 남은 시간 및 주간 reset의 현지 요일/시각도 일치했다. 공식 사용량 설정의 새로 읽은 값을 사용했으며, 닫힌 대화 하단에 남아 있던 이전 세션 사용률 표시는 현재 수치로 취급하지 않았다.

공식 계정 메뉴의 현재 사용자와 선택된 조직을 확인하고 Claude Code의 기존 비자격증명 계정 metadata와 비교했다. 사용자 이메일과 조직 UUID의 비교 결과 모두 true다. 표시 이름의 문자열은 다르므로 그것을 동일성 증거로 쓰지 않았다. 이메일·조직 ID·다른 대화 내용·세션 위치와 원본 화면은 공개 문서에 저장하지 않는다. P0-01은 이번 현재 계정/관측 대조 범위에서 통과이며 장기 자동 갱신·신규 설치·다른 계정·절전 복귀·Windows/스토어 완료를 증명하지 않는다. 코드·설정·인증 갱신·쿠키 접근은 변경/실행하지 않았다.

### 9.48 진단 읽기 전용 수정과 Claude 429 재발

코드 de84bc8은 diagnostics가 일반 수집 경로를 먼저 실행해 API/갱신/히스토리 쓰기로 이어지던 문제를 수정한다. 격리 테스트에서 수정 전 Claude API 1회 호출을 재현했다. 수정 후 진단·복사는 기존 관측만 읽고 fresh/stale/차단 근거를 유지한다. 다른 변경 명령과 혼합 실행은 시작 전에 거절한다. 복사 시 요청한 clipboard 기록만 허용한다.

기존 설치본이 수정 전 기준과 일치함을 확인하고 한 파일을 임시 백업 후 갱신했다. shebang·아이콘·설정·인증·LaunchAgent·helper는 바꾸지 않았다. 설치본과 현재 소스 본문 일치, SwiftBar 프로세스 실행을 확인했다. 실제 설치본의 diagnostics exit 0 전후 config/Claude cache/fail cache SHA-256이 동일하다. 화면 표시와 절전 복귀 검증을 대신하지 않는다.

2026-10-11 18:16 KST의 기존 관측은 Claude HTTP 429/backoff 상태이며 다음 retry 표시가 18:59다. 이전 §9.47의 계정/수치 대조는 당시 성공 기록이지 지속적인 수집 안정성 증거가 아니다. 제한 중 새 API 요청·인증 갱신·실패 캐시 제거를 하지 않았다. 제한 종료 후 실제 새 관측과 공식 화면을 다시 대조해야 한다.

strict release-verify exit 0: 166 tests/1920 assertions, 기존 여섯 browser suite, Bun build·스크립트/Windows 문법·격리 알림·설치 plugin/helper 일치. 경쟁사 출시 비교 §7~§10과 기획서에 채널/가격/권한/개인정보/피드백·C01~C09를 반영했다. 현재 공개 Pocket 앱 코드/cache v20과 desktop release v1.2.2는 변경하지 않았다. 원격 CI·새 기기·Windows 화면·실대화 의미 요약·실제 피드백/인터뷰·스토어는 별도 미완료다.

### 9.49 Claude 동시 조회 조정과 Windows 피드백 테스트

격리한 여섯 Bun 프로세스가 같은 프로필의 빈 캐시를 동시에 조회할 때 수정 전 API fixture 요청 여섯 회를 재현했다. SQLite의 원자적 프로필별 임대로 조회를 조정하고, 임대 확보 후 성공 캐시와 실패 대기시간을 다시 확인한다. 수정 후 성공과 429 모두 요청 한 회이며, 모든 프로세스가 같은 새 관측 또는 같은 재시도 시각을 읽는다. 임대에는 프로필 번호·임의 소유자·만료 시각만 저장한다. 진단은 임대를 만들지 않으며 API·인증 갱신도 실행하지 않는다.

프로세스 종료로 남은 임대는 45초 후 회수한다. 저장소가 손상되면 API 요청을 중단하고 로컬 요청 조정 오류와 지원 진단 안내를 표시한다. 이 검증은 같은 캐시 프로필의 동시 요청을 대상으로 하며, 서로 다른 프로필에 중복 등록된 자격증명의 요청 통합이나 실제 제공자 429의 원인을 증명하지 않는다. 기존 실제 backoff·인증 설정은 변경하지 않는다.

이전 a2236db의 Engine CI는 성공했지만 Windows CI 38128066899는 피드백 테스트의 LF 문자열 비교에서 실패했다. Windows checkout의 CRLF를 확인했고 두 줄바꿈 모두 개인정보 동의 필드를 검증하도록 수정했다. 피드백 양식 자체의 공개 범위·필수 동의는 유지한다.

3c4be09의 Engine CI 38128618767과 Windows CI 38128618774는 모두 success다. Windows 엔진 회귀·tray self-test·실행·EXE 빌드/실행·artifact 업로드가 통과했으며 버전 태그가 없어 release 단계는 건너뛰었다. 실제 사용자 Windows 화면 검증을 대신하지 않는다.

기존 Mac 설치본이 de84bc8 본문과 일치함을 확인하고 `/tmp/tokenjuice-coordination-backup.36WMMm/tokenjuice-battery.5s.js`에 백업했다. 엔진 한 파일만 3c4be09로 갱신했으며 shebang·아이콘·설정·인증·helper·LaunchAgent는 유지했다. 설치 plugin/helper 소스 일치와 SwiftBar 실행을 확인했다. 갱신 후 실제 diagnostics 전후 config/Claude cache/fail cache 해시가 동일하다. 18:32 KST 관측은 여전히 HTTP 429 대기이며 다음 확인 표시가 18:59다. 제한 종료 후 실제 새 quota 대조는 미완료다.

설치본 반영 후 strict release-verify exit 0: Bun 테스트 171개 통과·실패 0개·assertion 2000개, 여섯 browser suite, 번들·스크립트/Windows 문법·격리 알림·설치본 일치. 공개 Pocket v20과 desktop release v1.2.2는 유지한다. 지속 수집·신규 설치·절전·실대화 요약 가치·사용자 조사·디자인 경쟁 검증·모바일 연결/스토어 게이트는 남아 있다.

### 9.50 Android 환경 재확인과 현재 인증 실패

2026-10-12 프리플라이트에서 main 0e216bc·origin 일치·미커밋 변경 없음을 확인했다. Android Studio JBR Java 21.0.10과 SDK platform android-36.1·build-tools 36.1.0/37.0.0·ADB를 실행 확인했다. SDK manager의 공백 경로 버전 검사 경고는 설치 파일 변경 없이 임시 JBR 별칭 경로로 재실행해 해소했다. D8/aapt2 버전 조회도 성공했다. 환경 전체가 없다는 판단은 정정한다.

Gradle 실행기·기본 wrapper 배포 캐시와 저장소의 Android 앱 구조가 없어 TokenJuice Android 빌드는 실행할 수 없다. 연결된 adb 기기도 없다. [모바일 연결 조건](MOBILE_CONNECTION_GATE.md)에 구현 구조·빌드 도구·실기기·서명/제출 조건을 구분했다. 앱·wrapper·서명 키·스토어 등록·기기 설치는 추가하지 않았다.

10:11 KST 설치본의 읽기 전용 진단은 Claude HTTP 401/auth 상태와 다음 확인 10:20을 표시한다. 자동 갱신은 꺼져 있고 실제 수집 복구는 미완료다. Codex 관측은 fresh이나 공식 계정 대조를 대신하지 않는다. 인증 갱신·키체인/쿠키 접근·실패 캐시 삭제·API 추가 요청은 하지 않았다. 공식 Claude Code 로그인 상태 확인을 사용자에게 요청했다.

기존 최신 Engine 38128618767·Windows 38128618774·Pages 38078400767 success를 다시 확인했다. 공개 Pocket index.html·app.js·app.css·sw.js·manifest.webmanifest는 각각 HTTP 200이며 로컬 파일 SHA-256과 일치한다. Android 결과가 아니다.

이번 strict release-verify exit 0: 테스트 171개·실패 0개·assertion 2000개, 여섯 browser suite, 번들·문법·격리 알림·설치 plugin/helper 일치. 앱 코드는 변경하지 않았으며 위 결과로 실제 Claude 복구·Android 빌드·신규 설치·절전·사용자 조사·스토어 완료를 판정하지 않는다.

### 9.51 Pocket 제공자 식별과 우선 행동 이동

모바일 예시 화면에서 Codex 제한의 상단 제목이 제공자 없이 한도로 표시되는 문제를 확인했다. priority는 이름 없는 Codex payload를 읽었지만 카드 렌더링은 별도로 Codex 이름을 붙이고 있었다. 또한 컨텍스트 상태 보기와 계정 연결 확인이 모두 계정 목록 시작으로 이동했다. 제공자 식별 회귀 테스트는 수정 전 실패했다.

화면용 descriptor에서 제공자 이름과 계정별 목적지를 파생한다. Codex·로컬 provider·Claude 다계정의 해당 카드로 이동하고 컨텍스트는 별도 컨텍스트 카드로 이동한다. 이동 뒤 카드에 키보드 포커스와 명확한 윤곽을 제공하고 모션 감소 설정에서는 즉시 스크롤한다. 외부 파일의 ID를 이동 대상으로 사용하지 않는다. quota 계산·인증·저장 계약·외부 전송은 변경하지 않았다.

기존 browser suite에 제공자 식별·각 provider 인증 실패 목적지·Claude 두 번째 계정·컨텍스트 목적지·모션 감소 검증을 추가했다. 수정 후 단독 suite와 strict release-verify 모두 exit 0이며 테스트 171개/2000 assertions·여섯 browser suite·설치본 일치가 통과했다. 모바일 예시 캡처에서도 Codex 식별을 확인했다. 이번 변경은 동선 수정이며 화면 밀도·경쟁사 대비 전체 디자인 품질·실제 수집/사용자 재개 가치 완료가 아니다.

로컬 Pocket cache는 v21 후보다. 원격 CI와 Pages 배포·공개 파일 대조는 후속 검증으로 구분하며 desktop 엔진/릴리스는 바꾸지 않는다.

### 9.52 정상 상태 화면의 점진적 공개

da125f2의 Engine 38191643356·Windows 38191643480·Pages 38191643487 success를 확인했다. 공개 app.js·app.css·sw.js의 SHA-256은 da125f2와 일치하며 v21이 공개 반영됐다.

모든 provider가 fresh이고 확인된 성공 관측·export가 30분 이내이며 잔여량 50% 이상일 때만 부가 안내를 접는다. 빈 한도·소진 예측·fallback·컨텍스트 80% 이상에서는 접지 않는다. 정상 화면의 quota 숫자·reset·상태·우선 행동은 유지하고, 출처/마지막 성공과 다음 행동은 native details로 키보드에서 펼칠 수 있다. 날짜나 수치를 새 관측으로 변경하지 않는다.

합성 정상 snapshot의 375px 화면에서 같은 상단 카드 높이는 접힘 316px·펼침 468px였다. 이는 같은 구성요소의 공개 상태 비교이며 이전 버전 전체 화면이나 사용자 작업 시간 개선 측정이 아니다. 모바일 캡처에서 숫자·reset·펼치기 동선을 확인했다. 테스트는 fallback·낮은 quota·소진 예측·오래된/미래 export·오래된/알 수 없는 성공 관측·빈 quota·컨텍스트 경고에서 부가 안내가 계속 보이는지 검사한다.

이번 strict release-verify exit 0: 테스트 171개/2000 assertions·여섯 browser suite·번들·문법·격리 알림·설치본 일치. quota 계산·desktop·인증·외부 전송은 바꾸지 않았다. 2026-10-12 10:28 KST 설치본 진단은 여전히 Claude HTTP 401이며 사용자 로그인 확인 요청이 남아 있다.

후속 확인: 6afce92의 Engine 38192085998·Windows 38192085974·Pages 38192085958 모두 success다. 공개 app.js·app.css·sw.js의 SHA-256이 같은 커밋과 일치해 cache v22 공개 반영을 확인했다. 전체 경쟁 디자인·실기기·실대화 요약 가치·모바일 연결·사용자 인터뷰·스토어 목표는 미완료로 유지한다.

실제 요약 실행 조건도 다시 확인했다. 현재 로컬 요약 서비스는 명시적인 cloud API key를 요구하며, 이번 프로세스에는 TOKENJUICE_SUMMARY_API_KEY가 등록돼 있지 않다. PATH에서 ollama·llama-server 실행기를 찾지 못했다. 다른 위치에 설치된 모델이나 별도 프로세스의 키까지 부재하다고 단정하지 않는다. 실제 요약 provider 호출은 실행하지 않았다. 로컬 모델 설치/연동 또는 사용자 cloud API 방식과 비용/전송 동의, 검증 장비 선택을 요청했다. 10:30 KST의 기존 관측은 Claude HTTP 401이며 자동 갱신은 꺼져 있다.

### 9.53 열어 둔 Pocket의 스냅샷 나이 갱신

스냅샷 나이와 경고가 가져오기/새로고침 때만 계산되고 있었다. 수정 전 브라우저 재현은 주기 점검 callback이 없어 실패했다. 수정 후에는 열린 탭에서 1분마다, 창 focus·visibility 복귀·네트워크 상태 이벤트에서 파일 나이를 다시 확인한다. 숨겨진 탭은 주기 작업을 미루고 복귀 때 확인한다. provider 조회나 로그인 갱신을 실행하는 poll이 아니다.

30분이 지난 파일은 상단 업데이트 필요·새 파일 가져오기 동선과 스냅샷 당시 기록 라벨을 표시한다. 숫자는 원본의 과거 기록이며 새 관측으로 승격하지 않는다. 현재 화면에서 만료된 신뢰는 시계 rollback으로 복구하지 않고 파일을 다시 가져올 때 초기화한다. 저장된 generatedAt·quota·reset·localStorage는 변경하지 않는다.

나이 표시와 quota 안내만 갱신하며 편집기·검토 체크·포커스·펼친 account 상세를 다시 만들지 않는다. 새 만료 경고를 펼친 뒤 사용자가 닫으면 다음 tick마다 다시 열지 않는다. 가짜 시계로 실제 timer callback·창 복귀를 실행해 초안/검토/focus·저장 bytes 보존·rollback·숨김 탭 복귀·새 import 초기화·파일 picker 동선을 검증했다. 사용한 파일은 합성 데이터뿐이다. demo는 실제 수집처럼 바꾸거나 저장하지 않는다.

전체 strict release-verify exit 0: 테스트 171개/2000 assertions·확장된 companion을 포함한 여섯 browser suite·번들·문법·격리 알림·설치본 일치. 전체 테스트의 중복 경고 문구 선택자 오류는 배너를 특정해 수정했다. 이후 demo 상태 보호와 rollback 시각 문구까지 단독 재검증 exit 0을 확인했다. cache v23은 로컬 후보이며 원격 CI·Pages 공개 파일 검증은 별도다. 실수집·자동 sync·모바일/스토어·사용자 검증 목표는 완료 처리하지 않는다.

### 9.54 Pocket 스냅샷 저장 필드 제한

6c71351의 Engine 38193392579·Windows 38193392570·Pages 38193392556 success를 확인했다. 이후 합성 스냅샷에 root credentials·계정 prompt·quota messages·forecast transcript·provider config·session topic을 추가했다. 수정 전 형식 검사는 통과했지만 원본 전체가 Local Storage에 기록되는 실패를 재현했다. 실제 사용자 파일/토큰은 사용하지 않았다.

기존 형식 검사는 유지하고 그 뒤 `snapshot.js`로 저장·렌더링 필드를 복사한다. 계약 밖 필드와 scalar 위치의 객체/배열은 제외하며 quota·reset·generatedAt·lastSuccessAt은 그대로 보존한다. 기존 유효한 저장본도 같은 처리로 정리하고 원본 파일은 수정하지 않는다. 잘못된 새 파일은 기존 정상 캐시를 대체하지 않는다. 이전 선택적 providers/sessions 없는 v1과 실제 엔진의 암호화 번들 가져오기 흐름도 유지한다.

신규 단위 테스트 4개/12 assertions가 metadata 동일성·원본 객체 불변·각 단계의 추가 필드 제외·scalar object 제외·legacy 옵션을 검증했다. 단독 브라우저 검증과 전체 strict release-verify exit 0이며 확장된 companion과 기존 여섯 browser suite·번들·문법·설치본 일치가 통과했다. 저장 복원·잘못된 파일 이후 정상 캐시 보존도 확인했다.

허용된 metadata 문자열 속 비밀값을 자동 탐지하는 scanner는 아니다. 데이터 진위·실제 계정·실대화 요약 품질을 증명하지 않는다. cache v24 후보와 새 module precache를 추가했으며 원격 검증/공개 파일 대조는 별도다. 인증 갱신·실제 모델 호출·모바일/스토어 제출은 실행하지 않았다.

### 9.55 연속 가져오기 선택 순서 보호

5b062b8의 Engine 38193983057·Windows 38193983032·Pages 38193983135 success를 확인했다. 공개 app.js·snapshot.js·sw.js의 SHA-256은 같은 커밋과 일치해 v24 반영을 확인했다.

이전 File.text 완료를 지연하고 새 파일을 선택한 뒤 이전 읽기를 끝내면, 수정 전에는 새 선택을 덮어썼다. 같은 탭의 가져오기 revision을 확인해 마지막 선택만 저장·상태 메시지·picker 값 정리를 수행하도록 수정했다. 이전 파일의 늦은 실패도 새 성공 메시지를 바꾸지 않는다. 예시 보기·삭제는 이전 가져오기의 결과 반영을 무효화한다. 네트워크/토큰 접근·quota/관측 시각 변경·원본 파일 수정은 없다.

합성 파일의 이전 정상/잘못된 JSON과 최신 정상/잘못된 JSON·예시 선택을 교차 검증했다. 실제 엔진이 만든 합성 암호화 번들을 브라우저 WebCrypto로 복호화하되 완료를 지연시켜 최신 평문 선택이 유지되는지도 확인했다. 작업 자체를 취소하거나 WebCrypto 계산을 강제 중단하는 기능은 아니며 탭 간/기기 간 동기화까지 증명하지 않는다.

전체 strict release-verify exit 0: 175 tests·2012 assertions·확장된 companion을 포함한 여섯 browser suite·번들·문법·격리 알림·설치본 일치. cache v25는 로컬 후보이며 원격 검증·공개 반영은 별도다. 실수집·실제 요약·모바일/스토어·사용자 검증 목표는 미완료로 유지한다.

### 9.56 Windows 트레이 알림 전달 후보

6618d98의 Engine 38194728864·Windows 38194728892·Pages 38194728812는 success다. Windows는 기존 `--json` 소비 경로가 알림 결정을 실행하지 않아 엔진의 옵트인 알림을 전달받지 못했다. JSON 전달 계약을 추가하는 테스트 2개가 수정 전 실패하고 수정 후 통과했다.

`--json --notification-events`는 기존 엔진의 정책과 전이 상태를 사용해 이번 실행의 `{title, body}` 배열을 반환한다. 일반 JSON/텍스트/스냅샷 export는 이 상태를 소비하지 않는다. 준비된 Windows 트레이만 요청하고 기존 pystray 시스템 알림으로 표시한다. 여러 메시지는 한 알림으로 합치고 240자로 제한한다. 표시 실패는 비밀값 없는 메뉴 안내로 분리해 quota 표시를 유지한다. `--once`는 발화를 요청하지 않는다. 새 의존성·앱 ID/shortcut·registry·인증 갱신·사용자 설정 변경은 없다.

이는 [pystray의 기존 시스템 알림](https://pystray.readthedocs.io/en/latest/usage.html#displaying-notifications)이며 정식 AUMID/WinRT toast, 활성화 action이나 notification-centre 이력을 대신하지 않는다. 전달은 receipt/영속 queue가 없는 일회성이며 OS 억제·실패 뒤 자동 재전송하지 않는다. R11 전체 완료와 실제 Windows presentation은 여전히 미검증이다.

검증: Bun 177 pass/2022 assertions, 여섯 browser suite, bundle·문법·격리 macOS 알림 계약 통과. 임시 venv의 pystray 0.19.5로 Windows selftest의 readiness·지원 여부·합치기·잘못된 이벤트·길이·오류 격리·subprocess flag·아이콘 준비 이후 poll을 확인했다. 이 selftest는 Mac에서 mock으로 수행했으며 Windows GUI 관찰이 아니다. 실제 엔진 title `TokenJuice`와 내부 tray ID `tokenjuice`의 차이도 반영했다.

전체 strict release-verify는 마지막 설치본 일치 단계에서 exit 1이다. 실행 중인 Mac 엔진은 그대로이며 새 source와 달라졌다. 이번 후보를 설치/스토어 출시 완료로 보고하지 않고, 승인된 설치본 갱신과 Windows CI/실기기 관찰을 남긴다. 모바일 연결·실제 모델·실수집·사용자 피드백의 원래 목표도 유지한다.

### 9.57 Windows 알림 연결 검증

bded47b의 [Windows CI 38195587167](https://github.com/kendrick-na/tokenjuice/actions/runs/38195587167)와 [Engine CI 38195587202](https://github.com/kendrick-na/tokenjuice/actions/runs/38195587202)는 success다. Windows runner에서 엔진 회귀·트레이 selftest·실제 엔진 `--once`·EXE 빌드·빌드된 EXE 실행과 artifact 업로드를 확인했다. 사용자 기기의 tray 알림 presentation이나 실제 계정 수집까지 증명하는 결과는 아니다.

후속 연결 테스트는 합성 계정의 임시 HOME에서 Python `read_usage`가 실제 Bun 엔진을 호출하고, 반환한 실제 `TokenJuice` 이벤트를 mock 표시기에 넘긴다. 두 번째 호출은 빈 이벤트이며 표시기는 한 번만 호출된다. 정책 판단을 Python으로 복제하지 않고 title·본문·옵션·중복 억제의 연결을 함께 검증한다. Mac에서는 임시 venv를 명시해 실행했고, Windows CI에서는 기존 Python 의존성으로 실행된다. 일반 Mac/Linux 회귀에서는 선택적으로 건너뛰므로 그 결과만으로 연결 검증을 주장하지 않는다.

로컬 연결 테스트 1 pass/8 assertions와 이를 포함한 전체 Bun 회귀 178 pass/2030 assertions를 확인했다. 48a03ab의 [Windows CI 38195753786](https://github.com/kendrick-na/tokenjuice/actions/runs/38195753786)와 [Engine CI 38195753806](https://github.com/kendrick-na/tokenjuice/actions/runs/38195753806)도 success다. Windows 로그에서 새 연결 테스트 pass, selftest 통과, 빌드된 EXE exit 0을 확인했다. 태그 없는 후보 artifact이며 새 스토어/desktop release를 발행하지 않았다. 실행 Mac 설치본·설정·credential은 그대로이며 R11 native-toast/실기기, 실제 모델·모바일 연결·스토어·사용자 피드백 목표는 여전히 남는다.

### 9.58 로컬 모델 요약 어댑터

Ollama는 로컬 daemon을 통한 클라우드 모델도 지원하므로 loopback만으로 비전송을 판단하지 않는다. `ollama-work-summary.mjs`는 명시적 모델/tag·digest와 payload에 묶인 승인 뒤 metadata 상태·설치 모델을 확인한다. `cloud.disabled`가 정확히 true가 아니거나 모델 digest/크기/원격 필드가 맞지 않으면 대화 없이 중단한다. 공식 근거와 실행 한계는 LOCAL_AI_SUMMARY에 기록했다.

기존 발언 파서·비밀값 제외·근거 검증·128000-byte 응답 제한을 재사용한다. 로컬 evidence 4096-byte 제한을 위한 공통 옵션만 추가했고 Anthropic 기본 20000 bytes와 비용/동의 규칙은 유지한다. local 초안은 `local_generative`로 구분하고 출력 불완전·원격 응답·tool 호출·잘못된 참조를 거부한다. 클라우드 자동 fallback·download·실제 모델/대화 호출은 없다.

검증: 로컬 신규 7개와 기존 클라우드 코어 8개가 함께 통과했고 전체 Bun은 Windows 연결 테스트를 포함해 185 pass/2285 assertions다. 테스트의 합성 user 발언이 비밀값과 같은 줄에 있어 모두 제거된 경우와 동일 발언 dedup을 분리해 fixture를 바로잡았다. strict verifier의 여섯 browser suite·번들·문법·격리 알림도 통과했고 마지막 Mac 설치본 불일치로 전체 exit 1이다. 실제 daemon/모델의 의미 품질이나 자원 사용량을 증명한 결과는 아니다.

후속은 로컬 승인 세션·화면의 처리 위치/자원 안내·검토 파일 출처 연결, 사용자 동의 후 모델 설치와 실과제 평가다. 현재 실행 UI는 Anthropic이며 어댑터만으로 C07을 완료 처리하지 않는다. Mac 설치본 일치·수집·모바일·스토어·실사용자 피드백 게이트도 유지한다.

### 9.59 로컬 모델 승인 세션과 재검토 출처

0a9461c의 Windows 38196492454·Engine 38196492379는 success다. 후속 로컬 승인 테스트 4개는 수정 전 클라우드 전용 모델 처리와 provider 검증 부재로 실패했다. 승인 컨트롤러가 명시적 `ollama_local` 설정에만 로컬 어댑터를 선택하고, 미지정/Anthropic은 기존 원장·API key·비용 동의를 유지하도록 연결했다. 알 수 없는 provider는 거부한다.

소유자·payload digest·5분 만료·최대 preview 3개·1회 승인을 유지하고, 로컬 컨트롤러 하나에서 실행은 하나만 허용한다. 다른 대기 승인은 busy 때 소비하지 않으며, 완료/실패 뒤 실행 슬롯을 해제한다. 실행 중 삭제/종료와 실패 승인 재사용은 거부한다. 로컬은 cloud USD 원장을 사용하지 않지만 기기 자원은 사용한다. 여러 컨트롤러/프로세스 전체를 제한하는 기능은 아니다.

직접 재검토한 local 결과는 `local_generative_user_reviewed`·`reviewed_local_model_excerpt`로 내보낸다. 원문·근거·모델 digest·비용·키와 추가 필드는 제외한다. 현재 UI/실행 서버와 Pocket의 새 출처 파일 수용은 아직 연결되지 않았으므로 공개 사용 가능이나 C07 완료로 보고하지 않는다.

신규·기존 요약 테스트 23 pass/353 assertions, 전체 Bun 회귀는 Windows 연결을 포함해 189 pass/2312 assertions다. 합성 응답만 사용했고 실제 모델·대화·cloud API·설정 변경은 없다. Mac은 arm64/64 GiB RAM이며 PATH의 ollama와 기본 /Applications/Ollama.app은 확인되지 않았다. 다른 위치 설치 여부나 실제 모델 품질을 이 관찰로 확정하지 않는다.

후속은 로컬 실행 서버·처리 위치와 자원 안내 화면·Pocket 재검토 파일 호환·동의된 실제 모델 평가다. Mac 설치본 일치와 인증/지속 수집, 모바일 자동 연결·스토어·실사용자 피드백 목표는 계속 남는다.

### 9.60 로컬 모델 실행 서버와 검토 파일 왕복

508605e의 Engine 38196852783는 success지만 Windows 38196852853는 캐시 timestamp 회귀의 기본 5초 제한으로 실패했다. 이 테스트는 25개의 격리 엔진 프로세스를 실행한다. 같은 검증 항목을 유지하고 해당 테스트만 20초로 지정했다. 다른 테스트를 건너뛰거나 제품의 실패 판정을 느슨하게 바꾸지 않았으며 Windows 재검증은 별도다.

실행 서버는 `provider: ollama_local`을 명시한 경우에만 key/USD 원장 없이 로컬 어댑터를 선택한다. 정확한 loopback origin·Bearer·POST·클라이언트 설정 override 차단·승인 경계를 유지한다. 미지정 Anthropic은 기존 비용 동의를 유지한다. CLI는 OS의 절대 경로를 사용하고 모델·provider·digest를 전달하며 설치/다운로드/브라우저 자동 실행은 없다.

화면은 로컬 모델/클라우드 처리를 구분하고, 로컬에는 메모리·전력·시간 사용과 원격 여부 검사 조건을 표시한다. 모델 요청 전 동의, 생성 후 재검토, 편집 후 검토 해제를 유지한다. 로컬 생성 출처는 브라우저 저장→Pocket 미검토 다시 열기→재검토 저장/인계에서도 유지한다. 출처/개인정보 값이 맞지 않는 파일은 거부한다. Pocket cache v26 후보에 이 파일 호환을 포함했다.

합성 HTTP 왕복과 로컬/클라우드 화면 승인·1회 생성·수정·저장·초안 삭제, Pocket 로컬 파일의 출처/재검토/저장과 375/812/1280 폭을 검증했다. 기술 정보는 펼친 상태에서 실제 표시 내용을 검사한다. 로컬 375px 합성 화면을 시각 확인했고 외부 브라우저 요청·원문/key 저장은 없었다. 실제 모델·daemon·실대화 전송·요금 호출은 하지 않았다.

strict 회귀는 191 pass/2336 assertions·확장된 여섯 browser suite·번들·문법·격리 알림을 통과했고 마지막 Mac 설치본 불일치로 전체 exit 1이다. 설치본 변경·로그인 갱신·스토어 제출은 없다. 원격 CI/v26 공개 반영, 실제 모델 의미 품질·작업 재개 효과·실수집·모바일·스토어·실사용자 피드백 목표는 남는다.

### 9.61 설치본 일치 복구와 v26 공개 확인

29bd977의 Windows 38197439793·Engine 38197439818·Pages 38197439838는 success다. Windows 로그에서 timestamp 회귀 pass(1562ms), 로컬 HTTP 승인 테스트 pass, tray selftest 및 EXE exit 0을 확인했다. 공개 sw.js·work-summary.js SHA-256이 소스와 일치해 Pocket cache v26 반영을 확인했다. 실제 로컬 요약 모델이나 모바일 계정 연결이 공개 웹에 포함됐다는 뜻은 아니다.

실행 Mac 설치본은 bded47b부터 검증된 JSON 알림 전달 7줄이 빠져 있었다. 최신 저장소 엔진과 bded47b 엔진 사이 추가 차이가 없는 것을 확인하고, 기존 plugin을 `/tmp/tokenjuice-installed-events-backup.O5BCdt/tokenjuice-battery.5s.js`에 원본 그대로 백업했다. apply_patch로 이 차이만 반영했으며 shebang·파일 실행 모드와 기존 설정을 유지했다. 백업은 임시 경로라 OS 정리 뒤 보존을 보장하지 않는다. 전체 installer·LoginItems·서비스 재등록이나 인증 갱신은 실행하지 않았다.

plugin 본문과 wake helper는 소스와 일치하고 config 파일 SHA-256도 변경 전후 동일하다. 전체 strict release-verify exit 0: 191 tests/2336 assertions, 확장된 여섯 browser suite, 번들·문법·격리 알림·설치본 검증을 통과했다. SwiftBar PID 존재는 확인했지만 직접 메뉴 화면 확인은 UI 도구 timeout 두 번으로 실패해 실제 표시를 검증한 결과로 쓰지 않는다.

11:53 KST 읽기 전용 diagnostics는 Claude HTTP401/auth expired·trust blocked, 마지막 성공 146h 전·다음 retry 12:00, Codex local fresh를 표시했다. API/갱신을 추가 호출하지 않았고 autoRenew=false·알림/예측/topics off를 유지했다. 소스 일치는 Claude 인증·지속 수집 복구를 대신하지 않는다. 공식 Claude Code 재로그인 확인과 실제 계정 수치 대조, 모델 설치 동의/의미 품질·작업 재개 효과·모바일·스토어·실사용자 피드백은 남는다.

### 9.62 현재 완료 상태와 외부 검증 조건 재점검

12:01 KST 읽기 전용 diagnostics는 Claude HTTP401/auth expired·마지막 성공 147h 전·retry 12:10을 확인했다. API/갱신은 추가 호출하지 않았다. 실행 원장의 P0-01 현재 수치 대조는 미완료로 되돌리고 §9.47의 실제 성공은 과거 이력으로 보존했다. R6/R11도 Win32 sender/CI 통과와 실제 presentation·AUMID toast 미완료를 분리해 현재 코드 상태에 맞췄다.

같은 시각 metadata-only feedback triage는 열린 이슈 0건·truncated=false·분류 대기 0건을 반환했다. 이슈가 없다는 사실은 제품 만족·유료 수요·피드백 운영 검증이 아니다. 실제 접수→분류→수정→검증→응답 사례나 인터뷰를 합성하지 않았다.

현재 수집/품질/출시의 다음 증거는 공식 Claude Code 재로그인 후 현재 계정 대조, 동의된 로컬 runtime/model 설치 및 합성 실행→선택한 실과제 평가, 모바일 수집 허용 경로와 전달 서버/보관/비용/동의·실기기, 별도 승인된 스토어 계정/서명/제출이다. 코드·자동 검증 항목은 유지하되 이 외부 조건을 문서 수정이나 반복 회귀로 해결했다고 하지 않는다.

### 9.63 모델 설치 없는 기본 UX와 운영형 클라우드 API 후보

2026-10-12 사용자 “추천안대로 착수” 요청에 따라 일반 사용자에게 Ollama 설치를 요구하지 않는
방향으로 후속 개발했다. 로컬 모델 실평가는 고급 선택 경로의 게이트이며 기본 제품이나 클라우드
요약의 선행 설치 게이트가 아니다. 기본 추적·클라우드 선택·고급 BYOK/Ollama를 화면에서 구분하고,
운영형 클라우드는 실제 호스트/login 연결 전 ‘준비 중’으로 표시한다. UI 스킬의 단계적 공개와 기존
다크/서체/색 토큰을 적용했으며 작은 화면 가독성을 유지했다.

managed-summary-gateway 후보는 서버 키만 사용하고 앱 세션 검증/활성화를 호스트에 필수 주입한다.
같은 HTTPS origin·Host·POST·JSON을 요구하며 업로드 동의/정책 버전과 모델 생성 승인을 별도로
확인한다. 동의한 발췌 업로드도 외부 전송임을 계약에 명시했다. 계정별 예약·전체 운영 예산·동시 요청
제한·승인 격리/단일 사용·실패 예약 보존을 기존 컨트롤러/원장과 연결했다. 로컬 API는 loopback만
허용하는 기존 경계를 유지한다. 실제 로그인·운영형 클라이언트·multi-instance 원장·호스팅·보존
정책·가격/한도·실제 API 품질은 미완료다. 상세는 docs/MANAGED_CLOUD_SUMMARY.md.

신규 gateway 5개와 기존 HTTP/UI 경계 테스트를 포함한 targeted 16 pass/155 assertions.
strict release-verify --require-browser exit 0: 195 pass·1 platform skip·2380 assertions·18 Bun
파일, 기존 확장 6 browser suite, 번들·문법·격리 알림·설치본 일치를 통과했다. 375px/가로/desktop,
확대 글자·고급 옵션 펼치기·동의/편집/재검토를 합성 화면으로 검증했고 모바일 screenshot을 시각 확인했다.
합성 제공자만 사용했으며 Ollama/모델 설치·실대화·유료 API·메뉴바 설정/인증·공개 배포는 변경하지
않았다. 합성 gateway 테스트는 실제 가입/결제/운영형 클라이언트 E2E 검증이 아니다. 전체 목표 완료로
표시하지 않으며 기존 Claude 인증·모바일·스토어·사용자 피드백 항목은 남는다.

### 9.64 운영형 클라우드 사용자 화면과 합성 gateway 연결

`managed-summary/`에 모델 다운로드/개인 키 없이 사용하는 화면 후보를 추가했다. 기기에서 원문
파일을 파싱하고 role/content만 발췌 JSON에 넣는다. 도구 결과·원문 metadata·알려진 비밀값은
제외하며 최신 발언 유지·20,000 UTF-8 bytes·누락 안내를 적용한다. 모든 비밀값 제거나 완전한
대화 요약을 보장하지 않는다. 파일 선택만으로 업로드하지 않는다.

업로드할 정확한 발췌·수신자·정책 URL/버전을 확인한 후 명시적으로 업로드하고, 서버 미리보기의
발언/전체 제공자 요청과 5분 승인을 다시 확인해 생성한다. 전송 정책 재확인은 두 동의를 해제한다.
실패/불명 응답에 자동 재시도하지 않으며 인증 실패 때 선택·편집을 보존하되 업로드/생성을 막는다.
편집/저장은 기기에서만 처리하며 `/review`로 보내지 않는다. 파일은 Pocket에서 미검토로 재열리고
cloud 생성 출처를 유지한다. 서버 삭제 실패와 화면 삭제를 구분한다.

동일 HTTPS origin용 managed-summary-site adapter는 정적 파일 whitelist·same-origin CSP·no-store를
유지하고 config/key/source API를 노출하지 않는다. 실제 로그인/auth·호스팅·정책·운영 비용은
연결하지 않았다. 4183 fixture의 HTTP→HTTPS bridge와 고정 계정은 테스트 전용이며 운영 배포
대안이 아니다. 실제 제공자 호출·실대화·계정 로그인·모델 설치·Mac 설정 변경은 없다.

신규 client/site와 기존 gateway targeted 8 pass/88 assertions. 전체 strict release verifier exit 0:
198 pass·1 platform skip·2416 assertions·19 Bun 파일, 확장 7 browser suite, 번들·문법·격리
알림·실행 Mac 설치본 일치 통과. 브라우저에서 정확한 발췌 전송·별도 생성 동의·1회 실행·재검토
저장/재열기·잘못된 파일 입력 시 초안 보존·401 시 편집 유지·375px/가로/desktop·확대 글자·
키보드·외부 브라우저 요청/원문 영구 저장 부재를 검증했고 모바일 screenshot을 시각 확인했다.
이 브라우저 회귀는 Engine CI에도 추가했다. 사용자 로그인/남은 한도 표시·공개 배포·실모델 품질·
실계정 장기 수집·모바일·스토어·인터뷰는 미완료다. 이번 증거는 전체 목표 완료를 증명하지 않는다.

### 9.65 클라우드 후보 원격 CI와 현재 수집 재확인

303838d와 b9095d9를 origin/main에 반영했다. b9095d9의 Engine 38201615071은 macOS/Ubuntu
엔진 및 Companion browser 모두 success이고, browser job 로그에서 managed-summary.test.py의
정확한 발췌 전송·별도 승인·재검토/저장·401 보존 PASS를 확인했다. Windows 38201615069도
회귀·tray selftest·EXE 생성/실행·artifact 업로드 success다. tag release job은 skipped이며 새
데스크톱 릴리스/스토어 제출은 아니다. Pocket 공개 페이지 변경이나 클라우드 호스팅 배포도 없다.

12:54 KST 진단은 기존 관측만 읽었으며 Claude HTTP429/rate-limit·trust blocked·마지막 성공
147h 전·retry 13:10, Codex local JSONL fresh를 표시했다. autoRenew=false·알림/예측/topics off는
유지했다. 이번 작업에서 추가 API/로그인 갱신은 호출하지 않았으며 제한 원인을 추측하지 않는다.
기획 원장의 P0-01에 최신 상태를 반영했다. 제한 종료 후 인증·현재 계정 공식 수치 재대조와
장기 작동 검증은 여전히 미완료다. CI success를 실제 수집/모델 품질/사용자/스토어 성공으로
대체하지 않는다.

### 9.66 금액과 독립적인 요청 횟수 및 실제 원장 기반 표시

일반 사용자 요약 화면의 남은 횟수 미구현 항목을 후속 구현했다. `ai-summary-attempts.mjs`는
계정별 UTC 시도 수를 별도 private POSIX 파일에 기록하며 가격/모델 예약액 변경·재시작·한도
하향으로 사용 횟수를 초기화하지 않는다. 생성 전 시도 1회를 기록한 뒤 전체 비용을 예약하고,
실패/불명/전체 비용 거부에도 보수적으로 시도를 유지한다. 2개 원장의 분산 rollback은 없다.

snapshot과 reserve는 독점 lock을 사용하고 atomic rename·file/dir fsync로 저장한다. 손상·
symlink·public 권한·잠금·기록된 예약 시각보다 뒤로 간 clock은 차단한다. 옛 금액 원장만 있는
계정은 요청 횟수를 증명할 수 없어 migration_required로 중단하며 자동 삭제/초기화하지 않는다.
고정 금액의 나눗셈으로 잔여 횟수를 추정하지 않는다. 사용자 식별·원문·모델 정보는 횟수 파일에 없다.

인증된 정책/승인 결과는 used/remaining/limit·UTC 구간·reset/관측 시각을 제공한다. 생성 후
횟수 읽기만 실패하면 결과 초안을 유지하고 quota=null을 반환한다. 화면은 유효한 잔여 수,
확인 불가, 2분 초과/구간 경과 관측을 구분하고 자동 재조회/제공자 재시도는 없다. 확인된 0회는
새 생성 버튼을 막지만 기기 검토/저장은 유지한다. 실제 로그인·사용자별 요금제·운영 정책은 별도다.

신규/기존 targeted 15 pass/140 assertions. 별도 12 OS 프로세스 경합에서 실제 성공 프로세스가
존재하고 성공 수가 한도 이하이며 파일의 used와 일치함을 검증했다. 전체 Bun은 205 pass·1
platform skip·2468 assertions·20 파일이다. strict release-verify도 7 browser suite·번들·문법·
격리 알림·Mac 설치본 일치를 통과했다. 이후 잔여 수에 UTC 구간을 명시한 문구 및 실제 합성
횟수 소진→fresh 0회 새 생성 차단→오래된 관측 표시도 별도 브라우저 재검증을 통과했다.
실제 대화/유료 모델/API·계정 로그인·설정·스토어 제출은 변경하지 않았다. 후보 코드와
합성 검증을 운영 배포·실제 모델 품질 또는 전체 투두 완료로 기록하지 않는다.

### 9.67 횟수 원장 CI 및 최신 인증 상태

c6117ae를 origin/main에 반영했다. Engine 38202817657과 Windows 38202817623는 success다.
로컬 최종 strict 검증은 확장된 실제 합성 시도 소진·fresh 0회 생성 차단·오래된 관측 browser
검증까지 exit 0이다. Windows도 회귀·tray selftest·EXE 생성/실행·artifact 업로드를 통과했고
tag release는 skipped다. 새 Pocket 공개 기능·클라우드 호스팅·스토어 제출은 없다.

13:12 KST 읽기 전용 진단은 Claude HTTP401/auth expired·trust blocked·마지막 성공 148h 전·
retry 13:20, Codex local fresh를 반환했다. 이전 429 뒤 인증 실패로 바뀌었지만 추가 API/갱신은
호출하지 않았다. autoRenew=false·알림/예측/topics off를 유지하고 사용자에게 Claude Code
재로그인 여부를 요청했다. 설치된 CLI의 `auth --help`와 `auth login --help`로 login 명령과
기본 subscription 경로를 확인했으며 로그인 자체는 실행하지 않았다. 실제 재로그인·공식 계정
수치 대조·장기 갱신·실수집은 여전히 미완료이며 시도 횟수 기능과 분리한다.

### 9.68 로그인 뒤 앱 세션과 권한 철회 후보

managed-summary-sessions 후보는 호스트 로그인 제공자가 검증한 subject 뒤에만 앱 세션을
발급한다. 비밀번호/OAuth/JWT 검증이나 공개 subject 발급 route는 없다. 256-bit opaque
cookie·서버 hash lookup·cookie-only/중복 거부·HTTPS origin/Host·absolute/idle 만료·512개
기본 상한을 적용했다. 동적 권한은 요청마다 strict boolean으로 확인하며 실패/timeout은 거부한다.
await 중 logout/subject 철회/만료가 발생하면 뒤늦은 권한 응답으로 접근을 복구하지 않는다.
gateway의 인증 deadline도 기본 5초로 제한한다. 비협조 외부 promise 강제 종료는 보장하지 않는다.

신규/기존 targeted 14 pass/108 assertions, 전체 212 pass·1 platform skip·2512 assertions·
21 Bun 파일이다. strict release-verify --require-browser exit 0이며 기존 7 browser suite·
번들·문법·격리 알림·Mac 설치본 일치를 통과했다. 실제 opaque 세션을 gateway에 연결해 미인증
cookie·권한 철회·logout 뒤 생성 차단과 제공자 호출 0을 합성 검증했다. 실제 로그인 제공자·
OAuth callback·회원/결제 저장소·logout route/UI·호스팅·다중 instance·실사용 검증은 남는다.
보안 참고는 MANAGED_CLOUD_SUMMARY의 OWASP 링크이며 전체 규격 준수/보안 인증을 주장하지 않는다.

13:29 KST 기존 관측 진단은 Claude HTTP401/auth expired·trust blocked·retry 13:30,
마지막 성공 148h 전·Codex local fresh다. API/갱신·실로그인·모델 설치·유료 호출·설정 변경은
하지 않았다. 사용자의 재로그인 완료 답변이 없으므로 실수집을 완료로 기록하지 않는다.

### 9.69 Windows 회귀 timeout 원인과 입력별 분리

7c7fe28의 Engine 38204072804는 success지만 Windows 38204072468은 기존 malformed API
utilization 테스트의 기본 5000ms deadline으로 실패했다(5018.74ms). 새 앱 세션 테스트들은
통과했고, 실패 테스트는 10개 utilization·9개 body·overflow·출력 검사를 한 케이스로 묶어
42개 cold engine 프로세스를 실행했다. assertion 실패를 timeout으로 오인한 것이 아니라 로그에
timeout이 명시되어 있다. 실제 Windows 사용자 화면이나 프로덕션 실행을 확인한 결과는 아니다.

systematic-debugging 절차로 로그·호출 경로·정상 timestamp 테스트 패턴을 확인하고, 기존 입력과
검증을 보존한 채 10개 utilization·9개 body·overflow의 20개 독립 테스트로 분리했다. default
deadline을 늘리거나 테스트를 skip하거나 엔진의 실패 판정을 완화하지 않았다. 각 입력에서 cache
보존·history/알림 부재·비밀값 비출력을 더 직접 확인한다. targeted 20 pass/139 assertions다.
전체 자동/Windows 재검증이 필요하며 분리만으로 원격 CI 복구를 완료 처리하지 않는다.

### 9.70 세션 후보 및 Windows 회귀 재검증

25788bf의 Windows 38217823738 및 Engine 38217823673는 success다. Windows는 입력별
회귀·tray selftest·EXE 생성/실행·artifact 업로드를 통과했고 tag release는 skipped다. Engine도
macOS/Ubuntu·확장 browser job을 통과했다. 전체 로컬 회귀는 231 pass·1 platform skip·2578
assertions·21 Bun 파일이며 최종 strict verifier exit 0이다. 테스트 수 증가는 기존 1개 batch를
20개 독립 case로 분리한 결과이며 19개 제품 기능을 새로 완성했다는 뜻이 아니다.

앱 세션 후보 구현과 test harness deadline 문제를 각각 해결했지만 실제 신원 검증 제공자·
로그인/logout 사용자 흐름·권한 저장소·호스팅·정책·운영 가격·실모델 품질/작업 재개·스토어·
인터뷰는 미완료다. Claude도 마지막 13:29 진단은 auth expired이고 재로그인 완료 확인이 없다.
코드·CI 수정은 실제 계정 수집이나 전체 목표의 완료 증거가 아니다. 실제 대화/유료 API·
로그인/키·Mac 설정·공개 클라우드 배포·스토어 제출은 이번 작업에서 변경하지 않았다.

### 9.71 로그아웃 route/UI와 늦은 작업 응답 제외

managed-summary-site에 선택적 동일 appSessions 연결을 추가하고 `/auth/logout`을 구현했다.
same HTTPS origin/Host·POST JSON·confirmed true만 허용하며 query/extra subject·CSRF·비 JSON·
1024-byte 초과를 거부한다. 읽기 5초와 대기 3개 제한을 적용한다. cookie는 header로만 반환하고
응답 본문은 loggedOut true다. 세션 미구성/실패를 성공으로 표시하지 않으며 정책의 capability가
있을 때만 버튼을 표시한다. 실제 로그인 제공자/회원 DB/호스팅/TLS는 아직 미구현이다.

native 확인 뒤 새 전송을 즉시 막되 발췌/편집/저장을 기기에 유지한다. 생성/파일 읽기 중에도
로그아웃할 수 있고 connection epoch/작업 ID로 늦은 응답이 이전 상태를 복원하지 못하게 한다.
이미 승인한 실행의 취소/환불이나 서버 초안 삭제를 확인했다고 하지 않는다. 로그아웃 때문에
서버 삭제를 확인하지 못한 초안은 이후 화면 지우기에서도 확인 불가로 표시한다. 보조 버튼 간격·
조건부 focus 복귀는 UI 스킬 기준으로 기존 디자인 토큰을 유지했다.

합성 fixture에서 opaque 세션을 실제로 폐기해 다음 policy가 401임을 확인했다. bridge는 cookie를
서버에서 주입하고 `/test/session`은 고정 합성 identity만 발급한다. production site에는 이 route가
없으며 실제 로그인/브라우저 Secure-cookie/TLS 검증의 대안이 아니다. browser에서는 실패/성공
logout·편집 보존/저장 가능·늦은 파일 읽기/생성 응답 제외·새 API 거부를 확인했다. 원문/유료
API/실제 계정·설정·모델 설치·스토어 제출은 변경하지 않았다.

전체 Bun 233 pass·1 platform skip·2605 assertions·22 파일. strict release-verify exit 0이며
확장 7 browser suite·번들·문법·격리 알림·Mac 설치본 일치를 통과했다. 코드/UI 후보 연결과
합성 검증이지 실계정/실모델/클라우드 개통이나 전체 투두 완료가 아니다.

### 9.72 재연결 CI 경쟁 상태 재현 및 완료 조건 보강

452b947의 Windows 38220584444는 success지만 Engine 38220584453의 browser job은
managed-summary.test.py:95 저장 버튼 assertion에서 실패했다. 로컬 기존 suite는 통과했다.
systematic-debugging으로 경로를 추적한 결과, 두 번째 policy 요청 중에도 이전의 동일한
인증 실패 메시지와 quota unknown이 남는다. 따라서 그 두 텍스트를 기다리는 것은 새 요청의
완료 증거가 아니며 busy=true인 동안 저장 버튼은 정상적으로 잠깐 비활성화된다.

새 테스트는 policy 응답을 의도적으로 보류해 요청 발생·연결 버튼 비활성·이전 메시지·quota·
저장 비활성을 확인한 뒤 401 응답을 해제한다. finally 이후 연결/저장 버튼 활성화를 조건으로
기다리고 편집 보존·파일 선택 차단을 계속 검증한다. 제품 코드·deadline·skip 변경 없이
이전 assertion이 경쟁 상태에서 실패하는 조건을 재현했다. 고정 sleep은 추가하지 않았다.
targeted browser 3개 시나리오와 strict release-verify --require-browser exit 0이며 Bun은
233 pass·1 platform skip·2605 assertions다. 수정 후 원격 CI 확인은 별도로 필요하다.

17:07 KST 읽기 전용 진단은 Claude HTTP401/auth expired·trust blocked·마지막 성공 152h 전,
Codex local fresh다. API/갱신·로그인·설정 변경 없이 기존 관측만 읽었다. 앞선 실제 메뉴바
확인은 Mac 잠금 때문에 불가했고, 잠금 해제/재로그인 완료 답변이 없다. 실제 수집·신규 설치·
전체 디자인·호스팅·스토어·실사용 피드백 게이트는 여전히 미완료다.

6573b93의 Engine 38221694577와 Windows 38221694622는 모두 success다. browser job 로그에서
재연결 편집 보존·합성 한도 소진·로그아웃/늦은 응답 제외의 3개 managed 시나리오 PASS를
확인했다. Windows EXE 생성·실행·artifact 업로드도 통과했고 tag release는 skipped다.
이로써 이번 CI 경쟁 상태 보강의 원격 재검증까지 완료했으며 실제 출시 완료와는 구분한다.

### 9.73 재연결 중 상태를 이전 인증 실패와 구분

기획서 P1-04 오류 복구 동선의 작은 후속이다. connect가 policy를 초기화하고 새 요청을
보내는 동안 이전 인증 실패 안내는 그대로 남았으며, §9.72의 보류 응답 회귀로 이 상태가
확인됐다. 진행 안내를 요구하는 테스트를 먼저 실행해 기존 코드의 해당 assertion 실패를
재현한 뒤 connect 시작 시 status 안내 한 줄을 추가했다. 기존 role=status/aria-live 영역과
디자인을 유지하며 선택·편집 보존 및 발췌 자동 전송 없음도 설명한다. 인증·권한·서버 계약·
버튼 활성화 기준·실제 수집 설정은 변경하지 않는다.

보류된 policy 요청 중 새 진행 안내·이전 오류 부재·편집 보존·저장/전송 차단을 검사하고,
401 응답 뒤 실제 오류 안내·로컬 저장 재활성화를 확인했다. 합성 browser 3개 시나리오 및
strict release-verify --require-browser exit 0, Bun 233 pass·1 platform skip·2605 assertions다.
원격 CI는 후속 확인이 필요하다. 운영 배포·실계정 로그인·유료 호출·비밀값 접근은 없었으며
Mac 잠금 해제/Claude 재로그인·실기기·스토어·인터뷰와 P1-04 전체 항목은 계속 pending이다.

0b5c389의 Engine 38224960087와 Windows 38224960065 모두 success다. Engine의 browser job
114730090568에서 managed 3개 시나리오 PASS를 확인했다. Windows EXE 생성·실행·artifact
업로드도 통과했으며 tag release는 skipped다. 이번 후보 UI 변경의 CI 증거만 완료 처리한다.

### 9.74 파일 직접 열기의 잘못된 연결 중 안내와 스타일 경로 복구

사용자가 열어 둔 local-summary/index.html은 file:// 경로다. 기존 /app.css·/app.js는
파일 루트로 해석되고, module/API 기반 화면이 실행되지 않아 정적인 연결 중 안내와 잠긴
입력만 남았다. 직접 파일 복구 테스트를 먼저 추가해 안내 element 부재 실패를 확인했다.
상대 asset 경로·서버 연결 전 기본 문구·정적 복구 panel을 추가했고 실제 /api/session
연결 성공 뒤에만 panel을 숨긴다. file module 실패에도 안내와 스타일은 존재한다.

Pocket 수동 링크는 파일 확인/편집 경로이지 서비스 운영형 AI 생성이나 자동 sync라고 부르지
않는다. 고급 서버 실행은 별도이며 모델 설치·키 입력·네트워크·사용자 파일 전송은 자동
실행하지 않는다. 기존 색/서체·명시적 amber 상태·48px 링크를 UI 스킬 기준으로 재사용했다.

직접 파일의 375px 화면·CSS 배경·복구 안내·입력/생성 비활성·자동 HTTP/API 요청 없음 및
기존 클라우드/로컬 합성 흐름을 검증했다. /tmp/tokenjuice-file-recovery-mobile.png도 시각
확인했다. strict release-verify --require-browser exit 0, Bun 233 pass·1 platform skip·
2605 assertions이며 원격 CI는 별도 확인이 필요하다. 사용자 파일 탭 재연결은 CUA의 file://
보안 정책으로 거절되어 우회하지 않았고 실제 열린 탭을 새로고침했다고 주장하지 않는다.

2026-10-13 01:19 KST 읽기 전용 진단은 Claude HTTP401/auth expired·trust blocked·기존
마지막 성공 4h 전·retry 01:27, Codex local fresh다. 과거 성공 관측의 변경만으로 현재 인증
복구를 추정하지 않는다. 사용자 잠금 해제 답변은 받았으나 Claude Code 재로그인 확인은 없다.
실기기 전체·실모델 품질·운영 호스팅·스토어·사용자 인터뷰 및 전체 목표는 계속 미완료다.

fdd5ca6의 Engine 38277023788와 Windows 38277023775는 모두 success다. browser job
114904879779의 직접 파일 복구·기존 클라우드/로컬 합성 생성 3개 PASS를 확인했다.
Windows EXE 생성·실행·artifact 업로드도 통과했고 tag release는 skipped다. 이번 복구
화면 후보의 자동 검증 증거이며 실제 사용자 파일 탭/AI 개통 증거로 확대하지 않는다.

### 9.75 현재 공개 상태와 실제 개통 의존성 재대조

출시 계획서의 상단 및 최종 판정은 과거 Claude 숫자 복구와 Pocket v20을 현재 상태처럼
서술하고 있어 바로잡았다. Pages 최신 38197439838/29bd977 success, 소스 sw v26 및
index.html·app.js·app.css·sw.js·history.js·work-summary.js·work-files.js·manifest.webmanifest
8개의 공개 HTTP200/SHA-256 소스 일치를 다시 확인했다. 최초 점검의 style.css는 실제
참조 파일이 아닌 잘못된 검사 경로였으며, index.html의 app.css 참조를 확인해 재검사했다.
이를 배포 오류로 기록하지 않는다. GitHub 최신 릴리스는 v1.2.2, publishedAt
2026-10-08T17:01:20Z(10월 9일 02:01 KST)다. public Pocket/desktop 자산/main 후보를 분리한다.

10월 13일 01:27 KST 읽기 전용 진단은 Claude HTTP401/auth expired·trust blocked·기존
마지막 성공 4h 전·retry 01:37, Codex local fresh다. 자동 갱신 false·사용자 설정·자격증명·
실제 API 요청을 변경하지 않았다. 이전 성공 체크박스는 과거 이력으로 명시했다.

기획서의 보류 근거와 MANAGED_CLOUD_SUMMARY/MOBILE_CONNECTION_GATE/LAUNCH_FEEDBACK_PLAN을
대조해 실제 수집·운영형 요약 auth/호스트·실모델 비용 승인·Android 전달 계약·스토어·실제
피드백의 다음 의존성을 출시 계획에 연결했다. 임의의 호스트/신원 제공자·운영 예산·모바일
방식 선택이나 계정/키/서명/결제를 수행하지 않는다. 작은 합성 기능 추가가 전체 목표를
달성한 것으로 설명하지 않으며 P0~P3와 모든 플랫폼 목표는 유지한다.

이번 문서 대조 뒤 strict release-verify --require-browser exit 0, Bun 233 pass·1 platform
skip·2605 assertions와 전체 browser 회귀·설치본 일치가 통과했다. 마지막 코드 fdd5ca6의
Engine 38277023788·Windows 38277023775 success도 재확인했다. 문서-only 변경은 새 CI나
배포 실행을 의미하지 않으며 실제 개통 구성 추천을 위해 월 총비용 상한을 사용자에게 요청했다.

### 9.76 운영형 요약의 실제 호스트/auth 후보 조사

월 총비용 상한 답변 없이 가입·결제·계정/키·배포를 실행하지 않고 공식 문서로 Render,
Railway, Fly 저장/과금 제약과 Clerk 가격/서버 검증 경계를 조사했다. strategy-advisor의
현재 상태·제약·대안·위험 기준으로 Render 유료 단일 Bun 서버+지속 disk 및 Clerk 로그인을
우선 후보로 추천했다. Render 무료 disk 불가와 filesystem 휘발은 현재 원장에 부적합하며,
유료 disk도 배포 중 중단·단일 instance·runtime mount만 가능하다. Railway $5는 포함 usage
기준이지 무제한 총요금이 아니고 Fly는 volume 자동 복제/가용성 구성이 별도다.

서버+1GB disk 약 $7.25/월 계산은 총비용 상한/사용자 승인/실제 성능 증거가 아니다.
Clerk 무료 MRU 범위와 로그인 UI는 요약 권한·CSP·logout·TLS·철회 통합을 대신하지 않는다.
공식 링크/견적 제외 항목·disk snapshot 복원 예산 위험·운영 비용식·auth/Host 검증과 실제
API/품질 베타 실행 순서를 MANAGED_CLOUD_SUMMARY·기획서·출시 계획에 연결했다. 특정 호스트
선택이나 비공식 quota 정책 허용, 실제 개통 완료를 주장하지 않는다.

문서-only 변경이며 기본 앱 세션/site/logout 11 pass/103 assertions와 gateway 9 pass/80
assertions를 재확인했다. 최초 대상에 없는 managed-cloud-summary.test.js를 포함했으나 Bun은
존재하는 3개 파일만 실행했으므로 이를 gateway 검증으로 계산하지 않았다. 파일 목록 확인 후
실제 managed-summary-gateway.test.js의 9개를 별도로 실행했다. 마지막 코드 fdd5ca6의 Engine
38277023788·Windows 38277023775 success는 재확인했지만 이번 문서의 새 CI/배포는 아니다.
전체 투두·실제 인증/실기기·모바일·스토어·인터뷰 게이트는 유지한다.

### 9.77 실제 호스팅 연결을 위한 명시적 HTTPS ingress 경계 후보

Render 공식 web service 설명에서 TLS 종료 뒤 HTTP 전달·앱 포트의 직접 외부 접근 불가를
확인했다. 기존 site/gateway는 HTTPS origin을 요구하므로 배포에는 명시적 transport adapter가
필요하다. managed-summary-ingress.mjs는 공개 HTTPS origin·site·private_http_behind_tls·
요청별 동기 server-side isTrustedPeer 확인을 요구한다. 누락/false/truthy/Promise는 거부한다.
predicate는 실제 socket/네트워크 격리로 검증해야 하며 이 함수가 TLS/네트워크를 보장하지 않는다.

정확한 Host와 HTTP 입력을 검사한 뒤 origin을 운영 설정에서만 구성한다. 전달 주소/proto/IP/
원래 경로 헤더는 제거하되 Origin/Fetch Metadata/cookie/method/body/signal을 유지해 기존
인증·CSRF·본문·승인 검사를 통과하도록 우회하지 않는다. site의 CSP/Set-Cookie를 유지하고
실패의 키/peer 상세는 반사하지 않는다. 모듈 import로 listener·계정·키·TLS·배포를 실행하지 않는다.

실제 127.0.0.1 임시 서버의 socket peer 확인·정적 CSP/비공개 파일 차단, 합성 canonical
subject로 발급한 opaque 세션과 실제 gateway/site의 401·403·query/body·동의 누락·logout 후
401을 확인했다. provider 호출은 0이다. 새 4 pass/62 assertions, 전체 Bun 237 pass·1
platform skip·2667 assertions·23 파일이며 strict release-verify --require-browser exit 0다.
Windows에서는 POSIX 원장을 필요로 하는 새 통합 1개만 기존 gateway hostTest 규칙으로 skip하며
transport 객체/실제 loopback 서버 3개는 실행한다. 실제 Windows CI 결과는 후속 확인한다.

Render 실제 peer/Host/TLS 설정·직접 HTTP 차단·운영 health/drain·실제 auth/권한·보존/비용·
실모델·사용자 검증은 미완료다. 배포 준비 코드 연결을 전체 출시나 실제 TLS 검증으로 부르지
않으며 현재 Mac 설정·Claude 자격증명·공개 Pocket·스토어·외부 서버는 변경하지 않았다.

6830f61의 Engine 38279241466와 Windows 38279241459는 모두 success다. Ubuntu job
114912179382의 ingress 4개 PASS, Windows job 114912178569의 transport/loopback 3개
PASS 및 POSIX gateway 통합 1개 skip을 로그로 확인했다. browser job·Windows EXE 생성/
실행·artifact 업로드도 통과했고 tag release는 skipped다. 실제 호스팅/TLS/로그인·사용자
수집을 확인한 결과가 아니며 전체 목표는 미완료로 유지한다.

### 9.78 운영 중 readiness 및 종료 대기 controller 후보

managed-summary-lifecycle.mjs는 명시적 HTTPS origin·handler·동기 isReady·bounded active를
받는다. GET /healthz는 boolean ready만 반환하며 query/다른 method·잘못된 origin/Host를
거부한다. 준비/종료 중 일반 요청은 503, active 상한은 429다. health가 요약이나 사용자
gateway를 호출하거나 활성 수/키/원장을 출력하지 않는다. isReady의 실제 의존성 확인은
호스트 책임이며 Promise/truthy/예외를 정상으로 취급하지 않는다.

drain 시작은 되돌리지 않고 새 요청을 차단한다. 기존 buffered handler가 응답을 반환할
때까지 기다리며 default 30초·최대 120초 deadline 뒤에는 drained false다. timeout이
취소/환불/dispose/원장 복구를 실행하지 않으며 실제 작업은 이어서 완료될 수 있다. 별도
호스트가 signal/listener/stop·실제 provider 최대 시간·강제 종료의 불명 결과를 관리해야 한다.
streaming Response body의 완료까지 기다리는 기능은 아니며 현재 buffered site 계약만 검증했다.

새 7 pass/90 assertions에서 health metadata 부재·부하 상태와 readiness 분리·동시 drain·
deadline 후 계속 요청 거부·오류 후 capacity 회수, 실제 loopback ingress/site 연결을 확인했다.
실제 합성 gateway 생성은 fake provider가 기다리는 동안 drain deadline을 넘기고 중복 503·
abort 없음·기존 응답 완료·사용자 시도 used 1/remaining 1 보존을 확인했다. 실제 API 비용이나
대화/계정 사용은 없다. POSIX 원장 통합 1개는 Windows에서 skip하며 나머지 6개는 실행한다.

전체 Bun 244 pass·1 platform skip·2757 assertions·24 파일, strict release-verify
--require-browser exit 0다. source/기획서의 후보 경계를 업데이트했다. 실제 SIGTERM·운영
종료/재시작·TLS·auth/권한·호스팅/비용 승인·Claude 수집·스토어·인터뷰는 계속 미완료다.

### 9.79 Windows 예측 알림 회귀의 batch deadline 분리

27aedfa의 Engine 38280175637는 success지만 Windows 38280175523은 기존 예측 알림
테스트에서 5034.88ms로 default 5000ms deadline을 넘겼다. 새 lifecycle 일반 6개는
Windows에서도 PASS였고 POSIX 원장 통합 1개만 예정대로 skip했다. 테스트 로그와 source의
9회 cold engine spawn을 대조했다. 기존 1개 테스트는 로컬 430.72ms로 통과해 Windows
현상 자체의 로컬 재현/제품 오류를 주장하지 않는다.

systematic-debugging으로 assertion 실패가 아닌 deadline 초과임을 확인하고, 기존 history
off/표본 부족 2개·reset missing/invalid/past/before-depletion 4개·HTTP500/401/429 3개의
입력을 독립 test.each로 분리했다. 모든 case는 fresh isolated home와 default deadline을
유지하며 기능 입력/조건을 제거하거나 제품 엔진을 바꾸거나 skip/timeout 상향하지 않았다.
각 case에서 no alert·비밀 prompt 비출력·fixture 호출 1회를 확인하고 실패 관측에서는 기존
cache 그대로 보존도 확인한다. targeted 9 pass/30 assertions다. 8개 증가한 테스트 수는
기능 8개 추가가 아니라 기존 batch의 분리이며 full/Windows 원격 재검증은 후속이다.

분리 후 전체 Bun은 252 pass·1 platform skip·2786 assertions·24 파일이고 strict
release-verify --require-browser exit 0다. 엔진 기능/설치본/설정·실제 대화·API 호출은
변경하지 않았다. 원격 실패를 단순 재실행으로 성공 처리하지 않고 수정 커밋의 CI로 검증한다.

64576a3의 Engine 38280836988·Windows 38280837172는 모두 success다. Windows job
114917446305의 분리한 9개 예측 안전 case PASS(각 120~136ms)를 로그로 확인했고 lifecycle
일반 6개도 실행됐다. POSIX 원장 생성/drain 1개는 기존 플랫폼 제약으로 skip이다. EXE 생성/
실행·artifact 업로드와 browser job도 통과했고 tag release는 skipped다. lifecycle 후보 및
test harness 회귀는 이 범위에서 완료했지만 실제 운영 종료·배포·로그인·수집·스토어·인터뷰를
완료 처리하지 않는다.

### 9.80 명시적 host runtime과 bounded stop 연결 후보

managed-summary-host.mjs는 gateway/site/lifecycle/ingress를 연결하는 명시적 factory다.
import 시 listener·signal·키/환경/계정 발견을 실행하지 않는다. default는 127.0.0.1의 임시
포트이고 0.0.0.0은 privateIngressPort true가 있어야 한다. 그 플래그가 실제 TLS/방화벽을
설정하거나 승인하는 것은 아니다. host/isReady/verifyPeer/소유자 cleanup이 필요하며 테스트는
loopback만 실행했다. verifyPeer에는 server.requestIP의 frozen socket metadata만 전달한다.

stop은 먼저 drain하고 성공 뒤에만 server.stop(false)와 소유자 onStopped를 한 번 실행한다.
drain/close/cleanup 대기는 monotonic 잔여 deadline으로 제한하고 완료 불명/정리 실패는
stopped false다. 강제 취소·refund·예산/키 초기화나 반복 cleanup을 하지 않는다. 늦은 cleanup은
완료 뒤 재확인 가능하지만 throw한 cleanup을 자동 재실행하지 않는다. 실제 SIGTERM/운영
감독자·로그인 callback·real TLS/volume/auth/비용/보존 계약은 미완료다.

새 5 pass/51 assertions에서 실제 로컬 서버의 UI/health·미인증·private file/임의 login/test
발급 route 부재·위조 Host/forwarded IP 차단·pending 작업 보존·deadline 이후 새 요청 503·
동시/반복 stop의 단일 cleanup·느린/실패 cleanup을 검증했다. 느린 cleanup은 시작 event를
기다리며 처리 시작 시점을 시간 경과로 가정하지 않는다. fake gateway만 사용했고 실제
사용자/대화·키·제공자 API나 공개 bind는 없다. 전체 Bun 257 pass·1 platform skip·2837
assertions·25 파일 및 최종 strict release-verify --require-browser exit 0를 확인했다.
원격 CI는 수정 커밋으로 후속 확인하며 기존 Mac/Pocket/스토어·전체 목표 완료가 아니다.

90c24e3의 Engine 38282418772·Windows 38282418779는 모두 success다. Windows job
114922629878의 runtime 5개 PASS를 로그로 확인했고 EXE 생성·실행·artifact 업로드도
통과했다. Engine은 macOS/Ubuntu·browser job까지 success다. tag release는 skipped이며
실제 host/auth/키 등록·운영 배포·종료 신호·실사용 테스트 완료로 확대하지 않는다.

### 9.81 명시적 종료 신호 및 소유한 자식 프로세스 검증

managed-summary-signals.mjs는 명시적 attach 때 SIGINT/SIGTERM을 host.stop에 연결한다.
import/global 기본 등록·exit/kill/exitCode 변경·provider 재시도·원장 초기화·기본 로그는 없다.
pending 신호를 합치고 stop 오류/deadline 불명은 false, 이후 명시적 신호로 재확인한다.
관찰 값은 frozen signal/stopped뿐이며 설치 rollback/dispose는 소유한 listener만 제거한다.
기존 handler를 삭제하거나 detach로 이미 진행한 stop을 취소하지 않는다.

신규 5 pass/32 assertions 중 3개는 EventEmitter wiring·오류·중복/rollback/observer 경계다.
POSIX 2개는 이 테스트가 생성한 loopback/fake gateway child에 실제 SIGTERM을 보낸다.
idle은 cleanup 1회 뒤 exit 0, hold는 deadline false·process 생존·health 503·기존 synthetic
응답 완료 뒤 추가 명시적 SIGTERM으로 cleanup 1회/exit 0을 확인했다. fixture는 직접 실행
때만 시작하며 production route가 아니다. 기존 사용자/SwiftBar/Claude process에는 신호가 없다.

최초 두 child case는 ready timeout이었다. systematic-debugging으로 URL.pathname의 percent-
encoded 한글 경로가 실제 파일이 아니고 module-not-found exit 1임을 확인했다. 기존 코드의
fileURLToPath 패턴으로 바로잡아 child가 실제 실행된 뒤 신호 경계를 검증했다. 대기 시간을
늘리거나 종료 logic을 바꾸어 실패를 숨기지 않았다. 최종 strict release-verify
--require-browser exit 0다. 공식 process 문서의 Windows 신호 제약에 따라 실제 SIGTERM
2개는 Windows에서 skip하고 wiring 3개만 실행한다. 실제 호스팅 supervisor/grace period·
production auth/키/TLS/volume·실모델·Claude 수집·모바일/스토어·인터뷰는 미완료다.

7c46894의 Engine 38283843407·Windows 38283843432는 모두 success다. Ubuntu job
114927345328의 wiring 3개 및 실제 owned child 2개 PASS, Windows job 114927345416의
wiring 3개 PASS/actual SIGTERM 2개 skip을 로그로 확인했다. Ubuntu는 262 pass·1 skip·
2728 assertions·26 파일이다(플랫폼별 assertion 수가 다름). browser job과 Windows EXE
생성·실행·artifact 업로드도 통과했고 tag release는 skipped다. 실제 호스팅/사용자 프로세스
종료나 실제 대화/로그인·배포를 수행한 것으로 기록하지 않는다.

### 9.82 로컬 요약 연결 검증과 첫 화면 복구 동선

HTTP 200의 빈 session 응답이 복구 안내를 숨기고 연결됨·undefined를 표시하는 것을
합성 browser red test로 재현했다. 토큰 문자열/64hex·제공자·모델·cloud 예약 예산과
local 명시 tag를 검증한 뒤에만 token을 저장하고 입력/연결 상태를 활성화하도록 고쳤다.
잘못된 응답 9종은 복구 화면 유지·입력/생성 잠금·private marker 비노출을 확인했다.
최초 route lambda의 두 번째 인자에 Playwright Request가 들어가 JSON 직렬화에 실패한
테스트 harness 문제는 응답 body closure로 고쳤으며 제품 실패와 구분한다.

bootstrap/preview의 307 및 잘못된 JSON도 합성 재현했다. bootstrap 307에서 나온
영문 Failed to fetch는 사용자 복구 안내로 바꿨다. 요청마다 redirect:error·명시 timeout을
적용하고 JSON/network 오류 원문은 표시하지 않는다. sink 요청 0회·각 endpoint 1회·
generation 0회로 재전송/자동 재시도 없음을 확인했다. API 응답 불명은 이미 전송한 요청의
실행 여부도 불명으로 알리며 취소/환불/실행 안 됨으로 과장하지 않는다.

frontend-design에 따라 기존 serif/dark teal 디자인을 유지하면서 상태·복구 카드·Pocket
이동을 소개/기능 카드보다 앞으로 옮겼다. 고급 개발 안내는 details로 접어 일반 사용자
행동과 구분했다. 직접 file:// 화면의 375×812 및 1280×900에서 버튼 첫 화면 노출·
44px 이상 타깃·가로 넘침 없음·자동 HTTP/API 요청 0회를 확인했고 모바일 스크린샷을
시각 검수했다. 사용자 브라우저의 정책상 차단된 탭을 우회해 연 것이 아니라 저장소의
격리 headless 합성 테스트이며 실제 메뉴바/사용자 테스트를 대체하지 않는다.

최종 strict release-verify --require-browser exit 0: 262 pass·1 skip·2869 assertions,
기존 browser 흐름 및 신규 회귀 통과·설치 engine/helper 소스 일치다. 실제 대화/유료 API·
모델 다운로드·자격증명/설정 갱신·운영 배포는 하지 않았다. 기획서 P1-04/P1-05 전체는
미완료다. Claude 인증 fresh 관측/실기기, 실서비스 로그인/hosting, 실제 요약 품질,
신규 설치·경쟁 화면 비교·스토어·인터뷰는 별도 남은 gate다.

bb6caf9의 Engine 38285622639·Windows 38285622644는 모두 success다. browser job
114933168643에서 직접 파일·malformed bootstrap·redirect/invalid JSON 신규 PASS를
로그로 확인했다. Windows는 EXE 생성·실행·artifact 업로드까지 success이고 tag release는
skipped다. 공개 Pocket 배포나 새 desktop release 발행이 아니다.

2026-10-13 02:40 KST installed --diagnostics는 existing observations만 읽었다.
Claude는 http 429/rate-limit·trust blocked·마지막 성공 5h 전·retry 18m로, 이전 401 기록과
다르게 현재 요청 제한이며 복구/최신 quota가 아니다. autoRenew=false는 그대로다.
Codex는 fresh/live 로컬 JSONL 관측이다. 직접 API·renewal·설정 변경·사용자 프로세스 종료는
없었다. 네이티브 메뉴바 화면 확인과 제한 해제 후 실제 최신 수집은 여전히 남았다.

### 9.83 Pocket 앱 내 검토형 제보 초안

C04/P3-04의 앱 내 제보 준비 동선을 구현했다. 하단 피드백 버튼은 외부 접속 대신 접힌
제보 상세를 열고 유형에 focus한다. 유형/재현 설명(최대 2,000자)/opt-in 상태 요약에서
공유 JSON을 만들어 검토 뒤 복사·저장·고정 GitHub feedback.yml 링크를 제공한다.
입력 변경은 초안/검토/공유 가능 상태를 해제하고 reset/reload는 메모리 초안을 비운다.
복사 실패는 원문 예외 없이 미확인으로 안내하며 복사/저장을 접수라고 말하지 않는다.

진단은 고정 source/age/provider/state와 bounded 목록만 투영한다. 계정명·프로젝트·quota·
reset/시각·원문·기기 ID는 제외한다. demo·가져온 snapshot·실시간 진단을 구분한다.
설명은 기존 safeExcerpt를 재사용하되 완전한 비밀값 탐지나 원문 보존을 보증하지 않고
직접 검토를 요구한다. GitHub URL에는 초안/본문/스냅샷이 없으며 사용자 직접 붙여넣기와
공개 제출이 필요하다. 실제 사용자·공개 issue·API 호출을 만들지 않았다.

frontend-design에 따라 기존 dark teal/editorial 디자인과 DETAIL 점진 공개를 유지했다.
모바일 상세 스크린샷을 시각 검수했고 375/1280px 가로 넘침 없음·44px 타깃을 확인했다.
신규 Bun 3 pass/17 assertions 및 합성 browser에서 opt-in/whitelist/실제 파일 import·
demo/검토 해제/다운로드 내용·복사 실패/고정 링크/자동 제출 및 초안 저장 0회를 확인했다.
GitHub 이동은 intercept한 합성 popup으로만 검증하여 실제 제보 제출 증거로 쓰지 않는다.

테스트 구현의 clipboard mock assignment가 evaluate에서 함수로 실행되던 문제와 잘못된
demo ID를 기존 working selector/closure 패턴으로 수정했다. 기존 개인정보 부분일치
selector는 새 안내와 3개 매치가 되어 실패했으므로 정확한 link role로 지정했다. 제품의
개인정보 문구를 지우거나 대기/skip을 늘려 통과시킨 것이 아니다. 최종 strict release-verify
--require-browser exit 0: 265 pass·1 skip·2886 assertions, 기존 browser 회귀 및 설치본
engine/helper 일치다. Pages/Engine CI에 신규 browser 검증과 precache feedback.js를
연결하고 cache를 v27로 올렸다. 강제 새로고침은 하지 않으며 기존 미저장 편집을 보존한다.

실제 접수→응답→수정→배포 1건·신규 사용자/인터뷰·Claude 실수집·native/스토어·운영형
로그인/요약은 미완료이며 P3-04 전체를 완료 처리하지 않는다.
