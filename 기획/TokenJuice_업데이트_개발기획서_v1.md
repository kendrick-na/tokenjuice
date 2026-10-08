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
| R9~R11, R17~R18 | 안전한 starter config, 멀티 계정 별칭, Windows renderer, opt-in 세션 상태·pace forecast | 구현·자동 검증 완료(Windows 실기기 CI 대기) |
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

### v1.2 — 온보딩·계정·Windows 일관성

범위: R9~R11.

완료 기준:

- 최초 실행 시 필요한 권한과 읽는 데이터 경로를 설명하고, 토큰·코드·프롬프트를 외부로 보내지 않는 정책을 화면에 명시한다.
- 사용자가 계정 별칭과 현재 선택된 계정을 확인할 수 있다.
- macOS와 Windows에서 fresh/stale/error/알림 의미가 동일하다.
- 복구 명령은 자동 실행 여부와 사용자 실행 선택을 분명히 구분한다.

### v2.0 — 확장 플랫폼·제공자

범위: R12~R14 및 검증된 R13 어댑터.

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
