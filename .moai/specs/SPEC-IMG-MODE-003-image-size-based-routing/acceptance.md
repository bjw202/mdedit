# Acceptance Criteria: SPEC-IMG-MODE-003

## Test Scenarios (Gherkin Given/When/Then)

### AC-R-1: 소형 이미지 — 사용자 모드 존중 (REQ-R-001, 전체 3 경로)

```gherkin
Given imageInsertMode가 "inline-blob"이다
And 이미지 파일 크기가 IMAGE_INLINE_THRESHOLD 미만이다 (예: 1MB at threshold 2MB)
When 사용자가 붙여넣기 / 드롭 / 다이얼로그 중 하나로 해당 이미지를 삽입한다
Then 시스템은 기존 모드 분기를 적용한다 (inline-blob → data URI 임베드)
And 시스템은 ./images/ 폴더로의 복사를 수행하지 않는다
And 에디터 커서 위치에 ![image](data:image/png;base64,...) 가 삽입된다
```

```gherkin
Given imageInsertMode가 "file-save"이다
And 이미지 파일 크기가 IMAGE_INLINE_THRESHOLD 미만이다
When 사용자가 해당 이미지를 삽입한다
Then 시스템은 기존 file-save 동작을 수행한다 (copyImageToFolder 또는 saveImageFromClipboard)
And ./images/ 상대경로 링크가 삽입된다 (SPEC-IMG-MODE-002 기존 동작 보존)
```

### AC-R-2: 대형 이미지 — 모드 무관 file-save 라우팅 (REQ-R-001, 전체 3 경로)

```gherkin
Given imageInsertMode가 "inline-blob"이다
And 이미지 파일 크기가 IMAGE_INLINE_THRESHOLD 이상이다 (예: 5MB at threshold 2MB)
When 사용자가 붙여넣기로 해당 이미지를 삽입한다
Then 시스템은 saveImageFromClipboard IPC를 호출한다 (file-save 라우팅)
And 시스템은 data URI를 생성하지 않는다
And ./images/ 상대경로 링크가 삽입된다

When 사용자가 드롭으로 해당 이미지를 삽입한다 (File.path 속성 있음)
Then 시스템은 copyImageToFolder IPC를 호출한다
And ./images/ 상대경로 링크가 삽입된다

When 사용자가 다이얼로그로 해당 이미지를 선택한다 (readFileSize가 임계값 이상 반환)
Then 시스템은 readFileSize IPC로 크기를 먼저 조회한다
And 시스템은 copyImageToFolder IPC를 호출한다
And ./images/ 상대경로 링크가 삽입된다
```

### AC-R-3: 3 진입점 대칭 (REQ-R-002)

```gherkin
Given 동일한 대형 이미지(크기 >= IMAGE_INLINE_THRESHOLD)와 동일한 imageInsertMode "inline-blob"
When 사용자가 붙여넣기 / 드롭 / 다이얼로그 세 경로로 각각 삽입한다
Then 세 경로 모두 file-save 라우팅을 수행한다
And 세 경로 모두 ./images/ 상대경로를 삽입한다
And 어느 경로도 data URI를 생성하지 않는다
```

### AC-R-4: per-path 크기 획득 및 조회 실패 폴백 (REQ-R-003, v1.1.0 BD-1)

```gherkin
Given 붙여넣기 / 드롭 경로에 DOM File 객체가 있다
When 시스텀이 이미지 크기를 조회한다
Then 시스템은 file.size 속성을 동기적으로 읽는다
And 시스템은 readFileSize IPC를 호출하지 않는다

Given 다이얼로그가 네이티브 경로만 반환했다
When 시스텀이 이미지 크기를 조회한다
Then 시스템은 readFileSize IPC를 호출한다

Given 다이얼로그 경로에서 readFileSize IPC가 실패(거부/에러)한다
And imageInsertMode가 "inline-blob"이다
When 시스텀이 폴백을 수행한다
Then 시스템은 inline-blob로 폴백하지 않는다 (BD-1)
And 시스템은 file-save 경로(copyImageToFolder)로 폴백한다
And 시스템은 readImageAsBase64를 호출하지 않는다

Given 다이얼로그 경로에서 readFileSize IPC가 실패한다
And currentFilePath가 null이다 (미저장 문서)
When 사용자가 Save-As 다이얼로그를 취소한다
Then 시스템은 삽입을 중단(no-op)한다
And 시스템은 inline-blob로 회귀하지 않는다
```

### AC-T-1: 임계값 상수 (REQ-T-001)

```gherkin
Given src/lib/preview/previewLimits.ts 파일
When 상수 정의를 확인한다
Then IMAGE_INLINE_THRESHOLD 명명 상수가 존재한다
And 그 값은 LINE_FOLD_THRESHOLD(1MB) 이상이다
And 그 값은 MAX_IMAGE_SIZE(10MB) 미만이다
And 그 값은 OD-1 합의값(권장 2MB)이다
```

### AC-U-1: 대형 이미지 + 미저장 → 지연 Save-As (REQ-U-001)

```gherkin
Given imageInsertMode가 "inline-blob"이다
And currentFilePath가 null이다 (미저장 문서)
And 이미지 파일 크기가 IMAGE_INLINE_THRESHOLD 이상이다
When 사용자가 붙여넣기로 해당 이미지를 삽입한다
Then 시스템은 클립보드 만료 전에 File 객체를 동기적으로 확보한다 (extractImageFile)
And 시스템은 saveFileAs 다이얼로그를 트리거한다
And 사용자가 저장하면 시스템은 확보된 File로 saveImageFromClipboard(savedPath, base64)를 호출한다
And ./images/ 상대경로 링크가 삽입된다

When 사용자가 다이얼로그로 해당 이미지를 선택한다
Then 시스템은 saveFileAs 다이얼로그를 트리거한다
And 사용자가 저장하면 시스템은 copyImageToFolder(selectedPath, savedPath)를 호출한다
```

### AC-U-2: 소형 이미지 + 미저장 + inline-blob → Group A 보존 (REQ-U-002, 회귀 가드)

```gherkin
Given imageInsertMode가 "inline-blob"이다
And currentFilePath가 null이다 (미저장 문서)
And 이미지 파일 크기가 IMAGE_INLINE_THRESHOLD 미만이다
When 사용자가 붙여넣기로 해당 이미지를 삽입한다
Then 시스템은 saveFileAs 다이얼로그를 표시하지 않는다
And 시스템은 data URI로 직접 임베드한다
And 시스템은 saveFileAs / saveFileAsIpc를 호출하지 않는다 (SPEC-IMG-LOAD-001 REQ-A-001 보존)

When 사용자가 다이얼로그로 해당 소형 이미지를 선택한다
Then 시스템은 saveFileAs를 표시하지 않는다
And 시스템은 readImageAsBase64로 data URI를 읽어 삽입한다
```

### AC-U-3: 저장된 문서 + 대형 이미지 → file-save, 무프롬프트 (REQ-U-003)

```gherkin
Given currentFilePath가 null이 아니다 (저장된 문서)
And 이미지 파일 크기가 IMAGE_INLINE_THRESHOLD 이상이다
When 사용자가 대형 이미지를 삽입한다 (모드 무관)
Then 시스템은 기존 filePath로 file-save 라우팅을 수행한다
And 시스템은 saveFileAs 다이얼로그를 표시하지 않는다 (SPEC-IMG-LOAD-001 REQ-A-003 보존)
```

### AC-N-1: 소형 이미지 기본 모드 inline-blob 보존 (REQ-N-001)

```gherkin
Given imageInsertMode가 기본값 "inline-blob"이다 (SPEC-IMG-MODE-001 REQ-1)
And 이미지 파일 크기가 IMAGE_INLINE_THRESHOLD 미만이다
When 사용자가 소형 이미지를 삽입한다
Then 시스템은 data URI로 임베드한다 (기본 모드 동작 보존)
And 본 SPEC은 기본 모드 값을 변경하지 않는다
```

### AC-N-2: MAX_IMAGE_SIZE 10MB 거부 정책 유지 (REQ-N-002)

```gherkin
Given 이미지 파일 크기가 MAX_IMAGE_SIZE(10MB)를 초과한다 (예: 15MB)
When 해당 이미지가 IMAGE_INLINE_THRESHOLD 초과로 file-save로 라우팅된다
Then copy_image_to_folder / save_image_from_clipboard Rust 명령이 기존 동작대로 거부 에러를 반환한다
And 시스템은 MAX_IMAGE_SIZE 정책을 변경하지 않는다
And IMAGE_INLINE_THRESHOLD < MAX_IMAGE_SIZE 제약(T-001)에 의해 임계값 역전 사각지대는 발생하지 않는다
```

### AC-E-1: >10MB 이미지 file-save 거부 시 사용자 가시 에러 (REQ-IMG-MODE-3-E-001, v1.1.0 BD-2)

```gherkin
Given 이미지 파일 크기가 MAX_IMAGE_SIZE(10MB)를 초과한다 (예: 12MB 스크린샷)
And imageInsertMode가 "inline-blob"이다
When 사용자가 해당 이미지를 붙여넣기 / 드롭 / 다이얼로그로 삽입한다
Then 시스템은 IMAGE_INLINE_THRESHOLD 초과로 file-save로 라우팅한다
And Rust copy_image_to_folder / save_image_from_clipboard가 거부 에러를 반환한다
And 시스템은 사용자 가시 에러(toast 또는 동등한 메시지 컴포넌트)를 표시한다
And 해당 메시지는 이미지가 크기 제한(10MB)을 초과했고 삽입되지 않았음을 명시한다
And 시스템은 silent no-op(사용자 인지 없는 삽입 스킵)을 수행하지 않는다
And 시스템은 inline-blob 폴백을 수행하지 않는다 (동결 재도입 방지 — BD-2 option b 명시적 거부)
```

## Edge Cases

| Edge Case | Expected Behavior | Test |
|---|---|---|
| 이미지 크기 == IMAGE_INLINE_THRESHOLD 정확히 (경계) | 대형으로 취급 — file-save 라우팅 (REQ-R-001 "이상") | UT-R-BOUNDARY |
| 이미지 크기 == IMAGE_INLINE_THRESHOLD − 1 (경계) | 소형으로 취급 — 사용자 모드 존중 | UT-R-BOUNDARY |
| 다중 드롭: 소형·대형 혼합 | 각 파일이 독립 라우팅 — 소형은 data URI, 대형은 file-save. 삽입 순서는 루프 순서 보존 | UT-R-001d 확장 |
| 다이얼로그 경로 `readFileSize` IPC 실패 | file-save 폴백 (BD-1). inline-blob로 회귀하지 않음. file-save 불가(미저장+Save-As 취소) 시 no-op | UT-R-003c (v1.1.0) |
| 대형 이미지 붙여넣기 + 미저장 + 사용자가 Save-As 취소 | no-op — 삽입 수행 안 함. 확보된 File 객체 폐기. inline-blob로 회귀하지 않음 (BD-1) | UT-U-001 변형 |
| 대형 이미지 + file-save 모드 + 미저장 | 기존 `decideImageInsert` 'require-file-path' 분기가 Save-As 수행 (`SPEC-IMG-MODE-002` 동작). 본 SPEC 지연 게이트와 동일 결과 | 기존 테스트 회귀 |
| 드롭 + 대형 + DOM 소스(File.path 없음) + 미저장 | `MarkdownEditor.tsx:277-290` Save-As 게이트 → `handleImageDrop` 진입 → file-save 라우팅 → `fileToBase64` + `saveImageFromClipboard(mdFilePath, base64)` | UT-R-001d 변형 |
| `IMAGE_INLINE_THRESHOLD` 값을 OD-1에서 1MB로 선택 | `LINE_FOLD_THRESHOLD`와 동일. 소형 이미지(정확히 1MB) 경계 단언이 조정 필요 | UT-R-BOUNDARY (파라미터화) |
| 대형 이미지 >10MB가 file-save로 라우팅 | Rust 10MB 검증에서 거부. 사용자 가시 에러(toast) 표시 — REQ-IMG-MODE-3-E-001 (v1.1.0 BD-2). inline-blob 폴백 없음 | UT-E-001, PT-E-001 (v1.1.0) |
| 매우 빠른 연속 대형 이미지 붙여넣기 (멀티 클립보드) | 첫 이미지 Save-As 확보 후 세션 재사용 여부는 OD-2(option 1). 본 SPEC 1차 구현은 이미지마다 게이트 | (수동 스모크 only) |

## Quality Gate Criteria

- **단위 테스트**: `npx vitest run` — 기존 전체 통과 + 신규 라우팅/임계값/지연-Save-As 테스트 통과. 기존 UT-7/8/11(`imageHandler.test.ts:276-318`)은 `readFileSize` 모킹 추가 후 회귀 없이 green 유지.
- **TypeScript**: `npx tsc --noEmit` — 0 에러.
- **ESLint**: `npx eslint src/lib/image/imageHandler.ts src/lib/preview/previewLimits.ts src/test/imageHandler.test.ts` — 0 에러, 0 경고.
- **커버리지**: `src/lib/image/imageHandler.ts` 85%+ 유지 (`quality.yaml` `test_coverage_target: 85`). 신규 `resolveImageRoute` helper 및 라우팅 분기 커버.
- **Playwright must-pass**: PT-MODE-003-001 (클립보드 대형 이미지 + 미저장 → Save-As 안전), PT-MODE-003-002 (드롭 대형 이미지 + 미저장 → 기존 게이트 동작), PT-E-001 (v1.1.0: >10MB 이미지 삽입 시도 → toast 가시성). 로컬 실행 필수 ([feedback-jsdom-pointer-blindspot]).
- **수동 스모크**: plan.md Milestone 6의 7개 시나리오 실기기 확인 (OD-2 플랫폼 합의 후).
- **회귀**: 클립보드 붙여넣기 소형 경로, 다이얼로그 소형 경로, 드롭 소형 경로 — 기존 단위 테스트 green 유지.

## Test Strategy Layer (정직한 범위 표시)

> [feedback-spec-verifiable-requirements] 패턴 3 반영 — 자동 검증 범위와 리뷰 범위를 분리하여 명시.

| 검증 항목 | 자동화된 단위 테스트 | Playwright | 코드 리뷰 (diff) | 수동 스모크 |
|---|---|---|---|---|
| REQ-R-001 (per-image 라우팅, 3 경로) | UT-R-001a~f | — | — | AC-R-1/R-2 |
| REQ-R-001 (임계값 경계 ±1) | UT-R-BOUNDARY | — | — | — |
| REQ-R-002 (3 진입점 대칭) | UT-R-002 | — | — | — |
| REQ-R-003a (DOM file.size) | UT-R-003a | — | — | — |
| REQ-R-003b (readFileSize IPC 성공) | UT-R-003b | — | — | — |
| REQ-R-003c (readFileSize 실패 → file-save 폴백, v1.1.0 BD-1) | UT-R-003c | — | — | — |
| REQ-T-001 (상수 존재·값·제약) | UT-T-001 | — | O (previewLimits.ts diff) | — |
| REQ-U-001 (대형+미저장→지연 Save-As) | UT-U-001 | PT-MODE-003-001 (클립보드 만료 안전) | — | AC-U-1 (실기기) |
| REQ-U-002 (소형+미저장+inline-blob→Group A) | UT-U-002 | — | — | — |
| REQ-U-003 (저장됨+대형→무프롬프트) | UT-U-003 | — | — | — |
| REQ-N-001 (기본 모드 inline-blob 소형 보존) | UT-N-001 | — | — | — |
| REQ-N-002 (MAX_IMAGE_SIZE 10MB 거부 유지) | UT-N-002 | — | O (image_ops.rs 무변경) | — |
| REQ-E-001 (>10MB 거부 시 toast, v1.1.0 BD-2) | UT-E-001 | PT-E-001 (toast 가시성) | — | AC-E-1 |
| Group A 게이트 무변경 (AppLayout:316-318, MarkdownEditor:174-177) | UT-U-002 (소형 경로로 회귀 가드) | — | O (AppLayout/MarkdownEditor diff) | — |
| drop Save-As 게이트 무변경 (MarkdownEditor:277-290) | — | — | O (diff) | — |
| Rust 무변경 (Non-Goal #10) | — | — | O (src-tauri/ diff) | — |
| store 무변경 (Non-Goal #7, uiStore) | — | — | O (uiStore.ts diff) | — |
| 토글 UI 무변경 (Non-Goal 암시) | — | — | O (ImageModeToggle.tsx diff) | — |
| 클립보드 만료 안전성 (REQ-U-001 부분) | — (jsdom blind) | PT-MODE-003-001 | — | — |
| 드롭 + 미저장 기존 게이트 | — | PT-MODE-003-002 | — | — |

**참고**: "Group A 게이트 무변경", "Rust 무변경", "store 무변경", "토글 UI 무변경"은 단위 테스트로 강제 불가한 git diff 속성이다 ([feedback-spec-verifiable-requirements] 패턴 2). 리뷰 단계에서 확인한다. REQ-U-002(소형 경로 Group A 보존)는 단위 테스트로 게이트 동작의 결과를 검증하나, 게이트 코드 자체의 무변경은 리뷰로 확인한다.

## Definition of Done

- [ ] **RED**: `readFileSize` 모킹이 `vi.mock('@/lib/tauri/ipc')`에 추가됨
- [ ] **RED**: UT-R-001b/d/f, UT-U-001, UT-R-BOUNDARY, UT-R-003c (v1.1.0 BD-1), UT-E-001 (v1.1.0 BD-2)가 실패 상태로 존재
- [ ] **RED**: 기존 UT-7/8/11이 `readFileSize` 소형 mock으로 여전히 green (회귀 가드 확인)
- [ ] **GREEN**: `IMAGE_INLINE_THRESHOLD` 상수가 `previewLimits.ts`에 추가됨 (OD-1 값 = 2MB, v1.1.0 확정)
- [ ] **GREEN**: `resolveImageRoute(params: { mode; sizeInBytes })` helper가 추가됨 (NI-1 시그니처)
- [ ] **GREEN**: `insertImageFile`(붙여넣기)에 per-image 라우팅 + 지연 Save-As 적용됨 (NI-4 base64-after-routing 순서 준수)
- [ ] **GREEN**: `insertImageFromDialog`(다이얼로그)에 per-image 라우팅 + `readFileSize` 조회 + 지연 Save-As + **BD-1 폴백(file-save, no-op)** + **NI-4 base64-after-routing** 적용됨
- [ ] **GREEN**: `handleImageDrop`(드롭)에 per-image 라우팅 적용됨 (지연 게이트 불필요)
- [ ] **GREEN**: >10MB 이미지 file-save 거부 시 toast/메시지 표시 로직 추가 (REQ-E-001, BD-2). silent no-op 없음. inline-blob 폴백 없음
- [ ] **REFACTOR**: 전체 `npx vitest run` 통과, `tsc --noEmit` 0 에러, ESLint 0 경고
- [ ] **커버리지**: `src/lib/image/imageHandler.ts` 85%+ 유지
- [ ] **Playwright must-pass**: PT-MODE-003-001 (클립보드 대형+미저장), PT-MODE-003-002 (드롭 대형+미저장), PT-E-001 (v1.1.0: >10MB toast 가시성) 로컬 통과
- [ ] **수동 스모크**: AC-R-1, AC-R-2, AC-R-4(BD-1 폴백 포함), AC-U-1, AC-U-2, AC-U-3, AC-E-1 시나리오 실기기 확인
- [ ] **무변경 항목 (리뷰)**: Group A 게이트, drop Save-As 게이트, Rust 코드, uiStore, ImageModeToggle — 코드 리뷰에서 확인
- [ ] **@MX 갱신**: `imageHandler.ts:3`, `imageHandler.test.ts:1`, `previewLimits.ts` 상단의 `@MX:SPEC` 주석에 `SPEC-IMG-MODE-003` 추가
- [ ] **Open Decisions (v1.1.0 종료)**: OD-1 (2MB 확정), OD-2 (option 1 조용히 확정), OD-3 (defer + 디버그 로깅 권장 확정) — 모두 v1.1.0에서 해결됨

## Traceability

| AC | REQ | UT / PT | Layer |
|----|-----|---------|-------|
| AC-R-1 | REQ-R-001 (소형) | UT-R-001a/c/e | Unit + Smoke (실기기) |
| AC-R-2 | REQ-R-001 (대형) | UT-R-001b/d/f | Unit + Smoke (실기기) |
| AC-R-3 | REQ-R-002 | UT-R-002 | Unit |
| AC-R-4 | REQ-R-003 | UT-R-003a/b, UT-R-003c (v1.1.0 BD-1) | Unit |
| AC-T-1 | REQ-T-001 | UT-T-001 | Unit + Review (diff) |
| AC-U-1 | REQ-U-001 | UT-U-001, PT-MODE-003-001 | Unit + Playwright + Smoke |
| AC-U-2 | REQ-U-002 | UT-U-002 | Unit |
| AC-U-3 | REQ-U-003 | UT-U-003 | Unit |
| AC-N-1 | REQ-N-001 | UT-N-001 | Unit |
| AC-N-2 | REQ-N-002 | UT-N-002 | Unit + Review (Rust diff) |
| AC-E-1 | REQ-IMG-MODE-3-E-001 (v1.1.0 BD-2) | UT-E-001, PT-E-001 | Unit + Playwright + Smoke |
