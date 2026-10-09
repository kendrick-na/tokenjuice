# TokenJuice 출시 체크리스트

확인일: 2026-10-08

이 문서는 실제 GitHub 공개 릴리스를 만들기 전에 담당자가 확인하는 목록이다. 아직
커밋·태그·push·GitHub Release 생성 권한을 대신 부여하지 않는다.
현재 자동 검증과 미확인 외부 게이트의 대응은 [릴리스 증거 매트릭스](RELEASE_EVIDENCE.md)를
참고한다.

> 현재 `v1.2.2`는 이미 공개된 릴리스다. 이 파일의 체크박스는 다음 릴리스에도 재사용하는
> 사전 템플릿이며, 이번 릴리스의 실제 결과는 `docs/REQUIREMENTS_AUDIT.md`,
> `docs/VALIDATION_KIT.md`, 공개 release/CI 근거로 판정한다.

## 원격 사전조건 (2026-10-08 확인)

- [ ] 원격 `main`에 이번 변경을 검토·병합한 뒤 `Engine verification`과
  `Publish TokenJuice Pocket` 워크플로가 Actions 목록에 등록됐는지 확인한다.
  이 두 워크플로는 현재 릴리스 후보 작업트리에만 있으므로 push 전에는 원격에서 보이지 않는다.
- [ ] GitHub Pages를 GitHub Actions 원본으로 활성화한다. 확인 시점에
  `GET /repos/kendrick-na/tokenjuice/pages`는 404였으므로, 이 설정 없이는
  Pocket 배포 workflow가 공개 URL을 만들 수 없다.
- [ ] 원격 `main`의 Windows build 성공 이력은 있으나, 이번 변경 SHA의 Windows
  runner 결과로 대체 확인한다. 이전 성공 결과를 이번 릴리스의 증거로 사용하지 않는다.

## 출시 기준

- [ ] `bun test tests/engine.test.js` 통과
- [ ] `bun build claude-codex-battery.5s.js --target bun --outfile /tmp/tokenjuice-engine-check.js` 통과
- [ ] `python3 -m py_compile windows/tokenjuice_tray.py windows/selftest.py` 통과
- [ ] Windows에서 `python windows/selftest.py` 통과
- [ ] `companion/` PWA에서 스냅샷 가져오기·새로고침 후 기기 내 보관을 실제 브라우저로 확인
- [ ] Pocket을 한 번 연 뒤 네트워크를 끈 상태에서도 홈 화면/PWA 재실행과 기존 스냅샷 표시를 확인
- [ ] 암호화 `widget-sync.tokenjuice`를 올바른 암호로만 Pocket에 가져올 수 있고, 잘못된 암호가 snapshot을 덮어쓰지 않는지 확인
- [ ] GitHub Pages를 사용할 경우 Pages Source를 GitHub Actions로 설정하고, 배포 주소에서 PWA 설치·오프라인 재실행을 확인
- [ ] macOS에서 설치본과 소스의 첫 줄 이후 내용이 동일함을 확인
- [ ] API 모드 미사용·429·401·오래된 캐시·프롬프트 숨김 시나리오를 수동 확인
- [ ] Copilot 선택 기능이 꺼진 상태에서는 GitHub 요청이 0건인지, 켠 상태에서는 비용을 quota가 아닌 비용으로 표시하는지 확인
- [ ] 새 설치 macOS/Windows에서 설치·제거·재시작 경로 확인
- [ ] `README.md`, `docs/DATA_CONTRACT.md`, 릴리스 노트가 실제 동작과 일치
- [ ] `CHANGELOG.md`에 이번 태그의 PWA/스냅샷 동작과 알려진 제한을 기록

## 보안·개인정보 게이트

- [ ] 기본값에서 키체인, 네트워크, 알림, 프롬프트 주제 노출이 발생하지 않음
- [ ] `--json`, `--text`, `--diagnostics` 출력에 OAuth 토큰·프롬프트 원문·이메일이 없음
- [ ] 암호화 번들에 passphrase·OAuth 토큰·평문 quota JSON이 없는지 확인
- [ ] `autoRenew`는 기본 `false`, 알림은 기본 꺼짐
- [ ] Copilot adapter가 keychain·Git credential helper·기존 `GH_TOKEN`을 탐색하지 않고 설정된 `tokenEnv`만 읽는지 확인
- [ ] 비공식 Anthropic endpoint와 로컬 로그 형식의 변경 위험을 릴리스 노트에 고지

## 배포 순서

1. 깨끗한 작업트리에서 위 검증을 재실행한다.
2. 변경을 검토·커밋하고, 보호된 `main`에 병합한다.
3. GitHub Actions의 Windows 빌드와 회귀 테스트가 통과한 것을 확인한다.
4. 버전 태그 `vX.Y.Z`를 만들면 Windows exe와 엔진이 GitHub Release 자산으로 생성된다.
5. GitHub Pages Source가 GitHub Actions라면 `companion/` 정적 PWA 배포 workflow의 verify/deploy를 확인한다.
6. macOS 설치 명령과 Windows exe 설치 경로를 실제 새 사용자 환경에서 재검증한다.
7. 문제가 발견되면 태그를 덮어쓰지 말고 수정 릴리스를 낸다.

## 출시 뒤 지표

- 설치 성공/실패 사유(사용자 동의가 있는 오류 보고만)
- 첫 7일 활성 설치 수와 재실행 성공률
- `stale`, `auth_expired`, `rate_limited` 상태 비율
- 지원 요청에서의 데이터 불일치·개인정보 노출 보고 건수

제품은 기본적으로 원격 분석을 보내지 않는다. 위 지표를 수집하려면 별도의 사용자 동의,
개인정보 고지, 저장소 설계가 먼저 필요하다.
