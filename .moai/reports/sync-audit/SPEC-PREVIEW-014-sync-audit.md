# Sync Audit — SPEC-PREVIEW-014 (Korean relative image path in preview)

- Auditor: sync-auditor (fresh context, skeptical stance)
- Tree: worktree `preview-korean-img`, branch `worktree-preview-korean-img`, HEAD `838fb17` (base `a19e1c8`; commits `d6aebff` docs, `5c4a173` fix, `838fb17` sync)
- Evidence dir: `.moai/state/verify/preview-014-auditor/` (logs + throw-away mutants under `mut/`, outside `src/`)
- Profile: built-in default (must-pass = Functionality + Security), Tier S threshold 0.75

## Verdict: PASS-WITH-DEBT

| Dimension | Score | Must-pass | Verdict |
|-----------|-------|-----------|---------|
| Functionality | 0.95 | yes | PASS |
| Security | 0.95 | yes | PASS |
| Craft | 0.88 | no | PASS |
| Consistency | 0.82 | no | PASS (with debt) |
| **Harmonic mean** | **0.90** | | >= 0.75 |

Harmonic mean = 4 / (1/0.95 + 1/0.95 + 1/0.88 + 1/0.82) = 4 / 4.461 = 0.897.
No blocking defect. One SHOULD-FIX (user-facing CHANGELOG wording). Manual in-app acceptance remains open (correctly reflected by `status: implemented`).

## Defect list (route fixes; re-audit only this delta)

| ID | Severity | Location | Finding | Required fix |
|----|----------|----------|---------|--------------|
| D1 | SHOULD-FIX (optional for correctness) | `CHANGELOG.md:8` | User-facing changelog exposes internal workflow jargon: "(위 수치는 오케스트레이터가 직접 재실행 확인)" and "run 단계 보고 수치입니다". Also the 1604/1604 figure is now independently re-run (this audit) so the "보고 수치" qualifier is stale. | Replace the parenthetical with neutral wording, e.g. "검증: … 11/11 통과, `usePreview` 6/6, tsc·eslint 0, 전체 vitest 1604/1604(105 파일) 통과." — drop "오케스트레이터" and "run 단계". |
| D2 | MINOR | `.moai/specs/SPEC-PREVIEW-014-korean-image-path/progress.md` §E.2 ("원본 로그: `.moai/state/verify/preview-013/`") | Folder name is accurate on disk (exists, 6 logs) but carries the pre-renumber ID; `red.log` test titles also read "SPEC-PREVIEW-013". Not a broken pointer, only a naming residue. Logs are uncommitted state. | Add one clause: "(SPEC 번호 변경 전 이름 그대로 둠)". Do not rename the folder (would break the pointer). |
| D3 | MINOR | `progress.md` §E.4 evidence table, row `moai spec lint` | Labelled "오케스트레이터 직접 실행" but no log file exists for it under `preview-013-orch/`. Auditor re-ran it: exit 0 (see Evidence). Claim true, but unattributed at time of writing. | Optional: cite a log path or mark as re-verified by sync-audit. |
| D4 | MINOR (optional) | `src/lib/image/imageResolver.ts:103-106` | `toAbsolute` closure is recreated each loop iteration; it depends only on `mdDir`/`sep` and could be hoisted above the loop. | Optional: hoist above `for`. No behavior change. |
| D5 | MINOR (optional) | `src/lib/image/imageResolver.ts:129` | Inner-loop catch comment "Keep original src if the file cannot be read" is now slightly inaccurate — a failure on the first candidate moves to the next candidate. | Optional: "다음 후보로 진행 — 모두 실패하면 원래 src 유지". |
| D6 | MINOR (optional, informational) | `src/lib/image/imageResolver.ts:113-131` | IPC cost: an encoded src whose both candidates fail costs 2 IPC calls; a failing src repeated N times costs 2N (cache `resolved` is set only on success — pre-existing behavior was N). Acceptable for preview; documented as intended in SPEC Design Note. | None required. |

No dead code found. The pre-existing `full.replace(src, dataUri)` quirk (replaces the first occurrence of the src text inside the tag, e.g. if `alt` contained the same string before `src`) is unchanged — the fix still calls it with the original `src`, so it is not made worse.

## Claim / Evidence / Baseline-attribution / Gaps / Residual-risk

### 1. Claim

1. All 5 acceptance criteria (AC-PREVIEW014-01..05) are met by tests T1..T11 and the code at `src/lib/image/imageResolver.ts:102-132`.
2. Targeted tests, usePreview regression, typecheck, lint, and the full vitest suite (105 files / 1604 tests) pass on HEAD `838fb17`.
3. The tests are mutation-sensitive: removing the decode or reversing the fallback order makes 7 of 11 tests fail.
4. Decode-first does not create a newly reachable file: every decoded `..` reaches Rust `validate_path`, which rejects it before any filesystem read.
5. SPEC ↔ code ↔ tests ↔ CHANGELOG ↔ progress.md are consistent (11 tests, 7 RED failures, 5 REQ/AC, 014 numbering), with the defects listed above.

### 2. Evidence (commands run by this auditor, verbatim tails)

```
$ npx vitest run src/test/imageResolver.test.ts      -> exit=0
 ✓ src/test/imageResolver.test.ts (11 tests) 3ms
 Test Files  1 passed (1)
      Tests  11 passed (11)

$ npx vitest run src/test/usePreview.test.ts         -> exit=0
 Test Files  1 passed (1)
      Tests  6 passed (6)

$ npm run typecheck                                  -> tsc_exit=0
> tsc --noEmit

$ npm run lint                                       -> lint_exit=0
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0

$ npx vitest run  (full suite, log: full-vitest.log) -> exit=0
 Test Files  105 passed (105)
      Tests  1604 passed (1604)

$ moai spec lint .moai/specs/SPEC-PREVIEW-014-korean-image-path/spec.md -> exit=0
✓ No findings — all SPEC documents are valid
```

Mutation checks (throw-away copies in `mut/`, `src/` untouched):

```
# Mutant A: fallback order reversed ([toAbsolute(src), toAbsolute(decoded)])  -> exit=1
   × T1  × T2  × T4  × T5  × T6  × T10  × T11
      Tests  7 failed | 4 passed (11)

# Mutant B: decode removed (decoded = src)                                     -> exit=1
   × T1  × T2  × T4  × T5  × T6  × T10  × T11
      Tests  7 failed | 4 passed (11)
```

Both mutants are killed by T1, T4, T5, T11 (the four the brief asked about) plus T2, T6, T10. Mutant B reproduces the run agent's RED figure (`7 failed | 4 passed (11)`) independently. T3, T7, T8, T9 are regression guards that correctly pass under both mutants.

AC / REQ traceability:

| AC | REQ | Tests | Implementing code |
|----|-----|-------|-------------------|
| AC-PREVIEW014-01 | 001 | T1, T2 | `imageResolver.ts:113-121` (decode, decoded candidate first), `:103-106` (`./` strip + separator after decode) |
| AC-PREVIEW014-02 | 003 | T3 | `:116-120` (try/catch around `decodeURIComponent`, falls back to src → single candidate), `:123-131` (per-image catch, loop continues) |
| AC-PREVIEW014-03 | 002 | T4, T5, T6 | `:121` (two candidates only when decoded !== src), `:123-131` (break on first success; both fail → src kept) |
| AC-PREVIEW014-04 | 004 | T7, T8, T9, T10 | `:91-94` (http/https/data skip, unchanged), `:113` (absolute `/` path not decoded), `:96-99` + `:126` (cache keyed by original src) |
| AC-PREVIEW014-05 | 005 | T11 | No normalization in `toAbsolute`; every candidate goes through `readImageAsBase64` IPC |

Security — Rust boundary (read):

```rust
// src-tauri/src/commands/file_ops.rs:10-13
pub(crate) fn has_parent_dir_escape(path: &str) -> bool {
    Path::new(path).components().any(|c| matches!(c, std::path::Component::ParentDir))
}
// :22-30 validate_path -> Err("Invalid path: path traversal not allowed") when has_parent_dir_escape
// src-tauri/src/commands/image_ops.rs:129-137
pub async fn read_image_as_base64(image_path: String) -> Result<String, String> {
    let path = validate_path(&image_path)?;      // rejection happens here, before exists()/fs::read
    if !path.exists() { ... }
    let data = std::fs::read(&path) ...
```

Case analysis:

- `%2E%2E/%2E%2E/secret.png` → decoded `../../secret.png` → candidate `/docs/../../secret.png` → `ParentDir` component → `validate_path` returns Err before `exists()` or `fs::read`. The original-path candidate `/docs/%2E%2E/%2E%2E/secret.png` is a literal directory name (same as before the fix). T11 pins that the frontend forwards `..` unnormalized.
- `%2e%2e%2f` lower-case → `decodeURIComponent` is case-insensitive → `../` → same rejection.
- Double-encoded `%252E%252E/x` → decoded once to `%2E%2E/x` → literal name, no escape (single decode only).
- `%5C` on Windows: `..%5Csecret.png` → `..\secret.png` → `C:\docs\..\secret.png` → `ParentDir` on Windows → rejected. On macOS/Linux `\` is not a separator, so it is a literal file name `..\secret.png` inside mdDir — no escape.
- `%2Fetc%2Fpasswd` (does not start with `/`) → decoded `/etc/passwd` → joined as `/docs//etc/passwd` → stays under mdDir.
- `.%2F..%2Fx` → `./../x` → `./` stripped → `/docs/../x` → rejected.
- Threat-model note: absolute `/`-prefixed srcs were already read without any directory restriction before this change (`validate_path` only blocks `..`), so decode-first adds no capability that the markdown author did not already have. No newly reachable file found.

### 3. Baseline-attribution

All Evidence above was produced in this audit run against HEAD `838fb17` in the `preview-korean-img` worktree. Logs: `.moai/state/verify/preview-014-auditor/{imageResolver,usePreview,typecheck,lint,full-vitest,spec-lint}.log`, mutants `mut/{rev,nodecode}.log`. Nothing was carried over from the run agent's logs; the run agent's `preview-013/red.log` (`7 failed | 4 passed (11)`) and `full.log` (`Tests  1604 passed (1604)`, line 791) were read and found consistent with the independent results.

progress.md §E.4 label check:

| Row | Label | Auditor finding |
|-----|-------|-----------------|
| vitest imageResolver+usePreview 17 passed | orchestrator direct | True — `preview-013-orch/v5-after-renumber-tests.log`: `Tests  17 passed (17)`; re-run here 11 + 6 |
| typecheck exit 0 | orchestrator direct | True — v6 log exists; re-run here exit 0 |
| lint exit 0 | orchestrator direct | True — v7 log exists; re-run here exit 0 |
| moai spec lint exit 0 | orchestrator direct | No log on disk (D3); re-run here exit 0 |
| RED 7 failed / 4 passed | run agent report | True — `preview-013/red.log:161`; reproduced by Mutant B |
| full vitest 105 / 1604 | run agent report | True — now independently observed (exit 0, 105/1604) |

Consistency checks:

- `grep -rnE 'PREVIEW-?013'` (excluding node_modules/.git/target/.moai/state): hits only in SPEC-014 HISTORY row 1.0.2, `CHANGELOG.md:15` (discarded Web Worker plan; line 15, not ~12), `SPEC-IMG-MODE-003/spec.md:75,284`, `SPEC-IMG-LOAD-002/spec.md:75` (older Worker-plan references). No unexpected hits. `.moai/state/verify/preview-013*` folders and `red.log` test titles carry 013 (D2).
- Counts: 11 tests (test file T1..T11), 7 RED failures, 5 REQ (`spec.md:47-70`), 5 AC (`acceptance.md:29-53`) — agree across SPEC, tests, CHANGELOG, progress.md.
- Changed source files: exactly 2 (`imageResolver.ts`, `imageResolver.test.ts`) — matches DoD "plan.md 변경 표의 2개".
- `spec.md` frontmatter `version: 1.0.2`, `status: implemented` (not `completed`) — correct given manual acceptance is pending.
- CHANGELOG `&` handling: entry says "공백·`&`가 들어간 파일명" as a remaining limitation — names the intended character `&` correctly (SPEC explains the `&amp;` mechanism); no overclaim.
- CHANGELOG overclaim check: explicitly states in-app manual check and Windows real-device check are still open — not overclaiming. Only defect is jargon (D1).

### 4. Gaps (not observed by this auditor)

- Manual in-app acceptance (open a document with Korean-named images in the real Tauri app preview) — not performed; requires the user.
- Windows real-device behavior (including NFC/NFD) — not tested; only reasoned from `std::path` semantics.
- Rust `validate_path` was read, not executed with the specific decoded inputs; no `cargo test` run in this audit (Rust code is unchanged by this SPEC).
- Coverage not measured — no vitest coverage provider installed (consistent with progress.md).
- markdown-it's encoding behavior (`도` → `%EB%8F%84`, `%` → `%25`, `&` → `&amp;`) was taken from the SPEC; not re-measured here.
- Cross-model audit backends (codex/glm) not invoked.

### 5. Residual-risk

- The fix relies on markdown-it always percent-encoding non-ASCII in link destinations; a renderer upgrade changing that would only cost one extra failed IPC (fallback covers it), not a regression.
- Files whose names contain both a valid `%XX` sequence and non-ASCII characters (`도%20.png`) depend on markdown-it's mixed handling; decode → `도 .png` fails, original `%EB%8F%84%20.png` also fails → image stays broken. Edge case, out of SPEC scope.
- HTML export (`src/lib/export/exportHtml.ts` `embedLocalImages`) still carries the same defect — documented as follow-up in SPEC and CHANGELOG.
- Repeated failing encoded images double their IPC cost (D6).
