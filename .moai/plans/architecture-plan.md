# 마크다운 에디터 (Tauri v2 + Rust) 아키텍처 계획

## Context

VS Code의 마크다운 편집/프리뷰 기능만을 추출한 경량 데스크탑 앱을 제작한다.
- 불필요한 무거운 의존성 없이, Rust/Tauri 기반으로 네이티브 수준의 가벼움 구현
- 현재 프로젝트는 소스 코드 없는 MoAI-ADK 프레임워크 초기 상태

---

## 기술 스택 결정

| 역할 | 선택 | 이유 |
|---|---|---|
| 네이티브 런타임 | Tauri v2 (Rust) | 가볍고 빠른 바이너리, 강력한 IPC, 크로스 플랫폼 |
| 프론트엔드 | React 18 + TypeScript + Vite | CodeMirror 생태계 호환, 빠른 번들링 |
| 에디터 컴포넌트 | CodeMirror 6 | 경량, 모듈화, 마크다운 + 중첩 코드블록 하이라이팅 지원 |
| 마크다운 렌더러 | markdown-it v14 | 빠르고 확장성 높음 |
| 코드 하이라이팅 | Shiki v1 | VS Code와 동일한 문법 정의 사용 |
| 다이어그램 | mermaid.js v11 | 표준 Mermaid 지원 |
| 상태 관리 | Zustand v5 | 경량, 직관적 |
| 파일 감시 | notify crate v6 | Rust 생태계 표준 (macOS FSEvents 등) |

---

## 프로젝트 디렉토리 구조

```
markdown-editor-rust/
├── src-tauri/                          # Rust 백엔드
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/main.json          # fs/dialog 권한 정의
│   └── src/
│       ├── main.rs                     # 진입점 (최소화)
│       ├── lib.rs                      # Tauri Builder 조합
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── file_ops.rs             # read/write/create/delete/rename
│       │   ├── directory_ops.rs        # read_directory, open_dialog
│       │   └── watcher.rs              # notify 연동, 이벤트 emit
│       ├── models/
│       │   ├── mod.rs
│       │   ├── file_node.rs            # FileNode { name, path, is_directory, children, extension }
│       │   └── file_event.rs           # FileChangedEvent { kind, path }
│       └── state/
│           ├── mod.rs
│           └── app_state.rs            # Mutex<WatcherState>
│
├── src/                                # 프론트엔드
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx           # 3-패널 CSS Grid 컨테이너
│   │   │   └── ResizablePanels.tsx     # 드래그 리사이즈 핸들
│   │   ├── sidebar/
│   │   │   ├── FileExplorer.tsx        # 사이드바 루트 + 툴바
│   │   │   ├── FileTree.tsx            # 재귀 트리 렌더러
│   │   │   ├── FileTreeNode.tsx        # 파일/폴더 노드
│   │   │   └── FileActions.tsx         # 생성/삭제/이름변경 컨텍스트 메뉴
│   │   ├── editor/
│   │   │   ├── MarkdownEditor.tsx      # CodeMirror 6 래퍼
│   │   │   ├── EditorToolbar.tsx       # 저장, Bold, Italic 버튼
│   │   │   └── extensions/
│   │   │       ├── markdownHighlight.ts
│   │   │       ├── themeExtension.ts
│   │   │       └── keybindings.ts
│   │   └── preview/
│   │       ├── MarkdownPreview.tsx     # 프리뷰 패널
│   │       └── PreviewRenderer.tsx     # markdown-it + Mermaid 후처리
│   ├── hooks/
│   │   ├── useFileSystem.ts            # Tauri fs 추상화
│   │   ├── useFileWatcher.ts           # "file-changed" 이벤트 구독
│   │   ├── useEditor.ts                # CodeMirror 상태
│   │   ├── usePreview.ts               # 300ms 디바운스 렌더링
│   │   └── useTheme.ts                 # 다크/라이트 전환
│   ├── store/
│   │   ├── editorStore.ts              # activeFilePath, content, isDirty
│   │   ├── fileStore.ts                # rootPath, fileTree, expandedPaths
│   │   └── uiStore.ts                  # sidebarWidth, isDark (localStorage 영속화)
│   ├── lib/
│   │   ├── markdown/
│   │   │   ├── renderer.ts             # markdown-it 설정 + Shiki 통합
│   │   │   ├── mermaidPlugin.ts        # ```mermaid 블록 → div 변환 + 후처리
│   │   │   └── codeHighlight.ts        # Shiki 초기화 및 캐싱
│   │   └── tauri/
│   │       └── ipc.ts                  # invoke() 타입 안전 래퍼 (FileAPI)
│   ├── types/
│   │   ├── file.ts                     # FileNode, FileChangedEvent
│   │   └── editor.ts
│   └── styles/
│       ├── global.css
│       ├── themes/dark.css
│       ├── themes/light.css
│       └── components/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

## Rust 백엔드 설계

### 핵심 커맨드 (IPC: Frontend → Rust)

| 커맨드 | 인자 | 반환 | 역할 |
|---|---|---|---|
| `read_file` | `path: String` | `String` | 파일 내용 읽기 |
| `write_file` | `path, content` | `()` | 파일 저장 |
| `create_file` | `path: String` | `()` | 새 파일 생성 |
| `delete_file` | `path: String` | `()` | 파일/폴더 삭제 |
| `rename_file` | `old_path, new_path` | `()` | 이름 변경 |
| `read_directory` | `path: String` | `Vec<FileNode>` | 디렉토리 1단계 조회 (지연 로딩) |
| `open_directory_dialog` | - | `Option<String>` | 네이티브 폴더 선택 |
| `start_watch` | `path: String` | `()` | 파일 변경 감시 시작 |
| `stop_watch` | - | `()` | 감시 중단 |

### 이벤트 (Rust → Frontend)

| 이벤트 | 페이로드 | 설명 |
|---|---|---|
| `file-changed` | `FileChangedEvent { kind, path }` | 파일 생성/수정/삭제 알림 |

### Cargo.toml 핵심 의존성

```toml
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
notify = "6"

[profile.release]
opt-level = "s"    # 바이너리 크기 최소화
lto = true
strip = true
```

---

## 프론트엔드 핵심 설계

### package.json 핵심 의존성

```json
{
  "@tauri-apps/api": "^2",
  "@codemirror/state": "^6",
  "@codemirror/view": "^6",
  "@codemirror/lang-markdown": "^6",
  "@codemirror/language-data": "^6",
  "@codemirror/theme-one-dark": "^6",
  "codemirror": "^6",
  "markdown-it": "^14",
  "mermaid": "^11",
  "shiki": "^1",
  "react": "^18",
  "react-dom": "^18",
  "zustand": "^5"
}
```

### 핵심 데이터 흐름

**파일 열기:**
```
FileTreeNode 클릭
  → fileStore.openFile(path)
  → invoke('read_file', { path })
  → editorStore.setActiveFile(path, content)
  → MarkdownEditor content 업데이트
  → usePreview 디바운스 렌더링
```

**실시간 프리뷰 (300ms 디바운스):**
```
사용자 타이핑
  → CodeMirror updateListener → onChange(content)
  → editorStore.setContent(content)
  → usePreview debounce(300ms)
  → markdown-it.render(content) + Shiki 코드 하이라이팅
  → PreviewRenderer innerHTML 업데이트
  → renderMermaidDiagrams() (useEffect 후처리)
```

**파일 변경 감지:**
```
외부 파일 수정 → notify crate 감지
  → app.emit("file-changed", payload)
  → useFileWatcher listen()
  → isDirty ? "재로드 확인 다이얼로그" : 자동 재로드
  → fileTree 갱신 (생성/삭제 시)
```

### CodeMirror 6 에디터 확장 구성

```typescript
[
  basicSetup,                              // 기본 에디터 기능 (라인번호, 검색 등)
  markdown({
    base: markdownLanguage,
    codeLanguages: languages,              // 코드블록 내부 언어 하이라이팅
  }),
  syntaxHighlighting(defaultHighlightStyle),
  isDark ? oneDark : lightTheme,
  EditorView.lineWrapping,
  keymap.of([...defaultKeymap, saveKeymap]),
]
```

### Mermaid 처리 전략

- markdown-it 플러그인으로 ` ```mermaid ` 블록을 `<div data-mermaid-code="...">` 로 변환
- `PreviewRenderer`의 `useEffect`에서 `mermaid.render()` 를 통해 SVG로 교체
- `securityLevel: 'strict'` 로 XSS 방지

---

## 보안 설계

- `markdown-it` `html: false` → 마크다운 내 HTML 태그 비허용 (XSS 방지)
- Mermaid `securityLevel: 'strict'`
- Tauri capabilities로 파일 접근 범위 명시적 제어
- 외부 링크 → `shell:open` 으로 기본 브라우저에서 열기

---

## 구현 순서 (Phases)

```
Phase 1: 프로젝트 스캐폴딩
  ├── pnpm create tauri-app (React + TypeScript)
  ├── Cargo.toml 의존성 추가
  └── package.json 의존성 추가

Phase 2: Rust 백엔드 (models → state → commands → lib.rs)
  └── 모든 IPC 커맨드 + 파일 워처 구현

Phase 3: 프론트엔드 - 에디터
  ├── Zustand 스토어 3개
  ├── CodeMirror 6 마운트 + 마크다운 하이라이팅
  └── Ctrl+S 저장 연결

Phase 4: 프론트엔드 - 프리뷰
  ├── markdown-it + Shiki 초기화
  ├── Mermaid 플러그인
  └── 디바운스 훅

Phase 5: 파일 탐색기
  ├── FileTree 재귀 컴포넌트
  ├── 파일 CRUD 동작
  └── 파일 워처 연동

Phase 6: UI 마무리
  ├── 리사이즈 가능한 3-패널 레이아웃
  ├── 다크/라이트 테마
  └── 저장 상태 인디케이터
```

---

## 검증 방법

1. `cargo tauri dev` 로 개발 서버 실행 → 앱 정상 시작 확인
2. 폴더 열기 → 파일 트리 렌더링 확인
3. `.md` 파일 클릭 → 에디터에 내용 + 문법 하이라이팅 표시 확인
4. 타이핑 → 300ms 후 오른쪽 프리뷰 자동 업데이트 확인
5. ` ```mermaid ` 다이어그램 코드 입력 → SVG 렌더링 확인
6. ` ```typescript ` 코드블록 → Shiki 하이라이팅 확인
7. Ctrl+S → 파일 저장 + "저장됨" 표시 확인
8. 외부 에디터로 파일 수정 → 앱에서 재로드 감지 확인
9. `cargo tauri build` → 배포 바이너리 크기 확인 (목표: ~15MB 이하)

---

## 핵심 파일 경로 (구현 우선순위 기준)

1. `src-tauri/src/lib.rs` - Tauri Builder: 모든 플러그인/커맨드/상태 조합
2. `src-tauri/src/commands/watcher.rs` - notify + Tauri 이벤트 브릿지
3. `src/lib/tauri/ipc.ts` - 타입 안전 IPC 래퍼 (프론트엔드 전체 진입점)
4. `src/components/editor/MarkdownEditor.tsx` - CodeMirror 6 생명주기 관리
5. `src/lib/markdown/renderer.ts` - markdown-it + Shiki 비동기 초기화
6. `src/lib/markdown/mermaidPlugin.ts` - Mermaid 통합 플러그인
