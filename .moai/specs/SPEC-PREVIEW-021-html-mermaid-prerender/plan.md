# SPEC-PREVIEW-021 plan.md — 구현 계획 (Tier M, v0.1.0)

## §A Context

- 백로그 카드 t2. 선명 모드(srcdoc)에서 HTML 파일의 `pre.mermaid`·`div.mermaid` 블록을 pele SVG로 미리 그려 넣는다. 원본 보기는 바꾸지 않는다.
- 기준: origin/main `cdaadcf`(SPEC-PREVIEW-020 병합 직후). worktree `.claude/worktrees/html-mermaid-prerender`, 브랜치 `WT-mermaid-prerender`.
- 병행 카드: t1 SPEC-SEC-002(CSP 글꼴, worktree `csp-font-src`), t3 SPEC-PREVIEW-022(원본 보기 한글 깨짐, worktree `html-charset`). 병합 순서 t1 → t3 → t2.

### 검증된 코드 앵커 (cdaadcf, plan 단계에서 직접 읽음)

| 위치 | 내용 | 이 SPEC과의 관계 |
|------|------|------------------|
| `src/components/preview/HtmlFileViewer.tsx` `CrispHtmlView` 읽기 효과 | `readFile(htmlPath)` → `buildSrcdoc(text, { baseHref, zoomPercent })` → `setState({ kind: 'ready', srcdoc })` | 삽입 지점: `buildSrcdoc(prerenderMermaidBlocks(text), …)` |
| `src/lib/preview/htmlSrcdoc.ts` `buildSrcdoc`·`maskComments`·`HTML_ZOOM_FRAME_SCRIPT` | 주석 가림(오프셋 보존) 후 `<head>` 뒤 주입. 스크립트는 셸 CSP 해시와 한 몸 | 바꾸지 않는다. 주석 가림 발상만 새 모듈에서 재사용(raw text 요소까지 확장) |
| `src/lib/export/exportUtils.ts` `renderExportDiagram(source, values)` | 빈 소스·실패 `null`, 성공 시 모양 톤 주입 + `resolveDiagramColors`로 `var(--pele-)` 0개인 `SVGSVGElement` | 렌더에 그대로 사용 |
| `src/lib/diagram/diagramRenderer.ts` `renderDiagram`·`readPeleThemeValues`·`DIAGRAM_FONT_FAMILY*` | 단일 렌더·정화 경로, 예외를 던지지 않음. jsdom에서 `readPeleThemeValues`는 빈 표(대체값 사용) | 실패 안내의 line·column은 실패 경로에서만 `renderDiagram`을 한 번 더 불러 얻는다 |
| `src/styles/mdedit-tokens.css` `--pele-*` | 고정 팔레트, `[data-theme="dark"]` 블록에 재정의 없음 | `'light'` 탐침 하나로 충분 |
| `index.html` 메타 CSP | `font-src` 없음 → `default-src` 적용, `data:` 불허. `style-src 'unsafe-inline'` 있음 | 인라인 style 속성·`<style>` 사용 가능, CSP는 불변 |
| `e2e/html-file-viewer.spec.ts` 157행~ | 선명 모드 describe(영속 버전 2 시드) | 새 e2e 케이스 추가 위치 |

## §B Known Issues (위험)

1. **글꼴(가장 큰 위험)**: srcdoc은 불투명 출처라 웹폰트가 CORS로 막힐 수 있다(019 한계 3). 글꼴이 대체되면 라벨이 노드 밖으로 넘친다. → M1 관문.
2. **문자열 탐색 오판**: 정규식 탐색은 주석·`<script>`·`<style>`·`<textarea>`·`<template>` 안의 문자열을 잡을 수 있다. → 같은 길이 공백으로 가린 사본에서만 위치를 찾고 원본에서 자른다(오프셋 보존).
3. **중첩 `div`**: `div.mermaid` 안에 `div`가 있으면 첫 `</div>`가 짝이 아니다. → 깊이 계산. 짝을 못 찾으면 건드리지 않음.
4. **이미 그려진 블록**: 저장 전에 mermaid가 돌았던 HTML(SVG 포함, `data-processed`)은 다시 그리면 망가진다. → 건너뜀.
5. **jsdom 한계**: jsdom에서 pele는 내장 글자 폭 표를 쓰고 `getComputedStyle`이 토큰 값을 못 읽는다. 단위 테스트는 구조(SVG 존재, `var(--pele-` 0개, 감싸개 속성)만 단언하고 픽셀·색 값은 e2e·수동으로 본다.
6. **병행 카드 겹침**: t3(SPEC-PREVIEW-022)가 `HtmlFileViewer.tsx` 원본 보기 쪽을 고칠 가능성이 있다. 이 SPEC은 `CrispHtmlView`의 한 줄과 `@MX:NOTE`만 바꾼다. 병합 순서상 t3 뒤이므로 run 시작 시 origin/main을 병합하고 충돌을 확인한다.

## §C Pre-flight (run 시작 점검)

1. origin/main 병합 후 `grep -n "^status:" .moai/specs/SPEC-PREVIEW-019*/spec.md .moai/specs/SPEC-PREVIEW-015*/spec.md` → 둘 다 `completed`.
2. `grep -n "font-src" index.html` — SEC-002 병합 여부와 `data:` 허용 여부 기록(REQ-008 경로 선택 입력).
3. `git log --oneline origin/main -5 -- src/components/preview/HtmlFileViewer.tsx` — t3 변경 확인.
4. 기준선: `npx vitest run src/test/HtmlFileViewerCrisp.test.tsx src/test/htmlSrcdoc.test.ts src/test/exportDiagram.test.ts` 통과 기록.

## §D Constraints

- 바꾸는 파일(run 예정): `src/lib/preview/htmlMermaid.ts`(신규), `src/components/preview/HtmlFileViewer.tsx`(호출 1곳 + `@MX:NOTE`), `src/test/htmlMermaid.test.ts`(신규), `src/test/HtmlFileViewerCrisp.test.tsx`(케이스 추가), `e2e/html-file-viewer.spec.ts`(선명 모드 describe에 케이스 추가 — 기존 방식대로 HTML은 테스트 안 상수 + `read_file` 모의, 픽스처 파일 없음). 경로 (A)/(B)에서 글꼴 주소가 필요하면 새 모듈 안에서 처리한다.
- 바꾸지 않는 파일: `src/lib/preview/htmlSrcdoc.ts`, `index.html`, `src/lib/diagram/diagramRenderer.ts`, `src/lib/export/exportUtils.ts`, `src/store/uiStore.ts`, `src-tauri/**`.
- 새 의존성 없음. 셸 CSP·iframe sandbox 불변.
- 코드 주석은 한국어(`code_comments: ko`). 커밋 메시지는 한국어, SPEC ID와 카드 t2 명시.

## §E Self-Verification (게이트)

- `npx vitest run src/test/htmlMermaid.test.ts src/test/HtmlFileViewerCrisp.test.tsx src/test/HtmlFileViewer.test.tsx src/test/htmlSrcdoc.test.ts src/test/htmlSrcdocCsp.test.ts src/test/exportDiagram.test.ts` 통과.
- `npx tsc --noEmit` 오류 0, `npx eslint src/lib/preview src/components/preview` 새 오류 0.
- `npx playwright test e2e/html-file-viewer.spec.ts` 통과.
- `git diff origin/main -- index.html src/lib/preview/htmlSrcdoc.ts src/lib/diagram src/lib/export` 출력 없음.

## §F Milestones (바뀔 가능성이 큰 결정부터)

### M1 — 글꼴 관문 (Priority High, 측정만, 운영 코드 커밋 금지)

- 목적: REQ-008 경로 (A)/(B)/(C) 결정.
- 방법: macOS 개발 빌드에서 선명 모드로, mermaid 블록 1개를 손으로 SVG 치환한 HTML 시안을 연다. (A) `@font-face { font-family: 'Barlow'; src: url('<앱 출처>/fonts/barlow-400.woff2') }`를 넣고 `document.fonts.check('16px Barlow')`와 라벨 폭을 웹 검사기로 확인. 앱 출처 값은 개발(`http://localhost:1420`)·배포(`tauri://localhost`, Windows `http://tauri.localhost`)를 각각 적는다. (B) SEC-002가 `data:`를 허용했다면 같은 방식으로 `data:font/woff2;base64,…`를 확인.
- 기록: progress.md에 OS·빌드별 결과표. (A)/(B)가 모두 실패하면 run을 멈추고 (C) 수용 여부를 blocker로 코디네이터에 올린다.

### M2 — 블록 탐색기 (Priority High, 순수 함수, TDD)

- `src/lib/preview/htmlMermaid.ts`에 내부 함수 `findMermaidBlocks(html): Block[]`(`{ start, innerStart, innerEnd, end }` 오프셋).
- 가림 사본: 주석 → 공백, `<script|style|textarea|template …>…</…>`의 안쪽 → 공백(오프셋 보존).
- 시작 태그 정규식: `<(pre|div)(\s[^>]*)?>`(대소문자 무관) → 속성 문자열에서 `class` 값을 세 형식으로 꺼내 토큰 검사. `data-processed` 속성 검사.
- 닫기: `pre`는 다음 `</pre\s*>`; `div`는 `<div(\s[^>]*)?>` +1 / `</div\s*>` −1 깊이 계산.
- RED 먼저: AC-002·003 표의 각 행을 실패 테스트로 쓴다.

### M3 — 원문 추출·렌더·삽입 (Priority High, TDD)

- 공개 함수 `prerenderMermaidBlocks(html: string): string` — 예외를 잡아 입력 반환.
- 원문: `document.createElement('template')`의 `innerHTML`에 안쪽 HTML → `br` 요소를 글자 노드 `<br/>`로 교체 → `content.textContent` → dedent·trim.
- 렌더: `renderExportDiagram(src, readPeleThemeValues('light'))`(값 표는 호출당 1번만 읽는다). 성공: `new XMLSerializer().serializeToString(svg)` 또는 `svg.outerHTML`을 감싸개 `<div data-mdedit-diagram="" style="…">`에 넣어 안쪽 교체. 감싸개 style 값은 치환 값 표에서, 없으면 대체 리터럴(`#FAF9F6`·`#97A4B1`·`3px`).
- 실패: `renderDiagram(src)`를 한 번 더 불러 line·column만 얻고 안내 `<p data-mdedit-diagram-error="" style="font-size:0.875rem;color:#F59E0B;font-style:italic;margin:0.25rem 0">⚠ 이 다이어그램은 그릴 수 없었습니다 (L행 C열)</p>`를 닫는 태그 뒤에 넣는다.
- 뒤에서 앞으로(오프셋이 큰 블록부터) 치환해 앞 블록 오프셋이 흔들리지 않게 한다.

### M4 — 글꼴 삽입 (Priority Medium, M1 결과에 따름)

- (A)/(B)일 때: 렌더 성공 블록이 1개 이상이면 `@font-face` `<style data-mdedit-diagram-fonts="">`를 `</body>` 앞(없으면 끝)에 1번 넣는다. 굵기는 pele가 쓰는 400·600(→ 파일 500/700 중 M1에서 확인한 것)·mono 400으로 한정.
- (C)일 때: 이 마일스톤은 비고 §3 한계에 글꼴 대체를 추가하는 SPEC 개정 blocker를 올린다.

### M5 — 뷰어 연결·주석 (Priority Medium)

- `CrispHtmlView` 읽기 효과: `buildSrcdoc(prerenderMermaidBlocks(text), …)`. `useEffect` 의존성 불변(`[htmlPath]`).
- `@MX:NOTE`에 REQ-010 한계 3줄, 새 모듈 머리에 `@MX:NOTE`(삽입 계약)·`@MX:WARN`(정화 경로 외 마크업 결합 금지, REASON 포함).

### M6 — 테스트·e2e·기록 (Priority Low)

- `HtmlFileViewerCrisp.test.tsx`: srcdoc에 SVG 포함, 원본 보기·크기 폴백에서는 원문 유지(AC-001·009).
- e2e: 선명 모드 describe 옆에 새 describe(같은 시드·`read_file` 모의 방식)로 HTML 상수(성공 1, 실패 1, `code.language-mermaid` 1)를 열어 AC-012를 확인한다.
- progress.md에 AC 매트릭스·M1 결과·수동 M-1/M-2 대기 기록.

## mx_plan

| 대상 | 태그 | 이유 |
|------|------|------|
| `htmlMermaid.ts` `prerenderMermaidBlocks` | `@MX:NOTE` | 삽입 계약(블록 안쪽만 교체, 바깥 바이트 보존, 예외 시 입력 반환) |
| `htmlMermaid.ts` 감싸개·안내 조립부 | `@MX:WARN` + `@MX:REASON` | srcdoc에 들어가는 마크업 — 정화 SVG·고정 문자열 외 결합은 XSS 경로 |
| `HtmlFileViewer.tsx` 선명 모드 `@MX:NOTE` | 갱신 | REQ-010 한계 |

## §G Anti-Patterns

- `buildSrcdoc`이나 고정 스크립트에 손대기(셸 CSP 해시가 깨져 배율이 조용히 멈춘다).
- 셸 CSP에 `font-src`·`data:`·`'unsafe-inline'` 스크립트를 이 SPEC에서 추가하기.
- 블록 원문을 `innerHTML`로 활성 문서에 넣어 해석하기, 오류 메시지 문자열을 안내 HTML에 이어 붙이기.
- HTML 전체를 DOM으로 파싱했다가 다시 직렬화하기(doctype·스크립트·공백이 바뀐다 — REQ-006 위반).
- pele 렌더 옵션이나 `renderExportDiagram`을 이 용도로 고치기.
