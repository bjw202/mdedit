# SPEC Review Report: SPEC-UI-008
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.71

Note: 호출 시 작성자 추론 컨텍스트(author reasoning)는 전달되지 않았다. 전달되었더라도 M1 Context Isolation에 따라 무시했을 것이다. 감사 입력물: spec.md(주 입력), SPEC-UI-007 spec.md/acceptance.md(구조·스키마 대조), 소스 파일(EditorToolbar.tsx / keyboard-shortcuts.ts / PreviewRenderer.tsx / mermaidPlugin.ts / AppLayout.tsx), mermaid 11.12.3 런타임 파싱 검증. **주의: SPEC-UI-008 디렉터리에는 spec.md만 존재하며 acceptance.md/plan.md/tasks.md는 부재한다**(UI-007은 6종 아티팩트 보유).

## Must-Pass Results

- [PASS] MP-1 REQ 번호 일관성: REQ-UI-008-001 ~ 020을 끝까지 개별 확인(spec.md:L70–L98). Ubiquitous 001–004(L70–73), Event 005–010(L77–82), State 011–014(L86–89), Unwanted 015–020(L93–98) = 4+6+4+6 = 20개. 순차, 결번 0, 중복 0, 3자리 zero-padding 일관. AC ID AC-UI-008-001..012도 순차(L239–L250).
- [PASS] MP-2 EARS 형식 준수: Ubiquitous 001–004 "The system shall"(L70–73), Event 005–010 "WHEN …, the system shall"(L77–82), State 011–014 "WHILE …, the system shall"(L86–89), Unwanted 015/017/018/019/020 "The system shall not …"(단일 부정 — UI-007의 이중부정 결함을 회피, 정상). AC 표(L237–250)는 EARS로 위장되지 않은 매핑 요약이며 실제 Given-When-Then은 acceptance.md로 위임됨(위장 없음). **주의: REQ-016은 긍정형 "shall"이 Unwanted 헤딩 아래 배치되어 패턴 불일치 — D1로 품질 결함 기록(MP 실패 아님, 선례 UI-007의 REQ-015 처리와 동일 기준).**
- [PASS] MP-3 YAML frontmatter 유효성: id "SPEC-UI-008" 문자열(L2), version "0.0.1" 문자열(L3), status "draft" 문자열(L4), created "2026-07-22" ISO 날짜(L5), priority "medium" 문자열(L8), tags 6개 문자열 배열(L15–21). 필드명 `created`/`tags`(제네릭 `created_at`/`labels` 대신)는 UI-006/UI-007/PREVIEW-010과 동일한 프로젝트 표준 스키마 — 결함 아님.
- [N/A] MP-4 Section 22 언어 중립성: N/A — 단일 언어 SPEC(mdedit TypeScript/React 프런트엔드; spec.md:L32, L60). 다중 언어 툴링 범위 없음.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 (경미한 모호성, 일관 해석 가능) | 스니펫·삽입 계약·테마 상속 정의가 상호 일관(L33–35, L54–55). 모호성 원천은 REQ-002 "16–24px 판독 가능"(L71, 주관적)과 REQ-016 "정상 동작시킨다"(L94, weasel)에 국한 |
| Completeness | 0.75 | 0.75 (비핵심 아티팩트 1종 결여) | spec.md 섹션 완비: HISTORY(L25), WHY=Background(L45), WHAT=Summary(L31), HOW=Delta(L218), Requirements(L66), AC(L233), Exclusions 9항목(L258–266). frontmatter 완전. 단, 참조된 acceptance.md 부재(D3) + Delta가 PreviewRenderer 플레이스홀더 테스트 아티팩트 누락(D5) |
| Testability | 0.75 | 0.75 (일부 AC/REQ 비이진) | AC-004(스니펫 7종 parse)는 객관 검증 가능 — **감사자가 mermaid 11.12.3으로 7종 전부 parse PASS 확인**. 그러나 REQ-002 판독성은 비이진(AC-002는 SVG 존재만 확인, 판독성 미검증), REQ-016 "정상 동작" weasel. AC-006/007용 렌더 테스트가 Delta에 미열거 |
| Traceability | 0.50 | 0.50 (복수 REQ 미커버) | AC 표(L237–250)가 REQ-001~017,019는 커버하나 **REQ-018(신규 런타임 의존성 금지)과 REQ-020(나머지 17종/신규 단축키 금지)에 대응 AC가 전무**. 매 AC 행을 대조해 확인(샘플링 아님). 또한 "1:1 매핑" 주장(L235)의 상대 파일 acceptance.md가 부재하여 매핑 검증 불가 |

## Defects Found

D1. spec.md:L94 — REQ-UI-008-016 "The system **shall** AI 토글 … 무관하게 … 노출하고 정상 동작시킨다"는 **긍정형 요구사항**이나 "Unwanted Behavior Requirements" 헤딩(L91) 아래 배치되어 패턴이 불일치한다. Unwanted 절은 금지형("shall not") 또는 EARS "IF … then" 형식이어야 하며, 본 요구는 Ubiquitous 절로 이동해야 한다. 추가로 "정상 동작시킨다"는 비이진 weasel 표현(UI-007 D5 "정상적으로"와 동형)으로, 무엇이 "정상"인지 이진 판정 불가. — Severity: major

D2. spec.md:L237–L250 — **REQ-018과 REQ-020이 어떤 AC로도 커버되지 않는다(uncovered REQ 2건).** AC-012(L250)는 015/016/017만 매핑하고 018(런타임 의존성 금지)·020(17종/단축키 금지)을 누락한다. 두 요구는 "shall not" 회귀 가드로서 검증 대상이 명확함에도(예: package.json 미변경, markdownKeyBindings 미변경) 대응 AC가 없다. Traceability 계약 위반. — Severity: major

D3. spec.md:L235, L252 — 참조 대상 acceptance.md 부재. spec.md는 "acceptance.md의 Given-When-Then 시나리오와 1:1 매핑"(L235)과 "상세 기준은 acceptance.md 'Quality Gate Criteria' 참조"(L252)로 **존재하지 않는 파일·섹션을 권위 있는 출처로 지목**한다. spec.md는 "acceptance.md는 승인 게이트 이후 작성"(L235 괄호)이라 자기 정당화하나, 그 결과 (a) AC 표의 1:1 매핑 주장은 현재 검증 불가하고(UI-007에서 D1 major로 드러난 매핑 drift 재발 위험), (b) Quality Gate 상세 기준은 감사 시점에 부재한다. 최소한 dangling 참조를 "작성 예정(TBD)"으로 명시하거나 Quality Gate 상세를 spec.md 내에 인라인해야 한다. — Severity: major

D4. spec.md:L71 / L240 — REQ-UI-008-002 "16–24px 크기에서 **판독 가능**하게"는 비이진 요구다. 대응 AC-002(L240)는 "프리셋 아이콘 렌더(SVG 존재)"만 어서션하여 판독성 자체는 검증하지 않는다. Design Notes(L213)가 "16–24px 판독성이 수용 기준"이라 Run phase 재량으로 완화하나, 정규 요구 본문의 판독성 문구는 테스터가 이진 판정할 수 없다. — Severity: minor

D5. spec.md:L227–L231 vs L235 — Delta의 테스트 아티팩트 목록([MODIFY] EditorToolbar.test, [NEW] insertDiagram.test, [NEW] DiagramInsertMenu.test)에 **PreviewRenderer 플레이스홀더 분기(REQ-011/012)를 검증할 테스트 파일이 없다.** L235는 "프리뷰 렌더 오류 부재는 관련 렌더 테스트로 검증"이라 명시하나 대상 파일(src/test/PreviewRenderer.test.tsx 수정 등)이 Delta에 미열거되어 AC-006/AC-007의 검증 아티팩트가 추적되지 않는다. (감사자 확인: 기존 PreviewRenderer.test.tsx:88–99의 "invalid diagram" 테스트는 non-empty mock reject라 빈-펜스→플레이스홀더 신동작과 충돌하지 않음 → 회귀 위험은 낮음. 그러나 신규 커버리지 부재는 별개 결함.) — Severity: minor

D6. spec.md:L96, L98, L71 — 요구 원자성(atomicity) 저하. REQ-020(L98)은 "17종 추가" 금지와 "신규 단축키 등록" 금지 두 개의 별개 prohibition을 한 REQ에 묶었고, REQ-002(L71)는 아이콘 렌더+판독성+테마 반전+raw hex 금지 4개 관심사를 한 REQ에 묶었다. 분해 시 D2의 AC 커버리지 부여도 용이해진다. — Severity: minor

## Chain-of-Verification Pass

2차 재검토 수행 대상: 전체 REQ L70–L98(20개 각 항목 개별 정독), AC 표 L237–L250(매 행 REQ 매핑 대조), Preset Snippet Definitions L104–L207, Exclusions L258–L266, Delta L220–L231, 요구 간 모순 스캔.

- REQ 시퀀싱 끝까지 재확인: 001–020 각 1회 존재, 결번·중복 없음.
- **AC-to-REQ 매핑 전수 대조에서 D2(REQ-018/020 미커버)를 포착** — 샘플링이 아니라 12개 AC 행 각각의 Requirement 열을 나열(001,002,003,004,005,006,007,008,009,010,011,012,013,014,015,016,017,019 커버 / 018·020 누락)해야만 드러남.
- **스니펫 런타임 검증(고신뢰)**: mermaid 11.12.3(`node_modules/mermaid` 확인)으로 7종 스니펫을 JSDOM+`mermaid.parse`에 통과시켜 **flowchart/sequenceDiagram/gantt/classDiagram/stateDiagram-v2/pie/mindmap 전부 PASS**. 파서 민감형인 gantt(dateFormat/section/task)와 mindmap(들여쓰기 계층)도 오류 없이 파싱됨. 빈 문자열은 "No diagram type detected …"로 throw → REQ-011(빈 본문 시 parse 생략·플레이스홀더)의 전제(L54 "`mermaid.parse('')`가 throw")를 코드·런타임 양면으로 확증.
- **통합 지점 실재 확인**: `onFormat`/`onInsertTable`/`aria-haspopup="true"`(EditorToolbar.tsx:41,43,142), `insertTable`/`EditorSelection.range|cursor`(keyboard-shortcuts.ts:119,26,35 — 커서 배치 REQ-007/008 실현 가능), `handleInsertTable`(AppLayout.tsx:300)·`isViewOnly`(L314)·`handleViewReady`(L227) — spec 인용 라인(L53,L61)과 일치. `data-diagram` 속성은 `src/lib/markdown/mermaidPlugin.ts:20`에 실재.
- **경미한 경로 표기 편차**: Summary/Background(L33,L54)는 mermaid 렌더러를 "`mermaidPlugin.ts`"로만 지칭하는데 실제 위치는 `src/components/preview/`가 아니라 `src/lib/markdown/mermaidPlugin.ts`다. Delta 표(L227)는 PreviewRenderer.tsx만 [MODIFY] 대상으로 올바르게 지정하고 mermaidPlugin은 변경 대상이 아니므로 실질 영향 없음 — 결함 등재 생략(관찰만).
- 모순 스캔: REQ-011(빈→플레이스홀더)과 REQ-019(기존 `⚠ Diagram syntax error` 폴백 불변)는 REQ-012(빈→비어있지 않게 되면 통상 경로 복귀)로 정합 연결되어 상호 모순 없음. Exclusions(단축키 없음)와 REQ-010(드롭다운 내 키보드 조작)은 L261에서 명시적으로 carve-out — 충돌 없음. 확정 범위(7 프리셋+빈 펜스, AI 범위 밖) 대비 은근한 범위 확장 없음.

## Regression Check (Iteration 2+ only)

N/A — iteration 1.

## Recommendation

FAIL — must-pass 실패는 없고 기술 검증(스니펫 7종 parse, 통합 지점 실재)은 견고하나, major 결함 3건(D1·D2·D3)이 승인 전 수정되어야 한다. 사실상 "조건부 통과"에 근접하며 아래 항목은 iteration 2에서 해소 가능하다.

수정 지시(manager-spec):

1. (D2, 필수) AC 표(L237–250)에 REQ-018·REQ-020 커버 행을 추가하라. 예: 기존 AC-UI-008-012를 확장하거나 신규 행 `AC-UI-008-013 | REQ-UI-008-018, 020 | package.json 신규 런타임 의존성 0건 + markdownKeyBindings 무변경 + 프리셋 목록 정확히 8항목(17종 미추가)`. 두 회귀 가드에 이진 검증 수단을 부여할 것.
2. (D1, 필수) REQ-UI-008-016을 "Unwanted Behavior Requirements"에서 "Ubiquitous Requirements"로 이동하고, "정상 동작시킨다"를 이진 검증 가능한 응답으로 치환하라(예: "… AI 토글 상태를 참조하지 않고 삽입 메뉴를 노출·삽입 동작을 수행한다"). Unwanted 절에는 REQ-015/017/018/019/020(shall not)만 남길 것.
3. (D3, 필수) L235·L252의 acceptance.md 참조를 정리하라. (a) acceptance.md를 지금 작성하거나, (b) "Quality Gate Criteria" 상세를 spec.md L252 근처에 인라인하고 dangling 참조를 "acceptance.md는 승인 후 생성 예정 — 현재 미존재"로 명시. "1:1 매핑" 주장은 실제 파일이 생기기 전까지 검증 불가임을 문서에 반영할 것.
4. (D5, 권장) Delta 테스트 목록(L227–231)에 PreviewRenderer 플레이스홀더 분기 검증 테스트(예: [MODIFY] `src/test/PreviewRenderer.test.tsx` — 빈/공백 `data-diagram` → 플레이스홀더 표시·`⚠ Diagram syntax error` 미표시)를 추가하여 AC-006/007에 추적 가능한 아티팩트를 연결하라.
5. (D4, 권장) REQ-002 판독성 문구를 Design Notes(L213, 이미 존재)로 완전히 이관하고, 정규 요구 본문에는 이진 검증 가능한 응답(SVG 렌더 + `currentColor` 상속 + raw hex 부재)만 남길 것.
6. (D6, 권장) REQ-020을 두 요구로 분해(17종 프리셋 금지 / 신규 단축키 금지)하여 원자성과 AC 매핑을 개선하라.

항목 1–3은 iteration 2 PASS의 필수 조건이다. 항목 4–6은 권장이며 비차단이다.
