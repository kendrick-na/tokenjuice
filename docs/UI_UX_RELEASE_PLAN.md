# TokenJuice UI/UX 출시 품질 계획

확인일: 2026-10-09  
목표: AI Limits Tracker, OpenUsage, VibeUsage, Limits 계열 제품과 비교해 사용자가 첫 화면에서 상태를 이해하고 다음 행동을 완료하게 만든다.

## 1. 경쟁사 대비 디자인 판단

| 비교축 | 경쟁 제품이 잘하는 것 | TokenJuice 현재 | 업데이트 방향 |
|---|---|---|---|
| 첫 인지 | 남은 양·리셋·소진 예상 시각을 즉시 표시 | Pocket은 가져오기 전까지 빈 상태 | 빈 상태도 “무엇을 하면 되는지”와 예시 화면을 우선 노출 |
| 신뢰 | 업데이트 필요·재연결·마지막 성공을 별도 상태로 표현 | 엔진 계약은 있으나 표면마다 이해 난이도 차이 | `fresh / stale / reconnect / unavailable`을 색·아이콘·문장으로 통일 |
| 정보 구조 | 긴급한 quota/account를 위로 정렬 | provider 카드와 context가 함께 보임 | `NOW → WHY → NEXT → DETAIL` 순서를 고정 |
| 행동 유도 | reset, runs out, reconnect를 바로 행동으로 연결 | 일부는 새 스냅샷/터미널 명령을 알아야 함 | 화면의 primary CTA 하나로 복구 경로 제공 |
| 모바일 | 위젯·watch·모바일 화면을 짧은 결정 단위로 구성 | PWA snapshot import 중심 | 실제 기능 경계를 명시하고 375px에서 import→상태 확인을 완결 |
| 개발자 상세 | OpenUsage/VibeUsage처럼 history·비용·session을 확장 | 로컬 상세 정보가 있음 | 상세는 접어서 제공하고 핵심 화면을 복잡하게 만들지 않음 |

## 2. 디자인 원칙

### Calm Operations Console

TokenJuice의 시각적 방향은 화려한 대시보드가 아니라 **작업을 멈추게 할 신호만 조용히 강조하는 운영 콘솔**이다.

- 하나의 화면에는 primary CTA 하나만 둔다.
- 숫자보다 상태 문장과 다음 행동을 먼저 보여준다.
- 색상만으로 상태를 전달하지 않는다. 라벨·아이콘·문장을 함께 사용한다.
- 공식 quota, 로컬 session context, 추정 forecast, stale snapshot을 같은 카드처럼 섞지 않는다.
- 사용자가 읽지 않아도 되는 개발자 명령어는 기본 화면에서 숨긴다.
- 다크 테마를 유지하되 본문 대비 4.5:1 이상, 작은 텍스트 최소 16px, 터치 영역 44px 이상을 지킨다.

## 3. P0 화면 투두

### Pocket 첫 화면

- [x] 빈 상태에서 snapshot import와 demo preview를 함께 제공
- [x] NOW/WHY/NEXT 우선순위 카드
- [x] freshness·source·last success 정보
- [x] provider 상태와 별개로 오래된 export 파일을 "스냅샷 업데이트 필요"로 구분
- [x] fresh/fallback/stale/auth/rate-limit/unavailable의 의미와 다음 행동을 카드에 함께 표시
- [x] offline/local-only 원칙 표시
- [x] 첫 화면에 “이 제품이 누구를 위한 것인지”와 실제 제한(PWA는 자동 동기화하지 않음)을 더 명확히 표시
- [x] import 성공 후 3초 안에 성공 피드백과 최신성 표시
- [x] 잘못된 파일/암호 오류를 원인·해결책·재시도 CTA로 분리
- [x] 실제 snapshot이 없을 때 예시 화면과 실제 데이터의 차이를 더 강하게 구분

### 메뉴바·트레이

- [x] compact 상태에서도 provider 약어만 남기지 않고 `fresh/stale/reconnect`를 접근 가능한 텍스트로 제공
- [x] Windows tray와 Pocket에서 stale/auth/rate-limit/unavailable의 의미를 같은 평문으로 설명
- [x] 클릭 패널 첫 줄에 가장 위험한 quota 또는 context를 표시
- [x] 각 오류 상태에 사용자가 실행할 수 있는 단일 복구 행동 제공 (`NEXT` 한 줄: stale/auth/rate-limit/missing-data; 원인 불명 unavailable은 행동을 제안하지 않음)
- [ ] notch·Windows tray의 잘림과 시스템 글꼴 크기 실기기 확인

2026-10-10 P0 원인 일치 보강: Codex malformed quota를 세션 없음으로 설명하지 않는다.
Windows도 기본/legacy Codex의 invalid_quota·invalid_timestamp를 표시하고 실패 관측을
마지막 성공으로 승격하지 않는다. 합성 메뉴 검증과 Engine 37961548990/Windows 37961549103
CI는 success다. 원인 불명 오류의 로그인·시계 변경 CTA를 만들거나 실기기 체크를 완료하지 않았다.

### 설치·온보딩

- [x] OS를 자동 감지해 잘못된 설치 명령을 안내하지 않음
- [x] 설치 단계를 `설치 → 실행 확인 → 첫 데이터 확인` 3단계로 표현
- [x] SwiftBar/Bun 의존성을 “고급 정보”가 아니라 설치 전제조건으로 명시
- [x] 설치 실패 시 진단 복사와 GitHub 피드백 링크를 같은 화면에 배치
- [x] 메뉴바 미표시 시 `./install.sh --doctor`로 설치 상태를 단계별 판정
- [x] App Store/Google Play 미지원 상태를 숨기지 않고 공개 베타로 표기

## 4. P1 화면 투두

- [ ] 7일 trend와 pace forecast를 quota 카드와 분리
- [ ] account/provider별 reset·threshold·reconnect 설정 화면 — gated: Pocket snapshot 계약은 설정 override를 제외하며, 모바일에서 Mac `config.json`을 수정하면 local-only/읽기 전용 경계를 침범함. 데스크톱의 기존 local per-target 명령만 유지하고 제품·보안 결정 전에는 Pocket 설정을 추가하지 않음.
- [x] session context 80%/90% 단계별 checkpoint CTA (80% checkpoint 권장, 90% 새 세션 전환 준비; 클릭 시 로컬 스냅샷만 내보냄)
- [x] metadata-only checkpoint 다시 열기·재개 안내 복사/텍스트 저장 — 현재 상태와 구분, 독립 상세·메모리 전용·오류 보존·클립보드 대체 경로. 작업 의도/최근 파일을 복원하는 전체 resume brief와 효과 검증은 미완료.
- [x] 작은 화면에서 핵심 카드만 먼저 보이고 상세는 접기 (상태·NEXT는 항상 표시, 출처·마지막 성공은 키보드 가능한 disclosure)
- [ ] keyboard, VoiceOver/TalkBack, reduced motion, dynamic text 실기기 점검
- [x] 스크린샷과 실제 화면이 다른 문서 예시 제거 (README의 `docs/demo.gif`·`docs/screenshot.png` inline 참조 제거; 원본 파일 보존; 영문·한국어 본문에서 현재 Pocket 링크와 수동 snapshot/예시 데이터 구분 안내)

2026-10-09 검증: README의 두 이미지 참조는 검색 결과 0건이며 원본 파일은 Git에 그대로 남아 있다. Pocket 링크는 HTTP 200을 반환했다. `scripts/release-verify.sh`의 엔진 42 pass/217 assertions, 브라우저·번들·스크립트·알림 dry-run 단계는 통과했다. 마지막 SwiftBar 설치본 불일치로 전체 결과는 exit 1이며 실기기 gate를 유지한다. README와 이 문서는 Engine/Windows/Pages push path filter 대상이 아니므로 문서 반영이 새 PWA 배포를 뜻하지 않는다.

남은 미체크 항목은 7일 trend의 실제 시계열 snapshot 계약·행동 근거, Pocket 설정의 제품·보안 결정, notch/tray·스크린리더·큰 글자 실기기 확인이다. 사용자 5명 테스트·10명 인터뷰·14일 diary와 설치본 검증은 `docs/LAUNCH_FEEDBACK_PLAN.md` 및 `docs/VALIDATION_KIT.md`의 외부 gate로 계속 추적한다.

2026-10-10 추가: 기획 §16.5의 metadata-only 범위에서 `저장한 작업 이어가기` 상세를
구현했다. frontend-design·ui-ux-pro-max의 정보 위계/점진적 공개/44px/키보드/큰 글자 원칙을
적용하되 기존 로컬 폰트와 dark token set을 유지했다. 기본 NOW는 바꾸지 않고 가져온
checkpoint의 시점·한계를 설명하며, 화면 메모리만 사용한다. 자동 요약·생산성 평가·설정
전송·자동 provider 전환은 없다. webapp-testing으로 375px·landscape·desktop·200% 글자·
reduced motion·dark token 대비·copy/download/clipboard 거절·오류 보존·오프라인을 검사하고
모바일/desktop 합성 fixture 캡처를 시각 확인했다. 기존 context/account 헤더의 큰 글자
overflow도 재현 후 flex 줄바꿈으로 수정했다. VoiceOver/TalkBack·실기기·사용자 효과는 pending이다.

`4d326d3`의 Engine [37955457646](https://github.com/kendrick-na/tokenjuice/actions/runs/37955457646), Windows [37955457689](https://github.com/kendrick-na/tokenjuice/actions/runs/37955457689), Pages [37955457796](https://github.com/kendrick-na/tokenjuice/actions/runs/37955457796)는 success다. 공개 HTML의 resume 상세·sw v11과 새 모듈/app.js의 소스 해시 일치를 확인했다. desktop release job은 tag가 없어 skipped이며 실제 설치본/실기기·사용자 gate는 유지한다.

## 5. 출시 전 UX 검증 시나리오

2026-10-10 설치본 검증 후속: 승인 범위의 플러그인 한 파일 갱신·백업·본문 cmp·격리
실행이 완료됐고 release-verify는 설치본 일치까지 exit 0(76 pass/829 assertions)이다.
CUA가 SwiftBar에 attach할 수 없어 실제 메뉴바/클릭 패널·notch·sleep/wake 확인은 pending이다.
일반 installer/앱 restart/refresh·권한·설정은 변경하지 않았다. 상세는 audit §9.16이다.

같은 날 R13 후보 af7bdee의 CI success를 확인한 뒤 백업·승인된 6줄 설치 반영으로 다시
source/install cmp와 release-verify 전체 exit 0(78 pass/890 assertions)을 확인했다.
메뉴바·실기기 UI는 여전히 pending이며 상세 hash/격리 설치 실행은 audit §9.17이다.

참가자에게 설명하지 않고 아래를 수행하게 한다.

1. Pocket을 열고 “지금 작업을 계속해도 되는지” 말한다.
2. stale 또는 reconnect 상태의 원인과 다음 행동을 말한다.
3. 예시 화면과 실제 snapshot을 구분한다.
4. Mac 설치 후 메뉴바에서 실제 값을 찾는다.
5. context 경고 뒤 checkpoint를 저장한다.

합격 기준:

- 10초 안에 가장 위험한 상태를 찾는 비율 90% 이상
- source/fresh/stale 의미를 설명하는 비율 80% 이상
- 잘못된 provider나 오래된 값을 fresh로 오인하는 비율 5% 미만
- 경고 후 checkpoint/resume 행동 완료 30% 이상
- 375px 가로 스크롤 0건

## 6. 착수 순서

1. 현재 Pocket의 빈 상태·import 오류·feedback 진입점 개선
2. Mac 설치/메뉴바 실기기 문제를 재현하며 동일 상태 언어를 연결
3. 메뉴바 상세 패널의 NOW/WHY/NEXT를 검증
4. 5명 UX 테스트 후 수정
5. 그 다음 trend·위젯·스토어 패키징을 진행

스토어 등록, 확장프로그램, 위젯을 먼저 만드는 것은 UI/UX 성공을 증명하지 않는다. 첫 상태 확인과 복구 행동이 통과된 뒤에만 다음 플랫폼으로 확장한다.
