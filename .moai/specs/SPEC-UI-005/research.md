# SPEC-UI-005 Research — File Explorer Copy Path / Copy Name

## 1. File tree architecture & handler placement

### Data Flow Analysis

**FileExplorer → FileTree → FileTreeNode hierarchy:**
- `src/components/sidebar/FileExplorer.tsx:100-125` - Uses `useFileStore()` to access `fileTree`, `watchedPath`, `isLoading`, and provides `handleRefresh` callback that calls `readDirectory` IPC and updates store via `setFileTree`
- `src/components/sidebar/FileTree.tsx:25-42` - Receives `nodes` and `onRefresh` as props, maps over sorted nodes and renders `FileTreeNode` for each, passing `onRefresh` down
- `src/components/sidebar/FileTreeNode.tsx:92-88` - Receives `node`, `depth`, and `onRefresh` props. Context menu actions (lines 280-320) call `useFileSystem()` hook methods: `createFile`, `deleteNode`, `renameNode`, `openFolderPath`

**Node data structure (from SPEC-UI-002:102-109):**
```typescript
interface FileNode {
  name: string;          // 파일/폴더 이름
  path: string;          // 절대 경로
  isDirectory: boolean;  // 디렉토리 여부
  children?: FileNode[]; // 하위 항목 (디렉토리만)
  extension?: string;    // 파일 확장자 (.md, .txt 등)
}
```

**Existing action pattern (FileTreeNode.tsx:158-183):**
- `handleRenameConfirm` (lines 158-165): Calls `renameNode(node.path, renameValue.trim())` → `onRefresh()`
- `handleCreateConfirm` (lines 167-176): Calls `createFile(dirPath, createValue.trim())` → `onRefresh()`
- `handleDelete` (lines 178-183): Calls `deleteNode(node.path)` → `onRefresh()`

**onRefresh callback propagation:**
- `FileExplorer.tsx:121-125` - Creates `handleRefresh` that reads directory and updates store
- `FileTree.tsx:11-12` - Receives `onRefresh` prop
- `FileTree.tsx:37` - Passes to `FileTreeNode`
- `FileTreeNode.tsx:87` - Receives `onRefresh` prop
- `FileTreeNode.tsx:161,171,181` - Uses after file operations

### Handler Placement Recommendation

**Inline in FileTreeNode.tsx** (RECOMMENDED)

**Justification:**
1. **Existing pattern consistency**: All context menu actions (rename, delete, create) are already handled inline in FileTreeNode.tsx via callbacks to `useFileSystem()` hook
2. **No filesystem side effects**: Clipboard operations are read-only (copying path/name to clipboard) - no need for IPC or file system modification
3. **Immediate access to node data**: Both `node.path` and `node.name` are already available as component props
4. **No refresh needed**: Unlike create/delete/rename operations, clipboard operations don't modify the filesystem, so no `onRefresh()` call is required
5. **Similar complexity to existing actions**: Context menu items are simple onClick handlers that can directly call clipboard API

**Comparison with alternatives:**

**Option A: useFileSystem hook** (NOT RECOMMENDED)
- Hook is designed for Tauri IPC file operations (open, save, create, delete, rename)
- Clipboard operations are not filesystem operations - they're browser/WKWebView APIs
- Would unnecessarily couple clipboard functionality to file system concerns

**Option B: New clipboard wrapper** (NOT RECOMMENDED)
- Clipboard operations are simple one-liners: `navigator.clipboard.writeText(text)`
- No complex business logic or validation required
- Existing pattern (see `imageHandler.ts:36-69`) shows clipboard paste handling inline in handlers
- Creating a new module for a single API call would be over-engineering

**Handler placement:**
```typescript
// In FileTreeNode.tsx, add to existing context menu (after line 303, before "Rename")
<button
  role="menuitem"
  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
  onClick={() => { setContextMenu(null); handleCopyPath(); }}
>
  Copy Path
</button>
<button
  role="menuitem"
  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
  onClick={() => { setContextMenu(null); handleCopyName(); }}
>
  Copy Name
</button>

// Add handler functions (near line 184)
const handleCopyPath = useCallback(async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(node.path);
    // TODO: Show transient status message in Footer (section 2)
  } catch (err) {
    console.error('[FileTreeNode] Failed to copy path:', err);
  }
}, [node.path]);

const handleCopyName = useCallback(async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(node.name);
    // TODO: Show transient status message in Footer (section 2)
  } catch (err) {
    console.error('[FileTreeNode] Failed to copy name:', err);
  }
}, [node.name]);
```

## 2. Footer status message mechanism

### Current Footer Implementation

**Footer component structure (`src/components/layout/Footer.tsx:1-78`):**
- Receives props: `lineCount`, `cursorLine`, `cursorCol`, `encoding`, `saveStatus`, `wordCount`, `charCount`, `scrollSyncEnabled`, `onScrollSyncToggle`
- Displays static status information only - no transient message channel
- Layout: Left side (save status, line count, word count, char count), Right side (scroll sync toggle, cursor position, encoding)

**SaveStatus type (`src/store/uiStore.ts:11`):**
```typescript
export type SaveStatus = 'new' | 'saved' | 'unsaved' | 'saving';
```

**UIStore state (`src/store/uiStore.ts:21-50`):**
- Current fields: `sidebarWidth`, `previewWidth`, `theme`, `fontSize`, `sidebarCollapsed`, `saveStatus`, `scrollSyncEnabled`, `lastWatchedPath`, `imageInsertMode`, `viewMode`
- Actions: Setters for each field, `toggleSidebar`, `toggleScrollSync`
- **NO existing transient status message field**
- **NO existing setTimeout/clearTimeout pattern**

### Recommended Status Message API

**Store field addition (in `src/store/uiStore.ts`):**

Add to interface UIState (after line 36):
```typescript
/** Transient status message for clipboard operations, file saves, etc. */
statusMessage: string | null;
```

Add to initial state (after line 67):
```typescript
statusMessage: null,
```

Add action (after line 49):
```typescript
/** Sets a transient status message that auto-clears after 2 seconds */
setStatusMessage: (message: string | null) => void;
```

Add action implementation (after line 83):
```typescript
setStatusMessage: (message: string | null) => {
  set({ statusMessage: message });
  if (message) {
    setTimeout(() => {
      set({ statusMessage: null });
    }, 2000);
  }
},
```

**Footer rendering addition (in `src/components/layout/Footer.tsx`):**

Add to FooterProps interface (after line 12):
```typescript
statusMessage?: string | null;
```

Add to left side of footer (after line 51):
```typescript
{statusMessage && (
  <span className="text-blue-600 dark:text-blue-400">
    {statusMessage}
  </span>
)}
```

**Usage in FileTreeNode handlers:**
```typescript
const { setStatusMessage } = useUIStore();

const handleCopyPath = useCallback(async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(node.path);
    setStatusMessage('Path copied to clipboard');
  } catch (err) {
    console.error('[FileTreeNode] Failed to copy path:', err);
  }
}, [node.path, setStatusMessage]);
```

**Rationale for auto-clear pattern:**
- 2-second duration matches user expectation for "operation completed" feedback
- setTimeout in store ensures message clears regardless of component unmount
- Null check prevents unnecessary timers when clearing message programmatically
- Simple pattern used in most apps (no complex timer management needed)

## 3. Clipboard API selection

### Package.json Dependencies Analysis

**No clipboard plugin installed** (`package.json:19-58`):
- Tauri API v2: `@tauri-apps/api: ^2` (line 27)
- Tauri plugins: `@tauri-apps/plugin-opener: ^2`, `@tauri-apps/plugin-shell: ^2.3.5` (lines 28-29)
- **NO** `@tauri-apps/plugin-clipboard-manager`

**Tauri capabilities (`src-tauri/capabilities/main.json:1-15`):**
- Permissions: `core:default`, `dialog:allow-open`, `dialog:allow-save`, `dialog:allow-message`, `opener:default`, `shell:allow-execute`, `shell:allow-spawn`
- **NO** clipboard permissions

**CSP configuration (`src-tauri/tauri.conf.json:21-27`):**
```json
"security": {
  "csp": null,
  "assetProtocol": {
    "enable": true,
    "scope": []
  }
}
```
- **CSP is null** - no Content Security Policy restrictions
- This means `navigator.clipboard` is allowed in WKWebView

### Existing Clipboard Usage

**Image paste handling (`src/lib/image/imageHandler.ts:36-69`):**
```typescript
export async function handleImagePaste(
  view: EditorView,
  event: ClipboardEvent,
  mdFilePath: string,
): Promise<boolean> {
  const items = event.clipboardData?.items;
  if (!items) return false;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;
      // ... save image logic
    }
  }
  return false;
}
```
- Uses **`event.clipboardData`** (READ-ONLY access to clipboard data)
- This is browser standard API, not Tauri plugin
- Shows clipboard READ is already working in the app

**No existing clipboard WRITE usage:**
- `grep -r "clipboard.writeText\|navigator.clipboard" src/` - No results
- `grep -r "clipboard.*manager\|writeText" src/` - No results
- Image paste only READS clipboard, does not write

### Clipboard API Recommendation

**Use `navigator.clipboard.writeText()`** (RECOMMENDED)

**Rationale:**

1. **No Tauri plugin dependency**: App already has clipboard READ working via `event.clipboardData` - this proves WKWebView supports clipboard APIs
2. **CSP is null**: No Content Security Policy blocking (tauri.conf.json:22)
3. **Standard browser API**: `navigator.clipboard.writeText()` is supported in:
   - WKWebView (Tauri's macOS webview)
   - WebView2 (Tauri's Windows webview)
   - All modern browsers
4. **No plugin installation required**: Avoids adding `@tauri-apps/plugin-clipboard-manager` dependency
5. **Consistent with existing pattern**: Image paste uses standard clipboard API (`event.clipboardData`), not Tauri plugin
6. **Write-only operation**: `navigator.clipboard.writeText()` requires user gesture (onClick handler) - satisfied by context menu click
7. **No permissions needed**: Clipboard write is allowed by default in Tauri WKWebView when CSP is null

**Implementation:**
```typescript
// In FileTreeNode.tsx handlers
const handleCopyPath = useCallback(async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(node.path);
    setStatusMessage('Path copied to clipboard');
  } catch (err) {
    console.error('[FileTreeNode] Failed to copy path:', err);
  }
}, [node.path]);
```

**Alternative NOT recommended:**
- `@tauri-apps/plugin-clipboard-manager`: Adds unnecessary dependency, requires plugin installation and capability configuration, standard API works fine

## 4. SPEC-UI-002 alignment

### SPEC-UI-002 Requirements Review

**Context menu requirements (SPEC-UI-002:42):**
- **REQ-UI002-E03**: WHEN 사용자가 파일 또는 폴더 노드를 우클릭할 때, THEN 시스템은 컨텍스트 메뉴(새 파일, 새 폴더, 이름 변경, 삭제)를 표시해야 한다.

**Current context menu items (`src/components/sidebar/FileTreeNode.tsx:280-320`):**
- Line 289-295: "New File" (directories only)
- Line 296-302: "New Folder" (directories only)
- Line 306-312: "Rename" (all nodes)
- Line 313-319: "Delete" (all nodes)

### Alignment Analysis

**NEW FEATURE EXTENDS SPEC-UI-002 (no conflict):**
1. **Adds to existing menu**: Copy Path/Copy Name are new menu items in the existing context menu structure
2. **Same interaction pattern**: Right-click → context menu → select item (matches REQ-UI002-E03)
3. **No destructive operation**: Unlike Delete, clipboard operations are read-only (no confirmation needed)
4. **Works for all node types**: Like Rename/Delete, both Copy Path and Copy Name work for files and folders
5. **No filesystem modification**: Doesn't trigger `onRefresh()` - doesn't affect file tree state

**Acceptance criteria from SPEC-UI-002 to respect:**
- **REQ-UI002-U03**: FileNode data model (`{ name, path, isDirectory, children?, extension? }`) - Use `node.path` and `node.name` directly
- **REQ-UI002-N04**: 시스템은 파일 시스템 오류 발생 시 사용자에게 알림 없이 실패하지 않아야 한다 - Clipboard errors should be logged but not crash UI
- **Performance requirement** (SPEC-UI-002:133): 컨텍스트 메뉴 표시: < 16ms - Clipboard operations are async, won't block menu rendering

**New menu item placement:**
- Insert "Copy Path" and "Copy Name" AFTER "Rename" (line 312)
- BEFORE "Delete" (line 313) - keeps destructive operation at bottom
- No separator needed (group with Rename as non-destructive operations)

**No SPEC-UI-002 conflicts identified.**

## 5. Test patterns

### FileTreeNode Test Analysis

**Test file location:** `src/test/FileTreeNode.test.tsx`

**Context menu testing pattern (lines 95-114):**
```typescript
it('should show context menu on right-click', () => {
  render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
  const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
  fireEvent.contextMenu(nodeEl);
  expect(screen.getByRole('menu')).toBeInTheDocument();
});

it('should hide context menu when clicking outside', () => {
  // ... renders menu, clicks outside, verifies menu removed
});
```

**Menu item interaction pattern (lines 116-142):**
```typescript
it('should show rename input when Rename is selected from context menu', () => {
  render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
  const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
  fireEvent.contextMenu(nodeEl);
  fireEvent.click(screen.getByText('Rename'));
  expect(screen.getByRole('textbox')).toBeInTheDocument();
});
```

**Query method:**
- `screen.getByRole('menu')` - finds context menu container
- `screen.getByText('Rename')` - finds menu item by text content
- `fireEvent.contextMenu()` - triggers right-click
- `fireEvent.click()` - triggers menu item selection

### Vitest Configuration

**No vitest config file found** - using default vitest configuration
- Test environment: jsdom (inferred from `@testing-library/jest-dom` usage)
- No existing clipboard mocks

**Test setup (`src/test/setup.ts:1-16`):**
```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia for jsdom environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```
- **NO existing clipboard mock**
- Pattern established: Mock missing browser APIs in setup.ts

### Footer Test Analysis

**Test file location:** `src/test/Footer.test.tsx`

**Prop-based testing pattern (lines 8-29):**
```typescript
it('shows line count', () => {
  render(<Footer lineCount={42} />);
  expect(screen.getByText('Lines: 42')).toBeInTheDocument();
});

it('shows cursor position', () => {
  render(<Footer cursorLine={5} cursorCol={10} />);
  expect(screen.getByText('Ln 5, Col 10')).toBeInTheDocument();
});
```

**Status message test pattern (lines 31-53):**
```typescript
it('shows "Saved" when saveStatus is "saved"', () => {
  render(<Footer saveStatus="saved" />);
  expect(screen.getByText('Saved')).toBeInTheDocument();
});
```

**Transient timer test strategy:**
- Use `vi.useFakeTimers()` for auto-clear behavior
- Use `vi.advanceTimersByTime(2000)` to fast-forward timer
- Verify message appears then disappears after timeout

### Recommended Test Strategy

**Clipboard mock setup (add to `src/test/setup.ts`):**
```typescript
// Mock navigator.clipboard.writeText for jsdom environment
// jsdom does not implement clipboard API, so we provide a minimal mock
Object.defineProperty(window, 'navigator', {
  writable: true,
  value: {
    ...window.navigator,
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  },
});
```

**FileTreeNode clipboard tests (add to `src/test/Footer.test.tsx`):**
```typescript
describe('FileTreeNode: clipboard operations', () => {
  beforeEach(() => {
    useFileStore.setState({
      fileTree: [],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: null,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it('should copy path to clipboard when Copy Path is selected', () => {
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    
    fireEvent.contextMenu(nodeEl);
    fireEvent.click(screen.getByText('Copy Path'));
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/project/readme.md');
  });

  it('should copy name to clipboard when Copy Name is selected', () => {
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    
    fireEvent.contextMenu(nodeEl);
    fireEvent.click(screen.getByText('Copy Name'));
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('readme.md');
  });
});
```

**Footer transient status test (add to `src/test/Footer.test.tsx`):**
```typescript
describe('Footer: transient status message', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows status message when provided', () => {
    render(<Footer statusMessage="Path copied" />);
    expect(screen.getByText('Path copied')).toBeInTheDocument();
  });

  it('auto-clears status message after 2 seconds', () => {
    const { rerender } = render(<Footer statusMessage="Path copied" />);
    expect(screen.getByText('Path copied')).toBeInTheDocument();
    
    vi.advanceTimersByTime(2000);
    rerender(<Footer statusMessage={null} />);
    
    expect(screen.queryByText('Path copied')).not.toBeInTheDocument();
  });
});
```

**UIStore transient message test (new file `src/test/uiStore.test.ts`):**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';

describe('useUIStore: transient status message', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUIStore.setState({ statusMessage: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets status message', () => {
    useUIStore.getState().setStatusMessage('Test message');
    expect(useUIStore.getState().statusMessage).toBe('Test message');
  });

  it('auto-clears status message after 2 seconds', () => {
    useUIStore.getState().setStatusMessage('Test message');
    expect(useUIStore.getState().statusMessage).toBe('Test message');
    
    vi.advanceTimersByTime(2000);
    
    expect(useUIStore.getState().statusMessage).toBeNull();
  });

  it('does not set timer when clearing message', () => {
    useUIStore.getState().setStatusMessage('Test message');
    vi.advanceTimersByTime(1000);
    useUIStore.getState().setStatusMessage(null);
    
    vi.advanceTimersByTime(1000);
    expect(useUIStore.getState().statusMessage).toBeNull();
  });
});
```

## 6. Cross-platform path concerns

### Rust Backend Path Handling

**Path validation (`src-tauri/src/commands/file_ops.rs:11-20`):**
```rust
pub fn validate_path(path: &str) -> Result<PathBuf, String> {
    if path.contains("..") {
        return Err("Invalid path: path traversal not allowed".to_string());
    }
    if path.is_empty() {
        return Err("Invalid path: path cannot be empty".to_string());
    }
    let pb = std::path::Path::new(path);
    Ok(pb.to_path_buf())
}
```
- Rejects path traversal attempts ("..")
- Returns `PathBuf` (platform-native path type)

**Directory reading (`src-tauri/src/commands/directory_ops.rs:42-43`):**
```rust
let path_str = entry_path.to_string_lossy().to_string();
```
- Uses `to_string_lossy()` to handle non-UTF-8 paths
- Returns platform-specific path separator format

**Windows UNC handling (`src-tauri/src/commands/directory_ops.rs:114-127`):**
```rust
#[cfg(target_os = "windows")]
{
    let s = canonical.to_string_lossy();
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        return Ok(PathBuf::from(stripped));
    }
}
```
- Strips Windows UNC extended path prefix (`\\?\`)
- Ensures consistent path format across Windows versions

### Frontend Path Handling

**Path separator normalization (`src/components/sidebar/FileExplorer.tsx:73-75`):**
```typescript
function getBaseName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() ?? path;
}
```
- Handles both Unix ('/') and Windows ('\\') separators
- Uses regex `/[/\\]/` to split on either separator

**Parent path handling (`src/components/sidebar/FileExplorer.tsx:85-97`):**
```typescript
function parentOf(path: string): string | null {
  const trimmed = path.replace(/[/\\]+$/, '');
  if (!trimmed) return null;
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (lastSlash < 0) return null;
  if (lastSlash === 0) return '/';
  const parent = trimmed.slice(0, lastSlash);
  // Windows drive root edge case
  if (/^[A-Za-z]:$/.test(parent)) {
    return parent + '\\';
  }
  return parent;
}
```
- Handles both path separators
- Special handling for Windows drive roots (e.g., "C:\")

### Cross-Platform Path Concerns for Clipboard

**Copied path format:**
- Rust backend returns platform-specific path format from IPC
- Windows: Uses backslashes (`C:\Users\...\file.md`)
- Unix/macOS: Uses forward slashes (`/home/user/file.md`)

**Claude Code consumption:**
- **No normalization needed**: Claude Code (the AI agent consuming this research) runs on any platform and handles both path formats
- **User expectation**: Users expect platform-native path format when copying
- **No conversion required**: Copy `node.path` directly as-is from backend

**Recommendation:**
- Copy `node.path` as-is without modification
- Users on Windows get backslash paths, Unix users get forward slash paths
- This matches native file explorer behavior on each platform

## Recommendations (consolidated)

### Clipboard API: `navigator.clipboard.writeText()`
- **Why**: No plugin dependency, CSP is null, standard browser API supported in WKWebView/WebView2, consistent with existing clipboard read pattern
- **Implementation**: Direct call in FileTreeNode handlers, no Tauri IPC required

### Handler location: `src/components/sidebar/FileTreeNode.tsx`
- **Why**: Consistent with existing context menu actions (rename, delete, create), immediate access to `node.path` and `node.name`, no filesystem side effects, no refresh needed
- **Implementation**: Add `handleCopyPath` and `handleCopyName` callbacks inline with existing handlers (near line 184)

### Status message: Store field + Footer render
- **Store field**: Add `statusMessage: string | null` to UIState with `setStatusMessage` action that auto-clears after 2 seconds via setTimeout
- **Footer render**: Add conditional rendering in left side of footer (after save status), blue color to distinguish from save status
- **Usage**: Call `setStatusMessage('Path copied to clipboard')` after successful clipboard write

### Test strategy
- **Clipboard mock**: Add `navigator.clipboard.writeText` mock to `src/test/setup.ts` following established pattern
- **FileTreeNode tests**: Add tests for "Copy Path" and "Copy Name" menu items using existing pattern (contextMenu → click → verify mock call)
- **Footer tests**: Add tests for transient status message display and auto-clear using `vi.useFakeTimers()`
- **UIStore tests**: Add tests for `setStatusMessage` action and auto-clear behavior

## Open questions

**None.** All research questions answered with file:line evidence. Implementation path is clear:
1. Add status message to UIStore and Footer
2. Add clipboard handlers to FileTreeNode
3. Add menu items to context menu
4. Write tests following established patterns
5. No cross-platform path normalization needed (copy as-is)
