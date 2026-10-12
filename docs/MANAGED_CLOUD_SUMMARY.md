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
POST를 확인하고 capability 폐기와 Max-Age=0 cookie를 반환한다. site adapter에 같은 appSessions를
전달하면 `/auth/logout` route와 사용자 버튼이 활성화된다. gateway의 authenticate도 반드시 같은
세션 계층을 사용해야 한다. 호스트의 실제 로그인 제공자 통합은 미완료다. `revokeSubject`는 해당 계정의 모든 현재 세션을 폐기한다.
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

### 명시적 서버 실행부 후보

`scripts/managed-summary-host.mjs`의 `startManagedSummaryHost`는 기존 gateway/site/
readiness/ingress를 연결한다. import만으로 실행되지 않고 CLI·키/계정/환경 설정 발견·
로그인/모델 설치·signal handler 설치는 없다. 호스트가 검증한 `origin`, `gateway`, 선택적
동일 `appSessions`, 동기 `isReady`, `verifyPeer`, 소유자 `onStopped`를 명시해야 한다.
일반 사용자에게 이 factory의 API 키/운영 설정을 입력시키는 기본 설치 흐름이 아니다.

기본 bind는 127.0.0.1의 임시 port 0이다. port는 0~65535 정수이며 hostname은 127.0.0.1
또는 0.0.0.0만 허용한다. 0.0.0.0은 `privateIngressPort:true`를 명시한 경우만 가능하지만
그 값이 방화벽/TLS 격리를 만들어 주지는 않는다. 실제 네트워크/비공개 ingress 승인·검증
없이 실행하지 않는다. 회귀 테스트에서는 항상 loopback만 사용했다. gateway의 private POSIX
volume, auth/권한·비용·보존 정책 선택은 factory를 호출하기 전에 별도로 검증해야 한다.

`verifyPeer`에는 server.requestIP에서 읽은 frozen socket `{address,port,family}`만 넘긴다.
request/forwarded 헤더나 클라이언트가 주장한 IP를 peer 검증 값으로 넘기지 않는다. 읽기/동시
제약은 하위 site/gateway에서 유지하고 listener 본문 상한은 128,000 bytes·idleTimeout 120초다.
신원/키 등록 route나 `/test/session`은 제공하지 않는다. 실제 login callback은 미구현이다.

`stop(timeoutMs)`은 먼저 drain하고, 성공한 뒤에만 server.stop(false)와 onStopped를 한 번
실행한다. onStopped에서 소유한 gateway/appSessions를 안전하게 dispose한다. 기다리던 요청의
drain이 끝나지 않으면 `{stopped:false}`이고 새 요청만 거부하며 강제 중단/환불하지 않는다.
닫기/정리 역시 monotonic 잔여 deadline으로 기다린다. 느린 정리는 계속 완료될 수 있으나
당시 stop은 false이고, 이후 재확인 가능하다. 정리 예외는 false이며 재시도로 소유자 cleanup을
중복 실행하지 않는다. 공유 resource를 onStopped로 dispose하지 않는다. signal/listener 감독자
연결·실제 SIGTERM·호스팅 종료 제한·재시작/실제 cookie/TLS·로그/지속 저장소 검증은 별도다.

실제 임시 loopback의 시작·UI/health·미인증·private file/위조 Host·peer·pending 요청·deadline/
동시 stop·slow/failed cleanup을 검증했다. fake gateway 응답을 쓰며 실제 로그인·제공자/운영
배포 검증이 아니다. 실모델 기능·모바일·스토어·인터뷰 목표는 유지한다.

### Readiness 및 종료 대기 후보

`scripts/managed-summary-lifecycle.mjs`는 listener/signal 처리 없이 `handle`과 `drain`을
제공한다. `origin`, 실제 site를 감싼 `handler`, 동기 `isReady`를 명시한다. `isReady`는 호스트가
검증한 auth/권한/지속 저장소·운영 구성 상태에서 결정하며 boolean true만 허용한다. Promise,
truthy·예외는 ready가 아니다. callback이 실제 의존성을 검증하지 않으면 readiness 증거가
되지 않는다. 이 controller가 자체적으로 로그인·키 조회·모델 API·원장 초기화를 실행하지 않는다.

구성 순서는 `gateway → site → lifecycle.handle → ingress`이다. 원래 HTTPS origin/Host
검사를 유지하며 GET `/healthz`는 `{ready:true|false}`만 반환한다. query·다른 method는
거부하고 사용자/대화/키/원장/활성 요청 수를 반환하지 않는다. health는 요약 호출을 발생시키지
않는다. 준비 전/종료 중은 503이다. 일반 요청 최대 active는 기본 16, 설정 범위 1~256이며
초과 시 429다. capacity 소진은 health false로 바꾸지 않아 부하를 의존성 실패로 오인하지 않는다.

호스트가 종료 신호를 받으면 `drain(timeoutMs)`을 먼저 호출한다. 새 요청은 즉시 거부하고
기존 handler가 응답을 반환할 때까지 기다린다. 기본 30초, 허용 1~120,000ms이며 timeout은
`{drained:false}`다. false는 작업 취소·환불·원장 복구·resource dispose·완료가 아니며 종료
상태를 되돌리지 않는다. 시간이 지난 작업이 끝나면 재호출로 true를 확인할 수 있다. 현재
site/gateway는 생성 종료 후 buffered Response를 반환한다. 반환 뒤 계속 흐르는 streaming
response의 완료까지 추적하는 controller가 아니므로 SSE/스트리밍을 붙일 때는 별도 drain이
필요하다. 실제 호스팅 종료 제한과 최악 요청 시간에 맞는 signal/listener·대기·dispose 순서,
강제 종료의 불명 결과/예산 유지, 재시작 검증은 다음 통합 게이트다.

회귀는 합성 gateway 생성이 종료 deadline 뒤에도 응답·사용자 시도 원장을 보존하는지,
중복 요청 차단·abort/refund 없음·health metadata 부재와 실제 loopback의 ingress/site 연결을
검증한다. 실제 SIGTERM·호스트 배포·운영 TLS·실제 외부 요청/개인정보 계약은 검증 전이다.

### HTTPS ingress adapter 후보

`scripts/managed-summary-ingress.mjs`의 `createManagedSummaryIngress`는 site 앞의 선택적
HTTP→고정 HTTPS 주소 adapter다. 서버/listener·TLS/proxy·배포·로그인·키 발견을 자동 실행하지
않는다. `origin`, `site`, `transport: "private_http_behind_tls"`, 동기 `isTrustedPeer(request)`가
모두 명시적으로 필요하다. predicate는 실제 서버 socket IP/네트워크 격리로 요청별 출처를
검증해야 하며 헤더·Origin·cookie·URL·클라이언트 TLS 주장으로 true를 반환하면 안 된다.
Promise·truthy 값·누락은 허용하지 않는다. 앱 callback 자체가 네트워크를 안전하게 만드는 것은
아니므로 외부 공개 HTTP 포트에 이 adapter를 붙여서는 안 된다.

수신 request가 HTTP이고 Host가 설정 HTTPS origin의 host와 정확히 일치할 때만 경로/query를
고정 origin에 붙인다. Forwarded·X-Forwarded-*·X-Real-IP·X-Original-URL·X-Rewrite-URL은
제거한다. 클라이언트 Origin·Fetch Metadata·cookie·method·body·abort signal은 site/gateway에
유지하므로 인증/CSRF/본문 크기/전송 동의/승인 재사용 검사를 우회하지 않는다. site 응답의
Secure-cookie/CSP를 유지하고 private 실패 내용은 `ingress_unavailable`로 치환한다.

[Render 공식 web service 설명](https://render.com/docs/web-services)에 따르면 공개 HTTPS는
load balancer에서 종료된 뒤 앱으로 HTTP 전달되고, 앱 포트는 외부 인터넷에서 직접 접근할
수 없다. 하지만 실제 계정의 네트워크·socket·Host·TLS·private 경로/출처 설정은 검증 전이다.
이 adapter를 Render 전용 자동 신뢰로 취급하지 않는다. 직접 TLS 서버는 기존 site를 사용하고,
이 adapter는 HTTPS 입력도 거부한다. health/readiness·drain controller 후보는 위에 추가했지만
actual TLS·권한 저장소·signal/listener 통합·로그/보존·운영 host launch 구성은 별도 작업이다.

회귀는 127.0.0.1 임시 서버와 합성 canonical 신원만 사용한다. 실제 opaque 앱 세션·gateway를
연결한 cookie/Origin/동의/로그아웃 검증은 실제 IdP 로그인이나 Render TLS 동작 증거가 아니다.

### 2026-10-13 개통 구성 추천 — 선택/가입/배포 전

**권장 후보는 Render 유료 단일 Bun 서버 + 지속 디스크 + Clerk 로그인이다.** 현재 코드의
단일 instance/private POSIX 원장과 초기 출시 작업량을 기준으로 한 추론이며 사용자 선택이나
운영 승인으로 간주하지 않는다. 기존 타 프로젝트의 인증 앱·키·회원 DB는 재사용하지 않는다.

| 후보 | 공식 비용/제약 근거 | 현재 코드 적합성 판단 |
|---|---|---|
| Render 유료 서버+disk | [공식 가격](https://render.com/pricing): Starter 서버 $7/월, disk $0.25/GB·월. [Bun 지원](https://render.com/docs/language-support) | 1GB disk 가정이면 서버+disk 약 $7.25/월. 실제 결제 화면 재확인·세금/트래픽/빌드·AI·인증 추가 비용 별도. 512MB의 실제 부하 검증 필요 |
| Render 무료 서버 | [무료 제약](https://render.com/docs/free): 15분 idle 뒤 중단, filesystem 휘발, persistent disk 불가 | 현재 디스크 원장으로 운영 불가. 무료 서버에 재시작마다 새 quota/예산을 주는 우회는 금지 |
| Railway Hobby | [공식 요금](https://docs.railway.com/pricing/plans): $5/월에 $5 사용량 포함, 초과분 별도 | CPU/RAM/volume/전송 실측 없이 $5 고정 총비용이라고 안내하지 않는다. 대안이며 mount/TLS/종료 검증 선행 |
| Fly Machine+volume | [공식 저장 요금](https://fly.io/docs/about/pricing/): volume $0.15/GB·월, compute 별도. [볼륨 제약](https://fly.io/docs/volumes/overview/) | volume은 단일 Machine에 붙고 자동 복제하지 않는다. 공급자는 가용성 위해 복수 구성을 권고하지만 현재 원장은 다중 replica 미지원. 초기 운영 복잡성이 더 큰 대안 |

Render disk도 [단일 instance·runtime에서만 mount·배포 중 중단](https://render.com/docs/disks)이
있다. 따라서 추천은 무중단/고가용성 보장이 아니다. 중단 시 새 승인/생성을 차단하고 편집은
기기에 유지한다. 재시작으로 앱 세션/승인은 사라질 수 있지만 디스크 원장의 시도/금액은 유지해야
한다. 오래된 disk snapshot 복원으로 이미 사용한 예산을 다시 허용하지 않도록 운영 복구 계약과
수동 감사가 필요하다. 고가용성 목표는 추후 분산 원장·승인/세션 계층과 별도 검증으로 해결한다.

로그인은 [Clerk Hobby 공식 가격](https://clerk.com/pricing)의 무료 50,000 MRU/app 범위와
제공 sign-in UI를 초기 후보로 검토했다. MRU는 MAU와 다른 단위이며 무료가 보안/개인정보·회원
권한 구현을 대신하지 않는다. [서버 authenticateRequest](https://clerk.com/docs/reference/backend/authenticate-request)
검증·정확한 authorizedParties 및 TokenJuice 전용 설정을 통합하고, summaryEnabled는 신뢰할 수
있는 서버 권한 저장소에서 별도로 결정해야 한다. 브라우저 전달 ID/토큰 디코딩만으로 신원을
인정하거나 Clerk 로그인 성공을 요약 유료 권한으로 취급하지 않는다. 현재 strict CSP·logout과
실제 session 만료/철회 연결은 구현/실제 TLS 검증 전이다. SDK 선택만으로 완료되지 않는다.

운영 비용은 `서버 + disk + 인증/권한 저장소 + AI 실제 사용 + 전송/빌드 + 세금`으로 계산한다.
`30 × 승인한 globalDailyMaxUSD`는 30일 구간의 모델 **예약액** 계획치이지 전체 결제 상한이나
실제 청구액이 아니다. 월 총비용 상한 답변을 기다리고 있으며 테스트의 test-model·$0.02·
합성 토큰 단가를 운영 값으로 복사하지 않는다. 실제 모델·가격 확인일·최대 출력/발췌·무료
시도 수·제공자 결제 제한·인프라 과금 제한은 각각 확정해야 한다.

다음 실행 순서는 구성/비용 승인 → 전용 auth·권한 통합 → HTTPS ingress/Host·health/종료와
disk 재시작 보존 검증 → 실제 브라우저 로그인/철회/계정 격리 → 운영 정책/비용 제한 확정 →
승인된 합성 문장 실제 API 비용·품질 검증 → 제한 명시 베타·실제 인터뷰다. ingress에서 사용자
제공 forwarded header를 그대로 신뢰해 origin/Host 검사를 통과시키지 않는다. 이 추천은
요약 트랙이며 Claude quota 인증·Android 자동 연결·스토어 목표의 완료나 축소가 아니다.

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
    인증 deadline 후보. 실제 제공자/회원 DB/로그인은 미완료다.
  - [x] 동일 origin POST JSON·사용자 확인·본문 크기/대기 상한 logout route, cookie 헤더만
    반환·세션 폐기·미구성 503·로그아웃 실패 안내·로컬 편집 보존·늦은 응답 제외 화면 연결 후보.

- [ ] 호스트/auth 선택·배포 및 실제 세션 만료/철회·권한 격리 검증.
- [ ] 보존/삭제 정책 및 호스트·제공자 로그 설정 확인.
- [ ] 무료 시도 수·운영 비용 상한·가격 정책·제공자 결제 제한 확정.
- [ ] 서버 키 등록·합성 문장 실제 API 검증 승인 및 품질·비용 실측.
- [ ] 실제 사용자 요약→작업 재개 검증. 기존 추적·모바일·스토어·인터뷰 게이트도 유지한다.

### 로그아웃 동작과 검증 범위

정책의 logoutAvailable은 site에 appSessions가 구성됐을 때만 true다. 버튼은 보조 동작으로
표시하고 native 확인 후 `{confirmed:true}`만 POST한다. GET·cross-origin·extra subject·query·
누락 동의·비 JSON은 거부한다. 본문은 1024 bytes/5초, 대기 logout은 최대 3개다. 결과는
`{loggedOut:true}`이고 cookie는 Set-Cookie 헤더에만 둔다. 미구성/실패는 성공으로 표시하지 않는다.

로그아웃 시작부터 UI의 새 전송을 막고 발췌/편집·검토 저장은 기기에 유지한다. 공용 기기에서는
화면 지우기를 별도로 사용한다. 원문 전송이나 이미 실행 중인 생성의 취소·환불·서버 초안 삭제를
확인한 것이 아니다. 서버 삭제를 확인하지 못한 이전 초안은 지우기에서도 확인 불가로 표시한다.
connection epoch와 작업 ID로 늦게 도착한 생성/파일 읽기가 이전 상태를 복원하지 않도록 한다.

합성 fixture는 실제 opaque 세션 객체를 쓰지만 loopback bridge에서 cookie를 주입하고
`/test/session`은 고정 합성 identity 두 종류만 발급한다. 이 route는 production site에 없으며
실제 로그인·브라우저의 Secure-cookie 처리·TLS ingress를 검증한 것으로 취급하지 않는다.
Native confirmation·실패/성공 logout·편집 보존·401 거부·늦은 생성 응답 제외를 browser로 검증한다.

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
