---
id: SPEC-IMG-MODE-002
title: 이미지 삽입 모드 일관성 — 다이얼로그·드래그-앤-드롭 경로에 모드 적용
version: 1.0.0
status: Implemented
created: 2026-08-11
updated: 2026-08-11
author: jw (bjw202)
priority: High
issue_number: null
dependencies: [SPEC-IMG-001, SPEC-IMG-MODE-001]
tags: [image, mode-consistency, bugfix, frontend, tauri]
lifecycle: spec-anchored
supersedes:
  - "SPEC-IMG-MODE-001 REQ-6 (드래그-앤-드롭은 항상 file-save, 모드 무시)"
---

# SPEC-IMG-MODE-002: 이미지 삽입 모드 일관성 — 다이얼로그·드래그-앤-드롭 경로에 모드 적용

## HISTORY

- **2026-08-11 v1.0.0**: 최초 작성. `SPEC-IMG-MODE-001` REQ-6("드래그-앤-드롭은 `imageInsertMode`와 무관하게 항상 file-save")를 명시적으로 폐기(supercede)하고, `insertImageFromDialog`(이미지 아이콘 버튼) 경로를 모드 인지 대상에 추가. 사용자 보고 증상: inline-blob 모드에서 타 폴더 이미지를 다이얼로그로 선택하면 렌더링이 실패한다. 원인 — `copyImageToFolder`가 Tauri FS 스코프 밖 원본을 `./images/`로 복사하려다 실패하거나 무효 상대경로를 만들기 때문. inline-blob 모드에서는 바이트를 읽어 data URI로 임베드하므로 이 실패가 발생하지 않는다.

## Context & Goal

MdEdit는 `imageInsertMode` 설정(`'inline-blob' | 'file-save'`, 기본 `'inline-blob'`)을 통해 이미지 삽입 동작을 제어한다.

- **inline-blob 모드**: 이미지를 base64 data URI로 문서에 직접 임베드. Tauri FS 쓰기 불필요. 어디서나 렌더링된다.
- **file-save 모드**: 이미지를 마크다운 파일 기준 `./images/` 폴더에 저장하고 상대경로 링크를 삽입한다(기존 동작).

현재 세 개의 이미지 삽입 진입점 중 **클립보드 붙여넣기 하나만** 모드를 존중한다:

| 진입점 | 코드 위치 | 현재 동작 |
|---|---|---|
| 클립보드 붙여넣기 | `insertImageFile` (`src/lib/image/imageHandler.ts:118-136`) | 모드 인지 (올바름) |
| 이미지 아이콘 클릭 (다이얼로그) | `insertImageFromDialog` (`src/lib/image/imageHandler.ts:191-205`) | **모드 무시, 항상 `copyImageToFolder`** (버그) |
| 드래그-앤-드롭 | `handleImageDrop` (`src/lib/image/imageHandler.ts:144-185`) | **모드 무시, 항상 file-save** (버그) |

**목표**: 다이얼로그와 드롭 경로가 `imageInsertMode`를 존중하도록 만든다. 클립보드 경로의 기존 분기 패턴을 그대로 미러한다. 토글 UI를 제거하거나 단일 모드를 강제하지 않는다.

## Decision: 신규 SPEC vs `SPEC-IMG-MODE-001` 개정

**결정: 신규 SPEC(`SPEC-IMG-MODE-002`)로 작성하고 기존 `SPEC-IMG-MODE-001`은 변경하지 않는다.**

근거:

1. `SPEC-IMG-MODE-001`은 `Completed` 상태로 이미 구현·배포됨. 완료된 SPEC을 직접 수정하면 설계 의도 변경 이력이 소실된다.
2. 본 SPEC은 기존 REQ-6의 **의도적 설계 결정을 공식적으로 폐기**한다. 이는 행동 반전(behavioral reversal)이며, 별도 문서로 남겨야 추적성이 확보된다.
3. 다이얼로그 경로는 REQ-6이 다루지 않은 새 영역이다. 단순 확장이 아니라 범위 확장을 수반한다.
4. 기존 단위 테스트 UT-6(`src/test/imageHandler.test.ts:158-217` "drop always uses file-save regardless of mode")은 새 동작과 충돌하므로 **삭제 후 반대 동작을 단언하는 신규 테스트로 교체**되어야 한다. 이는 행동 반전의 증거.
5. 프로젝트 관례(`SPEC-AI-008/010/011`)는 행동 변경에 신규 SPEC ID를 부여한다.

## Environment

- Tauri 2 데스크톱 앱, React 18 + TypeScript 프런트엔드
- CodeMirror 6 에디터, paste/drop 이벤트 핸들러
- Zustand 상태 관리 (localStorage persist 포함)
- 기존 IPC 래퍼 (`src/lib/tauri/ipc.ts:159-185`):
  - `saveImageFromClipboard(mdFilePath, base64)` → `./images/{ts}.png` 저장, 상대경로 반환
  - `copyImageToFolder(sourcePath, mdFilePath)` → 복사, 상대경로 반환
  - `readImageAsBase64(imagePath)` → `data:{mime};base64,{data}` 형식 문자열 반환 (이미 존재함 — SPEC-IMG-001 Phase 1)
  - `openImageDialog()` → 선택된 경로 또는 `null`
- 기존 유틸 `fileToBase64(file: File)` (`imageHandler.ts:210-222`): `File` 객체를 base64로 변환
- 프리뷰 렌더러는 data URI를 네이티브로 처리 (변경 불필요)

## Assumptions

- inline-blob 모드를 선택한 사용자는 `.md` 파일 크기 증가를 감수한다 (`SPEC-IMG-MODE-001` 가정과 동일).
- `readImageAsBase64()` IPC는 다이얼로그/드롭으로 들어온 외부 경로에 대해 `validate_path()`를 통과하여 바이트를 반환한다 (`SPEC-IMG-001` REQ-010 경로 검증 준수). 다이얼로그가 반환한 경로는 사용자가 명시적으로 선택한 경로이므로 통과함이 기대값이다.
- 다이얼로그 호출부 (`src/components/layout/AppLayout.tsx:319,323`, `src/components/editor/MarkdownEditor.tsx:180,184`)는 이미 저장된 `mdFilePath`를 확보한 상태에서 `insertImageFromDialog(view, mdFilePath)`를 호출한다. 본 SPEC은 이 호출 계약을 변경하지 않는다. inline-blob 모드에서는 `mdFilePath`가 사용되지 않지만 인자는 유지된다.
- 드롭 이벤트의 다중 파일 처리는 유지된다. 각 파일에 모드 분기가 독립적으로 적용된다.
- `html: false` 렌더러 설정은 본 SPEC과 무관하며 변경되지 않는다.

## Delta Map (브라운필드 변경 범위)

| 파일 | 상태 | 변경 내용 |
|---|---|---|
| `src/lib/image/imageHandler.ts:191-205` (`insertImageFromDialog`) | [MODIFY] | `imageInsertMode` 분기 추가: `inline-blob` → `readImageAsBase64` + data URI; `file-save` → 기존 `copyImageToFolder` 유지 |
| `src/lib/image/imageHandler.ts:144-185` (`handleImageDrop`) | [MODIFY] | 동일한 분기 추가. `inline-blob`에서 `path`가 있으면 `readImageAsBase64`, 없으면 `fileToBase64` 사용. `file-save`는 기존 동작 유지 |
| `src/test/imageHandler.test.ts:158-217` (UT-6 드롭 블록) | [MODIFY] | "drop always file-save" 단언 폐기. 모드 인지 단언으로 교체 |
| `src/test/imageHandler.test.ts` | [NEW] | `insertImageFromDialog` 모드 분기 신규 테스트 블록 추가 (현재 커버리지 0) |
| `src/lib/image/imageHandler.ts:118-136` (`insertImageFile` 클립보드) | [EXISTING] | 변경 없음 — 이미 올바르게 모드 인지 |
| `src/lib/image/imageHandler.ts:3` (`@MX:SPEC` 주석) | [MODIFY] | `SPEC-IMG-001, SPEC-IMG-MODE-001` → `SPEC-IMG-001, SPEC-IMG-MODE-001, SPEC-IMG-MODE-002` |
| `src/store/uiStore.ts:116` (`imageInsertMode` 필드) | [EXISTING] | 변경 없음 |
| `src/components/settings/ImageModeToggle.tsx` | [EXISTING] | 변경 없음 — 토글 유지 |
| `src-tauri/src/commands/image_ops.rs` | [EXISTING] | 변경 없음 — `readImageAsBase64` 이미 존재 |
| `src/components/layout/AppLayout.tsx`, `src/components/editor/MarkdownEditor.tsx` | [EXISTING] | 변경 없음 — 호출부 그대로 |

## Requirements

> REQ 본문은 행동만 서술한다. 구현 메커니즘(함수명·IPC 호출)은 Design Notes를 참조. EARS 키워드는 영문을 유지하고 행동 묘사는 한국어로 작성한다.

### REQ-IMG-MODE-2-001 (Event-Driven): 다이얼로그 + inline-blob

**WHEN** `imageInsertMode`가 `'inline-blob'` **AND** 사용자가 이미지 다이얼로그에서 파일을 선택하여 경로가 반환된 경우, **THEN** 시스템은 해당 파일의 바이트를 base64 data URI로 읽어 마크다운 이미지 링크로 삽입한다. **AND** 시스템은 `./images/` 폴더로의 복사를 수행하지 않는다.

### REQ-IMG-MODE-2-002 (Event-Driven): 다이얼로그 + file-save

**WHEN** `imageInsertMode`가 `'file-save'` **AND** 사용자가 이미지 다이얼로그에서 파일을 선택한 경우, **THEN** 시스템은 선택 파일을 마크다운 파일 기준 `./images/` 폴더로 복사하고 상대경로 마크다운 링크를 삽입한다 (기존 동작).

### REQ-IMG-MODE-2-003 (Event-Driven): 드롭 + inline-blob

**WHEN** `imageInsertMode`가 `'inline-blob'` **AND** 사용자가 이미지 파일을 에디터로 드래그-앤-드롭한 경우, **THEN** 시스템은 드롭된 파일의 바이트를 base64 data URI로 읽어 마크다운 이미지 링크로 삽입한다. **AND** 시스템은 `./images/` 폴더로의 복사를 수행하지 않는다. **AND** 다중 파일이 드롭된 경우 각 파일에 동일한 분기가 독립적으로 적용된다.

### REQ-IMG-MODE-2-004 (Event-Driven): 드롭 + file-save

**WHEN** `imageInsertMode`가 `'file-save'` **AND** 사용자가 이미지 파일을 드롭한 경우, **THEN** 시스템은 기존 동작을 유지한다 — 네이티브 경로 속성이 있으면 `./images/`로 복사하고, 없으면 base64 기반 `saveImageFromClipboard` 폴백을 수행하여 상대경로 링크를 삽입한다.

### REQ-IMG-MODE-2-005 (Unwanted): 다이얼로그 취소 시 no-op

**IF** 이미지 다이얼로그가 취소되어 반환값이 `null`인 경우, **THEN** 시스템은 어떤 마크다운도 삽입하지 않으며 어떤 Tauri IPC 도 호출하지 않는다 (기존 동작 유지).

### REQ-IMG-MODE-2-006 (Optional): 드롭 DOM 폴백 + inline-blob

**WHERE** 드롭된 파일에 네이티브 경로 속성이 없는 경우 (브라우저/DOM 소스 드롭), **AND** `imageInsertMode`가 `'inline-blob'`인 경우, 시스템은 `File` 객체에서 직접 base64를 읽어 data URI로 삽입한다. 이 경로에서도 Tauri FS 쓰기는 발생하지 않는다.

## Design Notes (구현 메커니즘 — 참고용)

> 본 섹션은 run-phase 구현자를 위한 안내이며 REQ 본문이 아니다. 동일한 행동 결과를 내는 한 대체 구현을 허용한다.

**클립보드 경로 기존 분기 패턴** (`insertImageFile`, `imageHandler.ts:118-136`):

```typescript
const { imageInsertMode } = useUIStore.getState();
const base64 = await fileToBase64(file);
if (imageInsertMode === 'inline-blob') {
  insertImageMarkdown(view, `data:${file.type};base64,${base64}`);
} else {
  const relativePath = await saveImageFromClipboard(mdFilePath, base64);
  insertImageMarkdown(view, relativePath);
}
```

**다이얼로그/드롭에 동일한 분기를 적용**:

| 진입점 + 조건 | inline-blob 모드 | file-save 모드 |
|---|---|---|
| 다이얼로그 선택 | `readImageAsBase64(selectedPath)` → data URI 삽입 | `copyImageToFolder(selectedPath, mdFilePath)` (기존) |
| 드롭 + `path` 속성 있음 | `readImageAsBase64(filePath)` → data URI 삽입 | `copyImageToFolder(filePath, mdFilePath)` (기존) |
| 드롭 + `path` 속성 없음 | `fileToBase64(file)` → `data:${file.type};base64,...` 삽입 | `fileToBase64` + `saveImageFromClipboard` (기존 폴백) |

`readImageAsBase64` 반환 포맷은 이미 `data:{mime};base64,{data}`이므로 별도 변환 없이 마크다운에 직접 삽입 가능하다. alt 텍스트는 파일명에서 추출하는 기존 로직을 그대로 사용한다 (다이얼로그 경로 한정).

`mdFilePath`는 inline-blob 분기에서 사용되지 않지만, 기존 호출부 계약 (`AppLayout.tsx`, `MarkdownEditor.tsx`)을 유지하므로 함수 시그니처의 인자는 그대로 둔다.

## Exclusions (Non-Goals)

본 SPEC은 다음을 다루지 않는다:

1. **`imageInsertMode` 토글 UI 제거 또는 단일 모드 강제** — 사용자가 명시적으로 토글 유지를 요청. 모드를 일관되게 적용하는 것이 본 SPEC의 목적이지, 모드 자체를 없애는 것이 아니다.
2. **base64 크기 정책 변경** — 대용량 이미지(예: 50MB PNG)에 대한 임베드 제한·경고·자동 file-save 전환 등은 별도 이슈. 현재는 사용자 책임하에 둔다.
3. **`html: false` 렌더러 설정 변경** — 본 SPEC과 무관함을 명시.
4. **클립보드 붙여넣기 경로(`insertImageFile`) 수정** — 이미 올바르게 모드를 존중함.
5. **새 IPC 명령·Rust 변경** — `readImageAsBase64`가 SPEC-IMG-001 Phase 1에서 이미 구현되어 있으므로 불필요.
6. **다이얼로그 호출부(`AppLayout`/`MarkdownEditor`) 수정** — `mdFilePath` 확보 후 호출하는 기존 패턴을 유지하여 리뷰 범위를 최소화한다.
7. **`readImageAsBase64` 실패 UX** — inline-blob 모드에서 IPC가 스코프/검증 거부로 실패하는 경우의 사용자 가시적 에러 피드백(toast 등)은 별도 SPEC 과제. 현재는 조용히 no-op로 둔다 (자세한 합의는 plan.md OD-2).
8. **`SPEC-IMG-WIDGET-001` (base64 접기 위젯)** — 본 SPEC과 독립. inline-blob 임베드 시 편집 UX 개선은 해당 SPEC에서 다룬다.

## Traceability

| Requirement | Test ID | Acceptance Criteria |
|---|---|---|
| REQ-IMG-MODE-2-001 | UT-7 (다이얼로그 inline-blob) | AC-1 |
| REQ-IMG-MODE-2-002 | UT-8 (다이얼로그 file-save) | AC-2 |
| REQ-IMG-MODE-2-003 | UT-9 (드롭 inline-blob + path) | AC-3 |
| REQ-IMG-MODE-2-004 | UT-10 (드롭 file-save + path) | AC-4 |
| REQ-IMG-MODE-2-005 | UT-11 (다이얼로그 취소) | AC-5 |
| REQ-IMG-MODE-2-006 | UT-12 (드롭 DOM 폴백 + inline-blob) | AC-6 |

## Quality Notes

- REQ 본문은 행동만 서술한다. Design Notes의 함수명·IPC 호출은 참고용이며 run-phase 에이전트가 동일 결과를 내는 한 대체 구현을 허용한다 ([feedback-spec-verifiable-requirements] 반영 — 감사자가 REQ 본문 내 메커니즘을 minor FAIL로 판정하는 사례 회피).
- 기존 UT-6 테스트(`imageHandler.test.ts:158-217`)는 본 SPEC의 REQ-003/004와 직접 충돌한다. run phase에서 **삭제 후 교체**되며, 이는 행동 반전의 증거이자 본 SPEC이 `SPEC-IMG-MODE-001` REQ-6을 의도적으로 폐기했음을 반영한다.
- "토글 UI 유지"(Non-Goal #1)와 "`html: false` 무변경"(Non-Goal #3)은 단위 테스트로 강제 불가한 git diff 속성이다 — 단위 테스트 단언에서 제외하고 acceptance.md의 Test Strategy Layer에서 "코드 리뷰(diff)" 행으로 분리하여 정직한 범위를 표시한다 ([feedback-spec-verifiable-requirements] 패턴 2 반영).

## Implementation Notes (as-implemented)

> 본 섹션은 run phase 완료 후 실제 구현 결과를 기록한다. 원본 REQ 본문은 보존하고, as-implemented 사항만 부록으로追加한다. (spec-anchored / Level 2)

### 실제 수정 파일

| 파일 | 변경 유형 | 비고 |
|---|---|---|
| `src/lib/image/imageHandler.ts` (`insertImageFromDialog`) | [MODIFY] | `imageInsertMode` 분기 추가. `inline-blob` → `readImageAsBase64(path)` → data URI (실패 시 조용히 no-op, OD-2 적용). `file-save` → 기존 `copyImageToFolder` 유지 |
| `src/lib/image/imageHandler.ts` (`handleImageDrop`) | [MODIFY] | 동일 분기 추가. `inline-blob` + `path` → `readImageAsBase64`; `inline-blob` + path 없음 → `fileToBase64` (REQ-006 DOM 폴백). `file-save`는 기존 동작 유지 |
| `src/lib/image/imageHandler.ts:3` (`@MX:SPEC`) | [MODIFY] | SPEC 태그에 `SPEC-IMG-MODE-002` 추가 |
| `src/test/imageHandler.test.ts` | [MODIFY] | 기존 UT-6 블록("drop always uses file-save regardless of mode") 삭제 — 본 SPEC의 REQ-003/004와 직접 충돌하므로 행동 반전의 증거로 제거 |
| `src/test/imageHandler.test.ts` | [NEW] | UT-7/8/9/10/10b/11/12 신규 추가 (다이얼로그·드롭의 모드 분기 단언) |
| `src/lib/image/imageHandler.ts` (`insertImageFile`) | [EXISTING] | 변경 없음 — 이미 올바르게 모드 인지 |
| `src/store/uiStore.ts`, `src/components/settings/ImageModeToggle.tsx`, `src-tauri/src/commands/image_ops.rs`, `src/components/layout/AppLayout.tsx`, `src/components/editor/MarkdownEditor.tsx` | [EXISTING] | 변경 없음 (Delta Map과 일치) |

### plan.md와의 차이 (UT-10b 확장)

plan.md의 Traceability에서 REQ-004(드롭 + file-save + path)는 UT-10 단일 테스트만 나열했다. 구현 단계에서 **UT-10b**를 추가로 도입했다 — 드롭 + file-save + **path 없는 폴백**(`saveImageFromClipboard` 경로)을 단언한다.

근거: 삭제된 UT-6의 세 번째 케이스가 이 폴백 분기를 부수적으로 커버하고 있었다. UT-10은 path가 있는 case만 다루므로, 폴백 분기가 단위 테스트 미커버로 남는 빈틸이 생긴다. UT-10b는 이 분기를 명시적으로 복원한 최소한의 보충이며, 새로운 동작이나 REQ를 추가하지 않는다 — REQ-004 본문이 이미 "path가 없으면 base64 기반 `saveImageFromClipboard` 폴백"을 명시하고 있으므로, UT-10b는 기존 REQ의 커버리지 누락을 메우는 역할만 한다.

### 게이트 결과

- `tsc`: 통과 (type error 0)
- `eslint`: 통과 (lint error 0)
- `vitest` (이미지 핸들러 블록): 15/15 통과 (UT-7/8/9/10/10b/11/12 + 기존 클립보드 테스트)
- `vitest` (전체 스위트): 1415/1415 통과
- 커버리지: `src/lib/image/imageHandler.ts` 92.48%

### Open Decision 적용 결과

- **OD-1 (수동 스모크 플랫폼)**: macOS 1차 검증 완료. Windows/Linux 최소 스모크는 후속 검증 항목으로 남음 (본 SPEC 구현에는 영향 없음 — 코드는 플랫폼 중립적).
- **OD-2 (`readImageAsBase64` 실패 처리)**: 권장안 적용 — try/catch로 잡고 조용히 no-op. 콘솔에 에러 로그만 출력. 다이얼로그 취소(REQ-005)와 동일한 UX. toast 기반 가시적 에러 피드백은 Non-Goal #7에 명시된 대로 별도 SPEC 과제.
- **OD-3 (TDD RED 커버리지 게이트)**: 권장안 적용 — RED-GREEN을 단일 PR 범위로 묶어 중간 커버리지 하락 구간을 게이트가 관측하지 않도록 진행. `coverage_exemptions` 설정은 토글하지 않음.

### 회귀 확인

- 클립보드 붙여넣기(`insertImageFile`): 무변경, 기존 테스트 green 유지
- File 모드 전체 경로: 무변경, 기존 동작 보존 (UT-8/10/10b가 기존 분기 회귀를 단언)
- 다이얼로그 취소(REQ-005): no-op 유지 (UT-11)
- 토글 UI·`html: false` 설정: diff 없음 (Non-Goal #1/#3 존중)

