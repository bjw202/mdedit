# Backend Architecture - MdEdit v0.4.0

## File Tree

```
src-tauri/src/
├── main.rs              # 바이너리 엔트리 (windows_subsystem = "windows")
├── lib.rs               # Tauri 빌더; 플러그인 등록, 커맨드 와이어링
├── commands/
│   ├── mod.rs           # 모듈 re-export
│   ├── file_ops.rs      # 파일 CRUD + 저장 다이얼로그 + 내보내기 다이얼로그 + 바이너리 쓰기 + 인쇄
│   ├── directory_ops.rs # 디렉토리 읽기 (shallow), 폴더 다이얼로그
│   ├── watcher.rs       # 파일시스템 감시 (notify crate), start/stop
│   ├── image_ops.rs     # 클립보드 이미지 저장, 이미지 복사, base64 읽기, 이미지 다이얼로그
│   └── browser_ops.rs   # URL 브라우저 열기 (플랫폼별)
├── models/
│   ├── mod.rs           # Re-export
│   ├── file_node.rs     # FileNode struct (serde camelCase)
│   └── file_event.rs    # FileChangedEvent, FileChangeKind enum
└── state/
    ├── mod.rs           # Re-export
    └── app_state.rs     # AppState: Mutex<Watcher>, watch_path, debounce map
```

## IPC Commands (18개)

### file_ops.rs (9개)
| Command | 시그니처 | 설명 |
|---------|---------|------|
| read_file | (path) → String | UTF-8 파일 읽기 |
| write_file | (path, content) → () | UTF-8 파일 쓰기, 부모 디렉토리 자동 생성 |
| create_file | (path) → () | 빈 파일 생성 |
| delete_file | (path) → () | 파일 삭제 |
| rename_file | (old, new) → () | 이름 변경/이동 |
| save_file_as | (app, content, default?) → Option&lt;String&gt; | 저장 다이얼로그 |
| export_save_dialog | (app, format, name) → Option&lt;String&gt; | 내보내기 다이얼로그 |
| write_binary_file | (path, data: Vec&lt;u8&gt;) → () | 바이너리 쓰기 (DOCX용) |
| print_current_window | (window) → () | 네이티브 인쇄 (WebviewWindow::print) |

### directory_ops.rs (2개)
| Command | 설명 |
|---------|------|
| read_directory | Shallow 디렉토리 목록 (dirs-first, 알파벳순, symlink 제외) |
| open_directory_dialog | 네이티브 폴더 선택기 |

### watcher.rs (2개)
| Command | 설명 |
|---------|------|
| start_watch | notify 재귀 감시 시작; file-changed 이벤트 emit; 50ms 디바운스 |
| stop_watch | 감시 중단 |

### image_ops.rs (4개)
| Command | 설명 |
|---------|------|
| save_image_from_clipboard | base64 → ./images/&lt;timestamp&gt;.png (최대 10MB) |
| copy_image_to_folder | 이미지 파일 → ./images/ (이름 충돌 시 숫자 접미사) |
| read_image_as_base64 | 이미지 → data:{mime};base64,{data} |
| open_image_dialog | 네이티브 이미지 파일 선택기 |

### browser_ops.rs (1개)
| Command | 설명 |
|---------|------|
| open_url_in_browser | 플랫폼별: open(macOS), cmd /C start(Win), xdg-open(Linux) |

## Tauri Plugin 등록

- `tauri_plugin_opener` — URL/파일 열기
- `tauri_plugin_shell` — 셸 접근
- `tauri_plugin_dialog` — 네이티브 파일/폴더 다이얼로그

## Security

- **경로 순회 방지**: `validate_path()`가 `".."` 포함 경로 거부 (모든 file_ops 커맨드)
- **파일 감시 필터**: `.git/`, `.DS_Store`, `Thumbs.db`, `node_modules/`, `.tmp`, `.swp`, `~` 무시
- **CSP**: `html: false` (XSS 방지), `style-src 'unsafe-inline'` (CodeMirror), `script-src 'wasm-unsafe-eval'` (Shiki)
