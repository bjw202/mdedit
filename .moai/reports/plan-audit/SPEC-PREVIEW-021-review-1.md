# SPEC Review Report: SPEC-PREVIEW-021
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.84 (Tier M threshold 0.80 — score clears the bar; FAIL is driven by one blocking internal contradiction, D1)

Reasoning context ignored per M1 Context Isolation. Audit input: spec.md, plan.md, acceptance.md, progress.md at commit 490f887 (Tier M → primary trio + progress.md), plus targeted code reads to verify the SPEC's code claims.

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: `#### REQ-PREVIEW021-001` (spec.md:L42) … `-010` (spec.md:L95), sequential, no gaps or duplicates, consistent 3-digit padding.
- [PASS] MP-2 GEARS format (requirement layer only, REQ-XXX in spec.md): every REQ bullet opens with `The <subject> shall [not]` / `When …, the … shall` / `While …, the … shall` (e.g. spec.md:L44, L45, L53, L59, L63, L70, L82, L86). Note: REQ-008 (spec.md:L86) is structurally ubiquitous but embeds a selection procedure ("다음 순서로 고른다 … (C)는 … 고르지 않는다") — process text inside a requirement; minor, not a format failure. REQ-001 (L44) mixes While with an event clause ("읽었을 때") — acceptable compound. ACs (acceptance.md, Given-When-Then / table-driven) were NOT graded here.
- [PASS] MP-3 YAML frontmatter: all 12 canonical fields present with correct types (spec.md:L2-L13): `id: SPEC-PREVIEW-021`, `version: "0.1.0"` (quoted), `status: draft`, `created/updated: 2026-11-09`, `priority: Medium`, `phase: "v0.21.0 target"` (release label, not a lifecycle token), `module: src/lib/preview`, `lifecycle: spec-anchored`, `tags` comma string. No rejected aliases. Optional `tier: M`, `depends_on` valid.
- [N/A] MP-4 Language neutrality: single-project app SPEC (TypeScript front end); font names (Barlow, IBM Plex Mono) are not language tooling.
- [PASS] MP-5 D7 cross-SPEC: referenced SPECs and status — PREVIEW-015 completed, 016 completed, 017 completed, 019 completed, 020 implemented. None retired/superseded/archived → no BLOCKING. SPEC-SEC-002 and SPEC-PREVIEW-022 NOT FOUND in this worktree's `.moai/specs/` → SHOULD (see D13).
- [PASS] MP-6 D8 cross-platform: `grep -c syscall` = 0 in all four artifacts → auto-PASS.
- [PASS] MP-7 clarification gate: `grep -rn 'NEEDS CLARIFICATION'` over the SPEC dir → no matches (exit 1). No research.md (Tier M).

## Code-claim verification (claims vs code)

| Claim | Evidence | Result |
|-------|----------|--------|
| `renderExportDiagram` returns null on empty/failure, resolves all `var(--pele-` | exportUtils.ts:L42-58 (`if (!source.trim()) return null`; `if (!result.ok) return null`; `resolveDiagramColors(svg, values)`); diagramRenderer.ts `resolveDiagramColors` walks every attribute + `<style>` text, unknown names fall back to pele fallback | CONFIRMED. Note: return type is `{ svg, width, height }` (exportUtils.ts:L20-26), not a bare `SVGSVGElement` as plan.md:L15 says. Also returns null when the template has no `<svg>` (L48-49) — a non-pele failure (D10). |
| `readPeleThemeValues('light')` sufficient (tokens theme-independent) | mdedit-tokens.css:L96-97 comment "Theme-independent by decision (SPEC-PREVIEW-016): … no dark-block redeclaration"; grep of `[data-theme="dark"]` block (L130+) finds no `--pele-*` | CONFIRMED. jsdom returns an empty table (diagramRenderer.ts `readPeleThemeValues` early return) as plan §B.5 says. |
| CSP: no `font-src`, `style-src 'unsafe-inline'` | index.html:L7 — `default-src 'self' tauri: asset: http://asset.localhost https://asset.localhost; style-src 'self' 'unsafe-inline' …`; no `font-src` | CONFIRMED. `data:` fonts fall under default-src → blocked. |
| Error fixtures `21-error-line-col` → 2행 14열, `22-error-line0-semantic` → no suffix | diagramRenderer.test.ts:L279-283 asserts exactly these; fixture sources (m1-frozen/errors.json): `"sequenceDiagram\n  A->>B hello"` and `"pie\n  \"a\" : -1"` | CONFIRMED by reading. First lines have zero indentation, so REQ-003 dedent is a no-op and trim does not shift line/column → position survives extraction. NOT confirmed by execution: `npx vitest` failed to collect because this worktree has no `node_modules` (Gap). |
| e2e approach (seed persisted v2 + `read_file` mock, inline HTML constant) | e2e/html-file-viewer.spec.ts:L158-190 (`localStorage.setItem('mdedit-ui-store', … version: 2)`, `internals.invoke` override for `read_file`/`read_file_size`, `PAGE_HTML` constant) | CONFIRMED; plan §D "픽스처 파일 없음" matches existing practice. |
| Insertion point in `CrispHtmlView` | HtmlFileViewer.tsx:L89-97 — `readFile` → `buildSrcdoc(text, …)` inside `try`; effect deps `[htmlPath]` (L108); zoom via postMessage (L118-121) | CONFIRMED. Because the call sits inside the `try` whose `catch` maps errors to `'read'`/`'utf8'` fallback, REQ-007's no-throw guarantee is load-bearing (good that it exists). |
| Font risk (019 §3 limitation 3) | 019 spec.md:L141 "`@font-face` 웹폰트 … `Access-Control-Allow-Origin`이 앱 셸 출처로 고정되어 있어 실패한다"; fonts at public/fonts/barlow-400/500/700, ibm-plex-mono-400/500/600 (mdedit-fonts.css) | CONFIRMED the risk is real and correctly framed as an M1 gate. Adequacy caveats: D3, D14. |
| Wrapper fallback literals | plan.md:L71 `#FAF9F6`·`#97A4B1`·`3px` = mdedit-tokens.css:L104/L110/L114 | Values match the tokens, but contradict spec.md:L64 "pele 대체값" (D2). |
| `pd<N>` id prefix (limitation 7) | diagramRenderer.ts `const idPrefix = \`pd${++renderSeq}\`` | CONFIRMED. |

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.80 | 0.75 | Most rules are precise (detection grammar spec.md:L50-53, insertion order plan.md:L73, wrapper/notice markup plan.md:L71-72). Ambiguities: dedent definition (L58, D7), masking order / raw-text element set (plan.md:L62, D6), serialization choice (plan.md:L71, D9), fallback value source (L64 vs plan L71, D2), false equivalence claim (L57, D4). |
| Completeness | 0.95 | 1.0 | HISTORY L21, 배경/WHY L29-34, scope L36-38, REQ §2, AC in acceptance.md, `### 5.1 Out of Scope — 원본 보기` … `5.6` each with `-` bullets (L138-160), limitations L111-119, open questions L171-174. Frontmatter complete. |
| Testability | 0.75 | 0.75 | Most ACs binary (exact strings AC-006 L91-92, byte equality AC-003 L49, counts AC-002). AC-007 (L97-100) becomes unsatisfiable under font path (A)/(B) — D1. M-1 "같은 색으로 보인다" (L129) is a visual judgment (acceptable for manual items). |
| Traceability | 0.90 | 1.0 | Every REQ maps to ≥1 AC (acceptance.md:L5-18; spec.md §4 L123-134); every AC references an existing REQ. Sub-clause gaps: REQ-001 UTF-8 fallback (L45) not exercised by AC-009 (D5); REQ-004 "가운데 정렬" unasserted. |

Aggregate (harmonic mean): 0.84.

## Defects Found (structured defect-list)

D1. CONTRADICTION-REQ006-REQ008 — spec.md:L76 vs spec.md:L86, acceptance.md:L97-100, L116 — REQ-006 states the only permitted changes are "블록 안쪽 교체와 실패 안내 삽입" and that all other bytes are identical; REQ-008 paths (A)/(B) (the preferred paths) insert a `<style data-mdedit-diagram-fonts>` before `</body>` whenever ≥1 block renders, and plan M4 (plan.md:L77) places that insertion inside the same module. AC-007's input `H` contains a renderable `OK` block, so under (A)/(B) `P(H)` minus the block interior ≠ `H` minus the block interior → AC-007 fails by construction, and REQ-006 is violated by a requirement of the same SPEC. — Severity: BLOCKING — Class: blocking — Required fix: (1) add the font `<style>` (only under paths A/B, only when ≥1 block rendered) to REQ-006's exception list; (2) pin its insertion point unambiguously: the last `</body>` found in the masked copy that lies outside every block range, else end of string; (3) rewrite AC-007 to also strip that one `<style data-mdedit-diagram-fonts …>…</style>` before comparing (or state that AC-007 runs with the font insertion disabled/stubbed), and keep AC-010's exact-position assertion as the positive check.

D2. WRAPPER-FALLBACK-SOURCE — spec.md:L64 vs plan.md:L71 — Spec says missing values use "pele 대체값"; plan says literals `#FAF9F6`/`#97A4B1`/`3px` (these equal the app tokens, mdedit-tokens.css:L104/110/114). pele's own fallbacks are different values (diagramRenderer.ts `@MX:WARN` cites `var(--pele-bg,#fff)`). In jsdom (empty table) the two readings produce different wrapper styles. — Severity: SHOULD-FIX — Class: blocking (internal inconsistency, low impact) — Required fix: choose one in REQ-004 (recommend the token literals, matching mdedit-tokens.css) and state it; optionally have AC-005 assert the exact jsdom fallback values.

D3. FONT-GATE-WINDOWS-DEFERRED — acceptance.md:L115 ("Windows 결과는 M-2에서 채운다"), L136 ("필수(경로 확정 후)"), plan.md:L56 — M1 picks the font path from macOS measurements only; WebView2 (`http://tauri.localhost`, opaque `Origin: null`) may answer CORS differently from WKWebView (`tauri://localhost`). A path that works on macOS can fail on Windows only at close-time manual M-2, after implementation. — Severity: SHOULD-FIX — Class: optional — Required fix: either measure path (A) on Windows within M1 before committing to it, or add a rule: "Windows M-2에서 선택 경로가 실패하면 run을 멈추고 OS별 경로 또는 (C)를 blocker로 올린다". Also note that SPEC-PREVIEW-020 makes Windows default to 원본 보기, which lowers impact on Windows.

D4. EXTRACTION-EQUIVALENCE-CLAIM — spec.md:L57 — "마크다운 펜스에 같은 소스를 쓴 경우와 pele 입력이 같아진다" is only true for entity decoding. The fence path (`previewDiagramInput`, exportUtils.ts:L14-18) keeps `<b>x</b>` as literal text, while REQ-003 drops tags (AC-004 L74: `A[<b>x</b>]` → `A[x]`). This is a user-visible difference with no limitation entry. (Whether mermaid.js keeps such markup was not verified in this audit.) — Severity: SHOULD-FIX — Class: optional — Required fix: narrow the claim to "엔티티 디코드와 `<br>` 처리가 같다" and add a §3 limitation: "블록 안의 HTML 태그(`<b>` 등)는 버려져 라벨에 반영되지 않는다".

D5. AC009-UTF8-GAP — spec.md:L45 vs acceptance.md:L110-111 — REQ-001 names three fallbacks (size, read, UTF-8); AC-009 tests only size and read. — Severity: MINOR — Class: optional — Required fix: add a row where `readFile` rejects with a message matching `/utf-?8/` and assert `renderExportDiagram` is not called.

D6. MASKING-UNDERSPECIFIED — plan.md:L14, L62-64; spec.md:L51 — (a) Masking order is not fixed. If the existing `maskComments` regex (`/<!--[\s\S]*?(?:-->|$)/g`, htmlSrcdoc.ts:L58-60) is reused before raw-text masking, a script string containing `'<!--'` without `-->` masks the rest of the document and silently hides all later blocks. (b) Other raw-text/RCDATA elements (`<title>`, `<xmp>`, `<noscript>`, `<iframe>`, `<noembed>`, `<plaintext>`) are not listed. (c) The start-tag regex `<(pre|div)(\s[^>]*)?>` breaks on `>` inside quoted attribute values and can match a `<pre …>` written inside another tag's attribute value. (d) Whether the `<svg` "already rendered" test is case-insensitive and run on the masked copy is unstated. — Severity: MINOR — Class: optional — Required fix: one sentence each: single left-to-right scan in which raw-text elements and comments are recognized in document order; either add the extra elements or list them as a limitation; start-tag scan respects quoted attribute values (or accept and list as a limitation); `<svg` test is case-insensitive and runs on the masked inner range.

D7. DEDENT-UNDERSPECIFIED — spec.md:L58 — "비어 있지 않은 모든 줄에 공통인 앞쪽 공백" leaves open: tabs vs spaces, whether whitespace-only lines count as empty, whether decoded `&nbsp;` (U+00A0) counts as whitespace. — Severity: MINOR — Class: optional — Required fix: define it, e.g. "공백 = U+0020·U+0009; 공백만 있는 줄은 계산에서 빼고; 공통 접두 문자열을 그대로 걷어 낸다; U+00A0은 공백이 아니다".

D8. EDGE-CASE-MECHANISM-WRONG — acceptance.md:L142 — "HTML 파서가 첫 줄바꿈을 버리므로" — that drop happens when a `<pre>` start tag is parsed; REQ-003 parses only the inner HTML inside `<template>`, so the newline survives parsing and is removed by trim instead. The outcome is the same; the stated reason is wrong and could mislead an implementer. — Severity: MINOR — Class: optional — Required fix: change the wording to "앞 줄바꿈은 trim으로 사라진다".

D9. SERIALIZATION-OPEN — plan.md:L71 ("`XMLSerializer` … 또는 `svg.outerHTML`"), plan.md:L15 — The two serializers differ (xmlns attributes, escaping of text inside the SVG `<style>`). Plan also calls the return value an `SVGSVGElement` when it is `{ svg, width, height }`. — Severity: MINOR — Class: optional — Required fix: pick one (either works when the result is re-parsed as foreign content) and refer to `result.svg`.

D10. FAILURE-PATH-EDGE — spec.md:L70-71, plan.md:L72 — `renderExportDiagram` can return null without a pele failure (no `<svg>` in the template, exportUtils.ts:L48-49); then the second `renderDiagram` call returns `ok: true` and no line/column exists. The notice behavior is unspecified. — Severity: MINOR — Class: optional — Required fix: add "재호출 결과가 ok이거나 위치가 0이면 접미사 없이 안내".

D11. DOD-AC012-AMBIGUITY — acceptance.md:L155 vs L151 — DoD lists "활성 AC 001~011", but the quality gate requires the Playwright run that implements AC-012's e2e part. It is unclear whether AC-012's e2e part is required to finish the run phase. — Severity: MINOR — Class: optional — Required fix: say "AC-012 e2e 부분은 run 완료 조건, 수동 M-1·M-2는 completed 조건".

D12. HIDDEN-UNTIL-PROCESSED (hypothetical) — spec.md:L64 ("시작·닫는 태그는 원문 그대로") — A page whose CSS hides `.mermaid:not([data-processed])` until mermaid runs would keep the pre-rendered SVG hidden, because the start tag is not given `data-processed`. How common this is was not measured. — Severity: MINOR — Class: optional — Required fix: either add it to limitation 5, or decide to add `data-processed="true"` to the start tag (that would need an REQ-006 exception).

D13. D7-REFS-NOT-FOUND — spec.md:L86, L108, L173; plan.md:L7 — SPEC-SEC-002 and SPEC-PREVIEW-022 are not in this worktree's `.moai/specs/` (they live in parallel worktrees). D7-5 SHOULD. Pre-flight §C step 2 (plan.md:L33) already re-checks `font-src` after merging origin/main. — Severity: MINOR — Class: optional — Required fix: none required; optionally annotate "(병행 worktree, 이 tree에 아직 없음)".

D14. M1-MEASUREMENT-METHOD — plan.md:L56, acceptance.md:L115 — `document.fonts.check('16px Barlow')` returns false for a face that has not started loading, so a check without a preceding load gives a false negative. The weight mapping is also left to M1 (plan.md:L77 "400·600 → 파일 500/700 중"). — Severity: MINOR — Class: optional — Required fix: specify `await document.fonts.load('16px Barlow')` then `check`, plus the inspector's rendered-font readout, and record the weight→file mapping in the M1 table.

D15. IMPL-DETAIL-IN-REQS — spec.md:L57, L63, L81, L92 — REQs name `renderExportDiagram`, `readPeleThemeValues('light')`, `<template>`, `textContent` (RQ-4). This is justified by the binding user decision to reuse the pele path and by the security boundary. AC-005 (acceptance.md:L85) also asserts a plan-only detail ("readPeleThemeValues 1번만 호출") that no REQ states. — Severity: MINOR — Class: optional — Required fix: none required; optionally move the "once per call" rule into REQ-004 so AC-005 traces to a REQ.

## Regression Check (Iteration 2+ only)

N/A — iteration 1.

## Recommendation

FAIL on internal consistency, not on quality: the score (0.84) clears Tier M's 0.80 and all must-pass checks pass. Only one blocking item needs fixing before the re-audit, which can be limited to the defect delta:

1. D1 (BLOCKING): reconcile REQ-006 with REQ-008 (A)/(B). Add the font `<style>` to REQ-006's exceptions, pin its insertion point (last `</body>` in the masked copy outside blocks, else end of string), and change AC-007 so it excludes that style, or runs with font insertion disabled.
2. D2 (SHOULD-FIX, blocking-class but small): decide where the wrapper fallback values come from (tokens vs pele) in REQ-004.
3. Recommended in the same revision (optional): D3 (Windows font gate), D4 (narrow the extraction-equivalence claim and add a limitation), D5 (AC-009 UTF-8 row), D6/D7 (masking order, dedent definition).

The font risk is handled as a run-phase M1 gate. It runs first, writes no production code, records results, and requires coordinator and user sign-off for (C). The main gap is that the gate measures macOS only (D3). The remaining defects are optional wording and precision fixes. An implementer could build the module from plan M2-M5 after D1, D2, D6 and D7 are settled.

Gaps (not observed in this audit): the vitest suite could not run in this worktree (no `node_modules`). The 2행 14열 / no-suffix fixture claims are verified only by reading the fixture sources and the existing assertions at diagramRenderer.test.ts:L279-283. CORS behavior on WKWebView and WebView2 was not measured; M1 is designed to measure it.
