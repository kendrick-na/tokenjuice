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

현재 공개 Pocket은 §9.9의 `4d326d3`/sw v11, desktop 자산은 immutable `v1.2.2`다.
최신 로컬 엔진 후보에는 §9.10의 Claude utilization 검사를 추가했다. 아래 과거 커밋/테스트
수치는 각 단계의 기록이며 현재 설치본·PWA 소스와 같은 것으로 해석하지 않는다.

## 1. 단계별 완료 기준 감사

| 단계/기준 | 코드·자동 증거 | 실제 gate / 판정 |
|---|---|---|
| v1.1 신뢰성·진단·알림 | `claude-codex-battery.5s.js`, 로컬 `tests/engine.test.js` 66 pass/557 expect, `scripts/release-verify.sh`, macOS notification dry-run | threshold/잔여량 회복·opt-in 리셋 임박 및 Claude/Codex local pace 예측 알림 구현. Claude API/local utilization과 Codex used_percent의 malformed 사용률은 unavailable. 실계정·OS presentation은 별도; release-verify의 마지막 설치본 일치 단계는 실패 상태 |
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
| R6 | threshold/reset/forecast/reconnect 알림 | `runNotifications()`, target/account overrides, threshold/reset/reconnect·reset-soon·forecast tests | 지원 범위 구현: threshold·잔여량 회복·reconnect·별도 opt-in reset-soon/Claude 및 Codex local forecast 발화. Codex는 별도 수집/알림 동의와 유효 미래 reset 필요. macOS presentation pending; Windows sender 미구현 |
| R7 | official quota와 local context/cost 분리 | `kind` contract, session/context/cost tests, Pocket cards | 코드·자동 검증 완료 |
| R8 | secret-free copyable diagnostics | `--diagnostics`, `--copy-diagnostics`, diagnostics privacy test | 자동 검증 완료; 실제 support workflow는 pending |
| R9 | first-run onboarding/permission/keychain choice | `--init-config`, `guide.html`, starter config test | artifact·자동 검증 완료; 신규 사용자 comprehension pending |
| R10 | multi-account aliases/status | `loadAccounts()`, `loadCodexProfiles()`, selected legacy/additive JSON, macOS/Windows menu, 5 profile tests, Windows `37950833358` | Claude 및 수동 Codex root/alias/ID/표시 선택·계정별 상태/알림/history 계약 구현. Windows 메뉴 selftest/exe CI 통과. 실제 인증 계정 자동 식별·로그인 전환은 하지 않음. 실제 Team/personal mapping/사용성은 별도 검증 |
| R11 | Windows/macOS meaning/alarm parity | shared JS engine, Windows build `37885325588`, Engine CI `37885325573` | tray/build/contract 완료; macOS·Windows tray 실제 presentation pending. Windows native toast는 앱 identity/shortcut 또는 새 WinRT 의존성이 필요해 현재 범위에서 blocked |
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
| UX9 | detailed menu/tray panel and compact/notch safety | menu output, compact test, Windows CI; release-verify의 설치본 비교는 불일치 | code/build pass; 설치본 갱신·physical notch·OS visual pending |
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
