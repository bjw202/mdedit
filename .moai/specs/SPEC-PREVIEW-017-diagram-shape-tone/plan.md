# SPEC-PREVIEW-017 plan.md — 구현 계획 (Tier M)

## §A Context

- 016 고정 팔레트 위에 모양 기반 톤 2종(판단·시작/끝)을 더하고, 라이트 미리보기의 간선 라벨 이음매를 고친다. 근거·pele 실측·대비 수치는 `research.md`.
- 작업 위치: 워크트리 `.claude/worktrees/preview-017-diagram-tone`, 브랜치 `WT-diagram-tone`, 기준 커밋 4bef707(origin/main = v0.18.0 + .gitattributes). run 단계도 이 워크트리에서 이어간다.
- 이 워크트리에는 `node_modules`가 없다. run 단계 첫 작업은 `npm ci`다.

### 검증된 코드 앵커 (HEAD 4bef707)

| 앵커 | 내용 |
|------|------|
| `src/styles/mdedit-tokens.css:92-124` | 고정 pele `:root` 블록(헤더 주석 92-100, 선언 101-123, 23개) — 새 토큰 추가 위치 |
| `src/index.css:290-300` | `.preview-content .mermaid-container` 기본 규칙(:290)과 다크 종이 카드(:296-300) — 모양 톤 규칙·라벨 이음매 규칙 부착점 |
| `src/styles/mdedit-components.css:289` | `.md-previewpane { background: var(--md-bg) }` — 라이트 이음매 가설의 바탕 출처(측정 전) |
| `src/lib/diagram/diagramRenderer.ts:231-237` | `PELE_THEME_VARS`(23개 이름, 사용처는 이 파일뿐) |
| `diagramRenderer.ts:247-264` | `readPeleThemeValues(theme)` 탐침 |
| `diagramRenderer.ts:268-306` | `resolvePeleVars`·`resolveDiagramColors` + `@MX:WARN`(0-잔여) |
| `src/lib/export/exportUtils.ts:32-42` | `renderExportDiagram` — HTML·PDF·DOCX 공통 지점(주입 위치 후보) |
| `src/lib/export/exportUtils.ts:107-113,295-301` | 내보내기 컨테이너 바탕 `#FAF9F6` 상수·다크 카드 — 유지 |
| `src/lib/export/exportHtml.ts:48,82-93,104-119` | HTML·PDF가 `replaceMermaidPlaceholders` → `renderExportDiagram` |
| `src/lib/export/exportDocx.ts:95,134-136` | DOCX: `readPeleThemeValues('light')` → `renderExportDiagram` |
| `src/test/diagramRenderer.test.ts:123-176` | `EXPECTED_PALETTE`·23개 묶음·23개 값 단정 — 24개로 갱신 |
| `src/test/exportDiagram.test.ts:36-40,61,288` | `VAR_NAMES` 23개 이름(:37-40), CSS 표 모킹(:61), 이름 일치 가드(:288) — 24개로 갱신 |

## §B Known Issues (위험·미결)

- **토큰 이름 공간**: `--pele-*`는 pele가 읽는 이름 공간이다. pele 1.10.0은 `--pele-decision-border`를 읽지 않는다(grep 0회). pele를 올리면 충돌 여부를 다시 확인해야 한다(버전 고정 1.10.0이라 이번 범위에서는 위험 낮음).
- **AI 카드 미니 미리보기**: `.preview-content` 밖에서 렌더되면 미리보기 CSS가 닿지 않는다. 범위를 넓히지 않고 사실만 기록한다(acceptance 경계 사례).
- **016 테스트 개수 단정 (반드시 깨짐 → 24개로 갱신할 대상, 결함 아님)**:
  - `src/test/diagramRenderer.test.ts:149-176` — pele 선언 23개 묶음·23개 값 표.
  - `src/test/exportDiagram.test.ts:37-40`(`VAR_NAMES` 23개 이름, :36 주석 "23개") + `:288`(`Object.keys(THEME.light)`가 `VAR_NAMES`와 같아야 함) — `decision-border`를 더해 24개로.
- **내보내기 대체 리터럴 표류**: 단위 테스트는 `readPeleThemeValues`를 CSS 표로 모킹한다(`src/test/exportDiagram.test.ts:61`). 그래서 `PELE_THEME_VARS`에서 이름이 빠지거나 주입부 대체 리터럴이 확정 토큰 값과 어긋나도 기존 테스트가 통과할 수 있다. 가드: `:root` 이름 집합 = `PELE_THEME_VARS` 집합(AC-005), 대체 리터럴 = CSS 토큰 값(AC-006, 015 AC-004 글꼴 바이트 동일과 같은 방식).
- **라벨 이음매 해법 — 확정(사용자 결정 2026-10-29, AskUserQuestion)**: 해법 (a). 라이트 미리보기 다이어그램 컨테이너에 `background-color: var(--pele-bg)`만 추가하고 테두리·반경은 두지 않는다. 미리보기가 이미 그렇게 칠하는 내보내기(`exportUtils.ts:109`)와 같아지고 pele 사적 변수 `--_bg`는 건드리지 않는다. 016 REQ-005 라이트 절의 배경 부분을 개정한다(spec.md "다른 SPEC 개정" 표).
  - 측정 우선은 그대로다: 적용 전에 라이트 실제 바탕과 라벨 채움을 측정해 기록한다(AC-008). 측정이 가설(라이트 바탕 `#f2f2f3`)과 다른 원인을 보이면 기록하되, 해법 (a)의 결과 상태(라이트 컨테이너 바탕 `#FAF9F6`, 테두리·반경 없음)는 바꾸지 않는다.

## §C Pre-flight (run 시작 점검)

1. `git -C <worktree> rev-parse --short HEAD`가 4bef707 또는 그 후손이고 브랜치가 `WT-diagram-tone`인지 확인.
2. `npm ci` 실행(워크트리에 `node_modules` 없음). `package.json`의 pele가 1.10.0인지 확인.
3. §A 앵커 행 번호 스팟 체크 — 어긋나면 SPEC을 고치지 말고 재측정 값을 progress.md에 기록.
4. 변경 전 기준값 측정: 클러스터 톤(AC-002)과 라벨 이음매(AC-008) 계산 스타일을 라이트·다크에서 기록.

## §D Constraints

- 작성자 `classDef`·`class`·`style` 우선, `!important` 금지.
- 라벨 문구·노드 순서 기반 착색 금지. 선택자는 `pele-shape-*` 클래스만.
- 0-잔여: 내보낸 SVG에 `var(--pele-` 0건(015 AC-020).
- 글꼴 리터럴 계약(015 AC-004) 무변경. 다크 블록에 pele 재선언 금지(016).
- 기각 대안(꿀색 `#B78511` 테두리, series-8 재사용, 데이터·클러스터 착색)은 research.md에만 남기고 토큰·코드·API에 두지 않는다.

## §E Self-Verification (게이트)

- vitest + tsc + eslint + Playwright(webkit) + cargo test(회귀).
- 관찰 출력은 progress.md §E.2에 기록한다. AC-008 측정 기록은 수정 커밋보다 먼저 남긴다.

## §F Milestones

배치 원칙: 바뀔 가능성이 가장 큰 결정(새 토큰 값, 미리보기 덮어쓰기 기제)을 M1에, 내보내기 반영을 M2에, 라벨 이음매(해법 (a) 확정, 측정 선행)를 M3에, 기계적 테스트 정렬과 기록을 M4에 둔다.

### M1 — 토큰 + 미리보기 모양 톤 (Priority High)

- [MODIFY] `src/styles/mdedit-tokens.css` — `:root` pele 블록에 `--pele-decision-border` 1줄(후보 `#8A6410`, run에서 대비 3:1 이상·series-4 색상 계열 확인 후 확정). 헤더 주석에 17 근거 한 줄.
- [MODIFY] `src/index.css` — `.mermaid-container` 근처에 모양 톤 규칙을 `/* SPEC-PREVIEW-017 shape-tone BEGIN */` … `/* SPEC-PREVIEW-017 shape-tone END */` 표지 안에 둔다(AC-003·004 grep 범위). 채택 기제 = 노드 `g`에서 사적 변수 재선언(research.md §6 방식 A):
  - `.pele-node.pele-shape-diam { --_s: var(--pele-surface-alt); --_b: var(--pele-decision-border); }`
  - `.pele-node.pele-shape-stadium { --_b: var(--pele-accent); stroke-width: 1.5px; }`
  - 이유: pele 모양은 `fill="var(--_s)" stroke="var(--_b)"` 표현 속성으로 칠하고 사적 변수는 SVG 루트 인라인 style에서 정의되므로, 노드 `g`의 재선언이 그 노드만 바꾼다. 작성자 스타일은 모양 요소 자신의 인라인 선언이라 상속 값보다 항상 이긴다 — `!important` 불필요. `stroke-width`는 상속 속성이라 `g`에 두면 모양이 물려받고 작성자 값이 있으면 그 값이 이긴다.
  - 범위: `.preview-content` 아래로 한정할지, 앱 전체 `.pele` SVG에 둘지는 run에서 AI 카드 미니 미리보기 확인 결과에 맞춰 정한다(기본: 미리보기 범위, 기록 필수).
- [NEW] `e2e/diagram-shape-tone.spec.ts` — AC-001·002·003(미리보기)·004·007 계산 스타일 단정.

### M2 — 내보내기 동일 톤 (Priority High)

- [MODIFY] `src/lib/diagram/diagramRenderer.ts` — `PELE_THEME_VARS`에 `--pele-decision-border` 추가(탐침이 값을 읽도록, 23→24). 주석 갱신.
- [MODIFY] `src/lib/export/exportUtils.ts` — `renderExportDiagram`에서 `resolveDiagramColors` 호출 **전에** 판단·stadium 노드 `g`에 인라인 사용자 정의 속성을 넣는다(예: `--_s:var(--pele-surface-alt,<리터럴>);--_b:var(--pele-decision-border,<리터럴>)`, stadium은 `--_b:var(--pele-accent,…);stroke-width:1.5px`). 기존 치환 경로가 `var(--pele-…)`를 리터럴로 바꾸므로 0-잔여가 자동 유지되고, jsdom처럼 탐침이 빈 표를 돌려줘도 대체 리터럴로 채워진다. 이 한 지점으로 HTML·PDF·DOCX가 모두 덮인다(grep 확인).
  - 대안(기각 아님, run 선택 가능): SVG 안에 같은 규칙의 `<style>` 1개 주입. 선택 시 근거를 progress.md에 기록.
- [MODIFY] `src/test/exportDiagram.test.ts` — AC-003(내보내기 작성자 색 보존)·006·007(내보내기) 단정. `VAR_NAMES`(:37-40)에 `decision-border` 추가(23→24, :36 주석 갱신)로 :288 가드 유지. 빈 표 경로에서 대체 리터럴 = CSS 토큰 값 단정 추가(AC-006).

### M3 — 간선 라벨 이음매 (Priority Medium, 측정 우선, 해법 (a) 확정)

- 측정(수정 전): 라이트·다크 미리보기에서 `.mermaid-container` 계산 바탕(투명이면 첫 불투명 조상)과 `.pele-edge-label rect` 계산 `fill` → progress.md §E.2.
- [MODIFY] `src/index.css` — `.preview-content .mermaid-container`(:290)에 테마 무관 `background-color: var(--pele-bg)` 추가(테두리·반경은 기존 다크 규칙 :296-300에만). 다크 규칙의 바탕 선언은 중복이 되므로 정리 여부를 run에서 판단(결과 상태 동일).
- [MODIFY] `e2e/diagram-shape-tone.spec.ts` — AC-008 이음매 단정(라이트 바탕 `rgb(250, 249, 246)`·테두리/반경 `0px`, 두 테마 라벨 fill = 컨테이너 바탕).
- [MODIFY] `src/components/preview/PreviewRenderer.tsx` 또는 `src/index.css` 다크 카드 주석 — 016 "라이트 무카드" 근거 주석이 있으면 "라이트는 바탕만, 테두리·반경 없음"으로 문구 갱신(주석 전용).
- [EXISTING] `src/lib/export/exportUtils.ts:107-113` — 내보내기 이음매 상수 유지.

### M4 — 테스트 정렬 + 기록 (Priority Low)

- [MODIFY] `src/test/diagramRenderer.test.ts` — 23→24 개수 단정(:149-159), `EXPECTED_PALETTE`(:123-)에 새 토큰, 대비 ≥3.0 계산, HSL hue 36.9°~46.9° 계산, 값 ≠ `#B78511`·`#96562F`·`#C08A28`, `:root` `--pele-*` 이름 집합 = `PELE_THEME_VARS` 집합(AC-005).
- [MODIFY] `src/test/exportDiagram.test.ts:36-40,288` — M2에서 처리(23→24), 여기서는 최종 실행 확인.
- [EXISTING] `src/test/export.test.ts` — 컨테이너 바탕·라이트 무테두리 단정 회귀 감시(무변경 예상; 해법 (a)는 미리보기 CSS만 바꾸고 내보내기는 이미 `#FAF9F6`).
- [EXISTING] `e2e/diagram-preview-behavior.spec.ts`, `e2e/diagram-export-colors.spec.ts` — 픽스처가 사각형 노드뿐이고 라이트 `0px` 테두리 단정은 내보내기 쪽이라 무변경 예상, 실행으로 회귀 확인.
- [MODIFY-DOC] `.moai/specs/SPEC-PREVIEW-016-pele-fixed-palette/spec.md`·`acceptance.md`·`spec-compact.md` — 개정 포인터만(spec.md "다른 SPEC 개정" 표 기준: REQ-002 표 확장, AC-002 "23개"→24, compact :34 "23값"→24, REQ-005 라이트 배경 개정).

## mx_plan

- `@MX:NOTE`: `src/index.css` 모양 톤 규칙 위(기제와 작성자 우선 이유), `renderExportDiagram` 주입 지점(미리보기와 같은 기제, 치환 전 주입 순서 이유).
- `@MX:WARN`: 기존 `diagramRenderer.ts` 0-잔여 WARN 유지. 주입을 `resolveDiagramColors` 뒤로 옮기면 잔여가 생길 수 있으므로 주입 지점 NOTE에 순서를 명시한다(신규 WARN은 필요 시에만).
- `@MX:ANCHOR`: 신규 없음(`renderExportDiagram` fan_in 2: exportHtml, exportDocx).

## §G Anti-Patterns

- `!important`로 톤을 강제하지 않는다.
- 자식 모양 요소 종류(polygon·rect)를 선택자로 잡지 않는다 — 노드 `g`의 변수 재선언만 쓴다.
- 라벨 문구·`data-id`·`:nth-*`로 톤을 고르지 않는다.
- 측정 없이 라벨 이음매를 고치지 않는다.
- 라이트 컨테이너에 테두리·반경을 더하지 않는다.
- 기각 색을 "예비" 토큰으로 남기지 않는다.

## §H Cross-References

- `research.md` — 외부 근거, pele 실측, 대비 표, 기각 대안, `circle` 제외 근거.
- `SPEC-PREVIEW-016` — 개정 대상 표는 `spec.md` "다른 SPEC 개정".
- `SPEC-PREVIEW-015` — AC-004 글꼴, AC-020 0-잔여.
