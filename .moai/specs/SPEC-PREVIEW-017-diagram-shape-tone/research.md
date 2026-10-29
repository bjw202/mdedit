# SPEC-PREVIEW-017 research.md — 조사 기록

> 외부 리서치(WebSearch·WebFetch)는 오케스트레이터가 2026-10-29 세션에서 수행했고, 코드·pele 사실 확인과 대비 계산은 plan 단계(manager-spec)가 같은 날 직접 실행했다. 1차 출처와 2차 출처를 구분해 적는다. 수치는 이 세션에서 실제로 계산한 값만 쓴다.

## 1. 문제 정의

- mdedit는 mermaid 문법 다이어그램을 pele 1.10.0으로 렌더하고, 색은 SPEC-PREVIEW-016의 고정 팔레트 "잉크 앤 허니"(`src/styles/mdedit-tokens.css` :root 92-124행)를 쓴다.
- 플로차트의 모든 노드가 같은 채움 `--pele-surface` `#EEF3F7`과 같은 테두리 `--pele-border` `#97A4B1`로 칠해지고, `--pele-accent`는 `--pele-line`과 같은 `#3A5673`이라 다이어그램이 단조롭게 보인다.
- 마크다운 대부분이 LLM 작성이라 `classDef`가 거의 없다. 따라서 렌더러가 구조(모양) 기반 기본 톤을 직접 제공해야 한다.

## 2. 외부 근거

| # | 주장 | 출처 | 등급 |
|---|------|------|------|
| R1 | 의도(역할) 중심의 적은 의미 토큰. Visual Studio 2026은 테마 토큰을 약 1,806개에서 229개로(약 87%) 줄이고 AccentFill/Stroke/ControlFill처럼 역할 이름으로 붙였다 | https://learn.microsoft.com/en-us/visualstudio/extensibility/migration/modernize-theme-colors | 1차(공식 문서, 세션 내 fetch 확인) |
| R2 | WCAG 2.x SC 1.4.11 비텍스트 대비 — 내용을 이해하는 데 필요한 그래픽 요소는 인접 색과 3:1 이상. 테두리·외곽선이 필요한 대비를 담당할 수 있고, 가장 대비가 낮은 부분을 기준으로 시험한다. 노드 텍스트가 노드를 식별하면 노드 경계 자체는 필수 대비 대상이 아니다 | https://w3c.github.io/wcag/understanding/non-text-contrast.html | 1차(W3C Understanding 문서 편집자 초안, 세션 내 fetch 확인) |
| R3 | 색만으로 의미를 전달하지 않는다 — 모양·라벨과 짝지운다. 다이어그램당 색은 3개 이하 | https://news.mnstate.edu/?p=86803 , https://skills.visual-paradigm.com/?p=648 , https://www.umassd.edu/accessibility/digital-accessibility/charts/ | 2차(검색 결과, 본문 미검증) |
| R4 | 중립색 우선 + 단일 유채색 액센트 + 톤 단계 표면 레이어링(IBM Carbon 요약) | https://medium.com/@mats_44589/carbon-design-system-a-practical-example-8dcad5261ba5 | 2차(블로그 요약) |
| R5 | 색조를 띤 중립색, OKLCH 지각 균일 팔레트 | https://design.verdigris.co/foundations/color , https://uxdesign.cc/oklch-explained-for-designers-dc6af4433611 | 2차(벤더·블로그, 2026 특정 아님 — 현행 관행 참고용) |

## 3. 대응 원칙 (설계 논리)

- 모양이 이미 역할을 표현한다. 색은 그 역할을 다시 한 번 강조할 뿐이다(중복 부호화, R3).
- 따뜻함·차가움 대비로 판단(따뜻한 꿀색)과 처리(차가운 기본 표면)를 가른다.
- 단일 액센트(잉크 블루)는 진입·종료 지점에만 쓴다(R4).
- 다이어그램 한 장에 쓰이는 노드 톤은 기본·판단·시작/끝의 3가지를 넘지 않는다(R3).
- 새 토큰은 역할 이름 1개만 더한다(R1). 시작/끝 테두리는 기존 `--pele-accent` 값을 재사용한다.

## 4. pele 1.10.0 출력 구조 (읽기 전용 실측)

실측 대상: `/Users/byunjungwon/Dev/my-project-01/markdown-editor-rust/.claude/worktrees/release-v0.18.0/node_modules/pele/dist/pele.js`(`package.json` version `1.10.0`). 수정하지 않았고 git도 실행하지 않았다.

| 사실 | 근거(grep 결과) |
|------|----------------|
| 사적 변수는 SVG 루트의 인라인 `style`에서 정의된다: `--_bg:var(--pele-bg,#fff);…;--_s:var(--pele-surface,#f3f3f3);--_a:var(--pele-surface-alt,#e6e6e6);--_b:var(--pele-border,#8a8a8a);--_c:var(--pele-accent,#5b7bd5)` | `var fm="--_bg:…"`, 루트 템플릿 `<svg … class="pele pele-${e}" … style="${u}${fm}…" fill="var(--_fg)"` |
| 노드 모양은 표현 속성 `fill="var(--_s)" stroke="var(--_b)"`로 칠한다 | `cg=' fill="var(--_s)" stroke="var(--_b)"'` |
| 노드 그룹은 `<g class="pele-node pele-shape-${shape}…" data-id=… transform=…>`이고 그룹 자체에는 `style`이 없다 | 노드 템플릿 문자열 |
| 작성자 `classDef`/`style`은 모양 요소의 인라인 `style` 속성으로 나간다 — 예: `style="rx:var(--_r);fill:#ffeeee;stroke:#cc0000;"` | `pt(e)` 함수(인라인 style 병합) + 오케스트레이터 실측 |
| 모양 별칭 표에서 `stadium`은 `terminal`·`pill`과, 마름모는 `decision`·`diamond`와 같은 묶음이다 | `sw=[…["stadium","terminal","pill"]…]`, `…"decision","diamond"…` |
| `circle`은 별도 묶음이며 `doublecircle`·`sm-circ`·`f-circ`·`fr-circ` 등 원 계열이 따로 있다(상태도 시작·끝 점 등) | 별칭 grep(`circle"` 14회 등) |
| 간선 라벨 상자는 `<g class="pele-edge-label"><rect … rx="3" fill="var(--_bg)"/>…`이다 | `function rn(…)` |
| pele가 읽는 `--pele-*` 이름: accent, bg, border, critical, error, fg, font, font-mono, line, muted, radius, series-*, surface, surface-alt, zoom-* — `--pele-decision-border`는 0회 | `grep -o -- '--pele-[a-z0-9-]*'` 결과, `grep -c pele-decision` = 0 |
| 모양 테두리에 `stroke-width` 속성을 붙이지 않는다(기본값 상속) | 노드 모양 상수에 stroke-width 없음 |
| 클러스터(서브그래프) 사각형은 이미 `fill="var(--_a)" fill-opacity="0.5"` — surface-alt `#F7F2E7` 반투명으로 칠해진다. 서브그래프 안 판단 노드는 채움이 클러스터 바탕과 비슷해 테두리로 구분된다 | `grep -o 'fill="var(--_a)" fill-opacity="[0-9.]*"'` → 7회, 모두 `0.5` |
| 원 계열 중 `sm-circ`(`start`·`small-circle`·`stateStart`)와 `fr-circ`(`stop`·`framed-circle`·`stateEnd`)가 시작·끝 별칭을 갖고, `f-circ`는 `junction`(접합점)이다. 일반 `circle`(`circ`)에는 단말 별칭이 없다 | 별칭 배열 grep: `["sm-circ","start",…]`, `["fr-circ","stop",…]`, `["f-circ","junction",…]` |
| 참고: 위에서 인용한 `cg` 상수는 블록 다이어그램용이고 플로차트는 같은 문자열의 쌍둥이 상수 `cf`를 쓴다(plan-audit review-1 확인) | 리뷰 보고서 Verified facts |

해석: 노드 `g`에 `--_s`/`--_b`를 다시 선언하면 그 노드의 모양만 새 값을 상속받는다. 작성자 스타일은 모양 요소 자신의 인라인 선언이므로 상속된 변수보다 항상 이긴다(§6 결정 근거).

## 5. 대비 실측 (WCAG 상대 휘도, 이 세션 python 계산)

| 전경 | 배경 | 대비 | 판정 |
|------|------|------|------|
| `#B78511`(series-4 꿀색) | `#F7F2E7` | 2.95 | 1.4.11 3:1 미달 — 판단 테두리로 기각 |
| `#8A6410`(후보) | `#F7F2E7` | 4.81 | 통과 |
| `#8A6410` | `#FAF9F6`(종이) | 5.10 | 통과 |
| `#96562F`(series-8 갈색) | `#F7F2E7` | 5.13 | 수치는 통과하나 기각(§7) |
| `#3A5673`(잉크 블루) | `#EEF3F7` | 6.81 | 통과 |
| `#3A5673` | `#FAF9F6` | 7.23 | 통과 |
| `#97A4B1`(기본 테두리) | `#EEF3F7` | 2.28 | 노드 텍스트가 식별하므로 허용(R2) |
| `#F7F2E7` | `#FAF9F6` | 1.06 | 채움만으로는 구분 불가 — 테두리가 대비를 담당 |
| `#222B33`(본문) | `#F7F2E7` | 12.87 | 통과 |
| `#FAF9F6` | `#f2f2f3` | 1.06 | 라벨 이음매 가설(§8)의 차이 크기 |

색상(HSL) 실측: `#B78511` hue 41.9°, `#8A6410` hue 41.3°, `#F7F2E7` hue 41.2° — 후보 테두리는 series-4와 같은 색상 계열이고 명도만 낮다. 최종 값은 run 단계에서 대비 3:1 이상(`#F7F2E7` 기준)과 시각 조화를 다시 확인해 확정한다.

## 6. 미리보기 덮어쓰기 방식 비교

| 방식 | 내용 | 작성자 스타일 우선 | 판정 |
|------|------|------------------|------|
| A. 노드 `g`에서 사적 변수 재선언 | `.pele-node.pele-shape-diam { --_s: …; --_b: … }` | 모양 요소의 인라인 `fill`/`stroke`가 상속 변수보다 이김 — `!important` 불필요 | **채택** |
| B. 자식 모양에 `fill`/`stroke` CSS 지정 | `.pele-shape-diam > polygon { fill: … }` | 인라인 style이 CSS보다 이기므로 동작은 같음 | 기각 — 모양마다 자식 요소 종류(polygon·rect·path)를 알아야 하고, 라벨 텍스트까지 잡을 위험이 있다 |

방식 A의 추가 이점: 내보내기에서도 같은 원리(노드 `g`의 인라인 사용자 정의 속성)를 그대로 쓸 수 있어 미리보기와 내보내기의 기제가 1:1로 같다. `stroke-width`는 상속 속성이라 시작/끝 노드 `g`에 지정하면 모양이 물려받고, 작성자가 `stroke-width`를 쓰면 그 인라인 값이 이긴다.

## 7. 기각한 대안 (계약·토큰·API에 남기지 않는다)

- 판단 테두리에 꿀색 `#B78511`(series-4) 그대로 사용 — `#F7F2E7` 위 2.95:1로 1.4.11 미달.
- 판단 테두리에 series-8 갈색 `#96562F` 재사용 — 대비는 충분하나 데이터 계열 색을 구조 의미로 겹쳐 써서 계열 색과 의미가 섞인다. 색상도 꿀색 계열과 다르다.
- 데이터·클러스터(서브그래프) 착색 — 범위 밖(사용자 결정 1). 다이어그램당 3색 상한도 넘긴다.
- 라벨 문구 기반 의미 추론(예: "실패"·"아니오"·"yes"로 색 결정), 노드 순서 기반 무지개 착색 — 금지(사용자 결정, 하드 제약).
- `circle`을 시작/끝으로 포함 — 아래 §7.1.
- 라벨 이음매 해법 (b)(라이트 전용 `--_bg` 재선언) — §8 기각 사유 참조(사용자 결정 2026-10-29로 (a) 확정).

### 7.1 `circle` 제외 결정

- 기본값(시작/끝은 `stadium`만)을 유지한다.
- 근거 1: pele 별칭 표에서 `stadium`은 `terminal`과 같은 묶음이다 — 렌더러 자신이 이 모양을 단말로 명명한다. `circle`에는 그런 별칭이 없다.
- 근거 2: 플로차트에서 원은 연결점(접합부)이나 일반 강조 노드로도 쓰여 단말 의미가 모호하다. 의미가 모호한 모양에 액센트를 주면 "모양이 역할을 표현하고 색은 그것을 강조한다"는 원칙이 깨진다.
- 근거 3: pele에서 시작·끝 별칭(`start`·`stop`·`stateStart`·`stateEnd`)은 일반 `circle`이 아니라 상태도용 `sm-circ`·`fr-circ`가 갖고, 채운 원 `f-circ`는 `junction`(접합점)이다. 일반 `circle`이 단말이라는 근거는 렌더러 안에 없다. `sm-circ`·`fr-circ`는 플로차트 모양이 아니므로 이번 범위(사용자 결정 1)에 넣지 않는다.
- 결과: `circle`은 다른 모양(rect·cyl 등)과 함께 기본 톤으로 남는다.

## 8. 간선 라벨 이음매 — 가설과 측정 의무

- 관찰(사용자 스크린샷): 라이트 테마 미리보기에서 간선 라벨 상자가 주변 배경보다 밝게 보인다. 다크는 종이 카드(`#FAF9F6`) 위라 이음매가 없다.
- 코드 읽기로 세운 가설(측정 전): 라벨 상자는 `fill="var(--_bg)"` = `--pele-bg` `#FAF9F6`이다. 라이트에는 카드가 없고(REQ-PREVIEW016-005), 미리보기 창 배경은 `.md-previewpane { background: var(--md-bg) }`(`src/styles/mdedit-components.css:289`) = 라이트 `#f2f2f3`(`mdedit-tokens.css:17`)으로 보인다. 둘의 대비는 1.06이다.
- 이 가설은 계산 스타일로 측정하지 않았다. run 단계는 고치기 전에 라이트·다크 각각에서 `.mermaid-container`의 실제 바탕(투명이면 첫 불투명 조상의 계산 배경)과 라벨 `rect`의 계산 `fill`을 실측해 원인을 확정해야 한다.
- 관련 사실: 내보내기는 이미 두 테마 모두 컨테이너 바탕을 `#FAF9F6`으로 칠한다(`src/lib/export/exportUtils.ts:107-113`, 016). 즉 라이트 내보내기는 이음매가 없고, 라이트 미리보기만 내보내기와 다르다.
- 결정(사용자, 2026-10-29 AskUserQuestion): 해법 (a) — 라이트 미리보기 다이어그램 컨테이너에 바탕 `var(--pele-bg)`(`#FAF9F6`)만 추가하고 테두리·반경은 두지 않는다. 미리보기가 내보내기와 일치하고, 016 REQ-005 라이트 절의 배경 부분을 개정한다. 측정 우선 의무는 유지된다(적용 전에 실제 라이트 바탕을 측정해 기록).
- 기각: 해법 (b) — 라이트에서만 SVG의 `--_bg`를 실측 바탕으로 재선언. `--_bg`는 라벨 외에 C4 외부 노드 채움 등도 쓰므로 그 요소들의 색이 테마에 따라 달라져 016 REQ-004·017 REQ-007(테마 무관)과 충돌하고, 미리보기와 내보내기가 어긋난다(plan-audit review-1 D2).

## 9. 내보내기 경로 실측

- HTML(`exportHtml.ts:48` → `replaceMermaidPlaceholders`, :104-119), PDF(`generateHtmlContent`, :82-93 → 같은 함수), DOCX(`exportDocx.ts:136` `renderFenceDiagramPng` → `readPeleThemeValues('light')`, :95)가 모두 `renderExportDiagram`(`exportUtils.ts:32-42`) 한 지점을 지난다(grep 확인). 이 함수는 정화된 SVG에 `resolveDiagramColors`로 `var(--pele-…)`를 리터럴로 치환한다.
- 따라서 모양 톤을 이 한 지점에서 주입하면 세 형식이 같은 톤을 받는다. 주입 값이 `var(--pele-…)` 형태라면 `resolveDiagramColors`보다 먼저 넣어 기존 치환 경로가 리터럴로 바꾸게 하면 0-잔여 계약(015 AC-020)을 그대로 지킨다.

## 10. 테스트 영향 실측

- `src/test/diagramRenderer.test.ts:149-176` — pele 선언 23개 묶음·23개 값 표를 단정한다. 새 토큰 추가 시 24개로 갱신 필요.
- `src/test/exportDiagram.test.ts:37-40` `VAR_NAMES`(23개 이름, :36 주석 "23개")와 `:288` 가드(`Object.keys(THEME.light)` = `VAR_NAMES`) — 같은 이유로 24개로 갱신 필요(plan-audit review-1 D3로 추가).
- `PELE_THEME_VARS`(`diagramRenderer.ts:231-237`)를 쓰는 곳은 이 파일뿐이다(grep). 이름을 더하면 탐침이 새 값을 읽는다.
- e2e 2종(`e2e/diagram-preview-behavior.spec.ts`, `e2e/diagram-export-colors.spec.ts`)의 노드 색 단정은 첫 `.pele-node rect`를 읽고, 픽스처는 전부 사각형 노드(`A[시작] --> B[끝]` 등)다 — 판단·시작/끝 모양이 없어 이번 변경으로 깨지지 않는다(grep 확인). 회귀 감시로 남는다.
- `src/test/exportDiagram.test.ts:125`에 `classDef`·`style` 보존 픽스처가 있고 :331에서 보존을 단정한다 — 판단 노드가 없으므로 영향 없음, 회귀 감시.
