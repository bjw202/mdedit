## SPEC-UI-005 Progress

- Started: 2026-06-25
- Harness: standard
- Mode: TDD (solo, sub-agent)
- Language: TypeScript (moai-lang-typescript)

### Phase Trace
- Phase 0.9 complete: language=TypeScript → moai-lang-typescript
- Phase 0.95 complete: Scale-based mode = Standard (8 files, 1 domain)
- Phase 1: complete (manager-strategy — plan validation + tasks.md + MX map)
- Phase 2B complete: 2026-06-25 — TDD implementation (manager-tdd)
  - Cycle 1 (T-001): clipboard mock in src/test/setup.ts
  - Cycle 2 (T-002): uiStore statusMessage + setStatusMessage + single-flight timer + partialize exclude
  - Cycle 3 (T-003): Footer direct-subscribes to useUIStore.statusMessage (no prop drilling)
  - Cycle 4 (T-004): FileTreeNode handleCopyPath/handleCopyName + copy group menu items + divider
  - Tests: 478 passed (22 new), full suite green
  - Typecheck: pass (npx tsc --noEmit clean)
  - Lint: skipped (pre-existing: no ESLint config in repo)
  - Coverage tooling: skipped (@vitest/coverage-v8 not installed)
  - AC coverage: AC-001..005, 008, 009, 011, 012, 013, 016, 017, 018 = PASS; AC-014 (no deps change) PASS; AC-003a (keyboard) PASS via native <button> role="menuitem" verification
  - Divergence: AC-003a keyboard test uses native-button verification instead of fireEvent.keyDown (jsdom does not translate keydown→click on buttons; @testing-library/user-event not a dep and cannot be added per AC-014). Native <button> with role="menuitem" provides Enter/Space activation per HTML spec — contract verified by tagName check + click activation.
- Phase 2.8 complete: 2026-06-25 — independent review (manager-quality + evaluator-active): PASS with 4 test-hygiene nits + 1 test-strength note. Production code clean — no source changes.
- Phase 2.8b complete: 2026-06-25 — test-strength fixes (5 fixes, test-only)
  - Fix 1 (uiStore.test.ts): moved `vi.useFakeTimers()` from describe-body to `beforeEach`; added `vi.useRealTimers()` to `afterEach` to prevent fake-timer leak beyond SPEC-UI-005 describe block
  - Fix 2 (Footer.test.tsx): wrapped pre-render `useUIStore.setState` in `act(...)` (3 tests); reordered `afterEach` to `cleanup()` before store reset to eliminate React act() warnings
  - Fix 3 (FileTreeNode.test.tsx AC-011): removed tautological `.not.toThrow()` assertion (click handler uses `void` so rejection never re-throws synchronously); kept `waitFor(/failed/i)` as genuine catch-path verification with clarifying comment
  - Fix 4 (uiStore.test.ts): added EC-5 persist exclusion test — verifies `localStorage['mdedit-ui-store']` snapshot does NOT include `statusMessage` key after `setStatusMessage(msg)`
  - Fix 5 (FileTreeNode.test.tsx AC-003a): strengthened explanatory comment to explicitly document HTML-spec basis for keyboard activation, jsdom limitation, user-event dep absence, and AC-014 constraint
  - Tests: 479 passed (+1 vs Phase 2B baseline of 478; full suite green)
  - Typecheck: pass (npx tsc --noEmit clean, exit 0)
  - React act() warnings: resolved in Footer.test.tsx (0 warnings); pre-existing unrelated warnings in FileTreeNode.test.tsx AC-013 tests left as-is (out of scope)


