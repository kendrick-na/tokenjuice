# TokenJuice 업데이트 개발 기획서 v1

> **Claude 검수 메모 (2026-10-08)** — Codex 작성본을 원문과 대조했다.
> - ✅ 대조 일치: App Store 판매자 JoCoding, Inc. · Pro 가격 $29.99 / $14.99 / $2.99 · 호환 OS · "평점 최근 초기화" 문구 / CodexBar 22.3k stars · 2.1k forks · MIT.
> - ⚠️ 수정: AI Limits Tracker 최신 버전은 1.0.18이 아니라 **1.0.23**(3.4 표에 반영). "소진 예상 시각(Runs out)" 표시는 R6 알림 설계에 직접 참고할 만하다.
> - ⚠️ 미검증: Google Play 다운로드 수(`5+`)·업데이트 날짜·데이터 안전 항목은 검수 도구로 페이지를 읽지 못해 **재확인 필요**.
> - ⚠️ 해석 주의: JoCoding, Inc.는 Delaware 법인이지만 운영자는 한국 개발자로 알려져 있으므로(확인 필요) "미국 상용 사례"로 분류하지 않는다. 해외 비교군은 대부분 소규모 오픈소스(0~31 stars)이고, 대형 사례는 CodexBar·ccusage 2개뿐이다. **미국·일본의 유명 상용 앱 조사는 보강이 필요하다.**
> - ✅ 확인된 사실로 정정: `claude -p /usage`의 모델 호출 0회는 10/5 Claude 세션에서 실측했다(대화 기록에 usage 항목 0건). 9.3의 해당 항목은 "CLI 버전이 바뀔 때마다 재확인"으로 읽는다.
> - 참고: R3("자동 갱신 대신 사용자 안내")는 10/5에 적용한 자동 갱신(87a3e0d)과 방향이 반대다. 이 부분은 결정이 필요하다.

> 조사 기준일: 2026-10-08 (대한민국 표준시)
> 범위: 공개 웹페이지·앱스토어·Google Play·공개 GitHub 저장소만 확인. 앱 설치, 회원가입, 로그인, 결제, 키체인·설정 변경은 하지 않음.

## 1. 한 줄 결론

TokenJuice의 다음 승부처는 지원 AI를 많이 늘리는 것이 아니라 **“지금 숫자가 언제·어떤 경로에서 성공적으로 읽힌 값인지”를 항상 보여주는 신뢰성 계층**을 만드는 것이다. 그 위에 Claude·Codex 멀티계정, 리셋/소진 예측 알림, Windows/macOS 공통 UX를 단계적으로 얹는다.

### 요약

- AI Limits Tracker는 iPhone·Mac 메뉴 막대·Apple Watch·Android와 위젯, 온보딩, 로컬 알림, Pro 구독을 제품으로 묶은 가장 직접적인 상용 비교 대상이다.
- CodexBar는 오픈소스 생태계에서 가장 큰 관심을 받은 다중 제공자 사례다. 여러 인증 원천을 읽고, 리셋·비용·상태까지 한 화면에 모은다.
- 2026년 Product Hunt 신제품 흐름은 단순 quota 표시를 넘어 세션 상태·승인 요청·완료 알림·컨텍스트·비용까지 묶는 “AI agent command center”로 확장되고 있다.
- 시장의 약점은 공통적이다. Claude·Cursor·Codex의 사용량 경로가 공식 공개 API가 아니거나 CLI/브라우저 세션에 의존하고, 토큰 만료·429·수면 복귀·계정 선택 오류가 쉽게 “0%” 또는 오래된 숫자로 보인다.
- TokenJuice는 설치본을 이미 보유하고, Claude Team과 Codex를 한 메뉴바에서 읽으며, Windows 트레이 버전까지 있다는 점이 강점이다.
- 구현 기준으로 v1.1·v1.2 핵심과 R12/R19/R20의 로컬 기반을 완료했다. v2.0에는 암호화 수동 전달을 구현했으며, 남은 출시 차단 항목은 자동 CloudKit 동기화의 제품·보안 결정, 실기기 Windows 검증, 스토어/배포 결정이다.

### 1.1 2026-10-08 구현 추적

| 범위 | 구현 증거 | 상태 |
|---|---|---|
| R1~R8, R15~R16 | 상태 계약, Retry-After, 수동 기본 로그인 갱신, wake debounce, 비밀값 없는 진단, fixture 회귀 테스트 | 구현·자동 검증 완료 |
| R9~R11, R17~R18 | 안전한 starter config, 멀티 계정 별칭, Windows renderer, opt-in 세션 상태·pace forecast | 구현·자동 검증 완료; `5617b9a` Engine `37811131425`, Windows `37811131623` 성공 |
| R12 | 자격증명 없는 로컬 스냅샷 export와 TokenJuice Pocket PWA import | 구현·브라우저 자동 검증 완료 |
| R13 | GitHub Copilot 공식 비용 adapter + 명시적 local quota-file adapter | 구현·fixture/PWA 검증 완료; Cursor/Antigravity는 쿠키 수집 없이 안전한 exporter 파일로만 연결 |
| R14 | 선택적 암호화 수동 전달 bundle(PBKDF2 + AES-GCM), 자동 sync 없음 | 구현·엔진/PWA 상호운용 자동 검증 완료; CloudKit 자동 sync는 별도 제품 결정 |
| R19 | notch compact 메뉴바 출력 | 구현 완료 |
| R20 | 로컬 프로젝트별 컨텍스트 리포트 + 사용자 가격표 기반 Claude 비용 | 구현·fixture 검증 완료; Codex/미분해 token은 `partial`/`unavailable` |

## 2. TokenJuice 현황 진단

### 2.1 현재 구현 상태

다음은 이어받은 Claude 세션의 기록과 저장소 현황을 기준으로 한 진단이다.

| 항목 | 현재 확인 내용 |
|---|---|
| 저장소 | [kendrick-na/tokenjuice](https://github.com/kendrick-na/tokenjuice) |
| 로컬 HEAD | `862d592`; `origin/main`보다 3커밋 앞섬, 뒤처지지 않음 |
| 설치본 | `~/.swiftbar-plugins/tokenjuice-battery.5s.js`; 저장소 HEAD와 동일 |
| 실행 방식 | SwiftBar 플러그인, 5초 주기, Bun |
| Claude 1순위 | 키체인 `Claude Code-credentials`의 OAuth 토큰으로 `https://api.anthropic.com/api/oauth/usage`; 60초 캐시 |
| Claude 대체 경로 | `~/Library/Application Support/Claude/plan-usage-history.json`; 최근 30분 자료만 대체값으로 사용 |
| Codex | `~/.codex/sessions/**/*.jsonl`의 `rate_limits(primary/secondary)` 및 `last_token_usage` |
| 절전 복구 | `ensure-swiftbar-visible.sh`와 `com.tokenjuice.visibility` LaunchAgent가 15초마다 `swiftbar://refreshallplugins` 호출 |
| 표시 | 픽셀 배터리 헤더 복원; stale 값은 헤더에 `?` 표시 |
| 계정 | Claude Team, KAIST OverEdge 조직; Windows pystray 버전도 존재 |

### 2.2 확인된 근본 문제

1. **OAuth 토큰 수명과 갱신 주체가 분리되어 있다.** 키체인 OAuth 토큰은 약 8시간마다 만료되지만 갱신은 Claude CLI가 담당한다. 사용자가 Claude Desktop Code 탭만 쓰면 CLI가 토큰을 갱신하지 않아 401이 된다.
2. **Desktop 앱 기록은 항상 수집되는 데이터가 아니다.** 트레이 사용량 화면을 최근 24시간 안에 열었을 때만 background poll이 동작한다는 로그가 확인됐다.
3. **실패와 성공의 구별이 사용자에게 늦게 전달됐다.** 이전에는 마지막 성공값을 별도 표지 없이 보여 주어 실시간 값처럼 보일 수 있었다. 현재 stale 헤더 `?`는 올바른 방향이지만, 마지막 성공 시각·경로·실패 이유까지 필요하다.
4. **429는 데이터 문제와 인증 문제를 구별해야 한다.** 현재 Retry-After 1시간을 준수한다. 이때 무리한 재시도는 정확도를 높이지 않고 차단 시간을 늘릴 수 있다.
5. **키체인 계정 선택 오류가 있었다.** `env -i` 실행으로 `acct="unknown"` 빈 항목이 생겼고 플러그인이 그 항목을 읽었다. 현재는 macOS 사용자 계정을 기준으로 읽도록 수정됐다. 빈 키체인 항목 삭제는 이번 기획 범위가 아니며 사용자 승인 없이 건드리지 않는다.

### 2.3 강점·약점·잔여 위험

| 구분 | 진단 |
|---|---|
| 강점 | 별도 서버·회원가입 없이 개인 Mac에서 동작, SwiftBar 접근성, Claude와 Codex를 한 화면에 표시, 설치 경로가 단순함, Windows 확장 가능성 |
| 약점 | SwiftBar/Bun 런타임 의존, Claude 인증 갱신을 CLI에 의존, 공식 사용량 계약이 아닌 엔드포인트 의존, 모바일/위젯/완성형 온보딩 부족 |
| 잔여 위험 | Anthropic/OpenAI가 응답 형식·토큰 저장 위치·rate limit을 변경할 수 있음; Team 조직 정책상 사용량 접근이 달라질 수 있음; 수면 복귀 후 새로고침 폭주 가능; 여러 계정의 키체인 선택 오류 재발 가능 |
| 제품 위험 | “숫자가 보인다”와 “숫자를 믿어도 된다” 사이의 간극. stale·추정·공식값·로컬 집계가 같은 모양이면 신뢰를 잃음 |

## 3. 경쟁 조사 A — AI Limits Tracker

### 3.1 운영 주체·플랫폼·지원 범위

운영 주체는 **JoCoding, Inc.**로 표시된다. Apple 판매자도 JoCoding, Inc.이며, Google Play의 개발자 정보에는 미국 Delaware 주소·전화번호·`help@jocoding.net`이 공개되어 있다. Apple 페이지의 호환성은 iPhone(iOS 16+), Mac(macOS 12+), Apple Vision(visionOS 1+), Apple Watch(watchOS 10+)이고, 공식 사이트는 iPhone 위젯·Mac 메뉴 막대·Apple Watch를 전면에 둔다. Google Play에는 Android 앱도 등록되어 있다.

공식 사이트와 일본어 페이지에 공개된 제공자는 **Claude Code, Codex, Grok, Antigravity**다. AI Limits Tracker가 일반 ChatGPT 대화량 전체를 추적한다고 공개한 근거는 확인하지 못했다.

### 3.2 사용량 수집 방식

- 사용자가 각 제공자의 **자체 로그인/승인 흐름**으로 연결한다. JoCoding 계정이나 별도 서비스 회원가입은 필요 없다고 안내한다.
- Apple 설명은 iCloud Keychain과 기기 보안 저장소를 사용하고, 위젯은 자격증명 없이 최신 스냅샷을 표시한다고 설명한다.
- 개인정보처리방침은 제공자 접근/갱신 자격증명과 만료시각을 기기 Keychain에 저장하고, Apple 기기에서는 iCloud Keychain으로 동기화한다고 밝힌다. 최신 정규화 스냅샷과 계정 별칭은 기기 및 CloudKit private DB에 저장한다.
- 제공자 사용량·프롬프트·코드는 JoCoding으로 전송하지 않는다고 설명한다. 실제 사용량 요청은 선택한 제공자와 직접 통신한다.
- Android는 하드웨어 지원 Keystore와 로컬 기기 스냅샷, 클라우드 동기화 없음으로 설명한다.
- 약관은 제공자의 인증·API·데이터 형식 변경, rate limit, 조직 정책에 따라 동작이 바뀔 수 있다고 명시한다. 이는 TokenJuice와 같은 비공식/반공식 사용량 도구의 공통 위험을 공개적으로 인정한 사례다.

### 3.3 기능·화면·알림

- 메뉴 막대 패널과 가장자리 `island` 형태의 표시 옵션, 로그인 시 자동 실행, 메뉴 막대 퍼센트 표시, refresh interval 설정.
- iPhone 위젯, Apple Watch의 계정별 링/전체 개요/컴플리케이션, Android 홈 화면 위젯.
- 5시간·주간 한도, 정확한 reset time, reset credit을 정규화해 표시.
- 계정별 잔여 임계치 알림(기본 5%), Codex/Grok reset credit 만료 5시간 전·1시간 전 알림, 예정된 reset, 조기 reset, 재연결 필요, 마지막 성공 후 60분 이상 지나고 수동 갱신이 실패한 경우의 “사용량 업데이트 필요” 알림.
- 최신 성공 스냅샷을 다음 성공까지 유지하는 설계와, 위젯 자격증명 미보유 원칙을 공개한다.

### 3.4 가격·개인정보·평가·업데이트

| 항목 | 확인 결과 |
|---|---|
| Apple 가격 | Lifetime Pro US$29.99, Annual Pro US$14.99, Monthly Pro US$2.99. 무료 연결 계정 1개, Pro는 추가 계정·멀티계정 위젯을 제공한다고 안내 |
| Android 가격 | Google Play에 인앱 결제 표시. 구체 가격은 공개 페이지에서 확인 필요 |
| Apple 평점/리뷰 | “Overall rating recently reset”으로 표시. 현재 숫자 평점·리뷰 수·대표 불만/칭찬은 확인 필요 |
| Android 평점/리뷰 | 공개 페이지에서 숫자 평점·리뷰 수 확인 필요 |
| 다운로드 | Google Play에 `5+ Downloads` 표시. 실제 설치 수로 확대 해석하지 않음; Apple 다운로드 수는 확인 필요 |
| Apple 개인정보 라벨 | 개발자 제공·Apple 미검증. 추적에 사용: Identifiers. 사용자와 연결: Purchases/Purchase History, Coarse Location, Identifiers, Usage Data, Diagnostics. 연결되지 않음: 광고용 식별자 |
| Android Data safety | 제3자 공유 없음, 위치·금융정보 및 2개 추가 범주 수집 가능, 전송 중 암호화, 삭제 요청 가능으로 개발자 신고. 세부 범주와 실제 처리의 독립 검증은 확인 필요 |
| 최신 버전/업데이트 | ⚠️ Claude 검수(10/8): App Store 현재 **1.0.23**(검수 시점 "1일 전" 출시, 노트 = 홈 화면 위젯 새 디자인·한도가 리셋 전에 바닥나면 빨간 "Runs out" 시각 표시·Antigravity 모델명). 아래 1.0.16~1.0.18은 Codex 조사 시점 기록. Apple 1.0.18: plan status sync. 1.0.17: 평가 요청·신규 사용자 투어·Claude Code sign-in 개선. 1.0.16: Claude Code reset credit·계정 동기화 버그 수정. Google Play: 2026-10-06 업데이트, Pro 잠금 해제·홈 위젯·Antigravity 모델명 수정 |
| 운영자 개인정보 | 공식 정책은 JoCoding, Inc. Delaware와 RevenueCat(구매), PostHog(제품 분석), AppsFlyer(설치/귀속)를 공개. 자격증명·사용량을 JoCoding으로 보내지 않는다는 설명과, 분석/귀속 식별자 처리 사이의 차이를 사용자에게 분명히 설명할 필요가 있음 |

### 3.5 차별점과 TokenJuice에 주는 의미

AI Limits Tracker의 차별점은 API 하나의 기술보다 **제품 신뢰 흐름**이다. 연결 → 최신 성공 스냅샷 → 위젯/워치 → 실패 시 재연결·업데이트 알림까지 사용자 여정을 닫았다. 반대로 사용자가 볼 수 있는 제공자별 실제 요청 경로·공식 여부는 제한적으로만 설명되고, 제공자 API/인증 변경 위험은 약관에 남아 있다.

## 4. 경쟁 조사 B — 해외 서비스·오픈소스

### 4.1 비교 기준

GitHub 스타 수는 2026-10-08에 공개 페이지에서 본 스냅샷이며 변동한다. 개발자의 국가를 저장소만 보고 추정하지 않았다. “미국·유럽·일본”은 아래처럼 **운영자/주소가 확인된 경우와 일본어 검색에서 발견된 후보**를 구분한다.

- 미국 소재가 확인된 상용 사례: JoCoding, Inc. (Delaware). AI Limits Tracker는 3장에 상세히 다뤘다.
- 유럽 연관성이 공개된 오픈소스 사례: CodexBar 관리자의 GitHub 프로필은 Vienna ↔ London을 공개한다. 회사 국적과 제품 법인은 별도 확인이 필요하다.
- 일본어 검색에서 확인된 사례: Usage4Claude, AgentLimits, AI Usage Bar, Claude Meters. 저장소/게시글만으로 운영자 국적·법인 소재를 확정할 수 있는 자료는 확인하지 못했다.

### 4.2 주요 서비스 카드

#### CodexBar — 다중 제공자 기준점

- **형태/플랫폼:** macOS 14+ 메뉴 막대, Linux 데스크톱/트레이, 일부 Linux 바 위젯.
- **지원:** Codex, Claude, Cursor, Copilot, Devin, Gemini, Antigravity, Grok, Mistral, DeepSeek 등 매우 많은 제공자.
- **수집 방식:** 제공자별로 OAuth·device flow·API 키·CLI 로컬 파일·브라우저 cookie/localStorage·provider app 파일을 선택. Claude는 OAuth API/cookie/CLI PTY fallback, Codex는 OAuth/API 또는 로컬 CLI, Cursor는 브라우저 세션 cookie로 설명한다.
- **기능:** 제공자별 status item/아이콘 병합, session·weekly·monthly reset countdown, credits·spend·cost scan, provider status, Linux 알림.
- **가격·개인정보:** MIT 오픈소스; 별도 유료 가격은 확인 필요. 로컬 세션 재사용을 강조하지만 제공자별 인증원천이 다르므로 위협모델도 다르다.
- **규모·활동:** 22.3k stars, 2.1k forks, MIT, 약 6,988 commits. 최신 릴리스 v0.72.0은 2026-10-04로 확인됐다. 관리자 프로필에 Vienna ↔ London 및 OpenAI 경력이 공개되어 있다.
- **시사점:** “모든 AI”를 한꺼번에 지원하는 확장성은 강력하지만, TokenJuice가 그대로 따라가면 쿠키·토큰 취급 면적이 급증한다.

#### ccusage — 로컬 로그·토큰·비용 분석 기준점

- **형태/플랫폼:** Node/Bun/Deno로 실행하는 CLI와 리포트/라이브 모니터링.
- **지원:** Claude Code, Codex, OpenCode, Amp, Copilot CLI, Gemini CLI, Antigravity, Grok Build CLI 등 다수의 로컬 코딩 에이전트.
- **수집 방식:** 각 CLI의 로컬 transcript/session 파일을 읽는다. API 한도와 실제 로컬 토큰 사용·API 환산 비용을 구분해야 한다.
- **기능:** daily/weekly/monthly/session/blocks, 모델별 토큰·비용, JSON·MCP, statusline.
- **가격·개인정보:** MIT. 공개 설명상 로컬 데이터 중심; 실제 설치 시 읽는 경로를 확인해야 한다.
- **규모·활동:** 18.5k stars, 822 forks, MIT. 2026-10-08 확인 시 최근 릴리스 변경 목록에 여러 제공자·가격·데이터 파서 수정이 계속 추가되고 있었다. 정확한 최신 커밋일은 문서 작성 시점 화면에서 확인 필요.
- **시사점:** TokenJuice의 Codex/Claude “공식 한도”와 ccusage식 “로컬 토큰/비용”을 서로 다른 카드와 라벨로 제공할 근거가 된다.

#### AI Usage (`burakgon/ai-usage-menubar`) — 가벼운 네이티브 메뉴 막대

- **플랫폼:** macOS 26+ 네이티브 메뉴 막대. Dock 아이콘·상시 창·서버·텔레메트리·사용량 이력을 두지 않는다고 설명.
- **지원:** Claude Code, Codex, Cursor, Antigravity, GitHub Copilot, Devin, Grok.
- **수집:** 기존 도구가 만든 자격증명을 재사용하고 각 제공자의 first-party quota endpoint를 직접 호출. 자격증명을 로그/외부 전송하지 않으며, 실패 시 메모리의 마지막 성공값을 stale 표시.
- **기능:** 제공자·metric 선택, remaining/used 전환, 1/5/15/30/60분 갱신, launch at login, Sparkle 서명 업데이트.
- **가격·개인정보:** MIT, 무료 배포로 보이나 상용 가격은 확인 필요. 공개 README상 외부 전송·지속 캐시 없음.
- **규모·활동:** 31 stars, 9 forks, 30 commits. 정확한 최신 커밋 날짜는 확인 필요.
- **시사점:** stale을 숨기지 않는 UX와 “공급자별 metric을 선택”하는 구조가 TokenJuice에 직접 적용할 만하다.

#### UsageBar (`lucas-barake/usagebar`) — Claude/Codex만 단순하게

- **플랫폼:** macOS 14+, Apple Silicon·Intel 메뉴 막대.
- **지원:** Claude Code와 OpenAI Codex.
- **수집:** Codex `codex app-server`의 `account/rateLimits/read`; Claude Keychain OAuth token으로 `GET /api/oauth/usage`. Claude 토큰은 갱신하지 않고, 만료 시 사용자가 Claude CLI를 한 번 실행해야 한다고 문서화한다. 5분 주기·429 재시도·최대 1시간 last reading fallback.
- **기능:** 짧은/긴 window, reset time, Claude/Codex 중 높은 값 표시, 둘 다 표시, spend 시 red label.
- **가격·개인정보:** MIT, 별도 서버 업로드 없음. ad-hoc signed/not notarized라는 설치 위험을 스스로 고지.
- **규모·활동:** 7 stars, 1 fork, 13 commits. 최신 커밋 날짜는 확인 필요.
- **시사점:** TokenJuice의 현재 Claude 경로와 구조가 매우 유사하다. 따라서 토큰 갱신·stale·429 안내가 차별화 포인트가 될 수 있다.

#### ClaudeBar (`chiliec/ClaudeBar`) 및 Claude Usage (`Bread-bang/claude-usage`)

- **플랫폼/기능:** 둘 다 macOS 메뉴 막대. ClaudeBar는 5시간·7일 전체/Sonnet/Opus와 reset countdown, 5분/수동 갱신, Keychain, Pro/Max 감지를 제공한다. Claude Usage는 session·weekly·Sonnet·credits와 pane별 context/token 상태를 함께 보여 준다.
- **수집:** ClaudeBar는 Keychain의 세션 키와 Claude 사용량 API를 사용한다고 설명한다. Claude Usage는 backend·telemetry·cookie 없이 Keychain과 Anthropic endpoint를 사용하고, 마지막 정상값과 backoff를 유지한다고 설명한다.
- **오픈소스 정보:** ClaudeBar 5 stars, 1 fork, MIT, 193 commits. Claude Usage 10 stars, 1 fork, MIT, 31 commits. 두 저장소 모두 2026-10-08 기준 최근 활동이 보였으나 정확한 최신 커밋 날짜는 확인 필요.
- **시사점:** quota와 context window를 분리해 보여 주는 설계가 유용하다. TokenJuice도 “계정 한도”와 “현재 세션 컨텍스트/토큰”을 같은 숫자로 혼동하지 않게 해야 한다.

#### Claude Monitor (`Yuefan/claude-monitor`) — Windows/Linux/macOS 트레이·CLI

- **플랫폼:** Windows/Linux/macOS의 Python GUI·system tray·CLI.
- **수집:** 기본은 `~/.claude/projects`의 JSONL transcript를 읽는 로컬 방식이라 네트워크/API 키가 필요 없다. 선택 기능인 Account Quota는 기존 Claude Code 세션을 재사용해 Anthropic account API를 한 번 호출한다.
- **기능:** 30초 자동 새로고침, 5시간 rate-limit 추정, burn rate, 잔여 바, 7일·일간·월간·모델별·프로젝트별 리포트, EN/中文 UI.
- **오픈소스 정보:** MIT, 0 stars, 1 fork, 3 commits. 최신 활동/실사용 평판은 확인 필요.
- **시사점:** Windows 트레이판을 가진 TokenJuice가 참고할 수 있는 “로컬 추정값 vs 실제 계정 quota” 분리 사례다.

### 4.3 일본어 검색에서 확인된 후보

아래는 일본어 쿼리 `Claude 使用量 メニューバー`, `Claude Code 使用量 可視化`, `Codex 使用量 メニューバー`로 확인된 후보다. 일본 운영자/법인이라는 뜻은 아니며, 국가·가격·다운로드 수는 확인 필요로 남긴다.

| 서비스 | 플랫폼·지원 | 수집/기능 | OSS 상태 |
|---|---|---|---|
| [Usage4Claude](https://github.com/f-is-h/Usage4Claude) | macOS 메뉴 막대; Claude Free/Pro/Team/Max와 Codex | 5시간·7일·추가 사용량·Opus/Sonnet, Keychain 로그인, 알림, Claude의 Web/Code/Desktop/Mobile/Cowork를 한 제품 설명에 묶음 | README 일본어판 제공; MIT·stars·최근 커밋은 확인 필요 |
| [AgentLimits](https://github.com/Nihondo/AgentLimits/blob/main/README_ja.md) | macOS Sonoma+ 메뉴 막대·알림센터 위젯; Codex·Claude Code·Copilot·커스텀 스크립트(Cursor/Antigravity 예시) | 앱 내 WebView에서 chatgpt.com/claude.ai/github.com 로그인, 1~10분 갱신, provider별 표시/순서, 데이터 삭제 | 개발 중; license·stars·최근 커밋은 확인 필요 |
| [AI Usage Bar](https://github.com/TentoSwift/AIUsageBar) | macOS 메뉴 막대; Claude 5시간/주간/모델별 및 Codex 주간 | 공식 사용률이라고 설명하며 토큰 추정과 구분; `api.anthropic.com`, `console.anthropic.com`, `chatgpt.com` 등 통신처 공개; 로컬 로그로 API 환산 비용 | 공개 저장소·18 commits 확인; license·stars·최근 커밋 날짜는 확인 필요 |
| [Claude Meters 소개](https://zenn.dev/yskms/articles/e41a22b59a8e6c) | macOS 메뉴 막대; Claude Session/Weekly | 5시간·주간 원형 미터와 reset countdown; 작성자는 기록·알림·예측은 거의 없다고 명시 | Zenn 공개 소개; 저장소·license·가격·다운로드는 확인 필요 |
| [Claude Code 로그 시각화](https://github.com/anestec-rd/visualize-claude-code-usage) | 업로드형 Web 앱 | JSON/로그를 모델·기간별 토큰·비용·리셋 일정으로 시각화 | 공개 저장소; stars·license·운영비·업로드 데이터 보존은 확인 필요 |

일본어 검색에서 반복해서 드러난 수요는 “메뉴 막대에 숫자를 계속 띄우기”보다 **Claude와 Codex를 함께 보고, 모델별/주간별/리셋 시점을 구분하고, 위젯·알림까지 연결하는 것**이었다. 다만 브라우저 WebView 로그인 방식은 편리한 대신 쿠키·세션 데이터 보호와 제공자 약관 검토가 필요하다.

### 4.4 경쟁 비교표

| 서비스 | 플랫폼 | AI 범위 | 데이터 경로 | 가격 | 개인정보/신뢰 특성 | 규모 지표 |
|---|---|---|---|---|---|---|
| AI Limits Tracker | iOS/macOS/watchOS/visionOS/Android·위젯 | Claude, Codex, Grok, Antigravity | 제공자 로그인/승인, Keychain/Keystore, CloudKit 스냅샷 | Free + Pro 월/년/Lifetime | 제공자와 직접 통신, JoCoding 분석·구매 연동 존재 | Google Play 5+ 다운로드; 평점 확인 필요 |
| CodexBar | macOS/Linux/트레이 | 매우 다수 | OAuth, CLI, API key, cookie, localStorage, 로컬 파일 | MIT; 유료 가격 확인 필요 | 소스별 보안 수준이 다름 | 22.3k stars, MIT |
| ccusage | CLI | 매우 다수의 CLI | 로컬 transcript/session | MIT | 로컬 중심, quota와 비용 추정 구분 필요 | 18.5k stars, MIT |
| AI Usage | macOS 26+ | Claude, Codex, Cursor, Antigravity, Copilot, Devin, Grok | 기존 자격증명 + first-party endpoint | MIT; 가격 확인 필요 | 외부 전송·지속 캐시 없음 주장, stale 표시 | 31 stars, MIT |
| UsageBar | macOS 14+ | Claude, Codex | Keychain + Anthropic usage API, Codex app-server | MIT | 5분 제한·429·last reading 설명 | 7 stars, MIT |
| ClaudeBar | macOS 14+ | Claude | Keychain + Claude usage API | MIT | 로컬 Keychain, 5분 갱신 | 5 stars, MIT |
| Claude Monitor | Win/Linux/macOS | Claude | 로컬 JSONL, 선택적 Anthropic account API | MIT | 기본 로컬, 실제 quota는 선택 기능 | 0 stars, MIT |
| Usage4Claude/AgentLimits/AI Usage Bar | macOS·위젯 | Claude/Codex/Copilot 등 | Keychain 또는 WebView 로그인·제공자 endpoint | 확인 필요 | 일본어 문서, 로그인/삭제 UX 참고 | stars/license 확인 필요 |

## 5. 시사점과 TokenJuice의 자리

### 그들이 잘하는 것

- 한눈에 볼 수 있는 링·막대·색상·reset countdown.
- 사용자에게 로그인/권한/위젯/알림을 단계적으로 안내하는 온보딩.
- 마지막 성공값, stale, retry/backoff, provider unavailable을 제품 언어로 번역.
- 계정별·모델별·짧은 window/긴 window를 별도 카드로 분리.
- CodexBar처럼 공급자 어댑터를 분리해 지원 범위를 빠르게 늘림.

### 그들이 못하거나 공개가 약한 것

- 어떤 값이 공식 quota인지, 로컬 로그 추정인지, API 환산 비용인지 한 화면에서 충분히 구분하지 못하는 경우가 많다.
- 브라우저 쿠키·localStorage·OAuth를 섞어 쓰면서 provider별 보안 수준과 약관 위험이 달라진다.
- 앱스토어의 다운로드·리뷰·실패율 등 운영 신뢰 지표가 공개되지 않는 경우가 많다.
- 수면 복귀, 조직 계정, 토큰 만료, 401/429의 원인과 복구 방법은 여전히 개발자 문서에 머문다.

### TokenJuice만의 자리

**“내 컴퓨터에 이미 있는 인증·로그만 읽고, 토큰/프롬프트/코드를 서버로 보내지 않으며, 공식값·로컬 추정·stale을 구분해 보여 주는 개인용 AI 코딩 한도계”**다. SwiftBar를 버리고 대형 앱으로 갈 필요보다, 현재의 설치 장벽을 낮추고 신뢰 상태를 명료하게 만드는 것이 먼저다.

### 5.1 고빈도 바이브코더 리서치 — 검증된 페인포인트와 제품 원칙

**조사일: 2026-10-08.** 아래는 시장 규모 추정이 아니라 공개된 공식 문서·Claude Code/Codex 공개 이슈·대규모 사용자 토론에서 반복되는 문제를, TokenJuice가 실제로 해결할 수 있는 범위로만 정리한 것이다. Reddit은 경험 신호이며 발생 빈도나 제공자 정책의 사실을 단독으로 증명하지 않는다.

| 반복 페인포인트 | 공개 근거 | 사용자가 실제로 원하는 것 | TokenJuice 제품 요구사항 |
|---|---|---|---|
| **한도가 왜·언제 소진되는지 모름** | Claude/Codex 사용자는 작은 작업 뒤 급격한 사용량 상승, 재개 세션의 비정상 소진, 서로 모순되는 한도 상태를 보고한다. OpenAI는 rate limit이 요청·토큰 등의 제한임을 공식 설명한다. | 남은 %만이 아니라 마지막 성공 시각, 리셋, 다음 재시도, 이상 징후를 즉시 판단 | UX2·UX3·UX7: “지금 위험한 한도 / 이유 / 다음 행동”을 최상단에. 제공자 공식값과 로컬 추정을 절대 혼합하지 않음 |
| **컨텍스트가 차면 품질 저하·멈춤·재작업** | Claude Code 공개 이슈에는 자동 compact 지연, compact 후 반복 팽창, 조용한 세션 정지 사례가 있다. Anthropic도 agent harness의 context 관리 지시를 권고한다. | 컨텍스트가 막히기 전에 경고받고, 새 세션/compact가 필요한 이유를 알고 싶음 | R17·R20·UX7: quota와 분리된 `로컬 컨텍스트` 경고, `추정` 라벨, 프로젝트별 handoff/export 제안. 자동 compact를 조작하지 않음 |
| **에이전트가 기다리는지·멈췄는지 모름** | 장기/백그라운드 세션에서 context edge 뒤 입력 대기 상태로 정지하는 공개 사례가 있다. | “작업 중 / 내 입력 대기 / 완료 / 주의 필요”를 작업 화면 밖에서 확인 | R17·UX8·UX9: 로컬 로그 기반 휴리스틱 상태를 quota와 구별해 메뉴바·트레이에 표시. 승인/배포 같은 행위를 대신 실행하지 않음 |
| **오류를 보고도 복구 방법을 모름** | 401, 429, 과부하, token/context 계측 불일치가 서로 다른 문제인데 최종 화면은 종종 동일한 실패로 보인다. | 재로그인, 대기, 새 스냅샷, 새 세션 중 무엇을 해야 하는지 | UX3: 상태별로 원인·영향·CTA를 하나만 제시. `retryAt`이 있으면 자동/수동 재시도 시간을 명시 |
| **모델/도구를 병행할 때 작업 흐름이 끊김** | 사용자는 한도 소진 시 다른 모델/도구로 전환하지만, 각 한도·컨텍스트·비용의 성격이 다르다. | 어떤 도구로 계속할지 판단할 최소 정보와 기록 | R7·R13·R20: Claude/Codex를 깊게 신뢰성 있게 먼저 지원. 외부 provider는 안전한 명시적 local file adapter만 허용 |
| **프라이버시와 설치 부담** | 파워유저는 쿠키·세션·코드 업로드에 민감하고, 한편 터미널 명령과 파일 전달만 요구하는 도구도 이탈을 만든다. | “무엇을 읽고 무엇을 보내지 않는지”는 쉽게 이해하면서도 설치는 간단해야 함 | UX4·UX5·UX10: 로컬-우선 약속을 온보딩·빈 상태·랜딩에 반복하고, 명령어는 도움말의 점진적 공개로 이동 |

#### 바이브코더 제품 원칙

1. **모니터링은 숫자가 아니라 다음 결정을 줄여야 한다.** 가장 중요한 화면은 차트가 아니라 `계속 진행 / 잠시 대기 / 다시 연결 / 새 세션 시작` 중 하나를 고르게 해야 한다.
2. **quota, context, 비용, 에이전트 상태는 서로 다른 데이터다.** 같은 게이지나 하나의 “사용량” 수치로 합치지 않는다.
3. **추정치보다 거짓 확신이 위험하다.** 모든 추정·fallback·오래된 값에는 출처와 마지막 성공 시각을 붙이고, 불확실하면 숫자를 숨긴다.
4. **보조 도구는 사람의 승인권을 빼앗지 않는다.** TokenJuice는 상태를 설명하고 안전한 다음 행동으로 연결하되, compact·모델 전환·커밋·배포를 자동 실행하지 않는다.
5. **무료 코어의 첫 성공 경험은 60초 이내여야 한다.** 설치 후 첫 화면에서 사용자가 자신의 데이터 또는 이해 가능한 데모를 보고, 개인정보 경계를 이해해야 한다.

#### 이 리서치의 우선순위 결론

`제공자 수 확대`보다 **UX1~UX9(신뢰 상태, 컨텍스트/세션 분리, 복구, 온보딩, 행동형 알림)**가 우선이다. 자동 cloud sync·팀 분석·원격 제어는 현재의 로컬-우선 약속과 제품 집중도를 해칠 수 있으므로, P0/P1 성공 지표가 확인될 때까지 보류한다.

### 5.2 왜 바이브코더는 직접 만들거나 OSS를 조립하지 않고 제품을 선택하는가

이 항목은 구매자의 역량 부족을 전제로 하지 않는다. 고빈도 사용자는 오히려 구현 능력이 있어도 **주의력·신뢰·유지보수 비용**을 줄이는 제품을 선택할 수 있다. Cursor는 설치 뒤 빠른 시작과 재실행 가능한 온보딩을 제공하고, 사용량·한도·보안 설정을 제품 화면에 묶는다. Cursor의 Background Agent는 실행 상태·원격 환경·hand-off를 제품 표면에서 관리한다. Product Hunt의 ClaudeUsageBar 후기와 최신 session 분석 제품들은 “매번 설정 화면을 열지 않는 한눈 확인”, “agent가 실제로 무엇을 했는지의 요약”, “설치 후 바로 동작”을 가치로 제시한다. 이는 각 사업자의 마케팅/이용자 후기이며 시장 전체 통계로 일반화하지 않는다.

| 직접 개발/OSS 조립을 피하는 이유 | 사용자가 실제로 사는 것 | TokenJuice 제품 요구사항 | 금지선 |
|---|---|---|---|
| 업데이트·provider 변경을 계속 따라갈 시간이 없음 | 지원되는 데이터 경로, 회귀 테스트, 오류가 나도 안전하게 숨기는 기본값 | provider 계약·fixture·상태 모델을 유지하고, `마지막 성공`·`현재 값 아님`을 기본 표기 | 추정값을 실시간 한도처럼 표시하지 않음 |
| 수치를 봐도 다음 행동이 불명확 | `계속/대기/재연결/새 세션` 중 하나로 줄여 주는 판단 | 첫 화면의 위험 1건, 상태별 단일 CTA, reset/retry 시각 | 자동 compact·모델 전환·커밋·배포를 대신 실행하지 않음 |
| 설치·명령·파일 경로를 매번 기억하고 싶지 않음 | 설치 후 즉시 보이는 가치와 되돌릴 수 있는 안내 | 메뉴의 **Pocket으로 내보내고 열기**, 빈 화면 데모, 3단계 온보딩 | 숨은 로그인·백그라운드 업로드·강제 계정 생성 금지 |
| 프롬프트·코드·세션을 대시보드에 맡기기 불안함 | 무엇을 읽고 어디로 보내는지 분명한 경계 | 로컬 우선, 명시적 파일 import, 자격증명/프롬프트/코드 미전송을 화면에 표시 | 기본 제품에 세션 원문·쿠키·browser session 수집 금지 |
| 에이전트가 백그라운드에서 끝났는지·막혔는지 놓침 | OS 맥락에서 보이는 요약·알림·handoff | 메뉴바/트레이 상태와 향후 opt-in 알림, 컨텍스트·quota 분리 | 로컬 휴리스틱을 제공자 사실처럼 표시하지 않음 |

#### 제품 포지셔닝과 BM 시사점

- **무료 OSS와의 경쟁 축은 기능 수가 아니라 ‘설치 후 잊어도 되는 신뢰성’**이다. 무료 코어는 로컬·비밀값 미수집·오프라인 동작을 유지해 검증 가능해야 한다.
- **유료화 대상은 숫자 자체가 아니라 유지보수와 의사결정 비용 절감**이다. 다중 기기 알림, 서명된 업데이트, 다중 계정별 복구 우선순위, 지원 응답처럼 지속 운영이 필요한 가치만 후속 검증한다.
- **지원/신뢰가 제품의 일부**다. provider 변경 감지, 안전한 실패, 진단 복사, 호환성 표, 명확한 삭제 경로를 출시 범위로 취급한다.
- 2026-10-08 착수: macOS 메뉴의 `Pocket으로 내보내고 열기`는 로컬 snapshot을 만든 뒤 정적 Pocket을 연다. 자동 업로드·로그인·토큰 전달은 하지 않는다.

## 6. 업데이트 기능 백로그

점수는 초기 RICE가 아니라 우선순위용 **영향(I) 1~5 × 긴급도(U) 1~5 ÷ 노력(E) 1~5**로 표시한다. 점수는 개발 전 검증용이며 확정 추정치가 아니다.

| ID | 기능 | 문제/가치 | I | U | E | 점수 | 단계 |
|---|---|---|---:|---:|---:|---:|---|
| R1 | 데이터 상태 모델: `fresh / stale / unavailable / rate_limited / auth_expired / fallback` | 숫자의 신뢰성 회복 | 5 | 5 | 2 | 12.5 | v1.1 |
| R2 | 마지막 성공 시각·데이터 경로·다음 재시도 시각 표시 | 401·429·Desktop fallback 원인 파악 | 5 | 5 | 2 | 12.5 | v1.1 |
| R3 | 토큰 만료 복구를 명시적 상태·사용자 실행 안내로 전환 | CLI 백그라운드 실행 의존의 예측 불가능성 감소 | 5 | 5 | 3 | 8.3 | v1.1 |
| R4 | 429 Retry-After 카운트다운·재시도 폭주 방지 | 차단 악화 방지 | 4 | 5 | 2 | 10 | v1.1 |
| R5 | 절전 전후·SwiftBar 미표시 감시와 단일 refresh debounce | 현재 절전 복구 문제의 지속 방지 | 4 | 5 | 2 | 10 | v1.1 |
| R6 | 임계치/리셋 임박 알림, 소진 예측 알림 | 사용 중단을 미리 예방 | 5 | 4 | 3 | 6.7 | v1.1 |
| R7 | Claude/Codex 카드에 공식 한도와 로컬 토큰/컨텍스트를 분리 | quota와 cost/context 혼동 방지 | 5 | 4 | 3 | 6.7 | v1.1 |
| R8 | 진단 메뉴: 복사 가능한 비밀값 없는 상태 보고서 | 사용자가 문제를 설명할 수 있게 함 | 4 | 4 | 2 | 8 | v1.1 |
| R9 | 첫 실행 온보딩/권한·키체인 선택 안내 | unknown 계정·잘못된 계정 선택 감소 | 4 | 4 | 3 | 5.3 | v1.2 |
| R10 | 다중 Claude/Codex 계정 별칭·계정별 상태 | Team/개인 계정 병행 | 4 | 3 | 4 | 3 | v1.2 |
| R11 | Windows 트레이와 macOS 표시 상태/알림 UX 통일 | 사용자 범위 확대 | 4 | 3 | 4 | 3 | v1.2 |
| R12 | iPhone/Android 위젯 또는 companion | 모바일 가시성 | 4 | 2 | 5 | 1.6 | PWA local export 구현 |
| R13 | 제공자 어댑터: Cursor/Antigravity/Copilot 등 | 시장 확장 | 4 | 2 | 5 | 1.6 | Copilot 비용 + 안전한 local quota-file adapter 구현 |
| R14 | 선택적 CloudKit/동기화 | 여러 기기·위젯 | 3 | 2 | 5 | 1.2 | 암호화 수동 전달 구현; 자동 CloudKit 검토 |
| R15 | 공개 데이터 계약/fixture·회귀 테스트 | endpoint 변경 대응 | 5 | 4 | 4 | 5 | v1.1 |
| R16 | 제공자·데이터 경로 신뢰 배지 | 공식 quota/API·로컬 집계·추정 비용·stale을 구별 | 5 | 5 | 2 | 12.5 | v1.1 |
| R17 | 세션 상태 선택 기능 | 완료·대기·승인 필요·실행 중을 quota와 연결 | 4 | 3 | 4 | 3 | v1.2 |
| R18 | “이번 주 소진 예상” pace forecast | CUStats류의 행동형 예측 수요 대응 | 5 | 3 | 3 | 5 | v1.2 |
| R19 | Mac notch/위젯용 compact view | AgentPeek·AgentNotch류의 glanceability 수요 대응 | 3 | 2 | 4 | 1.5 | 구현 |
| R20 | 세션·프로젝트별 비용/컨텍스트 리포트 | Claudoscope·ccusage류와의 인접 영역 확보 | 4 | 2 | 5 | 1.6 | 구현; 사용자 가격표/완전 토큰분해가 있을 때만 비용 |

### 6.1 상품성 UI/UX 리뉴얼 투두 — AI Limits 대비 출시 게이트

**판단(2026-10-08):** 현재 TokenJuice는 데이터 신뢰성 엔진은 출시 가능 수준이나, 소비자 제품 표면은 AI Limits Tracker보다 뒤처진다. 특히 Pocket은 `--export-widget-snapshot` 등의 명령을 알아야 하는 스냅샷 뷰어여서, 일반 개발자가 처음 열고 즉시 가치를 이해·구매하기 어렵다. 아래 항목은 제공자 수 확대나 유료화보다 먼저 닫아야 할 **상품성 출시 게이트**다.

| 우선 | ID | 할 일 | 완료 기준 | AI Limits에서 확인한 근거 |
|---|---|---|---|---|
| P0 | UX1 | **단일 상태 언어와 디자인 토큰** 정의 | SwiftBar·Windows 트레이·Pocket에서 `방금 확인됨 / 업데이트 필요 / 다시 연결 / 다음 확인 시각`의 이름·아이콘·색이 동일. 색만으로 상태를 전달하지 않음 | 남은량·리셋·연결 문제를 한 화면 언어로 정규화 |
| P0 | UX2 | **기본 운영 화면** 제작 | 첫 화면에서 가장 긴급한 한도 1개와 Claude/Codex 요약을 보여 줌: 남은 %, 리셋까지, 소진 예상, 마지막 성공 시각, 신뢰 배지, 단일 주 CTA | Limits 화면이 `remaining → runs out/ahead → reset`으로 빠른 결정을 돕도록 설계됨 |
| P0 | UX3 | **오류를 복구 흐름으로 변환** | `stale/401/429/데이터 없음`마다 원인·영향·다음 행동 1개를 제공. 예: “Claude를 다시 연결하세요”, “14:30에 다시 확인합니다”. 개발자 명령어를 기본 UI에서 노출하지 않음 | reconnect needed·usage update needed를 독립 사건으로 안내 |
| P0 | UX4 | **첫 실행 온보딩 재설계** | 3단계 이내: ① 무엇을 읽는가 ② Claude/Codex 상태 확인 ③ 알림 선택. 건너뛰기·뒤로가기 제공. 비밀값·프롬프트·코드 미전송을 명시 | provider 목록의 Connect 흐름, 연결 후 짧은 신규 사용자 투어 |
| P0 | UX5 | **Pocket을 소비자용 동반 화면으로 재정의** | 빈 화면에 명령어 대신 “Mac에서 내보내기” 안내와 예시 데이터 미리보기, 가져오기 성공 피드백, 최신성/오프라인 상태, 재내보내기 방법을 제공 | iPhone 위젯/앱을 열지 않아도 현재 한도를 읽게 하는 구조 |
| P0 | UX6 | **정보 접근성·가독성 검수** | 본문 대비 4.5:1 이상, 터치 영역 44px 이상, 키보드 포커스·스크린리더 라벨, 작은 화면 375px·데스크톱·다크 모드·reduced motion 검증 | 최신 위젯도 light mode 가독성과 고갈 상태 식별을 별도 개선 |
| P1 | UX7 | **행동형 한도 해석** | “주간 한도 61% 남음”만이 아니라 `여유 있음 / 이 추세면 HH:MM 소진 / 리셋까지 N일`을 표시. 예측은 ‘로컬 추정’ 라벨과 함께 opt-in | `Runs out`, `Ahead`, `On pace`로 원시 퍼센트를 행동 언어로 변환 |
| P1 | UX8 | **알림 센터와 설정 UX** | 계정·한도별 임계치, 리셋, 재연결 필요를 개별 제어. 알림마다 이유·끄기·다음 예정 시각을 확인 가능 | 임계치·리셋·credit 만료·재연결을 분리하고 OS 예약 알림을 활용 |
| P1 | UX9 | **메뉴바 상세 패널/미니 위젯** | 픽셀 헤더는 브랜드 자산으로 유지하되, 클릭 후에는 데이터 카드와 복구 CTA를 표시. compact/notch 환경에서도 한도·상태가 잘림 없이 보임 | Panel과 edge island 중 표시 방식을 선택하게 함 |
| P1 | UX10 | **제품 랜딩·설치 경로** | 한 줄 가치 제안, 실제 화면, 3단계 설치, 개인정보 경계, 지원 OS, FAQ, 릴리스 다운로드를 하나의 랜딩에 제공. GitHub만 보고 설치하게 하지 않음 | 하나의 페이지에서 가치·기기·연결·개인정보·다운로드를 완결 |
| P2 | UX11 | **네이티브 모바일/위젯 타당성 검증** | PWA 수동 가져오기 사용률과 모바일 대기자 수를 측정한 뒤 iOS/Android/Watch 중 하나만 선택. 자동 동기화 전에는 위젯에 자격증명 미보관 | 홈/잠금화면·Watch·Mac을 동기화해 반복 확인 비용을 줄임 |
| P2 | UX12 | **유료 전환 화면과 Supporter 실험** | 무료 범위·유료 가치·가격·환불/지원·데이터 처리 범위를 명확히 한 실제 결제 전 대기자/가격 테스트. 유료 기능을 막연한 색상 변경으로 구성하지 않음 | Free 1계정과 Pro 다계정·위젯의 경계를 명확히 제시 |

UX1 진행 현황(2026-10-08): Pocket과 macOS 메뉴바·Windows 트레이에 동일한 사람 중심 상태명(방금 확인됨/대체 정보/업데이트 필요/다시 연결 필요/제공자 제한 중/확인할 수 없음)을 적용했다. JSON과 CLI의 기계 상태값은 호환성을 위해 변경하지 않는다.

#### P0 출시 체크리스트

- [ ] 첫 화면을 본 지 10초 안에 “지금 가장 위험한 한도”, “숫자의 최신성”, “다음 행동”을 말할 수 있다.
- [ ] 첫 실행 사용자가 터미널 명령·OAuth 내부 구조·파일 경로를 몰라도 Claude/Codex의 현재 상태를 이해한다.
- [ ] `fresh`, `stale`, `401`, `429`, fallback 각각에 색 외의 텍스트·아이콘·복구 CTA가 있다.
- [ ] 빈 상태는 빈 카드가 아니라 데모 데이터·가져오기 방법·개인정보 약속을 함께 제공한다.
- [ ] Pocket, 메뉴바, Windows 트레이가 동일한 상태 명칭과 우선순위를 사용한다.
- [ ] 작은 모바일(375px), 데스크톱, 다크 모드, 큰 텍스트, 키보드만으로 핵심 흐름을 검증했다.
- [ ] 사용자 테스트 5명 중 4명 이상이 도움 없이 “마지막 성공 시각”과 “재연결 방법”을 찾는다.

#### UI 방향 결정

- **유지할 것:** TokenJuice의 픽셀 배터리 헤더와 로컬-우선 신뢰 정체성.
- **바꿀 것:** Pocket의 레트로/터미널 중심 첫 인상과 명령어 노출. 상세 화면은 차분한 데이터 카드·막대·명확한 서체를 사용한다.
- **피할 것:** AI Limits의 iCloud/분석 SDK 구조를 그대로 복제하거나, 제품 표면이 준비되기 전에 제공자·차트를 계속 추가하는 일.
- **디자인 원칙:** 한 화면에 주 행동은 하나, 사용량 막대는 전체 트랙을 보여 주고, 경고는 빨강만이 아닌 문구·아이콘·시간을 함께 제공한다.

## 7. 단계별 로드맵과 완료 기준

### v1.1 — 신뢰성·진단·알림

범위: R1~R8, R15.

완료 기준:

- 모든 화면에 상태가 `fresh/stale/unavailable/auth_expired/rate_limited/fallback` 중 하나로 표시된다.
- 마지막 성공 시각, 사용한 경로, 다음 시도 가능 시각을 비밀값 없이 표시한다.
- 401·429·네트워크 실패·Desktop 기록 미갱신을 서로 다른 메시지로 재현할 수 있다.
- 429의 Retry-After 동안 추가 요청을 하지 않는다.
- 절전 후 5분 내 한 번만 복구 새로고침하고 중복 refresh가 발생하지 않는다.
- 5시간/주간 reset 임박과 잔여 임계치 알림을 사용자가 끄고 켤 수 있다.
- 공식 quota, 로컬 집계, 추정 비용, stale 값에 서로 다른 라벨이 붙는다.
- 회귀 fixture로 401·429·빈 키체인·잘못된 계정·오래된 fallback을 자동 검증한다.

### v1.1.1 — 상품 표면·복구 UX (다음 개발 스프린트)

범위: UX1~UX6.

완료 기준:

- Pocket과 데스크톱 상세 화면이 명령어가 아닌 사용자의 현재 한도와 다음 행동을 먼저 보여 준다.
- 모든 데이터 카드에서 출처·마지막 성공 시각·상태·복구 행동을 동일한 컴포넌트로 표시한다.
- 신규 사용자가 빈 상태에서 3단계 이내에 첫 유효 데이터를 확인하거나, 확인 불가 원인과 해결책을 이해한다.
- 375px/데스크톱/다크 모드/a11y 검수와 5명 사용성 테스트를 통과한다.
- 실제 화면·개인정보 경계·설치 경로가 있는 제품 랜딩 초안이 준비된다.

### v1.2 — 온보딩·계정·Windows 일관성

범위: R9~R11, UX7~UX10.

완료 기준:

- 최초 실행 시 필요한 권한과 읽는 데이터 경로를 설명하고, 토큰·코드·프롬프트를 외부로 보내지 않는 정책을 화면에 명시한다.
- 사용자가 계정 별칭과 현재 선택된 계정을 확인할 수 있다.
- macOS와 Windows에서 fresh/stale/error/알림 의미가 동일하다.
- 복구 명령은 자동 실행 여부와 사용자 실행 선택을 분명히 구분한다.
- 예측은 `로컬 추정`임을 명시하고, 소진 예상·임계치·리셋·재연결 알림을 사용자가 통제한다.
- GitHub 릴리스 외에도 제품 랜딩에서 지원 OS·설치·삭제·개인정보·지원 경로를 확인할 수 있다.

### v2.0 — 확장 플랫폼·제공자

범위: R12~R14, UX11 및 검증된 R13 어댑터.

완료 기준:

- 새 제공자마다 데이터 경로·인증 범위·공식/비공식 여부·약관 위험·실패 fixture가 문서화되어 있다.
- 모바일/위젯은 자격증명을 보유하지 않고, 마지막 성공 스냅샷과 상태 시각만 받는다.
- 동기화 선택을 끄면 외부 동기화가 발생하지 않는다.
- 개인정보처리방침·앱스토어 라벨·삭제 동작이 실제 구현과 일치한다.

## 8. 기술 설계 요점

### 8.1 데이터 계층

```text
Provider adapter
  ├─ Anthropic official-ish usage response
  ├─ Claude Desktop local history fallback
  └─ Codex local session/rate-limit data
        ↓
Normalizer (window, used, remaining, reset, source, observedAt)
        ↓
Trust state (fresh/stale/error/auth/rate-limit/fallback)
        ↓
Menu bar / tray / notification / future widget
```

정규화 객체에는 최소한 `provider`, `accountAlias`, `window`, `used`, `remaining`, `resetAt`, `source`, `observedAt`, `lastSuccessAt`, `state`, `retryAt`, `errorCode`가 필요하다. 토큰·쿠키·원문 응답·프롬프트·코드는 표시/로그/진단 보고서에서 제외한다.

### 8.2 인증 갱신

- 1순위는 제공자가 실제로 발행한 사용량/세션 경로다.
- OAuth 토큰 만료를 감지하면 즉시 무한 재시도하지 말고 `auth_expired`로 전환한다.
- 기존의 `claude -p /usage --no-session-persistence` 백그라운드 갱신은 실제 환경에서 모델 호출 0회라는 전제가 깨지지 않는지 버전별 fixture와 사용자 안내로 검증해야 한다. 자동 실행은 10분 제한과 사용자 중지 옵션을 유지한다.
- `acct="unknown"` 같은 키체인 항목은 자동 삭제하지 않는다. 선택된 계정명·서비스명·읽기 성공 여부만 비밀값 없이 진단한다.
- 여러 계정은 “현재 사용 계정”을 명시하고, 계정 전환은 사용자가 직접 확인한다.

### 8.3 비공식 API·약관 위험

Anthropic의 `/api/oauth/usage`, Codex의 app-server rate limit 경로, Cursor·기타 서비스의 브라우저 세션 경로는 제공자별 공개 범위가 다르다. AI Limits Tracker의 약관도 제공자 API·인증·데이터 형식 변경 및 rate limit 가능성을 명시한다. 따라서 어댑터마다 다음을 기록한다.

1. 공개 공식 문서가 있는가.
2. 호출 대상과 필요한 인증 범위는 무엇인가.
3. 사용량 요청이 모델 호출/과금/토큰 소비를 일으키는가.
4. 제공자 약관·조직 정책과 충돌할 가능성이 있는가.
5. 실패 시 마지막 값, 로컬 대체값, “확인 불가” 중 무엇을 보여 주는가.

기본 정책은 **읽기 전용·최소 권한·로컬 보관·원문 미저장·명시적 stale 표기**다. 브라우저 쿠키 자동 수집은 v2.0 이후 별도 검토하고, 먼저 수동 연결 또는 공식 CLI/앱이 저장한 자격증명만 지원하는 편이 안전하다.

## 9. 측정 지표·리스크·확인 필요 목록

### 9.1 측정 지표

- 데이터 신선도: 성공 응답의 p50/p95 지연, stale 상태 평균 시간.
- 수집 성공률: provider·상태별 401/429/네트워크/파싱 실패율.
- 복구성: 절전 복귀 후 5분 내 정상화율, 수동 조치 없이 다음 갱신까지 정상화율.
- 사용자 신뢰: “현재 값이 최신인지 알 수 있다” 설문, stale 상태에서 잘못된 값으로 행동한 사례.
- 알림 품질: 알림 후 실제 한도 도달 전 대응률, 오탐/중복 알림률.
- 운영 안정성: SwiftBar/Bun crash, Windows tray 재시작, CPU·네트워크 요청 수.
- 보안: 로그·진단·문서에 토큰/쿠키/프롬프트가 남은 건수 0.

### 9.2 리스크와 대응

| 리스크 | 대응 |
|---|---|
| Anthropic/OpenAI endpoint 변경 | 어댑터·정규화·fixture 분리, 응답 schema 감시, 실패 시 확인 불가 표시 |
| 토큰 자동 갱신이 예기치 않은 세션/호출을 만듦 | 기본 비활성 또는 명확한 사용자 선택, 실행 전 설명, 호출 0회 검증 |
| Team 조직 정책 위반 | 관리자/조직 약관 확인, 개인용 로컬 읽기 범위 명시 |
| 오래된 값이 최신처럼 보임 | 상태·마지막 성공 시각·source를 항상 표시 |
| 쿠키/키체인 유출 | 외부 업로드 금지, 로그 redaction, 최소 권한, 자동 삭제 금지 |
| 알림/refresh 폭주 | Retry-After·exponential backoff·debounce·절전 전후 상태머신 |
| 모바일 위젯이 자격증명을 요구 | 스냅샷 전용 구조로 제한, v2.0 전 보안 검토 |

### 9.3 확인 필요 목록

- Claude Team/KAIST OverEdge 조직에서 사용량 API 및 CLI 갱신을 허용하는지.
- `claude -p /usage --no-session-persistence`가 현재 Claude CLI 버전에서도 모델 호출 0회인지.
- Claude Desktop `plan-usage-history.json`의 기록 보존 기간·Team 계정별 의미·24시간 트레이 조건이 공식 문서로 확인되는지.
- Codex `rate_limits`의 primary/secondary 필드 의미와 reset 시각이 모든 로그인 방식에서 동일한지.
- macOS Keychain에 동일 서비스·여러 계정이 있을 때 안정적인 선택 키.
- SwiftBar/Bun/LaunchAgent의 절전 복귀·재로그인·네트워크 전환별 실제 성공률.
- AI Limits Tracker의 Android 상세 개인정보 범주, 실제 평점·리뷰 수·다운로드 규모.
- 비교 대상 각 GitHub 프로젝트의 운영자 국가, 최신 커밋 날짜, 라이선스가 확인 필요로 남은 항목.
- 새 제공자의 공개 API·약관·조직 정책·앱스토어 심사 가능성.
- 모바일/CloudKit을 추가할 경우 동기화 암호화 모델과 삭제 검증.

## 10. 최신 비즈니스 발굴 채널 추가 조사

### 10.1 Product Hunt에서 확인한 2026년 제품 흐름

Product Hunt는 사용량 트래커 자체의 시장 규모를 증명하는 자료는 아니지만, 초기 제품이 어떤 문제를 상품화하고 어떤 가격·기능으로 반응을 얻는지 확인하는 데 유용하다. 2026-10-08에 직접 확인한 관련 런치 페이지의 팔로워·업보트·리뷰는 **고객 수가 아니라 플랫폼 내 관심 신호**로 해석한다.

| 제품 | 공개된 포지셔닝·기능 | 가격/초기 신호 | TokenJuice에 주는 시사점 |
|---|---|---|---|
| [CUStats](https://www.producthunt.com/products/custats) | Claude·Codex를 중심으로 macOS 메뉴바·iOS, Android 예정; 다중 계정, 5시간/7일/모델별 한도, pace prediction, 이력 차트, 새 세션 트리거 | Product Hunt 51 followers, 리뷰 없음. 공식 사이트는 Mac $9.99 일회성, iOS US$8.99부터, 유료 사용자 338+라고 공개 | “보여주기”에서 “이번 주에 소진할지 예측하고 행동하게 하기”로 확장. 일회성 결제와 모바일 동반앱이 실제 사업 모델로 제시됨 |
| [AgentPeek](https://www.producthunt.com/products/agentpeek) | Mac notch/menu bar에서 26개 코딩 에이전트의 세션·권한·토큰·비용·로컬 서버를 통합 관찰 | Product Hunt 325 followers. 공식 가격은 3일 체험 후 Mac 1대 $14.99, 2대 $24.99, 3대 $34.99; 구독 없음 | 사용량만이 아니라 세션·승인·로컬 개발환경을 묶은 “agent command center”가 더 높은 지불가치를 가짐 |
| [AgentNotch](https://www.producthunt.com/products/agentnotch) | Claude·Cursor·Codex 등 세션, 질문·승인, 완료 알림, plan limit을 Mac notch에서 통합 | Product Hunt 111 followers, 리뷰 없음. 공식 사이트는 3일 체험 후 $9.99 일회성, v2.1.8 표시 | 알림의 핵심 대상은 단순 임계치뿐 아니라 “에이전트가 나의 입력을 기다림/끝남”이다. 다만 TokenJuice의 1차 범위는 quota 신뢰성으로 제한 |
| [Claudoscope](https://www.producthunt.com/products/claudoscope) | Claude Code 로컬 JSONL을 읽어 세션 검색·프로젝트별 비용·컨텍스트·secret scanning·CLAUDE.md/skills/hooks 점검 | 무료·오픈소스·MIT·로컬/무텔레메트리로 소개. Product Hunt 135 followers, 리뷰 없음 | quota tracker와 별개로 “사용량을 줄이고 안전하게 만드는 observability”가 인접 시장. R20의 근거 |
| [ClaudeUsageBar](https://www.producthunt.com/products/claudeusagebar) | Claude session/weekly 사용률, reset 시각, 25/50/75/90% 알림, global shortcut, cookie 로컬 보관 | 무료 오픈소스·Product Hunt 571 followers·5.0/1 review·401 upvotes. 리뷰에는 Cursor/Antigravity/Codex 지원 요청이 있음 | 무료 단일 기능 제품도 관심을 모을 수 있음. 제공자 확장은 실제 사용자 피드백에서 반복 요청되는 영역 |
| [Usage4Claude](https://www.producthunt.com/products/usage4claude) | Web·Claude Code·Desktop·Mobile의 합산 Claude quota, 색상 알림, adaptive refresh, 로컬 Keychain | 무료·Product Hunt 72 followers, 109 upvotes, 리뷰 없음 | Claude 사용자가 “Code만”이 아니라 모든 표면의 공유 quota를 기대한다는 메시지. TokenJuice의 Desktop fallback을 제품 설명으로 승격할 필요 |
| [AgentQuartz](https://www.producthunt.com/products/agentquartz) | Claude·Cursor 메뉴바, 원형/막대/호 gauge, 로컬 설정·session material | 무료 기본 + Pro $3 일회성, 비공식·현재 unsigned build로 공개 | 소액 일회성 unlock은 메뉴바 유틸리티에 자연스러운 가격대. 서명·업데이트 신뢰가 유료 기능보다 먼저 해결되어야 함 |
| [CodexBar Lite](https://www.producthunt.com/products/codexbar-lite) | 기존 Codex CLI 세션만 사용해 Codex usage/reset/알림 표시; Chrome cookie·Keychain·API key·제3자 계정 불필요 | 무료 오픈소스; Product Hunt 101 followers, 4.0/1 review, 84 upvotes | “zero-trust” 수집 방식이 명확한 차별화가 됨. TokenJuice도 source별 권한 면적을 UI에 보여야 함 |
| [BlackFlare](https://www.producthunt.com/products/blackflare) | Claude Code·Codex 메뉴바, Mac 깨우기, 세션 완료/승인 대기 알림, plan usage | Product Hunt 150 followers, 4.0/1 review, 102 upvotes | 절전 복구와 에이전트 완료 알림은 별도 기능이 아니라 같은 “작업을 놓치지 않기” 문제의 일부 |
| [tablo](https://www.producthunt.com/products/tablo-a-desktop-cat-widget?launch=tablo-4) | Claude Code·Codex 세션별 context meter, tool approval, 입력 필요 시 widget 알림 | Product Hunt 192 followers, 2026 출시, 가격 확인 필요 | TokenJuice가 context 표시를 넣을 경우 계정 quota와 세션 context를 별도 층으로 설계해야 함 |
| [Opaline](https://www.producthunt.com/products/rudel?launch=opaline) | Claude Code·Codex 팀의 메시지 단위 token cost·시간·skill 사용 분석; Rudel에서 팀 분석으로 확장 | Product Hunt 431 followers, 5.0/1 review, 이번 주 출시 표시 | 개인 메뉴바와 팀 비용/생산성 분석은 다른 시장. TokenJuice는 기본적으로 개인 로컬 제품으로 남고, 팀 기능은 별도 제품 검토 |
| [Claude Usage Tracker](https://www.producthunt.com/products/claude-usage-tracker) | Cursor·Claude Code·Windsurf·Cline 등 9+ 도구의 로컬 세션을 자동 탐지해 일별 비용·모델·heatmap·월간 예측 | 무료·오픈소스·MIT·로컬/무계정/무텔레메트리; Product Hunt 337 followers, 5.0/1 review | provider quota뿐 아니라 여러 도구의 API 환산 비용을 합치는 수요가 있음. 단, subscription quota와 비용을 같은 지표로 합치지 말 것 |

### 10.2 Product Hunt 밖에서 확인한 신호

- **Hacker News Show HN — CC Usage Bar:** Keychain을 읽지 않고 네트워크 호출도 하지 않으며, 클릭할 때 숨은 PTY에서 실제 `claude` 세션을 실행해 `/usage` 출력을 렌더링하는 zero-trust 설계가 소개됐다. 게시물은 1 point와 4 comments로 확인됐다. 이 방식은 정확성은 높일 수 있지만 실행 지연·CLI 설치 의존·자동 갱신 UX가 약해질 수 있다. ([게시물](https://news.ycombinator.com/item?id=47284990))
- **Hacker News Show HN — LimitBar:** Keychain의 Claude CLI 로그인과 Anthropic OAuth refresh flow를 선택적으로 재사용하고, 장기 토큰 파일 대안도 제공한다고 소개됐다. 2 points와 2 comments로 확인됐다. TokenJuice의 자동 갱신은 이 사례처럼 “선택적·명시적”이어야 한다. ([게시물](https://news.ycombinator.com/item?id=48775727))
- **Product Hunt의 Codex 3.0 리뷰:** 제품 자체는 경쟁 서비스지만, 리뷰 요약에서 사용량·진행상태 가시성이 약점으로 반복되고 “세션·모델별 사용량, 잔여량, reset을 한곳에서 보고 싶다”는 요구가 나타났다. 이는 TokenJuice가 해결하려는 문제의 실제 사용자 언어다. ([리뷰 페이지](https://www.producthunt.com/products/codex-3-0-by-openai/reviews))
- **공식 제품 사이트의 AgentPeek·CUStats·AgentNotch:** Product Hunt의 관심 신호를 실제 가격·플랫폼·데이터 처리 설명과 대조했다. 세 제품 모두 로컬 처리/무계정/일회성 결제를 전면에 내세우며, CUStats는 유료 사용자·출시 수·피드백 해결률까지 공개한다. ([AgentPeek](https://www.agentpeek.app/), [CUStats](https://custats.info/), [AgentNotch](https://www.agentnotch.app/))

### 10.3 시장 패턴과 제품 전략 수정

1. **카테고리 경계가 바뀌었다.** 경쟁 제품은 quota tracker, cost analytics, session monitor, approval inbox, keep-awake를 한 화면에 묶고 있다. 그러나 이 모든 것을 v1.1에 넣으면 TokenJuice의 핵심 신뢰 문제가 흐려진다.
2. **로컬 우선은 기능이 아니라 구매 이유다.** “무계정·무텔레메트리·내 컴퓨터에만 저장”은 거의 모든 신제품의 핵심 카피다. TokenJuice는 이를 선언하는 데서 끝내지 말고 source별로 어떤 자격증명을 읽는지 실제 화면에 공개해야 한다.
3. **일회성 결제가 메뉴바 유틸리티와 잘 맞는다.** 확인된 가격대는 $3~$15 수준의 lifetime unlock과 무료 오픈소스가 많다. AI Limits Tracker의 월/년/Lifetime Pro와 CUStats/AgentPeek/AgentNotch의 일회성 결제를 비교하면, TokenJuice는 v1.1에서는 무료 로컬 코어를 유지하고 v1.2 이후 유료 기능을 검토하는 편이 자연스럽다.
4. **예측이 반복되는 유료 가치다.** CUStats의 pace prediction, 주간 소진 예상, 색상 단계가 단순 표시보다 행동을 유도한다. R18을 v1.2 우선 후보로 올린다.
5. **알림은 숫자보다 사건 중심이어야 한다.** AgentPeek·AgentNotch·BlackFlare·tablo는 한도 임계치뿐 아니라 승인 필요·질문·완료·컨텍스트 임박을 알린다. TokenJuice에서는 v1.1의 quota 알림을 먼저 안정화하고, v1.2에서 세션 상태를 opt-in으로 추가한다.
6. **Product Hunt 수치는 시장 규모가 아니다.** 팔로워·업보트·리뷰·Day Rank는 초기 관심과 메시지 적합성의 신호일 뿐 실제 설치·유료 전환·잔존율을 대신하지 않는다. 경쟁사 분석에는 반드시 공식 가격·설치 수·GitHub 활동·스토어 리뷰를 별도로 기록한다.

### 10.4 제품 포지셔닝 문구 제안

> TokenJuice — Claude와 Codex의 한도, reset, stale 상태를 로컬에서 투명하게 보여 주는 개인용 AI coding quota monitor.

보조 문구:

> 공식 한도·로컬 사용량·추정 비용을 섞지 않습니다. 지금 숫자가 어디서 왔고 언제 마지막으로 성공했는지 보여 줍니다.

이 문구는 AgentPeek처럼 전체 agent command center를 약속하지 않으면서도, ClaudeUsageBar·CodexBar Lite처럼 단일 기능의 명료함과 AI Limits Tracker의 신뢰 UX를 결합한다.

### 10.5 업데이트된 로드맵 반영

- **v1.1:** R1~R8, R15, R16. Product Hunt 경쟁사보다 먼저 `source`, `observedAt`, `lastSuccessAt`, stale 이유를 사용자에게 노출한다. 공식 quota와 로컬 비용을 별도 카드로 둔다.
- **v1.2:** R9~R11, R17, R18. 계정 별칭·온보딩·Windows 일관성을 정리하고, 세션 상태와 주간 pace forecast를 opt-in으로 제공한다.
- **v2.0:** R12~R14, R19, R20. 모바일/위젯·notch·프로젝트 비용·컨텍스트·추가 provider를 검증된 어댑터만 선택적으로 도입한다. AgentPeek/AgentNotch처럼 기능을 늘리더라도 자격증명·프롬프트·코드의 외부 전송은 하지 않는다.

## 11. 경쟁사 BM 분석

### 11.1 분석 기준

각 제품의 BM을 다음 일곱 항목으로 분해했다. 공개 가격·공식 정책은 사실로 기록하고, 공개되지 않은 수익원은 추정하지 않고 `확인 필요`로 남긴다.

1. 누가 돈을 내는가: 개인 개발자, 멀티에이전트 파워유저, 팀/기업.
2. 어떤 문제에 돈을 내는가: quota 불안, context 소진, 에이전트 승인 대기, 비용 통제, 조직 분석.
3. 수익 방식: 무료, 일회성 라이선스, 구독, 앱스토어 IAP, 오픈소스 기반 지원/후원.
4. 유입 채널: Product Hunt, GitHub/Homebrew, App Store/Google Play, SEO, 커뮤니티.
5. 유지·확장 장치: 위젯, 알림, 다중 계정, 여러 기기, 팀 대시보드, 자동 업데이트.
6. 원가·운영 부담: provider endpoint 변경, 인증/쿠키 보안, 스토어 수수료, 클라우드 저장·분석, 고객지원.
7. 공개 근거의 강도: 공식 가격·약관은 높음, Product Hunt 자기소개는 중간, 추정은 배제.

### 11.2 회사·제품별 BM 카드

#### AI Limits Tracker — 프리미엄 소비자 유틸리티

- **고객:** Claude·Codex·Grok·Antigravity 계정을 여러 기기에서 쓰는 개인 개발자. 무료 사용자는 1개 계정, 여러 계정·멀티계정 위젯 사용자는 Pro로 전환시키는 구조다.
- **가치:** 한도와 reset을 iPhone·Mac 메뉴바·Apple Watch·Android 위젯에 지속 노출하고, 알림·iCloud Keychain·CloudKit 스냅샷으로 반복 확인 비용을 줄인다.
- **수익:** Apple 기준 Monthly Pro $2.99, Annual Pro $14.99, Lifetime Pro $29.99. 무료 1계정에서 추가 계정·위젯을 유료화하는 **freemium + subscription/lifetime IAP**다. Android 가격은 공개 페이지에서 확인 필요.
- **유입·유지:** App Store·Google Play·공식 SEO 사이트에서 유입하고, 위젯·워치·알림·동기화가 이탈 방지 장치다. RevenueCat이 구매 상태를 처리하고 PostHog/AppsFlyer가 분석·귀속을 담당한다고 개인정보처리방침에 공개한다.
- **원가·위험:** Apple/Google 스토어 수수료, 여러 OS 유지보수, 제공자 인증/endpoint 변경, CloudKit·분석 운영, 개인정보 설명 비용. 무료 계정에서 유료 계정으로 넘어가는 사용량 가치가 분명해야 한다.
- **BM 판단:** 현재 조사 대상 중 가장 완성된 B2C BM. 다만 “로컬 보안” 메시지와 분석/구매 SDK 처리 사이의 설명 일관성이 중요하다.

#### CUStats — 일회성 라이선스 + 모바일 동반앱

- **고객:** Claude·Codex·Grok·Cursor·Devin·Droid를 병행하고, Mac과 모바일에서 여러 계정을 보는 파워유저.
- **가치:** 5시간·주간·모델별 한도, pace prediction, 이력 차트, 다중 계정, reset/threshold 알림을 제공한다. 공식 사이트는 Mac 6개 제공자와 iOS companion을 설명한다.
- **수익:** Mac US$9.99 일회성 구매, iOS는 미국 기준 US$8.99부터, 구독·인앱 결제 없음으로 공개한다. Mac 라이선스와 모바일 companion을 별도 판매하는 **cross-platform one-time purchase**다.
- **유입·유지:** App Store, 공식 사이트, Product Hunt, 피드백 커뮤니티. 주간 예측·차트·알림·계정 수가 반복 사용을 만든다. 공식 사이트 자기신고 기준 유료 사용자 338+(Mac 216+, iOS 122+), 45 releases, feedback resolved 85%다.
- **원가·위험:** 앱스토어 수수료, provider별 cookie·토큰 호환성, 다중 계정 테스트, 모바일 background refresh, support. 클라우드 계정·동기화를 두지 않아 서버 원가는 낮지만 credential path가 넓다.
- **BM 판단:** “가벼운 메뉴바 유틸리티는 일회성 결제로도 팔린다”는 가장 구체적인 벤치마크. 수치들은 공식 사이트의 자기신고이므로 독립 검증된 매출·활성 사용자 수로 보지 않는다.

#### AgentPeek — 기능 번들형 프리미엄 데스크톱 앱

- **고객:** Claude Code·Codex·Cursor 등 여러 agent 세션을 동시에 운영하는 Mac 파워유저.
- **가치:** quota만이 아니라 세션·툴 호출·diff·승인·로컬 서버·프로젝트를 notch/menu bar와 session board로 통합한다.
- **수익:** 3일 무료 체험 후 1대 $14.99, 2대 $24.99, 3대 $34.99 일회성 라이선스. 업데이트는 지원 기간 동안 포함되고, 활성화 상태 확인을 위해 월 1회 license server에 영수증을 새로 고친다고 공개한다.
- **유입·유지:** Product Hunt·공식 사이트·무료 다운로드·개발자 개인 브랜드. “모든 기능·무제한 세션·업데이트 포함”과 다중 Mac 좌석이 전환·확장 장치다.
- **원가·위험:** 여러 agent hook/plugin 연동, macOS 호환성, 세션 데이터의 로컬 처리, 라이선스 서버·지원. 사용자 수가 늘수록 provider별 integration 유지 비용이 커진다.
- **BM 판단:** TokenJuice보다 넓은 문제를 해결하는 **paid command center**. TokenJuice가 같은 폭으로 확장하기보다 quota 신뢰성을 차별화해야 하는 근거다.

#### AgentNotch — 저가 일회성 + agent workflow 보조

- **고객:** Mac에서 agent의 질문·승인·완료를 놓치는 개발자.
- **가치:** Claude·Cursor·Codex·Kimi·OpenCode 등의 세션, permission request, 질문, 완료 알림, plan limits를 notch에 모은다.
- **수익:** 3일 체험 후 $9.99 일회성, 구독 없음, Stripe 결제, 14일 환불 정책. 팀 구매를 별도 안내한다.
- **유입·유지:** Product Hunt·공식 사이트·무료 체험. 여러 agent 지원과 알림 사건이 유지 장치다.
- **원가·위험:** agent hook/process/session 포맷의 지속적인 변화, macOS 전용 시장, 알림 오탐, 서명·업데이트 신뢰.
- **BM 판단:** low-price utility의 전형이다. 기능이 넓지만, 한 번의 구매로 끝나므로 신규 agent 연동과 업데이트 비용을 계속 감당해야 한다.

#### AgentQuartz — 무료 코어 + 초저가 커스터마이징

- **고객:** Claude·Cursor 한도만 간단히 보고 메뉴바 모양을 꾸미고 싶은 사용자.
- **수익:** 기본 기능 무료, gauge shape·배치 등 Pro를 $3 일회성 lifetime으로 판매한다고 Product Hunt에 공개했다. Gumroad가 결제 채널이다.
- **유입·유지:** Product Hunt·GitHub Releases·개인 사이트. 시각 커스터마이징이 무료 코어의 유료 전환 지점이다.
- **원가·위험:** unsigned macOS build를 공개하고 있어 설치 신뢰가 전환 장벽이다. 실제 유료 사용자·매출·업데이트 원가는 확인 필요.
- **BM 판단:** 핵심 데이터는 무료로 열고 표현/편의 기능만 소액으로 파는 모델. TokenJuice의 alert/history/forecast 유료화 실험에 참고할 수 있으나, 가격이 시장 검증됐다고 볼 근거는 부족하다.

#### Opaline — 팀·기업용 사용량 분석 SaaS

- **고객:** Claude Code·Codex를 조직 차원에서 사용하는 개발팀·engineering leadership.
- **가치:** 메시지·프롬프트·응답·툴 호출·token volume·estimated spend·agent adoption을 조직 단위로 분석하고, session trace와 advanced intelligence를 제공한다.
- **수익:** Free는 최대 3명·월 50,000 agent runs. Business는 연간 결제 기준 $42/member/month, Enterprise는 $85/member/month부터 + 연 $1,000 platform fee다. **freemium B2B SaaS + seat subscription + enterprise platform fee**가 명확하다.
- **유입·유지:** Product Hunt·CLI/npm·웹사이트·팀 분석 데모. 팀 데이터가 쌓일수록 대시보드·리포트·조직 분석의 전환 비용이 커진다.
- **원가·위험:** 세션 업로드·저장·검색·분석·AI 보조 처리, subprocessors, 보안·데이터 residency. 개인정보정책은 prompt·응답·소스코드·파일 경로·명령어가 제출 데이터에 포함될 수 있음을 명시한다.
- **BM 판단:** TokenJuice와 가장 다른 BM이다. 조직 데이터와 클라우드 분석을 필요로 하는 고가 B2B이며, TokenJuice가 Team 상품으로 확장할 경우 개인정보·약관·보안 체계가 완전히 달라진다.

#### Claudoscope — 무료 오픈소스·신뢰 기반 인접 제품

- **고객:** Claude Code/Cowork 세션 비용·컨텍스트·secret·설정 상태를 로컬에서 점검하려는 개인 개발자와 보안 민감 사용자.
- **가치:** local JSONL 기반 세션 검색, 비용 추정, Fleet view, secret scanning, 보안 hardening, 설정·skills·MCP 탐색.
- **수익:** 완전 무료·MIT·무텔레메트리로 공개한다. 유료 플랜·후원·상업 지원은 확인 필요하며 추정하지 않는다.
- **유입·유지:** GitHub·Homebrew·Product Hunt·오픈소스 신뢰. 사용자 데이터가 기기에 남고 기능이 계속 쌓이면 유지되지만, 직접 매출 장치는 공개되지 않았다.
- **BM 판단:** 수익보다 배포·신뢰·커뮤니티를 우선하는 프로젝트형 BM. TokenJuice가 무료 코어를 유지할 때의 경쟁 상대이며, 유료화한다면 cloud sync나 support 같은 명확한 원가가 있는 기능이 필요하다.

#### CodexBar·ccusage·UsageBar·AI Usage·Usage4Claude·ClaudeUsageBar — 오픈소스/무료 유틸리티군

- **고객·가치:** 개인 개발자가 AI 한도·토큰·비용을 빠르게 확인한다.
- **수익:** 대부분 MIT·무료·GitHub/Homebrew/릴리스 배포다. `Usagebar`는 Product Hunt에서 Pay What You Want로 소개됐지만, 실제 매출은 확인 필요. Sponsorship·지원 계약·유료 배포가 있다는 근거도 확인하지 못했다.
- **유입·유지:** GitHub stars, 검색, Product Hunt, 커뮤니티 문제 해결. CodexBar의 22.3k stars와 ccusage의 18.5k stars는 강한 배포 신호지만 매출·활성 사용자·전환율은 아니다.
- **원가·위험:** provider endpoint·CLI·OS 변화 대응은 유지보수자의 무급 또는 비공개 비용이다. 쿠키·Keychain을 읽는 제품은 보안 지원 비용도 생긴다.
- **BM 판단:** TokenJuice의 기능 경쟁자이면서 가격 압박원이다. 무료와 경쟁하려면 “더 많은 provider”가 아니라 신뢰 상태·절전 복구·Team 계정 진단처럼 공개 프로젝트가 꾸준히 해결하지 못하는 문제를 팔아야 한다.

#### BlackFlare·tablo·Agent Bar — BM은 아직 부분 공개

Product Hunt에서 BlackFlare는 Mac 깨우기·완료/승인 알림·plan usage, tablo는 context meter·approval widget, Agent Bar는 Claude Code GUI·voice·tool call·token cost를 제공한다고 소개한다. 그러나 조사 시점에 무료/유료 범위, 반복 과금 여부, 실제 유료 고객 수가 충분히 공개되지 않은 항목은 `확인 필요`로 남긴다. 이 그룹은 quota tracker보다 agent workflow를 판매하려는 방향을 보여 주지만, 사업 규모나 지속 가능성을 판단할 공개 근거는 부족하다.

### 11.3 BM 비교표

| 제품/회사 | 핵심 구매자 | 수익 모델 | 유입 채널 | 유지·확장 장치 | 공개 BM 성숙도 |
|---|---|---|---|---|---|
| AI Limits Tracker / JoCoding | 일반 개발자·Apple/Android 사용자 | Free + 월/년/Lifetime Pro IAP | App Store·Play·SEO | 위젯·워치·알림·CloudKit·멀티계정 | 높음 |
| CUStats | 멀티 provider 파워유저 | Mac/iOS 일회성 라이선스 | App Store·Product Hunt·사이트 | pace forecast·차트·다중 계정·companion | 중~높음 |
| AgentPeek | 멀티 agent Mac 개발자 | Mac 대수별 일회성 라이선스 | 사이트·Product Hunt·무료 체험 | all-in-one 기능·업데이트·다중 Mac | 높음 |
| AgentNotch | 승인/질문/완료를 놓치는 개발자 | $9.99 일회성·체험 | 사이트·Product Hunt | agent 지원 범위·알림 | 중~높음 |
| Opaline | 팀·기업 | Free + seat SaaS + Enterprise fee | Product Hunt·CLI/npm·영업 | 조직 데이터·분석·session trace | 높음 |
| Claudoscope | 보안 민감 개인 개발자 | 무료 MIT, 수익원 확인 필요 | GitHub·Homebrew·Product Hunt | 로컬 신뢰·기능 확장 | 낮음~중간 |
| CodexBar·ccusage 등 | 개인 개발자 | 무료 OSS, 수익원 확인 필요 | GitHub·Homebrew·커뮤니티 | provider 수·stars·기여자 | 제품별 상이 |
| BlackFlare·tablo·Agent Bar | agent workflow 파워유저 | 가격·반복 과금 확인 필요 | Product Hunt·개인 사이트 | 알림·session·GUI 기능 | 낮음~중간 |

### 11.4 TokenJuice 권장 BM 가설

아래는 경쟁사 사실이 아니라 TokenJuice에 대한 **검증 전 가설**이다.

> **BM 선행 조건:** UX1~UX6이 완료되기 전에는 유료 기능이나 결제를 출시하지 않는다. 현재의 Pocket/설치 경험은 ‘엔진을 시험하는 사용자’에게는 충분하지만, AI Limits처럼 일반 개발자가 즉시 가치를 이해하는 소비자 결제 경험에는 부족하다. 먼저 무료 코어의 첫 유효 데이터 확인률과 복구 UX를 검증한다.

#### 1단계: 무료 로컬 코어

- Claude + Codex, macOS SwiftBar와 Windows 트레이, fresh/stale/auth/rate-limit 상태, 기본 reset 알림은 무료로 제공.
- 별도 계정·서버·클라우드 없이 동작하고, 코드·프롬프트·토큰을 외부로 보내지 않는 점을 핵심 가치로 둔다.
- 무료 코어는 AI Limits Tracker의 1계정 무료 진입과 OSS 유틸리티의 배포 장벽을 동시에 참고한다.

#### 2단계: Supporter/Lifetime

- 멀티계정, 고급 알림, 7일 history, pace forecast, 진단 리포트, 서명된 자동 업데이트를 묶어 US$9~15 일회성으로 테스트한다.
- 이는 CUStats·AgentPeek·AgentNotch가 실제로 제시한 가격대와 맞지만, TokenJuice 매출이 검증된 것은 아니다.
- 단순 색상·아이콘 커스터마이징만 유료화하면 AgentQuartz 수준의 소액 상품이 되므로, TokenJuice는 “신뢰성·복구·예측”처럼 지속적인 문제 해결 가치에 과금하는 편이 낫다.

#### 3단계: Pro 구독은 서버 기능이 생길 때만

- 모바일 companion, CloudKit 동기화, 여러 기기 push, 팀 공유나 장기 분석을 실제로 운영할 때만 월 구독을 검토한다.
- 로컬 기능만 제공하면서 구독을 받으면 AI Limits Tracker의 멀티기기 가치와 비교해 설득력이 약하다.
- 구독을 도입한다면 저장 데이터, 동기화 범위, 삭제, 조직 계정 처리 비용을 먼저 계산한다.

#### 4단계: Team/B2B는 별도 제품으로 분리

- Opaline처럼 세션·프롬프트·소스코드·토큰을 조직 단위로 업로드하는 제품은 높은 ARPU를 만들 수 있지만, TokenJuice의 현재 로컬 프라이버시 약속과 충돌한다.
- 따라서 Team은 v2.0 이후 별도 opt-in 제품으로만 검토하고, 기본 TokenJuice에 서버 수집을 섞지 않는다.

### 11.5 BM 검증 지표와 의사결정 기준

| 가설 | 측정 | 다음 결정 |
|---|---|---|
| 사용자는 숫자보다 신뢰 상태에 돈을 낸다 | stale 원인 확인·복구 기능 사용률, Supporter 전환율 | 전환이 있으면 R1/R2/R16을 유료 가치의 중심으로 유지 |
| 다중 계정 수요가 충분하다 | 활성 설치 중 2개 이상 계정 비율 | 높으면 R10·멀티계정 알림 우선 |
| pace forecast가 재방문을 만든다 | 예측 화면 주간 재방문, forecast 알림 후 행동률 | 낮으면 v2로 미루고 기본 알림 개선 |
| 일회성 가격이 적합하다 | $9/$15 가격별 결제율·환불률·지원시간 | 지원 비용이 높으면 lifetime 범위 축소 또는 Pro 검토 |
| 모바일이 유료 확장을 만든다 | 모바일 위젯 요청, companion 대기자, 교차기기 사용률 | 충분한 수요가 있을 때만 CloudKit/위젯 투자 |

## 12. 출처 목록

모든 웹 출처는 2026-10-08 확인. GitHub stars·Google Play 다운로드·스토어 버전은 변동 가능한 현재 화면값이다.

### AI Limits Tracker

1. [AI Limits Tracker 공식 사이트](https://ailimits.app/)
2. [공식 일본어 사이트](https://ailimits.app/ja/)
3. [Apple App Store — AI Limits Tracker](https://apps.apple.com/us/app/ai-limits-tracker/id6801493876)
4. [Google Play — AI Limits Tracker](https://play.google.com/store/apps/details?id=com.jocoding.aiLimitsTracker)
5. [공식 개인정보처리방침](https://ailimits.app/privacy)
6. [공식 이용약관](https://ailimits.app/terms)

### 경쟁 오픈소스·서비스

7. [CodexBar](https://github.com/steipete/CodexBar) / [릴리스](https://github.com/steipete/CodexBar/releases) / [관리자 프로필](https://github.com/steipete)
8. [ccusage](https://github.com/ccusage/ccusage) / [문서](https://ccusage.ryoppippi.com/)
9. [AI Usage](https://github.com/burakgon/ai-usage-menubar)
10. [UsageBar](https://github.com/lucas-barake/usagebar)
11. [ClaudeBar — chiliec](https://github.com/chiliec/ClaudeBar)
12. [Claude Usage — Bread-bang](https://github.com/Bread-bang/claude-usage)
13. [Claude Monitor — Yuefan](https://github.com/Yuefan/claude-monitor)
14. [Usage4Claude 일본어 README](https://github.com/f-is-h/Usage4Claude/blob/main/docs/README.ja.md)
15. [AgentLimits 일본어 README](https://github.com/Nihondo/AgentLimits/blob/main/README_ja.md)
16. [AI Usage Bar — TentoSwift](https://github.com/TentoSwift/AIUsageBar)
17. [Claude Meters 소개](https://zenn.dev/yskms/articles/e41a22b59a8e6c)
18. [Claude Code 로그 시각화](https://github.com/anestec-rd/visualize-claude-code-usage)

### 최신 제품·런치 채널

19. [CUStats — Product Hunt](https://www.producthunt.com/products/custats) / [공식 사이트](https://custats.info/)
20. [AgentPeek — Product Hunt](https://www.producthunt.com/products/agentpeek) / [공식 사이트](https://www.agentpeek.app/)
21. [AgentNotch — Product Hunt](https://www.producthunt.com/products/agentnotch) / [공식 사이트](https://www.agentnotch.app/)
22. [Claudoscope — Product Hunt](https://www.producthunt.com/products/claudoscope) / [공식 사이트](https://claudoscope.com/)
23. [ClaudeUsageBar — Product Hunt](https://www.producthunt.com/products/claudeusagebar) / [공식 사이트](https://www.claudeusagebar.com/)
24. [Usage4Claude — Product Hunt](https://www.producthunt.com/products/usage4claude)
25. [AgentQuartz — Product Hunt](https://www.producthunt.com/products/agentquartz)
26. [CodexBar Lite — Product Hunt](https://www.producthunt.com/products/codexbar-lite)
27. [BlackFlare — Product Hunt](https://www.producthunt.com/products/blackflare)
28. [tablo — Product Hunt](https://www.producthunt.com/products/tablo-a-desktop-cat-widget?launch=tablo-4)
29. [Opaline/Rudel — Product Hunt](https://www.producthunt.com/products/rudel?launch=opaline)
30. [Claude Usage Tracker — Product Hunt](https://www.producthunt.com/products/claude-usage-tracker)
31. [CC Usage Bar — Hacker News Show HN](https://news.ycombinator.com/item?id=47284990)
32. [LimitBar — Hacker News Show HN](https://news.ycombinator.com/item?id=48775727)
33. [Product Hunt — Codex 3.0 리뷰](https://www.producthunt.com/products/codex-3-0-by-openai/reviews)

### BM·가격·개인정보 참고

34. [CUStats Mac App Store](https://apps.apple.com/us/app/custats-ai-usage-tracker/id6756333957?mt=12)
35. [AgentPeek 가격·라이선스](https://www.agentpeek.app/docs/licensing/)
36. [Opaline 가격](https://opaline.so/pricing)
37. [Opaline 이용약관](https://opaline.so/legal/terms-of-service)
38. [Opaline 개인정보처리방침](https://opaline.so/legal/privacy-policy/)
39. [Claudoscope 공식 사이트·라이선스](https://claudoscope.com/)
40. [Claudoscope 개인정보](https://claudoscope.com/privacy)

### 제공자 공식 참고

41. [OpenAI Help — ChatGPT plan과 Codex 사용량](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
42. [OpenAI Help — ChatGPT Work와 Codex](https://help.openai.com/en/articles/20001275/)
43. [OpenAI Help — Codex reset](https://help.openai.com/en/articles/20001507-paid-weekly-work-and-codex-rate-limit-resets)
44. [Anthropic — Claude Code LLM gateway/사용량 추적 참고](https://docs.anthropic.com/en/docs/claude-code/llm-gateway)
45. [GitHub REST API — Billing usage (Premium request usage)](https://docs.github.com/en/rest/billing/usage)

### TokenJuice 내부 현황 참고

46. [TokenJuice 저장소](https://github.com/kendrick-na/tokenjuice)
47. 이어받은 Claude 세션의 2026-09-25~2026-10-08 조사 기록 및 사용자 제공 현황. 공개 웹 출처가 아닌 내부 작업 기록은 외부 사실로 확대하지 않는다.

### 고빈도 바이브코더 리서치 참고

48. [OpenAI Developers — GPT-5-Codex context window와 rate limits](https://developers.openai.com/api/docs/models/gpt-5-codex)
49. [Anthropic Docs — agent harness의 context 관리](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables)
50. [Claude Code 공개 이슈 — context window가 짧은 git 작업 뒤 급감](https://github.com/anthropics/claude-code/issues/26291)
51. [Claude Code 공개 이슈 — context edge에서 자동 compact가 지연되어 장기 세션이 멈춤](https://github.com/anthropics/claude-code/issues/77509)
52. [Claude Code 공개 이슈 — compact 이후 context 재팽창](https://github.com/anthropics/claude-code/issues/84187)
53. [Codex 공개 이슈 — 작은 prompt에서도 TPM rate limit](https://github.com/openai/codex/issues/34465)
54. [Codex 공개 이슈 — context/usage가 비정상적으로 급증](https://github.com/openai/codex/issues/24896)
55. [Codex 공개 이슈 — rate limit 거부와 상태 정보가 모순되는 진단 문제](https://github.com/openai/codex/issues/38603)
56. [AI Limits Tracker 공식 제품 화면·알림·연결 UX](https://ailimits.app/)
57. [Cursor 공식 문서 — 빠른 시작·재실행 온보딩·사용량/보안 제품 표면](https://docs.cursor.com/get-started/installation)
58. [Cursor 공식 문서 — background agent의 상태·handoff·보안 경계](https://docs.cursor.com/background-agent)
59. [ClaudeUsageBar Product Hunt — 한눈 확인·경고·설치 후 즉시 동작이라는 이용자 가치 제안](https://www.producthunt.com/products/claudeusagebar)
60. [Spotlight by Backplanes Product Hunt — Claude/Codex 세션을 행동 가능한 요약으로 바꾸는 가치 제안](https://www.producthunt.com/products/backplanes)

---

## 13. 2026-10-09 전략 업데이트 — AI Limits Tracker와 경쟁서비스 재검증

> 이 섹션은 기존 v1 기획서의 경쟁 조사와 BM 가설을 최신 공개 자료로 재검증한 **우선 적용 부록**이다. 기존 내용과 충돌하는 경우 이 섹션의 판단을 우선한다. 특히 `AI Limits Tracker`(JoCoding)와 이름이 비슷한 별도 앱 `Limits: AI Usage Tracker`(다른 개발자)의 리뷰·가격·개인정보 정보를 섞지 않는다.

### 13.1 먼저 바로잡을 대상 구분

| 제품 | 운영 주체 | 핵심 표면 | 이번 기획에서의 역할 |
|---|---|---|---|
| **AI Limits Tracker** | JoCoding, Inc. | iPhone·Mac 메뉴바·Apple Watch·Android | 가장 직접적인 상용 비교 대상 |
| **Limits: AI Usage Tracker** | 별도 개발자 | iPhone 위젯·Lock Screen·다중 계정 | 이름 유사 제품. AI Limits Tracker의 리뷰로 인용하지 않음 |
| **OpenUsage** | 오픈소스 프로젝트 | macOS 메뉴바·터미널·statusline | 다중 provider·비용·개발자 관측성 기준점 |
| **ClaudeCodeUsage** | 오픈소스 VS Code 확장 | VS Code status bar/dashboard | IDE 안에 들어간 로컬 usage 기준점 |
| **VibeUsage·UsageDeck·OpenQuota** | 소규모 오픈소스/개인 프로젝트 | CLI·desktop·cross-platform | 시장의 반복되는 수요를 확인하는 보조 경쟁군 |

AI Limits Tracker의 최신 App Store 페이지는 JoCoding, Inc.가 운영하며 iPhone·Mac·Apple Watch를 지원한다고 표시한다. 공식 기능은 provider별 사용량·리셋 시각, 연결 계정 정리, iCloud Keychain/CloudKit 기반 Apple 기기 연결, Home Screen widget, 로컬 알림, 별도 회원가입 없음이다. App Store 표시 가격은 Lifetime Pro US$29.99, Annual Pro US$14.99, Monthly Pro US$2.99다. [출처: AI Limits Tracker App Store](https://apps.apple.com/us/app/ai-limits-tracker/id6801493876)

2026-10-09 확인 기준 최신 버전은 **1.0.23**이다. 최근 업데이트에서 단순 한도 표시를 넘어 다음 기능을 추가했다.

- 한도가 리셋 전에 소진될 경우 빨간색 `Runs out` 시각 표시
- 제공자 장애를 보여주는 Status 탭과 Apple Watch badge
- Antigravity 한도의 모델명 표시
- Codex reset credit 표시 및 앱/Apple Watch에서 직접 사용
- 마지막 성공값을 유지하는 widget refresh와 provider 장애 상태 처리
- 7일 사용 추세와 소진 예상 시각
- 새 사용자 sign-in tour, purchase restore, multi-device 계정 삭제 동기화 개선

이 변화는 AI Limits Tracker의 제품 방향이 “한도 숫자판”에서 **사용자가 다음에 무엇을 해야 하는지 알려주는 운영 화면**으로 이동하고 있음을 의미한다. 따라서 TokenJuice가 단순히 `C/S/X` 배터리를 더 예쁘게 만들거나 provider 수를 늘리는 것만으로는 충분하지 않다.

### 13.2 경쟁서비스 전체 기능 지도

| 제품군 | 사용자가 사는 가치 | 주요 기능 | TokenJuice가 배워야 할 점 | 그대로 따라 하면 안 되는 점 |
|---|---|---|---|---|
| AI Limits Tracker | 어디서든 공식 한도와 reset을 확인 | 모바일/Watch widget, 다중 계정, reset credit, local alert, Status, 소진 예상 | 온보딩, 신뢰 가능한 마지막 성공값, `Runs out`, reset credit UX | Apple 생태계·provider 인증을 그대로 확장하면 개발/보안 비용이 급증 |
| Limits | 작은 비용으로 여러 계정의 quota를 한눈에 확인 | iPhone/Lock Screen widget, reset alert, Codex credit expiry, pace warning | 저가 utility와 widget의 습관성 | 이름·가격·리뷰를 AI Limits Tracker와 혼동하지 않기 |
| OpenUsage | 모든 AI coding stack의 운영 데이터 통합 | 35~36 provider, quota, spend, token, burn rate, history, SQLite, tmux/statusline, JSON/CSV, Prometheus | 개발자용 observability와 로컬 history | provider 수 경쟁, API key/cookie/auth path 확장 |
| ClaudeCodeUsage | IDE를 떠나지 않고 사용량 확인 | Claude Code/Codex local usage, VS Code status bar, dashboard, session/cost estimate | 현재 작업 표면에 들어가는 UX | 단순 비용 추정치를 provider quota와 섞지 않기 |
| VibeUsage/UsageDeck/OpenQuota | 여러 provider를 섞는 개발자의 가벼운 통합 | CLI/desktop, token history, reset, estimated spend, cross-platform | Windows/Linux까지 포함한 배포·검색 수요 | 작은 프로젝트를 모두 별도 adapter로 흡수하지 않기 |
| Agent workflow 제품군 | agent가 묻거나 멈추는 순간을 놓치지 않기 | 승인 요청, 질문, 완료 알림, session board, context meter, remote control | quota보다 “작업 중단”을 해결하는 방향 | 처음부터 거대한 command center가 되지 않기 |
| 팀용 observability | 팀의 사용량·비용·adoption 관리 | 조직 dashboard, session trace, spend, policy, reports | 향후 B2B 가능성 | prompt/code 업로드를 기본값으로 도입하지 않기 |

OpenUsage는 공식 사이트에서 35개 이상 provider의 quota·spend·rate limit·token·burn rate를 로컬에서 보여준다고 설명하며, GitHub 저장소에는 217 stars·25 forks가 표시된다. Claude provider 문서는 session, weekly, model-scoped limit, extra usage, rate-limit reset을 별도로 다룬다. 이는 “다중 provider 관측” 자체에는 이미 강한 무료 경쟁이 있다는 뜻이다. [OpenUsage](https://openusage.sh/) · [OpenUsage GitHub](https://github.com/janekbaraniewski/openusage) · [Claude provider 문서](https://github.com/robinebers/openusage/blob/main/docs/providers/claude.md)

### 13.3 실제 사용자가 돈을 내는 이유에 대한 업데이트

현재 공개 증거로 확인되는 지불 이유는 “일반 유저가 AI 사용량을 궁금해한다”가 아니다. 다음 네 조건 중 두 개 이상이 겹치는 파워유저가 돈을 낸다.

1. Claude·Codex·Cursor 등 **두 개 이상의 provider 또는 계정**을 매일 사용한다.
2. 한도에 걸리면 프로젝트 납기·업무·에이전트 실행이 실제로 중단된다.
3. 모바일·메뉴바·Watch처럼 **계속 보이는 표면**이 필요하다.
4. reset credit·소진 예상·provider 장애를 놓치면 이미 지불한 구독료를 낭비한다.

그러므로 TokenJuice의 일반 소비자 전환율은 낮게 보는 것이 맞다. 반대로 고빈도 vibe coder, 프리랜서, AI agent를 업무에 붙인 소규모 팀에는 충분한 지불 이유가 있다. “세션 context 퍼센트”를 팔면 안 되고, **중단을 예방하고 작업을 이어가는 결과**를 팔아야 한다.

### 13.4 업데이트된 제품 전략

#### 포지셔닝

기존 문구:

> Claude Code와 Codex 사용량을 메뉴바에서 보여주는 battery tracker

업데이트 문구:

> **AI 코딩 작업이 한도·context 부족으로 끊기기 전에, 다음 작업까지 이어주는 로컬 작업 연속성 도구**

AI Limits Tracker의 quota/reset 데이터는 경쟁 또는 선택적 connector로 취급하고, TokenJuice의 본체는 다음 판단으로 정의한다.

> **Quota + Context + Trust + Project State → 다음 행동 추천**

여기서 `Trust`는 `fresh`, `fallback`, `stale`, `auth_expired`, `rate_limited`, `unavailable` 상태를 의미한다. 숫자를 보여주는 것보다 숫자를 믿어도 되는지 알려주는 것이 TokenJuice의 가장 강한 차별화다.

#### 권장 첫 고객

| 우선순위 | 고객 | 강한 문제 | 검증 질문 |
|---|---|---|---|
| P0 | Claude Code + Codex를 매일 함께 쓰는 개인 | 한도·context를 오가며 작업이 끊김 | 이번 주에 한도 때문에 작업을 바꾼 횟수는? |
| P0 | 여러 계정을 쓰는 vibe coder/프리랜서 | 어느 계정이 살아 있는지 모름 | 계정별 reset을 놓쳐 낭비한 적이 있는가? |
| P1 | AI agent를 업무에 붙인 소규모 팀 | agent 승인·중단·비용 통제가 안 됨 | 작업 중단 1회 비용이 얼마인가? |
| P2 | 일반 AI/가끔 코딩하는 사용자 | 문제 빈도가 낮음 | provider 기본 화면보다 무엇이 더 필요한가? |

P2를 초기 핵심 고객으로 잡지 않는다. 일반 사용자는 무료 Pocket이나 provider 기본 화면으로 유입시키고, P0의 실제 작업 중단 문제를 해결하는 것이 우선이다.

### 13.5 기능 업데이트안 — “슈퍼 서비스”의 올바른 범위

#### Phase A — 무료 로컬 코어 강화

- 기존 Claude·Codex 한도, 세션 context, trust 상태 유지
- provider별 `last success`, `next retry`, `source`, `reason`을 동일한 카드 구조로 표시
- 한도/세션/context를 한 숫자로 합치지 않고 별도 행으로 유지
- `stale` 값은 최신값처럼 보이지 않게 하고, “마지막 성공값”임을 항상 표시
- macOS SwiftBar·Windows tray·Linux CLI에서 동일한 JSON 계약 유지
- 첫 실행 후 30초 안에 “데이터가 어디에서 왔는지” 확인 가능한 진단 화면 제공

#### Phase B — Work Continuity 기능

- context 80% 이상: `checkpoint 권장`
- limit 20% 이하: `provider 전환 또는 짧은 작업 권장`
- 둘 다 위험: `현재 세션을 요약하고 새 세션으로 이어가기`
- stale/auth expired: 자동 전환하지 않고 먼저 재연결 안내
- 프로젝트·브랜치·최근 파일·마지막 작업 의도를 로컬 checkpoint로 저장
- 새 세션에서 복구할 수 있는 “resume brief” 생성

이 단계가 TokenJuice의 핵심 차별화다. AI Limits Tracker가 “Runs out”을 보여준다면, TokenJuice는 “그래서 지금 무엇을 저장·전환·재개할지”까지 연결해야 한다.

#### Phase C — 선택적 provider connector

- AI Limits Tracker처럼 직접 provider usage를 읽는 기능은 opt-in connector로 둔다.
- provider credentials를 TokenJuice 서버로 보내지 않는다.
- 공식값·로컬집계·추정값을 각각 다른 `kind`와 `trust`로 표시한다.
- reset credit은 provider가 직접 반환한 경우에만 표시하고, 로컬 추정으로 만들지 않는다.
- 첫 후보는 Claude/Codex이며, OpenUsage처럼 30개 provider 지원을 목표로 삼지 않는다.

#### Phase D — Pocket과 cross-device

- 현재 Pocket의 수동 snapshot import는 유지한다.
- 자동 cloud sync는 기본값으로 만들지 않는다.
- 사용자가 명시적으로 켠 경우에만 encrypted checkpoint sync를 제공한다.
- 모바일에서 전체 session log나 prompt를 보여주지 않고, quota·trust·resume brief만 표시한다.
- push notification은 서버 업로드와 분리해 설계한다.

#### Phase E — 팀용은 별도 검증

- 개인 제품에 곧바로 prompt/code 업로드형 SaaS를 넣지 않는다.
- 팀 기능은 먼저 로컬 집계 export와 opt-in 공유로 시작한다.
- 팀 dashboard를 만들 때는 prompt 원문·소스코드·토큰이 기본 수집되지 않는 계약을 먼저 확정한다.

### 13.6 경쟁사 대비 우선순위 매트릭스

| 기능 | AI Limits Tracker 강점 | OpenUsage 강점 | TokenJuice 기회 | 우선순위 |
|---|---|---|---|---|
| 공식 quota/reset | 매우 강함 | provider별 상이 | trust 라벨과 local fallback 결합 | P0 |
| 다중 provider | 4개 중심 | 35개 이상 | 2~4개만 깊게 지원 | P1 |
| 다중 계정 | 강함 | 강함 | 계정별 project/session까지 연결 | P0 |
| Mobile/Watch widget | 매우 강함 | 약함 | Pocket은 resume/status 중심 | P2 |
| 비용/history | 제한적~중간 | 매우 강함 | “한도 대비 비용”보다 작업 중단 비용 | P1 |
| Session context | 핵심 아님 | 분석 중심 | 가장 강한 차별화 | P0 |
| Resume/checkpoint | 공개 강점 없음 | 일부 export | TokenJuice의 핵심 wedge | P0 |
| Trust/stale/auth 상태 | 성공 스냅샷·상태 제공 | provider별 상이 | 제품 브랜드로 만들기 | P0 |
| Windows | Android/Apple 중심 | 로컬 도구별 상이 | 네이티브 tray + 동일 engine | P1 |
| Team/B2B | 해당 없음 | 로컬 중심 | 나중에 opt-in 별도 제품 | P2 |

### 13.7 BM 업데이트

현재 BM 가설은 다음처럼 수정한다.

1. **무료:** 로컬 quota·session·trust tracker, macOS/Windows/Linux CLI, 기본 Pocket export.
2. **Supporter/Lifetime:** 멀티계정, 고급 알림, 7일 history, pace forecast, checkpoint/resume brief, 서명된 자동 업데이트.
3. **Pro 구독:** 서버 비용이 실제로 생기는 encrypted cross-device sync, push, team sharing을 출시할 때만 도입.
4. **Team:** 개인 TokenJuice와 분리된 opt-in 제품. prompt/code 기본 수집 금지.

단순 quota 숫자에 구독료를 붙이지 않는다. 무료 OSS인 OpenUsage·ccusage와 정면 가격 경쟁을 하게 되기 때문이다. 과금 단위는 “한도 화면”이 아니라 **작업 중단을 줄인 횟수, 자동 복구, 여러 계정 운영, 팀 정책**이어야 한다.

### 13.8 30일 검증 로드맵

| 기간 | 목표 | 구현/검증 | 통과 기준 |
|---|---|---|---|
| 1주차 | 신뢰 화면 | source/last success/reason/next retry 카드 통합 | 사용자가 30초 안에 숫자의 출처를 설명 |
| 2주차 | Work Continuity | context·quota 동시 위험 규칙, checkpoint/resume brief | 실제 session 5개 이상에서 복구 성공 |
| 3주차 | Connector | Claude/Codex 공식값·로컬값을 분리 표시 | 공식값과 fallback을 혼동하지 않음 |
| 4주차 | 고객 검증 | P0 사용자 10~20명 인터뷰·2주 diary | 경고 후 checkpoint/전환 행동률 측정 |

다음 조건을 만족하지 못하면 결제·대규모 provider 추가 개발을 보류한다.

- 주간 활성 사용자 중 2개 이상 provider 사용자가 30% 미만
- limit/context 경고 후 실제 행동 전환이 10% 미만
- 사용자가 “provider 기본 화면으로 충분하다”고 반복 응답
- resume brief가 실제 작업 재개 시간을 줄이지 못함

### 13.9 최종 전략 결론

AI Limits Tracker까지 모두 결합한 “AI 사용량 슈퍼앱”은 기능적으로는 매력적이지만, 현재 TokenJuice가 그대로 가면 경쟁 서비스의 기능을 늦게 따라가는 제품이 된다. 우리가 가져가야 할 방향은 다음이다.

> **AI Limits Tracker가 “언제 막히는가”를 알려준다면, TokenJuice는 “막히기 전에 무엇을 저장하고 어디서 이어갈 것인가”를 해결한다.**

따라서 다음 개발 스프린트의 대표 기능은 provider 추가나 모바일 widget이 아니라 `Work Continuity Alert + Checkpoint/Resume Brief`로 확정한다. AI Limits connector는 이 기능을 정확하게 만들기 위한 보조 데이터 계층으로만 도입한다.

### 13.10 2026-10-09 최신 출처

- [AI Limits Tracker App Store — 최신 1.0.23, 기능 업데이트, 가격, 개인정보](https://apps.apple.com/us/app/ai-limits-tracker/id6801493876)
- [AI Limits Tracker Google Play — Android 기능, 2026-10-06 업데이트, Data safety](https://play.google.com/store/apps/details?id=com.jocoding.aiLimitsTracker)
- [AI Limits Tracker 공식 사이트](https://ailimits.app/)
- [Limits: AI Usage Tracker 공식 사이트 — 별도 제품](https://getlimits.app/)
- [OpenUsage 공식 사이트](https://openusage.sh/)
- [OpenUsage GitHub — provider 수·stars·기능](https://github.com/janekbaraniewski/openusage)
- [OpenUsage Claude provider 문서](https://github.com/robinebers/openusage/blob/main/docs/providers/claude.md)
- [ClaudeCodeUsage GitHub](https://github.com/ClaudeCodeUsage/ClaudeCodeUsage)
- [VibeUsage](https://vibeusage.com/)

## 14. 2026-10-09 UI/UX·비주얼 경쟁 감사 및 TokenJuice 디자인 업데이트

앞선 기능·사업성 비교에 더해, 공개 App Store/Google Play 설명, 공식 랜딩 페이지, GitHub/마켓플레이스 화면, 공개 사용 스크린샷을 기준으로 경쟁 서비스의 “어떻게 보이고 어떻게 쓰게 만드는가”를 감사했다. 로그인 후 내부 화면이나 비공개 사용자 여정까지 확인한 것은 아니므로, 아래 판단은 공개적으로 검증 가능한 UI/UX에 한정한다.

### 14.1 경쟁 제품의 시각적 포지션

| 제품군 | 화면 인상 | 핵심 UI 패턴 | 강점 | 한계 | TokenJuice의 해석 |
|---|---|---|---|---|---|
| AI Limits Tracker | 소비자용 glance UI. 밝고 정돈된 카드·링·큰 숫자, iPhone/Watch/widget 중심 | provider별 잔여량, reset 시간, 상태 탭, 로컬 알림 | 3초 안에 “얼마나 남았나”를 이해 | 프로젝트·세션·작업 재개 맥락이 얕음 | 큰 숫자와 즉시성은 채택하되 단순 quota 복제는 하지 않음 |
| Limits: AI Usage Tracker | 개인 생산성 앱에 가까운 깔끔한 추적 UI | 서비스별 사용량, 기간, 리셋·위젯 | 일반 사용자가 진입하기 쉬움 | 여러 작업의 원인·다음 행동까지는 약함 | 온보딩과 기본 상태 표현의 참고 대상으로만 사용 |
| OpenUsage / CodexBar 계열 | 개발자용 dark observability console. compact chip, monospace, 높은 정보 밀도 | 터미널/statusline/menu bar, burn rate, provider·모델·비용·export | 여러 provider를 한 화면에서 깊게 관찰 | 처음 보는 사용자는 의미를 해석해야 하고 “그래서 뭘 하지?”가 약함 | 진단 정보와 local-first 신뢰 모델은 채택, 조밀함은 detail 화면에 격리 |
| ClaudeCodeUsage 계열 | VS Code 안의 dark analytics dashboard | Overview/Graphs/Tables, 프로젝트·모델·날짜 필터, 비용·차트·heatmap | 사후 분석과 프로젝트별 패턴 파악에 강함 | glance alert가 아니며 quota·비용·추정치가 섞일 위험 | History/Insights 화면의 참고, 홈 화면에는 가져오지 않음 |
| VibeUsage/UsageDeck/OpenQuota 계열 | 여러 coding agent를 모니터링하는 전문 도구 | multi-provider dashboard, usage/cost/session 집계 | 파워유저의 통합 관찰 니즈를 포착 | 일반 사용자에게는 설정·용어·정보량이 과함 | “개발자 전체”가 아니라 반복적으로 막히는 사용자부터 공략 |

경쟁 제품은 세 가지 시각 언어로 나뉜다. (1) Consumer glance: 큰 숫자·링·카드, (2) Developer observability: 작은 텍스트·상태칩·로그, (3) IDE analytics: 탭·필터·그래프. TokenJuice가 이를 한 화면에 섞으면 “기능은 많지만 판단은 느린” 제품이 되므로 홈은 glance와 action에, 상세는 observability와 analytics에 분리한다.

### 14.2 TokenJuice의 디자인 포지셔닝: Calm Operations Console

TokenJuice의 시각적 방향은 **Calm Operations Console**로 확정한다.

- AI Limits Tracker처럼 첫눈에 읽히지만 단순 잔여량 앱보다 작업 맥락이 깊다.
- OpenUsage처럼 데이터 신뢰성을 보여주되 터미널 사용자만 이해하는 화면은 아니다.
- ClaudeCodeUsage처럼 분석 기능을 제공하되 분석 화면 때문에 현재 위험 신호가 묻히지 않는다.
- deep navy/slate 기반의 차분한 운영 콘솔로 하고, 정상 green·주의 amber·stale/fallback violet 또는 muted gray·장애 red를 사용한다.
- 색상만으로 상태를 전달하지 않고 아이콘·텍스트·시간·행동 라벨을 항상 병기한다.
- AI 서비스에서 흔한 보라/핑크 그라데이션, 장식용 glassmorphism, 의미 없는 animated ring은 사용하지 않는다.

권장 시각 토큰 초안: `#1E293B` primary, `#334155` secondary, `#0F172A` dark background, `#F8FAFC` foreground, `#22C55E` success, `#F59E0B` warning, `#8B5CF6`/`#94A3B8` stale, `#EF4444` destructive. 최종 출시 전 WCAG 대비·색각 이상·dark/light 모드 QA를 별도 수행한다.

### 14.3 정보 위계: NOW → WHY → NEXT → DETAIL

TokenJuice가 차별화해야 할 핵심은 데이터의 양이 아니라 **판단 순서**다.

```text
NOW     지금 가장 위험한 provider/session은 무엇인가?
WHY     왜 그렇게 판단했나? 데이터 출처·마지막 성공·신선도는?
NEXT    그래서 지금 사용자가 할 한 가지 행동은 무엇인가?
DETAIL  세션·프로젝트·히스토리·비용·진단은 어디서 보는가?
```

예시: `● C 72% · fresh   ● S 81% · 24m left   ◐ X 44% · reset 2h`

C/S/X는 기존 배터리 메타포를 유지하되 신규 사용자에게 암호처럼 보일 수 있으므로 첫 실행과 설정에 legend를 제공한다. `C=Claude`, `S=Codex`, `X=기타 provider/agent`이며 상태 점과 텍스트는 fresh/fallback/stale/error를 함께 표시한다.

### 14.4 상태 디자인과 신뢰 UX

AI Limits Tracker의 강점은 현재 값을 빠르게 보여주는 것이고, TokenJuice의 기회는 그 값이 얼마나 믿을 만한가를 함께 보여주는 것이다.

| 상태 | 시각 표현 | 사용자 문구 | 기본 행동 |
|---|---|---|---|
| Fresh | green check | 방금 확인됨 | 없음. 안심 상태 |
| Fallback | amber layered icon | 최근 표본 | 출처 보기 / 재조회 |
| Stale | violet/gray clock | 42분 전 | 새로고침 / connector 확인 |
| Rate limited | amber pause | 18분 후 재시도 | 기다리기 / manual retry |
| Auth expired | red key | 연결 필요 | 다시 연결 |
| Context risk | amber gauge | checkpoint 권장 | checkpoint 생성 |
| Work blocked | red stop | 작업 재개 필요 | switch / resume brief |

상태 카드에는 반드시 `source`, `last successful fetch`, `reason`, `next action`을 노출한다. “72% 남음”만 표시하는 것은 숫자는 맞아도 신뢰 UX가 부족하다.

### 14.5 화면별 개발 방향

#### A. Menu bar / tray

현재는 모든 provider 상세를 나열하지 않고 가장 위험한 1~3개만 우선 표시한다. 평상시에는 `● 3 healthy`처럼 조용하게 유지하고 행동이 필요한 순간에만 `! checkpoint` 또는 `↻ reconnect`를 올린다. 클릭하면 popover의 NOW로 바로 진입한다.

#### B. Popover

첫 화면을 `NOW`(가장 급한 상태), `WHY`(source·freshness·마지막 성공), `NEXT`(checkpoint·전환·reconnect 중 하나의 primary action) 세 블록으로 고정한다. 그 아래 provider card와 최근 session을 둔다.

#### C. Pocket / 모바일

desktop dashboard 축소판으로 만들지 않는다. 모바일은 `Can I continue?`, `What changed?`, `Resume` 세 질문에 답한다. 차트·heatmap·전체 provider 표는 History/desktop detail로 보낸다.

#### D. Onboarding

`사용 도구 선택 → 알림 위치 선택 → 첫 성공 snapshot → fresh/fallback/stale 설명 → alert opt-in` 순서로 한다. 첫 가치 경험은 모든 계정 연결이 아니라 하나의 provider와 하나의 session만으로 완성한다.

### 14.6 경쟁사에서 채택할 것과 버릴 것

| 경쟁 패턴 | 결정 | 이유 |
|---|---|---|
| 큰 숫자·provider별 카드 | 채택 | 3초 인지에 유리 |
| iOS/Watch/widget | 후순위 채택 | 반복 확인 니즈 검증 뒤 확장 |
| 7일 trend·예상 소진 | 상세에 채택 | 원인 분석에는 유용하지만 홈을 무겁게 함 |
| terminal/statusline | developer mode에 채택 | 파워유저용 opt-in |
| VS Code tab/filter/chart | History/Insights에 채택 | 사후 분석용 |
| 모든 provider를 한 번에 연결 | 배제 | 초기 activation·신뢰를 해침 |
| quota·cost·context를 같은 ring에 중첩 | 배제 | 단위와 의미 혼동 |
| 색상만으로 상태 구분 | 배제 | 접근성과 오판 위험 |
| AI 보라색 gradient / 장식 애니메이션 | 배제 | 운영 도구 신뢰감 약화 |

### 14.7 P0 UI/UX backlog 및 성공 지표

| 우선순위 | 항목 | 완료 기준 |
|---|---|---|
| P0 | NOW/WHY/NEXT popover | 신규 사용자가 30초 안에 위험 상태·근거·다음 행동 설명 |
| P0 | C/S/X legend + trust badge | 약어와 freshness를 혼동하지 않음 |
| P0 | source/last success/reason | fallback·stale를 fresh로 오인하지 않음 |
| P0 | 상태별 primary action | warning=checkpoint, auth=reconnect 일관성 |
| P0 | 색상 외 상태 표현 | 흑백·색각 이상 조건에서도 구분 |
| P0 | 375px Pocket flow | horizontal scroll 없이 Can I continue? → Resume |
| P1 | 7-day trend / estimated exhaustion | quota와 추정치 분리 |
| P1 | developer mode | terminal/statusline·고밀도 테이블 opt-in |
| P1 | widget/Watch/complication | retention 검증 후 개발 |
| P2 | multi-provider analytics | 2개 이상 provider 사용자 비율 확인 후 확장 |

검증 지표는 다음과 같다: 가장 위험한 상태를 10초 안에 찾는 비율 90% 이상, source와 fresh/stale 의미 설명 80% 이상, 잘못된 provider 전환 5% 미만, 경고 후 checkpoint/resume 완료 30% 이상, 375px horizontal scroll 0건, 색상을 끈 상태의 상태 식별 90% 이상, 홈에서 상세 원인까지 2클릭 이내.

### 14.8 리서치 근거

- [AI Limits Tracker App Store — 위젯·상태 탭·7일 추세·red Runs out·가격](https://apps.apple.com/us/app/ai-limits-tracker/id6801493876)
- [AI Limits Tracker 공식 사이트](https://ailimits.app/)
- [AI Limits Tracker Google Play — Android·local snapshot·보안/데이터 안전](https://play.google.com/store/apps/details?id=com.jocoding.aiLimitsTracker)
- [OpenUsage 공식 사이트 — multi-provider·local history·terminal/statusline](https://openusage.sh/)
- [OpenUsage GitHub](https://github.com/janekbaraniewski/openusage)
- [OpenUsage Claude provider 문서](https://github.com/robinebers/openusage/blob/main/docs/providers/claude.md)
- [ClaudeCodeUsage GitHub — VS Code 내 local usage dashboard](https://github.com/ClaudeCodeUsage/ClaudeCodeUsage)
- [Claude Code Usage 공개 화면 사례](https://discuss.pytorch.kr/t/claude-usage-claude-code/11174)
- [VS Code Marketplace 공개 화면 사례](https://marketplace.visualstudio.com/items?itemName=max-riabov.claude-glm-usage)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)

### 14.9 디자인 결론

TokenJuice는 AI Limits Tracker의 잔여량 카드를 복제하는 서비스가 아니라 그 카드가 놓치는 작업 연속성의 순간을 해결해야 한다.

> **경쟁 제품이 “얼마나 남았는가”를 보여준다면, TokenJuice는 “계속해도 되는가, 왜 그런가, 막히면 어디서 이어갈 것인가”를 보여준다.**

따라서 다음 디자인 스프린트의 산출물은 예쁜 dashboard가 아니라 `Calm Operations Console`의 동작 가능한 prototype이다. P0는 `NOW → WHY → NEXT` popover, 신뢰 상태 표현, checkpoint/resume action이며 차트·위젯·Watch·provider 추가는 그 흐름이 검증된 이후로 미룬다.

## 15. 2026-10-09 VibeUsage·Limits 추가 심층 조사 반영

앞선 문서에서 두 서비스를 기능 수준으로만 다뤘으므로, 이번에 공식 사이트·공개 문서·GitHub README·App Store 업데이트 이력·공개 화면을 다시 확인해 업데이트안을 보강했다. 두 제품은 이름은 비슷하지만 역할이 다르다.

- **VibeUsage** = 로컬 CLI 기반의 usage coach/관찰 도구
- **Limits** = iPhone 중심의 quota glance/알림 companion

### 15.1 VibeUsage 조사 결과

#### 제품 정의와 타깃

VibeUsage는 `npx vusage` 또는 설치 바이너리로 실행하는 open-source CLI다. 공식 사이트의 메시지는 “얼마나 썼나”보다 “어떻게 써서 덜 쓸 것인가”에 가깝다. Claude Code를 중심으로 Codex·Cursor·Gemini CLI를 확장 대상으로 삼고, 개발자·founder·engineering team이 여러 AI coding assistant의 사용량을 한 곳에서 이해하도록 설계됐다.

#### 확인된 기능

| 기능 | 확인 내용 | 제품적 의미 |
|---|---|---|
| Session metrics | 최근 7일 sessions, user/assistant messages, tool calls, input/output tokens | 단순 quota보다 실제 작업 패턴을 보여줌 |
| Tool breakdown | Bash/Read/Edit/Grep 등 tool call 비중 | 사용 습관의 비효율을 발견할 수 있음 |
| Personalized insight | “file read가 많으니 Grep을 사용하라”처럼 행동 팁 제공 | usage tracker에서 usage coach로 확장 |
| Rate-limit awareness | 5-hour/7-day window, reset time, pace 비교 | 한도와 작업 속도를 연결 |
| Local history | provider별 성공 snapshot을 JSONL로 저장, 최대 90일/8MiB | local-first·감사 가능성 |
| Statusline / JSON | compact statusline, provider 필터, script/widget용 JSON | 개발자 workflow에 삽입 가능 |
| Burn-rate guidance | 초과 pace를 green/yellow/red로 표시하고 pause/recovery guidance 제공 | “얼마 남음”보다 계획 수립에 유리 |
| Smart routing | 현재 headroom이 가장 큰 provider/model을 추천하되 요청 자체를 route하지는 않음 | multi-provider 전환의 의사결정 계층 |
| Provider health | provider status page를 조회해 operational 상태 표시 | 인증 문제와 provider 장애를 구분 |
| Security posture | release attestation, read-only usage fetch, prompt/code/credential을 history에 저장하지 않음 | 공급망·프라이버시 신뢰를 제품 메시지로 사용 |

#### VibeUsage의 실제 UX/비주얼

VibeUsage는 consumer 앱처럼 그래픽을 앞세우지 않고 터미널을 1차 화면으로 삼는다. CLI 출력은 box-drawing header, 텍스트 표, bar, 색상 pace indicator, insight 한 줄로 구성된다. 장점은 설치 후 `vusage` 한 번으로 빠르게 확인하고 statusline·스크립트·cron에 연결할 수 있다는 점이다. 반대로 일반 사용자는 “sessions / tool calls / pace / recovery”의 의미를 학습해야 하며, 모바일·위젯·시각적 onboarding은 약하다.

따라서 TokenJuice는 VibeUsage에서 **pace 기반 위험 판단, provider health, local history, smart routing의 의사결정 개념**을 가져오되, CLI의 정보 밀도와 인증 복잡성을 기본 UX로 가져오지 않는다. 이 기능들은 다음처럼 변환한다.

| VibeUsage 개념 | TokenJuice 변환 |
|---|---|
| pace color | `on track / at risk / will exhaust` 문구 + 색상 + 아이콘 |
| recovery guidance | “18분 쉬기”가 아니라 “checkpoint 후 Codex로 전환” 같은 작업 행동 |
| smart routing | 자동 전환이 아닌 `현재 여유가 큰 provider 추천` |
| provider health | quota 문제·auth 문제·provider outage를 분리한 WHY 영역 |
| statusline | developer mode의 compact menu-bar/statusline |
| local JSONL history | 사용자가 이해 가능한 History/Trend 화면과 export |

### 15.2 Limits 조사 결과

#### 제품 정의와 타깃

Limits는 iPhone 중심의 “your AI usage, always in view” 제품이다. Codex, Claude Code, Cursor, Grok, Antigravity를 연결하고 session·weekly limit, reset countdown, Home/Lock Screen widget을 한 곳에 둔다. 별도 Limits 계정 없이 OAuth로 각 provider에 직접 인증하며, token은 iOS Keychain에, usage snapshot은 기기에 저장하고 자체 서버에는 보내지 않는다고 설명한다.

#### 확인된 기능과 제품 운영

| 기능 | 확인 내용 | 제품적 의미 |
|---|---|---|
| Glance dashboard | readable ring/bar gauge, used/remaining/reset countdown | 앱을 열지 않고 상태를 이해하게 함 |
| Widgets | Home/Lock Screen, single-limit, compact/medium/large layouts, optional refresh | 반복 확인을 OS surface로 이동 |
| Notifications | reset·unexpected weekly reset·unused Codex manual reset expiry 경고 | reset을 수동으로 기억하는 문제 해결 |
| Intelligent ordering | 가장 급한 quota/account를 먼저 노출, manual ordering도 지원 | 우선순위가 화면 구조에 직접 반영 |
| Multi-account | provider별 여러 계정, widget에서 계정 번호 표시 | 파워유저의 계정 전환 니즈 대응 |
| Broad account meters | Claude spend caps, Codex Business/Enterprise monthly credit, Cursor team/credit/on-demand/included-request | 단순 개인 quota를 넘어 조직·예산까지 확장 |
| Reset credit | account detail에서 credit redeem 후 즉시 refresh | 단순 관찰에서 quota 조작으로 한 단계 확장 |
| Privacy UX | 연결별 필요한 scope와 Safari/provider sign-in 흐름을 설명하는 Privacy and connections screen | 민감한 인증을 제품 신뢰로 전환 |
| Localization | 한국어 포함 다국어 지원 | 소비자용 접근성·확장성 |
| Pricing | Free 시작, Pro 월 $2.99·연 $9.99·lifetime $19.99로 표시된 App Store 정보 | 저가 utility 구독/일회성 결제 모델 |

#### Limits의 실제 UX/비주얼

Limits는 밝고 차분한 iPhone utility UI다. 핵심 시각 언어는 provider logo + 수평 bar/ring + 큰 잔여 퍼센트 + reset countdown이다. widget은 화면 크기에 따라 한 계정·여러 계정·전체 provider를 재배치하고, 가장 급한 계정을 위로 올린다. App Store 업데이트 이력에서 widget clipping, provider name truncation, refresh stall, repeated alert를 계속 고친 점은 이 제품의 경쟁력이 “기능 수”보다 작은 화면에서의 신뢰성과 가독성에 있음을 보여준다.

Limits에서 TokenJuice가 가져갈 것은 **urgent-first ordering, widget을 위한 정보 압축, provider/account identity, reset alert, 연결·권한을 설명하는 trust screen**이다. 다만 quota가 정상이어도 작업 컨텍스트가 위험할 수 있으므로, TokenJuice는 ring 하나로 quota·context·cost를 합치지 않고 별도 상태로 유지한다.

### 15.3 두 서비스에서 새로 도출한 경쟁 인사이트

| 질문 | VibeUsage의 답 | Limits의 답 | TokenJuice의 기회 |
|---|---|---|---|
| 무엇을 측정하나? | session·message·tool·token·pace | quota·reset·account | quota + context + project state |
| 어디서 보나? | terminal·statusline·JSON | iPhone·widget·notification | menu bar + Pocket + 작업 중인 desktop |
| 어떤 행동을 유도하나? | 더 효율적인 tool 사용·pause·provider 추천 | 기다리기·reset 확인·account 선택 | checkpoint·resume brief·안전한 provider 전환 |
| 신뢰를 어떻게 만드나? | local history·read-only·attestation | Keychain·OAuth scope·no server | source·last success·freshness·reason을 한 화면에 표시 |
| 주요 약점은? | 일반 사용자에게 CLI/용어가 어려움 | 작업·프로젝트 맥락이 없음 | 두 강점을 합치되 기본 화면은 단순하게 유지 |

### 15.4 업데이트안에 추가하는 기능 우선순위

#### P0: Work Continuity Alert

VibeUsage의 pace와 Limits의 urgent-first를 결합한다. 단순히 `Claude 23%`가 아니라 다음처럼 표시한다.

```text
⚠ Claude: 5-hour window will exhaust soon
WHY: fresh  ·  last checked 2m ago  ·  pace above safe rate
NEXT: Save checkpoint → switch to Codex
```

#### P0: Trust & Connection Center

Limits의 Privacy and connections screen을 참고해 provider별로 다음을 보여준다.

- 어떤 계정에 연결됐는가
- 어떤 방식으로 읽었는가
- 마지막 성공 fetch는 언제인가
- 현재 값이 live/fallback/stale 중 무엇인가
- auth 만료·provider outage·rate limit 중 원인이 무엇인가

#### P1: Usage Coach

VibeUsage의 personalized insight를 차용하되 “토큰을 아껴라” 수준에서 멈추지 않는다.

- 최근 session에서 context가 빠르게 증가했는가
- tool call이 반복되거나 불필요한 file read가 많은가
- checkpoint를 만들면 다음 session의 비용·복구 시간이 줄어드는가
- 현재 provider보다 여유 있는 provider가 있는가

초기에는 설명 가능한 rule-based insight만 제공하고, 충분한 데이터가 쌓이기 전에는 AI가 생산성 점수를 임의로 매기지 않는다.

#### P1: Compact surfaces

Limits의 widget 압축 원칙과 VibeUsage의 statusline을 결합해 menu bar·desktop compact view를 만든다. 기본값은 가장 급한 1~3개 상태만 보여주고, 전체 provider·trend·tool breakdown은 detail view로 보낸다.

#### P2: Developer export / integrations

VibeUsage의 JSON·history와 유사한 export, shell/statusline, webhook은 power-user용으로 추가한다. 현재 `--json`, `--forecast-history`, `--developer`와 `--statusline`이 로컬·prompt-free 범위를 충족한다. webhook은 네트워크 전송·외부 공유·동의·보안 정책 검토가 필요하므로 별도 정책 게이트 전까지 구현하지 않는다. 일반 사용자의 첫 onboarding에 노출하지 않는다.

### 15.5 리스크와 검증 조건

- **OAuth/ToS 리스크**: VibeUsage README도 Claude consumer OAuth의 third-party usage 접근 제한을 명시한다. TokenJuice는 provider별 공식 API·허용된 local read·사용자 동의 범위를 분리해 connector별 법무/정책 검토를 거친다.
- **데이터 신뢰 리스크**: background refresh는 iOS가 실행 시점을 결정하므로 Limits도 약 15분 주기라는 한계가 있다. TokenJuice는 timestamp와 freshness를 숨기지 않는다.
- **과잉 분석 리스크**: tool call·token·heatmap을 홈에 모두 넣으면 VibeUsage의 개발자용 복잡성을 재현한다. coach/analytics는 detail로 보낸다.
- **위젯 집착 리스크**: widget은 강력하지만 사용자 retention과 반복 확인 행동이 먼저 검증돼야 한다. P0의 checkpoint/resume보다 앞세우지 않는다.

검증 조건은 다음으로 추가한다.

1. 사용자가 urgent-first 카드만 보고 10초 안에 가장 안전한 다음 행동을 선택하는가
2. live/fallback/stale와 auth/outage 차이를 30초 안에 설명하는가
3. Usage Coach 제안의 50% 이상이 실제 checkpoint·provider 전환·tool workflow 개선으로 이어지는가
4. 여러 provider를 쓰지 않는 사용자도 첫 provider 하나로 가치를 경험하는가
5. widget/알림이 실제 재방문을 만들지 못하면 P2로 되돌리는가

### 15.6 추가 출처

- [VibeUsage 공식 사이트 — usage coach, local CLI, 5-hour/7-day insight](https://vibeusage.com/)
- [VibeUsage GitHub README — install, pace, history, statusline, routing, provider status, security caveat](https://github.com/joshuadavidthomas/vibeusage/blob/main/README.md)
- [VibeUsage dashboard 설명 — multi-tool, project/model/time-window, leaderboard](https://www.vibeusage.cc/?section=install)
- [Limits 공식 사이트 — iPhone glance, widgets, reset notifications, privacy](https://getlimits.app/)
- [Limits Support — OAuth 연결, background refresh, Keychain/on-device storage](https://getlimits.app/support)
- [Limits App Store — 기능 업데이트, multi-account, widgets, reset credits, pricing](https://apps.apple.com/ca/app/limits-ai-usage-tracker/id6783130074)

## 16. 2026-10-09 타겟 유저·페인포인트 객관 검증과 착수 기준

### 16.1 먼저 결론

TokenJuice는 “AI를 쓰는 모든 사람”에게 필요한 제품이 아니다. 현재 가장 설득력 있는 타겟은 다음 조건을 동시에 만족하는 사용자다.

1. Claude Code·Codex·Cursor 등 2개 이상의 AI coding tool을 실제로 병행한다.
2. 한도·reset·인증 문제로 작업을 중단하거나 새 대화로 맥락을 잃어본 적이 있다.
3. 작업 중단 비용이 크고, 다시 시작할 때 무엇을 했는지 복구하는 데 시간이 든다.
4. 로컬 데이터·credential 프라이버시를 중요하게 여기며, 수동 import 또는 초기 설정을 감수할 수 있다.

이 타겟에는 명확한 pain이 있지만, 단일 provider를 가끔 쓰는 일반 사용자는 native usage 화면과 기본 알림만으로 충분할 가능성이 높다. 따라서 초기 제품의 목표는 대중적 “AI usage super app”이 아니라 **provider를 넘나들며 계속 만드는 사람의 작업 중단 보험**이다.

### 16.2 문제의 강도 평가

| 타겟 | 문제 빈도 | 중단 비용 | 현재 대안 | 결제 가능성 | 판단 |
|---|---:|---:|---|---:|---|
| 단일 provider 일반 사용자 | 낮음 | 낮음 | provider 기본 화면 | 낮음 | 초기 타겟에서 제외 |
| 여러 provider를 쓰는 취미 바이브코더 | 중간 | 중간 | 각 provider 앱/CLI를 수동 확인 | 낮음~중간 | 무료/저가로 테스트 |
| 매일 쓰는 solo builder/founder | 높음 | 높음 | 여러 창·CLI·메모·새 세션 | 중간~높음 | 핵심 초기 타겟 |
| 전문 개발자/consultant | 높음 | 높음 | CLI·IDE extension·팀 관행 | 중간 | workflow 통합이 되면 유효 |
| 팀/조직 | 중간~높음 | 매우 높음 | 관리자 대시보드·정책 | 높음 | 보안·관리 기능 후속 |

현재 근거만으로 시장 규모나 유료 전환을 확정할 수는 없다. 특히 경쟁 앱의 App Store 리뷰 수가 충분히 많지 않고, VibeUsage류는 오픈소스/CLI라서 “관심”과 “지불”을 구분해야 한다. 그러므로 다음 단계는 기능 확장이 아니라 실제 interruption diary와 concierge test다.

### 16.3 우리가 해결할 수 있는 pain과 해결하지 못하는 pain

**해결 가능성이 높은 pain**

- 여러 provider의 reset/잔여량을 매번 찾아보는 번거로움
- 오래된 값·fallback·auth 오류를 현재 값으로 오인하는 문제
- 한도 초과 직전에 작업을 저장하지 못해 새 세션에서 맥락을 복구하는 시간
- provider를 바꿔야 할 시점을 감으로 판단하는 문제

**아직 해결하지 못하는 pain**

- provider의 실제 quota endpoint가 바뀌거나 공식 접근이 막히는 문제
- 자동 checkpoint가 프로젝트의 의미를 완전히 이해하는 문제
- 단일 provider 사용자의 사용량 자체를 줄여주는 문제
- 사용자가 원래 중단을 거의 경험하지 않는 경우의 지속적인 가치

### 16.4 객관적 제품 가설

> **매주 2회 이상 AI coding 작업이 quota/auth/context 문제로 중단되는 multi-provider 사용자는, 현재 상태·신뢰도·다음 행동·resume brief를 한 화면에서 제공하면 주 3회 이상 재방문하고 저가 결제를 고려할 것이다.**

반증 조건도 사전에 둔다.

- 인터뷰 10명 중 3명 미만이 최근 30일 내 실제 중단 사례를 말한다.
- 중단 경험자도 “provider 화면을 직접 보면 충분하다”고 한다.
- 경고 후 checkpoint/resume 행동률이 20% 미만이다.
- 2주 diary에서 주간 재방문이 2회 미만이다.
- 데이터 신뢰성 문제로 false alert 또는 stale 오인이 반복된다.

위 조건 중 2개 이상이면 mobile widget·provider 추가·결제를 보류하고, 단순 로컬 진단 도구 또는 다른 문제로 재포지셔닝한다.

### 16.5 착수 범위: P0 Work Continuity Slice

이번 구현에서 바로 만드는 것은 다음 한 조각이다.

- Pocket 첫 화면의 `NOW → WHY → NEXT` 의사결정 카드
- quota와 분리된 로컬 세션 context 사용률 카드; 80% 이상 `checkpoint 권장`, 90% 이상 `컨텍스트 임박`
- context 경고에서 metadata-only checkpoint JSON을 로컬 다운로드; prompt/code 자동 요약·provider 자동 전환은 하지 않음
- source·last successful fetch·fresh/fallback/stale 상태를 함께 보여주는 신뢰 표현
- 위험한 상태에서 새 snapshot·연결 확인·상세 보기로 이어지는 하나의 primary action
- 375px 모바일 화면에서의 가독성 및 색상 외 상태 표현
- demo snapshot과 실제 local snapshot 양쪽에서 동작하는 회귀 테스트

이번 착수에서 보류하는 것:

- 자동 provider 전환
- prompt/code를 읽는 AI checkpoint 생성
- 서버 계정·원격 동기화
- widget/Watch/다수 provider 확장
- 사용량을 근거로 한 생산성 점수

### 16.6 현재 착수 결과와 다음 검증

현재 companion에 P0 `NOW → WHY → NEXT` 카드와 상태별 next action을 구현했고, 엔진의 local snapshot에 프롬프트 원문 없이 세션 context 메타데이터를 연결했다. Pocket은 quota와 context를 별도 카드·별도 상태로 표시하며, 80% 이상인 세션을 최우선 상태로 올린다. 경고 시 prompt/code가 없는 metadata-only checkpoint JSON을 로컬 저장할 수 있다. demo/import/offline 회귀 테스트와 export·checkpoint 시 prompt/topic 비노출 테스트를 통과시켰다. 다음은 실제 타겟 10명에게 다음 과정을 수행하는 것이다.

1. 최근 quota/auth/context 중단 사례를 10분 인터뷰로 수집한다.
2. 각 사용자에게 기존 방식으로 작업을 재개하게 한 뒤 시간을 기록한다.
3. TokenJuice 카드로 checkpoint/resume 판단을 하게 하고 시간을 다시 기록한다.
4. 2주 diary에서 alert→action, 재방문, false alert를 측정한다.
5. 행동이 확인된 뒤에야 Usage Coach·widget·provider 확장을 우선순위에 올린다.

성공 기준은 “예쁜 화면”이 아니라 다음 세 가지다.

- 사용자가 10초 안에 가장 위험한 상태를 찾는다.
- 30초 안에 그 상태의 신뢰도와 원인을 설명한다.
- 경고 후 실제로 checkpoint 또는 안전한 provider 전환을 수행한다.

## 17. 2026-10-09 구현 백로그 inventory와 게이트

| 항목 | 상태 | 증거 또는 남은 게이트 |
|---|---|---|
| v1.1 신뢰성 엔진·알림·진단 | 완료 | `CHANGELOG.md`, 최신 `38 pass`·`190 expect()` 엔진 회귀, release-verify |
| v1.2 계정 별칭·온보딩·Windows 공통 엔진·pace forecast | 구현 완료 | `5617b9a`: Engine `37811131425`, Windows `37811131623` 성공; 실기기 렌더는 별도 장비 게이트 |
| P0 UX1~UX5 | 구현 완료 | Pocket NOW/WHY/NEXT, trust/freshness, demo/import/offline browser test; `37809341999` Pages 성공 |
| P0 context checkpoint | 구현 완료 | `6d30b56`, `1654b26`; metadata-only 다운로드와 topic 비노출 테스트 |
| UX6 접근성·375px·5명 사용성 | 코드 검증 완료 / 사용자 검증 대기 | `e825e03`: `--faint`/`--panel-2` 대비율 4.5:1 이상 자동 점검 추가 및 browser test 통과; 실제 대비 측정·스크린리더 수동 점검·실사용자 5명은 pending |
| UX7 행동형 forecast | 구현 완료 | `85858a3`; opt-in local pace forecast를 Pocket snapshot까지 전달 |
| UX8 알림 센터/설정 UX | 코드 기준 구현 완료 / OS presentation·실사용자 검증 대기 | 계정별 opt-in `reconnect`, auth_expired transition 단일 알림, 계정·이유·다음 행동·last success·retry 시각을 `5617b9a`에 추가; stale/unavailable/429·반복 렌더에는 발화하지 않음. OS 알림 표시와 실사용자 선호 검증은 pending |
| UX9 메뉴바 상세 패널/compact | 구현 완료 | compact/notch 출력과 SwiftBar 설치본 비교 통과; 실제 notch 기기 시각 검증은 남음 |
| UX10 랜딩/설치 경로 | 코드 산출물 완료 / 사용자 검증 대기 | `279a260`: `companion/guide.html`의 가치·macOS/Windows/Pocket 설치·개인정보·FAQ·릴리스 링크; `37809141664` Pages 성공; 신규 사용자 5명 검증은 pending |
| P1 7-day history/Usage Coach | 부분 구현/검증 대기 | opt-in local pace history 7일 JSON export와 explicit `--developer` evidence view 추가; 시각적 trend·Usage Coach 우선순위는 2주 diary와 실제 행동 전환 데이터 필요 |
| P2 Developer export/integrations | 로컬 export/statusline 구현 / webhook 정책 게이트 | 기존 `--json`, `--forecast-history`, `--developer`, diagnostics 복사에 `5ee7069`의 opt-in `--statusline` 추가; prompt-free fixture와 최신 38개 엔진 테스트 통과. webhook은 외부 전송·동의·보안 설계 전까지 구현하지 않음 |
| P2 네이티브 widget/Watch/추가 provider | 대기 | PWA 사용률·대기자·provider 안전 adapter 검증 필요 |
| 자동 CloudKit/팀 기능/유료화 | 보류 | 보안·삭제 정책·서버 수집 여부에 대한 명시적 제품 결정 필요 |

최신 코드 증거 `5617b9a`의 Engine verification `37811131425`와 Windows build `37811131623`은 성공했다. 문서-only HEAD `680ec1d`는 새 실행을 만들지 않았으며, Pocket 배포 `37809988430`은 성공했고 배포 URL은 HTTP 200을 반환한다. GitHub Release `v1.2.0`은 draft가 아니며 macOS 엔진·Windows exe asset이 uploaded 상태다. 완료 증거의 공통 기준은 코드 변경, 자동 테스트, 문서 반영, `scripts/release-verify.sh` 통과다. 실기기·사용자 모집·보안 정책이 필요한 항목은 코드가 존재하더라도 완료로 승격하지 않는다.
