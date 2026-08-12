# Implementation Plan: SPEC-IMG-LOAD-002

> **범위**: `SPEC-IMG-LOAD-001` v1.1.0에서 이월된 Group C 전체 — 4축(A 뷰포트/폴딩, B 스트리밍, C Worker, D 임계값). 각 축은 독립적으로 머지 가능하도록 마일스톤을 분리한다.

## Technical Approach

**4-마일스톤 위상 순서**: Axis A(뷰포트 한정 + 라인 폴딩) → Axis D(임계값 3계층) → Axis B(chunked 스트리밍) → Axis C(markdown-it Worker). 각 마일스톤은 독자적으로 머지 가능하다.

**A+D 우선 순서의 근거 (과제 지시 "folding alone이 freeze를 해소하면 B/C는 perf optimization" 반영)**:

1. **Axis A가 최고 사용자 가치**: 뷰포트 한정(REQ-A-001)이 WIDGET-001의 미구현 제약(spec.md:165)을 최초로 이행하여 `docChanged`마다 발생하는 full-doc copy 동결을 제거한다. 라인 폴딩(REQ-A-003)은 거대 base64 단일 라인의 토크나이제이션 비용(N1)을 직접 완화한다. **A만으로도 편집 동결이 사라진다.**
2. **Axis D는 A와 결합하여 오픈을 허용**: SOFT/HARD/per-line 임계값을 도입하면 5MB 하드 블록이 해제되어, 폴딩과 함께 SOFT 이하~SOFT~HARD 사이의 파일이 편집 가능해진다. **A+D 머지 시점에 사용자는 대용량 파일을 열고 편집할 수 있다 — 스트리밍/Worker 없이도.**
3. **Axis B는 오픈 동결 추가 완화**: 점진적 append dispatch(REQ-B-005)가 "첫 paint 후 나머지가 점진적 렌더"를 가능하게 한다. A+D 이후에도 단일 dispatch 전체 로드(`MarkdownEditor.tsx:103-113`)는 오픈 순간 동결을 유발하므로, B가 이를 완화한다.
4. **Axis C는 프리뷰 렌더 동결 제거**: markdown-it + Shiki를 Worker로 이관하여 프리뷰 디바운스(300ms)마다 메인 스레드가 동결하는 고통 1(이중 파싱)을 제거한다. A+B로 에디터 동결이 이미 해소된 시점이므로 C는 순수 perf optimization이다.

**최소 변경 원칙**: 기존 IPC·상태 필드·함수 시그니처를 유지한다. `insertImageFromDialog`(001 동결 시그니처)와 `insertImageMarkdown`(`imageHandler.ts:18-29`) 시그니처를 그대로 두고 폴딩 힌트를 내부에 추가한다. `FILE_SIZE_THRESHOLD`는 deprecated alias로 남겨 SPEC-PREVIEW-007 회귀를 막는다(OD-2).

**신규 의존성**: 없음. `@codemirror/language` ^6.12.1이 폴딩 API(`codeFolding`/`foldGutter`/`defaultLanguageFolding`)를 이미 포함하므로 CodeMirror 측 패키지 추가가 불필요. Worker는 브라우저 표준 `Worker` API 사용. Rust chunked 읽기는 `std::fs::File` + `std::io::{Read, Seek}` 표준 라이브러리만 사용.

## Reproduction-First Test Strategy (TDD RED)

**[HARD] 각 마일스톤의 첫 단계는 사용자 보고 증상을 재현하는 실패 테스트 작성.** CLAUDE.md Section 7 Rule 4 준수.

### Axis A 재생산 (뷰포트 한정 + 폴딩)

1. **UT-A1-001 신규** (`src/test/image-widget.test.ts` 확장): `buildDecorations`가 visible viewport 외부의 data URI 이미지를 스캔하지 않음을 단언 — visible 범위 밖에 data URI를 배치하고 데코레이션 수가 0임을 확인 → **현재 코드(`image-widget.ts:155-170`의 `view.state.doc.toString()` full-doc copy)에서는 실패** (전체 문서를 스캔하므로 visible 밖도 매칭).
2. **UT-A1-003 신규**: `LINE_FOLD_THRESHOLD` 초과 단일 라인이 fold decoration을 받음을 단언 → **현재는 폴딩 익스텐션이 없어 실패**.
3. **UT-A1-005 신규** (`src/test/imageHandler.test.ts` 확장): `insertImageMarkdown` 호출 후 삽입된 라인이 임계값 초과일 때 fold effect가 dispatch됨을 단언 → **현재는 fold 트리거가 없어 실패**.
4. **PT-A1-006 신규** (Playwright): 4MB `.md`(거대 base64 라인 포함) 파일 오픈 후 입력 → `INPUT_RESPONSIVENESS_BUDGET_MS`(5초) 이내 첫 paint 단언 → **현재는 Lezer 라인 단위 토크나이제이션 + full-doc copy로 동결, 실패**.

### Axis D 재생산 (임계값)

5. **UT-D1-001~003 신규** (`src/test/previewLimits.test.ts` 생성): `SOFT_THRESHOLD`/`HARD_CEILING`/`LINE_FOLD_THRESHOLD` 상수가 명명되어 존재하고 제안값(30MB/100MB/1MB)을 가짐을 단언 → **현재는 `FILE_SIZE_THRESHOLD`만 존재하여 실패**.
6. **UT-D1-004 신규**: 20MB `.md` 파일이 `unsupported`가 아닌 편집 가능 상태로 라우팅됨을 단언 → **현재는 5MB `FILE_SIZE_THRESHOLD`로 `too-large` 라우팅되어 실패**.
7. **UT-D1-007 신규** (PREVIEW-008 회귀 가드): `.png`/`.svg` 파일이 SOFT/HARD 임계값 변경에 영향받지 않고 현행 라우팅을 유지함을 단언.

### Axis B 재생산 (스트리밍)

8. **CT-B1-001 신규** (`src-tauri/src/commands/file_ops.rs` 테스트 모듈): `read_file_chunk(path, 0, 1024)`가 첫 1024 바이트를 올바른 UTF-8로 반환함을 단언 → **현재는 `read_file_chunk` 커맨드가 없어 컴파일 실패**.
9. **CT-B1-002 신규** (D4 — 멀티바이트 경계): 청크 경계가 4바이트 UTF-8 시퀀스(이모지) 중간에 끊어질 때 반환 문자열이 항상 유효 UTF-8임을 단언 → **현재는 경계 처리가 없어 실패**.
10. **CT-B1-003 신규** (D4 — 무한 루프 금지): `trim_to_utf8_boundary`가 잘린 시퀀스·malformed byte·빈 입력에 대해 유한 패스로 종료함을 단언 (타임아웃 5초 설정으로 무한 루프 검출) → **현재는 유틸리티가 없어 실패**.

### Axis C 재생산 (Worker)

11. **UT-C1-001 신규** (`src/test/renderWorker.test.ts` 생성): Worker `postMessage`가 content + generation을 받아 HTML을 반환함을 단언 (jsdom 환경에서 Worker 모킹) → **현재는 Worker가 없어 실패**.
12. **UT-C1-002 신규**: generation이 불일치할 때 결과가 폐기됨을 단언 → **현재는 generation counter가 없어 실패**.
13. **UT-C1-003 신규**: Worker 크래시 시 동기 렌더 폴백이 호출됨을 단언.

### WIDGET-001 회귀 가드

14. **UT-REG-W1..W7 신규** (`src/test/image-widget.regression.test.ts` 생성): WIDGET-001 REQ-1..7(source 보존·data-URI-only·click→cursor·동적 갱신·테마 적응 등)가 Axis A 변경 후에도 동작함을 단언. 이 테스트들은 Axis A RED 이전에 baseline을 먼저 찍어두고, A 구현 후에도 green으로 유지되어야 한다.

**RED 완료 기준**: 위 14개 그룹의 신규 테스트가 마일스톤별로 실패 상태로 존재. 기존 001 Group A+B 테스트는 수정하지 않는다.

## Milestones

> 시간 추정은 사용하지 않는다 ([HARD] coding-standards.md). 우선순위 라벨과 위상 순서로만 표시.

### Milestone 1: Axis A — 뷰포트 한정 + 라인 폴딩 (RED + GREEN)

**Priority: High** (최고 사용자 가치 — 편집 동결 직접 제거)

- UT-A1-001, UT-A1-003, UT-A1-005 신규 추가 (RED 확인)
- PT-A1-006 신규 추가 (RED 확인 — 4MB 파일 오픈 후 입력 응답)
- UT-REG-W1..W7 (WIDGET-001 회귀 가드) baseline 먼저 작성 → green 확인 후 Axis A 구현 내내 green 유지
- `image-widget.ts:155-170` (`buildDecorations`) 수정: `view.state.doc.toString()` 제거 → `view.visibleRanges` 기반 부분 스캔 (REQ-A-001)
- `image-widget.ts:185-189` (`update`) 수정: `docChanged` + `viewportChanged`에서 갱신 (REQ-A-002)
- `markdown-extensions.ts:90-149` 수정: `codeFolding()` + `foldGutter()` + `longLineFoldField`(커스텀) 추가 (REQ-A-003)
- `imageHandler.ts:18-29` (`insertImageMarkdown`) 수정: 삽입 후 fold 힌트 (REQ-A-005)
- `previewLimits.ts` 수정: `LINE_FOLD_THRESHOLD` 상수 추가 (Axis D 일부 — A와 강결합이므로 여기서 미리 도입)
- UT-A1-001/003/005 통과 (GREEN)
- PT-A1-006 통과 (4MB 파일 오픈 후 5초 이내 입력 응답)
- **OD-A 해소**: `lineWrapping`·`atomicRanges`(image-widget.ts:193-197)·AI 카드 block widget(`ai-suggestion-card.ts`)·AI selection toolbar(`ai-selection-toolbar.ts:717`)와의 우선순위·상호작용을 RED 테스트로 고정

**Files**:
- `src/components/editor/extensions/image-widget.ts`
- `src/components/editor/extensions/markdown-extensions.ts`
- `src/lib/image/imageHandler.ts`
- `src/lib/preview/previewLimits.ts` (`LINE_FOLD_THRESHOLD` 추가만)
- `src/test/image-widget.test.ts` (확장)
- `src/test/image-widget.regression.test.ts` (신규 — WIDGET-001 회귀)
- `src/test/imageHandler.test.ts` (확장)
- `tests/` Playwright PT-A1-006 추가

### Milestone 2: Axis D — 임계값 3계층 (RED + GREEN)

**Priority: High** (A와 결합하여 오픈 허용)

- UT-D1-001~003, UT-D1-004, UT-D1-007 신규 추가 (RED 확인)
- `previewLimits.ts:10` 수정: `SOFT_THRESHOLD`(30MB)/`HARD_CEILING`(100MB) 추가 + 기존 `FILE_SIZE_THRESHOLD`를 deprecated alias로 유지 (REQ-D-001~003, OD-2)
- `useFileSystem.ts:215` 수정: `FILE_SIZE_THRESHOLD` 단일 비교를 SOFT/HARD 분기로 변경 (REQ-D-004/005)
- `AppLayout.tsx:373-374` (`isViewOnly`) 수정: HARD 초과 시에만 에디터 잠금 (SOFT 초과는 편집 허용)
- UT-D1-001~007 통과 (GREEN)
- **OD-1 해소**: SOFT 30MB / HARD 100MB / LINE_FOLD 1MB / STREAM_CHUNK 256KB / INPUT_BUDGET 5s 값 확정 (사용자 annotation)
- 회귀: 001 Group B(UT-B1/B5, CT-B2, PT-B4), SPEC-PREVIEW-007/008 기존 테스트 green 유지 (UT-D1-007이 PREVIEW-008 회귀 가드)

**Files**:
- `src/lib/preview/previewLimits.ts`
- `src/hooks/useFileSystem.ts`
- `src/components/layout/AppLayout.tsx`
- `src/test/previewLimits.test.ts` (신규)
- `src/test/useFileSystem.test.ts` (확장)

> **A+D 머지 시점의 사용자 가치**: 폴딩(A) + 임계값 상향(D)으로 5~30MB `.md` 파일이 편집 가능해진다. 스트리밍(B)과 Worker(C)는 이후 마일스톤에서 추가 완화만 제공하므로, A+D를 먼저 릴리즈하는 것이 사용자 가치 전달을 극대화한다.

### Milestone 3: Axis B — chunked 스트리밍 읽기 (RED + GREEN)

**Priority: Medium** (오픈 동결 추가 완화 — perf optimization)

- CT-B1-001, CT-B1-002, CT-B1-003(D4 — 무한 루프 금지) 신규 추가 (RED 확인)
- UT-B1-001(IPC 래퍼), UT-B1-005(append dispatch) 신규 추가 (RED)
- PT-B1-005 신규 (점진적 렌더 — Playwright)
- `file_ops.rs` 수정: `read_file_chunk(path, offset, len) -> Result<String, String>` 커맨드 추가 + `trim_to_utf8_boundary` 유틸리티 (REQ-B-001~003)
- `src/lib/tauri/ipc.ts` 수정: `readFileChunk(path, offset, len)` 래퍼 추가
- `MarkdownEditor.tsx:103-113` 수정: 스트리밍 로드 경로에서 점진적 append dispatch (REQ-B-005). 단, SOFT 미만 파일은 기존 단일 `readFile` 경로 유지 (회귀 없음)
- `useFileSystem.ts` 수정: SOFT 초과 파일은 `readFileChunk` 스트리밍 경로로 라우팅
- CT/UT/PT 통과 (GREEN)
- **OD-3 해소**: chunked 선택 (Channel 대신) — backpressure·기존 `invoke<>` 패턴 재사용·`core:default` 적합
- 회귀: 001 Group B(`read_file`/`readFileSize`/`writeFile`), SPEC-FS-001(`validate_path`) green 유지

**Files**:
- `src-tauri/src/commands/file_ops.rs` (`read_file_chunk` + `trim_to_utf8_boundary`)
- `src-tauri/src/lib.rs` (`read_file_chunk` 커맨드 등록)
- `src/lib/tauri/ipc.ts`
- `src/components/editor/MarkdownEditor.tsx`
- `src/hooks/useFileSystem.ts`
- `src-tauri/src/commands/file_ops.rs` 테스트 모듈
- `tests/` Playwright PT-B1-005

### Milestone 4: Axis C — markdown-it Web Worker (RED + GREEN)

**Priority: Medium** (프리뷰 렌더 동결 제거 — perf optimization)

- UT-C1-001, UT-C1-002(generation), UT-C1-003(onerror 폴백), UT-C1-004(파일 전환 취소), UT-C1-006(중복 직렬화), UT-C1-007(lifecycle) 신규 추가 (RED)
- PT-C1-001(파싱 중 입력 응답), PT-C1-003(Worker 크래시 동기 폴백) 신규 (Playwright)
- `src/lib/markdown/renderWorker.ts` 신규: Worker 소유 마크다운 파싱 + Shiki + 커스텀 플러그인 이관 (REQ-C-001/005)
- `renderer.ts:207-250,379-428` 수정: throwaway MarkdownIt 제거, `renderMarkdownSync`(폴백용 동기 경로)만 남기고 Worker 경로가 우선 (REQ-C-001/003)
- `codeHighlight.ts` 수정: Worker용 Shiki init 헬퍼 추가 (메인 스레드 싱글턴은 유지 — REQ-C-005, fan_in >= 4 회귀 없음)
- `usePreview.ts:15,49-68` 수정: Worker `postMessage` + generation counter + onerror 폴백 (REQ-C-002/003/004/006/007)
- UT/PT 통과 (GREEN)
- **OD-B 해소**: Shiki Worker 소유 (split post-pass 대신) — `highlight`가 `md.render` 내부 동기 실행이므로 Worker가 소유해야 비용이 메인 스레드를 벗어남
- **OD-C 해소**: lazy spawn (세션 시작이 아닌 첫 프리뷰 렌더 시) — 불필요한 Worker 리소스 회피
- 회귀: SPEC-PREVIEW-001/003/005/008/012(마크다운 렌더 품질·Shiki·KaTeX·SVG·표), usePreview/exportHtml/CodeFileViewer(Shiki 싱글턴 소비자 fan_in >= 4) green 유지

**Files**:
- `src/lib/markdown/renderWorker.ts` (신규)
- `src/lib/markdown/renderer.ts`
- `src/lib/markdown/codeHighlight.ts`
- `src/hooks/usePreview.ts`
- `src/test/renderWorker.test.ts` (신규)
- `src/test/usePreview.test.ts` (확장)
- `tests/` Playwright PT-C1-001/003

## Architecture Design Direction

```
[Milestone 1: Axis A — 뷰포트 한정 위젯]
  ↓
buildDecorations(view)
  ↓
for (const { from, to } of view.visibleRanges)  ← 전체 doc 복사 회피
  ↓
sliceString(from, to) → parseDataUriImage → Decoration.replace
  ↓
update(view): docChanged OR viewportChanged → 갱신
```

```
[Milestone 1: Axis A — 라인 폴딩]
  ↓
codeFolding() + foldGutter() + longLineFoldField
  ↓
longLineFoldField.create(state):
  for each line in doc:
    if line.length > LINE_FOLD_THRESHOLD → Decoration.fold(line)
  ↓
사용자 클릭 → 토글 (REQ-A-004, Playwright must-pass)
```

```
[Milestone 3: Axis B — chunked 스트리밍]
  ↓
readFileChunk(path, offset, len) → Result<String, String>
  ↓
trim_to_utf8_boundary(buf) → 안전한 UTF-8 청크 (D4 — 무한 루프 방지)
  ↓
프런트엔드: while (chunk.length > 0) { append dispatch; offset += byteLength }
  ↓
점진적 렌더 (REQ-B-005)
```

```
[Milestone 4: Axis C — Worker 파싱]
  ↓
usePreview (300ms 디바운스) → Worker.postMessage({content, generation, isDark, mdFilePath})
  ↓
Worker: new MarkdownIt + Shiki(자체 인스턴스) + 커스텀 플러그인
  ↓
Worker: md.render → data-mdedit-svg 마커 포함 HTML
  ↓
postMessage({generation, html}) → 메인 스레드
  ↓
generation !== current → 폐기 (REQ-C-002)
generation === current → embedPreviewImages(IPC-bound, 메인) → setHtml
  ↓
onerror → renderMarkdownSync (REQ-C-003 폴백)
```

## Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| **N1 — 라인 단위 토크나이제이션 비용이 폴딩으로 완전 제거되지 않음** | Medium | 폴딩된 라인은 CodeMirror 디스플레이 파이프라인에서 제외되지만 Lezer 파스트리는 문서 전체를 덮음. UT-A1-003 + PT-A1-006으로 관측 가능한 동결 제거를 단언. 폴딩으로 부족하면 5계층이 아니라 점진적 Lezer 파싱(별도 후속)을 고려하되 본 SPEC 범위 밖. |
| **N2 — Channel 백프레셔 부재** | Low | chunked pull 방식 채택(OD-3)으로 해소. Rust가 밀어넣지 않고 프런트엔드가 당기므로 과적 큐가 발생하지 않음. |
| **N3 — Worker lifecycle (크래시/teardown/중복/취소)** | High | REQ-C-002(generation counter)·REQ-C-003(onerror 폴백)·REQ-C-004(파일 전환 취소)·REQ-C-006(중복 직렬화)·REQ-C-007(lazy spawn + 정리)로 전부 명시적 인수. PT-C1-003(Worker 강제 크래시)으로 폴백 검증. |
| **N4 — 커스텀 플러그인 마이거레이션 비용** | Medium | 8개 플러그인 + 2개 enable(table/strikethrough)을 Worker로 이관. Shiki 소유권 이관이 하드 파트(OD-B). Design Notes에 정량화. |
| 폴딩 익스텐션이 `atomicRanges`(image-widget.ts:193-197)와 충돌 — 폴드된 라인의 atomic 위젯이 깨짐 | High | OD-A — RED 테스트로 상호작용 고정. `codeFolding` 우선순위를 `imageWidgetExtension`보다 뒤로 배치하거나, `Decoration.replace` 위젯 라인은 폴딩 대상에서 제외하는 커스텀 fold 트리거 설계. |
| AI 카드 block widget(`ai-suggestion-card.ts`)·AI selection toolbar(`ai-selection-toolbar.ts:717`)와 폴딩 상호작용 | Medium | OD-A — UT-REG-W1..W7과 동일한 회귀 가드 패턴을 AI 위젯에도 적용 (run phase에서 AI 확장 테스트 green 유지 단언). 본 SPEC은 AI 코드를 수정하지 않으므로 폴딩 익스텐션 추가만 검증. |
| Worker가 `embedPreviewImages`(IPC-bound)를 호출할 수 없어 이미지가 깨짐 | High | Design Notes 명시: Worker는 HTML 문자열만 반환, `embedPreviewImages`(`usePreview.ts:55`)는 메인 스레드 유지. Worker가 `data-mdedit-svg` 마커만 넘기고 `svgMap`은 내부 캡슐화하므로 IPC 마셜링 부담 없음. |
| Shiki Worker 이관이 메인 스레드 싱글턴 소비자(usePreview/exportHtml/CodeFileViewer)에 회귀 | Medium | REQ-C-005 — 메인 싱글턴 유지 + Worker 자체 인스턴스. fan_in >= 4 소비자 회귀 테스트 green 유지. |
| `FILE_SIZE_THRESHOLD` deprecated alias 제거가 SPEC-PREVIEW-007 회귀 | Medium | OD-2 — alias를 유지(값은 SOFT 또는 별도 5MB). run phase에서 `grep`으로 모든 consumer를 확인. |
| chunked 읽기가 비-UTF-8 파일에서 크래시 | Medium | REQ-B-006 — `String::from_utf8_lossy`(U+FFFD) 또는 전체 에러(OD에서 선택). CT-B1-006으로 단언. |
| 마일스톤 4(Worker)가 마일스톤 1-3에 의존하여 지연 | Low | 각 마일스톤은 독립 머지 가능. Worker가 마지막이므로 A+D+B만 머지된 상태에서도 사용자 가치(편집 가능 + 점진적 로드)가 전달됨. |
| 거대 base64 라인의 `Decoration.fold` 비용 자체가 동절 | Medium | UT-A1-003에서 fold decoration 생성 비용을 측정. 필요 시 `Decoration.replace`로 대체(시각적 축소만)하여 Lezer 비용은 그대로 두고 디스플레이만 최적화하는 fallback 설계. |
| Playwright `INPUT_RESPONSIVENESS_BUDGET_MS`(5초)가 CI 환경에서 너무 타이트 | Low | PT-A1-006은 로컬 must-pass, CI에서는 warning-only로 허용(OD-1에서 값 조정 가능). 동결 자체(30초+)는 여전히 검출 가능. |

## Open Decisions (run phase 개시 전 사용자 합의 필요)

### OD-1: 임계값·상수값 (001 OD-1 계승)

**질문**: `SOFT_THRESHOLD`/`HARD_CEILING`/`LINE_FOLD_THRESHOLD`/`STREAM_CHUNK_SIZE`/`INPUT_RESPONSIVENESS_BUDGET_MS` 값을 무엇으로 할 것인가?

**제안(권장)**:
- `SOFT_THRESHOLD` = 30MB (001 v1.0.0 제안 50MB에서 하향 — 폴딩이 라인 비용을 완전 제거 못한다는 보수적 판단)
- `HARD_CEILING` = 100MB (001 v1.0.0 제안 200MB에서 하향 — 동일 이유)
- `LINE_FOLD_THRESHOLD` = 1MB (단일 라인이 1MB 초과면 base64 data URI일 확률이 높음 — 일반 텍스트 라인은 수십 KB를 넘지 않음)
- `STREAM_CHUNK_SIZE` = 256KB (UTF-8 경계 처리 오버헤드와 점진적 렌더 빈도의 균형 — 64KB는 너무 잦은 IPC, 1MB는 점진성 상실)
- `INPUT_RESPONSIVENESS_BUDGET_MS` = 5000 (5초 — 로컬 must-pass, CI는 warning-only)

**이유**: 001 v1.0.0 감사(N1) 이후 폴딩이 라인 단위 Lezer 비용을 완전 제거하지 못한다는 확인이 있었으므로, 50/200MB보다 보수적으로 시작하고 run phase 측정 후 상향 조정이 가능하다. 모든 값은 명명 상수(REQ-D-001~003)이므로 drift 방지된다.

### OD-2: `FILE_SIZE_THRESHOLD` deprecated alias 처리

**질문**: 기존 `FILE_SIZE_THRESHOLD`(5MB, SPEC-PREVIEW-007)를 어떻게 다루는가?

**옵션**:
- (권장) `FILE_SIZE_THRESHOLD = SOFT_THRESHOLD`로 alias 유지. 모든 기존 consumer(`useFileSystem.ts:215`)는 새 분기로 마이그레이션. `grep`으로 미전환 consumer를 run phase에서 검증.
- `FILE_SIZE_THRESHOLD = 5MB`로 별도 유지(SOFT와 분리). 레거시 5MB 동작을 명시적으로 보존하려는 경우. 단, 이 값이 사실상 dead code가 될 위험.

**이유**: alias 유지가 SPEC-PREVIEW-007 회귀를 가장 안전하게 막는다. 단, alias가 dead code로 남지 않도록 run phase에서 consumer 전부를 새 분기로 전환한다(UT-D1-004/005가 이를 단언).

### OD-3: Channel vs chunked (001 OD-3 계승)

**질문**: Rust 스트리밍을 `tauri::ipc::Channel<T>`로 할 것인가, chunked `read_file_chunk`로 할 것인가?

**제안(권장)**: chunked(`read_file_chunk(path, offset, len) -> Result<String, String>`).

**이유**:
1. **백프레셔**: 프런트엔드가 당기는(pull) 모델이므로 큐 과적이 발생하지 않는다(N2 해소). Channel은 Rust가 밀어넣는(push) 모델이라 백프레셔가 추가로 필요.
2. **기존 패턴 재사용**: `invoke<>` 래퍼(`src/lib/tauri/ipc.ts`) 패턴 그대로. Channel은 레포 전체에 사용처가 없어(net-new) 러닝 커브·디버깅 비용이 추가.
3. **`core:default` 적합**: chunked는 기존 IPC capability 안에서 동작. Channel은 별도 capability 설정이 필요할 수 있음.
4. **취소 단순**: 파일 전환 시 프런트엔드가 다음 `readFileChunk` 호출을 멈추기만 하면 됨. Channel은 명시적 취소 신호가 필요.

### OD-A: 폴딩 전략 (신규)

**질문**: 라인 폴딩을 (a) `image-widget.ts`에 뷰포트 한정 + 커스텀 fold 트리거로 통합, (b) `@codemirror/language` `codeFolding`+`foldGutter`를 일반적으로 추가, 중 어느 쪽인가?

**제안(권장)**: 하이브리드 — 뷰포트 한정은 `image-widget.ts`에 반영(REQ-A-001)하고, 폴딩은 일반 `codeFolding()` + 커스텀 `longLineFoldField`(라인 길이 기반)를 별도 익스텐션으로 추가.

**조사 항목(run phase RED 단계)**:
- `image-widget.ts:193-197`의 `atomicRanges` provider와 `Decoration.fold`의 우선순위 충돌 — atomic 위젯 라인을 fold 대상에서 제외해야 하는가?
- `ai-suggestion-card.ts`의 block widget과 폴딩의 상호작용 — AI 카드가 fold된 라인 위에 렌더링되는가?
- `EditorView.lineWrapping`(`markdown-extensions.ts:103`)과 폴딩의 관계 — wrap된 라인의 fold 표시 위치.
- `ai-selection-toolbar.ts:717`의 `AiSparkleWidget`(선택 범위 위젯)과 폴딩의 충돌.

**이유**: 뷰포트 한정(REQ-A-001)은 WIDGET-001 위젯의 동결 결함이므로 `image-widget.ts`에서 고치는 것이 자연스럽다. 반면 폴딩은 마크다운 전체 구조(헤딩·리스트 등)에 적용되는 일반 기능이므로 별도 익스텐션이 더 깔끔하다. 두 익스텐션의 우선순위는 RED 테스트로 고정한다.

### OD-B: Shiki 소유권 (신규)

**질문**: Shiki 하이라이팅을 (a) Worker가 소유(`highlight` 콜백이 Worker 내부 실행), (b) Worker는 HTML만 만들고 Shiki를 메인 스레드 post-pass로 실행, 중 어느 쪽인가?

**제안(권장)**: (a) Worker 소유.

**이유**: `renderer.ts:388-400`의 `highlight` 콜백이 `md.render` 내부에서 동기 실행되므로, Shiki가 메인 스레드에 있으면 파싱 비용이 메인 스레드를 벗어나지 않는다(Worker 이관의 목적 상실). Worker가 자체 Shiki 인스턴스를 가지면(usePreview/exportHtml/CodeFileViewer는 메인 싱글턴 유지, fan_in >= 4 회귀 없음) 코드 블록 하이라이팅 비용이 전부 Worker로 이동한다. 단점: Worker 초기화 시 Shiki 로드 비용이 발생하므로 lazy spawn(OD-C)과 조합.

### OD-C: Worker spawn 시점 (001 OD-4 계승)

**질문**: Worker를 (a) 첫 프리뷰 렌더 시 lazy 생성, (b) 세션 시작 시 eager 생성, 중 어느 쪽인가?

**제안(권장)**: (a) lazy.

**이유**: 대부분의 세션은 소형 파일만 열므로 Worker 리소스를 미리 점유할 이유가 없다. Shiki 로드 비용(Worker 초기화 시)도 첫 실제 파싱까지 지연시키는 것이 체감 성능에 유리. 단점: 첫 파싱에 Worker 생성 오버헤드가 추가되지만 일회성이므로 무시 가능.

## Dependencies

- 신규 라이브러리 의존성: 없음
- Rust crate 추가: 없음 (`std::fs::File`, `std::io::{Read, Seek}`만 사용)
- 기존 IPC 재사용: `readFile`, `readFileSize`(001), `writeFile`(001 원자화), `saveFileAs`
- 기존 IPC 확장: 신규 `read_file_chunk` (Axis B)
- CodeMirror 패키지 재사용: `@codemirror/language` ^6.12.1(`codeFolding`/`foldGutter`/`defaultLanguageFolding` 포함, 이미 의존)
- 기존 상태 재사용: `useUIStore.imageInsertMode`, `useEditorStore.currentFilePath`/`content`/`dirty`, `useFileStore.previewStatus`/`fileTree`

## Traceability

| Milestone | Requirements | Tests |
|---|---|---|
| M1 (Axis A — 뷰포트/폴딩) | REQ-IMG-LOAD-2-A-001~006 + WIDGET-001 회귀(REQ-1~7) | UT-A1-001/003/005 (RED→GREEN), PT-A1-006 (Playwright must-pass), UT-REG-W1..W7 (회귀 가드) |
| M2 (Axis D — 임계값) | REQ-IMG-LOAD-2-D-001~007 | UT-D1-001~005/007 (RED→GREEN), 001 Group B + PREVIEW-007/008 회귀 |
| M3 (Axis B — 스트리밍) | REQ-IMG-LOAD-2-B-001~006 | CT-B1-001~003/006 (cargo, D4 포함), UT-B1-001/005 (RED→GREEN), PT-B1-005 (Playwright) |
| M4 (Axis C — Worker) | REQ-IMG-LOAD-2-C-001~007 | UT-C1-001~004/006/007 (RED→GREEN), PT-C1-001/003 (Playwright must-pass), Shiki 소비자 회귀 |
