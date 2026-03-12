# Implementation Plan: SPEC-IMG-MODE-001

## Technical Approach

Minimal-change strategy: branch on a single setting in `handleImagePaste()`. The inline-blob path reuses the existing `fileToBase64()` function and skips the Tauri IPC call entirely.

## Milestones

### Primary Goal: Settings Store + Image Handler Logic

**Priority: High**

1. **Add `imageInsertMode` to settings store**
   - Add `imageInsertMode: ImageInsertMode` field (default: `'inline-blob'`)
   - Add `setImageInsertMode` action
   - Ensure field is included in Zustand persist configuration
   - Files: settings store (new or existing in `src/store/`)

2. **Branch `handleImagePaste()` on setting**
   - Read `imageInsertMode` from store
   - `inline-blob` path: call `fileToBase64()` -> insert `![image](data:...)` directly
   - `file-save` path: existing flow (call `saveImageFromClipboard()` IPC -> insert file path)
   - File: `src/lib/image/imageHandler.ts`

### Secondary Goal: Settings UI

**Priority: Medium**

3. **Add UI control in settings panel**
   - Add labeled toggle or select control
   - Options: "Inline (base64)" / "File save (./images/)"
   - Wire to `setImageInsertMode` store action
   - File: Settings UI component

### Final Goal: Tests

**Priority: High**

4. **Unit tests for both modes**
   - Test `handleImagePaste()` in inline-blob mode produces data URI
   - Test `handleImagePaste()` in file-save mode calls IPC
   - Test default setting is `inline-blob`
   - Test setting persistence (store serialization)
   - Test drag-and-drop is unaffected by setting

## Architecture Design Direction

```
Clipboard Paste
      |
      v
handleImagePaste()
      |
      +-- read imageInsertMode from store
      |
      +-- if 'inline-blob':
      |       fileToBase64() -> insert data URI markdown
      |
      +-- if 'file-save':
              saveImageFromClipboard() IPC -> insert file path markdown
```

No new modules, no new IPC commands, no Rust changes. The branching happens at a single point in `imageHandler.ts`.

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large base64 strings slow editor | Medium | This is user's choice; file-save mode available as alternative |
| Store migration for existing users | Low | Default to `inline-blob`; no migration needed (new field with default) |
| Clipboard API differences across OS | Low | Existing `fileToBase64()` already handles this |

## Dependencies

- No new library dependencies
- No Rust/backend changes
- Reuses existing `fileToBase64()` utility

## Traceability

| Milestone | Requirements |
|-----------|-------------|
| Primary Goal | REQ-1, REQ-2, REQ-3, REQ-4, REQ-6 |
| Secondary Goal | REQ-5 |
| Final Goal | All REQ verification |
