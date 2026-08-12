# Implementation Plan: SPEC-IMG-LOAD-001

> **v1.1.0 (2026-08-12)**: Group C(스트리밍 + Worker + 임계값 재정의)는 후속 `SPEC-IMG-LOAD-002`로 이월. 본 plan은 Group A + Group B에 한정한다. 이월 근거는 spec.md Follow-up 섹션 참조.

## Technical Approach

**2-그룹 위상 순서**: Group A(호출부 모드 인지) → Group B(안전망). 각 그룹은 독자적으로 머지 가능하도록 설계된다. Group A는 사용자에게 가장 가시적인 Save-As 순서 버그를, Group B는 빈 화면·UI 동결 증상을 완화한다.

**최소 변경 원칙**: 기존 IPC·상태 필드·함수 시그니처를 유지한다. `insertImageFromDialog(view, mdFilePath)` 시그니처는 그대로 두고 `mdFilePath`에 빈 문자열을 허용한다. `getFileViewType` 시그니처도 유지한다.

**신규 의존성**: 없음. 본 SPEC은 Rust 표준 라이브러리(`std::fs`, `std::io`)와 기존 Tauri IPC 메커니즘만 사용한다. `SPEC-IMG-LOAD-002`에서 `tauri::ipc::Channel<T>`·Web Worker가 도입될 예정.

## Reproduction-First Test Strategy (TDD RED)

**[HARD] run-phase 첫 단계는 사용자 보고 증상을 재현하는 실패 테스트 작성.** CLAUDE.md Section 7 Rule 4 (Reproduction-First Bug Fixing) 준수.

### Group A 재생산

1. **UT-A1 신규** (`src/test/useImageInsert.spec.ts` 생성 또는 기존 테스트 파일 확장): `AppLayout.handleFormat('image')` + `imageInsertMode='inline-blob'` + `currentFilePath=null` → `saveFileAsIpc` 미호출, `insertImageFromDialog(view, '')` 호출 단언 → **현재 코드에서는 실패** (무조건 `saveFileAsIpc` 먼저 호출).
2. **UT-A4 신규**: 동일한 분기 로직이 `MarkdownEditor.handleModShiftI`에도 적용됨을 단언 → **현재는 두 진입점 모두 Save-As를 먼저 호출하므로 동일하게 실패**.

### Group B 재생산

3. **UT-B1 신규** (`src/test/previewContainer.test.ts`에 추가): `getFileViewType('doc.md', 'too-large') === 'unsupported'` 단언 → **현재 코드에서는 `'markdown'` 반환으로 실패** (라우팅 순서 버그).
4. **UT-B5 신규 (D1 회귀 가드)**: `getFileViewType('image.png', 'too-large') === 'raster-image'` (또는 현행 반환값), `getFileViewType('page.html', 'too-large') === 'html'` 등 비-`.md` 확장자의 too-large 라우팅이 현행과 동일함을 단언. 종전 D1 결함 패치가 `too-large`를 모든 확장자 앞으로 올렸다면 이 테스트로 즉시 검거.
5. **CT-B2 신규** (`src-tauri/src/commands/file_ops.rs` 테스트 모듈에 추가): POSIX 환경에서 `write_file` 도중 의도적 크래시(시그널 또는 early return) 후 원본 파일이 손상되지 않음을 단언 → **현재 `std::fs::write` 단일 호출이므로 실패**. Windows 변형은 자동화 CI 범위 밖 — 수동 스모크 only.
6. **UT-B3 신규** (`src/test/fileWatcher.test.ts`에 추가 또는 신규): 워쳐 reload가 `openFile`을 호출함을 단언 → **현재는 `readFile` 직접 호출이므로 실패**.
7. **UT-B4 신규**: `findFileNodeSize === undefined` 케이스에서 `readFileSize` IPC가 호출됨을 단언. 펼쳐진 폴더(nodeSize !== undefined)에서는 `readFileSize`가 호출되지 않음을 추가 단언 (N6 fast path 회귀 가드).

**RED 완료 기준**: 위 7개 신규 테스트가 모두 실패 상태로 존재. 기존 테스트는 수정하지 않는다 — N5 조사 결과 충돌하는 기존 테스트가 없으므로 (spec.md Quality Notes 참조).

## Milestones

> 시간 추정은 사용하지 않는다 ([HARD] coding-standards.md). 우선순위 라벨과 위상 순서로만 표시.

### Milestone 1: Group A RED + GREEN (이미지 삽입 호출부)

**Priority: High**

- UT-A1~A4 신규 추가 (RED 확인)
- `AppLayout.tsx:308-326` `case 'image'` 수정: `imageInsertMode` 리딩 + `inline-blob` 분기에서 Save-As 스킵
- `MarkdownEditor.tsx:167-189` `Mod-Shift-i` 수정: 동일한 분기 적용
- UT-A1~A4 통과 (GREEN)
- Playwright PT-A1 추가: `inline-blob` + 미저장 문서에서 툴바 이미지 버튼 클릭 시 Save-As 다이얼로그가 열리지 않고 이미지 피커가 직접 열림을 단언
- `@MX:SPEC` 주석 갱신: `AppLayout.tsx`, `MarkdownEditor.tsx`에 `SPEC-IMG-LOAD-001` 추가

**N5 — SPEC-IMG-MODE-002 테스트 충돌 점검 체크리스트** (run phase 시작 시 먼저 실행):

- [ ] `src/test/imageHandler.test.ts:261-319` (UT-7/8/11) 확인 — `insertImageFromDialog(view, '/path/to/file.md')`를 미리 채운 path로 호출하므로 **충돌 없음, 삭제 불필요**. 이 테스트들은 imageHandler 내부 분기를 검증할 뿐 호출부 Save-As 게이트와 무관.
- [ ] `src/test/imagePasteGuard.test.tsx:181-204` ("inline-blob 모드는 파일 경로를 요구하지 않는다" 블록) 확인 — 클립보드 붙여넣기 경로이며 `mockSaveFileAs` 미호출을 이미 단언 중. **충돌 없음, 삭제 불필요** — REQ-A-001과 정합.
- [ ] `src/test/imagePasteGuard.test.tsx:206-235` ("file-save 모드는 기존 동작을 유지한다" 블록) 확인 — file-save + 미저장에서 `mockSaveFileAs` 호출을 단언. **충돌 없음, 삭제 불필요** — REQ-A-002와 정합 (클립보드 경로 한정).
- [ ] 결론: 테스트 삭제 0건. UT-A1~A4는 순수 신규 커버리지. `SPEC-IMG-MODE-002` Non-Goal #6 폐기는 문서 수준(spec.md `supersedes` 필드)에서만 발생하며 행동 반전을 단언하던 기존 테스트는 없었다 ([feedback-spec-reversal-pattern] — "충돌 테스트가 있는 경우 삭제+교체" 전제가 충족되지 않으므로 삭제 불필요).

**Files**:
- `src/components/layout/AppLayout.tsx`
- `src/components/editor/MarkdownEditor.tsx`
- `src/test/useImageInsert.spec.ts` (신규) 또는 기존 테스트 파일
- `tests/` e2e 디렉토리에 Playwright 시나리오 추가

### Milestone 2: Group B RED + GREEN (안전망 — 자기 완결적)

**Priority: High**

- UT-B1, UT-B5, CT-B2, UT-B3, UT-B4 신규 추가 (RED 확인)
- `PreviewContainer.tsx:42-72` `getFileViewType` 수정: `too-large` 분기를 `.md`/`.markdown` 확장자 분기와 동일 임계점으로 이동 (D1 fix — 비-`.md` 확장자 분기 순서는 무변경, `SPEC-PREVIEW-008` 회귀 방지)
- `file_ops.rs:49-59` `write_file` 수정: 원자적 쓰기 패턴. `#[cfg(unix)]` / `#[cfg(windows)]` 분기
- `file_ops.rs`에 `read_file_size(path: String) -> Result<u64, String>` 신규 커맨드 추가 (Group B 범위 — 종전 Group C에서 이관, D3)
- `src/lib/tauri/ipc.ts`에 `readFileSize(path: string): Promise<number>` 래퍼 추가
- `App.tsx:52,57` 수정: 워쳐 reload를 `openFile` 경유로 변경. `useFileSystem`이 `reloadCurrentFile(path)` 헬퍼를 노출하는 대안 허용 (OD-5)
- `useFileSystem.ts:198-206` 수정: `nodeSize === undefined` 케이스에 대한 보호 — `readFileSize` IPC로 사전 조회 후 `FILE_SIZE_THRESHOLD` 적용. **N6 fast path**: `nodeSize !== undefined` 케이스(펼쳐진 폴더)는 IPC 없이 기존 size 사용
- UT-B1, UT-B5, CT-B2, UT-B3, UT-B4 통과 (GREEN)
- Playwright PT-B4 추가: 접힌 폴더 내 10MB `.md` 파일 오픈 시 UI 동결 없이 `UnsupportedFileViewer`가 나타남을 단언
- 기존 `SPEC-PREVIEW-007`/`SPEC-PREVIEW-008` 테스트 회귀 없음 확인 (UT-B5가 이 회귀 가드를 자동화)
- 회귀 검증 + @MX 태그 정리:
  - `npx vitest run` 전체 통과
  - `cargo test` 전체 통과 (Rust atomic write CT-B2)
  - `npx tsc --noEmit` 0 에러
  - `npx eslint` 수정 파일 0 경고
  - `npx playwright test` PT-A1, PT-B4 통과
  - `SPEC-IMG-MODE-002`, `SPEC-PREVIEW-007`, `SPEC-PREVIEW-008`, `SPEC-FS-001/003` 회귀 테스트 green 유지
- 수동 스모크 (Windows 원자 쓰기 — OD-1에서 이관, 자동화 CI는 범위 밖):
  - [ ] `inline-blob` + 미저장 문서에서 툴바 이미지 버튼 → Save-As 없이 이미지 피커 직접 오픈
  - [ ] `inline-blob` + 미저장 문서에서 `Cmd+Shift+I` → 동일
  - [ ] `file-save` + 미저장 문서 → 기존 Save-As 동작 유지
  - [ ] 6MB `.md` 파일 오픈 → `UnsupportedFileViewer` 정상 렌더링 (빈 화면 회귀 없음)
  - [ ] 접힌 폴더 내 10MB `.md` 오픈 → UI 동결 없음
  - [ ] 워쳐 reload 시 크기 가드 적용
  - [ ] **Windows**: `write_file` 원자 쓰기 — 강제 종료 시나리오에서 원본 무결성 확인 (POSIX는 CT-B2로 자동 검증, Windows는 본 항목 only)

**Files**:
- `src/components/preview/PreviewContainer.tsx`
- `src-tauri/src/commands/file_ops.rs` (`write_file` 수정 + `read_file_size` 신규)
- `src/lib/tauri/ipc.ts` (`readFileSize` 래퍼 추가)
- `src/App.tsx`
- `src/hooks/useFileSystem.ts`
- 단위/통합 테스트 파일들

## Architecture Design Direction

```
[호출부: 이미지 삽입]
  ↓
imageInsertMode = useUIStore.getState().imageInsertMode
filePath = useEditorStore.getState().currentFilePath
  ↓
  ├─ filePath !== null → insertImageFromDialog(view, filePath)  [기존, REQ-A-003]
  ├─ filePath === null && mode === 'inline-blob' → insertImageFromDialog(view, '')  [신규, REQ-A-001, Save-As 스킵]
  └─ filePath === null && mode === 'file-save' → saveFileAs → insertImageFromDialog(view, savedPath)  [기존 유지, REQ-A-002]
```

```
[원자 쓰기 — POSIX 기본 패턴, 대안 허용]
  ↓
write_file(path, content)
  ↓
임시 파일 path.mdedit-tmp-<pid> 생성
  ↓
content 작성 + fsync (디스크까지 flush)
  ↓
rename(tmp, path)  [POSIX 원자 / Windows ReplaceFile 동등 — 수동 스모크]
  ↓
완료 (임시 파일은 사라지고 대상이 완전히 교체됨)
```

```
[접힌 폴더 보호 + readFileSize fast path — REQ-B-004 + N6]
  ↓
useFileSystem.openFile(path)
  ↓
nodeSize = findFileNodeSize(fileTree, path)
  ↓
  ├─ nodeSize !== undefined (펼쳐진 폴더) → 기존 size 사용, IPC 없음 [N6 fast path]
  └─ nodeSize === undefined (접힌 폴더) → readFileSize(path) IPC 호출 [D3 — Group B 신규 IPC]
  ↓
size > FILE_SIZE_THRESHOLD(5MB) → previewStatus='too-large', UnsupportedFileViewer
size <= FILE_SIZE_THRESHOLD → 기존 readFile 단일 호출 (회귀 없음)
```

## Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| `getFileViewType` 재배치가 `.md` 외 확장자까지 영향을 미쳐 `SPEC-PREVIEW-008` 래스터/SVG 라우팅이 깨짐 | High | D1 fix로 `too-large` 재배치를 `.md`/`.markdown`에 한정. UT-B5가 비-`.md` 확장자 too-large 라우팅 불변을 자동 단언 (회귀 가드). |
| Windows `rename`이 대상 존재 시 실패 → 원자 쓰기 깨짐 | High | `#[cfg(windows)]`에서 `ReplaceFile` Win32 API 사용. 자동화 CI는 범위 밖이므로 수동 스모크로 검증 (OD-1에서 이관). Windows VM 확보 전에는 POSIX 경로만 머지하고 Windows는 TODO로 남길 수 없음 — 본 SPEC은 Windows 구현을 누락 없이 포함하되 검증은 수동 스모크로 한정. |
| `SPEC-IMG-MODE-002` Non-Goal #6 폐기가 기존 사용자 문서에 미치는 영향 | Low | N5 조사 결과 충돌 테스트 0건. `inline-blob` 모드에서 Save-As를 건너뛰어도 `insertImageFromDialog`가 data URI로 임베드하므로 파일 저장 시점에 사용자가 명시적으로 Save를 수행하면 됨. 기존 저장 파일은 영향 없음. |
| `findFileNodeSize` 보호(REQ-B-004)가 모든 경로에 사전 조회를 추가 → 소형 파일 오픈 지연 | Low | N6 fast path — `readFileSize` IPC는 `findFileNodeSize === undefined` 케이스(접힌 폴더)에만 호출. 펼쳐진 폴더의 기존 size를 그대로 사용하므로 회귀 없음. `readFileSize` IPC 비용은 단일 `stat` 호출로 마이크로초 단위. |
| `SPEC-IMG-LOAD-002` 후속 SPEC이 지연되어 대용량 파일(50MB+) 시나리오가 여전히 미해결 | Medium | 본 SPEC v1.1.0의 `FILE_SIZE_THRESHOLD=5MB`는 5~50MB 파일은 `UnsupportedFileViewer`로 라우팅하므로 UI 동결 자체는 없음. 사용자 경험은 "빈 화면"에서 "명확한 안내"로 개선. 50MB+ 파일의 점진적 로딩은 후속 SPEC 명시적 범위. |
| 원자 쓰기 중 디스크 가득 참 | Low | 임시 파일 작성 실패 → 원본 유지, 에러 반환. CT-B2 확장 케이스로 단언 가능. |

## Open Decisions (run phase 개시 전 사용자 합의 필요)

### OD-2: 기존 `FILE_SIZE_THRESHOLD` 호환성

**질문**: `SPEC-PREVIEW-007`이 도입한 `FILE_SIZE_THRESHOLD`(5MB)를 본 SPEC에서 어떻게 다루는가?

**옵션**:
- (권장) **변경 없음** — `FILE_SIZE_THRESHOLD=5MB`를 그대로 유지하고 본 SPEC은 상수 값을 수정하지 않는다. 후속 `SPEC-IMG-LOAD-002`가 `SOFT_THRESHOLD`/`HARD_CEILING`을 도입할 때 별도 합의.

**이유**: 본 SPEC v1.1.0은 임계값 숫자를 건드리지 않는다. 종전 v1.0.0의 `SOFT_THRESHOLD` 도입 계획은 Group C와 함께 후속 SPEC으로 이월되었으므로, OD-2의 사실상 결론은 "no-op"이다. 호환성 이슈도 없고 별도 alias도 불필요.

### OD-5: `useFileSystem` reload 헬퍼 추가 여부

**질문**: REQ-B-003(와쳐 reload 가드)을 위해 `useFileSystem`이 `reloadCurrentFile(path)` 헬퍼를 노출할 것인가, 아니면 기존 `openFile`을 재사용할 것인가?

**옵션**:
- (권장) 기존 `openFile`을 재사용. 신규 API 부담 없음. 단, `openFile`이 store 갱신·상태 전환을 수반하므로 부작용 검증 필요
- `reloadCurrentFile(path)` 신규 헬퍼 노출. 의미가 명확, 단위 테스트 용이. 단, 코드 중복 위험
- `openFile`에 `mode: 'reload'` 옵션 추가. 타협안

**이유**: `openFile`은 이미 크기 가드·store 갱신을 통합 처리하므로 재사용이 자연스럽다. 단, `openFile`이 `setCurrentFile` 등의 부작용을 수반하므로 워쳐 reload 맥락에서 동일하게 작동함을 단위 테스트로 단언해야 한다 (UT-B3).

> **삭제된 OD**: OD-1(임계값·플랫폼), OD-3(Channel vs chunked), OD-4(Worker spawn 시점)는 Group C와 함께 후속 `SPEC-IMG-LOAD-002`로 이월되어 본 plan에서 제거되었다. Windows 수동 스모크 검증은 OD-1에서 분리되어 Milestone 2의 체크리스트로 이동.

## Dependencies

- 신규 라이브러리 의존성: 없음
- Rust crate 추가: 없음 (`std::fs`, `std::io`만 사용)
- 기존 IPC 재사용: `readFile`, `writeFile`, `saveFileAs`, `insertImageFromDialog`, `openImageDialog` (Group A)
- 기존 IPC 확장: `writeFile` (원자화, Group B), 신규 `readFileSize` (Group B — D3에 의해 Group C에서 이관)
- 기존 상태 재사용: `useUIStore.imageInsertMode`, `useEditorStore.currentFilePath`, `useFileStore.previewStatus`

## Traceability

| Milestone | Requirements | Tests |
|---|---|---|
| M1 (Group A) | REQ-A-001~004 | UT-A1~A4 (RED→GREEN), PT-A1 (Playwright must-pass), N5 충돌 점검 체크리스트 |
| M2 (Group B + 회귀) | REQ-B-001~004 + (D1 회귀 가드) | UT-B1, UT-B5 (D1 회귀), CT-B2 (POSIX atomic write), UT-B3, UT-B4 + PT-B4 (Playwright must-pass) + Windows 수동 스모크 |
