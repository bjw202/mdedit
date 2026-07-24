# Expert Debug Memory: Tauri/WKWebView CSS Visual Bugs

## Critical Rule: Diagnostic Overlay First
For any visual/CSS bug in Tauri/WKWebView, add a diagnostic overlay BEFORE attempting fixes.
Never trust getComputedStyle alone - it reports CSS values, not visual rendering.

## macOS/WKWebView Scrollbar
- macOS overlay scrollbars are INVISIBLE by default
- Use `overflow: scroll` (not auto) + `::-webkit-scrollbar` custom styles
- Include `::-webkit-scrollbar-corner` for bidirectional scroll

## Playwright vs Tauri Mismatch
- Playwright WebKit viewport (1280x720) differs from user's actual Tauri window
- Tables fitting on user's large screen won't overflow = no scrollbar
- Always verify in the actual Tauri app, not just Playwright tests

## Preview Panel Architecture (this project)
- MarkdownPreview: `overflow: scroll` with `.preview-scroll` class
- Tables: `border-collapse: separate; border-spacing: 0` (avoid WebKit border clipping)
- Panel-level scroll preferred over per-element scroll wrappers
- ResizablePanels has `overflow-hidden` on each pane

## Tauri v2 invoke silently rejects (command arg shape)
- A `#[tauri::command] fn cmd(args: MyStruct, ...)` deserializes `args` by the PARAM NAME.
  Frontend MUST send `invoke('cmd', { args: {...} })`, NOT flat `invoke('cmd', { ...fields })`.
- Flat spread → Tauri can't find `args` → command rejects BEFORE the body runs. If the
  frontend `.catch` swallows the reason with a generic string, it looks like a silent no-op.
- This codebase's other commands take individual named params (path, content) so the flat
  convention "looks right" — struct-param commands are the exception (ai_request/ai_cancel).
- Pure serde tests of the struct pass with flat JSON (fields match) and do NOT catch this —
  the mismatch is at Tauri's param-envelope layer. Guard it with a nested-envelope test.
- Always surface the invoke reject reason to the user (P7); Rust Err(String) is already a
  clean classified message. See ipcErrorMessage in src/lib/tauri/ipc.ts.

## AI toolbar e2e repro + menu clip boundary (SPEC-AI-008)
- [AI toolbar e2e repro](project-ai-toolbar-e2e-repro.md) — AI toolbar/menus reachable in Playwright e2e; CRITICAL: menu placement clips at the EDITOR PANE (overflow-hidden), NOT the window. Assert against `.md-editor` rect, not innerWidth (asserting on the window gives false passes — caused a wrong H4 verdict). getClipBoundary + flip-then-clamp inline offsets.

## Full lesson-learned: .moai/learning/lesson-learned.md
