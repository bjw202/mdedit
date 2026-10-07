# SPEC Review Report: SPEC-PREVIEW-014
Iteration: 1/3
Verdict: PASS-WITH-DEBT
Overall Score: 0.86 (Tier S threshold 0.75)

Reasoning context ignored per M1 Context Isolation. Inputs: spec.md, plan.md, acceptance.md, progress.md + source code cross-reference.

## Must-Pass / Checklist Results

| ID | Result | Evidence |
|----|--------|----------|
| MP-1 Unambiguous, testable, traceable | PASS | REQ-001..005 sequential (spec.md:L45,50,56,61,68), no gaps/dupes. Matrix below: every REQ has >=1 AC and >=1 T. Minor: T11 omits expected call count (D2). |
| MP-2 GEARS + frontmatter | PASS (GEARS) / FAIL (lint, project-wide) | REQs use When/Ubiquitous/shall-not forms. `moai spec lint spec.md` -> `ERROR ParseFailure ... line 13: cannot unmarshal !!seq into string` (tags YAML array). Same error on completed sibling SPEC-IMG-WIDGET-002 (identical output); 43/43 SPECs in repo use list-form tags. Scratch copy with `tags` as quoted string -> `No findings — all SPEC documents are valid` (so `lifecycle: spec-first`, GEARS modality all pass the linter). `mcp__moai__spec_audit(filter_spec=SPEC-PREVIEW-014)` returned `total_specs: 0` (did not cover the untracked SPEC — not usable evidence). |
| MP-3 Root cause true | PASS | usePreview.ts:54 calls `renderMarkdown(content, highlighter, isDark)` (no mdFilePath) -> renderer.ts:329-337 plugin skips rewrite (`if (srcIndex >= 0 && mdFilePath)`). renderMarkdown returns `restoreSvgMarkers(md.render(...))` (renderer.ts:427-432) — no src rewrite; DOMPurify runs later in PreviewRenderer (after embed). usePreview.ts:54-55 pipes output straight to embedPreviewImages. imageResolver.ts:103-109 builds path from raw src. Reproduced with markdown-it 14.1.1: `figures_svg/도01_frame.png -> figures_svg/%EB%8F%8401_frame.png`, `100%.png -> 100%25.png`, `a%20b.png -> a%20b.png` (kept), `a#b.png`/`a?b.png`/`a+b.png` unchanged, `%E0%A4.png` -> decodeURIComponent URIError. decodeURIComponent is the correct inverse for mdurl.encode output (mdurl leaves `#?+&` etc. unencoded; decodeURIComponent leaves those literals intact; only valid pre-existing `%XX` is lossy, covered by the original-path fallback). Diagnosis challenge: user's ASCII-rename control (spec.md:L31) isolates the variable to filename characters; T1 RED will confirm the frontend half. Not fully inverted: markdown-it HTML-escapes `&` -> `&amp;` in the attribute (`a&b.png -> a&amp;b.png`), which decodeURIComponent does not undo (D4). |
| MP-4 Safety | PASS | validate_path (file_ops.rs:22-30) rejects any `ParentDir` component via `Path::components()` — it is component-based, not string-based, and runs on the final string the frontend sends. `%2E%2E/x` decodes to `../x` -> `/docs/../x` -> rejected, exactly like the already-possible raw `../x.png` (markdown-it passes it unchanged). On Windows `%5C` decodes to `\`, still parsed as a separator -> ParentDir still detected. `%2F` decode yields `/docs//etc/x` (stays under mdDir). No new traversal. Note: validate_path has no root confinement and absolute `/abs` srcs already read any path (pre-existing threat model) — the fix does not widen it. Existing Rust guard test: image_ops.rs:388 `test_read_image_path_traversal_prevention`. |
| MP-5 Test realism | PASS with gaps | Algorithm-consistency check: T3 (URIError -> original, 1 call), T4 (decoded hits, 1 call), T5 (decoded reject -> original resolve, order `/docs/a b.png` -> `/docs/a%20b.png`), T6 (2 calls), T10 (cache on success) all consistent with REQ-002. Gaps: T11 call count (D2); plan.md mock citation wrong (D3); no NFC/NFD case or exclusion (D5). |
| MP-6 Scope | PASS (with optional note) | Change confined to embedPreviewImages + 1 test file (plan.md:L42-47). Tier S normally carries AC inline in spec.md; a separate acceptance.md + 5 REQs for a ~10-line change is heavier than needed (D7, optional). Export path excluded without noting it has the identical defect (D6). |
| MP-7 Clarification markers | PASS | No `[NEEDS CLARIFICATION` in plan.md; research.md absent. |
| D7 cross-SPEC | PASS | related_specs PREVIEW-001/008, IMG-MODE-003, IMG-WIDGET-002 exist; none retired/superseded. |
| D8 syscall | N/A | No `syscall` in SPEC. |

## Traceability Matrix

| REQ | AC | Tests |
|-----|----|-------|
| REQ-001 decode-first | AC-01 | T1, T2, T4 |
| REQ-002 fallback once | AC-03 | T4, T5, T6 |
| REQ-003 malformed % | AC-02 | T3 |
| REQ-004 no regression | AC-04 | T7, T8, T9, T10 |
| REQ-005 no validation bypass | AC-05 | T11 (Rust half covered by existing image_ops.rs:388) |

ACs cite T-ids, not REQ-ids directly; mapping is indirect but complete.

## Category Scores

| Dimension | Score | Band | Evidence |
|-----------|-------|------|----------|
| Clarity | 0.85 | 0.75-1.0 | REQs precise (spec.md:L47-71); REQ-003 labelled "Event-detected" (not a GEARS pattern name); Korean/English hybrid sentences |
| Completeness | 0.80 | 0.75 | All sections present; Exclusions miss export twin defect, `&amp;`, NFD |
| Testability | 0.90 | 1.0- | Binary gates acceptance.md:L59-66; T11 count unspecified |
| Traceability | 0.90 | 1.0- | Matrix above, all covered |

## Defects Found

D1 — spec.md:L13 — `tags: [...]` fails `moai spec lint` (ParseFailure, seq into string). Project-wide convention (sibling IMG-WIDGET-002 identical). Severity: SHOULD-FIX — Class: optional for this SPEC (blocking only if the orchestrator enforces `moai spec lint`) — Fix: `tags: "preview, image, bugfix, i18n, percent-encoding, korean"`; verified this alone yields a clean lint.
D2 — acceptance.md:L25 — T11 does not state the expected call sequence. Under REQ-002 the decoded path differs, so 2 calls: `/docs/../secret.png` then `/docs/%2E%2E/secret.png`. Severity: SHOULD-FIX — Fix: add "호출 2회, 순서 위와 같음".
D3 — plan.md:L20, acceptance.md:L8 — claims imageHandler.test.ts:31-46 mocks `@tauri-apps/api/core` "including convertFileSrc"; it mocks only `invoke` (imageHandler.test.ts:31-33). imageResolver.ts:4 imports `convertFileSrc`. Severity: MINOR — Fix: state the new test's core mock must export `convertFileSrc: vi.fn()` (and `invoke`).
D4 — spec.md Exclusions — markdown-it escapes `&` to `&amp;` in src (`a&b.png -> a&amp;b.png`); the fix leaves such filenames broken. Severity: MINOR — Fix: add an Out of Scope bullet (HTML-entity filenames) or decode `&amp;` too.
D5 — spec.md Exclusions / acceptance — no mention of Unicode normalization: decoded name keeps the markdown text's form (usually NFC); files named on macOS may be NFD. Lookup is normalization-insensitive on APFS but not on NTFS/ext4. Severity: MINOR — Fix: add Out of Scope bullet (NFC/NFD mismatch) or a note that the manual check is macOS-only.
D6 — spec.md:L95 — export exclusion gives no rationale; `exportHtml.ts:133-166` `embedLocalImages` is a near-duplicate with the same undecoded-path defect (Korean images will still be dropped in HTML export). Severity: SHOULD-FIX (documentation) — Fix: record the known twin defect and a follow-up SPEC candidate in Exclusions.
D7 — artifact set — Tier S with a separate acceptance.md and 5 REQs is heavier than Tier S convention for a ~10-line change. Severity: MINOR — Class: optional — Fix: none required.

No BLOCKING defects.

## Recommendation

PASS-WITH-DEBT. Root cause verified in code and by markdown-it reproduction; decode-first/original-fallback is consistent with mdurl.encode semantics; no path-traversal weakening (validate_path is component-based). Before run: fix D1 (one line) if lint is enforced, and D2/D3 (test-spec precision). D4-D6 are Exclusions documentation; D7 optional.
