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

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
