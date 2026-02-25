# Technology Stack

## Executive Summary

markdown-editor-rust uses a deliberately lightweight technology stack optimized for performance, maintainability, and cross-platform compatibility. The core principle is "minimal but professional": use battle-tested frameworks without bloat, prefer stability over cutting-edge trends, and optimize ruthlessly for binary size and memory footprint.

---

## Core Technology Stack Table

### Backend Runtime

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| Application Framework | Tauri | v2.x | Native performance without Electron bloat; 400MB reduction in binary size |
| Language | Rust | 2021 edition | Memory safety without GC; performance parity with C; excellent async support |
| Async Runtime | Tokio | v1.x | Industry-standard async executor; well-tested; integrated with Tauri |
| File System Watcher | notify | v6.x | Pure Rust cross-platform watcher; low CPU overhead; proven reliability |

### Frontend UI

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| UI Framework | React | v18.x | Industry standard; mature ecosystem; excellent developer experience |
| Language | TypeScript | 5.x+ | Strict mode prevents runtime errors; improved DX; seamless tooling |
| Build Tool | Vite | v5.x | Instant HMR; fast production builds; Tauri integration; modern ESM-first |
| CSS Framework | Tailwind CSS | v3.x | Utility-first; minimal bundle size; excellent editor theme support |

### Editor Component

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| Editor Library | CodeMirror 6 | v6.x | Modular architecture; 50% smaller than Monaco; Markdown extensions available |
| Language Support | @codemirror/lang-markdown | v6.x | First-class Markdown syntax; extensible; actively maintained |
| Extensions | Multiple | v6.x | Keyboard shortcuts, themes, extensions all pluggable |

### Markdown Rendering

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| Markdown Parser | markdown-it | v14.x | Performance optimized; CommonMark compliant; plugin-friendly architecture |
| Code Highlighting | Shiki | v1.x | VS Code quality syntax highlighting; same grammar files as VS Code |
| Diagram Rendering | mermaid.js | v11.x | Flowchart, sequence, state, Git diagrams; active development |

### State Management

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| State Store | Zustand | v5.x | Minimal boilerplate; 2KB footprint; React 18 suspense compatible |
| Persistence | localStorage API | native | Browser standard; sufficient for editor state; no external deps |

### IPC and Communication

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| Frontend-Backend Bridge | Tauri invoke/emit | v2.x | Type-safe command invocation; event broadcasting; zero latency |
| Serialization | serde | v1.x | Zero-cost serialization framework; JSON interop |

---

## Architecture Decisions

### Decision 1: Tauri over Electron

**Comparison**:
- Electron: ~400MB binary, 300MB+ RAM idle, Node.js included, Chromium included
- Tauri: ~15MB binary, 60MB+ RAM idle, Rust backend, system WebKit/WebView2/GTK

**Rationale**:
Electron is convenient but carries massive overhead for a focused application. Tauri provides native performance while preserving the benefits of web technologies for UI. The 400MB size reduction addresses a primary user pain point: disk space and installation friction.

**Tradeoff**: Smaller ecosystem of third-party integrations compared to Electron (npm packages), but core functionality is available through Rust crates.

**Impact**: Users can install and launch MdEdit in seconds, not minutes. Lightweight enough for deployment on older hardware.

---

### Decision 2: CodeMirror 6 over Monaco

**Comparison**:
- Monaco (VS Code editor): 2.5MB minified, 8MB unminified, fully-featured, heavy
- CodeMirror 6: 150KB core, modular extensions, lighter weight, Markdown-optimized

**Rationale**:
Monaco is production-ready but brings the entire VS Code editor complexity. CodeMirror 6's modular architecture allows us to include only necessary features: syntax highlighting, line numbers, keyboard shortcuts, and Markdown extensions. The minimal footprint aligns with the lightweight philosophy.

**Tradeoff**: CodeMirror has a smaller ecosystem of prebuilt extensions compared to Monaco, but the core Markdown experience is superior (Markdown is a first-class citizen in CodeMirror).

**Impact**: Smaller bundle, faster load time, simpler codebase to maintain and extend.

---

### Decision 3: markdown-it over unified/remark

**Comparison**:
- markdown-it: ~25KB, fast synchronous parsing, plugin-based, CommonMark-compliant
- unified/remark ecosystem: Modular AST-based parsing, more flexible but heavier
- Markdown.js: Too simplistic, missing feature support

**Rationale**:
markdown-it provides fast, synchronous Markdown-to-HTML compilation with strong CommonMark compliance. The plugin architecture enables custom extensions (Mermaid rendering). It's lightweight and proven in production (used by GitLab, Vue docs). The synchronous API simplifies debouncing and real-time preview logic.

**Tradeoff**: AST-based parsers (remark) provide more flexibility for complex transformations, but that complexity is unnecessary for a preview renderer.

**Impact**: 300ms preview debounce is smooth and responsive without unnecessary processing overhead.

---

### Decision 4: Shiki over Highlight.js or Prism

**Comparison**:
- Highlight.js: ~50KB, client-side, good browser support
- Prism: ~15KB, lightweight, extensible
- Shiki: ~500KB initial (but async-loaded), VS Code quality, TextMate grammars

**Rationale**:
Shiki uses the same language grammars and theme format as VS Code, ensuring consistency and professional quality. The initial size penalty is acceptable because grammars are loaded asynchronously and cached. Users expect VS Code-quality highlighting in a "VS Code alternative", and Shiki is the only option that matches it.

**Tradeoff**: Larger bundle and requires onDemandLanguages to manage grammar files. Justify the complexity through quality.

**Impact**: Users see expected syntax highlighting for 100+ languages with VS Code accuracy.

---

### Decision 5: Mermaid v11 for Diagrams

**Rationale**:
Mermaid is the de facto standard for Markdown-embedded diagrams (flowcharts, sequence, state). Version 11 significantly improved rendering performance and bundle size. Integrating through markdown-it plugin provides seamless Markdown experience.

**Tradeoff**: Mermaid is large (~1MB uncompressed) but lazy-loaded. Not essential for V1, but diagram support is expected in professional Markdown tools.

**Impact**: Users can author complex architecture diagrams directly in Markdown without external tools.

---

### Decision 6: Zustand for State Management

**Comparison**:
- Redux: ~15KB, but heavy boilerplate and middleware
- Zustand: ~2KB, minimal boilerplate, hooks-based
- Recoil: Experimental, Google-backed but smaller community
- Context API alone: Works for simple apps, but prop drilling becomes painful

**Rationale**:
Zustand provides just enough structure without boilerplate. The store definitions are simple and readable. Hooks-based API matches React 18 modern patterns. 2KB footprint keeps bundle lean.

**Tradeoff**: Smaller ecosystem of plugins/extensions compared to Redux, but core functionality is sufficient.

**Impact**: Developers can reason about state without deep middleware knowledge.

---

## Technology Matrix: Build System and Packaging

### Frontend Build Pipeline

**Vite Build Process**:
1. Parse TypeScript files using swc (Rust-based transpiler)
2. Inline dependencies using esbuild
3. Code split by Rollup default strategy
4. Generate optimized JavaScript and CSS bundles
5. Asset fingerprinting for cache busting

**Optimization Settings**:
- Target: ES2020 (modern browsers, reduced polyfills)
- Module format: ESM with dynamic imports
- Minification: esbuild minifier (very fast)
- CSS extraction and minification
- Image optimization with Rollup plugins

### Rust Backend Build Pipeline

**Cargo Build Process**:
1. Compile Rust source to LLVM IR
2. Link with system libraries and Rust dependencies
3. Strip debug symbols for release builds
4. Link-time optimization (LTO) for final binary size reduction
5. Create platform-specific native executable

**Release Optimizations**:
```
[profile.release]
opt-level = "s"           # Optimize for size
lto = true                # Link-time optimization
strip = true              # Remove symbols
codegen-units = 1         # Single codegen unit for better optimization
```

**Result**: ~15MB binary on macOS (with --target aarch64-apple-darwin)

### Tauri Bundler

**Tauri CLI Bundling**:
1. Builds Rust backend with release optimizations
2. Bundles React frontend as static assets
3. Creates platform installers:
   - macOS: .dmg with code signing
   - Windows: .exe MSI installer
   - Linux: AppImage or .deb package

**Distribution**: Self-contained installers, auto-updater support.

---

## Dependency Management

### Core Dependencies (package.json)

**React and UI**:
- react@18.x (UI framework)
- typescript@5.x (type safety)
- tailwindcss@3.x (styling)

**Editor**:
- @codemirror/view, @codemirror/state (core editor)
- @codemirror/lang-markdown (Markdown support)
- @codemirror/commands (keyboard shortcuts)
- codemirror@6.x (bundles together)

**Markdown and Preview**:
- markdown-it@14.x (parser)
- shiki@1.x (code highlighting)
- mermaid@11.x (diagram rendering)

**Export Formats**:
- docx@9.x (DOCX file generation)

**State and Storage**:
- zustand@5.x (state management)

**Build and Development**:
- vite@5.x (bundler and dev server)
- @tauri-apps/cli@2.x (Tauri integration)
- vitest (testing framework)
- @testing-library/react (component testing)
- @playwright/test@1.58.2 (E2E testing framework with WebKit browser support for Tauri macOS validation)

**Total Production Bundle**: ~800KB gzipped (React, CodeMirror, markdown-it, Zustand combined)

### Core Dependencies (Cargo.toml)

**Tauri Core**:
- tauri@2.x (application framework)
- tokio (async runtime)

**File System**:
- notify@6.x (file watching)
- serde@1.x, serde_json (serialization)

**IPC and Command Handling**:
- tauri::command (procedural macros)
- serde for automatic serialization

**Utilities**:
- tracing (structured logging)
- anyhow (error handling)

**Total Rust Dependencies**: ~40 crates (relatively lightweight ecosystem)

---

## Development Environment Requirements

### Minimum System Requirements

**macOS Development**:
- Xcode 13+ (or Xcode command-line tools)
- Rust toolchain 1.70+ (via rustup)
- Node.js 18+ (via nvm or direct install)
- npm or yarn

**Windows Development**:
- Rust toolchain 1.70+
- Node.js 18+
- Microsoft Visual C++ Build Tools
- Windows 10+ SDK

**Linux Development**:
- GCC or Clang toolchain
- Rust toolchain 1.70+
- GTK 3.6+ development headers
- Node.js 18+
- libwebkit2gtk-4.0-dev or similar

### Development Tools

**Required**:
- Cargo (Rust package manager, included with rustup)
- npm (Node package manager)
- Git (version control)

**Recommended**:
- Visual Studio Code with Rust Analyzer extension
- TypeScript support and Prettier formatter
- Tauri plugin for VS Code (provides Tauri-specific tooling)

### Setup Commands

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js 18+ (example using nvm)
nvm install 18
nvm use 18

# Clone and setup project
git clone <repo>
cd markdown-editor-rust
npm install
npm run dev:tauri
```

---

## Performance Targets and Benchmarks

### Launch Performance

| Metric | Target | Method |
|--------|--------|--------|
| Cold start | < 500ms | Time from executable launch to app window visible |
| Warm start | < 200ms | Time from running app already in memory |
| First interactive | < 1s | Time until user can start typing |

### Runtime Memory

| State | Target | Notes |
|-------|--------|-------|
| Idle (no file open) | 60-80MB | Base Tauri + React + CodeMirror |
| With large file (50KB) | < 120MB | Including syntax highlighting cache |
| Multiple files open | < 150MB | With preview panel active |

### File Operations

| Operation | Target | Notes |
|-----------|--------|-------|
| Read file (10KB) | < 50ms | Including IPC round-trip |
| Write file (10KB) | < 100ms | Including disk sync |
| Directory listing (1000 files) | < 200ms | First load, then cached |
| Syntax highlight (10KB) | < 100ms | Shiki with cached grammar |

### Preview Rendering

| Metric | Target | Notes |
|--------|--------|-------|
| Markdown to HTML (10KB) | < 50ms | markdown-it compilation |
| Preview debounce | 300ms | User typing lag tolerance |
| Mermaid diagram render | < 500ms | First render; subsequent cached |
| Full page reflow | < 100ms | React reconciliation |

### Binary Size

| Target | Size | Notes |
|--------|------|-------|
| macOS ARM64 | < 15MB | Optimized release binary |
| Windows x64 | < 18MB | With MSVC runtime |
| Linux x64 | < 16MB | AppImage or binary |
| Installation footprint | < 50MB | Including all dependencies |

---

## Platform Support

### Target Platforms

**Tier 1 (Fully Supported)**
- macOS 11+ (Intel and Apple Silicon)
- Windows 10 21H2+
- Linux (Ubuntu 20.04+, Fedora 36+, Debian 11+)

**Tier 2 (Tested but Limited)**
- macOS 10.15-11 (Best effort, may not receive updates)
- Windows 7/8 (No official support, but technically possible via legacy Tauri)
- Older Linux distributions (Testing required per platform)

### Feature Parity

All Tier 1 platforms have identical features and performance:
- File operations
- File watching
- Markdown preview
- Syntax highlighting
- Mermaid diagrams

---

## Security and Dependencies

### Dependency Audit

**Process**:
- `npm audit` runs on every CI/CD build (blocking vulnerabilities)
- `cargo audit` runs for Rust dependencies
- GitHub Dependabot for automated PR generation

**Policy**:
- High severity: Immediate patching and release
- Medium: Patched within one week
- Low: Patched in next release cycle

### Minimized Dependency Surface

The tech stack deliberately limits dependencies:
- No monolithic frameworks (Next.js, Nuxt)
- No unnecessary runtime dependencies
- No beta or unstable libraries
- Prefer established, well-maintained crates/packages

**Rationale**: Fewer dependencies = fewer vulnerabilities = easier auditing.

---

## Future Technology Considerations

### Potential Upgrades (Not in V1)

**React Router** (when multi-document support added)
- Client-side routing for feature expansions
- Not needed for single-window, single-file-focused V1

**Electron/Wry** (alternative rendering)
- Wry is the Tauri webview renderer, already in use
- Electron upgrade: No, counter to lightweight philosophy

**Service Workers** (offline support)
- Not applicable for file-system focused app
- Local files always available offline

**WebAssembly** (for computation-heavy features)
- Potential: Markdown parsing in WASM for speed
- Cost-benefit unclear; markdown-it is already very fast

### Technology Debt Monitoring

- CodeMirror 7 eventual migration path (when available)
- React 19 when ecosystem stabilizes
- TypeScript 5.5+ features as they become stable
- Rust edition upgrades as they're released

---

## Build and Deploy Scripts

### Development

```bash
npm run dev        # Start dev server with hot reload
npm run dev:tauri  # Run Tauri in dev mode
npm run type-check # TypeScript type checking
npm run lint       # ESLint and Prettier
npm test           # Run unit tests
```

### Production

```bash
npm run build      # Build frontend and backend for release
npm run test:e2e   # End-to-end testing (if applicable)
npm run tauri build # Create platform-specific installers
```

### CI/CD Integration

GitHub Actions workflow:
1. Type checking (tsc)
2. Linting (eslint + cargo clippy)
3. Unit tests (vitest + cargo test)
4. Build for all platforms
5. Security audit (npm audit + cargo audit)
6. Create release artifacts

---

## Technology Stack Philosophy

### Core Principles

**Simplicity**: Every dependency must justify its existence. No "nice-to-have" libraries that add 100KB.

**Stability**: Prefer libraries at least 2 years old with active maintenance. No alpha/beta versions unless critical.

**Performance**: Measure everything. Use Lighthouse for frontend, profiling tools for backend.

**Maintainability**: Clear separation of concerns (Rust backend, React frontend). Type safety throughout (Rust + TypeScript).

**User-Centric**: Every choice evaluated from user perspective: installation size, memory usage, launch speed, visual quality.

---

## Comparison Summary

| Dimension | MdEdit | VS Code | Typora | Obsidian |
|-----------|--------|---------|--------|----------|
| Binary Size | 15MB | 400MB | 70MB | 120MB |
| Memory Idle | 70MB | 300MB | 150MB | 200MB |
| Launch Time | 200-500ms | 2-3s | 1s | 1.5s |
| Focused on Markdown | Yes | No | Yes | Yes |
| Open Source | Yes | Partial | No | No |
| Extensible | Limited (V2+) | Very | Limited | Very |
| License | MIT | Microsoft | Proprietary | Proprietary |

---

## Conclusion

The technology stack is deliberately minimal but professional. Tauri + React + CodeMirror + markdown-it + Shiki provides all the capabilities of much heavier tools while maintaining the lightweight philosophy. The choice of Rust for the backend ensures safety and performance, while TypeScript in the frontend prevents a large class of runtime errors. Each technology was selected with specific tradeoffs understood and accepted, prioritizing user experience and maintainability over ecosystem size or trend-chasing.
