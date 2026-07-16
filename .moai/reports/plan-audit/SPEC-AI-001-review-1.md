# SPEC Review Report: SPEC-AI-001
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.72

Reasoning context ignored per M1 Context Isolation. This audit is based solely on
`spec.md`, with `acceptance.md` and sibling SPEC frontmatter used only for
cross-reference of traceability and schema convention.

## Must-Pass Results

- [PASS] **MP-1 REQ number consistency**: REQ-AI-001 through REQ-AI-040 are strictly
  sequential with no gaps and no duplicates, all 3-digit zero-padded. Verified end-to-end:
  spec.md:L73 (REQ-AI-001) … spec.md:L171 (REQ-AI-040). 40 unique REQs, one per number.

- [PASS] **MP-2 EARS format compliance**: All 40 requirements use formal modal EARS
  constructions under correct pattern headers. Ubiquitous ("The system shall …",
  e.g. L73, L74, L96, L155), Event-Driven ("WHEN …, the system shall …", e.g. L79, L100,
  L119, L160), State-Driven ("WHILE …, the system shall …", e.g. L85, L107, L129, L167).
  No informal language, no Given/When/Then scenarios mislabeled as EARS, no informal/formal
  mixing within a single requirement. NOTE (deduction, not FAIL): the seven "Unwanted
  Behaviour" requirements (L89 REQ-008, L90 REQ-009, L113 REQ-018, L133 REQ-027, L148
  REQ-031, L149 REQ-032, L171 REQ-040) use the negative "The system shall not …" form
  rather than the canonical unwanted EARS template "If [undesired condition], then the
  system shall [response]". This is a recognized formal variant, not informal language, so
  it does not trip the MP-2 firewall, but it is a Clarity deduction (see below).

- [PASS] **MP-3 YAML frontmatter validity**: id (L2, string), version (L3, string),
  status (L5, string), priority (L8, string) all present with correct types. The creation
  date is present as `created: "2026-07-16"` (L5, ISO date) and categorization labels are
  present as `tags: [ai, editor, tauri, codemirror]` (L11–15, array). The rubric names
  these fields `created_at` and `labels`; this SPEC uses `created` and `tags`, which is the
  uniform, established schema across every SPEC in this repository (verified: SPEC-EDITOR-001,
  SPEC-FS-001, SPEC-PREVIEW-002, and 15+ others all use `created`/`tags`, none use
  `created_at`/`labels`). The required semantic fields — creation date and labels — are
  present and correctly typed, so this is PASS, not a field-omission FAIL.

- [N/A] **MP-4 Section 22 language neutrality**: N/A — single-project SPEC scoped to one
  application (mdedit / Tauri) and one AI CLI tool (`claude`, with `codex` deferred to M4).
  It does not cover multi-language programming-language tooling, so the 16-language
  enumeration requirement does not apply.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.85 | 0.75–1.0 | Requirements are well-structured and mostly unambiguous. Deductions: unwanted reqs use "shall not" instead of "If…then…shall" (L89, L90, L113, L133, L148, L149, L171); implementation details embedded in normative text (see D3); compound requirement in REQ-AI-001 (L73, three sentences). |
| Completeness | 0.92 | 0.75–1.0 | All required sections present: HISTORY (L19), WHY/Background & Rationale (L44), WHAT/Summary+Environment (L25, L58), Requirements (L67), Acceptance Criteria (L213), Exclusions (L255, 11 specific entries). Frontmatter complete under project schema. |
| Testability | 0.80 | 0.75–1.0 | Most ACs are binary-testable and delegate to acceptance.md Given-When-Then. Minor subjectivity: REQ-AI-007 "타이핑되듯" (typing-like) streaming (L85), REQ-AI-029 gray ghost styling. Thresholds are concrete (2,000/4,000자 L129, 3초 L139). |
| Traceability | 0.55 | 0.50–0.75 | **Two REQs are uncovered by any acceptance criterion**: REQ-AI-001 and REQ-AI-016 appear in no row of the AC↔REQ matrix (L217–238). This directly contradicts the SPEC's own stated guarantee of "1:1 매핑" and "AC ↔ REQ 대응" at L215. All ACs reference valid, existing REQs (no orphans). |

## Defects Found

D1. spec.md:L217–238 (AC table) — **REQ-AI-001 has no acceptance criterion.** REQ-AI-001
(L73, the `AiProvider` trait adapter contract + claude-only registration) is referenced by
no AC row. AC-AI-002 (L220) covers only REQ-AI-002 and REQ-AI-003. The trait/adapter
contract is a foundational M0 requirement and must be independently verifiable. — Severity: major

D2. spec.md:L217–238 (AC table) — **REQ-AI-016 has no acceptance criterion.** REQ-AI-016
(L108, "WHILE 고급 모델 사용 설정이 켜져 있으면 sonnet 사용") is referenced by no AC row.
AC-AI-011 (L229) covers REQ-AI-025 (the *3-retry sonnet fallback*), which is a distinct
behavior from the persistent advanced-model settings toggle. Cross-check confirms
acceptance.md also has no dedicated Given-When-Then for REQ-AI-016 (only a blanket
"REQ-AI-001 ~ 040" line at acceptance.md:L210). — Severity: major

D3. spec.md:L74, L109, L123 — **Implementation details embedded in normative requirements.**
REQ-AI-002 (L74) hardcodes CLI flags `--setting-sources ""` and env `MAX_THINKING_TOKENS=0`;
REQ-AI-017 (L109) hardcodes env var name `MDEDIT_AI_DISABLED`; REQ-AI-023 (L123) hardcodes
`securityLevel:'strict'`. These are HOW-level details in WHAT-level requirements (RQ-3/RQ-4).
Mitigating factor: each encodes a privacy/security contract, so they are borderline
acceptable as constraints — but they should ideally move to Design Notes with the requirement
stated as the behavioral guarantee (e.g., "shall block user/project settings from the CLI").
— Severity: minor

D4. spec.md:L73 — **Compound requirement (atomicity).** REQ-AI-001 packs three distinct
obligations into one requirement: (a) route AI requests through the `AiProvider` trait,
(b) register only the claude adapter in MVP, (c) trait exposes id/detect/spawn/capabilities.
This weakens single-requirement testability. Consider splitting. — Severity: minor

D5. spec.md:L89, L90, L113, L133, L148, L149, L171 — **Unwanted-behavior requirements use
"shall not" rather than the canonical EARS unwanted template** "If [undesired condition],
then the system shall [response]". Formally valid negative requirements, but not the
rubric-listed unwanted pattern. Recommend either rephrasing to the If/then form or accepting
as a documented project convention. — Severity: minor

## Chain-of-Verification Pass

Second-look findings, re-reading each REQ and AC end-to-end:

- Re-verified REQ numbering by reading every REQ line individually (L73–L171): 001–040, no
  gap, no dup, consistent padding. MP-1 confirmed.
- Re-verified traceability by enumerating every AC target REQ (L219–238) and subtracting from
  the full REQ set {001..040}. Uncovered set = {001, 016}. This confirms D1 and D2 are not
  skim artifacts — I built the full coverage set rather than spot-checking. No additional
  uncovered REQ found. No orphaned AC found (all referenced REQs exist).
- Re-verified Exclusions (L255–267): 11 specific, non-vague entries (M2, M3, M4 scope, 번역
  프리셋, 프리셋 커스터마이즈, 커서급 자동완성, 대화 기록 저장, 볼트 검색, 프론트매터 자동
  갱신, 감사 로그, 신규 런타임 의존성). Strong. No defect.
- Contradiction scan: found one internal contradiction — L215 asserts "1:1 매핑" and
  "AC ↔ REQ 대응" while L217–238 leaves REQ-AI-001 and REQ-AI-016 unmapped. This elevates
  D1/D2 from a plain coverage gap to a self-contradiction against the document's own stated
  invariant, which is why the verdict is FAIL rather than a marginal pass.
- Frontmatter schema: confirmed against 20+ sibling SPECs that `created`/`tags` is the
  project standard, preventing a false-positive MP-3 FAIL.

## Recommendation

FAIL. All four must-pass criteria pass, but a concrete, verifiable traceability defect
contradicts the SPEC's own stated AC↔REQ mapping guarantee. Fix the following before
re-audit:

1. **Add an AC for REQ-AI-001** (trait/adapter contract). Suggested: an AC verifying that AI
   requests route through the `AiProvider` trait and that exactly one adapter (claude) is
   registered in MVP — likely an extension of AC-AI-002 (L220) or a new AC-AI-021.

2. **Add an AC for REQ-AI-016** (advanced-model settings toggle → sonnet). This is distinct
   from AC-AI-011/REQ-AI-025 (the 3-retry inline fallback). Add a row asserting: WHILE the
   "고급 모델 사용" toggle is ON, requests use sonnet; when OFF, haiku. Mirror it in
   acceptance.md with a dedicated Given-When-Then (currently only the blanket L210 line covers it).

3. **(Recommended, non-blocking)** Move the hardcoded CLI flags / env var names / mermaid
   security level (D3, L74/L109/L123) into Design Notes, restating the requirements as
   behavioral guarantees. Consider splitting REQ-AI-001 (D4) into atomic requirements.

4. **(Optional)** Normalize the seven "shall not" unwanted requirements (D5) to the canonical
   "If … then the system shall …" EARS form, or record "shall not" as an accepted convention
   in the SPEC preamble.

Once REQ-AI-001 and REQ-AI-016 have acceptance criteria (restoring the claimed 1:1 mapping),
Traceability rises to ~0.95 and the SPEC should pass.
