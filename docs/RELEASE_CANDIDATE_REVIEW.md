# TokenJuice 후보 검토 패키지와 출시 차단 원장

확인일: 2026-10-10. 로컬 준비 결과이며 tag/release·스토어 제출·사용자 초대를 하지 않았다.

## 1. 고정 후보와 패키지

**후속 개발 후보와 분리:** 최신 4423ab1에는 R5 상태 손상 복구와 설치 helper 독립 비교가
추가됐다. Engine 38052165596·Windows 38052165597 success, 로컬 83 tests/1146 assertions다.
helper 한 파일을 백업·갱신해 plugin/helper 모두 일치하며 전체 release-verify는 exit 0이다.
아래 74157c2 로컬 패키지는 과거 고정 후보이며 새 helper 코드가 포함돼 있지 않다.
설치 증거·남은 실제 UI/절전 관찰은 VALIDATION_KIT 및 audit §9.21 참조.

- 엔진 소스: `74157c242a79cda1b8a0acbe034483d2bc2eb336`
- [Engine CI 37965807140](https://github.com/kendrick-na/tokenjuice/actions/runs/37965807140): success,
  macOS 80 tests/1043 assertions, Linux/bundle/Pocket browser pass.
- [Windows CI 37965807177](https://github.com/kendrick-na/tokenjuice/actions/runs/37965807177): success,
  engine/selftest/exe build/run/artifact pass, release skipped(no tag).
- 로컬 패키지: `scratchpad/release-candidate-74157c2/` (Git ignored, 외부 업로드 없음).
  고정 커밋 source archive·동일 CI의 Windows exe/engine·검증 키트·SHA256SUMS·설명서가 있다.
  자동 설치/실행 스크립트는 추가하지 않았다. Windows exe는 Mac에서 실행하지 않았다.
- CI artifact ID `11633666042`, `tokenjuice-windows`, head SHA를 API로 확인했다.
  API가 신고한 zip digest는 `sha256:500473300831ab0b7c1aa2b3653f930fc72005ed219da0014f3419b8e8b23cad`다.
  로컬은 gh download로 추출한 파일의 아래 해시를 검증했다. zip 자체의 로컬 대조를 했다는
  뜻은 아니다.

| 파일 | 원본 바이트 SHA-256 |
|---|---|
| source tar.gz | `51dfe1d6ad4276938bf4e0b71f25aa4f7b3124c9a029b5ef833efd6649f1ed46` |
| Windows tokenjuice.exe | `6c8cd51913cb18f22169a074f05fe26122b810865c07f3a6295ddd08e7aa97fa` |
| Windows engine JS | `975eba92a42196b4502fe3d37fb182f71d42c78a7fa86175964dff3fb0c146a2` |

처음 strict cmp는 Windows CRLF 때문에 line 1에서 실패했다. 이를 성공으로 숨기지 않고
CRLF→LF만 정규화한 전체 본문의 정확한 소스 일치를 확인했다. 원본 파일을 고치거나
서로 다른 파일의 해시를 같다고 기록하지 않았다. 세 파일의 SHA256SUMS 검사는 모두 OK다.
Windows artifact는 GUI-subsystem x86-64 PE이며 다른 아키텍처용 빌드라고 설명하지 않는다.

## 2. 전체 TODO의 독립 완료 판정

| 영역 | 완료한 로컬 범위 | 출시 차단 조건과 해소 증거 |
|---|---|---|
| 실제 Mac 메뉴바/절전 | 설치 엔진 본문 일치·격리 실행·release-verify exit 0, installed wake helper hash 일치 | CUA read-only inventory에 SwiftBar 없음. 실제 아이콘/패널·quota/trust·notch·sleep/wake 관찰 필요. process/file match는 UI pass가 아님 |
| 전체 작업 재개 | metadata-only checkpoint 생성/재열기·복사/텍스트 저장·삭제·오류 보존 자동 회귀 | 기존 contract가 의도/최근 파일/코드 제외. 수집 원천, 허용 필드/길이/schema, 경로/전송·동의·보존/삭제/Pocket 경계와 실제 재개 효과 필요 |
| 추세 | 별도 opt-in Claude/Codex local history 7일 export·pace forecast | Pocket 시계열 import/계정-reset 연결/검증·보존/삭제 계약과 행동 근거 필요. 최소 출시에는 로컬 export만 지원하며 시각 trend를 완료 처리하지 않음 |
| Coach | 기본 상태/다음 행동과 context checkpoint 규칙 | tool-call/file-read 수집·개인화 insight 미구현. master §16.4/16.6의 10명 interview·14일 diary·행동률/오탐과 동의 입력·설명 가능한 규칙/분모가 선행. 초기 무료 베타에 Coach를 약속하지 않음 |
| 신규 사용자 | synthetic 시나리오·동의/철회 초안·빈 기록표·자동 a11y 검사 | 신규 5명 설치/사용성과 screen reader/실기기 관찰 필요. 참가자를 대신하거나 결과를 합성하지 않음 |
| Windows | CI exe·tray selftest·공통 engine | 실제 tray/icon·tooltip·menu 관찰 필요. toast는 identity/shortcut 또는 WinRT 의존성·event contract 결정 후 구현 |
| 스토어 | 현재 설치/OS/개인정보 제한과 제출 선행 조건 정리 | App Store용 독립 앱/서명, Play용 AAB/identity, 확장 사용 사례·패키지 없음. 플랫폼·개발자 계정·서명/제출 권한·심사/데이터 경계 확정 전 제출 금지 |

전체 목표는 미완료다. 이 패키지는 GitHub 로컬 검토용이지 스토어 제출-ready 산출물이 아니다.
다음 신규 태그는 실제 Mac/Windows acceptance·신규 설치/제거/재시작 결과와 승인 후에만
검토한다. public PWA `4d326d3`/sw v11 및 immutable desktop `v1.2.2`는 그대로다.

## 3. 실행 자료

- [검증 키트](VALIDATION_KIT.md): 참가자·실기기 절차. 현재 기기는 full installer/restart/refresh 없이 관찰.
- [상세 감사 §9.18](REQUIREMENTS_AUDIT.md#918-r2r13-실패한-local-quota-읽기의-성공-시각-분리-2026-10-10): 코드/CI/설치 증거와 정확한 제품 입력.
- [빠른 출시·피드백 계획](LAUNCH_FEEDBACK_PLAN.md): 초기 피드백은 직접 제출, 자동 텔레메트리 없음.
- [UI/UX 게이트](UI_UX_RELEASE_PLAN.md): 자동 가독성 검사와 실제 사용자 기준을 분리.

Mac UI의 현재 blocker를 재시작·강제 절전·권한/LaunchAgent 변경으로 우회하지 않는다.
계약 미정인 작업 내용 수집이나 원격 동기화·결제·스토어 제출로 범위를 임의 확장하지 않는다.
