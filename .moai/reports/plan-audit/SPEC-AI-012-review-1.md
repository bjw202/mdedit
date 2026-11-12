# SPEC Review Report: SPEC-AI-012
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.71 (harmonic mean of 4 dimensions; Tier M PASS threshold 0.80)

Reasoning context ignored per M1 Context Isolation. Inputs read: spec.md, plan.md, acceptance.md (Tier M trio) plus the cited source files in the t4 worktree (HEAD 46616b2).

Short version: the design is sound, the code claims check out, and the scope stays narrow. The SPEC fails on two wording collisions in the language clause that make two acceptance criteria impossible to pass as written, on one undecided behaviour change for recovery re-requests, and on a regression baseline that may compare a value with itself. Each fix is a few lines.

## Must-Pass Results
- [PASS] MP-1 REQ number consistency: REQ-AI12-001..013 run in order with no gaps or duplicates (spec.md:L78-99).
- [PASS] MP-2 EARS format compliance (requirement layer only): Ubiquitous 001-005 (L78-82), Event-driven 006-008 ("…포함하면", "…도착하면", "…발행될 때", L86-88), State-driven 009 ("…동안", L92), Unwanted 010-013 (L96-99). The ACs are Given-When-Then in acceptance.md (verification layer) and were not graded here.
- [PASS] MP-3 YAML frontmatter validity: all 12 canonical fields are present with valid types (spec.md:L2-13). `version: "1.0.0"` is quoted, `status: draft` is in the enum, `priority: High` and `lifecycle: spec-anchored` are valid, `tags` is a comma string, and `tier: M` is present. No rejected aliases.
- [N/A] MP-4 language neutrality: the SPEC covers one Rust/TS project and no multi-language tooling.
- [PASS] MP-5 D7 cross-SPEC: referenced SPEC-AI-001/003/006/008/009/010 all exist; statuses are draft or completed, none retired/superseded/archived. SPEC-AI-013 (spec.md:L113, "카드 t5") does not exist. That is a SHOULD-level note for a future SPEC, not a BLOCKING finding.
- [PASS] MP-6 D8 cross-platform: `syscall` does not appear in any of the three artifacts.
- [PASS] MP-7 clarification gate: `grep '\[NEEDS CLARIFICATION'` on plan.md and acceptance.md returns 0 matches. research.md does not exist (Tier M).

## Category Scores
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 | Two wording collisions in the language clause (D1, D2). The recap tag form and recap diagram-fragment gating are ambiguous (D7, D8). Otherwise every requirement is concrete (spec.md:L78-99, plan.md:L41-59). |
| Completeness | 0.75 | 0.75 | HISTORY, Summary, Background, Decisions, Requirements, Delta, Exclusions, Risks and References are all present. The Out of Scope content exists as `## Exclusions` (spec.md:L111-119) but has no `### Out of Scope — <topic>` H3; `moai spec lint` reports `MissingExclusions` (warning). |
| Testability | 0.50 | 0.50 | AC-AI12-009 and AC-AI12-012 cannot pass against the wording that D5/REQ-005 mandates (D1, D2). AC-002(d) and the AC-008 recap sentence rely on "…뜻" without pinned keywords (D9). The AC-013 baseline may be self-referential (D6). The other ACs are binary. |
| Traceability | 1.0 | 1.0 | Every REQ has at least one AC: 001→AC-001, 002→AC-002/003, 003→AC-003/004, 004→AC-008, 005→AC-009, 006→AC-005/006/007, 007→AC-010/011/014, 008→AC-015, 009→AC-001, 010→AC-012, 011→AC-013, 012→AC-015, 013→AC-016. Every AC cites an existing REQ. Minor sub-clause gaps are in D10. |

## Verified Code Claims (evidence)
- `INLINE_SCOPE` at prompt.rs:31 ends with "결과는 입력 텍스트의 언어를 그대로 유지하라." and is appended after `feature.system_prompt()` at :246 (the SPEC says :245, close enough). Confirmed.
- `AiFeature::resolve` (prompt.rs:66-84) reads `custom_instruction` only under `"custom"`. Preset and diagram re-request instructions are dropped server-side. The bug is confirmed.
- Single-point claim: every `onReRequest(` call site (ai-suggestion-card.ts:308, 323, 406, 426, 512, 1136, 1153) goes through `callbacks.onReRequest`, which is wired once at :1425. The one `fireReRequest(..., { customInstruction: instruction, ... })` is at :1438. Confirmed.
- Preset cards lack `customInstruction`: `buildSelectionRequest` sets it only when `presetKind === 'custom'` (ai-selection-toolbar.ts:204-206). Confirmed. Diagram cards carry `feature: 'diagram'` (presetToFeature, :164-166). AC-015 item 3 is consistent.
- List fallback sends `customInstruction: ''` (ai-suggestion-card.ts:1446-1451). AC-015 item 5 is consistent.
- DIAGRAM snapshot `starts_with` (prompt.rs:886) still holds under the plan.md:L42-46 ordering, because the scope clause comes before the fragment and the fragment comes before the additional instruction. Confirmed, provided the snapshot constant is regenerated with the default tags.
- `system_prompt()` stays unchanged: plan.md:L58 and L158 say so explicitly. Note that the existing continue tests are self-referential (`assert_eq!(…, AiFeature::Continue.system_prompt())`, prompt.rs:766/836), which is why M1 needs literal snapshots (D6).
- The existing tests to update match the plan: aiCardRetryLimit.test.ts:233 and :269, aiCardRerequestProgress.test.ts:119 (plan.md:L130-131). Confirmed.
- `claude_cli.rs` / `codex_cli.rs` are not touched by the design (plan.md:L153). Consistent.

## Defects Found (structured defect-list)
D1. CN-1 contradiction — spec.md:L62 (D5), L82 (REQ-005) vs L96 (REQ-010) and acceptance.md:L91-95 (AC-012). The mandated language clause "사용자 지시나 **추가 지시**가 다른 언어를…" sits in every inline system prompt, but REQ-010 and AC-012 require that the phrase "추가 지시" appear nowhere when no additional instruction exists. As written, AC-012 always fails. — Severity: critical — Class: blocking — Required fix: narrow REQ-010 and AC-012 to the injected label (`추가 지시(재요청)`, plan.md:L46/L57), e.g. "the `추가 지시(재요청)` label does not appear anywhere". Alternatively, reword the D5 clause so it does not contain "추가 지시". Pick one and keep plan.md 4.1 (L104) consistent.

D2. AC untestable as written — acceptance.md:L75 (AC-009) and spec.md:L82 (REQ-005) vs spec.md:L62 (D5). The new conditional sentence "…요구하지 않는 한, 결과는 입력 텍스트의 언어를 그대로 유지하라." contains the forbidden "unconditional" sentence "결과는 입력 텍스트의 언어를 그대로 유지하라." verbatim as a suffix. A substring-absence test fails, and any other reading needs judgement. — Severity: critical — Class: blocking — Required fix: either reword D5 so the old sentence is not a substring (e.g. "…요구하지 않는 한 입력 텍스트의 언어를 유지하라."), or redefine "unconditional" in REQ-005/AC-009 with a precise check (e.g. the old `INLINE_SCOPE` constant string is absent, AND the language sentence is preceded by the "명시적으로 요구하지 않는 한" condition).

D3. Undecided behaviour change — spec.md:L88 (REQ-008), L127 (R3); ai-suggestion-card.ts:406, 426, 512. The error card "다시 시도", intruded card "다시 요청" and "⚡ 고급 모델로 다시 시도" all send `buildRetryInstruction()` = "이전 제안과 다른 방식으로". Today the server drops it on preset cards; after this SPEC it reaches the model as "추가 지시(재요청)". For the error and intruded cases there is no previous suggestion at all, and for ⚡ the user asked for a better model, not a different approach. R3 covers only the generic "프리셋 재요청" and does not decide these recovery paths. — Severity: major — Class: blocking — Required fix: add a decision (D9) stating whether exempt recovery re-requests (error/intruded/⚡) carry an additional instruction. If not, specify the minimal mechanism (e.g. those call sites pass an empty instruction, and `onReRequest` omits `additionalInstruction` when it is empty) and add an AC-015 case. If yes, record the rationale in R3 explicitly. Either way the plan's "1-line change" (plan.md:L69) must reflect the choice.

D4. Out-of-Scope convention — spec.md:L111. `## Exclusions (What NOT to Build)` has good bullets but no `### Out of Scope — <topic>` H3. `moai spec lint` emits `MissingExclusions` (warning, grandfathered). — Severity: minor — Class: optional — Required fix: add an H3 such as `### Out of Scope — transport, model, ghost-text paths` above the existing bullets.

D5. Factual inaccuracy in an assumption — spec.md:L71 (A1). It says request IDs are `ai-${Date.now()}-${random}` from ai-suggestion-card.ts:1357. That holds only for re-requests. Initial requests use `generateRequestId()`, which returns `crypto.randomUUID()` when available (ai-selection-toolbar.ts:275-279). The conclusion still holds (the alnum tail of a UUID varies per request). — Severity: minor — Class: optional — Required fix: correct A1 to cover both ID sources.

D6. Snapshot baseline can be self-referential — acceptance.md:L97-102 (AC-013), plan.md:L77, L167. Existing continue/section tests compare against `AiFeature::Continue.system_prompt()` (prompt.rs:766, 836), which would silently follow any accidental change to `system_prompt()` during the task_text split (plan.md:L58). AC-013 does not require literal strings. — Severity: major — Class: blocking — Required fix: state in AC-013 and M1 that the pre-change snapshots are literal string constants (system_prompt and user_prompt) captured from current code, not values computed by calling `system_prompt()`. Add one literal snapshot for at least one preset's `system_prompt()` to back the PRESERVE claim (plan.md:L158).

D7. Recap tag form is ambiguous — plan.md:L57 vs acceptance.md:L19, L47. The recap names the target tag ("<대상 태그> 안의 텍스트에만…"), but it does not say whether it writes `<T>`, `</T>` or the bare name. AC-005 needs the closing tag exactly once, so the recap must never emit `</T>`. Writing `<T>` puts a second unmatched opening tag after the envelope. — Severity: minor — Class: optional — Required fix: specify that the recap refers to the tag as a bare name or a backticked `<T>` (opening form only), and add "the recap contains no `</T>`" to AC-008.

D8. Recap diagram-fragment gating is ambiguous — plan.md:L57 ("다이어그램 종류 조각(있을 때)") vs L45 ("Diagram + 유효 종류일 때만"). If the recap attaches the fragment for a non-diagram feature that leaked a `diagramType`, the existing `diagram_type_ignored_for_non_diagram_features` (prompt.rs:918-930) breaks. — Severity: minor — Class: optional — Required fix: make the recap use the same gate as the system prompt (Diagram feature AND a known type).

D9. "…뜻" assertions are not pinned — acceptance.md:L27 (AC-002 b/d), L69 (AC-008 "'태그 없이 결과만 출력' 뜻의 문장"). Plan 4.1 (L91) hints at keywords, but the AC itself requires judgement. — Severity: minor — Class: optional — Required fix: pin the test keywords in the ACs (e.g. "읽기 전용", "데이터", "지시가 아니", "태그를 출력하지").

D10. Sub-clause coverage gaps — spec.md:L78 (REQ-001 "대상 블록은 선택이 비어 있어도 항상 존재") has no AC case. REQ-008 (L88) lists 7 re-request kinds, but AC-015 exercises 4 of them plus the fallback. This is acceptable given the verified single wiring point, but "↻ 다시" and ⚡ are untested. — Severity: minor — Class: optional — Required fix: add an empty-selection case to AC-001. Optionally add a ⚡ case to AC-015 (`model === 'sonnet'` and `additionalInstruction` according to the D3 decision).

D11. Mild new instruction-channel path — plan.md:L46, spec.md:L87. Auto-retry error text (`이전 오류: ${outcome.error}`, ai-suggestion-card.ts:1153) is now placed in the system prompt. Mermaid parse errors usually quote the offending line, which comes from model output derived from document data. That runs slightly against the SPEC's own data-vs-instruction goal. — Severity: minor — Class: optional — Required fix: optionally note it in Risks, or place only the error inside the recap rather than the system prompt. No new feature is required.

D12. Lint `MissingDependency` errors — spec.md:L16-21. `moai spec lint` reports "Dependency SPEC SPEC-AI-008/SPEC-AI-010 not found" because those directories carry slug suffixes (`SPEC-AI-008-diagram-type-picker`, `SPEC-AI-010-ai-card-progress-and-insert`). Both exist, so this is a tool path-resolution limitation and not a SPEC defect. — Severity: minor — Class: optional — Required fix: none needed in the SPEC. Record it as a known lint limitation.

## Regression Check
N/A (iteration 1).

## Recommendation
FAIL. The score of 0.71 is below the Tier M threshold of 0.80, and blocking defects D1, D2, D3 and D6 remain. All must-pass criteria pass. Fix list for manager-spec:
1. D1: narrow REQ-010 / AC-012 to the `추가 지시(재요청)` label, or reword the D5 clause.
2. D2: reword the D5 sentence so the old unconditional sentence is not a substring, or define "unconditional" precisely in REQ-005 / AC-009.
3. D3: add decision D9 for the error / intruded / ⚡ re-requests and reflect it in REQ-008, AC-015 and plan.md 2.4.
4. D6: require literal-string pre-change snapshots in AC-013 and M1.
5. Optional: D4 (H3 heading), D5 (A1 wording), D7/D8 (recap form and gating), D9 (pinned keywords), D10 (empty-selection AC), D11 (risk note).

Card coverage is complete: envelope, data declaration, per-request collision names, instruction sandwich, language-clause bug, and both re-request bugs map to REQ-001..008. No over-engineering was found: the collision loop, the single new IPC field and the non-accumulating additional instruction are each the minimal option. Tier M is honest (4 source files plus 3 test files, and an IPC contract change).
