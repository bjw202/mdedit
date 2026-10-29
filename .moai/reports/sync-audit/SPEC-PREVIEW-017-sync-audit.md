Verdict: PASS
Overall Score: 0.92

# SPEC-PREVIEW-017 Sync Audit (sync-auditor, standard harness, final-pass)

- 대상: 브랜치 `WT-diagram-tone`, 범위 `f9c94ee..HEAD`(HEAD `c6765c6`), 7커밋
- 감사일: 2026-10-29
- 방식: 진행 기록·sync 보고서·CHANGELOG·커밋 메시지를 믿지 않고, 아래 명령을 이 트리에서 직접 실행해 확인했다. 긴 출력은 `.moai/state/verify/6182e31c-0917-4343-b809-20aabc296175/a-*.txt`에 저장했다.
- 교차 모델 감사: 사용하지 않음(Claude 단독).

## 요약

판단·시작/끝 노드의 모양 기반 톤, 새 토큰 `--pele-decision-border`, 내보내기 주입, 라이트 미리보기 간선 라벨 이음매 수정이 모두 SPEC대로 구현되어 있다. 단위 테스트 1765개, Playwright webkit 15개, tsc, eslint를 직접 실행했고 모두 통과했다. 새 토큰의 대비(4.809:1)와 색상각(41.31°)도 직접 계산해 기준 안에 드는 것을 확인했다. 막는 결함(blocking)은 없다. 경미한 선택 사항(optional) 4건과, 확인하지 못한 항목(수동 시각 확인, 실제 PDF·DOCX 렌더링, Windows, 커버리지)을 아래에 정리했다.

## 차원별 점수

| 차원 | 점수 | 판정 | 근거(직접 관찰) |
|------|------|------|-----------------|
| Functionality (40%) | 0.95 | PASS | `npx vitest run` → exit=0, `Test Files 108 passed (108)`, `Tests 1765 passed (1765)`. `npx playwright test e2e/diagram-shape-tone.spec.ts e2e/diagram-preview-behavior.spec.ts e2e/diagram-export-colors.spec.ts --reporter=list` → exit=0, `15 passed (13.7s)`. AC-003·004 grep 3개 모두 `0`. |
| Security (25%) | 0.95 | PASS | 주입되는 문자열은 코드 안의 상수(`SHAPE_TONES`)뿐이고 사용자 입력이 섞이지 않는다. 정화된 SVG에 붙이므로 새 주입 경로가 없다. `grep -c '!important' src/lib/export/exportUtils.ts` → `0`. 이 SPEC의 범위에 드는 Critical·High 발견은 없다. |
| Craft (20%) | 0.88 | PASS | RED→GREEN 증거가 코드와 들어맞는다(아래 참조). 주석과 @MX:NOTE 설명이 실제 동작과 일치한다. 구현은 CSS 규칙 2개와 주입 루프 6줄로, plan 범위를 넘는 부분이 없다. 감점 요인은 커버리지를 측정할 수 없었다는 점(Gap)과 목(mock) 구현 누수(F1)다. |
| Consistency (15%) | 0.92 | PASS | 버전 6곳이 모두 0.19.0이고, 릴리스 커밋은 그 6파일만 바꿨다. CHANGELOG 구조가 맞다. 016 개정은 포인터만 추가했다. 감점 요인은 F2·F3(문서 일관성 경미)다. |

조화 평균: 4 / (1/0.95 + 1/0.95 + 1/0.88 + 1/0.92) = 0.924 → **0.92**. 필수 통과(must-pass) 차원인 Functionality와 Security가 모두 통과했다.

## AC별 증거

| AC | 판정 | 증거(명령 → 관찰값) |
|----|------|---------------------|
| AC-001 판단 노드 톤 | PASS | e2e `diagram-shape-tone.spec.ts:156` ✓ — 판단 노드는 채움 `rgb(247, 242, 231)`, 테두리 `rgb(138, 100, 16)`. 같은 그림의 사각형은 `rgb(238, 243, 247)` / `rgb(151, 164, 177)`. |
| AC-002 시작/끝·나머지 유지 | PASS | e2e `:166` ✓ — stadium은 테두리 ACCENT·`1.5px`. rect·cyl·circle은 기본값. 클러스터는 기준값 `{fill: SURFACE_ALT, fillOpacity:'0.5', stroke: BORDER, strokeWidth:'1px'}`과 같다(progress.md:83의 변경 전 BASELINE과 일치). 채움·테두리 조합은 `toBeLessThanOrEqual(3)`. |
| AC-003 작성자 우선 | PASS | e2e `:183` ✓ — `hot`은 `rgb(255, 238, 238)`/`rgb(204, 0, 0)`/`3px`. 채움만 지정한 `warm` 판단 노드는 채움 `rgb(255, 240, 204)`이고 테두리는 판단 테두리를 받는다. 내보내기 단위 테스트는 html·pdf·docx 세 경로 모두 모양 요소 style에 `fill:#ffeeee`·`stroke:#cc0000`·`fill:#ddeeff`가 남는 것을 확인한다. `awk '/shape-tone BEGIN/,/shape-tone END/' src/index.css \| grep -c '!important'` → `0`. `grep -c '!important' src/lib/export/exportUtils.ts` → `0`(f9c94ee 기준도 `0`). |
| AC-004 문구·순서 추론 금지 | PASS | e2e `:194` ✓. `awk … \| grep -cE 'nth-\|data-id\|:has\(\|:contains'` → `0`. 코드를 읽어 확인: 주입부는 `svg.querySelectorAll('.pele-node.pele-shape-diam' \| '.pele-node.pele-shape-stadium')`만 쓰고 `textContent`·인덱스·`data-id`를 쓰지 않는다. |
| AC-005 판단 테두리 토큰 | PASS | `grep -n decision-border src/styles/mdedit-tokens.css` → 선언은 127행 1건(101행은 주석). 직접 계산(node): `contrast 4.809`(대 `#F7F2E7`), `hue 41.31`(series-4 `41.93`, 허용 범위 36.9~46.9). 금지 색 3개와 다르다. 단위 테스트에서 24개 묶음, 다크 0개, `PELE_THEME_VARS` 집합 일치 가드가 통과한다. |
| AC-006 내보내기 동일 톤·0-잔여·동기화 | PASS | `exportDiagram.test.ts`에서 html·pdf·docx 3경로와 빈 표(대체 리터럴) 경로 모두 `not.toContain('var(--pele-')`이고, `--_s:#F7F2E7`, `--_b:#8A6410`, `--_b:#3A5673`, `stroke-width:1.5px`가 들어 있다. 코드에서 주입이 `resolveDiagramColors` 앞에 있음을 확인했다. `resolvePeleVars`는 `var(--pele-x,대체값)`의 대체값까지 통째로 치환하므로, 잔여 0건이 코드 수준에서도 성립한다. `git grep -n renderExportDiagram -- src/lib` → 호출처는 exportHtml.ts:114(HTML, PDF는 `generateHtmlContent`→`replaceMermaidPlaceholders` 경유)과 exportDocx.ts:136, 정의는 exportUtils.ts:42. |
| AC-007 테마 무관 | PASS | e2e `:205` ✓. 단위 테스트에서 라이트·다크 내보내기 톤이 `toEqual`로 같다. 기존 테마 토글 재렌더 금지 e2e(`diagram-preview-behavior.spec.ts:141,181`) ✓. 톤 CSS 선택자에는 `.dark`가 없다. |
| AC-008 간선 라벨 이음매 | PASS | 수정 전 측정 기록(progress.md:83·92: 라이트 컨테이너 `rgba(0, 0, 0, 0)`, 첫 불투명 조상 `rgb(242, 242, 243)`, 라벨 `rgb(250, 249, 246)`)은 M1 커밋 `931879b`에 들어 있고, 이 커밋은 수정 커밋 `0638232`보다 앞선다(`git log -S'BASELINE light'`로 확인). 같은 기록에서 M1 CSS 적용 전 상태(판단 노드가 기본 톤)도 확인된다. e2e `:132` 라이트 ✓, `:143` 다크 카드 유지 ✓. 내보내기 쪽 라이트 무카드 e2e(`diagram-export-colors.spec.ts:120`) ✓. |

## 결함 목록 (구조화)

- **F1** [low] [optional] `src/test/exportDiagram.test.ts:413` — 빈 표 경로 테스트가 `readPeleThemeValues`에 `mockImplementation(real…)`을 설정한다. 그런데 `beforeEach`의 `vi.clearAllMocks()`(161–162행)는 호출 기록만 지우고 구현은 되돌리지 않는다. 그래서 같은 파일에서 이 테스트 뒤에 실행되는 테스트들은 주입 표 대신 실제 jsdom 탐침(빈 표)을 쓰게 된다. 현재는 대체 리터럴이 토큰 값과 같아 결과에 영향이 없지만, 테스트 순서에 의존하는 상태다. 486행에도 같은 패턴이 원래부터 있다. 신뢰도는 높다(vitest 2 `clearAllMocks` 동작). — 필요한 수정: 해당 테스트 끝에서 `mockImplementation((t) => THEME[t])`로 되돌리거나 `mockImplementationOnce`를 쓴다.
- **F2** [low] [optional] `.moai/specs/SPEC-PREVIEW-016-pele-fixed-palette/spec-compact.md:18,34` — 개정 포인터가 별도 줄이 아니라 기존 행 끝에 괄호로 덧붙어 있다. 원문은 지워지지 않았으므로 "본문 재작성 금지"는 지켰지만, spec.md·acceptance.md에서 쓴 `> 개정 포인터` 별도 줄 형식과 다르다. — 필요한 수정(선택): 표 형식이라 불가피하다면 그대로 둬도 된다. 형식을 맞추려면 표 아래에 포인터 줄을 둔다.
- **F3** [low] [optional] `.moai/specs/SPEC-PREVIEW-017-diagram-shape-tone/spec.md:138` — References에 plan-audit 보고서가 review-1만 적혀 있다. 최종 PASS 보고서(`SPEC-PREVIEW-017-review-3.md`)는 빠져 있고, HISTORY에도 completed 전환 행이 없다. sync 커밋은 상태 필드만 바꾼다는 지시에는 맞는다. — 필요한 수정(선택): 다음 문서 개정 때 review-3 참조를 추가한다.
- **F4** [low] [optional] `src/lib/export/exportUtils.ts:50-53` — 노드 `g`에 원래 style이 있을 때 `/;?$/` 치환으로 세미콜론을 보정하는데, 원래 style이 공백이 아닌 다른 문자로 끝나는 경우는 단위 테스트가 다루지 않는다. 다만 pele 1.10.0 노드 `g`가 style을 내는지는 확인하지 않았으며, 도달 가능성은 불확실하다(신뢰도 낮음). — 필요한 수정: 없음(정보 제공용).

막는(blocking) 결함: **0건**.

## 보안 메모 (정보 제공용)

- `npm audit`은 실행하지 않았다. 이 SPEC은 의존성을 바꾸지 않았고(릴리스 커밋 diff에서 lock 파일 변경은 버전 필드 2곳뿐임을 확인), 기존 경고는 사용자가 PR 경고로 가져가기로 결정했다.

## Craft 상세

- RED 증거의 개연성: progress.md:96은 e2e 실패 메시지로 `Expected "rgb(247, 242, 231)" Received "rgb(238, 243, 247)"`를 기록했다. 이는 변경 전 CSS(톤 없음)에서 판단 노드가 기본 채움으로 그려지는 상태와 일치하며, 변경 전 BASELINE(progress.md:83)과도 맞는다. :104의 `expected '' to contain '--_s:#F7F2E7'`는 주입 루프가 없을 때 노드 `g` style이 빈 문자열이 되는 현재 코드와 맞는다. AC-007 내보내기 등식 테스트에 RED가 없었다는 점을 스스로 밝힌 것도 사실과 맞다.
- 주석 정확성: index.css @MX:NOTE의 설명(사적 변수 재선언, 작성자 인라인 우선, stroke-width는 상속 속성이라 g에 둠)은 e2e 계산값으로 확인된다. exportUtils.ts의 "주입은 반드시 resolveDiagramColors 앞" 경고는 코드 순서와 일치한다.
- 단순성: plan을 넘는 추상화가 없다.

## Consistency 상세

- `git show --stat HEAD` → 바뀐 파일은 CHANGELOG.md, package-lock.json, package.json, src-tauri/Cargo.lock, src-tauri/Cargo.toml, src-tauri/tauri.conf.json의 6개뿐이다(8+/6-). 버전 diff는 6곳 모두 `0.18.0`→`0.19.0`이다(package-lock 2곳 포함).
- CHANGELOG: `## [Unreleased]`(비어 있음) 다음에 `## [0.19.0] - 2026-10-29`이 오고, SPEC-PREVIEW-017 항목이 들어 있다. 항목의 주장을 하나씩 대조했다. 4.81:1과 41.3도는 직접 계산값 4.809·41.31과 맞는다. vitest 1765/108은 직접 실행값과 같다. e2e 15/15(신규 7, 기존 8)은 신규 spec의 테스트 7건과 맞는다. 원인 `#f2f2f3`은 progress.md:83 측정값과 같다. `renderExportDiagram`과 `src/index.css` 표지 경로도 실재한다. 거짓이거나 검증할 수 없는 주장은 찾지 못했다(플랜 감사 PASS 0.94는 보고서 파일이 있다는 것만 확인함).
- sync 커밋 `ac06236`에서 spec.md의 변경은 `status: draft`→`completed` 1줄뿐이다.

## 확인하지 못한 항목 (Not observed)

- 라이트·다크 미리보기 수동 시각 확인(acceptance 품질 게이트의 "수동" 항목)
- 실제 PDF 인쇄 결과와 DOCX를 Word에서 열었을 때의 렌더링. 단위 테스트는 SVG 문자열만 본다. Word의 네이티브 SVG가 CSS 사용자 정의 속성(`--_s`)을 해석하는지도 미확인이다. 다만 pele 자체가 이미 `var(--_s)`에 의존하므로 기존부터 있던 조건이다.
- Windows 실행과 `cargo test`(이 SPEC은 프런트엔드만 바꿈)
- 변경 파일의 라인 커버리지: `node_modules/@vitest/`에 coverage 제공자가 없어 측정할 수 없었다(Gap이며 PASS로 셈하지 않음).
- `npm audit`(범위 밖, 정보용)
- AI 카드 미니 다이어그램이 `.preview-content` 밖에서 그려진다는 주장은, `src/components/editor/extensions/ai-suggestion-card.ts`가 렌더 모듈을 쓴다는 grep 결과까지만 확인했고 DOM 위치를 실측하지는 않았다.
- 미추적 디렉터리 `.moai/backups/`는 의도된 백업이므로 결함으로 보지 않았다.

## 잔여 위험

- e2e는 webkit 하나에서만 계산 스타일을 확인했다. Windows의 WebView2(Chromium)에서도 같은 계산값이 나오는지는 관찰하지 않았다. 이 기제(상속된 사용자 정의 속성)는 표준이라 위험은 낮다.
- F1 때문에 이후에 테스트를 추가하면 순서에 따른 숨은 의존이 생길 수 있다.
