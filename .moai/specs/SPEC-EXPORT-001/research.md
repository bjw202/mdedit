# Research: Markdown Export Feature (PDF/HTML/DOCX)

## Architecture Overview

The markdown-editor-rust is a Tauri v2 + React 18 desktop app with:
- **Frontend**: React 18, Zustand state management, Tailwind CSS
- **Backend**: Rust (Tauri v2), tauri-plugin-dialog, tokio, notify
- **Rendering**: markdown-it + Shiki v3 (syntax) + Mermaid v11 (diagrams)

## Rendering Pipeline

### Current Flow
1. Raw Markdown (`editorStore.content`)
2. `renderMarkdown()` in `src/lib/markdown/renderer.ts:56-96`
3. markdown-it with `html: false` (XSS prevention)
4. Plugins: mermaidPlugin, dataLinePlugin
5. Optional Shiki syntax highlighting
6. Returns HTML string
7. `PreviewRenderer.tsx:22-51` renders via `dangerouslySetInnerHTML`
8. Post-process: Mermaid diagrams rendered client-side as SVG

### Key Files
| Purpose | Path | Lines |
|---------|------|-------|
| Main renderer | `src/lib/markdown/renderer.ts` | 56-96 |
| Code highlighting | `src/lib/markdown/codeHighlight.ts` | 1-39 |
| Mermaid plugin | `src/lib/markdown/mermaidPlugin.ts` | 13-24 |
| Preview component | `src/components/preview/PreviewRenderer.tsx` | 22-51 |
| Preview hook | `src/hooks/usePreview.ts` | 27-62 |
| IPC wrapper | `src/lib/tauri/ipc.ts` | all |
| Rust commands | `src-tauri/src/lib.rs` | 18-29 |
| Rust file ops | `src-tauri/src/commands/file_ops.rs` | 85-111 |
| CSS styling | `src/index.css` | 25-117 |
| Header buttons | `src/components/layout/Header.tsx` | 31-54 |

## Reference Implementations

### Save Dialog Pattern (file_ops.rs:85-111)
```rust
#[tauri::command]
pub async fn save_file_as(app: tauri::AppHandle, content: String) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app.dialog().file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_save_file();
    match path {
        Some(file_path) => {
            std::fs::write(&path_buf, content.as_bytes())?;
            Ok(Some(path_str))
        }
        None => Ok(None),
    }
}
```

### IPC Wrapper Pattern (ipc.ts)
```typescript
export async function saveFileAs(content: string): Promise<string | null> {
    return invoke<string | null>('save_file_as', { content });
}
```

### Preview CSS Classes (index.css:25-117)
- `.preview-content h1-h6` - Heading styles
- `.preview-content code, pre` - Code block styles
- `.preview-content table` - Table styles
- `.preview-content .shiki` - Syntax highlighting
- `.preview-content .mermaid-container` - Diagram container

## Technology Evaluation

### PDF Generation
| Option | Approach | Pros | Cons | Recommendation |
|--------|----------|------|------|----------------|
| Webview Print API | Frontend print-to-PDF | 100% visual fidelity, no deps | Print dialog required | MVP |
| headless-chrome | Rust crate | Full programmatic control | Large dependency | Future |
| printpdf/genpdf | Pure Rust | No external deps | Cannot render Mermaid/Shiki | Not recommended |

### HTML Export
| Option | Approach | Pros | Cons | Recommendation |
|--------|----------|------|------|----------------|
| Self-contained | Inline CSS + embedded SVG | Single file, offline | Larger file size | Recommended |
| Linked CSS | External stylesheets | Small file | Not portable | Not recommended |

### DOCX Export
| Option | Approach | Pros | Cons | Recommendation |
|--------|----------|------|------|----------------|
| `docx` npm | Frontend TS | Fine control, active maintenance | Mermaid needs PNG | Recommended |
| `docx-rs` | Rust backend | Zero JS overhead | Verbose API | Alternative |
| html-docx | HTML conversion | Simple | Loses formatting | Not recommended |

## Mermaid Diagram Handling
- **PDF**: SVG preserved automatically via webview print
- **HTML**: SVG embedded inline (already rendered in DOM)
- **DOCX**: Pre-render to PNG via canvas, embed as image

## Shiki Syntax Highlighting
- Generates inline-styled `<span>` elements
- Themes: `github-dark`, `github-light` (configured in `codeHighlight.ts`)
- **PDF/HTML**: Inline styles preserved automatically
- **DOCX**: Convert colored spans to `docx.TextRun` with color properties

## State Management (Export Context)
- `editorStore.content` - Raw Markdown source
- `uiStore.theme` - Current theme (dark/light) for Shiki theme selection
- `fileStore.currentFile` - Current filename for export default name

## Quality Baseline
- 305 passing tests (227 frontend + 78 backend)
- TypeScript strict mode enabled
- Both frontend/backend build successfully
- ESLint config missing (noted but not blocking)

## Dependencies to Add
**Frontend (package.json):**
- `docx` (~50KB gzip) - DOCX generation

**Backend (Cargo.toml):** None for MVP

## Constraints
1. `html: false` in markdown-it is a security requirement (never override)
2. Mermaid renders client-side only (async SVG injection)
3. Shiki theme currently hardcoded to `github-light` in renderer.ts:75
4. Cross-platform path handling required (Windows `\` vs Unix `/`)
