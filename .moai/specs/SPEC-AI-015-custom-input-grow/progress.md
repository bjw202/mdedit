# SPEC-AI-015 — progress

## §E.2 Run-phase Evidence

Baseline: branch WT-custom-input-grow, base 5c617ae (plan commit 7890189), run HEAD 0f4cefb (this run, this tree). cycle_type=tdd.

### RED (verbatim, captured before GREEN — `npx vitest run src/test/aiSelectionToolbar.test.ts`)

```
 Test Files  1 failed (1)
      Tests  28 failed | 79 passed (107)
 × ... > morphs into an auto-growing textarea ... (SPEC-AI-015 REQ-001)
     → expected 'INPUT' to be 'TEXTAREA' // Object.is equality
 × computeCustomMenuWidth: ... > (800, 0) → null
     → computeCustomMenuWidth is not a function
 (6x computeCustomMenuWidth, 3x computeCustomInputMaxHeight, 6x computeCustomInputHeight "is not a function")
 wiring: "expected false to be true" x4, "expected "spy" to not be called at all, but actually been called 1 times" x3 (IME/Shift+Enter),
         "expected "spy" to be called with arguments: [ '더 짧게\n존댓말로' ]" (Enter trim, multi-line)
```

### Gates

| # | Command | Exit | Result |
|---|---------|------|--------|
| 1 | `npm run typecheck` (`tsc --noEmit`) | 0 | no output errors |
| 2 | `npm run lint` (eslint --max-warnings 0) | 0 | no output errors |
| 3a | `npx vitest run src/test/aiSelectionToolbar.test.ts` | 0 | Test Files 1 passed; Tests 107 passed (107) |
| 3b | `npx vitest run src/test/aiSuggestionCard` | 0 | Test Files 4 passed; Tests 89 passed (89) |
| 4 | `npx playwright test e2e/ai-custom-input-grow.spec.ts e2e/ai-inline-edit.spec.ts e2e/ai-008-diagram-submenu-flip.spec.ts` (webkit) | 0 | 19 passed |
| 5 | `npx vitest run --dir src` (final, single run) | 0 | Test Files 118 passed; Tests 2071 passed (2071) |
| 6 | `git diff --stat origin/main...HEAD -- src e2e package.json` | - | 4 files: ai-selection-toolbar.ts, mdedit-components.css, aiSelectionToolbar.test.ts, e2e/ai-custom-input-grow.spec.ts (732+/25-); package.json unchanged |

Note on gate 6: plain `git diff origin/main` also lists unrelated files because origin/main moved ahead of this branch's base; the three-dot form (merge-base 5c617ae) is the attributable scope. `ai-suggestion-card.ts` diff vs base: 0 lines. CSS diff touches `.mdedit-ai-direct-*` only by removing the `custom` selectors from shared selector lists; direct declarations are byte-identical.

### REQ / AC status

| REQ | AC | Status | Evidence |
|-----|----|--------|----------|
| 001 | 001 | PASS | jsdom test: TEXTAREA, rows=1, placeholder, activeElement |
| 002 | 008 | PASS | CSS diff (selector removal only); aiSuggestionCard 89 tests pass |
| 003 | 004 | PASS | preset width/vertical rules unchanged (CSS diff; non-custom branch keeps viewport boundary); e2e preset width < 340 |
| 004 | 004 | PASS | jsdom (192/216/'' widths, `--custom`), pure fn table, e2e 340±2 and narrow-pane containment |
| 005 | 004 | PASS | jsdom: back button clears class and inline width |
| 006 | 005 | PASS | jsdom: rAF rescheduled on each mode change |
| 007 | 005, 006 | PASS | jsdom: preferred height 200, clip-ancestor boundary, max-height wiring (338px) |
| 008 | 006 | PASS | pure fn table; jsdom wiring; e2e 3-line growth and 60-line scroll |
| 009 | 002 | PASS | jsdom Enter/blank Enter; e2e Enter sends |
| 010 | 002 | PASS | jsdom Shift+Enter not prevented |
| 011 | 007 | PASS | jsdom no extra rAF on input; e2e `--above` kept after 60 lines |
| 012 | 003 | PASS (jsdom) | isComposing / keyCode 229 Enter, composing Escape |
| 013 | 003 | PASS | SPEC-AI-011 diagram tests unchanged and passing in the 107 |
| 014 | 006 | PASS | pure fn: floor 28 |
| - | 009 | PASS | scope check above, typecheck+lint exit 0 |

Manual M-1, M-2, M-3 (real WKWebView IME / long multi-line): PENDING for the user.

### Decisions

- jsdom rect mock returns the applied width (inline width, else 340 when `--custom`) per AC-004 note.
- e2e uses a long wrapping line: with a short line the CodeMirror scroller (the real clipping ancestor) shrinks to content width, so "wide pane" cannot hold. Observation, not changed (pre-existing BUG-2 clip logic).
- e2e "narrow pane" asserts containment (+ width <= 342); the mid-line `width < 340` assertion from plan was not asserted separately (anchor position is not deterministic across fonts).

## §E.3 Run-phase Audit-Ready Signal

run_status: audit-ready
run_complete_commit: 0f4cefb (M1 10b7c5f, M2 115021a, M3 0f4cefb; progress evidence in the following commit)

## §E.4 Sync-phase Audit-Ready Signal

sync_status: implemented (not completed; manual checks M-1, M-2, M-3 pending)
sync_complete_at: 2026-11-13
sync_commit_sha: pending-backfill (a commit cannot name its own SHA)
verified_tree: merge commit 3bed440 (origin/main merged into WT-custom-input-grow)
changelog_entry_position: CHANGELOG.md [Unreleased] / Changed, first entry
frontmatter_status_transitions: spec.md draft -> implemented, updated 2026-11-13 (only spec.md carries frontmatter)
docs_sync: README.md and docs/USER_GUIDE.md mention only the direct-input preset and Enter, which stays accurate; left untouched

### Verification (post-merge of origin/main, run in this worktree)

| Check | Result |
|-------|--------|
| tsc --noEmit | exit 0 |
| vitest targeted (aiSelectionToolbar + aiSuggestionCard) | 166 passed |
| vitest full | 2131 passed (121 files) |
| eslint --max-warnings 0 | exit 0 |
| Playwright webkit e2e/ai-custom-input-grow.spec.ts | 7 passed |

### Gaps

- REQ-012 (IME guard: isComposing / keyCode 229) is verified only in jsdom, not in a real WKWebView.
- Manual M-1 (Korean IME Enter), M-2 (IME Escape), M-3 (multi-line ceiling; dark-mode suggestion card unchanged) are PENDING for the user. The SPEC moves to completed after they pass.
