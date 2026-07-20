# SPEC Review Report: SPEC-AI-003
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.78

Reasoning context ignored per M1 Context Isolation. Audit performed against spec.md only, with acceptance.md and plan.md read for cross-reference. Project frontmatter schema calibrated against SPEC-AI-001, SPEC-AI-002, and the SPEC-UI-007 iteration-2 audit precedent (`created`/`tags` are the project-canonical field names for `created_at`/`labels`).

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: REQ-AI3-001 (spec.md:L53) through REQ-AI3-015 (spec.md:L108) verified end-to-end, one by one: 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015. No gaps, no duplicates, consistent three-digit zero-padding throughout.
- [PASS] MP-2 EARS format compliance: All 15 requirements match one of the five EARS patterns. Ubiquitous: REQ-AI3-001/002/012/015 ("The system **shall**", L53, L54, L94, L108). Unwanted: REQ-AI3-003/006/007/010 ("**IF** … **then the system shall**", L58, L72, L73, L84). State-driven: REQ-AI3-004/005/014 ("**WHILE** … **the system shall**", L62, L68, L102). Event-driven: REQ-AI3-008/009/013 ("**WHEN** … **the system shall**", L79, L80, L98). Optional: REQ-AI3-011 ("**WHERE** … **the system shall**", L88). REQ-AI3-014 uses a WHILE + condition compound ("WHILE 고스트가 스트리밍 중인 동안 … 문서가 변경되면") — a valid complex EARS combination, noted as D5 (minor), not a pattern violation. Given-When-Then content lives only in acceptance.md where it is correctly labeled as acceptance scenarios, not mislabeled as EARS.
- [FAIL] MP-3 YAML frontmatter validity: id "SPEC-AI-003" (L2), version "0.1.0" string (L3), status "draft" (L4), created "2026-07-17" ISO date (L5), priority "high" (L8) are present and correctly typed. However the labels field (project-canonical name: `tags`, array) is ABSENT from L1–L10. The project template consistently includes it: SPEC-AI-001 (`tags: [ai, editor, tauri, codemirror]`), SPEC-AI-002 (`tags: [ai, editor, codemirror, ux, loading]`), SPEC-UI-007 (tags array of 5, per iteration-2 audit precedent). One missing required field = FAIL per MP-3. Additionally `dependencies` and `lifecycle` (present in both sibling AI SPECs) are missing — notable because this SPEC explicitly depends on SPEC-AI-001/002 being merged (spec.md:L41).
- [N/A] MP-4 Section 22 language neutrality: N/A — single-product SPEC (TypeScript/CodeMirror frontend + Rust/Tauri backend of the mdedit app; spec.md:L20, L27–L29). No multi-language tooling scope.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.85 | 0.75–1.0 | Requirements are single-interpretation with concrete triggers and outcomes (e.g., L58 "false를 반환해 다음 바인딩으로 폴스루", L94 "커서 뒤 문맥은 한 글자도 변경되지 않는다"). Minor: "종결 부호" set is open-ended ("., !, ? 등", acceptance.md:L62) — D4. |
| Completeness | 0.65 | 0.50–0.75 | All sections present: HISTORY (L12), Background & Rationale/WHY (L24), Summary/WHAT (L18), pre-agreed design + Delta table/HOW (L31, L110), Requirements (L47), AC mapping (L123), Exclusions with 9 specific entries (L148–L158). Frontmatter missing 3 project-schema fields (tags, dependencies, lifecycle) — drives MP-3 FAIL and caps this dimension. |
| Testability | 0.95 | 1.0 | ACs are binary-testable with explicit oracles: "mock 호출 카운트 0 단언" (acceptance.md:L40), "바이트 단위로 동일하게 보존" (acceptance.md:L34), "aiCancel 호출 1회 / 미호출" (plan.md:L77), prompt-string containment assertions (acceptance.md:L55). No weasel words in normative text; "매끄럽게 연결" appears only inside quoted prompt-instruction text whose presence is string-testable, with output quality explicitly isolated to manual verification (acceptance.md:L24). |
| Traceability | 1.0 | 1.0 | Mapping table (spec.md:L127–L135) verified REQ-by-REQ: union of AC-AI3-001..007 mappings covers all of REQ-AI3-001..015 with zero uncovered REQs; every AC references only REQ IDs that exist. acceptance.md AC IDs (L28–L78) match the spec.md table one-to-one. |

## Audit Checklist Summary

- FC-1/2/3/4/5 PASS (L2–L8); FC-6 FAIL (no tags/labels field) — see D1.
- SC-1..SC-6 PASS: HISTORY L12, WHY L24, WHAT L18, REQUIREMENTS L47 (15 REQs), AC L123 + acceptance.md, Exclusions L148 (9 concrete entries, each with rationale and research/decision citation).
- RQ-1/RQ-2 PASS (see MP-1). RQ-3/RQ-4 PARTIAL: normative shall-text embeds function names and API calls — `sliceDoc(0, head)` (L53), `syntaxTree(state).resolveInner(pos)` (L58), `truncate_tail_at_paragraph`/`truncate_head_at_paragraph` (L80) — see D3. RQ-5 PASS (no "should"/"may" in normative text; measurable thresholds: "3초 이상" L68, "1회" L94).
- AC-1..AC-5 PASS (see MP-2 and Traceability).
- LN-1..LN-3: N/A (single-product SPEC).
- CN-1 PASS: no contradictions found. The REQ-AI3-013 no-toast rule is explicitly declared an exception to inherited REQ-AI-034 (L98), not a silent conflict. REQ-AI3-003 (full exclusion) vs REQ-AI3-004 (manual-only) partition node types disjointly (FencedCode/Table vs ListItem/Blockquote). CN-2 PASS: Exclusion "절단 고지 고스트 UI" (L150) is consistent with REQ-AI3-011 keeping only the relay (L88, cross-referenced both ways). CN-3 PASS: priority high consistent with kill-criteria rationale (L26).

## Defects Found

D1. spec.md:L1–L10 — YAML frontmatter missing `tags` (labels) field required by MP-3 and by the project SPEC schema (present in SPEC-AI-001, SPEC-AI-002, SPEC-UI-007). Also missing `dependencies` (this SPEC explicitly requires SPEC-AI-001/002 merged, L41) and `lifecycle`. — Severity: critical (must-pass MP-3)
D2. spec.md:L9 — `issue_number: 0` is an ambiguous placeholder; no GitHub issue #0 exists. Sibling SPECs use a real number (SPEC-AI-001: 13) or `null` (SPEC-AI-002). — Severity: minor
D3. spec.md:L53, L58, L80 — Implementation mechanisms (`sliceDoc(0, head)`, `syntaxTree(state).resolveInner(pos)`, `truncate_head_at_paragraph`) appear inside normative requirement text rather than only in the bracketed [MODIFY/NEW] traceability annotations. Mitigated: the "사전 합의 설계 결정 (재검토 금지)" section (L31–L37) legitimately fixes these mechanisms as pre-agreed brownfield constraints, but the WHAT/HOW boundary is blurred. — Severity: minor
D4. spec.md:L68 / acceptance.md:L62 — "종결 부호" (sentence-terminating punctuation) is enumerated open-endedly ("., !, ? 등"). plan.md:L49 points to a code precedent (ai-suggestion-card.ts:435), but the SPEC itself does not close the set; a tester could disagree on e.g. "…" or "。". — Severity: minor
D5. spec.md:L102 — REQ-AI3-014 uses a compound WHILE + conditional-event structure. Valid complex EARS; splitting into a WHEN clause would improve pattern purity. — Severity: minor

## Chain-of-Verification Pass

Second-look findings: none new. Verified by re-reading:
- REQ sequencing re-checked end-to-end (not spot-checked): 001–015 contiguous.
- Traceability re-verified per REQ, not sampled: built the full reverse map from the L127–L135 table; every REQ appears at least once; REQ-AI3-012 and 015 (easy to miss as "reuse-only" requirements) are covered by AC-AI3-001 and AC-AI3-007 respectively.
- Exclusions re-read for specificity: all 9 entries name concrete artifacts (file names, function names, decision IDs) — none vague.
- Cross-requirement contradiction sweep re-run, including REQ-AI3-013 (cancel on typing-dismissal) vs acceptance.md:L48 (no cancel on confirm transaction) — complementary, not contradictory; and REQ-AI3-002 priority order vs acceptance.md:L83 edge case — consistent.
- Frontmatter re-compared field-by-field against SPEC-AI-001/AI-002 — confirmed D1 (tags/dependencies/lifecycle absent) is real, not a template variation.
- spec-compact.md exists in the directory but is a derived artifact, not the audited document (consistent with SPEC-UI-007 iteration-2 precedent).

## Regression Check (Iteration 2+ only)

N/A — iteration 1.

## Recommendation

FAIL is driven solely by MP-3 (D1). The requirements body, acceptance criteria, and traceability are of high quality. Fix instructions for manager-spec:

1. spec.md:L1–L10 — Add the missing frontmatter fields to match the project schema (and mirror in acceptance.md/plan.md frontmatter):
   - `tags:` array (e.g., ai, editor, codemirror, ghost-text, prompt)
   - `dependencies:` list containing SPEC-AI-001 and SPEC-AI-002 (per L41)
   - `lifecycle: spec-anchored` (per SPEC-AI-001/002 convention)
2. spec.md:L9 — Replace `issue_number: 0` with `null` or the real issue number (D2).
3. Optional (minor, non-blocking): close the "종결 부호" character set in REQ-AI3-005 or reference the ai-suggestion-card.ts:435 precedent from spec.md itself (D4); consider splitting REQ-AI3-014 into a WHEN-form requirement (D5). D3 is accepted as-is given the pre-agreed design section.

No content-level rework of Requirements, AC mapping, or Exclusions is required. A frontmatter-only revision should pass iteration 2.

Verdict: FAIL
