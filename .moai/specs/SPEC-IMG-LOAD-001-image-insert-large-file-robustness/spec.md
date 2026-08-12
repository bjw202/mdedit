---
id: SPEC-IMG-LOAD-001
title: 이미지 삽입 호출부 모드 인지 + 대용량 마크다운 파일 안전망
version: 1.1.0
status: Planned
created: 2026-08-12
updated: 2026-08-12
author: jw (bjw202)
priority: High
issue_number: null
dependencies: [SPEC-IMG-001, SPEC-IMG-MODE-001, SPEC-IMG-MODE-002, SPEC-FS-001, SPEC-FS-003, SPEC-PREVIEW-007, SPEC-PREVIEW-008]
tags: [image, large-file, atomic-write, routing, bugfix, frontend, rust, tauri]
lifecycle: spec-anchored
supersedes:
  - "SPEC-IMG-MODE-002 Non-Goal #6 (다이얼로그 호출부 AppLayout/MarkdownEditor 무변경 입장)"
related:
  - "SPEC-PREVIEW-007 REQ-PREVIEW007-005 (FILE_SIZE_THRESHOLD=5MB — 본 SPEC은 변경하지 않음; 후속 SPEC-IMG-LOAD-002가 soft/hard 임계값으로 재정의 예정)"
  - "SPEC-FS-001 (read_file/write_file 도입 — 본 SPEC이 write_file 원자화 + read_file_size 신규 추가)"
  - "SPEC-IMG-MODE-002 REQ-IMG-MODE-2-001 (insertImageFromDialog 모드 인지 — 본 SPEC이 호출부 게이트를 모드 인지로 확장)"
follow_ups:
  - "SPEC-IMG-LOAD-002 (planned) — Group C deferred: Rust streaming read + markdown-it Web Worker + SOFT/HARD threshold redefinition + CodeMirror viewport/line-folding for giant base64 lines. ID 선택 근거: 후속 작업은 CodeMirror 뷰포트 렌더링(에디터 관심사)·Worker(렌더러 관심사)·스트리밍(FS 관심사)·임계값 정책(프리뷰 관심사)을 모두 아우르지만, 촉발 시나리오(image-bloat 대용량 파일)가 본 SPEC과 동일하므로 시리즈 추적성을 위해 IMG-LOAD-002로 둔다. SPEC-FS-LARGE-001 대안은 뷰포트 렌더링이 FS 작업이 아니라는 점에서 오해를 유발하므로 기각."
---

# SPEC-IMG-LOAD-001: 이미지 삽입 호출부 모드 인지 + 대용량 마크다운 파일 안전망

## HISTORY

- **2026-08-12 v1.0.0**: 최초 작성. 두 사용자 보고 증상을 단일 SPEC으로 통합.
  - **Issue 1 (Group A)**: `inline-blob` 모드(기본값)에서 문서를 저장하지 않은 상태로 툴바 이미지 버튼이나 `Cmd+Shift+I`를 누르면, 이미지 피커가 열리기 전에 **Save-As 다이얼로그**가 먼저 열린다. `SPEC-IMG-MODE-002`가 `insertImageFromDialog`를 모드 인지로 전환하면서 `mdFilePath`가 `inline-blob` 분기에서 더 이상 필요하지 않게 되었으나, 호출부(`AppLayout.tsx:308-326`, `MarkdownEditor.tsx:167-189`)의 Save-As 게이트는 여전히 무조건 동작한다. `SPEC-IMG-MODE-002` Non-Goal #6로 명시적으로 호출부 무변경을 선택했던 영역을 본 SPEC이 의도적으로 폐기한다.
  - **Issue 2 (Group B)**: 다수 이미지를 붙여넣은 마크다운 파일(base64 data URI로 인한 ~33% 크기 팽창)이 재오픈에 실패한다. 1차 실패 — `FILE_SIZE_THRESHOLD=5MB`(`previewLimits.ts:10`) 초과 파일은 `useFileSystem.ts:198-206`가 content를 `''`로 세팅하고 `readFile`을 호출하지 않는다. 합산 결함 — `PreviewContainer.getFileViewType`(`PreviewContainer.tsx:51-56`)이 `.md` 확장자 분기를 `previewStatus === 'too-large'` 분기(`:67`)보다 먼저 평가하여, 5MB 초과 `.md` 파일이 빈 에디터 + 빈 프리뷰로 열린다(에러 배너 없음). 2차 실패 — `findFileNodeSize`가 접힌 폴더 내 파일(`directory_ops.rs:56-66`의 lazy `read_directory_shallow`)에 대해 `undefined`를 반환하여 5MB 가드가 우회되면, 파일 전체가 로드되어 CodeMirror 단일 dispatch(`MarkdownEditor.tsx:103-113`) + `markdown-it` 이중 파싱(`renderer.ts:207-250`, `:428`)이 메인 스레드를 동결시킨다. 와쳐 우회 — `App.tsx:52,57`이 크기 가드를 거치지 않고 직접 `readFile`을 호출한다. 비원자 쓰기 — `write_file`(`file_ops.rs:49-59`)이 임시 파일 없이 `std::fs::write`만 사용하여 크래시/전원 손실 시 파일이 잘리거나 손상될 수 있다.
- **2026-08-12 v1.1.0**: 독립 감사 결과 4건의 BLOCKING 결함(D1~D4) 반영 + 범위 축소.
  - **범위 축소**: Group C(스트리밍 읽기 + Web Worker + SOFT/HARD 임계값 재정의)를 `SPEC-IMG-LOAD-002`(계획)로 이월. 근거(N1): base64 data URI로 인해 생성되는 거대한 단일 라인을 CodeMirror가 라인 단위로 토크나이즈하는 비용은 스트리밍/Worker만으로 해결되지 않으며, 뷰포트 렌더링·라인 폴딩이 별도 설계 과제로 확인됨. Group A+B는 사용자 가시 증상(Save-As 순서 버그, 빈 화면, UI 동결)을 낮은 리스크로 완화한다.
  - **D1 수정**: `getFileViewType` 라우팅 재배치 범위를 `.md`/`.markdown`으로 한정. 종전 의사코드는 `too-large` 분기를 모든 확장자 분기 앞으로 올려 `.html`/`.json`/래스터/SVG까지 `unsupported`로 재라우팅할 위험이 있었고 Non-Goal #8(`SPEC-PREVIEW-008` 래스터/SVG 보호)을 위반할 수 있었음. 회귀 가드 AC-B5 추가.
  - **D2 수정**: REQ-IMG-LOAD-B-002를 행동만 서술하도록 재작성. 종전에는 `temp→fsync→rename` 메커니즘을 REQ 본문에 처방하여 본 SPEC의 "REQ 본문 = 행동만" 원칙을 위반했음. 메커니즘은 Design Notes로 이동하고 `renameat2(RENAME_EXCHANGE)`·reflink 등 대안을 명시. Windows는 `ReplaceFile` 동등 패턴으로 최선 노력, 자동화 CI는 범위 밖으로 명시.
  - **D3 수정**: Group C 제거로 `read_file_size` IPC의 소속이 Group B로 확정. Delta Map 갱신. Group B는 자기 완결적(self-contained)임을 명시.
  - **D4 해소**: UTF-8 스트리밍 무한 루프 결함은 Group C 제거로 본 SPEC에서 사라짐. 단, 후속 SPEC-IMG-LOAD-002가 malformed/truncated UTF-8 처리 + 종료 테스트(REQ-C-006 권고)를 반드시 명시하도록 Follow-up 섹션에 경고.

## Context & Goal

두 증상은 `inline-blob` 모드(기본값)에서 이미지를 다수 임베드하는 사용자 워크플로우에서 서로 촉발한다. Issue 1은 삽입 순간의 UX 결함이고, Issue 2는 임베드 결과로 생긴 대용량 파일을 다시 열 때의 강건성 결함이다. 본 SPEC은 두 결함을 동시에 다룬다.

### Issue 1: 삽입 다이얼로그 순서 결함

두 진입점 모두 동일한 결함 패턴을 가진다:

| 진입점 | 코드 위치 | 현재 동작 |
|---|---|---|
| 툴바 이미지 버튼 | `AppLayout.tsx:308-326` (`case 'image'`) | `currentFilePath === null`이면 무조건 `saveFileAsIpc` → `insertImageFromDialog` |
| 키보드 단축키 | `MarkdownEditor.tsx:167-189` (`Cmd+Shift+I`) | 동일하게 `saveFileAs` → `insertImageFromDialog` |

`insertImageFromDialog`(`imageHandler.ts:217-244`)는 `SPEC-IMG-MODE-002` 이후 모드 인지이며, `inline-blob` 분기(`:230-238`)에서는 `mdFilePath`를 사용하지 않는다(`:215` 명시적 주석). 따라서 기본 모드에서 Save-As 게이트는 순수 오버헤드이다. 오직 `file-save` 모드(`copyImageToFolder`가 `mdFilePath` 필요)만 게이트를 실제로 필요로 한다.

### Issue 2: 대용량 파일 로딩 강건성 결함

| 결함 | 코드 위치 | 증상 |
|---|---|---|
| 5MB 하드 블록 | `previewLimits.ts:10`, `useFileSystem.ts:198-206` | 5MB 초과 `.md` 파일의 content가 `''`로 세팅되어 `readFile` 미호출 |
| 라우팅 순서 오류 | `PreviewContainer.tsx:51-56` | `.md` 분기가 `too-large` 분기(`:67`)보다 선행 → 빈 에디터 + 빈 프리뷰(에러 배너 없음) |
| 가드 우회(폴더 접힘) | `useFileSystem.ts:198`, `directory_ops.rs:56-66` | `findFileNodeSize`가 접힌 폴더 내 파일에 `undefined` 반환 → 5MB 가드 스킵 → 전체 로드 → UI 동결 |
| 와쳐 우회 | `App.tsx:52,57` | 와쳐 reload가 `readFile` 직접 호출 → 크기 가드 미적용 |
| 비원자 쓰기 | `file_ops.rs:49-59` | `std::fs::write` 단일 호출 → 크래시 시 잘린/손상 파일 잔존 |
| 단일 dispatch + 이중 파싱 | `MarkdownEditor.tsx:103-113`, `renderer.ts:207-250, :428` | 한 번에 전체 content를 CodeMirror에 밀어넣고 메인 스레드에서 `markdown-it` 파싱을 두 번 수행 |

**목표**: (A) 호출부를 모드 인지로 만들어 `inline-blob`에서 불필요한 Save-As를 제거하고, (B) 즉시 적용 가능한 안전망(`.md`/`.markdown` 라우팅 순서, 원자 쓰기, 와쳐 가드, 접힌 폴더 보호)을 추가한다.

> **v1.1.0 범위 참고**: Group C(스트리밍 읽기 + Web Worker + SOFT/HARD 임계값 재정의 + CodeMirror 뷰포트 렌더링)는 본 SPEC의 범위에서 제외되어 `SPEC-IMG-LOAD-002`(계획)로 이월되었다. 근거는 Follow-up 섹션과 HISTORY v1.1.0 항목 참조.

## Decision: SPEC-ID 및 통합 근거

**결정: 단일 SPEC `SPEC-IMG-LOAD-001`로 작성한다.**

고려 대안: Issue 1을 `SPEC-IMG-DIALOG-001`(이미지 다이얼로그 전용), Issue 2를 `SPEC-FS-004-large-file-robustness`(FS 시리즈 확장)로 분할.

통합 선택 근거:

1. **동인 결합**: 두 증상 모두 `inline-blob` 모드(기본값)에서 이미지를 다수 임베드하는 사용자 워크플로우에서 발생한다. Issue 1은 그 워크플로우의 시작(삽입) 결함이고, Issue 2는 종착지(재오픈) 결함이다. 동일 사용자가 동일 세션에서 두 증상을 연속으로 겪는다.
2. **사용자 명시적 요청**: 사용자가 단일 SPEC을 요청했으며 `SPEC-IMG-LOAD-001` ID를 제안했다.
3. **Group B 안전망은 Issue 2의 선결 조건**: Group B는 사용자에게 가장 가시적인 증상(빈 화면, UI 동결)을 완화한다. plan.md 마일스톤에서 Group A → Group B 순으로 위상 배치하여 단계적 가치를 보장한다.
4. **시리즈 일관성**: `IMG-LOAD`는 기존 `IMG`/`IMG-MODE`/`IMG-WIDGET` 서브시리즈와 충돌하지 않는 새 서브시리즈이다. `FS` 시리즈를 침해하지 않으면서 로딩 강건성이라는 횡단 관심사를 명시한다.

**v1.1.0 범위 조정 (2026-08-12)**: 독립 감사 결과 base64 data URI로 인한 거대 단일 라인을 CodeMirror가 라인 단위로 토크나이즈하는 비용(N1)이 스트리밍 + Worker만으로는 해결되지 않음이 확인되어, Group C를 `SPEC-IMG-LOAD-002`(계획)로 이월한다. 본 SPEC은 Group A(다이얼로그 순서 버그) + Group B(안전망)에 한정한다.

## Environment

- Tauri 2 데스크톱 앱, React 18 + TypeScript 프런트엔드, Rust 1.92 백엔드
- CodeMirror 6 에디터 (`view.dispatch({changes:...})` API)
- `markdown-it` 동기 파서 (`src/lib/markdown/renderer.ts`)
- Zustand 상태 관리 (`useUIStore`, `useEditorStore`, `useFileStore`)
- 기존 IPC 래퍼 (`src/lib/tauri/ipc.ts`): `readFile`, `writeFile`, `saveFileAs`, `readImageAsBase64`, `copyImageToFolder`, `openImageDialog`

## Assumptions

- `inline-blob` 모드 사용자는 `.md` 파일 크기 증가를 감수한다 (`SPEC-IMG-MODE-001` 가정과 동일).
- `read_image_as_base64` IPC는 크기 검증 없이 모든 파일을 읽는다 (`image_ops.rs:128-157` 확인). 본 SPEC은 이 동작을 변경하지 않는다 — 사용자가 다이얼로그/드롭으로 명시적으로 선택한 파일은 임베드 대상이다.
- `std::fs::rename`은 POSIX에서 원자적이지만 Windows에서는 대상 파일이 존재하면 실패한다. 크로스 플랫폼 원자 쓰기는 Windows에서 `ReplaceFile` Win32 API 또는 `rename` + 사전 삭제 패턴이 필요하다 (`std::fs::rename` 문서 참조). 단, 자동화된 Windows CI 검증은 본 SPEC 범위 밖이며 수동 스모크에 한한다.

## Delta Map (브라운필드 변경 범위)

| 파일 | 상태 | 변경 내용 |
|---|---|---|
| `src/components/layout/AppLayout.tsx:308-326` (`case 'image'`) | [MODIFY] | `useUIStore.getState().imageInsertMode` 리딩. `inline-blob` → Save-As 스킵, `insertImageFromDialog(view, '')` 직접 호출. `file-save` → 기존 Save-As 게이트 유지 |
| `src/components/editor/MarkdownEditor.tsx:167-189` (`Mod-Shift-i`) | [MODIFY] | 동일한 모드 인지 분기 적용 |
| `src/components/preview/PreviewContainer.tsx:42-72` (`getFileViewType`) | [MODIFY] | `previewStatus === 'too-large'` 분기를 `.md`/`.markdown` 확장자 분기와 동일 임계점에서 평가. **D1**: 다른 확장자(`.html`/`.json`/래스터/SVG)의 기존 분기 순서는 무변경 — `too-large` 재배치는 `.md`/`.markdown`에만 적용 |
| `src/hooks/useFileSystem.ts:198-206` (5MB 가드) | [MODIFY] | `nodeSize === undefined` 케이스(접힌 폴더) 보호 — `readFile` 시도 전 `readFileSize` IPC로 사전 크기 조회 (N6 fast path: 펼쳐진 폴더는 기존 size 그대로 사용) |
| `src/App.tsx:52,57` (와쳐 reload) | [MODIFY] | `readFile` 직접 호출을 `openFile` 위임(또는 동일 크기 가드 경유)으로 변경 |
| `src-tauri/src/commands/file_ops.rs:49-59` (`write_file`) | [MODIFY] | 원자적 쓰기 패턴 적용(임시 파일 → `fsync` → `rename` 또는 동등 대안). `#[cfg(unix)]` / `#[cfg(windows)]` 분기. Windows는 `ReplaceFile` 동등 패턴 (수동 스모크 한정) |
| `src-tauri/src/commands/file_ops.rs` (`read_file_size`) | [NEW] | **Group B 신규 IPC** (종전 Group C에서 이관 — D3). `read_file_size(path: String) -> Result<u64, String>` 커맨드. 메타데이터 조회 전용 |
| `src/lib/tauri/ipc.ts` | [MODIFY] | `readFileSize(path)` 래퍼 추가 (Group B). 기존 `readFile`/`writeFile` 시그니처는 유지 |
| `src/lib/preview/previewLimits.ts` | [EXISTING] | **변경 없음** — `FILE_SIZE_THRESHOLD=5MB` 그대로 유지. 후속 SPEC-IMG-LOAD-002가 `SOFT_THRESHOLD`/`HARD_CEILING`/`STREAM_CHUNK_SIZE`/`WORKER_DEBOUNCE_MS` 도입 예정 |
| `src/components/preview/UnsupportedFileViewer.tsx` | [EXISTING] | 변경 없음 — `too-large` 분기가 기존 컴포넌트를 사용 |
| `src/lib/image/imageHandler.ts` (`insertImageFromDialog`) | [EXISTING] | 변경 없음 — `SPEC-IMG-MODE-002`에서 이미 모드 인지. 본 SPEC은 호출부만 수정 |
| `src/lib/markdown/renderer.ts` | [EXISTING] | 변경 없음 — Worker 이관은 후속 SPEC-IMG-LOAD-002 |
| `src/components/editor/MarkdownEditor.tsx:103-113` (content dispatch) | [EXISTING] | 변경 없음 — chunk append dispatch는 후속 SPEC-IMG-LOAD-002 |
| `src-tauri/src/commands/image_ops.rs` | [EXISTING] | 변경 없음 — `MAX_IMAGE_SIZE=10MB`는 file-save 경로에만 적용, inline-blob은 사용자 책임 (Non-Goal #1) |

## Requirements

> REQ 본문은 행동만 서술한다. 구현 메커니즘(함수명·IPC·Rust 명령)은 Design Notes를 참조. EARS 키워드는 영문, 행동 묘사는 한국어.
> 각 REQ는 falsifiable한 단일 테스트와 매핑된다 (Traceability 참조). "무변경" 속성은 REQ 본문에서 제외하고 acceptance.md Test Strategy Layer에서 "코드 리뷰(diff)" 행으로 분리한다 ([feedback-spec-verifiable-requirements] 패턴 2).

### Group A — 이미지 삽입 다이얼로그 순서 (최소 변경)

#### REQ-IMG-LOAD-A-001 (Event-Driven): inline-blob + 미저장 문서 — Save-As 스킵

**WHEN** `imageInsertMode`가 `'inline-blob'` **AND** `currentFilePath`가 `null`(미저장 문서)인 상태에서 사용자가 이미지 삽입 진입점(툴바 버튼 또는 `Cmd+Shift+I`)을 호출한 경우, **THEN** 시스템은 Save-As 다이얼로그를 표시하지 않고 곧바로 이미지 피커 다이얼로그를 열어야 한다. **AND** 시스템은 `saveFileAs`/`saveFileAsIpc` IPC를 호출하지 않는다.

#### REQ-IMG-LOAD-A-002 (Event-Driven): file-save + 미저장 문서 — 기존 Save-As 게이트 유지

**WHEN** `imageInsertMode`가 `'file-save'` **AND** `currentFilePath`가 `null`인 상태에서 사용자가 이미지 삽입 진입점을 호출한 경우, **THEN** 시스템은 기존 동작(Save-As 다이얼로그 → 저장 성공 시 `insertImageFromDialog`)을 유지한다. `file-save` 모드는 `copyImageToFolder`를 위해 `mdFilePath`가 필요하다.

#### REQ-IMG-LOAD-A-003 (State-Driven): 이미 저장된 문서 — 모드 무관 기존 동작

**WHILE** `currentFilePath`가 `null`이 아닌(이미 저장된) 상태에서 사용자가 이미지 삽입 진입점을 호출한 경우, 시스템은 두 모드 모두에서 기존 동작(Save-As 없이 `insertImageFromDialog(view, filePath)`)을 유지한다.

#### REQ-IMG-LOAD-A-004 (Ubiquitous): 두 진입점 대칭

시스템은 툴바 버튼 진입점(`AppLayout.tsx`)과 키보드 단축키 진입점(`MarkdownEditor.tsx`)에 동일한 모드 인지 게이트를 적용한다. 두 진입점의 분기 로직은 동일한 `imageInsertMode` 리딩과 동일한 Save-As 스킵/유지 조건을 가져야 한다.

### Group B — 안전망

#### REQ-IMG-LOAD-B-001 (State-Driven): 대용량 `.md`/`.markdown` 라우팅 우선순위

**WHILE** `previewStatus === 'too-large'`이고 현재 파일 확장자가 `.md` 또는 `.markdown`인 경우, 시스템은 `UnsupportedFileViewer`를 렌더링해야 한다. **AND** `getFileViewType`은 `.md`/`.markdown` 확장자에 한해 `too-large` 상태를 먼저 평가한다. **AND** 다른 확장자(`.html`, `.json`, 래스터 이미지, SVG, 코드 파일 등)의 라우팅 분기 순서는 현재 구현을 유지한다 (`SPEC-PREVIEW-008` 래스터/SVG 보호 준수).

#### REQ-IMG-LOAD-B-002 (Ubiquitous + Unwanted): 원자적 파일 쓰기

시스템은 `write_file` IPC 호출을 원자적으로 수행한다. **IF** 쓰기 도중 프로세스 크래시 또는 전원 손실이 임의 시점에 발생한 경우, **THEN** 대상 경로에는 (a) 기존 콘텐츠 전체, 또는 (b) 새 콘텐츠 전체 중 하나만 존재하며 — 부분적으로 기록된(truncated) 파일은 허용되지 않는다.

> **검증 범위**: **POSIX** — cargo 테스트로 자동 검증 (CT-B2). **Windows** — `ReplaceFile` 동등 패턴으로 최선의 원자화를 제공하되, 자동화된 Windows CI는 본 SPEC 범위 밖; 수동 스모크로 확인. 구현 패턴(임시 파일 → fsync → rename 등)은 Design Notes 참조.

#### REQ-IMG-LOAD-B-003 (Event-Driven): 파일 워쳐 reload 크기 가드

**WHEN** 파일 워쳐가 현재 열린 파일의 수정 이벤트를 수신한 경우, **THEN** 시스템은 `openFile` 경로(또는 동일한 크기 가드 로직)를 경유하여 reload를 수행한다. **AND** 시스템은 크기 가드를 우회하여 `readFile`을 직접 호출하지 않는다.

#### REQ-IMG-LOAD-B-004 (Unwanted): 접힌 폴더 내 파일 가드 우회 금지

**IF** `findFileNodeSize`가 `undefined`를 반환하는 경우(접힌 폴더 내 파일 등) **AND** 실제 파일 크기가 `FILE_SIZE_THRESHOLD`를 초과하는 경우, **THEN** 시스템은 파일을 전체 로드하지 않고 `previewStatus='too-large'` 라우팅으로 처리한다. **AND** 메인 스레드 동결(단일 dispatch + 이중 파싱)이 발생해서는 안 된다.

## Threshold Constants (명명된 상수 — 구현 drift 방지)

| 상수 | 값 | 위치 | 용도 |
|---|---|---|---|
| `FILE_SIZE_THRESHOLD` | `5 * 1024 * 1024` (5MB) | `src/lib/preview/previewLimits.ts` | **변경 없음** — Group B는 기존 5MB 하드 블록을 그대로 사용. 후속 SPEC-IMG-LOAD-002가 `SOFT_THRESHOLD`/`HARD_CEILING`/`STREAM_CHUNK_SIZE`/`WORKER_DEBOUNCE_MS`를 도입하여 이 값을 재정의 예정 |

> 본 SPEC은 임계값 숫자를 변경하지 않는다. 값의 근거는 기존 `SPEC-PREVIEW-007`에 기록되어 있으며 회귀 없이 유지된다.

## Design Notes (구현 메커니즘 — 참고용)

> 본 섹션은 run-phase 구현자 안내이며 REQ 본문이 아니다. 동일한 행동 결과를 내는 한 대체 구현을 허용한다.

### Group A — 모드 인지 호출부

```typescript
// AppLayout.tsx case 'image' (MarkdownEditor.tsx Mod-Shift-i 동일 패턴)
case 'image': {
  const filePath = useEditorStore.getState().currentFilePath;
  const { imageInsertMode } = useUIStore.getState();
  if (!filePath) {
    if (imageInsertMode === 'inline-blob') {
      // REQ-A-001: Save-As 스킵, 빈 mdFilePath로 직접 호출
      // insertImageFromDialog는 inline-blob 분기에서 mdFilePath를 사용하지 않음
      void insertImageFromDialog(view, '');
      return;
    }
    // file-save 모드는 기존 게이트 유지 (REQ-A-002)
    const docContent = view.state.doc.toString();
    saveFileAsIpc(docContent).then((savedPath) => {
      if (savedPath) {
        // ... 기존 store 갱신 로직 ...
        insertImageFromDialog(view, savedPath);
      }
    });
  } else {
    insertImageFromDialog(view, filePath);
  }
  break;
}
```

`insertImageFromDialog` 시그니처(`view: EditorView, mdFilePath: string`)는 유지한다. `inline-blob` 분기에서 `mdFilePath`가 빈 문자열이어도 `imageHandler.ts:230-238`는 이를 읽지 않으므로 안전하다.

### Group B — 안전망

**라우팅 순서** (`PreviewContainer.getFileViewType`) — D1 fix:

```typescript
export function getFileViewType(path, previewStatus = null) {
  if (!path) return 'markdown';
  const lower = path.toLowerCase();
  // REQ-B-001 + D1: too-large 재배치는 .md/.markdown에만 적용.
  // 래스터/SVG/html/code 확장자 분기는 SPEC-PREVIEW-008 보호를 위해 현행 유지.
  if (previewStatus === 'too-large' && (lower.endsWith('.md') || lower.endsWith('.markdown'))) {
    return 'unsupported';
  }
  if (lower.endsWith('.html')) return 'html';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  // ... 나머지 기존 분기 (raster/SVG/code/binary) — 순서 무변경 ...
}
```

주의: 종전 의사코드는 `if (previewStatus === 'too-large') return 'unsupported';`를 모든 확장자 분기 앞에 두어 `.html`/`.json`/래스터/SVG까지 재라우팅하는 결함이 있었다 (D1). 본 패치는 `too-large` 재배치를 `.md`/`.markdown`으로 한정한다.

**원자 쓰기** (`file_ops.rs`) — D2 fix:

```rust
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let path_buf = validate_path(&path)?;
    // 부모 디렉토리 생성 (기존 로직 유지)
    // ...
    // REQ-B-002: 원자적 쓰기 — 아래 패턴 중 하나 (대안 허용).
    let tmp_path = path_buf.with_extension(format!("mdedit-tmp-{}", std::process::id()));
    {
        let mut file = std::fs::File::create(&tmp_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        use std::io::Write;
        file.write_all(content.as_bytes())
            .map_err(|e| format!("Failed to write temp file: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("Failed to fsync temp file: {}", e))?;
    }
    #[cfg(unix)]
    std::fs::rename(&tmp_path, &path_buf)
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;
    #[cfg(windows)]
    {
        // ReplaceFile Win32 API 또는 사전 삭제 + rename 패턴.
        // 자동화 CI는 범위 밖 — 수동 스모크로 검증 (acceptance.md AC-B2).
    }
    Ok(())
}
```

> **허용되는 대안 구현**: `temp→fsync→rename` 외에도 다음 패턴들은 동일한 원자성 보장을 제공하므로 REQ-B-002를 만족한다:
> - `renameat2(RENAME_EXCHANGE)` (Linux 전용)
> - copy-on-write reflinks (btrfs / APFS)
> - 트랜잭션을 지원하는 파일 시스템 API
>
> 채택한 패턴이 "전체 기존 콘텐츠 또는 전체 새 콘텐츠 중 하나만 남긴다"는 행동 요구를 충족하는 한, 구현체는 run-phase 에이전트의 판단에 맡긴다.

**와쳐 reload 가드** (`App.tsx`):

```typescript
// 기존: void readFile(event.path).then((content) => setContent(content));
// 변경: openFile 경유 (또는 useFileSystem이 노출하는 reloadCurrentFile 헬퍼)
const { openFile } = useFileSystem();
// ...
onFileChanged: (event) => {
  if (event.kind !== 'Modified' || event.path !== currentFilePath) return;
  const { dirty } = useEditorStore.getState();
  if (!dirty) {
    void openFile(event.path); // REQ-B-003: 동일 크기 가드 경유
    return;
  }
  guard.requestWatcherConflict(() => {
    void openFile(event.path);
  });
},
```

주의: `openFile`은 store 갱신을 수행하므로 `setContent(content)` 직접 호출을 대체한다. `useFileSystem`이 `reloadCurrentFile(path)` 헬퍼를 노출하는 대안도 허용한다 (REQ 본문은 행동만 서술).

**접힌 폴더 보호 + readFileSize fast path** (`useFileSystem.ts`) — D3 + N6:

```typescript
// REQ-B-004 + N6 fast path:
const nodeSize = findFileNodeSize(fileTree, path);
let size: number | undefined = nodeSize;
if (size === undefined) {
  // 접힌 폴더 내 파일 — 트리에 size가 없으므로 IPC로 사전 조회.
  // 펼쳐진 폴더(nodeSize !== undefined)는 이 IPC를 건너뛰고 기존 fast path 유지.
  size = await readFileSize(path);
}
if (size !== undefined && size > FILE_SIZE_THRESHOLD) {
  setPreviewStatus('too-large');
  setContent('');
  return;
}
// ... 기존 readFile 흐름 ...
```

`readFileSize` IPC는 `findFileNodeSize === undefined` 케이스(접힌 폴더)에만 호출되므로, 펼쳐진 폴더에서의 기존 fast path를 보존한다 (N6 — 회귀 없음).

## Exclusions (Non-Goals)

본 SPEC은 다음을 다루지 않는다:

1. **`inline-blob` 모드의 per-image 크기 제한 도입** — `read_image_as_base64`가 10MB 제한 없이 모든 파일을 읽는 현재 동작은 유지한다. 대용량 이미지 임베드로 인한 파일 팽창은 사용자 책임 (`SPEC-IMG-MODE-002` Non-Goal #2와 동일 입장). `MAX_IMAGE_SIZE=10MB`는 `file-save` 경로에만 적용한다.
2. **기본 모드를 `file-save`로 전환** — `inline-blob`이 기본값으로 유지된다. 사용자가 명시적으로 `file-save`를 선택하지 않는 한 모드 정책을 변경하지 않는다.
3. **이미 bloat된 기존 파일의 마이그레이션 도구** — base64 data URI를 `./images/` 파일로 추출하는 도구는 별도 후속 SPEC. 본 SPEC은 로딩 강건성만 다룬다.
4. **CodeMirror 6의 lazy 렌더링(뷰포트 기반) 및 라인 폴딩** — 후속 `SPEC-IMG-LOAD-002`로 이월. 거대 base64 라인의 라인 단위 토크나이제이션 비용(N1)은 뷰포트 렌더링 없이 해결 불가.
5. **`markdown-it`의 Web Worker 이관** — 후속 `SPEC-IMG-LOAD-002`로 이월.
6. **Rust 스트리밍 읽기 API (`read_file_stream` / chunked `read_file_chunk`)** — 후속 `SPEC-IMG-LOAD-002`로 이월. 본 SPEC은 `read_file_size`(단일 메타데이터 조회)만 추가한다.
7. **SOFT/HARD 임계값 정책 (50MB/200MB) 도입** — 후속 `SPEC-IMG-LOAD-002`로 이월. 본 SPEC은 `FILE_SIZE_THRESHOLD=5MB`를 그대로 유지한다.
8. **`SPEC-PREVIEW-008` 래스터 이미지/SVG 뷰어의 크기 가드 변경** — `too-large` 라우팅 재배치는 `.md`/`.markdown`에만 적용하며 (D1 fix), 래스터/SVG/html/code 확장자 분기 순서와 뷰어 자체의 내부 크기 처리는 건드리지 않는다.
9. **`read_image_as_base64` IPC의 크기 검증 추가** — 사용자가 명시적으로 선택한 파일은 임베드 대상이므로, 다이얼로그/드롭 경로의 크기 제한은 도입하지 않는다 (사용자 책임 원칙).
10. **이미지 접기 위젯(`SPEC-IMG-WIDGET-001`)** — 본 SPEC과 독립. bloat된 파일 편집 UX 개선은 해당 SPEC에서 다룬다.
11. **Windows 자동화 CI** — 원자 쓰기의 Windows 변형은 수동 스모크에 한한다. Windows VM 자동화는 인프라 과제로 별도 처리.

## Follow-up (Group C Deferred → SPEC-IMG-LOAD-002)

**이월 범위**: 다음 항목들은 본 SPEC v1.0.0의 Group C에 포함되었으나 v1.1.0에서 제거되어 후속 `SPEC-IMG-LOAD-002`(계획)로 이관되었다:

1. Rust 스트리밍 읽기 API (`read_file_stream` via Tauri Channel 또는 chunked `read_file_chunk` 쌍)
2. `markdown-it` Web Worker 이관 + 디바운스 로직
3. SOFT/HARD 임계값 정책 도입 (`SOFT_THRESHOLD=50MB`, `HARD_CEILING=200MB`, `STREAM_CHUNK_SIZE=256KB`, `WORKER_DEBOUNCE_MS=100`)
4. CodeMirror 점진적 append dispatch + 진행률 표시
5. **CodeMirror 뷰포트 렌더링 / 라인 폴딩** (신규 — 감사 N1이 촉발)

**이월 근거 (N1)**: base64 data URI는 마크다운 파일 내에 거대한 단일 라인(수십 MB)을 생성한다. CodeMirror 6은 라인 단위로 토크나이즈하므로, 스트리밍 읽기·Worker 파싱·점진적 dispatch를 도입하더라도 뷰포트 밖 라인의 토크나이제이션 비용이 그대로 남아 메인 스레드 동결을 유발한다. 따라서 Group C의 안전한 완료는 CodeMirror 자체의 뷰포트 렌더링 또는 긴 라인에 대한 폴딩 전략과 병행되어야 하며, 이는 별도의 아키텍처 설계 과제이다.

**후속 SPEC-IMG-LOAD-002가 반드시 다뤄야 할 경고 항목 (D4 잔여)**:

- **Malformed / truncated UTF-8 처리**: 종전 Group C 의사코드의 `utf8_boundary_len` 유틸리티가 잘린 시퀀스를 만났을 때 무한 루프에 빠지지 않음을 단언하는 cargo 테스트가 필요하다 (감사 REQ-C-006 권고). 본 SPEC v1.0.0에서는 이 결함이 스트리밍 의사코드에 잠재해 있었다. v1.1.0에서 Group C를 제거하며 본 결함도 사라졌지만, 후속 SPEC이 동일 패턴을 채택할 경우 반드시 종료 조건 테스트와 함께 명시해야 한다.
- **Tauri Channel 백프레셔**: chunk 큐 과적 시 ack 흐름 도입 여부.
- **Worker spawn 시점**: lazy vs 세션 시작 시 spawn.

본 SPEC은 `SPEC-IMG-LOAD-002`의 존재와 근거만 명시하며, 상세 REQ는 해당 SPEC 작성 시점에 정의한다.

## Traceability

| Requirement | Test ID | Layer | Acceptance |
|---|---|---|---|
| REQ-IMG-LOAD-A-001 | UT-A1 + PT-A1 | Unit (mode branch) + Playwright (dialog UX) | AC-A1 |
| REQ-IMG-LOAD-A-002 | UT-A2 | Unit (mode branch) | AC-A2 |
| REQ-IMG-LOAD-A-003 | UT-A3 | Unit (existing path preserved) | AC-A3 |
| REQ-IMG-LOAD-A-004 | UT-A4 | Unit (두 진입점 동일 분기 단언) | AC-A4 |
| REQ-IMG-LOAD-B-001 | UT-B1 | Unit (`getFileViewType` pure function) | AC-B1 |
| REQ-IMG-LOAD-B-002 | CT-B2 | cargo test (POSIX atomic write + crash recovery) | AC-B2 |
| REQ-IMG-LOAD-B-003 | UT-B3 | Unit (watcher routes through openFile) | AC-B3 |
| REQ-IMG-LOAD-B-004 | UT-B4 + PT-B4 | Unit (size pre-fetch via readFileSize) + Playwright (no freeze) | AC-B4 |
| (D1 회귀 가드) | UT-B5 | Unit (`getFileViewType` 확장자별 라우팅 무변경) | AC-B5 |

> PT = Playwright must-pass. 포인터/다이얼로그 UX와 UI 동결 검증은 jsdom 단위 테스트에 잡히지 않으므로 Playwright를 must-pass로 둔다 ([feedback-jsdom-pointer-blindspot]).

## Quality Notes

- REQ 본문은 행동만 서술한다. Design Notes의 함수명·IPC·Rust 명령은 참고용이며 run-phase 에이전트가 동일 결과를 내는 한 대체 구현을 허용한다 ([feedback-spec-verifiable-requirements]).
- "호출부 모드 분기 대칭"(REQ-A-004)은 단위 테스트로 강제 불가한 git diff 속성이 아니다 — 두 진입점의 분기 로직을 각각 단위 테스트로 단언하여 행동 수준에서 대칭을 검증한다. 단, "두 분기가 동일한 helper 함수를 호출하는가"는 코드 리뷰 범위 (acceptance.md Test Strategy Layer).
- 본 SPEC은 `SPEC-IMG-MODE-002` Non-Goal #6(호출부 무변경)을 의도적으로 폐기한다. `SPEC-IMG-MODE-002` REQ 본문은 변경하지 않고 본 SPEC frontmatter `supersedes`로만 명시한다 ([feedback-spec-reversal-pattern]).
- **N5 (테스트 충돌 조사 결과)**: `SPEC-IMG-MODE-002` 인수 테스트를 실제 조사한 결과, 본 SPEC과 충돌하는 기존 테스트는 없다. (a) `imageHandler.test.ts:261-319` UT-7/8/11은 `insertImageFromDialog(view, '/path/to/file.md')`를 미리 채운 mdFilePath로 직접 호출하므로 호출부 Save-As 게이트를 우회한다 — 본 SPEC의 REQ-A-001/002와 무관. (b) `imagePasteGuard.test.tsx`는 클립보드 붙여넣기 경로를 다루며 이미 `inline-blob` + 미저장에서 `mockSaveFileAs` 미호출을 단언하고 있어 REQ-A-001과 정합이다. 따라서 run phase에서 테스트 삭제는 필요 없으며, UT-A1~A4는 종전 미커버 영역(호출부)에 대한 순수 신규 커버리지가 된다.
- Group B는 자기 완결적(self-contained)이다 — 모든 Group B REQ(라우팅, 원자 쓰기, 와쳐, 접힌 폴더 보호, `read_file_size` IPC)을 단일 마일스톤으로 머지할 수 있다. 종전 "Group B는 Group C와 무관하게 적용 가능하다"는 문구는 Group C 이월로 인해 자명해졌다.
