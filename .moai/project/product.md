# Product Definition

## Project Identity

**Name**: markdown-editor-rust (Working title: MdEdit)

**Tagline**: A lightweight, native desktop alternative to VS Code for Markdown editing and preview.

**Type**: Desktop Application (Native, Cross-Platform)

**Target Platform**: macOS, Windows, Linux

**Development Status**: MVP (Core features implemented and functional)

---

## Problem Statement

Visual Studio Code is the industry standard for code and text editing, but it comes at a cost for users who work exclusively with Markdown:

- **Resource Heavy**: VS Code consumes 300-400MB RAM at idle, making it unsuitable for older machines or resource-constrained environments
- **Feature Bloat**: Loaded with 10,000+ extensions and features irrelevant to Markdown authors
- **Startup Time**: Takes 2-3 seconds to launch, slow for quick editing tasks
- **Binary Size**: 400MB+ installation, creating friction for new users
- **Learning Curve**: Complex interface and settings for a single-purpose workflow

## Solution

MdEdit is a **minimal, purpose-built** Markdown editor that removes all unnecessary features and focuses exclusively on the Markdown author experience:

- **Lightweight**: Tauri-based native binary under 15MB with minimal RAM footprint
- **Fast**: Instant launch, responsive editing, optimized rendering pipeline
- **Essential Only**: Three core features: editing, file management, and live preview
- **Professional Preview**: VS Code-quality syntax highlighting, Mermaid diagram support, and semantic Markdown rendering
- **Simple Interface**: Single-pane multi-tool approach without distracting sidebars

---

## Target Audience

### Primary Users

**Technical Writers and Documentation Authors**
- Write README.md, project documentation, API docs
- Need quick preview feedback while editing
- Prefer lightweight tools
- Work in Markdown-first environments (GitHub, GitLab, Obsidian)

**Software Developers**
- Maintain GitHub project READMEs and change logs
- Write blog posts in Markdown
- Document architecture and design decisions
- Need distraction-free writing environment

**Knowledge Management Practitioners**
- Use Markdown for note-taking and knowledge bases
- Maintain personal wikis and documentation systems
- Require cross-platform access (Windows, Mac, Linux)
- Need integration with file systems, not cloud-only

### Secondary Users

**Educators and Trainers**
- Create course materials in Markdown format
- Use Markdown for presentation content
- Need reliable preview functionality

**Open Source Contributors**
- Document projects with high-quality README files
- Contribute to documentation in GitHub/GitLab
- Appreciate simple, professional tools

---

## Use Cases and User Scenarios

### Scenario 1: Quick README Update

A developer needs to update a project README with recent changes. Currently takes 2-3 minutes in VS Code (startup + editing + save). With MdEdit: instant launch, edit, save, done in under 1 minute.

### Scenario 2: Complex Markdown Document

A technical writer creates a 50-page API documentation with tables, code blocks, and Mermaid diagrams. Needs live preview to verify rendering. MdEdit provides real-time preview with 300ms debounce, optimized for distraction-free writing flow.

### Scenario 3: Multi-File Documentation

A developer maintains documentation spanning 10+ interconnected Markdown files. Uses MdEdit's file explorer to navigate between files, with split-pane preview for quick reference.

### Scenario 4: Presentation Creation

An educator creates a presentation outline in Markdown, uses code blocks and Mermaid diagrams, and exports to HTML for presentation. MdEdit provides the editing and preview tools needed for this workflow.

---

## Core Features

### 1. Markdown Syntax Highlighting

Professional VS Code-style syntax highlighting for all Markdown elements.

**Included**:
- Headers (#, ##, etc.) with visual hierarchy
- Bold and italic text formatting
- Links and reference links
- Code blocks with language tags
- Inline code formatting
- Lists (ordered, unordered, nested)
- Blockquotes with nesting support
- Horizontal rules and separators
- Front matter (YAML metadata)

**Visual Indicators**:
- Language-aware code block headers
- Link URL display
- Inline formatting preview
- Blockquote nesting levels

**Non-Goal**: Does not highlight general-purpose programming languages. Only Markdown and embedded code blocks.

---

### 2. Real-Time Markdown Preview

Live preview panel showing rendered Markdown output synchronized with editor.

**Included**:
- Rendered HTML output matching CommonMark specification
- Standard Markdown elements (headings, lists, tables, blockquotes)
- Syntax-highlighted code blocks using Shiki highlighter
- Mermaid diagram rendering (flowcharts, sequence, state, etc.)
- Table rendering with alignment support
- Footnotes and reference links
- Strikethrough and superscript support
- 300ms debounce on preview updates for performance

**Performance**:
- Debounce rendering to prevent lag while typing
- Cache Shiki highlighter for fast subsequent renders
- Lazy load Mermaid diagrams to reduce initial paint time
- Optimize re-renders only changed sections

**Non-Goal**: Does not support HTML-in-Markdown. Markdown-it renders with html: false to prevent XSS.

---

### 3. File and Directory Explorer

Left sidebar file tree for project navigation.

**Included**:
- Hierarchical file tree view
- Expand/collapse directories
- Click to open files
- Right-click context menu (create, delete, rename)
- File icons based on file extension
- Drag-and-drop file reordering (optional, V2+)
- Search filter for quick file location

**Operations**:
- Create: New file or folder
- Delete: Remove files/folders with confirmation
- Rename: In-place file renaming
- Open: Single-click or double-click behavior

**Non-Goal**: Does not support Git integration, symbolic links, or watched external folders.

---

### 4. Standard Editor Features

Professional code editor functionality adapted for Markdown.

**Included**:
- Line numbers with visual selection
- Syntax-aware word wrap (preserves Markdown structure)
- Auto-indentation for lists and blockquotes
- Keyboard shortcuts (Ctrl+S to save, Ctrl+/ for comment toggle, etc.)
- Undo/Redo with full history
- Find and Replace with regex support
- Selection highlighting and multi-cursor support
- Bracket pair colorization
- Current line highlighting
- Scroll bar minimap (optional)

**Keyboard Support**:
- Standard VSCode shortcuts for navigation (Ctrl+Home, Ctrl+End, etc.)
- Markdown-specific shortcuts (list toggle, bold/italic formatting)
- Theme-aware color scheme

**Non-Goal**: Does not include advanced debugging, terminal integration, or language-specific features.

---

### 5. Document Export

Export rendered Markdown documents to multiple formats.

**Included**:
- Export to HTML with self-contained styling (all CSS inlined)
- Export to PDF with Webview print-to-PDF engine
- Export to DOCX (Word format) with Markdown-to-docx conversion
- Preservation of Markdown formatting (headings, lists, tables, code blocks)
- Syntax-highlighted code blocks in all export formats
- Mermaid diagram embedding (SVG in HTML/PDF, PNG in DOCX)
- Theme-aware styling (dark/light mode applied to exports)
- File save dialog with format-specific filters
- Auto-suggested filenames based on current document

**Formats Supported**:
- **HTML**: Self-contained single file, no external CSS dependencies
- **PDF**: High-quality visual output matching on-screen preview
- **DOCX**: Compatible with Microsoft Word, Google Docs, LibreOffice

**Performance**:
- HTML export: <2 seconds for typical documents
- PDF export: <3 seconds (system print dialog integration)
- DOCX export: <5 seconds (includes diagram PNG conversion)

**Non-Goal**: Does not support batch export of multiple files or custom export templates.

---

### 6. File Operations

Fast, reliable file I/O with filesystem synchronization.

**Included**:
- Read/write files with UTF-8 encoding
- Create new files and directories
- Delete files with confirmation dialog
- Rename files and directories
- Watch for external changes (auto-reload)
- Save status indicator in editor title
- Keyboard shortcut Ctrl+S for quick save

**File Handling**:
- Support for any file extension (not Markdown-only)
- Preserve file permissions and timestamps
- Handle large files efficiently (streaming where possible)
- Cross-platform path handling

**Safety**:
- Confirm before destructive operations
- Auto-save on app close to prevent loss
- Version backups (future feature, V2+)

**Non-Goal**: Does not provide Git history, remote file access, or cloud synchronization.

---

## Non-Goals (Intentional Omissions)

The following features are explicitly not included to maintain focus and lightweight design:

- **Git Integration**: No version control, blame view, or diff display
- **Terminal Integration**: No built-in terminal or command runner
- **Extensions Ecosystem**: No plugin or extension architecture
- **Code Execution**: No ability to run code or scripts
- **Debugging**: No debugger or runtime inspection
- **Language Support**: No programming language features (linting, formatting, type checking)
- **Collaboration Features**: No real-time collaboration or sharing
- **Cloud Storage**: No Dropbox, OneDrive, or Google Drive integration
- **Spell Check**: No grammar or spell checking (may add in V2)
- **Custom Themes**: Limited theme support (system dark mode only, V1)
- **Package Management**: No npm/pip integration or package browsing

---

## Success Metrics and Quality Goals

### Performance Targets

- **Launch Time**: < 500ms (target from cold start)
- **Memory Footprint**: < 80MB RAM at idle
- **Binary Size**: < 15MB on macOS (optimized release build)
- **Editor Responsiveness**: < 50ms keypress-to-character latency
- **Preview Rendering**: < 300ms debounce to display
- **Large File Performance**: Handle 50KB+ files without noticeable lag

### User Experience Goals

- **Discoverability**: All core features visible without opening menus or settings
- **First-Run Onboarding**: < 30 seconds to first edit
- **Keyboard Efficiency**: 80% of common tasks accessible via keyboard
- **Theme Consistency**: Match system theme (dark/light) without configuration
- **Cross-Platform Parity**: Feature-complete on macOS, Windows, Linux

### Quality Standards

- **Code Coverage**: Minimum 80% test coverage for Rust backend
- **Frontend Testing**: Unit tests for all React components
- **Accessibility**: WCAG 2.1 Level AA compliance for UI
- **Type Safety**: Full TypeScript strict mode, zero `any` types
- **Security**: No XSS vulnerabilities, safe file operations, sandboxed previews

### Stability Requirements

- **Crash Rate**: Zero crashes under normal usage
- **Data Loss Prevention**: No data loss from crashes or unexpected shutdown
- **Format Preservation**: Editing Markdown does not corrupt files or add hidden characters
- **Platform Support**: Minimum 95% uptime across supported platforms

---

## Competitive Positioning

### vs. VS Code

- **Advantage**: 30x lighter (15MB vs 400MB), faster launch, focused UI, 80% less RAM
- **Disadvantage**: No extensions, no multi-language support
- **Target**: Users who value simplicity and speed over extensibility

### vs. Typora

- **Advantage**: Open source (future), cross-platform consistency, live Mermaid diagrams
- **Disadvantage**: No WYSIWYG editing mode, simpler feature set
- **Target**: Developers and technical writers, not general users

### vs. Obsidian

- **Advantage**: Lightweight, no registration, native performance, simpler interface
- **Disadvantage**: No knowledge graph, no sync, no plugin ecosystem
- **Target**: Users who want a single-file editor, not a knowledge management system

---

## Vision and Roadmap Direction

### V1.0 (MVP)

Core features required for daily Markdown editing:
- Markdown syntax highlighting and live preview
- File explorer and basic file operations
- Standard editor features (undo, find/replace, word wrap)
- Cross-platform support (macOS, Windows, Linux)
- Mermaid diagram rendering
- Document export to HTML, PDF, and DOCX formats

### V2.0 (Enhancement)

Feature expansion based on user feedback:
- Theme customization and color scheme selection
- Auto-save and file change detection
- Code block copy buttons
- Search across multiple files
- Keyboard shortcut customization
- Version backups (local)

### V3.0+ (Future Exploration)

Potential long-term features requiring community input:
- Collaborative editing
- Plugin system for safe extensions
- Custom export templates and themes
- Integrated bibliography management
- Publishing workflow integration

---

## Market and Community

### Market Analysis

The lightweight editor market is underserved. Markdown adoption is growing across documentation tools (GitHub, GitLab, Confluence), but VS Code remains the default despite its overhead. An open-source, lightweight alternative addresses a real gap.

### Community Building

- Open sourcing on GitHub for transparency and contributions
- Active issue triage and community feedback loop
- Clear product roadmap for predictability
- Documentation and quick-start guides
- Example projects showing real-world usage

---

## Conclusion

MdEdit fills a specific niche: a professional, lightweight Markdown editor for users who value speed and simplicity. By ruthlessly eliminating non-essential features and optimizing for the core editing workflow, we create a tool that respects users' machines and time. The focus on Markdown-only editing, combined with modern language (Rust) and framework (Tauri), positions MdEdit as a sustainable long-term alternative to VS Code for Markdown-focused workflows.
