---
name: skeptical-eval-request-style
description: 사용자가 SPEC 구현물의 "회의적 품질 평가"를 요청할 때 일관되게 요구하는 형식과 자세
metadata:
  type: feedback
---

SPEC 구현물 평가 요청 시 사용자가 반복적으로 요구하는 패턴:
- 코드 수정 금지 (읽기 전용 평가)
- 회의적(skeptical) 관점 필수 — "acceptance를 rationalize하지 말 것", "결함을 찾아내는 방향"
- 테스트 통과/AC 검증이 이미 끝났더라도 보안·동시성·무변경 가드의 "실효성"을 의심 관점에서 검증
- 산출은 한국어, 4차원 점수(Functionality/Security/Craft/Consistency) + 결함 목록(critical/major/minor, file:line) + 무변경 가드 검증 결과 + 종합 판정(PASS/CONDITIONAL_PASS/FAIL)
- "테스트가 통과했음에도 숨어있을 수 있는 결함"에 집중

**Why:** MoAI orchestrator가 SPEC run phase 종료 후 final-pass 또는 per-sprint 개입으로 evaluator-active를 호출하는 표준 패턴. 사용자는 도구가 아닌 회의적 시각을 원한다.
**How to apply:** SPEC 평가 요청이 오면 (1) git diff로 무변경 가드 먼저 확인, (2) CODEX_HOME 등 보안 키워드 grep, (3) claim_terminal 같은 동시성 불변식을 코드 수준에서 추적, (4) "이미 통과한 테스트"를 전제로 삼지 말고 테스트가 놓친 경로를 찾기. [[project-spec-ai-009-state]]
