# SPEC Review Report: SPEC-PREVIEW-021
Iteration: 3/3 (final)
Verdict: PASS
Overall Score: 0.92 (iteration 1: 0.84 → iteration 2: 0.88 → iteration 3: 0.92; Tier M threshold 0.80)

Reasoning context ignored per M1 Context Isolation. The coordinator's note that `node -p` printed `1` is treated as the author's claim, not as an observation by this audit. Audit input: v0.1.2 at commit b417ac7, diffed against f334037 (`git diff f334037 b417ac7` over the SPEC directory, read in full). Scope: the delta for iteration-2 defects N1-N6, plus a scan for anything the revision introduced.

## Must-Pass Results

- [PASS] MP-1: REQ count and numbering unchanged (001-010). The revision touched only REQ-004 (b) wording (spec.md, REQ-004 second bullet).
- [PASS] MP-2 (requirement layer): the edited REQ-004 bullet keeps the `When 렌더가 성공하면, the 변환 shall …` form.
- [PASS] MP-3: `version: "0.1.2"`; HISTORY row 0.1.2 present; all other fields unchanged.
- [N/A] MP-4: single-application SPEC.
- [PASS] MP-5: no new SPEC references; prior statuses unchanged (D13/N6 SHOULD carried, no action needed).
- [PASS] MP-6: the diff adds no `syscall` text.
- [PASS] MP-7: the diff adds no `[NEEDS CLARIFICATION` markers.

## Regression Check (iteration-2 defects)

| ID | Prior severity | Status | Evidence |
|----|----------------|--------|----------|
| N1 | BLOCKING | **RESOLVED** | acceptance.md:L22 adds a rule: unit AC-001~009·011 are judged with fonts off (`prerenderMermaidBlocks(x, { fonts: false })`); `{ fonts: true }` is used only in AC-007 item 2 and AC-010; counts use the exact attribute `data-mdedit-diagram=""`. AC-001 (L31) and AC-002 (L36) switched to the exact attribute. AC-005's "`</pre></body>`로 끝난다" now holds because it is a unit AC with fonts off. In the viewer tests, which run with the default and may include the font style, I checked each assertion against `<style data-mdedit-diagram-fonts="">`. It contains no `<svg` and no `data-mdedit-diagram=""` (the attribute name continues with `-fonts`). It is not the 019 `<style>html{zoom:` injection. Call counts and the sandbox value are unaffected. So AC-001, AC-008 and AC-009 cannot fail because of font insertion. |
| N2 | SHOULD-FIX | **RESOLVED** | plan.md M4 defines the public signature `prerenderMermaidBlocks(html: string, opts?: { fonts?: boolean }): string`. The default follows the M1 path ((A)/(B) → `true`; (C) → `false`, and `true` then inserts nothing). The plan states explicitly that functions in the same module can't be mocked, so tests switch fonts with the option. `CrispHtmlView` calls with no options, consistent with REQ-007's single call. AC-007 (L108-109) uses the option instead of a mock. |
| N3 | MINOR | RESOLVED | plan.md M2: "`div`는 가림 사본에서 따옴표를 건너뛰는 같은 시작 태그 정규식(태그 이름 `div`)으로 +1". See residual R2 for one implementation note. |
| N4 | MINOR | RESOLVED | AC-010 first item now defers to the rule below it ("Windows 측정 시점과 정지 규칙은 바로 아래 항목을 따른다"). The M-0 Windows cell reads "가능하면 M1에서, 못 하면 M-2에서(실패 시 정지 — AC-010)". plan.md M1 already matched. |
| N5 | MINOR | RESOLVED | REQ-004 (b) now reads "성공 블록은 변환을 다시 돌려도 다시 그려지지 않는다(변환은 REQ-007대로 문서마다 한 번만 돈다)". |
| N6 (=D13) | MINOR | Carried, no action required | SPEC-SEC-002 / SPEC-PREVIEW-022 live in parallel worktrees; plan §C pre-flight 2 re-checks after merging origin/main. |

All iteration-2 defects are resolved. Across three iterations, no defect stayed unchanged in every iteration (no stagnation).

## New-defect scan (v0.1.2)

The revision introduced no contradiction:
- The `opts.fonts` default rule agrees with REQ-008's path choice and with REQ-006 exception (4).
- The fonts-off rule does not touch any REQ; it binds only the verification layer.
- Exact-attribute counting agrees with AC-012's `[data-mdedit-diagram]` selector.

Two cosmetic residues remain (below). Neither affects correctness or makes any criterion unsatisfiable.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Δ vs iter 2 | Evidence |
|-----------|-------|-------------|-------------|----------|
| Clarity | 0.90 | 1.0 | +0.02 | Test-state rule at acceptance.md:L22; signature and default rule in plan M4. Residue R1 (definition of `P`). |
| Completeness | 0.95 | 1.0 | 0 | All sections present; HISTORY 0.1.2 records the delta. |
| Testability | 0.88 | 1.0 | +0.10 | No AC is unsatisfiable under any font path (N1). Font on/off has a working mechanism (N2). |
| Traceability | 0.95 | 1.0 | 0 | REQ↔AC map unchanged and complete (acceptance.md:L5-18). |

Aggregate (harmonic mean): 0.92. No score regression across iterations → no STOP signal.

## Defects Found (structured defect-list)

R1. P-DEFINITION-WORDING — acceptance.md:L24 vs L22 — L24 still defines `P(x)` as `prerenderMermaidBlocks(x)` (no options), while L22 says unit ACs call `prerenderMermaidBlocks(x, { fonts: false })`. L22 is explicit enough that a tester will follow it, so this is a wording inconsistency, not a contradiction. — Severity: MINOR — Class: optional — Suggested fix (can be done at sync, or ignored): define `P(x)` as `prerenderMermaidBlocks(x, { fonts: false })` and use `P⁺(x)` for `{ fonts: true }`.

R2. DEPTH-TOKENIZER-NOTE — plan.md M2 (closing rule) — The quote-aware regex only protects the depth count if the scanner consumes each matched start tag's full extent before looking for `</div`. If opens and closes are found by two independent regex searches merged by position, a `</div>` inside a quoted attribute value is still counted. This is an implementation detail for an edge case that is very rare. — Severity: MINOR — Class: optional — Suggested fix: none required in the SPEC. manager-develop can scan opens and closes in one left-to-right pass, or add an AC-002 row such as `<div class="mermaid"><div data-x="</div>">OK</div></div>` → 1.

R3. CARRIED D13/N6 — referenced SPEC-SEC-002 / SPEC-PREVIEW-022 not in this worktree — Severity: MINOR — Class: optional — No action.

## Recommendation

PASS (0.92 ≥ 0.80, all must-pass checks pass, no blocking defect). Rationale per must-pass:
- MP-1/MP-2: REQ-001~010 sequential and in GEARS form.
- MP-3: 12 canonical fields, `version: "0.1.2"`.
- MP-5: no retired, superseded or archived references.
- MP-6/MP-7: no `syscall` text and no clarification markers.

The plan→run human gate (Implementation Kickoff Approval) still applies; this PASS does not bypass it. Run-phase entry conditions remain as stated in acceptance.md DoD:
- merge origin/main (t1 SEC-002, t3 PREVIEW-022);
- confirm 019 and 015 are `completed`;
- complete M1, the font gate, first, recording the macOS result (and Windows if possible).

R1-R3 are optional.

Gaps (not observed by this audit):
- vitest was never run (no `node_modules` in this worktree).
- The plan's regexes and `String.prototype.trim` removing U+00A0 were verified by reading and the JavaScript spec only. The author's `node -p` → `1` is recorded in progress.md but was not re-observed here.
- Real-device CORS/CSP font behavior is unmeasured by design (M1).

Residual risk: path (A) may still fail at M1 on one or both WebViews. The SPEC handles this by stopping and escalating to (B) or (C) rather than proceeding silently.
