# TokenJuice 경쟁 격차 지도 · 개선 체크리스트

확인일: 2026-10-11. 기준 checkout d16ce3d / 공개 Pocket sw v13.
판정: **핵심 Claude 표시가 사용자 컴퓨터에서 실패 중이므로 출시 품질 미달.** 테스트 통과·아이콘 표시·기능 파일 존재를 제품 완성으로 보지 않는다.

## 1. 실제 Claude `?` 진단

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
| TokenJuice 현재 | SwiftBar/Windows tray·Pocket | Claude/Codex, trust, checkpoint, 선택 파일의 로컬 추출 초안 | Claude 실제 표시 실패. Pocket 수동 import. 생성형 요약·native 기기간 sync·스토어 앱 아님 |

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

## 5. 실행 체크리스트와 완료 증거

| 우선 | 체크 항목 | 완료를 인정할 증거 |
|---|---|---|
| P0 | [ ] 현재 컴퓨터 Claude 수집 복구(최신 HTTP 429) | 같은 계정의 5h/weekly·reset 대조, 새 성공 시각, 실제 메뉴 확인 |
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
