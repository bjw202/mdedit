# SPEC Review Report: SPEC-AI-012
Iteration: 2/3
Verdict: PASS
Overall Score: 0.96 (harmonic mean of 4 dimensions; Tier M PASS threshold 0.80; iteration 1 was 0.71, so the score improved and no STOP applies)

Reasoning context ignored per M1 Context Isolation. The coordinator's change summary was not trusted; every fix below was re-read in the current files at HEAD bc805e2 (`git diff --stat 46616b2 HEAD`: only acceptance.md, plan.md and spec.md changed; 51 insertions, 34 deletions). Source files were re-checked where the revision makes new code claims.

Short version: all four blocking defects from iteration 1 are fixed, and the seven optional ones were handled as well. I found no new contradiction. What remains is one optional design gap (instruction text is not part of the tag-collision check) and some stale wording left over from the revision.

## Must-Pass Results
- [PASS] MP-1 REQ number consistency: REQ-AI12-001..013 are sequential with no gaps or duplicates (spec.md:L80-101).
- [PASS] MP-2 EARS format (requirement layer only): Ubiquitous 001-005 (L80-84), Event-driven 006-008 (L88-90), State-driven 009 (L94), Unwanted 010-013 (L98-101). The ACs are Given-When-Then in acceptance.md (verification layer) and were not graded here.
- [PASS] MP-3 YAML frontmatter: unchanged from iteration 1; all 12 canonical fields are valid (spec.md:L2-13), plus `tier: M`.
- [N/A] MP-4 language neutrality: the SPEC covers one project and no multi-language tooling.
- [PASS] MP-5 D7 cross-SPEC: SPEC-AI-001/003/006/008/009/010 exist with status draft or completed. SPEC-AI-013 (L117) is a future SPEC, which is a SHOULD-level note only.
- [PASS] MP-6 D8: `grep -c syscall` returns 0 in all three files.
- [PASS] MP-7 clarification gate: `grep -c 'NEEDS CLARIFICATION'` returns 0 in plan.md and acceptance.md; research.md does not exist (Tier M).

## Category Scores
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.90 | between 0.75 and 1.0 | Fixed phrases are pinned (D5 L62, D10 L67, plan L56-57). A few stale lines remain (N2) that a reasonable engineer would resolve the same way. |
| Completeness | 1.0 | 1.0 | All sections are present. `### Out of Scope — 이번 SPEC 에서 만들지 않는 것` was added (L115). `moai spec lint` no longer reports `MissingExclusions` (0 warnings). |
| Testability | 0.95 | 1.0 | Every AC now checks exact strings: AC-002 L28-29, AC-008 L69-72, AC-009 L78-79, AC-010 L85, AC-012 L98. AC-013 requires literal snapshots (L102). The second clause of AC-013 ("코드 확인", L105) is partly a review step. |
| Traceability | 1.0 | 1.0 | Every REQ maps to at least one AC. REQ-001's empty-selection clause is now in AC-001 (L21). All REQ-008 re-request kinds are in AC-015 cases 1-7 (L118-131). Every AC cites a REQ that exists. |

## Regression Check (iteration 1 defects)
- D1 (the "추가 지시" phrase sits in the language clause, so REQ-010/AC-012 cannot pass) — RESOLVED. The D5 sentence (L62) no longer contains "추가 지시". REQ-010 (L98) and AC-012 (L98) now check only the label `추가 지시(재요청)`. plan.md:L56 states that the scope phrases do not contain that label.
- D2 (the old sentence is a substring of the new one) — RESOLVED. New sentence: "…결과는 입력 텍스트와 같은 언어로 작성하라."; old sentence: "결과는 입력 텍스트의 언어를 그대로 유지하라.". Neither contains the other. AC-009 (L78-79) checks the old sentence is absent and the new one appears exactly once. The existing test `inline_scope_clause_present_for_all_six_inline_features` (prompt.rs:784-791, which checks for "언어", "읽기 전용" and "참고") still holds, because plan L56 keeps "읽기 전용 참고 자료".
- D3 (recovery re-requests would send a misleading instruction) — RESOLVED. New decision D9 (L66) and REQ-008 (L90) say the error, intruded and ⚡ retries send no additional instruction. The plan sends `''` (plan L70) and `instruction.trim() ? instruction : undefined` (plan L69). AC-015 case 7 (L131) checks it. I confirmed that no existing test asserts the instruction text on those three paths: only `model === 'sonnet'` at aiCardRerequestProgress.test.ts:147 and aiCardRetryLimit.test.ts:285, and only that the callback was called at aiSuggestionCard.test.ts:344/370/371.
- D4 (missing Out of Scope H3) — RESOLVED (L115; the lint warning is gone).
- D5 (assumption A1 named only one request-ID source) — RESOLVED (L73). This matches ai-selection-toolbar.ts:275-279 and ai-suggestion-card.ts:1357.
- D6 (the regression baseline could compare a value with itself) — RESOLVED. AC-013 (L102) and M1 (plan L78) require literal string snapshots, including `Shorten.system_prompt()` and `Custom("x").system_prompt()`.
- D7 (the recap's way of naming the tag was unspecified) — RESOLVED. D10 (L67) refers to tags by bare name only. AC-002 (L29) and AC-008 (L69) forbid `<mdedit_` and `</mdedit_` outside the envelope. AC-005 (L49) checks the closing tag appears exactly once in the string codex actually receives (`system + "\n\n" + user`, matching codex_cli.rs:33-35 as cited).
- D8 (the recap's diagram-fragment gate was ambiguous) — RESOLVED (REQ-004 L83, plan L57, AC-008 L72).
- D9 (ACs checked a "meaning" with no pinned keywords) — RESOLVED (pinned strings in AC-002/008/009/010).
- D10 (sub-clause coverage gaps) — RESOLVED (AC-001 L21; AC-015 cases 6 and 7).
- D11 (diagram error text now reaches the system prompt) — RESOLVED as a recorded risk (R6, L133).
- D12 (lint `MissingDependency` for suffixed folders) — accepted as a tool limitation. A re-run still reports 2 errors for SPEC-AI-008 and SPEC-AI-010; both folders exist with slug suffixes.

Stagnation: none. Every iteration-1 defect changed.

## Defects Found (structured defect-list)
N1. Collision-check scope — plan.md:L32 (`texts` = the three envelope texts only), spec.md:L67 (D10 rationale), acceptance.md:L49 (AC-005). D10's stated invariant is that the closing tag appears only once in the string codex receives. The instruction side can still carry a tag string: the Custom instruction, and especially the diagram auto-retry error (`이전 오류: …`). R2 admits the model may echo `</mdedit_target>`, and R6 notes that parser errors can quote model output. When that happens the closing tag appears again in the system prompt and the recap. — Severity: minor — Class: optional — Required fix (optional): add the custom instruction and the trimmed additional instruction to `texts` in `envelope_tags`. That is one extra slice element, needs no new mechanism, and could be covered by an AC-007 case (e).

N2. Stale wording left by the revision — Severity: minor — Class: optional — Required fix (optional), cosmetic:
  - plan.md:L154 still says ai-suggestion-card.ts changes by "재요청 배선 1줄 + 주석", but D9 changes 3 more call sites (plan L70, spec L110).
  - plan.md:L170 refers to "R1~R5", but spec now has R6 (spec L133, listed between R4 and R5).
  - spec.md:L59 (D2 rationale) still gives the request ID as `ai-<시각>-<난수>` only. A1 (L73) was corrected to include the UUID form.
  - spec.md:L61 (D4) and L130 (R2) say "태그 없이 출력하라" and "태그를 출력하지 말라", while the pinned phrase is "태그는 출력하지 말라" (D10 L67, REQ-004 L83). The pinned REQ/AC text governs, so this is not a contradiction.
  - plan.md:L83 says "INLINE_SCOPE 관련 NOTE 3건", but only 2 `@MX:NOTE` tags mention INLINE_SCOPE (prompt.rs:20, 24). The third mention is a plain comment (:92).

No blocking defects.

## Recommendation
PASS. All seven must-pass criteria pass or do not apply, as shown above. The score is 0.96 against the 0.80 Tier M threshold. All four blocking defects from iteration 1 (D1, D2, D3, D6) were verified as fixed in the current files, and the revision introduced no new contradiction. Code claims were re-checked: the onReRequest single wiring point (ai-suggestion-card.ts:1425/1438), the three recovery call sites (:406, :426, :512), the toolbar adding `customInstruction` only for the custom preset (ai-selection-toolbar.ts:204-206), and the DIAGRAM snapshot `starts_with` ordering. N1 and N2 are optional and can be folded into the run phase or ignored.
