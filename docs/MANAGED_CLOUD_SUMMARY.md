# 설치 부담 없는 선택적 클라우드 요약

2026-10-12 사용자가 추천 구조로 개발 착수를 요청했다. 기본 추적은 모델 설치·개인 요약 API
키 없이 사용하며, 일반 사용자 요약은 서비스 운영형 클라우드로 개발한다. 개인 키(BYOK)는
개발자 선택 경로, Ollama는 고급 로컬 선택 경로다. 설치·실제 대화 전송·유료 호출·호스팅
결제를 승인한 것으로 해석하지 않는다.

## 구현 후보와 미완료 범위

`scripts/managed-summary-gateway.mjs`는 호스팅 독립 API 코어다. 서버 키를 설정으로만 받고
브라우저에 제공하지 않는다. 서버 자동 실행·계정/키 발견·모델 설치·요청 로깅은 없다.
실제 로그인, 배포 주소, 결제 연결은 미구현이다. `managed-summary/`에 기기 발췌·업로드 동의·
생성 승인·로컬 재검토/저장 화면 후보를 추가하고 `scripts/managed-summary-site.mjs`로 동일 HTTPS
origin의 인증 gateway에 붙일 수 있다. 이 adapter는 로그인이나 호스팅을 자동 구성하지 않는다.
기존 `local-summary/`는 개인 키/로컬 개발 후보이며 공개 운영형 클라우드 개통으로 표시하지 않는다.

호스트가 HTTPS origin, `authenticate(request)`, 서버 API 키, 모델·현재 가격·요청별 예약액,
private POSIX 예산 경로, `dailyRequests`, `globalDailyMaxUSD`, 개인정보 정책 URL과
`policyVersion`을 제공한다. 인증 함수는 실제 앱 세션을 검증하고 신뢰할 수 있는 서버 저장소에서
`{subject, summaryEnabled}`를 결정해야 한다. 요청 JSON/헤더의 사용자 ID·요금제를 인증으로
사용하면 안 된다. 모듈 자체는 로그인/JWT 검증 시스템이 아니다.

### 로그인 뒤 앱 세션 후보

`managed-summary-sessions.mjs`는 호스트가 신원을 검증한 뒤의 세션 계층이다. 비밀번호 검증·
OAuth callback·JWT 검증·회원 생성은 없다. 서버에서만 검증된 canonical subject를 `issue`에
전달한다. 제공자/tenant를 구분하는 최대 128자 안정 ID를 쓰며, 요청 JSON의 subject를 그대로
받아 발급하는 HTTP route는 금지한다. 반환 setCookie는 비밀값으로 `Set-Cookie` 헤더에만
전달하고 URL/body/로그에 넣지 않는다.

256-bit 무작위 opaque cookie에 __Host- 이름·Secure·HttpOnly·SameSite=Strict·Path=/를 쓰고
Domain은 지정하지 않는다. 메모리에는 token hash와 subject/시각만 보존한다. cookie가 아닌
bearer/URL/storage 또는 중복 cookie는 받지 않는다. 기본 absolute 8시간·idle 30분·최대
512개며 absolute 만료는 activity로 늘리지 않는다. 재시작 후 cookie는 무효이고 복수 replica
세션 공유는 미지원이다. 현재 gateway처럼 단일 instance 후보로만 사용할 수 있다.

`hasSummaryAccess(subject,{signal})`를 요청마다 확인하며 strict boolean만 허용한다. 실패/timeout은
미인증이며 실제 회원/결제 저장소는 아직 없다. 이 함수는 signal 취소와 자원 제한을 구현해야 한다.
비협조 promise를 JS timeout으로 강제 종료할 수는 없다. gateway 자체 인증 deadline도 기본 5초다.

appSessions.authenticate를 gateway authenticate에 연결한다. `logout(request)`는 same-origin
POST를 확인하고 capability 폐기와 Max-Age=0 cookie를 반환한다. 실제 logout route/UI는 호스트
통합에서 연결해야 하며 미구현이다. `revokeSubject`는 해당 계정의 모든 현재 세션을 폐기한다.
await 중 logout/철회/만료가 발생하면 과거 권한 응답으로 접근을 복구하지 않는다. 로그인 제공자와
실제 권한 저장소·위험 사건/권한 변경 후 신원 재확인·실기기 검증은 여전히 출시 게이트다.

참고: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
전체 OWASP 준수/보안 인증/실제 로그인 E2E를 통과했다는 뜻은 아니다. 호스트의 검증된 세션 기능이
있으면 우선 사용하고 이 adapter는 선택적 통합 경계로 취급한다.

## 동의 및 API 계약

모든 경로는 동일 HTTPS origin의 POST JSON이다. Host·Origin·Fetch Metadata와 실제 앱
세션·요약 활성화를 요청마다 검사하고 CORS는 열지 않는다. 호스트가 CSRF·세션 만료/철회를 관리한다.

1. `/api/summary/policy`, `{}`: 제공자·모델·정책 버전/URL·하루 시도 제한·발췌 제한을 제공한다.
   사용자에게 제공자 API 키나 모델 다운로드를 요구하지 않는다.
2. 클라이언트가 기기에서 원문을 파싱·발췌·비밀값 제거하고 사용자에게 전송 범위·수신자·보존
   정책을 보여준다. `managed-summary/excerpt.js`와 화면은 이를 구현하며 UTF-8 크기·최신 발언
   유지·누락 안내를 제공한다. 모든 비밀값 제거를 보장하지 않아 사용자의 내용 확인이 필수다.
3. `/api/summary/preview`, `{raw,confirmed:true,policyVersion}`: 동의한 발췌만 최대
   20,000 UTF-8 bytes로 전송한다. 전체 파일·자동 폴더 탐색은 금지한다. 미리보기 업로드도 이미
   TokenJuice로의 외부 전송이다. 클라이언트 동의 UI 없이 호출하면 안 된다.
4. 서버가 발언·전송 JSON·승인 ID/digest·5분 만료를 반환한다. 이때 모델 호출은 없다.
5. `/api/summary/generate`, `{id,digest,confirmed:true}`: 발췌·모델·요청을 승인한 뒤에만
   토큰 계산/생성을 Anthropic으로 보낸다. 다른 계정의 승인·재사용·클라이언트 모델 변경은 거부한다.
6. 초안을 기기에서 사실·완료 주장·민감정보에 대조해 편집/재검토/저장한다. Pocket 출처 구분을
   재사용할 수 있다. 선택적 `/review`도 편집 내용을 전송하므로 기본 UX는 로컬 검토로 구현한다.

응답은 no-store이고 모듈은 발췌·원문·사용자 ID를 로그나 파일에 저장하지 않는다. 대화는 메모리에서
실행 중이 아닐 때 최대 5분 후 만료된다. 이는 호스트 접근 로그·오류 추적·제공자 보존까지 보장하지
않는다. 실제 인프라 설정과 개인정보 정책 확인이 필요하다.

## 비용·보안·운영 제한

- 요청 전 사용자별 시도 원장에 1회를 기록하고 전체 운영 예산에는 최대 비용을 예약한다.
  실패에도 유지하므로 성공 횟수가 아닌 **요청 시도 제한**으로 표시한다. 시도 기록 뒤 전체 예산
  거부가 발생해도 시도는 유지한다. 자동 재시도·환불·fallback은 없다. 토큰 계산은 청구서나
  절대 결제 상한이 아니다. 두 원장을 함께 rollback하는 분산 트랜잭션은 아니며 장애 시 보수적으로 소진한다.
- 사용자 횟수는 `ai-summary-attempts.mjs`의 별도 `daily-attempts.json`에서 UTC 날짜별로
  보존한다. 가격/모델 예약액 변경·재시작·한도 하향이 같은 날의 사용 횟수를 초기화하지 않는다.
  남은 횟수는 limit-used를 0 이상으로 제한하며, 정책의 의도적인 limit 상향은 사용 횟수를 보존한 채
  추가 시도를 허용한다. 이 후보는 사용자별 요금제/결제 시스템이 아니다.
- 기존 계정의 `daily-budget.json`만 있고 시도 원장이 없으면 자동 환산·초기화하지 않고
  `attempt_migration_required`로 차단한다. 기존 파일을 보존한 운영자 전환 검증이 필요하다.
  잠금·손상·symlink·public 권한·기록 시각보다 뒤로 간 clock도 차단하며 crash lock 자동 삭제는 없다.
- `/policy` 및 승인 API 결과에는 계정별 quota의 used/remaining/limit·UTC day·reset/관측 시각을
  제공한다. 읽기 실패는 null 또는 오류이고 새 한도/0회가 아니다. 생성 초안이 도착한 뒤 quota 읽기만
  실패하면 초안은 유지하고 횟수는 확인 불가로 표시한다. 2분 초과/구간 경과 관측은 오래된 값으로
  표시하며 자동 네트워크 재조회는 없다. 생성 요청 후 결과를 확인하지 못하면 기존 잔여 수를 숨긴다.
- 사용자 경로는 subject의 SHA-256이고 원장은 날짜·시도 수·마지막 예약 시각만 저장한다.
  전체 예산 원장은 날짜·예약액만 저장한다. 해시는 익명화 보장이 아니다.
  상위 경로 전체를 신뢰할 수 있는 전용 볼륨으로 관리해야 한다.
- 진행 요청 최대 8개, 메모리 계정 기본 64개, 계정당 미리보기 최대 3개, 승인 5분, 본문 읽기
  5초, 제공자 호출별 45초 제한이다. 비활성 계정은 10분 후 다음 계정 요청에서 메모리 정리하되
  디스크 예약은 유지한다. gateway 인증 deadline은 기본 5초다. 실제 인증/권한 요청 취소와
  IP/ingress rate limit은 호스트 책임이다.
- 단일 인스턴스 + 지속 private POSIX 볼륨 후보다. 서버리스 임시 파일·복수 replica는 미지원이다.
  분산 승인·DB 트랜잭션 원장·분산 한도는 별도 구현 전 금지한다.
- 운영 무료 요청 수·요금제·전체 예산·제공자 결제 제한을 확정해야 한다. 합성 테스트 금액을
  운영 기본값으로 쓰지 않는다. 사용자 API 키가 필요 없다는 것은 운영 비용이 없다는 뜻이 아니다.

## 출시 TODO

- [x] 서버 키 비노출·세션 검증 주입 경계·기능 활성화 확인·2단계 동의 API 후보.
- [x] 계정 격리·승인 재사용 차단·실패 예약 유지·사용자/전체 예산 재시작 보존 합성 검증.
- [x] 기본 추적 / 준비 중 운영형 클라우드 / 고급 BYOK·Ollama 화면 구분.
- [x] 로컬 발췌·업로드 동의·별도 생성 승인·검토 저장 화면 후보와 동일 origin 정적 adapter.
- [x] 합성 브라우저에서 승인 전 미업로드·정확한 발췌 전송·1회 생성·재검토/저장/Pocket 재열기·
  인증 실패 시 편집 내용 보존·375px/가로/확대 글자·키보드 흐름 검증.
- [x] 가격과 독립적인 일일 시도 원장·재시작 보존·별도 OS 프로세스 경합·UTC 전환/clock/손상 보호,
  계정별 남은 횟수/출처 시각·오래된 값/확인 불가 화면 후보. 운영 정책/실사용 검증은 별도다.
- [ ] 실제 로그인/만료/철회 및 운영 한도 정책 연결. 코드상 횟수 표시를 전체 출시 항목 완료로 간주하지 않는다.
  - [x] 신원 검증 뒤 앱 세션·cookie 제약·absolute/idle 만료·동적 권한·logout/철회·await 경합·
    인증 deadline 후보. 실제 제공자/회원 DB/로그인·logout UI는 미완료다.
- [ ] 호스트/auth 선택·배포 및 실제 세션 만료/철회·권한 격리 검증.
- [ ] 보존/삭제 정책 및 호스트·제공자 로그 설정 확인.
- [ ] 무료 시도 수·운영 비용 상한·가격 정책·제공자 결제 제한 확정.
- [ ] 서버 키 등록·합성 문장 실제 API 검증 승인 및 품질·비용 실측.
- [ ] 실제 사용자 요약→작업 재개 검증. 기존 추적·모바일·스토어·인터뷰 게이트도 유지한다.

## 합성 브라우저 실행

`tests/serve-summary-fixture.mjs`의 4183 서버는 loopback HTTP를 테스트 HTTPS origin으로
변환하고 고정 합성 계정을 쓰는 **테스트 전용 bridge**다. 실제 사용자 로그인·호스팅의 대안이
아니며 운영 배포하면 안 된다. 환경 API 키를 읽지 않고 가짜 모델 응답만 제공한다.
`tests/managed-summary.test.py`를 strict release verifier와 Engine CI에 포함했다.
브라우저의 요청은 loopback fixture로만 전달된다. 요약 파일 저장/편집은 `/review`에 전송하지 않는다.
정책 확인 401 시 선택/편집은 유지하되 업로드·생성은 막고 명시적인 재연결을 요구한다.

## 경쟁 근거

[AI Limits Tracker](https://ailimits.app/)는 대화 대신 사용량 숫자를 읽는다고 설명하고,
[Limits](https://getlimits.app/)는 콘텐츠 생성 없이 조회·위젯·알림을 제공한다고 명시한다.
[OpenUsage](https://github.com/janekbaraniewski/openusage)의 Ollama는 추적 대상이며,
[ClaudeCodeUsage](https://github.com/ClaudeCodeUsage/ClaudeCodeUsage)는 로컬 로그 추적과
별도 키·전송 미리보기·명시적 Send가 필요한 AI 조언을 구분한다. 공개 설명 확인이지 설치된
경쟁 앱의 전체 내부 검증은 아니다. 큰 모델을 기본 UX에서 제외하는 근거이며 TokenJuice 운영형
자동 요약은 자체 제품 추천이다. 경쟁사가 같은 자동 요약을 구현했다는 주장이 아니다.
