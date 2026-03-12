# SPEC-IMG-MODE-001: Image Insert Mode Setting

## Metadata

| Field | Value |
|-------|-------|
| SPEC ID | SPEC-IMG-MODE-001 |
| Title | Image Insert Mode Setting |
| Created | 2026-03-12 |
| Status | Completed |
| Priority | Medium |
| Lifecycle | spec-first |

---

## Environment

- Tauri 2 desktop application with React 18 + TypeScript frontend
- CodeMirror 6 editor with paste/drop event handlers
- Zustand state management with localStorage persistence
- Existing image paste flow: clipboard -> base64 -> Tauri IPC -> file save -> markdown link
- `fileToBase64()` utility already exists and produces `data:image/...;base64,...` strings
- Preview renderer already handles data URIs natively (no rendering changes needed)

## Assumptions

- Users who prefer inline-blob mode accept larger `.md` file sizes (base64 images embedded directly)
- The existing `fileToBase64()` function output is suitable for direct embedding in markdown
- Drag-and-drop from filesystem is NOT affected by this setting (always uses file-save via backend)
- Only clipboard paste behavior changes based on the setting
- The setting should persist across application restarts via localStorage

## Requirements

### REQ-1: Default Image Insert Mode

The system **shall** use `inline-blob` as the default image insert mode for clipboard paste operations.

### REQ-2: Inline-Blob Mode Behavior

**WHEN** the image insert mode is set to `inline-blob` **AND** the user pastes an image from clipboard, **THEN** the system **shall** convert the image to a base64 data URI and insert `![image](data:image/png;base64,...)` directly into the markdown content without calling the Tauri backend.

### REQ-3: File-Save Mode Behavior

**WHEN** the image insert mode is set to `file-save` **AND** the user pastes an image from clipboard, **THEN** the system **shall** save the image to the `./images/` folder via Tauri IPC and insert `![image](./images/{timestamp}.png)` into the markdown content (existing behavior).

### REQ-4: Setting Persistence

The system **shall** persist the `imageInsertMode` setting across application restarts using the existing Zustand persist mechanism.

### REQ-5: Settings UI Control

**WHERE** the settings panel exists, the system **shall** provide a user-configurable control to switch between `inline-blob` and `file-save` image insert modes.

### REQ-6: Drag-and-Drop Unaffected

**WHILE** processing drag-and-drop image events, the system **shall** continue using the existing file-save behavior regardless of the `imageInsertMode` setting.

## Specifications

### Data Model

```typescript
type ImageInsertMode = 'inline-blob' | 'file-save';

// Added to settings store
interface SettingsState {
  imageInsertMode: ImageInsertMode;
  setImageInsertMode: (mode: ImageInsertMode) => void;
}
```

### Files to Modify

| File | Change Description |
|------|--------------------|
| `src/store/` (settings store) | Add `imageInsertMode` field with default `'inline-blob'`, persist via Zustand |
| `src/lib/image/imageHandler.ts` | Branch `handleImagePaste()` on `imageInsertMode` setting |
| Settings UI component | Add toggle/select for image insert mode |

### Files NOT Modified

| File | Reason |
|------|--------|
| `src-tauri/src/commands/image_ops.rs` | No backend changes needed |
| `src/lib/image/imageResolver.ts` | Already handles data URIs |
| `src/lib/markdown/renderer.ts` | Already renders data URIs |
| `src/components/editor/MarkdownEditor.tsx` | Paste handler delegates to imageHandler (no change needed) |

### Traceability

| Requirement | Test | Acceptance Criteria |
|-------------|------|---------------------|
| REQ-1 | UT-1 | Default mode is inline-blob |
| REQ-2 | UT-2, AC-1 | Paste inserts base64 data URI |
| REQ-3 | UT-3, AC-2 | Paste saves file and inserts path |
| REQ-4 | UT-4, AC-3 | Setting survives restart |
| REQ-5 | UT-5, AC-4 | UI toggle changes mode |
| REQ-6 | UT-6 | Drop always uses file-save |
