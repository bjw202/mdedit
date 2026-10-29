verdict: PASS-WITH-DEBT

# SPEC Review Report: SPEC-INFRA-002
Iteration: 1/3 of the run-phase Plan Audit Gate (plan-phase history: iter1 FAIL 0.75, iter2 PASS-WITH-DEBT 0.90)
Verdict: PASS-WITH-DEBT
Overall Score: 0.90 (harmonic mean of the four dimensions) — Tier M threshold 0.80
Audited text: SPEC version 0.3.1 (spec.md, plan.md, acceptance.md, spec-compact.md, research.md, interview.md, progress.md)

Reasoning context ignored per M1 Context Isolation.
Cross-model backends: the `moai` MCP server failed to connect in this session, so `audit_multi` / `codex_audit` / `glm_audit` were unavailable. This audit is Claude-only (fail-open).

## Must-Pass Results

- [PASS] MP-1 REQ number consistency — `grep -nE "^#### REQ-" spec.md | wc -l` → 16; headings REQ-INFRA002-001..016 at spec.md:L50-L153, no gaps, no duplicates. `grep -nE "^### AC-" acceptance.md | wc -l` → 16, AC-INFRA002-001..016. A recursive grep over all seven SPEC files for REQ/AC IDs ≥ 017 returned nothing.
- [PASS] MP-2 GEARS compliance (judged against the requirement layer, REQ entries in spec.md only) — every REQ bullet uses `The <subject> shall [not]` or `When …, the <subject> shall`, e.g. spec.md:L52-53 (REQ-001), L76 (REQ-004 `shell: bash`), L83-84 (REQ-005), L124 (REQ-011), L155-156 (REQ-016). The ACs are Given/When/Then, which is the correct verification-layer format and was not graded here.
- [PASS] MP-3 YAML frontmatter — spec.md:L2-13: id, title, version `"0.3.1"` (quoted), status `draft`, created/updated `2026-10-29`, author, priority `High`, phase, module, lifecycle `spec-anchored`, tags (comma string). No rejected aliases. `tier: M` (L14).
- [N/A] MP-4 language neutrality — single-project infra SPEC (Node + Tauri), not multi-language tooling.
- [PASS] MP-5 D7 — the only SPEC ID referenced in spec/plan/acceptance/research is SPEC-INFRA-002 itself (15 hits). No BLOCKING finding.
- [PASS] MP-6 D8 — `grep -c syscall` → 0 in spec.md, plan.md, acceptance.md. Auto-pass.
- [PASS] MP-7 clarification gate — `grep -n '\[NEEDS CLARIFICATION' plan.md research.md` → no matches (exit 1).

## Focus-Area Verification (commands I ran)

### (1) tauri-action exact-SHA pin
- `gh api repos/tauri-apps/tauri-action/commits/1deb371b0cd8bd54025b384f1cd735e725c4060f` → exists, message "Apply Version Updates From Current Changes (#1191)", date 2026-06-29T17:03:57Z.
- `gh api …/git/ref/tags/v1` → `["tag","944946e3e4…"]`; `…/v1.0.0` → `["tag","2d793bf2c8…"]` (annotated tag objects).
- Peeling: `gh api …/git/tags/944946e…` → `["v1","commit","1deb371b…"]`; `…/git/tags/2d793bf…` → `["v1.0.0","commit","1deb371b…"]`. Both tags point to the pinned commit. The statements at spec.md:L124, plan.md:L57 and interview.md:L54 are accurate.
- AC-009 can fail on a wrong implementation. I ran the commands extracted verbatim from acceptance.md against a scratch fixture:
  - correct fixture: 009_1/2/3 → exit 0;
  - pin = tag-object SHA `944946e…` → 009_1 AssertionError and 009_2 exit 1;
  - comment `# v1` → 009_2 exit 1;
  - comment removed → 009_2 exit 1.

### (2) `shell: bash` (REQ-004 L76 → AC-005 L74)
- The correct fixture (job `defaults.run.shell: bash`) passes.
- With `defaults` removed → AssertionError. With one step set to `shell: pwsh` → AssertionError. The AC discriminates both ways.

### (3) Link directions (REQ-005 vs REQ-013)
- The two directions are specified consistently. Release-notes header → `https://github.com/bjw202/mdedit`, with no anchor and no `/releases` (spec.md:L83-84, plan D-8, interview.md:L58). README download section → `…/mdedit/releases` (spec.md:L136, interview.md:L58 last sentence).
- AC-005 (L78) results:
  - `/releases` link → "MISSING README link" and the offending line printed;
  - `#install` link → same;
  - correct link → no output.
- AC-011 (L136) on the current README prints `MISSING https://github.com/bjw202/mdedit/releases`, so a README that links only to the repository root would fail.
- Two gaps were found; see D2 and D3.

### (4) BUILD.md phrase checks (N4/N8) and the `github.token` check (N5)
- AC-011 L140 on the untouched docs/BUILD.md prints MISSING for all 8 phrases (including `main에 이미 병합된 커밋에 태그`, `완전히 끝난 뒤`, `다시 실행`, `ad-hoc`), plus the forbidden lines 23/24/27/30/38/39/50/57 (`git tag v0.9.0`, `gh release create`, `우클릭`, `xattr`).
- All 8 phrases appear contiguously in the plan §G draft (plan.md:L126-L134). Bold markers sit outside the phrases, so `grep -F` matches.
- AC-008 L108: with job-level `env: GH_TOKEN: ${{ github.token }}` injected into `build` → AssertionError. The correct fixture with a step-level `github.token` passes.

### (5) Numbering and stale references
- 16 REQ, 16 AC, IDs 001-016.
- Stale terms (`main 포함`, `자산 확인`, `asset`, `is-ancestor`) appear only in HISTORY rows (spec.md:L24), decision records (plan.md:L18-19), the interview record (interview.md:L43-46) and progress history (progress.md:L15). They also appear in Exclusions, where they state that the removal is deliberate.
- No REQ or AC still requires the deleted guard or the asset-check job.
- spec.md:L249 and plan.md:L147 still cite "Round 1~3" (D4).

### (6) Binding user decisions (interview.md Rounds 1-4)
- Round 1: draft only, user publishes → REQ-003 L67-69. macOS aarch64 + Windows x64 only → REQ-006. No Developer ID signing → Exclusions L198; Round 3 later added ad-hoc signing.
- Round 2: body = fixed guide + generated notes → REQ-005 L82. Tag-version check only, no gates → REQ-002, REQ-006 L95. README + BUILD.md docs → REQ-013/014.
- Round 3: ad-hoc signing, no `xattr` → REQ-007, REQ-013 L139, REQ-014 L145. First release v0.19.0 → phase, REQ-015. No main-origin guard → R-7, Exclusions L217. Asset job removed → Exclusions L218.
- Round 4: SHA pin + `# v1.0.0` → REQ-011 L124. Header link = README root (as corrected) → REQ-005 L83-84. R-8 accepted → spec.md:L233, REQ-014 L144.
- No contradiction found.

### Repository facts re-verified
- Versions: `package.json` 0.19.0, `src-tauri/tauri.conf.json` 0.19.0, `src-tauri/Cargo.toml` `[package]` `version = "0.19.0"`.
- `git tag -l 'v0.19*'` → empty. `git ls-remote --tags origin 'v0.19*'` → empty (exit 0). Local tags run v0.14.0 … v0.18.0.
- `package-lock.json:4930` `"node_modules/js-yaml"` → L4931 `"version": "4.1.1"`. Accurate. `node_modules/` is absent in this worktree.
- `docs/BUILD.md` is 655 lines. `## GitHub Releases로 배포하기` is at L591 and is the last H2, so "591-655행" (spec.md:L252, plan.md:L87/L104) is accurate. The `awk` from-heading-to-EOF scope in AC-011 is correct.
- `README.md` H2 headings: L13, L29, L48, L62 `## 빠른 시작 (개발 환경)`, L98, L111, L127. Plan M3 "before 빠른 시작" is consistent. The SPEC cites no README line numbers.
- `CHANGELOG.md`: L5 `## [Unreleased]`, L7 `## [0.19.0] - 2026-10-29`. REQ-015 is accurate.
- vitest: vite.config.ts L38-42 sets `exclude` but no `include`, so the default pattern collects `scripts/*.test.mjs`. AC-001 and AC-012 can see the new test.

### Automatic ACs on the untouched repository

| AC | Untouched repo | Can fail on a wrong implementation? |
|----|----------------|-------------------------------------|
| 001, 002 | Fail — test file absent (vitest "No test files found"; inferred, not run, no `node_modules`) | Yes |
| 003 | Fail — ENOENT (actionlint not installed: `which actionlint` → not found) | Yes (mutation-verified for js-yaml parts) |
| 004 | Fail — ENOENT | Yes (`-f draft=true` mutation → AssertionError) |
| 005 | Fail — ENOENT / MISSING | Yes (shell and link mutations) — see D2/D3 |
| 006 | Fail — ENOENT | Yes (by assertion construction; not mutated) |
| 007 | Fail — ran it: `TypeError: Cannot read properties of undefined (reading 'signingIdentity')` | Yes |
| 008 | Fail — ENOENT | Yes (job-env token mutation) |
| 009 | Fail — ENOENT | Yes (SHA/comment mutations) |
| 010 | **Pass** — `git diff --stat 061e828 -- .github/workflows/frontend-gates.yml` → empty | Yes, if frontend-gates.yml is edited |
| 011 | Fail — README 7 MISSING, BUILD.md 8 MISSING + 8 forbidden lines, CHANGELOG `[0.19.0]` count 0 (≠1). The `[Unreleased]` sub-check passes (0) | Yes |
| 012 | **Pass by construction** (baseline + 0 new tests) — not executed, no `node_modules` | Yes, on any regression |

The claim in the brief, that acceptance.md names AC-010 as the only AC that cannot fail on the untouched repository, does not match the current file. No such sentence exists (searched for "유일", "only" and similar phrasing). What acceptance.md:L10 actually says is broader and partly wrong: "워크플로 파일이 없는 지금의 저장소에서는 모두 실패한다(ENOENT)". The real picture: AC-010 and AC-012 pass on the untouched repository by design (both are regression guards), and AC-007 fails with a TypeError rather than ENOENT. See D1.

## Category Scores (rubric-anchored)

| Dimension | Score | Band | Evidence |
|-----------|-------|------|----------|
| Clarity | 0.85 | 0.75–1.0 | REQs are unambiguous (spec.md:L52-156). The general exit-code rule at acceptance.md:L10 contradicts the actual pass criterion of grep-based checks (D1). Stale round references (D4). |
| Completeness | 0.95 | 1.0 (minor) | All sections present: HISTORY L19, Overview L28, Requirements L46, REQ-AC table L158, edge cases L181, Exclusions with 5 `### Out of Scope —` H3s L196-220, risks L222, MX plan L236. 12 frontmatter fields present. |
| Testability | 0.88 | 0.75–1.0 | Every automatic AC has a command. 21 static sub-checks pass on a correct fixture, and every mutation I tried was caught. Gaps: the anchor check misses anchors on deeper paths (D2), a trailing-slash link is falsely rejected (D3), exit-code semantics are inverted for "→ 출력 없음" checks (D1). actionlint, AC-001/002 and AC-012 were not executed (tooling absent). |
| Traceability | 0.95 | 1.0 (minor) | The REQ-AC table at spec.md:L160-177 maps all 16 REQs. Every AC cites existing REQs. The per-step token clause of REQ-008 (L110) is only partly enforced (D6). |

Harmonic mean = 4 / (1/0.85 + 1/0.95 + 1/0.88 + 1/0.95) = 0.905 → 0.90 ≥ 0.80.

## Defects Found (structured defect-list)

D1. EXITCODE-RULE-WRONG — acceptance.md:L10 (also L8 context; affects L61, L78, L110, L136, L140) — Severity: SHOULD-FIX (major) — Class: optional (non-blocking; each affected Then states "→ 출력 없음 / → 정확히 … 한 줄").
- Evidence: L10 says every command exits 1 on mismatch and that all fail with ENOENT on the current repo. Measured: AC-005 L78 on the correct fixture gave exit=1 with empty output (pass), and on the wrong `/releases` fixture gave exit=0 with output (fail). The exit code is inverted relative to L10's rule. AC-007 fails with a TypeError, not ENOENT. AC-010 and AC-012 pass on the untouched repo.
- Risk: a run-phase agent applying L10 literally would score these checks backwards.
- Fix: Rewrite L10 to say:
  - the pass criterion is the expectation after "→" on each command line, or exit 0 for `node -e` assertions;
  - grep-loop checks pass on empty output regardless of exit code;
  - AC-010 and AC-012 are regression guards that already pass on the untouched repo;
  - AC-007 fails with a TypeError there.

D2. ANCHOR-CHECK-SHALLOW — acceptance.md:L78 vs spec.md:L84 — Severity: MINOR — Class: optional.
- Evidence: a header containing the correct bare link plus `https://github.com/bjw202/mdedit/blob/HEAD/README.md#install` passed AC-005 (empty output). REQ-005 L84 forbids any `#…` anchor in the block's links. The negative regex `mdedit(/releases|/?#)` only catches an anchor directly after `mdedit`.
- Fix: replace the negative grep with `grep -nE 'github\.com/bjw202/mdedit(/releases|[^ )>"]*#)' "$f"`.

D3. TRAILING-SLASH-FALSE-FAIL — acceptance.md:L78 vs spec.md:L83 — Severity: MINOR — Class: optional.
- Evidence: `(https://github.com/bjw202/mdedit/)` produced "MISSING README link". That link opens the README, so it satisfies REQ-005's intent.
- Fix: either allow an optional `/` in the positive regex (`mdedit/?([])>[:space:]"]|$)`), or state in REQ-005 that the URL is written exactly without a trailing slash.

D4. STALE-ROUND-REFS — spec.md:L249, plan.md:L147 — Severity: MINOR — Class: optional.
- Evidence: both still read "`interview.md` (Round 1~3)" and list only the iter1 audit report. Round 4 (interview.md:L49-63) carries the binding SHA-pin, link and R-8 decisions; iter2 is the report the 0.3.x debt fixes answer.
- Fix: change both to "Round 1~4" and add `.moai/reports/plan-audit/SPEC-INFRA-002-iter2.md`.

D5. INTERVIEW-HEADER-COUNT — interview.md:L3, L68 — Severity: MINOR — Class: optional.
- Evidence: the header says the interview ran in "두 차례" and the closing line says "두 라운드 뒤", while the file records four rounds (L69 "Rounds completed: 4").
- Fix: add a clause noting that Rounds 3-4 followed the audits.

D6. PER-STEP-TOKEN-PARTIAL — spec.md:L110 → acceptance.md:L108 — Severity: MINOR — Class: optional.
- Evidence: REQ-008 requires the token to reach only the steps that need it (the API calls and the build action). AC-008 checks only that workflow-level and job-level `env` contain no token. A token added to the `npm ci` step's env would pass (by inspection of the assertion; not mutated).
- Fix: add an assertion that every step whose `env` matches `/secrets\.|github\.token/` either has `gh api` in `run` or `uses` tauri-action.

## Regression Check (vs iter2 debt N1-N9)

- N1 WIN-SHELL — RESOLVED: spec.md:L76, acceptance.md:L74. Mutation-verified (no defaults, pwsh step).
- N2 RACE-WINDOW — RESOLVED: spec.md:L233 says the window is the whole build step; user acceptance recorded at interview.md:L60-61.
- N3 SHA-NOT-TIED — RESOLVED: the exact-SHA allowlist plus comment grep (acceptance.md:L119-121); `gh api` peeling confirmed. Tag-object SHA mutation fails.
- N4 BUILD-MAIN-WEAK — RESOLVED: the fixed phrase `main에 이미 병합된 커밋에 태그` (L140); fails on the current BUILD.md.
- N5 ENV-GITHUB-TOKEN — RESOLVED: `/secrets\.|github\.token/` (L108). Mutation-verified.
- N6 STALE-TEXT — RESOLVED for progress.md:L5/L7 and plan §G L123. A new instance remains at spec.md:L249 and plan.md:L147 (D4).
- N7 AC001-LINECOUNT — RESOLVED: `grep -oE … | sort -u | wc -l` → 3 (L28).
- N8 LOCAL-BUILD-SIGNING — RESOLVED: REQ-014 L147, AC-011 phrase `ad-hoc`, plan §G L132.
- N9 W-VAR-SCOPE — RESOLVED: L8, and every js-yaml command defines `W` inline. The extracted commands ran standalone.

No defect has persisted unchanged across iterations, and there is no score regression (0.75 → 0.90 → 0.90), so no STOP signal.

## Gaps (not observed in this audit)

- actionlint was not run: `which actionlint` returned nothing. AC-003's first sub-check is unverified until run phase.
- AC-001, AC-002 and AC-012 were not executed: there is no `node_modules` in the worktree, and I did not run `npm ci` so as to create nothing in the repository. js-yaml 4.1.1 was installed only in the session scratchpad, to run the static ACs.
- AC-006 and AC-004's second and third sub-checks were run only against the correct fixture, not mutated.
- The local `origin/main` was not fetched. The merge-base resolved to 061e828, while plan.md:L7 says origin/main has moved to 97b7db5.
- The manual ACs (013-016) depend on runner, GitHub and device behaviour and cannot be verified at plan time.

## Recommendation

PASS-WITH-DEBT: implementation may proceed. All seven must-pass criteria hold:
- REQ/AC numbering is 16/16 contiguous;
- every REQ is in GEARS form;
- the frontmatter has all 12 fields;
- there is no D7/D8/MP-7 finding;
- the score of 0.90 clears the 0.80 threshold.

Everything the brief asked me to focus on was verified with commands I ran:
- the SHA pin and its tag peeling;
- `shell: bash` enforcement;
- the two link directions;
- the BUILD.md phrase checks and the `github.token` check;
- numbering;
- agreement with the user's Round 1-4 decisions.

The debt is optional, and the fixes are cheapest if made before run:
1. D1 — rewrite acceptance.md:L10 so the run-phase agent judges grep-based checks by output, not exit code. This is the one item that could cause a wrong self-verification verdict.
2. D2 and D3 — tighten the AC-005 link regexes (one line each).
3. D4 and D5 — update the stale round references.
4. D6 — optionally add a step-level token assertion.
