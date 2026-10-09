# 변경 기록

형식은 Keep a Changelog의 범주를 참고한다. 날짜와 배포 태그는 실제 공개 릴리스가
생성된 뒤에만 확정한다.

## [Unreleased] — 공개 PWA 베타

### 변경

- 데스크톱에 별도 opt-in 리셋 임박 알림을 추가했다. 기본 꺼짐, 전역/윈도별 1~60분
  설정, fresh·미래 reset만 허용, 동일 reset 중복 방지 및 로컬 메뉴/CLI 제어를 지원한다.
  Windows toast·Pocket 설정 동기화를 추가한 것은 아니다.
- Claude 로컬 pace 예측 소진 알림을 별도 opt-in으로 추가했다. history 수집과 알림 동의는
  분리하고, fresh·최근 관측·충분한 표본·알려진 미래 reset 비교와 구간별 중복 방지를
  적용한다. Codex pace 예측은 아직 제공하지 않는다.
- Pocket 첫 화면에 대상 사용자(Claude Code·Codex를 자주 쓰는 사람)와 수동 스냅샷 방식,
  자동 동기화·앱스토어 미지원 상태를 명시했다.
- 가져오기 직후 스냅샷 최신성을 함께 알리고, 암호화 번들의 암호 입력을 취소했을 때도
  기존 데이터를 유지한 채 재시도 방법을 안내한다.
- GitHub 피드백 양식에 비밀값 없는 `--copy-diagnostics` 경로와 “이전에는 작동했나요?”
  회귀 질문을 추가했다.

### 수정

- 메뉴바 NOW의 quota 위험 점수가 잔여율을 내림차순으로 정렬해 여유 있는 창을 먼저
  보여주던 역전 문제를 수정했다. Claude/Codex의 사용률과 context 점유율을 같은 위험
  방향으로 비교하며 stale/unavailable 상태 경고는 숫자보다 먼저 표시한다.
- Pocket에서 바깥 형식은 맞지만 내부 계정·한도 구조가 손상된 파일을 가져오면 기존
  스냅샷을 덮어쓰던 문제를 수정했다. 14종 잘못된 구조에 대해 저장본과 화면 보존을
  검증하며, 구버전 v1 export·암호화 가져오기·손상된 저장본의 빈 상태 복구도 검증한다.
- Pocket의 stale/auth-expired/rate-limited/unavailable 카드에서 과거 잔여량·소진 예측을
  현재 수치처럼 표시하지 않도록 숨겼다. Claude/Codex/local provider의 12가지 상태 조합과
  fresh/fallback 표시 유지 회귀를 검증한다.
- 암호화 가져오기 테스트의 고정 시간 대기를 실제 완료 조건으로 바꾸고 느린 복호화 회귀를
  추가했다. 서비스 워커 캐시 v10에 가져오기 검사와 신뢰 상태 표시 수정을 포함한다.

### 알려진 제한

- Pocket은 직접 가져온 로컬 스냅샷 뷰어다. 자동 동기화, push, 계정 로그인, App Store와
  Google Play 배포를 제공하지 않는다.
- macOS SwiftBar 설치본의 메뉴바 표시·실계정 데이터·절전 복귀는 실제 기기 검증 전까지
  공개 출시 통과로 간주하지 않는다.
- Windows 트레이 빌드는 CI로 검증하지만 실제 Windows 기기의 tray 렌더링과 toast는 별도
  수동 검증이 필요하다.

## [1.2.1] - 2026-10-09

### 출시 범위

- `--statusline` 로컬 opt-in export
- quota-window별 알림 on/off·threshold·reset·다음 reset 시각
- 계정별 opt-in `reconnect` 알림과 auth_expired transition 중복 방지
- Pocket 접근성 대비 보정과 최신 설치·CI 검증

## [1.2.2] - 2026-10-09

### 출시 범위

- Pocket/guide 375px·desktop overflow 및 200% large-text 대응
- keyboard focus-visible·ARIA name/landmark·44px touch target 자동 검증 확대
- prefers-reduced-motion 우선순위 보정 및 실제 media emulation 테스트
- dark token 대비 측정 범위 확대와 light preference 회귀 확인

## [1.1.0] - 출시 후보

### 추가

- Claude·Codex 한도 데이터의 `fresh`, `fallback`, `stale`, `auth_expired`,
  `rate_limited`, `unavailable` 신뢰 상태
- 데이터 출처, 마지막 성공 시각, 재시도 시각, 신뢰 배지와 비밀값 없는 진단 출력
- `429 Retry-After` 준수 및 사람이 읽을 수 있는 재시도 카운트다운
- 기본 꺼짐인 한도 임박·리셋 알림
- 기본 수동 Claude 로그인 갱신과 메뉴의 명시적 갱신 동작
- 절전 복귀 시 SwiftBar 새로고침 디바운스
- 안전한 시작 설정 생성(`--init-config` 및 macOS/Windows 메뉴 항목)
- iPhone/Android 브라우저에서 직접 파일을 가져오는 설치형 PWA companion(TokenJuice Pocket)
- 자격증명·프롬프트·코드 없이 quota 상태만 내보내는 위젯 스냅샷 v1
- passphrase를 저장하지 않는 AES-256-GCM 암호화 기기 간 전달 번들
- 최근 로컬 세션의 프로젝트별 컨텍스트 상태를 내보내는 `--project-report`
- 사용자가 입력한 가격표와 완전한 Claude token split이 있을 때만 계산하는 프로젝트별 비용
- GitHub Copilot Premium-request 월별 비용을 읽는 명시적 선택 adapter(공식 GitHub API,
  지정 환경변수 토큰, 15분 캐시)
- Cursor·Antigravity 등 안전한 exporter를 연결할 수 있는 명시적 local quota-file adapter
- 엔진 fixture 회귀 테스트, 데이터 계약, 릴리스 검증 스크립트
- opt-in 로컬 `--statusline` 출력과 prompt-free fixture 테스트
- quota-window별 알림 on/off·threshold·reset·다음 reset 시각 표시
- 계정별 opt-in `reconnect` 알림: auth_expired transition 단일 발화와 이유·다음 행동·last success·retry 시각 표시

### 변경

- 계정 한도와 세션 컨텍스트 추정치를 서로 다른 의미로 라벨링
- 오래됨·인증 만료·요청 제한 상태에서 메뉴바/CLI가 이전 숫자를 최신 값처럼 표시하지 않음
- 여러 `CLAUDE_CONFIG_DIR` 계정의 로컬 사용량 캐시를 각 계정별로 읽음
- Windows CI가 엔진 회귀 테스트를 포함하고, macOS/Linux 엔진 검증 CI를 추가
- Copilot 비용은 quota와 분리해 표시하고, 사용자 설정 예산도 제공자 한도로 표현하지 않음
- 프로젝트 비용은 Codex·미분해·미가격 세션을 포함하면 `partial`/`unavailable`로 표시

### 보안·개인정보

- 기본 설정에서 API 모드, 프롬프트 주제 표시, 자동 로그인 갱신, 알림이 모두 꺼짐
- `--json`, `--text`, `--diagnostics` 회귀 테스트로 프롬프트 원문 비노출 확인
- Copilot adapter는 keychain·Git credential helper·기존 `GH_TOKEN`을 탐색하지 않으며,
  사용자가 설정한 환경변수 이름만 읽음
- local quota-file adapter는 network·token·cookie·browser session·명령 실행을 사용하지 않음
- 암호화 전달 번들은 자동 업로드·CloudKit·계정 동기화를 수행하지 않음

### 알려진 제한

- Anthropic usage endpoint 및 Claude/Codex 로컬 로그 형식은 공개 안정 계약이 아니므로
  공급자 업데이트로 바뀔 수 있다.
- Windows 실제 트레이 렌더링은 Windows GitHub Actions 및 실제 Windows 설치 환경에서
  최종 확인해야 한다.
- CloudKit/원격 동기화와 Cursor·Antigravity 연동은 공식 안전 경로·삭제 정책을 검증하기 전까지
  의도적으로 제공하지 않는다.
