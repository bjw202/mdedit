# SPEC Review Report: SPEC-AI-008
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.80

Note: 호출 프롬프트의 기능 설명·확정 결정은 감사 대상 사실이 아니라 배경으로만 취급했고, M1 Context Isolation에 따라 작성자 추론은 무시했다. 감사 입력물: spec.md(주 입력) + 현재 브랜치(`feature/SPEC-UI-008-diagram-insert-menu`)의 실제 소스(ai-selection-toolbar.ts / ai-suggestion-card.ts / ipc.ts / src-tauri/src/ai/{mod.rs,prompt.rs} / icons.tsx). **주의: SPEC-AI-008 디렉터리에는 spec.md만 존재(acceptance.md/plan.md 부재) — 단, AC 13건이 spec.md 내에 인라인되어 있고 dangling `acceptance.md`/`plan.md` 참조는 없음(grep 확인).**

## Must-Pass Results

- [PASS] MP-1 REQ 번호 일관성: REQ-AI-008-001 ~ 024 개별 확인(spec.md:L84–L116). Ubiquitous 001–005(L84–88), Event 006–013(L92–99), State 014–016(L103–105), Unwanted 017–024(L109–116) = 5+8+3+8 = 24. bold 정의 24개, `grep` 유니크 24개, 순차·결번 0·중복 0·3자리 zero-padding. AC ID 001–013 순차(L164–L176).
- [PASS] MP-2 EARS 형식 준수: Ubiquitous 001–005 "The system shall 항상 …"(L84–88); Event 006–013 "WHEN …, the system shall …"(L92–99); State 014–016 "WHILE …, the system shall …"(L103–105); Unwanted 017–024 전부 "The system shall not [긍정 동사]"(L109–116, 단일 부정). Unwanted 절에 긍정형 요구 잔존 없음. AC(L162–176)는 요약 매핑이며 EARS 위장 없음.
- [PASS] MP-3 YAML frontmatter 유효성: id "SPEC-AI-008"(L2), version "0.0.1" 문자열(L3), status "draft"(L4), created "2026-07-22" ISO(L5), priority "medium"(L8), tags 7개 문자열 배열(L17–24). 프로젝트 표준 스키마(`created`/`tags`) 일치, dependencies 배열 정상(L10–16).
- [N/A] MP-4 언어 중립성: N/A — 단일 프로젝트 SPEC(mdedit TS 프론트 + Rust 백엔드의 특정 앱 기능이며, 16개 언어 LSP 툴링 같은 템플릿 바운드 범용 콘텐츠가 아님).

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 (핵심 1곳 모호) | 진입점·재요청 승계·토글 종속 등 대부분 정합. 단 **프롬프트 조립 모델 서술이 부정확** — Summary(L49)/REQ-018(L110)/AC-004(L167)가 "조립되는 Diagram 프롬프트 == `AiFeature::Diagram.system_prompt()`"라 하나, 실제 조립은 `system_prompt() + "\n\n" + INLINE_SCOPE`(prompt.rs:196, `build_inline_prompt`)이다(D1) |
| Completeness | 0.85 | 0.75–1.0 사이 | spec.md 전 섹션 완비(HISTORY L28 / WHY L53 / WHAT L34 / Environment L69 / Requirements L78 / Fragments L118 / Design Notes L134 / Delta=HOW L144 / AC L158 / Exclusions 10항목 L184–193). AC 13건 인라인·dangling 참조 0. -0.15: 프롬프트 조립 공유 경로(비-diagram 인라인 5기능)·icons.tsx 리팩터 회귀를 가드하는 AC 부재(D2/D3) |
| Testability | 0.75 | 0.75 (일부 AC 비이진/오설정) | REQ→AC 대부분 이진(프롬프트 조각 키워드는 Rust `#[cfg(test)]`로, 서브메뉴 동작은 jsdom으로 검증 가능). 단 **AC-004는 현 상태에서도 실패하는 잘못된 불변식**(D1); REQ-006 "짧은 지연 후"는 비이진(Design Notes L139에서 완화, AC-001은 지연 미검증)(D4); REQ-023 "단일 소스" 구조적 제약(D3) |
| Traceability | 1.00 | 1.0 (양방향 완전) | REQ 001–024 전수가 AC에 매핑(L178 대조표 + 감사자 재대조). AC 표(L164–176) ↔ 대조표 항목별 일치, orphan AC 0, uncovered REQ 0. (회귀 가드 부재는 traceability가 아닌 completeness/testability 항목으로 계상) |

## Code Anchor 검증 (현재 브랜치)

호출 체크리스트 2·3·4의 앵커를 실제 소스로 대조:

- **ai-selection-toolbar.ts**: `{ kind: 'diagram', label: '🧜 다이어그램으로' }`(:128 ✓ spec L54), `createPresetMenu`(:389 ✓), `onOutsideMouseDown`(:622 ✓ spec L72), `buildToolbarDecorations`+`getUiState().enabled === false → Decoration.none`(:682/:692 ✓ spec L67 — 토글 OFF 시 툴바 미렌더 확인). `aiRequest(req.args)`(:676) 발행 경로 실재.
- **fireReRequest @MX:ANCHOR**(ai-suggestion-card.ts:1091–1101 ✓ spec L50): 본문이 `const merged = { ...originalArgs, ...overrides, requestId }`(:1103) — **원본 args 스프레드 불변식 실재**. `diagramType`을 초기 `originalArgs`에 실으면 재요청(feature='diagram' 유지)에 자동 승계됨 → REQ-014 주장 유효, 불변식 존중(fireReRequest 무변경). `decideDiagramOutcome`(:169 ✓ spec L64).
- **mod.rs**: `struct AiRequestArgs`(:83), 전 필드 `#[serde(default)]`(:85–105), `fn ai_request`(:113), `AiFeature::resolve(&args.feature, args.preset_kind.as_deref(), …)`(:124). **`deny_unknown_fields` 부재(grep 확인) + 전 필드 serde(default) → 신규 optional `diagram_type` 하위호환 주장 유효**. 기존 역직렬화 테스트(:381 `feature:"polish"`, preset_kind None)도 신규 필드로 깨지지 않음. TS `aiRequest` 호출부(aiRelay.test.ts:59, ai-selection-toolbar.ts:676, ai-suggestion-card.ts:1107, ai-ghost-text.ts 다수)는 전부 args 스프레드/명시 전달 → optional 추가로 파손 없음. **IPC 계약 변경 리스크 낮음.**
- **prompt.rs**: `AiFeature::Diagram`(:43/:101), `system_prompt()`(:88), Diagram 지시문 "graph·flowchart·sequenceDiagram 등 mermaid 키워드로 시작"(:105 ✓ spec L62, 인용 라인 101–106 정확).
- **icons.tsx**: 7종 JSX 아이콘 전부 실재 — FlowchartIcon(:279), SequenceDiagramIcon(:287), GanttIcon(:295), ClassDiagramIcon(:303), StateDiagramIcon(:311), PieChartIcon(:319), MindmapIcon(:327). spec 인용 "icons.tsx:279–333" 정확. (컴포넌트명은 `PieChartIcon`이나 spec가 정확한 이름을 단정하지 않아 무해.)
- **프롬프트 조각 첫 줄 키워드 vs UI-008 런타임 검증 스니펫(체크리스트 4)**: 7종 전부 일치 — flowchart/sequenceDiagram/gantt/classDiagram/pie/mindmap 키워드가 UI-008 스니펫 헤더와 동일. `stateDiagram`(프론트 키)→`stateDiagram-v2`(첫 줄 키워드) 매핑이 spec에 명시(L80, L128)되어 있고 `stateDiagram-v2`는 review(UI-008)에서 mermaid 11.12.3 parse PASS 확인된 유효 키워드 — **parse 실패를 유발하거나 라벨과 다른 종류를 만드는 키워드 없음.**
- **Cargo/clippy(체크리스트 8)**: `src-tauri/Cargo.toml` + Rust `#[cfg(test)]` 단위 테스트(prompt.rs 하단, mod.rs:381) 실재 → `cargo test` 게이트 서술(L180) 일관. clippy는 표준 컴포넌트 — 서술 정합.

## Defects Found

D1. spec.md:L49, L110, L167 — **바이트 동일 불변식(REQ-018/AC-004)이 잘못된 아티팩트를 가리킨다.** REQ-018은 "`diagramType` 없을 때 조립되는 Diagram 시스템 프롬프트 == 현행 `AiFeature::Diagram.system_prompt()` 바이트 동일"이라 하고 AC-004도 이를 검증 대상으로 삼는다. 그러나 `AiFeature::Diagram`은 전용 조립 분기가 없고 공유 `build_inline_prompt`(mod.rs:147 `_` 암)를 타며, 그 조립은 `system_prompt: format!("{}\n\n{}", feature.system_prompt(), INLINE_SCOPE)`(prompt.rs:196)이다. 즉 **현행 조립 프롬프트는 이미 `system_prompt()`와 다르다**(뒤에 `\n\n` + INLINE_SCOPE 부착). AC-004를 문구 그대로 테스트하면 변경 전에도 실패한다. 이 SPEC의 핵심 안전 계약(자동=바이트 동일)이 잘못된 기준을 지목하므로 load-bearing 결함이다. — Severity: major

D2. spec.md:L96(REQ-010), L150–151(Delta), L110(REQ-018) — **비-diagram 인라인 5기능 회귀 표면이 미가드.** INLINE_SCOPE는 6개 인라인 기능(polish/outline/table/**diagram**/shorten/custom)에 균일 부착되며(prompt.rs:24 @MX:NOTE "가드를 되살리지 말 것"), Diagram은 이들과 `build_inline_prompt`를 공유한다. Delta/REQ-010은 "AiFeature::Diagram 프롬프트 조립"/"Diagram 분기 조립"에 조각을 주입한다고 서술하나 **격리된 Diagram 분기는 존재하지 않는다**(현재 `_` 공유 암). `diagram_type`을 공유 경로에 배선하면 polish/outline/table/shorten/custom 프롬프트를 함께 건드릴 위험이 있는데, REQ-018은 diagram-None만 가드하고 **나머지 5기능의 프롬프트 불변을 보증하는 REQ/AC가 없다.** 이 hot path의 회귀는 SPEC-AI-003/004/006 계보 기능에 파급된다. — Severity: major

D3. spec.md:L115(REQ-023), L152(Delta), L166(AC-003) — **icons.tsx 리팩터가 방금 출시된 SPEC-UI-008 JSX 아이콘 렌더 불변을 가드하지 않는다.** REQ-023은 명령형 서브메뉴와 JSX 컴포넌트가 SVG path의 "단일 소스"를 공유하도록 강제해 icons.tsx(:279–333, UI-008 산출물) 리팩터를 요구한다. AC-003은 "AI 서브메뉴 path가 UI-008과 동일 소스에서 옴"만 검증할 뿐, **추출 후 UI-008의 기존 JSX 아이콘 7종이 동일 SVG를 렌더하는지**는 어떤 AC도 어서션하지 않는다. REQ-020(UI-008 수동 삽입 흐름 무변경)에도 아이콘 렌더 불변은 명시 항목이 아니다. 마크업이 결정적이라 리스크는 낮으나 무가드다. 추가로 REQ-023의 "단일 소스" 자체는 구조적 제약으로, 이진 검증은 "양쪽 렌더 path가 동일"로 근사할 수밖에 없다(AC-003이 이를 정밀히 진술하지 않음). — Severity: minor

D4. spec.md:L92(REQ-006) — REQ-006 정규 요구가 "짧은 지연(hover intent) **후** 플라이아웃을 연다"로 비이진 지연을 요구 본문에 포함한다. Design Notes(L139)가 "이진 수용 기준이 아닌 설계 목표"로 완화하고 AC-001(L164)은 지연을 검증하지 않으므로 실질 테스트 가능성은 유지되나, 정규 요구에 소프트 타깃이 섞여 있다. Design Notes로 완전 이관하거나 "hover 시 연다"로 이진화 권장. — Severity: minor

D5. spec.md:L109(REQ-017) — 원자성/혼합. shall-not 요구(종류 불일치를 검증 실패로 취급 금지 + 새 게이트 금지) 안에 긍정형 설계 단언("종류 준수는 프롬프트 제약과 재요청 승계로만 달성한다")이 함께 들어 있다. 의미는 정합하나 금지 요구와 긍정 단언을 분리하면 원자성이 개선된다. — Severity: minor

## Chain-of-Verification Pass

2차 재검토 대상: 전체 REQ L84–L116(24개 개별 정독), AC 표 L164–176 및 커버리지 대조표 L178, Fragments 표 L122–130, Delta L146–156, 소스 앵커.

- **REQ→AC 전수 재대조**: L178 대조표(001→AC2 … 024→AC13)의 24개 매핑을 AC 표의 Requirement 열과 항목별 대조 — 전부 일치. AC1(005,006,007)/AC2(001,004)/AC3(002,023)/AC4(008,018)/AC5(009)/AC6(010)/AC7(011,015)/AC8(012)/AC9(013)/AC10(014,017)/AC11(016)/AC12(003)/AC13(019,020,021,022,024). orphan AC 0, uncovered REQ 0. **traceability는 온전하나, 회귀 가드 부재(D2/D3)는 "누락된 REQ" 성격으로 별도 계상.**
- **프롬프트 조립 모델 실측**: 체크리스트 2/4 검증 중 `build_inline_prompt`가 Diagram을 포함한 6기능에 INLINE_SCOPE를 부착함을 소스로 확인(prompt.rs:196, mod.rs:147 `_` 암) → D1/D2를 포착. 이는 spec를 표면만 읽으면 놓치고, 실제 조립 코드를 추적해야만 드러남.
- **키워드 일관성**: 7종 첫 줄 키워드가 UI-008 런타임 검증 스니펫과 정합, `stateDiagram-v2` 매핑 명시 확인 — parse 파손 키워드 없음.
- **하위호환**: `deny_unknown_fields` 부재 + 전 필드 serde(default) + TS optional → 신규 `diagram_type`가 기존 호출부/테스트를 깨지 않음을 호출부 grep으로 확인.
- **재요청 불변식**: fireReRequest 스프레드(:1103)가 실재하며 SPEC은 이를 변경하지 않고 부수효과로 승계 — @MX:ANCHOR 계약 존중.
- **스코프 규율(체크리스트 7)**: dependencies는 `SPEC-UI-008`(L11)로 기재(호출자가 언급한 "merge-first"는 문구가 아닌 순서 의도로 해석). UI-008 파일 중 유일하게 icons.tsx만 [MODIFY]이며 REQ-020/023으로 경계 — UI-008 요구 자체를 바꾸라는 누수는 없음. 잔여 리스크는 D3(아이콘 렌더 회귀 무가드)로 한정.
- 2차 신규 결함: 없음(D1–D5 외 추가 없음). Exclusions 10항목 모두 구체적, 요구와 모순 없음(토글 종속 REQ-016 ↔ Exclusions "AI 토글 무관 노출 없음" L193 정합).

## Regression Check (Iteration 2+ only)

N/A — iteration 1.

## Recommendation

FAIL — must-pass 실패는 없고 소스 앵커·하위호환·키워드 일관성·재요청 승계는 모두 실증되었으나, 프롬프트 조립 모델의 부정확성에서 비롯된 major 결함 2건(D1·D2)이 승인 전 수정되어야 한다. 사실상 "조건부 통과"에 근접하며 iteration 2에서 해소 가능하다.

수정 지시(manager-spec):

1. (D1, 필수) REQ-018(L110)·AC-004(L167)·Summary(L49)의 바이트 동일 기준을 실제 조립 아티팩트로 교정하라. 예: "`diagram_type=None`일 때 `build_inline_prompt`가 산출하는 Diagram `system_prompt`(= 현행 `AiFeature::Diagram.system_prompt()` + `\n\n` + INLINE_SCOPE)가 현행과 바이트 동일". AC-004는 "현행 조립 Diagram 프롬프트 스냅샷 == diagram_type=None 조립 결과"로 검증하도록 진술.
2. (D2, 필수) 종류 조각 주입이 **Diagram 경로에만** 적용됨을 명확히 하고(전용 match 암 추가 또는 build_inline_prompt에 diagram 전용 게이팅), polish/outline/table/shorten/custom 5기능의 조립 프롬프트가 바이트 동일하게 유지됨을 보증하는 REQ/AC를 추가하라(예: 신규 AC "비-diagram 인라인 5기능 프롬프트 회귀 스냅샷 무변경"). "Diagram 분기"라는 표현이 현재 격리 분기 부재와 상충하므로 Delta 문구도 정정.
3. (D3, 권장) AC-003 또는 AC-013에 "SPEC-UI-008 JSX 아이콘 7종의 렌더 SVG(예: `d` path)가 추출 리팩터 후 무변경"을 추가해 UI-008 아이콘 회귀를 가드하라. REQ-023의 "단일 소스"를 "양쪽 소비자의 렌더 path 문자열 동일"로 이진화.
4. (D4, 권장) REQ-006의 "짧은 지연 후"를 Design Notes로 이관하고 정규 요구는 "hover 시 서브메뉴를 연다"로 이진화.
5. (D5, 권장) REQ-017에서 긍정 단언("종류 준수는 …로만 달성")을 근거 문장/Design Notes로 분리해 shall-not 요구를 순수 금지형으로.

항목 1–2는 iteration 2 PASS의 필수 조건이다. 항목 3–5는 권장이며 비차단이다.
