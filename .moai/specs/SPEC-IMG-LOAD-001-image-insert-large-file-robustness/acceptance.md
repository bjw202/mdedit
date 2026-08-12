# Acceptance Criteria: SPEC-IMG-LOAD-001

> **v1.1.0 (2026-08-12)**: Group C 테스트(AC-C1~C5, UT-C*, PT-C*, CT-C1) 제거. D1 회귀 가드 AC-B5 추가. Windows 원자 쓰기 검증을 수동 스모크로 한정. Group C 시나리오는 후속 `SPEC-IMG-LOAD-002`에서 별도 인수 기준을 마련할 예정.

## Test Scenarios (Gherkin Given/When/Then)

### Group A — 이미지 삽입 다이얼로그 순서

#### AC-A1: inline-blob + 미저장 문서 — Save-As 스킵 (REQ-A-001)

```gherkin
Given imageInsertMode가 "inline-blob"이다
And currentFilePath가 null이다 (미저장 문서)
When 사용자가 툴바 이미지 버튼을 클릭한다
Then 시스템은 saveFileAs 또는 saveFileAsIpc IPC를 호출하지 않는다
And 시스템은 insertImageFromDialog(view, '')을 호출한다
And Save-As 다이얼로그는 화면에 나타나지 않는다
And 이미지 피커 다이얼로그가 직접 열린다
```

**자동화**: UT-A1 (단위 — `saveFileAsIpc` 미호출 단언) + PT-A1 (Playwright — Save-As 다이얼로그 미표출 단언)

#### AC-A2: file-save + 미저장 문서 — 기존 Save-As 게이트 유지 (REQ-A-002)

```gherkin
Given imageInsertMode가 "file-save"이다
And currentFilePath가 null이다
When 사용자가 툴바 이미지 버튼을 클릭한다
Then 시스템은 기존 동작을 유지한다 — saveFileAsIpc를 먼저 호출하여 Save-As 다이얼로그를 표시한다
And 사용자가 저장을 완료하면 insertImageFromDialog(view, savedPath)가 호출된다
And 사용자가 Save-As를 취소하면 insertImageFromDialog는 호출되지 않는다 (기존 동작)
```

**자동화**: UT-A2 (단위 — `file-save` 분기에서 `saveFileAsIpc` 호출 단언)

#### AC-A3: 이미 저장된 문서 — 모드 무관 기존 동작 (REQ-A-003)

```gherkin
Given currentFilePath가 "/path/to/saved.md"이다 (이미 저장됨)
When 사용자가 이미지 삽입 진입점을 호출한다 (어느 모드에서든)
Then 시스템은 saveFileAs/saveFileAsIpc를 호출하지 않는다
And 시스템은 insertImageFromDialog(view, "/path/to/saved.md")를 직접 호출한다 (기존 동작)
```

**자동화**: UT-A3 (단위 — 저장된 경로에서 두 모드 모두 직접 호출 단언)

#### AC-A4: 두 진입점 대칭 (REQ-A-004)

```gherkin
Given 두 진입점(툴바 버튼, Cmd+Shift+I)이 동일한 imageInsertMode와 currentFilePath 상태를 관찰한다
When 각 진입점을 동일 상태로 호출한다
Then 두 진입점 모두 동일한 분기를 수행한다 — inline-blob + null에서는 둘 다 Save-As를 스킵하고, file-save + null에서는 둘 다 Save-As를 호출한다
```

**자동화**: UT-A4 (단위 — 두 진입점의 분기를 각각 호출하여 동일 단언). "동일 helper 호출"은 코드 리뷰 범위 (Test Strategy Layer).

### Group B — 안전망

#### AC-B1: 대용량 `.md` 라우팅 (REQ-B-001)

```gherkin
Given previewStatus가 "too-large"이다
And 현재 파일 경로가 "doc.md"이다
When PreviewContainer가 getFileViewType을 호출한다
Then 반환값은 "unsupported"이다
And UnsupportedFileViewer가 렌더링된다
And 빈 MarkdownPreview + 빈 CodeMirror 에디터는 렌더링되지 않는다 (회귀 버그 수정)
```

**자동화**: UT-B1 (단위 — `getFileViewType('doc.md', 'too-large')` === `'unsupported'`)

#### AC-B2: 원자적 파일 쓰기 (REQ-B-002)

```gherkin
Given 파일 "/path/to/existing.md"에 "old content"가 있다
When write_file("/path/to/existing.md", "new content") 호출 도중 프로세스가 강제 종료된다 (시그널 또는 early return으로 시뮬레이션)
Then 원본 파일 "/path/to/existing.md"은 "old content" 그대로 유지된다 또는 "new content"로 완전히 교체된다
And 파일이 잘린 일부 내용("new co")으로 손상되지 않는다
And 임시 파일(path.mdedit-tmp-*)은 잔존할 수 있으나 원본을 오염시키지 않는다
```

**자동화**: CT-B2 (cargo test — POSIX 임시 파일 생성 후 의도적 중단, 원본 무결성 단언). **Windows 변형**: 자동화 CI 범위 밖 — 수동 스모크로만 검증 ( Milestone 2 체크리스트).

#### AC-B3: 워쳐 reload 크기 가드 (REQ-B-003)

```gherkin
Given currentFilePath가 "/path/to/large.md"이다 (6MB — FILE_SIZE_THRESHOLD 초과)
And 파일 워쳐가 Modified 이벤트를 수신했다
And dirty === false이다 (자동 reload 조건)
When 워쳐 reload가 실행된다
Then 시스템은 openFile 경로(또는 동일 크기 가드)를 경유한다
And 시스템은 readFile을 크기 가드 없이 직접 호출하지 않는다
And 파일이 FILE_SIZE_THRESHOLD를 초과하면 previewStatus='too-large'로 라우팅된다
```

**자동화**: UT-B3 (단위 — 워쳐 콜백이 `openFile`을 호출함을 단언, `readFile` 직접 호출 배제)

#### AC-B4: 접힌 폴더 내 파일 가드 (REQ-B-004)

```gherkin
Given fileStore.fileTree에서 폴더 "subdir/"이 접혀있다 (children === null)
And "subdir/large.md" 파일이 10MB이다 (FILE_SIZE_THRESHOLD 초과 — CodeMirror 동결을 유발하는 크기)
When 사용자가 탐색기에서 "subdir/large.md"를 클릭한다
Then 시스템은 findFileNodeSize가 undefined를 반환하더라도 무조건 전체 로드하지 않는다
And readFileSize IPC로 파일 크기를 사전 조회한다 (D3 — Group B IPC)
And previewStatus='too-large'로 라우팅되어 UnsupportedFileViewer가 렌더링된다
And UI가 동결되지 않는다
```

**자동화**: UT-B4 (단위 — `findFileNodeSize` undefined 케이스에서 `readFileSize` 사전 호출 단언 + 펼쳐진 폴더에서는 `readFileSize` 미호출 단언 / N6 fast path 회귀 가드) + PT-B4 (Playwright — 접힌 폴더 내 대용량 파일 오픈 시 main thread 응답성 유지 단언, 5초 이내 첫 paint)

#### AC-B5: too-large 비-`.md` 파일 라우팅 무변경 (D1 회귀 가드)

```gherkin
Given previewStatus가 "too-large"이다
And 현재 파일 경로가 "image.png"이다
When PreviewContainer가 getFileViewType을 호출한다
Then 반환값은 현행 구현과 동일하다 (예: "raster-image" — SPEC-PREVIEW-008 라우팅 보존)
And 반환값이 "unsupported"로 변경되지 않는다
```

변형(동일 단언 구조): "page.html" → "html" 유지; "data.json" → 현행 JSON 뷰어 라우팅 유지; "logo.svg" → "svg" 유지.

**자동화**: UT-B5 (단위 — D1 패치가 비-`.md` 확장자의 too-large 라우팅을 변경하지 않았음을 단언). 이 테스트는 종전 v1.0.0 의사코드의 D1 결함(모든 확장자를 unsupported로 재라우팅)이 재도입될 경우 즉시 검거한다.

## Edge Cases

| Edge Case | Expected Behavior | Test |
|---|---|---|
| `inline-blob` + 미저장 + 다이얼로그 취소 | `insertImageFromDialog` 내부에서 `openImageDialog`가 null 반환 → no-op (기존 `imageHandler.ts:222` early return 유지) | UT-A1 확장 |
| `file-save` + 미저장 + Save-As 취소 | `saveFileAsIpc`가 null 반환 → `insertImageFromDialog` 미호출 (기존 동작) | UT-A2 확장 |
| 모드 전환 직후 이미지 삽입 | `useUIStore.getState()` 동기 리딩으로 즉시 새 모드 적용 | UT-A4 확장 |
| 빈 문서에서 `inline-blob` 이미지 삽입 후 저장 | 사용자가 명시적 Save를 수행하면 그 시점에 `mdFilePath`가 확정됨. 이미 삽입된 data URI는 영향 없음 | 수동 스모크 |
| 4.99MB `.md` 파일 | 소형 파일 경로(단일 `read_file`)로 처리. 회귀 없음 | UT-B1 확장 |
| 5.01MB `.md` 파일 | `FILE_SIZE_THRESHOLD` 초과 → `too-large` → `UnsupportedFileViewer` (Group B 라우팅) | UT-B1 |
| 접힌 폴더 내 5.01MB `.md` 파일 | `findFileNodeSize` undefined → `readFileSize` 사전 호출 → 임계값 초과 감지 → `too-large` 라우팅 (UI 동결 없음) | UT-B4 + PT-B4 |
| 펼쳐진 폴더 내 5.01MB `.md` 파일 | `findFileNodeSize`가 size 반환 → `readFileSize` IPC 없이 기존 fast path로 임계값 적용 (N6) | UT-B4 |
| 5.01MB `.png` / `.html` / `.svg` 파일 | 비-`.md` 확장자 → 현행 라우팅 유지 (D1 fix로 `too-large` 재배치 영향 안 받음) | UT-B5 |
| 워쳐 reload 중 파일이 삭제됨 | `openFile` 경유 시 기존 예외 처리 흡수 (useFileSystem try/catch) | UT-B3 확장 |
| 원자 쓰기 중 디스크 가득 참 | 임시 파일 작성 실패 → 원본 유지, 에러 반환 | CT-B2 확장 |
| Windows에서 대상 파일이 열려 있음 | `ReplaceFile` 실패 처리. 에러 메시지로 사용자 안내 | 수동 스모크 (Windows — 자동화 CI 범위 밖) |

> **Group C 이관 항목**: 50MB/200MB 초과 파일, UTF-8 chunk 경계, CodeMirror 점진적 dispatch, Worker spawn 실패 등의 엣지 케이스는 후속 `SPEC-IMG-LOAD-002`의 인수 기준에서 다룬다. 본 SPEC v1.1.0은 `FILE_SIZE_THRESHOLD=5MB`를 그대로 두어 5MB 초과 파일은 모두 `UnsupportedFileViewer`로 라우팅된다.

## Quality Gate Criteria

- **단위 테스트**: `npx vitest run` — UT-A1~A4, UT-B1, UT-B3, UT-B4, UT-B5 신규 통과 + 기존 전체 green 유지 (N5 조사 결과 삭제 대상 0건)
- **Rust 테스트**: `cargo test` — CT-B2(POSIX atomic write) 신규 통과 + 기존 `file_ops`/`image_ops`/`directory_ops` green 유지
- **Playwright**: `npx playwright test` — PT-A1, PT-B4 must-pass. 포인터·다이얼로그 UX는 jsdom에 잡히지 않으므로 Playwright를 게이트로 ([feedback-jsdom-pointer-blindspot])
- **TypeScript**: `npx tsc --noEmit` — 0 에러
- **ESLint**: `npx eslint` 수정 파일 전부 — 0 에러, 0 경고
- **커버리지**: 수정된 프런트엔드 파일 85%+ 유지 (`quality.yaml test_coverage_target: 85`). Rust 파일 커버리지는 기존 기준 유지
- **회귀**: `SPEC-IMG-MODE-002`(이미지 핸들러 모드 분기 — N5로 확인된 정합 테스트), `SPEC-PREVIEW-007`(too-large 라우팅 — `too-large` 순서 변경은 `.md` 한정), `SPEC-PREVIEW-008`(래스터/SVG 확장자 분기 — UT-B5가 회귀 가드), `SPEC-FS-001`(`read_file`/`write_file` 기본 동작 — 소형 파일 경로 유지), `SPEC-FS-003`(와쳐 충돌 모달) 테스트 green 유지
- **수동 스모크**: AC-A1, AC-B2(Windows 원자 쓰기 — 자동화 CI 범위 밖), AC-B4는 반드시 실기기 확인

## Test Strategy Layer (정직한 범위 표시)

> [feedback-spec-verifiable-requirements] 패턴 3 반영 — 자동 검증 범위와 리뷰 범위를 분리하여 명시.

| 검증 항목 | 자동화된 단위/통합 테스트 | Playwright (E2E) | 코드 리뷰 (diff) | 수동 스모크 |
|---|---|---|---|---|
| REQ-A-001 (inline-blob Save-As 스킵) | UT-A1 | PT-A1 | — | AC-A1 (실기기) |
| REQ-A-002 (file-save 게이트 유지) | UT-A2 | — | — | — |
| REQ-A-003 (저장된 문서 기존 동작) | UT-A3 | — | — | — |
| REQ-A-004 (두 진입점 대칭) | UT-A4 (행동 수준) | — | "동일 helper 호출" | — |
| REQ-B-001 (too-large `.md` 라우팅 순서) | UT-B1 | — | — | — |
| REQ-B-002 (원자 쓰기 — POSIX) | CT-B2 (cargo) | — | — | — |
| REQ-B-002 (원자 쓰기 — Windows) | — | — | — | AC-B2 (Windows 실기기) |
| REQ-B-003 (와쳐 reload 가드) | UT-B3 | — | — | — |
| REQ-B-004 (접힌 폴더 보호 + N6 fast path) | UT-B4 | PT-B4 | — | — |
| D1 회귀 가드 (비-`.md` too-large 라우팅 무변경) | UT-B5 | — | — | — |
| `imageInsertMode` 기본값 유지 (Non-Goal #2) | — | — | O (`uiStore.ts:116` 무변경) | — |
| `MAX_IMAGE_SIZE` 적용 범위 유지 (Non-Goal #1) | — | — | O (`image_ops.rs` 무변경) | — |
| `insertImageFromDialog` 시그니처 유지 | — | — | O (`imageHandler.ts` 무변경) | — |
| `FILE_SIZE_THRESHOLD=5MB` 무변경 | 기존 SPEC-PREVIEW-007 테스트 | — | — | — |
| 래스터/SVG/html/code 확장자 분기 순서 유지 (`SPEC-PREVIEW-008`) | UT-B5 + 기존 테스트 | — | — | — |
| `SPEC-IMG-MODE-002` 모드 분기 회귀 | 기존 UT-7/8/11 + imagePasteGuard.test.tsx | — | — | — |

**참고**: "기본값 유지", "시그니처 유지", "무변경" 항목은 단위 테스트로 강제 불가한 git diff 속성이다. 이들을 단위 테스트로 단언하면 baseline hash가 없는 vitest에서 아무것도 증명하지 못한다 ([feedback-spec-verifiable-requirements] 패턴 2). 리뷰 단계에서 확인한다.

## Definition of Done

- [ ] **RED (Group A)**: UT-A1~A4 신규 추가, 현재 구현에서 실패 확인
- [ ] **N5 점검 (Group A 사전)**: `src/test/imageHandler.test.ts:261-319` 및 `src/test/imagePasteGuard.test.tsx` 충돌 점검 — 삭제 대상 0건 확인 (plan.md Milestone 1 체크리스트)
- [ ] **GREEN (Group A)**: `AppLayout.tsx`, `MarkdownEditor.tsx` 모드 인지 분기 구현, UT-A1~A4 통과
- [ ] **Playwright (Group A)**: PT-A1 — `inline-blob` + 미저장에서 Save-As 미표출 단언 통과
- [ ] **RED (Group B)**: UT-B1, UT-B5, CT-B2, UT-B3, UT-B4 신규 추가, 실패 확인
- [ ] **GREEN (Group B)**: `PreviewContainer.tsx` 라우팅 순서(D1 fix — `.md` 한정), `file_ops.rs` 원자 쓰기 + `read_file_size` 신규 IPC, `ipc.ts` readFileSize 래퍼, `App.tsx` 와쳐 가드, `useFileSystem.ts` 사전 크기 조회(N6 fast path 포함) 구현, UT/CT 통과
- [ ] **Playwright (Group B)**: PT-B4 — 접힌 폴더 내 대용량 파일 오픈 시 UI 동결 없음 단언 통과
- [ ] **REFACTOR**: 전체 `npx vitest run`, `cargo test`, `npx tsc --noEmit`, `npx eslint`, `npx playwright test` 통과
- [ ] **수동 스모크**: AC-A1, AC-B2(Windows), AC-B4 실기기 확인
- [ ] **회귀**: `SPEC-IMG-MODE-002`, `SPEC-PREVIEW-007`, `SPEC-PREVIEW-008`, `SPEC-FS-001`, `SPEC-FS-003` 기존 테스트 green 유지
- [ ] **@MX 갱신**: 수정된 파일 `AppLayout.tsx`, `MarkdownEditor.tsx`, `PreviewContainer.tsx`, `App.tsx`, `useFileSystem.ts`, `file_ops.rs`, `ipc.ts`의 `@MX:SPEC` 주석에 `SPEC-IMG-LOAD-001` 추가
- [ ] **@MX 유지**: `imageHandler.ts`, `image_ops.rs`, `directory_ops.rs`, `renderer.ts`, `MarkdownEditor.tsx:103-113`(content dispatch 블록), `previewLimits.ts`의 기존 `@MX:SPEC` 주석은 유지 (해당 파일은 본 SPEC에서 무변경 또는 최소 변경)
- [ ] **Open Decisions**: OD-2(FILE_SIZE_THRESHOLD — 본 SPEC은 no-op), OD-5(reload 헬퍼)가 run phase 개시 전 사용자에 의해 명시적으로 해결됨
- [ ] **Follow-up 등록**: `SPEC-IMG-LOAD-002`(계획)를 본 SPEC frontmatter `follow_ups`에 명시했음을 확인 — 후속 SPEC이 Group C + CodeMirror 뷰포트 렌더링 + D4 잔여(malformed UTF-8 처리)를 다룰 예정

## Traceability

| AC | REQ | UT/CT | Playwright | Layer |
|----|-----|----|----|----|
| AC-A1 | REQ-A-001 | UT-A1 | PT-A1 | Unit + Playwright must-pass |
| AC-A2 | REQ-A-002 | UT-A2 | — | Unit |
| AC-A3 | REQ-A-003 | UT-A3 | — | Unit |
| AC-A4 | REQ-A-004 | UT-A4 | — | Unit + Review (helper) |
| AC-B1 | REQ-B-001 | UT-B1 | — | Unit |
| AC-B2 | REQ-B-002 | CT-B2 | — | cargo test (POSIX) + Smoke (Windows) |
| AC-B3 | REQ-B-003 | UT-B3 | — | Unit |
| AC-B4 | REQ-B-004 | UT-B4 | PT-B4 | Unit + Playwright must-pass |
| AC-B5 | (D1 회귀 가드) | UT-B5 | — | Unit |
