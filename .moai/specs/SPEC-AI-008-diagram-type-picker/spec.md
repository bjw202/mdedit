---
id: SPEC-AI-008
version: "0.0.4"
status: draft
created: "2026-07-22"
updated: "2026-07-30"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-UI-008
  - SPEC-AI-001
  - SPEC-AI-003
  - SPEC-AI-004
  - SPEC-AI-005
  - SPEC-AI-006
tags:
  - ai
  - editor
  - toolbar
  - mermaid
  - diagram
  - prompt
  - flyout
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.1 | 2026-07-22 | jw | 최초 SPEC 작성 — AI 선택 툴바(✨)의 "🧜 다이어그램으로" 프리셋에 다이어그램 종류 플라이아웃 서브메뉴 추가. 8항목(자동 + 7종). 사용자 확정 결정 반영: (1) 진입점 = `ai-selection-toolbar.ts`의 프리셋 메뉴에서 `{ kind:'diagram' }` 항목을 즉시 발행 대신 플라이아웃 서브메뉴 열림으로 변경(명령형 DOM, `createPresetMenu` 선례 재사용), (2) 서브메뉴 = "자동 (AI 판단)"(첫 항목·기본, 오늘 동작 유지) + 7종 프리셋(flowchart/sequenceDiagram/gantt/classDiagram/stateDiagram/pie/mindmap), 각 종류 항목은 SPEC-UI-008 스켈레톤 아이콘 형상 + 한글 라벨을 재사용, (3) 종류 선택 = AI 다이어그램 생성 프롬프트에 해당 mermaid 종류를 강제하는 제약 조각(fragment) 주입(Rust `prompt.rs`), "자동" = 기존 프롬프트 무변경(바이트 동일), (4) 다운스트림(스트리밍·`mermaidValidate` 파싱·제안 카드·재요청 UX; SPEC-AI-003/004/006 계보) 무변경 — 프롬프트만 종류 제약을 얻는다. 조사 근거: 프롬프트 조립은 100% Rust(REQ-AI-003), IPC는 `feature`/`presetKind`/`customInstruction` 전달; 재요청은 `fireReRequest`가 원본 args를 스프레드하므로 종류 필드가 자동 승계됨. |
| 0.0.2 | 2026-07-22 | jw | plan-audit 리뷰(SPEC-AI-008-review-1, FAIL 0.80) 반영 — 결함 5건 수정: **D1**(major) "자동=바이트 동일" 불변식(REQ-018/AC-004/Summary)을 잘못된 아티팩트(`Diagram.system_prompt()` 단독)에서 실제 조립 결과(`build_inline_prompt` 산출 = `system_prompt()` + `\n\n` + INLINE_SCOPE)로 재앵커. **D2**(major) Diagram 전용 조립 분기가 없고 공유 `build_inline_prompt`(비-diagram 5기능과 INLINE_SCOPE 공유)를 탄다는 사실 반영 — REQ-010/Delta를 "공유 경로 내 diagram 전용 게이팅"으로 정정하고, 비-diagram 5기능(polish/outline/table/shorten/custom) 프롬프트 바이트 동일 회귀 가드로 신규 **REQ-025 + AC-014** 추가. **D3**(minor) icons.tsx 추출 리팩터 후 UI-008 JSX 아이콘 7종 렌더 SVG 무변경 가드를 AC-014에 추가하고 REQ-023의 "단일 소스"를 "양쪽 소비자 렌더 path 문자열 동일"로 이진화. **D4**(minor) REQ-006의 "짧은 지연 후"를 정규 요구에서 제거(이진화: "hover 시 연다"), 지연은 Design Notes로 이관. **D5**(minor) REQ-017의 긍정 단언을 근거절/Design Notes로 분리해 순수 shall-not로. REQ 24→25, AC 13→14, 커버리지 대조표·Delta·Fragments 인트로 갱신. |
| 0.0.3 | 2026-07-30 | jw | **SPEC-AI-011로 REQ-006/007 충돌 해소 — 클릭 열기 전용으로 개정.** REQ-AI-008-007의 "hover 불가 환경에서 클릭 시 토글(열림↔닫힘)"을 "포인터·키보드 어느 경로든 클릭 시 연다. 이미 열려 있으면 상태를 바꾸지 않는다"(open-only)로 개정 — 전제절 "hover 불가 환경에서"는 런타임에 판별 불가능해 삭제. REQ-AI-008-006에 "hover 열림과 클릭 열림은 상호 배타적이지 않으며 둘 다 멱등 열기 연산" 명확화를 추가. REQ-AI-008-013을 "Tab / 방향키 / Enter / Space"로 확장하고 `role="menu"`/`role="menuitem"` 요구를 추가. AC-AI-008-001의 "클릭(no-hover) → 토글"을 "클릭 → 열림(이미 열려 있으면 무변경)"으로, AC-AI-008-009를 방향키 래핑 순환 + 포커스 진입/복귀 포함으로 확장. 근거: 실제 포인터 클릭은 mouseenter → click 순으로 발화해 REQ-006(hover 열림)과 REQ-007(클릭 토글)이 포인터 입력에서 동시 만족 불가능했다(코딩 실수가 아니라 명세 충돌). 구현·검증은 SPEC-AI-011 참조. |
| 0.0.4 | 2026-07-30 | jw | **REQ-AI-008-013/AC-AI-008-009의 방향키 확장을 되돌림(0.0.3의 개정 (c) 철회).** SPEC-AI-011 후속 조사에서 서브메뉴 방향키 내비게이션이 실제 macOS WKWebView 앱에서 도달 불가능함이 확인되어(포커스가 메뉴/버튼에 결코 들어가지 않음 — 상세는 SPEC-AI-011 spec.md HISTORY v1.1.0) 해당 키보드 요구가 SPEC-AI-011에서 철회되었다. 이에 따라 본 SPEC의 REQ-AI-008-013을 "Tab / 방향키 / Enter / Space"에서 방향키를 제거해 "Tab / Enter / Space"로, AC-AI-008-009를 방향키 래핑 순환과 "포커스 진입(트리거 활성화 → 첫 항목)"을 제거해 실제 구현(Tab 포커스 순회 + Enter/Space 선택 + Esc 복귀 + role 부여)만 서술하도록 되돌렸다. `role="menu"`/`role="menuitem"` 요구는 방향키와 무관한 접근성 표기이므로 그대로 유지한다. |

## Summary

`mdedit`(Tauri v2 + React 18 + TypeScript + CodeMirror 6) AI 선택 툴바의 프리셋 메뉴에서 **"🧜 다이어그램으로"** 항목에 마우스를 올리거나(hover) 클릭하면(no-hover/touch) **플라이아웃 서브메뉴**가 펼쳐진다. 서브메뉴는 8개 항목이다:

1. **"자동 (AI 판단)"** — 첫 항목·기본. 오늘과 동일하게 AI가 다이어그램 종류를 스스로 고른다(프롬프트 무변경).
2. **7종 프리셋** — flowchart, sequenceDiagram, gantt, classDiagram, stateDiagram(-v2), pie, mindmap. 각 항목은 SPEC-UI-008이 이미 구현한 **흑백 스켈레톤 아이콘 형상**과 **한글 라벨**을 재사용한다.

종류를 선택하면 AI 다이어그램 생성 요청에 **그 mermaid 종류를 강제하는 제약 조각**이 실려, Rust에서 조립되는 다이어그램 시스템 프롬프트가 "정확히 그 종류만" 생성하도록 좁혀진다. "자동"을 선택하면 오늘의 프롬프트가 **바이트 단위로 동일**하게 유지된다.

기존 다운스트림 흐름 — 스트리밍, `mermaidValidate.ts`의 `mermaid.parse` 사전 검증, 제안 카드(ai-suggestion-card), 자동 재요청/목록 폴백 UX(SPEC-AI-003/004/006 계보) — 는 **그대로**다. 이 SPEC이 더하는 것은 오직 프롬프트의 종류 제약뿐이다.

핵심 설계 결정(사용자 승인, 재검토 금지):

- **진입점**: `src/components/editor/extensions/ai-selection-toolbar.ts`. `createPresetMenu`(명령형 `document.createElement` DOM)의 `diagram` 항목 클릭 핸들러를 "즉시 `fire('diagram')`"에서 "플라이아웃 서브메뉴 열기"로 바꾼다. 서브메뉴도 동일한 명령형 DOM 패턴으로 구성한다(React 리라이트 없음).
- **자동 우선**: 서브메뉴 첫 항목은 항상 "자동 (AI 판단)"이며, 이는 오늘의 동작(AI가 종류 선택)이다. 이 항목 선택은 종류 필드 없이 `fire('diagram')`을 호출한다.
- **프롬프트 주입 지점**: 프롬프트 조립은 전부 Rust이므로(REQ-AI-003), 종류 제약도 Rust `prompt.rs`에서 주입한다. 단 `AiFeature::Diagram`은 **전용 조립 분기가 없다** — polish/outline/table/shorten/custom과 함께 공유 `build_inline_prompt`(prompt.rs:171, mod.rs:147 `_` 암)를 타며, 그 조립 시스템 프롬프트는 `format!("{}\n\n{}", feature.system_prompt(), INLINE_SCOPE)`(prompt.rs:196)이다. 따라서 종류 제약은 이 공유 경로 안에서 **feature가 Diagram이고 `diagram_type`이 있을 때만** 조각을 덧붙이는 diagram 전용 게이팅으로 주입해야 한다. IPC는 신규 optional 필드 `diagramType`(camelCase) → Rust `diagram_type: Option<String>`로 종류를 전달한다. `diagram_type=None`(자동)이면 `build_inline_prompt`가 산출하는 Diagram `system_prompt`가 현행 조립 결과(= `AiFeature::Diagram.system_prompt()` + `\n\n` + INLINE_SCOPE)와 **바이트 단위로 동일**하다.
- **재요청 승계**: `fireReRequest`(ai-suggestion-card.ts:1101)가 `{ ...originalArgs, ...overrides }`로 원본 args를 스프레드하므로, 초기 요청에 `diagramType`이 실리면 mermaid 파싱 실패에 따른 자동 재요청(feature 유지='diagram')에도 종류 제약이 **자동 승계·재복창**된다. 재요청 메커니즘 자체는 변경하지 않는다.
- **AI 경계·검증 계약 무변경**: `mermaidValidate.ts`, `decideDiagramOutcome`, `buildFallbackDecision`은 그대로다. 파싱 유효성(mermaid.parse)이 **유일한 하드 게이트**로 남고, 종류 불일치는 검증 실패로 취급하지 않는다.

## Background & Rationale

현재 AI 선택 툴바에서 "다이어그램으로"를 고르면(ai-selection-toolbar.ts:128 `{ kind:'diagram', label:'🧜 다이어그램으로' }`) AI가 다이어그램 종류를 **스스로** 판단해 mermaid를 생성한다. Rust 프롬프트(`prompt.rs` `AiFeature::Diagram`)는 종류 중립적이다 — "graph·flowchart·sequenceDiagram 등 mermaid 키워드로 시작"이라고만 지시한다. 그 결과 사용자가 간트 차트를 원해도 AI가 flowchart를 뽑는 등, 원하는 종류를 얻으려면 여러 번 재요청하거나 "직접 입력"으로 종류를 문장으로 지시해야 한다.

SPEC-UI-008이 **수동 삽입**용 7종 프리셋(아이콘 + 한글 라벨 + 즉시 렌더되는 스켈레톤 예제)을 이미 도입했다. 본 SPEC은 그 종류 목록·아이콘 형상을 재사용해 **AI 생성** 쪽에도 종류 선택을 부여한다: 사용자가 종류를 고르면 AI가 그 종류로만 생성하도록 프롬프트를 좁힌다. 진입 장벽을 낮추고 재요청 횟수를 줄이는 것이 목적이다.

기술 컨텍스트(소스 근거):

- **프롬프트 조립 = 100% Rust**: `ai_request`(mod.rs:112)는 `AiFeature::resolve(feature, presetKind, customInstruction)`로 내부 템플릿을 정한 뒤 `build_inline_prompt`로 조립한다. 프론트는 "기능 종류 + 텍스트 조각"만 넘긴다(REQ-AI-003, ipc.ts:186). 다이어그램 프리셋은 `feature='diagram'` + `presetKind='diagram'`로 도착해 `AiFeature::Diagram`으로 매핑된다(prompt.rs:76, resolve_diagram_feature_with_and_without_preset 테스트). 종류 제약을 프론트에서 문자열로 붙일 수 없으므로 **Rust 조립 지점에서 주입**해야 한다.
- **다이어그램 프롬프트 현행**: `AiFeature::Diagram.system_prompt()`(prompt.rs:101–106)는 "순수 mermaid 문법만, 펜스·설명 없이, mermaid 키워드로 시작"을 지시한다(BUG-3(b) 대응). 종류 제약은 이 지시에 "반드시 `<종류>`만" 절을 덧붙이는 형태다.
- **IPC 계약**: `AiRequestArgs`(mod.rs:83, ipc.ts:195)는 camelCase→snake_case 자동 매핑, 모든 optional 필드는 `#[serde(default)]`. 신규 `diagramType?` 추가는 하위호환(자동=필드 생략).
- **다이어그램 검증·재요청**: `mermaidValidate.ts`의 `validateMermaid`(mermaid.parse) + `buildFallbackDecision`(1회 실패→auto-retry, 2회+→목록 폴백), 카드 컨트롤러의 `decideDiagramOutcome`(ai-suggestion-card.ts:169)가 **파싱 유효성만** 본다. 종류 불일치를 감지하는 코드는 없다.
- **재요청 승계 경로**: `fireReRequest`(ai-suggestion-card.ts:1091–1111, `@MX:ANCHOR`)는 `{ ...originalArgs, ...overrides, requestId }`로 발행한다. ↻/직접지시/sonnet 재요청은 `feature='diagram'`을 유지하므로 `diagramType`이 자동 승계된다. 목록 폴백만 `feature='inline-edit', presetKind='outline'`로 덮어써 종류를 의도적으로 버린다(더 이상 다이어그램이 아님).
- **아이콘 형상**: SPEC-UI-008이 `src/components/icons/icons.tsx`에 7종 JSX 아이콘 컴포넌트(FlowchartIcon 등, `stroke="currentColor"`, 런타임 의존성 없음)를 인라인했다(icons.tsx:279–333). 단, AI 툴바는 **명령형 DOM**(document.createElement)이라 JSX 컴포넌트를 직접 마운트할 수 없다 — 아이콘 path 마크업을 명령형 서브메뉴에서 재사용하려면 SVG 마크업의 **단일 소스**를 공유해야 한다(경로 데이터 중복 금지).
- **AI 토글**: `buildToolbarDecorations`(ai-selection-toolbar.ts:692)는 `getUiState().enabled === false`면 ✨ 데코레이션 자체를 렌더하지 않는다(SPEC-AI-005 REQ-AI5-007). 즉 AI가 꺼져 있으면 툴바가 아예 없어 서브메뉴도 도달 불가다(수동 삽입 SPEC-UI-008과 대비 — 그쪽은 토글 무관).

## Environment & Assumptions

- 프론트엔드: React 18, TypeScript strict, CodeMirror 6, Tailwind CSS 3 + SPEC-UI-006 `.md-*`/`.mdedit-*` 토큰·컴포넌트 CSS.
- AI 툴바: `ai-selection-toolbar.ts`의 `AiSparkleWidget`(WidgetType, 명령형 DOM) + `createPresetMenu`(팝오버, 명령형 DOM). 외부 mousedown 닫기는 위젯(`onOutsideMouseDown`, ai-selection-toolbar.ts:622)이 소유한다.
- 백엔드: Rust `src-tauri/src/ai/{mod.rs,prompt.rs}`. 프롬프트 조립·IPC 역직렬화(camelCase). `AiFeature::Diagram`가 종류 중립적으로 이미 존재.
- 프리셋 종류·아이콘: SPEC-UI-008이 `keyboard-shortcuts.ts` `DIAGRAM_PRESETS`(7종 + custom)와 `icons.tsx` 7종 아이콘을 도입. 본 SPEC은 그중 **7종(custom 제외)**의 종류 키·라벨·아이콘 형상을 재사용한다.
- 다이어그램 검증: mermaid 11.12.3(SPEC-PREVIEW-006 핀), `mermaidValidate.ts`(`securityLevel:'strict'`). 검증 계약 무변경.
- 테스트 환경: vitest + @testing-library/react + jsdom(명령형 DOM 테스트 선례: `aiSelectionToolbar.test.ts` `createPresetMenu`/`AiSparkleWidget` describe). Rust는 `#[cfg(test)]` 단위 테스트(prompt.rs 하단).

## Requirements (EARS)

> 종류 키 표기: 프론트 union은 SPEC-UI-008 `DiagramPreset`에서 `custom`을 제외한 7종을 재사용한다 — `'flowchart' | 'sequenceDiagram' | 'gantt' | 'classDiagram' | 'stateDiagram' | 'pie' | 'mindmap'`. (`stateDiagram` 키는 첫 줄 키워드 `stateDiagram-v2`에 대응 — "Diagram Type Prompt Fragments" 표 참조.)

### Ubiquitous Requirements

- **REQ-AI-008-001**: The system **shall** 항상 다이어그램 플라이아웃 서브메뉴를 정확히 8개 항목으로 구성한다 — "자동 (AI 판단)"이 첫 항목, 이어 7종 프리셋(flowchart / sequenceDiagram / gantt / classDiagram / stateDiagram / pie / mindmap). 각 항목은 비어 있지 않은 `aria-label`과 한글 라벨 텍스트를 갖는다.
- **REQ-AI-008-002**: The system **shall** 항상 7종 종류 항목의 아이콘을 SPEC-UI-008 스켈레톤 아이콘 형상과 동일한 SVG 마크업으로 렌더하고, `stroke="currentColor"`를 상속하여 텍스트 색 변경 시 함께 반전되게 한다(별도 색상 하드코딩 없음).
- **REQ-AI-008-003**: The system **shall** 항상 서브메뉴·항목·아이콘 스타일을 `--md-*`/`.mdedit-*` 시맨틱 토큰 및 `currentColor`만으로 렌더한다(raw hex 색상 리터럴 금지). 다크모드는 토큰 전환으로 자동 적용된다.
- **REQ-AI-008-004**: The system **shall** 항상 "자동 (AI 판단)" 항목을 첫 번째·기본 항목으로 배치하며, 이 항목은 오늘의 동작(AI가 다이어그램 종류를 스스로 판단)을 나타낸다.
- **REQ-AI-008-005**: The system **shall** 항상 "다이어그램으로" 트리거 항목에 `aria-haspopup="true"`와 서브메뉴 열림 상태를 반영하는 `aria-expanded`를 유지한다.

### Event-Driven Requirements

- **REQ-AI-008-006**: **WHEN** hover 가능 포인터가 "다이어그램으로" 항목 위에 올라오면, **the system shall** 플라이아웃 서브메뉴를 연다. (hover intent 지연 값은 이진 수용 기준이 아니며 Design Notes에서 다룬다.) hover 열림과 클릭 열림(REQ-007)은 상호 배타적이지 않으며, 둘 다 멱등 열기 연산이므로 같은 제스처에서 연달아 실행되어도 결과가 동일하다(SPEC-AI-011).
- **REQ-AI-008-007**: **WHEN** "다이어그램으로" 항목이 클릭·활성화되면(포인터·키보드 어느 경로든), **the system shall** 플라이아웃 서브메뉴를 **연다. 이미 열려 있으면 상태를 바꾸지 않는다**(open-only, SPEC-AI-011). 이 항목의 활성화는 어느 경로에서도 즉시 다이어그램 요청을 발행하지 않는다(오늘 동작과의 차이).
- **REQ-AI-008-008**: **WHEN** 사용자가 "자동 (AI 판단)"을 선택하면, **the system shall** 다이어그램 요청을 **종류 필드 없이**(`diagramType` 생략) 발행하고 서브메뉴와 프리셋 메뉴를 닫는다.
- **REQ-AI-008-009**: **WHEN** 사용자가 7종 종류 항목 중 하나를 선택하면, **the system shall** 다이어그램 요청에 선택한 종류(`diagramType`)를 실어 발행하고 서브메뉴와 프리셋 메뉴를 닫는다.
- **REQ-AI-008-010**: **WHEN** 다이어그램 요청이 종류(`diagramType`)를 실어 도착하면, **the system shall** 공유 `build_inline_prompt` 경로 안에서 **feature가 Diagram일 때만** "Diagram Type Prompt Fragments" 표의 해당 제약 조각을 조립되는 시스템 프롬프트에 덧붙여, 출력이 정확히 그 mermaid 종류가 되도록 강제한다(diagram 전용 게이팅 — 다른 인라인 기능 경로에는 조각이 실리지 않는다).
- **REQ-AI-008-011**: **WHEN** 서브메뉴가 열린 상태에서 Escape가 눌리면, **the system shall** 서브메뉴만 닫고 상위 프리셋 목록으로 포커스를 복귀시킨다(툴바 전체를 닫지 않는다 — 기존 custom-input의 Esc→목록 복귀 선례와 동형).
- **REQ-AI-008-012**: **WHEN** 서브메뉴가 열린 상태에서 툴바 래퍼(`.mdedit-ai-toolbar`) 외부에 mousedown이 발생하면, **the system shall** 서브메뉴를 상위 메뉴와 함께 닫는다(기존 위젯 `onOutsideMouseDown` 경로 재사용).
- **REQ-AI-008-013**: **WHEN** 사용자가 서브메뉴 내부를 키보드(Tab / Enter / Space)로 조작하면, **the system shall** 8개 항목 간 포커스를 이동시키고 Enter/Space로 포커스된 항목을 선택 가능하게 한다(기존 프리셋 항목과 동일한 네이티브 `<button>` 시맨틱). 서브메뉴 컨테이너는 `role="menu"`를, 8개 항목은 각각 `role="menuitem"`을 갖는다(SPEC-AI-011). (v0.0.4: 방향키 래핑 순환 요구는 도달 불가로 확인되어 철회 — HISTORY 참조)

### State-Driven Requirements

- **REQ-AI-008-014**: **WHILE** mermaid 파싱 실패로 인한 다이어그램 자동 재요청(feature='diagram' 유지)이 진행되는 동안, **the system shall** 최초 선택한 종류(`diagramType`)를 재요청에 승계하여 종류 제약이 재복창되게 한다(`fireReRequest`의 원본 args 스프레드 경로). 목록 폴백(outline) 경로는 오늘과 같이 종류를 버린다.
- **REQ-AI-008-015**: **WHILE** 상위 프리셋 메뉴가 닫히는 동안(Esc/외부 클릭/발행 완료), **the system shall** 열려 있던 플라이아웃 서브메뉴도 함께 닫고 관련 리스너·타이머를 정리한다(누수 없음).
- **REQ-AI-008-016**: **WHILE** AI 토글(SPEC-AI-005 `effectiveAiEnabled`)이 비활성인 동안, **the system shall** ✨ 선택 툴바 데코레이션 자체를 렌더하지 않아 다이어그램 서브메뉴가 도달 불가 상태가 되게 한다(REQ-AI5-007과 일관 — 수동 삽입 SPEC-UI-008과 달리 AI 생성은 토글에 종속).

### Unwanted Behavior Requirements

- **REQ-AI-008-017**: The system **shall not** 다이어그램 종류 불일치(AI가 요청한 종류와 다른 mermaid 종류를 반환)를 검증 실패로 취급하거나 이를 위한 새 런타임 게이트를 추가한다. `mermaid.parse` 유효성이 유일한 하드 게이트로 남으며 `validateMermaid`/`decideDiagramOutcome`/`buildFallbackDecision` 계약은 무변경이다. (근거: 종류 준수는 검증이 아니라 프롬프트 제약(REQ-AI-008-010)과 재요청 승계(REQ-AI-008-014)로 달성한다 — Design Notes 참조.)
- **REQ-AI-008-018**: The system **shall not** "자동" 경로의 동작을 바꾼다 — `diagram_type=None`(자동)일 때 `build_inline_prompt`가 산출하는 Diagram 조립 시스템 프롬프트는 **현행 조립 결과(= `AiFeature::Diagram.system_prompt()` + `\n\n` + INLINE_SCOPE)와 바이트 단위로 동일**해야 한다.
- **REQ-AI-008-019**: The system **shall not** 신규 런타임 의존성을 추가한다(`package.json` 및 `src-tauri/Cargo.toml` dependencies 무변경). 플라이아웃/포털 라이브러리 도입 금지 — 순수 CSS 포지셔닝.
- **REQ-AI-008-020**: The system **shall not** SPEC-UI-008 수동 삽입 흐름(`insertDiagram`, `DIAGRAM_PRESETS`, `keyboard-shortcuts.ts` 스니펫 상수, 빈-펜스 프리뷰 플레이스홀더)의 동작·계약을 변경하거나 호출한다. AI 생성(본 SPEC)과 수동 삽입(UI-008)은 역할이 분리된다.
- **REQ-AI-008-021**: The system **shall not** mermaid 버전 핀(11.12.3, SPEC-PREVIEW-006) 또는 `securityLevel:'strict'` 불변식을 변경한다.
- **REQ-AI-008-022**: The system **shall not** 나머지 17종 mermaid 유형을 서브메뉴에 추가한다(서브메뉴는 정확히 자동 + 7종 = 8항목으로 고정, v1).
- **REQ-AI-008-023**: The system **shall not** 다이어그램 아이콘 SVG path 데이터를 복제한다 — 명령형 서브메뉴와 SPEC-UI-008 JSX 아이콘 컴포넌트가 소비하는 렌더 path 문자열이 종류별로 서로 동일해야 한다(단일 소스). 추출 리팩터 후 기존 JSX 아이콘 7종이 렌더하는 SVG(예: `d` path 문자열)는 추출 전과 무변경이어야 한다.
- **REQ-AI-008-024**: The system **shall not** 신규 전역 키보드 단축키를 등록한다(`markdownKeyBindings` 무변경). 서브메뉴 내 키보드 조작(REQ-AI-008-013)은 전역 단축키 등록이 아니므로 이에 해당하지 않는다.
- **REQ-AI-008-025**: The system **shall not** 비-diagram 인라인 5기능(polish / outline / table / shorten / custom)의 조립 시스템 프롬프트를 변경한다 — 공유 `build_inline_prompt` 경로에 diagram 종류 게이팅을 배선한 뒤에도 이 5기능이 산출하는 시스템 프롬프트는 변경 전과 **바이트 단위로 동일**해야 한다(공유 hot path 회귀 가드, SPEC-AI-003/004/006 계보 보호).

## Diagram Type Prompt Fragments

아래 7개 조각은 `diagram_type`가 실렸고 feature가 Diagram일 때만, 공유 `build_inline_prompt` 경로 안의 diagram 전용 게이팅으로 조립 시스템 프롬프트에 덧붙는다(REQ-AI-008-010). "첫 줄 키워드"는 생성된 mermaid의 첫 줄이 시작해야 하는 토큰이며, 조각이 그 키워드를 명시한다. `diagram_type` 미도착(자동)이면 조각을 덧붙이지 않아 현행 조립 결과와 바이트 동일하고(REQ-AI-008-018), 비-diagram 5기능 경로는 이 게이팅에 진입하지 않는다(REQ-AI-008-025).

| `diagramType` (프론트 키) | 첫 줄 키워드 | 프롬프트 제약 조각(Rust, 한글) | 재사용 근거(스니펫 헤더, SPEC-UI-008) |
|---------------------------|-------------|-------------------------------|----------------------------------------|
| `flowchart` | `flowchart` | "반드시 mermaid 순서도만 생성하라. 출력 첫 줄은 `flowchart` 키워드로 시작해야 한다." | `flowchart TD` |
| `sequenceDiagram` | `sequenceDiagram` | "반드시 mermaid 시퀀스 다이어그램만 생성하라. 출력 첫 줄은 `sequenceDiagram` 키워드로 시작해야 한다." | `sequenceDiagram` |
| `gantt` | `gantt` | "반드시 mermaid 간트 차트만 생성하라. 출력 첫 줄은 `gantt` 키워드로 시작해야 한다." | `gantt` |
| `classDiagram` | `classDiagram` | "반드시 mermaid 클래스 다이어그램만 생성하라. 출력 첫 줄은 `classDiagram` 키워드로 시작해야 한다." | `classDiagram` |
| `stateDiagram` | `stateDiagram-v2` | "반드시 mermaid 상태 다이어그램만 생성하라. 출력 첫 줄은 `stateDiagram-v2` 키워드로 시작해야 한다." | `stateDiagram-v2` |
| `pie` | `pie` | "반드시 mermaid 파이 차트만 생성하라. 출력 첫 줄은 `pie` 키워드로 시작해야 한다." | `pie title ...` |
| `mindmap` | `mindmap` | "반드시 mermaid 마인드맵만 생성하라. 출력 첫 줄은 `mindmap` 키워드로 시작해야 한다." | `mindmap` |

> 조각의 정확한 문구는 Run phase 재량이나, (1) 종류를 명시할 것, (2) 첫 줄 키워드를 표의 값으로 명시할 것, (3) 기존 "펜스·설명 없이, 순수 mermaid만" 지시와 충돌하지 않을 것 — 세 계약은 고정이다. 조각은 첫 줄 키워드 anchor일 뿐, 별도 런타임 종류 검증기를 신설하지 않는다(REQ-AI-008-017).

## Design Notes / Future Considerations

> 아래는 요구사항이 아니며(AC 없음), Run phase의 설계 참고 사항이다.

- **아이콘 공유 소스(REQ-AI-008-023 구현 힌트)**: 명령형 서브메뉴는 JSX를 마운트할 수 없으므로, 7종 아이콘의 SVG inner 마크업을 문자열 단일 소스(예: `icons.tsx` 옆의 상수 모듈)로 추출해 (a) 기존 JSX 컴포넌트와 (b) 명령형 서브메뉴(`innerHTML` 또는 SVG 노드 생성)가 함께 소비하도록 상정한다. path 데이터를 서브메뉴에 다시 타이핑하지 말 것. 정확한 추출 형태는 Run phase 재량.
- **hover intent 지연(REQ-AI-008-006 힌트)**: 작은 지연(예: ~120ms)으로 우발적 hover 열림을 억제하되, 이진 수용 기준이 아닌 설계 목표다(SPEC-AI-011 Rejected Alternatives (e) — 타이밍 의존 동작은 검증 불가로 기각되었으므로 미구현 상태를 유지한다). 이진 검증 대상은 "hover 시 열림 / 클릭 시 열림(open-only) / Esc 복귀 / 외부 클릭 닫힘"에 한한다.
- **자동 항목 아이콘**: "자동 (AI 판단)"은 종류 아이콘 대신 라벨만 두거나 별도 auto 글리프를 쓸 수 있다(Run 재량). 종류 아이콘 재사용 요구(REQ-AI-008-002)는 7종 항목에 한정된다.
- **IPC 필드명**: `diagramType`(camelCase) → Rust `diagram_type: Option<String>`(`#[serde(default)]`). 값은 프론트 union 키(`flowchart` 등)와 문자 동일하게 상정한다. Rust는 미지의 값에 관대하게(무시 → 자동과 동일) 처리하거나 명시적 매핑 실패를 자동으로 폴백하는 방향을 권장한다.
- **fire 시그니처 확장 힌트**: `fire(presetKind, customInstruction)`에 종류 인자를 더해 `buildSelectionRequest`가 `args.diagramType`을 채우는 방식을 상정한다. `presetToFeature`/`feature='diagram'` 매핑은 무변경.
- **종류 게이팅 구현 힌트(REQ-AI-008-010/025)**: 격리된 Diagram match 암이 없으므로, `diagram_type`을 `build_inline_prompt`(또는 그 diagram 전용 래퍼)에 전달해 feature가 Diagram이고 값이 있을 때만 조각을 부착하는 방식을 상정한다. 5기능 회귀 가드(REQ-025)는 diagram 게이팅이 `matches!(feature, AiFeature::Diagram)` 등으로 엄격히 한정됐는지에 달려 있다.
- **종류 불일치 처리 근거(REQ-AI-008-017)**: 종류 준수는 런타임 검증이 아니라 프롬프트 제약(REQ-010)과 재요청 승계(REQ-014)로 달성한다. AI가 요청과 다른 종류를 반환해도 parse가 유효하면 통과시키는 이유는, 종류-일치 하드 게이트를 추가하면 재요청 루프·과다 재시도 위험이 생기고 `decideDiagramOutcome` 계약을 깨기 때문이다.

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src/components/editor/extensions/ai-selection-toolbar.ts` | `createPresetMenu`의 `diagram` 항목 클릭을 "즉시 발행"에서 "플라이아웃 서브메뉴 열기"로 변경; 명령형 서브메뉴(8항목: 자동 + 7종, hover/click/Esc/키보드) 추가; `fire()`·`BuildSelectionRequestInput`·`AiSelectionRequest.args`에 `diagramType` 전달 경로 추가 |
| [MODIFY] | `src/lib/tauri/ipc.ts` | `AiRequestArgs`에 optional `diagramType?: DiagramType`(7종 union) 추가 |
| [MODIFY] | `src-tauri/src/ai/mod.rs` | `AiRequestArgs`에 `#[serde(default)] diagram_type: Option<String>` 추가; `ai_request`의 공유 인라인 조립 호출(`_` 암, mod.rs:147)에 `diagram_type`을 전달 |
| [MODIFY] | `src-tauri/src/ai/prompt.rs` | 공유 `build_inline_prompt` 경로에 diagram 전용 게이팅 추가 — feature가 Diagram이고 `diagram_type`이 있을 때만 종류 제약 조각(7종, 첫 줄 키워드) 부착. `diagram_type=None` 또는 비-diagram feature이면 현행 조립 결과와 바이트 동일 유지(격리된 Diagram match 암을 신설하거나 조립 함수에 diagram 게이팅 인자를 추가하는 방식 — Run 재량) |
| [MODIFY] | `src/components/icons/icons.tsx` (+ 인접 SVG 마크업 소스) | 7종 아이콘 SVG inner 마크업을 명령형 DOM과 공유 가능한 단일 소스로 추출(REQ-AI-008-023, path 중복 금지). 추출 후 기존 JSX 아이콘 렌더 SVG는 무변경 |
| [MODIFY] | `src/test/diagramIcons.test.tsx` 또는 인접 아이콘 테스트 | 추출 리팩터 전후 7종 JSX 아이콘 렌더 SVG(`d` path 문자열) 무변경 회귀 어서션(REQ-AI-008-023, AC-AI-008-014) |
| [MODIFY] | `src/styles/mdedit-components.css` | 플라이아웃 서브메뉴 클래스(`.mdedit-ai-diagram-submenu*`) 추가(토큰·currentColor만) |
| [MODIFY] | `src/test/aiSelectionToolbar.test.ts` | 서브메뉴 열림/닫힘/키보드/자동·종류 선택 → `diagramType` 유무 어서션; 기존 프리셋/재요청 테스트 회귀 없음 확인 |
| [MODIFY] | `src-tauri/src/ai/prompt.rs` (`#[cfg(test)]`) | 종류 조각 주입/`diagram_type=None` 바이트 동일 단위 테스트 + **비-diagram 5기능(polish/outline/table/shorten/custom) 조립 프롬프트 바이트 동일 회귀 테스트**(AC-AI-008-014) 추가; 기존 `diagram_prompt_*`/`inline_scope_*` 테스트 회귀 없음 |
| [MODIFY] | `src-tauri/src/ai/mod.rs` (`#[cfg(test)]`) | `diagram_type` camelCase(`diagramType`) 역직렬화 + 조립 전달 회귀 가드 |

## Acceptance Criteria

> 컴포넌트 테스트(vitest + jsdom, `aiSelectionToolbar.test.ts` 패턴)를 기본으로 하고, 프롬프트 종류 제약·회귀는 Rust `#[cfg(test)]` 단위 테스트로 검증한다. 아래 표는 REQ-AI-008-001~025 전체를 커버한다. 각 AC의 Given-When-Then 상세는 sibling `acceptance.md`(AC-AI-008-001~014)에 1:1로 전개되어 있다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI-008-001 | REQ-AI-008-005, 006, 007 | "다이어그램으로" 항목 hover → 서브메뉴 열림; 클릭 → 열림(이미 열려 있으면 무변경, SPEC-AI-011); `aria-haspopup`/`aria-expanded` 반영; 클릭이 즉시 요청을 발행하지 않음 |
| AC-AI-008-002 | REQ-AI-008-001, 004 | 서브메뉴가 정확히 8항목, "자동 (AI 판단)"이 첫 항목; 7종 순서(flowchart→…→mindmap); 각 항목 개별 `aria-label` + 한글 라벨 |
| AC-AI-008-003 | REQ-AI-008-002, 023 | 7종 항목 아이콘이 `<svg>` + `stroke="currentColor"` 상속으로 렌더; 서브메뉴 렌더 path 문자열이 SPEC-UI-008 JSX 아이콘의 렌더 path 문자열과 종류별로 동일(단일 소스, 중복 없음) |
| AC-AI-008-004 | REQ-AI-008-008, 018 | "자동" 선택 → 요청에 `diagramType` 미포함; `diagram_type=None`으로 `build_inline_prompt`가 산출하는 Diagram 시스템 프롬프트 == 현행 조립 결과(`system_prompt()` + `\n\n` + INLINE_SCOPE) 스냅샷과 바이트 동일 |
| AC-AI-008-005 | REQ-AI-008-009 | 7종 각 항목 선택 → 요청 args에 해당 `diagramType`(정확한 종류 키) 포함, 서브메뉴·메뉴 닫힘 |
| AC-AI-008-006 | REQ-AI-008-010 | `diagram_type` 실린 요청 → 공유 경로의 diagram 게이팅으로 조립 프롬프트에 해당 종류 제약 조각 + 첫 줄 키워드(표) 포함; 7종 각각 서로 다른 키워드 명시 |
| AC-AI-008-007 | REQ-AI-008-011, 015 | 서브메뉴 열림 상태 Esc → 서브메뉴만 닫히고 프리셋 목록 복귀(툴바 유지); 메뉴 닫힘 시 서브메뉴/리스너 정리 |
| AC-AI-008-008 | REQ-AI-008-012 | 서브메뉴 열림 상태에서 툴바 외부 mousedown → 서브메뉴 + 상위 메뉴 함께 닫힘 |
| AC-AI-008-009 | REQ-AI-008-013 | Tab 포커스 순회 + Enter/Space로 포커스 항목 선택(네이티브 `<button>`); 복귀(Esc → 트리거) 포함; 서브메뉴 `role="menu"` + 항목 `role="menuitem"`(SPEC-AI-011). (v0.0.4: 방향키 래핑 순환·포커스 진입 요구는 철회 — HISTORY 참조) |
| AC-AI-008-010 | REQ-AI-008-014, 017 | 종류 실은 초기 요청의 자동 재요청(feature='diagram')이 `diagramType` 승계(`fireReRequest` 스프레드); 종류 불일치는 검증 실패로 취급되지 않음(`decideDiagramOutcome`/`buildFallbackDecision` 무변경); 목록 폴백은 종류 버림 |
| AC-AI-008-011 | REQ-AI-008-016 | AI 토글 OFF(`enabled:false`) → `buildToolbarDecorations`가 데코 0건 → 툴바/서브메뉴 미노출 |
| AC-AI-008-012 | REQ-AI-008-003 | 신규 서브메뉴 CSS·아이콘이 `--md-*`/`.mdedit-*` 토큰·`currentColor`만 사용, raw hex 없음 |
| AC-AI-008-013 | REQ-AI-008-019, 020, 021, 022, 024 | `package.json`·`Cargo.toml` 신규 의존성 0건; 서브메뉴 정확히 8항목(17종 미추가); SPEC-UI-008 `insertDiagram`/`DIAGRAM_PRESETS`/빈-펜스 플레이스홀더 무변경; mermaid 핀·`securityLevel` 무변경; `markdownKeyBindings` 무변경 |
| AC-AI-008-014 | REQ-AI-008-023, 025 | 아이콘 추출 리팩터 후 SPEC-UI-008 JSX 아이콘 7종 렌더 SVG(`d` path) 무변경(스냅샷/등가 어서션); diagram 게이팅 배선 후 비-diagram 5기능(polish/outline/table/shorten/custom) 조립 시스템 프롬프트가 변경 전과 바이트 동일(Rust 스냅샷 테스트) |

REQ 커버리지 대조(001–025 전수): 001→AC2, 002→AC3, 003→AC12, 004→AC2, 005→AC1, 006→AC1, 007→AC1, 008→AC4, 009→AC5, 010→AC6, 011→AC7, 012→AC8, 013→AC9, 014→AC10, 015→AC7, 016→AC11, 017→AC10, 018→AC4, 019→AC13, 020→AC13, 021→AC13, 022→AC13, 023→AC3·AC14, 024→AC13, 025→AC14. 미커버 REQ 없음.

**Quality Gates (AC 외 공통 게이트)**: `npm run typecheck`(`tsc --noEmit`) 클린 + `npm test`(vitest) 전체 통과 + `npm run lint`(PR #37로 `.eslintrc.cjs` 복귀, 실패는 실제 결함) + `cargo test`(prompt.rs/mod.rs 단위 테스트) 통과 + 관련 시 `cargo clippy` 무경고 + `npm run test:e2e`(Playwright) 무변경 통과.

## Exclusions (What NOT to Build)

- **나머지 17종 mermaid 유형 없음** — er, journey, gitGraph, quadrantChart, requirementDiagram, C4, sankey, xychart, block, packet, kanban, architecture, radar, treemap 등은 서브메뉴에서 제외(v1). "자동"이 필요 시 AI 판단으로 생성 가능.
- **"자동" 모델 동작 변경 없음** — 자동 선택 시 AI가 종류를 고르는 오늘의 프롬프트·모델 동작은 바이트 동일 유지. 자동의 종류 선정 품질을 개선하지 않는다.
- **런타임 종류 검증기 없음** — AI가 요청과 다른 종류를 반환해도 새 하드 게이트를 만들지 않는다. mermaid.parse 유효성만 하드 게이트. 종류 준수는 프롬프트 제약 + 재요청 승계로만.
- **재요청 메커니즘 변경 없음** — `fireReRequest`/`decideDiagramOutcome`/`buildFallbackDecision`/카드 컨트롤러 계약 무변경. 종류 승계는 기존 스프레드 경로의 부수효과로 얻는다.
- **수동 삽입(SPEC-UI-008) 변경 없음** — `insertDiagram`, `DIAGRAM_PRESETS`, 에디터 툴바 "다이어그램" 버튼, 빈-펜스 플레이스홀더 무변경. custom(빈 펜스) 항목은 AI 서브메뉴에 없음.
- **툴바 React 리라이트 없음** — 서브메뉴는 기존 명령형 DOM 패턴을 따른다. 팝오버/floating-ui/포털 라이브러리 미도입.
- **아이콘 형상 재디자인 없음** — SPEC-UI-008 스켈레톤 아이콘 형상을 그대로 재사용. 새 아이콘 그리지 않음.
- **mermaid 버전·테마 연동 변경 없음** — 11.12.3 핀, `securityLevel:'strict'`, SPEC-PREVIEW-010 테마 연동 무변경.
- **키보드 단축키 없음** — 다이어그램 종류 선택 전용 전역 단축키 미도입(`markdownKeyBindings` 무변경).
- **AI 토글 무관 노출 없음** — 수동 삽입(UI-008)과 달리, AI 생성 서브메뉴는 AI 토글이 켜져 있을 때만 도달 가능(REQ-AI5-007 상속). 토글 OFF에서 별도 노출 경로를 만들지 않는다.
