# 모바일 사용량 연결 출시 조건

2026년 10월 11일 기준, TokenJuice의 Android 연결은 구현 전이다. 모바일 자동 갱신·위젯·reset 알림 목표는 유지한다. 현재 Pocket의 수동 암호화 파일 전달은 자동 동기화가 아니며 Android 앱·스토어 패키지도 없다.

## Claude 인증 방식

[Anthropic 인증 정책](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use)은 타사 앱의 Claude.ai 로그인 제공과 구독 자격증명 중개를 제한한다. [개발자 로그인 안내](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account#developers)는 제품 개발자에게 Console API key 또는 지원 클라우드 인증을 안내한다. 이 안내만으로 읽기 전용 quota endpoint의 허용 여부를 확정할 수 없다. 기존 OAuth usage 수집이 기술적으로 동작한 것과 출시용 지원·허용이 확인된 것은 다르다.

모바일에 Claude OAuth 로그인·웹 쿠키 추출·구독 토큰 업로드를 추가하지 않는다. 기존 Mac 설정이나 동의 상태도 이 조사로 변경하지 않는다. 비공식 usage endpoint의 출시 적합성은 제공자 확인 전 미통과이며, 경쟁사 스토어 등록을 허용 근거로 삼지 않는다. API key를 등록하면 Pro·Max 구독 잔여량을 얻을 수 있다고 안내하지 않는다.

## 수집 경로별 검증

| 경로 | 현재 근거 | 출시 조건 |
|---|---|---|
| Claude Code statusline | [공식 문서](https://code.claude.com/docs/en/statusline#available-data)의 quota·reset stdin 필드와 로컬 collector 구현 | Pro·Max 실제 callback과 계정 대조. 첫 응답 전·누락·reset 경과를 unavailable 또는 stale로 처리 |
| Team·Enterprise | 같은 statusline 구독 필드 지원이 확인되지 않음 | 실제 조직의 지원 방식·권한·관측을 확인. 다른 플랜 성공을 확대 적용하지 않음 |
| Claude Desktop 기록 | 실제 화면과 저장된 history가 불일치한 이력 | 관측 시각·현재 계정·공식 수치 대조. 화면을 열었다고 갱신됐다고 간주하지 않음 |
| OAuth usage endpoint | 기존 Mac의 성공과 429 이력 | 지원·허용 확인, 만료/제한/장기 수집 검증. 모바일 기본 인증으로 복제하지 않음 |
| Codex 로컬 수집 | 현재 엔진의 session JSONL 관측 | 현재 계정·수치·reset 대조와 PC 꺼짐/로그인 만료 처리 |

공식 statusline의 구독 quota는 Pro·Max, 또는 spend limit을 제공하는 Claude apps gateway에서 첫 API 응답 뒤 제공된다. 각 window가 독립적으로 누락될 수 있다. gateway spend와 구독 session/week quota는 다른 값이며 합산하지 않는다.

## 모바일 자동 동기화와 위젯

허용된 PC 수집 결과의 quota·reset·관측 시각·상태만 모바일로 전달하는 경로를 우선 검증한다. 이것은 권장 설계이며 아직 구현되거나 서비스가 선택된 것은 아니다. 수동 파일 전달을 자동 동기화의 완료 근거로 사용하지 않는다.

- provider 토큰·쿠키·대화·코드·절대 경로는 동기화 payload에서 제외한다. 다계정은 별칭과 기기별 불투명 식별자를 사용하고 동의 없이 이메일을 보내지 않는다.
- 기기 페어링·종단간 암호화·폐기·순서/재전송 검증·만료 처리를 구현한다. 전달 서버는 암호문만 보관하며 서버 선정·보관 기간·비용·사용자 동의는 배포 전에 확정한다.
- Android는 승인된 전달 키만 Keystore로 보호한다. 앱과 위젯은 같은 관측 시각·fresh/stale 판정을 사용하며 휴대폰 수신 시각으로 오래된 PC 관측을 새 값으로 바꾸지 않는다.
- PC가 꺼지거나 수집이 막히면 위젯에 마지막 성공·연결 상태를 표시한다. stale 관측으로 소진/reset 완료 알림을 보내지 않는다.
- 실제 Android에서 페어링·수신·위젯·백그라운드·절전·오프라인·키 폐기와 잘못된 패킷을 검증한다. 그 뒤 서명 AAB와 Play 내부 테스트를 진행한다.

## 출시 판정

각 지원 계정에서 허용된 수집 경로와 실제 관측이 먼저 통과해야 한다. 특정 플랜을 지원하지 못하면 제품 화면과 스토어에 그 한계를 명시하되, 사용자 승인 없이 원래의 지원 목표를 축소하지 않는다. 제공자 확인이나 유료 계정·전송 서비스가 필요한 단계는 별도 승인을 받는다. 신규 Android 로그인·암호 키·클라우드·스토어 제출은 이번 점검으로 실행하지 않았다.
