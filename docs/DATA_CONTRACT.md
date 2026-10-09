# TokenJuice 데이터 계약 v2

확인일: 2026-10-10

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

Claude usage API와 Claude Code local usage-cache의 존재하는 주요 창 `utilization`도
유한한 숫자형 0~100만 받는다. 문자열·boolean·배열·객체·범위 밖 값은 변환하거나
clamp하지 않고 계정 단위 `unavailable / invalid_quota / items: []`로 반환한다.
모델별 optional 창의 null utilization과 누락/null 창은 기존대로 건너뛰며 정상 0·100은 유지한다.
HTTP 200의 빈/잘못된 quota 응답은 성공으로 기록하지 않고 이전 정상 캐시를 보존한다.
60초 재시도 제한 동안 실패 관측/`retryAt`만 표시하며 `lastSuccessAt`은 null이다.
잘못된 local usage-cache는 다른 후보/계정/API로 조용히 fallback하지 않는다.
정규화된 API 캐시도 사용률을 검사해 fresh나 HTTP 실패 뒤 성공 fallback으로 쓰지 않는다.
invalid quota는 snapshot·알림·pace history에 숫자를 제공하지 않는다. 실제 인증/접근 권한은
바꾸지 않는다. 이 utilization 검사는 reset/시각 필드·JSON 파일 문법 등 모든 provider
스키마 검증 완료를 뜻하지 않는다. Desktop 별도 경로의 제한된 검사는 아래와 구분한다.

Claude 내부 정규화 API cache의 존재하는 `at/observedAt/lastSuccessAt`은 양의 유한한
Date-valid/nonfuture Unix ms 숫자여야 한다. 누락/null optional 시각의 기존 `at` fallback은
유지한다. fresh cache는 존재하는 관측/성공 시각도 모두 60초 이내여야 하며 invalid cache는
fresh와 HTTP 실패 후 fallback 양쪽에서 제외한다. 명시적으로 켠 API의 실제 정상 응답은
현재 읽기 시각으로 회복할 수 있다. 기존 2시간 fallback 한계와 캐시 파일은 유지한다.
Claude Code local usage-cache의 기존 파일 mtime 관측 방식도 유지하되 미래/불명/유효 범위
밖 mtime은 `unavailable / invalid_timestamp / items: []`로 반환한다. 다른 local 후보/API로
조용히 우회하지 않고 30분 fresh/stale 기준을 유지한다. 실패 관측은 `observedAt`에만 남길
수 있고 실제 유효 성공이 없으면 `at/lastSuccessAt`은 null이다. 실패한 읽기를 현재 시각의
성공으로 대체하지 않는다. 미래가 정상인 retryAt/reset, 일반 provider 시각 형식이나 OS
시계 보정·시계 오차 허용 정책은 새로 정의하지 않는다.

macOS Claude Desktop `samples[].u.fh/sd`는 숫자 또는 기존 reader가 지원한 비어 있지 않은
숫자 문자열을 0~100 범위에서만 정규화한다. boolean/null/blank/배열/객체/비유한 수·범위
밖 값은 clamp하지 않고 해당 표본을 제외한다. `t`도 같은 숫자/숫자 문자열 호환성을 유지하되
양의 Date-valid Unix ms이며 미래가 아니어야 한다. 최근 2시간의 유효 표본 중 배열상 마지막
표본을 사용하는 기존 선택 규칙을 유지한다. 정렬·새 계정 추론·인증 접근은 추가하지 않는다.
유효한 과거 표본만 historic last-success note로 남길 수 있고 잘못된 표본 시각은 성공으로
기록하지 않는다. 유효 표본이 없는 nonempty/malformed history는 invalid_quota이며 API가
꺼져 있고 정상 local cache가 없을 때 unavailable/items[]/lastSuccessAt null로 표시한다.
정상 local cache 또는 명시적으로 켠 API는 기존 우선순위대로 사용할 수 있다. 숫자 문자열
허용은 이전 reader 호환성이지 제공자의 안정된 공식 형식 보증이 아니다. API/local의 strict
numeric utilization 검사와 다르며 일반 reset 형식·시계 오차 정책·파일 문법 검증은 남아 있다.

Codex quota를 읽을 때 존재하는 각 창의 `used_percent`는 유한한 숫자형 0~100이어야
한다. 숫자처럼 보이는 문자열·boolean·배열·객체·범위 밖 값·비유한 수는 변환하지 않는다.
최신 탐색 레코드의 primary 또는 secondary가 이 검사를 실패하면 해당 프로필 전체를
`unavailable`, `reason: "invalid_quota"`, 빈 `items`로 반환한다. 더 오래된 정상 레코드로
fallback하거나 reset 경과를 근거로 잘못된 값을 0%로 바꾸지 않는다. 다른 정상 프로필은
영향받지 않는다. 누락/null 사용률 창을 건너뛰는 기존 동작과 정상 숫자 0·100은 유지한다.

Codex의 quota 창이 있는 탐색 레코드는 파일 mtime이 양의 유한한 Date-valid/nonfuture
Unix ms여야 한다. 실패하면 reset 추론 전에 `unavailable / invalid_timestamp / items: []`로
반환하며 과거 레코드/다른 파일로 우회하지 않는다. 마지막 성공은 null, 실패 observedAt은
실제 읽기 시각이다. 정상 파일의 1시간 fresh/stale 기준·파일/행 탐색 순서·null 창 건너뛰기는
유지한다. 다른 프로필은 독립적이다. 이 검사는 quota 관측에 한정되며 session context 또는
pace의 명시적 event timestamp를 파일 mtime으로 대체하지 않는다. reset 스키마/OS 시계
보정 정책을 새로 정의하지 않고 파일/설정/계정은 수정하지 않는다.

사용률 검사를 실패한 레코드의 유효 파일 수정 시각은 `observedAt`에만 남긴다. 성공 이력이 따로 저장되지 않은
이 경로의 `lastSuccessAt`은 `null`이다. JSON/widget에 잘못된 사용률을 내보내거나 pace
history·quota 알림에 사용하지 않는다. 이 검사는 Codex 사용률에 한정되며 reset 등 모든
provider 필드의 스키마를 검증하거나 실계정 정확성을 보증하는 것은 아니다.

- Claude 한도: 로컬 usage cache, 사용자가 API 모드를 켠 경우 Anthropic usage endpoint,
  최근 Claude Desktop 기록 순으로 사용한다. API endpoint와 로컬 cache 스키마는 공개 안정
  계약이 아니므로 변경될 수 있다.
- Codex 한도와 컨텍스트: 기본 로컬 `~/.codex/sessions/**/*.jsonl` 또는 사용자가 명시한
  프로필 root의 `sessions/**/*.jsonl` 기록에서 읽는다. 현재
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
`local pace estimate`와 수동 next action으로 알린다. 임계치·reset-soon/forecast marker는
서로 덮어쓰지 않는다.

## Codex pace history / forecast (별도 opt-in)

- `codexForecast.enabled:true`는 Codex history 수집 동의다. Claude의 `forecast.enabled`를
  상속하지 않는다. `codex-quota-history.json`에 version 1과 최대 320개 관측을 저장하고
  기록 시 8일 이전을 제거한다. `--codex-forecast-history`는 최근 7일을 별도 format
  `tokenjuice-codex-forecast-history-v1`로 내보낸다.
- 관측은 `{key,at,used}`만 포함한다. key는 `cw_` + SHA-256(profile scope/role/window_minutes/resets_at)이며
  primary/secondary가 같은 표시 이름이어도 분리하고 reset 구간 변경 시 새 baseline을 만든다.
  계정 인증 식별자가 아니다. default 단일 프로필의 기존 key 입력은 유지하며, 명시적
  프로필은 사용자가 지정한 local ID로 scope를 분리한다. history에는 이 ID·별칭도 평문
  필드로 넣지 않는다. 경로·prompt·OAuth account ID는 해시 입력/필드로 수집하지 않는다.
  같은 root 안에서 실제 로그인만 바뀐 기록들을 자동 인증 식별하지는 못한다.
- fresh 상태와 최근 15분 이내의 명시적 타임존 포함 이벤트 timestamp, 숫자 used 0~100,
  양의 정수 window_minutes 및 알려진 미래 Unix-seconds reset이 모두 필요하다. 파일 mtime은
  pace 관측 timestamp를 대신하지 않는다. 누락·미래·오래된 timestamp와 불명/과거 reset은
  수집/계산에서 제외한다. 동일/역순 timestamp는 중복 표본으로 저장하지 않는다.
- 증가하는 사용률의 같은 구간에 표본 2개 이상, 최소 10분의 관측 범위와 양의 속도가 있어야
  `local_pace_estimate`를 계산한다. v2 Codex item의 `paceKey`·`forecast`는 추가 필드다.
  `forecast.observedAt`은 마지막 표본 시각이다. 기존 quota 필드/형식은 변경하지 않는다. v1 widget forecast도
  기존 선택적 필드를 사용한다. 메뉴·developer·widget 표시가 provider 공식 예측이라는 뜻은 아니다.
- 알림은 effective `enabled:true`와 `notify.codexForecast:true`가 별도로 필요하다.
  window override의 `codexForecast`를 우선하며 `notify.forecast`는 Codex 알림을 켜지 않는다.
  CLI `--notify-codex-forecast-on/off`는 알림 정책만 변경한다. 최근·충분한 관측의 미래
  소진 시각이 알려진 reset보다 먼저일 때 opaque window/period별 한 번만 발화한다.
  JSON/text/widget/history export는 알림을 발화하지 않는다. Windows native toast는 미지원이다.

## Codex 로컬 프로필 / 선택 계약 (R10 수동 subset)

설정의 `codexAccounts`는 최대 8개의 `{id,name,configDir}` 배열이다. id는 고유한
`[a-z0-9][a-z0-9_-]{0,31}`이며 `default`는 기존 동작용으로 예약한다. name은 길이 1~64의
별칭이며 menu delimiter/제어 문자를 허용하지 않는다. root는 절대 경로 또는 `~/` 확장만
허용하고, 중복 canonical root(symlink 포함)는 거절한다. 설정이 없으면 기존 `.codex`만
읽는다. 자동 root/credential/account discovery는 추가하지 않는다.

`codexSelectedAccount`가 없으면 첫 프로필을 선택한다. 명시한 ID가 없거나 manifest가
잘못되면 `invalid_selection`/`invalid_profiles`, unavailable, 빈 legacy quota를 반환한다.
임의 계정/default root로 fallback하지 않는다. 명시적인 CLI `--select-codex-account=<id>`와
macOS/Windows 메뉴는 로컬 config의 선택 필드만 바꾸며 기존 설정을 보존한다. 로그인·
credential·환경변수·실제 Codex 실행 설정은 바꾸지 않는다. 실패하면 선택을 그대로 둔다.

v2의 `codex[]`·`codexStatus` 형식은 유지하고 선택 프로필을 담는다. `codexStatus`에
account/accountId/reason을 추가하고, `codexAccounts[]`는 모든 프로필의 공개 ID/별칭,
selected/items/state/source/observedAt/lastSuccessAt/reason/kind/trust를 제공한다. root는
출력하지 않는다. diagnostics는 ID/별칭 대신 index만 표시한다. Codex context·project
report는 선택 프로필만 포함한다. widget v1은 선택 계정만 담되 quota 이름에 별칭을
붙인다. Pocket의 여러 Codex 계정 동시 표시/모바일 설정 변경은 이 계약에 포함되지 않는다.

명시 프로필의 threshold/reset override key는 `codex:<id>:primary|secondary`, forecast
dedup key는 불투명 paceKey다. 모든 프로필의 fresh quota를 대상으로 하며 reorder/rename으로
키가 바뀌지 않는다. default 모드의 기존 `codex:<display name>` override는 그대로 유지한다.
수동 ID는 실제 인증 계정의 보장이 아니다. root를 다른 계정용으로 재사용할 때는 새 ID가
필요하고, 실제 Team/personal mapping과 OS UI 검증은 별도 acceptance다.

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

## Pocket metadata-only checkpoint / 재개 안내

기존 context CTA가 내보내는 `tokenjuice-checkpoint-v1` 파일을 Pocket의 독립적인
`저장한 작업 이어가기` 상세에서 다시 열 수 있다. quota snapshot v1은 변경하지 않는다.
64 KiB 이하의 JSON, `privacy: "metadata_only"`, claude/codex platform, 양의 유한하고
Date로 해석 가능한 `createdAt`, context의 유한한 비음수 `used`/`pct`와 양의 `window`
또는 null을 검사한다. optional project/branch/model/status는 null 또는 제어 문자 없는
256자 이하 문자열이다. context pct >100도 로컬 추정치로 보존한다.

읽는 필드만 새 객체로 복사하며 unknown/topic/code/nextAction을 표시·복사하지 않는다.
유효하지 않은 파일은 기존 안내/한도 저장본을 유지한다. 새 checkpoint 생성도 같은
검사를 통과해야 다운로드한다. createdAt은 파일 생성 시각이며 현재 상태의 관측 시각이
아니다. 원본의 진위를 인증하지 않고 저장 메타데이터를 live quota/현재 context로 표시하지 않는다.

재개 안내는 이 메타데이터와 사용자 확인 체크리스트만 담는다. 작업 의도·최근 파일·
브랜치 내용·프롬프트·코드 복원이나 자동 세션 실행/전환은 없다. checkpoint는 화면 메모리만
사용하고 새로고침하면 사라진다. 명시적 복사/다운로드 외 네트워크 전송·Mac config 변경·
자동 sync는 없다. 화면에서 지우기는 메모리만 지우고 스냅샷/원본 파일/클립보드는 보존한다.
Phase B의 의미 있는 resume brief 전체 및 실제 재개 시간 단축은 여전히 별도 백로그/검증이다.

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
