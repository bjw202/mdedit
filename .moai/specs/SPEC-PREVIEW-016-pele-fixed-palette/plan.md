# SPEC-PREVIEW-016 plan.md — 구현 계획 (Tier M)

## §A Context

- pele 1.10.0은 다이어그램 팔레트를 `--pele-*` CSS 변수로 읽는다. `src/styles/mdedit-tokens.css`가 이 블록을 `:root`(92-123행, `var(--md-…)` 체이닝)와 `[data-theme="dark"]`(162-186행) 두 곳에 선언해 다이어그램 색이 앱 테마를 따라간다. 이 결함을 디자인 확정(2026-10-28, 잉크 앤 허니 고정)으로 닫는다.
- 내보내기 이음매 `getPreviewCss`(`src/lib/export/exportUtils.ts:79,107-109`)는 앱 배경 3항 선택을 미러링한다. 고정 팔레트에서는 `#FAF9F6` 상수가 된다.
- 승인 경위: Phase 8 기획 제안 DP1 게이트 Proceed(2026-10-28), Tier M. 기획 입력은 `.moai/cache/spec-preview-016-proposal.md`.

### [HARD] 환경 전제 — run 단계는 origin/main 기반 브랜치에서

- 로컬 작업 트리는 v0.16.1(pre-pele)이다. pele이 들어온 v0.17.0과 이후 기준으로 작업해야 하므로, run 단계 분기는 반드시 origin/main에서 만든다.
- pele 사실 확인은 작업 트리 `src/`를 읽지 말고 `git show origin/main:<path>`로만 한다.
- 본 계획의 모든 행 앵커는 origin/main 블롭 39c39e9 기준으로 검증됐다.

### 검증된 코드 앵커 (origin/main 39c39e9)

| 앵커 | 내용 |
|------|------|
| `src/styles/mdedit-tokens.css:92-123` | pele `:root` 블록(주석 92-99, 선언 100-122; 19개 변수가 `var(--md-…)` 체이닝, 리터럴은 굵기 600 — `--pele-title-weight` 111, `--pele-heading-weight` 112 — 과 글꼴·글꼴-mono 121-122) |
| `src/styles/mdedit-tokens.css:162-186` | 다크 블록 안의 pele 부분(주석 162, 선언 163-185) — 삭제 대상은 162-185행이고 186행 `}`는 다크 블록 자체의 닫는 중괄호라 보존 |
| `src/styles/mdedit-tokens.css:17,127` | `--md-bg` 라이트 `#f2f2f3` / 다크 `#191b1d` (현 이음매가 미러링하는 값) |
| `src/styles/mdedit-tokens.css:78` | `--md-radius-sm: 3px`, root 전용 → 테마 무관 → 리터럴 반경 고정은 값을 보존 |
| `src/lib/diagram/diagramRenderer.ts:10,12` | `DIAGRAM_FONT_FAMILY` / `DIAGRAM_FONT_FAMILY_MONO` 리터럴(CSS와 바이트 동일 — AC-004 계약) |
| `diagramRenderer.ts:231-237` | `PELE_THEME_VARS`(23개 이름) |
| `diagramRenderer.ts:247-264` | `readPeleThemeValues(theme)` 탐침 |
| `diagramRenderer.ts:266-293` | `resolvePeleVars` + `@MX:WARN`(0-잔여 계약, 015 AC-020) |
| `src/components/preview/PreviewRenderer.tsx:18` | `@MX:NOTE`(테마 추족 근거 주석 — 고정화 후 문구 재작성, 주석 전용) |
| `src/lib/export/exportUtils.ts:79,107-109` | `getPreviewCss(theme)`; 이음매 주석 107-108 + `mermaidBg` 3항 선택(109) |
| `src/lib/export/exportHtml.ts:104-119` | `replaceMermaidPlaceholders(html, theme)`; 112행 `readPeleThemeValues(theme)` |
| `src/lib/export/exportDocx.ts:95` | `readPeleThemeValues('light')` — DOCX는 이미 라이트 고정, 변경 없음 |
| `src/index.css:290,328` | `.preview-content .mermaid-container` 규칙(카드 규칙 부착점 :290) |
| `readPeleThemeValues` fan_in | 2(exportDocx:95, exportHtml:112) — `@MX:ANCHOR` 문턱 3 미만 |

### 테스트 앵커 (변경 영향)

| 앵커 | 영향 |
|------|------|
| `src/test/diagramRenderer.test.ts:105-126,128-141` | 이중 블록 루프(`[':root','[data-theme="dark"]']`)가 고정화에서 깨짐 → 단일 `:root`로 교체 |
| `src/test/exportDiagram.test.ts:36-60,296-303,318-319` | 변경 대상 — `THEME.light/dark` 표·모킹 정의(36-60), 6-조합 행렬 combos(296-303), 기대값 소비 지점(318-319) → 고정 팔레트 표로. 무변경 carve-out: 397-408(탐침 probe 테스트) |
| `e2e/diagram-preview-behavior.spec.ts:159-165` | 변경 대상 — 테마 불일치 단정(160-161행 `dark.fill/stroke !== light.fill/stroke`)이 고정 팔레트에서 반드시 깨짐 → 테마 동일성 단정으로 전환(M3) |
| `e2e/diagram-preview-behavior.spec.ts:92-93,126-138` | 변경 대상 — `expectColorsMatchTheme` 보조기(:126-138)의 프로브(`readNodeColors` 내 :92-93)가 계산 `var(--md-surface)`/`var(--md-border-strong)`을 읽는다 — REQ-PREVIEW016-001이 이 pele→md 체이닝을 제거하므로 `--pele-surface`/`--pele-border`(또는 고정 리터럴)로 재조준한다(호출 지점 :150·:154·:164·:171·:176·:215 전체가 이 프로브에 의존) |
| `e2e/diagram-preview-behavior.spec.ts:181-217` | 변경 대상 — 두 번째 테스트 "다크 테마로 시작하면…": :203(체이닝 동일 단정 `first.fill === first.token`, 프로브 :192 `var(--md-surface)`)과 :215-216(헬퍼 호출 + `light.fill !== first.fill` 테마 차이 단정)이 고정 팔레트에서 반드시 깨짐 → 고정값·테마 동일성 단정으로 전환(M3). `isSameSvg` 가드(:207-211)는 보존 |
| `e2e/diagram-export-colors.spec.ts:36-37,85-94,119-127` | 변경 대상 — 이중 블록 상수(36-37), 테마별 pele→md 연결 단정 루프(85-94, 루프 종료 95), 내보낸 SVG 테마값 단정(119-127)이 단일 `:root` 리터럴화에서 깨짐 → 고정값 단정으로 전환(M3) |
| `e2e/mermaid-subgraph-label.spec.ts`, `e2e/markdown-render.spec.ts` | 무변경 — 테마 색 단정 없음(origin/main 실측 grep, halo `fill="none"` 등 구조 전용) |
| `src/test/PreviewRenderer.test.tsx:240-297` | 테마 토글 재렌더 금지 가드 3건 — 무변경 생존 |
| `src/test/export.test.ts:135-148` | `getPreviewCss` 단정이 일반형 → 필수 변경 없음 |

## §B Known Issues (위험)

- **다크 카드 회귀**: `src/index.css:290`의 카드 규칙을 다크 스코프로 바꾸면 라이트 경로(미리보기·내보내기·프리셋) 회귀가 날 수 있다. 라이트 무카드 기본값(REQ-PREVIEW016-005)과 함께 회귀 테스트로 감시한다.
- **테마 가정 테스트 파손**: `diagramRenderer.test.ts:105-126,128-141`의 이중 블록 루프는 고정화에서 반드시 깨진다 — 결함이 아니라 교체 대상(단일 `:root`). `exportDiagram.test.ts`의 6조합 표도 같다. e2e도 같은 부류다 — `e2e/diagram-preview-behavior.spec.ts`에서는 :159-165(테마 불일치 단정), `expectColorsMatchTheme` 보조기의 프로브(:92-93 — `var(--md-surface)`/`var(--md-border-strong)`을 `--pele-*`로 재조준), 두 번째 테스트 :181-217(:203 체이닝 동일 단정, :215-216 헬퍼+테마 차이 단정)이 전부 교체 대상이고, `e2e/diagram-export-colors.spec.ts:36-37,85-94,119-127`(이중 블록 읽기·테마별 연결 단정)도 같다. 전부 "깨진 테스트 = 버그"로 해석해 되돌리지 않는다.
- **015 문서 개정 위치**: 로컬 트리의 015 문서는 구버전이다. 폐기 포인터 편집은 origin/main 기반 브랜치에서만 한다.

## §C Pre-flight (run 시작 점검)

1. 브랜치가 origin/main 기반인지 확인 — `git merge-base --is-ancestor origin/main HEAD` 또는 분기 시점 로그.
2. `package.json`의 pele가 1.10.0 고정인지 확인.
3. 앵커 유효성 스팟 체크 — `git show origin/main:src/styles/mdedit-tokens.css` 등으로 §A 표의 행 번호가 유효한지 재확인(이후 커밋으로 어긋났으면 본 SPEC을 정정하지 말고 앵커 재측정 기록).
4. pele mock/`.mockup`의 accent·surface 소비 검증 — 제안 배제 항목 5(run 단계 오픈 아이템, plan 막는 항목 아님).

## §D Constraints

- pele 1.10.0 고정(1.12.0 상승은 범위 밖).
- AC-004 글꼴 계약: CSS 리터럴 `--pele-font`·`--pele-font-mono`는 `DIAGRAM_FONT_FAMILY`·`DIAGRAM_FONT_FAMILY_MONO`와 바이트 동일.
- 0-잔여 치환 계약(015 AC-020 유지): 내보낸 SVG에 `var(--pele-` 잔여 0.
- `--md-*` 토큰 무변경. 사용자 `classDef`·`style` 색 보존.
- 015 문서 개정은 폐기 포인터만 — 015 본문·REQ 문구 재작성 금지.

## §E Self-Verification (게이트)

- 검증 게이트: vitest + tsc + eslint + Playwright(webkit) + cargo test(회귀).
- 각 AC의 검증 기법은 `acceptance.md` 기준이며, 관찰 출력은 progress.md §E.2에 기록한다.
- AC-PREVIEW016-005의 manual 항목(다크 종이 카드 시각 확인)은 사람 확인 1회를 요구한다.

## §F Milestones

배치 원칙: 변경 가능성이 가장 높은 결정(토큰 데이터 모델 고정)을 M1에 두고, 기계적 테스트 정렬과 기록을 M3에 둔다 — 검토 집중도가 높은 결정이 앞에 온다.

### M1 — 토큰 고정 + 형태 테스트

- [MODIFY] `src/styles/mdedit-tokens.css` — 162-185행 삭제(186행은 다크 블록 자체의 닫는 중괄호라 보존); 92-122행 교체(123행 닫는 중괄호 보존)해 `:root` pele 블록을 고정 리터럴로 + 블록 헤더 주석(고정 팔레트 결정·출처).
- [MODIFY] `src/test/diagramRenderer.test.ts` — 이중 블록 루프(`:105-126,128-141`) → 단일 `:root`; 체이닝 금지 가드(`var(--md-` 0)와 팔레트 값 표 테스트 추가.

### M2 — 다크 카드 + 미리보기/내보내기 이음매

- [MODIFY] `src/lib/export/exportUtils.ts` — `mermaidBg` 3항 선택(`:109`) → `#FAF9F6` 상수; `getPreviewCss`에 다크 카드 테두리·반경 규칙.
- [MODIFY] `src/index.css` — `.mermaid-container`(`:290`)에 다크 스코프 종이 카드 규칙(배경 `--pele-bg`, 테두리 `--pele-border`, 반경 `--pele-radius`).
- [MODIFY] `src/components/preview/PreviewRenderer.tsx` — `:18` `@MX:NOTE` 문구 재작성(주석 전용, 동작 변경 없음).
- [MODIFY] `src/test/PreviewRenderer.test.tsx` — 기존 재렌더 금지 가드(240-297) 유지; 직렬화 동일성 단정 추가(선택).

### M3 — 테스트 정렬 + 기록

- [MODIFY] `src/test/exportDiagram.test.ts` — 36-60(THEME 표·모킹 정의), 296-303(6-조합 행렬 combos), 318-319(기대값 소비 지점) → 고정 팔레트 기대값; 397-408(탐침 테스트) 무변경.
- [MODIFY] `e2e/diagram-preview-behavior.spec.ts` — (a) 159-165행 테마 불일치 단정(`dark.fill/stroke !== light.fill/stroke`) → 테마 동일성 단정(`dark.fill === light.fill`) 전환. (b) 헬퍼 `expectColorsMatchTheme`의 프로브 재조준 — `readNodeColors` 내 :92-93의 `var(--md-surface)`/`var(--md-border-strong)`을 `var(--pele-surface)`/`var(--pele-border)`(또는 고정 리터럴)로 바꿔 헬퍼가 고정 팔레트와 대조하게 한다(호출 지점 :150·:154·:164·:171·:176·:215 전체가 이 프로브에 의존). (c) 두 번째 테스트 :181-217 전환 — :203(체이닝 동일 단정, 프로브 :192)은 `first.fill`을 pele surface 고정값과 대조하도록, :215-216(헬퍼 호출 + `light.fill !== first.fill`)은 테마 동일성 단정으로 재작성하되 `isSameSvg` 가드(:207-211)는 보존. AC-PREVIEW016-004의 e2e 산출물.
- [MODIFY] `e2e/diagram-export-colors.spec.ts` — 36-37(이중 블록 상수)·85-94(테마별 pele→md 연결 단정)·119-127(내보낸 SVG 테마값 단정) → 단일 `:root` 고정값 단정; 다크 내보내기 HTML의 카드 계산 스타일 단정 추가. AC-PREVIEW016-005의 e2e 산출물.
- [MODIFY-DOC] `.moai/specs/SPEC-PREVIEW-015-pele-renderer/spec.md` + `acceptance.md` — 폐기 포인터만 추가(origin/main 기반 브랜치에서; spec.md "다른 SPEC 개정" 표 기준).
- [EXISTING] `src/lib/diagram/diagramRenderer.ts` — 변경 없음(`PELE_THEME_VARS`·`readPeleThemeValues`·`resolvePeleVars` 그대로).
- [EXISTING] `src/lib/export/exportHtml.ts`, `src/lib/export/exportDocx.ts` — 변경 없음(치환 경로·DOCX 라이트 고정 유지).
- [EXISTING] `src/test/export.test.ts` — 필수 변경 없음(일반형 단정이 회귀 감시로 남는다).

## mx_plan

- `@MX:NOTE`: `mdedit-tokens.css` pele 블록 헤더(고정 팔레트 결정 + 출처 기록); `PreviewRenderer.tsx:18` `@MX:NOTE` 문구 재작성(테마 추종 근거 → 고정 팔레트 근거).
- `@MX:ANCHOR`: 신규 없음 — `readPeleThemeValues` fan_in 2 < 3; `renderDiagram`은 기존 ANCHOR 유지(영향 없음).
- `@MX:WARN`: 기존 `diagramRenderer.ts:268` 유지; 신규 WARN 없음.

## §G Anti-Patterns

- 로컬 작업 트리 `src/`에서 pele 사실을 읽지 않는다 — v0.16.1(pre-pele)이며 답이 `git show origin/main:<path>`에 있다.
- `var(--md-…)` 체이닝이나 다크 블록 pele 선언을 되살리지 않는다.
- 테마별 기대값 표, 테마 조건부 pele 선언을 재도입하지 않는다.
- 015 본문을 폐기 포인터 이상으로 재작성하지 않는다.
- "깨진 테스트 = 버그"로 해석해 이중 블록 루프를 보존하려 하지 않는다 — 교체가 설계 의도다.

## §H Cross-References

- `SPEC-PREVIEW-015` — 폐기/유지 대응 표는 `spec.md` "다른 SPEC 개정" 절.
- 승인 기획 입력: `.moai/cache/spec-preview-016-proposal.md`.
- 디자인 확정 기록: 2026-10-28 사용자 결정(잉크 앤 허니 A안; Option B `#C08A28` 기각).
