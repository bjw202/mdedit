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

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## §F Phase 4 Mode Selection

- Input: tier L, M1 scope = spike only (spike/pele/, m1/ report, src/test/fixtures/pele/), domains = frontend render + export + test tooling, language mix TS/HTML, concurrency benefit LOW (sequential capture/compare pipeline)
- Plan Audit Gate: skip-eligible (iteration 2 PASS 0.91 ≥ Tier L 0.85); artifacts were edited after the audit (N1–N5 wording folds, spec-compact.md, MX plan) — disclosed to the user, who chose to proceed without re-audit at Implementation Kickoff Approval (2026-10-26)
- Mode evaluation: direct — not selected (multi-file spike); serial — **selected**; fanout — not selected (coding-heavy, single pipeline); sweep — not selected (not mechanical bulk)
- Decision: serial
- Justification: M1 is one ordered pipeline (install → collect samples → render both engines → capture fixtures → report), so a single implementation agent avoids coordination overhead. Executor is `general-purpose` carrying the manager-develop role, because the manager-develop definition pins `isolation: worktree`, which previously created an empty nested worktree inside a session worktree (project lesson feedback-worktree-hook-failure).
