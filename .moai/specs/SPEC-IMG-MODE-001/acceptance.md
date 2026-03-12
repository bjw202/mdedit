# Acceptance Criteria: SPEC-IMG-MODE-001

## Test Scenarios

### AC-1: Inline-Blob Mode Paste (REQ-2)

```gherkin
Given the imageInsertMode setting is "inline-blob"
And the user has an image in the clipboard
When the user pastes in the editor
Then the editor inserts "![image](data:image/png;base64,...)" at the cursor position
And no Tauri IPC call to saveImageFromClipboard is made
And no file is created in the ./images/ folder
```

### AC-2: File-Save Mode Paste (REQ-3)

```gherkin
Given the imageInsertMode setting is "file-save"
And the user has an image in the clipboard
When the user pastes in the editor
Then the system calls saveImageFromClipboard via Tauri IPC
And a file is saved to the ./images/ folder
And the editor inserts "![image](./images/{timestamp}.png)" at the cursor position
```

### AC-3: Setting Persistence (REQ-4)

```gherkin
Given the user changes imageInsertMode to "file-save"
When the application is closed and reopened
Then the imageInsertMode setting is still "file-save"
```

### AC-4: Settings UI Toggle (REQ-5)

```gherkin
Given the user opens the settings panel
When the user views the image settings section
Then a control for image insert mode is visible
And the control shows the current mode selection

Given the user selects "file-save" from the image insert mode control
When the selection is confirmed
Then the imageInsertMode in the store is updated to "file-save"
```

### AC-5: Default Mode (REQ-1)

```gherkin
Given a fresh installation with no prior settings
When the application starts
Then the imageInsertMode defaults to "inline-blob"
```

### AC-6: Drag-and-Drop Unaffected (REQ-6)

```gherkin
Given the imageInsertMode setting is "inline-blob"
When the user drags and drops an image file onto the editor
Then the system uses the file-save behavior (saves to ./images/ via backend)
And the setting does not affect drag-and-drop behavior
```

## Unit Test Plan

| Test ID | Description | Module |
|---------|-------------|--------|
| UT-1 | Default imageInsertMode is 'inline-blob' | Settings store |
| UT-2 | handleImagePaste in inline-blob mode returns data URI markdown | imageHandler |
| UT-3 | handleImagePaste in file-save mode calls saveImageFromClipboard IPC | imageHandler |
| UT-4 | imageInsertMode persists via Zustand persist | Settings store |
| UT-5 | setImageInsertMode updates store correctly | Settings store |
| UT-6 | handleImageDrop ignores imageInsertMode setting | imageHandler |

## Quality Gate Criteria

- All 6 unit tests pass
- Both paste modes produce valid markdown image syntax
- Setting persists in localStorage after store hydration
- No regressions in existing image paste/drop functionality
- No TypeScript type errors introduced

## Definition of Done

- [x] `imageInsertMode` setting added to store with default `'inline-blob'`
- [x] `handleImagePaste()` branches correctly on setting
- [x] Inline-blob mode skips Tauri IPC entirely
- [x] File-save mode preserves existing behavior exactly
- [x] Settings UI control is functional
- [x] All unit tests pass
- [x] Drag-and-drop behavior unchanged
- [x] Setting persists across app restart

## Traceability

| Acceptance Criteria | Requirement | Unit Test |
|--------------------|-------------|-----------|
| AC-1 | REQ-2 | UT-2 |
| AC-2 | REQ-3 | UT-3 |
| AC-3 | REQ-4 | UT-4 |
| AC-4 | REQ-5 | UT-5 |
| AC-5 | REQ-1 | UT-1 |
| AC-6 | REQ-6 | UT-6 |
