# SPEC-PREVIEW-015 — Progress

## §E.1 Plan-phase Audit-Ready Signal

- plan 산출물(Tier L 5종 + 진행 기록): research.md(조사 단계), spec.md(v0.4.1), design.md, plan.md, acceptance.md, progress.md, 그리고 요약본 spec-compact.md
- SPEC ID 정규식 검사: `SPEC-PREVIEW-015` PASS (2026-10-26, Bash 실행)
- REQ 25건, AC 25건 (Tier L 상한 25), 모든 REQ가 AC 1건 이상에 연결됨. REQ-025·AC-025는 M1b 판정으로 최종 문구 확정(spec v0.4.0)
- 남은 미결 표지: 없음
- plan-audit: iteration 1 FAIL 0.76(`review-1.md`) → iteration 2 PASS 0.91(`review-2.md`) → M1·M1b 판정 반영 뒤 iteration 3 FAIL 0.85(`review-3.md`) → 결함 D1·D2·D4–D10 반영(spec v0.4.1, D3은 오케스트레이터가 §E.2에 반영) → iteration 4(아래 줄)
- 상태: `status: draft` 유지. M1·M1b 커밋(`20eb33f`, `d1dbc02`)은 운영 코드를 바꾸지 않는 사람 게이트용 시험 측정이므로 `draft → in-progress` 전이를 일으키는 첫 run-phase 커밋으로 보지 않는다. 전이는 manager-develop이 첫 M2 커밋에서 한다.
- plan-audit iteration 4: PASS-WITH-DEBT 0.88 (`.moai/reports/plan-audit/SPEC-PREVIEW-015-review-4.md`, 조건: N1–N4를 M2 인계 전에 반영) → N1–N8 모두 반영(spec v0.4.2)
- plan_complete_at: 2026-10-26T16:34:40+09:00
- plan_status: audit-ready

## §E.2 Run-phase Evidence

### M1 시험 렌더링 증거 (2026-10-26, 기준 HEAD 57eb160 위 작업 트리)

- 설치: `npm ci`(postinstall `patch-package` → `mermaid@11.12.3 ✔`) 후 `npm i -E pele@1.10.0`. `npm ls mermaid pele --depth=0` → `mermaid@11.12.3`, `pele@1.10.0`. `package.json` `"pele": "1.10.0"`(캐럿 없음).
- 산출물: `m1/report.html`(나란히 비교·내보내기·시간), `m1/checks.md`(확인 항목 1–13 표 + MANUAL 3건), `m1/evidence/*.json`, `m1/img/`, `m1/exports/`(HTML·Chromium 대용 PDF·DOCX·PNG), `src/test/fixtures/pele/`(`unit/` 77개·`browser/` 76개, `manifest.json` 153항목).
- 확인 항목 상태: PASS 1·2·3·4a·7·8·9·10·11·12·13(측정), PASS+주의 5·6(다크 literal 대비), MANUAL 4b·5(PDF 앱 경로)·13 기준선. FAIL 없음.
- 측정 환경: `vitest 2.1.9 jsdom 28.1.0`, `playwright 1.58.2 webkit 26.0`, `chromium 145.0.7632.6`(PDF 대용).
- 첫 렌더 시간(다이어그램 32개, webkit): mermaid 579 / 516 / 507ms, pele 32 / 34 / 32ms.
- 관찰된 `--pele-*`: accent, bg, border, fg, font, font-mono, heading-weight, line, muted, radius, series-1…4, surface, surface-alt, title-weight. 소스에만: series-5…8, error, critical, zoom-*.
- jsdom: 캔버스 없음(`getContext('2d')` null) → pele 내장 측정기로 결정적 렌더. 픽스처 재렌더 검증 `unitChecked=76 browserChecked=76 mismatches=0`.
- 판정 참고 사항(report F1–F10): 수식 라벨이 mermaid에서는 수식으로, pele에서는 `$$…$$` 원문으로 보임 / 다크 literal 내보내기의 흰 DOCX 페이지 대비 문제 / `line≥1·column 0` 오류 위치 미관찰 / 정화기가 `role` 속성 제거 / mindmap·서브그래프 내부 방향 등 배치 차이.
- 이 브랜치 영향: `src/test/diagramRegressionGuard.test.ts` 의존성 집합 단언 1건 실패(pele 추가, M2 범위).

### M1 사용자 판정 (2026-10-26, AskUserQuestion으로 수집)

- 판정(통과/보류): **통과**. M1 측정에서 현재 mermaid strict는 KaTeX로 수식을 그리고 pele(해석기 없음)는 원문을 보였다(D15 추정 정정). 사용자는 처음에 "다이어그램 안 수식 미지원"으로 통과시켰다가, 같은 날 결정을 바꿔 **pele `math` 옵션에 기존 katex를 연결**하기로 했다. 그 결정은 M1b 보강 측정으로 확정됐다(아래 "M1b 측정" 판정: `mathml-bare`). 따라서 "수식 미지원"은 폐기된 중간 결정이다.
- `responsive` 선택: **true** (패널 폭에 맞춰 축소)
- DOCX 다크 색: **DOCX는 내보내기 테마와 상관없이 항상 라이트 색 값**을 넣는다(흰 페이지 대비). HTML·PDF는 내보내기 테마를 따른다.
- D5 `--pele-*` 변수 목록: 출력에서 관찰된 accent, bg, border, fg, font, font-mono, heading-weight, line, muted, radius, series-1…4, surface, surface-alt, title-weight + 소스에만 있는 series-5…8, error, critical (zoom-* 제외, enableZoom 미사용). `--md-*` 대응은 M2에서 확정(보고서의 임시 대응은 제안일 뿐).
- D14 단위 테스트 측정기: **`jsdom-default`** — 근거: 픽스처 재렌더 검증 `unitChecked=76 browserChecked=76 mismatches=0` (오케스트레이터가 `npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/verify.capture.ts`로 직접 재실행, exit 0)
- 남은 수동 확인: MANUAL-1(앱 클릭, M3 이후), MANUAL-2(앱 PDF 내보내기), MANUAL-3(현재 앱의 수식 표시 기준선)

### M1b 측정 (2026-10-26, 기준 HEAD f145220 위 작업 트리)

- 범위: `spike/pele/` 안에서만 측정(운영 코드·의존성 변경 없음). 해석기 출력 세 방식 `html` / `mathml` / `mathml-bare`(KaTeX MathML에서 바깥 `<span class="katex">` 제거). 다이어그램 전용 정화 시제품 `spike/pele/m1b/diagramSanitize.ts`(별도 `DOMPurify(window)` 인스턴스).
- 산출물: `m1/checks.md` "M1b" 표, `m1/report-m1b.html`(M1 `report.html`에서 링크), `m1/evidence/m1b-unit.json`·`m1b-browser.json`·`m1b-csp.json`, `m1/img/m1b-*.png`(43개), `m1/exports/m1b/`(HTML 내보내기 12개, DOCX PNG 20개, 위치 탐색 PNG 8개).
- 측정 환경: `vitest 2.1.9 jsdom 28.1.0`, `playwright 1.58.2 webkit 26.0`, 비교 `chromium 145.0.7632.6`, KaTeX 0.16.44, DOMPurify 3.4.12.
- 확인 1 미리보기: `mathml-bare`만 webkit에서 제자리(수식 픽셀의 fO 안 비율 1). `html`·`mathml`은 webkit에서 비율 0(SVG 왼쪽 위로 몰림), chromium에서는 1. 같은 어긋남이 KaTeX CSS가 실린 페이지의 mermaid 수식에도 보임.
- 확인 2 정화: 공유 `sanitizeSvg` × M1 픽스처 38쌍 바이트 동일(jsdom·webkit·chromium, 사용 전·중·후 모두 불일치 0). 다이어그램 경로는 fO·수식 내용 유지, 적대 입력 9종 남은 표지 0. 별도 인스턴스 훅은 `sanitizeSvg`에서 0회 실행, 전역 인스턴스 훅은 43회 실행(대조). 새 인스턴스는 공유 href 훅을 물려받지 않음 → 다시 등록 필요.
- 확인 3 HTML 내보내기: `mathml-bare`는 KaTeX CSS·글꼴 없이 표시(14,199B). `html`은 CSS+woff2 data URI가 필요하고(386,784B) webkit에서는 넣어도 자리 어긋남.
- 확인 4 DOCX PNG: webkit·chromium 모두 캔버스 오염 없음(`toDataURL`·`toBlob`·`getImageData` 성공). `html`은 위첨자·분수·근호가 깨진 글자, `mathml`·`mathml-bare`는 수식 표시. 대체안 `none`·`textsvg`도 측정(성공).
- 확인 5 CSP: pele 수식 렌더로 늘어난 위반 0. 모든 시나리오(수식 없는 load-only 포함)에 콘솔 거부 1건 — Vite가 `KaTeX_Size3-Regular.woff2`를 `data:` URI로 넣고 CSP에 `font-src`가 없어 막힘(앱 프로덕션 빌드에서도 확인, 기존 결함).
- jsdom: DOM 측정은 크기 0 → `null` → `$$…$$` 원문. 단위 테스트에서 실제 수식 크기는 확인 불가.
- 판정(통과/보류): **통과** (2026-10-26, AskUserQuestion으로 수집)
- 해석기 출력 방식: **`mathml-bare`** — KaTeX `output:'mathml'`에서 바깥 `.katex` span 제거. `html`·`mathml`은 webkit에서 foreignObject 밖으로 어긋나 탈락.
- DOCX 처리 방식: **별도 대체안 없음** — `mathml-bare`가 DOCX PNG에서도 수식 표시, 캔버스 오염 없음.
- CSP 기존 결함(KaTeX_Size3 data: 글꼴, font-src 없음): 이 SPEC 범위 밖, 백로그 카드 `t1`로 기록(`moai todo`, 오케스트레이터 실행).
- 오케스트레이터 재확인: 픽스처 재렌더 `unitChecked=76 browserChecked=76 mismatches=0` (exit 0), `git diff --name-only f145220 d1dbc02 -- src index.html` 출력 없음.
- 남은 수동 확인: MANUAL-3(현재 앱 mermaid 수식이 WKWebView에서 제자리인지 — M1b에서 어긋남 가능성 관찰), MANUAL-4(M3 이후 pele 수식 WKWebView 확인)

### M2 다이어그램 모듈·테마 토큰·픽스처 (2026-10-26, 기준 HEAD fd0df84)

- 커밋: `73ddd04`(M1 `unit/` → `m1-frozen/` 이동 + `status: in-progress`), `88340f2`(모듈·토큰·픽스처 재캡처·단위 테스트). 의존성 제거·가드 테스트 개정은 **보류**(아래 "의존성 제거 보류").
- 새 모듈 `src/lib/diagram/diagramRenderer.ts`: `renderDiagram`(정화된 SVG·`width`·`height` 또는 오류 `{code,message,line,column}`, 예외를 밖으로 던지지 않음), `validateDiagram`(같은 렌더 함수 호출, `error` = `PeleError.message`), `formatDiagramError`(D9), `sanitizeDiagramSvg`(별도 `DOMPurify(window)` 인스턴스, href 차단 훅 재등록, 수식 허용분만 추가), `katexMathMarkup`·`createMathResolver`(`mathml-bare`, `trust: false`, KaTeX 오류 마크업이면 `null`), 고정 옵션 `PELE_RENDER_OPTIONS`(동결 객체), 호출마다 고유 `idPrefix`(`pd1`, `pd2`, …), 시험용 진입점 `renderDiagramForTest`(수식 크기 측정만 주입). 색 값 치환 함수는 M4 범위라 만들지 않았다.
- 다이어그램 경로의 HTML 허용은 "foreignObject.pele-math 바로 아래의 감싸기 `div`"뿐이다. M1b 시제품이 허용하던 `span`과 금지하던 `style`·`a`는 D4 문구와 공유 규칙에 맞춰 각각 빼고 되돌렸다(공유 `sanitizeSvg`와 같은 규칙 + 수식 허용분만).
- 글꼴 상수: 일반 `"Barlow", system-ui, sans-serif`(앱 UI 글꼴 `--md-font-ui`와 같은 목록), 고정폭 `"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace`(`--md-font-mono`와 같은 목록). `--pele-font`·`--pele-font-mono`는 두 블록 모두 이 목록을 리터럴로 적었다.

#### `--pele-*` ↔ `--md-*` 대응 (D5 확정, `src/styles/mdedit-tokens.css` 두 블록 동일)

| `--pele-*` | 값 | 비고 |
|---|---|---|
| `--pele-bg` | `var(--md-bg)` | 미리보기 패널 바탕(`.md-previewpane`)과 같음 |
| `--pele-fg` | `var(--md-text-primary)` | |
| `--pele-muted` | `var(--md-text-muted)` | |
| `--pele-line` | `var(--md-text-muted)` | 선은 본문보다 한 단계 약하게 |
| `--pele-surface` | `var(--md-surface)` | 노드 채움 |
| `--pele-surface-alt` | `var(--md-surface-raised)` | |
| `--pele-border` | `var(--md-border-strong)` | |
| `--pele-accent` | `var(--md-accent)` | |
| `--pele-error` · `--pele-critical` | `var(--md-danger)` | |
| `--pele-radius` | `var(--md-radius-sm)` | 3px (pele 기본 4px) |
| `--pele-title-weight` · `--pele-heading-weight` | `600` | 미리보기 제목 굵기(`.md-preview h1–h3`)와 같음, 굵기 토큰 없음 |
| `--pele-series-1`…`8` | `--md-accent`, `--md-dirty`, `--md-success`, `--md-danger`, `--md-ai-glow-from`, `--md-accent-active`, `--md-text-muted`, `--md-accent-hover` | 계열 전용 `--md-*` 토큰이 없어 기존 역할 색으로 연결 |
| `--pele-font` | `"Barlow", system-ui, sans-serif` | 리터럴 |
| `--pele-font-mono` | `"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace` | 리터럴 |

- `var()`는 선언한 요소에서 풀리므로, `data-theme="dark"`가 라이트 루트 아래 요소(D6 탐침 등)에 붙어도 다크 값이 나오게 다크 블록에 같은 선언을 반복했다. `--pele-zoom-*`는 정의하지 않았다.

#### 픽스처 (`src/test/fixtures/pele/manifest.json` 170항목)

| 묶음 | 파일 | 캡처 | 측정기 | 정화기 |
|---|---|---|---|---|
| `m1-frozen/` | 77 (정화 전·후 38쌍 + `errors.json`) | M1 그대로 이동(`git mv`, 이름 변경 100%), `frozen: true` | `jsdom-default` | 공유 `sanitizeSvg`(M1) |
| `unit/` | 47 (샘플 23개 × 정화 전·후 + `errors.json`) | `npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/m2-unit.capture.ts` → `m2-unit entries=47 svgFiles=46 errors=4`, exit 0 | `jsdom-default` (vitest 2.1.9, jsdom 28.1.0) | `sanitizeDiagramSvg` |
| `browser/` | 46 (샘플 23개 × 정화 전·후) | `SPIKE_OUT=<scratch> npx vite build --config spike/pele/vite.spike.config.ts` → exit 0, `SPIKE_OUT=<scratch> node spike/pele/run-m2-browser.mjs` → `m2-browser entries=46 env="playwright 1.58.2 webkit 26.0 (headless, macOS)" fonts=[Barlow 400·700, IBM Plex Mono 400 모두 loaded:true] consoleErrors=0`, exit 0 | `canvas` | `sanitizeDiagramSvg` |

- 샘플 23개 = M1 유효 샘플 19개 + M1b 수식 샘플 `m01`–`m04`. 옵션은 모두 `PELE_RENDER_OPTIONS`(두 글꼴 값 포함)이고 `responsive: true` 한 가지로만 캡처했다(고정 옵션이므로 `false` 변형은 두지 않음).
- 수식 픽스처 5종(`18-math-label`, `m01`–`m04`): `unit/`은 `math.method: "injected-fixed"`(48×20 주입, jsdom은 크기 0), `browser/`는 `math.method: "getBoundingClientRect"`(모듈 기본 측정, 예: `18-math-label` 49×19·9×24). 두 묶음 모두 `foreignObject.pele-math`가 수식 개수만큼 있고 `$$` 원문 0. `m04`의 `\href{javascript:…}`·`\htmlClass{evil}`는 `trust: false`로 링크·클래스가 되지 않고 `<annotation>` 안 TeX 글자로만 남는다.
- 손으로 쓴 SVG는 픽스처에 없다. 테스트 안의 적대 입력 9종은 공격 탐침이며 pele 출력 픽스처로 쓰지 않는다.

#### 검증 (모두 이 worktree에서 직접 실행, 출력 전문 `.moai/state/verify/pele-015-m2/`)

| 명령 | 결과 |
|---|---|
| `npx vitest run src/test/diagramRenderer.test.ts` (구현 전, RED) | exit 1 — 모듈 없음(`red.txt`) |
| `npx vitest run src/test/diagramRenderer.test.ts src/test/diagramRegressionGuard.test.ts src/test/aiDiagramTypeRegressionGuard.test.ts` | exit 1 — `Tests 1 failed \| 84 passed (85)`. 실패 1건은 M1부터 있던 `diagramRegressionGuard` 의존성 집합 단언(pele 추가, 가드 개정은 보류 패치에 있음). `diagramRenderer.test.ts` 78개 전부 통과(`targeted.txt`) |
| `npx tsc --noEmit` | exit 0 (`tsc-final.txt`) |
| `npx eslint <변경 파일 6개>` | exit 0 (`eslint-final.txt`) |
| `npx vitest run` (전체) | exit 1 — `Test Files 1 failed \| 106 passed (107)`, `Tests 1 failed \| 1724 passed (1725)`. 실패 1건 = 위와 같은 M1부터의 가드 단언(예상, 의존성 제거 단계와 함께 해소)(`full-vitest-final.txt`) |
| `git diff --stat fd0df84 HEAD -- src/lib/preview/svgSanitize.ts index.html src-tauri src/lib/markdown/mermaidPlugin.ts` | 출력 없음(무변경) |

- AC-005: m1-frozen 38쌍 모두 `sanitizeDiagramSvg(raw) === sanitizeSvg(raw) === 고정 정화 후 출력`(바이트), 결과에 `<script`·`<foreignObject`·`on*` 0. 불일치 없음 → blocker 아님.
- AC-025(unit 1–6), AC-012(unit), AC-004(옵션·CSS 리터럴 비교), AC-007·014(모듈 부분), AC-010(idPrefix), AC-002(unit 재렌더 바이트 동일, browser 구조) 통과.

#### 의존성 제거 보류 (blocker 성격 발견)

- `npm uninstall mermaid patch-package` + `postinstall` 삭제 + `patches/` 삭제 + `npm install`로 실제 제거해 영향을 쟀다.
- 이 worktree는 주 체크아웃 폴더 안에 있어서, 제거 뒤에도 `mermaid`가 상위 폴더의 `node_modules`(주 체크아웃)에서 풀린다. 그래서 worktree 안의 `tsc`는 TS2307 대신 `@types/trusted-types` 두 벌 충돌 1건만 보였다(`tsc-post-removal.txt`) — 대표성이 없는 측정이다.
- 깨끗한 체크아웃을 흉내 내려고 `src`·설정을 저장소 밖 scratch 폴더로 복사하고 worktree의 `node_modules`만 연결해 다시 쟀다:
  - `tsc --noEmit` → exit 2, `error TS2307: Cannot find module 'mermaid'` 18건 — 운영 3건(`ai-suggestion-card.ts:1289`, `PreviewRenderer.tsx:2`, `mermaidValidate.ts:1`) + 테스트 15건(`insertDiagram.test.ts`, `PreviewRenderer.test.tsx`)(`cleansim-tsc.txt`). 다이어그램 모듈 자체 오류 0.
  - `vitest run` → `Test Files 37 failed | 70 passed (107)`, `Tests 321 failed | 1188 passed (1509)`. 원인: `Failed to resolve import "mermaid"` — `ai-suggestion-card.ts` 343회(카드를 가져오는 AI 테스트 전반으로 번짐), `mermaidValidate.ts` 7, `PreviewRenderer.tsx` 2, 테스트 2. 그 밖의 3건은 복사본에 `src-tauri/capabilities/main.json`·`src-tauri/src/lib.rs`가 없어 생긴 측정 부산물(`cleansim-vitest.txt`).
- 결론: M2에서 mermaid를 지우면 M3·M4 호출부가 바뀔 때까지 깨끗한 체크아웃(CI)의 `tsc`·빌드·테스트가 깨진다. 호출부 파일은 고치지 않았다(M3·M4 범위). 제거 변경(`package.json`·`package-lock.json`·패치 삭제·가드 테스트 2개 개정, MX NOTE 포함)은 `.moai/state/verify/pele-015-m2/m2-dependency-removal.patch`에 저장했고 `git apply --check` 통과를 확인한 뒤 작업 트리를 HEAD로 되돌리고 `npm ci`로 `node_modules`를 복구했다(`npm ls` → `mermaid@11.12.3`, `pele@1.10.0`).
- 선택지(오케스트레이터 결정): (A) 지금 패치를 적용·커밋하고 M3·M4 동안 깨진 빌드를 받아들임 (B) mermaid를 M3·M4가 끝날 때까지 두고, 패치를 M4 마지막 단계(또는 M7 직전)에 적용 (C) M3에서 호출부 교체와 같은 커밋으로 적용.

#### Gaps (확인하지 않은 것)

- 깨끗한 체크아웃의 실제 CI 실행은 하지 않았다(scratch 복사본 측정으로 대신함).
- 의존성 제거 상태에서의 `vite build`는 실행하지 않았다(정적 import 3곳이 있어 실패가 예상되지만 측정하지 않음).
- `browser/` 픽스처의 측정 폭과 앱 웹뷰의 실제 표시 폭이 맞는지는 이 묶음 캡처로만 보았고, 앱(WKWebView)에서는 확인하지 않았다. 앱 안에서 Barlow 글꼴이 로드되기 전에 첫 렌더가 일어나면 측정 글꼴과 표시 글꼴이 어긋날 수 있다(M3에서 확인 필요).
- `--pele-series-*` 대응과 다크 대비는 실물 화면으로 확인하지 않았다(파이·간트 색 구분은 M5 e2e·수동 확인).
- `npm run lint`(저장소 전체)는 실행하지 않았다. 변경 파일만 검사했다.

### M3 미리보기·AI 호출부 교체 (2026-10-26, 기준 HEAD be76af2)

사용자 결정에 따라 `mermaid` 의존성 제거(`m2-dependency-removal.patch`)는 M4 마지막 단계로 미뤘다. M3에서는 패치를 적용하지 않았고, M3 파일이 mermaid를 import하지 않게만 했다.

#### 변경

| 커밋 | 내용 |
|---|---|
| `6f529e2` | `PreviewRenderer.tsx`: mermaid import·`MERMAID_BASE_CONFIG`·`initialize`·비동기 `forEach` 제거, 컨테이너마다 `renderDiagram` 동기 호출. 오류는 `<p class="text-sm text-amber-500 italic py-2">`에 `formatDiagramError` 결과를 `textContent`로(D9). `useUIStore` 테마 구독·`isDark`·matchMedia 리스너·의존성 배열의 `isDark` 제거(테마 전환 재렌더 없음). 빈 펜스 분기·본문 링크 클릭 처리·클래스 이름(D10) 유지. `PreviewRenderer.test.tsx` 재작성 |
| `7a1ae73` | `mermaidValidate.ts`: 계약(`Promise<{valid, error?}>`) 유지, 내부는 `validateDiagram`, `MERMAID_STRICT_CONFIG` 제거. `ai-suggestion-card.ts` `renderMermaidInto`: 동적 import 제거, `renderDiagram` 동기 렌더(반환형 `void`, 주입 타입과 같음), 실패 시 영역 비움. 테스트 `mermaidValidate`·`aiSuggestionCard`(AC-015 3건 추가)·`aiCardRetryLimit`·`aiSuggestionCardRerequest`(mermaid mock·`parseMock` 제거, 실제 pele 판정) |
| `6c56d31` | `insertDiagram.test.ts` 프리셋 7종을 `renderDiagram`으로 렌더. `renderer.test.ts`·`MarkdownPreview.test.tsx`의 소비자 없는 mermaid mock 제거 |
| `d2f51dd` | `aiSuggestionCardRerequest.test.ts` 주석 한 줄 정정(`mermaid.parse` → 검증 계약) |

- 다이어그램 모듈(`diagramRenderer.ts`)은 바꾸지 않았다.
- 테스트에서 pele·모듈은 통과형 감시 래퍼(`vi.fn(real.render)`, `vi.fn(real.renderDiagram)`)로만 감쌌다. 손으로 쓴 SVG를 pele 출력으로 쓰는 테스트는 없다. AI 흐름 테스트의 `BADSYNTAX`·펜스가 남은 코드 거부와 `flowchart LR …` 통과는 실제 pele로 확인했다(`node` 탐침: `BADSYNTAX` → `unsupported-diagram 0 0`, `sequenceDiagram\n  A->>B hello` → `syntax 2 14`, `pie\n  "a" : -1` → `semantic 0 0`).
- MX: PreviewRenderer ANCHOR 문구를 "다이어그램 모듈로 렌더"로, async forEach WARN·parse 선행 NOTE 삭제(개별 실패 처리는 NOTE로 남김), securityLevel WARN/REASON을 표의 strict 모드 문구로 교체, `@MX:SPEC`에 SPEC-PREVIEW-015 추가, 빈 펜스 NOTE 유지. mermaidValidate SPEC 줄 추가·WARN/REASON 교체. `renderMermaidInto`에 NOTE 추가.

#### 검증 (이 worktree에서 직접 실행, 출력 전문 `.moai/state/verify/pele-015-m3/`)

| 명령 | 결과 |
|---|---|
| `npx vitest run src/test/PreviewRenderer.test.tsx` (구현 전, RED) | exit 1 — `Tests  9 failed \| 12 passed (21)` (`red-preview.txt`) |
| `npx vitest run src/test/mermaidValidate.test.ts` (구현 전, RED) | exit 1 — `Tests  4 failed \| 6 passed (10)` (`red-validate.txt`) |
| `npx vitest run src/test/aiSuggestionCard.test.ts` (구현 전, RED) | exit 1 — `Tests  2 failed \| 57 passed (59)` (`red-card.txt`) |
| `npx vitest run src/test/PreviewRenderer.test.tsx` | exit 0 — `Tests  21 passed (21)` (`green-preview.txt`) |
| `npx vitest run src/test/mermaidValidate.test.ts src/test/aiSuggestionCard.test.ts src/test/aiCardRetryLimit.test.ts src/test/aiSuggestionCardRerequest.test.ts` | exit 0 — `Tests  102 passed (102)` (`green-ai.txt`) |
| `npx vitest run src/test/insertDiagram.test.ts src/test/renderer.test.ts src/test/MarkdownPreview.test.tsx` | exit 0 — `Tests  98 passed (98)` (`green-misc.txt`). 프리셋 렌더 테스트 7건 실행 확인(verbose) |
| `npx tsc --noEmit` | exit 0 (`tsc.txt`, 출력 없음) |
| `npx eslint <변경 파일 11개>` | exit 0 (`eslint.txt`, 출력 없음) |
| `npx vitest run` (전체, `6c56d31` 기준) | exit 1 — `Test Files  1 failed \| 106 passed (107)`, `Tests  1 failed \| 1729 passed (1730)`. 실패 1건 = `diagramRegressionGuard.test.ts > adds zero new runtime dependencies to package.json (REQ-019)` — M1부터의 예상 실패(의존성 제거 패치와 함께 해소) (`vitest-full.txt`) |
| `npx vitest run src/test/aiSuggestionCardRerequest.test.ts` (`d2f51dd` 주석 정정 뒤) | `Tests  8 passed (8)` |

- 대상 AC(unit 부분): AC-006, 007, 008, 009, 010(입력=`data-diagram`, 최신 내용만, idPrefix 고유·id 중복 없음), 011(테마 토글·system 변경 뒤 같은 SVG 노드, pele 추가 호출 0), 014(검증 결과 = 모듈 `PeleError.message`, pele 호출 1회·고정 옵션, Promise), 015(미니 렌더 = 모듈 결과, 실패 시 비움, 삽입·닫기 동작), 016(프리셋 7종).

#### 남은 mermaid 참조

- M3 파일 11개에서 `from 'mermaid'`·`import('mermaid')`·`vi.mock('mermaid'` 검색 → 0건(grep exit 1).
- 저장소 `src`·`e2e` 전체에서 같은 검색 → 0건. 내보내기 파일(`exportHtml.ts`·`exportDocx.ts`)은 mermaid를 import하지 않고 미리보기 DOM의 `.mermaid-container`를 읽는다(M4 범위).
- 라이브러리 이름이 남은 곳(import 아님): `package.json`·`package-lock.json`의 `mermaid`·`patch-package`·`patches/mermaid+11.12.3.patch`(M4 끝 제거 예정), `diagramRegressionGuard.test.ts:37` 의존성 집합, `exportDocx.ts:241` 펜스 info 비교, `mermaidPlugin.ts:17` 펜스 info 비교.
- worktree가 주 체크아웃 폴더 안에 있어 패키지 해석으로는 제거를 증명할 수 없으므로 위 grep을 근거로 한다.

#### Gaps (확인하지 않은 것)

- e2e(M5)는 실행하지 않았다. 테마 전환 뒤 실제 채움색 변화(AC-011 e2e)와 AI 카드 e2e(AC-014 e2e)는 확인하지 않았다.
- MANUAL-1(미리보기 본문 링크 클릭이 시스템 브라우저로 열림): 코드는 그대로 두었으나 앱에서 확인하지 않았다. 링크 클릭 단위 테스트도 이번에 추가하지 않았다.
- MANUAL-4(시스템 WKWebView에서 pele 수식이 상자 안에 그려짐): 앱에서 확인하지 않았다. jsdom은 수식 크기를 0으로 재어 `$$…$$` 원문으로 되돌리므로 단위 테스트로는 증명하지 않는다.
- 앱 안 Barlow 글꼴 로드 전 첫 렌더 시 측정 글꼴과 표시 글꼴이 어긋나는지(M2 Gaps 항목)는 여전히 확인하지 않았다. 이제 미리보기는 테마로 다시 렌더하지 않으므로 글꼴이 늦게 로드되어도 내용이 바뀔 때까지 첫 배치가 유지된다.
- M4 전까지의 내보내기: `exportHtml`·`exportDocx`가 미리보기 DOM의 다이어그램을 그대로 가져가므로, 이 브랜치에서는 M4 전까지 내보낸 파일에 `var(--pele-*)`가 풀리지 않은 pele SVG가 들어갈 수 있다(측정하지 않음, M4가 해소).
- 저장소 전체 `npm run lint`와 `vite build`는 실행하지 않았다.

### M4 내보내기 원본 렌더·의존성 제거 (2026-10-26, 기준 HEAD e9c7470)

#### 변경

| 커밋 | 내용 |
|---|---|
| `828dd92` | `diagramRenderer.ts`: `PELE_THEME_VARS`(D5 목록 23개), `readPeleThemeValues(theme)`(`data-theme` 탐침 요소 + `getComputedStyle`, 읽은 뒤 바로 제거), `resolvePeleVars(css, values)`(모든 `var(--pele-…)`를 표 값으로, 없으면 대체값을 중첩 해석해 채움 — 0건 보장), `resolveDiagramColors(svg, values)`(속성 값·`<style>` 텍스트 제자리 치환, `foreignObject` 안쪽 포함). `exportUtils.ts`: `previewDiagramInput`(mermaidPlugin과 같은 `"`→`&quot;` + HTML 속성 파싱 → 미리보기와 같은 문자열), `renderExportDiagram`(빈 소스·실패 → null), 다이어그램 카드 바탕을 `--md-bg` 값(#f2f2f3 / #191b1d)으로. `mdedit-tokens.css`: 라이트 블록 선택자를 `[data-theme="light"],\n:root`로 확장. `mermaidPlugin.ts:19` `@MX:NOTE` |
| `2c12807` | `exportHtml.ts`: `replaceMermaidPlaceholders(html, theme)` — 자리마다 `data-diagram`을 렌더해 내보내기 테마 값으로 치환, 전역 `document.querySelectorAll` 제거, 빈·실패 자리는 빈 컨테이너. PDF(`generateHtmlContent`)도 같은 경로. `exportDocx.ts`: `captureMermaidImages`·`shift()` 제거, 펜스 토큰 자리에서 `renderFenceDiagramPng`(입력 `previewDiagramInput`, 색 항상 라이트, 크기 = pele `width`·`height` × 0.75pt, 2배 래스터, 415pt 넘으면 비율 유지 축소), 실패·빈 펜스는 코드 텍스트. 테스트 `exportDiagram.test.ts` 신설, DM1 재작성 |
| `dafc840` | `m2-dependency-removal.patch` 적용(`git apply --check` 통과 후): `mermaid`·`patch-package`·`postinstall` 제거, `patches/` 삭제, `package-lock.json` 재생성(`npm install` → `removed 142 packages`), 가드 테스트 2개 개정(`pele === '1.10.0'`, mermaid·patch-package·postinstall·패치 파일 재유입 시 실패, 핀 `@MX:NOTE`) |

- **라이트 선택자 확장 이유(계획 밖 1줄 변경)**: D6은 DOCX 색을 항상 라이트로 정했는데, `--pele-*`는 `var(--md-*)`를 선언한 요소에서 풀린다. M2는 "라이트 루트 아래 다크 탐침"만 다뤘으므로, 다크 앱에서 `data-theme="light"` 탐침을 붙이면 다크 값이 상속되어 DOCX가 다크 색이 된다. 라이트 블록을 `[data-theme="light"]`에도 걸어 탐침에서 라이트 `--md-*`·`--pele-*`가 다시 선언되게 했다. 영향 확인: 앱에서 `data-theme`를 다는 곳은 `useTheme.ts:24`(`<html>`, 루트 테마와 같은 값)와 `ImageFileViewer.tsx:138`(스토어 원값 `light|dark|system` — `light`일 때 루트도 라이트이므로 값 변화 없음)뿐이다(`grep -rn "data-theme" src`). 기존 CSS 텍스트 테스트(`:root {` 검색)는 그대로 통과한다.
- MX: 색 치환 함수 `@MX:WARN`+`@MX:REASON`(diagramRenderer), `exportDocx.ts:32` shift NOTE 삭제 → 펜스별 렌더·PNG 변환부 `@MX:WARN`+`@MX:REASON`, `exportHtml.ts` 자리별 렌더 `@MX:NOTE`, `exportHtml`·`exportDocx`·`diagramRenderer`(REQ-018) `@MX:SPEC` 추가, `mermaidPlugin.ts:19` NOTE, 가드 테스트 핀 NOTE(패치에 포함).
- `exportPdf.ts`: 무변경. 인쇄 스타일(`exportPdf.ts:73-91`)은 `img` 규칙과 내보내기 CSS만 넣고 SVG 색을 덮는 규칙이 없다. 내보낸 SVG에는 `var(--pele-`가 없어 앱 문서의 토큰에도 기대지 않는다.

#### 단위 테스트가 증명하는 것 / 대체하는 것

- **실제**: `renderMarkdown`·markdown-it·pele 1.10.0·다이어그램 모듈(정화 포함)·`resolvePeleVars`·`previewDiagramInput`·DOCX 토큰 변환.
- **대체**: (1) IPC(저장 대화상자·파일 쓰기). (2) pele `render`는 통과형 감시 래퍼(`vi.fn(real.render)`) — 입력 기록용, 출력은 실제 pele. (3) 수식 크기 측정: `renderDiagram`을 `renderDiagramForTest(src, {measureMath: 48×20})`로 감싼 통과형 래퍼(D14, jsdom은 크기 0). (4) 테마 값: `readPeleThemeValues`를 서로 다른 라이트·다크 주입 표로 대체(D6 시험용 진입점). 실제 `readPeleThemeValues`는 jsdom에서 빈 표를 돌려줌을 따로 확인(대체값으로 채워 `var(--pele-` 0, 탐침 잔류 0). (5) `Image`는 src(래스터 입력 SVG data URI)를 기록하고 onload만 부르며, canvas `getContext`·`toBlob`은 **래스터 단계(onload 안)에서만** 스텁을 돌려준다 — pele도 글자 폭 측정에 canvas를 쓰므로, 항상 켜 두면 pele가 스텁을 측정기로 잡아 `n.measureText is not a function`으로 렌더가 실패했다(측정으로 발견). 따라서 **PNG 픽셀·DOCX 실제 표시는 증명하지 않는다**. 증명하는 것은 래스터 입력 SVG 내용, canvas 폭(= pele 폭 × 2), `ImageRun` 크기·개수·위치다.
- 실제 `readPeleThemeValues`가 앱 CSS에서 올바른 값을 읽는지(특히 다크 앱의 라이트 탐침)는 jsdom이 사용자 정의 속성 연쇄를 계산하지 않아 단위 테스트로 증명하지 않았다. 선택자 존재만 CSS 텍스트로 단언했다.

#### 검증 (이 worktree에서 직접 실행, 출력 전문 `.moai/state/verify/pele-015-m4/`)

| 명령 | 결과 |
|---|---|
| `npx vitest run src/test/exportDiagram.test.ts src/test/exportImageEmbed.test.ts` (구현 전, RED) | exit 1 — `Tests  20 failed \| 27 passed (47)` (`red.txt`) |
| 같은 명령, 새 모듈·CSS 위에 **옛 `exportHtml.ts`·`exportDocx.ts`**(HEAD 내용을 잠시 되돌림) | exit 1 — `Tests  18 failed \| 29 passed (47)`. AC-017·018(미리보기 DOM 없음·잔재 DOM 사용), AC-019(HTML·DOCX 밀림 재현), AC-020 6조합, AC-021, AC-025 내보내기, DM1 모두 실패 (`red-oldcode.txt`). 확인 뒤 새 파일로 복원 |
| `npx vitest run src/test/exportDiagram.test.ts src/test/exportImageEmbed.test.ts src/test/diagramRenderer.test.ts` | exit 0 — `Test Files  3 passed (3)`, `Tests  125 passed (125)` (exportDiagram 21, exportImageEmbed 26, diagramRenderer 78) (`green.txt`) |
| `npx vitest run src/test/export.test.ts src/test/exportDocx.test.ts src/test/exportHtml.test.ts src/test/exportPdf.test.ts src/test/exportOpenRegressionGuard.test.ts src/test/renderer.test.ts src/test/useTheme.test.ts` | exit 0 — `Tests  108 passed (108)` (`export-suite.txt`) |
| `npx tsc --noEmit` (의존성 제거 전 / 후) | exit 0 / exit 0, 출력 없음 (`tsc.txt`, `tsc-post-removal.txt`) |
| `npx eslint <변경 파일 7개>` / `npx eslint <가드 테스트 2개>` | exit 0 / exit 0, 출력 없음 (`eslint.txt`, `eslint-guards.txt`) |
| `npx vitest run src/test/diagramRegressionGuard.test.ts src/test/aiDiagramTypeRegressionGuard.test.ts` (제거 후) | exit 0 — `Tests  7 passed (7)` (`guards.txt`) |
| `npx vitest run` (전체, 제거 후 작업 트리 = `dafc840`) | exit 0 — `Test Files  108 passed (108)`, `Tests  1751 passed (1751)`. M1부터의 `diagramRegressionGuard` 실패 해소 (`vitest-full.txt`) |
| `npm ls mermaid patch-package pele` | exit 0 — `mdedit@0.16.1 …/pele-015` `└── pele@1.10.0` (mermaid·patch-package 없음). `ls node_modules/mermaid` → No such file; `package-lock.json`의 `node_modules/mermaid`·`node_modules/patch-package` 항목 0 (`npm-ls.txt`) |

#### 깨끗한 체크아웃 흉내 (worktree가 주 체크아웃 폴더 안이라 패키지 해석으로는 제거를 증명할 수 없음)

- 저장소 밖 scratch 폴더에 `src`·`e2e`·`public`·`index.html`·`package.json`·`package-lock.json`·`tsconfig*.json`·`vite.config.ts`·`postcss.config.js`·`tailwind.config.js`·`.eslintrc.cjs`·`playwright.config.ts`·`src-tauri/capabilities`·`src-tauri/src/lib.rs`·`src-tauri/Cargo.toml`을 복사하고 worktree `node_modules`만 심볼릭 링크로 연결(`dafc840` 기준).
- `npx tsc --noEmit -p <scratch>/tsconfig.json` → exit 0, 출력 없음. `--listFilesOnly`로 scratch `src/` 파일 187개를 검사했고 mermaid 패키지 파일은 0(이름에 mermaid가 든 파일은 `mermaidValidate.ts`·`mermaidPlugin.ts`·`mermaidValidate.test.ts`뿐) (`cleansim-tsc.txt`).
- `npx vitest run --root <scratch>` → exit 0, `RUN v2.1.9 <scratch>`, `Test Files  108 passed (108)`, `Tests  1751 passed (1751)` (`cleansim-vitest.txt`). M2 측정의 `Failed to resolve import "mermaid"`(37파일 실패)가 사라졌다.
- `npx vite build <scratch> --outDir <scratch-dist>` → exit 0, `611 modules transformed`, `built in 2.92s`(500kB 청크 경고만) (`cleansim-vite-build.txt`). 산출물의 `mermaid-*.js`(29,511 B)는 Shiki의 mermaid 문법 하이라이트 정의(`{"displayName":"Mermaid",…"injectionSelector":"L:text.html.markdown"`)이며 mermaid 라이브러리가 아니다.
- scratch 복사본·산출물은 확인 뒤 삭제했다.

#### 남은 mermaid 참조 (dafc840)

- `grep -rn "from 'mermaid'\|import('mermaid')\|vi.mock('mermaid'\|from \"mermaid\"" src e2e` → 0건(grep exit 1, `grep-imports.txt`).
- 저장소 전체 import: `spike/pele/compare.ts`, `spike/pele/m1b.ts`(M7 삭제 대상, 이제 실행 불가).
- 패키지 이름·펜스 info(import 아님): `src/test/diagramRegressionGuard.test.ts:51-53`(재유입 금지 단언), `src/lib/markdown/mermaidPlugin.ts:17`·`src/lib/export/exportDocx.ts:244`(펜스 info `'mermaid'` 비교 — 문법 이름이라 유지, D10), `src/test/aiSuggestionCard.test.ts:78`(펜스 문자열), `e2e/mermaid-subgraph-label.spec.ts:6` patch-package 주석(M5 범위).
- 문서: `docs/USER_MANUAL.md`·`docs/USER_GUIDE.md`·`docs/AI-Best-Practice-MdEdit*.md`·`.moai/project/{tech,structure}.md`·`.moai/project/codemaps/*`(sync 범위).

#### Gaps (확인하지 않은 것)

- 앱(WKWebView)에서 HTML·PDF·DOCX 실제 내보내기를 하지 않았다: 다크 앱에서 DOCX가 라이트 색으로 나오는지(라이트 탐침 선택자 효과), HTML·PDF 색이 내보내기 테마인지, 앱 PDF 인쇄의 수식 표시(AC-025 manual), DOCX를 Word에서 열었을 때의 표시(AC-020 manual), 에디터 단독 보기 내보내기(AC-018 manual).
- `readPeleThemeValues`의 실제 값 읽기는 브라우저에서 측정하지 않았다(jsdom 한계). M5 e2e나 수동 확인 대상.
- DOCX PNG 픽셀(foreignObject 수식 포함)은 단위 테스트가 스텁이다. M1b 4에서 같은 래스터 방식으로 수식이 그려짐을 측정했지만, 이번 색 치환 뒤 결과로는 다시 측정하지 않았다.
- 목록·인용 안의 다이어그램 펜스는 DOCX 변환기가 원래 처리하지 않는다(기존 동작, 범위 밖). 예전에는 그 펜스의 DOM 그림이 뒤 펜스로 밀려 들어갔으나 이제는 빠지기만 한다.
- Windows(WebView2)는 확인하지 않았다.
- 저장소 전체 `npm run lint`(`eslint .`)는 실행하지 않았다. `spike/pele/`의 mermaid import가 lint 규칙에 걸리는지는 측정하지 않았다(M7에서 삭제).
- `npm ci`(깨끗한 설치)는 하지 않고 `npm install` + scratch 복사로 대신했다.

### M5 e2e 개정 (2026-10-26, 기준 HEAD a84b8e1)

M4 CSS 변경(`mdedit-tokens.css` 라이트 블록 선택자 `[data-theme="light"], :root`)은 사용자가 유지로 결정(2026-10-26). design.md D6 반영은 M6에서 manager-spec이 한다.

#### 변경

| 커밋 | 내용 |
|---|---|
| `26caee8` | `e2e/mermaid-subgraph-label.spec.ts`: `.cluster-label foreignObject` 측정을 pele 서브그래프 제목 `text.pele-cluster-label` 측정으로 교체. 소유 상자는 가장 가까운 `[data-id]` 조상(`g.pele-cluster` 또는 `g.pele-cluster-titles > g.pele-cluster-title`). 단언: 제목 2개·상자 2개(A·B), 제목마다 `tspan` 0개 + `getBBox().height < 글자 크기 × 1.4 × 1.6`(1줄), 제목 화면 상자가 자기 `g.pele-cluster > rect` 안(1px 여유), 두 상자 겹침 없음. 측정 전 `document.fonts.ready` 대기. 낡은 patch-package 주석(`:6`) 삭제, 파일 이름 유지(D10). `e2e/markdown-render.spec.ts`: "mermaid 비동기 렌더" 주석만 pele 기준으로 정정(대기 조건·선택자 무변경) |
| `08eeb44` | 새 `e2e/diagram-preview-behavior.spec.ts` 5건 — AC-011 2건, AC-012 2건, AC-025 e2e 1건(아래 "AC 대응") |

- 실제 pele 제목 구조(근거): `src/test/fixtures/pele/browser/02-subgraph-B-vertical.sanitized.svg`·`03-subgraph-C-horizontal.sanitized.svg`. 가려질 수 있는 제목은 `g.pele-cluster-titles > g.pele-cluster-title[data-id]` 안에 후광용 `<text fill="none" stroke=…>`와 `text.pele-cluster-label`이 함께 놓이고, 나머지는 `g.pele-cluster[data-id]` 안에 `rect` 다음으로 놓인다. webkit 일회성 탐침(커밋하지 않음, `.moai/state/verify/pele-015-m5/probe.txt`): 제목 `getBBox().height` 19.22, 글자 크기 16px(1줄 기준 상한 35.84), 노드 rect 계산 `fill` `rgb(233, 233, 234)`(= 라이트 `--md-surface` `#e9e9ea`).
- 다른 e2e의 mermaid 내부 의존: `grep -rn -i "mermaid\|foreignObject\|\.cluster\|nodeLabel\|edgeLabel" e2e/*.ts` 결과, 내부 구조에 기대던 것은 `mermaid-subgraph-label.spec.ts`뿐이었다. `markdown-render.spec.ts:41,61`·`ai-inline-edit.spec.ts:230,238`은 D10으로 유지된 클래스(`.mermaid-container`, `.mdedit-ai-mermaid-preview`)와 펜스 문자열만 쓰며, 대기 조건 변경 없이 통과했다.

#### 검증 (이 worktree에서 직접 실행, 출력 전문 `.moai/state/verify/pele-015-m5/`)

모든 Playwright 실행은 `CI=1`(기존 서버 재사용 금지 → 이 worktree의 `npm run dev-vite`를 `webServer`가 띄우고 끝나면 내림). 실행 전후 `lsof -nP -iTCP:1420 -sTCP:LISTEN` → 출력 없음(exit 1).

| 명령 | 결과 |
|---|---|
| `CI=1 npx playwright test e2e/mermaid-subgraph-label.spec.ts e2e/markdown-render.spec.ts e2e/ai-inline-edit.spec.ts` (개정 전, RED) | exit 1 — `2 failed`, `16 passed`. 실패 2건 = 옛 서브그래프 시나리오 B·C, `locator('.preview-content .mermaid-container svg .cluster-label')` 10초 타임아웃(pele SVG에 없음) (`baseline-3specs.txt`) |
| `CI=1 npx playwright test e2e/mermaid-subgraph-label.spec.ts` | exit 0 — `2 passed (4.6s)` (`final-subgraph.txt`) |
| `CI=1 npx playwright test e2e/diagram-preview-behavior.spec.ts` | exit 0 — `5 passed (12.8s)` (`final-behavior.txt`) |
| `CI=1 npx playwright test e2e/markdown-render.spec.ts e2e/ai-inline-edit.spec.ts` | exit 0 — `16 passed (12.0s)` (`final-render-ai.txt`) |
| `CI=1 npx playwright test --reporter=json e2e/diagram-preview-behavior.spec.ts` (측정값 기록) | exit 0. AC-011: 라이트 `fill rgb(233, 233, 234)` / `stroke rgba(29, 31, 32, 0.28)`, 다크 `fill rgb(33, 36, 39)` / `stroke rgba(231, 231, 234, 0.26)`, 각각 토큰 계산값과 같음. AC-025: 기준·수식 모두 `violations [] consoleRejects []` (`behavior-2.json`) |
| `CI=1 npx playwright test` (전체, webkit 프로젝트) | exit 0 — `69 passed`, `1 skipped` (21.1s). skip 1건 = `spec-img-mode-003.spec.ts:143` 기존 `.skip`(실제 DataTransfer 필요, 이 SPEC과 무관) (`full-e2e.txt`) |
| `npx tsc --noEmit` | exit 0, 출력 없음 (`tsc.txt`). `tsconfig.json`의 `include`는 `src`뿐이라 e2e는 검사하지 않음 |
| `npx tsc --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --lib es2022,dom,dom.iterable --skipLibCheck --types node e2e/mermaid-subgraph-label.spec.ts e2e/diagram-preview-behavior.spec.ts` | exit 0, 출력 없음 (`tsc-e2e.txt`). 같은 옵션에서 `markdown-render.spec.ts`는 기존 오류(fixture에서 `Page` import, `:129-131` 암시적 any)가 나며 이번 변경(주석)과 무관 |
| `npx eslint e2e/mermaid-subgraph-label.spec.ts e2e/diagram-preview-behavior.spec.ts e2e/markdown-render.spec.ts` | exit 0, 출력 없음 (`eslint.txt`) |
| `npx vitest run` (전체) | exit 0 — `Test Files  108 passed (108)`, `Tests  1751 passed (1751)` (`vitest-full.txt`). 이번 마일스톤은 단위 테스트를 추가하지 않음 |

#### AC 대응 (e2e 부분)

- **AC-013**: 시나리오 B(세로)·C(가로) 모두 제목 1줄(tspan 0, 높이 기준 이하), 자기 상자 안, 상자끼리 겹침 없음 — PASS.
- **AC-011**: (1) `theme: 'system'` + `colorScheme: light`로 시작 → OS 다크 → OS 라이트 → 헤더 "Toggle theme"(다크) → 다시 토글(라이트). 매 단계 같은 SVG 객체(`isConnected` + 현재 `querySelector` 결과와 동일), 노드 rect 계산 `fill`·`stroke`가 `--md-surface`·`--md-border-strong` 계산값과 같고 라이트·다크 값이 서로 다름. (2) `addInitScript`로 `theme: 'dark'` 저장 → `waitForSelector('.preview-content .mermaid-container svg')` 핸들로 곧바로 읽은 채움색 = 다크 토큰 값, 1초 뒤에도 같은 핸들이 연결·현재 노드, 토글 뒤 라이트 값과 다름 — PASS. 계산값은 `--pele-surface → var(--md-surface)` 연결을 통한 것이다.
- **AC-012**: 노드 링크 문법(샘플 19와 같음) 다이어그램에 href 있는 `<a>` 0개, 노드 A·B 클릭 뒤 URL 같음·`open_url_in_browser` 호출 0·팝업 0. 대조: 같은 문서의 본문 링크 클릭은 같은 수집기로 `['https://example.com/control']` 1회. 외부 이미지 문법(샘플 20과 같음): 외부 `href`·`xlink:href` 0, `<image>` 0, `example.com` 요청 0 — PASS(이미지 부분은 AC상 unit 배치이며 e2e는 추가 확인).
- **AC-014 (e2e)**: 기존 `ai-inline-edit.spec.ts` "1차 무효 → 자동 재요청 → 2차 유효" 시나리오가 무변경으로 통과(`.mdedit-ai-mermaid-preview` 보임, 삽입 문서에 ` ```mermaid `) — PASS.
- **AC-025 (e2e)**: 앱 CSP meta가 있는 개발 서버 페이지에서 `18-math-label`을 렌더 → `foreignObject.pele-math` 2개, 각 안의 `<math>` 상자가 크기 > 0이고 `foreignObject` 상자 안(1px 여유). 수식을 뺀 같은 문서(기준)와 비교해 (가) `securitypolicyviolation` 수, (나) 콘솔 CSP 거부 수 모두 증가 없음(둘 다 0 대 0). 대조: 같은 페이지에 `img-src`에 없는 외부 주소 `<img>`를 붙이면 두 수집기 모두 증가 → CSP가 실제로 걸려 있고 수집기가 동작함 — PASS. 내보내기 쪽 단언(KaTeX CSS 없음, `<math>` 포함)은 M4 단위 테스트 범위다.

#### Gaps (확인하지 않은 것)

- 모든 e2e는 Playwright webkit 26.0(헤드리스) + `vite` 개발 서버 + IPC mock이다. 시스템 WKWebView(실제 Tauri 앱)에서의 수식 배치(MANUAL-4), 다이어그램 클릭 시 외부 브라우저가 열리지 않음(MANUAL-1), 앱 안 Barlow 글꼴 로드 전 첫 렌더 시 측정·표시 글꼴 어긋남은 확인하지 않았다.
- AC-025 CSP 비교는 개발 서버 기준이다. 프로덕션 빌드에서만 생기는 `KaTeX_Size3-Regular.woff2` `data:` 글꼴 거부(백로그 `t1`)는 이 환경에서 기준·수식 모두 0건이라 나타나지 않았다. 프로덕션 빌드(`vite preview`)로는 실행하지 않았다.
- AC-011 e2e는 노드 rect의 `fill`·`stroke` 두 속성만 본다. 선(`--pele-line`)·글자(`--pele-fg`)·`--pele-series-*`(파이·간트 색) 다크 대비는 실물 화면으로 확인하지 않았다(manual AC-024).
- `readPeleThemeValues`(내보내기용 탐침 값 읽기, M4)는 이 e2e에서 호출하지 않았다. 내보내기 결과의 실제 색(HTML·PDF·DOCX)은 여전히 manual(AC-020·024) 대상이다.
- 서브그래프 1줄 판정의 "글자 크기 × 1.4" 한 줄 기준은 추정치다(측정 19.22 대 상한 35.84). 2줄 렌더를 실제로 만들어 이 단언이 실패하는지는 확인하지 않았고, 대신 `tspan` 0개 단언을 함께 둔다.
- Windows(WebView2)는 확인하지 않았다.

### M6 다른 SPEC 개정 (2026-10-26, 기준 HEAD 200f171, manager-spec)

SPEC 본문은 manager-spec 소유라 오케스트레이터가 M6을 manager-spec에 재위임했다. 이 절도 그 위임 지시에 따라 manager-spec이 적는다. 코드는 바꾸지 않았다.

#### 개정한 SPEC (`status`는 모두 그대로)

| SPEC | version | 바꾼 요구 |
|------|---------|-----------|
| SPEC-PREVIEW-006 | 1.0.0 → 1.0.1 | REQ-PREVIEW006-003("Tier 2 패치" 삭제), 004(폐기 → 무패치로 대체), 005(pele `1.10.0` 고정), 006(패치 전제 삭제), 007(pele 버전·mermaid 재유입 가드) |
| SPEC-PREVIEW-010 | 1.0.0 → 1.0.1 | REQ-PREVIEW010-001~006(006은 둘째·셋째 줄만) |
| SPEC-UI-008 | spec.md·acceptance.md 각 0.0.2 → 0.0.3 | REQ-UI-008-008, 019, 020, AC-UI-008-004(spec.md 표 줄 + acceptance.md 블록), "Preset Snippet Definitions" 검증 문구, "빈 펜스 플레이스홀더 판정 힌트" |
| SPEC-AI-001 | 0.1.1 → 0.1.2 | REQ-AI-023, REQ-AI-024 |
| SPEC-AI-008 | 0.0.4 → 0.0.5 | REQ-AI-008-017, 019, 021, AC-AI-008-013 |
| SPEC-EXPORT-004 | 0.1.3 → 0.1.4 | REQ-EXPORT004-012(DOCX 문장) |
| SPEC-EXPORT-001 | 1.0.0 → 1.0.1 | REQ-EXPORT-020 괄호만. REQ-EXPORT-003은 확인만(pele에서도 "인라인 SVG, JavaScript 없음" 성립, 문구 무변경) |

각 SPEC HISTORY에 "SPEC-PREVIEW-015로 개정" 행 1개, `updated: 2026-10-26`. 같은 M6에서 이 SPEC의 design.md D6에 라이트 색 값 읽기(임시 `data-theme="light"` 요소, `mdedit-tokens.css` 라이트 블록 선택자 `[data-theme="light"], :root`, 커밋 828dd92)를 적고 spec.md를 0.4.2 → 0.4.3으로 올렸다(`status: in-progress` 유지).

#### SPEC-EXPORT-004(완료 SPEC) 처리 판단

편집 전에 실행한 명령과 출력:

- `moai spec audit --spec SPEC-EXPORT-004` → `Unknown flag: --spec.` (이 CLI에는 `--spec`이 없고 `--filter-spec`이 있다)
- MCP `spec_audit`(`filter_spec: SPEC-EXPORT-004`, `include_grandfathered: true`) → `{"total_specs":0,"grandfathered":0,"modern_era_clean":0,"drift_findings":[]}` — 감사기는 SPEC ID를 폴더 이름으로 잡으므로 `SPEC-EXPORT-004`로는 아무것도 걸리지 않는다.
- `moai spec audit --filter-spec SPEC-EXPORT-004-export-image-path --include-grandfathered --json` (exit 0):

```
{
  "audited_at": "2026-10-26T11:46:43.082391Z",
  "total_specs": 1,
  "grandfathered": 0,
  "modern_era_clean": 1,
  "drift_findings": [
    {
      "spec_id": "SPEC-EXPORT-004-export-image-path",
      "era": "V3R6",
      "finding_type": "EraAutoDetected",
      "severity": "INFO",
      "details": {
        "heuristic_matched": "H-4 (§E.2 + §E.4 + sync_commit_sha)"
      }
    }
  ]
}
```

판단: **기본안(HISTORY 1행 + `version` 패치 증가, `status: completed` 유지)을 택했다.** 근거는 셋이다.

1. 감사기의 drift 규칙(`moai spec audit --help`)은 progress.md 단계 표지와 `status`의 조합만 본다. 본문 편집은 drift 조건이 아니다. V3R6 규칙 중 `Y_Y_Y_Y_StatusDrift`는 "단계 표지 4개와 SHA가 모두 있는데 `status`가 `completed`가 아님"이므로, EXPORT-004를 `in-progress`로 되돌리면 오히려 이 규칙에 걸릴 수 있다.
2. `spec-frontmatter-schema.md`(주 체크아웃 `.claude/rules/moai/development/`, 이 worktree에는 그 파일이 없음)의 `completed → in-progress (amendment)` 전이는 **MAY**이고, 완료 SPEC을 다시 열어 고치는 경우를 위한 것이다. 이번 변경은 다른 SPEC(SPEC-PREVIEW-015)이 바꾼 동작을 가리키도록 회귀 금지 문장 하나를 고치는 것이며 EXPORT-004 자체의 구현을 다시 열지 않는다.
3. `status`를 바꾸지 않으므로 `amendment_of:`와 HISTORY `## Amendments`는 붙이지 않았다.

편집 뒤 같은 명령의 결과는 편집 전과 같다(V3R6, `modern_era_clean: 1`, INFO 1건, 아래 "편집 뒤 감사").

#### AC-PREVIEW015-024 문구 검사 (출력 `.moai/state/verify/pele-015-m6/ac024-out.txt`)

`python3 -I .moai/state/verify/pele-015-m6/ac024.py <worktree>` — AC-024 표의 1~25·27행을 블록 정의대로 잘라 금지·필수 문자열을 센다. 결과: 26행 모두 PASS(`FAILS 0`), 8개 파일(7개 SPEC + UI-008 acceptance.md) HISTORY에 `SPEC-PREVIEW-015` 행 각 1개. 26행(README·USER_MANUAL·USER_GUIDE)은 sync 범위라 검사하지 않았다.

첫 실행에서 16행이 FAIL이었다. 원인은 UI-008 HISTORY 0.0.3 행이 "빈 펜스 플레이스홀더 판정 힌트"와 `mermaid.parse`를 그대로 인용해, "첫 번째로 맞는 줄"을 고르는 검사가 내용 줄 대신 HISTORY 행을 집은 것이다. HISTORY 행 문구를 바꿔 다시 실행했다.

#### 편집 뒤 감사 (출력 `.moai/state/verify/pele-015-m6/audit-*.json`)

`moai spec audit --filter-spec <폴더 이름> --include-grandfathered --json`, 모두 exit 0, 편집 전 전체 감사(`--json --include-grandfathered`)와 시대 분류가 같다.

| SPEC 폴더 | 시대 | 결과 |
|-----------|------|------|
| SPEC-PREVIEW-015-pele-renderer | V3R5 | INFO 2(EraAutoDetected, Grandfathered) |
| SPEC-PREVIEW-006 | V2.x | INFO 2 |
| SPEC-PREVIEW-010-mermaid-dark-theme | V2.x | INFO 2 |
| SPEC-UI-008-diagram-insert-menu | V2.x | INFO 2 |
| SPEC-AI-001 | V3R2-R4 | INFO 2 |
| SPEC-AI-008-diagram-type-picker | V2.x | INFO 2 |
| SPEC-EXPORT-004-export-image-path | V3R6 | INFO 1(EraAutoDetected), `modern_era_clean: 1` |
| SPEC-EXPORT-001 | V2.x | INFO 2 |

`moai spec audit --strict` 전체 → exit 0(MUST-FIX 0건).

#### Gaps (확인하지 않은 것)

- `moai spec lint`는 돌리지 않았다. 개정한 SPEC 중 여섯 개(EXPORT-004 제외)는 이전부터 12개 필수 필드(`title`·`phase`·`module` 등)가 빠진 grandfather 시대 frontmatter다. M6 범위가 아니라 고치지 않았다.
- 개정 대상 표에 없는 mermaid 시절 문구(예: PREVIEW-006·010의 Overview·근거 절, UI-008 acceptance.md 머리말의 "mermaid 11.12.3 `mermaid.parse`로 검증", UI-008 Exclusions의 "11.12.3 핀 유지")는 표대로 손대지 않았다. AC-024는 표에 적힌 블록만 검사한다.
- AC-024의 manual 부분(앱에서 전체 흐름 확인)과 26행(사용자 문서)은 sync 단계 몫이다.
- SPEC-PREVIEW-010 REQ-006 둘째 줄은 표의 문구("내보내기 다이어그램 색은 SPEC-PREVIEW-015 REQ-018을 따른다.")를 그대로 옮겼고, `shall` 형식이 아닌 참조 문장이다.

#### M6 후속 — 표 밖 mermaid 문구 정리 (2026-10-26, 사용자 결정, 기준 HEAD f651a90)

위 Gaps의 둘째 항목을 사용자가 M7 전에 정리하기로 했다. 7개 SPEC의 `spec.md`·`acceptance.md`(SPEC-AI-001은 `spec-compact.md` 포함)에서 `mermaid`를 하나씩 보고, 지금 엔진에 대해 틀린 문장만 고쳤다. 판단 기준: (1) 지금도 참인 역사 기록(HISTORY 행, "1.0.0 당시" 근거)은 남기고 필요하면 당시 기록임을 밝힌다. (2) 다이어그램 문법을 가리키는 "Mermaid"(` ```mermaid ` 펜스, 다이어그램 종류, AI 프롬프트 입력 언어)와 D10으로 유지된 이름(`.mermaid-container`, `mermaidPlugin.ts`, `mermaidValidate.ts`, `validateMermaid`)은 그대로 둔다. (3) `plan.md`·`research.md`·`progress.md`·`tasks.md`·`handoff.md`는 그 시점의 작업 기록이라 손대지 않았다. 버전은 다시 올리지 않고 각 SPEC의 기존 SPEC-PREVIEW-015 HISTORY 행 문구를 늘렸다. frontmatter 변경 0줄(`git diff -U0 -- .moai/specs | grep -E '^[-+][a-z_]+:'` 출력 없음).

- SPEC-PREVIEW-006: Overview를 현재 상태 중심으로 고치고, 근거·결정 기록·선택한 해결 방향·[DELTA]에 1.0.0 기록 표시, Glossary·Exclusions·References 정리. acceptance.md 시나리오 A~E·측정 방법·엣지·DoD에서 패치 전제 제거(측정 대상은 M5 e2e와 같은 `text.pele-cluster-label`).
- SPEC-PREVIEW-010: Overview 현재 상태 안내, Glossary·Security·Exclusions·References 정리. acceptance.md는 mermaid `initialize`/`render` 스파이 시나리오가 모두 틀려져 A~F를 개정 REQ 기준으로 다시 썼고, 각 시나리오를 고정하는 이 SPEC의 AC(004·005·007·008·011·012·020·023)를 적었다.
- SPEC-UI-008: Summary·기술 컨텍스트·Environment·REQ-013·014("mermaid 파싱" → 다이어그램 렌더)·[DELTA]·Exclusions, acceptance.md 머리말·AC-006·007·품질 게이트·DoD.
- SPEC-AI-001: Summary·근거 절·Environment·[DELTA]·MX 계획, `spec-compact.md` REQ-AI-023·024·[DELTA], acceptance.md 검증 문구·보안 행·DoD.
- SPEC-AI-008: Summary·기술 컨텍스트·Environment·REQ-AI-008-014("mermaid 파싱 실패" → 다이어그램 검증 실패)·Exclusions, acceptance.md AC-010·013·품질 게이트·DoD.
- SPEC-EXPORT-004: acceptance.md 격리 설명, DM1 행, AC-EXPORT004-08을 현재 테스트(`src/test/exportImageEmbed.test.ts:315-334` DM1, 미리보기 DOM 없이 원본 펜스 렌더)에 맞춤. `status: completed` 유지.
- SPEC-EXPORT-001: §1 다이어그램 현재 상태 안내, 기술 스택·현재 상태·제약·A3·A6·§4.2~4.4·외부 라이브러리 표(mermaid → pele), acceptance.md HTML 시나리오 전제·DOCX 실패 시나리오(코드 텍스트 대체, `src/lib/export/exportDocx.ts:130-142,242-262`)·테스트 표.

검증: `python3 -I .moai/state/verify/pele-015-m6/ac024.py <worktree>` → `FAILS 0`(26행 PASS, 출력 `ac024-cleanup-out.txt`). `moai spec audit --strict` → exit 0, MUST-FIX 0건(출력 `audit-strict-cleanup.txt`).

남은 한계: SPEC-EXPORT-001 DOCX 실패 시나리오의 "사용자에게 경고가 표시된다"는 지금 코드에 해당 동작이 없어 지웠다. 1.0.0 구현에 경고가 있었는지는 확인하지 않았다. frontmatter `tags`의 `mermaid`·`patch-package`(PREVIEW-006 등)와 SPEC-AI-001 `spec-compact.md`·`acceptance.md`의 `version: "0.1.1"`은 버전·frontmatter를 바꾸지 말라는 지시에 따라 그대로 두었다.

### M7 정리·게이트·MX (2026-10-26, 기준 HEAD 33a0fa0)

#### 변경

| 커밋 | 내용 |
|---|---|
| `802da12` | `git rm -r spike/pele` — 55개 파일(비교 페이지·렌더·캡처·검증 스크립트, `samples/`·`samples-m1b/`·`m1b/`) 삭제(D11). spike 경로를 가리키던 주석 4곳 정정: `e2e/diagram-preview-behavior.spec.ts` 3곳(→ 픽스처 샘플 18·19·20, `manifest.json`의 `source`), `src/test/diagramRenderer.test.ts:314`(→ "M1b 시험 코드, M7에서 삭제") |
| `1233f89` | MX 최종 점검 — ANCHOR REASON 3곳을 측정한 호출부 수로 정정(아래 MX 표) |

- **삭제 전 참조 확인**: `grep -rn "spike" src e2e scripts vite.config.ts tsconfig.json tsconfig.node.json .eslintrc.cjs package.json playwright.config.ts .gitignore .github` → 주석 4줄과 `manifest.json`만 나왔다. import·설정·스크립트 참조는 0이다. `diagramRenderer.test.ts`는 렌더 입력을 `manifest.json` 각 항목의 `source` 필드(소스 전문 인라인)에서 읽으므로 spike 파일 없이 동작한다.
- **유지**: `src/test/fixtures/pele/`(`m1-frozen/`·`unit/`·`browser/`·`manifest.json`)는 그대로다.
- **재캡처 도구는 spike와 함께 사라졌다**: `manifest.json`의 `sourceOrigin` 170개는 `spike/pele/samples/…`(154)·`spike/pele/samples-m1b/…`(16)를 가리키는 출처 표기로 남는다(이제 없는 경로). `unit/`·`browser/` 재캡처 명령(위 M2 픽스처 표의 `spike/pele/vitest.capture.config.ts`·`m2-unit.capture.ts`·`vite.spike.config.ts`·`run-m2-browser.mjs`)과 M1 픽스처 재렌더 검증(`spike/pele/verify.capture.ts`)도 더는 실행할 수 없다. 다시 만들지 않았다. pele를 올리는 별도 SPEC은 캡처 도구를 새로 만들어야 한다. 단, `unit/` 재렌더 바이트 비교(AC-002)는 `diagramRenderer.test.ts` 안에서 계속 돈다.

#### 검증 (이 worktree에서 직접 실행, 출력 전문 `.moai/state/verify/pele-015-m7/`)

acceptance.md "기계 검증 게이트" 7종을 표에 적힌 순서와 상관없이 `npm ci`부터 실행해 깨끗한 설치 위에서 나머지를 돌렸다. 커밋 `1233f89` 작업 트리 기준.

| # | 명령 | exit | 핵심 출력 | 증거 |
|---|---|---|---|---|
| 6a | `npm ci --no-audit --no-fund` | 0 | `added 501 packages in 3s` | `npm-ci.txt` |
| 6b | `npm ls mermaid patch-package` | 1 | `mdedit@0.16.1 …/pele-015` `└── (empty)` — 두 패키지 모두 없음(npm은 찾는 패키지가 하나도 없으면 exit 1). `ls node_modules/mermaid node_modules/patch-package` → 둘 다 No such file | `npm-ls.txt` |
| 7 | `grep -rn "from 'mermaid'\|import('mermaid')\|vi.mock('mermaid'" src e2e` | 1 | 0건 | `grep-imports.txt`(빈 파일) |
| 2 | `npm run typecheck` (`tsc --noEmit`) | 0 | 출력 없음 | `typecheck.txt` |
| 3 | `npm run lint` (`eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`, 저장소 전체) | 0 | 출력 없음 | `lint.txt` |
| 1 | `npx vitest run` | 0 | `Test Files  108 passed (108)`, `Tests  1751 passed (1751)` | `vitest-full.txt` |
| 4 | `CI=1 npx playwright test` (프로젝트 `webkit` 하나) | 0 | `69 passed (21.2s)`, `1 skipped` — skip = `spec-img-mode-003.spec.ts:143` 기존 `.skip`(실제 DataTransfer 필요, 이 SPEC과 무관). 실행 전후 `lsof -nP -iTCP:1420 -sTCP:LISTEN` → 출력 없음(exit 1) | `playwright-full.txt` |
| 5 | `cargo test --manifest-path src-tauri/Cargo.toml` (`~/.cargo/bin/cargo`, 셸 PATH에 cargo 없음) | 0 | `test result: ok. 367 passed; 0 failed` (+ 0개짜리 대상 3개) | `cargo-test.txt` |
| + | `npx vite build --outDir <scratchpad>/m7-dist --emptyOutDir` | 0 | `✓ 609 modules transformed.`, `✓ built in 2.83s` | `vite-build.txt` |
| + | `git diff --stat 929d116 HEAD -- src-tauri src/lib/preview/svgSanitize.ts index.html src/lib/export/types.ts src/lib/image/imageResolver.ts src/components/editor/extensions/keyboard-shortcuts.ts` | 0 | 출력 없음(plan.md "변경하지 않는 파일" 무변경) | `unchanged-files.txt` |

커버리지(게이트 항목은 아니며 TRUST 5 확인용). 프로젝트에 커버리지 도구가 없어 `npm i --no-save @vitest/coverage-v8@2.1.9`로 `node_modules`에만 잠시 설치하고(`package.json`·`package-lock.json` 무변경, `git status` 확인) 측정 뒤 `npm ci`로 되돌렸다(`npm-ci-restore.txt`, `node_modules/@vitest/coverage-*` 0).

| 명령 | 결과 | 증거 |
|---|---|---|
| `npx vitest run --coverage.enabled --coverage.provider=v8 --coverage.include=src/lib/diagram/diagramRenderer.ts --coverage.include=src/lib/export/exportUtils.ts --coverage.reporter=text` | exit 0, `Tests 1751 passed`. `diagramRenderer.ts` Stmts 98.06 / Branch 86.59 / Funcs 100 / Lines 98.06 (미실행 52-53, 171-172). `exportUtils.ts` 97.33 / 93.18 / 100 / 97.33 (미실행 63-64) | `coverage.txt` |

#### MX 최종 점검 (plan.md "MX Tag Plan" 전 행, `grep -n "@MX:"`로 확인)

| 대상 | 계획 | 현재 코드 | 결과 |
|---|---|---|---|
| `diagramRenderer.ts` 렌더 진입 `renderDiagram` | ANCHOR + REASON | `:203-206` ANCHOR+REASON. 운영 코드 직접 호출 4곳(`PreviewRenderer.tsx:93`, `ai-suggestion-card.ts:1289`, `diagramRenderer.ts` `validateDiagram`, `exportUtils.ts:34`) | REASON "5곳 이상" → `fan_in = 4`(5경로)로 정정 (`1233f89`) |
| 같은 파일 검증 진입 `validateDiagram` | ANCHOR + REASON | `:216-219`. 직접 호출 1곳(`mermaidValidate.ts:22`) | 유지. REASON에 fan_in = 1과 계약 근거 명시 (`1233f89`) |
| 고정 옵션 상수 | NOTE + WARN + REASON | `:14-16` | 일치 |
| 색 값 치환 함수 | WARN + REASON | `resolvePeleVars` 위 WARN+REASON | 일치 |
| 다이어그램 전용 정화 경로 | WARN + REASON | `:131-132` | 일치 |
| KaTeX 해석기 | NOTE | `:44` (`mathml-bare`, `trust: false`) | 일치 |
| `idPrefix` 생성부 | NOTE | `:193` | 일치 |
| `diagramRegressionGuard.test.ts` pele 핀 | NOTE | `:48` | 일치 |
| `mermaidPlugin.ts:19` 이스케이프 | NOTE 추가 | `:19` | 일치 |
| `exportDocx.ts` 펜스별 렌더·PNG 변환 | WARN + REASON | `:126-127` | 일치 |
| `PreviewRenderer.tsx` ANCHOR | 문구 수정, 유지 | `:6` "다이어그램 모듈로 렌더" | 일치. 단 REASON "MarkdownPreview, 내보내기 함수 등 … fan_in >= 3"이 낡아 정정: 운영 사용처 `MarkdownPreview.tsx:5,32` 1곳(M4 이후 내보내기는 미리보기 DOM을 읽지 않음), NOTE 강등 후보로 표시하고 태그는 유지 (`1233f89`) |
| `PreviewRenderer.tsx` async forEach WARN | 삭제 | 없음. 개별 실패 처리 NOTE `:15-16` | 일치 |
| `PreviewRenderer.tsx` parse 선행 NOTE | 삭제 | 없음 | 일치 |
| `PreviewRenderer.tsx` securityLevel WARN/REASON | strict 모드 문구로 교체 | `:25-29` 표 문구 그대로 | 일치 |
| `PreviewRenderer.tsx` `@MX:SPEC` | SPEC-PREVIEW-015 추가 | `:10` `SPEC-PREVIEW-010 SPEC-PREVIEW-015` | 일치 |
| `PreviewRenderer.tsx` 빈 펜스 NOTE | 유지 | `:85-88` | 일치 |
| `mermaidValidate.ts:3-5` | SPEC 줄 추가, WARN·REASON 교체 | `:3` SPEC-PREVIEW-015, `:4-8` strict 모드 문구 | 일치 |
| `svgSanitize.ts` ANCHOR(fan_in >= 2)·WARN 2개 | 유지 | `:1-2`, `:10-11`, `:37-39`, 파일 diff 0줄 | 일치 |
| `exportDocx.ts:32` shift() NOTE | 삭제 → 새 WARN | shift NOTE 없음(`shift()`는 새 WARN REASON의 설명문에만 남음), 새 WARN `:126` | 일치 |
| `exportHtml.ts`·`exportDocx.ts` `@MX:SPEC` | SPEC-PREVIEW-015 추가 | `exportHtml.ts:6`, `exportDocx.ts:4` | 일치 |
| `ai-suggestion-card.ts` `renderMermaidInto` | NOTE 추가 | `:1284-1286` | 일치 |
| 확인만 하는 태그(`exportUtils.ts`, `exportPdf.ts`, `keyboard-shortcuts.ts`) | 무변경 | mermaid 라이브러리를 가리키는 MX 없음 | 일치 |

- `@MX` 줄 중 `securityLevel`·`mermaid.render`·`mermaid.parse`·"mermaid 다이어그램을 처리" 검색 → 0건.
- 모듈의 나머지 공개 함수 운영 호출부(grep): `readPeleThemeValues` 2(`exportDocx.ts:95`, `exportHtml.ts:112`), `resolveDiagramColors` 1, `formatDiagramError` 1, `sanitizeDiagramSvg`·`createMathResolver`·`katexMathMarkup`·`getDiagramPurifier`·`resolvePeleVars`는 모듈 내부만, `renderDiagramForTest` 0(테스트 전용). 모두 fan_in < 3이라 ANCHOR를 새로 붙이지 않았다. 파일당 상한(ANCHOR 3, WARN 5): `diagramRenderer.ts` ANCHOR 2·WARN 3, `exportDocx.ts` ANCHOR 1·WARN 2.

#### Gaps (확인하지 않은 것)

- 실제 Tauri 앱(시스템 WKWebView)은 실행하지 않았다. MANUAL-1~4, 앱 PDF·DOCX 실물 색·표시, Windows WebView2는 여전히 사람 확인 대상이다(§E.3).
- 깨끗한 체크아웃의 실제 CI는 돌리지 않았다. 이 worktree는 주 체크아웃 폴더 안이라 `npm ci` 뒤에도 상위 `node_modules`가 해석 경로에 남는다. 패키지 부재는 `npm ls`·`ls node_modules`와 M4의 scratch 복사 측정(`pele-015-m4/cleansim-*`)을 근거로 한다.
- 프로덕션 빌드는 만들기만 했고 `vite preview`로 띄워 e2e를 돌리지 않았다(KaTeX `data:` 글꼴 CSP 백로그 `t1` 확인 안 함).
- 커버리지 수치는 일회성 설치 도구로 잰 것이며 프로젝트에 고정된 커버리지 게이트는 없다.

### 수동 확인 (2026-10-26, 사용자 보고, sync 단계 manager-docs가 기록)

- **출처**: 사용자가 이 worktree(`.claude/worktrees/pele-015`, 브랜치 `WT-pele-renderer`) 빌드를 `npm run dev`로 띄워 확인한 뒤 2026-10-26에 "수동 확인 다 통과했어"라고 보고했다. 아래 판정은 사용자 보고에 근거하며, 에이전트가 앱을 직접 실행해 관찰한 것이 아니다.
- **확인 목록과 결과** (사용자에게 전달된 점검 목록 전 항목, 보고 = 통과):

| 항목 | 내용 | 결과 |
|---|---|---|
| MANUAL-1 | 다이어그램 안 링크 클릭 시 아무 일도 없음 / 본문 일반 링크는 시스템 브라우저로 열림 | 통과(사용자 보고) |
| MANUAL-4 | 시스템 WKWebView에서 다이어그램 노드 안 수식이 그려짐 | 통과(사용자 보고) |
| 테마 | 테마 토글 시 깜빡임 없이 다이어그램 색만 바뀜 | 통과(사용자 보고) |
| 다크 대비 | 다크 테마의 계열 색(`--pele-series-*`)·선·글자 대비 | 통과(사용자 보고) |
| 서브그래프 | 긴 한글 서브그래프 제목이 한 줄 | 통과(사용자 보고) |
| 오류·빈 펜스 | 오류 문구의 `(L행 C열)` 위치 표시, 빈 펜스 안내 문구 | 통과(사용자 보고) |
| 글꼴 | 글꼴 로드 시점(첫 렌더의 측정 글꼴·표시 글꼴 어긋남 없음) | 통과(사용자 보고) |
| 내보내기 | 다크 테마에서 HTML·PDF·DOCX 내보내기 — DOCX는 라이트 색, 그림 위치 맞음, 수식 보임, 실패 펜스는 코드 텍스트 | 통과(사용자 보고) |
| 에디터 단독 보기 | 미리보기를 끈 에디터 단독 보기에서 내보내기 | 통과(사용자 보고) |
| Windows | WebView2 미리보기 렌더·DOCX 내보내기("기기가 있을 때만" 항목) | 사용자가 별도로 언급하지 않음 (미확인) |

- **AC 판정 갱신**: AC-018(manual 부분), AC-020(manual 부분), AC-024(앱 안 전체 흐름 manual 부분), AC-025(manual 부분: MANUAL-4, 앱 PDF 수식 표시)를 사용자 보고에 따라 통과로 본다. AC-024의 문서 26행은 sync 단계 문서 갱신 뒤 따로 검사한다(§E.4).
- **확인하지 않은 것**: Windows(WebView2). MANUAL-2(앱 PDF 인쇄 결과)·MANUAL-3(교체 전 mermaid 수식 기준선)은 목록에 이름으로 따로 적히지 않았다. MANUAL-2는 "다크 테마에서 HTML·PDF·DOCX 내보내기" 항목에 포함된 것으로 읽었고, MANUAL-3은 교체 전 비교용 기준선이라 이번 보고 대상이 아니었다. 사용자가 확인한 문서·기기·OS 버전은 보고에 없다.

## §E.3 Run-phase Audit-Ready Signal

- `run_status: audit-ready`
- `run_complete_at: 2026-10-26T12:37:09Z`
- 브랜치 `WT-pele-renderer`, 작업 트리 `.claude/worktrees/pele-015`, 기준 `929d116`(origin/main). push 하지 않음. SPEC `status: in-progress` 유지(sync 단계가 옮김).

### 마일스톤과 커밋 범위

| 마일스톤 | 커밋 | 내용 |
|---|---|---|
| M1 / M1b | `20eb33f`, `d1dbc02` (판정·계획 반영 `f145220`, `c0fee35`, `0fac523`, `fd0df84`) | 시험 렌더링 비교 보고서·실측 픽스처, 수식 처리기 측정. 사용자 판정 통과(AC-001 HUMAN GATE) |
| M2 | `73ddd04`..`be76af2` | 다이어그램 모듈·`--pele-*` 토큰·픽스처 재캡처 |
| M3 | `6f529e2`..`e9c7470` | 미리보기·AI 검증·AI 카드를 모듈로 |
| M4 | `828dd92`..`a84b8e1` | 내보내기 원본 렌더·색 값 치환, mermaid·patch-package 제거 |
| M5 | `26caee8`..`200f171` | e2e 개정·추가 |
| M6 | `e07649d`..`33a0fa0` | 다른 SPEC 7건 문구 개정(manager-spec) |
| M7 | `802da12`..(이 기록 커밋) | spike 삭제, 게이트, MX 최종 점검 |

### AC 대응 (어디서 증명했는가)

| AC | unit | e2e | 사람 확인 / 증거 |
|---|---|---|---|
| 001 | — | — | M1 보고서 + 사용자 판정 통과(§E.2 M1 사용자 판정) |
| 002 | `diagramRenderer.test.ts`(unit/ 재렌더 바이트 동일, browser/ 구조) | — | 픽스처 매니페스트 |
| 003, 004, 005, 006, 007, 009, 010, 016, 017, 019, 021, 022, 023 | 통과 | — | — |
| 008 | 통과(PreviewRenderer) | — | — |
| 011 | 통과(같은 SVG 노드, 재렌더 0) | 통과(채움·선 색이 토큰 값으로 바뀜) | — |
| 012 | 통과(href·외부 이미지 0) | 통과(클릭 이동 0, 외부 요청 0) | MANUAL-1(앱 클릭) 미확인 |
| 013 | — | 통과(서브그래프 제목 1줄·겹침 없음) | — |
| 014 | 통과(같은 엔진, `PeleError.message`) | 통과(AI 재요청 흐름) | — |
| 015 | 통과 | — | — |
| 018 | 통과(미리보기 DOM 없이 내보내기, 옛 코드에서 실패 확인 `pele-015-m4/red-oldcode.txt`) | — | **manual 미확인**(앱 에디터 단독 보기 내보내기) |
| 019 | 통과(옛 코드에서 실패 확인 `red-oldcode.txt`) | — | — |
| 020 | 통과(형식·테마 6조합 `var(--pele-` 0, 테마 값 존재) | — | **manual 미확인**(내보낸 HTML·PDF·DOCX 실제 색) |
| 024 | — | — | 문구 검사 1~25·27행 PASS(`pele-015-m6/ac024-cleanup-out.txt`). 26행(README·USER_MANUAL·USER_GUIDE)은 sync 범위, **앱 전체 흐름 manual 미확인** |
| 025 | 통과(수식 구조, 별도 인스턴스 허용 목록) | 통과(수식 상자 배치, CSP 새 위반 0, 개발 서버) | **MANUAL-3·MANUAL-4 미확인**, 앱 PDF 수식 표시 미확인 |

### 기계 게이트 (M7, 위 표)

7종 모두 기대대로: vitest 1751/1751, typecheck 0, lint 0(저장소 전체), Playwright webkit 69 passed·1 기존 skip, cargo 367 passed, `npm ci` 후 mermaid·patch-package 없음, mermaid import grep 0. 추가로 `vite build` exit 0, 무변경 파일 diff 0, `diagramRenderer.ts` 줄 커버리지 98.06%.

### 남은 사람 확인 (sync 전 또는 머지 전)

- MANUAL-1: 앱에서 미리보기 본문 링크 클릭이 시스템 브라우저로 열리고, 다이어그램 노드 클릭은 아무 데도 가지 않는다.
- MANUAL-2: 앱 PDF 내보내기(인쇄 → PDF 저장) 결과의 다이어그램 표시·색.
- MANUAL-3: 현재 앱(교체 전) mermaid 수식 표시 기준선.
- MANUAL-4: 시스템 WKWebView에서 pele 수식이 상자 안에 그려짐, `m03` 오류 없음, 라이트·다크 PDF의 수식 표시.
- AC-018: 에디터 단독 보기에서 HTML·PDF·DOCX 내보내기에 다이어그램이 들어감.
- AC-020: 내보낸 HTML·PDF가 내보내기 테마 색, DOCX는 다크 앱에서도 라이트 색(라이트 탐침 선택자 효과), Word에서 열었을 때 표시.
- AC-024: 앱에서 전체 흐름(미리보기·AI·내보내기) 확인.
- Windows WebView2: 미리보기 렌더·DOCX 내보내기 1회(권장, 필수 아님).
- 앱 안 Barlow 글꼴 로드 전 첫 렌더 시 측정 글꼴과 표시 글꼴 어긋남 여부.
- 다크 테마의 `--pele-series-*`(파이·간트 계열 색)·선·글자 대비.

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-10-26
sync_commit_sha: "이 기록을 담은 sync 커밋 자체(같은 커밋 안에서는 자기 SHA를 적을 수 없음). git log --grep 'SPEC-PREVIEW-015 sync' -1로 확인"
sync_base_sha: adbea17
sync_status: audit-ready
b12_self_test_a: "grep -c 'SPEC-PREVIEW-015' CHANGELOG.md → 0 (작성 전), 중복 없음"
b12_self_test_b: "acceptance.md 고유 AC 식별자 36개 중 이 SPEC 소유 AC-PREVIEW015-* 25개(나머지 11개는 개정 대상 다른 SPEC의 AC 인용). CHANGELOG 항목은 '수용 기준 25건(AC-PREVIEW015-001~025)'으로 일치"
b12_self_test_c: "CHANGELOG에 적은 경로 8개(src/lib/diagram/diagramRenderer.ts, src/styles/mdedit-tokens.css, e2e/diagram-preview-behavior.spec.ts, src/lib/ai/mermaidValidate.ts, src/lib/export/exportHtml.ts·exportDocx.ts·exportUtils.ts, src/components/preview/PreviewRenderer.tsx) ls 확인, 삭제를 적은 patches/는 ls → No such file"
changelog_entry_position: "CHANGELOG.md [Unreleased] → 새 '### Changed' 절(기존 Fixed·Added 뒤)"
frontmatter_status_transitions:
  spec.md: "in-progress → completed (implemented 단계는 이 sync 커밋에 합쳐 닫음), updated: 2026-10-26 (이미 오늘 날짜라 값 변화 없음)"
  plan.md / acceptance.md / progress.md / spec-compact.md / design.md / research.md: "frontmatter 블록이 없어 상태 필드 없음 — 새로 만들지 않음"
mx_validation: "sync는 소스 파일을 바꾸지 않음. M7 MX 최종 점검(1233f89, §E.2 M7 표)이 계획 전 행을 확인했으므로 추가·변경 태그 0"
```

### 바꾼 문서

| 파일 | 내용 |
|---|---|
| `docs/USER_MANUAL.md` | 목차 7번 앵커를 실제 부록 제목으로 수정, 94행 깨진 앵커(`물법`→`문법`) 수정. 부록: pele 1.10.0 명시, 안내 문구 표(`⚠ Diagram syntax error (L행 C열)`·위치 없는 오류·빈 펜스·코드 그대로 보임) 신설, 문제 1을 실제 동작대로 다시 씀(백틱 줄에 `mermaid`, 공백은 무관), 사실이 아닌 문제 3(들여쓰기) 삭제·번호 당김, 점선 화살표 잘못된 예 `..->`→`-.>`, 단계별 점검에 오류 위치 단계 추가, 6-4절(다이어그램 안 수식·테마·링크/이미지·내보내기 색과 실패 처리) 신설, FAQ 갱신 |
| `docs/USER_GUIDE.md` | `### Mermaid 다이어그램` 절: pele 엔진, 재렌더 없이 색 전환, 오류 위치, 다이어그램 안 수식(섞인 라벨, 내보내기 포함), 링크·이미지, 내보내기(에디터 단독 보기, DOCX 항상 라이트, 실패 처리) |
| `README.md` | 15행 기능 설명, 104행 기술 표(Mermaid 11.12.3 → pele 1.10.0) |
| `docs/AI-Best-Practice-MdEdit.md`, `-Brief.md` | 기술 표 "Mermaid 11" 한 칸만 → "pele 1.10(Mermaid 문법)" (엔진에 대해 틀린 문장) |
| `.moai/project/tech.md` | 기술 표, Decision 5 재작성(이력 표기), 의존성 목록, 성능 표, 플랫폼 목록 |
| `.moai/project/structure.md` | 없는 `MermaidRenderer` 제거, usePreview·mermaidPlugin 설명, `diagram/` 모듈 추가, package.json·경계·데이터 흐름·성능·보안 항목 |
| `.moai/project/codemaps/{overview,pipelines,testing}.md` | 버전·플러그인 출력·에러 처리·테스트 공백 항목 |
| `CHANGELOG.md` | [Unreleased] `### Changed` 항목 |

문서 주장 근거: 부록의 "실패한다/성공한다" 문장은 pele 1.10.0 직접 탐침으로 확인했다(`.moai/state/verify/pele-015-sync/probe.mjs`·`probe2.mjs`, gitignore 대상). 예: `A[사용자 (User)]` → `syntax 2 11`, 탭 들여쓰기 → 렌더 성공, `A ..-> B` → 렌더 성공, `A -.> B`·`A -- > B`·`A -> B` → `syntax`, `Flowchart LR` → `unsupported-diagram 0 0`. 펜스 정보 문자열은 markdown-it 파싱 + `mermaidPlugin`과 같은 `trim() === 'mermaid'` 비교로 확인(`" mermaid"`·`"mermaid   "` 일치, `"mermaid diagram"`·`"Mermaid"`·다음 줄 `mermaid` 불일치). 내보내기 테마는 `AppLayout.tsx:149-168`의 `exportTheme`(앱 테마, system은 OS 설정으로 풀어 씀).

### AC-024 검사

- `python3 -I .moai/state/verify/pele-015-m6/ac024.py <worktree>` → exit 0, 1~25·27행 모두 PASS, HISTORY 8개 파일 각 1행, `FAILS 0` (`.moai/state/verify/pele-015-sync/ac024-out.txt`). 이 스크립트는 26행을 다루지 않는다.
- 26행 검사 `python3 -I .moai/state/verify/pele-015-sync/ac024_row26.py <worktree>` → README·USER_MANUAL·USER_GUIDE 모두 `11\.12\.3` 0건 PASS, 목차 15행 → `#appendix-mermaid-다이어그램-문법-오류-해결` 제목 존재 PASS, 문서 안 깨진 내부 앵커 0, `FAILS 0` (`ac024-row26-out.txt`).
- AC-024 manual(앱 전체 흐름): §E.2 "수동 확인" 사용자 보고로 통과.

### Gaps (확인하지 않은 것)

- 문서를 렌더해 링크를 클릭해 보지는 않았다. 앵커는 GitHub 제목 슬러그 규칙을 흉내 낸 스크립트로만 확인했다.
- 마크다운 린터는 이 저장소에 설정이 없어 돌리지 않았다.
- sync는 소스·테스트를 바꾸지 않아 vitest·Playwright·LSP 게이트를 다시 돌리지 않았다(마지막 실행은 M7, `1233f89` 작업 트리).
- USER_MANUAL 부록 소제목 번호(`6-1`~`6-4`)가 목차 번호(7)와 맞지 않는 기존 불일치는 그대로 두었다.
- Windows(WebView2) 실물 확인은 없다.

### 감사 후속 (F1·F2) (2026-10-26, 기준 HEAD af8b61b, manager-develop)

sync 감사(`.moai/reports/sync-audit/SPEC-PREVIEW-015-sync-audit.md`) PASS-WITH-DEBT 중 F1·F2만 고쳤다. 출력 전문은 `.moai/state/verify/pele-015-audit-fix/`.

- **F2 `da709ce`** — 정화 실패(예외·빈 결과)를 `{ok:false, error:{code:'sanitize', line:0, column:0}}`로 돌려준다(D9 접미사 없음). RED: `npx vitest run src/test/diagramRenderer.test.ts -t F2` → exit 1, `Tests 2 failed | 78 skipped (80)`, `expected true to be false` (`f2-red.txt`). GREEN: 같은 파일 전체 exit 0, `Tests 80 passed (80)` (`f2-green.txt`). 호출부 6곳(PreviewRenderer·mermaidValidate·ai-suggestion-card·exportUtils→exportHtml/exportDocx)은 모두 이미 실패 결과를 분기 처리함을 코드로 확인했다.
- **F1 `b5fe856`** — `e2e/diagram-export-colors.spec.ts`(webkit 2건). 페이지에서 `import('/src/lib/diagram/diagramRenderer.ts')`·`import('/src/lib/export/exportHtml.ts')`로 같은 모듈을 불러 다크 루트에서 dark 값 = 루트 계산 `--md-*`(= CSS 다크 블록), light 탐침 값 = CSS 라이트 블록(bg·fg·accent·surface, 다크와 다름), 탐침 미잔존, 실제 `generateHtmlContent` SVG의 `var(--pele-` 0건·테마 색만 사용을 확인. 운영 코드 무변경. 첫 실행 exit 0 `2 passed`. 실패 확인(커밋 안 함): 탐침 `data-theme` 제거 → exit 1, `light --pele-bg Expected "#f2f2f3" Received "#191b1d"` 및 라이트 SVG에 `#e9e9ea` 없음(`f1-e2e-break1.txt`); `probe.remove()` 제거 → exit 1, `임시 탐침 요소가 남아 있음 Expected 0 Received 2`(`f1-e2e-break2.txt`). 복구 후 `git diff -- src/lib/diagram/diagramRenderer.ts` 빈 출력, 재실행 exit 0 `2 passed`(`f1-e2e-green.txt`).
- 게이트(F1 커밋 직전 작업 트리): `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npx vitest run` exit 0 `Test Files 108 passed (108)`, `Tests 1753 passed (1753)` · `CI=1 npx playwright test` exit 0 `71 passed, 1 skipped`. 끝난 뒤 1420 포트 점유 프로세스 없음(`lsof -ti tcp:1420` 빈 출력).
- Gaps: tsconfig `include`가 `src`뿐이라 새 e2e 파일은 tsc가 아니라 eslint와 Playwright 실행으로만 검사된다. F1 e2e는 Vite 개발 서버의 `/src/...` 모듈 경로에 기대므로 빌드 산출물에서는 돌지 않는다(기존 e2e 2개 파일과 같은 방식).
- **F6** (2026-10-26, 기준 HEAD 3bdf659, manager-docs) — `CHANGELOG.md` SPEC-PREVIEW-015 `### Changed` 항목을 짧은 사용자용 하위 항목 7개로 나누고, 검증 수치·AC 목록·내부 구현 정보는 PR 본문용으로 `.moai/state/verify/pele-015-sync/changelog-moved-to-pr.md`에 옮겼다. 감사 보고서도 함께 커밋했다.

## §F Phase 4 Mode Selection

- Input: tier L, M1 scope = spike only (spike/pele/, m1/ report, src/test/fixtures/pele/), domains = frontend render + export + test tooling, language mix TS/HTML, concurrency benefit LOW (sequential capture/compare pipeline)
- Plan Audit Gate: skip-eligible (iteration 2 PASS 0.91 ≥ Tier L 0.85); artifacts were edited after the audit (N1–N5 wording folds, spec-compact.md, MX plan) — disclosed to the user, who chose to proceed without re-audit at Implementation Kickoff Approval (2026-10-26)
- Mode evaluation: direct — not selected (multi-file spike); serial — **selected**; fanout — not selected (coding-heavy, single pipeline); sweep — not selected (not mechanical bulk)
- Decision: serial
- Justification: M1 is one ordered pipeline (install → collect samples → render both engines → capture fixtures → report), so a single implementation agent avoids coordination overhead. Executor is `general-purpose` carrying the manager-develop role, because the manager-develop definition pins `isolation: worktree`, which previously created an empty nested worktree inside a session worktree (project lesson feedback-worktree-hook-failure).
