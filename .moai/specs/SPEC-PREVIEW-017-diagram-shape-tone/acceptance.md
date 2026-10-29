# SPEC-PREVIEW-017 acceptance.md — 수용 기준 (Tier M)

## 추적성

| AC | REQ | 검증 기법 |
|----|-----|----------|
| AC-PREVIEW017-001 | REQ-PREVIEW017-001 | e2e — 계산 스타일 |
| AC-PREVIEW017-002 | REQ-PREVIEW017-002 | e2e — 계산 스타일 |
| AC-PREVIEW017-003 | REQ-PREVIEW017-003 | e2e(계산 스타일) + unit(내보내기 문자열) + grep |
| AC-PREVIEW017-004 | REQ-PREVIEW017-004 | e2e + grep |
| AC-PREVIEW017-005 | REQ-PREVIEW017-005 | unit — CSS 파싱·대비·색상 계산 |
| AC-PREVIEW017-006 | REQ-PREVIEW017-006 | unit — 내보내기 문자열·동기화 가드 |
| AC-PREVIEW017-007 | REQ-PREVIEW017-007 | e2e + unit |
| AC-PREVIEW017-008 | REQ-PREVIEW017-008 | evidence(측정) + unit + e2e |

계산 스타일 검증 원칙: CSS 캐스케이드와 인라인 style의 우선순위는 jsdom 문자열 검사로 증명되지 않는다. 미리보기 색 단정은 실제 브라우저가 스타일을 계산하는 Playwright(webkit) e2e로 한다. 내보내기 리터럴 출력 단정은 jsdom 문자열 검사로 충분하다.

신규 e2e 파일(이름은 run 단계 확정 가능): `e2e/diagram-shape-tone.spec.ts`. 실행: `npx playwright test e2e/diagram-shape-tone.spec.ts`.

리터럴 기준값: 판단 테두리 후보 `#8A6410` = `rgb(138, 100, 16)`. run 단계가 다른 값으로 확정하면 그 값의 rgb로 AC-001·006 기대값을 갱신하고 갱신 사실을 progress.md에 기록한다(검증 자체를 토큰 자기참조로 바꾸지 않는다).

## 시나리오

### AC-PREVIEW017-001 — 판단 노드 톤 (e2e)

- **Given** `flowchart TD` 안에 `B{판단}` 판단 노드와 사각형 노드가 있는 문서를 미리보기로 연 상태에서,
- **When** 테스트가 `.pele-node.pele-shape-diam`의 모양 요소에 대해 `getComputedStyle`의 `fill`·`stroke`를 읽으면,
- **Then** `fill`은 `rgb(247, 242, 231)`(`#F7F2E7`), `stroke`는 확정 판단 테두리의 리터럴 rgb(후보 기준 `rgb(138, 100, 16)`)이다. 같은 다이어그램의 사각형 노드는 `rgb(238, 243, 247)`/`rgb(151, 164, 177)` 그대로다.

### AC-PREVIEW017-002 — 시작/끝 노드 톤과 나머지 모양 유지 (e2e)

- **Given** `A([시작])`, `Z([끝])`(stadium), `C[처리]`(rect), `D[(저장소)]`(cyl), `E((원))`(circle), 서브그래프 1개가 있는 문서를 미리보기로 연 상태에서,
- **When** 각 노드 모양 요소와 클러스터 사각형의 계산 `fill`·`stroke`·`stroke-width`를 읽으면,
- **Then** stadium은 `fill` `rgb(238, 243, 247)`, `stroke` `rgb(58, 86, 115)`, `stroke-width` `1.5px`이고, rect·cyl·circle은 `fill` `rgb(238, 243, 247)`·`stroke` `rgb(151, 164, 177)`이며, 클러스터 사각형의 계산 `fill`·`stroke`는 run 단계가 변경 전 HEAD(4bef707)에서 같은 문서로 측정해 progress.md §E.2에 기록한 기준값과 같다. 작성자 스타일이 없는 이 문서에서 노드 채움·테두리 조합은 3종(기본·판단·시작/끝) 이하다.

### AC-PREVIEW017-003 — 작성자 스타일 우선 (e2e + unit + grep)

- **Given** 판단 노드에 `classDef hot fill:#ffeeee,stroke:#cc0000,stroke-width:3px` + `class B hot`, 시작/끝 노드에 `style A fill:#ddeeff,stroke:#004488`, 다른 판단 노드에 채움만 지정한 `classDef warm fill:#fff0cc`가 적용된 문서가 주어지고,
- **When** 미리보기에서 해당 모양 요소의 계산 스타일을 읽고(e2e), 같은 문서를 HTML로 내보내 SVG 문자열을 검사하고(unit, `src/test/exportDiagram.test.ts`), 톤 규칙 블록과 내보내기 주입 파일에서 `!important`를 세면,
- **Then** 미리보기 계산값은 B `fill` `rgb(255, 238, 238)`·`stroke` `rgb(204, 0, 0)`·`stroke-width` `3px`, A `fill` `rgb(221, 238, 255)`·`stroke` `rgb(0, 68, 136)`이다. 채움만 지정한 판단 노드는 `fill` `rgb(255, 240, 204)`이고 `stroke`는 판단 테두리 리터럴 rgb다(지정 안 한 속성만 톤으로 채움). 내보낸 SVG에서 해당 모양 요소의 인라인 `style`에 작성자 값(`fill:#ffeeee`, `stroke:#cc0000`, `fill:#ddeeff`)이 그대로 있다. 그리고 다음 두 명령의 출력이 모두 `0`이다:
  - `awk '/shape-tone BEGIN/,/shape-tone END/' src/index.css | grep -c '!important'` (톤 규칙은 `/* SPEC-PREVIEW-017 shape-tone BEGIN */` … `/* SPEC-PREVIEW-017 shape-tone END */` 표지 안에 둔다)
  - `grep -c '!important' src/lib/export/exportUtils.ts` (HEAD 4bef707 기준 0건)

### AC-PREVIEW017-004 — 문구·순서 기반 추론 금지 (e2e + grep)

- **Given** 라벨이 각각 `{실패?}`, `{yes}`, `{아니오}`인 판단 노드 3개와 라벨이 다른 stadium 노드 2개가 서로 다른 위치(첫 노드·중간·마지막)에 있는 문서가 주어지고,
- **When** 각 노드 모양의 계산 `fill`·`stroke`를 읽으면,
- **Then** 판단 노드 3개의 값이 모두 같고, stadium 2개의 값이 서로 같다. 그리고 `awk '/shape-tone BEGIN/,/shape-tone END/' src/index.css | grep -cE 'nth-|data-id|:has\(|:contains'`의 출력이 `0`이고, 내보내기 주입 코드(`renderExportDiagram` 안 주입부)는 노드 선택에 `pele-shape-*` 클래스만 쓴다(`textContent`·`innerText`·`data-id`·인덱스 미사용 — 코드 리뷰 증거를 progress.md에 기록).

### AC-PREVIEW017-005 — 판단 테두리 토큰 (unit)

- **Given** `src/styles/mdedit-tokens.css` 본문, `src/lib/diagram/diagramRenderer.ts`의 `PELE_THEME_VARS`와 글꼴 상수가 주어지고,
- **When** `src/test/diagramRenderer.test.ts`가 `--pele-*` 선언을 파싱하면,
- **Then** 다음이 모두 성립한다.
  - `:root` pele 묶음은 연속 24개, 파일 전체도 24개, 다크 블록은 0개다.
  - `--pele-decision-border`는 `:root`에 리터럴로 정확히 1회 있고 `var(` 체이닝이 없다.
  - 테스트가 계산한 그 값과 `#F7F2E7`의 WCAG 대비는 3.0 이상이다.
  - 테스트가 계산한 그 값의 HSL hue는 36.9°~46.9°(series-4 `#B78511` 41.9° ± 5°) 안이다.
  - 값(대소문자 무시)은 `#B78511`·`#96562F`·`#C08A28`이 아니다.
  - `:root`의 모든 `--pele-*` 이름 집합이 `PELE_THEME_VARS` 집합과 같다(빠진 이름 0, 남는 이름 0).
  - 나머지 23개 값과 글꼴 바이트 동일 단정(015 AC-004, 016 AC-003)은 기존대로 통과한다.

### AC-PREVIEW017-006 — 내보내기 동일 톤·0-잔여·값 동기화 (unit)

- **Given** 판단·stadium·rect 노드와 작성자 `classDef`가 섞인 문서가 주어지고,
- **When** `src/test/exportDiagram.test.ts`가 HTML 내보내기(`replaceMermaidPlaceholders` 경유), PDF용 `generateHtmlContent`, DOCX용 `renderExportDiagram`(`readPeleThemeValues('light')` 값) 결과의 SVG를 검사하고, 탐침이 빈 표를 돌려주는 경우(대체 리터럴 경로)도 따로 검사하면,
- **Then** 다음이 모두 성립한다.
  - 세 경로 모두 판단 노드에 `#F7F2E7` 채움과 판단 테두리 리터럴이, stadium 노드에 `#3A5673` 테두리와 `1.5px` 두께가 담겨 있다.
  - SVG의 `var(--pele-` 개수는 0이고, 작성자 색은 보존된다.
  - 빈 표 경로에서도 같은 리터럴이 나온다 — 주입부의 대체 리터럴 각각이 `mdedit-tokens.css` `:root`의 대응 토큰 값과 같다(테스트가 CSS를 파싱해 비교, 015 AC-004 글꼴 바이트 동일 계약과 같은 방식).
  - 기존 `VAR_NAMES` 가드(`src/test/exportDiagram.test.ts:37-40,288`)는 `decision-border`를 포함한 24개 이름으로 통과한다.
  - 세 경로가 `renderExportDiagram` 한 지점을 지난다는 사실을 `git grep -n renderExportDiagram -- src/lib` 출력으로 함께 기록한다.

### AC-PREVIEW017-007 — 테마 무관 (e2e + unit)

- **Given** AC-PREVIEW017-001·002 문서가 미리보기에 열린 상태에서,
- **When** 라이트에서 판단·stadium 모양의 계산 `fill`·`stroke`·`stroke-width`를 읽고 테마를 다크로 바꿔 다시 읽으면(e2e), 그리고 같은 문서를 `theme=light`·`theme=dark`로 내보내면(unit),
- **Then** 라이트와 다크의 계산값이 같고, 두 내보내기의 다이어그램 톤 문자열이 같다. 016 재렌더 금지 가드(`src/test/PreviewRenderer.test.tsx`의 테마 토글 테스트)는 계속 통과한다.

### AC-PREVIEW017-008 — 간선 라벨 이음매 (evidence + unit + e2e)

- **Given** 라벨 있는 간선(`A -->|예| B`)을 가진 다이어그램이 라이트·다크 미리보기에 각각 열린 상태에서,
- **When** run 단계가 수정 전에 (1) `.mermaid-container`의 계산 `background-color`와, 투명이면 첫 불투명 조상의 계산 바탕, (2) `.pele-edge-label rect`의 계산 `fill`을 측정해 명령과 출력을 progress.md §E.2에 기록하고, 해법 (a)를 적용한 뒤 같은 측정을 e2e로 단정하면,
- **Then** 다음이 모두 성립한다.
  - 수정 전 기록에 두 테마의 측정값과 확정된 원인이 있다.
  - 수정 후 라이트 미리보기 `.mermaid-container`의 계산 `background-color`는 `rgb(250, 249, 246)`이고 `border-top-width`는 `0px`, `border-top-left-radius`는 `0px`이다.
  - 수정 후 두 테마 모두 라벨 `rect`의 계산 `fill`이 그 뒤 컨테이너의 계산 바탕과 같다(`rgb(250, 249, 246)`).
  - 다크 종이 카드(테두리 `1px`·반경 `3px`)는 그대로다.
  - `src/test/export.test.ts`의 컨테이너 바탕 `#FAF9F6`·라이트 무테두리 단정(016 AC-005·006)은 그대로 통과한다.

## 경계 사례

- 작성자가 채움만 지정하면 테두리는 모양 톤(판단 테두리·액센트)을 받는다 — 지정한 속성만 이긴다(AC-003).
- 작성자 색이 팔레트 값과 같은 16진수여도 보존 대상이다.
- 서브그래프 안 판단 노드: 클러스터 사각형이 이미 `fill="var(--_a)" fill-opacity="0.5"`(surface-alt 반투명)로 칠해지므로 판단 노드 채움과 클러스터 바탕의 차이가 작다 — 판단 노드는 테두리로 구분된다(research.md §4). 범위 변경 없음.
- 블록 다이어그램 등 다른 다이어그램 종류가 같은 `pele-shape-diam`/`pele-shape-stadium` 클래스를 내면 같은 톤을 받는다 — 모양 의미가 같기 때문이다.
- AI 카드 미니 미리보기는 같은 렌더 모듈을 쓰지만 `.preview-content` 밖이면 미리보기 CSS가 닿지 않을 수 있다 — run 단계에서 확인하고, 다르면 progress.md에 사실로 기록한다(범위 확장은 하지 않음).
- 기존 e2e 2종(`e2e/diagram-preview-behavior.spec.ts`, `e2e/diagram-export-colors.spec.ts`)은 사각형 노드만 써서 톤 변경 영향이 없어야 한다. 단, `e2e/diagram-export-colors.spec.ts:162`의 라이트 테두리 `0px` 단정은 내보내기 쪽이라 해법 (a)와 충돌하지 않는다 — 회귀 감시.

## 품질 게이트

- vitest: 신규·수정 테스트 전부 통과.
- tsc: 0 error. eslint: 0 error.
- Playwright(webkit): `e2e/diagram-shape-tone.spec.ts` 및 기존 다이어그램 e2e 통과.
- cargo test: 회귀 0(프런트 전용 변경 확인용).
- 수동: 라이트·다크 미리보기에서 판단·시작/끝 톤과 라벨 이음매 시각 확인 1회.

## Definition of Done

1. AC-PREVIEW017-001..008 전부가 관찰 증거(명령 + 출력)로 PASS.
2. AC-008 측정 기록이 수정 커밋보다 앞서 progress.md §E.2에 있다.
3. 016 문서에 개정 포인터만 추가(spec.md "다른 SPEC 개정" 표 기준).
4. 기각 대안(꿀색 `#B78511` 테두리, series-8 재사용, 데이터·클러스터 착색)은 토큰·코드·API 어디에도 없다.
