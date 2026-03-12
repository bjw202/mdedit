# Research: SPEC-IMG-MODE-001 Image Insert Mode Setting

## Codebase Analysis

### Current Image Paste Flow

1. **`src/components/editor/MarkdownEditor.tsx`** (Lines 210-262)
   - CodeMirror paste/drop event handlers registered via EditorView.domEventHandlers
   - `paste` handler: extracts image from clipboard, delegates to `handleImagePaste()`
   - `drop` handler: extracts file from drop event, delegates to `handleImageDrop()`

2. **`src/lib/image/imageHandler.ts`** (Lines 35-107)
   - `handleImagePaste()`: converts clipboard image to base64 via `fileToBase64()`, then calls `saveImageFromClipboard()` Tauri IPC, inserts `![image](./images/timestamp.png)`
   - `handleImageDrop()`: handles drag-and-drop from filesystem
   - `fileToBase64()`: already converts File object to `data:image/...;base64,...` string

3. **`src/lib/tauri/ipc.ts`** (Lines 123-156)
   - `saveImageFromClipboard(base64Data, filename)`: Tauri IPC wrapper calling Rust backend
   - `copyImageToFolder(sourcePath, destFolder)`: copies file to target
   - `readImageAsBase64(path)`: reads file and returns base64

4. **`src-tauri/src/commands/image_ops.rs`**
   - Rust backend: receives base64 data, saves to `./images/{timestamp}.png`

### Rendering (Already Supports data URIs)

5. **`src/lib/image/imageResolver.ts`** (Lines 18-58)
   - `resolveImageSrc()` already passes `data:` URIs unchanged (no transformation needed)

6. **`src/lib/markdown/renderer.ts`**
   - markdown-it with `imageResolverPlugin` - data URIs render natively

### State Management

7. **`src/store/`** - Zustand stores (editorStore.ts, uiStore.ts)
   - Settings are persisted via Zustand `persist` middleware with localStorage

### Key Findings

- `fileToBase64()` already exists and produces the exact format needed for inline-blob mode
- The preview renderer handles `data:image/...;base64,...` URIs natively - no changes needed
- No Rust backend changes needed for inline-blob mode (pure frontend path)
- Drag-and-drop from filesystem still needs backend for file copy; only clipboard paste affected
- Settings UI pattern exists in the codebase for reference

### Minimal Change Surface

The change is small and well-isolated:
- **imageHandler.ts**: Add branch on setting (primary change)
- **Settings store**: Add one field (`imageInsertMode`)
- **Settings UI**: Add one toggle/select
- **No backend changes** for the inline-blob path
