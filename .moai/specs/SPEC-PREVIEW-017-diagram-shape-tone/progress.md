# SPEC-PREVIEW-017 progress.md

## Phase Notes (plan)

- 리서치: 외부 근거(WebSearch·WebFetch)는 오케스트레이터가 2026-10-29 수행. 1차/2차 출처 구분과 URL은 `research.md` §2.
- 코드·pele 실측: plan 단계(manager-spec)가 2026-10-29 직접 수행 — 워크트리 HEAD 4bef707 소스 grep, pele 1.10.0 dist 읽기 전용 grep(`.claude/worktrees/release-v0.18.0/node_modules/pele/`, 수정·git 실행 없음), WCAG 대비·HSL 색상 python 계산. 결과는 `research.md` §4·§5.
- 사용자 결정(2026-10-29, AskUserQuestion):
  1. 범위 = 판단(`pele-shape-diam`) + 시작/끝(`pele-shape-stadium`) 노드만. 나머지 모양·클러스터 무변경, 다이어그램당 3색 이하.
  2. 판단 테두리 = 새 진한 꿀색 토큰(후보 `#8A6410`, run에서 확정). `#B78511`·series-8 재사용 기각.
  3. 간선 라벨 이음매 포함 — 측정 우선, 해법은 열어 둠.
  4. 이 워크트리에서 작업, run도 여기서 이어감.
- plan 단계 판단: `circle`은 시작/끝에서 제외(research.md §7.1), 시작/끝 테두리 두께 `1.5px`, 미리보기 기제 = 노드 `g` 사적 변수 재선언(research.md §6).
- Tier M — 산출물: spec.md / plan.md / acceptance.md / research.md / spec-compact.md / progress.md(design.md 없음).

## Environment

- 워크트리: `.claude/worktrees/preview-017-diagram-tone`, 브랜치 `WT-diagram-tone`, 기준 커밋 4bef707(origin/main = v0.18.0 + .gitattributes).
- `node_modules` 미설치 — run 단계는 `npm ci`부터 시작한다.

## Resolved Decisions

- 라벨 이음매 해법 = (a) 확정(사용자, 2026-10-29 AskUserQuestion): 라이트 미리보기 다이어그램 컨테이너 바탕 `var(--pele-bg)`(`#FAF9F6`), 테두리·반경 없음. 016 REQ-PREVIEW016-005 배경 부분 개정(테두리·반경은 다크 전용 유지). 기각 대안은 research.md §8에만 기록. 적용 전 측정 의무는 유지.

## Plan-audit History

- review-1(2026-10-29): FAIL 0.75 — `.moai/reports/plan-audit/SPEC-PREVIEW-017-review-1.md`. D1~D11 반영해 v0.1.1로 개정(D12는 사용자 결정 3을 담은 항목이라 유지).

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-10-29
- plan_status: audit-ready (v0.1.1, plan-audit iteration 2 PASS 0.93 — `.moai/reports/plan-audit/SPEC-PREVIEW-017-review-2.md`; 잔여 MINOR N1~N5는 run 단계에서 흡수)

## §E.2 Run-phase Evidence

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
