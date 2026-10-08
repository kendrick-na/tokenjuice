[Claude 세션 「TokenJuice SwiftBar 현황 조사」에서 이어받는 작업 — 사용자 지시]

이 세션(TOOLS · TokenJuice 절전 복구)에서 이어서 진행해 주세요. 모든 답변과 문서는 한국어로 씁니다.

## 0. 지금까지의 현황 (Claude 세션 9/25~10/8 작업 결과)
- 설치본: ~/.swiftbar-plugins/tokenjuice-battery.5s.js (5초 주기, bun 실행). 저장소: /Users/easymilli/Downloads/바이브코딩/01_개발_제품/클로드코덱스_배터리 (GitHub 공개 저장소 kendrick-na/tokenjuice). 설치본 = 저장소 HEAD(862d592)와 동일.
- 로컬 커밋 3개 미push: c3b766d, 87a3e0d, 862d592. 이 작업에서는 push·커밋 금지.
- 메뉴바 헤더: 픽셀 배터리 이미지 복원(9/25 이 세션이 넣은 글자 헤더는 되돌림). 절전 대책: ~/Library/Application Support/TokenJuice/ensure-swiftbar-visible.sh + LaunchAgent com.tokenjuice.visibility(15초마다 swiftbar://refreshallplugins).
- Claude 사용량 데이터 경로(우선순위): ① 공식 usage API(api.anthropic.com/api/oauth/usage, 키체인 "Claude Code-credentials" 토큰, 60초 캐시) ② Claude 데스크탑 앱 기록 ~/Library/Application Support/Claude/plan-usage-history.json(30분 이내만 대체값).
- 확인된 근본 문제와 조치:
  1. 키체인 OAuth 토큰은 약 8시간마다 만료되고 Claude CLI만 갱신함. 사용자는 9월부터 데스크탑 앱 Code 탭만 써서(터미널 claude 실행 9월 0회) 토큰이 죽음 → 401. 조치: 401이면 백그라운드로 `claude -p /usage --no-session-persistence` 실행(모델 호출 0회 = 사용량 0, 10분에 1회 제한).
  2. 데스크탑 앱은 "트레이 사용량 화면을 24시간 안에 열었을 때만" 수집(로그: [plan-usage] background poll paused: tray not opened recently).
  3. 실패 후 지난 값을 표시 없이 보여줘서 "실시간 아님" → 이제 stale이면 헤더 `?`.
  4. 429(Retry-After 1시간)는 준수.
  5. 10/5 env -i 로 claude 실행 시 키체인에 acct="unknown" 빈 항목이 생겨 플러그인이 그걸 읽던 문제 → 현재 macOS 사용자 계정으로 읽도록 수정. (빈 항목 삭제는 사용자 승인 대기 — 건드리지 말 것)
- Codex 쪽: ~/.codex/sessions/**/*.jsonl 의 rate_limits(primary/secondary) 와 last_token_usage 로 한도·세션 컨텍스트 표시.
- 계정: Claude Team 요금제(KAIST OverEdge 조직). 윈도우 트레이(pystray) 버전도 있음(windows/).

## 1. 조사 대상 A — 아래 서비스를 샅샅이 조사
- https://ailimits.app/
- https://apps.apple.com/us/app/ai-limits-tracker/id6801493876
- https://play.google.com/store/apps/details?id=com.jocoding.aiLimitsTracker
조사 항목: 운영 주체/개발자, 지원 플랫폼(iOS·Android·macOS·위젯 등), 지원 AI 서비스 목록, 사용량을 어떻게 가져오는지(로그인 방식·쿠키·API·수동입력 등 — 공개된 범위에서), 핵심 기능·화면 구성·알림·위젯, 가격/구독, 개인정보 처리(앱스토어 개인정보 라벨·데이터 안전 섹션), 평점·리뷰 수·대표 불만/칭찬, 업데이트 이력·버전, 다운로드 규모, 차별점.

## 2. 조사 대상 B — 해외(미국·일본 등) 유명 유사 서비스
Claude/Codex/ChatGPT/Cursor 등 AI 코딩·구독 사용량(한도, 토큰, 비용)을 메뉴바·위젯·트레이·CLI로 보여주는 서비스/오픈소스를 폭넓게 찾을 것. 미국·유럽·일본(일본어 검색 포함: 例 「Claude 使用量 メニューバー」「Claude Code 使用量 可視化」) 각각 최소 몇 개씩. 각 서비스마다 같은 조사 항목 + GitHub 스타 수·라이선스·최근 활동(오픈소스인 경우).

## 3. 산출물 — 「TokenJuice 업데이트 개발 기획서」
저장 위치: /Users/easymilli/Downloads/바이브코딩/01_개발_제품/클로드코덱스_배터리/기획/TokenJuice_업데이트_개발기획서_v1.md (폴더 없으면 생성)
권장 구성:
1. 한 줄 결론 + 요약
2. TokenJuice 현황 진단(위 0번 근거, 강점·약점·남은 위험)
3. 경쟁 서비스 상세(A: ailimits / AI Limits Tracker 심층, B: 해외 서비스) — 서비스별 카드 + 비교표(플랫폼·지원 AI·데이터 수집 방식·가격·개인정보·평점)
4. 시사점: 그들이 잘하는 것 / 못하는 것 / TokenJuice만의 자리
5. 업데이트 기능 백로그(RICE 또는 영향·노력 점수) — 데이터 신뢰성, 알림, 위젯/모바일, 지원 서비스 확대, 온보딩, 개인정보
6. 단계별 로드맵(v1.1 / v1.2 / v2.0) + 각 단계 완료 기준
7. 기술 설계 요점(데이터 경로·인증 갱신 안정성·비공식 API 의존 위험·약관 위험)
8. 측정 지표, 리스크, 확인 필요 목록
9. 출처 목록(URL + 확인 날짜)

## 4. 규칙 (반드시)
- 사실은 출처가 있는 것만. 평점·다운로드·가격·인원·날짜 등 확인 못 한 건 「확인 필요」로 비워둘 것. 그럴듯한 추정 금지.
- 코드 수정·커밋·push·배포 금지. 문서 작성만.
- 계정·로그인·키체인·결제·설정 변경 금지. claude CLI 를 env -i 로 실행 금지. API 키·토큰 출력 금지.
- 앱을 설치하거나 회원가입하지 말 것(공개 페이지·리뷰·문서로만 조사).
- 끝나면 문서 경로와 핵심 결론 5줄, 확인 필요 목록을 마지막 메시지로 남길 것.
