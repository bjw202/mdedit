# SPEC-PREVIEW-022 — Progress

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-09
- plan 산출물: spec.md, plan.md, acceptance.md (Tier M의 계획 산출물 3개) + research.md(조사 근거). status: draft. progress.md는 생애주기 기록이며 계획 산출물 수에 넣지 않는다.
- SPEC ID 정규식 검사: `SPEC-PREVIEW-022` PASS (Bash 실행 결과 `PASS`)
- 기준: `main` `cdaadcf`, 브랜치 `WT-html-charset`
- 설계: 브리프 권장안 A가 SPEC-SEC-001 거부 판정을 무너뜨린다는 소스 근거(research.md §3) 때문에 권장안을 X로 바꿨고, 안 A 기각은 확정했다. 남은 결정은 X와 X2 중 패치 전달 방식(plan.md §D-1)이며 run 시작 전 구현 승인 때 정한다. 계획은 X다. X2를 고르면 AC-001~004를 다시 계획하고 재감사를 받는다.
- plan-audit 1차: PASS-WITH-DEBT 0.85(Tier M 기준 0.80), 보고서 `.moai/reports/plan-audit/SPEC-PREVIEW-022-review-1.md`. 결함 D1~D10·D12를 spec.md 0.1.1과 plan.md·acceptance.md·research.md에 반영했다(D11은 변경 없음). REQ·AC 번호와 개수(12/11)는 그대로다. 감사가 권한 다음 확인 범위는 D1~D3이다.
- 검증 경로: 병합 전 macOS 실기기 + 자동 AC, 병합 뒤 다음 릴리스 빌드에서 Windows 확인. Windows 확인 전까지 SPEC은 `implemented`(acceptance.md § 검증 경로).

## §E.2 Run-phase Evidence

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
