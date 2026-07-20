# SPEC Review Report: SPEC-UI-007
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.78

Note: No author reasoning context was passed with this invocation. Had any been passed, it would be ignored per M1 Context Isolation. Audit inputs: spec.md, acceptance.md (cross-reference), frontmatter of SPEC-UI-006 / SPEC-PREVIEW-010 (project schema baseline).

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: REQ-UI-007-001 through REQ-UI-007-015 verified end-to-end (spec.md:L60–L86). Sequential, zero gaps, zero duplicates, consistent zero-padding. AC IDs AC-UI-007-001..010 also sequential (spec.md:L108–L117).
- [PASS] MP-2 EARS format compliance: REQ-001..003 Ubiquitous "The system shall" (L60–L62); REQ-004..008 Event-driven "WHEN ..., the system shall" (L66–L70); REQ-009..010 State-driven "WHILE ..., the system shall" (L74–L75); REQ-014 Unwanted "IF ..., then the system shall" (L82). Acceptance criteria are correctly labeled Given-When-Then scenarios in acceptance.md (not mislabeled as EARS). Caveat: REQ-015 deviates from the EARS Optional pattern — see D2; recorded as a Requirements-quality defect, not an AC-format MP failure.
- [PASS] MP-3 YAML frontmatter validity: id "SPEC-UI-007" string (L2), version "0.0.1" string (L3), status "draft" string (L4), created "2026-07-16" ISO date (L5), priority "medium" string (L8), tags array of 5 strings (L12–L17). Field names `created`/`tags` (vs generic `created_at`/`labels`) match the project-wide SPEC template verified against SPEC-UI-006 and SPEC-PREVIEW-010 frontmatter — canonical schema, not a defect.
- [N/A] MP-4 Section 22 language neutrality: N/A — single-language SPEC (TypeScript/React frontend of mdedit; spec.md:L29, L51). No multi-language tooling in scope.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 (minor ambiguity, consistently resolvable) | Grid semantics (r = total rows incl. header) defined 3x consistently (L29, L35, L68); double negatives in REQ-011..013 (L79–L81) and non-normative REQ-015 (L86) are the only ambiguity sources |
| Completeness | 1.00 | 1.0 (all sections present) | HISTORY L21; WHY = Background & Rationale L39; WHAT = Summary L27; HOW = Delta L88; Requirements L56; Acceptance Criteria L102; Exclusions L119 with 9 specific entries (L121–L129) |
| Testability | 0.75 | 0.75 (one AC/REQ not precisely binary-testable) | REQ-015 "적용할 수 있다 ... 필수 아님" (L86) untestable; "정상적으로 닫는다" REQ-010 (L75) borderline but AC-006 (acceptance.md:L77) makes it binary. All other ACs binary (exact skeleton snapshots acceptance.md:L42–L47, L65–L68; exact counts L28, L34, L91) |
| Traceability | 0.75 | 0.75 (one REQ uncovered + one indirect mapping) | AC table L108–L117 covers REQ-001, 003–014; REQ-002 missing from spec.md table (covered only in acceptance.md AC-010 L99–L103); REQ-015 covered by no AC; spec.md AC-010 traces to "—" (L117) |

## Defects Found

D1. spec.md:L117 vs acceptance.md:L99–L103 — Broken 1:1 mapping claimed at spec.md:L104 ("acceptance.md의 Given-When-Then 시나리오와 1:1 매핑"). spec.md row AC-UI-007-010 = "tsc --noEmit 클린 + 전체 vitest 통과" with Requirement "—", but acceptance.md AC-UI-007-010 = "다크모드 토큰 (REQ-UI-007-002)". Same AC ID, different content. Consequence: REQ-UI-007-002 has no AC in spec.md's table (uncovered REQ), and spec.md carries an orphaned AC tracing to no REQ. — Severity: major

D2. spec.md:L86 — REQ-UI-007-015 does not use the EARS Optional pattern. "WHERE ... 우측 정렬(right-0) 폴백을 적용할 수 있다(Run phase 판단, 필수 아님)" uses "may/can" instead of "the system shall", is not binary-testable, and has no AC coverage. A requirement that is explicitly "필수 아님" is not a requirement. — Severity: major

D3. spec.md:L79–L81 — REQ-011/012/013 combine English "shall not" with Korean negative verb endings ("변경하지 않는다", "추가하지 않는다", "등록하지 않는다"), producing a literal double negative ("shall not [not change]"). Intent is recoverable from the section heading and clarifying sentences, but normative text must not require intent recovery. — Severity: minor

D4. spec.md:L67, L69 — Implementation details inside Requirements: REQ-005 hardcodes CSS token names (`--md-accent-soft`, `--md-accent`, `--md-text-muted`) and REQ-007 hardcodes API identifiers (`EditorSelection.range`, `view.focus()`). These are HOW, not WHAT. Mitigating context: spec.md:L31 marks these as user-approved pinned decisions ("사용자 승인, 재검토 금지"), so this is acceptable-by-convention for this brownfield project, but the API names belong in the Delta/design notes, not in EARS responses. — Severity: minor

D5. spec.md:L75 / acceptance.md:L77 — "정상적으로" ("normally/properly") in REQ-010 and AC-006 is a weasel word. AC-006's Then-clause makes the actual assertion binary (popover closes, no doc change, no exception), so impact is contained. — Severity: minor

## Chain-of-Verification Pass

Second-look findings — re-read performed on: full REQ list L60–L86 (each entry individually, not skimmed), AC table L106–L117 against acceptance.md L24–L103, Exclusions L119–L129, and cross-requirement contradiction scan.

- REQ sequencing re-verified end-to-end: 001–015 all present exactly once.
- Grid semantics cross-checked for contradictions: REQ-005 example "4행 3열 → 4 × 3" (L67), REQ-006 "(r−1) 본문 행" (L68), AC-002 "12개 셀" (L109), AC-003 "(3,4) → 헤더 4열 + 본문 2행" (L110), AC-005 boundaries "(1,1) → 본문 0행; (8,8) → 본문 7행" (L112), REQ-001 aria-label "Insert 3 by 4 table = 3행 × 4열" (L60) — all mutually consistent. No contradiction.
- Exclusions vs requirements: REQ-015 (right-0 fallback) does not conflict with "포털/floating-ui 미도입" (L127); REQ-013 consistent with "키보드 단축키 없음" (L121); Esc-close (REQ-008) is not contradicted by "화살표 키 그리드 탐색 없음" (L122) which explicitly carves out "마우스 + Esc". Clean.
- New defect found on second pass: D1 (the AC-010 mapping break) was confirmed and REQ-002's missing row in spec.md was caught only by verifying every AC-to-REQ pair, not sampling. D5 was also added on second pass.

## Regression Check (Iteration 2+ only)

N/A — iteration 1.

## Recommendation

FAIL — no must-pass failure, but two major defects (D1, D2) must be fixed before approval. Fix instructions for manager-spec:

1. Fix spec.md AC table (L106–L117) to restore the claimed 1:1 mapping with acceptance.md: change row AC-UI-007-010 to `AC-UI-007-010 | REQ-UI-007-002 | 다크모드 토큰 — 신규 CSS가 --md-* 토큰만 사용, raw hex 없음`. Move the tsc/vitest gate content out of the AC table into a separate "Quality Gates" note (it already exists as acceptance.md "Quality Gate Criteria" L105–L114) or give it its own non-AC row label.
2. Fix REQ-UI-007-015 (L86): either (a) rewrite in EARS Optional form with shall — e.g. "WHERE 팝오버가 창 우측 경계를 넘는 경우, the system shall 우측 정렬(right-0) 폴백을 적용한다" — and add a matching AC, or (b) delete it from Requirements and record it as a note under Exclusions/Future considerations. Do not keep a "필수 아님" clause inside the EARS section.
3. Fix double negatives in REQ-011/012/013 (L79–L81): drop the trailing Korean negative so each reads as a single negation, e.g. "The system shall not 기존 FormatAction 유니언 타입, onFormat 콜백 시그니처, handleFormat switch(@MX:ANCHOR)를 변경한다" or restate fully in Korean single-negative form.
4. (Minor, optional) Move `EditorSelection.range` / `view.focus()` from REQ-007 (L69) into the Delta table or a design-notes subsection; keep the REQ response behavioral ("첫 헤더 셀 플레이스홀더 텍스트가 선택되고 에디터가 포커스를 가진다").
5. (Minor, optional) Replace "정상적으로 닫는다" (L75) with "닫는다".

Items 1–3 are required for a PASS at iteration 2. Items 4–5 are recommended but non-blocking.
