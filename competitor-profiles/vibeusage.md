# VibeUsage — Quick Profile

확인일: 2026-10-11 · [공식 출처](https://vibeusage.com/)

대상(카피에서 추론): 사용 패턴을 개선하려는 CLI 사용자.

## 확인한 서비스 내용

로컬 사용 패턴·도구별 분석·개선 조언. 본문은 Claude 현재, 다른 도구 coming soon으로 설명하므로 모두 출시됐다고 볼 수 없다.

## UI/UX 관찰

이번 회차는 공식 페이지 텍스트 조사만 실시. 디자인 우열은 판정하지 않는다.

## TokenJuice 개선 시사점

사용량 숫자보다 절감 행동의 근거를 제공하는 방향 참고. 사용 증가를 생산성 증가로 표현하지 않는다.

SEO/트래픽/전환율은 수집하지 않았다. 공개 기능 설명과 실제 동작 검증은 다르다. 계정 연결·결제·설치는 수행하지 않았다.
근거: [원본 수집 노트](raw/vibeusage/2026-10-11/scrapes/home.md).

## 후속 공식 문서 대조

[README](https://github.com/edwluo/vibeusage)는 overview와 limits를 구분하며, limits가 Claude 로그인 자격증명을 사용해 Anthropic API를 호출한다고 설명한다. 로컬 대화 분석을 “모든 기능 무네트워크”로 해석하면 안 된다. Codex는 여전히 예정 표기다. 홈페이지와 README의 CLI 패키지명이 달라 설치 안내를 그대로 복사하지 않는다.

유료 구독 사용자나 실제 절감 효과는 확인되지 않았다. TokenJuice Coach는 도구 호출 비율을 토큰 절감률로 바꾸지 말고, 관측 범위·분모·권장 행동과 한계를 함께 표시해야 한다. 이는 제품 설계 판단이며 경쟁사 사용자 성과가 아니다.

## Raw Data Sources

[후속 수집 노트](raw/vibeusage/2026-10-11/scrapes/recheck-0305.md). Firecrawl/DataForSEO 도구가 없어 공식 웹 텍스트로 대조했으며 SEO 수치는 없다. 시각 검증·앱 실행은 이번 조사에 포함하지 않았다.

## Change Log

2026-10-11 후속: 로컬 분석과 quota 네트워크 호출 경계를 분리하고 CLI 명칭 불일치를 기록했다. 이전 수집 노트는 보존한다.
