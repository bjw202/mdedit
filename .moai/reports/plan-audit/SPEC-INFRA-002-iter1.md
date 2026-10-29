# SPEC Review Report: SPEC-INFRA-002
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.75 (harmonic mean) — Tier M PASS threshold 0.80

Reasoning context ignored per M1 Context Isolation. Audit mode: Claude-only. The MCP audit backends (`mcp__moai__*`) failed to connect this session, so the fail-open path applied and no codex/GLM second opinion exists.

## Plain-language summary

The plan is mostly sound. The workflow shape (check versions, create one draft, build two platforms, upload to that draft) follows Tauri's official pattern, and the tag/version check is designed so it can be tested without pushing a real tag. Four things block it:

1. Two user decisions are still open (`[NEEDS CLARIFICATION]` markers in plan.md and research.md).
2. The SPEC has 17 requirements, but Tier M allows at most 16.
3. The automated check for "the release stays a draft" would pass even if the workflow published the release.
4. I found strong evidence that an unsigned Mac build will show "damaged" rather than "Open Anyway". The planned README instructions would then be wrong, so the macOS signing decision has to be made before implementation, not after the first real release.

The REQ-003 "tag must be on main" check also goes beyond the user's binding instruction ("tag/version consistency check only"). Cutting it fixes the requirement-count overflow as well.

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: The headings run REQ-INFRA002-001 (spec.md:L48) through REQ-INFRA002-017 (spec.md:L147) with no gap and no duplicate, using 3-digit padding. The ACs (AC-INFRA002-001..014) also have no gaps. They appear out of order in acceptance.md (014 at L118 comes before 010 at L126), which is a minor issue.
- [PASS] MP-2 GEARS compliance (judged on the requirement layer, spec.md REQ entries only): every REQ bullet uses `The <subject> shall`, `When …, the <subject> shall`, `While …` (spec.md:L100), or `shall not` (e.g. L51, L71, L77, L93, L108, L113, L126). Given-When-Then ACs in acceptance.md were not graded here.
- [PASS] MP-3 YAML frontmatter: spec.md:L2-L13 has all 12 canonical fields. `id: SPEC-INFRA-002` matches `^SPEC-[A-Z][A-Z0-9]+-[0-9]{3}$`, `version: "0.1.0"` is quoted, `status: draft` and `priority: High` are in their enums, the dates are ISO, `lifecycle: spec-anchored`, and `tags` is a comma string. No rejected aliases appear. `tier: M` (L14) is a valid optional field. I checked against the primary-checkout SSOT `.claude/rules/moai/development/spec-frontmatter-schema.md`.
- [N/A] MP-4 language neutrality: this is a CI/release SPEC for one repo, not multi-language tooling.
- [PASS] MP-5 D7 cross-SPEC: the only SPEC-ID referenced in any artifact is SPEC-INFRA-002 itself, so the check produces no BLOCKING finding.
- [PASS] MP-6 D8: `grep -c syscall spec.md` returned 0.
- [FAIL] MP-7 clarification gate: `grep -rn 'NEEDS CLARIFICATION'` matched plan.md:L15 (D-1 macOS ad-hoc signing / xattr), plan.md:L23 (D-2 first release version), and research.md:L83 (D-1). The orchestrator must resolve these through AskUserQuestion before Implementation Kickoff Approval. The markers are correctly confined to plan.md and research.md (none in spec.md or acceptance.md).

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.80 | 0.75 | Requirements are mostly unambiguous. Contradictions: REQ-005 "shall not modify existing release" (L77) vs the rerun row reusing the existing draft (L186); R-5 "official-org actions only" (L222) vs third-party `dtolnay`/`Swatinem` in plan.md:L58. REQ-001 uses GitHub glob notation without saying so (L50). The scope of REQ-014's negative clause is unclear (L135). `phase: "v0.19.1 target"` (L10) contradicts plan.md D-2's recommendation of v0.19.0 (plan.md:L26). |
| Completeness | 0.75 | 0.75 | All sections are present, including 5 `### Out of Scope —` H3s with bullets (L190-L212), and the requested edge cases are covered (L178-L186). Missing: publish-then-rerun, token exposure to `npm ci` lifecycle scripts, and a macOS "damaged" path for README guidance. |
| Testability | 0.60 | 0.50 | AC-004 cannot detect the core violation (D3). AC-009 checks strings that already exist in the unmodified files (D5). Then-clauses in AC-003/005/006/007 have no command behind them (D6). The AC-001 main-origin case tests only a message formatter (D4). The automatic/manual split is honest: no automatic AC needs a tag push. |
| Traceability | 0.90 | 1.0→0.75 | The REQ→AC table (spec.md:L154-L172) covers all 17 REQs. Every AC cites existing REQs. spec-compact.md (17/14) and plan.md §H agree. One latent break: REQ-016/AC-009 fix the CHANGELOG entry to `[Unreleased]`, which the D-2 = v0.19.0 option invalidates (D9). |

Harmonic mean = 4 / (1/0.80 + 1/0.75 + 1/0.60 + 1/0.90) = 0.746, below 0.80 (Tier M, spec-workflow.md § SPEC Complexity Tier).

## Defects Found (structured defect-list)

D1. MP7-CLARIFY — plan.md:L15, L23; research.md:L83 — Unresolved `[NEEDS CLARIFICATION]` markers for D-1 and D-2. D-3 (plan.md:L28) is also an open user decision but has no marker. — Severity: critical (BLOCKING) — Class: blocking — Required fix: The orchestrator resolves D-1, D-2 and D-3 through AskUserQuestion (see "Decisions the user must make"). manager-spec then removes the markers and writes the answers into plan.md §B, and also into spec.md where they change requirements (D-1 → README guidance and the conditional `tauri.conf.json` row; D-2 → `phase`, REQ-016).

D2. TIER-REQ-CEILING — spec.md:L23, L44-L150 — There are 17 REQs. Tier M allows at most 16 (`.claude/rules/moai/workflow/spec-workflow.md` REQ/AC budget table: "M | 16 | 16"; the ceilings are independent). — Severity: BLOCKING — Class: blocking — Required fix: Drop REQ-INFRA002-003 (see D7; it also fixes the scope-fidelity issue) and renumber 004→003 … 017→016 in spec.md, the REQ-AC table, acceptance.md headers, spec-compact.md and the HISTORY count. Alternative: merge REQ-010 into REQ-009, or REQ-016 into REQ-015.

D3. AC004-DRAFT-UNDETECTABLE — acceptance.md:L56-L57 — The draft guarantee is enforced by the create job's `POST /releases` body (`draft: true`, plan.md:L48). AC-004 asserts only that `draft…false` is absent and that `releaseDraft: true` is present. I read the tauri-action v1 source (`src/index.ts` at tag v1, L99-L129): when `releaseId` is given, `releaseDraft` is never consulted, because draft status is used only on the `tagName` create path. If the create step omitted the `draft` field, the REST default `draft=false` would publish the release, and every AC-004 command would still pass. — Severity: BLOCKING — Class: blocking — Required fix: Add a positive assertion on the create call, e.g. `grep -nE "draft[\"']?[:=] *true|-F *draft=true|-f *draft=true" .github/workflows/release.yml` → ≥1 match inside the create job. Also add `grep -n "make_latest" … → 0`, which is already in the regex. Either drop `releaseDraft: true` from the expected set, since it does nothing under `releaseId`, or keep it as harmless and stop counting it as evidence for REQ-004.

D4. AC001-MAIN-CHECK-UNTESTED — acceptance.md:L21-L23, L129 — The REQ-003 unit case tests only that a "not on main" verdict produces a message containing the SHA. The `git merge-base --is-ancestor` logic is never exercised, and the only negative rehearsal (AC-010) tags `origin/main`, which is on main. So no AC, automatic or manual, verifies REQ-003's actual behaviour. — Severity: SHOULD-FIX — Class: blocking (moot if D7 cuts REQ-003) — Required fix: If REQ-003 stays, add a manual rehearsal case that tags a non-main commit (e.g. a throwaway branch commit) and expects failure with the SHA, or make the ancestry decision a pure function over injected `git` output and unit-test both branches.

D5. AC009-NON-DISCRIMINATING — acceptance.md:L104-L116 — On the current, unmodified tree, `.dmg` and `-setup.exe` already occur in README.md (L79-L80, the developer build section), and `git push origin v` (BUILD.md:L613) and `Publish` (BUILD.md:L631) already occur in docs/BUILD.md. Four of the seven assertions therefore pass with zero work. The BUILD.md checks run over the whole file, not over "the section". — Severity: SHOULD-FIX — Class: blocking — Required fix: Scope the checks to the new section, e.g. `awk '/^## 설치 파일 내려받기/{f=1;next}/^## /{f=0}f' README.md | grep -c '_aarch64.dmg'`. For BUILD.md, extract from `## GitHub Releases로 배포하기` to EOF and assert strings that do not exist today (`releaseDraft`/`초안`, `release.yml`, `git push --delete origin`), plus the absence of `v0.9.0` and of the right-click "열기" method (plan.md:L98 already plans to remove both).

D6. STATIC-THEN-UNASSERTED — acceptance.md:L43-L48, L63-L71, L77, L90 — Several Then clauses have no judging command. AC-003: no command checks that `on:` has only `push`, that the tags filter has exactly one value, or the `needs` chain. AC-005: no command checks that the matrix has exactly 2 entries, and the single alternation grep at L70 cannot show that all three patterns appear. AC-006: no command checks top-level `contents: read`. AC-007: no command checks `node-version: '24'`. The REQ-AC table claims "정적(YAML 파싱)" (spec.md:L156) but no parse command exists. — Severity: SHOULD-FIX — Class: blocking — Required fix: Add one command per Then clause, e.g. separate `grep -c` for each of `_aarch64\.dmg`, `-setup\.exe`, `\.msi`; `grep -n "needs: *\[\?version-check" …`; `grep -n "node-version: '24'"`; a top-level permissions check bounded with awk before `jobs:`. Or state explicitly that actionlint plus human review covers those clauses, and drop "YAML 파싱".

D7. SCOPE-REQ003 — spec.md:L61-L64; interview.md:L21-L22 — The binding interview answer to "빌드 전 검증 범위는?" was "태그-버전 일치 검사만". REQ-003 adds a second pre-build gate, and plan.md:L30 admits it was not requested. Its premise is also only a proxy: being on main does not prove `frontend-gates.yml` passed for that commit. Cost: 1 REQ, 1 git call, 1 unit case, an ancestry dependency on `origin/main` refs in the runner, and a manual case it still lacks (D4). — Severity: SHOULD-FIX — Class: blocking (it conflicts with a binding decision) — Required fix: Cut REQ-003 and its AC-001 case. Keep the safeguard as a documented procedure step in REQ-015 ("main에 병합된 커밋에 태그를 단다", already in the L139 sequence). Keep it only if the user explicitly answers D-3 with "keep".

D8. MACOS-DAMAGED-EVIDENCE — spec.md:L133, L149, L218; plan.md:L17-L19 — The SPEC defers D-1 to a post-merge rehearsal and makes "그래도 열기" the primary README guidance. Evidence I gathered: (a) I downloaded the only published asset, `mdedit_0.14.0_aarch64.dmg`, and ran `codesign -dv` on its `mdedit.app`: `flags=0x20002(adhoc,linker-signed)`, `Signature=adhoc`, `Info.plist=not bound`, `Sealed Resources=none`. `codesign --verify --deep --strict` reports "code has no resources but signature indicates they must be present". The bundle carries only the linker's ad-hoc signature and no bundle seal. (b) https://v2.tauri.app/distribute/sign/macos/ (fetched) says code signing is required "to prevent a warning that your application is broken and can not be started, when downloaded from the browser" and that ad-hoc signing "is useful on ARM (Apple Silicon) devices, where code-signing is required for all apps from the Internet". A CI build with the same config (no `signingIdentity`) is very likely to produce the same unsealed bundle. That is an inference: no CI build exists yet. If the app shows "damaged", the README's "그래도 열기" path may not be offered at all, so REQ-014's guidance and REQ-017 would both fail on the first real release. — Severity: SHOULD-FIX — Class: blocking — Required fix: Resolve D-1 before run. Recommended: move `bundle.macOS.signingIdentity: "-"` from [CONDITIONAL] M4 into M2 as a planned change (subject to user approval), and add a static AC (`grep -n '"signingIdentity": "-"' src-tauri/tauri.conf.json`).

D9. D2-CHANGELOG-COUPLING — spec.md:L10, L145; acceptance.md:L116; plan.md:L25-L26 — REQ-016 and AC-009 require the entry under `[Unreleased]`, while the recommended D-2 answer (v0.19.0) means the change ships in the already-dated `## [0.19.0] - 2026-10-29` (CHANGELOG.md:L7). `phase: "v0.19.1 target"` encodes the non-recommended option. — Severity: SHOULD-FIX — Class: blocking — Required fix: After D-2, make REQ-016 name the target section explicitly (`[0.19.0]` or `[Unreleased]`→`[0.19.1]`), update the AC-009 awk anchor to match, and set `phase` to the chosen release.

D10. RERUN-CAN-MODIFY-PUBLISHED — spec.md:L77, L186 — REQ-005 says the workflow shall not modify an existing release. The edge-case row says "Re-run failed jobs" reuses the existing draft id. I read tauri-action `src/upload-release-assets.ts` (dev branch): before uploading, it calls `deleteReleaseAsset` for any same-named asset on the target release. If the user publishes a partial draft and then re-runs the failed build job, the build uploads to, and deletes assets on, a published release. That contradicts REQ-005 and the safety intent. The claim that re-runs reuse the successful job's output is also not established by the GitHub re-run docs I fetched, which document only that re-runs keep the same `GITHUB_SHA`/`GITHUB_REF` and the original actor's privileges. — Severity: SHOULD-FIX — Class: blocking (internal consistency) — Required fix: Either add a pre-upload step in the build job that fails unless `GET /releases/{id}` shows `draft == true`, or reword REQ-005 to exempt the draft created by the same run, and document in BUILD.md "do not re-run after publishing; delete draft and tag, then retag". Mark the rerun row as unverified until the rehearsal confirms it.

D11. TOKEN-EXPOSURE-CHECKOUT — plan.md:L41, L56-L60; spec.md:L222 — The build job holds `contents: write` and runs `npm ci` (dependency lifecycle scripts). `actions/checkout` persists the token into `.git/config` by default (`persist-credentials` default true), so any install script could read a release-writing token. R-5 also claims "공식 조직 액션만 사용" while plan.md:L58 uses third-party `dtolnay/rust-toolchain@stable` and `Swatinem/rust-cache@v2` inside that write-scoped job. — Severity: SHOULD-FIX — Class: blocking (R-5 contradicts the plan) — Required fix: Require `persist-credentials: false` on checkout in write-scoped jobs, pass `GITHUB_TOKEN` only as step-level `env` on the tauri-action and `gh api` steps (never job-level), and correct R-5 to name the third-party actions as an accepted risk. Optionally run `npm ci --ignore-scripts` if the build allows it (verify in run).

D12. ASSET-CHECK-OPTIONAL — spec.md:L95-L100; plan.md:L44 — The asset-check job was not requested. It adds 1 job, 1 more `contents: write` token, 4 REQ clauses and part of AC-005. A failed platform build already turns the run red, and the user reviews the draft by hand before publishing. Its unique value is catching silent name drift (R-2). — Severity: MINOR — Class: optional — Required fix: The orchestrator decides. Leaning simpler: cut the job and keep only REQ-008's exclusion clause (no Linux/Intel assets), which the matrix definition (AC-005) already enforces.

D13. TAURISCRIPT-PREMISE-FALSE — research.md:L33; plan.md:L59 — The research says the default `tauriScript` "may fail" because there is no `tauri` npm script. The tauri-action v1 `src/runner.ts` (identical on tag v1 and dev) shows that with `@tauri-apps/cli` in package.json (package.json:L44 `"@tauri-apps/cli": "^2"`) and npm, the runner uses `npm exec tauri` when no `tauri` script exists. The default works. — Severity: MINOR — Class: optional — Required fix: Correct research.md §2. Either drop `tauriScript` (simpler) or keep `npx tauri` with an accurate rationale.

D14. VERSION-REGEX-CASE — acceptance.md:L15-L17; spec.md:L50, L57 — REQ-001 is written in GitHub filter-glob syntax, where `.` is literal. A script that reuses that string as a regex would accept `v0x19x0`. No AC case catches an unescaped dot. — Severity: MINOR — Class: optional — Required fix: Label REQ-001's pattern as "GitHub 태그 필터 패턴", and add a rejection case such as `v0x19x0` or `v0.19.0.1` to AC-001.

D15. AC008-BASE — acceptance.md:L99 — `git diff --stat origin/main -- …frontend-gates.yml` reports a false diff if another PR changes that file on main before this branch merges. — Severity: MINOR — Class: optional — Required fix: Compare against the merge-base: `git diff --stat "$(git merge-base origin/main HEAD)" -- .github/workflows/frontend-gates.yml`.

D16. UNCOVERED-CLAUSES — spec.md:L83, L135, L139 — Some clauses have no AC at all: the header block content (REQ-006 L83, statically greppable in `.github/release-notes-header.md`), the README negative clause (REQ-014 L135), and BUILD.md's cleanup procedure (REQ-015 L139). REQ-014 L135 is also ambiguous, because README's existing developer "배포 빌드" section legitimately lists Linux outputs (README.md:L82). — Severity: MINOR — Class: optional — Required fix: Scope L135 to the new download section and add greps for the header file's three filename patterns and for `git push --delete origin` in BUILD.md.

D17. STALE-BASELINE — plan.md:L7; research.md:L3 — "기준 커밋 061e828(origin/main)". origin/main is now 97b7db5 (#81, harness churn). `git diff --stat HEAD origin/main -- .github README.md docs/BUILD.md CHANGELOG.md package.json src-tauri scripts vite.config.ts` is empty, so no target file is affected. — Severity: MINOR — Class: optional — Required fix: Note the new base, and rebase or merge origin/main at run start.

D18. KOREAN-CALQUES — spec.md:L61 "main 기원 확인", acceptance.md:L126/L133 "음성/양성 리허설", spec.md:L115 "비취소 동시성" — These are English-mapped terms (origin / negative-positive / non-cancel). The user-facing labels that will go into README ("설치 파일 내려받기", "개인정보 보호 및 보안", "그래도 열기") read naturally. — Severity: MINOR — Class: optional — Required fix: Use "main 포함 여부 확인", "실패 경로 리허설 / 정상 경로 리허설", and "태그별 동시성(진행 중 취소 안 함)".

D19. PROGRESS-E1-OWNER — progress.md:L14 — §E.1 says the orchestrator writes it after user approval. The schema (spec-frontmatter-schema.md progress.md Section Map) assigns §E.1 `plan_status: audit-ready` to manager-spec in the plan phase. — Severity: MINOR — Class: optional — Required fix: manager-spec writes `plan_status: audit-ready` with a timestamp when the plan is ready for audit.

## Attack-point findings (A–G)

**A. Scope fidelity.** Added moving parts beyond the request: 2 jobs (create-release, asset-check), 1 ancestry gate, and 1 previous-tag function.
- create-release job: **keep.** It is justified by the official tauri-action example `publish-to-manual-release.yml` (single creator, matrix uploads via `releaseId`). It is also the only place to prepend the header block and set `previous_tag_name` without a matrix race.
- previous-tag computation: **keep.** It is about 10 lines of pure function plus 3 tests. The GitHub REST docs describe `previous_tag_name` only as "Use to manually specify the range" and never document the default start (verified in the fetched docs). The repo has published releases only at v0.14.0 (`gh release list`: v0.14.0 Latest, v0.13.2 Draft), so leaving the default is a real risk.
- REQ-003: **cut** (D7, and it fixes D2).
- asset-check job: **downgrade to optional / cut** (D12).

**B. Unverified claims.** Results of my own checks:
- tauriScript default: verified working (D13).
- WiX/NSIS auto-download: verified. The tauri-bundler source (`crates/tauri-bundler/src/bundle/windows/msi/mod.rs` L39 `WIX_URL`, L290 `download_and_verify`; `nsis/mod.rs` L38 `NSIS_URL`, L140) downloads both from GitHub at build time, so the failure mode in spec.md:L185 is real and correctly handled.
- Ad-hoc / "damaged": strong evidence for "damaged" (D8).
- Tag-filter full match: not stated explicitly. The workflow-syntax cheat sheet describes `v2*` as "Matches branch and tag names that start with `v2`" (the `*` is needed for a prefix) and `v[12].[0-9]+.[0-9]+` as "Matches all semantic versioning … tags", which implies anchored matching, so `v0.19.0-rc.1` most likely does not trigger. The SPEC's two-layer defence (spec.md:L182) is correct either way.
- Auto-notes default start: still undocumented (see A).
- Rerun reuses the draft id: asserted as fact at spec.md:L186 without verification (D10).
- SmartScreen labels: no official source. AC-013 correctly makes this a manual on-screen check.
- prebuild under tauri-action: the runner calls `npm exec tauri build`, not `npm run build`, so npm's `prebuild` lifecycle does not fire. AC-011's `[prebuild]`-absent check is a valid confirmation.
- Draft listing needs push access: confirmed ("Only users with push access will receive listings for draft releases"), so the write scope on the listing jobs is justified.

**C. Repo facts.**
- Versions: `0.19.0` in package.json:L4, src-tauri/Cargo.toml:L3 (`[package]`), and src-tauri/tauri.conf.json:L4.
- Scripts: no `tauri` script. `prebuild` runs `cargo clean` only on win32 and only under `npm run build`, so it is irrelevant under tauri-action.
- Tags (local = remote via `git ls-remote`): v0.4.0 … v0.13.2, v0.14.0, v0.15.0, v0.16.1, v0.17.0, v0.18.0. There is no v0.16.0 or v0.19.0.
- Releases: v0.14.0 (Latest, `mdedit_0.14.0_aarch64.dmg`) and v0.13.2 (Draft).
- Vitest: vite.config.ts sets no `include`, and the installed vitest 2.1.9 default `**/*.{test,spec}.?(c|m)[jt]s?(x)` matches `scripts/*.test.mjs`, so it will be collected. The test file will also inherit the jsdom environment and `src/test/setup.ts`, which is harmless. The script must not run its CLI section on import (it calls `git` and exits).
- Line citations: BUILD.md "GitHub Releases로 배포하기" spans L591 to EOF L655 (correct). README build guide L73-L94 is roughly correct (L73 배포 빌드 through the end of 테스트).

**D. Internal consistency.** REQ-001 (glob) and REQ-002 ("정확히 v<숫자>.<숫자>.<숫자>") agree in intent; see D14 for the regex hazard. No AC hard-codes a version that breaks under either D-2 answer: the AC-001/002 literals are fixtures and AC-011 uses `<tag>`. Only REQ-016/AC-009 and `phase` depend on D-2 (D9).

**E. Release-flow safety.**
- Draft-only: with `releaseId`, tauri-action only uploads (index.ts L128-L129), and no step publishes. Sound in design, but the AC cannot detect a missing `draft: true` (D3).
- Least privilege: the design is sound (top-level read, job-level `contents: write`). Gaps are credential persistence and job-level token env (D11).
- Secrets: GITHUB_TOKEN only (sound).
- Existing release: a fresh run fails before any build if a draft or published release exists (sound). A re-run after publishing can modify a published release (D10).
- Concurrency: per-tag group with `cancel-in-progress: false` (sound).

**F. Process hygiene.** No time estimates found (`timeout-minutes` values are deferred, not estimated). Markers appear only in plan.md and research.md (correct placement, but they block per MP-7). The frontmatter is schema-complete. Section letters in progress.md (§E.1-§E.4) match the SSOT. **The author's deviation from "§F.1" is correct:** progress.md `§F` is reserved for "Phase 4 Mode Selection" (schema progress.md Section Map), and the file-change table belongs in plan.md, a different document (schema "§F disambiguation" note).

**G. Korean quality.** See D18. The planned user-facing labels are natural. The BUILD.md SmartScreen label "자세한 정보" is unverified and correctly deferred to AC-013.

## Decisions the user must make

- **D-1 macOS ad-hoc signing.** Recommendation: **adopt `bundle.macOS.signingIdentity: "-"` in M2, before the first release**, with explicit user approval because it edits `tauri.conf.json`. Evidence: the published v0.14.0 app is linker-signed only with no sealed resources, and strict verification fails (D8). Tauri's docs say unsigned downloaded apps can show "broken and can not be started", and that ad-hoc signing is the Apple Silicon remedy. Ad-hoc signing involves no identity, no Apple account and no secret, so it stays within the user's "no code signing/notarization" decision in spirit. Tauri also notes that ad-hoc signing still needs the Privacy & Security approval, so the README's "그래도 열기" path stays valid. Keep `xattr` out of README, and mention it in BUILD.md only as a fallback if "damaged" is still observed.
- **D-2 first release version.** Recommendation: **v0.19.0.** All three version files already say 0.19.0, no tag exists yet, and no version-bump PR is needed. The workflow runs from the tagged commit's YAML, so the tag must sit on a commit after this SPEC merges, which the plan already states. Consequences to apply: set `phase: "v0.19.0 target"`, and change REQ-016/AC-009 to record the entry under `[0.19.0]` (D9). Choose 0.19.1 instead only if the user wants the v0.19.0 tag to mark exactly 061e828.
- **D-3 keep the main-origin guard.** Recommendation: **cut.** It exceeds the binding "version check only" decision, it is the 17th REQ over the Tier M ceiling (D2), its real behaviour is untested (D4), and "on main" does not prove CI passed. Put the safeguard in the BUILD.md procedure instead.

## Regression Check

Not applicable (iteration 1).

## Recommendation

FAIL. Fix order for manager-spec, after the orchestrator obtains D-1, D-2 and D-3 answers:

1. Remove the `[NEEDS CLARIFICATION]` markers and record the decisions (D1). Apply D-1 → move ad-hoc signing into M2 plus a static AC (D8). Apply D-2 → fix `phase`, REQ-016 and AC-009 (D9).
2. Cut REQ-003 and renumber to 16 REQs (D2, D7, D4).
3. Add a positive `draft: true` assertion for the create call to AC-004 (D3).
4. Scope the AC-009 greps to the new sections with strings absent today (D5). Add a command for every unasserted Then clause in AC-003/005/006/007 (D6).
5. Resolve the REQ-005 vs rerun contradiction with a draft re-check before upload, or reworded scope (D10). Add `persist-credentials: false` and step-level token env, and correct R-5 (D11).
6. Optionally apply D12-D19.

After fixes 1-5, re-audit only that defect delta (iteration 2).
