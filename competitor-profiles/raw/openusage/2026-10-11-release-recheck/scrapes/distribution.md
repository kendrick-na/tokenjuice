# OpenUsage 공개 출시 근거

확인일 2026-10-11. 공식 사이트/저장소/릴리스 텍스트 대조, 설치 스크립트 실행 없음.

- [홈](https://openusage.sh/): terminal/tmux/statusline·로컬 history, 34 providers.
- [저장소](https://github.com/janekbaraniewski/openusage): MIT; Homebrew `brew install janekbaraniewski/tap/openusage`, quick install script, Go source install. README는 37 providers라 홈페이지와 불일치. 로컬 도구/API key 자동 탐지; provider별 credentials/네트워크 경계 다름. 221 stars 표시.
- [릴리스](https://github.com/janekbaraniewski/openusage/releases): 목록 latest v0.25.0, 2026-08-31. Darwin arm64/amd64, Linux/Windows 배포와 checksums/Sigstore 자료. GitHub Issues/PR·changelog 운영. Homebrew/script와 직접 binary 채널이 존재하며 자동 업데이트 실제 동작은 검증하지 않음.

구독 가격표 없음. 무료 MIT 배포가 유료 provider API 호출 비용까지 없다는 뜻은 아니다. 모바일 스토어/Chrome 확장 출시는 이 자료로 확인되지 않음.
