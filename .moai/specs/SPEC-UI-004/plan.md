# SPEC-UI-004 — 구현 계획 (plan.md)

> Brownfield(기존 AppLayout/ResizablePanels/Header/uiStore 수정). development_mode = tdd → RED-GREEN-REFACTOR.
> Plan Review 게이트에서 사용자 승인 완료. 미세 결정 2건 확정: (1) 토글을 `ViewModeToggle` 별도 컴포넌트로 분리, (2) 활성 강조는 원래 `viewMode` 기준이고 `.html`→preview tooltip 힌트는 선택적(nice-to-have).

## 1. 설계 결정 (Design Decisions)

### (a) viewMode 상태 위치 및 영속화 — uiStore 확장, 추가 작업 불필요

`useUIStore`는 이미 `persist` 미들웨어(`name: 'mdedit-ui-store'`)로 **store 전체 상태를 localStorage에 직렬화**한다(theme·sidebarWidth·previewWidth 등이 이미 자동 영속화 중). 따라서 `viewMode` 필드를 추가하면 **추가 persist 설정 없이 자동 영속화**된다. theme와 정확히 동일한 메커니즘이므로 일관성이 보장된다.

```ts
export type ViewMode = 'split' | 'editor' | 'preview';
// UIState에 추가: viewMode: ViewMode; setViewMode: (mode: ViewMode) => void;
// 초기값: viewMode: 'split'
// 액션:   setViewMode: (mode) => set({ viewMode: mode })
```

컨벤션: enum이 아닌 string literal union(기존 `Theme`/`SaveStatus`/`ImageInsertMode`와 일치). 3-state이므로 `toggleX` 대신 명시적 `setViewMode(mode)`.

### (b) ResizablePanels의 모드별 렌더링 — store 직접 구독 + 너비 분기

`ResizablePanels`가 `useUIStore`에서 `viewMode`를, `useFileStore`에서 `currentFile`을 직접 구독한다(props drilling 회피, 기존 `sidebarWidth`/`previewWidth` 구독과 동일 패턴).

| effectiveViewMode | Editor 패널 | Editor↔Preview 구분선 | Preview 패널 |
|-------------------|-------------|----------------------|--------------|
| `split`(기본) | `editorWidth`(현 로직) | 표시 | `previewWidthStyle`(현 로직) |
| `editor` | `calc(100% - ${fixedWidthPx}px)` 전체 폭 | 숨김 | 렌더 안 함 |
| `preview` | 렌더 안 함 | 숨김 | `calc(100% - ${fixedWidthPx}px)` 전체 폭 |

**전체 폭 처리 핵심**: 단일 패널 모드에서는 `previewWidth` 퍼센트 비율을 무시하고 `calc(100% - ${fixedWidthPx}px)`(사이드바 + 구분선 제외 나머지 전부)를 부여한다. `fixedWidthPx`(사이드바 + 구분선) 계산은 기존 로직을 재사용한다. `previewWidth` 값 자체는 store에서 변경하지 않으므로 `split` 복귀 시 사용자가 조정한 비율이 그대로 유지된다.

구현 형태: 모드별로 `editorWidth`/`previewWidthStyle`을 계산하는 분기를 추가하고, JSX에서 `effectiveViewMode !== 'preview'`일 때만 Editor div를, `effectiveViewMode === 'split'`일 때만 구분선을, `effectiveViewMode !== 'editor'`일 때만 Preview div를 렌더한다.

### (c) `.html` 자동 미리보기 — effectiveViewMode 파생(렌더링 한정)

세 후보 비교:

| 후보 | 설명 | 평가 |
|------|------|------|
| A. effectiveViewMode 파생 (채택) | `viewMode === 'editor' && getFileViewType(currentFile) === 'html'`이면 렌더링상 `preview`로 취급. store `viewMode`는 `editor` 유지 | 깔끔. 비-html 전환 시 자동 editor 복귀. 사용자 의도(editor 선호) 보존. side effect 없음(멱등) |
| B. .html일 때 editor 버튼 비활성화 | 토글 편집 버튼 disabled | UX 혼란, store-UI 불일치 — 기각 |
| C. .html 진입 시 store viewMode를 preview로 강제 | side effect로 setViewMode | 사용자 선호 덮어씀, .md 복귀해도 preview 갇힘 — 기각 |

**채택: 후보 A**. 파생 위치는 **ResizablePanels**(이미 currentFile/viewMode를 구독하는 렌더 지점). AppLayout 변경 최소화.

```ts
const isHtmlFile = getFileViewType(currentFile) === 'html';
const effectiveViewMode: ViewMode =
  viewMode === 'editor' && isHtmlFile ? 'preview' : viewMode;
```

`effectiveViewMode`만 렌더링·너비 계산에 사용. 토글 active 표시는 원래 `viewMode` 기준(확정 결정 2).

### (d) 코드 파일(.py/.json 등)의 editor 모드 동작 — editor에 그대로 유지(확인)

`getFileViewType`이 `'code'`를 반환하는 파일은 AppLayout의 `isHtmlFile` 분기(`=== 'html'`)에 걸리지 않으므로 `MarkdownEditor`에 텍스트로 로드되어 **편집 가능**하다. 따라서 자동 미리보기 강등은 `.html`에만 적용하고, 코드 파일은 editor 모드에서 Editor에 그대로 표시된다. effectiveViewMode 파생 조건도 `=== 'html'`로 한정(`=== 'code'` 제외).

## 2. 영향/신규 파일

| 파일 | 변경 유형 | 핵심 작업 |
|------|-----------|-----------|
| `src/store/uiStore.ts` | [MODIFY] | `ViewMode` 타입, `viewMode`(기본 `'split'`), `setViewMode` 추가. persist 자동 |
| `src/components/layout/ViewModeToggle.tsx` | [NEW] | 3-버튼 세그먼티드 토글. store 직접 구독, active = 원래 viewMode |
| `src/components/layout/Header.tsx` | [MODIFY] | `ViewModeToggle` 배치. 기타 컨트롤 무변경 |
| `src/components/layout/ResizablePanels.tsx` | [MODIFY] | viewMode/currentFile 구독, effectiveViewMode 파생, 모드별 너비·조건부 렌더 |
| `src/components/layout/AppLayout.tsx` | [MODIFY] (소폭) | 기존 editorPanel 전달 유지, 시그니처 미세 조정만 |
| `src/test/uiStore.test.ts` | [MODIFY] | viewMode 기본값/setter/persist 테스트 추가 |
| `src/test/ResizablePanels.test.tsx` | [MODIFY] | 모드별 렌더·.html 자동 preview 테스트 추가 |
| `src/test/Header.test.tsx` | [MODIFY] | 토글 통합 렌더 확인(필요 시) |
| `src/test/ViewModeToggle.test.tsx` | [NEW] | 토글 단위 테스트(렌더·클릭·active) |

## 3. @MX 태그 대상 (code_comments = ko)

| 위치 | 태그 | 사유 |
|------|------|------|
| `uiStore.ts` 기존 ANCHOR 블록 | `@MX:ANCHOR` 업데이트 | `viewMode` 추가로 store API 표면 확장. SPEC-UI-004 참조 추가 |
| `ResizablePanels.tsx` 기존 ANCHOR(line 22) | `@MX:ANCHOR` 업데이트 | viewMode 분기로 핵심 레이아웃 변경. `@MX:REASON`에 모드별 너비 불변식 명시 |
| `ResizablePanels.tsx` effectiveViewMode 파생부 | `@MX:NOTE` 추가 | `.html`이면 editor→preview 강등하되 store는 보존한다는 비자명 규칙 설명(SPEC-UI-004 REQ-UI-004-004 참조) |
| `ViewModeToggle.tsx` | `@MX:NOTE` 추가 | 3-state 세그먼티드 컨트롤 의도 + 단축키 미지원 결정 기록 |
| 신규 미구현/미테스트 public(RED 단계) | `@MX:TODO` | GREEN 단계에서 제거 |

ANCHOR/WARN은 `@MX:REASON` 필수. 기존 파일에 이미 ANCHOR가 있으므로 신규 추가보다 업데이트 위주(파일당 3개 한도 준수).

## 4. Run-phase 분해 순서 (TDD)

의존 그래프상 store → 토글 컴포넌트 → Header 배선 → 패널 렌더 순으로 진행한다(하류가 상류 타입에 의존).

1. **uiStore `viewMode`** — RED: `viewMode` 기본값/`setViewMode`/persist 테스트 작성 → GREEN: `ViewMode` 타입·필드·액션 추가 → REFACTOR: ANCHOR 주석 업데이트.
2. **`ViewModeToggle` 컴포넌트** — RED: 렌더/클릭→viewMode 변경/active 표시 테스트 → GREEN: 3-버튼 토글 구현(store 구독, active = 원래 viewMode) → REFACTOR: 아이콘·접근성(aria-pressed) 정리.
3. **Header 배선** — `ViewModeToggle`를 Header에 배치. 기존 Header 테스트가 회귀 없이 통과하는지 확인. props 추가 없음.
4. **ResizablePanels 조건부 렌더 + effectiveViewMode** — RED: editor→preview 숨김·역방향·.html 자동 preview·previewWidth 보존 테스트 → GREEN: viewMode/currentFile 구독, effectiveViewMode 파생, 모드별 너비·조건부 렌더 구현 → REFACTOR: 너비 계산 분기 정리, ANCHOR/NOTE 주석.

각 단계 종료 시 전체 vitest 스위트를 돌려 기존 레이아웃/사이드바/프리뷰 회귀가 없는지 확인한다.

## 5. 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 단일 패널 표시 시 너비 계산 오류 | editor/preview-only에서 `calc((100% - fixedPx) * ratio)`를 그대로 쓰면 패널이 화면을 다 못 채움 | 단일 모드에서는 ratio 무시, `calc(100% - ${fixedWidthPx}px)` 전체 폭 부여. fixedWidthPx 계산 재사용 |
| persist 하이드레이션 타이밍 | rehydrate 전 첫 렌더에서 기본값(split)이 잠깐 보였다 저장값으로 깜빡일 수 있음 | zustand persist는 동기 localStorage라 통상 첫 렌더 전 hydrate 완료. theme가 이미 동일 방식이라 동일 보장. 깜빡임 관측 시에만 hydration 가드 검토(현재 불필요 추정) |
| 구분선 숨김 시 드래그 ref 잔존 | 단일 모드 진입 중 `isDraggingPreview` ref가 남을 수 있음 | 구분선 미렌더 시 마우스 이벤트 미발생으로 실질 무해. 안전상 모드 변경 시 드래그 ref 리셋은 선택적 |
| active 표시와 effectiveViewMode 불일치 | `.html`+editor 선택 시 버튼은 editor active인데 화면은 preview → 혼란 가능 | active 표시는 원래 `viewMode` 기준 유지(확정 결정 2). 선택적 tooltip 힌트로 보완 가능(nice-to-have) |
| previewWidth 보존 누락 | 단일 모드 갔다 split 복귀 시 사용자 비율 리셋되면 회귀 | 단일 모드에서 `setPreviewWidth` 미호출(렌더만 전체폭). store 값 불변 → 테스트로 검증 |
| AppLayout vs ResizablePanels의 .html 분기 중복 | AppLayout editorPanel은 이미 isHtmlFile 플레이스홀더 분기 보유. ResizablePanels에도 추가 시 이중 분기 | 역할 분리 명확화: AppLayout = 편집 불가 플레이스홀더(콘텐츠), ResizablePanels = 어느 패널을 보일지(레이아웃). 두 분기는 직교하며 충돌 없음 |
