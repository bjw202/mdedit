# SPEC-AI-001 심층 연구 리포트 — AI 기능 (M0+M1)

- 작성일: 2026-07-16
- 조사 방법: Explore 에이전트 심층 코드베이스 분석 (10개 영역)
- 설계 근거: `.moai/design/ai-features-mvp-design.md` v0.4 / `.moai/design/ai-features-mvp-simulation-report.md`

## 0. 요약

Tauri 2 + React 18 + CodeMirror 6 + zustand + TypeScript(strict) 마크다운 에디터로, SPEC 기반 브라운필드 개발이 잘 정착되어 있습니다. AI 기능이 붙을 지점(CodeMirror widget decoration, Tauri command/event, zustand store, 설정 UI, mermaid 파이프라인)의 선례가 모두 존재하며 설계서 v0.4 접근과 대부분 정합합니다. 가장 신규성 높은 영역은 Rust `ai/` 모듈(프로세스 스폰 + 델타 스트리밍 이벤트 릴레이)로, 기존에 자식 프로세스 stdout 캡처/라인 스트리밍 선례가 없어 M0의 핵심 리스크입니다.

## 1. 아키텍처 분석 (파일 경로·의존성)

### 프론트엔드
- `src/App.tsx` — 앱 루트, useFileWatcher 배선, platform attribute 설정
- `src/components/layout/AppLayout.tsx` — 3-패널 셸, handleFormat/handleInsertTable, **viewRef(EditorView) 소유(useRef, store 밖)**
- `src/components/layout/Header.tsx` — 설정성 컨트롤이 인라인 렌더되는 곳(ImageModeToggle/ViewModeToggle/폰트/테마)
- `src/components/editor/MarkdownEditor.tsx` — CodeMirror EditorView 생성·소유, keymap 등록
- `src/components/editor/EditorToolbar.tsx` — 포맷 버튼 + TableGridPicker 팝오버(선택 툴바 선례)
- `src/components/editor/extensions/markdown-extensions.ts` — 확장 번들(createMarkdownExtensions), AI 확장 등록 지점
- `src/components/editor/extensions/keyboard-shortcuts.ts` — keymap + dispatch 헬퍼(wrapSelection/insertTable)
- `src/components/editor/extensions/image-widget.ts` — ★ Decoration widget 선례(제안카드/고스트의 원형)
- `src/components/preview/PreviewRenderer.tsx` — ★ mermaid.parse/render 선례(사전검증)
- `src/store/{editorStore,uiStore,fileStore}.ts` — zustand
- `src/lib/tauri/ipc.ts` — ★ invoke 래퍼 단일 계층(ai invoke 추가 지점)

### 백엔드 (`src-tauri/src/`)
- `lib.rs` — invoke_handler에 command 등록(lib.rs:35-55), .setup()에서 앱 초기화(정책 kill-switch 프로브 지점)
- `commands/watcher.rs` — ★ 별도 스레드 스폰 + `app_handle.emit()` 이벤트 릴레이 선례(watcher.rs:104-140)
- `commands/browser_ops.rs` — ★ `std::process::Command::spawn()` 선례(browser_ops.rs:20-23, fire-and-forget)
- `commands/file_ops.rs` — validate_path 보안 경계, `Result<T, String>` 에러 규약
- `state/app_state.rs` — Mutex 기반 managed state(AI in-flight 프로세스 핸들 보관 참고)

의존성 확정: `mermaid@11.12.3`(핀 + patch-package), CodeMirror6(`@codemirror/view ^6.39`, state, commands, lang-markdown, **autocomplete ^6.20 이미 설치**), `zustand ^5`, `@tauri-apps/plugin-shell ^2.3.5`. capabilities/main.json에 `shell:allow-execute`, `shell:allow-spawn` 이미 허용됨.

## 2. 발견된 기존 패턴·컨벤션 (참조 구현 파일:라인)

**2.1 CodeMirror widget — AI UI 핵심 선례**: `image-widget.ts`가 제안카드/고스트텍스트의 직접 원형. `WidgetType` 서브클래스+`toDOM()`(82-140), `ViewPlugin.fromClass`+`RangeSetBuilder<Decoration>`(155-198), `EditorView.atomicRanges.of()`(193-197). 문서 텍스트 비오염(뷰 레이어 전용) → 설계서 §4.3 block widget 요구와 일치. 제안카드=`Decoration.widget({block:true})`, 고스트=inline widget.

**2.2 트랜잭션 dispatch(P5 정합)**: `state.changeByRange(range=>{...})` 후 `view.dispatch(changes)`(keyboard-shortcuts.ts:16-52, insertTable 119-145). `insertTable`은 dispatch 후 `EditorSelection.range`로 삽입 텍스트 선택 상태 만드는 선례까지 제공. `history()`/historyKeymap이 번들에 이미 포함(markdown-extensions.ts:107-110) → undo 스택 무료.

**2.3 keymap — Mod- 접두어 플랫폼 자동 매핑**: 모든 단축키 `Mod-s`,`Mod-Shift-i`,`Mod-b`(MarkdownEditor.tsx:113-218). CodeMirror가 Mod→macOS⌘/Win·Linux Ctrl 자동 매핑 → 설계서 §2가 코드 레벨에서 이미 만족. **Tab은 `indentWithTab`으로 들여쓰기 바인딩됨(markdown-extensions.ts:110)** — 설계서 §5의 "Tab 확정키 제외"와 정합(기존 Tab 유지). AI keymap을 확장 배열 앞쪽(높은 precedence)에 등록해야 `Mod-Enter`/`Esc`가 고스트 활성 시 선점됨.

**2.4 Tauri command+이벤트 릴레이 — 스트리밍 핵심 선례**: `watcher.rs`가 가장 가까운 선례 — 별도 스레드에서 `app_handle.emit("file-changed", &payload)`(95,138), 프론트는 `listen<T>` 후 unlisten 반환(useFileWatcher.ts:68-79). → `ai://chunk|done|error`는 이 패턴 그대로. 프로세스 스폰은 browser_ops.rs(fire-and-forget)뿐이라 **stdout 파이프 캡처·자식 kill·라인 스트리밍은 신규 구현**. in-flight 관리는 AppState에 `Mutex<Option<Child>>` 추가(watcher 관리와 동형), ai_cancel=child.kill().

**2.5 에러 규약**: 모든 command `Result<T, String>`+`.map_err(|e| format!())`. 설계서 §9 오류 분류(로그인만료/네트워크/기타)는 stderr를 Rust에서 분류해 `ai://error` payload enum 필드로 전달.

**2.6 mermaid 파이프라인**: `PreviewRenderer.tsx:114`에서 `await mermaid.parse(diagram)`을 render 전 호출(사전검증) → **설계서 §4.2 시나리오 C "삽입 전 로컬 파서 검증" 이미 구현, 재사용 가능**. `mermaid.render(id,diagram)→{svg}`로 카드 미니 렌더. `MERMAID_BASE_CONFIG={startOnLoad:false, securityLevel:'strict'}` 고정, theme만 동적(29,107). **securityLevel:'strict' 약화 금지(@MX:WARN, XSS)**. mermaid 11.12.3 핀 + patches/mermaid+11.12.3.patch(cluster 라벨 width:1e5) 유지.

**2.7 zustand 컨벤션**: `create<State>()((set)=>({}))`. 영속화는 `persist(...,{name,partialize})`(uiStore.ts:72-129), 트랜지언트값은 partialize 제외(statusMessage 선례 123-126) → **aiStore 스트림버퍼·요청상태는 영속화 제외**. 타이머 등 컴포넌트 수명 무관 부수효과는 module-level ref(25,106-118) → AI 취소핸들/unlisten에 동일. **EditorView는 store에 안 넣음** — AppLayout이 viewRef(useRef)로 소유, onViewReady 콜백으로 획득(AppLayout.tsx:163,187-190). store 액션은 `useXStore.getState()`로 비반응형 접근이 지배적. 선택 상태는 `state.selection.main.head`, `state.sliceDoc(from,to)`, `state.doc.lineAt()`.

**2.8 설정 UI**: **전용 설정 화면 없음** — 설정성 컨트롤이 Header.tsx에 인라인 렌더(171-188). ImageModeToggle은 useUIStore 구독+`<select>`+`--md-*` 토큰. **설계서 §8.2 "설정>AI" 섹션·온보딩 위저드·고지 배너는 신규 설정 다이얼로그 필요** → 설정화면 형태(모달/우측패널/헤더확장)는 사용자 결정 필요.

**2.9 팝오버·컨텍스트 메뉴**: `TableGridPicker`(EditorToolbar.tsx:97-178) = relative 래퍼+`absolute top-full z-50`+**외부 mousedown+Escape 양쪽 닫기** → ✨선택툴바·프리셋메뉴 직접 선례. 우클릭은 `FileTreeNode.tsx:156-158`에 `onContextMenu`→{x,y} 좌표 팝업 선례(§4.1 우클릭 중복노출에 재사용).

**2.10 테마 토큰(AI 패널 승계)**: `src/styles/mdedit-tokens.css` = `:root`(light)+`[data-theme="dark"]`, `--md-*` 시맨틱 롤, raw hex 금지(SPEC-UI-006). `useTheme.ts:18-25`가 `.dark`클래스+`data-theme`속성 동시 토글 → **AI 패널·카드는 `--md-*` 토큰만 쓰면 다크/라이트 자동 대응**(설계서 §6.0 충족). 채팅앱풍 별도 시각언어 금지 규약과 정합.

## 3. 리스크·암묵 계약

- **프론트매터 포맷터가 .md 쓰기 손상**(설계서 §1 비목표): AI는 사용자 트리거 dispatch만, 프론트매터 자동갱신 금지 유지.
- **`npm run lint` 항상 실패**(eslint config 부재, package.json:17): 실질 게이트=`tsc --noEmit`(strict)+`vitest run`+Playwright(webkit). lint 실패를 회귀로 오판 금지.
- **AI 스트리밍 릴레이 완전 신규**: stdout 파이프캡처·라인스트리밍·자식kill 선례 없음. M0에서 watcher.rs 스레드+emit 패턴 재활용해 최우선 프로토타입.
- **shell 권한 확보됨**(capabilities/main.json) but `claude` 임의경로 실행 보안검토 필요(expert-security). ai:// 이벤트는 emit이라 별도 capability 불필요.
- **securityLevel:'strict' 약화 금지**(PreviewRenderer.tsx:27-29): 카드 미니렌더도 strict 유지, mermaid render 산출 SVG만 innerHTML.
- **CSP null**(tauri.conf.json): 카드 렌더 시 사용자문서·AI출력 escape 주의.
- **i18n 없음**(grep 0건): UI 문자열 한국어 하드코딩(기존 관례), 단축키 표기만 OS별 분기(§2).
- **EditorView는 store 밖 useRef**(AppLayout.tsx:163 @MX 주석 "NOT stored in Zustand"): aiStore에 EditorView 넣지 말 것.
- **정책 kill-switch(`MDEDIT_AI_DISABLED`)**: Rust `std::env::var`+설정디렉토리 정책파일, lib.rs setup()에서 1회 프로브 후 프론트 전달 command 신설.
- **로그인 세션 감지**: detect command에서 `claude --version`+세션파일 존재확인, 크로스플랫폼 경로(Win `%USERPROFILE%`) 주의(주 사용자 Windows).

## 4. 테스트 인프라

- **vitest**(vite.config.ts test 블록, jsdom, setupFiles ./src/test/setup.ts, e2e 제외) — 48개 테스트파일.
- **CM 단위테스트 모범**: `insertTable.test.ts:15-26` — 실제 `EditorState.create`+가짜 view 스텁(`{get state(){}, dispatch(spec){state=state.update(spec).state}}`)로 DOM 없이 dispatch 검증. AI 트랜잭션 적용·재검증(§4.3)·선택확장을 이 방식으로. `image-widget.test.ts`는 DocView 최소 인터페이스로 decoration 순수 테스트.
- **Playwright**: e2e/*.spec.ts, **webkit 단일 프로젝트**, webServer=npm run dev-vite(1420). Tauri IPC 없어 렌더/상호작용 위주.
- **Rust 테스트**: 각 command 하단 `#[cfg(test)] mod tests`, 순수함수 위주 → AI 스트림 JSON 파싱을 순수함수 분리해 테스트.
- **RED-first(TDD)**: insertTable.test.ts:2 "written before implementation exists" — 프로젝트 기본 methodology는 TDD.

## 5. SPEC 문서 컨벤션

`.moai/specs/SPEC-XXX/` 디렉토리. 최근 SPEC-UI-007-table-insert 파일: spec.md/plan.md/acceptance.md/tasks.md/research.md/progress.md/spec-compact.md. 최소셋(SPEC-PREVIEW-008): spec.md/plan.md/acceptance.md.

**spec.md 프론트매터**: id, version, status, created, updated, author, priority, issue_number, dependencies[], tags[], lifecycle: spec-anchored.
**본문**: HISTORY 표 → Summary → 핵심설계결정(사용자승인,재검토금지) → Background&Rationale(파일:라인 근거) → Environment&Assumptions → **Requirements(EARS)**(Ubiquitous/Event-Driven/State-Driven/Unwanted, REQ-XXX-NNN "shall") → Design Notes/Future → **Delta(Brownfield)** 표([MODIFY]/[NEW] 파일별) → **Acceptance Criteria** 표(AC↔REQ 1:1) → Quality Gates(tsc+vitest, lint 제외 명시) → Exclusions.

## 6. M0/M1 구현 접근 권고

### M0 (기반) — 신규성 높은 순
1. **Rust `ai/` 모듈**(mod/provider/claude_cli/detect/prompt.rs): provider.rs에 `AiProvider` trait 확정(claude 단독, capabilities() 포함 M4 대비). claude_cli.rs는 `Command`로 빈 스크래치 cwd(.current_dir)+`--setting-sources ""`+`MAX_THINKING_TOKENS=0`(.env)+`--output-format stream-json` 스폰, `Stdio::piped()` stdout 리더 스레드에서 `stream_event.content_block_delta.text_delta` 파싱→`emit("ai://chunk")`, `result`→ai://done, stderr 분류→ai://error. **watcher.rs 스레드+emit 확장**. AppState에 `Mutex<Option<Child>>`(in-flight 1개, ai_cancel=kill). **스트림 JSON 파싱은 순수함수 분리→Rust 유닛테스트**. command→lib.rs:35 등록.
2. **프론트 릴레이**: ipc.ts에 aiRequest/aiCancel/aiDetectProviders 래퍼, ai:// listen 훅(useFileWatcher 구조 복제).
3. **aiStore**: `create<AiState>()` — 상태(idle/streaming/done/error)+스트림버퍼+취소핸들, 비영속, unlisten module-ref.
4. **설정 UI+온보딩+고지배너+정책 kill-switch**: 신규 설정 다이얼로그(Header 인라인 한계), `--md-*` 토큰만. → 형태 사용자 결정 필요.

### M1 (축1+시나리오 F)
1. **✨ 선택툴바+프리셋메뉴**: TableGridPicker(외부mousedown+Esc) 복제, 위치는 `view.coordsAtPos(selection.main.head)`.
2. **제안카드 위젯**: image-widget.ts WidgetType+ViewPlugin+`Decoration.widget({block:true})` 확장(즉석지시 입력·미니 mermaid 렌더 포함).
3. **단일 트랜잭션 적용+dispatch 직전 원문 재검증(§4.3)**: `sliceDoc(from,to)`가 카드 생성시점 원문과 일치검사 후 dispatch. insertTable dispatch+선택 패턴 재사용.
4. **선택 길이 가드(§4.4)**: 2000/4000자 분기, 프리셋 활성/비활성, 순수함수 분리→vitest.
5. **mermaid 사전검증(§4.2 C)**: PreviewRenderer mermaid.parse 로직 추출·공유, strict 유지.
6. **빈 섹션 채우기(시나리오 F)**: 고스트=inline widget decoration, `Mod-Enter` keymap을 AI 확장 배열 앞쪽 등록, Tab은 기존 indentWithTab 유지(오버라이드 금지). 힌트는 토큰0 로컬판정(커서위치·타이머).

### 방법론
프로젝트 기본 **TDD(RED-first)**. Rust 파싱/가드 순수함수 + CM 트랜잭션 로직은 insertTable.test.ts 가짜 view 방식으로 테스트 우선.

## 주요 참조 파일
- `src/components/editor/extensions/image-widget.ts` (위젯 원형)
- `src-tauri/src/commands/watcher.rs` (스레드+emit 스트리밍 릴레이 선례)
- `src-tauri/src/commands/browser_ops.rs` (프로세스 스폰 선례)
- `src/components/preview/PreviewRenderer.tsx` (mermaid.parse/render+strict+테마)
- `src/components/editor/EditorToolbar.tsx` (팝오버 외부클릭+Esc 닫기)
- `src/components/layout/AppLayout.tsx` (viewRef 소유·handleFormat 배선)
- `src/store/uiStore.ts` (persist/partialize/module-ref 타이머 컨벤션)
- `src/test/insertTable.test.ts` (CM 단위테스트 패턴)
- `src-tauri/capabilities/main.json` (shell 권한 이미 허용)
