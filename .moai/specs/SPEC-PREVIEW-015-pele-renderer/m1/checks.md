# SPEC-PREVIEW-015 M1 — 기계 확인 표

> 기준 트리: 브랜치 `WT-pele-renderer`, HEAD `57eb160` 위의 작업 트리(이 커밋에 포함). 측정일 2026-10-26, macOS(Darwin 27.0.0, Apple Silicon), node v24.12.0.
> 측정 환경: 단위 = `vitest 2.1.9 jsdom 28.1.0`(설정 `src/test/setup.ts`), 브라우저 = `playwright 1.58.2 webkit 26.0`(헤드리스), PDF 대용 = `playwright chromium 145.0.7632.6`.
> 원본 출력: `evidence/unit-capture.json`, `evidence/browser-run.json`, `evidence/browser-svgs.json`. 상태 표기: PASS(이번 실행에서 관찰) / FAIL / MANUAL(사용자가 앱에서 확인해야 함). 판정(통과/보류)은 사용자 몫이다.

## 확인 항목 (AC-PREVIEW015-001 1–13)

| # | 항목 | 상태 | 실행 명령 | 출력 발췌 |
|---|------|------|-----------|-----------|
| 1 | 모든 샘플이 `PeleError` 없이 렌더, `notarealdiagramtype foo!!!`는 거부(`code` 기록) | PASS | `npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/unit.capture.ts` · `node spike/pele/run-browser.mjs` | 유효 19개 모두 렌더(jsdom·webkit). `11-ai-mock-invalid` → `{"code":"unsupported-diagram","message":"No diagram type detected for the given text.","line":0,"column":0}`. 의도적 오류 샘플 21·22·23도 거부(`syntax` L2 C14 / `semantic` L0 C0 / `syntax` L3 C1). 실제 AI 응답: 미수집 |
| 2 | 시나리오 B·C 서브그래프 제목 한 줄, 상자 겹침 없음 | PASS | `node spike/pele/run-browser.mjs` (`geometry`) | B·C, 560·800px 모두 제목 `tspans 0`(한 줄), 높이 19px(800) / 14px(560, responsive 축소), `clusterOverlaps []`, 제목이 클러스터 안(`fitsInsideSomeCluster: true`) |
| 3 | `autoDirection: false`이면 560px에서 배치 방향이 800px과 같음 | PASS | `node spike/pele/run-browser.mjs` (`autoDirection`) | 고정 옵션(모듈은 `maxWidth`를 넘기지 않음)에서는 출력이 칸 폭과 무관하게 동일. `maxWidth` 560/800 비교: 01·12·13·15 `falseSvgEqual560vs800: true`, 03은 방향 TB 유지·간격만 축소(767×316 → 715×284). 대조: `autoDirection:true`+560 → 15번 575×188 → 186×452 |
| 4a | `links: false` → `href` 있는 `<a>` 없음, 클릭해도 이동 없음 / `images: false` → 외부 주소·네트워크 요청 없음 (webkit) | PASS | `unit.capture.ts` (`linksImages`) · `run-browser.mjs` (`linksImagesBrowser`) | `linksFalse {"anchorWithHref":false,"linksInfo":[]}`, webkit에서 노드 A·B 클릭 후 `urlUnchanged:true, popups:0`. `imagesFalse {"imageEl":false,"externalUrl":false}`, 점검 중 요청 `[]`. 대조: 기본값이면 `<a href>`·`<image>`가 생기고 `sanitizeSvg`가 둘 다 지움 |
| 4b | Tauri 개발 웹뷰에서 다이어그램 클릭 시 이동 없음 | MANUAL | 아래 MANUAL-1 | 실행하지 않음(데스크톱 앱 필요). M1에는 앱 연결 코드가 없어 M3 이후에만 실제 확인 가능 |
| 5 | HTML·PDF·DOCX PNG에서 색이 남음(literal), as-is 결과도 함께 | PASS (HTML·DOCX) / MANUAL (PDF 앱 경로) | `run-browser.mjs` (`exports`) · `node spike/pele/make-docx.mjs` | HTML literal: 파일 안 `var(--pele-` 0건(라이트·다크), as-is 39건. DOCX PNG 유채색 픽셀: 13번 46,709(라이트 literal) / 46,650(다크 literal), 09번 178,725 / 178,879. 다크 as-is는 라이트 as-is와 픽셀 통계가 같음(대체값=라이트). PDF는 Chromium 인쇄 대용 4개만 생성(`exports/pdf-proxy-*.pdf`); 앱 인쇄 경로는 MANUAL-2. 다크 literal은 흰 DOCX 페이지에서 밝은 글자가 거의 안 보임(report F3) |
| 6 | DOCX용 SVG→PNG 결과에 글자와 색이 보임 | PASS (라이트) / 주의 (다크 literal 대비) | `run-browser.mjs` (`svgToPng`, `exportDocx.ts:154-201`과 같은 경로) | 12개 PNG 모두 변환 성공(`ok:true`), 2배 크기. 라이트 PNG에서 글자·색 확인(`exports/docx-png-light-literal-13-classdef-style.png`). 다크 literal은 글자가 있으나 투명 배경+밝은 글자라 흰 페이지에서 대비 부족(`exports/docx-dark-literal.docx.png`) |
| 7 | `sanitizeSvg` 통과 뒤에도 모양이 같음(`<style>`·인라인 style·`id` 참조 기록) | PASS | `run-browser.mjs` (`sanitizeVisual`) · `unit.capture.ts` (`results`) | webkit 정화 전·후 스크린숏 바이트 동일 19/19. 인라인 style 개수 동일(예: 01번 6→6), `<style>` 0→0, `id` 0→0, `var(--pele-` 동일(11→11). 지워지는 것: 루트 `role="graphics-document document"`. 문자열은 직렬화 차이로 다름(자기 닫힘 태그 → 여는/닫는 태그) |
| 8 | 앱 CSP(`index.html:7`) 아래 콘솔 CSP 오류 없음 | PASS | `run-browser.mjs` (`spike/pele/compare.html`에 같은 CSP meta, `vite build` 결과를 `vite preview`로 제공) | pele 렌더·삽입 단계: `violationsAfterPele []`, `consoleAfterPele []`. mermaid 단계에서만 2건: `img-src https://example.com/logo.png`(20번 이미지 노드, mermaid 쪽) |
| 9 | 다이어그램 30개 이상 문서에서 첫 렌더 시간 | PASS (측정) | `run-browser.mjs` (`timing`, 32개, 실행마다 새 페이지) | mermaid 전체 579 / 516 / 507ms(레이아웃 포함 585 / 522 / 512), pele 32 / 34 / 32ms(34 / 36 / 34). 1개 콜드: mermaid 27 / 47 / 23ms, pele 3 / 3 / 4ms |
| 10 | 엔티티 샘플: `data-diagram` 속성값과 펜스 토큰 원문이 결과를 다르게 만드는지 | PASS (차이 없음) | `unit.capture.ts` (`entity`, 실제 `mermaidPlugin` + markdown-it) | 입력은 다름: 토큰 `A[R&amp;D]`, 속성 `A[R&D]`(`inputsEqual:false`). pele 출력은 바이트 동일(`svgEqual:true`), 라벨 둘 다 `R&amp;D`(=화면 "R&D") — pele가 엔티티를 스스로 디코드 |
| 11 | vitest jsdom에서 pele 렌더 가능 여부 | PASS | `unit.capture.ts` (`jsdom`, `results`) | `OffscreenCanvas: undefined`, `canvas.getContext('2d'): null` → pele가 내장 글자 폭 표 측정기로 렌더. 19개 모두 두 번 렌더해 동일(`deterministic:true`). 고정 폭 측정기를 주입하면 결과가 달라짐(`fixedWidthDiffers:true`). stderr에 jsdom 경고 1줄: `Not implemented: HTMLCanvasElement's getContext() method` |
| 12 | 여러 다이어그램 동시 렌더 시 SVG `id` 중복 | PASS | `unit.capture.ts` (`ids`) · `run-browser.mjs` (`domIds`) | pele 출력에 `id` 속성 자체가 없음: `idPrefix` 없음/있음 모두 `totalIds 0`; webkit 한 문서에 19개 삽입 `idCount 0, duplicates []` |
| 13 | 수식 라벨(측정만) | PASS (측정 기록) | `unit.capture.ts` (`math`) · `run-browser.mjs` (`math`) | mermaid strict: `foreignObject:true, katexMarkup:true, mathml:true`, 화면에 수식 표시(`img/18-math-label-mermaid.png`). pele: `foreignObject:false`, 라벨이 원문 `$$x^2 + y^2$$`·`$$\frac{a}{b}$$` 그대로(`img/18-math-label-pele.png`). 앱 미리보기 확인은 MANUAL-3 |

## 추가 기록 (판정 입력값)

- **`--pele-*` 변수(D5)** — 출력에서 관찰: `--pele-accent --pele-bg --pele-border --pele-fg --pele-font --pele-font-mono --pele-heading-weight --pele-line --pele-muted --pele-radius --pele-series-1…4 --pele-surface --pele-surface-alt --pele-title-weight`. `dist/pele.js` 소스에만: `--pele-series-5…8`, `--pele-error`, `--pele-critical`, `--pele-zoom-cursor`, `--pele-zoom-top/right/bottom/left`(enableZoom 전용). 명령: `grep -o -- '--pele-[a-z0-9-]*' node_modules/pele/dist/pele.js | sort | uniq -c`.
- **단위 테스트 측정기(D14) 근거** — jsdom에는 캔버스가 없어 pele가 내장 측정기를 고르고, 결과가 결정적이며 재렌더 시 바이트 동일(아래 픽스처 검증 76/76). 이 근거로는 `jsdom-default`가 추가 코드 없이 쓸 수 있는 후보다. 선택은 사용자·오케스트레이터가 기록한다.
- **`responsive`** — `true`/`false` 차이는 루트 style의 `max-width:100%;height:auto` 유무뿐(19/19 확인). 보고서에 두 값을 나란히 실었다.
- **오류 위치 샘플(AC-007용)** — `line≥1·column≥1`: `sequenceDiagram\n  A->>B hello`(L2 C14). `line 0`: `pie\n  "a" : -1`(semantic), `notarealdiagramtype foo!!!`. `line≥1·column 0`: 변형 6,264개에서 0건(찾지 못함).
- **pele 오류 메시지 형식** — mermaid와 같은 꼴(`Parse error on line 2:\n…\nExpecting 'TXT', got 'NEWLINE'`). 다만 mermaid 메시지와 글자가 같지는 않다(21번 비교: mermaid는 `...iagram  A->>B hello` 앞부분을 붙임).
- **이 브랜치의 기존 테스트 영향** — `pele` 설치로 `src/test/diagramRegressionGuard.test.ts`의 "런타임 의존성 무증가" 단언 1건이 실패한다(`expected […(21)] to deeply equal […(20)]`, 명령 `npx vitest run src/test/diagramRegressionGuard.test.ts src/test/aiDiagramTypeRegressionGuard.test.ts` → `Tests 1 failed | 6 passed (7)`). plan.md M2가 이 가드를 고치는 범위다.
- **픽스처 검증(AC-002 예행)** — `npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/verify.capture.ts` → `unitChecked=76 browserChecked=76 mismatches=0`, `Tests 1 passed`.
- **기본 vitest가 spike를 수집하지 않음** — `npx vitest list --filesOnly | grep -c spike` → `0`.

## MANUAL 항목 (macOS 앱)

M1은 운영 코드를 바꾸지 않으므로, 앱에서 pele 출력을 직접 볼 수는 없다. 아래 두 가지(MANUAL-2, MANUAL-3)는 **현재 앱 동작의 기준선**을 확인하는 것이고, MANUAL-1은 M3에서 모듈이 연결된 뒤에야 의미가 있다.

- **MANUAL-1 (확인 4b, M3 이후)** — `npm run tauri dev`로 앱을 띄우고 `spike/pele/samples/19-link-click.mmd` 내용을 ```` ```mermaid ```` 펜스로 넣는다. 미리보기에서 "링크 노드"·"대상" 상자를 클릭한다. 확인할 것: 외부 브라우저가 열리지 않고 창 내용도 바뀌지 않는다.
- **MANUAL-2 (확인 5, PDF 앱 경로)** — 앱에서 `.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/exports/html-light-literal.html`과 같은 세 다이어그램(13·09·05번 소스)을 펜스로 넣은 문서를 만들고, 라이트·다크 각각 "PDF로 내보내기" → 인쇄 대화상자에서 PDF로 저장. 확인할 것: (a) 현재 mermaid 다이어그램이 PDF에 색과 함께 나오는지(기준선), (b) 다크 테마에서 다이어그램 글자가 읽히는지. pele 경로의 PDF는 M4 이후 같은 절차로 다시 본다. 비교용 Chromium 대용 PDF는 `m1/exports/pdf-proxy-*.pdf`.
- **MANUAL-3 (확인 13 기준선)** — 앱에서 `spike/pele/samples/18-math-label.mmd`를 펜스로 넣는다. 확인할 것: 지금 앱 미리보기에서 `x² + y²`·`a/b`가 수식으로 보이는지(webkit 측정에서는 보였다). 보인다면 pele 교체 뒤에는 `$$…$$` 원문으로 바뀐다(report F1).

## 재현 명령

```bash
npm ci && npm i -E pele@1.10.0
npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/unit.capture.ts   # unit/ 픽스처 + jsdom 근거
SPIKE_OUT=<임시 폴더> npx vite build --config spike/pele/vite.spike.config.ts
SPIKE_OUT=<임시 폴더> npx vite preview --config spike/pele/vite.spike.config.ts        # http://localhost:4317
node spike/pele/run-browser.mjs                                                          # browser/ 픽스처 + 비교·내보내기·시간
node spike/pele/make-docx.mjs && qlmanage -t -s 900 -o <m1/exports> <m1/exports>/docx-*.docx
node spike/pele/merge-manifest.mjs                                                       # manifest.json 병합
node spike/pele/make-report.mjs                                                          # m1/report.html
npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/verify.capture.ts  # 픽스처 재렌더 검증
```
