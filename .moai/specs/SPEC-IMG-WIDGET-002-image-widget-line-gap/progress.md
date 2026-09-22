# SPEC-IMG-WIDGET-002 진행 기록

SPEC: `SPEC-IMG-WIDGET-002` — 인라인 이미지 위젯 line-gap 회귀 복구
Tier: M · 워크트리: `WT-image-widget-gap`

---

## §E.1 Plan-phase Audit-Ready Signal

- 산출물: `spec.md`, `plan.md`, `acceptance.md`, `progress.md` (Tier M 세트)
- 요구사항: REQ-A-001..006 / REQ-B-001..004 / REQ-C-001..005 (총 15건)
- 인수 기준: AC-A-001..006 / AC-B-001..004 / AC-C-001..005 (총 15건, REQ 와 1:1)
- 근본 원인: `spec.md` Root Cause 에 2계층으로 `file:line` 증거와 함께 기록. `src/` 측 행 번호는 본 워크트리에서 직접 확인, `node_modules/@codemirror/view` 측 행 번호는 오케스트레이터가 주 체크아웃에서 확인한 값을 인용(본 워크트리에는 `node_modules` 미설치).
- 미해결: 없음. v1.0.0 의 `[NEEDS CLARIFICATION: LINE_FOLD_THRESHOLD 와 base64 팽창의 단위 불일치]` 는 사용자 결정으로 해소 — `LINE_FOLD_THRESHOLD = 3 * 1024 * 1024`(3,145,728자), 잔여 대역 0. `plan.md` B-1 참조.
- plan-audit: v1.1.0 FAIL(0.67) → v1.2.0 PASS-WITH-DEBT(0.86) → v1.3.0 에서 잔여 7건(N1~N7) 해소. v1.2.0 이 D1~D6 6건을 반영했고, v1.3.0 은 검증 수단의 거짓 통과 경로(AC-B-001 삭제로 통과, grep 방언 의존 2건)와 정지 규칙의 잘못된 참조·단일 표본 분기를 닫았다. REQ 본문은 v1.1.0 이후 변경 없음. 핵심 변화는 3MB 상향의 비용을 **주장에서 측정으로** 전환한 것 — `PT-A1-006b` 의 대상 라인(2,097,183자)이 폴드→비폴드로 전환되므로 M4 측정은 회귀 확인이 아니라 새 시나리오의 최초 측정이며, 기존 941ms 는 통과 근거가 아니다.
- run-phase 진입 시 필독: AC-C-002 의 2방향 판별 + 정지 규칙(예산 초과 시 자력 임계값 조정 금지, SPEC-IMG-LOAD-002 Re-planning Gate 로 에스컬레이션).
- 상태: `draft`. run-phase 미개시.

## §E.2 Run-phase Evidence

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
