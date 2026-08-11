# Acceptance Criteria: SPEC-IMG-MODE-002

## Test Scenarios (Gherkin Given/When/Then)

### AC-1: 다이얼로그 + inline-blob (REQ-001)

```gherkin
Given imageInsertMode가 "inline-blob"이다
And 마크다운 파일이 저장되어 있다 (mdFilePath 존재)
When 사용자가 툴바 이미지 아이콘을 클릭하여 다이얼로그를 열고 타 폴더의 이미지를 선택한다
Then 시스템은 선택된 파일의 바이트를 base64로 읽는다 (readImageAsBase64 IPC 호출)
And 시스템은 ./images/ 폴더로의 복사를 수행하지 않는다 (copyImageToFolder 미호출)
And 에디터 커서 위치에 ![filename](data:image/png;base64,...) 가 삽입된다
And 프리뷰에서 이미지가 즉시 렌더링된다 (사용자 보고 버그 수정 확인)
```

### AC-2: 다이얼로그 + file-save (REQ-002)

```gherkin
Given imageInsertMode가 "file-save"이다
And 마크다운 파일이 저장되어 있다
When 사용자가 다이얼로그에서 이미지를 선택한다
Then 시스템은 copyImageToFolder IPC를 호출한다
And 마크다운 파일 기준 ./images/ 폴더에 파일이 복사된다
And 에디터에 ![filename](./images/photo.png) 가 삽입된다 (기존 동작 유지)
```

### AC-3: 드롭 + inline-blob + path 속성 (REQ-003)

```gherkin
Given imageInsertMode가 "inline-blob"이다
When 사용자가 외부 폴더의 이미지 파일을 에디터로 드래그-앤-드롭한다 (File.path 속성 있음)
Then 시스템은 드롭된 파일의 바이트를 base64로 읽는다 (readImageAsBase64 IPC 호출)
And 시스템은 ./images/ 폴더로의 복사를 수행하지 않는다 (copyImageToFolder 미호출)
And 드롭 위치에 ![photo](data:image/png;base64,...) 가 삽입된다
And 다중 파일 드롭 시 각 파일에 동일한 inline-blob 분기가 적용된다
```

### AC-4: 드롭 + file-save + path 속성 (REQ-004)

```gherkin
Given imageInsertMode가 "file-save"이다
When 사용자가 이미지 파일을 드롭한다 (File.path 속성 있음)
Then 시스템은 copyImageToFolder IPC를 호출한다 (기존 동작)
And ./images/ 상대경로 마크다운 링크가 삽입된다
```

### AC-5: 다이얼로그 취소 (REQ-005)

```gherkin
Given 사용자가 이미지 다이얼로그를 열었다
When 사용자가 취소(Cancel) 버튼을 누르거나 Esc를 눌러 다이얼로그를 닫는다 (openImageDialog가 null 반환)
Then 시스템은 어떤 마크다운도 삽입하지 않는다 (EditorView.dispatch 미호출)
And 어떤 Tauri IPC 도 호출하지 않는다 (readImageAsBase64, copyImageToFolder 모두 미호출)
```

### AC-6: 드롭 DOM 폴백 + inline-blob (REQ-006)

```gherkin
Given imageInsertMode가 "inline-blob"이다
When 브라우저/DOM 소스 (예: 다른 웹페이지에서 드래그) 에서 이미지가 드롭되어 File 객체는 있으나 path 속성이 없다
Then 시스템은 File 객체에서 fileToBase64를 호출한다
And 시스템은 saveImageFromClipboard를 호출하지 않는다 (기존 폴백과 다름 — 본 SPEC이 변경)
And ![image](data:image/png;base64,...) 가 삽입된다
```

## Edge Cases

| Edge Case | Expected Behavior | Test |
|---|---|---|
| 다중 이미지 드롭, inline-blob 모드 | 각 파일이 data URI로 임베드됨. 총 .md 파일 크기가 커질 수 있음 (사용자 책임 — Non-Goal #2) | UT-9 확장 |
| 다중 이미지 드롭, file-save 모드 | 각 파일이 ./images/로 복사됨 (기존 동작) | UT-10 |
| inline-blob 모드에서 매우 큰 이미지 (예: 50MB) | data URI로 임베드됨. 성능 경고 없음 (Non-Goal #2) | (명시적 단위 테스트 없음 — 리스크 표로만 기록) |
| `readImageAsBase64` IPC가 거부하는 경우 (path 검증 실패) | no-op (OD-2에서 사용자 합의 필요). 콘솔 로그 | (수동 스모크 only) |
| 사용자가 모드를 변경한 직후 바로 이미지 삽입 | 새 모드가 즉시 적용됨 (zustand 동기 리딩) | UT-7~10 |
| 미저장 파일에서 다이얼로그 호출 | 호출부 (AppLayout/MarkdownEditor) 가 이미 Save As를 트리거함 — 본 SPEC과 무관 | (기존 동작 유지) |
| 다이얼로그에서 비이미지 파일 선택 | `openImageDialog`가 이미지 필터를 사용하므로 발생 가능성 낮음 — 본 SPEC 범위 밖 | (해당 없음) |
| 드롭된 파일에 `path` 속성이 빈 문자열인 경우 | `path` 없음으로 취급하여 DOM 폴백 분기 적용 | UT-12 변형 |

## Quality Gate Criteria

- **단위 테스트**: `npx vitest run` — 기존 전체 통과 + 신규 6개 (UT-7~12) 통과. 기존 UT-6 블록 (3개 `it`) 은 삭제됨. 결과적으로 테스트 총수는 +3 증가
- **TypeScript**: `npx tsc --noEmit` — 0 에러
- **ESLint**: `npx eslint src/lib/image/imageHandler.ts src/test/imageHandler.test.ts` — 0 에러, 0 경고
- **커버리지**: `src/lib/image/imageHandler.ts` 85%+ 유지 (quality.yaml `test_coverage_target: 85`). `insertImageFromDialog` 분기가 새로 커버되어 커버리지는 상승할 것으로 예상
- **수동 스모크**: AC-1, AC-3 시나리오는 반드시 실기기에서 확인 (OD-1 플랫폼 합의 후)
- **회귀**: 클립보드 붙여넣기 경로 (`insertImageFile`) 기존 테스트 UT-2, UT-3 통과 유지

## Test Strategy Layer (정직한 범위 표시)

> [feedback-spec-verifiable-requirements] 패턴 3 반영 — 자동 검증 범위와 리뷰 범위를 분리하여 명시.

| 검증 항목 | 자동화된 단위 테스트 | 코드 리뷰 (diff) | 수동 스모크 |
|---|---|---|---|
| REQ-001 (다이얼로그 inline-blob) | UT-7 | — | AC-1 (실기기) |
| REQ-002 (다이얼로그 file-save) | UT-8 | — | — |
| REQ-003 (드롭 inline-blob + path) | UT-9 | — | AC-3 (실기기) |
| REQ-004 (드롭 file-save + path) | UT-10 | — | — |
| REQ-005 (다이얼로그 취소) | UT-11 | — | — |
| REQ-006 (드롭 DOM 폴백 + inline-blob) | UT-12 | — | — |
| 토글 UI 유지 (Non-Goal #1) | — | O (`ImageModeToggle.tsx` 무변경) | — |
| `html: false` 무변경 (Non-Goal #3) | — | O (`renderer.ts` 무변경) | — |
| 클립보드 경로 무변경 (Non-Goal #4) | 기존 UT-2, UT-3 | — | — |
| 신규 IPC·Rust 명령 없음 (Non-Goal #5) | — | O (`src-tauri/` 무변경) | — |
| 호출부 무변경 (Non-Goal #6) | — | O (`AppLayout.tsx`, `MarkdownEditor.tsx` 무변경) | — |

**참고**: "토글 UI 유지", "`html: false` 무변경", "신규 IPC 없음", "호출부 무변경" 은 단위 테스트로 강제 불가한 git diff 속성이다. 이들을 단위 테스트로 단언하면 baseline hash가 없는 vitest에서 아무것도 증명하지 못한다 ([feedback-spec-verifiable-requirements] 패턴 2). 리뷰 단계에서 확인한다.

## Definition of Done

- [ ] **RED**: 기존 UT-6 (`imageHandler.test.ts:158-217` "drop always file-save") 블록 삭제 + 신규 UT-7~12가 실패 상태로 존재
- [ ] **RED**: `vi.mock('@/lib/tauri/ipc')` 에 `readImageAsBase64` 모킹 추가
- [ ] **GREEN**: `insertImageFromDialog`가 모드 분기 (REQ-001/002/005) 구현
- [ ] **GREEN**: `handleImageDrop`가 모드 분기 (REQ-003/004/006) 구현
- [ ] **REFACTOR**: 전체 `npx vitest run` 통과, `tsc --noEmit` 0 에러, ESLint 0 경고
- [ ] **수동 스모크**: AC-1 (사용자 보고 버그) 재현 후 수정 확인. AC-3 드롭 경로 확인
- [ ] **무변경 항목 (리뷰)**: 토글 UI, 클립보드 경로, 렌더러, Rust, 호출부 — 코드 리뷰에서 확인
- [ ] **@MX 갱신**: `imageHandler.ts:3` 및 `imageHandler.test.ts:1` 의 `@MX:SPEC` 주석에 `SPEC-IMG-MODE-002` 추가
- [ ] **@MX 유지**: `ImageModeToggle.tsx:2` 의 `@MX:SPEC: SPEC-IMG-MODE-001` 주석 유지 (토글 자체는 MODE-001 산물)
- [ ] **Open Decisions**: OD-1, OD-2, OD-3이 run phase 개시 전 사용자에 의해 명시적으로 해결됨

## Traceability

| AC | REQ | UT | Layer |
|----|-----|----|----|
| AC-1 | REQ-001 | UT-7 | Unit + Smoke (실기기) |
| AC-2 | REQ-002 | UT-8 | Unit |
| AC-3 | REQ-003 | UT-9 | Unit + Smoke (실기기) |
| AC-4 | REQ-004 | UT-10 | Unit |
| AC-5 | REQ-005 | UT-11 | Unit |
| AC-6 | REQ-006 | UT-12 | Unit |
