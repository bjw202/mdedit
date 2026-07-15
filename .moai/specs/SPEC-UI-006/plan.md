# SPEC-UI-006 — 구현 계획 (plan.md)

> **결정 확정 (v1.0.1, 2026-07-15)** — 사용자 확정 2건:
> 1. **3-파일 세트 완성**: spec.md + plan.md + acceptance.md.
> 2. **[DECIDED] 페인 레이아웃 = 기존 `ResizablePanels` 드래그-투-리사이즈 유지.** 핸드오프의 고정 CSS grid 트랙(`.md-app`/`.md-body` `232px 6px 1fr 6px 1fr`)은 채택하지 않는다. 스플리터/pane에는 **시각 토큰만** 적용(`--md-divider-pane`, `--md-surface`/`--md-bg`). 트랙 사이징은 범위 밖(Exclusions).
>
> Brownfield 리스킨(표현 계층 한정). development_mode = tdd → RED-GREEN-REFACTOR(브라운필드 강화). 통합 전략 = 전략 1(핸드오프 CSS 직접 채택, 사용자 확정, 재검토 금지).
> [HARD] 불변식: **동작·로직 제로 변경**. 변경 범위 = className/마크업(아이콘·라벨), CSS, 테마 이펙트 브리지 한 줄, 폰트 에셋, 아이콘 컴포넌트.

## 1. 설계 결정 (Design Decisions)

### (a) CSS 통합 — 토큰 → 컴포넌트 로드 순서 + 루트 래핑 (채택)

- `mdedit-tokens.css`, `mdedit-components.css`를 `src/styles/`(vendored)에 배치하고 엔트리에서 **토큰 → 컴포넌트** 순으로 import한다(REQ-UI-006-001). 순서가 뒤바뀌면 컴포넌트 클래스가 미정의 변수를 참조한다.
- `src/index.css`의 기존 `@tailwind` 레이어와 CodeMirror image-widget CSS(line 9-40+)는 유지한다.
- 앱 루트(`AppLayout.tsx`)를 `.md-root`(폰트/색/배경) + 세로 3영역 셸(`.md-app`)로 래핑한다(REQ-UI-006-002).

### (b) 테마 브리지 — `data-theme` 병행 설정 한 줄 (채택, 최소 변경)

`src/hooks/useTheme.ts`의 `applyTheme` 콜백(line 14-20, 현재 `.dark` 클래스만 토글)에 `data-theme` 속성 설정 한 줄을 추가한다. 기존 light/dark/system 분기, `matchMedia` 리스너, cleanup은 무변경(REQ-UI-006-007/008/013/017).

```ts
// useTheme.ts (applyTheme 내부 — 브리지 한 줄 추가)
const applyTheme = (isDark: boolean): void => {
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.setAttribute('data-theme', isDark ? 'dark' : 'light'); // ← 브리지 (신규)
};
```

결정 세부:
- `.dark` 클래스는 Tailwind `darkMode: "class"`가 계속 사용하므로 **제거하지 않는다**(핸드오프 `data-theme`와 병존).
- system 모드: `matchMedia('(prefers-color-scheme: dark)')` change 핸들러가 이미 `applyTheme`를 호출하므로 `data-theme`도 자동 동기화(REQ-UI-006-013). 별도 배선 불필요.
- 상태 머신(uiStore `theme`) 변경 없음 — 표시 속성만 추가.

### (c) 페인 레이아웃 — 기존 ResizablePanels 유지, 시각 토큰만 (채택, [DECIDED])

**핸드오프 `.md-body` 고정 grid(`232px 6px 1fr 6px 1fr`)는 채택하지 않는다.** `ResizablePanels.tsx`의 드래그-투-리사이즈 로직(pane 크기 상태, 드래그 핸들러, 마우스 이벤트)은 **무변경**으로 유지한다(REQ-UI-006-020).

적용 범위:
- 스플리터(divider): `.md-pane-divider` 클래스 또는 `--md-divider-pane` 색만 적용. 폭·hit-area·드래그 동작은 기존 그대로.
- pane ground: 사이드바 = `--md-surface`, 에디터/프리뷰 = `--md-bg`(또는 `--md-surface-raised` for 에디터 필드).
- `.md-app`은 세로 3영역(타이틀바/본문/상태바) 구성에만 사용. 본문 영역 내부는 `ResizablePanels`가 계속 소유.

근거:
1. 드래그-투-리사이즈는 사용자 기능이며 "동작 무변경" 불변식의 대상이다. 고정 grid로 대체하면 기능 회귀다.
2. 시각 리스킨 목표(색/폰트/스플리터 룩)는 토큰 적용만으로 달성 가능하다.
3. 고정 grid 트랙 사이징은 범위 밖(spec.md Exclusions).

### (d) 폰트 로컬 번들 — vendored woff2 + @font-face (채택)

- Barlow(400/500/700), Barlow Condensed(400/600), IBM Plex Mono(400/500/600) woff2를 `public/fonts/`(또는 `src/assets/fonts/`)에 배치.
- `@font-face` 선언을 토큰 CSS import 이전(또는 index.css 상단)에 추가하여 `--md-font-ui/display/mono` 참조를 충족(REQ-UI-006-004).
- 런타임 Google Fonts CDN 의존 없음(REQ-UI-006-015). `@import`는 명시적 임시 폴백 코멘트로만 허용.
- 라이선스 파일(OFL for Barlow/IBM Plex Mono) 동봉.

### (e) 인라인 아이콘 — 로컬 SVG React 컴포넌트 (채택)

- 30개 Lucide SVG를 `src/components/icons/`에 로컬 컴포넌트/에셋으로 인라인. `stroke="currentColor"`이므로 텍스트 색 상속.
- 기존 이모지(☀️/🌙)·파이프(`|`)·텍스트 글리프(☰/`▼`/`●`/`A-`/`A+`)를 Icon Mapping 표(spec.md)에 따라 교체.
- 아이콘 전용 버튼은 기존 `aria-label` 문자열을 **그대로 유지**(REQ-UI-006-003/006).
- `lucide-react` 등 런타임 패키지 추가 없음(REQ-UI-006-015).

### (f) className 교체 — surface 단위, 마크업 최소 변경 (채택)

- spec.md Surface → Class 매핑 표에 따라 각 컴포넌트 className을 `.md-*`로 교체. 마크업 구조 변경은 아이콘 노드·라벨 텍스트 조정으로 최소화.
- CodeMirror 호스트(`MarkdownEditor.tsx`)는 크롬(거터/선택/스크롤바)만 `--md-*`로 재스타일. **확장(extensions)·에디터 로직·`EditorView.theme` 배선은 무변경.**
- Tailwind는 `.md-*` 미커버 레이아웃 세부에 병용 가능(REQ-UI-006-019).

## 2. 영향/신규 파일

| 파일 | 변경 유형 | 핵심 작업 |
|------|-----------|-----------|
| `src/styles/mdedit-tokens.css` | [NEW] | 핸드오프 토큰 CSS vendored 배치 |
| `src/styles/mdedit-components.css` | [NEW] | 핸드오프 컴포넌트 CSS vendored 배치(토큰 다음 로드) |
| `src/index.css` | [MODIFY] | `@font-face` 선언 + 토큰→컴포넌트 import 추가. 기존 Tailwind 레이어·CodeMirror image-widget CSS 유지 |
| `public/fonts/` (또는 `src/assets/fonts/`) | [NEW] | Barlow / Barlow Condensed / IBM Plex Mono woff2 + 라이선스 |
| `src/components/icons/` | [NEW] | 30개 Lucide SVG 로컬 아이콘 컴포넌트/에셋 + 배럴 |
| `src/hooks/useTheme.ts` | [MODIFY] | `applyTheme`에 `data-theme` 설정 한 줄 추가. 기존 `@MX:ANCHOR` 유지 + NOTE 갱신 |
| `src/components/layout/AppLayout.tsx` | [MODIFY] | `.md-root`/`.md-app` 세로 셸 래핑. **`ResizablePanels` 본문 레이아웃 무변경**. 아이콘/className 교체 |
| `src/components/layout/Header.tsx` | [MODIFY] | 타이틀바/버튼/Export 메뉴/폰트 스테퍼 `.md-*` 교체, 아이콘 인라인 |
| `src/components/layout/Footer.tsx` | [MODIFY] | 상태 바 `.md-statusbar`/`.md-status-item` 교체(SPEC-UI-005 statusMessage 동작 무변경) |
| `src/components/layout/ResizablePanels.tsx` | [MODIFY] | 스플리터 `.md-pane-divider`/`--md-divider-pane` 시각만. **드래그 로직·트랙 사이징 무변경** |
| `src/components/layout/ViewModeToggle.tsx` | [MODIFY] | `.md-seg`/`.md-seg-opt` 세그먼트, 아이콘 인라인 |
| `src/components/settings/ImageModeToggle.tsx` | [MODIFY] | `.md-seg`/`.md-seg-opt`, 아이콘 인라인 |
| `src/components/sidebar/FileExplorer.tsx` | [MODIFY] | `.md-sidebar`/`.md-sidebar-head` |
| `src/components/sidebar/FileSearch.tsx` | [MODIFY] | `.md-search`, search 아이콘 |
| `src/components/sidebar/FileTree.tsx`, `FileTreeNode.tsx` | [MODIFY] | `.md-tree`/`.md-tree-row`(폴더/열림/선택/포커스 상태), 아이콘. `data-testid="file-tree-node"`·컨텍스트 메뉴 동작(SPEC-UI-002/005) 무변경 |
| `src/components/editor/EditorToolbar.tsx` | [MODIFY] | `.md-toolbar`/`.md-tool-btn`/`.md-tool-sep`, 포맷 아이콘 |
| `src/components/editor/MarkdownEditor.tsx` | [MODIFY] | `.md-editorpane`/`.md-editor`/`.md-gutter` 크롬만. **CodeMirror 확장·로직 무변경**. `data-testid="markdown-editor"` 유지 |
| `src/components/preview/*.tsx` | [MODIFY] | `.md-previewpane`/`.md-preview`. 렌더 로직 무변경. `html-preview-iframe`/`html-view-only-placeholder`/`unsupported-file-viewer` testid 유지 |
| `tailwind.config.js` | [MODIFY?] | 필요 시에만. `darkMode: "class"` 유지 |
| `src/test/useTheme.test.ts` | [MODIFY] | `data-theme` 브리지 검증 추가 |
| 이모지/글리프 어서션 테스트 | [MODIFY] | 접근성 마크업(`aria-label`/`role`) 어서션으로 갱신(동작 어서션 유지, REQ-UI-006-016) |

신규 런타임 의존성: **없음**. Rust 백엔드(`src-tauri/`) 변경: **없음**.

## 3. @MX 태그 대상 (code_comments = ko)

| 위치 | 태그 | 사유 |
|------|------|------|
| `src/hooks/useTheme.ts` `applyTheme` | `@MX:NOTE`(기존 `@MX:ANCHOR` 유지) | `data-theme` 브리지가 `.dark`와 병존하는 이유(핸드오프 키잉). `@MX:SPEC: SPEC-UI-006` |
| `src/index.css` 토큰/컴포넌트 import | `@MX:NOTE` | 토큰→컴포넌트 로드 순서 불변식 + `@font-face` + CodeMirror CSS 병존. `@MX:SPEC: SPEC-UI-006` |
| `src/components/icons/` 배럴 | `@MX:NOTE` | Lucide SVG 로컬 인라인(런타임 의존성 회피) 근거. `@MX:SPEC: SPEC-UI-006` |
| `src/components/layout/ResizablePanels.tsx` 스플리터 | `@MX:NOTE` | 핸드오프 고정 grid 미채택, 드래그 리사이즈 유지 결정 명시. `@MX:SPEC: SPEC-UI-006` |

파일당 3개 한도 준수. WARN 불필요(표현 계층, 복잡도 낮음).

## 4. Run-phase 분해 순서 (TDD, 브라운필드 강화)

의존 그래프: 토큰/폰트/아이콘 인프라 → 테마 브리지 → surface별 리스킨. 각 surface 후 전체 스위트 회귀 확인. surface 단위 커밋 분할(Multi-File Decomposition), revert-safe.

1. **CSS/폰트/아이콘 인프라** — 토큰·컴포넌트 CSS vendored, `@font-face`, 30개 아이콘 컴포넌트 도입. `src/index.css` import 순서(토큰→컴포넌트). 회귀: 기존 렌더 깨짐 없음(`tsc`/eslint/vitest/E2E).
2. **테마 브리지** — RED: `useTheme.test.ts`에 dark→`data-theme="dark"`+`.dark`, light→`data-theme="light"`+`.dark` 제거, system change 동기 검증 → GREEN: `applyTheme` 한 줄 추가 → REFACTOR: NOTE 주석. 기존 `useTheme.test.ts` 회귀 없음.
3. **App shell + 페인** — `.md-root`/`.md-app` 세로 셸 래핑. `ResizablePanels` 스플리터 시각 토큰만. RED(E2E/vitest): 드래그 리사이즈 동작 보존 확인 + 고정 grid 미적용. **드래그 로직 코드 diff 없음**.
4. **Header/Footer** — 타이틀바·버튼·Export·스테퍼·상태 바 `.md-*` + 아이콘. 이모지/글리프 어서션 테스트 → 접근성 어서션 갱신. save status/dirty 동작(SPEC-UI-005) 무변경.
5. **Sidebar + File tree** — `.md-sidebar`/`.md-search`/`.md-tree` + 상태 클래스 + 아이콘. `file-tree-node` testid·컨텍스트 메뉴(SPEC-UI-002/005) 무변경.
6. **Editor toolbar + chrome** — `.md-toolbar`/`.md-tool-btn` + 포맷 아이콘, `.md-editor`/`.md-gutter` 크롬. **CodeMirror 확장 무변경**, `markdown-editor` testid 유지.
7. **Preview** — `.md-previewpane`/`.md-preview`. 렌더 로직·testid 무변경. markdown/html/code/unsupported 뷰 회귀(SPEC-PREVIEW-007) 확인.
8. **최종 게이트** — 라이트/다크/system 전 surface 시각 검증, `tsc --noEmit`, eslint `--max-warnings 0`, 전체 vitest + Playwright.

각 단계 종료 시 전체 vitest + 관련 Playwright 실행하여 회귀 없는지 확인.

## 5. 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 고정 grid 채택 유혹으로 드래그 리사이즈 회귀 | 기능 파손 | [DECIDED] grid 미채택. `ResizablePanels` 코드 diff 금지, AC-UI-006-014로 방어 |
| 이모지/글리프 리터럴 어서션 테스트 다수 | 테스트 갱신 범위 확대 | AC-UI-006-002로 test-touch point 관리; 동작 어서션 약화 금지(REQ-016) |
| 폰트 woff2 라이선스/배포 | 라이선스 위반 | OFL(Barlow/IBM Plex Mono)·ISC/MIT(Lucide) 라이선스 파일 동봉 |
| CodeMirror 크롬 재스타일이 에디터 렌더 영향 | 커서/선택 시각 회귀 | `--md-selection`/`--md-gutter`만, 확장·`EditorView.theme` 무변경. Playwright 에디터 스냅샷 방어 |
| `data-theme` + Tailwind `dark:` 이중 색 소스 | 색 혼선 | surface별 단일 소스(대부분 `.md-*`)로 스타일. `.dark`=Tailwind, `data-theme`=핸드오프 병존 |
| 전면 리스킨 diff 규모 | 리뷰/회귀 위험 | surface 단위 커밋 분할, 각 후 테스트. revert-safe PR(`feature/SPEC-UI-006-ui-reskin`) |
| 토큰→컴포넌트 import 순서 오류 | 미정의 변수 참조로 스타일 깨짐 | REQ-001 명시, import 순서 고정 + 리뷰 |
| 라이트/다크 대비 접근성 | WCAG 미달 | 토큰이 테마별 대비 설계됨; 포커스 2px 아웃라인 도입 |

## 6. 검증 게이트 (Definition of Done)

- [ ] acceptance.md 모든 AC 시나리오 검증됨(AC-UI-006-001 ~ 014).
- [ ] **[HARD]** diff가 className·CSS·아이콘·폰트·테마 브리지 한 줄로 한정됨(AC-001). 이벤트 핸들러/스토어/IPC/CodeMirror/렌더/export/스크롤싱크/파일IO 코드 변경 없음.
- [ ] 기존 vitest 스위트 통과(회귀 없음). 이모지/글리프 어서션은 접근성 마크업으로 갱신, 동작 어서션 유지(AC-002).
- [ ] 기존 Playwright E2E 통과, `data-testid`/`role`/`aria-label` 셀렉터 보존(AC-003).
- [ ] `tsc --noEmit` 클린, eslint `--max-warnings 0` 클린(AC-004).
- [ ] 라이트/다크/system 테마 전 surface 정상 렌더(AC-006/007/008).
- [ ] 3종 폰트 로컬 로드, `package.json` 의존성 변경 없음(AC-009).
- [ ] 아이콘 전용 버튼 `aria-label` 유지 + Lucide SVG(AC-010), 포커스 2px 아웃라인(AC-011), dirty 표시(AC-012).
- [ ] **드래그-투-리사이즈 동작 보존 + 고정 grid 미적용(AC-014).**
- [ ] @MX 태그 대상 파일에 ko 로 추가(파일당 3개 한도).
- [ ] `src-tauri/` 변경 없음.
</content>
