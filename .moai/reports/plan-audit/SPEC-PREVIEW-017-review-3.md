Verdict: PASS
Overall Score: 0.94

# SPEC Review Report: SPEC-PREVIEW-017
Iteration: 3/3 (fresh full audit for the run-phase Plan Audit Gate)
Verdict: PASS
Overall Score: 0.94 (Tier M threshold 0.80; iter1 0.75 -> iter2 0.93 -> iter3 0.94, no regression)

Reasoning context ignored per M1 Context Isolation. Prior reports review-1/review-2 were read for the regression check only; every claim below was re-verified against the files at HEAD f9c94ee (worktree `WT-diagram-tone`) and, for pele facts, by rendering with `node_modules/pele/dist/pele.js` 1.10.0. Audit mode: Claude-only (no `audit_model` key under `.moai/config/`, so no codex/GLM backend call).

Artifacts read (Tier M + extras): spec.md (138 lines), plan.md (113), acceptance.md (113), research.md (113), spec-compact.md (49), progress.md (43). No design.md / tasks.md (by design).

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: REQ-PREVIEW017-001..008 at spec.md:L40, L44, L50, L56, L61, L68, L76, L81 — sequential, no gaps, no duplicates, 3-digit padding consistent.
- [PASS] MP-2 GEARS compliance (requirement layer, spec.md REQ bullets only): every bullet is `The <subject> shall ...` / `shall not ...`, `While ...` (L84) or `When ...` (L85). Examples: L52 "The 모양 기반 톤 shall not 작성자가 ... 덮어쓴다", L65 "shall not `#B78511`·`#96562F`·`#C08A28` 중 하나다". ACs (acceptance.md) are Given/When/Then — correct verification-layer format, not graded here.
- [PASS] MP-3 YAML frontmatter: spec.md:L2-13 has all 12 fields — id, title, version `"0.1.1"` (quoted), status `draft`, created/updated `2026-10-29`, author, priority `Medium`, phase (string), module, lifecycle `spec-anchored`, tags (comma string). No rejected aliases. Extra `tier: M`, `depends_on` are harmless. (The schema SSOT file `.claude/rules/moai/development/spec-frontmatter-schema.md` is absent in this worktree; checked against the 12-field list in the auditor contract.)
- [N/A] MP-4 language neutrality: single-project frontend (TypeScript/CSS) SPEC, no multi-language tooling.
- [PASS] MP-5 D7: references are SPEC-PREVIEW-015 (status `completed`) and SPEC-PREVIEW-016 (status `completed`). Neither retired/superseded/archived; both exist. The 016 amendment is explicit (spec.md:L101-110).
- [PASS] MP-6 D8: `grep -c syscall spec.md` -> `0`. Auto-pass.
- [PASS] MP-7 clarification gate: `grep -rn 'NEEDS CLARIFICATION' .moai/specs/SPEC-PREVIEW-017-diagram-shape-tone/` -> no output (exit 1).

## Required Check 1 — plan.md §A code anchors (verified at HEAD f9c94ee)

| Anchor (plan.md:L13-24) | Observed | Result |
|---|---|---|
| `mdedit-tokens.css:92-124` header 92-100, decls 101-123, 23 | header comment starts L92, `--pele-bg` L101 ... `--pele-font-mono` L123, `}` L124; `grep -c -- '--pele-[a-z0-9-]*:'` -> 23 | exact |
| `index.css:290-300` | `.preview-content .mermaid-container` L290, dark card rule L296-300 (comment L294-295) | exact |
| `mdedit-components.css:289` | `.md-previewpane { ... background: var(--md-bg) ... }` L289; `--md-bg: #f2f2f3` at tokens L17 | exact |
| `diagramRenderer.ts:231-237` `PELE_THEME_VARS` 23 names, only user | L231-237, 23 names; no other `src` user | exact |
| `diagramRenderer.ts:247-264` `readPeleThemeValues` | L247 to `}` L264 | exact |
| `diagramRenderer.ts:268-306` | WARN L268, `resolvePeleVars` L272, `resolveDiagramColors` L296, closing `}` L307 | off by 1 (ok) |
| `exportUtils.ts:32-42` `renderExportDiagram` | L32-42; calls `resolveDiagramColors(svg, values)` L40 | exact |
| `exportUtils.ts:107-113,295-301` | `mermaidBg = '#FAF9F6'` L109, card L113, container rule L295-301 | exact |
| `exportHtml.ts:48,82-93,104-119` | L48, `generateHtmlContent` L82 (uses placeholders L87), `replaceMermaidPlaceholders` L104, `renderExportDiagram` L114 | exact |
| `exportDocx.ts:95,134-136` | `readPeleThemeValues('light')` L95, `renderFenceDiagramPng` L134, call L136 | exact |
| `diagramRenderer.test.ts:123-176` | `EXPECTED_PALETTE` L123, 23-count asserts L149-159, value test L165-176 | exact |
| `exportDiagram.test.ts:36-40,61,288` | comment "23개" L36, `VAR_NAMES` L37-41, mock `readPeleThemeValues` **L62**, guard L288 | off by 1 (ok) |

No anchor is off by more than one line or points at the wrong thing. `git grep -n renderExportDiagram -- src/lib` confirms exactly two call sites (exportHtml.ts:114, exportDocx.ts:136), so the single-injection-point claim holds. `resolveDiagramColors` visits every attribute of every element (diagramRenderer.ts:296-305), so a `var(--pele-…)` injected into a node `g` style before L40 will be literalized — the plan's ordering argument is correct.

pele facts re-verified by rendering a sample flowchart with pele 1.10.0 in this worktree:
- `A([..])` -> `<g class="pele-node pele-shape-stadium">`, `B{..}` -> `pele-shape-diam`, `E((..))` -> `pele-shape-circle`; node `g` carries no `style`; shapes carry `fill="var(--_s)" stroke="var(--_b)"`.
- Author `classDef hot fill:#ffeeee,stroke:#cc0000,stroke-width:3px` + `class B hot` -> polygon `style="fill:#ffeeee;stroke:#cc0000;stroke-width:3px;"` and class `hot` on the `g`; `style A ...` -> inline on A's rect. Confirms author-wins-by-inline-style mechanism.
- Edge label: `<g class="pele-edge-label"><rect ... rx="3" fill="var(--_bg)"/>`; cluster rect `fill="var(--_a)" fill-opacity="0.5" stroke="var(--_b)"`.
- `grep -c pele-decision` in pele.js -> 0. Node shapes carry no `stroke-width` attribute (only edges/clusters/icons do), so the inherited `stroke-width: 1.5px` on the stadium `g` will reach the shape.
- WCAG/HSL recomputed: `#8A6410` vs `#F7F2E7` 4.81, vs `#FAF9F6` 5.10; `#B78511` vs `#F7F2E7` 2.95; `#3A5673` vs `#EEF3F7` 6.81; hue `#8A6410` 41.3°, `#B78511` 41.9° — all match research.md §5.

## Required Check 2 — REQ <-> AC traceability and technique

1:1 confirmed: spec.md:L90-99 and acceptance.md:L5-14 list identical pairs 001..008 with identical technique labels. Every AC is binary: literal rgb values (AC-001/002/003/008), bounded grep commands with expected `0` (AC-003/004), unit-parsed counts/sets/contrast/hue (AC-005), string checks on three export paths plus empty-table fallback path (AC-006). jsdom/Playwright split (acceptance.md:L16) is sound: cascade/inheritance outcomes (preview) go to webkit e2e; export literal output goes to jsdom strings. Referenced existing guards exist: `src/test/PreviewRenderer.test.tsx` theme toggles (L248-289), `src/test/export.test.ts` L161-180 (bg `#FAF9F6` both themes, dark border/radius, **and** light no-border/no-radius at L176-180), `e2e/diagram-export-colors.spec.ts:161-163` (export-side light 0px).

## Required Check 3 — internal contradictions

- Token count 23 -> 24: consistent in spec.md:L106, plan.md:L73/L76/L88/L92, acceptance.md:L55/L71, compact L24-25/L39-41. No document claims a different total.
- Light container background: spec.md REQ-008 L84 (bg only, no border/radius), Out of Scope L128, plan.md:L34/L81/L106, acceptance.md AC-008 L86, research.md §8 L99, compact L14/L49 — all agree on solution (a). Option (b) appears only as rejected in research.md:L83/L100. Export bg constant unchanged everywhere.
- `!important` prohibition: spec.md:L54, plan.md §D L46 / §G L102, acceptance.md AC-003 L41-42 — consistent; current `grep -c '!important' src/lib/export/exportUtils.ts` -> 0.
- circle exclusion: spec.md:L47, L116; research.md §7.1; AC-002 asserts circle keeps default; compact L33/L46 — consistent.
- Only stale fact: "node_modules 없음" (plan.md:L7, L40; compact L3; progress.md:L18). `node_modules` now exists in the worktree (gitignored; `pele` loadable). Harmless — `npm ci` still yields a clean install — see D3.

## Required Check 4 — 016 amendment table vs plan M4

spec.md:L103-108 rows: (1) REQ-016-002 value table + `--pele-decision-border`; (2) AC-016-002 "고정 23개 토큰 기준" (verified at 016 acceptance.md:L27) and compact L34 "23값" (verified) -> 24; AC-016-001 count only in tests (verified: no "23" in 016 AC-001 text); (3) REQ-016-005 light clause background amendment (verified text at 016 spec.md:L63-64); (4) REQ-016-004/007/008 and 015 AC-004/AC-020 retained. plan.md:L92 lists exactly: REQ-002 table extension, AC-002 23->24, compact :34 23->24, REQ-005 light background. Match, and both restrict the edit to pointers (spec.md:L110, acceptance.md DoD L112).

## Category Scores

| Dimension | Score | Rubric Band | Evidence |
|---|---|---|---|
| Clarity | 0.90 | 0.75-1.0 | Precise literals and selectors (spec.md:L42, L46, L63-65). Minor overreach: REQ-008 L83 says the label box matches "the surface it sits on" universally, but only the container case is specified/tested (D1); L85 is a process obligation phrased as a product REQ (D2). |
| Completeness | 1.0 | 1.0 | HISTORY L20-25, 배경/WHY L29-32, Requirements L38-86, Acceptance pointer L130-132, two+ `### Out of Scope — <topic>` H3 with bullets L114-128; HOW in plan.md; 12 frontmatter fields. |
| Testability | 0.90 | 0.75-1.0 | All ACs binary with literal values/commands. Minor fragility: the `!important`/`data-id` grep counts will also hit comments placed inside the marked block or anywhere in exportUtils.ts (D4); AC-004 export-side selector check is code-review evidence (acceptance.md:L48). |
| Traceability | 1.0 | 1.0 | 8 REQ <-> 8 AC, identical tables spec.md:L90-99 / acceptance.md:L5-14; no orphans. |

## Defects Found (structured defect-list)

D1. REQ008-SCOPE — spec.md:L83 — "간선 라벨 바탕 상자 shall 두 테마 모두에서 그 상자가 놓인 표면과 이음매 없이 같은 색" is universal, but a label inside a subgraph sits on the cluster rect (`fill="var(--_a)" fill-opacity="0.5"`, verified), so it stays slightly different from `#FAF9F6` in both themes (pre-existing pele behavior, untouched by this SPEC). AC-008 (acceptance.md:L87) only checks labels against the container. — Severity: minor — Class: optional — Required fix: scope the bullet to "다이어그램 컨테이너 바탕 위에 놓인 라벨 상자", or add an edge-case line in acceptance.md that in-cluster labels are out of scope.

D2. REQ008-PROCESS-REQ — spec.md:L85 — the `When run 단계가 ... 시작하면, the 구현 shall ... 측정해 기록한다` bullet is a workflow obligation, not product behavior (RQ-3). It is already enforced by AC-008 and DoD #2. — Severity: minor — Class: optional — Required fix: none required; optionally move it to plan.md §C/§E and keep REQ-008 purely behavioral.

D3. STALE-NODE-MODULES — plan.md:L7, L40; spec-compact.md:L3; progress.md:L18 — state the worktree has no `node_modules`; it now exists (gitignored, pele 1.10.0 loadable). — Severity: minor — Class: optional — Required fix: none blocking; run phase may keep `npm ci` (deterministic) and note the fact in progress.md.

D4. GREP-COMMENT-FRAGILITY — acceptance.md:L41-42, L48 — `grep -c '!important'` over all of `exportUtils.ts`, and the BEGIN/END block grep for `!important|nth-|data-id|:has(`, also count comments. plan.md:L67 and mx_plan L96 invite exactly such comments ("`!important` 불필요", "data-id 미사용") at those locations, which would turn a correct implementation into a failing AC. — Severity: minor — Class: optional — Required fix: in run phase keep those words out of comments inside the marked block and in exportUtils.ts (or place the @MX:NOTE above BEGIN), or change the greps to exclude comment lines; record the choice in progress.md.

D5. ANCHOR-OFF-BY-ONE — plan.md:L18, L24 — `diagramRenderer.ts:268-306` ends at L307; `exportDiagram.test.ts:61` mock is at L62. — Severity: minor — Class: optional — Required fix: none (plan.md §C step 3 already says to record re-measured lines in progress.md, not edit the SPEC).

No blocking defects.

## Regression Check (prior iterations)

- review-1 D1-D5 (blocking) — RESOLVED: solution (a) recorded unconditionally (spec.md:L84, L107; plan.md:L34); option (b) only in research.md rejected list (L83, L100); `exportDiagram.test.ts` VAR_NAMES/guard in test inventory (plan.md:L24, L32, L76); REQ-005 hue/contrast/forbidden-color criteria (spec.md:L64-65; AC-005 L57-59); token<->probe sync and fallback-literal guards (spec.md:L73-74; AC-005 L60, AC-006 L70). Re-verified today.
- review-1 D6-D11 — RESOLVED (BEGIN/END markers acceptance.md:L41; 3-tone cap scoped spec.md:L48; AC-001 literal rgb L28; cluster `--_a` 0.5 fact research.md:L44 confirmed by render).
- review-2 N1 (export.test.ts lacks light no-border assertion) — WITHDRAWN, the finding was wrong: export.test.ts:L176-180 asserts the light rule contains neither `#97A4B1` nor `border-radius: 3px`. acceptance.md:L89 is correct as written.
- review-2 N2 (sm-circ/fr-circ "not flowchart shapes") — UNRESOLVED, still optional; scope unaffected (user decision 1).
- review-2 N3 (AC-PREVIEW016-005 pointer) — UNRESOLVED, downgraded: 016 AC-005's light observation is on `getPreviewCss('light')` (export), which this SPEC does not change, so no pointer is strictly needed. Note that 016 REQ-005's light clause ("배경 ... 추가하지 않는다") already conflicts with 016 REQ-006's export background constant — a pre-existing 016 inconsistency outside this SPEC.
- review-2 N4 — carried as D4 (now with the comment-fragility angle).
- review-2 N5 (theme-independent bg also paints error/empty containers in light) — UNRESOLVED, optional; consistent with REQ-008 L84.

No defect has stagnated as blocking across iterations.

## Recommendation

PASS. Rationale per must-pass: MP-1 sequential REQ-001..008 (spec.md:L40-81); MP-2 every REQ bullet uses GEARS Ubiquitous/Unwanted/While/When forms (e.g. L52, L84, L85); MP-3 12 canonical fields with correct types (L2-13); MP-5 referenced SPECs 015/016 are `completed`; MP-6 no `syscall`; MP-7 no clarification markers. All §A anchors verified within one line; the core mechanism (node-`g` private-variable redeclaration, author inline style wins, export injection before `resolveDiagramColors`) is confirmed against actual pele 1.10.0 output and the current renderer code. The optional findings D1-D5 can be absorbed during the run phase; none blocks Implementation Kickoff.
