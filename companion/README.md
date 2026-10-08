# TokenJuice Pocket

TokenJuice Pocket은 iPhone·Android 브라우저에서 홈 화면에 추가해 쓰는 정적 PWA companion이다.
계정 로그인, 토큰, 클라우드 동기화, 원격 분석이 없다.

## 사용 방법

1. Mac에서 `bun claude-codex-battery.5s.js --export-widget-snapshot`을 실행한다.
2. `~/.cache/claude-codex-battery/widget-snapshot.json` 파일을 휴대폰으로 직접 전달한다.
3. PWA에서 **내 스냅샷 가져오기**를 눌러 파일을 선택한다. 첫 화면의 **예시 화면 보기**는
   실제 계정·파일 없이 상태와 복구 안내를 미리 보여 주며, 브라우저에 저장하지 않는다.
4. Safari/Chrome의 “홈 화면에 추가”를 사용한다.

가져온 스냅샷은 해당 브라우저의 Local Storage에만 저장된다. 새 데이터를 보려면 사용자가
새 파일을 직접 가져와야 한다. 이 제한은 휴대폰에 자격증명을 보관하거나 자동 동기화하는
것을 피하기 위한 의도된 개인정보 보호 정책이다.

Pocket은 숫자만 보여 주지 않는다. 가장 먼저 확인할 한도와 다음 행동을 맨 위에 두고,
각 provider에 `방금 확인됨`, `업데이트 필요`, `다시 연결 필요`, `제공자 제한 중` 같은
사용자용 상태 문구와 마지막 성공 시각을 표시한다. quota, 로컬 컨텍스트, 비용은 같은
의미의 숫자가 아니므로 스냅샷의 quota 이외 데이터를 임의로 합산하지 않는다.

### 암호화 전달(선택)

파일을 메신저·클라우드 드라이브 등으로 옮겨야 한다면, 평문 스냅샷 대신 암호화 번들을
만들 수 있다. 실행 직전의 터미널 환경에만 충분히 긴 암호를 제공한다. 암호를 설정 파일에
적거나 공유 파일과 함께 보내지 않는다.

```bash
TOKENJUICE_SYNC_PASSPHRASE='직접 정한 긴 암호' \
  bun claude-codex-battery.5s.js --export-sync-bundle
```

`~/.cache/claude-codex-battery/widget-sync.tokenjuice`를 다른 기기로 옮겨 Pocket에서
가져온 뒤 암호를 입력한다. 이 번들은 AES-256-GCM으로 암호화되며, 자동 업로드·CloudKit·계정
동기화가 아니다. 암호를 잃으면 복구할 수 없다.

## 배포

`companion/`은 빌드 단계가 없는 정적 파일이다. GitHub Pages, Cloudflare Pages, Netlify 등
HTTPS 정적 호스팅에 이 폴더 내용만 게시할 수 있다. 서비스 워커 때문에 `file://`가 아닌
HTTPS 또는 localhost에서 열어야 오프라인 설치가 동작한다.

저장소에는 `companion-pages.yml` 워크플로가 포함되어 있다. 기본 브랜치가 `main`인 공개
저장소에서 GitHub Pages의 **Source를 GitHub Actions**로 한 번 선택하면, 이후 `companion/`
변경의 `main` 병합마다 브라우저 가져오기·로컬 보관 테스트를 통과한 정적 파일만 게시한다.
이 워크플로가 업로드하는 것은 `companion/` 디렉터리뿐이다. 사용자가 가져온 스냅샷, 엔진 설정,
키체인·환경변수 자격증명은 GitHub Pages에 포함되지 않는다.
