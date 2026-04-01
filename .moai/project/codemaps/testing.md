# Test Architecture - MdEdit v0.4.0

## Framework

- **Vitest 2** + **@testing-library/react 14** + **jsdom 28**
- 설정: `src/test/setup.ts` (jest-dom matchers, matchMedia mock)
- 환경: jsdom (Vite config inline)

## Test Files (30개, 331 tests)

| 테스트 파일 | 대상 모듈 | 테스트 수 | 패턴 |
|------------|----------|----------|------|
| app.test.tsx | App.tsx | 5 | render + screen queries |
| infrastructure.test.ts | Vite config, ESM, jsdom | 8 | import/환경 검증 |
| editorStore.test.ts | editorStore | - | Zustand setState/getState |
| fileStore.test.ts | fileStore | - | Zustand actions |
| uiStore.test.ts | uiStore | - | 클램핑, 영구 저장, actions |
| Header.test.tsx | Header | 11 | 내보내기 메뉴, dirty 표시 |
| Footer.test.tsx | Footer | - | 상태 라벨, 커서, 싱크 토글 |
| EditorToolbar.test.tsx | EditorToolbar | - | 버튼 수, onFormat 콜백 |
| MarkdownEditor.test.tsx | MarkdownEditor | - | CodeMirror 마운트, Ctrl+S |
| MarkdownPreview.test.tsx | MarkdownPreview | - | usePreview mock |
| PreviewRenderer.test.tsx | PreviewRenderer | - | innerHTML, Mermaid, 링크 인터셉트 |
| ResizablePanels.test.tsx | ResizablePanels | 3 | 3-pane, 사이드바 접기 |
| FileExplorer.test.tsx | FileExplorer | - | 폴더 열기, 검색 필터 |
| FileTree.test.tsx | FileTree | 6 | 노드 정렬, dirs-first |
| FileTreeNode.test.tsx | FileTreeNode | - | 클릭, 컨텍스트 메뉴 |
| FileSearch.test.tsx | FileSearch | 7 | 입력, 클리어 |
| ImageModeToggle.test.tsx | ImageModeToggle | 5 | select, onChange |
| renderer.test.ts | renderer | 27 | markdown-it 렌더링 (기본+data-line+KaTeX) |
| usePreview.test.ts | usePreview | - | 300ms 디바운스, 에러 복원 |
| useFileSystem.test.ts | useFileSystem | - | openFolder, openFile, CRUD |
| useFileWatcher.test.ts | useFileWatcher | - | listen 등록, cleanup |
| useScrollSync.test.ts | useScrollSync | - | 스크롤 이벤트, 피드백 루프 |
| useTheme.test.ts | useTheme | 3 | dark 클래스 추가/제거 |
| imageHandler.test.ts | imageHandler | - | 붙여넣기, 드래그, 다이얼로그 |
| image-widget.test.ts | image-widget | - | parseDataUri, ImageWidget, buildDecorations |
| export.test.ts | 전체 export | - | HTML/PDF/DOCX 통합 |
| exportHtml.test.ts | exportHtml | - | 자체 포함 HTML, Mermaid, 이미지 |
| exportPdf.test.ts | exportPdf | - | DOM 주입, afterprint |
| exportDocx.test.ts | exportDocx | - | 토큰→DOCX 매핑 |
| ExportHeader.test.tsx | Header (export) | - | 내보내기 로딩 표시 |

## Key Mock Patterns

### 1. Tauri API Mock
```typescript
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
```

### 2. Dynamic Import (renderer.test.ts)
```typescript
// Shiki/Mermaid의 비동기 초기화가 jsdom에서 깨지므로 vi.mock 후 동적 import
vi.mock('shiki', () => ({ createHighlighter: vi.fn().mockResolvedValue({...}) }))
const { renderMarkdown } = await import('@/lib/markdown/renderer')
```

### 3. Fake Timers (usePreview.test.ts)
```typescript
vi.useFakeTimers()
vi.advanceTimersByTime(300)  // 디바운스 대기
vi.runAllTimersAsync()
```

### 4. Zustand Store Reset
```typescript
beforeEach(() => { useEditorStore.setState({ content: '', dirty: false, ... }) })
```

### 5. Zustand Selector Mock
```typescript
vi.mock('@/store/editorStore', () => ({
  useEditorStore: vi.fn((selector) => selector(mockState))
}))
```

## Coverage Areas

| 영역 | 커버리지 | 비고 |
|------|---------|------|
| Components | 높음 | 모든 컴포넌트에 테스트 존재 |
| Hooks | 높음 | 5/5 훅 테스트 |
| Stores | 높음 | 3/3 스토어 테스트 |
| Markdown Rendering | 높음 | 27 tests (기본+data-line+KaTeX) |
| Export | 높음 | HTML/PDF/DOCX 각각 + 통합 |
| Image Handling | 높음 | 핸들러 + 위젯 |
| Rust Backend | 없음 | 프론트엔드 테스트만 (Rust는 cargo test 없음) |

## Build & Config

| 설정 파일 | 핵심 내용 |
|----------|----------|
| vite.config.ts | jsdom 환경, @/ 별칭, setup.ts, e2e 제외, 4GB 메모리 |
| tsconfig.json | ES2020, strict, noUnusedLocals, react-jsx |
| tailwind.config.js | darkMode: 'class', src/** 스캔 |
| src-tauri/tauri.conf.json | CSP, 1280x800 윈도우, unsafe-inline |
| src-tauri/Cargo.toml | lto=true, opt-level="s", strip=true |
