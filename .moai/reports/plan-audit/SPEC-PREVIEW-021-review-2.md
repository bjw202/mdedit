# SPEC Review Report: SPEC-PREVIEW-021
Iteration: 2/3
Verdict: FAIL
Overall Score: 0.88 (iteration 1: 0.84 → delta +0.04; Tier M threshold 0.80)

Reasoning context ignored per M1 Context Isolation. Audit input: spec.md / plan.md / acceptance.md / progress.md at commit f334037 (v0.1.1), compared with 490f887 via `git diff`. Scope: the iteration-1 defect delta (D1-D15), a regression check, and new defects introduced by the revision.

## Must-Pass Results

- [PASS] MP-1 REQ numbering: REQ-PREVIEW021-001 (spec.md:L43) … -010 (spec.md:L97), sequential, unchanged count (10).
- [PASS] MP-2 GEARS (requirement layer only): revised REQs keep `The … shall [not]` / `When …, the … shall` form (spec.md:L59-60, L65-66, L72-73, L78, L88). ACs not graded here.
- [PASS] MP-3 frontmatter: 12 fields present; `version: "0.1.1"` (L4), `updated: 2026-11-09` (L7); HISTORY row 0.1.1 (L26) matches.
- [N/A] MP-4 single-application SPEC.
- [PASS] MP-5 D7: same references as iteration 1; none retired/superseded/archived. SPEC-SEC-002 / SPEC-PREVIEW-022 are still absent from this worktree (SHOULD, D13 — no action needed).
- [PASS] MP-6 D8: the revision adds no `syscall` text (the diff contains none).
- [PASS] MP-7: the revision adds no `[NEEDS CLARIFICATION` markers (diff and current progress.md/plan.md read in full).

## Regression Check (iteration-1 defects)

| ID | Prior severity | Status | Evidence |
|----|----------------|--------|----------|
| D1 | BLOCKING | **PARTIALLY RESOLVED** | REQ-006 now lists four exceptions, including the font `<style>` (spec.md:L78). The insertion point is fixed as "어느 블록 안에도 있지 않은 마지막 `</body>`" (L88; AC-010 acceptance.md:L126). AC-007 has font-off and font-on variants (acceptance.md:L106-107). **But the same by-construction failure remains in three other ACs** — see N1. I under-scoped D1 in iteration 1 by naming only AC-007. |
| D2 | SHOULD-FIX | RESOLVED | REQ-004 (a): "값이 없으면 앱 토큰 리터럴 `#FAF9F6`·`#97A4B1`·`3px`" (spec.md:L66); AC-005 asserts the jsdom values (acceptance.md:L91). |
| D3 | SHOULD-FIX | RESOLVED (minor wording residue → N4) | Stop rule added: "Windows를 M1에서 재지 못했다면 M-2에서 … run을 멈추고 코디네이터에 blocker로 올린다" (acceptance.md:L125; plan.md M1 기록). |
| D4 | SHOULD-FIX | RESOLVED | The claim now covers entity decoding only, with an explicit exception for real tags (spec.md:L59). Limitation 8 added (L122). |
| D5 | MINOR | RESOLVED | AC-009 now has three fallback cases, UTF-8 included (acceptance.md:L120). |
| D6 | MINOR | RESOLVED (one plan residue → N3) | Single-pass scanner; raw-text elements inside are not treated as comments; quoted `>` handled (spec.md:L53). Element list extended (L52); `<svg` check is case-insensitive on the masked copy (L55); limitation 9 added (L123). New AC rows: acceptance.md:L46-48, L64. |
| D7 | MINOR | RESOLVED | Dedent definition at spec.md:L60. I worked both new AC-004 examples by hand against it: L80 (tab prefix, blank line) → `flowchart TD\n\n  A --> B` ✓; L81 (`&nbsp;`): common prefix is 2 spaces, then `trim` removes the leading `\n ` → `flowchart TD\nA --> B` ✓. Removing U+00A0 relies on ECMAScript `trim` (U+00A0 counts as WhiteSpace); the SPEC states this (L60). The fixtures still keep their positions: BAD's first line has zero indentation, so the common prefix is empty. |
| D8 | MINOR | RESOLVED | acceptance.md:L152 (the newline survives template parsing; trim removes it). |
| D9 | MINOR | RESOLVED | `result.svg.outerHTML` fixed (spec.md:L66; plan.md M3 states the return type is `{ svg, width, height }`). |
| D10 | MINOR | RESOLVED | spec.md:L73; AC-006 new bullet (acceptance.md:L100). |
| D11 | MINOR | RESOLVED | The DoD splits the run-completion condition from the close condition (acceptance.md:L165). |
| D12 | MINOR (hypothetical) | RESOLVED by design change | REQ-004 (b) inserts ` data-processed="true"` before `>`/`/>` (spec.md:L66). This is listed as REQ-006 exception (2) (L78). AC-005 covers it: idempotent re-run, and `/>` and trailing-space start tags (acceptance.md:L87-88). Consistent with REQ-002's skip rule (L55). Side effect → N5. |
| D13 | MINOR | N/A — no action needed (as recommended) | progress.md v0.1.1 note. |
| D14 | MINOR | RESOLVED | `await document.fonts.load(...)` before `check`; weight↔file mapping recorded in the M1 table (plan.md M1; acceptance.md:L125). |
| D15 | MINOR | RESOLVED | The "once per call" rule moved into REQ-004 (spec.md:L65), so AC-005 L92 now traces to a REQ. |

Resolved: 13 of 15 (D13 needed no action). Partially resolved: D1 (BLOCKING residue). No defect stagnated (none survives unchanged).

## New-defect scan (introduced or exposed by v0.1.1)

Checked and found consistent:
- REQ-006 exception (2) agrees with REQ-004 (b) and with REQ-002's `data-processed` skip.
- The re-run of a success block is idempotent (the second pass renders 0 blocks, so no second font style either).
- REQ-008's insertion point agrees with AC-010.
- Plan M4 notes that insertion order works with back-to-front replacement.
- The quote-aware start-tag regex (plan.md M2) matches the HTML rule that `/` belongs to an unquoted value (`<div class=mermaid/>` → token `mermaid/`, not a block). That is browser-consistent. By reading, it has no ambiguous repetition that could backtrack catastrophically.
- Executing the regex/trim checks failed: the worktree command guard refused `node -e`, and Write outside the project was refused. Those two points are verified by reading only (Gap).

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Δ vs iter 1 | Evidence |
|-----------|-------|-------------|-------------|----------|
| Clarity | 0.88 | 1.0 | +0.08 | Masking, dedent, insertion point, serialization and fallback values are now each stated once (spec.md:L53, L60, L66, L88). Residue: N3, N4. |
| Completeness | 0.95 | 1.0 | 0 | All sections present; limitations 8-9 added (L122-123). |
| Testability | 0.78 | 0.75 | +0.03 | New AC rows are binary (acceptance.md:L46-48, L64, L80-81, L88, L100, L120). But AC-001, AC-002 and AC-005 still fail by construction under font path (A)/(B) (N1). The "mock the font function" seam is not testable as planned (N2). |
| Traceability | 0.95 | 1.0 | +0.05 | The REQ-001 UTF-8 sub-clause and the REQ-004 once-per-call rule are now covered (L120, L92). |

Aggregate (harmonic mean): 0.88.

## Defects Found (structured defect-list)

N1. D1-RESIDUE — acceptance.md:L29, L34, L87 — The font-path contradiction fixed in AC-007 is still present in three ACs. Under the preferred paths (A)/(B), every input with ≥1 rendered block also receives `<style data-mdedit-diagram-fonts="">` before the last `</body>`:
- AC-005 (L87) requires the result to "`</pre></body>`로 끝난다". With font insertion the result ends `</pre><style data-mdedit-diagram-fonts="">…</style></body>`, so this fails.
- AC-001 (L29) requires `data-mdedit-diagram` to appear exactly once in srcdoc. The substring also occurs inside `data-mdedit-diagram-fonts`, giving a count of 2.
- AC-002 (L34) counts `data-mdedit-diagram` per row. Same substring problem: every row with a success doubles. Any row that included a failure would also match `data-mdedit-diagram-error`.

These were present in v0.1.0 as well; iteration 1 named only AC-007. — Severity: BLOCKING — Class: blocking — Required fix:
- (1) Add one sentence to the verification-layer principle (acceptance.md:L20): "AC-001~009·011은 글꼴 삽입을 끈 상태에서 판정하고, 글꼴 삽입은 AC-007 두 번째 항목과 AC-010만 켠다."
- (2) Make the counts attribute-exact: count `data-mdedit-diagram=""` occurrences or `[data-mdedit-diagram]` elements, not the bare substring.

N2. FONT-OFF-SEAM-UNTESTABLE — plan.md M4 ("단위 테스트가 끌 수 있도록 글꼴 조립은 별도 내부 함수로 둔다"), acceptance.md:L106 ("글꼴 삽입 함수를 모의") — A function internal to `htmlMermaid.ts` and called from the same module cannot be replaced with `vi.mock`/`vi.spyOn`, because ESM calls inside one module bypass the mocked export. The "font off" state that N1's fix and AC-007 depend on therefore has no workable mechanism as written. — Severity: SHOULD-FIX — Class: blocking (the stated test method cannot be carried out) — Required fix: pick a seam explicitly. Options: put font assembly in its own module (e.g. `src/lib/preview/htmlMermaidFonts.ts`) mocked with `vi.mock`, or add an optional second parameter `prerenderMermaidBlocks(html, { fonts?: boolean })` defaulting to on (REQ-007's call site stays single-argument). If the new file is chosen, list it in plan §D.

N3. PLAN-DEPTH-REGEX-NOT-QUOTE-AWARE — plan.md M2 "닫기: … `div`는 `<div(\s[^>]*)?>` +1 / `</div\s*>` −1" vs spec.md:L53 — The block start-tag regex was made quote-aware; the nested-div depth regex was not. An attribute value containing `</div` (e.g. `<div data-x="</div>">` inside a block) would be counted as a close. Rare. — Severity: MINOR — Class: optional — Required fix: say the depth counter reuses the quote-aware tag regex (with `div` only), or add this to limitation 9.

N4. D3-WORDING-RESIDUE — acceptance.md:L124 ("Windows 결과는 M-2에서 채운다") and L146 ("필수(경로 확정 후)") vs L125 ("Windows는 가능하면 M1에서 함께 잰다 … 멈추고 blocker") — Three statements about when Windows is measured. L125 is the operative rule; the other two read as older wording. — Severity: MINOR — Class: optional — Required fix: replace L124's sentence with "Windows는 L125 규칙을 따른다" and the L146 cell with "M1에서 가능하면, 아니면 M-2(실패 시 정지)".

N5. FAILURE-REPEAT-NOT-IDEMPOTENT — spec.md:L66 (b) rationale "변환을 다시 돌려도 같은 결과가 된다" — This holds for success blocks only. A failed block keeps its start tag unchanged (REQ-005), so a second `P` call adds a second notice. REQ-007 calls the transform once per read, so this is not a live defect; the rationale sentence just over-claims. — Severity: MINOR — Class: optional — Required fix: change it to "성공 블록은 다시 돌려도 같은 결과가 된다", or accept as is.

N6. CARRIED — D13 (SPEC-SEC-002 / SPEC-PREVIEW-022 not in this worktree) — Severity: MINOR — Class: optional — No action required.

## Recommendation

FAIL. Only N1 is blocking (N2 is the test-seam half of the same fix). The v0.1.1 revision resolved 13 of the 15 iteration-1 defects cleanly. The D12 design change (`data-processed`) is internally consistent with REQ-002, REQ-004 and REQ-006 and introduces no contradiction. The score rose from 0.84 to 0.88, so there is no regression and no STOP signal.

For iteration 3 (the final iteration), a one-paragraph change is enough:
1. N1: add a "font insertion off" default for AC-001-009/011 to the verification principle (acceptance.md:L20), and switch the AC-001/AC-002 counts to the exact attribute `data-mdedit-diagram=""` (or the `[data-mdedit-diagram]` element selector).
2. N2: name the test seam (separate module mocked with `vi.mock`, or an optional `{ fonts }` parameter) in plan M4 and in AC-007.
3. Optional: N3-N5 wording.

The iteration-3 re-audit should be limited to N1-N2. If those are fixed as described, nothing else blocks a PASS.

Gaps (not observed): vitest still cannot run here (no `node_modules`). The `node -e` regex/trim checks were refused by the worktree command guard, so the plan regex behavior and the `trim`/U+00A0 claim are verified by reading and language-spec knowledge only, not by execution. CORS behavior on the real device remains for M1.
