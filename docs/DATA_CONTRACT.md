# TokenJuice 데이터 계약 v2

확인일: 2026-10-08

`bun claude-codex-battery.5s.js --json`은 macOS 메뉴바, Windows 트레이 등
외부 표시기가 공통으로 소비하는 출력이다. 숫자를 표시하는 소비자는 반드시 `kind`,
`state`, `trust`를 함께 해석해야 한다. `used`만 보고 최신 사용량이라고 표시하면 안 된다.

## 구분

| `kind` | 뜻 | 숫자의 성격 |
| --- | --- | --- |
| `quota` | 계정 단위 요금제/사용 한도 | 제공자 또는 제공자 클라이언트가 기록한 값 |
| `context` | 개별 대화의 컨텍스트 창 점유량 | 로컬 트랜스크립트의 토큰 합계 추정치, 계정 한도가 아님 |
| `cost` | 외부 제공자의 금액 사용 보고 | 실제 비용/청구 사용액이며 요청 한도나 토큰 quota가 아님 |

## 상태

| `state` | 표시 규칙 |
| --- | --- |
| `fresh` | 최신 값으로 숫자를 표시한다. |
| `fallback` | 대체 소스의 최근 표본이다. 숫자는 표시할 수 있으나 대체값임을 라벨링한다. |
| `stale` | 마지막 성공 값일 뿐 현재 값이 아니다. 헤더/아이콘에는 숫자를 표시하지 않는다. |
| `auth_expired` | 인증 만료. 숫자를 표시하지 않고 로그인 갱신 경로를 제시한다. |
| `rate_limited` | 제공자가 재시도를 제한했다. `retryAt` 전까지 요청하거나 숫자를 표시하지 않는다. |
| `unavailable` | 데이터가 없다. 숫자를 표시하지 않는다. |

`trust.level`은 위 상태를 소비자용으로 요약한다. `live`, `fallback`, `stale`,
`blocked`, `unavailable`, `estimate` 중 하나다.

## 필드

`claude[]` 및 `codexStatus`의 공통 필드는 다음과 같다.

| 필드 | 의미 |
| --- | --- |
| `source` / `sourceLabel` | 실제 데이터 경로 |
| `observedAt` | 해당 샘플을 읽은 시각(Unix ms) |
| `lastSuccessAt` | 마지막으로 성공한 읽기 시각(Unix ms) |
| `retryAt` | 재시도 가능한 시각(Unix ms, 없으면 `null`) |
| `errorCode` | HTTP 상태 등 분류 가능한 오류 코드(없으면 `null`) |
| `stale` | 과거값임을 빠르게 확인하는 호환 필드 |
| `trust` | `{ level, icon, text }` 신뢰성 요약 |

`sessions[]`는 항상 `kind: "context"`다. 기본 JSON에는 프롬프트 원문인 `topic`이
포함되지 않는다. 사용자가 명시적으로 `--topics` 또는 `CCB_TOPICS=1`을 사용한 경우에만
포함될 수 있다.

`items[].forecast`는 사용자가 `forecast.enabled`를 켰을 때만 존재한다. 이는 로컬에서
기록한 사용률 변화로 계산한 `{ kind: "local_pace_estimate", samples, usedPerHour,
exhaustionAt, beforeReset }`이며, 제공자 공식 quota나 보장된 소진 시각이 아니다.

`sessions[].status`는 사용자가 `sessionStatus.enabled`를 켰을 때만 존재한다. 값은
`working`, `waiting_for_input`, `completed`, `needs_attention`, `unknown` 중 하나며,
마지막 로컬 로그 레코드에 따른 휴리스틱이다. 제공자·에이전트의 공식 실행 상태로 취급하면 안 된다.

`copilot`은 선택 기능을 켠 경우에만 `--json`에 존재하는 `kind: "cost"` 객체다.
GitHub Copilot Premium-request 월별 사용 금액을 표시할 뿐, 남은 요청 수나 구독 quota를
나타내지 않는다. `monthlyBudgetUsd`가 있으면 그 값은 사용자가 정한 개인 예산이며 제공자 한도가 아니다.
이 객체는 자격증명 없는 휴대폰 스냅샷 계약에서 의도적으로 제외된다.

`providers[]`는 사용자가 `config.json`의 `providers` 배열에 직접 지정한 local quota-file
adapter 결과다. 항목은 `{ id, label, usageFile }`이며, 파일에는 `items[]`의 `name`, 0~100
사이 `used`, 선택 `resets`, 선택 `observedAt`(Unix ms)이 들어간다. adapter는 15분 이내를
`fresh`, 2시간 이내의 과거값을 `stale`, 그보다 오래되었거나 읽지 못한 파일을 `unavailable`로
처리한다. 이 경로는 network, token, cookie, browser session, shell command를 사용하지 않는다.

## 데이터 경로와 한계

- Claude 한도: 로컬 usage cache, 사용자가 API 모드를 켠 경우 Anthropic usage endpoint,
  최근 Claude Desktop 기록 순으로 사용한다. API endpoint와 로컬 cache 스키마는 공개 안정
  계약이 아니므로 변경될 수 있다.
- Codex 한도와 컨텍스트: 로컬 `~/.codex/sessions/**/*.jsonl` 기록에서 읽는다. 현재
  세션이 장시간 기록을 남기지 않으면 `stale`가 될 수 있다.
- `429`의 `Retry-After`는 우선 준수한다. 없는 경우에도 최소 5분 대기한다.
- Claude 로그인 갱신은 기본적으로 수동이다. 메뉴의 명시적 동작 또는
  `config.json`의 `autoRenew:true`라는 사용자의 옵트인에서만 CLI를 실행한다.
- GitHub Copilot 비용(선택): `config.json`의 `copilot.enabled:true`, `username`,
  `tokenEnv`를 모두 사용자가 설정한 경우에만 GitHub 공식 사용량 endpoint를 호출한다.
  토큰은 설정 파일·키체인·Git credential helper에서 읽지 않고, 지정한 환경변수에서만 읽는다.
  이 endpoint의 응답 형식이나 권한은 GitHub 정책 변경 영향을 받을 수 있으므로 15분 캐시와
  `unavailable` 안전 실패를 적용한다.
- 추가 provider(선택): 사용자 지정 local quota-file만 읽는다. Cursor·Antigravity의 비공식
  브라우저 세션/쿠키나 기존 자격증명을 자동 탐색하지 않는다. 제공자가 이 파일을 만드는 방식의
  정확성·공식성·약관 적합성은 그 exporter를 선택한 사용자에게 명확히 고지해야 한다.

## 소비자 호환성

Windows 트레이와 모든 후속 위젯은 `contractVersion: 2`를 확인해야 한다. 알 수 없는
상태는 안전하게 `unavailable`로 취급하고 숫자를 숨긴다. 알림은 `fresh` 값에만 허용한다.

## 리셋 임박 알림 (local desktop opt-in)

해당 창의 effective `enabled:true`와 별도로 `notify.resetSoonMinutes`를 1~60의 정수로 설정한
경우에만 발화한다. enabled와 resetSoonMinutes 모두 quota-window override를 우선한다.
기본 0은 꺼짐이며 quota-window override에서 같은 필드를 상속/변경할
수 있다. CLI `--notify-reset-soon=10`/`=0`과 메뉴 토글은 로컬 설정만 바꾼다.
fresh quota와 provider가 알려 준 미래 reset 시각(Claude ISO/Codex Unix seconds)에만
적용하며 같은 quota/reset 시각의 중복 알림을 cache에서 막는다. 과거/불명/임계 구간 밖의
reset, stale/fallback/blocked 값은 제외한다. 기존 threshold hysteresis와 상태를 공유해도
각 marker를 보존한다. 모든 read-only export는 알림을 발화하지 않는다.
이는 Windows toast나 Pocket 설정 전달이 아니다.

Claude pace 소진 예측은 `forecast.enabled:true`(history 수집)와 effective 알림 enabled 및
`notify.forecast:true`(예측 발화)가 모두 필요하다. 둘 다 기본 꺼짐이며 window override의
`forecast`를 우선한다. local CLI `--notify-forecast-on`/`--notify-forecast-off`는 알림 정책만
바꾸며 history 수집을 대신 켜지 않는다. fresh 상태, 최근 15분 내 관측, 표본 2개 이상,
미래 소진 시각과 알려진 미래 reset 비교가 모두 유효할 때 한 quota/reset 구간당 한 번
`local pace estimate`와 수동 next action으로 알린다. Codex는 pace history/예측이 없어
예측 알림 대상이 아니다. 임계치·reset-soon/forecast marker는 서로 덮어쓰지 않는다.

## 위젯 스냅샷 계약 v1

`--widget-snapshot`은 자격증명 없이 표시 가능한 quota 상태만 JSON으로 출력한다.
`--export-widget-snapshot`은 같은 내용을 로컬 cache의 `widget-snapshot.json`에 명시적으로
쓴다. 이 기능은 로컬 export만 하며 네트워크·CloudKit·계정 동기화를 수행하지 않는다.

- 포함: 계정 별칭, quota 이름/비율/reset, 신뢰 상태, 마지막 성공 시각, 재시도 시각
- 제외: OAuth 토큰, 키체인 값, 프롬프트, 세션 주제, 코드, 트랜스크립트, 진단 오류 원문
- 후속 모바일/위젯은 이 파일을 읽을 수 있지만, 전송·동기화 기능은 별도 암호화·동의 설계
  없이는 추가하면 안 된다.

Pocket은 저장 전에 v1 envelope뿐 아니라 계정·provider의 상태와 `items[]`, quota의
숫자형 `used`(0~100), 선택적 forecast/context 구조도 검사한다. `generatedAt`은 양의
Unix milliseconds 숫자다. `providers`·`sessions`가 없는 이전 v1 export도 허용한다.
평문 파일과 복호화한 번들에 동일한 검사를 적용하며, 잘못된 파일은 기존 Local Storage와
화면을 바꾸지 않는다. 시작 시 이미 손상된 저장본이 있으면 그 저장본만 제거하고 빈 상태로
복구한다. 이 검사는 파일 형식 검사이지 실제 provider 데이터의 진위를 보장하는 인증은 아니다.

Pocket quota 카드의 잔여량·progressbar·forecast는 `fresh` 또는 명시적으로 라벨링한
`fallback`에서만 표시한다. export에 과거 `items[]`가 남아 있더라도 `stale`,
`auth_expired`, `rate_limited`, `unavailable`에서는 숫자를 숨기고 상태·복구 안내와
마지막 성공 정보를 유지한다.

## 암호화 기기 간 전달 번들 v1

`TOKENJUICE_SYNC_PASSPHRASE`를 현재 실행 환경에만 제공한 뒤
`--export-sync-bundle`을 실행하면 같은 snapshot을 로컬 cache의 `widget-sync.tokenjuice`에
쓴다. 이 파일은 서버 동기화가 아니라 사용자가 직접 기기 간에 전달하는 암호문이다.

- 암호화: 무작위 salt/IV, `PBKDF2-SHA-256` 310,000회, `AES-256-GCM`, 고정 AAD
  `tokenjuice-sync-v1`.
- 제외: passphrase, OAuth 토큰, 키체인 값, 프롬프트, 세션 주제, 코드, 진단 원문.
- passphrase는 config/cache/bundle에 기록하지 않는다. Pocket은 가져올 때만 브라우저
  WebCrypto로 복호화하고 plaintext snapshot만 Local Storage에 둔다.
- 자동 업로드·CloudKit·계정·원격 삭제는 구현하지 않는다. 따라서 동기화를 끈 상태에는
  외부 동기화가 발생하지 않으며, 전달받은 파일은 사용자가 삭제·교체할 수 있다.

## 프로젝트 리포트 계약 v1

`--project-report`는 최근 6시간 안에 수정된 Claude/Codex 로컬 세션을 프로젝트와 플랫폼별로
묶어 JSON으로 출력한다. `contextTokens`, `contextWindow`, `highestContextPct`는 컨텍스트
관측값이며 계정 quota가 아니다. `cost`는 기본적으로 `unavailable`이다. 사용자가
`config.json`의 `pricing`에 모델별 `inputUsdPerM`, `outputUsdPerM`,
`cacheCreationUsdPerM`, `cacheReadUsdPerM`을 직접 입력한 Claude turn만 로컬 비용을
계산한다. 가격표·token class가 모두 있는 프로젝트는 `available`, 일부가 비었으면 `partial`,
완전히 비었으면 `unavailable`이다. Codex의 완전한 input/output/cache 분해나 제공자 가격을
임의 추정하지 않는다.

## 회귀 검증

`bun test tests/engine.test.js`는 격리된 임시 HOME과 API fixture로 다음을 검증한다.

- 신선/대체/오래됨/인증 만료/429 상태와 캐시
- Retry-After 백오프와 로그인 갱신의 최소 간격
- 옵트인 임계치·리셋 알림
- 한도와 컨텍스트 라벨 분리
- 프롬프트 원문이 JSON·진단·텍스트 출력에 새지 않음
- 절전 복귀용 SwiftBar 새로고침 디바운스
