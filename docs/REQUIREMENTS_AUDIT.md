# TokenJuice 요구사항·증거 최종 감사

확인일: 2026-10-09

이 문서는 개발기획서의 요구사항을 현재 저장소의 코드·테스트·CI·release·실제
검증 gate로 분리해 매핑한다. `자동 통과`는 fixture/browser/CI 범위의 통과일 뿐이며,
실사용자·실기기·정책 결정을 대신하지 않는다.

기준 release는 `v1.2.2` (`12efce26b5eb6dafcb6aaf64f92ef7804ef1b487`)다.
최신 문서-only HEAD는 이 audit 문서가 반영된 `main`의 후속 문서 커밋이며, release asset은
tag commit에서 고정되어 있다.

## 1. 단계별 완료 기준 감사

| 단계/기준 | 코드·자동 증거 | 실제 gate / 판정 |
|---|---|---|
| v1.1 신뢰성·진단·알림 | `claude-codex-battery.5s.js`, `tests/engine.test.js` 38 pass/190 expect, `scripts/release-verify.sh`, Engine CI `37812922211` | 실계정·OS notification presentation은 별도. 코드/자동 검증 완료 |
| v1.1.1 상품 표면·복구 UX | `companion/index.html`, `companion/app.js`, `tests/companion.test.py`, guide/Pocket browser test | 375px·desktop·a11y 기계 기준 완료, 스크린리더·5명 사용성 pending |
| v1.2 온보딩·계정·Windows | `guide.html`, `accounts.json` loader, Windows tray, Windows CI `37812922103`, release workflow | 신규 사용자 설치와 실제 Windows/macOS UI presentation pending |
| v2.0 확장 플랫폼·provider | Copilot/local quota adapter, metadata-only snapshot, encrypted manual bundle tests | 자동 CloudKit, team, additional OAuth/browser connector, widget/Watch selection pending |

## 2. R1–R20 요구사항 매핑

| ID | 요구사항 | 현재 evidence | 정확한 판정 |
|---|---|---|---|
| R1 | `fresh/stale/unavailable/rate_limited/auth_expired/fallback` 상태 모델 | `usageState()`, `usageStateForHttp()`, `stateLabel()`, engine state tests | 코드·fixture 완료; 실제 provider 형식 변화는 ongoing risk |
| R2 | last success/source/retry 시각 | `buildDiagnostics()`, menu recovery rows, developer mode; stale/429/401 tests | 코드·자동 검증 완료; 실제 계정 메시지 이해는 pending |
| R3 | 인증 만료를 명시 상태·사용자 실행 안내로 전환 | `stateDisplayLabel()`, `stateRecoveryHint()`, `--renew-login`; 401 tests | 코드 완료; 실제 재로그인·Keychain click은 사용자/장비 gate |
| R4 | 429 Retry-After·backoff | `fetchClaudeUsage()`, 429 tests | 자동 검증 완료 |
| R5 | wake refresh single debounce | `scripts/ensure-swiftbar-visible.sh`, wake helper test | 코드·fixture 완료; 실제 sleep/wake 장비는 pending |
| R6 | threshold/reset/forecast/reconnect 알림 | `runNotifications()`, target/account overrides, threshold/reset/reconnect tests | payload·idempotency 완료; macOS/Windows presentation pending |
| R7 | official quota와 local context/cost 분리 | `kind` contract, session/context/cost tests, Pocket cards | 코드·자동 검증 완료 |
| R8 | secret-free copyable diagnostics | `--diagnostics`, `--copy-diagnostics`, diagnostics privacy test | 자동 검증 완료; 실제 support workflow는 pending |
| R9 | first-run onboarding/permission/keychain choice | `--init-config`, `guide.html`, starter config test | artifact·자동 검증 완료; 신규 사용자 comprehension pending |
| R10 | multi-account aliases/status | `loadAccounts()`, multi-directory test, menu labels | 코드·fixture 완료; 실제 Team/personal 계정 사용성 pending |
| R11 | Windows/macOS meaning/alarm parity | shared JS engine, Windows build `37812922103`, tagged build `37813141076` | build/contract 완료; 두 OS 실제 presentation pending |
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
| UX8 | per-account/window threshold/reset/reconnect and reason/next time | notification policy/override/reconnect tests; `CCB_TEST_NOTIFY_LOG` | engine contract pass; actual OS notification presentation pending |
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
| macOS notification/notch | v1.2.2 Mac/notch 장비 보유자 | `docs/VALIDATION_KIT.md` §3, fixture/permission checklist |
| Windows notification/tray | v1.2.2 Windows 장비 보유자 | `docs/VALIDATION_KIT.md` §3, release exe + 동봉 engine |
| native widget/Watch | 제품 의사결정자 + PWA usage/waitlist 데이터 | UX11 기준; 구현·결제는 보류 |
| CloudKit/team/webhook/payment | 제품·보안·법무 의사결정자 | 현재 구현하지 않으며 정책 결정 후 별도 설계 |

## 6. 2026-10-09 SwiftBar 실기기 관찰 시도

- 환경: notch 지원 Mac14,5 / macOS 15.6.1.
- CUA 앱 inventory에서 SwiftBar가 노출되지 않았고, `SystemUIServer`는 실행 중이 아닌 것으로 보고됐다.
- `cua.getApp("SwiftBar")`는 server error `-10005` (`timeoutReached`)로 종료됐다.
- 이 시도에서는 설정, 알림 권한·발화, 설치 파일을 변경하지 않았다.
- 따라서 live 메뉴바/notch 렌더링은 여전히 pending이다. compact 출력·CI·설치본 비교의 자동 증거를 물리적 시각 pass로 승격하지 않는다.
- 다음 안전한 절차는 SwiftBar가 실제로 실행 중인 데스크톱 세션에서 `docs/VALIDATION_KIT.md` §3 체크리스트만 수행하는 것이다. 개인정보가 포함된 화면 캡처는 요구하지 않는다.

이 문서는 현 시점 코드 감사와 실행 준비 상태를 기록할 뿐, 목표 완료나 사용자 성공을
선언하지 않는다.
