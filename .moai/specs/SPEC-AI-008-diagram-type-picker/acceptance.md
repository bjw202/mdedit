---
id: SPEC-AI-008
version: "0.0.4"
status: draft
created: "2026-07-22"
updated: "2026-07-30"
author: "jw"
issue_number: 0
priority: medium
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.2 | 2026-07-22 | jw | 최초 acceptance 작성(run-entry, 관측 O3) — spec.md v0.0.2(plan-auditor review-2 PASS 0.96)의 인라인 AC 표(AC-AI-008-001~014)를 독립 Given-When-Then 14건으로 추출. spec.md AC 표·REQ→AC 대조표(001–025)와 1:1 정합. UI-008 acceptance.md 구조 준용(시나리오 + Quality Gate Criteria + Definition of Done). D1(자동=조립 결과 바이트 동일)·D2(비-diagram 5기능 회귀 스냅샷)·D3(UI-008 JSX 아이콘 렌더 무변경) 반영. 검증 스택: vitest + jsdom(`aiSelectionToolbar.test.ts` 명령형 DOM 선례) + Rust `#[cfg(test)]` 스냅샷(prompt.rs/mod.rs). 게이트에 `cargo test`/`cargo clippy` 포함. |
| 0.0.4 | 2026-07-30 | jw | **AC-AI-008-009의 방향키·포커스 진입 시나리오 철회(0.0.3 개정 (e)의 되돌림).** SPEC-AI-011 후속 조사에서 서브메뉴 키보드 내비게이션이 실제 macOS WKWebView 앱에서 도달 불가능함이 확인되어(메뉴 루트 `tabIndex=-1` + 포커스 이동 코드 없음, Tab은 에디터의 `indentWithTab`이 소비, WebKit은 버튼 클릭 시 포커스를 주지 않음 — 상세는 SPEC-AI-011 spec.md HISTORY v1.1.0) 해당 요구가 SPEC-AI-011에서 철회되었다. 방향키 래핑 순환 항목과 "트리거 활성화 → 첫 항목 포커스 진입" 항목을 제거하고 실제 구현(Tab 순회 + Enter/Space 선택 + Esc 복귀 + role 부여)만 남겼다. spec.md v0.0.4와 1:1 정합. `role="menu"`/`role="menuitem"`은 방향키와 무관한 접근성 표기이므로 유지. |
| 0.0.3 | 2026-07-30 | jw | **SPEC-AI-011로 REQ-006/007 충돌 해소 반영 — 클릭 열기 전용으로 개정.** AC-AI-008-001의 "클릭(no-hover/터치/키보드) → 토글" 시나리오를 "클릭(포인터·키보드 어느 경로든) → 열림, 이미 열려 있으면 무변경"으로 개정. AC-AI-008-009에 방향키 래핑 순환 + 포커스 진입(트리거 활성화 → 첫 항목)/복귀(Esc → 트리거) + `role="menu"`/`role="menuitem"` 시나리오를 추가. spec.md v0.0.3과 1:1 정합. 구현·검증은 SPEC-AI-011 참조. |

# Acceptance Criteria — SPEC-AI-008 (AI 다이어그램 종류 선택 플라이아웃)

검증 방식: **컴포넌트/단위 테스트 중심** — 프론트는 vitest + jsdom(명령형 DOM: `ai-selection-toolbar.ts`의 `createPresetMenu`/`AiSparkleWidget` describe 선례, `src/test/aiSelectionToolbar.test.ts`), Rust는 `#[cfg(test)]` 단위/스냅샷(`src-tauri/src/ai/prompt.rs`·`mod.rs` 하단). 프롬프트 종류 조각·바이트 동일 불변식은 Rust 스냅샷으로, 서브메뉴 상호작용·`diagramType` 전달은 jsdom으로 검증한다. 기존 Playwright E2E 스위트는 무변경 통과해야 하며, 본 SPEC은 신규 E2E를 요구하지 않는다(관련 시 선택적).

## Given-When-Then Scenarios

### AC-AI-008-001: "다이어그램으로" 항목 → 서브메뉴 열림(open-only) (REQ-AI-008-005, 006, 007)

- **Given** AI 프리셋 메뉴(`createPresetMenu`)가 열려 있고 "🧜 다이어그램으로" 항목이 렌더된 상태일 때
- **When** (hover 가능 환경에서) 포인터가 해당 항목에 올라오면
- **Then** 플라이아웃 서브메뉴가 열리고 트리거 항목의 `aria-expanded`가 `true`가 된다.
- **And** (포인터·키보드 어느 경로든) 해당 항목을 클릭·활성화하면 서브메뉴가 **연다. 이미 열려 있으면 상태를 바꾸지 않는다**(open-only, SPEC-AI-011) — 이 클릭은 다이어그램 요청을 즉시 발행하지 않는다(오늘의 즉시 `fire('diagram')` 동작과의 차이).
- **And** 트리거 항목은 `aria-haspopup="true"`를 유지한다.

### AC-AI-008-002: 8항목 구조 + 자동 우선 + 라벨 (REQ-AI-008-001, 004)

- **Given** 다이어그램 플라이아웃 서브메뉴가 열려 있을 때
- **When** 항목을 검사하면
- **Then** 항목이 정확히 8개이며, 첫 항목이 "자동 (AI 판단)"이고, 이어 7종(flowchart → sequenceDiagram → gantt → classDiagram → stateDiagram → pie → mindmap) 순서로 나열된다.
- **And** 각 항목이 비어 있지 않은 `aria-label`과 한글 라벨 텍스트를 갖는다.

### AC-AI-008-003: 아이콘 렌더 + 단일 소스 (REQ-AI-008-002, 023)

- **Given** 다이어그램 서브메뉴가 열려 있을 때
- **When** 7종 종류 항목의 아이콘을 검사하면
- **Then** 각 아이콘이 `<svg>` 요소로 렌더되고 `stroke="currentColor"`를 상속한다(별도 색상 하드코딩 없음).
- **And** 서브메뉴가 렌더하는 종류별 SVG path 문자열이 SPEC-UI-008 JSX 아이콘 컴포넌트(`FlowchartIcon` 등, icons.tsx:279–333)가 렌더하는 종류별 path 문자열과 동일하다(단일 소스, path 데이터 중복 0).

### AC-AI-008-004: "자동" 선택 → 종류 없음 + 조립 바이트 동일 (REQ-AI-008-008, 018)

- **Given** 다이어그램 서브메뉴가 열려 있을 때
- **When** "자동 (AI 판단)" 항목을 선택하면
- **Then** 발행되는 요청 args에 `diagramType`이 포함되지 않고(생략), 서브메뉴·프리셋 메뉴가 닫힌다.
- **And** (Rust) `diagram_type=None`으로 `build_inline_prompt`가 산출하는 Diagram `system_prompt`가 **현행 조립 결과(= `AiFeature::Diagram.system_prompt()` + `"\n\n"` + `INLINE_SCOPE`, prompt.rs:196)의 스냅샷과 바이트 단위로 동일**하다.

### AC-AI-008-005: 종류 선택 → diagramType 전달 (REQ-AI-008-009)

- **Given** 다이어그램 서브메뉴가 열려 있을 때
- **When** 7종 종류 항목 중 하나(예: 간트 차트=`gantt`)를 선택하면
- **Then** 발행되는 요청 args에 해당 `diagramType`(정확한 종류 키, 예: `'gantt'`)이 포함되고, 서브메뉴·프리셋 메뉴가 닫힌다.
- **And** 7종 각각이 자신의 종류 키를 정확히 실어 보낸다(`flowchart`/`sequenceDiagram`/`gantt`/`classDiagram`/`stateDiagram`/`pie`/`mindmap`).

### AC-AI-008-006: 종류 조각 프롬프트 주입 (REQ-AI-008-010)

- **Given** `diagram_type`가 실린 다이어그램 요청이 Rust에 도착할 때
- **When** 공유 `build_inline_prompt` 경로가 프롬프트를 조립하면
- **Then** feature가 Diagram일 때에 한해 "Diagram Type Prompt Fragments" 표의 해당 제약 조각과 첫 줄 키워드가 조립 시스템 프롬프트에 포함된다.
- **And** 7종 각각 서로 다른 첫 줄 키워드를 명시한다(`stateDiagram` → `stateDiagram-v2` 포함).

### AC-AI-008-007: Escape → 서브메뉴만 닫힘 + 정리 (REQ-AI-008-011, 015)

- **Given** 다이어그램 서브메뉴가 열려 있을 때
- **When** Escape 키가 눌리면
- **Then** 서브메뉴만 닫히고 상위 프리셋 목록으로 포커스가 복귀하며 프리셋 메뉴(툴바)는 유지된다(기존 custom-input의 Esc→목록 복귀 선례, ai-selection-toolbar.ts:482–491 동형).
- **And** 상위 프리셋 메뉴가 닫힐 때(Esc/외부 클릭/발행 완료) 열려 있던 서브메뉴도 함께 닫히고 관련 리스너·타이머가 정리된다(누수 없음).

### AC-AI-008-008: 외부 mousedown → 함께 닫힘 (REQ-AI-008-012)

- **Given** 다이어그램 서브메뉴가 열려 있을 때
- **When** 툴바 래퍼(`.mdedit-ai-toolbar`) 외부에 mousedown이 발생하면
- **Then** 서브메뉴와 상위 프리셋 메뉴가 함께 닫힌다(기존 위젯 `onOutsideMouseDown`, ai-selection-toolbar.ts:622 경로 재사용).

### AC-AI-008-009: 키보드 조작 (REQ-AI-008-013, SPEC-AI-011)

> v0.0.4: 방향키 래핑 순환과 "트리거 활성화 → 첫 항목 포커스 진입" 시나리오를 **철회**했다(0.0.3 개정 (e)의 되돌림). 실제 macOS WKWebView 앱에서 포커스가 툴바에 들어가지 않아 도달 불가로 확인됐다 — 상세는 SPEC-AI-011 spec.md HISTORY v1.1.0. spec.md v0.0.4와 1:1 정합. 아래는 실제 구현만 서술한다.

- **Given** 다이어그램 서브메뉴가 열려 있을 때
- **When** Tab으로 항목 간 이동 후 Enter 또는 Space를 누르면
- **Then** 포커스가 8개 항목 간 이동하고 포커스된 항목이 선택된다(기존 프리셋 항목과 동일한 네이티브 `<button>` 시맨틱).
- **And** Escape는 서브메뉴만 닫고 트리거로 포커스를 복귀시킨다.
- **And** 서브메뉴 컨테이너는 `role="menu"`를, 8개 항목은 각각 `role="menuitem"`을 갖는다.

### AC-AI-008-010: 재요청 종류 승계 + 종류 불일치 비-게이트 (REQ-AI-008-014, 017)

- **Given** 종류(`diagramType`)를 실은 다이어그램 요청이 발행되어 있고, AI 응답이 mermaid `parse`에 실패한 상태일 때
- **When** 자동 재요청(feature='diagram' 유지)이 발생하면
- **Then** `fireReRequest`(ai-suggestion-card.ts:1101, `@MX:ANCHOR`)의 `{ ...originalArgs, ... }` 스프레드로 `diagramType`이 재요청에 승계되어 종류 제약이 재복창된다.
- **And** AI가 요청과 다른 mermaid 종류를 반환해도 이는 검증 실패로 취급되지 않는다 — `mermaid.parse` 유효성만 하드 게이트이며 `validateMermaid`/`decideDiagramOutcome`(ai-suggestion-card.ts:169)/`buildFallbackDecision`는 무변경이다.
- **And** 목록 폴백(`feature='inline-edit'`, `presetKind='outline'`, ai-suggestion-card.ts:1172) 경로는 오늘과 같이 종류를 버린다.

### AC-AI-008-011: AI 토글 OFF → 툴바/서브메뉴 미노출 (REQ-AI-008-016)

- **Given** AI 토글(SPEC-AI-005 `effectiveAiEnabled`)이 비활성(`getUiState().enabled === false`)인 상태일 때
- **When** 선택이 발생해 `buildToolbarDecorations`(ai-selection-toolbar.ts:682)가 호출되면
- **Then** 데코레이션이 0건(`Decoration.none`, :692)이 되어 ✨ 선택 툴바가 렌더되지 않고, 따라서 다이어그램 서브메뉴도 도달 불가하다(수동 삽입 SPEC-UI-008과 달리 AI 생성은 토글에 종속).

### AC-AI-008-012: 토큰 전용 스타일(다크모드) (REQ-AI-008-003)

- **Given** 신규 서브메뉴 CSS·아이콘이 적용된 상태에서
- **When** 신규 클래스(`.mdedit-ai-diagram-submenu*`)·아이콘 마크업을 검사하면
- **Then** 모든 신규 스타일이 `--md-*`/`.mdedit-*` 시맨틱 토큰과 `currentColor`만 참조하고 raw hex 색상 리터럴이 없다(다크모드는 토큰 전환으로 자동).

### AC-AI-008-013: 회귀 가드 — 의존성/8항목/수동삽입/핀/키맵 (REQ-AI-008-019, 020, 021, 022, 024)

- **Given** 본 SPEC의 전체 변경이 적용된 상태에서
- **When** `package.json`·`src-tauri/Cargo.toml`·서브메뉴 항목·SPEC-UI-008 파일·mermaid 설정·키 바인딩을 검사하면
- **Then** `package.json`(dependencies/devDependencies)과 `Cargo.toml`(dependencies)에 신규 런타임 의존성이 0건이다.
- **And** 서브메뉴가 정확히 8항목(자동 + 7종)이며 나머지 17종 mermaid 유형이 추가되지 않았다.
- **And** SPEC-UI-008 수동 삽입 흐름(`insertDiagram`, `DIAGRAM_PRESETS`, `keyboard-shortcuts.ts` 스니펫 상수, 빈-펜스 프리뷰 플레이스홀더)이 무변경이며 본 SPEC이 이를 호출하지 않는다.
- **And** mermaid 버전 핀(11.12.3)·`securityLevel: 'strict'`가 무변경이고, `markdownKeyBindings`에 신규 바인딩이 없다.

### AC-AI-008-014: 아이콘 추출 회귀 + 비-diagram 5기능 프롬프트 스냅샷 (REQ-AI-008-023, 025)

- **Given** 아이콘 SVG 마크업 추출 리팩터와 Rust diagram 게이팅 배선이 적용된 상태에서
- **When** SPEC-UI-008 JSX 아이콘 7종(`FlowchartIcon`~`MindmapIcon`)의 렌더 결과와 비-diagram 인라인 5기능의 조립 프롬프트를 각각 변경 전 스냅샷과 대조하면
- **Then** 7종 JSX 아이콘이 렌더하는 SVG(예: `d` path 문자열)가 추출 전과 무변경이다(vitest 스냅샷/등가 어서션, `src/test/diagramIcons.test.tsx` 또는 인접 아이콘 테스트).
- **And** polish/outline/table/shorten/custom 5기능이 산출하는 조립 시스템 프롬프트가 diagram 게이팅 배선 후에도 변경 전과 바이트 단위로 동일하다(Rust `#[cfg(test)]` 스냅샷; 기존 `inline_scope_clause_present_for_all_six_inline_features`, prompt.rs:713 회귀 없음).

## Quality Gate Criteria

| 게이트 | 기준 |
|--------|------|
| 타입 체크 | `npm run typecheck`(`tsc --noEmit`) 클린 (에러 0) |
| 단위/컴포넌트 테스트(프론트) | `npm test`(vitest) 전체 통과 — 확장(`aiSelectionToolbar.test.ts` 서브메뉴/키보드/`diagramType`) + 신규(`diagramIcons.test.tsx` 아이콘 렌더 회귀) + 기존 전체 무변경 통과 |
| 단위/스냅샷 테스트(Rust) | `cargo test` 전체 통과 — 종류 조각 주입 + `diagram_type=None` 바이트 동일 + 비-diagram 5기능 프롬프트 바이트 동일 스냅샷; 기존 `diagram_prompt_*`/`inline_scope_*`/역직렬화 테스트 무변경 통과 |
| Rust 린트 | `cargo clippy` 무경고(신규 코드) |
| E2E | 기존 Playwright(`npm run test:e2e`) 스위트 무변경 통과. 신규 E2E는 필수 아님(관련 시 선택적) |
| Lint(프론트) | `npm run lint`(eslint, `.eslintrc.cjs`·PR #37) 통과 — lint 실패는 본 SPEC 구현의 실제 결함으로 취급 |
| 커버리지 | 신규 코드 커밋당 80% 이상, 전체 목표 85% |
| 의존성 | `package.json`·`src-tauri/Cargo.toml` 신규 런타임 의존성 0건 |
| 보안 불변식 | mermaid `securityLevel: 'strict'`, `startOnLoad: false` 유지, 버전 핀 11.12.3 유지 |
| IPC 하위호환 | `AiRequestArgs` 신규 `diagram_type`은 `#[serde(default)]` optional — 기존 역직렬화 테스트(mod.rs:381 등) 무변경 통과 |

## Definition of Done

- [ ] AC-AI-008-001 ~ 014 전 시나리오에 대응하는 테스트가 존재하고 통과
- [ ] REQ-AI-008-001 ~ 025 전 요구사항이 테스트 또는 diff 리뷰로 검증됨(spec.md AC 표 하단 REQ→AC 대조 참조)
- [ ] "자동"(diagram_type=None) 조립 프롬프트가 현행 조립 결과 스냅샷과 바이트 동일(D1)
- [ ] 비-diagram 인라인 5기능 조립 프롬프트가 게이팅 배선 후 바이트 동일(D2)
- [ ] SPEC-UI-008 JSX 아이콘 7종 렌더 SVG가 추출 리팩터 후 무변경(D3)
- [ ] 7종 종류 조각이 서로 다른 첫 줄 키워드를 명시(`stateDiagram`→`stateDiagram-v2` 포함)
- [ ] 종류가 자동 재요청에 승계되고, 종류 불일치가 검증 실패로 취급되지 않음(`decideDiagramOutcome`/`buildFallbackDecision` 무변경)
- [ ] AI 토글 OFF에서 툴바·서브메뉴 미노출 확인(`buildToolbarDecorations` → `Decoration.none`)
- [ ] `npm run typecheck` 클린 · `npm test` 전체 통과 · `npm run lint` 통과 · `cargo test` 통과 · `cargo clippy` 무경고 · 기존 Playwright 무변경 통과
- [ ] 신규 런타임 의존성 0(JS + Cargo) 확인, 서브메뉴 8항목 고정 확인, `markdownKeyBindings`·mermaid 핀 무변경 확인, 수동 삽입(SPEC-UI-008) 무변경 확인
- [ ] @MX 태그 적용(서브메뉴 DOM/`fire` `@MX:NOTE`, prompt.rs 게이팅 `@MX:NOTE`, `fireReRequest` `@MX:ANCHOR` 유지)
