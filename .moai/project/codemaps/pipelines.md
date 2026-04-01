# Pipelines & Data Flow - MdEdit v0.4.0

## 1. Markdown Rendering Pipeline

```
에디터 콘텐츠 (string)
        │
        ▼ (300ms 디바운스, usePreview)
renderMarkdown(content, highlighter, isDark, mdFilePath)
        │
        ▼ MarkdownIt 인스턴스 (호출마다 새로 생성)
        │
        ├─ html: false ──────────── XSS 방지 (변경 금지)
        ├─ linkify: true ────────── URL 자동 링크
        ├─ typographer: true ────── 스마트 따옴표
        │
        ├─ highlight (Shiki)
        │       └─ codeToHtml(code, { lang, theme })
        │             폴백: escapeHtml + <code>
        │
        ├─ md.enable('table')
        ├─ md.enable('strikethrough')
        │
        ├─ Plugin 1: mermaidPlugin
        │       └─ ```mermaid → <div class="mermaid-container" data-diagram="...">
        │
        ├─ Plugin 2: markdownItKatex { throwOnError: false }
        │       ├─ $...$ → 인라인 KaTeX
        │       └─ $$...$$ → 블록 KaTeX (.katex-display)
        │
        ├─ Plugin 3: tableScrollPlugin
        │       └─ <table> → <div class="table-scroll-wrapper"><table style="...">
        │
        ├─ Plugin 4: imageResolverPlugin
        │       └─ 상대 경로 → convertFileSrc() → asset: URL
        │
        └─ Plugin 5: dataLinePlugin
                └─ 블록 토큰 → data-line="N" (0-based, 스크롤 싱크용)
        │
        ▼ md.render(content) → HTML 문자열
        │
        ▼ embedPreviewImages(html, mdFilePath)
        │       └─ 로컬 <img> → readImageAsBase64() IPC → data URI
        │
        ▼ PreviewRenderer (dangerouslySetInnerHTML)
        │
        ▼ useEffect (HTML 업데이트 후)
                ├─ .mermaid-container 찾기
                ├─ mermaid.parse() → 구문 검증
                ├─ mermaid.render() → SVG
                └─ el.innerHTML = svg
```

## 2. Image Handling Pipeline

### Clipboard Paste (inline-blob 모드)
```
ClipboardEvent → MarkdownEditor paste 핸들러
→ fileToBase64(file) → data:image/png;base64,...
→ insertImageMarkdown(view, dataUri)
→ 에디터: ImageWidget 데코레이션 (썸네일)
→ 미리보기: <img src="data:..."> 렌더링
```

### Clipboard Paste (file-save 모드)
```
ClipboardEvent → MarkdownEditor paste 핸들러
→ fileToBase64(file) → base64
→ saveImageFromClipboard(mdFilePath, base64) IPC
→ Rust: base64 디코드 → ./images/<timestamp>.png 저장
→ insertImageMarkdown(view, './images/...')
→ 미리보기: resolveImageSrc → asset: URL → embedPreviewImages → data URI
```

### Drag-and-Drop (항상 file-save)
```
DragEvent → MarkdownEditor drop 핸들러
→ copyImageToFolder(filePath, mdFilePath) IPC
→ Rust: ./images/에 복사 (이름 충돌 시 숫자 접미사)
→ insertImageMarkdown(view, relativePath)
```

## 3. Export Pipeline

### HTML 내보내기
```
exportToHtml → exportSaveDialog IPC
→ renderMarkdown (Shiki + 모든 플러그인)
→ replaceMermaidPlaceholders (DOM에서 SVG 복제)
→ embedLocalImages (readImageAsBase64 → data URI)
→ buildHtmlDocument (자체 포함, JS 없음)
→ writeFile IPC
```

### PDF 내보내기
```
exportToPdf → generateHtmlContent (HTML과 동일)
→ #pdf-export-print div + @media print style 주입
→ double rAF (레이아웃 안정화)
→ printCurrentWindow IPC (WebviewWindow::print)
→ afterprint 이벤트 → cleanup (5분 폴백 타임아웃)
```

### DOCX 내보내기
```
exportToDocx → exportSaveDialog IPC
→ captureMermaidImages (SVG → canvas → PNG)
→ MarkdownIt.parse() → tokens[]
→ convertTokensToDocx (토큰별 DOCX 요소 매핑)
→ Packer.toBlob → ArrayBuffer → Uint8Array
→ writeBinaryFile IPC
```

## 4. Core Data Flows

### 에디터 → 미리보기
```
사용자 타이핑 → EditorView updateListener
→ editorStore.setContent() → usePreview 구독
→ 300ms 디바운스 → renderMarkdown → embedPreviewImages
→ html 상태 업데이트 → MarkdownPreview → PreviewRenderer
```

### 파일 열기
```
FileTreeNode 클릭 → useFileSystem.openFile(path)
→ dirty guard (confirm) → readFile IPC
→ fileStore.setCurrentFile + editorStore.setContent (isExternalUpdate=true)
→ CodeMirror 트랜잭션 dispatch → 미리보기 300ms 후 업데이트
```

### 파일 감시 → 자동 리로드
```
외부 편집기가 파일 수정 → OS 이벤트 → notify crate
→ should_ignore + 50ms 디바운스 → app_handle.emit("file-changed")
→ useFileWatcher 콜백 → App.tsx onFileChanged
→ readFile IPC → editorStore.setContent → 미리보기 자동 업데이트
```

### 스크롤 싱크
```
에디터 스크롤 → scrollDom 'scroll' 이벤트 → rAF 쓰로틀
→ lineBlockAtHeight → 0-based 줄 번호 계산
→ 미리보기 [data-line] 쿼리 → 가장 가까운 요소 찾기
→ isProgrammaticScroll=true → preview.scrollTo (무한 루프 방지)
```

## 5. Key Invariants

1. **html: false** — markdown-it에서 변경 금지 (XSS 방지)
2. **EditorView는 ref** — Zustand에 저장하지 않음 (DOM 참조, 리렌더 방지)
3. **fileStore 비영구** — expandedDirs: Set은 JSON 직렬화 불가
4. **Shallow 디렉토리 로딩** — 한 단계만 읽기, 확장 시 지연 로딩
5. **isExternalUpdateRef** — 파일 열기/리로드 시 dirty 마킹 방지
6. **isProgrammaticScrollRef** — 스크롤 싱크 무한 루프 방지
7. **50ms 감시 디바운스** — 중복 file-changed 이벤트 방지
8. **경로 순회 방지** — validate_path()가 ".." 거부
