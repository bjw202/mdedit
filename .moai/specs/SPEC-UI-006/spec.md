---
id: SPEC-UI-006
version: "1.0.1"
status: draft
created: "2026-07-15"
updated: "2026-07-15"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-UI-002
  - SPEC-UI-005
  - SPEC-PREVIEW-007
tags:
  - ui
  - reskin
  - design-system
  - theming
  - tokens
  - fonts
  - icons
  - presentation-only
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-15 | jw | 최초 SPEC 작성 — Claude Design 핸드오프(`# mdedit UI redesign.zip`)를 채택한 **전면 UI 비주얼 리스킨**. 전략 1(핸드오프 CSS 직접 적용): `mdedit-tokens.css` + `mdedit-components.css` 로드, JSX className을 `.md-*` 컴포넌트 클래스로 surface 단위 교체, `data-theme` 테마 브리지, 3종 폰트 로컬 번들, 30개 Lucide SVG 인라인 아이콘. **표현 계층만 변경, 동작/로직 무변경**이 하드 제약. 구현은 `feature/SPEC-UI-006-ui-reskin` 브랜치에서 `/moai run`으로 진행. |
| 1.0.1 | 2026-07-15 | jw | 결정 확정 2건 반영: (1) 3-파일 세트 완성(plan.md / acceptance.md 추가). (2) **[DECIDED] 페인 레이아웃 = 기존 `ResizablePanels` 드래그-투-리사이즈 유지**, 핸드오프 고정 CSS grid 트랙(`232px 6px 1fr 6px 1fr`) 미채택. 신규 REQ-UI-006-020, AC-UI-006-014 추가; Surface 매핑·Technical Approach·Exclusions에 반영. |

## Summary

`mdedit` (Tauri v2 + React 18 + TypeScript) 데스크톱 마크다운 에디터의 **전체 UI를 Claude Design 핸드오프 디자인 시스템으로 리스킨**한다. 스틸-블루 액센트(라이트 `#5980a6` / 다크 `#7ea6cd`)의 차분한 라이팅-툴 미학을 적용하며, 다음을 도입한다:

- **시맨틱 토큰 CSS**(`mdedit-tokens.css`) + **컴포넌트 클래스 CSS**(`mdedit-components.css`)를 앱에 로드(토큰 먼저, 컴포넌트 나중).
- 현재 임시방편 Tailwind 유틸리티 + 리터럴 파이프(`|`) + 이모지 아이콘으로 구성된 JSX className을 핸드오프의 `.md-*` 컴포넌트 클래스로 **surface 단위 교체**.
- 앱이 현재 `.dark` 클래스로 토글하는 것과 **병행하여** `<html>`에 `data-theme="dark"|"light"`를 설정하는 **테마 브리지**.
- Barlow / Barlow Condensed / IBM Plex Mono 3종 폰트를 **로컬 번들**(오프라인 데스크톱 앱).
- 핸드오프의 30개 Lucide SVG를 **로컬 인라인 아이콘**으로 도입(런타임 의존성 추가 없음).

이 SPEC의 [HARD] 불변식은 **동작·로직 제로 변경**이다: 이벤트 핸들러, 스토어 로직, Tauri IPC, CodeMirror 확장, 마크다운 렌더링, export 로직, 스크롤 싱크, 파일 IO는 일절 손대지 않는다. 변경 범위는 className/마크업(아이콘·라벨), CSS 파일, 테마 이펙트의 브리지 한 줄, 폰트 에셋, 아이콘 컴포넌트로 한정된다.

## Background & Rationale

### 현재 상태의 문제

현재 UI는 컴포넌트별로 임의의 Tailwind 유틸리티 클래스를 직접 나열하고, 구분자로 리터럴 `|` 파이프를, 아이콘으로 이모지(☀️, 🌙)와 텍스트 글리프(☰, `▼`, `●`, `A-`/`A+`)를 사용한다. 시각적 일관성·다크모드 대비·접근성(아이콘 라벨, 포커스 표시)이 표준화되어 있지 않다. `tailwind.config.js`의 `theme.extend`는 비어 있고 디자인 토큰이 없다.

### 핸드오프 디자인 시스템

Claude Design 핸드오프(`.moai/design/# mdedit UI redesign.zip`)는 다음을 제공한다:

- `tokens/mdedit-tokens.css`: 시맨틱 CSS 변수. 라이트(`:root`) + 다크(`[data-theme="dark"]`). 색상 역할(`--md-bg`, `--md-surface`, `--md-surface-raised`, `--md-border`, `--md-text-*`, `--md-accent*`, `--md-danger/success/dirty`, `--md-selection`, `--md-code-bg`, `--md-divider-pane`), 타입 스케일(`--md-fs-*`, `--md-font-ui/display/mono`), 간격(`--md-space-1..6`), 반경(`--md-radius-sm/md/lg`), 그림자(`--md-shadow-sm/md/lg`), 모션(`--md-dur-*`, `--md-ease`).
- `tokens/mdedit-components.css`: 모든 앱 surface에 대한 `.md-*` 컴포넌트 클래스(토큰만 참조). live 의사클래스(`:hover`/`:focus-visible`/`:active`)와 정적 modifier(`.is-hover`/`.is-active`/`.is-selected`/`.is-focused`/`.is-disabled`)를 모두 배선.
- `icons/*.svg`: 30개 Lucide 아이콘(stroke 1.5, `stroke="currentColor"`).
- 폰트: Barlow(UI), Barlow Condensed(워드마크/프리뷰 헤딩), IBM Plex Mono(에디터).

### 통합 전략 (사용자 확정, 재검토 금지)

**전략 1 — 핸드오프 CSS 직접 채택.** 핸드오프 CSS를 앱에 로드하고 기존 className을 `.md-*` 클래스로 surface 단위 교체한다. Tailwind는 `.md-*`가 커버하지 않는 부분에 계속 사용 가능하다.

- **테마 브리지**: 핸드오프는 `<html>`의 `data-theme="dark"`로 다크모드를 키잉하지만, 앱의 `useTheme`은 `.dark` 클래스를 토글한다(`src/hooks/useTheme.ts:14-30`). 브리지 = 테마 이펙트가 `.dark` 클래스 토글과 **병행하여** `document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')`도 설정하도록 한다. 기존 light/dark/system 상태 머신은 무변경으로 계속 동작한다.
- **폰트 기본값**: 3종 폰트를 **로컬**로 번들(`public/` 또는 `src` 하위에 vendored woff2)한다. 런타임 Google Fonts CDN 의존은 도입하지 않는다(오프라인 데스크톱 앱). Google Fonts `@import`는 명시적 임시 폴백으로만 사용 가능.
- **아이콘 기본값**: 30개 SVG를 로컬 React 컴포넌트/에셋으로 인라인한다(`lucide-react` 등 런타임 의존성 추가 없음).
- **[DECIDED] 페인 레이아웃**: 기존 `ResizablePanels.tsx`의 **드래그-투-리사이즈 동작을 유지**한다. 핸드오프의 고정 CSS grid(`.md-app`/`.md-body` `232px 6px 1fr 6px 1fr`)는 채택하지 않는다. 스플리터/pane에는 시각 토큰(`--md-divider-pane`, `--md-surface`/`--md-bg`)만 적용한다. 트랙 사이징은 명시적으로 범위 밖(Exclusions). 이 결정으로 드래그 리사이즈는 "동작 무변경" 불변식 하에 보존된다.

### 관련 SPEC과의 관계

- **SPEC-UI-002**(파일 트리 UI), **SPEC-UI-005**(컨텍스트 메뉴 Copy Path/Name + Footer 트랜지언트 메시지)의 마크업/동작을 **대체하지 않고 시각만 리스킨**한다.
- **SPEC-PREVIEW-007**(전체 파일 노출 + `UnsupportedFileViewer`)의 프리뷰 라우팅·플레이스홀더 동작을 무변경으로 유지하되, 해당 surface의 시각만 `.md-*`로 리스킨한다. `data-testid="unsupported-file-viewer"`, `data-testid="html-view-only-placeholder"` 등 셀렉터는 보존한다.

## Scope

### In Scope

- 토큰 CSS + 컴포넌트 CSS를 앱 번들에 로드(로드 순서: 토큰 → 컴포넌트). 앱 루트를 `.md-root` / `.md-app`로 래핑.
- `useTheme` 이펙트에 `data-theme` 속성 설정 한 줄 추가(브리지). 기존 `.dark` 클래스 토글 유지.
- 3종 폰트(Barlow, Barlow Condensed, IBM Plex Mono) 로컬 번들 + `@font-face` 선언.
- 30개 Lucide SVG를 로컬 인라인 아이콘 컴포넌트/에셋으로 도입, 기존 파이프·이모지·텍스트 글리프 아이콘 대체.
- surface 단위 className 교체(아래 Surface → Class 매핑 표): 타이틀바, 버튼, Export 메뉴, 세그먼트 토글(뷰 모드 / 이미지 모드), 폰트 스테퍼, 사이드바 + 검색, 파일 트리(모든 행 상태), 에디터 툴바, 에디터 크롬(거터/선택/스크롤바), 프리뷰, 페인 디바이더, 상태 바.
- 키보드 포커스 = 2px `--md-accent` 아웃라인(브라우저 기본 아웃라인 대체). dirty 표시 = `--md-dirty` 점.
- 기존 `aria-label` / `data-testid` / `role` 보존(E2E 셀렉터 안정성).
- 이모지/글리프 리터럴을 검증하던 vitest 단위 테스트의 **어서션 갱신**(동작 어서션은 약화 금지, 접근성 마크업 어서션으로 전환).

### Out of Scope (Exclusions)

`## Exclusions (What NOT to Build)` 섹션 참조. 요약: 동작/로직 변경, 신규 기능, 신규 런타임 의존성, 마크다운 렌더 로직, export 로직, CodeMirror 확장, Rust 백엔드, 상태 머신 변경은 모두 범위 밖.

## Surface → Class Mapping (핸드오프 README 기준)

| Surface | 대상 파일 | `.md-*` 클래스 |
|---------|-----------|----------------|
| App shell | `layout/AppLayout.tsx` | `.md-root`, `.md-app`(titlebar/body/statusbar 세로 구성) — **주의: 핸드오프 `.md-app`/`.md-body`의 고정 CSS grid 트랙(`232px 6px 1fr 6px 1fr`)은 채택하지 않음. 세로 3영역 구성과 토큰(색/폰트)만 적용, 본문 pane 레이아웃은 기존 `ResizablePanels` 유지.** 아래 [DECIDED] 참조 |
| Title bar | `layout/Header.tsx` | `.md-titlebar`, `.md-wordmark`, `.md-vdiv`, `.md-filename` + `.md-dirty-dot` |
| Buttons | `layout/Header.tsx` | `.md-btn`, `.md-btn-primary`, `.md-icon-btn` |
| Export menu | `layout/Header.tsx` | `.md-menu`, `.md-menu-item`(`.kbd`), `.md-menu-sep` |
| Segmented toggle | `layout/ViewModeToggle.tsx`, `settings/ImageModeToggle.tsx` | `.md-seg`, `.md-seg-opt` |
| Font stepper | `layout/Header.tsx` | `.md-stepper`(`button`, `.val`) |
| Sidebar + search | `sidebar/FileExplorer.tsx`, `sidebar/FileSearch.tsx` | `.md-sidebar`, `.md-sidebar-head`, `.md-search` |
| File tree | `sidebar/FileTree.tsx`, `sidebar/FileTreeNode.tsx` | `.md-tree`, `.md-tree-row`(`.folder`, `.open`, `.md-tree-indent`), 상태: `.is-selected`/`.is-focused` |
| Editor toolbar | `editor/EditorToolbar.tsx` | `.md-toolbar`, `.md-tool-btn`, `.md-tool-sep` |
| Editor chrome | `editor/MarkdownEditor.tsx` | `.md-editorpane`, `.md-editor`, `.md-gutter`, `.md-code` (CodeMirror 확장/로직 무변경, 크롬만) |
| Preview | `preview/PreviewContainer.tsx`, `preview/MarkdownPreview.tsx`, `preview/PreviewRenderer.tsx`, `preview/CodeFileViewer.tsx`, `preview/HtmlFileViewer.tsx`, `preview/UnsupportedFileViewer.tsx` | `.md-previewpane`, `.md-preview`(h1–h3, code, pre, table, blockquote) |
| Pane divider | `layout/ResizablePanels.tsx` | `.md-pane-divider` (시각만; **드래그 리사이즈 동작·트랙 사이징은 무변경**, 아래 [DECIDED] 참조) |
| Status bar | `layout/Footer.tsx` | `.md-statusbar`, `.md-status-item`(`.saved`/`.dirty`), `.md-status-toggle` |
| Global | `src/index.css`, `tailwind.config.js` | 토큰/컴포넌트 CSS import, `@font-face`, 기존 CodeMirror image-widget CSS 유지 |

## Icon Mapping (파이프/이모지/글리프 → Lucide SVG)

| 현재 글리프 | 위치 | Lucide 아이콘 |
|-------------|------|---------------|
| ☰ | 사이드바 토글 | `panel-left` |
| ☀️ / 🌙 | 테마 토글 | `sun` / `moon` |
| `A-` / `A+` | 폰트 스테퍼 | `minus` / `plus` |
| `▼` | Export 드롭다운 | `chevron-down` |
| `●` | dirty 표시 | `circle` / `--md-dirty` 점 |
| `|` (리터럴 파이프) | 구분자 | `.md-vdiv` / `.md-tool-sep` / `.md-menu-sep` |
| New / Save / Save As / Export | 헤더 버튼 | `file-plus` / `save` / `file-output` / `download` |
| 뷰 모드 | ViewModeToggle | `panel-left` / `columns-2` / `eye` |
| 이미지 모드 | ImageModeToggle | `image` / `link-2` |
| 폴더/파일/펼침 | 파일 트리 | `folder` / `folder-open` / `file-text` / `chevron-right` / `chevron-down` |
| 검색 | FileSearch | `search` |
| 툴바 포맷 버튼 | EditorToolbar | `bold` / `italic` / `code` / `link` / `heading-1..3` / `list` / `text-quote` |
| 저장 상태 | Footer | `check-circle` / `circle` |

## Requirements (EARS)

### Ubiquitous Requirements

- **REQ-UI-006-001**: The system **shall** 항상 `mdedit-tokens.css`를 `mdedit-components.css`보다 **먼저** 로드하여, 컴포넌트 클래스가 정의된 토큰 변수를 항상 참조할 수 있게 한다.
- **REQ-UI-006-002**: The system **shall** 항상 앱 루트 컨테이너를 `.md-root`(기본 폰트/색/배경) 및 `.md-app`(grid 셸)로 래핑한다.
- **REQ-UI-006-003**: The system **shall** 항상 아이콘 전용 버튼마다 텍스트 `aria-label`을 유지하며(기존 라벨 문자열 보존), 각 아이콘을 핸드오프 Lucide SVG로 렌더한다.
- **REQ-UI-006-004**: The system **shall** 항상 3종 폰트(Barlow, Barlow Condensed, IBM Plex Mono)를 로컬 번들 에셋에서 `@font-face`로 제공하고, 런타임 Google Fonts CDN에 의존하지 않는다.
- **REQ-UI-006-005**: The system **shall** 항상 키보드 포커스 표시를 2px `--md-accent` 아웃라인으로 렌더하고 브라우저 기본 아웃라인을 대체한다.
- **REQ-UI-006-006**: The system **shall** 항상 기존 `data-testid`, `role`, `aria-label` 속성을 리스킨 후에도 보존한다(특히 `markdown-editor`, `html-preview-iframe`, `html-view-only-placeholder`, `unsupported-file-viewer`, `file-tree-node`).

### Event-Driven Requirements

- **REQ-UI-006-007**: **WHEN** 테마가 dark로 해석되면, **the system shall** `document.documentElement`에 `.dark` 클래스를 추가하는 것과 **병행하여** `data-theme="dark"` 속성을 설정한다.
- **REQ-UI-006-008**: **WHEN** 테마가 light로 해석되면, **the system shall** `.dark` 클래스를 제거하는 것과 병행하여 `data-theme="light"` 속성을 설정한다.
- **REQ-UI-006-009**: **WHEN** 사용자가 파일 트리 행을 선택하거나 호버하면, **the system shall** 해당 상태를 `.md-tree-row` 상태 클래스(`.is-selected` / `--md-accent-soft` 등)로 시각 표현한다(기존 선택/포커스 상태 로직은 무변경).
- **REQ-UI-006-010**: **WHEN** 사용자가 뷰 모드 또는 이미지 모드 토글을 조작하면, **the system shall** `.md-seg` / `.md-seg-opt` 세그먼트 스타일로 활성 옵션을 표시한다(토글 상태 로직 무변경).

### State-Driven Requirements

- **REQ-UI-006-011**: **WHILE** 현재 문서가 dirty(미저장) 상태인 동안, **the system shall** 파일명 옆에 `--md-dirty` 점(`.md-dirty-dot`)과 상태 바 `.dirty` 항목을 표시한다.
- **REQ-UI-006-012**: **WHILE** 다크 테마가 활성인 동안, **the system shall** 모든 리스킨된 surface를 `[data-theme="dark"]` 토큰 값으로 렌더한다.
- **REQ-UI-006-013**: **WHILE** system 테마 모드가 활성인 동안, **the system shall** OS `prefers-color-scheme` 변경에 따라 `.dark` 클래스와 `data-theme` 속성을 동기 갱신한다.

### Unwanted Behavior Requirements

- **REQ-UI-006-014**: The system **shall not** 이벤트 핸들러, 스토어(state) 로직, Tauri IPC, CodeMirror 확장/에디터 로직, 마크다운 렌더링, export 로직, 스크롤 싱크, 파일 IO를 변경하지 않는다. 변경은 className/마크업(아이콘·라벨), CSS, 테마 이펙트 브리지 한 줄, 폰트 에셋, 아이콘 컴포넌트로 한정된다.
- **REQ-UI-006-015**: The system **shall not** 신규 런타임 의존성(`lucide-react`, 폰트 CDN 패키지, CSS-in-JS 등)을 추가하지 않는다.
- **REQ-UI-006-016**: **IF** vitest 단위 테스트가 리터럴 이모지/글리프(☀️/🌙/`|`/`A-` 등)나 반드시 변경되어야 하는 특정 클래스에 대해 어서션하면, **then** the system **shall** 그 테스트를 접근성 마크업(예: `aria-label`, `role`) 기반 어서션으로 갱신하되, **동작(behavior) 어서션은 약화하지 않는다.**
- **REQ-UI-006-017**: The system **shall not** 기존 테마 상태 머신(light/dark/system)의 상태·전이 로직을 변경하지 않는다. 브리지는 표시 속성 설정만 추가한다.
- **REQ-UI-006-020**: The system **shall not** 핸드오프의 고정 CSS grid 트랙 사이징(`.md-app`/`.md-body` `232px 6px 1fr 6px 1fr`)을 채택하지 않으며, 본문 pane 레이아웃과 드래그-투-리사이즈 동작을 기존 `ResizablePanels.tsx` 구현 그대로 유지한다. 스플리터/pane에는 시각 토큰(`--md-divider-pane`, `--md-surface`/`--md-bg`)만 적용한다.

### Optional / Enhancement Requirements

- **REQ-UI-006-018**: **WHERE** 가능하면, 정적 modifier 클래스(`.is-hover`/`.is-active`/`.is-selected`/`.is-focused`/`.is-disabled`)를 활용해 상태 스타일을 표현한다.
- **REQ-UI-006-019**: **WHERE** Tailwind 유틸리티가 `.md-*` 클래스로 커버되지 않는 레이아웃 세부(간격 미세조정 등)에 필요하면, Tailwind 병용을 허용한다.

## Acceptance Criteria

> acceptance.md 의 Given-When-Then 시나리오와 1:1 매핑됨. 시각 검증은 Playwright(라이트/다크 스크린샷·클래스 존재)로, 동작 불변식은 기존 vitest + Playwright 스위트 무변경 통과로 검증한다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-UI-006-001 | REQ-UI-006-014 | **[HARD 불변식]** 리스킨 diff가 이벤트 핸들러/스토어/IPC/CodeMirror/렌더/export/스크롤싱크/파일IO 코드를 변경하지 않음(변경 파일이 className·CSS·아이콘·폰트·테마 브리지로 한정됨을 diff 리뷰로 확인) |
| AC-UI-006-002 | REQ-UI-006-016 | 기존 vitest 단위 테스트가 통과. 이모지/글리프 리터럴에 의존하던 테스트는 접근성 마크업 어서션으로 갱신되었고 동작 어서션은 유지됨 |
| AC-UI-006-003 | REQ-UI-006-006 | 기존 Playwright E2E(app-render, markdown-render, html-file-viewer, table-border, mermaid-subgraph-label) 전부 통과. `data-testid`/`role`/`aria-label` 셀렉터 보존 |
| AC-UI-006-004 | — | `tsc --noEmit` 클린, eslint `--max-warnings 0` 클린 |
| AC-UI-006-005 | REQ-UI-006-001, REQ-UI-006-002 | 토큰 CSS가 컴포넌트 CSS보다 먼저 로드되고, 앱 루트가 `.md-root`/`.md-app`로 래핑됨 |
| AC-UI-006-006 | REQ-UI-006-007, REQ-UI-006-008 | 테마 dark 시 `<html>`에 `.dark` + `data-theme="dark"` 동시 존재, light 시 `.dark` 제거 + `data-theme="light"` |
| AC-UI-006-007 | REQ-UI-006-013 | system 모드에서 `prefers-color-scheme` 변경 시 `.dark`와 `data-theme`가 함께 갱신됨 |
| AC-UI-006-008 | REQ-UI-006-012 | 라이트/다크 두 테마에서 모든 리스킨 surface가 올바른 토큰 값으로 렌더됨(스크린샷 회귀) |
| AC-UI-006-009 | REQ-UI-006-004, REQ-UI-006-015 | 3종 폰트가 로컬 에셋에서 로드되고, `package.json` 의존성이 변경되지 않음(폰트/아이콘 런타임 의존성 없음) |
| AC-UI-006-010 | REQ-UI-006-003 | 모든 아이콘 전용 버튼이 텍스트 `aria-label`을 유지하며 Lucide SVG로 렌더됨(이모지/파이프/글리프 제거) |
| AC-UI-006-011 | REQ-UI-006-005 | 인터랙티브 요소가 포커스 시 2px `--md-accent` 아웃라인을 표시함 |
| AC-UI-006-012 | REQ-UI-006-011 | dirty 상태에서 `.md-dirty-dot`와 상태 바 `.dirty` 항목이 표시됨 |
| AC-UI-006-013 | REQ-UI-006-017 | 테마 상태 머신 로직(useTheme.test.ts)이 무변경 통과 |
| AC-UI-006-014 | REQ-UI-006-020 | 본문 pane 드래그-투-리사이즈가 리스킨 후에도 동작함(`ResizablePanels` 로직 무변경). 핸드오프 고정 grid 트랙(`232px 6px 1fr 6px 1fr`)이 적용되지 않음(스플리터는 `.md-pane-divider`/`--md-divider-pane` 시각만) |

## Technical Approach

### CSS 로드 및 루트 래핑

- `mdedit-tokens.css`와 `mdedit-components.css`를 `src`(또는 `public`) 하위에 vendored로 두고, `src/index.css` 상단(현재 `@tailwind` 레이어 이후) 또는 엔트리에서 **토큰 → 컴포넌트** 순으로 import한다. 기존 CodeMirror image-widget CSS(`src/index.css:9-40+`)는 유지한다.
- 앱 루트(`AppLayout.tsx`)에 `.md-root`와 세로 3영역 셸(`.md-app`: 타이틀바 / 본문 / 상태바)을 적용한다. **[DECIDED] 핸드오프 `.md-body`의 고정 CSS grid 트랙(`232px 6px 1fr 6px 1fr`)은 채택하지 않는다.** 본문 pane 레이아웃과 사이징은 기존 `ResizablePanels.tsx`가 구현한 **드래그 리사이즈 동작을 그대로 유지**하고, 스플리터/pane에는 **시각 토큰만** 적용한다(스플리터 = `.md-pane-divider` / `--md-divider-pane`, pane ground = `--md-surface`(사이드바) / `--md-bg`(에디터·프리뷰)). 트랙 사이징은 Exclusions에 명시(범위 밖).

### 테마 브리지 (핵심 최소 변경)

`src/hooks/useTheme.ts`의 `applyTheme` 콜백(현재 `.dark` 클래스만 토글, line 14-30)에 `data-theme` 속성 설정을 **한 줄 추가**한다:

```typescript
// useTheme.ts (개념적 — 구현은 Run phase)
const applyTheme = (isDark: boolean): void => {
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.setAttribute('data-theme', isDark ? 'dark' : 'light'); // ← 브리지
};
```

- 기존 light/dark/system 분기, `matchMedia` 리스너, cleanup은 무변경.
- `.dark` 클래스는 Tailwind `darkMode: "class"`가 계속 사용하므로 제거하지 않는다(핸드오프 `data-theme`와 병존).

### 폰트 로컬 번들

- Barlow(400/500/700), Barlow Condensed(400/600), IBM Plex Mono(400/500/600) woff2를 `public/fonts/`(또는 `src/assets/fonts/`)에 vendored로 배치.
- `@font-face` 선언을 토큰 CSS보다 먼저(또는 index.css 상단) 추가하여 `--md-font-ui/display/mono` 참조를 충족.
- Google Fonts `@import`는 명시적 임시 폴백으로만 허용(코멘트로 표기), 기본 경로는 로컬.

### 인라인 아이콘

- 30개 SVG를 `src/components/icons/`(또는 유사)에 로컬 React 컴포넌트 또는 정적 에셋으로 도입. `stroke="currentColor"`이므로 텍스트 색을 상속한다.
- 기존 이모지/파이프/글리프를 대응 아이콘으로 교체(Icon Mapping 표 참조). 아이콘 전용 버튼은 `aria-label`을 유지.
- `lucide-react` 등 런타임 패키지는 추가하지 않는다.

### className 교체 (surface 단위)

- Surface → Class 매핑 표에 따라 각 컴포넌트의 className을 `.md-*`로 교체. 마크업 구조 변경은 최소화하고, 아이콘 노드와 라벨 텍스트만 조정한다.
- CodeMirror 호스트(`MarkdownEditor.tsx`)는 크롬(거터/선택/스크롤바)만 `--md-*`로 재스타일한다. **확장(extensions)·에디터 로직은 무변경.**

## Test Strategy (TDD — 표현 계층 특성 반영)

이 SPEC은 표현 계층 리스킨이므로 TDD는 **회귀 방어 + 신규 시각/브리지 검증** 중심으로 적용한다.

### 신규/갱신 테스트 (RED first where applicable)

- **테마 브리지** (`src/test/useTheme.test.ts` 확장): dark 해석 시 `documentElement`에 `data-theme="dark"`가 설정되고 `.dark`도 존재; light 시 `data-theme="light"` + `.dark` 부재; system 모드 `matchMedia` 변경 시 둘 다 갱신.
- **아이콘/접근성**: 이모지/파이프 리터럴을 어서션하던 기존 테스트를 `getByRole('button', { name: '<aria-label>' })` 기반으로 갱신(동작 어서션 유지).
- **Playwright 시각 회귀**(옵션, Run phase 결정): 라이트/다크 스크린샷 또는 `.md-*` 클래스 존재 검증.

### 회귀 방어 (무변경 통과 필수)

- 기존 vitest 스위트 전체(FileTreeNode, uiStore, Footer, useTheme 등) 통과.
- 기존 Playwright E2E 전체(`e2e/app-render.spec.ts`, `markdown-render.spec.ts`, `html-file-viewer.spec.ts`, `table-border.spec.ts`, `mermaid-subgraph-label.spec.ts`) 통과.
- `tsc --noEmit`, eslint `--max-warnings 0` 클린.

## @MX Tag Targets

code_comments = ko (`.moai/config/sections/language.yaml`).

| 위치 | 태그 | 사유 |
|------|------|------|
| `src/hooks/useTheme.ts` `applyTheme` | `@MX:NOTE` | `data-theme` 브리지가 `.dark` 클래스와 병존하는 이유(핸드오프 키잉 방식) 기록. 기존 `@MX:ANCHOR` 유지. `@MX:SPEC: SPEC-UI-006` |
| `src/index.css` (토큰/컴포넌트 import) | `@MX:NOTE` | 토큰→컴포넌트 로드 순서 불변식과 CodeMirror image-widget CSS 병존. `@MX:SPEC: SPEC-UI-006` |
| `src/components/icons/` 인라인 아이콘 배럴 | `@MX:NOTE` | Lucide SVG 로컬 인라인(런타임 의존성 회피) 근거. `@MX:SPEC: SPEC-UI-006` |

## Risks & Edge Cases

| 리스크 | 영향 | 완화 |
|--------|------|------|
| `.md-body` grid(232px/6px/1fr/6px/1fr)가 기존 `ResizablePanels` 리사이즈 상태와 충돌 | 페인 크기 리사이즈 파손 | 리사이즈 로직 무변경, `.md-pane-divider`는 시각만; grid vs 기존 flex/resizable 정합은 Run phase 결정. 필요 시 grid 대신 기존 레이아웃 유지 + 토큰 색만 적용 |
| 이모지/글리프 리터럴 어서션 테스트 다수 존재 | 테스트 갱신 범위 확대 | AC-UI-006-002로 명시적 test-touch point 관리; 동작 어서션 약화 금지 |
| 폰트 woff2 라이선스/배포 | 배포 시 라이선스 위반 | Barlow/IBM Plex Mono는 OFL, Lucide는 ISC/MIT — 라이선스 파일 동봉. Run phase에서 확인 |
| CodeMirror 크롬 재스타일이 에디터 렌더에 영향 | 커서/선택 시각 회귀 | `--md-selection`/`--md-gutter`만 적용, 확장·테마 확장(`EditorView.theme`) 로직은 무변경. Playwright 에디터 스냅샷으로 방어 |
| `data-theme` 속성이 다른 CSS(Tailwind dark:)와 이중 적용 | 색상 이중 소스 혼선 | `.dark` = Tailwind, `data-theme` = 핸드오프 토큰; 병존하되 surface별로 하나의 소스로 스타일(대부분 `.md-*` 우선) |
| 전면 리스킨 diff 규모 | 리뷰/회귀 위험 | surface 단위로 커밋 분할(Multi-File Decomposition), 각 surface 후 테스트. revert-safe PR |
| 라이트/다크 대비 접근성 | WCAG 미달 가능성 | 토큰이 이미 테마별 대비 설계됨; 포커스 2px 아웃라인 도입으로 개선 |

## Dependencies

### Internal (SPEC)

| SPEC ID | 의존 내용 |
|---------|-----------|
| SPEC-UI-002 | 파일 트리 컴포넌트/컨텍스트 메뉴 마크업(리스킨 대상, 동작 무변경) |
| SPEC-UI-005 | 컨텍스트 메뉴 Copy 항목 + Footer 트랜지언트 메시지(리스킨 대상, 동작 무변경) |
| SPEC-PREVIEW-007 | 전체 파일 노출 + `UnsupportedFileViewer` 프리뷰 라우팅(리스킨 대상, 셀렉터/동작 보존) |

### External

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| react | 18.x | UI |
| tailwindcss | (기존) | `.md-*` 미커버 영역 병용, `darkMode: "class"` 유지 |
| Barlow / Barlow Condensed / IBM Plex Mono | 로컬 woff2 | 폰트(번들, 런타임 의존성 아님) |
| Lucide SVG | 로컬 에셋 | 아이콘(인라인, 런타임 의존성 아님) |

신규 런타임 의존성: **없음.**

## Branch / Delivery

- 구현은 `/moai run SPEC-UI-006` 시 feature 브랜치 **`feature/SPEC-UI-006-ui-reskin`**에서 진행하며, 리뷰 가능한 revert-safe PR로 전달한다.
- surface 단위 커밋 분할(Multi-File Decomposition)로 각 단계 회귀 검증.
- 브랜치 생성은 `/moai run` 단계에서 수행(Plan 단계에서는 생성하지 않음).

## References

- 핸드오프 번들: `.moai/design/# mdedit UI redesign.zip` (README·tokens·components·icons).
- `src/hooks/useTheme.ts:8-32` — 테마 이펙트(브리지 삽입 지점).
- `src/index.css:1-40` — Tailwind 레이어 + CodeMirror image-widget CSS(토큰/컴포넌트 import 지점).
- `tailwind.config.js` — `darkMode: "class"`, 빈 `theme.extend`(유지).
- `src/components/layout/` — AppLayout, Header, Footer, ResizablePanels, ViewModeToggle.
- `src/components/sidebar/` — FileExplorer, FileSearch, FileTree, FileTreeNode.
- `src/components/editor/` — EditorToolbar, MarkdownEditor.
- `src/components/preview/` — PreviewContainer, MarkdownPreview, PreviewRenderer, CodeFileViewer, HtmlFileViewer, UnsupportedFileViewer.
- `src/components/settings/ImageModeToggle.tsx`.
- `e2e/` — app-render, markdown-render, html-file-viewer, table-border, mermaid-subgraph-label(회귀 검증 대상).
- 보존 셀렉터: `markdown-editor`, `html-preview-iframe`, `html-view-only-placeholder`, `unsupported-file-viewer`, `file-tree-node` + 상기 `aria-label` 목록.

## Exclusions (What NOT to Build)

- **동작/로직 변경 금지** — 이벤트 핸들러, 스토어 로직, Tauri IPC, CodeMirror 확장, 마크다운 렌더링, export 로직, 스크롤 싱크, 파일 IO 무변경.
- **신규 기능 추가 없음** — 리스킨은 표현 계층 한정. 기능 추가는 별도 SPEC.
- **신규 런타임 의존성 없음** — `lucide-react`, 폰트 CDN 패키지, CSS-in-JS, 아이콘 라이브러리 추가 금지.
- **테마 상태 머신 변경 없음** — light/dark/system 로직 무변경. 브리지는 `data-theme` 속성 설정만 추가.
- **Rust 백엔드 변경 없음** — `src-tauri/` 무변경.
- **동작 어서션 약화 없음** — 테스트는 접근성 마크업으로 갱신 가능하나 behavior 검증은 유지·강화만.
- **런타임 Google Fonts CDN 의존 없음** — 로컬 번들 기본. `@import`는 명시적 임시 폴백으로만.
- **레이아웃 구조 재설계 없음** — 3-pane 셸/리사이즈 동작 유지, 시각(색/폰트/간격/아이콘)만 리스킨.
- **핸드오프 고정 CSS grid 트랙 사이징 채택 없음** — `.md-app`/`.md-body`의 `232px 6px 1fr 6px 1fr` grid 트랙은 도입하지 않는다. 본문 pane 레이아웃/사이징은 기존 `ResizablePanels.tsx`의 드래그-투-리사이즈를 그대로 유지하고, 스플리터/pane에는 시각 토큰(`--md-divider-pane`, `--md-surface`/`--md-bg`)만 적용한다.
- **다크모드 외 신규 테마 없음** — 핸드오프 라이트/다크 두 테마만.
</content>
</invoke>
