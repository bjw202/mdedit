# SPEC Review Report: SPEC-INFRA-002
Iteration: 2/3
Verdict: PASS-WITH-DEBT
Overall Score: 0.90 (harmonic mean) — Tier M PASS threshold 0.80 (score rose from 0.75; no STOP signal)

Reasoning context ignored per M1 Context Isolation. The author's change summary was treated as a set of claims to verify, not as evidence. Audit mode: Claude-only, because the MCP audit backends were unavailable (fail-open).

## Plain-language summary

The revised plan fixes every blocking problem from round 1:

- The open decisions are recorded.
- The requirement count is back to 16, which Tier M allows.
- The "stays a draft" check now looks at the call that actually decides draft status.
- Mac ad-hoc signing is part of the plan, with an automated config check and a manual on-device check.

I verified the new claims myself. The runner images do ship Rust 1.99, well above the repo's 1.77.2. Tauri's ad-hoc signing needs no extra CI step. js-yaml is already in the lockfile at the top level. What remains are minor gaps in the checks and one accepted risk the user should knowingly sign off: someone pressing Publish while a build is still running. The plan can go to the human approval gate.

## Must-Pass Results

- [PASS] MP-1: 16 headings, REQ-INFRA002-001…016 in order with no gaps or duplicates (`grep -oE '^#### REQ-INFRA002-[0-9]+' spec.md`). ACs run 001…016 (16 `### AC-INFRA002-0` headings).
- [PASS] MP-2 (requirement layer only): every REQ bullet uses `shall`, `When …`, or `shall not` (e.g. spec.md:L50-51, L65-68, L72-74, L88-92, L96-97, L103-107, L120-122, L150-151).
- [PASS] MP-3: all 12 fields are present (spec.md:L2-13). `version: "0.2.0"`, and `phase: "v0.19.0 target"` (L10) now matches D-2.
- [N/A] MP-4: single-repo CI SPEC.
- [PASS] MP-5: the only SPEC-ID referenced is the SPEC itself.
- [PASS] MP-6: no `syscall`.
- [PASS] MP-7: `grep -rn 'NEEDS CLARIFICATION'` over the SPEC directory returned nothing. plan.md §B (L12-21) records D-1…D-6 as decided, and interview.md Round 3 records the user's answers to D-1…D-4.

## Category Scores

| Dimension | Score | Band | Evidence |
|-----------|-------|------|----------|
| Clarity | 0.90 | 1.0→0.75 | The REQs are unambiguous, and the round-1 contradictions are resolved: REQ-004 L74 now scopes the ban to *published* releases, and R-5 L225 names only `actions/*` and `tauri-apps`. Remaining: the size of the R-8 race window is not stated (N2), and there are stale pointers (N6). |
| Completeness | 0.90 | 1.0→0.75 | Every edge case has a row (L180-187), and the exclusions record the two cuts (L212-213). Gaps: the Windows default shell for the new pre-upload check (N1), and the effect on local builds of the signing key (N8). |
| Testability | 0.85 | 0.75 | Every Then clause now has a command, and none of them can pass on an empty tree. Small gaps: the SHA is not tied to a release tag (N3), the `main` pattern is trivially satisfied (N4), the env check misses `github.token` (N5), and the line-count grep is fragile (N7). |
| Traceability | 0.95 | 1.0 | The REQ↔AC table (L155-172), the acceptance headers, spec-compact.md and plan.md §I all agree on 16/16. Every REQ has a milestone and a file: REQ-007 → M2 and `tauri.conf.json` (plan L78, L99), REQ-004 → M2 `release.yml`, REQ-016 → M4. Only progress.md and plan §G carry stale text (N6). |

HM = 4 / (1/0.90 + 1/0.90 + 1/0.85 + 1/0.95) = 0.90.

## Iteration-1 resolution table

| ID | Status | Evidence |
|----|--------|----------|
| D1 clarification markers | Fixed | No markers left. Decisions are in plan.md L14-21 and interview.md Round 3. |
| D2 17 REQs > 16 | Fixed | 16 REQ headings and 16 AC headings, both at the Tier M ceiling. |
| D3 draft not asserted | Fixed | REQ-003 L65 requires `draft: true` on the create call. AC-004 L63 asserts `(-F\|--field) +draft=true` on a `gh api` step in `create-release`. `releaseDraft` is dropped (plan L41, §H L126). |
| D4 REQ-003 untested | Fixed (moot) | The old REQ was deleted. |
| D5 AC-009 non-discriminating | Fixed (minor residual N4) | AC-011 L136/L140 cut the README section and the BUILD.md section-to-EOF. research.md L21 records that the required strings are absent today. The BUILD pattern `main` is still weak. |
| D6 Then without commands | Fixed | AC-003 L54/L56, AC-006 L88-92, AC-008 L106-114 and AC-009 L121-123 each assert through js-yaml. |
| D7 scope creep (main guard) | Fixed | Exclusion at L212, R-7 L227, and a procedure step at REQ-014 L139. |
| D8 macOS "damaged" | Fixed | REQ-007 L96-97, AC-007 L99 (JSON diff against the merge-base), AC-015 L174-178, plan M2 L78. |
| D9 CHANGELOG / phase vs D-2 | Fixed | `phase` L10. REQ-015 L146 points at `[0.19.0]`. AC-011 L144-145 checks 1 entry in `[0.19.0]` and 0 in `[Unreleased]`. |
| D10 re-run modifies published | Fixed (residual accepted as R-8, see N2) | REQ-004 L73. AC-005 L76 checks for a `gh api`+`.draft`+`exit 1` step placed before the tauri-action step. The re-run claim is now marked unverified (L185, research.md L43). |
| D11 token exposure / R-5 | Fixed | REQ-008 L105-106 and AC-008 L108/L110 cover `persist-credentials: false` and the token appearing only in step-level env. REQ-011 L120-122 and AC-009 L121 cover the allow-list. R-5 L225 is honest about the token being visible inside the build step. |
| D12 asset-check job | Fixed (removed) | L213 and plan D-4. |
| D13 tauriScript premise | Fixed | plan L54 (no `tauriScript`), research.md L32. |
| D14 regex dot case | Fixed | REQ-001 L50 is labelled as filter syntax. REQ-002 L57 and AC-001 L26 add `v0x19x0` and `v0.19.0.1`. |
| D15 AC-008 base | Fixed | AC-010 L128 compares against the merge-base. |
| D16 uncovered clauses | Fixed | Header greps at AC-005 L80. README forbidden list at AC-011 L136 (REQ-013 L135 is now scoped to the section). BUILD cleanup `push --delete origin` at L140. |
| D17 stale baseline | Fixed in plan, residual in progress.md (N6) | plan.md L7. |
| D18 Korean calques | Fixed | "main 포함 여부" (interview), "실패 경로/정상 경로 리허설" (AC-013/014), "진행 중 취소 안 함" (REQ-010). |
| D19 §E.1 audit-ready signal | Not fixed — accepted | The orchestrator forbids writing `plan_status: audit-ready` before approval (progress.md Plan-audit History). This is a sequencing choice, not a SPEC defect; the signal should be written right after approval. |

## Verification of the author's new claims (attack point 3)

- **Runner Rust (verified):** In runner-images README, `macos-latest` is macOS 26 arm64 (L32) and `windows-latest` is Windows Server 2025 VS2026 (L37). The image READMEs list Rust 1.99.0 / Cargo 1.99.0 (macOS 26 arm64, image 20261013.0424.1) and Rust 1.99.1 / Cargo 1.99.1 (Windows 2025, image 20261021.278.1). Both are well above `rust-version = "1.77.2"`. The Windows image also ships WiX 3.14.1.8722. One item stays unverified, and research.md L51 marks it as such: that the Windows default host target is `x86_64-pc-windows-msvc`.
- **js-yaml (verified):** `package-lock.json:4930` `"node_modules/js-yaml"` 4.1.1 is hoisted to top level, so `require("js-yaml")` from the repo root resolves after `npm ci`. I ran js-yaml 4.1.1 and it parses `on:` as the string key `"on"`, and keeps `runs-on: ${{ matrix.platform }}` as the literal string. AC-006's `'\${{ matrix.platform }}'` inside bash double quotes expands to that same literal. acceptance.md L7 and plan.md L10 both require `npm ci` first. Without `node_modules`, every command fails with `Cannot find module`, so the checks fail closed rather than passing vacuously.
- **awk section cuts:** UTF-8 heading literals match byte-for-byte. If a heading is renamed, the cut is empty and every required pattern prints MISSING, so the check fails closed. If a step is renamed, the js-yaml assertions still pass or fail correctly, because they match on `run` and `uses` content, not on step names.
- **Ad-hoc signing (verified):** tauri-bundler at `tauri-cli-v2.10.0` (the locked CLI is 2.10.0; Cargo.lock has `tauri` 2.10.3). In `macos/sign.rs` L19-42, a keychain is imported only when `APPLE_CERTIFICATE` is set; otherwise `Keychain::with_signing_identity(identity)` is used. In `tauri-macos-sign/src/keychain.rs` L221-239, signing runs `codesign --force -s <identity> [--options runtime]` with no timestamp and no keychain. So `"-"` needs no extra CI step beyond the `/usr/bin/codesign` that ships on the macOS runner. The key lives under `bundle.macOS` and has no effect on Windows bundles. AC-015's expectations (`Signature=adhoc`, strict verify exits 0, Gatekeeper "Open Anyway" rather than "damaged") are realistic for a sealed ad-hoc bundle, but they remain unobserved until the first CI build. AC-015 is correctly manual.
- **SHA pin:** GitHub's secure-use guide says "Pin actions to a full-length commit SHA … This helps mitigate the risk of a bad actor adding a backdoor". The mixed policy is coherent: `actions/*` keep `@v4` to match `frontend-gates.yml`, and the one third-party action holding a write token gets a SHA. AC-009 does enforce the shape, but see N3.

## Defects Found (new in iteration 2)

N1. WIN-SHELL — spec.md:L73; acceptance.md:L76; plan.md:L37 — The pre-upload draft check runs in the matrix build job, including on `windows-latest`. GitHub's documented default shell on Windows is `pwsh` (workflow-syntax table: "Windows | `pwsh` | This is the default shell used on Windows"). A bash-style `if [ … ]; then exit 1; fi` without `shell: bash` breaks on Windows. The failure is loud (the job fails), not a safety hole, and AC-005's regex cannot detect it. — Severity: MINOR — Class: optional — Fix: State `shell: bash` (Git Bash on Windows runners) for that step or in `defaults.run.shell` for the build job, and add `a.strictEqual(step.shell||J.build.defaults?.run?.shell,'bash')` to AC-005.

N2. RACE-WINDOW-SIZE — spec.md:L187, L228; plan.md:L20 — tauri-action compiles and uploads in a single step, so the draft check necessarily runs before the whole Rust and Vite build. The check-to-upload window is therefore the full build duration, not a short gap, and a Publish click during that time lets assets land on a published release. R-8 calls the risk accepted, but plan D-5 is an author decision; it is not among the user's Round 3 answers. — Severity: MINOR — Class: optional — Fix: In R-8, say the window spans the entire build step. At the approval gate, the orchestrator should show R-8 as a risk for the user to accept.

N3. SHA-NOT-TIED-TO-RELEASE — acceptance.md:L121; plan.md:L54 — AC-009 accepts any 40-hex SHA. The v1 tags are annotated, so their object SHAs differ from the commit SHA (`git ls-remote`): `refs/tags/v1` → 944946e…, `v1.0` → 94d8812…, `v1.0.0` → 2d793bf…, all peeling to commit `1deb371b0cd8bd54025b384f1cd735e725c4060f`. Pinning a tag-object SHA, or any unreleased dev commit, would pass AC-009. — Severity: MINOR — Class: optional — Fix: Add a check that the pinned SHA appears in `git ls-remote https://github.com/tauri-apps/tauri-action 'refs/tags/v1*^{}'`, and require a trailing `# v1.x.y` comment.

N4. BUILD-MAIN-WEAK — acceptance.md:L140 — The required pattern `main` is matched by any mention of main, so it does not verify REQ-014's step "main에 이미 병합된 커밋에 태그". — Severity: MINOR — Class: optional — Fix: Require `병합된 커밋` instead.

N5. ENV-CHECK-GITHUB-TOKEN — acceptance.md:L110 — The workflow/job-env check only looks for `secrets.`. `env: GITHUB_TOKEN: ${{ github.token }}` at job level would slip through and violate REQ-008 L106. — Severity: MINOR — Class: optional — Fix: Test `/secrets\.|github\.token/`.

N6. STALE-TEXT — progress.md:L5, L7; plan.md:L120 — progress.md still says "기준 커밋 061e828(origin/main)" and "interview.md(2라운드)". plan §G cites "§F M3 절차" for the BUILD procedure, but that procedure is defined in REQ-014 L139; M3 L84 does not list it. — Severity: MINOR — Class: optional — Fix: Update to 97b7db5 and Round 1-3, and point plan §G at REQ-014.

N7. AC001-LINECOUNT — acceptance.md:L32 — `grep -cE … ≥ 3` counts lines, so a correct table-driven test that lists all three cases on one line would wrongly fail. — Severity: MINOR — Class: optional — Fix: `grep -oE "v0x19x0|v0\.19\.0\.1|rc\.1" … | sort -u | wc -l` → 3.

N8. LOCAL-BUILD-SIGNING-UNDOCUMENTED — spec.md:L96; plan.md:L78 — After the change, a local `npm run build` on macOS also runs `codesign --force -s -` (keychain.rs L221). This is harmless and requires the Xcode CLT `codesign`, which macOS builds already need, but REQ-014's BUILD.md rewrite does not mention it. — Severity: MINOR — Class: optional — Fix: Add one sentence to the BUILD.md section saying local mac builds are now ad-hoc signed and Windows builds are unaffected.

N9. W-VAR-SCOPE — acceptance.md:L8-12 — `$W` must be defined in the same shell invocation as each `node -e`, because agent Bash calls do not share state. If it is undefined, `a`/`J` throw a ReferenceError, so this fails closed, not open. — Severity: MINOR — Class: optional — Fix: State "define W in the same invocation" or prefix each command with the assignment.

No blocking defects.

## Recommendations on the two open user choices

1. **SHA-pin tauri-action vs `@v1` → SHA-pin (agree with author).** This is the only third-party action, and it runs with `contents: write`. GitHub's own guidance calls a full-length SHA the immutable form, while `v1` is a movable tag. Pin the peeled commit (currently `1deb371b0cd8bd54025b384f1cd735e725c4060f` for v1.0.0, per `git ls-remote`) with a `# v1.0.0` comment, and fix N3. Cost: no automatic updates without Dependabot. That is acceptable because the workflow only runs on tag pushes, and R-2 already plans to check asset names during the rehearsal.
2. **AC-005 accepting a README link without a section anchor → accept, but align REQ-005 wording.** The release body renders on GitHub, and the repo URL shows the README. A Korean anchor (`#설치-파일-내려받기`) breaks silently if the heading is ever renamed, and no check would notice. Change REQ-005 L80 from "README 내려받기 절 링크" to "저장소(README) 링크; 절 앵커는 선택", so the requirement and AC-005 L80 match.

## Debt carried forward (PASS-WITH-DEBT)

- D19: write the §E.1 audit-ready signal immediately after approval.
- N1-N9: minor and optional. N1 and N3 are the most worth doing before run, and N1 would otherwise surface as a failed Windows job in the rehearsal.
- Accepted risks R-7 (tag on a non-main commit) and R-8 (Publish during a build). R-8 should be shown to the user explicitly (N2).
- Still unverified until the first CI run (correctly manual): the CI ad-hoc signature passing strict verify and opening without "damaged" (AC-015), the Windows Rust default target, the SmartScreen button labels (AC-016), and whether re-running failed jobs reuses create-job outputs.

The plan **can enter the human approval gate**. At that gate, present R-8, the SHA-pin choice and the anchor choice.

## Regression Check

No regressions. The REQ/AC renumbering is consistent across spec.md, acceptance.md, spec-compact.md, plan.md §I and research.md. interview.md L43's "구 REQ-INFRA002-003" is an intentional historical reference.
