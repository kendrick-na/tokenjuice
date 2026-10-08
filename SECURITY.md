# TokenJuice 보안 정책

확인일: 2026-10-08

## 지원 범위

`main`의 최신 설치본과 최신 GitHub Release만 보안 수정 대상이다. 오래된 커밋, 포크에서
수정한 코드, 사용자가 만든 local quota-file exporter는 재현 가능한 문제가 있을 때만
참고 대상으로 본다.

## 신고 방법

공개 Issue에 OAuth 토큰, API 키, Keychain 출력, browser cookie, 프롬프트·코드 원문,
암호화 번들 passphrase를 올리지 않는다. 저장소 관리자가 지정한 비공개 연락 수단이 아직
없으면 Issue에는 다음 정도의 비밀값 없는 정보만 남긴다.

- TokenJuice 버전/커밋, OS, Bun·Python 버전
- `--diagnostics` 출력(내용을 다시 확인한 뒤)
- 재현 단계와 예상/실제 동작
- 민감한 값은 `REDACTED`로 대체한 최소 로그

관리자가 비공개 연락처를 공개하면 그 경로를 우선 사용한다. 유출 가능성이 있는 토큰은
신고 전에 해당 제공자에서 먼저 폐기·갱신한다.

## 보안 경계

- 기본 상태에서 TokenJuice는 Claude 키체인, 네트워크, 알림, 프롬프트 주제를 사용하지 않는다.
- 사용자가 API mode나 Copilot 비용 adapter를 켠 경우에만 각 제공자의 endpoint에 직접
  읽기 요청한다. TokenJuice 자체 서버로 usage·token·prompt를 전송하지 않는다.
- local quota-file adapter는 사용자가 직접 지정한 파일만 읽는다. shell command, Git
  credential helper, 기존 환경변수 토큰, browser cookie/localStorage를 탐색하지 않는다.
- Pocket PWA는 static asset 외의 서버 API를 사용하지 않는다. snapshot은 브라우저 Local
  Storage에만 저장되며 “이 기기에서 삭제”로 제거할 수 있다.
- 암호화 전달 번들은 passphrase를 저장하지 않으며, PBKDF2-SHA-256과 AES-256-GCM을 사용한다.
  암호를 잃으면 복구할 수 없다.

## 수정 원칙

보안 문제가 확인되면 영향 범위, 완화책, 수정 릴리스 버전을 공개 가능한 범위에서
`CHANGELOG.md`에 기록한다. 키·cookie·프롬프트·사용자 파일을 재현 목적으로 요구하거나
저장하지 않는다.

## 의존성 유지보수

`.github/dependabot.yml`은 GitHub Actions와 Windows의 `pip` 의존성을 매주 점검한다.
자동으로 병합하지 않으며, 각 업데이트는 엔진·Windows·Pocket 검증을 통과한 뒤에만
릴리스 후보에 포함한다.
