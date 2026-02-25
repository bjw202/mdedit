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

## Full lesson-learned: .moai/learning/lesson-learned.md
