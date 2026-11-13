---
id: SPEC-AI-017
title: "미리보기에서 가리켜 지시하기 — 구현 계획"
version: "0.2.2"
status: draft
created: 2026-11-13
updated: 2026-11-13
---

# SPEC-AI-017 구현 계획

## 등급과 방법론

- 등급: **Tier M** — 기존 운영 파일 12개(TS 10, Rust 2) + 새 파일 2개(순수 모듈 1, 컴포넌트 1) + e2e 1개 + 픽스처 4개, 예상 600~900줄(테스트 포함). 산출물 3종(spec·plan·acceptance) + progress.md.
- 방법론: TDD(RED → GREEN → REFACTOR). 대상 판정·줄 범위·낡음 판정·대상 정보·검증 분기·프롬프트 조립은 모두 순수 함수로 두고 먼저 실패하는 테스트를 쓴다.
- 실행 형태: 순차 서브에이전트 1개(코딩 위주, 파일 간 의존이 있음). 하위 에이전트를 `isolation: "worktree"` 로 띄우지 않는다.

## 구현 원칙

1. 새 장치보다 기존 경로: 카드(`startSuggestionCard`)·적용(`applySuggestion`)·자동 재요청(`onReRequest(…, 'exempt')`)·검증(`validateMarkdownTable`·`validateDiagram`)·정리(`runAiArtifactCleanup`)를 그대로 쓴다.
2. 다른 기능은 바이트까지 그대로: 프롬프트·claude 인자·codex 인자·카드 동작(REQ-AI17-016). `scope_clause`·`envelope_tags` 의 기존 출력은 바꾸지 않는다 — 가리키기 전용 함수를 새로 둔다(SPEC-AI-016 의 `research_scope_clause` 선례).
3. 포인터 순서가 걸린 동작(⌥ 누름 → 강조, ⌥+클릭 vs 클릭 vs 드래그 vs 링크)은 jsdom 만으로 판정하지 않는다. 순수 함수는 vitest, 실제 포인터 순서는 Playwright webkit(`e2e/`, `tauri-v2-ai-mock` 고정물)으로 확인한다(메모리 교훈: 포인터 순서 요구는 실제 브라우저 층이 필요).
4. 외부 CLI 프롬프트는 계획 단계 실측 파일(`spike/captures/*`)과 바이트 비교로만 고정한다. 문서로 추정한 프롬프트를 만들지 않는다.

## Milestones (우선순위 순서)

### M1 — 실제 브라우저 클릭 확인과 픽스처 (Priority: High)
- **먼저 잴 것**: Playwright webkit 에서 다이어그램 노드(flowchart·sequence)의 `text`/`path` 위 ⌥+클릭 이벤트가 `closest('g.pele-node[data-id]')` 로 ID 를 돌려주는지, 표 칸의 ⌥+클릭이 텍스트 선택을 만들지 않는지 확인한다(S3 은 jsdom 까지만 확인). 결과를 progress.md 에 남긴다. 안 되면 STOP 하고 보고한다(설계 전제가 깨짐).
- `spike/captures/{table-column,diagram-node}.{system,user}.txt` 4개를 `src-tauri/tests/fixtures/point-table-system.txt`·`point-table-user.txt`·`point-diagram-system.txt`·`point-diagram-user.txt` 로 **복사**한다(SPEC `spike/` 는 증거로 남긴다).

### M2 — 백엔드 프롬프트 (Priority: High)
- `prompt.rs`: `AiFeature::PointTable(지시, 대상정보)`·`PointDiagram(지시, 대상정보)` (또는 같은 정보를 담는 동등 형태), `resolve` 에 `point-table`·`point-diagram`, 작업 문장 상수 2개, 가리키기 범위 절 함수, `build_point_prompt`(태그 충돌 회피는 두 이름에 같은 접미사). `allows_web()` 거짓.
- `mod.rs`: `AiRequestArgs.pointer`(`#[serde(default)]`), 가리키기 분기(앞뒤 문맥 미사용), `pointer` 없음·빈 값 → 오류.
- 테스트: 픽스처와 바이트 비교(AC-AI17-010), 다른 기능 조립 결과 불변(AC-AI17-013), 태그 충돌.

### M3 — 미리보기 대응과 대상 판정 (Priority: High)
- `renderer.ts`: `renderMarkdown` 의 파서 구성(옵션·플러그인)을 공용 함수로 꺼낸다(렌더 출력 불변, 기존 테스트 무수정 통과). `tableValidate.ts`: `splitRow` 공개.
- `usePreview.ts`·`MarkdownPreview.tsx`: 렌더 소스를 HTML 과 한 상태로.
- 새 `src/lib/preview/pointTarget.ts`: (a) 이벤트 대상 → 대상 종류(열·칸·노드·없음), (b) 순번 블록 찾기(D11: DOM 의 k번째 `table`/`.mermaid-container` ↔ 공용 파서로 파싱한 k번째 `table_open`/mermaid `fence`, 개수·`data-diagram`(`previewDiagramInput` 기준)·머리 칸 수 일치 확인) → 블록 줄 범위·블록 텍스트(표 줄 / 펜스 전체·펜스 안 코드)·행 위치, 최상위 여부, 노드 ID 낱말 경계(유니코드), (c) 에디터 문서와의 낡음 판정(⌥+클릭·보내기 두 시점), (d) 대상 정보 문자열, (e) 길이 판정(`evaluateSelectionGuard` 재사용). 여러 줄 인라인 `<svg>` 가 앞에 있는 문서로 순번 대응을 확인한다(AC-AI17-004). 테스트는 실제 `renderMarkdown` 출력 HTML 과 `renderDiagram` SVG 로.

### M4 — 입력창·강조·카드 (Priority: High)
- `PreviewRenderer.tsx`: 캡처 단계 `click`(⌥ 이고 대상이면 기본 동작·전파 막고 입력창), `keydown`/`keyup`/`pointermove` 로 ⌥ 강조, 카드 구독(`subscribeActiveCard`)으로 대상 강조 유지·해제, 다시 그린 뒤 같은 순번 블록 텍스트가 같을 때만 강조 복원(REQ-AI17-014). 노드 강조는 같은 `data-id` 의 모든 `g.pele-node`(D16). ⌥+클릭·보내기 시점에 `effectiveAiEnabled`·보기 모드 판정(REQ-AI17-001).
- 새 `PointInstructionPopover.tsx`: 대상 요약·지시 입력·Enter(조합 중 무시 — `isComposing`·`keyCode 229`, SPEC-AI-015 선례)/Shift+Enter/Esc/바깥 클릭·길이 안내·낡음 안내.
- 요청: `buildSelectionRequest` 와 같은 경로로 `AiRequestArgs`(`presetKind` `point-*`, `pointer`, 앞뒤 문맥 없음) → `startSuggestionCard`(범위 = 블록 전체) → 에디터 카드 위치로 스크롤. 로그인 안 됨 → 기존 온보딩.
- `ai-length-guard.ts`: `AiPresetKind` 에 `point-table`·`point-diagram`(변환 계열 판정 — 6,000~12,000자 「아래에 삽입」 전용).
- `ai-suggestion-card.ts`: `point-*` 검증 분기 — 표 하나뿐·`selection` 기준 정규화 비교로 원본과 같으면 실패·**사용자 시작 요청 묶음마다** 자동 재요청 1회(기존 `tableAttempts`·`diagramAttempts` 는 쓰지 않고 가리키기 전용 묶음 카운터를 ↻·「다시 시도」 진입 시 0으로)·두 번째 실패 오류 카드·목록 폴백 없음. 기존 `table`·`diagram` 분기는 그대로, 표 렌더 미리보기(주입형, `renderMermaid` 와 같은 방식, 이미지·링크는 글자로 — D17), 다이어그램 펜스 적용 조건에 `point-diagram` 포함, 적용 버튼 = 「바꾸기」 기본 + 「아래에 삽입」(SPEC-AI-013 판정 그대로).
- `aiOffEffects.ts`: 입력창·강조 정리.
- `ipc.ts`: `pointer?: string`.

### M5 — e2e 와 통합 확인 (Priority: Medium)
- 새 `e2e/preview-pointing.spec.ts`(webkit, `e2e/fixtures/tauri-v2-ai-mock.ts` — `ai_request` 페이로드를 `window.__AI_MOCK__.requests` 에 기록하고 `resultText` 로 응답을 정한다): AC-AI17-014 의 포인터 순서·요청·정리·스크롤 동기 시나리오.
- 실 CLI 1회씩(claude haiku, codex 기본)으로 표·다이어그램 가리키기 왕복을 앱에서 확인(AC-AI17-015, macOS). Windows 는 AC-AI17-016.

## 변경 파일 목록 (코디네이터 겹침 확인용)

| 파일 | 마일스톤 |
|------|----------|
| `src-tauri/src/ai/prompt.rs` | M2 |
| `src-tauri/src/ai/mod.rs` | M2 |
| `src-tauri/tests/fixtures/point-{table,diagram}-{system,user}.txt` (신규 4개) | M1 |
| `src/lib/markdown/renderer.ts` (+ 기존 테스트 유지) | M3 |
| `src/lib/ai/tableValidate.ts` | M3 |
| `src/hooks/usePreview.ts` (+ 테스트) | M3 |
| `src/components/preview/MarkdownPreview.tsx` | M3 |
| `src/lib/preview/pointTarget.ts` (신규, + 테스트) | M3 |
| `src/components/preview/PreviewRenderer.tsx` (+ 테스트) | M4 |
| `src/components/preview/PointInstructionPopover.tsx` (신규, + 테스트) | M4 |
| `src/components/editor/extensions/ai-length-guard.ts` | M4 |
| `src/components/editor/extensions/ai-suggestion-card.ts` (+ 테스트) | M4 |
| `src/lib/ai/aiOffEffects.ts` | M4 |
| `src/lib/tauri/ipc.ts` | M4 |
| `src/index.css`(또는 미리보기 스타일 파일 — 강조 테두리·입력창) | M4 |
| `e2e/preview-pointing.spec.ts` (신규) | M5 |

다른 진행 중 카드와 겹칠 수 있는 곳: `ai-suggestion-card.ts`·`prompt.rs`·`mod.rs`(SPEC-AI-012~016 이 모두 거친 파일), `PreviewRenderer.tsx`·`usePreview.ts`·`renderer.ts`(미리보기 계열 SPEC). origin/main 1f3d4a5 기준으로 작성했다.

## Risks & Mitigations

| 위험 | 영향 | 대응 |
|------|------|------|
| 실제 브라우저에서 SVG 안쪽 요소 클릭이 노드 ID 로 이어지지 않음(S3 은 jsdom) | 다이어그램 가리키기가 안 됨 | M1 첫 작업으로 webkit 에서 확인. 실패하면 STOP·보고(노드 영역 좌표 판정 등 대안은 사용자 결정) |
| 순번 대응이 깨지는 마크업(마크다운 표·mermaid 펜스 밖에서 `table`/`.mermaid-container` 가 생김, A4) | 엉뚱한 블록을 가리킴 | 낡음 판정이 블록 텍스트를 비교하므로 어긋나면 요청하지 않는다. AC-AI17-004 의 인라인 `<svg>` 문서로 확인. 스크롤 동기는 바꾸지 않는다(AC-AI17-014 8단계 회귀 확인) |
| Windows 에서 Alt 를 떼면 창 메뉴 활성화(A3) | 입력창이 뜬 뒤 포커스를 메뉴가 가져갈 수 있음 | AC-AI17-016 수동. 재현되면 대상 위 ⌥+클릭 뒤 첫 `keyup`(Alt)에서 `preventDefault` |
| ⌥+드래그(일부 앱의 사각 선택) 같은 기존 습관과 충돌 | 선택 동작이 달라질 수 있음 | 이 기능은 `click` 만 가져간다. 드래그 시작(`pointerdown` 후 이동)은 건드리지 않는다. AC-AI17-014 |
| haiku 가 지시를 무시하고 원본을 돌려줌(S5 초안 문구에서 4회 중 2회) | 바뀐 것 없는 결과 | 정본 문구(개정, 3회 중 3회 반영) + 원본 동일을 실패로 보고 1회 자동 재요청(D8) |
| 검토 중 블록 위쪽 편집으로 적용이 막힘(D12) | 다시 가리켜야 함 | 문서 손상 없음(stale). 범위 추적은 모든 AI 카드에 걸친 변경이라 범위 밖 |
| 다른 칸·노드까지 바뀜 | 의도하지 않은 변경 | 렌더된 결과를 보고 확정, 되돌리기 1회. 차이 강조는 범위 밖 |
| 미리보기 렌더와 에디터 문서의 어긋남(300ms 지연) | 엉뚱한 행·열을 가리킴 | D11 낡음 판정 — 다르면 요청하지 않음 |
| Rust 테스트가 CI 에서 돌지 않음(`release.yml:11` 머리말, SPEC-AI-016 확인) | Rust 회귀를 CI 가 못 잡음 | M5 에서 로컬 `cargo test` 원문을 progress.md 에 남긴다 |

## Out of Scope

spec.md 「Exclusions」 를 따른다.
