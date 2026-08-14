---
id: SPEC-IMG-MODE-003
title: "이미지 삽입 per-image 크기 기반 라우팅 — 대용량 이미지 자동 file-save 전환"
version: 1.0.0
status: Planned
created: 2026-08-14
updated: 2026-08-14
author: jw (bjw202)
priority: High
issue_number: null
dependencies: [SPEC-IMG-MODE-001, SPEC-IMG-MODE-002, SPEC-IMG-LOAD-001]
lifecycle: spec-first
supersedes:
  - "SPEC-IMG-MODE-002 Non-Goal #2 (대용량 이미지 임베드 제한·자동 file-save 전환은 별도 이슈)"
  - "SPEC-IMG-LOAD-001 Non-Goal #1 (inline-blob 모드의 per-image 크기 제한 도입)"
  - "SPEC-IMG-LOAD-001 Non-Goal #9 (read_image_as_base64 IPC 크기 검증 추가)"
tags: [image, routing, threshold, performance, frontend, tauri]
related:
  - SPEC-IMG-WIDGET-001 (이미지 접기 위젯 — 본 SPEC과 독립)
  - SPEC-IMG-LOAD-002 (대용량 파일 라인 폴딩 — 본 SPEC과 상호 보완)
---

# SPEC-IMG-MODE-003: 이미지 삽입 per-image 크기 기반 라우팅 — 대용량 이미지 자동 file-save 전환

## HISTORY

- **2026-08-14 v1.0.0**: 최초 작성. `SPEC-IMG-MODE-002` Non-Goal #2("대용량 이미지(예: 50MB PNG)에 대한 임베드 제한·경고·자동 file-save 전환 등은 별도 이슈") 및 `SPEC-IMG-LOAD-001` Non-Goal #1("inline-blob 모드의 per-image 크기 제한 도입")·Non-Goal #9("read_image_as_base64 IPC 크기 검증 추가")를 명시적으로 폐기(supercede). 근본 원인 루트: 거대 base64 단일 라인이 CodeMirror Lezer(편집기) 및 markdown-it 이중 파싱(프리뷰)을 동결시키는 현상을, Web Worker 파싱 이관(과거 계획 방향) 대신 **삽입 시점에 per-image 크기로 라우팅**하여 `.md` 파일이 가벼운 상태로 유지되도록 원천 차단. 사용자 모드 선호(소형 이미지는 inline-blob 이식성)와 자동 안전망(대형 이미지는 file-save)을 양립시킨다.

## Context & Goal

MdEdit는 두 가지 이미지 삽입 모드(`SPEC-IMG-MODE-001`)를 제공한다:

- **inline-blob 모드 (기본값)**: 이미지를 base64 data URI로 `.md`에 직접 임베드. 외부 파일 의존성 없이 어디서나 렌더링되는 이식성 보장. 그러나 대형 이미지(수 MB)는 거대 단일 라인을 생성하여 편집기·프리뷰 양쪽을 동결시킨다.
- **file-save 모드**: 이미지를 `./images/` 폴더에 저장하고 상대경로 링크를 삽입. `.md` 파일은 가볍게 유지되나 외부 파일 의존성이 발생.

`SPEC-IMG-MODE-002` 이후 세 진입점(클립보드 붙여넣기·드래그-앤-드롭·이미지 다이얼로그)이 모두 `imageInsertMode`를 존중한다. 그러나 대형 이미지를 inline-blob 모드로 임베드하면 다음 동결 연쇄가 발생한다:

1. **삽입 순간**: 거대 base64 문자열(예: 5MB 이미지 → ~6.7MB base64)이 IPC를 통해 반환되어 `.md` 내 단일 라인으로 보간된다 (`imageHandler.ts:165`).
2. **편집기 동결**: CodeMirror 6 Lezer 파서가 라인 단위로 토크나이즈하므로, 거대 라인 하나가 메인 스레드를 점유한다.
3. **프리뷰 동결**: markdown-it이 두 번의 파싱 패스(`src/lib/markdown/renderer.ts:208-209` 코드 보호 범위 탐지 + `:428` 본 렌더)에서 거대 라인을 각각 순회한다.
4. **재오픈 동결**: 임베드된 `.md`를 다시 열 때 동일 동결이 재발한다 (`SPEC-IMG-LOAD-001/002`가 라인 폴딩·뷰포트 위젯으로 완화하나 원인 제거가 아님).

**근본 원인 루트**: `.md` 파일에 거대 라인이 존재하지 않으면 동결 자체가 발생하지 않는다. 본 SPEC은 Web Worker 파싱 이관(과거 계획 방향, 별 SPEC으로 착수했으나 착수 전 단계에서 폐기) 대신, **삽입 시점에 per-image 크기 임계값으로 대형 이미지를 file-save로 자동 라우팅**하여 `.md`를 가볍게 유지한다. 소형 이미지는 사용자 모드(inline-blob 이식성)를 그대로 존중한다.

### 루트 인과 분석 (Five Whys)

- **증상**: 대형 이미지 삽입 후 편집기·프리뷰가 수 초~수십 초간 동결.
- **Why 1**: 거대 base64 단일 라인이 Lezer·markdown-it 양쪽에서 라인 단위 토크나이제이션 비용을 발생시킨다.
- **Why 2**: inline-blob 모드가 이미지 크기와 무관하게 항상 base64로 임베드한다.
- **Why 3**: `read_image_as_base64` IPC가 10MB 크기 검증 없이 모든 파일을 읽는다 (`SPEC-IMG-LOAD-001` Non-Goal #9로 명시적 보류).
- **Why 4 (근본 원인)**: per-image 크기 기반 라우팅 게이트가 존재하지 않는다. 사용자 모드는 전역 선호도(소형 이미지용 이식성)이지, 대형 이미지에 대한 안전 장치가 아니다.

**목표**: 세 삽입 진입점에 단일 크기 임계값 chokepoint를 도입하여, 사용자 모드와 무관하게 대형 이미지를 file-save로 라우팅한다. 소형 이미지는 기존 모드 동작을 그대로 보존한다. 0.15.0 Group A(`SPEC-IMG-LOAD-001` REQ-A-001 — inline-blob + 미저장 문서에서 Save-As 스킵)의 소형 이미지 동작을 회귀 없이 유지한다.

## Decision: 신규 SPEC vs 기존 SPEC 개정

**결정: 신규 SPEC(`SPEC-IMG-MODE-003`)로 작성하고 기존 `SPEC-IMG-MODE-001`/`SPEC-IMG-MODE-002`/`SPEC-IMG-LOAD-001`은 변경하지 않는다.**

근거 ([feedback-spec-reversal-pattern] 준수):

1. `SPEC-IMG-MODE-001`(Completed)·`SPEC-IMG-MODE-002`(Implemented)는 이미 구현·배포됨. 완료된 SPEC의 REQ 본문을 직접 수정하면 설계 의도 변경 이력이 소실된다.
2. 본 SPEC은 `SPEC-IMG-MODE-002` Non-Goal #2(대형 이미지 자동 file-save 전환은 "별도 이슈"로 명시적 보류) 및 `SPEC-IMG-LOAD-001` Non-Goal #1·#9(inline-blob per-image 크기 제한·IPC 크기 검증은 "사용자 책임 원칙"으로 명시적 보류)를 **의도적 설계 결정의 공식적 폐기**로 다룬다. 이는 행동 반전(behavioral reversal)이며 별도 문서로 남겨야 추적성이 확보된다.
3. 기존 단위 테스트 UT-7/8/11(`src/test/imageHandler.test.ts:276-318` — 다이얼로그 모드 분기 단언)은 `readFileSize` 모킹 추가 및 임계값 분기 단언 확장이 필요하다. 기존 단언 자체가 삭제되지는 않으나(소형 이미지 경로 보존), 임계값 분기 신규 단언이 추가되므로 테스트 스위트 구조가 변경된다.
4. 프로젝트 관례(`SPEC-AI-008/010/011`, `SPEC-IMG-LOAD-001`의 `SPEC-IMG-MODE-002` Non-Goal 폐기 사례)는 행동 변경에 신규 SPEC ID를 부여하고 `supersedes` 필드로만 관계를 명시한다.

**주의**: 본 SPEC은 `SPEC-PREVIEW-013`(markdown-it Web Worker 이관 — 과거 계획 방향)을 de facto 대체한다. 그러나 `SPEC-PREVIEW-013`은 어떤 브랜치에서도 커밋된 적이 없는 미착수 계획이므로, 공식 `supersedes` 대상이 아니다. 본 SPEC의 Exclusions(Non-Goals)에 "abandoned Worker route"로 명시한다.

## Environment

- Tauri 2 데스크톱 앱, React 18 + TypeScript 프런트엔드
- CodeMirror 6 에디터(Lezer 파서, 라인 단위 토크나이제이션)
- markdown-it 프리뷰 렌더러(`src/lib/markdown/renderer.ts:208-209, :428` — 이중 파싱 패스)
- Zustand 상태 관리(`src/store/uiStore.ts:40, :116` — `imageInsertMode` 전역 필드, `:106` persist)
- 기존 IPC 래퍼(`src/lib/tauri/ipc.ts`):
  - `readFileSize(path): Promise<number>` (`:34-35` → `read_file_size`, Rust `file_ops.rs:115`, `lib.rs:51` 등록) — 현재 유일 consumer는 `useFileSystem.ts:215`(접힌 폴더 크기 조회). 본 SPEC이 두 번째 consumer가 된다.
  - `copyImageToFolder(sourcePath, mdFilePath)` → `./images/{filename}` 복사, 상대경로 반환
  - `readImageAsBase64(imagePath)` → `data:{mime};base64,{data}` (크기 검증 없음 — `SPEC-IMG-LOAD-001` Non-Goal #9)
  - `saveImageFromClipboard(mdFilePath, base64)` → `./images/{ts}.png` 저장, 상대경로 반환
  - `openImageDialog()` → 선택 경로 또는 `null`
- 기존 임계값 상수(`src/lib/preview/previewLimits.ts`):
  - `LINE_FOLD_THRESHOLD = 1MB` (`:23`) — 단일 라인 길이 임계값(하위 이웃)
  - `SOFT_THRESHOLD = 30MB` (`:11`), `HARD_CEILING = 100MB` (`:17`) — 대용량 파일 3계층
- 기존 Rust 상수: `MAX_IMAGE_SIZE = 10MB` (`image_ops.rs:12`) — file-save 경로 전용 상한(상위 이웃)
- 기존 0.15.0 Group A 게이트(`SPEC-IMG-LOAD-001` REQ-A-001/002/003/004):
  - `AppLayout.tsx:316-318` (`case 'image'`): inline-blob + 미저장 → Save-As 스킵, `insertImageFromDialog(view, '')`
  - `MarkdownEditor.tsx:174-177` (`Mod-Shift-i`): 동일 분기(REQ-A-004 대칭)
  - `MarkdownEditor.tsx:277-290` (drop 핸들러): 미저장 시 모드와 무관하게 항상 Save-As 게이트

## Assumptions

- **per-image 크기는 세 진입점 모두에서 커밋 전에 알 수 있다**:
  - 붙여넣기 `insertImageFile`(`imageHandler.ts:155-173`): DOM `File` 객체 → `file.size` 동기 조회 가능.
  - 드롭 `handleImageDrop`(`imageHandler.ts:185-242`): DOM `File` → `file.size` 동기 조회 가능. 네이티브 `path` 변형도 동일 `File` 객체의 `size` 사용.
  - 다이얼로그 `insertImageFromDialog`(`imageHandler.ts:253-280`): 네이티브 경로만 → `await readFileSize(selectedPath)` (기존 IPC, `useFileSystem.ts:215`에서 이미 사용 중).
- **임계값은 `MAX_IMAGE_SIZE`(10MB)보다 엄격하게 작아야 한다**. 그렇지 않으면 대형 이미지가 file-save로 라우팅된 뒤 `copy_image_to_folder`의 10MB 검증(`image_ops.rs:89-95`)에서 거부되는 사각지대(dead zone)가 발생한다.
- **per-image 임계값이 올바른 게이트**이다: 거대 단일 라인 하나가 Lezer·markdown-it 양쪽을 동결시킨다. 다수의 소형 라인은 라인 기반 파서(markdown-it)에 저렴하다. 따라서 누적 크기가 아닌 per-image 게이트가 원인-결과에 정합하다.
- `imageInsertMode`는 전역(zustand persist, `uiStore.ts:40,116,106`)이며 per-document가 아니다. 이는 본 SPEC과 양립한다 — 모드 = 사용자 선호도(소형 이미지), 임계값 = 자동 안전망(대형 이미지). store 변경 불필요.
- `readFileSize` IPC는 `SPEC-IMG-LOAD-001` Group B에서 이미 구현되어 다이얼로그 경로에서 추가 Rust 변경 없이 재사용 가능하다.
- file-save 경로는 Tauri FS capability 변경 없이 임의의 마크다운 파일 옆 `./images/`에 쓸 수 있다. 앱은 `tauri-plugin-fs`가 아닌 자체 Tauri 명령(raw `std::fs::*`)을 사용하며, `validate_path`(`..` 거부)만으로 게이트된다.
- 미저장 문서에서 file-save 라우팅 시 `md_file_path`가 필수이다 — `ensure_images_dir`(`image_ops.rs:33-40`)이 `.parent()`를 호출하며, 빈 경로는 `validate_path`에서 "path cannot be empty"(`file_ops.rs:23-24`)로 거부된다.

## Delta Map (브라운필드 변경 범위)

| 파일 | 상태 | 변경 내용 |
|---|---|---|
| `src/lib/preview/previewLimits.ts` | [MODIFY] | `IMAGE_INLINE_THRESHOLD` 상수 추가 (OD-1 값, 기본 2MB). `LINE_FOLD_THRESHOLD`(1MB)와 `MAX_IMAGE_SIZE`(10MB, Rust) 사이 브래킷 |
| `src/lib/image/imageHandler.ts:155-173` (`insertImageFile` 붙여넣기) | [MODIFY] | per-image 크기 조회(`file.size`) 후 임계량 초과 시 file-save 라우팅. 미저장 + 대형 → 지연 Save-As (REQ-U-001) |
| `src/lib/image/imageHandler.ts:185-242` (`handleImageDrop` 드롭) | [MODIFY] | 루프 내 per-image 크기 조회 후 임계량 초과 시 file-save 라우팅. 미저장 게이트는 이미 `MarkdownEditor.tsx:277-290`에서 Save-As 수행하므로 핸들러 내 지연 게이트 불필요 |
| `src/lib/image/imageHandler.ts:253-280` (`insertImageFromDialog` 다이얼로그) | [MODIFY] | `readFileSize(selectedPath)` 조회 후 임계량 초과 시 file-save 라우팅. 미저장 + 대형 → 지연 Save-As (REQ-U-001) |
| `src/lib/image/imageHandler.ts` (신규 helper) | [NEW] | `resolveImageRoute(fileOrPath, mode): Promise<'inline'|'file'>` chokepoint. 3개 핸들러가 공유. Design Notes 참조 |
| `src/test/imageHandler.test.ts:276-318` (UT-7/8/11 다이얼로그 블록) | [MODIFY] | `vi.mock('@/lib/tauri/ipc')`에 `readFileSize` 모킹 추가. 기존 소형 이미지 단언은 회귀 가드로 유지(REQ-U-002). 임계량 분기 신규 단언 추가 |
| `src/test/imageHandler.test.ts` | [NEW] | 임계량 경계 테스트(threshold ±1 byte × 3 경로), 지연 Save-As 테스트(REQ-U-001), 소형+미저장 비-Save-As 테스트(REQ-U-002) |
| `src/lib/image/imageHandler.ts:3` (`@MX:SPEC`) | [MODIFY] | SPEC 태그에 `SPEC-IMG-MODE-003` 추가 |
| `src/store/uiStore.ts:40,116` | [EXISTING] | 변경 없음 — `imageInsertMode` 전역 유지 |
| `src-tauri/src/commands/image_ops.rs` (`MAX_IMAGE_SIZE`, `copy_image_to_folder`, `read_image_as_base64`) | [EXISTING] | 변경 없음 — Rust 크기 정책·IPC는 그대로 |
| `src-tauri/src/commands/file_ops.rs` (`read_file_size`, `validate_path`) | [EXISTING] | 변경 없음 |
| `src/components/layout/AppLayout.tsx:316-318` (Group A 게이트) | [EXISTING] | 변경 없음 — 지연 Save-As는 핸들러 내부에서 수행, 게이트 자체는 소형 이미지에 무변경 (REQ-U-002) |
| `src/components/editor/MarkdownEditor.tsx:174-177` (Group A 게이트) | [EXISTING] | 변경 없음 — 동일 |
| `src/components/editor/MarkdownEditor.tsx:277-290` (drop Save-As 게이트) | [EXISTING] | 변경 없음 — drop은 이미 미저장 시 Save-As 게이트하므로 핸들러 내 지연 게이트 불필요 |
| `src/components/settings/ImageModeToggle.tsx` | [EXISTING] | 변경 없음 — 토글 유지 |
| `src/lib/markdown/renderer.ts` (markdown-it 이중 파싱) | [EXISTING] | 변경 없음 — `.md`가 가벼우면 파싱 비용 저렴 |

## Requirements

> REQ 본문은 행동만 서술한다. 구현 메커니즘(함수명·IPC 호출·상수 배치)은 Design Notes를 참조. EARS 키워드는 영문을 유지하고 행동 묘사는 한국어로 작성한다.

### Group R (Routing — per-image 크기 기반 라우팅)

#### REQ-IMG-MODE-3-R-001 (Complex): per-image 크기 기반 라우팅

**WHILE** 사용자의 `imageInsertMode`가 어떤 값이든 (`'inline-blob'` 또는 `'file-save'`), **WHEN** 이미지 삽입 진입점(클립보드 붙여넣기·드래그-앤-드롭·이미지 다이얼로그)을 통해 이미지가 삽입될 때, **IF** 해당 이미지의 바이트 크기가 `IMAGE_INLINE_THRESHOLD` 이상이면, **THEN** 시스템은 `imageInsertMode` 값과 무관하게 해당 이미지를 file-save 경로(`./images/` 폴더 저장 + 상대경로 링크)로 라우팅한다. **AND IF** 해당 이미지의 크기가 `IMAGE_INLINE_THRESHOLD` 미만이면, **THEN** 시스템은 기존 `imageInsertMode` 분기(`SPEC-IMG-MODE-002` 정의)를 그대로 적용한다.

#### REQ-IMG-MODE-3-R-002 (Ubiquitous): 3개 진입점 대칭 적용

시스템은 세 개의 이미지 삽입 진입점(클립보드 붙여넣기·드래그-앤-드롭·이미지 다이얼로그)에 동일한 per-image 라우팅 결정을 적용한다. 어느 진입점으로 들어와도 동일한 임계값 비교와 동일한 file-save/inline 분기가 수행되어야 한다 (`SPEC-IMG-LOAD-001` REQ-IMG-LOAD-A-004 대칭 원칙과 동일).

#### REQ-IMG-MODE-3-R-003 (State-Driven): per-path 크기 획득 방식

**WHILE** 이미지 크기를 조회할 때, **IF** DOM `File` 객체가可用하면(붙여넣기·드롭 경로) 시스템은 동기적으로 `file.size` 속성을 읽는다. **IF** DOM `File`이 없고 네이티브 경로만 있으면(다이얼로그 경로, 드롭의 네이티브 path 변형), 시스템은 `readFileSize` IPC를 통해 크기를 조회한다. 어느 방식이든 크기 조회 실패 시 시스템은 안전 쪽(사용자 모드 존중)으로 폴백하며 삽입을 중단하지 않는다.

### Group T (Threshold — 임계값 상수)

#### REQ-IMG-MODE-3-T-001 (Ubiquitous): `IMAGE_INLINE_THRESHOLD` 상수 정의

시스템은 `IMAGE_INLINE_THRESHOLD`라는 명명된 상수를 정의한다. 이 상수는:
- `src/lib/preview/previewLimits.ts`에 기존 임계값 상수들과 함께 위치한다.
- 값은 Open Decision OD-1에서 사용자가 합의한다 (권장값 2MB, 허용 범위 [1MB, 3MB]).
- `MAX_IMAGE_SIZE`(10MB, `image_ops.rs:12`)보다 **엄격하게 작아야 한다** (`<`). 이 제약은 위반 시 REQ-IMG-MODE-3-N-002(10MB 초과 file-save 거부)와의 사각지대를 방지한다.
- `LINE_FOLD_THRESHOLD`(1MB, `previewLimits.ts:23`) 이상이어야 한다 (임계값 이하로 라우팅된 소형 inline-blob 이미지가 라인 폴딩을 트리거하지 않도록).

### Group U (Unsaved conflict — 미저장 문서 충돌 해결)

#### REQ-IMG-MODE-3-U-001 (Event-Driven): 대형 이미지 + 미저장 문서 → 지연 Save-As

**WHEN** `IMAGE_INLINE_THRESHOLD` 이상의 대형 이미지가 inline-blob 모드에서 삽입되려 하고 **AND** `currentFilePath`가 `null`(미저장 문서)인 경우, **THEN** 시스템은 핸들러 내부에서 Save-As 다이얼로그를 트리거하여 `mdFilePath`를 확보한 뒤 file-save 경로로 라우팅한다. **AND** 시스템은 `mdFilePath` 없이 file-save 경로를 시도하지 않는다 (빈 경로 `validate_path` 거류 방지). 이 때 클립보드 만료(붙여넣기 경로)에 대비해 `File` 객체를 Save-As 대기 전에 동기적으로 확보한다.

#### REQ-IMG-MODE-3-U-002 (Unwanted): 소형 이미지 + 미저장 + inline-blob → Group A 보존 (회귀 가드)

**IF** `IMAGE_INLINE_THRESHOLD` 미만의 소형 이미지가 inline-blob 모드 + 미저장 문서에서 삽입되는 경우, **THEN** 시스템은 Save-As 다이얼로그를 표시하지 않고 곧바로 data URI로 임베드한다. **AND** 시스템은 `saveFileAs` / `saveFileAsIpc` / `readFileSize`(이 경로에서는 크기 조회 후 소형 판정) IPC를 삽입 목적 외에 호출하지 않는다. 이 요구는 `SPEC-IMG-LOAD-001` REQ-IMG-LOAD-A-001(inline-blob + 미저장 → Save-As 스킵)의 소형 이미지 회귀 가드이다.

#### REQ-IMG-MODE-3-U-003 (State-Driven): 저장된 문서 + 대형 이미지 → 기존 경로로 file-save

**WHILE** `currentFilePath`가 `null`이 아닌(저장된) 상태에서 대형 이미지가 삽입되는 경우, 시스템은 Save-As 다이얼로그 없이 기존 `filePath`로 file-save 라우팅을 수행한다 (`SPEC-IMG-LOAD-001` REQ-IMG-LOAD-A-003 — 이미 저장된 문서는 모드 무관 기존 동작 — 의 대형 이미지 확장).

### Group N (Non-goals preserved — 기존 정책 보존)

#### REQ-IMG-MODE-3-N-001 (Ubiquitous): 소형 이미지의 기본 모드 inline-blob 보존

시스템은 `IMAGE_INLINE_THRESHOLD` 미만의 소형 이미지에 대해 `SPEC-IMG-MODE-001` REQ-1이 정의한 `inline-blob` 기본 모드 동작을 보존한다. 본 SPEC은 기본 모드 값을 변경하지 않으며, 소형 이미지의 이식성(data URI) 보장을 유지한다.

#### REQ-IMG-MODE-3-N-002 (Unwanted): `MAX_IMAGE_SIZE` 10MB file-save 거부 정책 유지

시스템은 `MAX_IMAGE_SIZE`(10MB, `image_ops.rs:12`) 기반 file-save 경로의 크기 거부 정책을 변경하지 않는다. `IMAGE_INLINE_THRESHOLD` 초과로 file-save로 라우팅된 이미지가 다시 10MB 초과인 경우, 시스템은 기존 동작대로 거부 에러를 반환하며 사용자 가시적 에러 피드백은 별도 SPEC 과제이다 (OD-2 관련). `IMAGE_INLINE_THRESHOLD`가 10MB 미만으로 설정되므로(T-001 제약) 임계량 역전 사각지대는 발생하지 않는다.

## Design Notes (구현 메커니즘 — 참고용)

> 본 섹션은 run-phase 구현자를 위한 안내이며 REQ 본문이 아니다. 동일한 행동 결과를 내는 한 대체 구현을 허용한다.

### `resolveImageRoute` helper (신규 chokepoint)

```typescript
// 의사코드 — 실제 시그니처는 run phase 결정
type ImageRoute = 'inline' | 'file';

async function resolveImageRoute(params: {
  mode: ImageInsertMode;
  sizeInBytes: number;
}): Promise<ImageRoute> {
  if (params.sizeInBytes >= IMAGE_INLINE_THRESHOLD) return 'file';
  return params.mode === 'inline-blob' ? 'inline' : 'file';
}
```

3개 핸들러가 모두 이 helper를 호출한다. 현재 모드 분기가 3개 핸들러에 중복(`imageHandler.ts:160-170`, `:210-231`, `:264-279`)되어 있으므로, helper 도입으로 단일 결정점을 만든다.

### 지연 Save-As (Lazy Save-As) 흐름 — option 2 채택

**왜 option 2(핸들러 내부 지연 게이트)인가**:

- **Option 1 (게이트 조건부 변경)**: `decideImageInsert`(`imageHandler.ts:93-105`)에 `fileSize` 인자를 추가하여 대형 + 미저장 시 `'require-file-path'` 반환. 기존 `imagePasteGuard.test.tsx:181-204`("inline-blob 모드는 파일 경로를 요구하지 않는다") 단언이 게이트 조건부 변경으로 인해 테스트 구조 재설계를 요구한다. 게이트 단위의 변경은 리뷰 범위가 넓다.
- **Option 2 (핸들러 내부 지연 게이트)** ✓: Save-As 결정을 3개 핸들러 내부로 이동. 소형 이미지에 대해서는 Group A 게이트(`AppLayout.tsx:316-318`, `MarkdownEditor.tsx:174-177`)를 그대로 두어 zero regression. 대형 이미지 + 미저장 시에만 핸들러가 Save-As를 트리거. 붙여넣기 경로는 `extractImageFile`(`imageHandler.ts:136-148`)이 동기적으로 `File`을 확보하므로 클립보드 만료 안전.
- **Option 3 (임시 디렉토리)**: 대형 이미지를 시스템 임시 디렉토리에 저장. 이식성(외부 파일 의존)을 깨므로 기각.

**핸들러별 지연 게이트 필요 여부**:

| 진입점 | 현재 미저장 게이트 | 본 SPEC 지연 게이트 필요? |
|---|---|---|
| 붙여넣기 (`insertImageFile`) | `decideImageInsert` → 'insert' for inline-blob + 미저장 (Save-As 스킵) | **필요** (대형 + inline-blob + 미저장 시) |
| 다이얼로그 (`insertImageFromDialog`) | Group A 게이트 inline-blob + 미저장 → Save-As 스킵 (`AppLayout:316-318`) | **필요** (대형 + inline-blob + 미저장 시) |
| 드롭 (`handleImageDrop`) | `MarkdownEditor:277-290` 모드 무관 항상 Save-As 게이트 | **불필요** (이미 게이트됨) |

### 크기 획득 방식 (REQ-R-003)

- 붙여넣기·드롭: DOM `File` 객체의 `file.size` 동기 속성. IPC 없음.
- 다이얼로그: 네이티브 경로만 반환(`openImageDialog`) → `await readFileSize(selectedPath)` (IPC 1회). 현재 다이얼로그 경로는 `readFileSize`를 사용하지 않으므로 신규 호출 부위.

### 임계값 상수 배치

`IMAGE_INLINE_THRESHOLD`는 `src/lib/preview/previewLimits.ts`에 기존 3계층 임계값(`LINE_FOLD_THRESHOLD=1MB`, `SOFT_THRESHOLD=30MB`, `HARD_CEILING=100MB`)과 함께 배치한다. 이 위치는:

- `LINE_FOLD_THRESHOLD`(단일 라인 길이 1MB)와 논리적으로 인접 — 임계값 이하 inline-blob 이미지는 라인 폴딩을 트리거하지 않아야 한다.
- Rust `MAX_IMAGE_SIZE`(10MB)는 Rust 상수이므로 TS 파일에 명시적 import 불가. Design Notes와 T-001 제약(`< MAX_IMAGE_SIZE`)으로 문서화한다.

### Threshold Constants Table

| 상수 | 값 | 위치 | 역할 |
|---|---|---|---|
| `LINE_FOLD_THRESHOLD` | 1MB (1,048,576) | `previewLimits.ts:23` | 단일 라인 길이 임계 — 초과 시 라인 폴딩 (`SPEC-IMG-LOAD-002` REQ-D-003). 본 SPEC 하위 이웃 |
| `IMAGE_INLINE_THRESHOLD` | OD-1 (권장 2MB = 2,097,152) | `previewLimits.ts` (신규) | per-image 크기 임계 — 이상 시 file-save 라우팅 (본 SPEC T-001). `LINE_FOLD_THRESHOLD` 이상, `MAX_IMAGE_SIZE` 미만 |
| `MAX_IMAGE_SIZE` | 10MB (10,485,760) | `image_ops.rs:12` (Rust) | file-save 경로 이미지 크기 상한 — 초과 시 거부 (`SPEC-IMG-001`). 본 SPEC 상위 이웃. T-001 제약: `IMAGE_INLINE_THRESHOLD < MAX_IMAGE_SIZE` |
| `SOFT_THRESHOLD` | 30MB | `previewLimits.ts:11` | 대용량 `.md` 파일 임계 — 점진적 로딩 (`SPEC-IMG-LOAD-002`). 본 SPEC과 무관 (`.md` 전체 크기, per-image 아님) |
| `HARD_CEILING` | 100MB | `previewLimits.ts:17` | 대용량 `.md` 파일 상한 — UnsupportedFileViewer (`SPEC-IMG-LOAD-002`). 본 SPEC과 무관 |

## Exclusions (Non-Goals)

본 SPEC은 다음을 다루지 않는다:

1. **abandoned Web Worker route (과거 계획 방향)** — markdown-it 파싱의 Web Worker 이관(`SPEC-PREVIEW-013`로 착수 예정이었으나 미착수 폐기)은 본 SPEC의 근본 원인 루트(per-image 라우팅)로 인해 불필요해진다. `.md`가 가벼우면 Worker 이관 없이도 파싱 비용이 저렴하다. 본 SPEC이 de facto 대체하나, 공식 `supersedes` 대상이 아니다(`SPEC-PREVIEW-013`은 어떤 브랜치에서도 커밋된 적 없음).
2. **이미 bloat된 기존 `.md` 파일의 마이그레이션 도구** — base64 data URI를 `./images/` 파일로 추출하는 도구는 별도 후속 SPEC (`SPEC-IMG-LOAD-001` Non-Goal #3과 동일 입장).
3. **per-image 디코드 최적화** — file-save 경로의 대형 단일 이미지 디코드 비용(프리뷰에서 raster 디코딩)은 존재하나, `.md`가 가벼우면 파싱 동결은 없으므로 본 SPEC 범위 밖. 별도 최적화 과제.
4. **기본 모드를 `file-save`로 전환** — `inline-blob`이 기본값으로 유지된다 (`SPEC-IMG-MODE-001` REQ-1, `SPEC-IMG-LOAD-001` Non-Goal #2 보존). 본 SPEC은 소형 이미지의 모드 선호도를 존중한다.
5. **`MAX_IMAGE_SIZE`(10MB) 변경** — Rust 상수 그대로. 대형 이미지(>10MB)는 file-save로 라우팅되어도 기존 거부 정책 적용 (REQ-N-002).
6. **사용자 가시적 에러 피드백(toast 등)** — `readFileSize` 실패·file-save 거부(>10MB) 시의 사용자 알림은 별도 SPEC (`SPEC-IMG-MODE-002` Non-Goal #7과 동일 입장). 본 SPEC은 조용히 no-op 또는 기존 에러 전파를 따른다 (OD-2).
7. **`imageInsertMode` store를 per-document로 변경** — 전역(zustand persist)을 유지. 모드 = 사용자 선호도, 임계값 = 자동 안전망의 양립 설계.
8. **`SPEC-IMG-WIDGET-001`(이미지 접기 위젯)** — 본 SPEC과 독립. bloat된 파일 편집 UX 개선은 해당 SPEC.
9. **이미지 삽입 순서 보존** — 다중 드롭 시 라우팅 결정이 파일마다 독립적이므로, 소형·대형 혼합 드롭에서 삽입 순서는 유지되나 이를 명시적 단위 테스트로 강제하지는 않는다 (기존 `handleImageDrop` 루프 순서 보존에 의존).
10. **Rust 신규 명령·IPC 추가** — `readFileSize`(`SPEC-IMG-LOAD-001` Group B 산물) 재사용. Rust 변경 불필요.

## Traceability

| Requirement | Test ID | Acceptance Criteria |
|---|---|---|
| REQ-IMG-MODE-3-R-001 | UT-R-001a/b/c/d/e/f (3 경로 × 소형/대형), UT-R-BOUNDARY (임계값 ±1 byte × 3 경로) | AC-R-1, AC-R-2 |
| REQ-IMG-MODE-3-R-002 | UT-R-002 (3 진입점 동일 라우팅 단언) | AC-R-3 |
| REQ-IMG-MODE-3-R-003 | UT-R-003a (DOM `file.size`), UT-R-003b (`readFileSize` IPC) | AC-R-4 |
| REQ-IMG-MODE-3-T-001 | UT-T-001 (상수 존재·값 검증·`< MAX_IMAGE_SIZE` 단언) | AC-T-1 |
| REQ-IMG-MODE-3-U-001 | UT-U-001 (대형 + inline-blob + 미저장 → `saveFileAs` 1회 호출) | AC-U-1 |
| REQ-IMG-MODE-3-U-002 | UT-U-002 (소형 + inline-blob + 미저장 → `saveFileAs` 미호출) | AC-U-2 |
| REQ-IMG-MODE-3-U-003 | UT-U-003 (대형 + 저장됨 → file-save, `saveFileAs` 미호출) | AC-U-3 |
| REQ-IMG-MODE-3-N-001 | UT-N-001 (소형 + 기본 모드 inline-blob → data URI) | AC-N-1 |
| REQ-IMG-MODE-3-N-002 | UT-N-002 (대형 >10MB → file-save 거부 에러) | AC-N-2 |

## Quality Notes

- REQ 본문은 행동만 서술한다. Design Notes의 함수명(`resolveImageRoute`)·IPC 호출(`readFileSize`)·상수 배치는 참고용이며 run-phase 에이전트가 동일 결과를 내는 한 대체 구현을 허용한다 ([feedback-spec-verifiable-requirements] 반영).
- 기존 UT-7/8/11(`imageHandler.test.ts:276-318` — 다이얼로그 모드 분기)은 본 SPEC의 소형 이미지 경로(REQ-U-002)와 양립한다. 삭제되지 않으나 `readFileSize` 모킹 추가가 필요하다 (다이얼로그 경로가 이제 크기 조회를 수행하므로). 이는 테스트 인프라 확장이지 행동 반전이 아니다.
- "store 무변경"(Non-Goal #7), "Rust 무변경"(Non-Goal #10), "Group A 게이트 무변경"·"토글 UI 무변경"(Delta Map `[EXISTING]` 행)은 단위 테스트로 강제 불가한 git diff 속성이다 — acceptance.md의 Test Strategy Layer에서 "코드 리뷰(diff)" 행으로 분리하여 정직한 범위를 표시한다 ([feedback-spec-verifiable-requirements] 패턴 2 반영).
- 핸들러 내부 동작(지연 Save-As 트리거 등)은 jsdom 단위 테스트로 검증 가능하나, 실제 클립보드·드래그-앤-드롭 이벤트의 포인터 순서·클립보드 만료 타이밍은 jsdom이 재현하지 못한다. Playwright must-pass 게이트로 보완한다 ([feedback-jsdom-pointer-blindspot] 반영 — REQ-U-001의 클립보드 만료 안전성은 Playwright로 검증).
