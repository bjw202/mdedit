# SPEC-PREVIEW-007 — 수용 기준

> development_mode = tdd. 모든 시나리오는 vitest + @testing-library/react로 검증 가능해야 한다(GREEN 단계 대상). 클릭 안정성(D·F)과 기존 렌더 회귀 차단(G)이 must-pass 기준이다. 바이너리 read reject는 Rust IPC mock 또는 실제 reject로 재현한다.

## 사전 준비

- **전체 노출 픽스처(파일 트리)**: `README.md`, `index.html`, `app.ts`, `.gitignore`(dotfile), `main.rs`(미매핑 텍스트), `data.csv`(미매핑 텍스트), `notes`(확장자 없음), `logo.png`(바이너리), `archive.zip`(바이너리), 그리고 디렉터리 1개.
- **분류 픽스처(openFile)**: 텍스트 파일(read 성공), 바이너리 파일(`readFile` reject), 임계값 초과 파일(`FileNode.size`가 임계값보다 큼), `.html` 파일.
- **store/IPC mock**: `useFileStore.currentFile`/`previewStatus`, `useEditorStore.content`/`setContent`, `readFile`(성공/ reject 양쪽), `FileNode.size` 주입.
- **대용량 임계값**: plan 결정 2 제안값(5MB)을 테스트 상수로 사용. 경계값(임계값-1, 임계값, 임계값+1)으로 가드 검증.

---

## 기능 시나리오

### 시나리오 A: 파일 탐색기 전체 파일 노출 (REQ-PREVIEW007-001, 002) — must-pass

- **Given** `README.md`·`.gitignore`·`main.rs`·`logo.png`·`notes`(확장자 없음)·디렉터리를 포함한 파일 트리가 주어지고
- **When** `FileExplorer`를 렌더하면(검색어 없음)
- **Then** dotfile(`.gitignore`)·미매핑 텍스트(`main.rs`)·바이너리(`logo.png`)·확장자 없는 파일(`notes`)을 포함한 **모든 파일과 디렉터리**가 트리에 표시되고
- **And** `filterViewableFiles`/`filterMdOnly`에 의한 확장자 필터링이 적용되지 않는다.

### 시나리오 B: 검색 필터는 기존대로 동작 (REQ-PREVIEW007-002) — must-pass

- **Given** 전체 파일 트리가 표시된 상태에서
- **When** 검색어 `"main"`을 입력하면
- **Then** `filterTree`가 동작해 `main.rs`와 그 조상 디렉터리만 표시되고
- **And** allowlist 필터는 재도입되지 않는다(검색 결과에 확장자 제한 없음).

### 시나리오 C: 인식 안 되는 텍스트 파일 평문 표시 + 편집 (REQ-PREVIEW007-003)

- **Given** 미매핑 텍스트 파일 `main.rs`(또는 `.gitignore`/확장자 없는 `notes`)가 선택되고 `readFile`이 텍스트 내용을 성공 반환하고
- **When** `openFile`이 실행되어 분류가 text로 set되면
- **Then** 프리뷰가 `CodeFileViewer`를 `lang='text'`로 렌더해 평문으로 표시하고
- **And** 편집기에 파일 내용이 로드되어(`setContent` 호출) 편집 가능 상태가 된다(editor-disable 플레이스홀더 미표시).

### 시나리오 D: 바이너리/읽기 불가 파일 graceful 처리 (REQ-PREVIEW007-004, 006) — must-pass

- **Given** 바이너리 파일 `logo.png`가 선택되고 `readFile`이 비-UTF-8 사유로 **reject**되고
- **When** `openFile`이 실행되면
- **Then** reject가 try/catch로 흡수되어 분류가 binary로 set되고(예외 전파 없음)
- **And** 프리뷰가 `UnsupportedFileViewer`를 사유 `'binary'`·파일명 `logo.png`로 렌더하고
- **And** 편집기에 내용이 로드되지 않으며(`setContent('')` 또는 미호출) editor-disable 플레이스홀더가 표시되고
- **And** 콘솔 에러나 처리되지 않은 예외가 발생하지 않는다.

### 시나리오 E: 대용량 파일 미리보기 건너뜀 (REQ-PREVIEW007-005)

- **Given** 텍스트 파일이지만 `FileNode.size`가 대용량 임계값을 초과하고
- **When** `openFile`이 실행되면
- **Then** `FileNode.size` 가드가 먼저 동작해 `readFile`이 **호출되지 않고**(read 회피)
- **And** 분류가 too-large로 set되어 `UnsupportedFileViewer`가 사유 `'too-large'`·파일명으로 "파일이 커서 미리보기를 건너뜁니다" 안내를 표시한다.

### 시나리오 F: 바이너리 외 읽기 실패도 안전 처리 (REQ-PREVIEW007-006)

- **Given** 파일 선택 시 `readFile`이 권한/삭제/I-O 사유로 reject되고
- **When** `openFile`이 실행되면
- **Then** 앱이 중단되지 않고 "미리보기 불가" 플레이스홀더 또는 안전한 안내 상태로 처리된다(예외 전파 없음).

### 시나리오 G: 기존 렌더 동작 회귀 차단 (REQ-PREVIEW007-007) — must-pass

- **Given** `README.md`(마크다운)·`index.html`(HTML)·`app.ts`(코드 매핑) 파일이 각각 선택되고
- **When** 각 파일에 대해 `openFile`·`PreviewContainer` 라우팅이 동작하면
- **Then** `README.md`는 `MarkdownPreview`(SPEC-PREVIEW-001/002/003 무변경)로 렌더되고
- **And** `index.html`은 `HtmlFileViewer`(SPEC-PREVIEW-004)로 렌더되며 편집기에 editor-disable 플레이스홀더가 유지되고
- **And** `app.ts`는 `CodeFileViewer`(SPEC-PREVIEW-005, Shiki 강조)로 렌더되고
- **And** 어떤 경우에도 `.md` 외 파일이 마크다운 폴백으로 잘못 렌더되지 않는다.

---

## 엣지 케이스

- **빈 파일(0바이트)**: text로 분류되어 빈 평문 영역이 표시되고 오류로 처리되지 않는다.
- **확장자 없는 텍스트 파일(`notes`)**: 코드 매핑 미해당이지만 read 성공 → text 평문 표시 + 편집 가능.
- **대문자 확장자(`LOGO.PNG`)**: 소문자 비교로 `.png`과 동일 취급되며, read reject 시 binary 분류된다.
- **임계값 경계값**: size = 임계값-1 → text 처리, size = 임계값+1 → too-large 처리(정확히 임계값일 때의 동작은 plan에서 `>` 또는 `>=`로 명시).
- **text → binary → markdown 빠른 연속 클릭**: 매 전환마다 `previewStatus`가 올바르게 갱신되고 직전 분류가 누설되지 않는다(편집기 로드/미로드가 매번 정확).
- **`.html` 대용량 파일**: `.html` 분기가 size 가드보다 우선인지(plan 결정 1의 분기 순서) run에서 확정 — 본 SPEC은 `.html`을 기존 iframe 경로로 유지하는 것을 기본으로 한다.

---

## 품질 게이트 / Definition of Done

- [ ] 기능 시나리오 A·B 통과 (**must-pass — 전체 노출 + 검색 필터 유지**)
- [ ] 기능 시나리오 D·F 통과 (**must-pass — 클릭 안정성, 예외/콘솔 에러 없음**)
- [ ] 기능 시나리오 G 통과 (**must-pass — `.md`/`.html`/code 렌더 회귀 차단**)
- [ ] 기능 시나리오 C·E 통과
- [ ] 엣지 케이스 6건 확인
- [ ] 프런트엔드 타입체크 및 vitest 테스트 통과 (development_mode = tdd, RED 우선)
- [ ] 신규 npm 의존성 0 확인 (`package.json` 변경 없음)
- [ ] (Rust 변경 시) `cargo clippy` + `cargo test` 통과; 무변경 시 해당 없음
- [ ] SPEC-PREVIEW-001/002/003·004·005 회귀 없음
- [ ] `filterViewableFiles`/`filterMdOnly` 및 미사용 import·테스트 정리 완료
- [ ] MX 태그 갱신 완료 (plan.md MX 태그 계획)
