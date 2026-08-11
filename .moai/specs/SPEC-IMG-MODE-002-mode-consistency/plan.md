# Implementation Plan: SPEC-IMG-MODE-002

## Technical Approach

**최소 변경 원칙**: 기존 `insertImageFile` (클립보드)의 모드 분기 패턴을 다이얼로그·드롭 핸들러에 동일하게 적용한다. 신규 IPC·신규 Rust 명령·신규 상태 필드 불필요 — `readImageAsBase64` IPC는 SPEC-IMG-001 Phase 1에서 이미 구현되어 있다.

**대칭적 분기**: 세 진입점(클립보드/다이얼로그/드롭)이 동일한 `imageInsertMode` 리딩 + 동일한 분기 구조를 갖는다. 이는 코드 리뷰에서 일관성을 쉽게 검증 가능하게 한다.

## Reproduction-First Test Strategy (TDD RED)

**[HARD] run-phase 첫 단계는 사용자 보고 증상을 재현하는 실패 테스트 작성.** CLAUDE.md Section 7 Rule 4 (Reproduction-First Bug Fixing) 준수.

**재생산 시나리오** (`src/test/imageHandler.test.ts`에 신규 추가, 현재 `vi.hoisted` 모킹 패턴 재사용):

1. UT-7 신규 추가: `insertImageFromDialog` + inline-blob → `copyImageToFolder` 미호출, data URI 삽입 단언 → **현재 코드에서는 실패** (항상 `copyImageToFolder` 호출).
2. UT-9 신규 추가: `handleImageDrop` + inline-blob + path → `copyImageToFolder` 미호출, `readImageAsBase64` 호출, data URI 삽입 단언 → **현재 동작과 반대** → 통과를 위해 UT-6 (기존 "drop always file-save" 블록) 폐기 필요.

**RED 완료 기준**:
- 신규 6개 테스트 (UT-7~12)가 모두 실패 상태로 존재
- 기존 UT-6 (`imageHandler.test.ts:158-217` "drop always uses file-save regardless of mode") 블록이 제거됨 (또는 동일 커밋에서 신규 단언으로 교체됨)
- ipc.ts 모킹에 `readImageAsBase64` 가 추가됨 (현재 `vi.mock('@/lib/tauri/ipc')`에 누락)

## Milestones

> 시간 추정은 사용하지 않는다 ([HARD] coding-standards.md). 우선순위 라벨과 위상 순서로만 표시.

### Milestone 1: 기존 UT-6 폐기 + 재생산 테스트 (RED)

**Priority: High**

- 기존 `imageHandler.test.ts:158-217` 의 "drop always uses file-save regardless of mode" 블록 (3개 `it`) 삭제
- ipc.ts 모킹 (`vi.mock('@/lib/tauri/ipc')`)에 `readImageAsBase64` 추가
- 신규 테스트 블록 추가:
  - UT-7: `insertImageFromDialog` + inline-blob + 다이얼로그가 경로 반환 → `copyImageToFolder` 미호출 단언, `readImageAsBase64` 호출 단언, 삽입된 마크다운이 `data:` 접두사를 가짐을 단언
  - UT-8: `insertImageFromDialog` + file-save → `copyImageToFolder` 호출 (기존 동작)
  - UT-9: `handleImageDrop` + inline-blob + `path` 속성 있음 → `copyImageToFolder` 미호출, `readImageAsBase64` 호출, 삽입 텍스트가 `data:image/...;base64,` 형태
  - UT-10: `handleImageDrop` + file-save + `path` 있음 → `copyImageToFolder` 호출 (기존 동작)
  - UT-11: `insertImageFromDialog` + 다이얼로그가 `null` 반환 → dispatch 호출 없음, IPC 호출 없음
  - UT-12: `handleImageDrop` + inline-blob + `path` 없음 (DOM 폴백) → `saveImageFromClipboard` 미호출, 삽입 텍스트가 data URI 형태
- 모든 신규 테스트가 현재 구현에서 실패함을 확인 (RED 증거)

**Files**:
- `src/test/imageHandler.test.ts` (수정)

### Milestone 2: `insertImageFromDialog` 모드 분기 (GREEN)

**Priority: High**

- `imageHandler.ts:191-205` 수정:
  - `useUIStore.getState().imageInsertMode` 리딩
  - `inline-blob` 분기: `readImageAsBase64(selectedPath)` → 반환된 data URI를 그대로 삽입. alt 텍스트는 파일명에서 추출 (기존 로직 유지)
  - `file-save` 분기: 기존 `copyImageToFolder(selectedPath, mdFilePath)` 유지
  - `null` 반환 (다이얼로그 취소): 기존 early return 유지
- UT-7, UT-8, UT-11 통과 확인

**Files**:
- `src/lib/image/imageHandler.ts`

### Milestone 3: `handleImageDrop` 모드 분기 (GREEN)

**Priority: High**

- `imageHandler.ts:144-185` 수정:
  - 루프 진입 전 `useUIStore.getState().imageInsertMode` 리딩 (루프 밖에서 한 번만 읽어 효율화)
  - `inline-blob` + `path` 있음: `readImageAsBase64(filePath)` → data URI
  - `inline-blob` + `path` 없음 (DOM 폴백): `fileToBase64(file)` → `data:${file.type};base64,${base64}` (기존 `saveImageFromClipboard` 호출 제거)
  - `file-save`: 기존 분기 유지 (path 있으면 `copyImageToFolder`, 없으면 `fileToBase64` + `saveImageFromClipboard`)
- 다중 파일 루프 유지. 각 파일에 모드 분기 적용
- UT-9, UT-10, UT-12 통과 확인

**Files**:
- `src/lib/image/imageHandler.ts`

### Milestone 4: 회귀 검증 + @MX 태그 갱신 (REFACTOR)

**Priority: Medium**

- `imageHandler.ts:3` 의 `@MX:SPEC` 주석 갱신: `SPEC-IMG-001, SPEC-IMG-MODE-001` → `SPEC-IMG-001, SPEC-IMG-MODE-001, SPEC-IMG-MODE-002`
- `imageHandler.test.ts:1` 의 `@MX:SPEC` 주석 갱신: 동일하게 SPEC-IMG-MODE-002 추가
- `ImageModeToggle.tsx:2` 의 `@MX:SPEC: SPEC-IMG-MODE-001` 주석은 **유지** (토글 자체는 MODE-001 산물이므로 변경 없음)
- 전체 단위 테스트 스위트 실행: `npx vitest run`
- TypeScript 컴파일: `npx tsc --noEmit`
- ESLint: `npx eslint src/lib/image/imageHandler.ts src/test/imageHandler.test.ts`
- 클립보드 붙여넣기 경로(`insertImageFile`) 회귀 없음 확인 (기존 UT-2/3)
- 수동 스모크 테스트 (OD-1 플랫폼 합의 후):
  - [ ] inline-blob 모드에서 타 폴더 이미지 아이콘 클릭 선택 → 프리뷰 렌더링 성공 (사용자 보고 버그 수정 확인)
  - [ ] inline-blob 모드에서 외부 폴더 이미지 드롭 → 렌더링 성공
  - [ ] file-save 모드에서 동일 경로 → 기존 동작 유지
  - [ ] 다이얼로그 취소 → no-op
  - [ ] 다중 파일 드롭 → 각 파일 모드 분기 적용

## Architecture Design Direction

```
세 진입점이 동일한 모드 분기 패턴을 사용한다.

클립보드 붙여넣기 (변경 없음 — 이미 올바름):
  handleImagePaste → insertImageFile
    ├─ inline-blob: fileToBase64(File) → data URI
    └─ file-save:   saveImageFromClipboard(mdFilePath, base64) → 상대경로

이미지 다이얼로그 (REQ-001/002/005):
  insertImageFromDialog
    ├─ 다이얼로그 취소 (null): no-op
    ├─ inline-blob: readImageAsBase64(path) → data URI
    └─ file-save:   copyImageToFolder(path, mdFilePath) → 상대경로

드래그-앤-드롭 (REQ-003/004/006), 각 파일에 대해:
  handleImageDrop
    ├─ inline-blob + path 있음: readImageAsBase64(filePath) → data URI
    ├─ inline-blob + path 없음: fileToBase64(File) → data URI
    ├─ file-save + path 있음:   copyImageToFolder(filePath, mdFilePath) → 상대경로
    └─ file-save + path 없음:   fileToBase64 + saveImageFromClipboard → 상대경로
```

## Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| 기존 UT-6 단언이 새 동작과 충돌 — 삭제 시 순간적 커버리지 하락 | Medium | RED 단계에서 삭제 + 교체를 단일 마일스톤(M1)에 수행. 중간 상태(테스트 없는 구간)를 허용하지 않음 |
| `readImageAsBase64` IPC가 Tauri FS 스코프 밖 경로에서 거부될 가능성 | Low | SPEC-IMG-001 REQ-010의 `validate_path()`가 다이얼로그/드롭 경로에 대해 통과함을 스모크 테스트로 확인. 거부 시 no-op (OD-2) |
| 대용량 이미지(예: 20MB+) inline-blob 임베드가 .md 파일을 과도하게 키움 | Medium | 본 SPEC 범위 밖 (Non-Goal #2). `SPEC-IMG-WIDGET-001` 접기 위젯이 UX 영향 완화 |
| Tauri 드롭 이벤트의 `file.path` 속성 노출이 OS마다 다를 수 있음 | Low | OD-1 수동 스모크 플랫폼 합의 후 검증. path가 없는 DOM 폴백 경로(REQ-006)가 안전망 |
| `insertImageFromDialog` 호출부가 inline-blob에서도 `mdFilePath` 확보를 위해 불필요한 Save As를 트리거하는 잔여 로직 | Low | Non-Goal #6. 호출부는 그대로 유지하여 리뷰 범위 최소화. 향후 별도 정리 SPEC 가능 |
| 행동 반전으로 인해 기존 사용자 문서가 깨질 가능성 | Low | `file-save` 모드 사용자는 영향 없음 (기존 동작 유지). `inline-blob` 모드 사용자는 이제 기대한 대로 동작 (버그 수정) |

## Open Decisions (run phase 개시 전 사용자 합의 필요)

아래 항목은 본 SPEC plan 단계에서 명시적 합의가 필요한 결정이다. run phase 에이전트에 위임하기 전에 사용자가 해결해야 한다.

### OD-1: 수동 스모크 테스트 플랫폼 범위

**질문**: Milestone 4의 수동 스모크 테스트를 어느 플랫폼에서 실행할 것인가?

**옵션**:
- (권장) macOS 1차 검증 + Windows/Linux 최소 스모크. Tauri 드롭 이벤트의 `file.path` 속성 노출이 OS마다 다를 수 있어 최소한의 크로스 플랫폼 확인 권장
- macOS만. 개발자 주력 환경이므로 1차 검증은 충분하나 크로스 플랫폼 회귀 가능성 남음
- macOS + Windows + Linux 전수 검증. 가장 안전하지만 시간 소요 큼

**이유**: Tauri 2의 드래그-앤-드롭에서 `File.path` 속성 노출은 플랫폼별로 차이가 있을 수 있음. SPEC-IMG-001 가정에서는 네이티브 드롭에 path가 있다고 했으나 Tauri 2 런타임에서 재확인이 필요.

### OD-2: `readImageAsBase64` 실패 시 에러 처리

**질문**: inline-blob 모드에서 `readImageAsBase64()`가 throw한 경우 (경로 검증 거부 등) 어떻게 처리할 것인가?

**옵션**:
- (권장) try/catch로 잡고 조용히 no-op (다이얼로그 취소와 동일). 콘솔에 에러 로그만 출력. Non-Goal #7에 명시된 기본 입장
- try/catch 후 사용자에게 toast 에러 표시. 본 SPEC 범위 확장 필요 (toast 컴포넌트 의존성 추가)
- 에러 전파 (호출부에서 처리). AppLayout/MarkdownEditor 호출부 수정 필요 → Non-Goal #6 위반

**이유**: Non-Goal #7에 명시된 대로 현재는 no-op로 둔다. 다만 run phase에서 사용자가 가시적 에러 피드백을 선호하는지 확인 필요. toast가 필요하면 본 SPEC 범위가 확장되거나 후속 SPEC이 필요.

### OD-3: TDD RED 단계의 커버리지 게이트 충돌

**질문**: `insertImageFromDialog`가 현재 0% 커버리지인 상태에서, 신규 RED 테스트가 일시적 커버리지 하락을 유발할 수 있다. 어떻게 처리할 것인가?

**옵션**:
- (권장) RED-GREEN을 단일 PR/커밋 범위로 묶어 커버리지 게이트가 중간 상태를 보지 않게 함. quality.yaml의 `coverage_exemptions.enabled: false`를 켜지 않고 진행
- quality.yaml `coverage_exemptions`를 임시 토글 (false → true → false). RED 단계의 실패 테스트에 한해 예외 등록
- 커버리지 게이트를 일시적으로 무시 (`--no-coverage` 플래그 등). 권장하지 않음

**이유**: TDD RED-GREEN 원칙과 CI 커버리지 게이트(80%)의 충돌. CLAUDE.md Section 7 Rule 4 (Reproduction-First)가 우선이지만, 운영 정책 합의 필요. 첫 번째 옵션(단일 PR 묶음)이 가장 깨끗하다.

## Dependencies

- 신규 라이브러리 의존성: 없음
- Rust 변경: 없음
- 기존 IPC 래퍼 재사용: `readImageAsBase64`, `copyImageToFolder`, `saveImageFromClipboard`, `openImageDialog` (모두 `src/lib/tauri/ipc.ts:159-185`)
- 기존 유틸 재사용: `fileToBase64`, `insertImageMarkdown` (imageHandler.ts)
- 기존 상태 재사용: `useUIStore.getState().imageInsertMode` (uiStore.ts:116)

## Traceability

| Milestone | Requirements | Tests |
|---|---|---|
| M1 RED | (재생산 — 구현 전) | UT-7~12 신규 (실패 상태), UT-6 블록 삭제 |
| M2 GREEN | REQ-001, REQ-002, REQ-005 | UT-7, UT-8, UT-11 통과 |
| M3 GREEN | REQ-003, REQ-004, REQ-006 | UT-9, UT-10, UT-12 통과 |
| M4 REFACTOR | (회귀 + @MX 갱신) | 전체 스위트 + 수동 스모크 |
