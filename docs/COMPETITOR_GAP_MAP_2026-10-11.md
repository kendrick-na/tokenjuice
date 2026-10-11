# TokenJuice 경쟁 격차 지도 · 개선 체크리스트

확인일: 2026-10-11. 현재 코드 기준 f34af88 / 공개 Pocket 7a4031e·cache v20 / desktop release v1.2.2. 출시 채널과 가격의 후속 비교는 §7~§10을 적용한다.

최신 관측 18:16 KST: 진단 수정 de84bc8 설치·소스 일치와 strict 검증 통과. Claude는 HTTP 429/backoff 상태, retry 표시 18:59(audit §9.48). 아래 계정 대조 통과는 당시 기록이며 현재 live 수집 또는 장기 안정성 완료가 아니다.
현재 판정: **현재 Claude 계정·수치·reset 대조 통과 / 신규 설치·절전·장기 인증과 전체 출시 품질 검증 미완료.** 테스트 통과·아이콘 표시·기능 파일 존재를 제품 완성으로 보지 않는다. 아래 초기 진단·디자인 관찰은 당시 이력이며 현재 화면의 재감사 결과가 아니다.

## 1. 실제 Claude `?` 진단

**현재 상태:** 공식 Claude 설정 화면과 현재 선택 계정의 세션·주간·reset을 대조했다(audit §9.47). 현재 컴퓨터의 한 계정 검증이며 다른 계정·신규 설치·절전·장기 인증 안정성을 증명하지 않는다. 사용자 “실제 숫자가 보임”도 확인됐다. statusLine 실제 callback이나 웹 쿠키로 복구했다는 증거는 없다. 아래 401/429 기록은 과거 진단 이력이다.

**후속 갱신(01:54 KST):** 아래 표와 재로그인 제안은 00:29의 401 조사 기록이다. 현재 fail cache는 00:59:38의 HTTP **429**, retry는 01:59:38까지로 바뀌었다. 공식 Desktop 화면에서 세션 28%/주간 17% 사용은 확인했으나 history 파일은 갱신되지 않았다. statusLine bridge는 quota-only 구현/회귀 검증만 완료, Team의 실제 callback 없음. 지금은 재로그인 반복이나 backoff 제거를 제안하지 않는다. 현재 단계와 승인 경계는 개발기획서 §20 및 audit §9.25~9.26을 따른다.

자격증명 내용·프롬프트를 출력하지 않고 설정과 캐시 메타데이터만 읽었다. Keychain/API 요청·로그인 갱신·설정 변경은 하지 않았다.

| 관찰 | 결과 | 해석 |
|---|---|---|
| API 설정 | true | API 미활성화가 원인이라는 설명은 틀림 |
| 자동 로그인 갱신 | false | 자동 갱신 실행 중이라는 증거 없음 |
| 마지막 성공한 API 캐시 | 2026-10-08 05:02 KST, 두 quota window | 예전 파일의 state=fresh는 당시 상태. 지금도 fresh라는 뜻 아님 |
| 최신 실패 기록 | 2026-10-11 00:29 KST, HTTP 401, refreshing=false | 인증 실패가 기록됨. 만료/잘못 선택한 자격증명 중 어느 것인지는 미확정 |
| 표준 Claude 로컬 quota 후보 4개 | 없음 | 해당 기본 경로로는 대체 최신값을 못 얻음 |
| Claude Desktop history 파일 | 10월 6일 이후 파일 갱신 없음 | 최근 대체 관측을 기대할 수 없음 |

소스의 수집 경로: 최근 로컬값 → 최근 앱값/API cache → API. 실패 시 오래된 숫자를 최신값으로 표시하지 않으므로 `?`가 가능하다. 이번 판단은 최근 캐시와 소스 경로로 좁힌 원인이며, 실제 메뉴 화면·새 API 응답까지 재현한 증거는 아니다. 별도 root/accounts 설정 존재 여부도 필요 시 확인한다.

다음 검증: 사용자가 정상 Claude 로그인을 갱신 → 동일 계정의 provider 사용량 화면과 TokenJuice 5h/weekly·reset 대조 → 새 lastSuccessAt 확인 → 재시작/절전 복귀까지 확인. 실패하면 계정/root 선택과 credential lookup을 조사한다. 사용량 연결 동의 없이 새 권한을 활성화하거나 raw token을 노출하지 않는다. 401이 없어지기 전에는 복구 완료로 표기하지 않는다.

## 2. 비교 범위와 증거 수준

- 실화면: TokenJuice 첫 화면·예시 dashboard, Limits, AI Limits Tracker, OpenUsage의 공개 사이트를 같은 in-app browser에서 관찰.
- 공식 문서: VibeUsage, ClaudeCodeUsage README. 해당 앱의 설치 UX/정확성은 미검증.
- 공개 소개 이미지·샘플값은 디자인 근거일 뿐 실제 quota 정확성 근거가 아니다. SEO/매출/전환율/독립 리뷰 모집단은 조사하지 않았으므로 수치 평가하지 않는다.
- [프로필·날짜별 수집 노트](../competitor-profiles/_summary.md)에 근거를 보관했다. AI Limits Tracker와 Limits는 서로 다른 제품이다.

## 3. 기능·서비스 비교 지도

| 제품 | 작업 중 확인 표면 | 데이터와 편의성: 공식 설명 기준 | 우리에게 중요한 격차 |
|---|---|---|---|
| [AI Limits Tracker](https://ailimits.app/) | Mac panel/island·모바일·Watch | provider 연결, 계정 관리, snapshot 공유, 재연결 안내 | 파일 수동 전달보다 연결·복구 흐름이 앞섬 |
| [Limits](https://getlimits.app/) | iPhone dashboard·위젯 | reset 확인 알림, 소진 경고, credit expiry | 일상적으로 확인하는 마찰이 작음. iOS 갱신 제한 명시 |
| [OpenUsage](https://openusage.sh/) | terminal·tmux·statusline | 다중 provider, spend/quota/history; 현 화면 34개 표시 | 별도 웹을 열지 않아도 됨. 범위는 provider별 확인 필요 |
| [ClaudeCodeUsage](https://github.com/ClaudeCodeUsage/ClaudeCodeUsage) | VS Code status bar·dashboard | 기간/프로젝트/토큰 구성, 추정 비용, 관측 quota | 코딩 환경 안의 분석. live quota와 로컬 관측 구분 |
| [VibeUsage](https://vibeusage.com/) | CLI | 사용 습관 분석·절감 조언; 다른 tool 일부는 예정 | 수치에서 구체적 절감 행동으로 연결 |
| TokenJuice 현재 | SwiftBar/Windows tray·Pocket | Claude/Codex, trust, checkpoint, 선택 파일의 로컬 추출 초안 | Claude 실제 숫자 복구 확인, 장기 실행 검증 미완료. Pocket 수동 import. 생성형 요약·native 기기간 sync·스토어 앱 아님 |

기능 확장의 순서 지도:

정확한 연결/복구(P0) → 작은 상태 화면(P0) → 쉬운 설치·첫 성공(P0)
→ 시각적 위계·제품 소개(P1) → 일상 알림·최소권한 연결(P1)
→ 근거 있는 작업 재개/분석(P2) → 추가 provider·스토어(P2, 별도 심사)

## 4. 디자인 판단 — 주관적 취향과 관찰을 구분

현재 Pocket은 분위기는 있지만 첫 사용과 빠른 상태 확인에는 부족하다. 산세리프로 바꾸는 것만으로 해결되지 않는다.

| 화면 | 직접 관찰한 차이 | 개선 판단 |
|---|---|---|
| Limits 소개 | 절제된 흑백, 큰 제목, 앱·위젯 제품 이미지와 CTA | 결과 화면을 첫 fold에 보여주는 구조 참고 |
| AI Limits Tracker 소개/운영 예시 | 밝은 배경, 정렬된 숫자·reset·짧은 상태, 기기별 화면 | quota 비교 밀도와 숫자 위계 참고 |
| OpenUsage 소개 | 일관된 픽셀 로고·모노스페이스·소수 강조색 | 타깃 맞춘 정체성 참고. 영상은 여기서 재생 불가 |
| TokenJuice 소개 | 매우 큰 한글 세리프 문구, 긴 설명, 파일 import가 첫 행동 | 제품 소개와 실제 앱을 분리. 실제 결과/설치 CTA를 앞에 |
| TokenJuice 예시 dashboard | NOW/NEXT 유사 문장 반복, 첫 상태 카드가 큼, Claude 반폭 카드 옆 빈 공간, Codex 다음 줄 | provider 카드를 일관된 grid/행으로 정렬. 숫자 먼저, 문제가 있을 때만 짧은 행동 배너 |
| TokenJuice resume/초안 | quota 첫 화면과 별도 파일 workflow가 같은 페이지에 누적 | Usage / Work / Settings로 분리. 원문 처리 경고는 파일 선택 시점에 유지 |

경쟁사 화면을 베끼지 않고, 숫자·간격·흐름의 명료성을 기준으로 삼는다. 현재의 `상태 문장 우선` 원칙은 수정한다: **정상일 때 잔여량과 reset 우선, 문제일 때 원인과 복구 우선.** 한도와 context는 반드시 분리한다.

VibeUsage 후속 문서 대조: [프로필](../competitor-profiles/vibeusage.md)에 로컬 분석과 quota API 호출 경계를 분리했다. Coach의 도구 호출 비율을 토큰 절감률로 광고하지 않는 것이 TokenJuice 설계 기준이다. 실제 절감은 동등한 작업 비교로 검증하며 유료 수요 검증을 대신하지 않는다.

## 5. 실행 체크리스트와 완료 증거

| 우선 | 체크 항목 | 완료를 인정할 증거 |
|---|---|---|
| P0 | [x] 현재 컴퓨터의 현재 Claude 계정 수치 복구 | 사용자 숫자 확인 + 공식 계정·5h/weekly·reset 대조(audit §9.47). 장기 갱신/신규 설치는 별도 미완료 |
| P0 | [ ] `?`를 원인 있는 상태로 표현 | 연결 안 됨/재로그인/제한/지연 별 라벨·단일 복구 CTA. unknown을 0%로 만들지 않음 |
| P0 | [ ] 첫 실행 연결 온보딩 | 계정 선택→권한 설명→연결 확인→첫 성공. 없는 캐시 기다리라고만 하지 않음 |
| P0 | [ ] UI와 데이터 계약 일치 | fresh/fallback/stale/auth/429/unknown 화면과 자동 회귀 테스트, fake live 금지 |
| P0 | [ ] 노트북·절전 실기기 확인 | 내장 화면, 외장 분리, 재로그인, 절전 복귀 각각 기록 |
| P1 | [ ] 사용량 홈 재구성 | 동일 높이의 provider card, 5h/weekly 큰 숫자·reset, 빈 공간/반복 안내 제거 |
| P1 | [ ] 연결 문제 화면 구현 | 마지막 성공, 원인, 재연결/재확인, 다음 retry를 한 화면에서 이해 |
| P1 | [ ] 소개 페이지와 Pocket 구분 | 제품 화면+설치 CTA+지원 OS/베타 범위. 예시값과 실데이터 확실히 구분 |
| P1 | [ ] 일관된 디자인 토큰 | UI sans/숫자 tabular, spacing·border·badge·focus·상태색 통일. 한국어 줄바꿈 확인 |
| P1 | [ ] 접근성·반응형 | 375/768/1440, 키보드, screen reader, 대비, 확대, reduced motion 기록 |
| P1 | [ ] 일상 확인 마찰 축소 | local companion 연결 방안의 threat model/동의 설계 먼저. 수동 import를 auto sync로 광고하지 않음 |
| P1 | [ ] 알림 정확성 | OS 알림 권한·재시작·절전·중복 억제·reset 관측 검증. 화면 토글 존재만으로 완료 아님 |
| P2 | [ ] 작업 재개 가치 검증 | 저장→새 세션 재개 성공 과제. 추출 초안을 생성형 자동 요약으로 부르지 않음 |
| P2 | [ ] 분석/절감 제안 | 데이터 coverage·근거·추정 라벨, 동등 과제 비교. 토큰량을 생산성 지표로 대체하지 않음 |
| P2 | [ ] 배포 채널 | 실사용 베타부터. native Mac/store/Android/extension은 각각 설치·서명·정책·심사 트랙 |

## 6. 제품 출시 판정

P0 통과 전: 기능 추가보다 정확성과 복구 흐름 우선. P1 화면 재설계는 P0와 병행 가능하지만 완료를 대신하지 못한다.
사용자 5명에게 연결·잔여량 이해·문제 복구·작업 재개 과제를 주고 관찰한다. 이는 **이번 사용성 검증 기준**이며 전체 사용자의 니즈/유료 전환을 증명하는 수치가 아니다.
체크리스트는 실기기 완료 증거가 없으면 미완료로 유지한다.

### 같은 날 후속: 좁은 연결 오류 UX 구현

진단 이후 오류 표시 코드와 회귀 테스트를 추가했다. SwiftBar 실패 헤더의 `?` 이미지를 짧은 원인 라벨로 대체하고, 메뉴의 원인·마지막 성공·retry·재인증 NEXT를 노출했다. Pocket 실패 카드에서도 복구 근거를 접힌 상세 밖으로 이동했다. 정상 숫자·한도 계약은 유지했다. 전체 redesign/자동 sync는 하지 않았다.

release-verify exit 0 (엔진 87/1159 assertions + 요약 7/31, 브라우저 검증 포함). 기존 Mac plugin의 표시 코드만 백업 후 갱신했고 소스 일치 확인. 재인증/실제 숫자/실제 메뉴 검증, commit/push/공개 배포는 아직 미완료다. 로컬 sw v14 후보와 공개 v13을 구분한다. 자세한 증거는 [요구사항 감사 §9.24](REQUIREMENTS_AUDIT.md#924-claude-연결-실패복구-ux--2026-10-11-로컬-변경).

후속 정정: 사용자가 텍스트 헤더 변경 후 바가 사라졌다고 신고했다. 헤더만 이전 고정폭 이미지로 복원하고 refresh 요청했다. 실제 화면 복구는 사용자 확인 전까지 pending. 오류 원인/복구 안내는 클릭 메뉴와 Pocket에서 유지한다. 노트북 표시 검증 없이 텍스트 길이를 안전하다고 판단하지 않는다.

사용자 확인 업데이트: ‘다시 보임’으로 아이콘 재표시는 확인 완료. Claude 인증/실제 값 정확성/절전 복귀까지 통과한 것은 아니다. 기존 아이콘을 유지하고 추가 헤더 실험은 하지 않는다.

## 7. 경쟁사 출시 채널과 가격 비교

2026-10-11 공개 등록 페이지 기준이다. 미국 App Store USD 가격은 다른 지역·Android 가격에 그대로 적용하지 않는다. 스토어 업데이트 제공과 실제 자동 업데이트 성공은 별개다.

| 제품 | 실제 배포 표면과 설치 | 갱신 및 피드백 표면 | 가격과 계정 조건 |
|---|---|---|---|
| AI Limits Tracker | [Apple 등록](https://apps.apple.com/us/app/ai-limits-tracker/id6801493876), [Mac 링크](https://apps.apple.com/us/app/ai-limits-tracker/id6801493876?platform=mac), [Play 등록](https://play.google.com/store/apps/details?id=com.jocoding.aiLimitsTracker). iPhone/Mac/Watch/Android | 스토어 버전 이력·지원 이메일. Apple 목록 1.0.23, Play 업데이트 10월 9일 | 무료 1계정; Pro 다계정. Apple 월 $2.99/연 $14.99/평생 $29.99. 동일 Apple Account의 iPhone/Mac 구매 공유. Android 가격 미확정 |
| Limits | [iPhone App Store](https://apps.apple.com/us/app/limits-ai-usage-tracker/id6783130074). 독립 Mac 메뉴바/Android 출시는 확인되지 않음 | 목록 1.0.8, 개발자 리뷰 응답, 앱 Settings 피드백 및 [이메일 지원](https://getlimits.app/support) | 무료 시작·reset 확인 알림; Pro 예측 경고. 월 $1.99/연 $6.99/Pro $14.99. Pro 상품 기간은 목록 이름만으로 확정하지 않음 |
| OpenUsage | [공식 설치](https://github.com/janekbaraniewski/openusage#install): Homebrew·스크립트·Go source, [GitHub binaries](https://github.com/janekbaraniewski/openusage/releases). Mac/Linux/Windows CLI | GitHub Issues/PR·changelog, latest 목록 v0.25.0(8월 31일). 릴리스 checksum/Sigstore 자료 | MIT 공개 배포. 구독 가격표 없음. provider 사용료는 별도 |
| ClaudeCodeUsage | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=growthjack.claude-code-usage) 등록 확인; 공식 README의 [Open VSX](https://open-vsx.org/extension/GrowthJack/claude-code-usage) 링크는 본문 확인 제한. IDE 설치 또는 VSIX | Marketplace version history/Q&A/review, GitHub Issues/PR. README v2.4 설명과 실제 배포 VSIX 버전은 구분 | MIT. 유료 상품 가격 미확인; 선택적 AI는 사용자 key/API 비용. Chrome 확장이 아님 |
| VibeUsage | [홈](https://vibeusage.com/) `npx vusage`, [README](https://github.com/edwluo/vibeusage) `npx vibeusage`; Node 18+. npm 명칭 대조 필요 | 공개 저장소·npm 배포 경로. 실제 npm 버전/업데이트 동작 미검증 | MIT. 유료 구독 근거 없음. 별도 Vibe Island 앱을 합산하지 않음 |
| TokenJuice | GitHub desktop v1.2.2 + SwiftBar/Windows tray, 공개 Pocket PWA. 스토어 등록 없음 | GitHub 이슈·수동 진단/설치 갱신. 사용자 피드백 운영 접근성은 실제 확인 필요 | 현재 공개 배포. 유료 전환은 수요/원가 검증 이후. Pocket 파일 import는 자동 계정 연결이 아님 |

OS 최소 조건에 불일치가 있다. AI Limits Tracker 홈페이지는 iOS 17, Apple 목록은 iOS 16/macOS 12/watchOS 10을 표시한다. Limits 목록은 iOS 26이며 Mac 호환성은 M1/macOS 26이나 “macOS 검증 안 됨”도 명시한다. 이를 독립 native Mac 제품이라고 부르지 않는다. Android 최소 OS·정확한 IDE 버전 조건은 후속 확인 대상이다.

## 8. 데이터 수집과 개인정보 비교

| 제품 | 연결과 데이터 경계 | 제품 판단에 반영할 제한 |
|---|---|---|
| AI Limits Tracker | provider 직접 로그인; Apple Keychain/CloudKit. Android는 [기기 Keystore·로컬 snapshot](https://play.google.com/store/apps/details?id=com.jocoding.aiLimitsTracker), 클라우드 sync 없음 | [정책](https://ailimits.app/privacy)에 RevenueCat·PostHog·AppsFlyer와 분석 끄기 명시. usage 비전송을 무추적으로 표현하지 않음. 스토어 개인정보 라벨은 개발자 신고 |
| Limits | [Safari provider 로그인](https://getlimits.app/), Claude 코드 붙여넣기/일부 redirect. Keychain·App Group snapshot | [정책](https://getlimits.app/privacy): 자체 backend/추적 없음, RevenueCat 구매 검증. broad scope와 앱의 제한된 사용 주장은 다름. 정책의 일회성 구매 설명은 현재 월/연 상품과 불일치 |
| OpenUsage | 로컬 도구·API key 탐지와 provider별 수집; 로컬 SQLite history | [README](https://github.com/janekbaraniewski/openusage)에 provider별 credential 원천이 다름. 로컬 dashboard가 모든 기능 무네트워크를 뜻하지 않음 |
| ClaudeCodeUsage | [공식 설명](https://github.com/ClaudeCodeUsage/ClaudeCodeUsage): 로그 분석, Claude OAuth quota, Codex 마지막 관측; 선택 AI 요청 preview/Send·SecretStorage | credential 갱신/writeback과 optional 원격 전송을 구분. synthetic UI를 실계정 정확성 증거로 쓰지 않음 |
| VibeUsage | [README](https://github.com/edwluo/vibeusage): overview 로컬 JSONL, limits는 Claude credential로 Anthropic API 호출 | no telemetry 주장과 API 요청을 구분. tool-call 비율을 절감 token 비율로 환산하지 않음 |
| TokenJuice | 로컬/명시적 API·source/trust 표시, 수동 quota snapshot 전달, 선택 대화 인계 | 모바일 snapshot과 인증 credential 분리. 자동 sync·실제 생성형 요약 품질은 미완료. 진단은 읽기 전용 보장과 비밀값 제거를 모두 검증해야 함 |

스토어 등록은 provider 공식 제휴·OAuth 이용 허가나 향후 API 안정성을 보증하지 않는다. 경쟁사 흐름을 근거로 브라우저 쿠키 접근이나 고객 자격증명 수집을 추가하지 않는다.

## 9. 수요와 경쟁 위치

[Limits 미국 리뷰](https://apps.apple.com/us/app/limits-ai-usage-tracker/id6783130074)는 업무/개인 계정 통합, 위젯 즉시 확인, 결제 만족과 Live Activities 요청을 포함한다. 현재 표시 4.4/39 ratings는 지역별 snapshot이며 독립 인터뷰나 전체 유료 전환율이 아니다. AI Limits Tracker Apple 평점은 최근 초기화, Play 10+ 표시는 활성 사용자나 매출이 아니다. VibeUsage의 결제 수요 근거는 없다. “일반 AI 사용자 누구나 구독한다”는 결론은 지지되지 않는다.

| 주 사용 시점 | 빠른 확인 중심 | 상세 분석과 행동 중심 |
|---|---|---|
| 작업 화면 안 | AI Limits Tracker Mac | OpenUsage terminal, ClaudeCodeUsage IDE, VibeUsage CLI |
| 작업 화면 밖 | AI Limits Tracker mobile/Watch, Limits widget | TokenJuice Pocket 인계 검토는 현재 수동 전달 |

위치는 기능 설명에 따른 정성적 분류다. TokenJuice의 차별화 후보는 **한도 때문에 끊기기 전에 판단하고, 끊겨도 검토한 작업 맥락으로 재개하는 흐름**이다. 자동 요약을 더한다는 사실만으로 절감·재개 가치가 증명되지는 않는다. 실제 작업 재개 성공·다시 설명한 양·시간·token을 함께 관찰한다. 경쟁사에도 세션 재개/AI 조언이 있어 “유일”이라는 주장은 하지 않는다.

## 10. 개발 및 출시 변경사항

채널 권고는 기존 데스크톱 공개 베타를 개선하면서 Android의 실제 연결·위젯을 병행 설계하는 것이다. 사용자가 요구한 스토어 출시 목표는 유지한다. 수동 파일 앱 포장이나 심사용 껍데기를 모바일 핵심 상품으로 대체하지 않는다. 기존 Google Play 조직 계정은 확인됐지만 TokenJuice 등록/제출·서명은 아직 없다. Apple 유료 membership과 Chrome 개발자 등록은 미확정이다.

| ID | 우선 | 구현 산출물 | 완료 증거 |
|---|---|---|---|
| C01 | P0 | 현재 계정→공식 quota→TokenJuice 대조; 만료/429/절전 복구 | 현재 계정 대조 완료. 신규 설치·장기 실행·절전은 미완료로 별도 기록 |
| C02 | P0 | 연결 설정에서 계정·권한·수집 원천·마지막 성공·재연결 동선 | 새 사용자 최초 연결/만료 복구 과제; credential 무노출·허위 최신값 없음 |
| C03 | P1 | 소개 페이지와 운영 화면 분리, provider 숫자/reset 정렬, 짧은 오류 CTA | 경쟁사 같은 과제/폭 비교, 375/768/1440·키보드·확대·실기기 관찰 |
| C04 | P1 | 앱 내 피드백 진입점, 미리보기 가능한 비밀값 없는 진단·동의 후 전송 | 실제 접수→분류→수정→재검증→응답 1건. 가짜 인터뷰 금지 |
| C05 | P1 | desktop 설치/업데이트/rollback·변경 이력·known limits | 새 기기 설치·첫 숫자·절전·업데이트 후 설정 보존. CI만으로 통과 금지 |
| C06 | P2 | Android provider 연결 가능성 검증, Keystore·usage snapshot·widget·reset 알림 | 실제 기기 로그인/만료/429/백그라운드/오프라인. 파일 import-only를 live tracker라고 하지 않음 |
| C07 | P2 | 검토한 요약·선택 파일 인계→새 세션 작업 재개 | 동의된 실대화의 의미 품질·재개 과제·시간/비용. API key/외부 전송 별도 동의 |
| C08 | P3 | Play 서명 AAB/내부 테스트·개인정보/Data Safety·설치/피드백 안내 | 사용자가 선택한 release scope, 실제 install/검증; 제출/키 등록은 승인 후 |
| C09 | P3 | 독립 Mac 앱/Apple 배포; 확장 채널은 Chrome와 IDE 구분 | membership/권한/고유 사용 사례·패키지 검증. 경쟁사 VSIX를 Chrome 출시 근거로 삼지 않음 |

Android 구현 방식은 C06에서 실제 provider 연결 제약과 widget 요구를 확인한 뒤 결정한다. 오프라인 Pocket 포함 앱/TWA/네이티브의 기술 선택은 아직 확정하지 않는다. 기술 선택 질문으로 시장 비교를 대체하지 않는다.

후속 증거: 제품별 `competitor-profiles/raw/<slug>/2026-10-11-release-recheck/scrapes/distribution.md`. Firecrawl/DataForSEO가 없어 공식 공개 텍스트로 대조했다. 설치 UX·OS별 동작·독립 리뷰 모집단·실제 유료 수요는 여전히 추가 검증 대상이다. SEO 수치는 만들지 않았다.
