# Project Structure

## Directory Overview

The markdown-editor-rust project follows a monorepo structure with clear separation between Rust backend (Tauri) and React frontend, enabling independent development and testing of each layer.

```
markdown-editor-rust/
├── src-tauri/                    # Rust backend (Tauri application)
├── src/                          # React frontend (TypeScript)
├── .moai/                        # MoAI-ADK configuration (project metadata)
├── .claude/                      # Claude Code configuration
├── e2e/                          # Playwright E2E tests with Tauri IPC mock fixtures
├── public/                       # Static assets (favicon, manifest)
├── index.html                    # HTML entry point
├── package.json                  # Node dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite bundler configuration
├── playwright.config.ts          # Playwright configuration
├── .env.example                  # Environment variable template
├── README.md                     # Project overview and quick start
├── CHANGELOG.md                  # Release notes
└── LICENSE                       # Open source license (MIT)
```

---

## Backend: src-tauri/

Rust backend using Tauri v2 for native application control, file I/O, file system watching, and IPC bridge to frontend.

### Root Files

**Cargo.toml**
- Rust package manifest defining dependencies
- Tauri configuration and version constraints
- Optional features (updater, notification, shell)
- Build optimizations (opt-level, lto, strip)

**tauri.conf.json**
- Application metadata (package, version, author)
- Window configuration (width, height, resizable)
- Security and capability settings
- Build settings for macOS, Windows, Linux

### Subdirectories

#### src-tauri/src/

Core Rust application code.

**main.rs**
- Application entry point
- Tauri builder configuration
- Plugin initialization
- File watcher setup
- IPC event handler registration

**lib.rs**
- Library exports
- Builder pattern implementation
- Plugin module definitions
- Shared types

#### src-tauri/src/commands/

Tauri IPC command handlers (invoked from frontend).

**file_ops.rs**
- `read_file(path)` - Read file content as UTF-8 string
- `write_file(path, content)` - Write content to file
- `create_file(path)` - Create new empty file
- `delete_file(path)` - Delete file with confirmation
- `rename_file(old_path, new_path)` - Rename or move file
- Error handling and permission checking
- Path validation and sandboxing

**directory_ops.rs**
- `read_directory(path)` - Read directory contents recursively
- `open_directory_dialog()` - Open native directory chooser dialog
- Returns FileNode tree structure
- Caching for performance on large directories
- Symlink handling and cycle detection

**watcher.rs**
- `start_watch(path)` - Initialize file system watcher
- `stop_watch()` - Stop current watcher
- File change event filtering (create, modify, delete, rename)
- Debouncing to prevent duplicate events
- Emit file-changed events to frontend

#### src-tauri/src/models/

Serde data structures for serialization and type safety.

**file_node.rs**
- FileNode struct representing a file or directory
- Fields: name, path, is_directory, children, size, modified_time
- Serializable to JSON for frontend
- Custom Display implementation for debugging

**file_event.rs**
- FileChangedEvent struct
- Fields: kind (create/modify/delete), path, timestamp
- Used for file system watcher notifications
- Triggers frontend refresh on changes

#### src-tauri/src/state/

Application state management.

**app_state.rs**
- AppState struct wrapped in Mutex for thread-safe access
- WatcherState tracking active file watchers
- Fields: current_watch_path, watcher_handle, debounce_timer
- Managed by Tauri state manager

#### src-tauri/capabilities/

Security and permission configuration.

**main.json**
- Tauri capabilities defining allowed operations
- File system permissions (read, write, paths)
- Dialog permissions (open, save, directory)
- Event emission permissions
- Command allowlist

---

## E2E Testing: e2e/

Playwright E2E test suite for validating visual rendering, browser compatibility, and critical user workflows.

### Subdirectories

#### e2e/fixtures/

Test fixtures and mocking utilities.

**tauri-mock.ts**
- Custom Playwright fixture for injecting Tauri IPC mock
- Provides tauriPage extending standard Playwright Page
- Injects window.__TAURI__ global object before page load
- Mocks core.invoke, event.listen, event.emit methods
- Applied automatically to all E2E tests

**test-content.md**
- Markdown fixture file containing diverse content for testing
- Includes wide table for horizontal scroll validation
- Includes Mermaid diagram, code block, and text content
- Used by table-border and markdown-render tests

#### Test Files

**table-border.spec.ts**
- Tests CSS rendering of table borders in preview panel
- Validates border visibility on td and th elements
- Confirms no WebKit clipping issues with scroll containers
- Tests getComputedStyle for pixel accuracy

**app-render.spec.ts**
- Smoke test for basic app rendering
- Verifies core UI elements exist (editor, preview, header)
- Confirms no console errors on page load
- Tests page accessibility

**markdown-render.spec.ts**
- Tests markdown-to-HTML rendering pipeline
- Validates h1, strong, and other HTML elements render correctly
- Tests preview update timing (within 2 seconds of input)
- Verifies markdown content is properly displayed

**diagnostic.spec.ts** (temporary)
- Temporary diagnostic test file created during debugging
- Contains debugging logic for Playwright WebKit validation
- Marked for cleanup after validation completes

---

## Frontend: src/

React 18 + TypeScript frontend for UI, editor, and preview.

### Core Files

**main.tsx**
- React application entry point
- DOM root mounting
- Provider initialization (theme, store, etc.)

**App.tsx**
- Root component
- Application layout structure
- Theme initialization
- Error boundary setup

### Subdirectories

#### src/components/

Reusable React components organized by feature.

**layout/**
- AppLayout: Main application container with resizable panes
- ResizablePanels: Flexible layout component for split panes
- Header: Application header with file name and save status
- Footer: Status bar with line count, selection info, encoding

**sidebar/**
- FileExplorer: Main sidebar container
- FileTree: Recursive tree component for directory structure
- FileTreeNode: Individual file/folder node with context menu
- FileSearch: Filter files by name
- Breadcrumb: Current path navigation

**editor/**
- MarkdownEditor: CodeMirror 6 integration
- EditorToolbar: Formatting buttons (bold, italic, lists, etc.)
- EditorGutter: Line numbers and interaction area
- extensions/: CodeMirror custom extensions
  - markdown-extensions.ts: Markdown-specific extensions
  - syntax-highlighting.ts: Syntax highlighting setup
  - keyboard-shortcuts.ts: Custom keyboard bindings

**preview/**
- MarkdownPreview: Preview panel container
- PreviewRenderer: Renders markdown-it HTML output
- MermaidRenderer: Handles Mermaid diagram rendering
- CodeBlockRenderer: Syntax-highlighted code blocks

#### src/hooks/

Custom React hooks for common patterns.

**useFileSystem.ts**
- Opens files via Tauri `read_file` command
- Saves files via Tauri `write_file` command
- Handles file creation, deletion, renaming
- Error handling and user feedback

**useFileWatcher.ts**
- Listens to Tauri `file-changed` events
- Triggers content refresh on external modifications
- Debounces rapid file changes
- Cleanup on unmount

**usePreview.ts**
- markdown-it renderer initialization
- Mermaid diagram rendering setup
- Shiki syntax highlighter initialization
- Debounced markdown compilation

**useTheme.ts**
- System dark mode detection
- Theme switching logic
- CSS variable injection for theming
- localStorage persistence

#### src/store/

Zustand state management (global stores).

**editorStore.ts**
- Current file path and content
- Editor state (cursor position, scroll offset, selection)
- Undo/redo history
- Dirty flag for unsaved changes

**fileStore.ts**
- File tree structure (loaded from directory)
- Currently open file
- Watched directories
- File metadata (size, modified time)

**uiStore.ts**
- Sidebar visibility and width
- Preview pane visibility and width
- Theme (light/dark)
- Font size and zoom level
- Sidebar collapse state

#### src/lib/

Utility libraries and helpers.

**markdown/**
- renderer.ts: markdown-it initialization and rendering
- mermaidPlugin.ts: Plugin for rendering Mermaid in markdown-it
- codeHighlight.ts: Shiki integration for syntax highlighting
- markdownExt.ts: Custom Markdown extensions and rules

**export/**
- exportHtml.ts: HTML export with self-contained CSS and SVG diagrams
- exportPdf.ts: PDF export using Webview print-to-PDF
- exportDocx.ts: DOCX export with markdown-it token conversion
- exportUtils.ts: Common utilities for all export formats
- types.ts: TypeScript types for export functionality

**tauri/**
- ipc.ts: Type-safe wrappers for Tauri commands
  - invoke wrapper with proper typing
  - Event listener setup
  - Error handling utilities
  - Export save dialog wrappers

#### src/types/

TypeScript type definitions for type safety.

**file.ts**
- FileNode interface matching Rust struct
- FileChangedEvent interface
- Directory listing response type

**editor.ts**
- EditorState interface
- EditorConfig for CodeMirror setup
- Selection and cursor position types

**markdown.ts**
- RenderResult interface
- MarkdownOptions for renderer config
- TableOfContents interface

---

## Configuration Files

### Project Root

**package.json**
- React and TypeScript dependencies
- CodeMirror 6 packages
- Markdown libraries (markdown-it, Shiki, mermaid)
- Build scripts (dev, build, preview, type-check)
- Tauri CLI integration
- Dev dependencies (vite, TypeScript, vitest)

**tsconfig.json**
- Strict type checking mode enabled
- Target: ES2020 (modern JavaScript)
- Module: ESNext (bundled by Vite)
- Path aliases for cleaner imports
- DOM lib for browser types

**vite.config.ts**
- React plugin configuration
- Path alias setup
- Tauri integration plugin
- Build optimization settings
- Dev server configuration

**.env.example**
- Template for environment variables
- VITE_API_URL example (for future API)
- Development flags

### Backend Configuration

**src-tauri/Cargo.toml**
- Tauri version (v2.x)
- Dependencies: serde, tokio, notify
- Optional features for native plugins
- Build profiles for release optimization

**src-tauri/tauri.conf.json**
- App name and version
- Window dimensions and capabilities
- Security settings and CSP
- File system permissions scope
- Platform-specific settings

---

## File Relationships and Dependencies

### Critical Relationships

**IPC Type Safety**
- tauri/ipc.ts exports typed command wrappers
- src-tauri/src/commands/*.rs functions are invoked through ipc.ts
- Type definitions in src/types/file.ts mirror Rust models

**State Synchronization**
- editorStore maintains current file content
- useFileWatcher listens to file-changed events and updates editor
- fileStore caches directory structure from read_directory

**Rendering Pipeline**
- MarkdownEditor → debounced onChange → editorStore update
- editorStore change → usePreview re-renders → MarkdownPreview displays
- mermaidPlugin intercepts code blocks with language=mermaid

**File Operations**
- FileTreeNode click → useFileSystem.openFile() → Tauri read_file
- Ctrl+S in editor → useFileSystem.saveFile() → Tauri write_file
- Save completes → editorStore.setDirty(false)

### Module Boundaries

**Backend/Frontend Separation**
- Backend: All file system access, file watching, IPC servers
- Frontend: All UI rendering, state management, event handling
- Bridge: Tauri commands and event channels

**Component Boundaries**
- Editor component owns CodeMirror instance
- Preview component owns markdown-it and Mermaid renderers
- FileExplorer component owns directory tree state
- AppLayout component manages pane sizing

**Store Boundaries**
- editorStore: Editor-specific state only (content, cursor, selection)
- fileStore: File system and directory state
- uiStore: UI layout and appearance state
- No cross-store updates to prevent consistency issues

---

## Data Flow Paths

### User Edit Workflow

1. User types in MarkdownEditor component
2. CodeMirror onChange fires
3. Content passed to editorStore.setContent()
4. Store triggers rerender
5. usePreview hook detects content change
6. Debounces 300ms to reduce unnecessary renders
7. markdown-it compiles Markdown to HTML
8. Mermaid plugin processes code blocks
9. Shiki highlights code blocks
10. MarkdownPreview displays rendered HTML

### File Open Workflow

1. User clicks file in FileTree component
2. FileTreeNode invokes useFileSystem.openFile(path)
3. useFileSystem calls Tauri invoke('read_file')
4. Rust backend reads file content
5. Content returned as UTF-8 string
6. editorStore.setContent() and setCurrentFile() updated
7. UI re-renders with new content

### File Save Workflow

1. User presses Ctrl+S
2. Editor toolbar Save button triggers
3. useFileSystem.saveFile(path, content) invoked
4. Tauri invoke('write_file') called
5. Rust backend writes to filesystem
6. editorStore.setDirty(false)
7. UI updates save indicator

### File System Watch Workflow

1. User opens a directory
2. useFileWatcher initialized with useEffect
3. Tauri invoke('start_watch', path) called
4. Rust backend initializes notify watcher
5. External change detected (another app modifies file)
6. Rust emits 'file-changed' event with FileChangedEvent
7. useFileWatcher listener receives event
8. If changed file is current file, triggers reload
9. User sees updated content with confirmation prompt

---

## Performance Optimization Points

**Editor Performance**
- CodeMirror 6 with lazy loading
- Syntax highlighting cached per session
- Code folding deferred until user interaction
- Virtual scrolling for large files

**Preview Performance**
- 300ms debounce on markdown compilation
- Mermaid diagrams lazy-loaded on scroll
- Shiki highlighter initialized once and reused
- markdown-it token cache between renders

**File System Performance**
- Directory listing cached in fileStore
- Debounced file watcher events (50ms)
- Lazy expansion of directory tree
- Async file operations with loading indicators

**Memory Management**
- Zustand stores with shallow comparison
- Event listener cleanup on unmount
- File watcher stopped when directory closed
- CodeMirror instance properly destroyed

---

## Security Boundaries

**File System Sandboxing**
- Tauri capabilities restrict file access to user-configured paths
- No arbitrary file system access
- Directory dialog restricts browse locations
- Path traversal validation before operations

**Content Security**
- markdown-it configured with html: false (no HTML in Markdown)
- Mermaid configured with securityLevel: 'strict'
- No eval or dynamic code execution
- External links opened in browser, not in app

**IPC Security**
- Typed Tauri commands prevent injection
- Event names whitelisted in capabilities
- Sensitive data not logged
- File contents handled as untrusted user input

---

## Development Workflow Integration

### File Editing During Development

When modifying files:
- Editor tests use component testing library (vitest + @testing-library/react)
- Rust tests use Cargo test framework
- All changes preserve type safety through TypeScript and Rust

### Testing Structure

Frontend tests colocate with components:
- Component.test.tsx alongside Component.tsx
- Store tests in store/ directory
- Hook tests in hooks/ directory

Backend tests in src-tauri/tests/:
- Integration tests for file operations
- Command tests with mock filesystem
- Event emission verification

### Build Process

Development: `npm run dev` runs Vite + Tauri development server

Production: `npm run build` triggers:
1. `cargo build --release` for optimized Rust binary
2. Vite build for minified React bundle
3. Tauri bundler creates installer for platform

---

## Scaling Considerations

The architecture supports growth without major restructuring:

**Adding Features**
- New Tauri commands added to src-tauri/src/commands/ as separate modules
- New React components added to src/components/ with new feature subdirectories
- New stores in src/store/ for feature-specific state

**Performance at Scale**
- Large files (50KB+) handled through CodeMirror virtual scrolling
- Large directories (1000+ files) handled through lazy tree expansion
- Memory usage remains bounded through React memoization

**Maintainability**
- Clear module boundaries enable parallel development
- Type safety prevents integration bugs
- Progressive enhancement allows V2 features without V1 refactoring
