# SPEC-PREVIEW-016 acceptance.md — 수용 기준 (Tier M)

## 추적성

| AC | REQ | 검증 기법 |
|----|-----|----------|
| AC-PREVIEW016-001 | REQ-PREVIEW016-001 | unit — CSS 파싱 |
| AC-PREVIEW016-002 | REQ-PREVIEW016-002 | unit — 값 표 대조 |
| AC-PREVIEW016-003 | REQ-PREVIEW016-003 | unit — 글꼴·반경·굵기 |
| AC-PREVIEW016-004 | REQ-PREVIEW016-004 | unit + e2e — 테마 동일성 |
| AC-PREVIEW016-005 | REQ-PREVIEW016-005 | unit + e2e + manual — 다크 카드 |
| AC-PREVIEW016-006 | REQ-PREVIEW016-006 | unit — 내보내기 상수 |
| AC-PREVIEW016-007 | REQ-PREVIEW016-007 | unit — 테마 인자 무관성 |
| AC-PREVIEW016-008 | REQ-PREVIEW016-008 | unit — 재렌더 금지 가드 |
| AC-PREVIEW016-009 | REQ-PREVIEW016-009 | evidence + grep — 개정 기록 |

## 시나리오

### AC-PREVIEW016-001 — 토큰 단일 블록 리터럴 (unit — CSS 파싱)

- **Given** `src/styles/mdedit-tokens.css` 파일 본문이 주어지고,
- **When** 테스트가 텍스트를 파싱해 `--pele-*` 선언의 위치와 값을 세면,
- **Then** `:root` 안에 정확히 하나의 pele 선언 묶음만 존재하고, `[data-theme="dark"]` 블록에는 `--pele-*` 선언이 0개이며, 어떤 `--pele-*` 값에도 `var(--md-` 문자열이 없다.

### AC-PREVIEW016-002 — 팔레트 값 표 대조 (unit — 값 표)

- **Given** 승인된 잉크 앤 허니 기대값 표(고정 23개 토큰 기준)가 테스트 안에 상수로 주어지고,
- **When** 파싱된 `--pele-*` 값을 표와 하나씩 비교하면,
- **Then** 전부 표와 같고, accent == line == `#3A5673`이며, series는 정확히 8개로 `#3168A8` `#C95F3B` `#23997C` `#B78511` `#C76A95` `#7A8A28` `#6E5BC4` `#96562F`와 하나씩 일치한다.

### AC-PREVIEW016-003 — 글꼴·반경·굵기 (unit)

- **Given** 단일 `:root` 블록과 `src/lib/diagram/diagramRenderer.ts`의 `DIAGRAM_FONT_FAMILY`·`DIAGRAM_FONT_FAMILY_MONO` 상수가 주어지고,
- **When** `--pele-font`·`--pele-font-mono` 값을 상수와 비교하면,
- **Then** 글꼴 목록이 바이트 단위로 같고, 반경은 `3px`, 제목·헤딩 굵기(`--pele-title-weight`·`--pele-heading-weight`)는 `600`이다.

### AC-PREVIEW016-004 — 테마 무관 불변식 (unit + e2e)

- **Given** 같은 다이어그램 문서가 주어지고,
- **When** 라이트 테마와 다크 테마에서 각각 렌더해 SVG를 직렬화하면(unit은 값 경로, e2e는 webkit 렌더),
- **Then** 두 직렬화 결과의 색 값이 동일하다. e2e 기법의 산출물은 plan M3의 `e2e/diagram-preview-behavior.spec.ts` 편집이다 — 기존 159-165행 테마 불일치 단정(`dark.fill/stroke !== light.fill/stroke`)의 테마 동일성 전환, 헬퍼 `expectColorsMatchTheme` 프로브의 `--pele-*` 재조준(:92-93), 두 번째 테스트 :181-217의 고정값·테마 동일성 전환(`isSameSvg` 가드 :207-211 보존)을 모두 포함한 결과가 본 AC의 e2e 증거가 된다.

### AC-PREVIEW016-005 — 다크 종이 카드 (unit + e2e + manual)

- **Given** 다크 테마(`data-theme="dark"`)가 활성인 상태가 주어지고,
- **When** 미리보기와 내보낸 HTML에서 다이어그램 컨테이너의 계산 스타일을 검사하면,
- **Then** 배경이 `#FAF9F6`이고 `--pele-border` 테두리와 `--pele-radius` 반경이 있으며, 라이트 테마에서는 카드가 없다 — `getPreviewCss('light')` 출력의 컨테이너 규칙에 카드 배경/테두리/반경 선언이 없음으로 관찰한다. e2e(다크 내보낸 HTML의 카드 계산 스타일)의 산출물은 plan M3의 `e2e/diagram-export-colors.spec.ts` 편집이다 — 고정값 전환과 함께 다크 카드 단정을 추가한 결과가 본 AC의 e2e 증거가 된다. 사람이 다크 화면의 종이 카드를 시각 확인한다(manual 1회).

### AC-PREVIEW016-006 — 내보내기 이음매 상수 (unit)

- **Given** `getPreviewCss('light')`와 `getPreviewCss('dark')` 결과가 주어지고,
- **When** 다이어그램 컨테이너 규칙을 검사하면,
- **Then** 두 테마 모두 컨테이너 배경이 `#FAF9F6`이고 다크 출력에는 카드 테두리·반경 선언이 있다. 검증 기법은 `getPreviewCss` 출력에 대한 문자열 수준 단위 검사다 — 내보낸 HTML 카드 단정은 AC-PREVIEW016-005가, 내보낸 SVG 잔여 0은 AC-PREVIEW016-007가 소유하므로 여기서 중복 단정하지 않는다. PDF 내보내기는 같은 `getPreviewCss` 출력을 소비한다 — `generateHtmlContent`(exportHtml.ts:82)가 그 출력을 :90에서 읽고, 첫 내보내기 경로의 `getPreviewCss` 소비(:57)도 같은 출력을 `buildHtmlDocument`(:60)에 넘긴다 — 그래서 이 단정이 REQ-PREVIEW016-006의 PDF 표면도 함께 커버한다.

### AC-PREVIEW016-007 — 테마 인자 무관성 (unit)

- **Given** 같은 문서(사용자 `classDef`·`style` 색 포함)가 주어지고,
- **When** `theme=light`와 `theme=dark`로 각각 내보내면,
- **Then** 다이어그램 색이 동일하고, 사용자가 직접 쓴 `classDef`·`style` 색은 치환 없이 보존된다.

### AC-PREVIEW016-008 — 재렌더 금지 (unit)

- **Given** 미리보기가 마운트된 상태가 주어지고,
- **When** 테마 토글과 OS 스킴 변경 이벤트를 발생시키면,
- **Then** 기존 재렌더 금지 가드(`src/test/PreviewRenderer.test.tsx:240-297`)가 모두 통과한다 — 같은 SVG 노드, 추가 pele 렌더 호출 0.

### AC-PREVIEW016-009 — 선행 SPEC 개정 기록 (evidence + grep)

- **Given** 015 문서 개정(`spec.md`·`acceptance.md` 폐기 포인터)이 끝난 상태가 주어지고,
- **When** 개정 기록 — 본 SPEC `spec.md`의 "다른 SPEC 개정" 표(기록 위치) — 를 읽고, tracked 파일에 `git grep -in '#c08a28' -- ':!.moai/specs'`를 실행하면,
- **Then** 폐기 절 목록(REQ-PREVIEW015-008 1·2·3번 불릿, REQ-PREVIEW015-013 테마 추종 절, AC-011 e2e, AC-015, AC-020 기대값 표)과 유지 계약(AC-004, AC-020 zero-residue·사용자 색, AC-011 재렌더 금지)이 본 SPEC `spec.md` "다른 SPEC 개정" 표에 있고, grep 결과는 tracked 소스·설정·문서 중 `.moai/specs/`(의사결정 기록) 제외 0건이다.

## 경계 사례

- 사용자 `classDef`·`style`이 팔레트 색과 같은 16진 값을 쓸 때 — 값이 같아도 사용자 색은 치환 대상이 아니다(보존).
- AI 카드 미니 렌더·프리셋 검증 — 같은 다이어그램 모듈을 쓰므로 고정 팔레트가 자동 적용된다(015 단일 모듈 아키텍처). 카드 규칙은 미리보기·내보내기 경로에만 둔다.
- `src/test/export.test.ts:135-148`의 `getPreviewCss` 기존 단정 — 일반형이라 무변경이며 회귀 감시로 남는다.
- 다크에서 수식(`foreignObject.pele-math`) — 015 범위로 이번 변경 대상이 아니지만, 카드 배경 위 가독성은 AC-005 manual 확인이 함께 본다.

## 품질 게이트

- vitest: 신규·수정 테스트 전부 통과(단일 블록 루프 전환 포함).
- tsc: 0 error. eslint: 0 error.
- Playwright(webkit): e2e(테마 동일성·다크 카드) 통과.
- cargo test: 회귀 0.
- 수동: 다크 종이 카드 시각 확인 1회(AC-005).

## Definition of Done

1. AC-PREVIEW016-001..009 전부가 관찰 증거(명령 + 출력)로 PASS.
2. MX 계획 이행 — `mdedit-tokens.css` 헤더 `@MX:NOTE`, `PreviewRenderer.tsx:18` 문구 재작성, 신규 ANCHOR/WARN 없음 확인.
3. 015 개정 기록 존재(폐기 포인터) + `#C08A28` 잔여 0 — tracked 소스·설정·문서 중 `.moai/specs/`(의사결정 기록) 제외(`git grep -in '#c08a28' -- ':!.moai/specs'`).
4. progress.md §E.2에 관찰 증거 기록 완료.
