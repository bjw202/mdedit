---
id: SPEC-AI-008
version: "0.0.2"
status: planned
created: "2026-07-22"
updated: "2026-07-22"
author: "jw"
priority: medium
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.2 | 2026-07-22 | jw | Run-entry plan 작성(관측 O3) — spec.md/acceptance.md v0.0.2(plan-auditor review-2 PASS 0.96)와 정합. UI-008 `plan.md`/`tasks.md` 구조 준용. 실제 소스(ai-selection-toolbar.ts:124·128·389·433·482·570·622·692, ai-suggestion-card.ts:169·1101·1172, ipc.ts:195·235, mod.rs:83·124·147, prompt.rs:31·101·171·196·713, icons.tsx:279–333) 대조로 파일·라인 근거 확정. 개발 방법론 = TDD(브라운필드 Pre-RED 특성화 포함, D1/D2 스냅샷 기준선이 그 핵심). 브랜치 = `feature/SPEC-AI-008-diagram-type-picker`, main에서 PR #39(SPEC-UI-008) 머지 **후** 분기. |

## Overview

AI 선택 툴바(✨)의 프리셋 메뉴에서 "🧜 다이어그램으로" 항목을 즉시 발행에서 **플라이아웃 서브메뉴 열림**으로 바꾸고, 8개 항목("자동 (AI 판단)" + 7종 종류)을 연다. "자동"은 오늘의 동작(AI가 종류 판단, 프롬프트 무변경)이고, 7종 종류 중 하나를 고르면 AI 다이어그램 생성 프롬프트에 그 mermaid 종류를 강제하는 제약 조각이 실린다. 종류 제약은 프론트가 문자열로 붙이지 않고 **IPC 신규 optional 필드 `diagramType`** 로 전달되어 Rust 조립 지점에서 주입된다.

본 SPEC은 SPEC-UI-008(수동 삽입)이 도입한 7종 종류 키·아이콘 형상을 재사용하되, 대상이 다르다 — UI-008은 에디터 툴바의 수동 펜스 삽입, 본 SPEC은 AI 생성 프롬프트의 종류 제약이다. 다운스트림(스트리밍·`mermaidValidate` 파싱·제안 카드·재요청 UX; SPEC-AI-003/004/006 계보)은 무변경이며 프롬프트만 종류 제약을 얻는다.

- 개발 방법론: **TDD** (`quality.yaml` `development_mode: tdd`, RED-GREEN-REFACTOR, 브라운필드 Pre-RED 특성화 포함)
- 브랜치: `feature/SPEC-AI-008-diagram-type-picker` (`/moai run` 단계에서 생성). **의존: main에서 PR #39(SPEC-UI-008) 머지 후 분기** — 종류 아이콘·`DIAGRAM_PRESETS` 종류 키가 UI-008 산출물이기 때문.
- 신규 런타임 의존성: **없음** (JS `package.json` + Rust `Cargo.toml` 무변경). 순수 CSS 포지셔닝, 명령형 DOM.
- 요구/수용 기준: spec.md REQ-AI-008-001~025, acceptance.md AC-AI-008-001~014 (본 plan은 이를 구현 관점으로 분해하며 요구사항 자체를 변경하지 않는다)

## Confirmed Design Decisions (사용자 승인, 재검토 금지)

spec.md HISTORY(0.0.1)·Summary의 사용자 확정 결정을 옮긴 것으로, Run phase에서 **재검토 금지**다.

1. **진입점 = ai-selection-toolbar.ts 프리셋 메뉴의 diagram 항목** — `createPresetMenu`(:389) 내 `{ kind:'diagram' }`(:128) 항목의 클릭 핸들러(:433–440)를 "즉시 `fire('diagram')`"에서 "플라이아웃 서브메뉴 열기"로 바꾼다. 서브메뉴도 동일한 **명령형 DOM**(`document.createElement`) 패턴을 따른다(React 리라이트 없음).
2. **hover 플라이아웃 + 자동 우선** — 8항목: "자동 (AI 판단)"이 첫 항목·기본(오늘 동작 = AI 종류 판단), 이어 7종(flowchart/sequenceDiagram/gantt/classDiagram/stateDiagram/pie/mindmap). hover 시 열림, no-hover/터치는 클릭 토글, Esc는 서브메뉴만 닫고 목록 복귀.
3. **공유 경로 내 diagram 전용 게이팅** — `AiFeature::Diagram`은 전용 조립 분기가 없고 polish/outline/table/shorten/custom과 함께 `build_inline_prompt`(prompt.rs:171)를 공유하며 조립은 `format!("{}\n\n{}", feature.system_prompt(), INLINE_SCOPE)`(:196)다. 종류 조각은 이 경로 안에서 **feature가 Diagram이고 `diagram_type`이 있을 때만** 부착한다. `None`(자동)이면 현행 조립 결과와 **바이트 동일**.
4. **종류 불일치는 검증 실패가 아님** — `mermaid.parse` 유효성이 유일한 하드 게이트. `decideDiagramOutcome`(ai-suggestion-card.ts:169)/`validateMermaid`/`buildFallbackDecision` 무변경. 종류 준수는 프롬프트 제약 + 재요청 승계로만 달성.
5. **`serde(default)` IPC 필드** — `AiRequestArgs`에 신규 optional `diagramType`(camelCase) → Rust `diagram_type: Option<String>`(`#[serde(default)]`). 자동은 필드 생략 = 하위호환.
6. **아이콘 SVG 단일 소스** — 명령형 서브메뉴는 JSX를 마운트할 수 없으므로 SPEC-UI-008 JSX 아이콘(icons.tsx:279–333)의 SVG 마크업을 문자열 단일 소스로 추출해 양쪽(JSX 컴포넌트 + 명령형 서브메뉴)이 공유한다. path 데이터 중복 금지. 추출 후 JSX 아이콘 렌더 SVG는 무변경.
7. **다운스트림·회귀 불변식** — `fireReRequest`(@MX:ANCHOR, ai-suggestion-card.ts:1101) 원본 args 스프레드 불변식 존중(종류는 부수효과로 승계). 비-diagram 5기능 프롬프트 바이트 동일. AI 토글 OFF 시 툴바 미노출. 신규 의존성 0, 서브메뉴 8항목 고정, mermaid 핀·`securityLevel` 무변경, `markdownKeyBindings` 무변경, SPEC-UI-008 수동 삽입 무변경.

## Task Decomposition

TDD 순서로 각 유닛은 "테스트 먼저(RED) → 최소 구현(GREEN) → 정리(REFACTOR)"로 진행한다. 브라운필드 영역(공유 프롬프트 조립, UI-008 아이콘)은 변경 전 **Pre-RED 특성화 스냅샷**으로 기존 동작을 고정한 뒤 확장한다 — 이 스냅샷이 D1/D2/D3 회귀 방어의 토대다.

### T1. [Pre-RED] 특성화 스냅샷 — 조립 프롬프트(6기능) + UI-008 아이콘

- 목적: D1/D2/D3 회귀 기준선을 변경 **전에** 고정한다.
- (Rust) `build_inline_prompt`로 6개 인라인 기능(polish/outline/table/diagram/shorten/custom)의 조립 `system_prompt`를 스냅샷으로 캡처 — diagram 포함 현행 조립 결과(= `system_prompt()` + `\n\n` + INLINE_SCOPE, prompt.rs:196)를 기준선화. 기존 `inline_scope_clause_present_for_all_six_inline_features`(:713)와 별도로 **바이트 동일 스냅샷**을 확보.
- (프론트) SPEC-UI-008 JSX 아이콘 7종(icons.tsx:279–333)의 렌더 SVG(`d` path)를 추출 리팩터 전 스냅샷으로 확보.
- 파일: `src-tauri/src/ai/prompt.rs`(`#[cfg(test)]` 보강), `src/test/diagramIcons.test.tsx`(신규, 추출 전 렌더 스냅샷).
- Done: 변경 전 `cargo test`·`npm test` green, 6기능 조립 스냅샷 + 7종 아이콘 렌더 스냅샷이 명시적으로 존재.
- 매핑: REQ-018/023/025(회귀 기준선), AC-004/014.

### T2. [RED→GREEN] 아이콘 SVG 단일 소스 추출 — `src/components/icons/icons.tsx` (+ 인접 마크업 소스)

- 7종 아이콘의 SVG inner 마크업을 문자열 상수(예: `icons.tsx` 인접 소스 모듈)로 추출하고, 기존 JSX 컴포넌트(`FlowchartIcon`~`MindmapIcon`)가 그 상수를 소비하도록 리팩터. 명령형 서브메뉴(T4)도 같은 상수를 소비(`innerHTML` 또는 SVG 노드 생성).
- 불변식: 추출 후 JSX 아이콘 렌더 SVG(`d` path)가 T1 스냅샷과 무변경(REQ-023). path 데이터 중복 0.
- 테스트: T1의 `diagramIcons.test.tsx` 스냅샷이 리팩터 후에도 green(AC-014). 서브메뉴 렌더 path == JSX 렌더 path 등가 어서션.
- 매핑: REQ-002/023, AC-003/014.

### T3. [RED→GREEN] IPC 필드 `diagramType`/`diagram_type` — `src/lib/tauri/ipc.ts` + `src-tauri/src/ai/mod.rs`

- (TS) `AiRequestArgs`(ipc.ts:195)에 `diagramType?: DiagramType`(7종 union, UI-008 `DiagramPreset`에서 `custom` 제외 재사용) 추가. `aiRequest`(:235) 호출 형태 무변경(`{ args }` 래핑 유지).
- (Rust) `AiRequestArgs`(mod.rs:83)에 `#[serde(default)] diagram_type: Option<String>` 추가. `ai_request`(:113)의 공유 인라인 조립 호출(`_` 암, :147)에 `diagram_type`을 전달(조립 함수 시그니처 확장은 T5).
- 테스트: (Rust) `diagramType` camelCase 역직렬화 + None 기본값 회귀 가드(mod.rs `#[cfg(test)]`, :381 선례). 기존 최소/전체 역직렬화 테스트 무변경 통과(하위호환).
- 매핑: REQ-009/010(전달 경로), AC-005/006, IPC 하위호환 게이트.

### T4. [RED→GREEN→REFACTOR] 다이어그램 플라이아웃 서브메뉴(명령형 DOM) — `src/components/editor/extensions/ai-selection-toolbar.ts`

- `createPresetMenu`(:389) 내 diagram 항목(:433–440) 클릭 핸들러를 "플라이아웃 서브메뉴 열기"로 변경. 서브메뉴는 8항목(자동 + 7종) `<button>` 리스트(명령형 DOM). 트리거 항목에 `aria-haspopup`/`aria-expanded`.
- 상호작용: hover 열림(REQ-006, 지연은 Design Notes 재량), no-hover 클릭 토글(REQ-007), Esc → 서브메뉴만 닫고 목록 복귀(기존 `handleKeyDown` Esc 선례, :482–491), 외부 mousedown → 위젯 `onOutsideMouseDown`(:622)으로 함께 닫힘, Tab/Enter/Space 네이티브 선택(REQ-013).
- 발행: "자동" → `fire('diagram')` 종류 없이(REQ-008). 종류 → `fire('diagram', undefined, diagramType)`. `fire`(:570)/`BuildSelectionRequestInput`(:69)/`buildSelectionRequest`(:168)/`AiSelectionRequest.args`(:44)에 `diagramType` 전달 경로 추가. `presetToFeature`/`feature='diagram'` 매핑 무변경.
- 아이콘: T2 단일 소스 상수를 종류 항목에 주입(자동 항목은 아이콘 없음/별도 글리프 재량).
- @MX: 서브메뉴 DOM + `fire` 종류 전달에 `@MX:NOTE`(hover/토글/Esc 복귀·종류 게이팅 진입점) + `@MX:SPEC: SPEC-AI-008`.
- 테스트(RED first, `src/test/aiSelectionToolbar.test.ts` 확장, `createPresetMenu`/`AiSparkleWidget` describe 선례):
  - diagram 항목 hover/클릭 → 서브메뉴 열림/토글, `aria-expanded`; 클릭이 즉시 발행 안 함.
  - 8항목·자동 우선·순서·`aria-label`; 종류 항목 `<svg>`+`currentColor`.
  - "자동" 선택 → args에 `diagramType` 없음; 종류 선택 → 정확한 `diagramType`.
  - Esc → 서브메뉴만 닫힘; 외부 mousedown → 함께 닫힘; Tab/Enter 선택.
- 매핑: REQ-001/002/003/004/005/006/007/008/009/011/012/013/015, AC-001/002/003/005/007/008/009.

### T5. [RED→GREEN→REFACTOR] Rust 종류 게이팅 + 조각 — `src-tauri/src/ai/prompt.rs`

- `build_inline_prompt`(또는 diagram 전용 래퍼)에 `diagram_type` 인자를 전달해, `matches!(feature, AiFeature::Diagram)` 이고 값이 있을 때만 "Diagram Type Prompt Fragments" 7종 조각을 조립 `system_prompt`에 부착. `None`/비-diagram이면 현행 조립 결과와 바이트 동일.
- 조각: 7종 각각 종류 명시 + 첫 줄 키워드(spec.md 표: flowchart/sequenceDiagram/gantt/classDiagram/`stateDiagram-v2`/pie/mindmap). 기존 "펜스·설명 없이 순수 mermaid" 지시(:101–106)와 무충돌.
- @MX: 게이팅 지점에 `@MX:NOTE`(diagram 전용 부착·비-diagram 무영향) + `@MX:SPEC: SPEC-AI-008`.
- 테스트(RED first, prompt.rs `#[cfg(test)]`):
  - `diagram_type=Some(x)` → 조립 프롬프트에 해당 조각·첫 줄 키워드 포함; 7종 서로 다름.
  - `diagram_type=None` → T1 diagram 스냅샷과 바이트 동일(AC-004).
  - 비-diagram 5기능 → T1 스냅샷과 바이트 동일(AC-014/REQ-025); 기존 `inline_scope_*`(:713)/`diagram_prompt_*` 무변경.
- 매핑: REQ-010/018/025, AC-004/006/014.

### T6. [GREEN] CSS — `src/styles/mdedit-components.css`

- 플라이아웃 서브메뉴 클래스(`.mdedit-ai-diagram-submenu*`) 추가. 기존 `.mdedit-ai-preset-*` 스타일 관례 재사용 우선.
- HARD: raw hex 금지, `--md-*`/`.mdedit-*` 토큰 + `currentColor`만. 다크모드 토큰 전환 자동(REQ-003, AC-012).
- 매핑: REQ-003, AC-012.

### T7. 회귀 가드 + 품질 게이트

- 회귀 가드(AC-013): `package.json`·`Cargo.toml` 신규 의존성 0, 서브메뉴 8항목, `markdownKeyBindings` 무변경, SPEC-UI-008 `insertDiagram`/`DIAGRAM_PRESETS`/빈-펜스 무변경, mermaid 핀·`securityLevel` 무변경.
- 재요청 승계 검증(AC-010): 종류 실은 요청의 자동 재요청이 `diagramType`을 승계(`fireReRequest` 스프레드, ai-suggestion-card.ts:1101); 목록 폴백은 종류 버림(:1172). `decideDiagramOutcome` 무변경.
- 게이트: `npm run typecheck` 클린 → `npm test`(vitest) 전체 통과 → `npm run lint` 통과 → `cargo test` 통과 → `cargo clippy` 무경고 → 기존 Playwright 무변경 통과.
- 매핑: REQ-014/017/019/020/021/022/024, AC-010/013, Quality Gate Criteria.

### 실행 순서 및 의존성

```
T1 (Pre-RED 스냅샷: 6기능 프롬프트 + UI-008 아이콘) ──┐
T2 (아이콘 단일 소스 추출) ───────────────┐          │
T3 (IPC diagramType/diagram_type) ────────┼→ T4 (서브메뉴 DOM) ─┐
T5 (Rust 게이팅 + 조각) ───────────────────┘                    ├→ T7 (게이트)
T6 (CSS) ── T4 이후 ────────────────────────────────────────────┘
```

우선순위: T1(스냅샷 기준선, D1/D2/D3 토대) → T2(아이콘 추출)·T3(IPC)·T5(Rust 게이팅) > T4(서브메뉴 DOM) > T6(스타일) > T7(게이트). T5(Rust)와 T4(프론트)는 IPC 계약(T3) 합의 후 병행 가능.

## Risk Analysis & Mitigation

| # | 리스크 | 영향 | 완화 |
|---|--------|------|------|
| 1 | **공유 프롬프트 hot path 회귀** — Diagram은 polish/outline/table/shorten/custom과 `build_inline_prompt`+INLINE_SCOPE(prompt.rs:24 "가드를 되살리지 말 것")를 공유. 종류 게이팅 배선이 5기능 프롬프트를 침범할 위험 | SPEC-AI-003/004/006 계보 파급 | 게이팅을 `matches!(feature, AiFeature::Diagram)`로 엄격 한정. T1 6기능 스냅샷 + T5 비-diagram 5기능 바이트 동일 테스트(REQ-025/AC-014)로 방어 |
| 2 | **icons.tsx 리팩터가 갓 머지된 UI-008 아이콘 렌더 침범** — icons.tsx:279–333은 PR #39 산출물 | UI-008 수동 삽입 아이콘 회귀 | 추출은 마크업을 상수로 옮기고 JSX는 그 상수를 소비만. T1 추출 전 스냅샷 + T2 추출 후 등가 어서션(REQ-023/AC-014). 마크업 결정적이라 리스크 낮음 |
| 3 | **`@MX:ANCHOR` fireReRequest 불변식** — 원본 args 스프레드(:1103)를 깨면 재요청 컨텍스트 유실(과거 BUG-2) | 재요청 프롬프트 빔/종류 미승계 | `fireReRequest` **무변경**. 종류는 초기 `originalArgs.diagramType`에 실려 부수효과로 승계. 목록 폴백만 feature 덮어써 종류 버림(기존 :1172 동작 유지) |
| 4 | **IPC 계약 변경 하위호환** — 신규 필드 추가 | 기존 호출부/역직렬화 파손 | `deny_unknown_fields` 부재 + 전 필드 `#[serde(default)]`. TS optional. 기존 호출부(aiRelay.test.ts, ai-ghost-text.ts 등) 스프레드/명시 전달로 무영향. T3 역직렬화 회귀 테스트 |
| 5 | **AI 토글 종속 일관성** — 서브메뉴가 토글 OFF에서 노출되면 UI-008(토글 무관)과 혼선 | 정책 불일치 | `buildToolbarDecorations`(:692)가 `enabled===false`면 `Decoration.none` — 툴바 자체 미노출로 서브메뉴 도달 불가(REQ-016/AC-011). 별도 노출 경로 신설 금지 |
| 6 | **종류 불일치 재요청 루프 유혹** — 종류-일치 하드 게이트 추가 시 과다 재시도 | `decideDiagramOutcome` 계약 파손·루프 | 종류-일치 게이트 **미신설**. parse 유효성만 하드 게이트(REQ-017). 종류 준수는 프롬프트+승계로만 |
| 7 | **명령형 DOM ↔ JSX 아이콘 경계** — 서브메뉴는 `document.createElement`, 아이콘은 JSX | path 중복/드리프트 | T2 단일 소스 상수를 양쪽이 소비. `innerHTML`/SVG 노드 생성으로 명령형 주입. 신규 런타임 의존성 0(REQ-019) |

## MX Tag Plan

`code_comments = ko`(`language.yaml`).

| 위치 | 태그 | 사유 |
|------|------|------|
| `ai-selection-toolbar.ts` 서브메뉴 DOM + `fire` 종류 전달 | `@MX:NOTE` + `@MX:SPEC: SPEC-AI-008` | hover/토글/Esc 목록 복귀 + 종류 게이팅 진입점(diagram 항목 클릭 → 플라이아웃) 근거 |
| `prompt.rs` diagram 종류 게이팅 | `@MX:NOTE` + `@MX:SPEC: SPEC-AI-008` | 공유 `build_inline_prompt` 내 `matches!(Diagram)` 전용 부착, 비-diagram 무영향·None 바이트 동일 |
| `mod.rs` `diagram_type` 필드/전달 | `@MX:NOTE` | `#[serde(default)]` 하위호환 + 공유 조립 호출(`_` 암)에 전달 |
| `ai-suggestion-card.ts` `fireReRequest` | `@MX:ANCHOR` **유지**(무변경) | 원본 args 스프레드 불변식 — 종류 승계는 부수효과, 이 앵커를 건드리지 않음 |
| `icons.tsx` 단일 소스 추출 | `@MX:NOTE` | 7종 SVG 마크업 단일 소스(JSX + 명령형 공유), path 중복 금지 |

## Exclusions (Non-Goals)

spec.md "Exclusions (What NOT to Build)"와 동일 — 요약: 나머지 17종 mermaid 유형 없음, "자동" 모델 동작 변경 없음, 런타임 종류 검증기 없음, 재요청 메커니즘 변경 없음, SPEC-UI-008 수동 삽입 변경 없음, 툴바 React 리라이트 없음, 아이콘 형상 재디자인 없음, mermaid 버전·테마 연동 변경 없음, 키보드 단축키 없음, AI 토글 무관 노출 없음.

## Quality Gates (TDD)

- RED-GREEN-REFACTOR 준수, 테스트 선행 필수. 브라운필드(공유 프롬프트 조립·UI-008 아이콘)는 Pre-RED 특성화 스냅샷 선행(T1).
- `npm run typecheck`(`tsc --noEmit`) 클린 · `npm test`(vitest) 전체 무변경 통과 · `npm run lint`(eslint) 통과 · `cargo test` 전체 통과 · `cargo clippy` 무경고 · 기존 Playwright 무변경 통과(신규 E2E 없음).
- 커밋당 커버리지 80%+, 전체 목표 85%.
- LSP run 게이트: errors 0 / type errors 0 / lint errors 0.
- 보안·하위호환 불변식: mermaid `securityLevel: 'strict'`·`startOnLoad: false`·버전 핀 11.12.3 유지; `diagram_type` `#[serde(default)]` optional로 IPC 하위호환.

## Related Documents

- `spec.md` — EARS 요구사항(REQ-AI-008-001~025) + Diagram Type Prompt Fragments + Delta
- `acceptance.md` — Given-When-Then 시나리오(AC-AI-008-001~014) + Quality Gate Criteria + Definition of Done
- `tasks.md` — Task 분해(T-001~T-007) + REQ/AC 매핑
- 선례: `.moai/specs/SPEC-UI-008-diagram-insert-menu/{plan,tasks}.md`
- 의존: SPEC-UI-008(PR #39) — 종류 아이콘·`DIAGRAM_PRESETS` 종류 키의 상류
