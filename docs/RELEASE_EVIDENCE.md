# TokenJuice 릴리스 증거 매트릭스

확인일: 2026-10-08
대상: `1.1.0` 출시 후보 작업트리(아직 커밋·push·태그·배포 전)

이 문서는 [출시 체크리스트](RELEASE_CHECKLIST.md)의 각 판단을 어떤 증거가 뒷받침하는지
정리한다. `자동 통과`는 해당 테스트의 범위 안에서만 통과를 뜻하며, 실제 Windows·새 설치
환경·GitHub 공개 배포를 대신하지 않는다.

## 현재 로컬 증거

| 영역 | 명령/증거 | 결과 | 증명 범위 |
| --- | --- | --- | --- |
| 엔진 | `bun test tests/engine.test.js` | 32개 테스트, 149 assertions 통과 | 상태 모델, 401/429, stale, opt-in 갱신·알림, 출력 비밀값, snapshot/bundle, 비용·provider 계약 |
| 번들 | `bun build claude-codex-battery.5s.js --target bun` | 통과 | Bun이 현재 엔진을 번들할 수 있음 |
| macOS 스크립트 | `bash -n install.sh scripts/ensure-swiftbar-visible.sh scripts/release-verify.sh` | 통과 | 셸 문법 |
| Windows 소스 | `python3 -m py_compile windows/tokenjuice_tray.py windows/selftest.py` | 통과 | Python 문법. Windows backend 실행은 아님 |
| Pocket PWA | `tests/companion.test.py` + Playwright | 통과 | JSON/암호화 bundle import, 잘못된 암호의 기존 스냅샷 보존, Local Storage 보관·삭제, offline 재실행, 개인정보 화면·favicon |
| 설치본 일치 | `scripts/release-verify.sh` | 통과 | 현재 Mac의 SwiftBar 설치본 본문과 소스 본문이 일치 |
| 시각 점검 | 로컬 브라우저, 390px viewport | 통과 | Pocket 초기·개인정보·모바일 레이아웃을 수동으로 확인 |
| 공백 검사 | `git diff --check` | 통과 | 수정된 추적 파일의 공백 오류 없음 |

## 출시 기준별 판정

| 체크리스트 항목 | 판정 | 근거 또는 다음 증거 |
| --- | --- | --- |
| 엔진 테스트·Bun 번들 | 로컬 통과 | 위 엔진·번들 증거 |
| Windows `selftest.py` | 미확인 | 실제 Windows Actions runner에서 `pystray` win32 backend와 함께 실행 필요 |
| Pocket import·보관·offline·암호 오류·삭제 | 로컬 통과 | Playwright 회귀 테스트 |
| Pages 주소에서 설치·offline | 미확인 | Pages가 아직 활성화되지 않아 공개 URL 없음 |
| macOS 설치본 일치 | 로컬 통과 | `release-verify.sh` 결과 |
| API 미사용·401·429·stale·프롬프트 숨김 | 자동 통과 | 임시 HOME·fixture 기반 엔진 테스트. 실계정 수동 점검은 별도 |
| Copilot의 비용/비quota 표기 | 자동 통과 | fixture 및 Windows menu self-test 코드. 실제 GitHub 계정 호출은 수행하지 않음 |
| 새 Mac·Windows 설치/제거/재시작 | 미확인 | 격리된 새 사용자 환경에서 실제 설치 필요 |
| 문서·계약·릴리스 노트 일치 | 검토 필요 | 커밋 전 최종 diff 검토와 태그 버전 확정 후 확인 |
| 기본값·비밀값·암호화 bundle 보안 게이트 | 자동 통과 범위 있음 | 엔진/PWA fixture 테스트와 정적 명령 실행 감사. 외부 보안 감사는 별도 |

## 원격 상태와 출시 순서

2026-10-08 읽기 전용 확인 결과:

- 원격 `origin/main`은 `35e4e80`이며 로컬 HEAD보다 3커밋 뒤다.
- 원격에는 이전 `Windows build` workflow만 등록돼 있다. `Engine verification`과
  `Publish TokenJuice Pocket`은 이번 작업트리를 push한 뒤에야 등록된다.
- GitHub Pages API는 404를 반환했다. Pages Source를 GitHub Actions로 활성화해야
  Pocket의 공개 배포가 가능하다.
- 이전 Windows build 성공은 이 후보 SHA의 검증 증거가 아니다.

따라서 공개 출시 전에는 다음 순서를 지킨다.

1. 변경을 검토하고 커밋한다.
2. 원격 `main`에 병합·push한다.
3. Pages를 GitHub Actions 원본으로 활성화한다.
4. 이번 SHA의 Linux/macOS 엔진, Pocket, Windows workflow를 모두 확인한다.
5. 새 설치 macOS/Windows에서 설치·제거·재시작을 확인한다.
6. `v1.1.0` 태그와 GitHub Release를 생성하고 Windows 자산·Pocket URL을 재확인한다.

이 문서는 권한을 부여하지 않으며, 각 외부 단계를 수행한 사람이 체크리스트를 갱신한다.
