# TokenJuice 검증 키트

확인일: 2026-10-09

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
- 준비: `v1.2.2` release의 Pocket URL, synthetic demo 화면, 빈 기록표, 타이머.
- 금지: 실제 설치·로그인·계정 연결·화면 녹화·스크린샷·브라우저 파일 업로드.

### Facilitator script

1. “이 테스트는 제품이 아니라 화면을 평가합니다. 막히거나 틀려도 참가자 책임이 아닙니다.”
2. “실제 계정이나 작업 자료를 보여주지 마세요. 지금 제공하는 예시 화면만 사용합니다.”
3. 참가자에게 화면을 공유하되 facilitator는 마우스·키보드·힌트를 조작하지 않는다.
4. 과제 중에는 “무엇을 누를까요?”에 답하지 말고 “지금 무엇을 이해했나요?”만 되묻는다.
5. 각 과제 후 관찰된 행동·시간·오류만 기록한다. 발화 원문은 기록하지 않는다.
6. 종료 시 “어떤 정보가 가장 불안했나요?”와 “어떤 문구가 다음 행동을 결정하는 데 도움이 됐나요?”만 묻는다.
7. 삭제·철회 선택을 다시 안내하고, 참가자 ID만 남긴다.

### Scenario / task cards

| ID | 참가자에게 읽어줄 과제 | 10초/30초 관찰 기준 |
|---|---|---|
| S1 | “지금 가장 먼저 조치해야 할 상태를 찾아 말해 주세요.” | 10초 안에 위험 상태를 찾음 |
| S2 | “그 숫자를 왜 믿어도 되는지, 마지막 성공 시각과 출처를 찾아 말해 주세요.” | 30초 안에 source·freshness를 설명 |
| S3 | “작업을 안전하게 이어가기 위해 다음에 할 행동을 선택해 주세요.” | checkpoint/resume 등 단일 CTA를 선택하고 임의 provider 전환을 하지 않음 |
| S4 | “처음 설치한다면 어디서 설치 방법과 개인정보 원칙을 확인하나요?” | guide의 설치·개인정보 경로를 30초 안에 찾음 |
| S5 | “화면 글자가 커진 환경에서도 핵심 CTA를 사용할 수 있는지 확인해 주세요.” | 200% text zoom에서 가로 스크롤 없이 CTA를 찾음 |

### 기록표 (빈 양식)

| participant ID | S1 sec / pass | S2 sec / pass | S3 sec / pass | S4 sec / pass | S5 sec / pass | first error | recovery sec | notes |
|---|---:|---|---:|---|---:|---|---:|---|
| P01 |  |  |  |  |  |  |  |  |
| P02 |  |  |  |  |  |  |  |  |
| P03 |  |  |  |  |  |  |  |  |
| P04 |  |  |  |  |  |  |  |  |
| P05 |  |  |  |  |  |  |  |  |

출시 게이트는 사전에 고정한다: 핵심 과제 S1~S4 중 4명 이상이 facilitator 도움 없이 성공하면
`4/5 gate = pass`로 계산한다. 실제 결과가 없을 때는 `pending`이다.

## 2. P0 10명 인터뷰 + 2주 diary

### 목적

quota/context/auth 중단이 실제로 반복되는지, alert가 행동으로 이어지는지 확인한다. 이 조사는
제품 가설 검증용이며 실제 계정 사용량을 수집하지 않는다.

### 10분 interview script

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

> 이 검증은 TokenJuice의 synthetic 화면과 최소 행동 기록만 사용합니다. 실제 계정, 프롬프트,
> 코드, 토큰, 이메일, 스크린샷은 요청하지 않습니다. 참여는 선택이며 언제든 이유 없이 중단할 수
> 있습니다. 기록은 pseudonymous ID로 로컬에만 저장하고 검증 종료 후 7일 이내 삭제합니다.
> 참여에 동의하지 않거나 중간에 철회해도 불이익은 없습니다.

동의 기록은 `participant_id`, `consent=yes/no`, `consented_at`, `withdrawn_at`만 남긴다.
동의하지 않은 ID의 세션·diary 행은 생성하지 않는다.

### diary 결과표 (빈 양식)

| metric | observed | denominator | result | decision |
|---|---:|---:|---:|---|
| alert→action within 5 min |  |  |  | pending |
| return within 24h |  |  |  | pending |
| false alert rate |  |  |  | pending |
| checkpoint/resume action |  |  |  | pending |

## 3. macOS/Windows notification presentation checklist

### 공통 사전조건

- release: `v1.2.2`
- tag commit: `12efce26b5eb6dafcb6aaf64f92ef7804ef1b487`
- 실제 계정 대신 엔진 fixture 또는 synthetic config를 사용한다.
- 테스트 전 알림 권한과 방해금지 상태를 참가자 화면에서 확인하되, 계정·메시지·스크린샷은 기록하지 않는다.
- 알림 payload의 내용은 이미 자동 fixture로 검증됐으므로, 여기서는 표시 여부·위치·중복·클릭 후
  앱 복귀만 본다.

### macOS

- [ ] SwiftBar 설치본이 `v1.2.2` release engine과 일치
- [ ] Notification permission 허용 상태에서 threshold alert가 Notification Center에 표시
- [ ] reconnect alert가 계정명·이유·다음 행동·retry 시각을 표시
- [ ] 동일 상태 새로고침에서 duplicate toast가 발생하지 않음
- [ ] reset/recovery 후 다음 상태 변화가 정상 표시
- [ ] notch 내장 디스플레이에서 menu-bar icon과 compact text clipping 없음
- [ ] 방해금지/권한 거부 시 메뉴의 상태·next action은 유지되고 crash하지 않음

### Windows

- [ ] `v1.2.2`의 `tokenjuice.exe`와 동봉 engine을 같은 폴더에 배치
- [ ] Windows notification permission 허용 상태에서 threshold/reconnect toast가 표시
- [ ] 동일 상태 polling에서 duplicate toast가 발생하지 않음
- [ ] reset/recovery 후 다음 상태 변화가 정상 표시
- [ ] permission 거부 시 tray 상태와 next action이 유지되고 crash하지 않음

### 수동 결과표 (빈 양식)

| device / OS version | app/release | scenario | presentation | duplicate | permission-off fallback | pass/fail | defect ID |
|---|---|---|---|---|---|---|---|
|  |  | threshold |  |  |  | pending |  |
|  |  | reconnect |  |  |  | pending |  |
|  |  | reset |  |  |  | pending |  |
|  |  | notch/compact |  |  | n/a | pending |  |

증거는 private data 없는 `pass/fail`, OS major version, release tag, defect ID만 남긴다. 알림
스크린샷·계정명·파일 경로는 수집하지 않는다.

## 4. 현재 판정과 실행 책임

| 항목 | 현재 상태 | 필요한 주체 | 준비된 다음 실행 |
|---|---|---|---|
| UX6 5명 세션 | pending | 제품 담당자 + 참가자 5명 | §1 script와 P01~P05 표를 사용해 20분씩 진행 |
| P0 10명 interview/diary | pending | 제품 담당자 + 동의한 참가자 10명 | §2 consent 후 I01~I10, D1~D14 기록 |
| macOS notification/notch | pending | macOS 실기기 보유자 | §3 v1.2.2 checklist, synthetic fixture만 사용 |
| Windows notification/tray | pending | Windows 실기기 보유자 | §3 v1.2.2 checklist, release exe 사용 |

이 문서는 프로토콜 준비 완료를 뜻할 뿐, 실제 검증 통과를 뜻하지 않는다.
