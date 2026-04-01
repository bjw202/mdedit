# Frontend Architecture - MdEdit v0.4.0

## File Tree

```
src/
├── main.tsx                  # React 엔트리 포인트, KaTeX CSS import
├── App.tsx                   # 루트 컴포넌트; 파일 감시, 폴더 복원
├── index.css                 # 전역 CSS; Tailwind, preview-content, CodeMirror 변수
├── components/
│   ├── editor/
│   │   ├── MarkdownEditor.tsx          # CodeMirror 6 에디터
│   │   ├── EditorToolbar.tsx           # 서식 툴바 (Bold/Italic/H1-H3/UL/OL/Code/Link/Quote/Image)
│   │   └── extensions/
│   │       ├── markdown-extensions.ts  # CodeMirror 확장 번들 팩토리
│   │       ├── keyboard-shortcuts.ts   # Ctrl+B/I/comment 키바인딩
│   │       ├── syntax-highlighting.ts  # VS Code Dark+ 스타일 하이라이트
│   │       └── image-widget.ts         # Data URI 이미지 썸네일 위젯 데코레이션
│   ├── layout/
│   │   ├── AppLayout.tsx       # 루트 레이아웃; Header + ResizablePanels + Footer
│   │   ├── Header.tsx          # 타이틀바, 파일 액션, 내보내기, 폰트/테마 제어
│   │   ├── Footer.tsx          # 상태바: 저장 상태, 단어/문자/줄 수, 커서, 스크롤 싱크
│   │   └── ResizablePanels.tsx # 3-pane 드래그 리사이즈 레이아웃
│   ├── preview/
│   │   ├── MarkdownPreview.tsx  # 미리보기 패널; usePreview 훅 사용
│   │   └── PreviewRenderer.tsx  # dangerouslySetInnerHTML; Mermaid 후처리, 링크 인터셉트
│   ├── sidebar/
│   │   ├── FileExplorer.tsx    # 사이드바; 폴더 헤더, 검색, FileTree
│   │   ├── FileSearch.tsx      # 파일명 필터 검색 입력
│   │   ├── FileTree.tsx        # FileTreeNode 정렬/렌더링
│   │   └── FileTreeNode.tsx    # 단일 파일/디렉토리 노드; 지연 로딩, 컨텍스트 메뉴
│   └── settings/
│       └── ImageModeToggle.tsx # 이미지 삽입 모드 선택 (inline-blob/file-save)
├── hooks/
│   ├── useFileSystem.ts   # 통합 파일시스템 연산 (open/save/create/delete/rename)
│   ├── useFileWatcher.ts  # Tauri file-changed 이벤트 리스너
│   ├── usePreview.ts      # 디바운스(300ms) 마크다운→HTML 렌더링
│   ├── useScrollSync.ts   # 에디터↔미리보기 스크롤 동기화 (data-line)
│   └── useTheme.ts        # dark/light/system 테마 적용
├── store/
│   ├── editorStore.ts  # 에디터 콘텐츠, 커서, dirty (비영구)
│   ├── fileStore.ts    # 파일 트리, expandedDirs (비영구)
│   └── uiStore.ts      # 테마, 너비, 저장상태, 이미지모드 (localStorage 영구)
├── lib/
│   ├── tauri/ipc.ts            # 19개 Tauri invoke() 타입 안전 래퍼
│   ├── markdown/
│   │   ├── renderer.ts         # renderMarkdown() — markdown-it 파이프라인
│   │   ├── codeHighlight.ts    # Shiki 싱글톤 (지연 초기화)
│   │   └── mermaidPlugin.ts    # mermaid 코드 블록 → placeholder div
│   ├── image/
│   │   ├── imageHandler.ts     # 이미지 붙여넣기/드래그/다이얼로그 처리
│   │   └── imageResolver.ts    # 상대 경로 → asset: URL, base64 임베딩
│   └── export/
│       ├── exportHtml.ts       # 자체 포함 HTML 내보내기
│       ├── exportPdf.ts        # 네이티브 print 기반 PDF 내보내기
│       ├── exportDocx.ts       # docx 패키지 기반 Word 내보내기
│       ├── exportUtils.ts      # 공유 유틸 (파일명, CSS, HTML 문서)
│       └── types.ts            # ExportOptions 인터페이스
└── types/
    └── file.ts  # FileNode 인터페이스 (Rust struct 미러)
```

## Component Hierarchy

```
App
└── AppLayout
    ├── Header (타이틀바, 내보내기, 설정)
    │   └── ImageModeToggle
    ├── ResizablePanels
    │   ├── FileExplorer (사이드바)
    │   │   ├── FileSearch
    │   │   └── FileTree
    │   │       └── FileTreeNode (재귀)
    │   ├── MarkdownEditor + EditorToolbar (에디터)
    │   └── MarkdownPreview (미리보기)
    │       └── PreviewRenderer
    └── Footer (상태바)
```

## Zustand Stores

| Store | 영구 저장 | 주요 상태 | 주요 소비자 |
|-------|-----------|-----------|-------------|
| editorStore | X | content, cursor, dirty, currentFilePath | MarkdownEditor, usePreview, AppLayout |
| fileStore | X | fileTree, expandedDirs, watchedPath | FileExplorer, FileTreeNode, useFileSystem |
| uiStore | O (localStorage) | theme, fontSize, sidebarWidth, previewWidth, imageInsertMode, scrollSyncEnabled | Header, Footer, ResizablePanels, useTheme |

## Hooks Dependencies

| Hook | 구독 Store | IPC 호출 | 소비자 |
|------|-----------|---------|--------|
| useFileSystem | editor, file, ui | 8개 | FileExplorer, FileTreeNode, AppLayout |
| useFileWatcher | - | startWatch, stopWatch | App |
| usePreview | editor, ui | - | MarkdownPreview |
| useScrollSync | - | - | AppLayout |
| useTheme | ui | - | AppLayout |
