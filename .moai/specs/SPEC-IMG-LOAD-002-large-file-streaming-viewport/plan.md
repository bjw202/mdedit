# Implementation Plan: SPEC-IMG-LOAD-002

> **범위**: `SPEC-IMG-LOAD-001` v1.1.0에서 이월된 Group C 전체를 4축(A/B/C/D)으로 전개하되, **v1.1.0부터 RUN 범위를 A+D로 축소**하고 B+C는 Phase 2 (Conditional)로 이관한다.

## HISTORY

- **2026-08-12 v1.1.0 (RUN 범위 축소 + 감사 결함 수정 + linchpin 테스트 추가)**:
  - **RUN 범위 축소**: Group A(뷰포트 위젯 바운딩 + 라인 폴딩) + Group D(임계값 3계층)만 RUN 게이트로 확정. Group B(스트리밍) + Group C(Worker)는 "Phase 2 (Conditional)"로 이관 — PT-A1-006b 결과에 따라서만 구현 여부 결정.
  - **D1 수정 — 폴딩 과잉 주장 철회**: 폴딩이 "Lezer 토크나이제이션 비용 제거"를 한다는 v1.0.0 주장을 철회. **REQ-A-001(뷰포트 위젯 바운딩 — `view.state.doc.toString()` full-doc copy 제거)이 실제 동결 제거 주체**이며, REQ-A-003(폴딩)은 디스플레이 비용 절감용으로만 작용. 본 plan.md의 Technical Approach·Risks·Architecture Direction 전면 수정.
  - **D2 수정 — 폴드 메커니즘**: `longLineFoldField` always-on StateField → `foldEffect` dispatch 패턴(`foldState` 통합).
  - **D3 수정 — Buffer 미존재**: Axis B pseudocode `Buffer.byteLength` → `new TextEncoder().encode(chunk).length`.
  - **PT-A1-006b (linchpin) 추가**: 거대 base64 라인이 뷰포트로 스크롤인 시 Lezer 동결을 직접 측정. 실패 시 Re-planning Gate 트리거.
  - **OD finalize**: OD-1/2/3/B/C APPROVED, OD-A 하이브리드 APPROVED with foldEffect constraint. 본 plan.md "Decided Decisions" 섹션으로 통합.
  - 마일스톤 재구조: M1(A+D RUN, 단일 머지) / M2(conditional Lezer-viewport 신규 SPEC) / M3(optional B+C perf).
  - **Precondition Gate·Run-Phase Decision Rule 신규 추가**: 001 PR #61 머지 선행 + PT-A1-006b 결과에 따른 런 분기.
- **2026-08-12 v1.0.0**: 최초 작성. 001 v1.1.0에서 이월된 Group C를 4축(A/B/C/D)으로 전개.

## Precondition Gate

[HARD] **`SPEC-IMG-LOAD-001` (PR #61) MUST be merged to `main` before Milestone 1 run starts.**

- **이유**: Delta Map의 file:line은 post-001-merge 베이스라인 기준. 001 Group A(삽입 호출부 모드 분기) + Group B(대용량 안전망)가 머지되지 않은 상태에서 run하면 라인 번호가 맞지 않아 회귀 위험이 있다.
- **확인 방법**: 런 에이전트는 Phase 1 시작 전 `git log --oneline -- src/lib/image/imageHandler.ts src-tauri/src/commands/file_ops.rs | grep -i "SPEC-IMG-LOAD-001"` 또는 `gh pr view 61 --json state`로 머지 상태를 확인.
- 미머지 시 런 에이전트는 정지하고 보고 (Re-planning Gate).

## Run-Phase Decision Rule (Re-planning Gate)

[HARD] **PT-A1-006b(linchpin) 결과가 Phase 2 활성화 여부를 결정한다.**

| PT-A1-006b 결과 | 런 에이전트 행동 |
|---|---|
| **PASS** (time-to-first-paint ≤ `INPUT_RESPONSIVENESS_BUDGET_MS` 5s) | Phase 1(A+D)만으로 사용자 동결이 해소됨. Phase 2(B/C)는 무기한 연기(perf optimization으로만 가치). Milestone 3은 사용자 명시 opt-in 시에만. |
| **FAIL** (동결 지속) | 런 에이전트는 **반드시 정지하고 보고**. Phase 2(B/C)를 구현하려 시도하지 말 것 — 스트리밍(B)은 로드 타이밍, Worker(C)는 프리뷰 파싱 비용이며 Lezer 편집기 토크나이제이션과 무관. 대신 **신규 후속 SPEC**(`SPEC-IMG-LOAD-003` 또는 `SPEC-CM-LEZER-VIEWPORT-001` — 뷰포트 바운디드/증분 Lezer 파싱)이 필요 (Milestone 2). |

본 규칙은 [feedback-spec-reversal-pattern]을 따른다 — 의도적 설계 결정(폴딩=동결 해소 가정)이 런 단계에서 깨지면, 본 SPEC을 개정하는 대신 신규 SPEC으로 supersede.

## Technical Approach

**RUN 범위 (Phase 1)**: Axis A(뷰포트 위젯 바운딩 + 라인 폴딩) + Axis D(임계값 3계층). 두 축을 **하나의 마일스톤(Milestone 1)으로 통합**하여 독자적으로 머지 가능.

**Phase 2 (Conditional)**: Axis B(chunked 스트리밍) + Axis C(markdown-it Worker). PT-A1-006b 결과에 따라서만 활성화(Milestone 3).

**A+D가 RUN 범위인 근거 (D1 수정 반영)**:

1. **REQ-A-001(뷰포트 위젯 바운딩)이 동결 제거 주체**: `image-widget.ts:155-170`의 `view.state.doc.toString()` full-doc copy가 `docChanged`마다 발생하는 것이 편집 동결의 직접 원인. 이를 `view.visibleRanges`/`view.viewportLineBlocks` 기반 부분 스캔으로 교체하면 일반 케이스의 동결이 제거된다. WIDGET-001 spec.md:165 미구현 제약의 최초 이행.
2. **REQ-A-003(폴딩)은 디스플레이 비용 절감 전용**: 폴딩은 뷰 계층(렌더링·페인트) 비용에서만 거대 라인을 제외한다. Lezer 파스트리 토크나이제이션은 `state.doc`을 `viewport.to + 100000`까지 독립적으로 수행하므로 폴딩과 무관(`node_modules/@codemirror/language/dist/index.js:612-625` 감사 확증).
3. **REQ-D(임계값)는 오픈을 허용**: 5MB 단일 하드 블록을 SOFT(30MB)/HARD(100MB)/LINE_FOLD(1MB) 3계층으로 재정의하여 5~30MB 파일이 편집 가능해진다.
4. **A+D만으로 사용자 가치 전달**: 사용자가 보고한 동결(REQ-A-001 full-doc copy 비용)이 해소되고 대용량 파일(5~30MB)이 편집 가능해진다. **B/C는 추가 완화일 뿐 필수가 아니다** — 과제 지시(over-engineering 회피)에 부합.

**폴딩 메커니즘 (D2 수정)**: `longLineFoldField` StateField always-on 패턴 대신 `foldEffect` dispatch 패턴 채택 — `@codemirror/language` `foldState`와 통합되어 REQ-A-004(토글)가 작동. `imageHandler.ts:18-29`의 폴딩 힌트와 동일한 `foldEffect.of({from, to})` 패턴으로 일관성 확보.

**최소 변경 원칙**: 기존 IPC·상태 필드·함수 시그니처를 유지. `insertImageFromDialog`(001 동결 시그니처)와 `insertImageMarkdown`(`imageHandler.ts:18-29`) 시그니처를 그대로 두고 폴딩 힌트를 내부에 추가. `FILE_SIZE_THRESHOLD`는 deprecated alias로 남겨 SPEC-PREVIEW-007 회귀를 막는다(OD-2).

**신규 의존성**: 없음. `@codemirror/language` ^6.12.1이 폴딩 API(`codeFolding`/`foldGutter`/`foldState`/`foldEffect`)를 이미 포함하므로 CodeMirror 측 패키지 추가가 불필요. Worker는 브라우저 표준 `Worker` API 사용. Rust chunked 읽기는 `std::fs::File` + `std::io::{Read, Seek}` 표준 라이브러리만 사용.

## Reproduction-First Test Strategy (TDD RED)

[HARD] 각 마일스톤의 첫 단계는 사용자 보고 증상을 재현하는 실패 테스트 작성. CLAUDE.md Section 7 Rule 4 준수.

### Phase 1 재생산 (A+D — RUN scope)

1. **UT-A1-001 신규** (`src/test/image-widget.test.ts` 확장): `buildDecorations`가 visible viewport 외부의 data URI를 스캔하지 않음을 단언 → **현재 `image-widget.ts:155-170`의 `view.state.doc.toString()` full-doc copy에서 실패** (전체 문서 스캔).
2. **UT-A1-003 신규**: `LINE_FOLD_THRESHOLD` 초과 단일 라인이 fold decoration을 받음을 단언 → **현재 폴딩 익스텐션 부재로 실패**.
3. **UT-A1-005 신규** (`src/test/imageHandler.test.ts` 확장): `insertImageMarkdown` 호출 후 임계값 초과 시 fold effect dispatch 단언 → **현재 fold 트리거 부재로 실패**.
4. **PT-A1-006 신규** (Playwright): 4MB `.md`(거대 base64 포함) 오픈 후 입력 → `INPUT_RESPONSIVENESS_BUDGET_MS`(5s) 이내 첫 paint 단언 → **현재 Lezer 라인 토크나이제이션 + full-doc copy로 동결, 실패**.
5. **PT-A1-006b 신규 (linchpin GATE)** (Playwright): 4MB `.md` 첫 화면은 일반 텍스트, 거대 base64 라인이 폴드 바로 아래. 스크롤하여 base64 라인이 뷰포트로 진입 → 글자 입력 → time-to-first-paint 측정 → 5s 이내 단언. **본 테스트가 Phase 2(B/C) 활성화 여부를 결정한다** (Run-Phase Decision Rule). spec.md "Residual Freeze Risk" + acceptance.md AC-2-A6b 참조.
6. **UT-D1-001~003 신규** (`src/test/previewLimits.test.ts` 생성): `SOFT_THRESHOLD`/`HARD_CEILING`/`LINE_FOLD_THRESHOLD` 상수 존재 + 제안값(30MB/100MB/1MB) 단언 → **현재 `FILE_SIZE_THRESHOLD`만 존재, 실패**.
7. **UT-D1-004 신규**: 20MB `.md` 파일이 `unsupported`가 아닌 편집 가능 상태로 라우팅됨 단언 → **현재 5MB `FILE_SIZE_THRESHOLD`로 `too-large`, 실패**.
8. **UT-D1-007 신규** (PREVIEW-008 회귀 가드): `.png`/`.svg`가 임계값 변경에 영향받지 않고 현행 라우팅 유지 단언.

### Phase 2 재생산 (B+C — Conditional, PT-A1-006b FAIL이어도 M3 user opt-in 시에만)

9. **CT-B1-001 신규** (cargo): `read_file_chunk(path, 0, 1024)`가 첫 1024 바이트를 올바른 UTF-8로 반환 단언 → 커맨드 부재로 컴파일 실패.
10. **CT-B1-002 신규** (D4 — 멀티바이트 경계): 청크 경계가 4바이트 UTF-8 시퀀스 중간에 끊어질 때 유효 UTF-8 반환 단언.
11. **CT-B1-003 신규** (D4 — 무한 루프 금지): `trim_to_utf8_boundary`가 잘린 시퀀스·malformed·빈 입력에 대해 유한 패스 종료 단언 (타임아웃 5s).
12. **UT-B1-001/005 신규**: IPC 래퍼 + append dispatch (dirty 가드 포함 — REQ-B-005).
13. **UT-C1-001~004/006/007 신규**: Worker postMessage + generation + onerror 폴백 + 파일 전환 취소 + 중복 직렬화 + lifecycle.
14. **PT-B1-005, PT-C1-001/003 신규** (Playwright): 점진적 렌더 + 파싱 중 응답 + Worker 크래시 폴백.

### WIDGET-001 회귀 가드

15. **UT-REG-W1..W7 신규** (`src/test/image-widget.regression.test.ts` 생성): WIDGET-001 REQ-1..7(source 보존·data-URI-only·click→cursor·동적 갱신·테마 적응 등)이 Phase 1(A) 변경 후에도 동작함을 단언. Phase 1 RED 이전에 baseline 먼저 작성 → green 확인 후 구현 내내 green 유지.

**RED 완료 기준**: Phase 1의 1~8번 + 회귀 가드 15번이 실패 상태로 존재. Phase 2의 9~14번은 M3(user opt-in) 시에만 작성. 기존 001 Group A+B 테스트는 수정하지 않는다.

## Milestones

> 시간 추정은 사용하지 않는다 ([HARD] coding-standards.md). 우선순위 라벨과 위상 순서로만 표시.

### Milestone 1: Phase 1 (RUN SCOPE) — Axis A + Axis D

**Priority: High** (최고 사용자 가치 — REQ-A-001 full-doc copy 제거가 편집 동결 직접 제거 + 임계값 상향으로 대용량 편집 허용)

**독립 머지 가능**: 본 마일스톤은 Phase 2(B/C)와 독립적으로 머지될 수 있다. A+D 머지 시점에 사용자는 대용량 파일(5~30MB)을 열고 편집할 수 있다.

**REQ 범위**:
- REQ-A-001 (뷰포트 위젯 바운딩 — `view.visibleRanges`/`view.viewportLineBlocks`)
- REQ-A-002 (viewportChanged 갱신)
- REQ-A-003 (거대 라인 자동 폴딩 — `foldEffect` dispatch against `foldState`, D2)
- REQ-A-004 (폴드 토글)
- REQ-A-005 (삽입 시 폴딩 힌트 — 2 UI gesture → 4 call site, D6)
- REQ-A-006 (대용량 편집 응답 — PT-A1-006)
- REQ-D-001~005/007 (SOFT/HARD/LINE_FOLD 임계값 + `FILE_SIZE_THRESHOLD` deprecated alias + 래스터/SVG 제외)
- WIDGET-001 REQ-1..7 회귀 가드

**GATING 테스트**: PT-A1-006b (linchpin). 본 테스트의 PASS/FAIL이 Phase 2(M3) 활성화 및 M2 분기 여부를 결정한다.

**단계**:
1. UT-REG-W1..W7 (WIDGET-001 회귀 가드) baseline 먼저 작성 → green 확인 후 Phase 1 구현 내내 green 유지
2. UT-A1-001/003/005, UT-D1-001~005/007 신규 추가 (RED 확인)
3. PT-A1-006, PT-A1-006b 신규 추가 (RED 확인 — 4MB 파일 오픈/스크롤 후 입력 응답)
4. `image-widget.ts:155-170` (`buildDecorations`) 수정: `view.state.doc.toString()` 제거 → `view.visibleRanges` 기반 부분 스캔 (REQ-A-001)
5. `image-widget.ts:185-189` (`update`) 수정: `docChanged` + `viewportChanged`에서 갱신 (REQ-A-002)
6. `markdown-extensions.ts:90-149` 수정: `codeFolding()` + `foldGutter()` + `foldEffect` dispatch 패턴 추가 (REQ-A-003, D2)
7. `imageHandler.ts:18-29` (`insertImageMarkdown`) 수정: 삽입 후 fold 힌트 (REQ-A-005)
8. `previewLimits.ts` 수정: `SOFT_THRESHOLD`/`HARD_CEILING`/`LINE_FOLD_THRESHOLD` 추가 + `FILE_SIZE_THRESHOLD` deprecated alias 유지 (REQ-D-001~003, OD-2)
9. `useFileSystem.ts:215` 수정: SOFT/HARD 분기 (REQ-D-004/005)
10. `AppLayout.tsx:373-374` (`isViewOnly`) 수정: HARD 초과 시에만 잠금 (REQ-D-005)
11. UT/PT 통과 (GREEN)
12. **OD-A 해소 검증**: `lineWrapping`·`atomicRanges`(image-widget.ts:193-197)·AI 카드 block widget(`ai-suggestion-card.ts`)·AI selection toolbar(`ai-selection-toolbar.ts:717`)와의 우선순위를 RED 테스트로 고정

**Files**:
- `src/components/editor/extensions/image-widget.ts`
- `src/components/editor/extensions/markdown-extensions.ts`
- `src/lib/image/imageHandler.ts`
- `src/lib/preview/previewLimits.ts`
- `src/hooks/useFileSystem.ts`
- `src/components/layout/AppLayout.tsx`
- `src/test/image-widget.test.ts` (확장)
- `src/test/image-widget.regression.test.ts` (신규 — WIDGET-001 회귀)
- `src/test/imageHandler.test.ts` (확장)
- `src/test/previewLimits.test.ts` (신규)
- `src/test/useFileSystem.test.ts` (확장)
- `tests/` Playwright PT-A1-006/PT-A1-006b 추가

**머지 게이트**: PT-A1-006(기본 동결) PASS + UT-REG-W1..W7 green + 001 Group B/PREVIEW-007/008 회귀 green. **PT-A1-006b는 이 시점에서 PASS 또는 FAIL 어느 쪽이어도 M1 머지를 차단하지 않는다** — PT-A1-006b 결과는 M2/M3 활성화 여부를 결정할 뿐.

**사용자 가치**: A+D 머지로 사용자가 보고한 편집 동결(REQ-A-001 full-doc copy)이 제거되고 5~30MB `.md` 파일이 편집 가능해진다. 스트리밍/Worker 없이도 달성된다.

### Milestone 2: Conditional — Lezer Viewport SPEC (PT-A1-006b FAIL 시에만)

**Priority: High (조건부)** — PT-A1-006b가 FAIL일 때만 활성화.

**중요**: 본 마일스톤은 **본 SPEC(SPEC-IMG-LOAD-002)의 구현이 아니다**. PT-A1-006b FAIL 시 런 에이전트는 본 SPEC의 Phase 2(B/C)로 넘어가지 말고, **신규 후속 SPEC**을 생성해야 한다 (Run-Phase Decision Rule).

**신규 SPEC 후보**:
- `SPEC-IMG-LOAD-003` 또는 `SPEC-CM-LEZER-VIEWPORT-001`: 뷰포트 바운디드/증분 Lezer 파싱. CodeMirror의 Lezer 파서가 `viewport.to + 100000`까지 파싱하는 기본 동작을 뷰포트 범위로 제한하거나 증분 파싱으로 전환.

**왜 Phase 2(B/C)가 아닌가**:
- 스트리밍(B)은 파일 로드 타이밍만 다룬다 — Lezer 편집기 토크나이제이션과 무관.
- Worker(C)는 프리뷰 마크다운 파싱 비용만 메인 스레드에서 벗어나게 한다 — Lezer 편집기 토크나이제이션(`@codemirror/lang-markdown`)과 무관.
- 따라서 B/C 구현으로 PT-A1-006b 동결(base64 라인 뷰포트 진입 시 Lezer parse-ahead)이 해소되지 않는다.

**단계**:
1. 런 에이전트 정지 + 보고 (Re-planning Gate — 진행률 정체 보고)
2. MoAI가 사용자에게 신규 SPEC 생성 확인 (AskUserQuestion)
3. `manager-spec`이 `SPEC-IMG-LOAD-003`(또는 `SPEC-CM-LEZER-VIEWPORT-001`) 생성 — 뷰포트 바운디드/증분 Lezer 파싱
4. 본 SPEC(SPEC-IMG-LOAD-002)은 M1(A+D) 머지로 종료. Phase 2(B/C)는 M3로 이월(사용자 opt-in 시).

### Milestone 3: Optional perf — Phase 2 (B+C) (user opt-in only)

**Priority: Low** (순수 perf optimization — 사용자가 명시적으로 opt-in할 때만)

**활성화 조건**:
- PT-A1-006b PASS 후, 사용자가 추가 성능 최적화(오픈 동결 완화·프리뷰 파싱 오프로드)를 원할 때, 또는
- M2의 신규 SPEC이 Lezer 동결을 해소한 후 부가적 완화가 필요할 때.

**REQ 범위**:
- REQ-B-001~006 (chunked 스트리밍 + UTF-8 경계 + append dispatch with dirty 가드 — REQ-B-005)
- REQ-C-001~007 (Worker 파싱 + generation + 폴백 + Shiki Worker 소유 + lifecycle — REQ-C-007 lazy 단일 트리거)

**단계 (Axis B — chunked 스트리밍)**:
1. CT-B1-001~003/006 (cargo, D4 포함), UT-B1-001/005 (dirty 가드 포함), PT-B1-005 신규 (RED)
2. `file_ops.rs` 수정: `read_file_chunk(path, offset, len) -> Result<String, String>` 커맨드 + `trim_to_utf8_boundary` 유틸리티 (REQ-B-001~003/006)
3. `src/lib/tauri/ipc.ts` 수정: `readFileChunk(path, offset, len)` 래퍼 추가
4. `MarkdownEditor.tsx:103-113` 수정: 스트리밍 로드 경로에서 점진적 append dispatch (REQ-B-005). **dirty 가드 체크 선행** (SPEC-FS-003). 단, SOFT 미만 파일은 기존 단일 `readFile` 경로 유지 (회귀 없음)
5. `useFileSystem.ts` 수정: SOFT 초과 파일은 `readFileChunk` 스트리밍 경로로 라우팅
6. CT/UT/PT 통과 (GREEN)

**단계 (Axis C — markdown-it Worker)**:
7. UT-C1-001~004/006/007, PT-C1-001/003 신규 (RED)
8. `src/lib/markdown/renderWorker.ts` 신규: Worker 소유 마크다운 파싱 + Shiki + 커스텀 플러그인 이관 (REQ-C-001/005)
9. `renderer.ts:207-250,379-428` 수정: throwaway MarkdownIt 제거, `renderMarkdownSync`(폴백용 동기 경로)만 남기고 Worker 경로가 우선 (REQ-C-001/003)
10. `codeHighlight.ts` 수정: Worker용 Shiki init 헬퍼 추가 (메인 스레드 싱글턴은 유지 — REQ-C-005, fan_in >= 4 회귀 없음)
11. `usePreview.ts:15,49-68` 수정: Worker `postMessage` + generation counter + onerror 폴백 (REQ-C-002/003/004/006/007, lazy spawn at first preview render — D11)
12. UT/PT 통과 (GREEN)

**Files** (Phase 2):
- `src-tauri/src/commands/file_ops.rs` (`read_file_chunk` + `trim_to_utf8_boundary`)
- `src-tauri/src/lib.rs` (`read_file_chunk` 커맨드 등록)
- `src/lib/tauri/ipc.ts`
- `src/components/editor/MarkdownEditor.tsx`
- `src/hooks/useFileSystem.ts`
- `src/lib/markdown/renderWorker.ts` (신규)
- `src/lib/markdown/renderer.ts`
- `src/lib/markdown/codeHighlight.ts`
- `src/hooks/usePreview.ts`
- `src-tauri/src/commands/file_ops.rs` 테스트 모듈
- `src/test/renderWorker.test.ts` (신규)
- `src/test/usePreview.test.ts` (확장)
- `tests/` Playwright PT-B1-005, PT-C1-001/003

## Architecture Design Direction

```
[M1: Axis A — 뷰포트 한정 위젯]
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
[M1: Axis A — 라인 폴딩 (foldEffect dispatch — D2)]
  ↓
codeFolding() + foldGutter() + foldEffect dispatch against foldState
  ↓
LINE_FOLD_THRESHOLD 초과 라인 감지 → foldEffect.of({from, to}) dispatch
  ↓
foldState가 Decoration.fold 적용 (뷰 계층 전용 — Lezer 비용은 무관, D1)
  ↓
사용자 클릭 → unfold effect dispatch → 토글 (REQ-A-004, Playwright must-pass)
```

```
[M1: REQ-A-001이 동결 제거하는 메커니즘 (D1 핵심)]
  ↓
docChanged 트리거
  ↓
[BEFORE] image-widget.ts:155-170: view.state.doc.toString() → 전체 doc 복사 → 글로벌 정규식 → 동결
  ↓
[AFTER]  buildDecorations: view.visibleRanges만 순회 → sliceString(from, to) 부분 복사 → 동결 제거
  ↓
[AFTER]  폴딩(foldState)은 디스플레이 비용만 절감 — Lezer 토크나이제이션 비용은 무관
```

```
[M3: Axis B — chunked 스트리밍 (Phase 2)]
  ↓
readFileChunk(path, offset, len) → Result<String, String>
  ↓
trim_to_utf8_boundary(buf) → 안전한 UTF-8 청크 (D4 — 무한 루프 방지)
  ↓
프런트엔드: dirty 가드 점검(REQ-B-005) → while (chunk.length > 0) { append dispatch; offset += byteLen(TextEncoder, D3) }
  ↓
점진적 렌더 (REQ-B-005, dirty 가드 포함)
```

```
[M3: Axis C — Worker 파싱 (Phase 2)]
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
  ↓
lazy spawn at first preview render (REQ-C-007, D11 — 단일 트리거)
```

## Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| **N1 — Lezer 라인 단위 토크나이제이션이 폴딩/뷰포트 한정으로 제거되지 않음 (D1 수정)** | High | REQ-A-001(뷰포트 위젯 바운딩)이 `docChanged`마다의 full-doc copy 동결을 제거하는 실제 주체. 폴딩(REQ-A-003)은 디스플레이 비용만 절감. **잔여 동결**(거대 base64 라인이 뷰포트로 스크롤인 시 Lezer parse-ahead `viewport.to + 100000`)은 PT-A1-006b가 측정 → FAIL 시 M2(신규 Lezer-viewport SPEC)로 분기. B/C(M3)는 해소 불가. |
| **N2 — Channel 백프레셔 부재** | Low | chunked pull 방식(OD-3)으로 해소. Rust가 밀어넣지 않고 프런트엔드가 당김. Phase 2(B). |
| **N3 — Worker lifecycle (크래시/teardown/중복/취소)** | High | REQ-C-002(generation)·REQ-C-003(onerror 폴백)·REQ-C-004(파일 전환 취소)·REQ-C-006(중복 직렬화)·REQ-C-007(lazy spawn + 정리)로 전부 명시적 인수. PT-C1-003으로 폴백 검증. Phase 2(C). |
| **N4 — 커스텀 플러그인 마이그레이션 비용** | Medium | 8개 플러그인 + 2개 enable(table/strikethrough)을 Worker로 이관. Shiki 소유권 이관이 하드 파트(OD-B). spec.md Design Notes에 정량화. Phase 2(C). |
| 폴딩 익스텐션이 `atomicRanges`(image-widget.ts:193-197)와 충돌 | High | OD-A — RED 테스트로 상호작용 고정. foldEffect dispatch 패턴(D2)으로 foldState 통합. 위젯 라인은 fold 대상 제외 또는 특수 처리 설계. |
| AI 카드 block widget(`ai-suggestion-card.ts`)·AI selection toolbar(`ai-selection-toolbar.ts:717`)와 폴딩 상호작용 | Medium | OD-A — UT-REG-W1..W7과 동일한 회귀 가드 패턴을 AI 위젯에도 적용. 본 SPEC은 AI 코드를 수정하지 않으므로 폴딩 익스텐션 추가만 검증. |
| Worker가 `embedPreviewImages`(IPC-bound)를 호출할 수 없어 이미지 깨짐 | High | Design Notes 명시: Worker는 HTML 문자열만 반환, `embedPreviewImages`(`usePreview.ts:55`)는 메인 스레드 유지. Worker가 `data-mdedit-svg` 마커만 넘기고 `svgMap`은 내부 캡슐화. Phase 2(C). |
| Shiki Worker 이관이 메인 스레드 싱글턴 소비자(usePreview/exportHtml/CodeFileViewer)에 회귀 | Medium | REQ-C-005 — 메인 싱글턴 유지 + Worker 자체 인스턴스. fan_in >= 4 소비자 회귀 테스트 green 유지. Phase 2(C). |
| `FILE_SIZE_THRESHOLD` deprecated alias 제거가 SPEC-PREVIEW-007 회귀 | Medium | OD-2 — alias를 유지(값은 SOFT 또는 별도 5MB). run phase에서 `grep`으로 모든 consumer를 확인. |
| chunked 읽기가 비-UTF-8 파일에서 크래시 | Medium | REQ-B-006 — `String::from_utf8_lossy`(U+FFFD) 또는 전체 에러. CT-B1-006으로 단언. Phase 2(B). |
| **PT-A1-006b FAIL 시 런 에이전트가 B/C(M3)로 넘어가 동결 해소 시도** | High | Run-Phase Decision Rule로 차단 — FAIL 시 정지+보고, M2 신규 Lezer-viewport SPEC로 분기. B/C는 Lezer 편집기 토크나이제이션과 무관함을 명시. |
| 거대 base64 라인의 `Decoration.fold` 비용 자체가 동결 | Medium | UT-A1-003에서 fold decoration 생성 비용 측정. 필요 시 `Decoration.replace`로 대체(시각적 축소만)하여 디스플레이만 최적화하는 fallback 설계. |
| Playwright `INPUT_RESPONSIVENESS_BUDGET_MS`(5s)가 CI 환경에서 너무 타이트 | Low | PT-A1-006/006b 로컬 must-pass, CI에서는 warning-only(OD-1). 동결 자체(30초+)는 여전히 검출 가능. |

## Decided Decisions (v1.1.0 — 모두 확정)

> v1.0.0의 "Open Decisions" 섹션은 v1.1.0에서 모두 decided로 전환되었다. 사용자 annotation 완료.

### OD-1: 임계값·상수값 — APPROVED

- `SOFT_THRESHOLD` = `30 * 1024 * 1024` (30MB)
- `HARD_CEILING` = `100 * 1024 * 1024` (100MB)
- `LINE_FOLD_THRESHOLD` = `1 * 1024 * 1024` (1MB)
- `STREAM_CHUNK_SIZE` = `256 * 1024` (256KB)
- `INPUT_RESPONSIVENESS_BUDGET_MS` = `5000` (5s — 로컬 must-pass, CI warning-only)

**근거**: 001 v1.0.0 감사(N1) 이후 폴딩이 Lezer 비용을 완전 제거 못한다는 보수적 판단에서 50/200MB → 30/100MB로 하향. 모든 값은 명명 상수(REQ-D-001~003)로 drift 방지.

### OD-2: `FILE_SIZE_THRESHOLD` deprecated alias — APPROVED

`FILE_SIZE_THRESHOLD = SOFT_THRESHOLD`로 alias 유지. 모든 기존 consumer(`useFileSystem.ts:215`)는 새 SOFT/HARD 분기로 마이그레이션. run phase에서 `grep`으로 미전환 consumer 검증. SPEC-PREVIEW-007 회귀 방지.

### OD-3: Channel vs chunked — APPROVED (chunked)

`read_file_chunk(path, offset, len) -> Result<String, String>` 채택. 백프레셔(pull 모델, N2 해소)·기존 `invoke<>` 패턴 재사용·`core:default` 적합·취소 단순(프런트엔드가 다음 호출을 멈추기만 하면 종료). Phase 2(B).

### OD-A: 폼딩 전략 — APPROVED (하이브리드 + foldEffect constraint)

뷰포트 한정은 `image-widget.ts`에 반영(REQ-A-001). 폴딩은 일반 `codeFolding()` + `foldEffect` dispatch 패턴(D2 수정 — `longLineFoldField` always-on StateField가 아님)으로 `foldState` 통합. RED 테스트로 `atomicRanges`/`lineWrapping`/AI 카드 block widget/AI selection toolbar와의 우선순위 고정.

### OD-B: Shiki 소유권 — APPROVED (Worker 소유)

Worker가 자체 Shiki 인스턴스 소유(`highlight` 콜백이 `md.render` 내부 동기 실행이므로). 메인 싱글턴은 usePreview/exportHtml/CodeFileViewer용 유지(fan_in >= 4 회귀 없음). 단점: Worker 초기화 시 Shiki 로드 비용 → OD-C lazy spawn과 조합. Phase 2(C).

### OD-C: Worker spawn 시점 — APPROVED (lazy, 단일 트리거)

**첫 프리뷰 렌더 시점**에 lazy 생성(D11 — v1.0.0의 "첫 SOFT 초과 파일 또는 첫 프리뷰 렌더" 이중 옵션에서 **단일 옵션**으로 통합). Shiki 로드 비용 지연 효과. 단점: 첫 파싱에 Worker 생성 오버헤드(일회성, 무시 가능). Phase 2(C).

## Dependencies

- 신규 라이브러리 의존성: 없음
- Rust crate 추가: 없음 (`std::fs::File`, `std::io::{Read, Seek}`만 사용)
- 기존 IPC 재사용: `readFile`, `readFileSize`(001), `writeFile`(001 원자화), `saveFileAs`
- 기존 IPC 확장: 신규 `read_file_chunk` (Phase 2, Axis B)
- CodeMirror 패키지 재사용: `@codemirror/language` ^6.12.1(`codeFolding`/`foldGutter`/`foldState`/`foldEffect` 포함, 이미 의존)
- 기존 상태 재사용: `useUIStore.imageInsertMode`, `useEditorStore.currentFilePath`/`content`/`dirty`, `useFileStore.previewStatus`/`fileTree`
- **선행 의존**: `SPEC-IMG-LOAD-001` (PR #61) main 머지 (Precondition Gate)

## Traceability

| Milestone | Requirements | Tests |
|---|---|---|
| **M1 (Phase 1 — A+D RUN SCOPE)** | REQ-IMG-LOAD-2-A-001~006, REQ-IMG-LOAD-2-D-001~005/007 + WIDGET-001 회귀(REQ-1~7) | UT-A1-001/003/005, UT-D1-001~005/007 (RED→GREEN), PT-A1-006 (Playwright must-pass), **PT-A1-006b (linchpin GATE)**, UT-REG-W1..W7 (회귀 가드) |
| **M2 (Conditional — Lezer viewport SPEC)** | 본 SPEC 범위 외 — 신규 SPEC-IMG-LOAD-003 또는 SPEC-CM-LEZER-VIEWPORT-001 (뷰포트 바운디드/증분 Lezer 파싱) | PT-A1-006b FAIL 시에만 활성화 |
| **M3 (Optional perf — Phase 2 B+C)** | REQ-IMG-LOAD-2-B-001~006, REQ-IMG-LOAD-2-C-001~007 | CT-B1-001~003/006 (cargo, D4 포함), UT-B1-001/005 (dirty 가드), PT-B1-005, UT-C1-001~004/006/007, PT-C1-001/003 (user opt-in 시에만) |
