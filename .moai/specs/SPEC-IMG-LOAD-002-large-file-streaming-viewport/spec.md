---
id: SPEC-IMG-LOAD-002
title: 대용량 마크다운 뷰포트 렌더링 + 스트리밍 읽기 + 렌더러 Worker (Group C)
version: 1.0.0
status: Planned
created: 2026-08-12
updated: 2026-08-12
author: jw (bjw202)
priority: High
issue_number: null
dependencies: [SPEC-IMG-LOAD-001, SPEC-IMG-WIDGET-001, SPEC-FS-001, SPEC-FS-003, SPEC-PREVIEW-007, SPEC-PREVIEW-008]
tags: [large-file, viewport, streaming, web-worker, code-folding, codemirror, markdown-it, performance, frontend, rust, tauri]
lifecycle: spec-anchored
supersedes: []
related:
  - "SPEC-IMG-LOAD-001 Follow-up (Group C deferred) — 본 SPEC이 이월 범위를 전부 수용한다"
  - "SPEC-IMG-LOAD-001 OD-1(임계값), OD-3(Channel vs chunked), OD-4(Worker spawn) — 본 SPEC이 OD-1/OD-3/OD-C로 계승"
  - "SPEC-IMG-WIDGET-001 spec.md:165 (viewport-bounding constraint, 미구현) — 본 SPEC이 REQ-IMG-LOAD-2-A-001로 최초 구현"
  - "SPEC-IMG-WIDGET-001 REQ-1..REQ-7 — 본 SPEC이 image-widget.ts를 EXTEND하며 회귀 테스트로 보존"
  - "SPEC-PREVIEW-007 REQ-PREVIEW007-005 (FILE_SIZE_THRESHOLD=5MB) — 본 SPEC이 SOFT/HARD/per-line 3계층으로 재정의(OD-2 deprecated alias 경유)"
  - "SPEC-PREVIEW-008 (래스터/SVG 뷰어) — 본 SPEC의 임계값 변경은 래스터/SVG에 적용하지 않는다(Non-Goal)"
  - "SPEC-FS-001 (read_file/write_file) — 본 SPEC이 read_file_chunk 신규 IPC 추가, 기존 시그니처는 유지"
follow_ups: []
---

# SPEC-IMG-LOAD-002: 대용량 마크다운 뷰포트 렌더링 + 스트리밍 읽기 + 렌더러 Worker (Group C)

## HISTORY

- **2026-08-12 v1.0.0**: 최초 작성. `SPEC-IMG-LOAD-001` v1.1.0에서 이월된 Group C 범위를 4축(A/B/C/D)으로 전개.
  - **이월 배경**: 001 v1.0.0 감사(N1)에서 "base64 data URI로 인한 거대 단일 라인을 CodeMirror가 라인 단위로 토크나이즈하는 비용은 스트리밍 + Worker만으로 해결되지 않는다"가 확인되어 001은 Group A(다이얼로그 순서) + Group B(안전망)로 범위 축소. 본 SPEC이 4축을 모두 인수한다.
  - **4축 구성 근거**: (A) 뷰포트 렌더링 + 라인 폴딩 — 사용자 가시 증상(UI 동결)의 직접 원인(N1) 제거, `SPEC-IMG-WIDGET-001`이 자체 spec.md:165에 선언했으나 미구현한 뷰포트 한정을 최초로 구현. (B) Rust 스트리밍 읽기 — 단일 `read_file` 호출 회피, 점진적 로딩. (C) markdown-it Web Worker — 메인 스레드 파싱 비용 제거(Shiki 포함). (D) 임계값 정책 — 5MB 단일 하드 블록을 SOFT/HARD/per-line 3계층으로 재정의.
  - **N1–N4 반영**: N1(per-line 토크나이제이션) → Axis A. N2(Channel 백프레셔 부재) → Axis B에서 chunked 선택으로 해소. N3(Worker lifecycle — 크래시/teardown/중복/취소) → Axis C REQ 그룹. N4(커스텀 플러그인 마이그레이션 비용) → Axis C Design Notes에 정량화.
  - **D4 잔여 인수**: 001 v1.1.0가 "후속 SPEC이 반드시 다뤄야 할 경고 항목"으로 명시한 malformed/truncated UTF-8 처리 + 종료 조건 테스트를 REQ-IMG-LOAD-2-B-002/B-003로 명시적 인수.

## Context & Goal

`inline-blob` 모드(기본값)에서 이미지를 다수 임베드한 마크다운 파일은 base64 data URI로 인해 단일 라인이 수십 MB에 달할 수 있다. 001 Group B는 5MB 초과 파일을 `UnsupportedFileViewer`로 라우팅하여 "빈 화면" 증상은 막았지만, **5MB 이하에서도** 거대 base64 라인이 있으면 편집·렌더가 동결한다. 그리고 5MB 초과 파일은 아예 편집이 불가하다. 두 가지 고통이 존재한다:

### 고통 1: freeze on open (대용량 파일 오픈 시 메인 스레드 동결)

| 결함 | 코드 위치 | 메커니즘 |
|---|---|---|
| 단일 dispatch 전체 로드 | `MarkdownEditor.tsx:103-113` (content dispatch, 001 현행 유지) | 한 번에 전체 content를 CodeMirror에 밀어넣음 |
| 이중 markdown-it 파싱 | `renderer.ts:207-250` (`getCodeProtectedRanges`의 throwaway `new MarkdownIt()`), `renderer.ts:379-428` (`new MarkdownIt({html:false})` + `md.render`) | content 변경마다 메인 스레드에서 마크다운 파싱을 두 번 수행 |
| Shiki 동기 실행 | `renderer.ts:388-400` (`highlight` 콜백), `codeHighlight.ts:17-39` (Shiki singleton) | `md.render` 내부에서 코드 블록마다 Shiki가 동기 실행 |

### 고통 2: freeze on edit (편집 중 docChanged 트리거 전체 재스캔)

| 결함 | 코드 위치 | 메커니즘 |
|---|---|---|
| 위젯 데코레이션 full-doc copy | `image-widget.ts:155-170` (`buildDecorations`), `:185-189` (`update` on `docChanged`) | `view.state.doc.toString()`로 전체 문서를 복사한 뒤 글로벌 정규식(`DATA_URI_IMAGE_PATTERN`) 실행 — `SPEC-IMG-WIDGET-001` spec.md:165 "viewport 범위로 제한" 제약이 **한 번도 구현되지 않음** |
| Lezer 라인 단위 토크나이제이션 | `@codemirror/lang-markdown` ^6.5.0 (Lezer, per-line) | 거대 base64 단일 라인을 라인 단위로 토크나이즈 → 뷰포트 안에 있으면 동결 |
| 5MB 편집 불가 | `previewLimits.ts:10` (`FILE_SIZE_THRESHOLD = 5MB`), `useFileSystem.ts:215` (consumer), `AppLayout.tsx:373-374` (`isViewOnly` 게이트) | 5MB 초과 `.md`는 `previewStatus='too-large'` + `setContent('')` → 에디터 잠금 placeholder |

**목표**: 4축을 통해 (A) 뷰포트 한정 + 라인 폴딩으로 편집 동결 제거, (B) 스트리밍 읽기로 오픈 동결 제거, (C) Worker로 렌더 동결 제거, (D) 임계값 재정의로 편집 가능 상한을 5MB에서 SOFT(30MB 제안)로 상향. **A+D만으로도 폴딩이 라인 단위 비용을 제거하여 대용량 파일 편집이 가능해진다** — B/C는 동결 추가 완화를 위한 성능 최적화 위치로 단계적 도입한다(plan.md 마일스톤 참조).

## Decision: SPEC-ID 및 4축 통합 근거

**결정: 단일 SPEC `SPEC-IMG-LOAD-002`로 4축을 모두 다룬다.**

고려 대안: (a) Axis A를 `SPEC-CM-VIEWPORT-001`(CodeMirror 시리즈), Axis B를 `SPEC-FS-004-streaming`(FS 시리즈), Axis C를 `SPEC-PREVIEW-013-worker`(PREVIEW 시리즈)로 분할.

통합 선택 근거:

1. **동인 결합**: 4축 모두 "base64 data URI로 bloat된 대용량 마크다운 파일"이라는 동일 사용자 워크플로우에서 발생한다. 001과 동일 촉발 시나리오이므로 시리즈 추적성을 위해 `IMG-LOAD-002`로 둔다.
2. **001 Follow-up 명시적 인수**: 001 v1.1.0이 Follow-up 섹션에 "Group C deferred → SPEC-IMG-LOAD-002"로 명시했으므로, 본 SPEC이 그 약속을 이행한다. 분할 시 001의 follow_ups 참조가 깨진다.
3. **A+D 단독 가치**: 폴딩(A) + 임계값 재정의(D)만으로도 사용자가 대용량 파일을 열고 편집할 수 있다(plan.md 마일스톤 순서의 근거). B/C는 독립적 성능 최적화이므로 본 SPEC 안에서 마일스톤으로 단계화한다.
4. **WIDGET-001 EXTEND**: Axis A는 `image-widget.ts`의 미구현 제약(spec.md:165)을 최초로 구현하므로, WIDGET-001 REQ-1..REQ-7 회귀 테스트를 본 SPEC 인수 조건에 명시적으로 포함한다. 신규 위젯 데코레이션을 만들지 않고 기존 것을 고친다.

## Environment

- Tauri 2 데스크톱 앱, React 18 + TypeScript 프런트엔드, Rust 1.92 백엔드
- CodeMirror 6 에디터 — `@codemirror/view` ^6.39.15, `@codemirror/state` ^6.5.4, `@codemirror/language` ^6.12.1(폴딩 API 포함, **신규 패키지 불필요**), `@codemirror/lang-markdown` ^6.5.0(Lezer, 라인 단위 토크나이제이션)
- `markdown-it` 동기 파서(`src/lib/markdown/renderer.ts`), Shiki 싱글턴(`src/lib/markdown/codeHighlight.ts:17-39`, github-dark+github-light, 13 언어)
- Zustand 상태 관리(`useUIStore`, `useEditorStore`, `useFileStore`)
- 기존 IPC 래퍼(`src/lib/tauri/ipc.ts`): `readFile`, `readFileSize`(001 Group B), `writeFile`(001 Group B 원자화), `saveFileAs`
- **CodeMirror 확장 현황**: `markdown-extensions.ts:90-149`에 약 16개 최상위 확장 항목. `EditorView.lineWrapping`(`:103`)은 시각적 wrap만. `imageWidgetExtension()`(`:123`)은 WIDGET-001. **폴딩 플러그인(`codeFolding`/`foldGutter`/`defaultLanguageFolding`)은 현재 코드베이스 어디에도 없다.**
- **Web Worker**: `src/` 전체에 Worker 인스턴스가 한 번도 사용되지 않았다. Axis C가 최초 도입이다.
- **Tauri Channel**: `tauri::ipc::Channel<T>`도 현재 사용처가 없다(레포 전수 조사 결과). Axis B는 chunked pull 방식을 권장한다(OD-3).

## Assumptions

- `inline-blob` 모드 사용자는 `.md` 파일 크기 증가를 감수한다(001 가정과 동일). 본 SPEC은 모드 정책을 변경하지 않는다(Non-Goal).
- CodeMirror 6의 `codeFolding()` + `defaultLanguageFolding`(또는 커스텀 fold 트리거)이 거대 단일 라인을 폴딩할 수 있으며, 폴딩된 라인은 뷰포트 렌더·디스플레이 토크나이제이션 비용에서 제외된다. 이 가정은 plan.md 마일스톤 1(RED 단계)에서 먼저 검증한다.
- `@codemirror/language` ^6.12.1이 폴딩 API를 별도 패키지 추가 없이 제공한다(`package.json` 확인 완료).
- Rust `std::fs::File`의 `read` + `seek` 조합으로 chunk 단위 읽기가 가능하며, UTF-8 멀티바이트 경계 처리는 프런트엔드(또는 Rust 측 유틸리티)에서 안전하게 수행할 수 있다.
- Shiki 싱글턴(`codeHighlight.ts`)은 Worker 컨텍스트에서도 `createHighlighter`로 재초기화 가능하다(Worker 안에서 lazy init). Shiki가 Worker 전용 인스턴스를 가지더라도 메인 스레드 기존 소비자(renderer.ts 이외에 usePreview, exportHtml, CodeFileViewer — fan_in >= 4)는 영향받지 않는다.
- 001 Group A+B는 본 SPEC 구현 개시 전에 main에 머지되어 있다( Delta Map의 file:line은 post-001-merge 베이스라인을 기준).
- `embedPreviewImages`(`usePreview.ts:55`)의 `readImageAsBase64` IPC는 메인 스레드에서만 동작하므로 Worker 외부에 유지한다(DOM/IPC-bound 작업은 Worker 부적합).

## Delta Map (브라운필드 변경 범위)

> file:line은 `SPEC-IMG-LOAD-001` Group A+B가 머지된 이후 베이스라인 기준. 001이 아직 머지 전이면 일부 라인이 본 SPEC 작성 시점의 main과 다를 수 있다 — run phase 시작 시 재확인.

| 파일 | 상태 | 변경 내용 |
|---|---|---|
| `src/components/editor/extensions/image-widget.ts:155-170` (`buildDecorations`) | [MODIFY] | **Axis A**: visible viewport 범위만 스캔하도록 변경. `view.state.doc.toString()`(full-doc copy) 제거 → `view.viewportLineBlocks` 또는 `view.visibleRanges` 기반 부분 스캔. WIDGET-001 spec.md:165 미구현 제약을 최초로 이행(REQ-IMG-LOAD-2-A-001). |
| `src/components/editor/extensions/image-widget.ts:185-189` (`update`) | [MODIFY] | **Axis A**: `docChanged`뿐 아니라 `viewportChanged`에서도 데코레이션 갱신(REQ-IMG-LOAD-2-A-002). full-doc copy 비용 제거. |
| `src/components/editor/extensions/markdown-extensions.ts:90-149` (extensions 배열) | [MODIFY] | **Axis A**: `codeFolding()` + `foldGutter()`(또는 커스텀 fold 익스텐션)을 배열에 추가. `imageWidgetExtension()`과의 우선순위 정렬. `lineWrapping`(`:103`)과의 상호작용 검증(OD-A). |
| `src/lib/image/imageHandler.ts:18-29` (`insertImageMarkdown`) | [MODIFY] | **Axis A**: 삽입 직후 해당 라인이 `LINE_FOLD_THRESHOLD` 초과면 fold 트리거(REQ-IMG-LOAD-2-A-005). 001 REQ-IMG-LOAD-A-004(두 진입점 대칭)와 동일한 4개 호출부(paste/drop×2/dialog)에 일관 적용. |
| `src/lib/preview/previewLimits.ts:10` (`FILE_SIZE_THRESHOLD`) | [MODIFY] | **Axis D**: 5MB 단일 상수를 `SOFT_THRESHOLD`/`HARD_CEILING`/`LINE_FOLD_THRESHOLD` 3계층으로 재정의(REQ-IMG-LOAD-2-D-001~003). 기존 `FILE_SIZE_THRESHOLD`는 deprecated alias로 남겨 SPEC-PREVIEW-007 회귀 방지(OD-2). |
| `src/hooks/useFileSystem.ts:215` (임계값 consumer) | [MODIFY] | **Axis D**: `FILE_SIZE_THRESHOLD` 비교를 SOFT/HARD 분기로 변경. SOFT 초과 시 점진적 로딩 + 폴딩 활성화(REQ-IMG-LOAD-2-D-004), HARD 초과 시 `unsupported` 유지(REQ-IMG-LOAD-2-D-005). |
| `src/components/layout/AppLayout.tsx:373-374` (`isViewOnly` 게이트) | [MODIFY] | **Axis D**: HARD 초과 시에만 에디터 잠금. SOFT 초과는 편집 허용(폴딩과 함께). `unsupported` 분기는 HARD 전용으로 좁아짐. |
| `src-tauri/src/commands/file_ops.rs` (`read_file_chunk`) | [NEW] | **Axis B**: `read_file_chunk(path: String, offset: u64, len: usize) -> Result<String, String>` 커맨드. chunk 단위 읽기 + UTF-8 경계 처리(REQ-IMG-LOAD-2-B-001~003). `validate_path` 재사용(SPEC-FS-001). |
| `src/lib/tauri/ipc.ts` | [MODIFY] | **Axis B**: `readFileChunk(path, offset, len)` 래퍼 추가. 기존 `readFile`/`readFileSize` 시그니처 유지. |
| `src/lib/markdown/renderer.ts:207-250` (`getCodeProtectedRanges`) | [MODIFY] | **Axis C**: throwaway `new MarkdownIt()` 제거 → Worker로 이관(내부 유틸). 반환값이 callers에게 노출되지 않으므로 마셜링 부담 없음. |
| `src/lib/markdown/renderer.ts:379-428` (`new MarkdownIt` + `md.render` + Shiki `highlight` 콜백) | [MODIFY] | **Axis C**: 마크다운 파싱 + Shiki 하이라이팅을 Worker로 이관. `md.render` 호출이 Worker 내부에서 실행(REQ-IMG-LOAD-2-C-001/B-005). 커스텀 플러그인(`dataLinePlugin`/`tableScrollPlugin`/`tableCellLineBreakPlugin`/`extractInlineSvg`/`restoreSvgMarkers`/`mermaidPlugin`/`markdownItKatex`/`imageResolverPlugin`) 전부 Worker로 이동. |
| `src/lib/markdown/codeHighlight.ts:17-39` (`getHighlighter` 싱글턴) | [MODIFY] | **Axis C**: Worker가 자체 Shiki 인스턴스를 소유(REQ-IMG-LOAD-2-C-005). 메인 스레드 싱글턴은 usePreview/exportHtml/CodeFileViewer 용도로 유지(fan_in >= 4 회귀 없음). |
| `src/hooks/usePreview.ts:15,49-68` (300ms 디바운스 + `renderMarkdown` 호출) | [MODIFY] | **Axis C**: `renderMarkdown` 호출을 Worker `postMessage`로 교체. generation counter로 stale 결과 폐기(REQ-IMG-LOAD-2-C-002). `embedPreviewImages`(`:55`)는 메인 스레드 유지(IPC-bound). |
| `src/components/preview/PreviewRenderer.tsx:47-59,97,113-133` (DOMPurify/mermaid) | [EXISTING] | 변경 없음 — Worker가 `data-mdedit-svg` 마커가 포함된 최종 HTML만 반환. DOMPurify sanitize(`:47-59,97`)·mermaid client render(`:113-133`)는 메인 스레드 유지(DOM-bound). |
| `src/components/editor/MarkdownEditor.tsx:103-113` (content dispatch) | [MODIFY] | **Axis B**: 점진적 append dispatch — 청크 도착 시 CodeMirror에 append(REQ-IMG-LOAD-2-B-005). 단일 전체 dispatch 회피. |
| `src/components/editor/extensions/ai-suggestion-card.ts` (block widget) | [EXISTING] | 변경 없음 — 폴딩 익스텐션과의 상호작용만 run phase에서 검증(OD-A). |
| `src-tauri/src/commands/file_ops.rs:35` (`read_file`), `:115` (`read_file_size`), `:53` (`write_file` 원자화) | [EXISTING] | 변경 없음 — 소형 파일(4.99MB 이하)은 기존 단일 `read_file` 경로 유지(회귀 없음). |
| `src-tauri/src/commands/image_ops.rs` (`MAX_IMAGE_SIZE`) | [EXISTING] | 변경 없음 — inline-blob 삽입 시 per-image 크기 검증 도입 안 함(001 Non-Goal #1 계승). |

## Requirements

> REQ 본문은 행동만 서술한다. 구현 메커니즘(함수명·IPC·Rust 명령)은 Design Notes 참조. EARS 키워드는 영문, 행동 묘사는 한국어.
> 각 REQ는 falsifiable한 단일 테스트와 매핑된다(Traceability 참조). "무변경" 속성은 REQ 본문에서 제외하고 acceptance.md Test Strategy Layer에서 "코드 리뷰(diff)" 행으로 분리한다([feedback-spec-verifiable-requirements] 패턴 2).
> REQ ID 규칙: `REQ-IMG-LOAD-2-{A|B|C|D}-NNN`. 001과 충돌 회피를 위해 가운데 `2`를 둔다.

### Group A — 뷰포트 렌더링 + 라인 폴딩 (핵심 가치)

#### REQ-IMG-LOAD-2-A-001 (State-Driven): 위젯 데코레이션 뷰포트 한정

**WHILE** CodeMirror 에디터가 활성 상태이고 문서에 data URI 이미지가 포함된 경우, 시스템은 위젯 데코레이션 계산을 visible viewport 범위로 한정한다. **AND** 시스템은 `view.state.doc.toString()` 호출로 전체 문서를 복사하지 않는다. **AND** 글로벌 정규식 매칭은 visible 라인에 대해서만 수행한다. (WIDGET-001 spec.md:165 미구현 제약의 최초 이행.)

#### REQ-IMG-LOAD-2-A-002 (Event-Driven): 뷰포트 변경 시 데코레이션 갱신

**WHEN** 사용자가 스크롤하거나 커서를 이동하여 visible viewport가 변경된 경우, **THEN** 시스템은 새로 visible 된 라인의 위젯 데코레이션을 갱신한다. **AND** 새로 visible 된 data URI 이미지가 지연 없이 위젯으로 렌더링된다.

#### REQ-IMG-LOAD-2-A-003 (State-Driven): 거대 라인 자동 폴딩

**WHILE** 문서의 단일 라인 길이가 `LINE_FOLD_THRESHOLD`를 초과하는 경우, 시스템은 해당 라인을 자동으로 fold하여 시각적으로 축소한다. **AND** 폴드된 라인은 클릭 가능한 축소 표시(예: "…N lines folded")로 표시된다. (N1 — 거대 base64 단일 라인 토크나이제이션 비용 — 의 직접 완화.)

#### REQ-IMG-LOAD-2-A-004 (Event-Driven): 폴드 토글

**WHEN** 사용자가 폴드된 라인의 축소 표시를 클릭하거나 폴드 단축키를 입력한 경우, **THEN** 시스템은 해당 라인을 펼친다. **AND** 다시 클릭하면 다시 fold한다. (jsdom은 포인터/hover 경로를 잡지 못하므로 Playwright must-pass로 둔다 — [feedback-jsdom-pointer-blindspot].)

#### REQ-IMG-LOAD-2-A-005 (Event-Driven): 이미지 삽입 시 폴딩 힌트

**WHEN** `insertImageMarkdown` 경유로 data URI 이미지가 삽입된 경우(`imageHandler.ts:18-29`, 4개 호출부), **THEN** 시스템은 삽입된 라인이 `LINE_FOLD_THRESHOLD`를 초과하면 즉시 fold 트리거한다. **AND** 두 진입점(툴바, `Cmd+Shift+I`)에 동일한 폴딩 힌트가 적용된다(001 REQ-IMG-LOAD-A-004 대칭).

#### REQ-IMG-LOAD-2-A-006 (Ubiquitous + Unwanted): 대용량 파일 편집 시 동결 없음

**WHEN** 파일 크기가 `FILE_SIZE_THRESHOLD` 이하이고 거대 base64 라인을 포함한 마크다운 파일을 열거나 편집하는 경우, 시스템은 메인 스레드 동결 없이 입력에 응답한다. **IF** 사용자가 입력 후 `INPUT responsiveness budget` 이내에 첫 paint가 발생하지 않는 경우, **THEN** 이는 결함으로 간주한다. (jsdom은 동결을 잡지 못하므로 Playwright must-pass로 둔다.)

### Group B — Rust 스트리밍 읽기 (chunked)

#### REQ-IMG-LOAD-2-B-001 (Event-Driven): 청크 단위 읽기 IPC

**WHEN** 프런트엔드가 `read_file_chunk(path, offset, len)`을 호출한 경우, **THEN** 시스템은 `offset` 바이트 위치에서 시작하여 최대 `len` 바이트를 읽어 UTF-8 문자열로 반환한다. **AND** 파일 끝에 도달하면 읽은 만큼만 반환한다. **AND** `validate_path`를 경유하여 경로 탈출을 방지한다(SPEC-FS-001).

#### REQ-IMG-LOAD-2-B-002 (Unwanted): UTF-8 멀티바이트 경계 안전

**IF** 청크가 멀티바이트 UTF-8 시퀀스 중간에서 끝나는 경우(truncated tail), **THEN** 시스템은 시퀀스의 마지막 완전한 코드 포인트까지만 반환하고, 잘린 나머지 바이트는 다음 청크로 이월한다. **AND** 반환 문자열은 항상 유효한 UTF-8이다. (D4 잔여 인수 — 001 v1.1.0 경고 항목.)

#### REQ-IMG-LOAD-2-B-003 (Unwanted): truncated/malformed tail 무한 루프 금지

**IF** chunk 경계 처리 로직이 잘린 시퀀스 또는 malformed UTF-8을 만나는 경우, **THEN** 시스템은 종료 조건에 도달하여 무한 루프에 빠지지 않는다. **AND** cargo 테스트가 truncated tail과 malformed UTF-8 입력에 대해 종료를 단언한다. (D4 — 001 v1.1.0가 후속 SPEC에 요구한 종료 테스트.)

#### REQ-IMG-LOAD-2-B-004 (State-Driven): pull 기반 백프레셔

**WHILE** 스트리밍 로드가 진행 중인 경우, 시스템은 프런트엔드가 청크를 당겨오는(pull) 모델을 사용한다. **AND** Rust 측이 프런트엔드 의사와 무관하게 밀어넣지 않는다. (N2 — Channel 백프레셔 부재 — 해소.)

#### REQ-IMG-LOAD-2-B-005 (Event-Driven): 점진적 append dispatch

**WHEN** 스트리밍 청크가 도착하는 경우, **THEN** 시스템은 전체 content를 한 번에 dispatch하지 않고 CodeMirror에 청크를 append하는 방식으로 dispatch한다. **AND** 사용자는 청크 도착과 함께 점진적으로 렌더링되는 문서를 본다.

#### REQ-IMG-LOAD-2-B-006 (Unwanted): 비-UTF-8 파일 우아한 저하

**IF** 파일이 유효한 UTF-8이 아닌 경우(바이너리·인코딩 불일치), **THEN** 시스템은 현행 `read_file`(001 Group B 회귀)과 정합하게 처리한다 — 전체 거부(`Result<String,String>` 에러)하거나 U+FFFD로 대체한다. **AND** chunked 경로가 비-UTF-8 파일에서 크래시하지 않는다. (SPEC-FS-001 UTF-8 계약 준수.)

### Group C — markdown-it Web Worker

#### REQ-IMG-LOAD-2-C-001 (Event-Driven): Worker 마크다운 렌더링

**WHEN** 프리뷰 content가 변경되는 경우(300ms 디바운스 이후), **THEN** 시스템은 마크다운 파싱을 Web Worker에서 수행하고, 완성된 HTML 문자열(`data-mdedit-svg` 마커 포함)을 메인 스레드에 반환한다. **AND** 메인 스레드는 파싱 중에 입력에 응답한다. (고통 1 — 이중 markdown-it + Shiki 동기 실행 — 해소.)

#### REQ-IMG-LOAD-2-C-002 (State-Driven): generation counter (stale 결과 폐기)

**WHILE** Worker 파싱이 진행 중이고 사용자가 추가로 content를 변경하거나 파일을 전환하는 경우, 시스템은 generation counter(또는 시퀀스 번호)를 사용하여 이전 요청의 결과를 폐기한다. **AND** 화면에는 항상 마지막 요청의 결과만 반영된다. (N3 — 겹치는 parse / open B before A finishes.)

#### REQ-IMG-LOAD-2-C-003 (Unwanted): Worker 크래시 폴백

**IF** Worker가 파싱 도중 크래시하거나 에러를 throw하는 경우(150MB 문서 등), **THEN** 시스템은 `onerror`/`onmessageerror` 핸들러로 동기 렌더(`renderer.ts` 기존 경로)로 폴백한다. **AND** 프리뷰가 빈 화면 없이 렌더링된다. (N3 — Worker 크래시.)

#### REQ-IMG-LOAD-2-C-004 (Event-Driven): 파일 전환/닫기 시 in-flight 취소

**WHEN** 사용자가 파일을 전환하거나 닫는 경우, **THEN** 시스템은 진행 중인 Worker 파싱을 취소(또는 그 결과를 폐기)한다. **AND** 전환 후 첫 파싱은 새 파일에 대해서만 수행된다. (N3 — teardown on file close.)

#### REQ-IMG-LOAD-2-C-005 (Ubiquitous): Shiki Worker 소유

마크다운 코드 블록 구문 강조(Shiki `highlight` 콜백)는 항상 Worker 내부에서 실행된다. **AND** 메인 스레드의 Shiki 싱글턴(`codeHighlight.ts`)은 usePreview/exportHtml/CodeFileViewer 등 기존 소비자(fan_in >= 4)를 위해 유지되며, Worker는 자체 인스턴스를 소유한다. (Shiki가 `md.render` 내부에서 동기 실행되므로 Worker가 소유해야만 파싱 비용이 메인 스레드를 벗어난다.)

#### REQ-IMG-LOAD-2-C-006 (Unwanted): Worker 중복 파싱 직렬화

**IF** 디바운스 창 내에 여러 content 변경이 발생하는 경우, **THEN** 시스템은 마지막 요청만 Worker에 전달한다(또는 이전 요청을 취소). **AND** 동일 content에 대해 중복 파싱을 수행하지 않는다.

#### REQ-IMG-LOAD-2-C-007 (State-Driven): Worker lifecycle (lazy spawn + 정리)

**WHILE** 세션이 활성 상태인 경우, 시스템은 Worker를 lazy하게(첫 SOFT 초과 파일 또는 첫 프리뷰 렌더 시) 생성한다. **AND** 파일 닫기·세션 종료 시 Worker를 정리한다(메모리 누수 방지). (OD-C 권장안 — lazy.)

### Group D — 임계값 정책 (3계층)

#### REQ-IMG-LOAD-2-D-001 (Ubiquitous): SOFT_THRESHOLD 명명 상수

시스템은 `SOFT_THRESHOLD`라는 명명된 상수를 정의하고, 이 값을 초과하는 `.md`/`.markdown` 파일에 대해 점진적 로딩 + 라인 폴딩을 활성화한다. (값은 OD-1에서 사용자 확정 — 제안 30MB.)

#### REQ-IMG-LOAD-2-D-002 (Ubiquitous): HARD_CEILING 명명 상수

시스템은 `HARD_CEILING`이라는 명명된 상수를 정의하고, 이 값을 초과하는 파일은 `UnsupportedFileViewer`로 라우팅하여 로드를 거부한다. (값은 OD-1에서 사용자 확정 — 제안 100MB.)

#### REQ-IMG-LOAD-2-D-003 (Ubiquitous): LINE_FOLD_THRESHOLD 명명 상수

시스템은 `LINE_FOLD_THRESHOLD`라는 명명된 상수를 정의하고, 단일 라인 길이가 이 값을 초과하면 자동 폴딩을 트리거한다(REQ-IMG-LOAD-2-A-003과 연동). (값은 OD-1에서 사용자 확정 — 제안 1MB. N1 직접 완화.)

#### REQ-IMG-LOAD-2-D-004 (State-Driven): SOFT 초과 — 점진적 로딩 + 폴딩

**WHILE** 파일 크기가 `SOFT_THRESHOLD`를 초과하고 `HARD_CEILING` 이하인 경우, 시스템은 편집을 허용한다. **AND** 점진적 로딩(REQ-IMG-LOAD-2-B-005, Axis B 머지 후)과 라인 폴딩(REQ-IMG-LOAD-2-A-003)을 활성화한다. **AND** 에디터 잠금 placeholder를 표시하지 않는다.

#### REQ-IMG-LOAD-2-D-005 (State-Driven): HARD 초과 — 로드 거부

**WHILE** 파일 크기가 `HARD_CEILING`을 초과하는 경우, 시스템은 `UnsupportedFileViewer`를 렌더링하고 에디터를 잠근다. **AND** content를 `''`로 세팅하고 `previewStatus='too-large'`로 라우팅한다(001 Group B 동작과 정합).

#### REQ-IMG-LOAD-2-D-006 (State-Driven): per-line 임계값 초과 자동 폴딩

**WHILE** 문서 내 단일 라인 길이가 `LINE_FOLD_THRESHOLD`를 초과하는 경우, 시스템은 해당 라인을 자동으로 fold한다(REQ-IMG-LOAD-2-A-003의 정책 선언 버전 — 임계값 상수와의 결합을 명시). (N1 직접 완화.)

#### REQ-IMG-LOAD-2-D-007 (Unwanted): 래스터/SVG 크기 가드 제외

**IF** 파일 확장자가 래스터 이미지(`.png`/`.jpg`/...) 또는 `.svg`인 경우, **THEN** 시스템은 본 SPEC의 SOFT/HARD/LINE_FOLD 임계값 변경을 적용하지 않는다. **AND** `SPEC-PREVIEW-008` 래스터/SVG 뷰어의 현행 라우팅과 내부 크기 처리는 유지된다. (001 Non-Goal #8 계승.)

## Threshold Constants (명명된 상수 — 구현 drift 방지)

| 상수 | 제안값 | 위치 | 용도 | OD |
|---|---|---|---|---|
| `SOFT_THRESHOLD` | `30 * 1024 * 1024` (30MB) | `src/lib/preview/previewLimits.ts` | 점진적 로딩 + 폴딩 활성화 한계 | OD-1 |
| `HARD_CEILING` | `100 * 1024 * 1024` (100MB) | `src/lib/preview/previewLimits.ts` | 로드 거부 한계(UnsupportedFileViewer) | OD-1 |
| `LINE_FOLD_THRESHOLD` | `1 * 1024 * 1024` (1MB) | `src/lib/preview/previewLimits.ts` | 단일 라인 자동 폴딩 트리거 | OD-1 |
| `STREAM_CHUNK_SIZE` | `256 * 1024` (256KB) | `src/lib/preview/previewLimits.ts` | `read_file_chunk` 기본 청크 크기 | OD-1 |
| `WORKER_DEBOUNCE_MS` | `300` (현행 `usePreview.ts:15` DEBOUNCE_MS와 동일) | `src/hooks/usePreview.ts` | Worker 파싱 디바운스 | (현행 유지) |
| `INPUT_RESPONSIVENESS_BUDGET_MS` | `5000` (5초) | 테스트 전용 상수 | REQ-IMG-LOAD-2-A-006 동결 판정 한계(Playwright) | OD-1 |
| `FILE_SIZE_THRESHOLD` (deprecated alias) | `5 * 1024 * 1024` (5MB) | `src/lib/preview/previewLimits.ts` | **삭제 금지** — `SPEC-PREVIEW-007` 회귀 방지용 alias. `SOFT_THRESHOLD`와 동일 값 또는 별도 5MB 유지(OD-2) | OD-2 |

> 모든 값은 OD-1에서 사용자가 확정한다. 제안값의 근거는 001 v1.0.0 감사(N1) 이후 "폴딩이 라인 단위 비용을 완전히 제거하지는 못한다"는 보수적 판단에 기반한다(001 v1.0.0이 제안한 50MB/200MB보다 낮춤).

## Design Notes (구현 메커니즘 — 참고용)

> 본 섹션은 run-phase 구현자 안내이며 REQ 본문이 아니다. 동일한 행동 결과를 내는 한 대체 구현을 허용한다.

### Axis A — 뷰포트 한정 + 폴딩

**뷰포트 한정 위젯 데코레이션** (`image-widget.ts` `buildDecorations`):

```typescript
// REQ-IMG-LOAD-2-A-001: visible viewport만 스캔.
// view.state.doc.toString() (full-doc copy) 제거.
import { EditorView, ViewPlugin, Decoration, WidgetType } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

export function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    // visible 범위의 텍스트만 추출 — 전체 doc 복사 회피
    const text = view.state.doc.sliceString(from, to);
    // base64 data URI는 단일 라인이므로, visible 라인만 정규식 실행
    for (const match of parseDataUriImage(text)) {
      // match.from/to는 visible 범위 내 로컬 오프셋 → 절대 오프셋 변환
      builder.add(from + match.from, from + match.to, Decoration.replace({ widget: new ImageWidget(...) }));
    }
  }
  return builder.finish();
}
```

**폴딩 익스텐션** (`markdown-extensions.ts`):

```typescript
import { codeFolding, foldGutter, defaultLanguageFolding } from '@codemirror/language';
import { StateEffect, StateField } from '@codemirror/state';

// REQ-IMG-LOAD-2-A-003: 거대 라인 자동 폴딩.
// defaultLanguageFolding은 마크다운 구조(헤딩/리스트 등)만 fold하므로,
// 라인 길이 기반 커스텀 fold 트리거를 별도 StateField로 추가.
const longLineFoldField = StateField.define<DecorationSet>({
  create(state) { return autoFoldLongLines(state); },
  update(value, tr) {
    if (!tr.docChanged) return value;
    return autoFoldLongLines(tr.state);  // LINE_FOLD_THRESHOLD 초과 라인 fold
  },
  provide: (f) => EditorView.decorations.from(f),
});
```

> OD-A: `codeFolding()` + `foldGutter()`를 추가할 때 기존 익스텐션과의 우선순위(`lineWrapping`, `imageWidgetExtension`의 `atomicRanges`, AI 카드 block widget)를 조정해야 한다. run phase에서 RED 테스트로 상호작용을 먼저 고정한다.

**이미지 삽입 폴딩 힌트** (`imageHandler.ts:18-29`):

```typescript
// REQ-IMG-LOAD-2-A-005: 삽입 직후 해당 라인이 임계값 초과면 fold.
export function insertImageMarkdown(view, relativePath, altText = 'image', pos?) {
  const insertPos = pos ?? view.state.selection.main.head;
  const markdown = `![${altText}](${relativePath})`;
  view.dispatch({ changes: { from: insertPos, to: insertPos, insert: markdown } });
  // 삽입된 라인 길이 체크 → LINE_FOLD_THRESHOLD 초과 시 fold effect dispatch
  if (markdown.length > LINE_FOLD_THRESHOLD) {
    view.dispatch({ effects: foldLineEffect.of(insertedLineFrom) });
  }
}
```

### Axis B — chunked 스트리밍 읽기 (UTF-8 경계 포함)

**Rust 청크 읽기** (`file_ops.rs`):

```rust
// REQ-IMG-LOAD-2-B-001..003: chunk 단위 읽기 + UTF-8 경계 안전.
#[tauri::command]
pub async fn read_file_chunk(path: String, offset: u64, len: usize) -> Result<String, String> {
    let path_buf = validate_path(&path)?;
    use std::io::{Read, Seek, SeekFrom};
    let mut file = std::fs::File::open(&path_buf).map_err(|e| format!("Failed to open: {}", e))?;
    file.seek(SeekFrom::Start(offset)).map_err(|e| format!("Failed to seek: {}", e))?;
    let mut buf = vec![0u8; len];
    let n = file.read(&mut buf).map_err(|e| format!("Failed to read: {}", e))?;
    buf.truncate(n);
    // REQ-B-002: 멀티바이트 시퀀스 중간 잘림 보정 — 마지막 완전 코드 포인트까지만.
    let safe_len = trim_to_utf8_boundary(&buf);
    let chunk = String::from_utf8_lossy(&buf[..safe_len]).into_owned();
    // REQ-B-006: 비-UTF-8은 from_utf8_lossy가 U+FFFD로 대체 (또는 전체 거부 — OD에서 선택)
    Ok(chunk)
}

/// 멀티바이트 시퀀스가 잘렸으면 그 시퀀스의 시작 바이트 직전으로 되돌린다.
/// REQ-B-003: 무한 루프 금지 — 반드시 단일 패스로 종료 (cargo 테스트로 단언).
fn trim_to_utf8_boundary(buf: &[u8]) -> usize {
    if buf.is_empty() { return 0; }
    let mut i = buf.len();
    // 뒤에서부터 continuation byte(0b10xxxxxx)를 추적하여 시퀀스 시작을 찾는다.
    // continuation byte가 아닌 리딩 바이트를 만나면 시퀀스 길이를 계산하고,
    // 시퀀스가 완전하지 않으면 그 시퀀스 시작 직전으로 자른다.
    // 단일 패스 보장: i는 항상 감소하며 0에서 종료.
    while i > 0 {
        i -= 1;
        if buf[i] & 0xC0 != 0x80 {
            // 리딩 바이트 발견 — 예상 시퀀스 길이 계산
            let expected = if buf[i] & 0xE0 == 0xC0 { 2 }
                else if buf[i] & 0xF0 == 0xE0 { 3 }
                else if buf[i] & 0xF8 == 0xF0 { 4 }
                else { 1 };  // ASCII
            if buf.len() - i >= expected {
                return buf.len();  // 마지막 시퀀스가 완전 → 전체 사용
            } else {
                return i;  // 시퀀스 잘림 → 시작 직전까지
            }
        }
        // continuation byte면 계속 리딩 바이트 탐색 (i 감소)
    }
    0  // 전체가 continuation byte인 비정상 입력 — 안전하게 0 반환 (루프 종료)
}
```

> REQ-B-003 cargo 테스트는 `trim_to_utf8_boundary`가 (a) 잘린 4바이트 시퀀스, (b) malformed byte, (c) 빈 입력, (d) ASCII-only 입력에 대해 반드시 유한 패스로 종료함을 단언한다. 001 v1.1.0 D4 잔여 인수의 직접 이행.

**점진적 append dispatch** (`MarkdownEditor.tsx`):

```typescript
// REQ-IMG-LOAD-2-B-005: 청크 도착 시 append dispatch.
async function streamFileIntoEditor(view: EditorView, path: string) {
  let offset = 0;
  const chunkSize = STREAM_CHUNK_SIZE;  // 256KB
  while (true) {
    const chunk = await readFileChunk(path, offset, chunkSize);
    if (chunk.length === 0) break;
    const docLen = view.state.doc.length;
    view.dispatch({ changes: { from: docLen, to: docLen, insert: chunk } });
    offset += Buffer.byteLength(chunk, 'utf-8');  // 바이트 오프셋 전진
    // chunk가 chunkSize보다 짧으면 EOF
    if (Buffer.byteLength(chunk, 'utf-8') < chunkSize) break;
  }
}
```

### Axis C — markdown-it Worker (generation counter + Shiki 소유)

**Worker 구조** (`src/lib/markdown/renderWorker.ts` — 신규):

```typescript
// REQ-IMG-LOAD-2-C-001..007: Worker 소유 마크다운 파싱 + Shiki.
// 메인 스레드는 postMessage로 content + generation 전달, Worker는 HTML 반환.
import MarkdownIt from 'markdown-it';
import { createHighlighter } from 'shiki';
// 모든 커스텀 플러그인을 Worker로 import (renderer.ts에서 이관)
import { dataLinePlugin } from './plugins/dataLine';
import { tableScrollPlugin } from './plugins/tableScroll';
// ... (tableCellLineBreakPlugin, extractInlineSvg, restoreSvgMarkers,
//      mermaidPlugin, markdownItKatex, imageResolverPlugin)

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;
// Worker 자체 Shiki 인스턴스 (REQ-C-005). 메인 스레드 싱글턴과 분리.

self.onmessage = async (e: MessageEvent<{ content: string; generation: number; isDark: boolean; mdFilePath: string | null }>) => {
  const { content, generation, isDark, mdFilePath } = e.data;
  try {
    if (!highlighter) highlighter = await createHighlighter({ themes: ['github-dark','github-light'], langs: [...] });
    const md = new MarkdownIt({ html: false, linkify: true, typographer: true,
      highlight: (code, lang) => { try { return highlighter!.codeToHtml(code, { lang: lang||'text', theme: isDark?'github-dark':'github-light' }); } catch { return `<pre><code>${md.utils.escapeHtml(code)}</code></pre>`; } }
    });
    md.enable('table'); md.enable('strikethrough');
    md.use(mermaidPlugin); md.use(markdownItKatex, { throwOnError: false });
    md.use(tableScrollPlugin); md.use(imageResolverPlugin, mdFilePath);
    md.use(dataLinePlugin); md.use(tableCellLineBreakPlugin);
    // SVG extract/restore는 Worker 내부 svgMap으로 캡슐화 — 메인 스레드는 마커만 받음
    const html = restoreSvgMarkers(md.render(extractInlineSvgPrepass(content)), svgMap);
    (self as any).postMessage({ generation, html, error: null });
  } catch (err) {
    (self as any).postMessage({ generation, html: null, error: String(err) });
  }
};
```

**메인 스레드 디스패처** (`usePreview.ts`):

```typescript
// REQ-IMG-LOAD-2-C-002: generation counter로 stale 폐기.
// REQ-IMG-LOAD-2-C-003: onerror 시 동기 렌더 fallback.
// REQ-IMG-LOAD-2-C-004: 파일 전환 시 generation 증가로 in-flight 폐기.
let renderGeneration = 0;
const worker = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' });

worker.onmessage = (e) => {
  const { generation, html, error } = e.data;
  if (generation !== renderGeneration) return;  // stale — 폐기
  if (error || !html) {
    renderMarkdownSync(content, highlighter, isDark).then(setHtml);  // 폴백 (REQ-C-003)
    return;
  }
  embedPreviewImages(html, currentFilePath).then(setHtml);  // IPC-bound는 메인 유지
};
worker.onerror = () => { /* 동기 렌더로 영구 폴백 */ };

// 파일 전환 시 (REQ-C-004):
renderGeneration++;  // 모든 in-flight 결과 폐기
```

> N4 정량화: `renderer.ts`에서 Worker로 이관할 커스텀 플러그인/규칙 수는 8개(`dataLinePlugin`, `tableScrollPlugin`, `tableCellLineBreakPlugin`, `extractInlineSvg`, `restoreSvgMarkers`, `mermaidPlugin`, `markdownItKatex`, `imageResolverPlugin`) + table/strikethrough enable 2개. Shiki 소유권 이관이 하드 파트(`highlight` 콜백이 `md.render` 내부에서 동기 실행되므로 Worker가 Shiki를 가져야 파싱 비용이 메인 스레드를 벗어남 — REQ-C-005 근거).
>
> 메인 스레드 유지 작업(DOM/IPC-bound): `sanitizeSvg`/DOMPurify(`PreviewRenderer.tsx:47-59,97`), mermaid client render(`:113-133`), `embedPreviewImages`(`usePreview.ts:55`의 `readImageAsBase64` IPC). Worker가 `data-mdedit-svg` 마커가 포함된 HTML만 반환하고 `svgMap`은 Worker 내부에 캡슐화되므로 SVG 마커 마셜링 부담이 없다(`getCodeProtectedRanges`는 callers에 반환값이 없으므로 코드 영역 마셜링도 없다).

## Exclusions (Non-Goals)

본 SPEC은 다음을 다루지 않는다:

1. **이미지 위젯의 신규 데코레이션 타입 추가** — `image-widget.ts`의 `ImageWidget` 시각 정보(썸네일/alt/MIME/size)는 변경하지 않는다. 본 SPEC은 뷰포트 한정(REQ-A-001)만 추가한다. WIDGET-001 REQ-2(위젯 시각 콘텐츠) 무변경.
2. **기본 모드를 `file-save`로 전환** — `inline-blob`이 기본값으로 유지된다(001 Non-Goal #2 계승).
3. **`inline-blob` 모드의 per-image 크기 검증 도입** — `read_image_as_base64`는 10MB 제한 없이 모든 파일을 읽는 현행 동작 유지(001 Non-Goal #1 계승). bloat된 파일은 사용자 책임.
4. **이미 bloat된 기존 파일의 마이그레이션 도구** — base64 data URI를 `./images/` 파일로 추출하는 도구는 별도 후속 SPEC(001 Non-Goal #3 계승).
5. **CodeMirror 자체의 뷰포트 렌더링 엔진 개조** — CodeMirror 6이 이미 뷰포트 기반 렌더링을 제공하므로 본 SPEC은 폴딩 익스텐션 추가에 그친다. 뷰포트 렌더링 자체를 다시 구현하지 않는다. (폴딩 플러그인이 라인 단위 비용을 충분히 제거하면 뷰포트 개조는 불필요 — run phase에서 확인.)
6. **AI 변경** — AI 제안 카드(`ai-suggestion-card.ts`)·AI 고스트 텍스트·AI 툴바는 본 SPEC 범위 밖. 폴딩 익스텐션과의 상호작용만 검증(OD-A).
7. **`SPEC-PREVIEW-008` 래스터/SVG 뷰어의 크기 가드 변경** — 래스터/SVG는 `asset://` OS 스트리밍을 사용하며 본 SPEC의 SOFT/HARD/LINE_FOLD 임계값을 적용하지 않는다(REQ-D-007, 001 Non-Goal #8 계승).
8. **Windows 자동화 CI** — 001과 동일 입장. Rust chunked 읽기의 Windows 변형은 POSIX와 동일 코드(`std::fs::File` 크로스 플랫폼)이므로 별도 Windows 수동 스모크는 불필요하나, Worker·CodeMirror 폴딩은 크로스 플랫폼 동일하다.
9. **클라우드 동기화·포맷 변환** — 본 SPEC은 로컬 대용량 파일 로딩 강건성만 다룬다.
10. **001 REQ 본문 수정** — 본 SPEC은 001의 REQ/acceptance를 수정하지 않는다. 001 frontmatter `follow_ups`에 이미 002가 명시되어 있으므로 001을 bump하지 않는다(과제 지시).
11. **`insertImageFromDialog` 시그니처 변경** — 001이 동결한 시그니처를 존중(001 Delta Map). 본 SPEC은 `insertImageMarkdown`(하위 헬퍼)에만 폴딩 힌트를 추가한다.
12. **스트리밍 쓰기(Write streaming)** — `write_file`은 001 Group B에서 원자화되었고, 저장은 전체 content를 한 번에 쓴다. 대용량 파일의 점진적 저장은 별도 후속 SPEC.

## Traceability

| Requirement | Test ID | Layer | Acceptance |
|---|---|---|---|
| REQ-IMG-LOAD-2-A-001 | UT-A1-001 | Unit (`buildDecorations` viewport-only, visible 범위 외 라인 미스캔 단언) | AC-2-A1 |
| REQ-IMG-LOAD-2-A-002 | UT-A1-002 + PT-A1-002 | Unit (viewportChanged 갱신) + Playwright (스크롤 후 위젯 출현) | AC-2-A2 |
| REQ-IMG-LOAD-2-A-003 | UT-A1-003 | Unit (`LINE_FOLD_THRESHOLD` 초과 라인 fold 단언) | AC-2-A3 |
| REQ-IMG-LOAD-2-A-004 | PT-A1-004 | Playwright (fold 토글 클릭) — must-pass, [feedback-jsdom-pointer-blindspot] | AC-2-A4 |
| REQ-IMG-LOAD-2-A-005 | UT-A1-005 | Unit (삽입 후 fold 트리거 + 두 진입점 대칭) | AC-2-A5 |
| REQ-IMG-LOAD-2-A-006 | PT-A1-006 | Playwright (대용량 파일 오픈/편집 시 `INPUT_RESPONSIVENESS_BUDGET_MS` 이내 응답) — must-pass | AC-2-A6 |
| REQ-IMG-LOAD-2-B-001 | UT-B1-001 + CT-B1-001 | Unit (IPC 래퍼) + cargo (offset/len/EOF) | AC-2-B1 |
| REQ-IMG-LOAD-2-B-002 | CT-B1-002 | cargo (멀티바이트 경계 단언) | AC-2-B2 |
| REQ-IMG-LOAD-2-B-003 | CT-B1-003 | cargo (truncated/malformed tail 유한 종료 — D4) | AC-2-B3 |
| REQ-IMG-LOAD-2-B-004 | (코드 리뷰) | Review (pull 모델 — 프런트엔드가 당김) | AC-2-B4 |
| REQ-IMG-LOAD-2-B-005 | UT-B1-005 + PT-B1-005 | Unit (append dispatch) + Playwright (점진적 렌더) | AC-2-B5 |
| REQ-IMG-LOAD-2-B-006 | CT-B1-006 | cargo (비-UTF-8 입력 — U+FFFD 또는 에러) | AC-2-B6 |
| REQ-IMG-LOAD-2-C-001 | UT-C1-001 + PT-C1-001 | Unit (Worker postMessage往返) + Playwright (파싱 중 입력 응답) | AC-2-C1 |
| REQ-IMG-LOAD-2-C-002 | UT-C1-002 | Unit (generation counter stale 폐기) | AC-2-C2 |
| REQ-IMG-LOAD-2-C-003 | UT-C1-003 + PT-C1-003 | Unit (onerror fallback) + Playwright (Worker 강제 크래시 시 동기 렌더) | AC-2-C3 |
| REQ-IMG-LOAD-2-C-004 | UT-C1-004 | Unit (파일 전환 시 in-flight 폐기) | AC-2-C4 |
| REQ-IMG-LOAD-2-C-005 | (코드 리뷰 + 회귀) | Review (highlight 콜백이 Worker 내부) + usePreview/exportHtml/CodeFileViewer 회귀 | AC-2-C5 |
| REQ-IMG-LOAD-2-C-006 | UT-C1-006 | Unit (디바운스 내 중복 요청 직렬화) | AC-2-C6 |
| REQ-IMG-LOAD-2-C-007 | UT-C1-007 | Unit (lazy spawn + 파일 닫기 시 terminate) | AC-2-C7 |
| REQ-IMG-LOAD-2-D-001 | UT-D1-001 | Unit (`SOFT_THRESHOLD` 상수 존재 + 값 단언) | AC-2-D1 |
| REQ-IMG-LOAD-2-D-002 | UT-D1-002 | Unit (`HARD_CEILING` 상수) | AC-2-D2 |
| REQ-IMG-LOAD-2-D-003 | UT-D1-003 | Unit (`LINE_FOLD_THRESHOLD` 상수) | AC-2-D3 |
| REQ-IMG-LOAD-2-D-004 | UT-D1-004 + PT-D1-004 | Unit (SOFT 초과 편집 허용) + Playwright (placeholder 미표시) | AC-2-D4 |
| REQ-IMG-LOAD-2-D-005 | UT-D1-005 | Unit (HARD 초과 unsupported 라우팅 — 001 Group B 회귀 정합) | AC-2-D5 |
| REQ-IMG-LOAD-2-D-006 | UT-D1-006 | Unit (per-line 초과 fold — A-003과 정책 결합) | AC-2-D6 |
| REQ-IMG-LOAD-2-D-007 | UT-D1-007 | Unit (래스터/SVG 임계값 제외 — PREVIEW-008 회귀 가드) | AC-2-D7 |
| (WIDGET-001 회귀 가드) | UT-REG-W1..W7 | Unit (WIDGET-001 REQ-1..7 보존 — source 보존/data-URI-only/click→cursor 등) | AC-2-REG |
| (001 Group B 회귀 가드) | 기존 UT-B1/B5, CT-B2, PT-B4 | 기존 (001 인수 — 본 SPEC 변경 후에도 green 유지) | (001 인수) |

> PT = Playwright must-pass. 포인터/폴드 토글·UI 동결 검증은 jsdom에 잡히지 않으므로 Playwright를 게이트로 둔다([feedback-jsdom-pointer-blindspot]). N3(Worker lifecycle)과 N1(동결)은 Playwright must-pass로만 정직하게 검증 가능하다.

## Quality Notes

- REQ 본문은 행동만 서술한다. Design Notes의 함수명·IPC·Rust 명령·Worker 구조는 참고용이며 run-phase 에이전트가 동일 결과를 내는 한 대체 구현을 허용한다([feedback-spec-verifiable-requirements]).
- 본 SPEC은 001 Non-Goal #4(뷰포트 렌더링/라인 폴딩), #5(markdown-it Worker), #6(스트리밍 읽기), #7(SOFT/HARD 임계값)을 의도적으로 인수한다. 001 REQ 본문은 변경하지 않고 본 SPEC frontmatter `related`로만 명시([feedback-spec-reversal-pattern] — 001의 이월 항목을 폐기가 아닌 인수로 처리).
- "pull 기반 백프레셔"(REQ-B-004), "Shiki Worker 소유"(REQ-C-005)는 단위 테스트로 강제 불가한 아키텍처 속성이므로 코드 리뷰 범위로 분리한다(acceptance.md Test Strategy Layer — [feedback-spec-verifiable-requirements] 패턴 2). 단, 행동 결과(메인 스레드 응답성, 파싱 비용 이동)는 Playwright/성능 테스트로 관측 가능.
- A+D만으로도 대용량 파일 편집이 가능해진다(폴딩이 라인 단위 비용 제거). B/C는 성능 최적화이므로 plan.md 마일스톤에서 A→D→B→C 순으로 단계화하여 각 마일스톤이 독자적 머지 가능성을 갖는다. 이 순서는 "folding alone이 freeze를 해소하면 B/C는 perf optimization"이라는 과제 지시(over-engineering 회피)에 부합한다.
- 본 SPEC은 `SPEC-IMG-WIDGET-001`의 미구현 제약(spec.md:165 viewport-bounding)을 최초로 이행한다. WIDGET-001 REQ-1..7 회귀 테스트(UT-REG-W1..W7)를 인수 조건에 명시하여 위젯 행동이 훼손되지 않음을 보장한다.
- 001 v1.1.0 D4 잔여(malformed/truncated UTF-8 처리 + 종료 테스트)를 REQ-IMG-LOAD-2-B-002/B-003로 명시적 인수한다. 이는 001 v1.0.0 Group C 의사코드에 잠재했던 무한 루프 결함이 002에서 재발하지 않도록 한다.
