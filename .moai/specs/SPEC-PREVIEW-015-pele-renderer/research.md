# research.md: mermaid → pele 교체를 위한 의존 지도 재검증 (기준 커밋 929d116)

> 조사일 2026-10-26. 읽기만 했고 파일은 바꾸지 않았다. 직접 읽지 않고 판단한 내용은 **(추정)**으로 표시했다.
>
> **기준 트리 주의:** 로컬 `main`(작업 트리 HEAD)은 `6a322d6`에 있다. `929d116`(SPEC-EXPORT-004)은 `origin/main`에만 있고, 로컬은 1커밋 뒤처져 있다. 작업 트리에는 `.moai/`·`.claude/` 쪽 미커밋 변경이 많다. 이 커밋이 바꾼 파일(`src/lib/export/*`, `imageResolver.ts`, `AppLayout.tsx`, `ipc.ts`, `types.ts`, `docs/USER_MANUAL.md`, 테스트 4개)은 모두 `git show 929d116:<path>`로 읽었다. 나머지 파일은 두 커밋 사이에 차이가 없다.

---

## 1. Architecture / call-site map

### 1.1 mermaid 직접 import 전체 목록
`src/`, `e2e/`, `scripts/`, `vite.config.ts`, `playwright.config.ts`를 모두 검색했다. 운영 코드의 import는 3곳, 실제 mermaid로 도는 테스트는 1곳이다. `vite.config.ts`(1-49)에는 mermaid alias, optimizeDeps, manualChunks 설정이 없다. `scripts/prebuild.mjs`에도 mermaid 언급이 없다.

| # | 위치 | 방식 |
|---|---|---|
| 1 | `src/components/preview/PreviewRenderer.tsx:2` | 정적 `import mermaid from 'mermaid'` |
| 2 | `src/lib/ai/mermaidValidate.ts:1` | 정적 import |
| 3 | `src/components/editor/extensions/ai-suggestion-card.ts:1289` | 동적 `(await import('mermaid')).default` |
| 4 | `src/test/insertDiagram.test.ts:10` | 정적 import. mock 없이 실제 mermaid를 쓴다 |

`ai-suggestion-card.ts:18`이 `mermaidValidate`를 정적으로 import한다. 그래서 mermaid는 AI 카드 모듈에도 정적으로 딸려 들어간다 (번들 분리 효과가 사실상 없음, 추정).

### 1.2 PreviewRenderer (미리보기)
- 기본 설정: `PreviewRenderer.tsx:29` `MERMAID_BASE_CONFIG = { startOnLoad: false, securityLevel: 'strict' }`. strict를 낮추지 말라는 경고 주석은 `:25-28`에 있다.
- 다크 판정: `getEffectiveIsDark` `:35-39`, `useUIStore` 구독 `:79-80`, system 모드 matchMedia 리스너 `:84-94`.
- 렌더 effect는 `:99-176`이고 의존성은 `[safeHtml, isDark]`(`:176`)이다.
  - `:110` 매 실행마다 `mermaid.initialize({ ...MERMAID_BASE_CONFIG, theme: isDark ? 'dark' : 'default' })`를 호출한다.
  - `:113` `container.querySelectorAll('.mermaid-container')`
  - `:114` `containers.forEach(async (el) => …)`. 각 비동기 작업을 기다리지 않는다.
  - `:120-124` 본문이 비면 `<p class="md-diagram-placeholder">다이어그램 문법을 입력하세요</p>`를 넣는다 (SPEC-UI-008).
  - `:126` `await mermaid.parse(diagram)`, `:127` 무작위 id, `:128` `await mermaid.render(id, diagram)`, `:129` `el.innerHTML = svg`. **mermaid 출력은 sanitize를 거치지 않는다.**
  - `:130-131` 실패하면 `<p class="text-sm text-amber-500 italic py-2">⚠ Diagram syntax error</p>`를 넣는다.
- 인라인 `<svg>` 마커(`data-mdedit-svg`)만 `restoreInlineSvgMarkers` `:47-59`를 거쳐 `sanitizeSvg`로 정화된다 (`:97`, useMemo).
- **비동기 forEach 경쟁 (재평가):**
  - 내용(safeHtml)이 바뀌면 React가 innerHTML을 통째로 갈아끼운다. 늦게 끝난 옛 작업은 이미 문서에서 떨어진 `el`에 쓰므로 화면에 영향이 없다 (추정).
  - 실제로 겹치는 경우는 **테마만 바뀔 때**다. safeHtml이 같아 React가 DOM을 다시 쓰지 않으므로 옛 실행과 새 실행이 같은 `el`에 쓴다. mermaid 내부 실행 큐가 순서를 지켜 준다면 결과는 맞겠지만 확인하지 않았다 (추정).
  - 더 확실한 경쟁은 전역 설정이다. 다른 모듈이 중간에 `initialize`를 부르면 설정이 기본값으로 덮인다 (§1.3).

### 1.3 mermaidValidate (AI 검증)
- `mermaidValidate.ts:7` `MERMAID_STRICT_CONFIG = { startOnLoad: false, securityLevel: 'strict' }`. theme 키가 없다.
- `:20-28` `validateMermaid`: `:21`에서 initialize, `:23`에서 `await mermaid.parse(code)` (render는 안 함), `:26` 오류 메시지를 반환한다.
- `:37-39` `buildFallbackDecision`(1회차면 auto-retry, 그 이후는 목록 폴백 제안)은 mermaid와 무관하다. 그대로 두면 된다.
- **전역 덮어쓰기 확인:** `node_modules/mermaid/dist/chunks/mermaid.core/chunk-ABZYJK2D.mjs:2511-2519`의 `setSiteConfig`는 설정을 `defaultConfig`로 되돌린 뒤 넘긴 값을 병합한다. 그래서 theme 없이 `initialize`를 부르면 전역 theme이 `default`로 돌아간다. 다만 `initialize`가 `setSiteConfig`를 거친다는 연결은 직접 읽지 않았다 (추정).
- 결론: 다크 모드에서 미리보기의 parse와 render 사이에 AI 검증이 끼어들면 그 다이어그램은 라이트 색으로 그려질 수 있다 (추정).

### 1.4 ai-suggestion-card 미니 렌더
- `ai-suggestion-card.ts:485-491` `phase === 'diagram-valid'`이면 `div.mdedit-ai-mermaid-preview`를 만들고 `input.renderMermaid?.(…)`를 부른다. 렌더러는 주입식이라 jsdom 테스트에서는 주입하지 않는다.
- `:1141-1155` `handleDiagramComplete`: `stripMermaidFence` → `validateMermaid` → `decideDiagramOutcome`.
- `:1267-1270` `stripMermaidFence`, `:1277-1281` `ensureMermaidFence`. 둘 다 mermaid 라이브러리와 무관하며 유지 대상이다.
- `:1287-1298` `renderMermaidInto`: 동적 import → `initialize(MERMAID_STRICT_CONFIG)`(**테마 없음**, 다크 미대응) → `render` → `container.innerHTML = svg`. sanitize 없음, 실패는 조용히 무시한다.
- `:1468`에서 운영 코드가 `renderMermaid: renderMermaidInto`를 주입한다.
- CSS: `src/styles/mdedit-components.css:487-491` `.mdedit-ai-mermaid-preview` (배경 `--md-code-bg`).

### 1.5 펜스 감지
- `src/lib/markdown/mermaidPlugin.ts:13-24`: `token.info.trim() === 'mermaid'`이면 `<div class="mermaid-container" data-diagram="${escaped}"></div>`를 만든다. `:19`에서 **`"`만** `&quot;`로 바꾼다.
- **숨은 계약:** `&`는 이스케이프하지 않는다. 그래서 소스 안의 `&amp;`, `&lt;` 같은 엔티티는 `getAttribute('data-diagram')`에서 디코드된 문자열로 렌더러에 넘어간다 (추정. HTML 속성 파싱 규칙 기준).
- 등록 위치: `src/lib/markdown/renderer.ts:3`(import), `:408`(`md.use(mermaidPlugin)`).
- 앱 CSS: `src/index.css:290-292` `.preview-content .mermaid-container { @apply flex justify-center mb-4; }`, 인쇄용 `:328`.

### 1.6 svgSanitize (`src/lib/preview/svgSanitize.ts`)
- `:13-35` 설정: `USE_PROFILES: { svg: true, svgFilters: true }`, `FORBID_TAGS: ['script', 'foreignObject']`, 이벤트 핸들러 속성 17종 금지.
- **`:45-56` 전역 DOMPurify 훅:** `href`/`xlink:href` 값 가운데 `#`로 시작하지 않고 `data:`, 아무 스킴(`[a-z][a-z0-9+.-]*:`), `//` 중 하나에 맞으면 속성을 제거한다. **`https://` 링크도 지워진다.**
- 설치된 DOMPurify(3.4.12)의 SVG 프로파일(`node_modules/dompurify/dist/purify.es.mjs:314`)은 `style` 속성, `<style>`·`<a>`·`<text>`·`<tspan>`·`<marker>` 태그, `class`·`transform`·`href`를 허용한다. 따라서 pele 출력의 인라인 style과 CSS 변수는 남지만 **링크 href는 훅이 지운다.**
- 현재 사용처는 `PreviewRenderer.tsx:4,53`과 `SvgFileViewer.tsx:10,51` 두 곳뿐이다. 설정은 한 파일에서만 관리한다는 원칙(`svgSanitize.ts:1-5`)이 있어, 이 설정을 완화하면 SVG 파일 뷰어에도 그대로 영향이 간다.
- mermaid 출력은 현재 어느 경로에서도 이 sanitize를 거치지 않는다 (`PreviewRenderer.tsx:129`, `ai-suggestion-card.ts:1293`).

### 1.7 다이어그램 프리셋
- 정의: `src/components/editor/extensions/keyboard-shortcuts.ts:159-164`(설명 주석), `:165-173` `DiagramPreset` 타입, `:178` `DiagramType`, `:191-192` 펜스 상수, **`:194-257` `DIAGRAM_PRESETS`** (8개 = 7종 + `custom`), `:266-299` `insertDiagram`.
- 7종: flowchart, sequenceDiagram, gantt, classDiagram, stateDiagram, pie, mindmap. 프리셋 body는 SPEC-UI-008 spec.md에 적힌 고정 문자열과 글자 단위로 같아야 한다 (`:160`).

### 1.8 Rust 프롬프트 (`src-tauri/src/ai/prompt.rs`)
- `:101-106` `AiFeature::Diagram` 시스템 프롬프트. 펜스 없이 출력하고 "graph·flowchart·sequenceDiagram 등 mermaid 키워드로 시작"하라고 지시한다.
- `:170-200` `diagram_type_fragment`: 7종의 첫 줄 키워드를 강제한다 (`flowchart` / `sequenceDiagram` / `gantt` / `classDiagram` / `stateDiagram-v2` / `pie` / `mindmap`).
- 테스트: `:507`, `:517-526`, `:544`, `:852`(`DIAGRAM_NONE_SYSTEM_PROMPT_SNAPSHOT`), `:865-894`.
- pele도 Mermaid 문법을 그대로 받으므로 고칠 필요가 없다. 다만 7종 키워드를 모두 pele가 지원하는지는 시험 렌더로 확인해야 한다.

---

## 2. Export pipeline (929d116 기준)

### 2.1 입력
`src/lib/export/types.ts:9-30` `ExportOptions = { content (원본 마크다운), filename, theme: 'light'|'dark', highlighter, mdFilePath?, onUnembeddedImages?, confirmUnembeddedImages? }`

- **미리보기 DOM은 인자로 받지 않는다.** 각 export 함수가 `document.querySelectorAll`로 전역 DOM을 직접 뒤진다.
- 호출부: `AppLayout.tsx:165`(HTML), `:194`(PDF), `:224`(DOCX). 모두 `useEditorStore.getState().content`와 `exportTheme`(`:151-154`, system 모드는 matchMedia로 판정)을 넘긴다.

### 2.2 HTML (`exportHtml.ts`)
- `:43` `renderMarkdown(content, highlighter)`로 **원본에서 다시 렌더**한다. 이 결과에는 빈 `.mermaid-container` 자리만 있다.
- `:46` 다음 `:99-131` `replaceMermaidPlaceholders`: 문서 전역 `.mermaid-container`(`:106`)와 새 HTML의 자리(`:115`)를 **인덱스로 짝짓는다**(`:117-128`). 해당 DOM 노드의 `svg`를 `cloneNode(true)`해서 넣는다. svg가 없으면 빈 자리로 남는다.
- `:49` 다음 `:137-141` `embedAndReport` → `embedImagesInHtml`(`imageResolver.ts:150-186`)은 `<img src>`만 바꾸므로 SVG는 건드리지 않는다.
- CSS: `exportUtils.ts:43` `getPreviewCss(theme)`. mermaid 관련은 `:71`(배경색), `:253-260`, `:274`. **CSS 변수는 `--cm-*` 5개뿐**(`:44-56`)이고 `--md-*`, `--pele-*`는 없다.
- `buildHtmlDocument` `:297-320`: JavaScript가 없고 CSP meta도 없다.
- `generateHtmlContent` `:80-91`은 PDF용이며 같은 경로(`:85`)를 탄다.

### 2.3 PDF (`exportPdf.ts`)
- `:32-38` `generateHtmlContent`를 그대로 재사용한다. mermaid를 따로 처리하지 않는다.
- `:51-56` DOMParser로 body와 style을 뽑는다. `:66-95` 숨긴 `#pdf-export-print`를 body 끝에 붙이고 `@media print`로만 보이게 한다. `:114` `printCurrentWindow()`.
- 앱 DOM 안에서 인쇄한다. 그래서 pele의 `--pele-*` 변수를 앱 CSS가 `:root`에 정의해 두면 PDF에서는 색이 상속될 수 있다. 단 인쇄용 style이 테마를 덮을 수 있어 확인이 필요하다 (추정).
- 정리는 `afterprint` 이벤트(`:106`) 또는 5분 타이머(`:109`)로 한다. 그 사이에는 `.mermaid-container` 복사본이 body 끝에 남아 다음 HTML·DOCX 내보내기의 전역 검색에 섞일 수 있다. 미리보기가 DOM 앞쪽에 있으므로 앞 N개 매칭에는 영향이 없을 것이다 (추정).

### 2.4 DOCX (`exportDocx.ts`)
- `:79` `captureMermaidImages()` (`:125-148`): 전역 `.mermaid-container`를 돌며 **svg가 없거나 변환에 실패한 컨테이너는 건너뛴다**(`:134-135`, `:142-144`).
- `svgToPng` `:154-201`: XMLSerializer → base64 data URI(CSP 때문에 blob URL 대신 사용, `:156`) → `Image` → canvas 2배 크기 → PNG. 크기는 **미리보기 DOM의 `getBoundingClientRect()`**에서 가져오고 최소 400×200이다(`:164-166`). DOCX에는 0.75배로 넣는다(`:190-191`).
- 소비: `:241-258`. `fence`이면서 `info === 'mermaid'`일 때 `mermaidImages.shift()`로 앞에서부터 꺼낸다(**순서 의존**, 주석 `:32`). 이미지가 없으면 코드 텍스트로 대체한다(`:259-272`).
- **기존 버그 (확인):** 중간 다이어그램 하나가 문법 오류이거나 빈 펜스여서 svg가 없으면, 그 컨테이너는 건너뛰고 뒤의 이미지가 모두 **한 칸씩 앞 펜스로 밀린다.** HTML 쪽은 인덱스로 짝지어서 밀리지는 않는다.
- XMLSerializer로 만든 data URI 이미지는 문서 CSS를 받지 못한다. pele의 `var(--pele-*)`에 대체값이 없으면 색이 빠진다 (추정, §8 리스크 1).

### 2.5 "export 시 원본에서 렌더" 설계 판단 근거
- HTML·DOCX 모두 이미 `content`(원본 마크다운)를 받아 다시 렌더하거나 파싱한다 (`exportHtml.ts:43,84`, `exportDocx.ts:90`).
- pele `render`는 동기 호출이다. 그래서 `data-diagram`이나 `token.content`에서 바로 SVG를 만들 수 있고, 미리보기 DOM 의존·인덱스 매칭·밀림 버그·debounce 차이가 한꺼번에 없어진다.
- **현재 결함 (확인):** 보기 모드가 editor 단독이면 미리보기가 아예 마운트되지 않는다 (`ResizablePanels.tsx:171-172`). 이때 HTML·PDF는 빈 다이어그램 자리를, DOCX는 코드 텍스트를 내보낸다.
- 미리보기는 300ms debounce(`src/hooks/usePreview.ts:13,50`) 기준이고 export는 최신 `content` 기준이다. 그래서 직전 편집에서 다이어그램 수가 달라지면 인덱스가 어긋난다.
- DOCX 크기는 pele가 돌려주는 `width`/`height`로 바꿀 수 있다. 지금 쓰는 `getBoundingClientRect`는 미리보기 `zoom`(`PreviewRenderer.tsx:183`)과 패널 폭의 영향을 받는다 (추정).

---

## 3. Theme & CSP & links

### 3.1 테마 정의
- 디자인 토큰: `src/styles/mdedit-tokens.css:11` `:root`(라이트), `:89` `[data-theme="dark"]` (예: `--md-text-primary` `:18`/`:96`, `--md-accent` `:22`/`:100`, `--md-code-bg` `:34`/`:112`).
- 에디터 변수: `src/index.css:71` `:root`, `:89` `.dark` (`--cm-*`, `--table-*`).
- 적용: `src/hooks/useTheme.ts:20-24`가 `.dark` 클래스와 `data-theme` 속성을 둘 다 설정한다 (SPEC-UI-006 브리지, `:8-10`).
- pele `--pele-*`를 `--md-*` 토큰에 연결할 자리는 `mdedit-tokens.css`의 두 블록이 자연스럽다 (추정).

### 3.2 현재 재렌더 방식
`isDark`가 effect 의존성에 있다 (`PreviewRenderer.tsx:176`). 테마가 바뀌면 다시 초기화(`:110`)하고 모든 컨테이너를 다시 parse·render한다. pele로 바꾸면 테마 전환에 재렌더가 필요 없으므로 `isDark` 의존성과 matchMedia 로직(`:78-94`)을 없앨 수 있다. 다만 SPEC-PREVIEW-010의 REQ-002·003 문구는 개정해야 한다.

### 3.3 CSP
- `index.html:7`: `default-src 'self' tauri: asset: …; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' data: asset: …; connect-src …; frame-src …`
- `src-tauri/tauri.conf.json:21-26`: `"csp": null`. Tauri 쪽 CSP 주입은 없고 index.html meta만 쓴다. 보고서에는 이 내용이 없었다.
- pele가 canvas `measureText`(OffscreenCanvas)를 쓰는 데에는 CSP 제약이 없다 (추정).

### 3.4 미리보기 링크 클릭 처리
- `PreviewRenderer.tsx:136-170`: 컨테이너에 click 리스너를 단다. `target.closest('a')`로 앵커를 찾고, `http(s)://`이면 `preventDefault`와 `stopPropagation` 후 `openUrlInBrowser(href)`를 부른다. 실패하면 `window.open`으로 폴백한다. 그 밖의 href는 기본 동작에 맡긴다.
- 커맨드: `ipc.ts:227`(929d116 기준. 로컬 HEAD에서는 `:219`) `invoke('open_url_in_browser')`. Rust 쪽은 `src-tauri/src/commands/browser_ops.rs:11-29`로, macOS `open`, Windows `cmd /C start "" url`, Linux `xdg-open`을 쓰고 **스킴 검증이 없다.**
- 권한: `capabilities/main.json:12-22`(`opener:default`, `shell:allow-execute/spawn`). 앱 코드는 opener 플러그인 JS API가 아니라 자체 커맨드를 쓴다.
- pele `links`를 쓸 경우 확인할 것:
  - (a) svgSanitize 훅(`:45-56`)이 `https:` href를 지운다.
  - (b) `closest('a')`는 SVG `<a>`에도 동작하지만, href가 `xlink:href`로만 있으면 `getAttribute('href')`가 null이다 (추정).
  - (c) 다이어그램 소스에서 나온 URL이 스킴 검증 없는 Rust 커맨드로 바로 간다. 특히 Windows `cmd`가 `&`를 해석할 위험이 있다 (추정).

---

## 4. Tests to rewrite

### 4.1 버전·의존성 고정 가드
| 파일:줄 | 단언 |
|---|---|
| `src/test/diagramRegressionGuard.test.ts:13-50` | 런타임 의존성 키 집합이 정확히 21개 (`mermaid` 포함 `:37`), `lucide-react`·`@floating-ui/react` 없음, `:49` `mermaid === '11.12.3'` |
| 같은 파일 `:52-70` | `DIAGRAM_PRESETS` 8개, 키 순서 고정, 제외 7종 미포함 (pele 교체와 무관, 유지) |
| 같은 파일 `:72-76` | `markdownKeyBindings` 3개 (무관) |
| `src/test/aiDiagramTypeRegressionGuard.test.ts:13-31` | npm 런타임 의존성 무증가, `:31` `mermaid === '11.12.3'` |
| 같은 파일 `:34`, `:60-70`, `:74-76` | cargo 의존성 무증가, 서브메뉴 8개, insertDiagram 존재 (무관) |

### 4.2 실제 mermaid로 도는 단위 테스트
- `src/test/insertDiagram.test.ts:217-228`: 7개 프리셋 body마다 `mermaid.initialize({startOnLoad:false, securityLevel:'strict'})` 후 `mermaid.parse(body)`가 resolve되는지 확인한다 (`:224-225`). pele `parse`로 바꿔 쓰면 된다.

### 4.3 `vi.mock('mermaid')` 기반
| 파일:mock 줄 | 핵심 단언 |
|---|---|
| `src/test/PreviewRenderer.test.tsx:6-12` (parse→true, render→`<svg>mermaid-diagram</svg>`) | `:68` parse 다음 render 호출, `:85` parse 실패 시 `Diagram syntax error`, `:103` render 실패 처리, `:168-206` 빈 펜스 플레이스홀더와 parse 미호출, `:242-283` 다크/라이트에서 initialize의 `theme` 값과 토글 시 재초기화·재렌더, `:361` 모든 initialize 호출이 `securityLevel:'strict', startOnLoad:false` 포함, `:440` 인라인 svg 혼합 문서의 테마 토글 회귀 |
| `src/test/mermaidValidate.test.ts:11` | `:23-37` valid/invalid와 오류 메시지 전달, `:40` parse 전에 strict로 initialize |
| `src/test/renderer.test.ts:18` | 로딩을 피하려는 mock. `:102` mermaid 펜스가 container div로 렌더됨 (mermaidPlugin 계약) |
| `src/test/MarkdownPreview.test.tsx:18` | 로딩을 피하려는 mock (**보고서 목록에 없던 항목**) |
| `src/test/aiCardRetryLimit.test.ts:25` | `:381` 다이어그램 자동 재요청이 재시도 카운터를 건드리지 않음 |
| `src/test/aiSuggestionCardRerequest.test.ts:25` | `:86` 재요청 후 diagram-valid 도달, `:169` 펜스 제거 후 검증, `:195` 삽입 시 펜스 복원, `:267` 목록 폴백은 검증을 타지 않음 |
| `src/test/aiSuggestionCard.test.ts` (mock 없음) | `:187-214` decideDiagramOutcome, `:382` `.mdedit-ai-mermaid-preview` 존재, `:554` stripMermaidFence. 이 파일은 `mermaidValidate`를 통해 실제 mermaid 모듈을 불러올 수 있다 (추정) |
| `src/test/specImgLoadBRouting.test.ts:9,15` | 주석으로만 mermaid 로딩 회피를 언급 (뷰어를 mock). 영향 작음 |

### 4.4 929d116에서 새로 생긴 내보내기 테스트 (보고서 이후)
- `src/test/exportImageEmbed.test.ts:306-330` **DM1**: 문서 DOM에 `.mermaid-container > svg`를 직접 붙이고 canvas를 mock한 뒤 `exportToDocx` 실행. PNG `ImageRun`이 1회 호출되고 펜스 코드 텍스트(`DIAGRAM_SRC`)는 들어가지 않음을 단언한다. **DOM 캡처 방식에 묶여 있어**, 원본 렌더 방식으로 바꾸면 다시 써야 한다.
- 같은 파일 `:109`: 각 테스트가 끝날 때 `.mermaid-container`를 정리한다.

### 4.5 e2e
| 파일:줄 | 단언 |
|---|---|
| `e2e/mermaid-subgraph-label.spec.ts:1-199` | 시나리오 B(`:157-177`, 세로)와 C(`:180-198`, 가로)의 픽스처 `:13-40`(긴 한글 subgraph 제목). `:59` `.mermaid-container svg .cluster-label`을 기다린 뒤 `:73-98`에서 `.cluster-label` 안 `foreignObject`의 높이를 측정해 한 줄 높이의 1.6배 이하인지 확인. `:116-150` `.cluster` 상자 겹침 없음. **mermaid DOM 구조(`foreignObject`)에 묶여 있다** |
| `e2e/markdown-render.spec.ts:41` | `.preview-content .mermaid-container svg`가 보일 때까지 대기 (SPEC-PREVIEW-011 레이아웃 고정용) |
| `e2e/markdown-render.spec.ts:61` | `.mermaid-container`가 보임 |
| `e2e/ai-inline-edit.spec.ts:230` | `.mdedit-ai-mermaid-preview`가 보임, `:238` 삽입된 문서에 ```` ```mermaid ```` 포함 |
| `e2e/fixtures/tauri-v2-ai-mock.ts:115-118` | 1차 응답은 `notarealdiagramtype foo!!!`(**검증 실패를 기대**), 2차는 유효한 flowchart. pele도 첫 응답을 거부해야 이 시나리오가 성립한다 |
| `e2e/fixtures/test-content.md:15-22` | `graph TD` 한글 노드 샘플 |

---

## 5. SPEC requirements to amend

| SPEC (디렉터리) | 요구 ID: 한 줄 요약 |
|---|---|
| `.moai/specs/SPEC-PREVIEW-006/spec.md` | **REQ-PREVIEW006-004** (`:91-93`): patch-package로 `postinstall`마다 mermaid 패치를 결정론적으로 적용. **REQ-PREVIEW006-005** (`:95-97`): `package.json`에 mermaid를 정확히 `11.12.3`으로 고정. **REQ-PREVIEW006-007** (`:103-105`): 패치가 없거나 버전이 바뀌면 가드 테스트 실패. REQ-001~003(`:81-89`)의 "cluster 제목 1줄·겹침 없음"은 라이브러리와 무관한 목표라 유지할 수 있다. "재논의 금지" 절(`:57`, ELK `:63`, `:121`)은 기각된 대안 목록이며 라이브러리 교체는 그 대상이 아니다 |
| `.moai/specs/SPEC-PREVIEW-010-mermaid-dark-theme/spec.md` | **REQ-PREVIEW010-001** (`:61-65`): 다크면 `theme:'dark'`, 라이트면 `'default'`로 렌더. **REQ-PREVIEW010-002** (`:67-71`): 토글 시 "`initialize` 다시 호출 → `.mermaid-container` 다시 `render`" (mermaid API 이름이 문구에 박혀 있음). **REQ-PREVIEW010-004** (`:78-82`): 모든 `mermaid.initialize`에서 `securityLevel:'strict'`·`startOnLoad:false` 유지. **REQ-PREVIEW010-006** (`:89-93`): `:93` mermaid 버전 핀(11.12.3) 변경 금지, `:92` 내보내기 배경 로직 유지 |
| `.moai/specs/SPEC-UI-008-diagram-insert-menu/spec.md` | **REQ-UI-008-008** (`:83`): 삽입된 펜스는 "mermaid 11.12.3에서 파싱/렌더 오류 없이 즉시 렌더". **REQ-UI-008-019** (`:100`): 새 런타임 의존성 추가 금지 (**pele 추가와 충돌**). **REQ-UI-008-020** (`:101`): mermaid 버전 핀, `securityLevel:'strict'`, `⚠ Diagram syntax error` 폴백 변경 금지. 관련 AC: `:248` AC-UI-008-004 ("11.12.3 `parse` 통과"), `:107`(스니펫 검증 문구), `:220`(`mermaid.parse` 미호출 힌트) |
| `.moai/specs/SPEC-AI-001/spec.md` | **REQ-AI-023** (`:124`): 로컬 mermaid 파서로 스크립트가 차단된 안전 모드에서 검증 (`securityLevel:'strict'` 유지). **REQ-AI-024** (`:125`): mermaid 검증 실패 시 오류를 동봉해 1회 재요청하고, 다시 실패하면 목록 폴백 |
| `.moai/specs/SPEC-AI-008-diagram-type-picker/spec.md` | **REQ-AI-008-017** (`:112`): "`mermaid.parse` 유효성이 유일한 하드 게이트", `validateMermaid` 계약 무변경. **REQ-AI-008-019** (`:114`): 새 런타임 의존성 금지 (**pele와 충돌**). **REQ-AI-008-021** (`:116`): mermaid 버전 핀(11.12.3)·strict 불변식 변경 금지. AC-AI-008-013(`:183`) |
| **(보고서에 없던 항목)** `.moai/specs/SPEC-EXPORT-001/spec.md` | **REQ-EXPORT-003** (`:83-84`): HTML 내보내기에 Mermaid를 인라인 SVG로 포함. **REQ-EXPORT-020** (`:155-156`): 내보낸 파일에 JS 없음, SVG만. pele에서도 유지되므로 문구 확인 정도면 된다 |
| **(새로 생김)** `.moai/specs/SPEC-EXPORT-004-export-image-path/spec.md` | `:130` "DOCX export shall Mermaid 다이어그램 캡처·삽입 동작을 지금과 같이 유지". `:164` "Mermaid 렌더러 교체는 이 SPEC 범위가 아님". 원본 렌더 방식을 택하면 `:130`의 "캡처" 문구와 부딪친다 |

**문서**
- `docs/USER_MANUAL.md`(929d116): 목차 `:15` "7. Mermaid 다이어그램 트러블슈팅"이 가리키는 앵커와 달리, 실제 제목은 `:498` `## Appendix: Mermaid 다이어그램 문법 오류 해결`이다(**앵커 깨짐**). 본문은 `:498-665`이고 `:666`에서 "## 8"로 넘어간다. 그 밖에 `:94`, `:29`, `:75-80`에도 언급이 있다.
- `docs/USER_GUIDE.md:204-206`: "테마를 전환하면 다이어그램이 즉시 다시 채색". `:236`, `:320`도 AI 다이어그램을 설명한다.
- `README.md:15,104` ("Mermaid 11.12.3").
- `.moai/project/{tech,structure,product}.md`와 `codemaps/*`에도 mermaid가 언급된다 (상세는 읽지 않음).

---

## 6. Package / patch removal

- `package.json`(929d116): `:37` `"mermaid": "11.12.3"`, `:18` `"postinstall": "patch-package"`, `:59` `"patch-package": "^8.0.0"`(dev).
- `patches/` 안에는 **`mermaid+11.12.3.patch` 하나만** 있다 (14줄). `node_modules/mermaid/dist/chunks/mermaid.core/chunk-JZLCHNYA.mjs`의 cluster `rect` → `createText`에 `width: 1e5`를 추가한다. 이 파일을 지우면 patch-package와 postinstall도 함께 없앨 수 있다. 다른 패치는 없다.
- 설치된 버전은 `node_modules/mermaid/package.json:3` 11.12.3. lock의 `node_modules/mermaid`(`package-lock.json:6403`~)는 cytoscape*, d3, dompurify ^3.2.5, katex ^0.16.22, marked, `@mermaid-js/parser`(`:1438`) 등을 끌어온다. 함께 사라진다.
- **`dompurify`(`:34`)와 `katex`(`:35`)는 앱이 직접 쓰므로 남는다.** `@types/dompurify`(`:32`)도 남는다.
- ELK(`@mermaid-js/layout-elk`)는 설치돼 있지 않다 (lock 검색 결과 없음).
- `pele`는 아직 `node_modules`에 없다.
- 가드 테스트의 의존성 집합(`diagramRegressionGuard.test.ts:19-43`)은 `mermaid`를 빼고 `pele`를 넣도록 고쳐야 한다.

---

## 7. Drift vs 2026-10-24 report

| 보고서 항목 | 현재 (929d116) | 판정 |
|---|---|---|
| PreviewRenderer `:2, 29, 110, 126-129`, forEach `:114` | 같음 | 일치 |
| mermaidValidate `:7, 20-28` | 같음 | 일치 |
| ai-suggestion-card `:1287-1297` | `:1287-1298` | 일치 |
| insertDiagram.test `:218-230` | `:217-228` | 사소 |
| mermaidPlugin `:13-24` | 같음 | 일치 |
| exportHtml `:95-126` | **`:99-131`** (호출 `:46`, `:85`). 머리 주석이 추가돼 4줄 밀림. 로직은 같음 | 줄 이동 |
| exportPdf "HTML 결과 재사용" | 같음. 이미지 누락 확인 콜백이 추가됨(`:30-45`) | 보강됨 |
| exportDocx `:111-188` | **capture `:125-148`, svgToPng `:154-201`, 소비 `:241-258`, 호출 `:79`**. `ImageContext`가 추가돼 밀림 | 줄 이동 |
| 프리셋 `keyboard-shortcuts.ts:159-290` | 배열 `:194-257`, 함수 `:266-299` | 범위 일치 |
| prompt.rs `:101-106, 170-200, 852` | 같음 | 일치 |
| CSP `index.html:7` | 같음. `tauri.conf.json:22` `csp: null`은 보고서에 없음 | 보충 |
| "svgSanitize는 foreignObject 제거, pele 출력을 그대로 통과 가능" | 맞지만 **`:45-56` href 훅이 `https:` 링크를 제거한다** (pele `links`가 무력화됨) | **보정 필요** |
| mock 기반 테스트 목록 | **`MarkdownPreview.test.tsx:18` 누락**. `exportImageEmbed.test.ts:306-330` DM1이 새로 생김 | 누락·신규 |
| 고정 SPEC 목록 | **SPEC-EXPORT-004 `:130`(새로 생김), SPEC-EXPORT-001 REQ-003/020, UI-008 REQ-019·AI-008 REQ-019(새 의존성 금지)** 누락 | 누락 |
| "세 곳이 같은 전역 initialize, AI 쪽은 테마 없음 (미확인)" | 세 곳 확인(`PreviewRenderer:110`, `mermaidValidate:21`, `ai-suggestion-card:1290`). `setSiteConfig`가 기본값으로 되돌림을 확인(`chunk-ABZYJK2D.mjs:2511-2519`) | 대부분 확인 |
| "forEach(async)는 늦은 옛 결과가 새 결과를 덮을 수 있음" | 내용 변경 시에는 떨어진 노드에 써서 무해(추정). 실제 위험은 테마 토글 겹침과 전역 설정 경쟁 | 재해석 |
| USER_MANUAL "Mermaid 문제 해결 절" | `:498-665` Appendix. 목차 `:15` 앵커가 깨져 있음 | 위치 확정 |
| (새 발견) editor 단독 모드에서 내보내기 시 다이어그램 누락 | `ResizablePanels.tsx:171-172` | 새 결함 |
| (새 발견) DOCX에서 이미지가 앞 펜스로 밀림 | `exportDocx.ts:134-135, 142-144, 242` | 새 결함 |
| 로컬 트리 | 로컬 `main`=6a322d6, 929d116은 origin/main에만 있음 | 환경 주의 |

---

## 8. Risks & implicit contracts

1. **내보내기 색 소실.** `getPreviewCss`(`exportUtils.ts:43-73`)에는 `--pele-*` 정의가 없다. DOCX는 SVG를 떨어진 data URI 이미지로 그리므로(`exportDocx.ts:155-162`) 문서 CSS를 받지 못한다. 변수 값을 SVG에 직접 박거나 SVG 안 `<style>`에 넣어야 한다. 대체값 존재 여부는 pele 출력에 달려 있다 (추정).
2. **링크 정책.** svgSanitize 훅(`:45-56`)과 SvgFileViewer가 같은 설정을 쓰므로, 링크를 살리려면 전용 sanitize 설정이나 후처리를 따로 두어야 한다. 여기에 Rust `open_url_in_browser`의 스킴 미검증(`browser_ops.rs:11-29`)이 겹친다.
3. **`data-diagram` 이스케이프 계약.** `mermaidPlugin.ts:19`는 `"`만 바꾼다. 엔티티 디코드를 거친 문자열이 렌더러 입력이다. pele로 바꿀 때 같은 입력을 유지해야 한다 (추정).
4. **오류·빈 펜스 UI 계약.** `⚠ Diagram syntax error` 마크업(`PreviewRenderer.tsx:131`)과 `md-diagram-placeholder`(`:121-122`)를 SPEC-UI-008 REQ-013/014/020과 SPEC-PREVIEW-010 REQ-005가 요구한다. `PeleError`의 `line`/`column`을 쓰려면 문구 변경을 SPEC에 반영해야 한다.
5. **검증기와 렌더러 일치.** AI 검증(`mermaidValidate`)과 미리보기, 카드 미니 렌더가 같은 엔진을 써야 한다. e2e 모의 응답(`tauri-v2-ai-mock.ts:117`)은 "검증 실패" 동작을 기대한다.
6. **전역 상태 제거의 부수 효과.** pele는 전역 initialize가 없어 다크 모드 덮어쓰기 문제가 사라진다. 대신 PreviewRenderer 테스트 `:242-440`(initialize 호출 단언)은 전부 의미가 없어진다.
7. **레이아웃·크기 변화.** e2e 서브그래프 테스트가 `foreignObject`를 측정한다(`mermaid-subgraph-label.spec.ts:76,94`). pele는 라벨을 `<text>`로 그리므로 측정 대상을 바꿔야 한다. `responsive`/`autoDirection` 설정이 미리보기 폭에 따라 배치를 바꿀 수 있다 (보고서 §4-2).
8. **DOCX 크기 계약.** `getBoundingClientRect`에 최소 400×200을 적용하는 현재 방식(`exportDocx.ts:164-166`)은 zoom과 패널 폭에 좌우된다. 원본 렌더 방식이면 pele `width`/`height`를 쓴다.
9. **번들 분리 착시.** 카드는 동적 import를 쓰지만 `mermaidValidate`를 통해 정적으로도 불러온다 (`ai-suggestion-card.ts:18`).
10. **SPEC의 "새 런타임 의존성 금지" 조항** (UI-008 REQ-019, AI-008 REQ-019)은 해당 SPEC 범위 안의 제약이다. 그래도 가드 테스트가 의존성 집합 전체를 고정하므로 교체 SPEC에서 명시적으로 풀어야 한다.

---

## 9. Open questions

1. 로컬 `main`을 `origin/main`(929d116)으로 맞춘 뒤 작업할 것인가? 작업 트리에 `.moai/`·`.claude/` 미커밋 변경이 많다.
2. 내보내기를 "미리보기 DOM 복사"에서 "원본에서 pele로 렌더"로 바꿀 것인가? 그러면 editor 단독 모드 누락과 DOCX 밀림 버그가 함께 해결되지만 SPEC-EXPORT-004 `:130` 문구를 개정해야 한다.
3. pele `links`를 지원할 것인가? 지원한다면 sanitize 설정을 분리하고 Rust URL 스킴을 검증해야 한다. 지원하지 않는다면 `links` 옵션을 끈다.
4. 다크 테마를 `--pele-*`를 `--md-*`에 연결하는 방식으로 처리할 것인가? 그렇다면 내보낸 HTML의 `data-theme` 기준 값은 어디서 가져올 것인가 (`buildHtmlDocument`는 `exportUtils.ts:305`에서 `data-theme`만 설정함)?
5. AI 카드 미니 렌더의 다크 대응 (지금은 테마가 없음)을 이번 교체에서 함께 정할 것인가?
6. `PeleError`의 line/column을 AI 재요청 메시지(`ai-suggestion-card.ts:1135`의 `이전 오류: …`)에 넣을 것인가? mermaid 오류 문자열에 맞춘 테스트 단언(`mermaidValidate.test.ts:37` `'Parse error'`)도 바뀐다.
7. 7개 프리셋과 `stateDiagram-v2`(`prompt.rs:190`), `mindmap`, `pie title …` 문법을 pele가 모두 지원하는가? 보고서 §5의 시험 렌더 체크리스트로 확인해야 한다.
8. USER_MANUAL 목차 `:15`의 깨진 앵커를 이번 문서 개정 때 함께 고칠 것인가?
