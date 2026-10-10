# TokenJuice 검증 키트

확인일: 2026-10-10

이 문서는 코드가 아닌 실제 사용자·실기기 검증을 실행하기 위한 빈 프로토콜이다.
아래 표의 결과·통과율·참여자 수는 실제 세션 전에는 기입하지 않는다. 누구에게도
연락하거나 초대하지 않았으며, 사용자가 참가자와 장비를 제공하기 전까지 해당 항목은
미완료다.

## 0. 공통 개인정보 원칙

- 데모는 저장소의 synthetic snapshot만 사용한다. 실제 Claude/Codex 계정, 로그, 프롬프트,
  코드, 토큰, 이메일, branch명, 프로젝트명, 화면 캡처를 받지 않는다.
- 참여자 ID는 `P01`~`P05` 또는 `I01`~`I10` 같은 pseudonymous ID만 사용한다. 실명·연락처·회사명은
  기록하지 않는다.
- 세션 기록은 이 문서의 최소 필드만 로컬 CSV/Markdown에 기록한다. 원격 분석·클라우드 업로드·녹화는
  기본 사용하지 않는다.
- 참여자는 언제든 중단·철회할 수 있다. 철회 시 해당 ID의 로컬 기록과 임시 데모 파일을 즉시 삭제한다.
- 검증 종료 후 7일 이내에 raw notes와 결과표를 삭제하고, 집계된 pass/fail만 기획서에 남긴다.
- 실제 사용자가 자신의 데이터를 보여주려는 경우에도 거절하고 synthetic demo로 전환한다.

## 1. UX6·UX10 5명 사용성 세션

### 목적과 준비물

- 목적: 신규 사용자가 Pocket/guide에서 위험 상태, 근거, 다음 행동, 설치 경로를 스스로 찾는지 확인한다.
- 대상: 실제 참가자 5명. 개발자·연구자 여부는 분석 필드로 저장하지 않는다.
- 시간: 1명당 20분(소개 2분, 과제 12분, 회고 4분, 철회/삭제 안내 2분).
- 준비: 최신 GitHub Pages Pocket URL(현재 public PWA source `4d326d3`가 배포된 URL), synthetic demo 화면, 빈 기록표, 타이머. `v1.2.2`는 immutable desktop release asset이므로 PWA source와 같은 버전이라고 가정하지 않는다. metadata-only 재개 안내는 작업 내용 복원 기능이 아니다.
- 금지: 실제 설치·로그인·계정 연결·화면 녹화·스크린샷·브라우저 파일 업로드.

### Facilitator script

1. “이 테스트는 제품이 아니라 화면을 평가합니다. 막히거나 틀려도 참가자 책임이 아닙니다.”
2. “실제 계정이나 작업 자료를 보여주지 마세요. 지금 제공하는 예시 화면만 사용합니다.”
3. 동의 초안을 읽고 명시적 동의를 받는다. 거절하면 ID나 응답을 만들지 않고 종료한다. 동의 후에만 P01~P05를 배정한다.
4. 참가자에게 synthetic 화면을 보여주되 facilitator는 마우스·키보드·힌트를 조작하지 않는다. 화면 공유가 불편하면 facilitator 기기에서 직접 보게 한다.
5. 과제 중에는 “무엇을 누를까요?”에 답하지 말고 “지금 무엇을 이해했나요?”만 되묻는다.
6. 과제 후 pass/fail·시간·사전 정의된 오류 코드만 기록한다. 발화 원문·자유서술 notes는 남기지 않는다.
7. 종료 시 “어떤 정보가 가장 불안했나요?”와 “어떤 문구가 다음 행동을 결정하는 데 도움이 됐나요?”를 묻되, 답은 미리 정한 범주로만 집계한다.
8. 철회·삭제를 다시 안내한다. 철회 시 해당 ID의 기록과 임시 데모 파일을 즉시 삭제한다.

### Scenario / task cards

| ID | 참가자에게 읽어줄 과제 | 10초/30초 관찰 기준 |
|---|---|---|
| S1 | “지금 가장 먼저 조치해야 할 상태를 찾아 말해 주세요.” | 10초 안에 위험 상태를 찾음 |
| S2 | “그 숫자를 왜 믿어도 되는지, 마지막 성공 시각과 출처를 찾아 말해 주세요.” | 30초 안에 source·freshness를 설명 |
| S3 | “작업을 안전하게 이어가기 위해 다음에 할 행동을 선택해 주세요.” | checkpoint/resume 등 단일 CTA를 선택하고 임의 provider 전환을 하지 않음 |
| S4 | “처음 설치한다면 어디서 설치 방법과 개인정보 원칙을 확인하나요?” | guide의 설치·개인정보 경로를 30초 안에 찾음 |
| S5 | “화면 글자가 커진 환경에서도 핵심 CTA를 사용할 수 있는지 확인해 주세요.” | 200% text zoom에서 가로 스크롤 없이 CTA를 찾음 |

### 기록표 (빈 양식)

| participant ID | S1 sec / pass | S2 sec / pass | S3 sec / pass | S4 sec / pass | S5 sec / pass | error code | recovery sec |
|---|---:|---|---:|---|---:|---|---:|
| P01 |  |  |  |  |  |  |  |
| P02 |  |  |  |  |  |  |  |
| P03 |  |  |  |  |  |  |  |
| P04 |  |  |  |  |  |  |  |
| P05 |  |  |  |  |  |  |  |

오류 코드는 `none`, `wrong_state`, `missed_source`, `missed_action`,
`needed_hint` 중 하나만 기록한다. 이 범주에 맞지 않는 경우 자유 텍스트를 만들지 말고
검증 책임자가 결과표를 집계할 때 `unclassified` 건수로만 별도 합산한다.

출시 게이트는 사전에 고정한다: 핵심 과제 S1~S4 중 4명 이상이 facilitator 도움 없이 성공하면
`4/5 gate = pass`로 계산한다. 실제 결과가 없을 때는 `pending`이다.
S5는 접근성 관찰용으로 별도 보고하며 4/5 판정 분모에 넣지 않는다. 미완료 과제는
`fail`과 관찰 종료 시각으로 기록한다.

## 2. P0 10명 인터뷰 + 2주 diary

### 목적

quota/context/auth 중단이 실제로 반복되는지, alert가 행동으로 이어지는지 확인한다. 이 조사는
제품 가설 검증용이며 실제 계정 사용량을 수집하지 않는다.

### 10분 interview script

동의 초안을 먼저 읽고 명시적 동의를 받는다. 동의 전에는 ID·응답·날짜를 기록하지 않는다.
거절·철회는 결측값이나 실패로 집계하지 않는다. I01~I10은 동의 후 배정한다.

1. 최근 AI coding 작업이 멈춘 순간이 있었나요? 있었다/없었다만 표시한다.
2. 그때 원인은 한도·컨텍스트·인증·에이전트 대기 중 어느 범주였나요?
3. 당시 다음 행동을 결정하는 데 얼마나 걸렸나요? `즉시 / 1~5분 / 5분 초과 / 모름` 중 하나만 선택한다.
4. 현재 synthetic NOW/WHY/NEXT 화면에서 가장 먼저 볼 블록은 무엇인가요?
5. 알림이 왔을 때 어떤 행동이면 유용한가요? `기다림 / checkpoint / 재연결 / 확인 안 함` 중 하나만 선택한다.

### 최소 diary 필드

하루 1회 또는 사건 발생 시 1행만 기록한다. 빈 값도 허용한다.

| field | allowed value |
|---|---|
| participant_id | `I01`~`I10` |
| day | `D1`~`D14` |
| event | `alert`, `manual_check`, `work_interrupted`, `returned` |
| state_class | `quota`, `context`, `auth`, `waiting`, `none` |
| action | `checkpoint`, `reconnect`, `wait`, `resume`, `none` |
| false_alert | `yes`, `no`, `unknown` |
| return_within_24h | `yes`, `no`, `unknown` |
| minutes_to_action | integer bucket `0`, `1-5`, `6+`, `unknown` |

기록하지 않는 것: alert 본문, 프롬프트·코드·토큰·계정 식별자, provider 계정명, 파일 경로,
스크린샷, 원문 인터뷰 노트.

### 동의·철회 초안(아직 전송하지 않음)

> 이 검증은 TokenJuice의 synthetic 화면과 최소 행동 기록만 사용합니다. UX 화면 확인은 약 20분,
> 인터뷰는 약 10분이며, diary 참여는 별도 동의한 경우에만 14일 동안 하루 1회 또는 사건 때
> 선택적으로 기록합니다. 실제 계정, 프롬프트, 코드, 토큰, 이메일, 스크린샷, 녹화는 요청하지
> 않습니다. 참여는 선택이며 언제든 이유 없이 중단·철회할 수 있습니다. 기록은 pseudonymous ID로
> 로컬에만 저장하고 검증 종료 후 7일 이내 삭제합니다. 참여를 거절하거나 철회해도 불이익은 없습니다.

동의 기록은 `participant_id`, `consent=yes/no`, `consented_at`, `withdrawn_at`만 남긴다.
동의하지 않은 ID의 세션·diary 행은 생성하지 않는다.

인터뷰에서 최근 30일 중단 경험은 `yes/no`만 aggregate count로 기록하고, 미참여·무응답과
`no`를 구분한다. D0 synthetic 비교는 참가자 ID 기준 홀짝으로 순서를 정한다
(홀수 baseline-first, 짝수 card-first); 순서 외 개인 식별 정보는 기록하지 않는다.

### 실행 순서와 사전 판정 규칙

1. 동의한 참가자만 I01~I10에 배정해 10분 인터뷰를 한다. 실제 계정·알림·사용량 화면은 열지 않는다.
2. 동의자는 synthetic 시나리오에서 기존 방식으로 다음 행동을 고르고 판단 시간을 기록한 뒤, NOW/WHY/NEXT 화면에서 같은 유형의 과제를 수행한다. baseline/card 순서는 참가자마다 번갈아 배치한다. 시간·행동 범주만 남긴다.
3. D1~D14에는 하루 1회 또는 사건 발생 때 최소 필드 한 행만 기록한다. 무사건 날은 빈 행을 만들지 않는다. 철회 후 미기록 일자는 실패로 보지 않는다.
4. 아래 분모를 고정한다. 분모가 0인 지표는 0%가 아니라 `pending`이다.

| metric | numerator / denominator | 판정 기준 |
|---|---|---|
| 최근 30일 중단 경험 | 실제 quota/auth/context 중단을 보고한 동의 참가자 / 인터뷰 완료자 | 10명 중 3명 미만이면 §16.4의 pain 반증 조건 |
| 판단 시간 변화 | 동일 참가자의 synthetic baseline 초와 NOW/WHY/NEXT 초 | 참가자별 차이와 중앙값을 함께 보고; 10명 미만이면 탐색 결과 |
| alert→action within 5 min | 알림 후 5분 안에 행동한 사건 / actionable alert 사건 | 분모 0은 pending; 행동률 20% 미만이면 §16.4 반증 조건 |
| return within 24h | 24시간 안에 복귀한 중단 사건 / 관찰 가능한 중단 사건 | 분모 0은 pending |
| false alert rate | false_alert=yes 알림 / yes 또는 no로 분류한 알림 | unknown은 분모에서 제외하고 별도 개수 보고 |
| checkpoint/resume action | checkpoint 또는 resume를 택한 사건 / 행동 여부가 기록된 actionable alert | 분모 0은 pending |
| 주간 재방문 | 주 1회 이상 manual_check/returned가 있는 참여자-주 / 완전 관찰된 참여자-주 | §16.4의 주간 2회 미만 기준과 대조; 결측 주 제외 |

§16.4의 반증 조건 중 두 개 이상이 실제 관찰되면 mobile widget·provider 추가·결제를 보류하고
재포지셔닝을 의사결정자에게 상정한다. 이는 자동 출시 승인 기준이 아니다. 인터뷰 10명 미만,
14일 미완료, 또는 분모 0은 성공이나 반증으로 간주하지 않고 pending으로 둔다.

### diary 결과표 (빈 양식)

| metric | observed | denominator | result | decision |
|---|---:|---:|---:|---|
| alert→action within 5 min |  |  |  | pending |
| return within 24h |  |  |  | pending |
| false alert rate |  |  |  | pending |
| checkpoint/resume action |  |  |  | pending |

## 3. macOS/Windows notification presentation checklist

### 2026-10-10 현행 행동 필요 항목

최신 source 4423ab1의 helper 손상 상태 복구/독립 설치 비교가 CI success다.
83 tests/1146 assertions·browser/bundle/격리 알림은 pass, plugin 본문도 일치하지만
installed wake helper는 이전 버전이다. `bash scripts/check-installed-sources.sh`는
실행/설정 변경 없이 이를 exit 1로 알린다. helper 한 파일의 백업·좁은 교체 승인 후
다시 비교해야 하며 full installer/LaunchAgent 변경·앱 restart/refresh는 필요하지 않다.

실제 메뉴바 도구는 SwiftBar를 노출하지 않는다. 실행 중 Finder의 AX에도 status-item이
없고 screenshot은 빈 흰 화면이라 제품 미표시나 OS 권한 문제로 단정할 수 없다.
사용자는 현재 Mac에서 ① TokenJuice icon/클릭 패널 유무 ② 평소 절전 후 같은 표시의
복귀 여부를 pass/fail로 관찰해 제공한다. 테스트를 위해 강제 절전하지 않으며 계정 수치/
로그/스크린샷은 수집하지 않는다. 이는 코드 테스트와 분리된 사용자 행동 필요 gate다.

### 74157c2 설치 체크포인트 (과거 후보)

최신 엔진 후보 74157c2는 승인된 플러그인 한 파일 반영 뒤 source/install cmp와
release-verify 전체 exit 0(80 tests/1043 assertions)을 통과했다. 절전 helper도 소스와
SHA-256 f54794aad83a3f8b89f0bea4435eae1cc38bc8e936c8adba67d3615c24cbe6f4가 같다.
CUA read-only inventory는 여전히 SwiftBar를 노출하지 않으며 실제 메뉴바/절전 복귀는
pending이다. 프로세스/파일 일치를 UI pass로 기록하지 않는다. 이 기기에는 full installer를
다시 실행하거나 앱 restart/refresh·권한/LaunchAgent 변경을 하지 않는다.

### 공통 사전조건

- immutable desktop baseline: `v1.2.2` / `12efce26b5eb6dafcb6aaf64f92ef7804ef1b487`
- current public PWA source: `4d326d3` (Pages workflow `37955457796` 성공, resume 상세·sw v11 HTTP 확인). 이는 desktop release asset이 아니다. 이후 engine-only 수정은 Pages 재배포 대상이 아니다.
- desktop presentation은 **한 번에 하나의 기준만** 검증한다. 기존 `v1.2.2` 설치본을 관찰할 때는 tag 기준을, 사용자 승인 후 최신 소스를 설치했을 때는 현재 checkout 기준을 사용한다. 두 기준을 섞어 pass로 기록하지 않는다.
- 실제 계정 대신 엔진 fixture 또는 synthetic config를 사용한다.
- 기기 소유자가 현재 권한·집중 모드 상태를 직접 확인한다. 이 절차에서 설정을 열거나 바꾸지 않는다. 상태 확인을 원하지 않거나 권한이 꺼져 있으면 presentation은 pending이다.
- 알림 payload의 내용은 이미 자동 fixture로 검증됐으므로, 여기서는 표시 여부·위치·중복·클릭 후
  앱 복귀만 본다.
- macOS 엔진은 `osascript display notification` 경로를 사용한다. 현재 Windows tray 소스
  `windows/tokenjuice_tray.py`에는 native toast/notification 송신 구현이 없다. Windows toast는
  앱 identity/AUMID·Start Menu shortcut 또는 WinRT 의존성 선택 전까지 implementation-boundary
  blocker이며, tray icon·tooltip·menu만 별도 검증할 수 있다.

### macOS

- [ ] 선택한 desktop 기준과 SwiftBar 설치본이 일치. 기존 baseline이면 `v1.2.2` tag와 비교하고, 최신 source 후보면 현재 checkout에서 `./install.sh --doctor`가 source match를 보고한 뒤에만 기록
- [ ] Notification permission 허용 상태에서 threshold alert가 Notification Center에 표시
- [ ] reconnect alert가 계정명·이유·다음 행동·retry 시각을 표시
- [ ] 동일 상태 새로고침에서 duplicate toast가 발생하지 않음
- [ ] reset/recovery 후 다음 상태 변화가 정상 표시
- [ ] notch 내장 디스플레이에서 menu-bar icon과 compact text clipping 없음
- [ ] 방해금지/권한 거부 시 메뉴의 상태·next action은 유지되고 crash하지 않음

### Windows

- [ ] 기존 실기기 실행본에서 tray icon·tooltip·menu의 상태와 다음 행동을 확인
- [ ] Windows toast/notification은 identity/설치 경계 결정 전까지 `blocked: implementation boundary`로 기록. 미구현을 기기 pass로 바꾸지 않음

### 수동 결과표 (빈 양식)

| device / OS version | app/release | scenario | presentation | duplicate | permission-off fallback | pass/fail | defect ID |
|---|---|---|---|---|---|---|---|
|  |  | threshold |  |  |  | pending |  |
|  |  | reconnect |  |  |  | pending |  |
|  |  | reset |  |  |  | pending |  |
|  |  | notch/compact |  |  | n/a | pending |  |

### 실행 순서

1. **Mac:** 먼저 선택한 후보와 설치 본문이 일치하는지 읽기 전용 비교로 확인한다. 위 현재 기기는 플러그인 갱신을 이미 마쳤으며 full installer를 다시 실행하지 않는다. 다른 신규 기기의 설치·갱신은 그 기기 소유자의 명시적 승인 후 해당 checkout에서만 진행한다. 기존 release와 최신 source 후보를 섞지 않는다. 앱/UI가 없으면 notch는 `pending: app/UI unavailable`이며 실제 sleep/wake 결과도 pending이다. UI 접근을 위해 앱을 강제 restart/refresh하거나 권한을 변경하지 않는다.
2. Notification contract smoke는 macOS에서 `scripts/notification-smoke.sh`를 실행한다. 기본 모드는 분리된 임시 HOME/config, provider credential 부재, `CCB_TEST_USAGE_FIXTURE`, `CCB_TEST_NOTIFY_LOG`를 사용해 threshold → reset → reconnect를 각각 한 번씩 캡처하며 `osascript`를 호출하지 않는다. Linux/Windows에서는 명확히 skip한다. OS presentation은 이 harness의 통과와 별개로 pending이다. 실제 알림을 보려면 `--allow-os-notification`과 `TOKENJUICE_CONFIRM_OS_NOTIFICATION=I_UNDERSTAND_TOKENJUICE_WILL_NOTIFY`를 모두 명시해야 하며, 기기 소유자가 권한·집중 모드를 확인한 뒤 별도 실행해야 한다. 기본 프로필·credential·Keychain을 사용하지 않는다.
3. **Windows:** 현재 toast 송신 기능이 없으므로 toast 테스트와 권한 조작은 하지 않는다. 기존 실행본이 있는 기기에서 tray icon·tooltip·menu만 관찰한다.
4. 두 OS 모두 화면 캡처·알림 본문·계정 데이터를 수집하지 않는다. 실패는 defect ID와 OS major만 남긴다.

증거는 private data 없는 `pass/fail`, OS major version, release tag, defect ID만 남긴다. 알림
스크린샷·계정명·파일 경로는 수집하지 않는다.

## 4. 현재 판정과 실행 책임

| 항목 | 현재 상태 | 필요한 주체 | 준비된 다음 실행 |
|---|---|---|---|
| UX6 5명 세션 | pending | 제품 담당자 + 참가자 5명 | §1 script와 P01~P05 표를 사용해 20분씩 진행 |
| P0 10명 interview/diary | pending | 제품 담당자 + 동의한 참가자 10명 | §2 consent 후 I01~I10, D1~D14 기록 |
| macOS notification/notch | harness 자동 검증 완료 / 실기기 presentation pending | TokenJuice 담당자 + macOS 실기기 보유자 | `scripts/notification-smoke.sh` dry-run; 실제 Notification Center·notch는 §3에서 명시적으로 실행할 때만 관찰 |
| Windows tray UI | pending | Windows 실기기 보유자 | §3: 기존 release exe의 tray icon·tooltip·menu만 관찰 |
| Windows toast | blocked: implementation boundary | 제품·설치 경계 승인 + TokenJuice 구현 담당자 | event contract/격리 fixture를 먼저 설계하고, 승인된 sender 구현 후에만 OS 검증 |

이 문서는 프로토콜 준비 완료를 뜻할 뿐, 실제 검증 통과를 뜻하지 않는다.
