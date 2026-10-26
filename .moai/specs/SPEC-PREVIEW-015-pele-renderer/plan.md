# SPEC-PREVIEW-015 — 구현 계획

> 본 문서는 spec.md(WHAT/WHY)에 대한 HOW를 다룬다. Given-When-Then 수용 시나리오와 테스트 배치는 acceptance.md, 코드 근거는 research.md 참조. 개발 방식은 TDD(cycle_type=tdd). 단, M1은 운영 코드를 바꾸지 않는 시험 렌더링이다.
> 순서 원칙: M1 사람 게이트를 맨 앞에 두고, 그 뒤로는 바뀔 가능성이 큰 결정(새 모듈 계약·테마 토큰·내보내기 방식)을 먼저, 기계적인 테스트 개정·정리를 뒤에 둔다.

## Tier 판단

**Tier L.** 근거:

- 변경 파일이 운영 코드 약 10개, 테스트 약 15개, e2e 3개, 다른 SPEC 7개, 문서 3개 이상으로 15개를 크게 넘는다.
- 런타임 의존성 교체, 보안 경계(정화·링크) 재정의, 내보내기 방식 전환이 함께 있다.
- 마일스톤이 7개이고 M1 결과에 따라 나머지 전체가 멈출 수 있다.

산출물(Tier L 5종 + 진행 기록): `research.md`(조사 단계에서 작성됨), `spec.md`, `design.md`, `plan.md`, `acceptance.md`, 그리고 `progress.md`.

## 확정 결정 (Locked Decisions)

설계 결정 D1–D15의 전체 내용과 근거, Design Note는 **`design.md` §1·§2**에 있다. 아래는 번호 색인이다.

| # | 결정 (요약) |
|---|-------------|
| D1 | 엔진 = pele 1.10.0 전면 교체 |
| D2 | 고정 옵션 `autoDirection: false`·`links: false`·`images: false`·`responsive: true`·`fontFamily`·`fontFamilyMono`(앱 다이어그램 글꼴 상수 두 개) |
| D3 | 모듈 하나, 검증과 렌더가 같은 렌더 함수 |
| D4 | 정화 = 별도 `DOMPurify(window)` 인스턴스의 다이어그램 경로(href 훅 재등록, 수식 허용 목록) + 공유 `sanitizeSvg` 무변경 |
| D5 | `--pele-*` ↔ `--md-*` 연결 (변수 목록은 M1 확정) |
| D6 | 내보내기 = 원본 렌더 + 모든 `var(--pele-…)`를 실제 값으로 치환 (HTML·PDF는 내보내기 테마, DOCX는 항상 라이트) |
| D7 | 실패·빈 펜스 자리 = 형식별 현재 동작 + 위치 고정 |
| D8 | DOCX 크기 = pele `width`·`height` |
| D9 | 오류 문구 형식(`(L행 C열)` 또는 접미사 없음), `error` = `PeleError.message` |
| D10 | 클래스·파일 이름 유지 |
| D11 | 시험 렌더링 코드 `spike/pele/`, M7에서 삭제 |
| D12 | M1 보고서 `m1/report.html` + `m1/checks.md` |
| D13 | `images: false` 고정 |
| D14 | 픽스처 두 묶음(`unit/`·`browser/`), 매니페스트에 캡처 환경·측정기 기록, 단위 테스트 측정기 `jsdom-default` |
| D15 | 다이어그램 안 수식 = pele `math` + 기존 `katex`, 출력 `mathml-bare` (M1b 확정) |

## 마일스톤 (우선순위 순, 시간 추정 없음)

### M1 (Priority High, **HUMAN GATE**) — 시험 렌더링과 비교 보고서

운영 코드를 바꾸지 않는다. `src/` 아래에서는 `src/test/fixtures/pele/`만 새로 만든다.

1. `npm i -E pele@1.10.0`(이 단계에서만 mermaid와 함께 설치). `package-lock.json` 변경은 M2에서 정리.
2. 샘플 수집 (모두 `spike/pele/samples/`에 원문 그대로):
   - `e2e/fixtures/test-content.md:15-22` mermaid 블록
   - `e2e/mermaid-subgraph-label.spec.ts:13-40` 시나리오 B(세로)·C(가로) 긴 한글 subgraph 제목
   - `DIAGRAM_PRESETS` 7종 (`keyboard-shortcuts.ts:194-257`)
   - AI 샘플: `e2e/fixtures/tauri-v2-ai-mock.ts:115-118`의 두 응답(첫 응답 `notarealdiagramtype foo!!!`는 **반드시 거부**되어야 함) + 사용자가 제공하는 실제 AI 응답 몇 건(없으면 보고서에 "미수집"으로 적음)
   - `classDef`·`style`로 색을 지정한 다이어그램, `stateDiagram-v2`, `mindmap`, `pie title …`
   - 엔티티가 든 소스(`A[R&amp;D]`, `A["따옴표"]`) — 미리보기 입력과 원본 토큰 입력의 차이 확인용
3. 비교 보고서 `m1/report.html`: 샘플마다 mermaid(현재 설정, 패치 적용) | pele 1.10.0을 나란히, 라이트·다크, 미리보기 폭 560px·800px(640px 아래·위), `responsive` `true`/`false`.
4. 내보내기 시제품: 샘플 문서 1개를 HTML·PDF(앱에서 인쇄 → PDF 저장)·DOCX로 내보내 결과를 보고서에 첨부(스크린숏 또는 파일). `--pele-*` 값을 풀어 넣은 경우와 넣지 않은 경우를 함께 보인다.
5. `m1/checks.md` — 기계 확인 표를 **맨 앞에** 둔다(acceptance.md AC-PREVIEW015-001의 항목 표). 각 항목에 실행 명령과 출력, PASS/FAIL.
6. 다이어그램이 많은 문서(샘플 30개 이상)에서 mermaid와 pele의 첫 렌더 시간을 같은 기기에서 측정해 표로 기록(성능 목표 참고: `.moai/project/tech.md:350` "Mermaid diagram render < 500ms").
7. 픽스처 캡처(design.md D14): pele 1.10.0 실제 출력(정화 전·후)을 두 묶음으로 저장한다. `src/test/fixtures/pele/unit/`은 vitest jsdom에서 단위 테스트와 같은 측정기로, `src/test/fixtures/pele/browser/`는 비교 페이지(webkit·캔버스 측정기)에서 캡처한다. `manifest.json` 각 항목에 입력·옵션·pele 버전·캡처 날짜·캡처 환경(실행기와 버전)·측정기(`jsdom-default` / `fixed-width-test` / `canvas`)를 적는다. 손으로 쓴 SVG는 넣지 않는다.
8. vitest jsdom에서 pele가 렌더되는지(캔버스 측정기가 없을 때의 동작) 확인해 보고서에 기록하고, 단위 테스트 측정기(`jsdom-default` 또는 `fixed-width-test`)를 정해 design.md D14에 적는다 — M3 테스트 방식과 `unit/` 픽스처 캡처가 여기에 달려 있다.
9. 수식 라벨(design.md D15): 수식이 든 샘플 1개를 현재 앱의 mermaid strict 설정과 pele + `sanitizeSvg`로 각각 렌더해, 수식이 표시되는지 **측정해 기록만** 한다(단정하지 않음).

**게이트:** 보고서를 사용자에게 보이고 통과/보류를 사용자가 정한다. 오케스트레이터가 `AskUserQuestion`으로 묻고, 결과(판정, `responsive` 선택, D5 변수 목록, D14 단위 테스트 측정기)를 progress.md §E.2에 기록하고, 확정 값은 manager-spec 재위임으로 design.md에 반영한다.
- **보류**: 여기서 멈춘다. 브랜치는 머지하지 않고 그대로 두며, 보류 이유와 다시 볼 조건(예: pele 다음 버전, 이슈 #29 해결)을 progress.md에 적는다. M2 이후 작업은 하지 않는다.
- **통과**: M1b로 간다.

Reference: research.md §1.7, §4.5, §8 / `.moai/reports/mermaid-pele-feasibility-2026-10-24.md` §5(주 체크아웃)

### M1b (Priority High, **HUMAN GATE — M1 보강**) — 다이어그램 수식 해석기 시험

M1 판정 뒤 사용자가 다이어그램 안 수식을 pele `math` + 기존 `katex`로 지원하기로 정했다(design.md D15). M1과 같이 운영 코드를 바꾸지 않고 `spike/pele/` 안에서 측정만 한다. 모든 항목은 측정으로 확인하고, 추정으로 채우지 않는다.

1. **미리보기 렌더**: KaTeX 해석기를 넘긴 pele 출력을 webkit 비교 페이지에서 렌더해 `foreignObject.pele-math` 안에 수식이 보이는지, `width`·`height`가 맞는지 기록한다(`18-math-label` 샘플, 스크린숏).
2. **정화 허용 목록 왕복**: 다이어그램 전용 정화 경로(D4)를 거친 뒤 `foreignObject.pele-math`와 KaTeX HTML이 남고, `class`가 다른 `foreignObject`·`<script>`·`on*` 속성은 지워지는지 확인한다. 같은 실행에서 공유 `sanitizeSvg`의 결과(SVG 파일 뷰어 경로)가 M1과 바이트 단위로 같은지도 확인한다(공유 설정 무영향).
3. **HTML 내보내기**: 내보낸 HTML을 앱 밖 브라우저로 열어 수식이 보이는지 확인한다. KaTeX CSS가 없을 때의 표시도 함께 기록한다.
4. **DOCX PNG**: 현재 DOCX 래스터화 방식(SVG→data URI→`Image`→canvas)으로 `foreignObject` 수식이 PNG에 그려지는지 확인한다.
5. **CSP**: 앱 CSP(`index.html:7`) 아래에서 콘솔 CSP 오류가 없는지 확인한다.

결과는 `m1/checks.md`에 "M1b" 표로 덧붙인다. **게이트**: 오케스트레이터가 결과를 사용자에게 보이고 `AskUserQuestion`으로 판정을 받는다. DOCX(항목 4)가 실패하면 DOCX만의 처리 방식도 이 게이트에서 사용자가 정한다. 판정 뒤 manager-spec 재위임으로 spec REQ-025·AC-025와 design.md D4·D15를 최종 문구로 바꾼다. 그 전에는 M2로 가지 않는다.

**M1b 결과(2026-10-26)**: 사용자 판정 **통과**. 해석기 출력 `mathml-bare`, DOCX 별도 대체안 없음, 기존 CSP 글꼴 결함은 백로그 `t1`. 최종 문구는 spec v0.4.0 REQ-003·025, AC-025, design.md D4·D15에 반영했다. 수식 픽스처는 아직 `src/test/fixtures/pele/`에 없으므로 M2에서 `mathml-bare` 출력의 정화 결과(구조)를 실제 렌더로 캡처해 추가한다(D14 원칙).

### M2 (Priority High) — 다이어그램 모듈, 의존성, 테마 토큰

- 새 모듈 `src/lib/diagram/diagramRenderer.ts`(D3·D4·D9)와 `src/test/diagramRenderer.test.ts`(실제 pele + 픽스처).
- 다이어그램 글꼴 상수와 `--pele-font`·`--pele-font-mono` 연결(design.md D5): **먼저** M1 `unit/` 캡처(정화 전·후 38쌍)를 `src/test/fixtures/pele/m1-frozen/`으로 옮기고 매니페스트에 `frozen: true`를 단다(다시 캡처하지 않는 고정 기준). 그다음 일반·고정폭 글꼴 상수를 정해 `fontFamily`·`fontFamilyMono` 고정 옵션에 넣고, 두 CSS 변수를 같은 리터럴 목록으로 적은 뒤 `src/test/fixtures/pele/unit/`과 `browser/` 픽스처를 다시 캡처해 매니페스트 옵션에 두 값을 기록한다. 수식 픽스처(`mathml-bare` 정화 결과)도 이때 실제 렌더로 캡처한다(크기 결정 방법 기록, design.md D14).
- `package.json`: `mermaid` 제거, `pele: "1.10.0"`, `patch-package` devDependency·`postinstall` 제거. `patches/mermaid+11.12.3.patch` 삭제(`patches/` 폴더가 비면 함께 삭제). `package-lock.json` 재생성.
- `src/styles/mdedit-tokens.css` 두 블록에 `--pele-*` 정의(D5).
- 가드 테스트: `src/test/diagramRegressionGuard.test.ts:13-50`(의존성 집합에서 `mermaid` 빼고 `pele` 넣기, `pele === '1.10.0'`), `src/test/aiDiagramTypeRegressionGuard.test.ts:13-31`(같은 핀). 프리셋·키바인딩 단언(`:52-76`, `:34`, `:60-76`)은 그대로.

Reference: research.md §1.6, §3.1, §4.1, §6

### M3 (Priority High) — 미리보기·AI 호출부 교체

- `src/components/preview/PreviewRenderer.tsx`: mermaid import·`MERMAID_BASE_CONFIG`·`initialize` 제거, 비동기 `forEach` 제거(동기 렌더), `isDark` 의존성과 matchMedia 재렌더 경로(`:78-94`, `:176`) 제거. 오류 문구는 D9. 링크 클릭 처리(`:136-170`)는 마크다운 본문 링크용이므로 유지.
- `src/lib/ai/mermaidValidate.ts`: 계약 유지, 내부만 모듈 호출. `MERMAID_STRICT_CONFIG` 제거.
- `src/components/editor/extensions/ai-suggestion-card.ts:1287-1298` `renderMermaidInto`: 모듈 사용, 동적 import 제거.
- `src/test/insertDiagram.test.ts:217-228`: 프리셋 7종을 모듈로 렌더.
- mock 테스트 개정: `PreviewRenderer.test.tsx`(initialize 단언 `:242-283`, `:361`, `:440`은 "재렌더 없음·노드 유지"와 "위치 접미사" 단언으로 대체), `mermaidValidate.test.ts`(`'Parse error'` 단언 → 실제 pele 메시지 존재), `renderer.test.ts:18`·`MarkdownPreview.test.tsx:18`(mermaid mock 제거 또는 모듈 mock), `aiCardRetryLimit.test.ts:25`, `aiSuggestionCardRerequest.test.ts:25`, `aiSuggestionCard.test.ts`.

Reference: research.md §1.2-§1.4, §4.2-§4.3

### M4 (Priority High) — 내보내기를 원본 렌더로

- `src/lib/export/exportHtml.ts:99-131` `replaceMermaidPlaceholders` → 자리마다 모듈 렌더 + 색 값 풀어 넣기(D6·D7). 전역 `document.querySelectorAll('.mermaid-container')` 의존 제거.
- `src/lib/export/exportDocx.ts:79, 125-201, 241-272` → 펜스마다 렌더·PNG, 크기 D8, 실패 시 코드 텍스트(D7). `mermaidImages.shift()` 순서 의존 제거.
- `src/lib/export/exportPdf.ts`: HTML 생성 경로 재사용이므로 원칙상 무변경. 인쇄 스타일이 다이어그램 색을 덮는지 M1 결과에 따라 확인만.
- `src/lib/export/exportUtils.ts:43-73`: 다이어그램 배경 등 기존 mermaid 전용 CSS(`:71`, `:253-260`, `:274`)를 pele 출력에 맞게 정리(선택자 `.mermaid-container` 유지).
- 테스트: `src/test/exportImageEmbed.test.ts:306-330` DM1을 "미리보기 DOM 없음 + 원본 펜스 → PNG `ImageRun` 1회"로 재작성, `:109` 정리 코드 정리. 새 테스트(에디터 단독·위치 대응·색 풀어 넣기·엔티티 입력 일치)는 acceptance.md 배치표.

- 수식 다이어그램 내보내기 확인: AC-020 문서에 수식 다이어그램을 넣어 `foreignObject.pele-math` 안쪽까지 `var(--pele-` 치환을 단언하고, AC-025에서 `exportToHtml`과 PDF 경로 `generateHtmlContent` 모두 KaTeX CSS 없이 `<math>`를 담는지 단언한다. 앱 PDF 인쇄 결과의 수식 표시는 수동 확인(AC-025 manual)이다.

Reference: research.md §2.1-§2.5, §8-1, §8-8

### M5 (Priority Medium) — e2e 개정

- `e2e/mermaid-subgraph-label.spec.ts`: `.cluster-label foreignObject` 측정(`:59`, `:73-98`)을 pele SVG의 서브그래프 제목 `<text>` 측정으로 바꾼다. 목표(한 줄, 상자 겹침 없음 `:116-150`)는 유지. 선택자는 M1에서 확인한 실제 구조를 쓴다.
- `e2e/markdown-render.spec.ts:41, 61`, `e2e/ai-inline-edit.spec.ts:230, 238`: 선택자 유지(D10), 대기 조건만 확인.
- 새 e2e: 다이어그램 안 클릭 시 이동 없음(AC-PREVIEW015-012), 테마 토글 시 SVG 노드 유지·색 변경(AC-PREVIEW015-011).

Reference: research.md §4.5

### M6 (Priority Medium) — 다른 SPEC 개정

- spec.md "다른 SPEC 개정" 표대로 7개 SPEC의 본문을 고친다. **이 편집은 manager-spec 소유**이므로 오케스트레이터가 M5 완료 뒤 manager-spec에 재위임한다(manager-develop은 SPEC 본문을 고치지 않음). 각 SPEC: 해당 REQ 문구 교체, HISTORY 1행 추가("SPEC-PREVIEW-015로 개정"), `version` 패치 증가, `updated: 2026-10-26` 이후 날짜. `status`는 바꾸지 않는다.
- **완료된 SPEC 주의 (SPEC-EXPORT-004)**: SPEC-EXPORT-004는 `status: completed`다. M6은 그 본문(REQ-EXPORT004-012)을 HISTORY 1행 + `version` 패치 증가로 고치고 `status`는 그대로 두는 것을 기본안으로 한다. 단, **편집 전에** `moai spec audit --spec SPEC-EXPORT-004`(또는 MCP `spec_audit`, `filter_spec: SPEC-EXPORT-004`)를 실행해 완료된 SPEC의 본문 편집이 drift로 잡히는지 확인하고, 프로젝트에 완료 SPEC 개정 규약(`spec-frontmatter-schema.md`의 `completed → in-progress (amendment)` 전이, `amendment_of:`, HISTORY `## Amendments`)을 적용해야 하는지 판단한다. 확인한 명령·출력·택한 방식을 progress.md에 기록한다. 결과는 지금 정하지 않는다.

### M7 (Priority Low) — 정리, 게이트, MX

- `spike/pele/` 삭제(D11). 캡처한 픽스처 `src/test/fixtures/pele/`(`unit/`·`browser/`)와 `manifest.json`은 **남긴다**(단위 테스트·구조 확인의 기준). `node_modules`에 mermaid가 남지 않았는지 확인.
- 남은 mermaid 참조 검사: `grep -rn "from 'mermaid'\|import('mermaid')\|vi.mock('mermaid'" src e2e` 결과 0건.
- 게이트: acceptance.md "기계 검증 게이트".
- MX: 새 모듈 공개 함수에 `@MX:ANCHOR`(호출부 4곳 이상), `PreviewRenderer.tsx:25-28`·`mermaidValidate.ts:4-5`의 `securityLevel` 경고 주석을 아래 "MX Tag Plan" 표에 적힌 strict 모드 문구로 교체(문구는 그 표가 기준).

### Sync 단계 (manager-docs)

- `docs/USER_MANUAL.md:498-665` 부록 갱신, 목차 `:15` 앵커 수정, `:29`, `:75-80`, `:94` 언급 확인.
- `docs/USER_GUIDE.md:206-208`(`### Mermaid 다이어그램` 절, 테마 전환 즉시 재채색 → 재렌더 없이 색 전환), `:236`, `:320` 확인.
- **다이어그램 수식·DOCX 색 안내**: `docs/USER_MANUAL.md` Mermaid 부록과 `docs/USER_GUIDE.md` `### Mermaid 다이어그램` 절에 다이어그램 안 `$$…$$` 수식이 KaTeX로 그려지며 HTML·PDF·DOCX 내보내기에도 그대로 들어간다는 점, 글자와 수식을 섞은 라벨도 그려진다는 점(design.md §4)을 적는다(design.md D15). DOCX 다이어그램은 항상 라이트 색으로 들어간다는 안내도 함께 넣는다(design.md D6).
- `README.md:15, 104`("Mermaid 11.12.3" → pele 1.10.0, Mermaid 문법 지원).
- `.moai/project/tech.md:43, 126-131, 224, 350`, `.moai/project/structure.md:229, 250, 335, 508`, `.moai/project/codemaps/*`의 mermaid 언급.

## MX Tag Plan (mx_plan)

> 2026-10-26 worktree(929d116)에서 대상 파일마다 `grep -n "@MX:" <file>`로 기존 태그를 확인하고 세운 계획이다. 태그 본문은 `code_comments: ko`에 따라 한국어로 쓴다. 적용은 해당 마일스톤의 manager-develop이 하고, M7에서 전체를 다시 확인한다.

### 새로 붙일 태그

| 파일 | 위치 | 태그 | 내용(요지) | 마일스톤 |
|------|------|------|-----------|----------|
| `src/lib/diagram/diagramRenderer.ts` (신규) | 렌더 진입 함수 | `@MX:ANCHOR` + `@MX:REASON` | 미리보기·AI 검증·AI 카드·HTML/PDF/DOCX 내보내기가 모두 이 함수를 지난다(fan_in ≥ 3, M3·M4 이후 5곳 이상). 옵션·정화 단계를 바꾸면 모든 경로가 함께 바뀐다 | M2 |
| 같은 파일 | 검증 진입 함수 | `@MX:ANCHOR` + `@MX:REASON` | `validateMermaid`가 이 함수로 렌더 함수를 그대로 호출한다(design.md D3). `parse`만 부르도록 바꾸면 검증·미리보기 불일치가 다시 생긴다 | M2 |
| 같은 파일 | 고정 옵션 상수 | `@MX:NOTE` + `@MX:WARN` + `@MX:REASON` | `autoDirection: false`·`links: false`·`images: false`는 사용자 결정(design.md D2·D13). `links`를 켜면 스킴 검증 없는 `open_url_in_browser` 경로가 열리고, `images`를 켜면 정화기 하나에만 외부 요청 차단을 맡기게 된다 | M2 |
| 같은 파일 | 색 값 치환 함수 | `@MX:WARN` + `@MX:REASON` | 내보내기 테마 기준으로 모든 `var(--pele-…)`를 치환해야 한다. 하나라도 남으면 pele 대체값(라이트)으로 그려져 다크 내보내기가 조용히 라이트가 된다(AC-020) | M4 |
| 같은 파일 | 다이어그램 전용 정화 경로 | `@MX:WARN` + `@MX:REASON` | 전역 DOMPurify 인스턴스를 쓰거나 훅을 전역에 걸면 SVG 파일 뷰어의 `sanitizeSvg`로 새어 든다(M1b 측정 43회). 별도 `DOMPurify(window)` 인스턴스에서 href 차단 훅을 다시 등록해야 한다(design.md D4) | M2 |
| 같은 파일 | KaTeX 수식 해석기 | `@MX:NOTE` | `output: 'mathml'` + 바깥 `.katex` 제거(`mathml-bare`), `trust: false`. HTML 출력은 webkit에서 어긋나 탈락(design.md D15) | M2 |
| 같은 파일 | `idPrefix` 생성부 | `@MX:NOTE` | 한 문서 안 SVG `id` 충돌 방지(design.md D3, AC-010·017) | M2 |
| `package.json` 대신 가드 테스트 `src/test/diagramRegressionGuard.test.ts` | pele 핀 단언 | `@MX:NOTE` | `pele`는 `1.10.0` 정확 고정. 올릴 때는 별도 SPEC에서 M1과 같은 비교를 거친다(JSON 파일에는 주석을 달 수 없어 가드 테스트에 둔다) | M2 |
| `src/lib/markdown/mermaidPlugin.ts` | `data-diagram` 이스케이프 줄(`:19`) | `@MX:NOTE` 추가 | `"`만 `&quot;`로 바꾸는 계약이 렌더러 입력을 정한다. 미리보기와 내보내기가 같은 문자열을 써야 한다(REQ-006·015). 이스케이프 범위를 바꾸면 내보내기 입력 변환도 함께 바꿔야 한다 | M4 |
| `src/lib/export/exportDocx.ts` | 펜스별 다이어그램 렌더·PNG 변환부 | `@MX:WARN` + `@MX:REASON` | SVG→data URI→canvas 변환은 비동기이며 펜스 위치와 결과를 짝지어야 한다. 순서를 큐로 되돌리면 밀림 결함(AC-019)이 다시 생긴다 | M4 |

### 고치거나 지울 태그 (mermaid를 가리키는 기존 태그)

| 파일:줄 | 기존 태그 | 처리 |
|---------|-----------|------|
| `src/components/preview/PreviewRenderer.tsx:7-8` | `@MX:ANCHOR` "mermaid 다이어그램을 처리하는 핵심 컴포넌트" | 문구를 "다이어그램 모듈로 렌더"로 고침, ANCHOR 유지 |
| `src/components/preview/PreviewRenderer.tsx:16-17` | `@MX:WARN` "mermaid.render()가 forEach 내부에서 async로 실행됨" | **삭제**. 동기 렌더로 바뀌어 대상 코드가 없어진다. 다이어그램별 개별 실패 처리는 `@MX:NOTE`로 남긴다 |
| `src/components/preview/PreviewRenderer.tsx:18` | `@MX:NOTE` "mermaid.parse()를 render() 전에 호출" | **삭제**(검증·렌더는 모듈 한 함수) |
| `src/components/preview/PreviewRenderer.tsx:27-28` | `@MX:WARN` "securityLevel을 'strict'보다 약한 값으로…" | "strict 모드 = pele 기본 보안 + 다이어그램 전용 정화(별도 DOMPurify 인스턴스, 재등록한 href 차단 훅, 수식용으로 foreignObject.pele-math·그 안의 감싸기 div·MathML 태그·semantics·annotation[encoding]만 추가 허용) + links/images false. 옵션·정화를 약화하지 않는다"로 교체 |
| `src/components/preview/PreviewRenderer.tsx:11` | `@MX:SPEC: SPEC-PREVIEW-010` | 유지하고 `SPEC-PREVIEW-015` 추가 |
| `src/components/preview/PreviewRenderer.tsx:116-119` | `@MX:NOTE` 빈 펜스 분기 | 유지(동작 무변경) |
| `src/lib/ai/mermaidValidate.ts:3-5` | `@MX:SPEC`·`@MX:WARN`·`@MX:REASON`(securityLevel) | SPEC 줄에 `SPEC-PREVIEW-015` 추가, WARN·REASON은 위와 같은 strict 모드 문구로 교체 |
| `src/lib/preview/svgSanitize.ts:1-2` | `@MX:ANCHOR` "fan_in >= 2" | ANCHOR·REASON 유지. 실제 호출부는 그대로 2곳(PreviewRenderer 인라인 svg, SvgFileViewer)이다. 다이어그램 모듈은 `sanitizeSvg`를 호출하지 않고 별도 DOMPurify 인스턴스를 쓴다(design.md D4). 기존 WARN(`:10-11`, `:37-39`)은 유지 |
| `src/lib/export/exportDocx.ts:32` | `@MX:NOTE` "mermaidImages array is consumed via shift() - order must match DOM order" | **삭제**(DOM 캡처·`shift()` 제거) 후 위 새 WARN으로 대체 |
| `src/lib/export/exportHtml.ts:1-5`, `src/lib/export/exportDocx.ts:2-3` | `@MX:SPEC` 목록 | `SPEC-PREVIEW-015` 추가 |
| `src/components/editor/extensions/ai-suggestion-card.ts:1287-1298` | 태그 없음 | `renderMermaidInto`에 `@MX:NOTE`(모듈 사용, 정화된 SVG, 테마는 CSS 변수로 자동 반영) 추가 |

### 확인만 하고 바꾸지 않는 태그

- `src/lib/export/exportUtils.ts:1-4`, `:130-132`, `src/lib/export/exportPdf.ts:9-11`, `src/components/editor/extensions/keyboard-shortcuts.ts:159-177`(프리셋 규칙): mermaid 라이브러리를 가리키지 않으므로 그대로 둔다. `src/styles/mdedit-tokens.css`에는 기존 태그가 없고 CSS 토큰 블록에는 새 태그를 붙이지 않는다.

## 위험

| 위험 | 대응 |
|------|------|
| pele는 공개 약 3주된 라이브러리(2026-10-05 저장소 생성) | 정확 고정(REQ-021) + 가드 테스트(REQ-022). 업그레이드는 별도 SPEC에서 M1과 같은 비교를 거친다 |
| 자체 레이아웃 엔진이라 기존 다이어그램 배치가 바뀜 | M1 나란히 비교로 사용자가 판정. 보류 경로가 있다 |
| 다크 대비 부족(pele 이슈 #29, `classDef` 색 노드) | M1에서 실물 확인. 받아들일 수 없으면 보류 사유가 된다. 앱 쪽 우회(토큰 조정)가 가능하면 D5에 적는다 |
| 내보낸 파일에서 색 소실 | D6 모든 `var(--pele-…)`를 내보내기 테마의 실제 값으로 치환. M1에서 HTML·PDF·DOCX 실물 확인, M4 단위 테스트(AC-020)로 형식·테마별 `var(--pele-` 0건 + 해당 테마 값 존재 고정 |
| `data-diagram` 이스케이프 계약(`mermaidPlugin.ts:19`는 `"`만 바꿈)이 미리보기·내보내기 입력 차이를 만듦 | **M1에서 닫힘**: 입력은 다르지만 pele 출력은 바이트 동일(checks 확인 10, `svgEqual: true`)이라 지금은 출력 차이가 없다. 그래도 REQ-006·015의 같은 입력 계약은 pele 업그레이드 대비로 유지하고, M4 단위 테스트(AC-017)로 입력 일치를 고정한다 |
| 여러 다이어그램의 SVG 내부 `id` 충돌(화살표 마커가 다른 다이어그램 정의를 가리킴) | D3 고유 `idPrefix`. AC-PREVIEW015-010(미리보기)과 AC-PREVIEW015-017(내보낸 HTML)에서 `id` 중복 0건 단언 |
| jsdom에 캔버스가 없어 pele 글자 폭 측정이 다르게 동작 | **M1 해소**: jsdom에서 pele가 내장 글자 폭 표로 결정적으로 렌더함을 확인했고 단위 테스트 측정기를 `jsdom-default`로 정했다(픽스처 재렌더 76/76 일치, design.md D14). 바이트 비교는 같은 측정기 픽스처끼리만 한다. 레이아웃 수치 단언은 e2e(webkit)에만 둔다 |
| 다이어그램 전용 정화 경로가 pele 출력의 일부(`<style>`, 인라인 style, `id` 참조, 수식 MathML)를 지움 | M1(report F6)·M1b(2b)에서 정화 뒤 모양 유지를 확인했다. M2 AC-005(수식 없는 입력에서 공유 `sanitizeSvg`와 결과 일치)와 AC-025(수식 구조 유지)로 고정한다. 깨지면 허용 목록을 넓히지 않고 blocker로 보고해 사용자에게 다시 묻는다 |
| 다이어그램 안 외부 이미지(pele 기본 `images: true`) | D13 `images: false`로 렌더 단계에서 차단하고, 정화 단계에서 다이어그램 전용 정화 경로(별도 DOMPurify 인스턴스에 다시 등록한 href 차단 훅, design.md D4)가 스킴 있는 `href`를 다시 지운다. 공유 `sanitizeSvg` 훅은 별도 인스턴스에 물려지지 않는다(M1b 2d). AC-PREVIEW015-012로 정화 전·후 외부 이미지 href 0건 고정 |
| Windows `open_url_in_browser` 스킴 미검증(`browser_ops.rs:11-29`) | `links: false`로 다이어그램에서 닿지 않는다. 마크다운 본문 링크 경로는 기존 그대로이며 별도 보안 정리 후보 |
| Windows WebView2 렌더 차이 | 자동 검증 없음. Windows에서 미리보기·DOCX 수동 확인 1회 권장(acceptance.md 검증 경계) |
| 오류 메시지 문구 변경으로 AI 재요청 품질 변화 | `이전 오류: …` 흐름은 유지. pele 메시지는 위치·코드를 담으므로 품질 저하 가능성은 낮다고 본다(추정) — e2e `ai-inline-edit` 재요청 시나리오로 흐름만 고정 |

## 변경 파일

| 파일 | 마일스톤 | 변경 |
|------|----------|------|
| `spike/pele/**` | M1 생성 → M7 삭제 | 시험 렌더링 코드 |
| `.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/{report.html,checks.md}` | M1 | 비교 보고서·기계 확인 표 |
| `src/test/fixtures/pele/**` | M1·M2 | 실제 렌더 캡처 픽스처 + `manifest.json`. M2에서 M1 `unit/` 캡처를 `m1-frozen/`(고정 기준, 재캡처 없음)으로 옮기고 `unit/`·`browser/`를 `fontFamily`·`fontFamilyMono` 반영 뒤 다시 캡처, 수식 픽스처 추가 |
| `src/lib/diagram/diagramRenderer.ts` (신규) | M2 | 렌더·검증·위치 문구·색 풀어 넣기, KaTeX `mathml-bare` 수식 해석기, 별도 DOMPurify 인스턴스의 다이어그램 전용 정화 경로 |
| `src/test/diagramRenderer.test.ts` (신규) | M2 | 모듈 단위 테스트 |
| `package.json`, `package-lock.json` | M1·M2 | pele 추가, mermaid·patch-package·postinstall 제거 |
| `patches/mermaid+11.12.3.patch` | M2 | 삭제 |
| `src/styles/mdedit-tokens.css` | M2 | `--pele-*` 정의 |
| `src/test/diagramRegressionGuard.test.ts`, `src/test/aiDiagramTypeRegressionGuard.test.ts` | M2 | 의존성 집합·핀 개정 |
| `src/components/preview/PreviewRenderer.tsx` | M3 | 모듈 사용, 전역 설정·재렌더 제거 |
| `src/lib/ai/mermaidValidate.ts` | M3 | 내부만 모듈로 |
| `src/components/editor/extensions/ai-suggestion-card.ts` | M3 | `renderMermaidInto` 모듈 사용 |
| `src/test/{insertDiagram,PreviewRenderer,mermaidValidate,renderer,MarkdownPreview,aiCardRetryLimit,aiSuggestionCardRerequest,aiSuggestionCard}.test.ts(x)` | M3 | mermaid 의존 단언 개정 |
| `src/lib/export/exportHtml.ts`, `src/lib/export/exportDocx.ts`, `src/lib/export/exportUtils.ts` | M4 | 원본 렌더·색 풀어 넣기·위치 대응·크기 |
| `src/test/exportImageEmbed.test.ts` + 새 내보내기 다이어그램 테스트 | M4 | DM1 재작성, 새 AC 테스트 |
| `e2e/mermaid-subgraph-label.spec.ts`, `e2e/markdown-render.spec.ts`, `e2e/ai-inline-edit.spec.ts` + 새 e2e | M5 | 측정 대상 개정, 링크·테마 e2e |
| 7개 SPEC `spec.md`(+ SPEC-UI-008 `acceptance.md`) | M6 | 요구 문구 개정 (manager-spec) |
| `docs/USER_MANUAL.md`, `docs/USER_GUIDE.md`, `README.md`, `.moai/project/*` | Sync | 문서 |

변경하지 않는 파일: `src/lib/preview/svgSanitize.ts`, `src/lib/markdown/mermaidPlugin.ts`, `src/components/editor/extensions/keyboard-shortcuts.ts`(프리셋), `src-tauri/**`(프롬프트·`browser_ops.rs` 포함), `index.html`(CSP), `src/lib/export/types.ts`, `src/lib/image/imageResolver.ts`.

## Open questions

- 없음. `images` 옵션은 사용자가 `images: false`로 정했다(D13).

### research.md §9 질문의 처리

research.md는 조사 기록이라 고치지 않고, §9의 열린 질문이 어디서 해소되었는지 여기에 적는다.

| §9 | 질문 | 처리 |
|----|------|------|
| 1 | 로컬 `main`을 `origin/main`에 맞출지 | 해당 없음 — 이 SPEC은 `origin/main`(929d116) 기준 worktree(`WT-pele-renderer`)에서 진행한다 |
| 2 | 내보내기를 원본 렌더로 바꿀지 | 해소 → spec REQ-015·016·017, design.md D6·D7 |
| 3 | pele `links`를 지원할지 | 해소 → 지원하지 않음, spec REQ-011, design.md D2 |
| 4 | 다크 테마 처리와 내보내기 값 출처 | 해소 → design.md D5(토큰 연결), D6(내보내기 `theme` 기준 값 치환) |
| 5 | AI 카드 미니 렌더 다크 대응 | 해소 → spec REQ-013 |
| 6 | `PeleError` 위치를 AI 재요청에 넣을지 | 해소 → design.md D9(`error` = `PeleError.message` 그대로), 테스트 단언은 AC-014 |
| 7 | 프리셋·`stateDiagram-v2`·`mindmap`·`pie` 지원 여부 | M1에서 측정 → AC-001 확인 항목 1, AC-016 |
| 8 | USER_MANUAL 목차 앵커 수정 | 해소 → spec REQ-024, sync 단계 |

## 결정 이력

- 2026-10-26: 사용자가 전면 교체, pele 1.10.0 정확 고정, M1 사람 게이트, 원본 렌더 내보내기, 오류 위치 접미사 형식, `links: false`, 범위 제외 항목을 정했다(오케스트레이터 전달). `responsive` 선택과 `--pele-*` 변수 목록은 M1 판정으로 넘겼다(D2·D5).
- 2026-10-26: Open questions의 `images` 옵션을 사용자가 `images: false` 고정으로 정했다(D13). 미결 표지는 없다.
- 2026-10-26: plan-audit iteration 1(FAIL 0.76, `.moai/reports/plan-audit/SPEC-PREVIEW-015-review-1.md`)의 D1–D12를 반영했다. 오케스트레이터 결정: 색은 치환 한 가지 방식(D6), `design.md` 신설(예외 없음), AC-024는 개정 대상 줄만 검사, 픽스처 매니페스트에 캡처 환경·측정기 기록(D14), 수식 라벨 미지원(D15 — 이후 M1b 뒤 KaTeX `mathml-bare` 지원으로 변경, design.md D15), 통과형 감시 래퍼 허용.
- 2026-10-26: plan-audit iteration 4(PASS-WITH-DEBT 0.88, `.moai/reports/plan-audit/SPEC-PREVIEW-015-review-4.md`)의 N1–N8을 반영했다. 고정 기준 묶음 `m1-frozen/` 도입(공유 `sanitizeSvg` 비교는 다시 만들지 않는 M1 값과 함), strict 모드 허용 목록을 REQ-003·D4와 같게, `fontFamilyMono` 추가와 리터럴 글꼴 목록 비교 절차, AC-020 수식 크기 주입, AC-025 기준 비교 완화, `browser/` 재캡처.
