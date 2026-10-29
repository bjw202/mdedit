# SPEC-PREVIEW-017 progress.md

## Phase Notes (plan)

- 리서치: 외부 근거(WebSearch·WebFetch)는 오케스트레이터가 2026-10-29 수행. 1차/2차 출처 구분과 URL은 `research.md` §2.
- 코드·pele 실측: plan 단계(manager-spec)가 2026-10-29 직접 수행 — 워크트리 HEAD 4bef707 소스 grep, pele 1.10.0 dist 읽기 전용 grep(`.claude/worktrees/release-v0.18.0/node_modules/pele/`, 수정·git 실행 없음), WCAG 대비·HSL 색상 python 계산. 결과는 `research.md` §4·§5.
- 사용자 결정(2026-10-29, AskUserQuestion):
  1. 범위 = 판단(`pele-shape-diam`) + 시작/끝(`pele-shape-stadium`) 노드만. 나머지 모양·클러스터 무변경, 다이어그램당 3색 이하.
  2. 판단 테두리 = 새 진한 꿀색 토큰(후보 `#8A6410`, run에서 확정). `#B78511`·series-8 재사용 기각.
  3. 간선 라벨 이음매 포함 — 측정 우선, 해법은 열어 둠.
  4. 이 워크트리에서 작업, run도 여기서 이어감.
- plan 단계 판단: `circle`은 시작/끝에서 제외(research.md §7.1), 시작/끝 테두리 두께 `1.5px`, 미리보기 기제 = 노드 `g` 사적 변수 재선언(research.md §6).
- Tier M — 산출물: spec.md / plan.md / acceptance.md / research.md / spec-compact.md / progress.md(design.md 없음).

## Environment

- 워크트리: `.claude/worktrees/preview-017-diagram-tone`, 브랜치 `WT-diagram-tone`, 기준 커밋 4bef707(origin/main = v0.18.0 + .gitattributes).
- `node_modules` 미설치 — run 단계는 `npm ci`부터 시작한다.

## Resolved Decisions

- 라벨 이음매 해법 = (a) 확정(사용자, 2026-10-29 AskUserQuestion): 라이트 미리보기 다이어그램 컨테이너 바탕 `var(--pele-bg)`(`#FAF9F6`), 테두리·반경 없음. 016 REQ-PREVIEW016-005 배경 부분 개정(테두리·반경은 다크 전용 유지). 기각 대안은 research.md §8에만 기록. 적용 전 측정 의무는 유지.

## Plan-audit History

- review-1(2026-10-29): FAIL 0.75 — `.moai/reports/plan-audit/SPEC-PREVIEW-017-review-1.md`. D1~D11 반영해 v0.1.1로 개정(D12는 사용자 결정 3을 담은 항목이라 유지).
- review-3(2026-10-29, run-phase Plan Audit Gate): PASS 0.94 (Tier M 기준 0.80) — `.moai/reports/plan-audit/SPEC-PREVIEW-017-review-3.md`. 캐시 조회 `hit:false`(감사 시점 해시가 기록되지 않았고 캐시는 MCP 프로세스 메모리 전용)라 신규 감사를 수행함.
  - audit_verdict: PASS
  - audit_report: .moai/reports/plan-audit/SPEC-PREVIEW-017-review-3.md
  - audit_at: 2026-10-29T10:08+09:00
  - auditor_version: plan-auditor (opus, profile medium)
  - plan_artifact_hash: a07714b68bc426e0af6ae3dbcefb8c73797792242d5b0d266ab6be857c9a5590
  - 남은 결함 D1~D5는 전부 minor/optional. run 단계 흡수 방침:
    - D3 `node_modules`: `npm ci` exit 0으로 설치 완료(501개 패키지, 2026-10-29) — 계획서의 "없음" 서술은 낡은 사실.
    - D4 grep 취약성: `!important`·`data-id` 단어를 shape-tone BEGIN/END 블록 안 주석과 `exportUtils.ts` 주석에 쓰지 않는다(@MX:NOTE는 BEGIN 위에 두거나 표현을 바꾼다). 정상 구현이 AC-003·004 grep에서 거짓 실패하는 것을 막기 위함.
    - D5 앵커 1행 어긋남: `diagramRenderer.ts` 268-307, `exportDiagram.test.ts` mock은 :62. 재측정 값을 여기에 기록하고 SPEC 본문은 고치지 않는다.
    - D1(클러스터 안 라벨은 반투명 클러스터 바탕 위라 이음매 판단 범위 밖)은 AC-008 경계 사례로만 기록, D2는 조치 없음.

## Run-phase Kickoff (2026-10-29)

- Implementation Kickoff Approval: 사용자 승인(AskUserQuestion, 2026-10-29) — 구현 시작 / 자율 진행 / 구현 에이전트는 `general-purpose` + manager-develop 역할 지시.
- 근거: manager-develop frontmatter `isolation: worktree`(주 체크아웃 `.claude/agents/moai/manager-develop.md:2`)가 세션 worktree 안에서 빈 중첩 worktree를 만든 전례(메모리 feedback-worktree-hook-failure, SPEC-PREVIEW-014)가 있어 우회.
- 개발 방법론 `tdd`(quality.yaml:4), 커버리지 목표 85 / 커밋당 80, harness level `standard`, 브랜치 `WT-diagram-tone`(기준 f9c94ee). 푸시·PR은 run 범위 밖(sync 단계).

## Phase 4 Mode Selection

- Input parameters: tier M / 변경 파일 약 11개(tokens.css, index.css, diagramRenderer.ts, exportUtils.ts, 단위 테스트 2개, 신규 e2e 1개, 016 문서 3개, progress.md) / 도메인 1(프런트 CSS·TS) / 파일 언어 CSS+TS / 병렬화 이득 낮음(M2는 M1 토큰에 의존, M1·M3가 `index.css`를 함께 수정).
- Mode evaluation:

  | 모드 | 판정 | 이유 |
  |------|------|------|
  | serial | 채택 | 의존 사슬(토큰 → 내보내기 → 이음매 측정 → 정렬)과 같은 파일 공유 |
  | fanout | 제외 | 남은 읽기 전용 조사가 없음 |
  | agent-team | 제외 | 같은 파일 공유, 단일 도메인, 토큰 비용 대비 이득 없음 |
  | sweep | 제외 | 균일한 기계적 변환이 아니고 30개 미만 |

- Decision: Scale-based mode: Standard Mode (serial) (files: ~11, domains: 1).
- Justification: 코딩 작업은 병렬화 이득이 작다는 전제에 부합하고, 마일스톤마다 기준 측정 → 구현 → 증거 순서가 필요해 한 에이전트가 순차로 진행하는 편이 안전하다. 오케스트레이터는 완료 후 독립 검증 배치를 따로 돌린다.

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-10-29
- plan_status: audit-ready (v0.1.1, plan-audit iteration 2 PASS 0.93 — `.moai/reports/plan-audit/SPEC-PREVIEW-017-review-2.md`; 잔여 MINOR N1~N5는 run 단계에서 흡수)

## §E.2 Run-phase Evidence

증거 파일 폴더(gitignored, 세션 로컬): `.moai/state/verify/6182e31c-0917-4343-b809-20aabc296175/`. 아래 출력은 그 파일들에서 발췌한 그대로다.

### E.2.0 Pre-flight·앵커 재측정 (HEAD f9c94ee, 코드는 4bef707과 동일)

- 브랜치 `WT-diagram-tone`, HEAD `f9c94ee`. `package.json:36` `"pele": "1.10.0"`. `node_modules` 존재(오케스트레이터 `npm ci` 완료).
- 앵커 재측정(plan.md §A와 다른 것만): `diagramRenderer.ts` `resolvePeleVars`·`resolveDiagramColors`는 268-307(plan 268-306), `exportDiagram.test.ts` 모킹은 :62(plan :61) — review-3 D5와 같음. `src/index.css:290-300`, `mdedit-tokens.css:92-124`, `diagramRenderer.ts:231-237`, `exportUtils.ts:32-42·107-113`은 그대로.
- pele 마크업 실측(`node .r017.mjs`, 임시 스크립트 — 측정 후 삭제; 출력 `pele-sample.svg`): 노드 `g`는 `class="pele-node pele-shape-diam hot"`처럼 모양 클래스 + 작성자 class를 갖고, 모양 요소는 `fill="var(--_s)" stroke="var(--_b)" style="fill:#ffeeee;stroke:#cc0000;stroke-width:3px;"` — 작성자 값이 모양 요소 인라인 style에 들어간다. 채움만 지정하면 `style="fill:#fff0cc;"`. stadium은 `<rect … rx="24" fill="var(--_s)" stroke="var(--_b)">`. 사적 변수는 SVG 루트 인라인 style(`--_s:var(--pele-surface,#f3f3f3);--_b:var(--pele-border,#8a8a8a);--_c:var(--pele-accent,#5b7bd5)…`). research.md §6 기제 전제 확인.

### E.2.1 수정 전 기준 측정 (M1 CSS 편집 전, AC-002 클러스터 기준값 + AC-008 이음매)

명령(임시 e2e `e2e/zz-baseline-017.spec.ts` — 측정 후 삭제, 커밋하지 않음):
`npx playwright test e2e/zz-baseline-017.spec.ts --reporter=list > …/baseline-pre-fix.log 2>&1` → `exit=0`, `2 passed (6.7s)`.
문서: `flowchart TD` A([시작])→B{판단}→|예| C[처리]→D[(저장소)]→E((원)), subgraph G[묶음]{F[안쪽]}, E→F, F→Z([끝]).

출력(라이트, 노드 일부 생략):
```
BASELINE light {"theme":"light","container":{"backgroundColor":"rgba(0, 0, 0, 0)","borderTopWidth":"0px","borderTopLeftRadius":"0px"},"firstOpaqueAncestor":{"selector":"DIV.md-previewpane.h-full.overflow-auto.p-4.preview-scroll","backgroundColor":"rgb(242, 242, 243)"},"edgeLabelRectFill":"rgb(250, 249, 246)","cluster":{"gClass":"pele-cluster","fill":"rgb(247, 242, 231)","fillOpacity":"0.5","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"},"nodes":{"A pele-node pele-shape-stadium":{"tag":"rect","fill":"rgb(238, 243, 247)","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"},"B pele-node pele-shape-diam":{"tag":"polygon","fill":"rgb(238, 243, 247)","stroke":"rgb(151, 164, 177)","strokeWidth":"1 …
```
출력(다크, 전체):
```
BASELINE dark {"theme":"dark","container":{"backgroundColor":"rgb(250, 249, 246)","borderTopWidth":"1px","borderTopLeftRadius":"3px"},"firstOpaqueAncestor":{"selector":"DIV.mermaid-container","backgroundColor":"rgb(250, 249, 246)"},"edgeLabelRectFill":"rgb(250, 249, 246)","cluster":{"gClass":"pele-cluster","fill":"rgb(247, 242, 231)","fillOpacity":"0.5","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"},"nodes":{"A pele-node pele-shape-stadium":{"tag":"rect","fill":"rgb(238, 243, 247)","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"},"B pele-node pele-shape-diam":{"tag":"polygon","fill":"rgb(238, 243, 247)","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"},"C pele-node pele-shape-rect":{"tag":"rect","fill":"rgb(238, 243, 247)","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"},"D pele-node pele-shape-cyl":{"tag":"path","fill":"rgb(238, 243, 247)","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"},"E pele-node pele-shape-circle":{"tag":"circle","fill":"rgb(238, 243, 247)","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"},"F pele-node pele-shape-rect":{"tag":"rect","fill":"rgb(238, 243, 247)","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"},"Z pele-node pele-shape-stadium":{"tag":"rect","fill":"rgb(238, 243, 247)","stroke":"rgb(151, 164, 177)","strokeWidth":"1px"}}}
```

판독:
- **AC-002 클러스터 기준값**(두 테마 동일): `fill rgb(247, 242, 231)`, `fill-opacity 0.5`, `stroke rgb(151, 164, 177)`, `stroke-width 1px`. rect·cyl·circle 기준: `fill rgb(238, 243, 247)`, `stroke rgb(151, 164, 177)`, `1px`.
- **AC-008 원인 확정**: 라이트는 `.mermaid-container`가 투명(`rgba(0, 0, 0, 0)`)이고 첫 불투명 조상은 `.md-previewpane`의 `rgb(242, 242, 243)`(`#f2f2f3`), 라벨 상자 `fill`은 `rgb(250, 249, 246)`(`#FAF9F6`) — 둘이 달라 이음매가 생긴다(research.md §8 가설과 일치). 다크는 컨테이너가 `rgb(250, 249, 246)` 카드(테두리 1px·반경 3px)라 라벨과 같다 — 이음매 없음.

### E.2.2 M1 — 토큰 + 미리보기 모양 톤

- RED(구현 전): `npx vitest run src/test/diagramRenderer.test.ts` → `exit=1`, `Tests  3 failed | 80 passed (83)`(24개 묶음·24개 값·판단 테두리 토큰 3건, `m1-red-unit.log`). `npx playwright test e2e/diagram-shape-tone.spec.ts --reporter=list --retries=0` → `exit=1`, `5 failed`(AC-001 `Expected "rgb(247, 242, 231)" Received "rgb(238, 243, 247)"`, AC-003·007 `Expected "rgb(138, 100, 16)" Received "rgb(151, 164, 177)"`, `m1-red-e2e.log`).
- GREEN: 같은 e2e → `exit=0`, `5 passed (8.1s)`(`m1-green-e2e.log`). 단위 → `Tests  1 failed | 82 passed (83)` — 남은 1건은 M2 RED로 의도한 `:root 이름 집합 = PELE_THEME_VARS` 가드(`m1-green-unit.log`).
- 토큰 추가 직후 `src/test/exportDiagram.test.ts`의 016 가드가 깨짐 확인(`Tests  1 failed | 21 passed (22)`, `m1-export-before-varnames.log`) → `VAR_NAMES` 24개로 갱신 후 `Tests  22 passed (22)`(`m1-export-after-varnames.log`). plan.md는 이 갱신을 M2에 두었으나 토큰 추가와 같은 커밋이어야 초록이 유지되어 M1로 당겼다.
- 토큰 값 확정 `#8A6410`(후보 그대로): `node -e` 계산 출력 `contrast vs #F7F2E7 4.809 vs #FAF9F6 5.100 hue 41.31 series-4 hue 41.93`.
- 범위 결정(M1): 톤 규칙은 `.preview-content` 아래로 한정. AI 카드 미니 다이어그램(`ai-suggestion-card.ts:1289` `renderMermaidInto`)은 편집기 안 컨테이너에 SVG를 넣으므로 `.preview-content` 밖이다 — 톤을 받지 않는다(사실 기록, 범위 확장 없음).

### E.2.3 M2 — 내보내기 동일 톤

- RED: `npx vitest run src/test/exportDiagram.test.ts src/test/diagramRenderer.test.ts` → `exit=1`, `Tests  5 failed | 105 passed (110)`(`m2-red-unit.log`): `PELE_THEME_VARS` 집합 가드 `expected [ '--pele-accent', '--pele-bg', …(22) ] to deeply equal [ … …(21) ]`, html·pdf·docx·빈 표 경로 4건 `expected '' to contain '--_s:#F7F2E7'`. 라이트·다크 동일성 테스트(AC-007 내보내기)는 구현 전에도 통과(둘 다 톤 없음 — 등식 검사라 RED가 없음, 구현 후 같은 테스트가 톤 있는 상태로 재통과).
- 구현: `PELE_THEME_VARS`에 `--pele-decision-border`(23→24). `renderExportDiagram`에서 `resolveDiagramColors` 앞에 `SHAPE_TONES` 2행을 노드 `g` 인라인 style로 주입(선택자 `.pele-node.pele-shape-diam`·`.pele-node.pele-shape-stadium`만). 대안(SVG 안 `<style>` 주입)은 쓰지 않음 — 미리보기와 같은 노드 `g` 기제가 더 단순.
- GREEN: `npx vitest run src/test/exportDiagram.test.ts src/test/diagramRenderer.test.ts src/test/export.test.ts` → `exit=0`, `Tests  130 passed (130)`(`m2-green-unit.log`).
- grep(AC-003·004):
  ```
  $ awk '/shape-tone BEGIN/,/shape-tone END/' src/index.css | grep -c '!important'
  0
  $ grep -c '!important' src/lib/export/exportUtils.ts
  0
  $ awk '/shape-tone BEGIN/,/shape-tone END/' src/index.css | grep -cE 'nth-|data-id|:has\(|:contains'
  0
  $ grep -cE 'data-id|textContent|innerText' src/lib/export/exportUtils.ts
  0
  ```
- AC-004 코드 리뷰 증거: 주입부는 `svg.querySelectorAll(selector)`의 `selector`가 `SHAPE_TONES`의 두 모양 클래스 문자열뿐이고, 라벨 문구·노드 id·인덱스를 읽지 않는다(위 grep 0건).
- 세 경로 단일 지점(AC-006):
  ```
  $ git grep -n renderExportDiagram -- src/lib
  src/lib/export/exportDocx.ts:136:  const diagram = renderExportDiagram(previewDiagramInput(fenceContent), colors);
  src/lib/export/exportHtml.ts:114:    const diagram = renderExportDiagram(placeholder.getAttribute('data-diagram') ?? '', values);
  src/lib/export/exportUtils.ts:42:export function renderExportDiagram(source: string, values: PeleThemeValues): ExportDiagram | null {
  ```
  (import 줄·주석 줄 생략. PDF는 `generateHtmlContent` → `exportHtml.ts` 같은 함수 경유.)

### E.2.4 M3 — 간선 라벨 이음매 (해법 (a))

- 수정 전 측정은 §E.2.1, 커밋 `931879b`(M1)에 들어 있어 이 수정 커밋보다 앞선다.
- RED: `npx playwright test e2e/diagram-shape-tone.spec.ts --reporter=list --retries=0 -g "AC-008"` → `exit=1`, `1 failed / 1 passed`(라이트 `Expected "rgb(250, 249, 246)" Received "rgba(0, 0, 0, 0)"`, 다크 통과 — 기존 카드, `m3-red-e2e.log`).
- 구현: `.preview-content .mermaid-container`에 `background-color: var(--pele-bg)`(테마 무관). 다크 규칙의 같은 바탕 선언은 중복이라 제거(결과 상태 동일 — 다크 e2e가 `rgb(250, 249, 246)`·`1px`·`3px` 단정). 라이트에 테두리·반경 없음. 주석 "라이트는 무카드"를 "라이트는 바탕만, 테두리·반경 없음"으로 갱신(`src/index.css`, `src/lib/export/exportUtils.ts` 주석 1줄). `PreviewRenderer.tsx`에는 해당 주석이 없음(`grep -n "카드\|무카드"` 출력 없음).
- GREEN: `npx playwright test e2e/diagram-shape-tone.spec.ts --reporter=list --retries=0` → `exit=0`, `7 passed (10.8s)`(`m3-green-e2e.log`).
- 경계(review-3 D1): 서브그래프 안 라벨은 반투명 클러스터 바탕 위라 이 단정 범위 밖 — 측정·수정 대상 아님.

### E.2.5 M4 — 테스트 정렬·016 포인터·전체 게이트

- 테스트 정렬: `diagramRenderer.test.ts`(24개 묶음·값 표·대비·hue·기각 색·이름 집합 가드)는 M1·M2에서 RED→GREEN으로 이미 반영, `exportDiagram.test.ts` `VAR_NAMES` 24개는 M1에서 반영. M4에서는 최종 실행만 확인.
- 016 문서 개정 포인터만 추가(본문 무수정): `SPEC-PREVIEW-016…/spec.md` REQ-002·REQ-005 아래 인용 포인터 2줄, `acceptance.md` AC-002 아래 포인터 1줄, `spec-compact.md` REQ-005 줄·AC-002 표 행 끝 괄호 포인터. `git diff --stat` 8 insertions / 2 deletions(괄호 덧붙임 2줄).
- 기각 대안 부재: `grep -rn "C08A28\|decision-border" src e2e`(테스트 제외) → 토큰 선언·주석·주입·`PELE_THEME_VARS`·톤 규칙만, `#C08A28` 0건. `#B78511`은 `mdedit-tokens.css`의 series-4 1건뿐(톤·주입 코드 0건).
- 전체 게이트(모두 이번 실행, 최종 트리):

  | 명령 | exit | 관찰 출력(발췌) | 증거 |
  |------|------|----------------|------|
  | `npx vitest run` | 0 | `Test Files  108 passed (108)` / `Tests  1765 passed (1765)` | `gate-vitest.log` |
  | `npx tsc --noEmit` | 0 | 출력 없음 | `gate-tsc.log` |
  | `npm run lint` (`eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`) | 0 | 경고·오류 출력 없음 | `gate-lint.log` |
  | `npx playwright test e2e/diagram-shape-tone.spec.ts e2e/diagram-preview-behavior.spec.ts e2e/diagram-export-colors.spec.ts --reporter=list --retries=0` | 0 | `15 passed (13.3s)` | `gate-e2e.log` |
  | `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml` | 0 | `test result: ok. 367 passed; 0 failed` (+ 0개 테스트 바이너리 2개) | `gate-cargo.log` |

## §E.3 Run-phase Audit-Ready Signal

- run_status: audit-ready (2026-10-29, manager-develop 역할 / general-purpose, cycle_type tdd)
- 커밋: M1 `931879b`, M2 `0049f5a`, M3 `0638232`, M4 = 이 절을 담은 커밋(브랜치 `WT-diagram-tone`, 미푸시).
- 판단 테두리 확정값: `#8A6410`(후보 그대로) — `#F7F2E7` 대비 4.809, `#FAF9F6` 대비 5.100, HSL hue 41.31°(series-4 41.93°).

| AC | 판정 | 명령 | 증거 |
|----|------|------|------|
| AC-PREVIEW017-001 | PASS | `npx playwright test e2e/diagram-shape-tone.spec.ts` (AC-001) | §E.2.2, `gate-e2e.log` |
| AC-PREVIEW017-002 | PASS | 같은 spec (AC-002, 클러스터 기준값 = §E.2.1) | §E.2.1·2.2, `gate-e2e.log` |
| AC-PREVIEW017-003 | PASS | e2e (AC-003) + `npx vitest run src/test/exportDiagram.test.ts` + grep 2건 = 0 | §E.2.2·2.3 |
| AC-PREVIEW017-004 | PASS | e2e (AC-004) + grep = 0 + 주입부 코드 리뷰 | §E.2.3 |
| AC-PREVIEW017-005 | PASS | `npx vitest run src/test/diagramRenderer.test.ts` | §E.2.2·2.3, `gate-vitest.log` |
| AC-PREVIEW017-006 | PASS | `npx vitest run src/test/exportDiagram.test.ts` + `git grep -n renderExportDiagram -- src/lib` | §E.2.3 |
| AC-PREVIEW017-007 | PASS | e2e (AC-007) + exportDiagram 라이트·다크 동일 + `PreviewRenderer.test.tsx` 전체 vitest 통과 | §E.2.2·2.3·2.5 |
| AC-PREVIEW017-008 | PASS | 수정 전 측정(§E.2.1, M1 커밋) + e2e AC-008 2건 + `export.test.ts` 통과 | §E.2.1·2.4·2.5 |

변경 파일: `src/styles/mdedit-tokens.css`, `src/index.css`, `src/lib/diagram/diagramRenderer.ts`, `src/lib/export/exportUtils.ts`, `src/test/diagramRenderer.test.ts`, `src/test/exportDiagram.test.ts`, `e2e/diagram-shape-tone.spec.ts`(신규), 016 `spec.md`·`acceptance.md`·`spec-compact.md`(포인터), 이 `progress.md`.

@MX 태그: NOTE 3건 추가 — `src/index.css` shape-tone BEGIN 위, `src/lib/export/exportUtils.ts` `SHAPE_TONES` 위, `e2e/diagram-shape-tone.spec.ts` 머리. 신규 ANCHOR·WARN 없음. 기존 `diagramRenderer.ts` 0-잔여 WARN 유지.

Gaps(관찰하지 않음):
- 수동 시각 확인(acceptance 품질 게이트 "라이트·다크 미리보기 시각 확인 1회")은 하지 않았다 — 사람 눈 확인 필요.
- 실제 앱(Tauri) 실행과 실제 PDF·DOCX 파일 렌더는 보지 않았다. 내보내기 검증은 jsdom 문자열(래스터 입력 SVG) 수준이며 PNG 픽셀은 증명하지 않는다.
- 실제 브라우저에서 `readPeleThemeValues`가 `--pele-decision-border`를 읽는지는 단위 테스트(모킹)로만 간접 확인했다 — 탐침이 비어도 대체 리터럴이 같은 값을 넣으므로 결과는 같다.
- Windows 빌드·webkit 외 브라우저는 실행하지 않았다.
- 커버리지 수치는 측정하지 않았다(`--coverage` 미실행).

Residual risk:
- pele 버전을 올리면 `--pele-decision-border` 이름 충돌·노드 `g` 마크업(모양 클래스, 사적 변수 `--_s`/`--_b`) 변경 가능성 — 고정 1.10.0에서는 낮음(plan.md §B).
- AI 카드 미니 다이어그램은 `.preview-content` 밖이라 톤·라이트 바탕을 받지 않는다(의도된 범위, §E.2.2).
- 라이트 바탕 규칙은 오류·빈 다이어그램 컨테이너도 `#FAF9F6`로 칠한다(review-2 N5, REQ-008과 일치).

### E.3b 오케스트레이터 독립 검증 (2026-10-29, 구현 에이전트 보고와 별개로 최종 트리 d4710e9에서 재실행)

증거 폴더: `.moai/state/verify/6182e31c-0917-4343-b809-20aabc296175/` (`v-*.log`, gitignored).

| 명령 | exit | 관찰 출력(발췌) | 증거 |
|------|------|----------------|------|
| `npx tsc --noEmit` | 0 | 출력 없음 | `v-tsc.log` |
| `npm run lint` | 0 | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` 뒤 경고·오류 없음 | `v-lint.log` |
| `npx vitest run` | 0 | `Test Files  108 passed (108)` / `Tests  1765 passed (1765)` | `v-vitest.log` |
| `npx playwright test e2e/diagram-shape-tone.spec.ts e2e/diagram-preview-behavior.spec.ts e2e/diagram-export-colors.spec.ts --reporter=list` | 0 | `15 passed (13.1s)` | `v-e2e.log` |
| AC-003 `awk … shape-tone … \| grep -c '!important'` / `grep -c '!important' src/lib/export/exportUtils.ts` / AC-004 금지 선택자 grep | — | 각각 `0` / `0` / `0` (블록 길이 11줄, 마커 `src/index.css:309`·`:319`) | 터미널 |
| `grep -c -- "--pele-decision-border:" src/styles/mdedit-tokens.css` | — | `1` (`:127`, `:root` 블록 안, 리터럴 `#8A6410`) | 터미널 |
| `git diff --name-only f9c94ee..HEAD` | — | 11개 파일, 전부 plan.md §F 범위(SPEC-017 spec/plan/acceptance 본문 무변경, 016 문서 3개는 포인터만, `src-tauri/` 변경 0) | 터미널 |

- 소스 코드 리뷰(`git diff f9c94ee..HEAD -- src/index.css src/styles/mdedit-tokens.css src/lib/...`): CSS 톤 규칙 8줄(+ 주석), `SHAPE_TONES` 2행 + 주입 루프 6줄, 토큰 1줄, `PELE_THEME_VARS` 1줄. 선택자는 `pele-shape-*` 클래스뿐이고 `!important`·라벨 문구·노드 순서·테마 입력이 없다. 다크 규칙의 중복 바탕 선언 제거는 결과 상태 동일(다크 e2e가 `rgb(250, 249, 246)`·`1px`·`3px` 단정).
- 보고서 `SPEC-PREVIEW-017-review-3.md`(run 진입 시 PASS 0.94)를 같은 커밋 묶음에 넣었다.

Gaps(오케스트레이터 미관찰): `cargo test`는 재실행하지 않았다(변경 파일에 Rust 파일이 없어 회귀 확인용이다. 구현 에이전트가 보고한 `367 passed`는 `gate-cargo.log` 기준이며 이 절에서는 직접 확인하지 않았다). 수동 시각 확인, 실제 Tauri 앱·PDF·DOCX 렌더, Windows·비 webkit 브라우저, 커버리지 수치는 §E.3 Gaps와 같다.

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-10-29
sync_commit_sha: ac06236
sync_status: complete
sync_audit: "PASS 0.92 (Functionality 0.95 / Security 0.95 / Craft 0.88 / Consistency 0.92) — .moai/reports/sync-audit/SPEC-PREVIEW-017-sync-audit.md"
b12_self_test_a: "grep -c 'SPEC-PREVIEW-017' CHANGELOG.md → 0 (기재 전, 중복 없음)"
b12_self_test_b: "acceptance.md 고유 AC 토큰 13개(교차 참조 AC-001/003/004/005/008 포함) 중 이 SPEC의 AC는 AC-PREVIEW017-001~008 8건 — CHANGELOG 항목이 8건으로 기재"
b12_self_test_c: "CHANGELOG에 적은 경로 src/index.css, src/lib/export/exportUtils.ts, src/styles/mdedit-tokens.css → ls로 존재 확인"
changelog_entry_position: "CHANGELOG.md [Unreleased] → ### Changed (첫 항목)"
frontmatter_status_transitions:
  spec_md: "draft → completed (updated: 2026-10-29 유지)"
```

### 감사 이후 정리 (2026-10-29, 오케스트레이터)

- 버전 올림(사용자 요청): `0.18.0 → 0.19.0`, 커밋 `c6765c6`(package.json, package-lock.json 2곳, Cargo.toml, Cargo.lock의 mdedit 항목, tauri.conf.json, CHANGELOG `[0.19.0] - 2026-10-29`). `cargo metadata --locked` exit 0, 올린 뒤 vitest 108파일/1765 통과 확인. 태그·릴리즈 없음.
- 샘플 문서(사용자 요청): `samples/diagram-palette.md` — mermaid 블록 7개를 앱 렌더러 `validateDiagram`으로 모두 유효 확인(임시 테스트 8 passed, exit 0, 테스트 파일은 삭제). 라이트·다크 실제 화면 캡처 확인은 하지 않았다(사람 눈 확인 몫).
- 감사 결함 처리(모두 low·optional): F1 `src/test/exportDiagram.test.ts:413` 모킹 복원 누락(테스트 순서 의존 위험) — 후속 정리 후보, 이번 PR에서는 고치지 않음. F2 016 `spec-compact.md` 개정 포인터 서식 — 서식만의 문제. F3 `spec.md` References/HISTORY 갱신 — SPEC 본문이라 manager-spec 소관, 이번에는 보류. F4 노드 `g`에 기존 style이 있을 때의 단위 테스트 — pele 1.10.0이 노드 `g`에 style을 내는지 미확인, 조치 없음.
- 안전 백업 `.moai/backups/sync-20261029-103901/`은 모두 커밋된 파일의 복사본이라 삭제함.
- 남은 일: 푸시·PR 생성(사용자 별도 승인 필요), 라이트·다크 눈 확인, 실제 PDF·DOCX 렌더 확인.

### 차이 보고(divergence)

- scope_expansion: 없음
- unplanned_additions: 없음
- structural_changes:
  - `VAR_NAMES` 23→24 갱신을 M2에서 M1으로 앞당김
  - 다크 규칙의 중복 바탕 선언 제거(결과 상태 동일)
  - 주석 문구 2곳 수정
- deferred_items: 사람의 라이트·다크 시각 확인, 실제 PDF·DOCX 렌더 확인, AI 카드 미니 다이어그램(범위 밖)
- 새 디렉터리·의존성: 없음

### 갱신한 문서 / 건너뛴 문서

- 갱신: `CHANGELOG.md`([Unreleased] Changed 1건), `spec.md` 프런트매터 `status`
- 건너뜀: `README.md`, `.moai/project/product.md`·`structure.md`·`tech.md`, codemaps — 새 디렉터리·의존성·기능 진입점이 없어 반영할 내용이 없음

### SPEC 상태 전환

- `draft → completed`: run 단계에서 `in-progress`를 거치지 않았으므로, 3단계 닫기 규약대로 이 단일 sync 커밋에서 바로 `completed`로 닫는다.

### 보안 메모

- `npm audit` 24건(critical 3: dompurify, vitest, tinypool / high 13 / moderate 5 / low 3). 모두 기존부터 있던 항목이며 이 SPEC은 `package.json`·lock·Cargo 파일을 바꾸지 않았다. 사용자는 "경고와 함께 계속"을 선택했다. PR 설명에 같은 내용을 반복하고, 의존성 업그레이드는 별도 작업으로 둔다.

### Phase 7~10 관찰 기록

- `tsc --noEmit` 종료 코드 0, eslint 종료 코드 0
- vitest 108 파일 / 1765 테스트 통과
- `src/lib/export/exportUtils.ts` 줄 커버리지 97.7%(79~80행 미커버)
- MX 검증 P1=0, P2=0
- 보안 코드 스캔: 보안 민감 파일 변경이 없어 건너뜀

Gaps(이 절에서 미관찰): 위 수치는 오케스트레이터가 전달한 관찰값이며 manager-docs가 이 커밋에서 다시 실행하지 않았다. 사람의 시각 확인, 실제 PDF·DOCX 렌더, AI 카드 미니 다이어그램은 남아 있다.
