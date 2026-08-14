# Implementation Plan: SPEC-IMG-MODE-003

## Technical Approach

**근본 원인 루트**: Web Worker 파싱 이관(과거 계획 방향) 대신, 삽입 시점 per-image 크기 임계값으로 대형 이미지를 file-save로 자동 라우팅하여 `.md` 파일이 가벼운 상태로 유지되도록 원천 차단. 거대 base64 단일 라인이 생성되지 않으면 CodeMirror Lezer(편집기)와 markdown-it 이중 파싱(프리뷰, `renderer.ts:208-209 + :428`)의 동결 자체가 발생하지 않는다.

**최소 변경 원칙**: 신규 IPC·신규 Rust 명령·신규 상태 필드 불필요. `readFileSize` IPC(`SPEC-IMG-LOAD-001` Group B 산물)를 다이얼로그 경로의 두 번째 consumer로 재사용. 상수 1개(`IMAGE_INLINE_THRESHOLD`) 추가, helper 1개(`resolveImageRoute`) 도입, 3개 핸들러에 라우팅 적용.

**대칭적 라우팅**: 세 진입점(붙여넣기/다이얼로그/드롭)이 동일한 `resolveImageRoute` helper를 호출한다 (`SPEC-IMG-LOAD-001` REQ-IMG-LOAD-A-004 대칭 원칙과 동일). 현재 모드 분기가 3개 핸들러에 중복되어 있는 것을 단일 결정점으로 통합.

**지연 Save-As (option 2)**: Save-As 결정을 핸들러 내부로 이동. 소형 이미지에 대해서는 0.15.0 Group A 게이트(`AppLayout.tsx:316-318`, `MarkdownEditor.tsx:174-177`)를 무변경으로 두어 zero regression. 대형 이미지 + 미저장 시에만 핸들러가 Save-As를 트리거.

## Reproduction-First Test Strategy (TDD RED)

**[HARD] run-phase 첫 단계는 사용자 보고 증상을 재현하는 실패 테스트 작성.** CLAUDE.md Section 7 Rule 4 (Reproduction-First Bug Fixing) 준수.

**재생산 시나리오** (`src/test/imageHandler.test.ts`에 신규 추가, 현재 `vi.hoisted` 모킹 패턴 재사용):

1. UT-R-001b 신규 추가: 붙여넣기 + inline-blob + 대형 이미지(`file.size >= IMAGE_INLINE_THRESHOLD`) → `saveImageFromClipboard` 호출 단언, data URI 삽입 미발생 단언 → **현재 코드에서는 실패** (크기 무관 항상 inline-blob).
2. UT-R-001d 신규 추가: 드롭 + inline-blob + 대형 이미지 → `copyImageToFolder` 호출 단언 → **현재 코드에서는 실패**.
3. UT-R-001f 신규 추가: 다이얼로그 + inline-blob + 대형 이미지(`readFileSize` mock이 임계값 이상 반환) → `copyImageToFolder` 호출 단언 → **현재 코드에서는 실패**.
4. UT-U-001 신규 추가: 붙여넣기 + inline-blob + 대형 + 미저장(`mdFilePath=''`) → `saveFileAs` 1회 호출 단언 → **현재 코드에서는 실패** (Save-As 스킵 후 빈 경로로 진행).
5. UT-R-BOUNDARY 신규 추가: 임계값 `-1`/`0`/`+1` byte 이미지로 라우팅 경계 단언 → **현재 코드에서는 실패** (임계값 분기 자체 없음).

**기존 테스트 인프라 확장**:

- `vi.mock('@/lib/tauri/ipc')`(`imageHandler.test.ts:30` 부근)에 `readFileSize` 모킹 추가 (현재 누락 — 다이얼로그 경로가 크기 조회를 안 했으므로).
- 기존 UT-7/8/11(`:276-318` — 소형 이미지 기반 다이얼로그 모드 분기)은 회귀 가드로 유지. 다만 `readFileSize` mock이 소형 값을 반환하도록 설정하여 기존 단언이 green으로 유지됨을 확인.

**RED 완료 기준**:
- 신규 테스트(UT-R-001b/d/f, UT-U-001, UT-R-BOUNDARY 최소 1세트)가 모두 실패 상태로 존재.
- ipc.ts 모킹에 `readFileSize` 가 추가됨.
- 기존 UT-7/8/11이 여전히 green (소형 mock 값으로 회귀 없음 확인).

## Milestones

> 시간 추정은 사용하지 않는다 ([HARD] coding-standards.md). 우선순위 라벨과 위상 순서로만 표시.

### Milestone 1: 테스트 인프라 확장 + 재생산 테스트 (RED)

**Priority: High**

- `src/test/imageHandler.test.ts`의 `vi.mock('@/lib/tauri/ipc')` 블록에 `readFileSize` 모킹 추가 (기본값: 소형 크기 = `IMAGE_INLINE_THRESHOLD - 1`).
- 기존 UT-7/8/11(`:276-318`)이 새 모킹 환경에서 여전히 green임을 확인 (회귀 가드).
- 신규 테스트 블록 추가 (모두 현재 구현에서 실패해야 함):
  - UT-R-001a: 붙여넣기 + 소형 + inline-blob → data URI (회귀 가드 — MODE-002 동작 보존)
  - UT-R-001b: 붙여넣기 + 대형 + inline-blob → `saveImageFromClipboard` 호출, data URI 아님
  - UT-R-001c: 드롭 + 소형 + inline-blob → data URI (회귀 가드)
  - UT-R-001d: 드롭 + 대형 + inline-blob → `copyImageToFolder` 호출
  - UT-R-001e: 다이얼로그 + 소형 + inline-blob → data URI (회귀 가드 — UT-7 확장)
  - UT-R-001f: 다이얼로그 + 대형 + inline-blob → `copyImageToFolder` 호출
  - UT-R-002: 3 진입점이 동일한 라우팅 결정을 내림을 단언 (대형 이미지로 3경로 모두 file-save)
  - UT-R-003a: 붙여넣기/드롭은 `file.size`를 읽고 `readFileSize`를 호출하지 않음
  - UT-R-003b: 다이얼로그는 `readFileSize`를 호출함 (성공 시 크기 기반 라우팅)
  - UT-R-003c (v1.1.0, BD-1): 다이얼로그 + `readFileSize` IPC 거부 + 대형 fixture + inline-blob 모드 → 시스템은 `copyImageToFolder`로 라우팅 (또는 미저장+Save-As 취소 시 no-op). **`readImageAsBase64` 호출 미발생**을 단언 — inline-blob 폴백 금지
  - UT-R-BOUNDARY: 임계값 `−1`/`0`/`+1` byte × 3 경로 (최소 9개 단언)
  - UT-T-001: `IMAGE_INLINE_THRESHOLD` 상수가 존재, 값이 `< MAX_IMAGE_SIZE`(10MB)임을 단언. `>= LINE_FOLD_THRESHOLD`(1MB)임을 단언
  - UT-U-001: 붙여넣기/다이얼로그 + 대형 + inline-blob + 미저장 → `saveFileAs` 1회 호출 후 file-save
  - UT-U-002: 붙여넣기/다이얼로그 + 소형 + inline-blob + 미저장 → `saveFileAs` 미호출 (Group A 보존)
  - UT-U-003: 대형 + 저장된 문서 → file-save, `saveFileAs` 미호출
  - UT-N-001: 기본 모드 inline-blob + 소형 → data URI
  - UT-N-002: 대형 이미지 >10MB → file-save 경로 거부 에러 (Rust `copy_image_to_folder` 동작 — IPC mock으로 단언)
  - UT-E-001 (v1.1.0, BD-2): 대형 이미지 >10MB → file-save 거부 → toast/메시지 표시 단언. silent no-op 아님. inline-blob 폴백 미발생 단언
- 모든 신규 라우팅 테스트가 현재 구현에서 실패함을 확인 (RED 증거).

**Files**:
- `src/test/imageHandler.test.ts` (수정)

### Milestone 2: 임계값 상수 + 라우팅 helper (GREEN 기반)

**Priority: High**

- `src/lib/preview/previewLimits.ts`에 `IMAGE_INLINE_THRESHOLD` 상수 추가 (OD-1 값, 기본 2MB). `LINE_FOLD_THRESHOLD`(1MB)와 `SOFT_THRESHOLD`(30MB) 사이에 문서화.
- `src/lib/image/imageHandler.ts`에 `resolveImageRoute(params: { mode, sizeInBytes }): Promise<'inline' | 'file'>` helper 추가 (Design Notes 의사코드 참조).
- `imageHandler.ts` 상단 import에 `IMAGE_INLINE_THRESHOLD` 추가.
- UT-T-001 통과 확인 (상수 검증).
- UT-R-002 통과를 위한 helper 단위 테스트 가능 상태.

**Files**:
- `src/lib/preview/previewLimits.ts` (수정)
- `src/lib/image/imageHandler.ts` (수정 — helper 추가)

### Milestone 3: 붙여넣기 경로 라우팅 + 지연 Save-As (GREEN)

**Priority: High**

- `imageHandler.ts:155-173` (`insertImageFile`) 수정:
  - `file.size >= IMAGE_INLINE_THRESHOLD` 판정.
  - 소형: 기존 모드 분기 유지 (inline-blob → data URI, file-save → `saveImageFromClipboard`).
  - 대형: 모드 무관 file-save 경로(`saveImageFromClipboard(mdFilePath, base64)`)로 라우팅.
  - 대형 + `mdFilePath` 빈 문자열(미저장): 지연 Save-As 트리거 — `extractImageFile`이 이미 File을 확보했으므로 안전. Save-As 완료 후 `savedPath`로 `saveImageFromClipboard` 호출.
  - **NI-4 구현 메모 (v1.1.0, 성능)**: `fileToBase64`/base64 변환은 라우팅 결정 **이후에** 호출한다. 순서: (1) `file.size` 읽기 (동기), (2) `resolveImageRoute({ mode, sizeInBytes })` 호출, (3) 라우팅 결과에 따라 필요한 변환/IPC 호출. 붙여넣기 file-save 경로는 `saveImageFromClipboard(mdFilePath, base64)` IPC가 base64를 요구하므로 변환을 피할 수 없으나, 라우팅 분기 전에 모든 경로에 대해 미리 변환하지 않도록 주의한다 — 인라인 삽입이 결정된 경우에만 data URI 변환을 수행하고, file-save가 결정된 경우에만 base64 변환을 수행한다.
- UT-R-001a/b, UT-R-003a, UT-U-001 (붙여넣기 변형), UT-U-002 (붙여넣기 변형), UT-U-003 통과 확인.

**Files**:
- `src/lib/image/imageHandler.ts` (수정)

### Milestone 4: 다이얼로그 경로 라우팅 + 지연 Save-As (GREEN)

**Priority: High**

- `imageHandler.ts:253-280` (`insertImageFromDialog`) 수정:
  - `openImageDialog()` 반환 후 `await readFileSize(selectedPath)` 로 크기 조회.
  - `size >= IMAGE_INLINE_THRESHOLD` 판정.
  - 소형: 기존 모드 분기 유지 (inline-blob → `readImageAsBase64`, file-save → `copyImageToFolder`).
  - 대형: 모드 무관 `copyImageToFolder(selectedPath, mdFilePath)` 로 라우팅.
  - 대형 + `mdFilePath` 빈 문자열(미저장): 지연 Save-As 트리거. Save-As 완료 후 `savedPath`로 `copyImageToFolder` 호출.
  - **BD-1 폴백 (v1.1.0)**: `readFileSize` IPC가 실패하는 경우, `readImageAsBase64`(inline-blob)로 폴백하지 않고 `copyImageToFolder(selectedPath, mdFilePath)`(file-save)로 폴백한다. `mdFilePath` 부재 시 `ensureMdFilePathForLargeImage` helper로 Save-As를 시도하고, 취소 시 no-op. 이 순서를 어기면 거대 base64 단일 라인이 재도입된다.
  - **NI-4 구현 메모 (v1.1.0, 성능 — 다이얼로그 경로에서 특히 중요)**: `readImageAsBase64`는 inline-blob 라우팅으로 결정된 경우에 **만** 호출한다. file-save 라우팅(`copyImageToFolder`)인 경우 base64 변환을 건너뛰고 `copyImageToFolder(selectedPath, mdFilePath)`로 path-기반 복사를 직접 수행한다 — 5MB 이미지의 ~6.7MB base64 변환을 회피하여 메모리 펌핑을 방지. 순서: (1) `readFileSize(selectedPath)` (IPC), (2) `resolveImageRoute({ mode, sizeInBytes })` 호출, (3-a) inline → `readImageAsBase64`, (3-b) file-save → `copyImageToFolder` (base64 없음). 기존 구조가 base64를 먼저 읽고 모드를 분기한다면 순서를 뒤바꿔야 한다 (run-phase에서 회귀 테스트로 검증).
- 기존 UT-7/8/11(`:276-318`) 회귀 없음 확인 (`readFileSize` mock이 소형 반환).
- UT-R-001e/f, UT-R-003b, **UT-R-003c (v1.1.0)**, UT-U-001 (다이얼로그 변형), UT-U-002 (다이얼로그 변형) 통과 확인.

**Files**:
- `src/lib/image/imageHandler.ts` (수정)

### Milestone 5: 드롭 경로 라우팅 (GREEN — 지연 게이트 불필요)

**Priority: High**

- `imageHandler.ts:185-242` (`handleImageDrop`) 수정:
  - 루프 내 각 파일에 대해 `file.size >= IMAGE_INLINE_THRESHOLD` 판정.
  - 소형: 기존 모드 분기 유지 (`:210-231` 그대로).
  - 대형: 모드 무관 file-save 경로(path 있음 → `copyImageToFolder`, path 없음 → `fileToBase64` + `saveImageFromClipboard`)로 라우팅.
  - 지연 Save-As 불필요 — `MarkdownEditor.tsx:277-290`이 미저장 시 항상 Save-As 게이트하므로, `handleImageDrop` 호출 시점에는 `mdFilePath`가 항상 유효.
- 다중 파일 드롭 시 각 파일 독립 라우팅 적용.
- UT-R-001c/d 통과 확인.

**Files**:
- `src/lib/image/imageHandler.ts` (수정)

### Milestone 6: 회귀 검증 + @MX 태그 갱신 (REFACTOR)

**Priority: Medium**

- `imageHandler.ts:3`의 `@MX:SPEC` 주석 갱신: 기존 목록에 `SPEC-IMG-MODE-003` 추가.
- `imageHandler.test.ts:1`의 `@MX:SPEC` 주석 갱신: 동일하게 추가.
- `previewLimits.ts`의 `@MX:SPEC` 주석 갱신: `SPEC-IMG-MODE-003` 추가 (현재 `SPEC-PREVIEW-007, SPEC-IMG-LOAD-002`).
- 전체 단위 테스트 스위트 실행: `npx vitest run`.
- TypeScript 컴파일: `npx tsc --noEmit`.
- ESLint: `npx eslint src/lib/image/imageHandler.ts src/lib/preview/previewLimits.ts src/test/imageHandler.test.ts`.
- 커버리지: `src/lib/image/imageHandler.ts` 85%+ 유지 (`quality.yaml` `test_coverage_target: 85`).
- 클립보드 붙여넣기 회귀 없음 확인 (기존 클립보드 테스트 블록).
- 수동 스모크 테스트 (OD-2 플랫폼·UX 합의 후):
  - [ ] 소형 이미지(< 2MB) inline-blob 모드 붙여넣기 → data URI 임베드 (Group A 보존)
  - [ ] 대형 이미지(≥ 2MB) inline-blob 모드 붙여넣기 → `./images/` 저장, 상대경로 삽입
  - [ ] 대형 이미지 + 미저장 문서에서 다이얼로그 → Save-As 트리거 후 file-save
  - [ ] 소형 이미지 + 미저장 문서에서 다이얼로그 → Save-As 스킵, data URI (Group A 보존)
  - [ ] 드롭 경로 대형 이미지 → file-save (미저장 시 기존 Save-As 게이트 동작)
  - [ ] 대형 이미지 >10MB → file-save 거부 + 사용자 가시 에러(toast) 표시 (REQ-N-002 + REQ-E-001, v1.1.0 BD-2)
  - [ ] 다중 드롭 소형·대형 혼합 → 각 파일 독립 라우팅
  - [ ] (v1.1.0, BD-1) 다이얼로그 경로 `readFileSize` IPC 실패 시뮬레이션 → file-save 폴백(또는 미저장+Save-As 취소 시 no-op). inline-blob로 회귀하지 않음을 실기기 확인

**Playwright must-pass 게이트** ([feedback-jsdom-pointer-blindspot] 반영 — REQ-U-001 클립보드 만료 안전성):
- [ ] PT-MODE-003-001: 실제 클립보드의 대형 이미지 붙여넣기 + 미저장 문서 → Save-As 다이얼로그 정상 트리거, 저장 후 이미지 누락 없음
- [ ] PT-MODE-003-002: 대형 이미지 드롭 + 미저장 → 기존 Save-As 게이트 동작, 저장 후 file-save 라우팅
- [ ] PT-E-001 (v1.1.0, BD-2): 대형 이미지 >10MB 삽입 시도 → toast/메시지가 사용자에게 가시적으로 표시됨을 Playwright로 단언 (DOM 셀렉터로 toast 요소 탐지). silent no-op 아님.

## Architecture Design Direction

```
세 진입점이 동일한 resolveImageRoute helper를 거쳐 per-image 크기 기반 라우팅을 수행한다.

                  resolveImageRoute({ mode, sizeInBytes })
                            |
              +-------------+-------------+
              |                           |
     size < IMAGE_INLINE_THRESHOLD    size >= IMAGE_INLINE_THRESHOLD
              |                           |
       honor user mode               file-save (mode 무관)
              |                           |
   +----------+----------+                |
   |                     |                |
 inline-blob          file-save      copyImageToFolder / saveImageFromClipboard
 (data URI)        (existing path)   (needs mdFilePath)
   |                     |                |
   v                     v                v
 insertImageMarkdown   insertImageMarkdown   +-- saved doc: use existing filePath
                                            +-- unsaved doc (paste/dialog): lazy Save-As
                                            +-- unsaved doc (drop): already gated by MarkdownEditor:277-290

진입점별 크기 획득:
  붙여넣기 (insertImageFile): file.size (DOM File, 동기)
  드롭      (handleImageDrop): file.size (DOM File, 동기)
  다이얼로그 (insertImageFromDialog): readFileSize(path) (IPC, 비동기)
```

## Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| 다중 대형 이미지 연속 붙여넣기 시 Save-As 다이얼로그 반복 노출 | Medium | OD-2 UX 합의 — 첫 이미지에서 Save-As 확보 후 세션 내 재사용(별도 최적화) 또는 toast로 라우팅 사유 명시. 본 SPEC 범위에서는 1차 구현(이미지마다 게이트)으로 진행 |
| 다이얼로그 경로 `readFileSize` IPC 왕복 지연 | Low | 단일 메타데이터 조회이므로 수 ms 이내. 기존 `useFileSystem.ts:215`에서 이미 동일 IPC 사용 중이며 성능 이슈 보고 없음 |
| 임계값 튜닝 (OD-1) — 2MB가 너무 낮거나 높을 수 있음 | Medium | OD-1 v1.1.0에서 2MB로 확정(범위 [1MB, 3MB]). `LINE_FOLD_THRESHOLD`(1MB) 이상·`MAX_IMAGE_SIZE`(10MB) 미만 제약(T-001)이 안전망. 런타임 조정 불가(컴파일 타임 상수) — 튜닝은 후속 개정에서. 디버그 로깅(OD-3)으로 post-ship 튜닝 데이터 수집 권장 |
| 대형 이미지(>10MB)가 file-save로 라우팅 후 Rust 10MB 검증에서 거부 | Low | T-001 제약(`IMAGE_INLINE_THRESHOLD < MAX_IMAGE_SIZE`)으로 사각지대 방지. >10MB 거부 시 사용자 가시 에러(toast)는 REQ-IMG-MODE-3-E-001 (BD-2)로 처리 — silent no-op 아님 |
| **(v1.1.0, BD-1)** `readFileSize` IPC 실패 시 inline-blob 폴백이 동결을 재도입 | Critical | REQ-R-003 정정: 폴백은 file-save (또는 file-save 불가 시 no-op). inline-blob 경로로 회귀 금지. UT-R-003c로 단언 — `readFileSize` reject + 대형 fixture + inline-blob 모드 → `copyImageToFolder` 호출, `readImageAsBase64` 미호출 |
| 기존 UT-7/8/11(`imageHandler.test.ts:276-318`)이 `readFileSize` 모킹 누락으로 실패 | Medium | M1에서 `readFileSize` 모킹 추가를 가장 먼저 수행. 기존 테스트가 소형 mock 값으로 green 유지됨을 M1 완료 기준으로 검증 |
| Playwright 게이트가 CI에서 warning-only일 때 클립보드 만료 회귀 누락 | Medium | PT-MODE-003-001/002/PT-E-001을 로컬 must-pass로 지정. CI 통과와 별개로 PR 머지 전 수동 실행 ([feedback-jsdom-pointer-blindspot]) |
| 행동 반전으로 인해 기존 사용자 문서가 영향받을 가능성 | Low | 소형 이미지 경로는 100% 보존 (Group A 무변경). 대형 이미지 inline-blob 사용자는 라우팅 변경으로 이점(동결 해소) 획득 — 기대한 동작 개선 |
| `resolveImageRoute` helper 도입이 기존 테스트 구조와 충돌 | Low | helper는 순수 함수(`{ mode, sizeInBytes }` → 라우팅)이므로 기존 핸들러 테스트에 간섭 없음. helper 자체 단위 테스트(UT-R-002)로 검증 |

## Open Decisions (v1.1.0 — 모두 해결됨, run phase 개시 가능)

아래 항목은 본 SPEC plan 단계에서 명시적 합의가 필요한 결정이다. v1.1.0에서 3개 모두 해결되어 run phase 에이전트에 위임할 수 있다.

### OD-1: `IMAGE_INLINE_THRESHOLD` 값 — RESOLVED (2MB, v1.1.0)

**결정**: 2MB (2,097,152 bytes). 허용 범위 [1MB, 3MB] 유지.

**측정 근거 (NI-3)**: 2MB는 **heuristic이며 본 SPEC에 측정 REQ이 없다**. 하위 이웃 `LINE_FOLD_THRESHOLD`(1MB)와 상위 이웃 `MAX_IMAGE_SIZE`(10MB)의 브래킷 중간값으로, 일반적인 스크린샷(200KB~1MB)은 inline-blob 이식성을 유지하고 고해상도 사진(5~8MB)은 file-save로 라우팅된다는 직관에 기반한다. `SPEC-IMG-LOAD-002`의 라인 폴딩(REQ-D-003, `LINE_FOLD_THRESHOLD=1MB`)이 [~0.75MB, 임계값] 영역의 인라인 이미지에 대한 활성 편집 완화책으로 남는다 — 본 SPEC의 라우팅은 명백히 대형인 이미지(수 MB+)에 대한 안전망이다 (NI-2 정정 근거와 동일).

**이웃 제약**:
- 하위: `LINE_FOLD_THRESHOLD` = 1MB. 권장 ≥ 1MB (NI-2 — 일반 스크린샷의 불필요한 file-save 회피 목적; 라인 폴딩 방지 목적이 아님).
- 상위: `MAX_IMAGE_SIZE` = 10MB. 필수 < 10MB (T-001 제약 — 사각지대 방지).

런타임 조정 불가(컴파일 타임 상수) — 튜닝은 후속 개정에서. 디버그 로깅(OD-3)으로 post-ship 튜닝 데이터 수집 권장.

### OD-2: 지연 Save-As UX — RESOLVED (option 1: 조용히, v1.1.0)

**결정**: option 1 — 조용히 Save-As 다이얼로그 표시. Save-As 자체에 대한 추가 toast 안내는 없다 (기존 file-save + 미저장 동작과 동일).

**범위 분리 (BD-2, 중요)**: >10MB 이미지 file-save 거부 시의 사용자 가시 에러(toast)는 **본 OD가 아닌** REQ-IMG-MODE-3-E-001(Group E)로 본 SPEC v1.1.0 범위에서 다뤄진다. OD-2는 "지연 Save-As 다이얼로그 자체의 안내"에 한정되며, 이는 조용히 진행한다.

**이유**: Save-As 자체는 이미 익숙한 UX이고 (기존 file-save + 미저장 동작) toast 컴포넌트 의존성 추가는 범위 확장이므로 최소 변경을 채택. 사용자 안내는 >10MB 거부 에러(REQ-E-001 toast)와 크기 조회 실패 no-op(BD-1)에서만 명시적으로 제공한다.

### OD-3: 라우팅 세션 텔레메트리 — RESOLVED (defer + 디버그 로깅 권장, v1.1.0)

**결정**: 연기 (defer). 본 SPEC은 라우팅 동작만 구현. 사용자 가시적 텔레메트리(설정 패널 카운터 등)는 후속 SPEC.

**디버그 로깅 권장 (NI-3 연계)**: 라우팅 결정(`routed to inline/file`, threshold, size)의 debug-level 로그(`console.debug`)를 첫 구현에 포함할 것을 권장한다. 이는 post-ship 튜닝(OD-1 임계값 조정)의 첫 단계로, 개발자 도구에서 라우팅 통계를 수집할 수 있게 한다. Production 빌드에서는 noop 또는 낮은 레벨로 유지하여 UX 영향을 제로로.

**이유**: 텔레메트리는 임계값 튜닝(OD-1 후속)에 유용하나, 첫 구현에서는 동작 안정화가 우선. 디버그 로깅은 사용자 가시 범위 밖이므로 UX 영향 없이 튜닝 데이터를 제공한다.

## Dependencies

- 신규 라이브러리 의존성: 없음
- Rust 변경: 없음
- 기존 IPC 재사용: `readFileSize`(`SPEC-IMG-LOAD-001` Group B 산물, 두 번째 consumer), `copyImageToFolder`, `saveImageFromClipboard`, `readImageAsBase64`, `openImageDialog` (모두 `src/lib/tauri/ipc.ts`)
- 기존 유틸 재사용: `fileToBase64`, `insertImageMarkdown`, `extractImageFile` (`imageHandler.ts`)
- 기존 상태 재사용: `useUIStore.getState().imageInsertMode` (`uiStore.ts:40,116`)
- 기존 상수 재사용: `LINE_FOLD_THRESHOLD` (`previewLimits.ts:23`) — 신규 `IMAGE_INLINE_THRESHOLD`의 하위 이웃

## Traceability

| Milestone | Requirements | Tests |
|---|---|---|
| M1 RED | (재생산 — 구현 전) | UT-R-001b/d/f, UT-U-001, UT-R-BOUNDARY, UT-R-003c (v1.1.0 BD-1), UT-E-001 (v1.1.0 BD-2) 신규 (실패 상태) + `readFileSize` 모킹 추가 |
| M2 GREEN 기반 | REQ-T-001, REQ-R-002 | UT-T-001, UT-R-002 통과 (상수 + helper) |
| M3 GREEN 붙여넣기 | REQ-R-001(붙여넣기), REQ-R-003a, REQ-U-001(붙여넣기), REQ-U-002(붙여넣기), REQ-U-003, REQ-N-001 | UT-R-001a/b, UT-R-003a, UT-U-001, UT-U-002, UT-U-003, UT-N-001 통과 |
| M4 GREEN 다이얼로그 | REQ-R-001(다이얼로그), REQ-R-003b/c (v1.1.0 BD-1), REQ-U-001(다이얼로그), REQ-U-002(다이얼로그), REQ-N-002, REQ-E-001 (v1.1.0 BD-2) | UT-R-001e/f, UT-R-003b, UT-R-003c, UT-U-001, UT-U-002, UT-N-002, UT-E-001 통과 |
| M5 GREEN 드롭 | REQ-R-001(드롭), REQ-R-002(드롭) | UT-R-001c/d 통과 |
| M6 REFACTOR | (회귀 + @MX 갱신 + Playwright) | 전체 스위트 + 수동 스모크 + PT-MODE-003-001/002 + PT-E-001 (v1.1.0) |
