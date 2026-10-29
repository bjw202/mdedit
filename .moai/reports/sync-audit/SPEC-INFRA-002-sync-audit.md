verdict: PASS-WITH-DEBT

# Sync Audit Report: SPEC-INFRA-002 (tag-push release automation)

- Auditor: sync-auditor, 2026-10-29. **Claude-only audit**: the `moai` MCP server failed to connect at session start (codex/GLM convergence unavailable). WebFetch was not available to this agent either; official GitHub docs were fetched with `curl` from `docs.github.com/api/article/body` and grepped (saved under the gitignored `.moai/state/verify/SPEC-INFRA-002/sync-audit-scratch/`).
- Tree: worktree `.claude/worktrees/release-automation`, branch `WT-release-automation`, HEAD `c6d2835`, merge-base with origin/main `97b7db5`. Nothing pushed.
- Tier M, threshold 0.80. Profile: built-in default (no `evaluator_profile` in spec.md).
- Scratch files this audit created (gitignored runtime path, not repository files): `.moai/state/verify/SPEC-INFRA-002/sync-audit-scratch/{mut.cjs,npm-test.log,releases.md,syntax.md,checkout.md,runners.md}`. Running the implementer's `ac.sh` also rewrote its own `ac7.tmp` in the same gitignored directory.

## Summary

The implementation does what the SPEC asks. I re-ran every automatic acceptance command (AC-001..012) myself and all produced their PASS output. The four required mutations of `release.yml` (removing `-F draft=true`, switching the shell to `pwsh`, adding a token to the `npm ci` step, using a tag-object SHA) each make the relevant AC fail, as intended. No Critical or High findings. The debt is mostly in the acceptance checks themselves: several of them would still pass if the guarded logic were neutered. In particular, AC-004a (the draft guarantee) passes when `draft=true` survives only in a shell comment. The biggest unknowns are runtime ones that only a real tag push can settle: whether `GET /releases/{id}` returns a draft, the GitHub "workflow-file" rule on release creation, the final asset list, and the macOS/Windows first-run screens.

## Overall

| Dimension | Score | Verdict | Evidence (verbatim excerpts) |
|---|---|---|---|
| Functionality (40%) | 85/100 | PASS | AC-001..011 via `bash .moai/state/verify/SPEC-INFRA-002/ac.sh` (diffed against acceptance.md below): `Tests 23 passed (23) [exit=0]`, AC-001b `3`, every node assertion `[exit=0]`, AC-004b `[grep exit=1]` with no lines, AC-008d `secrets.GITHUB_TOKEN`, AC-011c `1`, AC-011d `0`, AC-005e/010/011a/011b no output. AC-012: `npm test` → `Test Files 109 passed (109)` / `Tests 1788 passed (1788)` exit 0; `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm run typecheck` exit 0. Baseline recount on this tree: `npx vitest run --exclude 'scripts/**' …` → `Tests 1765 passed (1765)`, and 1765 + 23 = 1788. |
| Security (25%) | 85/100 | PASS (no Critical/High) | Least-privilege `permissions` (AC-008a exit 0), `persist-credentials: false` (AC-008b exit 0), token only in step env of `gh api` / tauri-action steps (AC-008c exit 0, M3 mutation → FAIL), no `${{ }}` interpolation inside `run:` (all via `env:`), third-party action pinned to commit `1deb371b…` (verified: tag `v1.0.0` → tag object `2d793bf…` → commit `1deb371b0cd8bd54025b384f1cd735e725c4060f`). One Medium finding: the write token is visible to build child processes (F4). |
| Craft (20%) | 85/100 | PASS | `npx vitest run scripts --coverage …` → `check-release-version.mjs  94.82 Stmts / 91.3 Branch / 90 Funcs / 94.82 Lines, uncovered 94-97,127-128`. ≥85% target met. CLI smoke: `v0.19.0` → exit 0, `직전 버전 태그: v0.18.0`; `v0.0.1` → exit 1 with three per-file `::error::` lines; `v0x19x0` and no argument → exit 1 format error. Debt: `npx eslint scripts/check-release-version.mjs` → `79:53 error Irregular whitespace not allowed no-irregular-whitespace` (F7), which the lint gate never sees because it is `--ext ts,tsx` only (F8). |
| Consistency (15%) | 88/100 | PASS | Comments and MX tags in Korean per `code_comments: ko`; `[AUTO]` prefix + `@MX:REASON` on the ANCHOR; Conventional Commit subjects (`git log 97b7db5..HEAD`); docs match the workflow structure. Small wording inaccuracies (F9, F10). |

- Weighted score: 0.40·85 + 0.25·85 + 0.20·85 + 0.15·88 = **85.5 → 0.85** (harmonic mean 0.856). Threshold 0.80 → met.
- MUST-PASS (Functionality, Security): **both PASS**. No blocking findings → verdict **PASS-WITH-DEBT** (all findings optional).

## Findings (structured defect list)

All findings are **optional** (none breaks correctness or an AC the SPEC states). Confidence: H = verified by command/source, M = doc-based inference, L = unverified.

- **F1 [Medium] [optional] (H)** `acceptance.md:66` AC-004a — the AC for the draft guarantee (the SPEC's most important safety property) can pass vacuously. Mutation V3 (scratch copy: replace the `-F draft=true \` line with `-F prerelease=false \` plus a `# -F draft=true` comment line) → `004a=PASS`, even though the create call no longer sends `draft`. acceptance.md line 65 says "이 값을 지우면 실패한다"; that holds only when the text disappears entirely (M1 → `004a=FAIL(ERR_ASSERTION)`). Required fix: in AC-004a, drop `#`-comment lines before matching, e.g. `run(s).split('\n').filter(l=>!/^\s*#/.test(l)).join('\n')`, then test `/(-F|--field) +draft=true/`.
- **F2 [Low] [optional] (H)** `acceptance.md:68` AC-004b forbidden-phrase grep misses equivalent forms. Mutation V5 (a step running `gh api --method=PATCH … -F draft=False`) → `forbidden-grep=no-hit(PASS)` and AC-008c `PASS`. Mutation V4 (`releaseDraft: false` on tauri-action) → no hit, which is harmless: verified at the pinned SHA, `src/index.ts:102` creates a release only when `tagName && !releaseId`, so `releaseDraft` is unused on this path. Required fix: widen the regex to `--method[ =]*(DELETE|PATCH)`, `-X *=?(DELETE|PATCH)`, and make the `draft…false` part case-insensitive.
- **F3 [Low] [optional] (H)** `acceptance.md:77,79` AC-005a/005b check only that a step contains `tag_name`/`.draft` and `exit 1`. Mutation V1 (`if false; then`) → `005b=PASS`; V2 (filter `select(.tag_name == "never")`) → `005a=PASS`. acceptance.md:86 already admits this limit. Required fix: none mandatory; keep relying on code review and AC-014.
- **F4 [Medium] [optional] (H, by source reading)** `.github/workflows/release.yml:160-166` — `GITHUB_TOKEN` (contents: write) sits in the tauri-action step env. tauri-action runs `npm exec tauri build` (verified: `src/runner.ts` uses `exec` when there is no `tauri` script, and `package.json` has none), and that build runs `beforeBuildCommand` `npm run build-vite` plus cargo build scripts, all inheriting the env. Every Vite plugin and build-script dependency can therefore read a repo write token during the build. This is inherent to tauri-action's upload design and permitted by REQ-008; the token is scoped to this repo and expires with the job. Required fix: record it as an accepted residual risk in spec.md §Risks. Optional hardening (a separate SPEC): build without token or `releaseId`, then upload in a separate `gh api` step.
- **F5 [Medium] [optional] (M)** `release.yml:153` — the draft check calls `GET /repos/{owner}/{repo}/releases/{id}`. The official doc text (`releases.md`, "Get a release") reads "Gets a public release with the specified release ID". If that call returned 404 for drafts, `draft=$(gh api …)` under `bash -eo pipefail` would stop the job before upload. That fails safe, but it would block every release. Common practice suggests push-access tokens can read drafts by id; not observed here. Required fix: none now. Confirm in AC-014; if it 404s, look the release up from the list endpoint (as the create job already does).
- **F6 [Medium] [optional] (M)** create-release `POST /releases` (`release.yml:102-107`). The official doc (`releases.md` lines 147-149) says that if the resolved target commit "adds or modifies any file under .github/workflows/ relative to the repository's default branch", GITHUB_TOKEN "cannot be authorized" and the call returns 404/403. With `target_commitish` omitted the doc resolves to the default branch's latest commit (safe). How an existing tag that points at an older main commit is treated is ambiguous. BUILD.md's example `git tag v0.19.0 origin/main` tags main HEAD, which avoids the issue. Required fix: in BUILD.md step 2, state "tag the latest origin/main commit" rather than any already-merged commit, or record this as a residual risk.
- **F7 [Low] [optional] (H)** `scripts/check-release-version.mjs:79` — the regex `/^﻿/` contains a literal U+FEFF (`od -c` shows `357 273 277`). It behaves correctly, but it is invisible, `npx eslint` reports `no-irregular-whitespace`, and no test feeds a BOM-prefixed file. Required fix: write `/^﻿/` and add a BOM case to the `readVersions` test.
- **F8 [Low] [optional] (H)** `package.json` lint script `eslint . --ext ts,tsx` never lints `.mjs`, so the new script sits outside the lint gate (pre-existing configuration, outside this SPEC). Required fix: a follow-up card to add `mjs` to the lint scope.
- **F9 [Low] [optional] (H, doc)** `release.yml:22` comment "같은 태그에 대한 실행은 줄을 세우되". Official doc (`syntax.md:923,929`): at most one run can be pending per group, and a newer pending run cancels and replaces the older pending one. Required fix: reword to "진행 중인 실행은 취소하지 않는다(대기 중인 실행은 최신 1개만 남는다)".
- **F10 [Low] [optional] (H)** `release.yml:147` and `docs/BUILD.md` ("빌드 job은 업로드 직전에 초안인지 확인") — the check runs before the whole build, not just before upload. BUILD.md's next clause explains the gap correctly, but "업로드 직전" misleads. Required fix: "빌드를 시작하기 전에".
- **F11 [Low] [optional] (L)** BUILD.md step 4 says to check "파일 세 개". The final asset set is unobserved: Windows MSI names include a language suffix (`…_x64_en-US.msi`, per `src/build.ts:141`), and whether macOS also uploads an `.app`-derived asset was not settled from source. AC-014 counts only the three suffixes, so it would not catch extras. Required fix: confirm in AC-014 and adjust the BUILD.md wording to "at least these three files" if extras appear.
- **F12 [Low] [optional] (L)** README / BUILD.md first-run instructions are unverified screen text: macOS "그래도 열기 → 열기" (recent macOS may also ask for a password) and SmartScreen "추가 정보 → 실행". Required fix: AC-015/016 on real machines, then correct the wording to match the screens.
- **F13 [Info] (H)** The implementer's `ac.sh` differs from acceptance.md in exactly two commands: `2>&1` is inserted in AC-001b (`grep -oE … 2>&1 | sort -u | wc -l`) and AC-008d (`grep -oE "secrets…" … 2>&1 | sort -u`). Both are harmless (a missing file still yields a non-PASS value). All other 30 automatic commands are verbatim; the 5 remaining non-matches are prose (`grep -n…`) or manual-AC commands. progress.md §E.2's "그대로 옮겨" is accurate except for these two.
- **F14 [Info] (L)** Unverified documentation claims: CHANGELOG "로컬 `npm run build`도 같은 서명을 받습니다" and BUILD.md "(Xcode 명령줄 도구의 `codesign` 사용)". No local Tauri build was run in run or sync.

## 1. AC re-run and transcription check

- Transcription diff (Python extraction of every back-ticked command from acceptance.md, compared with `ac.sh`): `total 39 not-verbatim 7`. The seven: L12 (prose `grep -n…`), L34 and L117 (the two `2>&1` insertions, F13), and L165/167/177×2 (manual AC-013/014 commands, not in `ac.sh` by design).
- Results: see the Overall table. All AC-001..012 PASS.

### Mutation tests (in-memory copies only; `release.yml` was read, never written)

`node .moai/state/verify/SPEC-INFRA-002/sync-audit-scratch/mut.cjs <worktree>` (assertion bodies copied verbatim from acceptance.md):

```
baseline: 004a=PASS 005a=PASS 005b=PASS 005c=PASS 008c=PASS 009a=PASS forbidden-grep=no-hit(PASS) 009b=PASS
M1 delete -F draft=true line => 004a=FAIL(ERR_ASSERTION) forbidden-grep=no-hit(PASS)
M2 defaults shell bash->pwsh => 005c=FAIL(ERR_ASSERTION)
M3 secrets.GITHUB_TOKEN env on npm ci => 008c=FAIL(ERR_ASSERTION)
M4 tag-object SHA for tauri-action => 009a=FAIL(ERR_ASSERTION) 009b=FAIL
V1 draft check neutered (if false) => 005b=PASS
V2 existing-release filter neutered => 005a=PASS
V3 draft=true only inside a shell comment => 004a=PASS
V4 releaseDraft: false on tauri-action => forbidden-grep=no-hit(PASS)
V5 publish step via --method=PATCH draft=False => forbidden-grep=no-hit(PASS) 008c=PASS
V6 github.token in tauri-action env (allowed by design) => 008c=PASS
```

M1–M4 (the four required mutations) all FAIL as they should. V1–V5 pass vacuously (F1–F3). V6 is the intended allowance.

## 2. Real-run behaviour vs primary sources

| Item | Status | Source / evidence |
|---|---|---|
| tauri-action `releaseId` path: no release creation; uploads to the given id; `releaseDraft` unused | verified | `src/index.ts:29-30,102,128-129` at `1deb371b…` |
| Re-run upload is idempotent (deletes an existing same-name asset first) | verified | `src/upload-release-assets.ts:54-64` |
| `args: ${{ matrix.args }}` empty on Windows → no extra args | source verified (`stringArgv(core.getInput('args'))`, `src/inputs.ts:26`); "missing matrix key → empty string" not doc-verified | — |
| Action runtime Node 24 | verified | `action.yml`: `using: 'node24'` |
| `gh api --paginate … --jq '… env.TAG …'` | verified | positive control: `TAG=$(…[0].tag_name) gh api … --jq '…select(.tag_name == env.TAG)…'` → `게시본 https://github.com/tauri-apps/tauri-action/releases/tag/action-v1.0.0`; no-match case exit 0, no output (gh 2.83.2) |
| `-F draft=true` → JSON boolean; `-F body=@file` reads the file | verified | `gh api --help`: "literal values `true`, `false`, `null`, and integer numbers get converted"; "if the value starts with `@`, the rest of the value is interpreted as a filename" |
| `generate-notes` with `tag_name` + `previous_tag_name` | verified (live, non-mutating) | `gh api --method POST repos/bjw202/mdedit/releases/generate-notes -f tag_name=v0.19.0 -f previous_tag_name=v0.18.0` → name `v0.19.0`, body contains `v0.18.0...v0.19.0` = `true`; doc: "The generated release notes are not saved anywhere." |
| `POST /releases` with an existing pushed tag | verified (doc) | `target_commitish`: "Unused if the Git tag already exists." |
| Release creation with GITHUB_TOKEN vs workflow-file changes | **risk, ambiguous** | doc L147-149 (F6) |
| Listing drafts requires push access | verified (doc) | "Only users with push access will receive listings for draft releases." (`contents: write` job) |
| `GET /releases/{id}` returns a draft | **unverified** | doc says "Gets a public release" (F5) |
| `fetch-depth: 0` brings tags | verified | checkout README: "Set `fetch-depth: 0` to fetch all history for all branches and tags." |
| Windows `shell: bash` = Git Bash | verified | syntax doc: "When specifying a bash shell on Windows, the bash shell included with Git for Windows is used." `bash --noprofile --norc -eo pipefail {0}` |
| `macos-latest` is arm64 → `--target aarch64-apple-darwin` is the native target | verified | runners doc: arm64 row lists `macos-latest` (macos-26-arm64) |
| Tag filter `+`/`.` semantics | verified (`+` = one or more of the preceding character; `.` not a special character) | syntax doc L3278 cheat sheet |
| prebuild hook not run in CI | source-verified (npm `exec`, not `run build`); observation pending (AC-014) | `src/runner.ts`, `package.json` scripts |
| gh CLI / Rust preinstalled on the windows-latest and macos-26 images | unverified here | — |

## 3. SPEC–implementation divergence (Step 1.5)

- Planned files (plan.md §F.1): 4 new + 4 modified + frontend-gates unchanged. Actual `git diff --name-status 97b7db5..HEAD`: exactly those 8, plus SPEC process artifacts (plan-phase docs, plan-audit reports, progress.md, spec.md `status: draft → in-progress`, owned by manager-develop).
- scope_expansion: none.
- unplanned_additions: extra test cases beyond the AC minimum (null version, `[workspace]` before `[package]`, CRLF, runCli GITHUB_OUTPUT and failure paths); `runCli` dependency injection for testability. Justified, small.
- deferred_items: manual AC-013..016; the vite `.claude/**` test-exclusion proposal (progress.md, out of scope).
- structural_changes: none. New directories: none (`scripts/` and `.github/` already existed).
- New dependencies: none. `git diff --stat 97b7db5..HEAD -- package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock vite.config.ts .github/workflows/frontend-gates.yml` → no output.
- tauri.conf.json diff: only `"macOS": { "signingIdentity": "-" }` added (AC-007 exit 0).

## 4. Documentation accuracy

- CHANGELOG `[0.19.0]` SPEC-INFRA-002 bullet: "단위 테스트 23건" ✓ (23 passed); trigger, job order, three version files, file names, `release-notes-header.md`, `signingIdentity: "-"` ✓ match the code. "로컬 `npm run build`도 같은 서명" unverified (F14).
- `.github/release-notes-header.md`: three patterns + README link, no `/releases` or anchor link ✓ (AC-005e).
- README "설치 파일 내려받기": file names match tauri-action naming (`${name}_${version}_${arch}.dmg`, `…_${arch}-setup.exe`, `src/build.ts:88,185`) ✓. First-run screen labels unverified (F12).
- docs/BUILD.md release section: version gate, tag-on-main procedure, rc tags not triggering, draft-only, existing-release failure, recovery order (`gh release delete` → remote tag delete → local tag delete) ✓ consistent with the workflow. "업로드 직전" wording (F10); "파일 세 개" (F11); tag-target nuance (F6); "Xcode 명령줄 도구의 codesign" unverified (F14).
- Korean wording: natural written register, no translationese found ("저장소 첫 화면(README)", "한 번 열어 본 뒤", "~하려는 설정이며").

## 5. @MX compliance (`scripts/check-release-version.mjs`)

- `@MX:ANCHOR` on `checkReleaseVersion` with `[AUTO]` and `@MX:REASON` ✓. Production fan_in is 1 (`runCli`) + tests, so it qualifies as a public contract boundary (exported, consumed by the workflow through the CLI), not by fan_in ≥ 3. Acceptable.
- `@MX:NOTE` ×2 (tag regex, Cargo `[package]` parsing) ✓; Korean per `code_comments: ko` ✓; per-file limits respected.
- No P1/P2 violations: no WARN needed (no complexity ≥ 15, no global mutation); `runCli` and `findPreviousTag` are tested, so no TODO is required.

## 6. Quality numbers (this run, this tree, HEAD c6d2835)

- `npm test` → `Test Files 109 passed (109)`, `Tests 1788 passed (1788)`, exit 0 (log: `sync-audit-scratch/npm-test.log`).
- `npx tsc --noEmit` exit 0; `npm run typecheck` exit 0; `npm run lint` exit 0 (scope excludes `.mjs`: F8).
- Coverage (v8, new script only): 94.82% statements / 91.3% branches / 90% functions. Uncovered: `gitTags` (94-97) and the direct-execution guard (127-128), both exercised by the CLI smoke runs above.

## 7. Gaps (not observed) and residual risk

- **Not observed**: a real workflow run (all jobs, artifact names and count, notes range, the prebuild hook's absence), `GET /releases/{id}` on a draft (F5), the workflow-file 404 rule (F6), the macOS ad-hoc signature (`codesign -dv` → `Signature=adhoc`), the macOS first-run path and Windows SmartScreen labels (AC-015/016), gh/Rust availability on runner images, and any local `tauri build`. Manual AC-013..016 remain open.
- **Residual risk**: build-time token exposure to npm/cargo build code (F4, accepted design); publishing mid-run (R-8, accepted by the user); tagging a commit not on main (R-7, accepted, procedure only); tauri-action behaviour beyond the pinned SHA is frozen, so later fixes are not picked up.

## 8. Hand-off: SPEC body edits (manager-spec; manager-docs may not edit these bodies)

None is required for the as-implemented state. All automatic ACs pass and the implementation matches spec v0.3.2. Optional edits, if the planning agent takes them:

1. acceptance.md AC-004a: ignore shell-comment lines before matching `draft=true` (F1).
2. acceptance.md AC-004b: widen the forbidden regex to `--method[ =]*(DELETE|PATCH)` / `-X *=?(…)` and case-insensitive `draft…false` (F2).
3. spec.md §Risks: add F4 (token visible to build child processes) and F6 (the GITHUB_TOKEN workflow-file rule on release creation; tag main HEAD) as recorded residual risks.

Non-SPEC follow-ups (manager-develop or a new card): F7 (BOM regex escape + test), F8 (lint `.mjs`), F9/F10 (comment and BUILD.md wording), and F11/F12 doc wording after AC-014..016.
