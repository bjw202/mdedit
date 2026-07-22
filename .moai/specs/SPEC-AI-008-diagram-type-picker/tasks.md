# Task Decomposition

SPEC: SPEC-AI-008

개발 방법론: TDD (RED-GREEN-REFACTOR, 브라운필드 Pre-RED 특성화 스냅샷 포함). 검증 범위: 프론트 컴포넌트/단위 테스트(vitest + jsdom, `ai-selection-toolbar.ts` 명령형 DOM 선례) + Rust `#[cfg(test)]` 단위/스냅샷(prompt.rs·mod.rs). 신규 Playwright E2E 없음(기존 스위트 무변경 통과, acceptance.md Quality Gate 기준). 의존: main에서 PR #39(SPEC-UI-008) 머지 후 분기.

| Task ID | Description | TDD Phase | Requirement | Acceptance | Dependencies | Planned Files | Status |
|---------|-------------|-----------|-------------|------------|--------------|---------------|--------|
| T-001 | Pre-RED 특성화 스냅샷 — (Rust) 6개 인라인 기능(polish/outline/table/diagram/shorten/custom) 조립 `system_prompt` 바이트 스냅샷 + (프론트) UI-008 JSX 아이콘 7종 렌더 SVG(`d` path) 스냅샷을 변경 전 회귀 기준선으로 고정 | Pre-RED | REQ-018, REQ-023, REQ-025 | (기준선) AC-004, AC-014 | - | src-tauri/src/ai/prompt.rs, src/test/diagramIcons.test.tsx | pending |
| T-002 | 아이콘 SVG 단일 소스 추출 — 7종 마크업을 문자열 상수로 추출, JSX 컴포넌트(icons.tsx:279–333)가 상수 소비, 추출 후 렌더 SVG 무변경(단일 소스, path 중복 0) | RED→GREEN | REQ-002, REQ-023 | AC-003, AC-014 | T-001 | src/components/icons/icons.tsx (+ 인접 SVG 마크업 소스), src/test/diagramIcons.test.tsx | pending |
| T-003 | IPC 필드 추가 — (TS) `AiRequestArgs.diagramType?`(7종 union) + (Rust) `#[serde(default)] diagram_type: Option<String>`, `ai_request`가 공유 조립 호출(`_` 암, mod.rs:147)에 전달; camelCase 역직렬화·None 기본값 회귀 가드 | RED→GREEN | REQ-009, REQ-010 | AC-005, AC-006 | - | src/lib/tauri/ipc.ts, src-tauri/src/ai/mod.rs | pending |
| T-004 | 다이어그램 플라이아웃 서브메뉴(명령형 DOM) — diagram 항목 클릭을 서브메뉴 열기로 변경(자동 우선 8항목), hover/토글/Esc 복귀/외부 mousedown/키보드; `fire`/`buildSelectionRequest`에 `diagramType` 전달(자동=미포함) | RED→GREEN→REFACTOR | REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-011, REQ-012, REQ-013, REQ-015 | AC-001, AC-002, AC-003, AC-005, AC-007, AC-008, AC-009 | T-002, T-003 | src/components/editor/extensions/ai-selection-toolbar.ts, src/test/aiSelectionToolbar.test.ts | pending |
| T-005 | Rust 종류 게이팅 + 조각 — `build_inline_prompt`(또는 diagram 전용 래퍼)에 `matches!(Diagram) && diagram_type.is_some()` 전용 부착, 7종 조각+첫 줄 키워드(`stateDiagram-v2` 포함); None/비-diagram 바이트 동일 | RED→GREEN→REFACTOR | REQ-010, REQ-018, REQ-025 | AC-004, AC-006, AC-014 | T-001, T-003 | src-tauri/src/ai/prompt.rs | pending |
| T-006 | CSS — 플라이아웃 서브메뉴 클래스(`.mdedit-ai-diagram-submenu*`), `--md-*`/`.mdedit-*` 토큰·`currentColor` 전용(raw hex 금지, 다크모드 자동) | GREEN | REQ-003 | AC-012 | T-004 | src/styles/mdedit-components.css | pending |
| T-007 | 회귀 가드 + 품질 게이트 — 신규 의존성 0(JS+Cargo) + 서브메뉴 8항목 + `markdownKeyBindings`/mermaid 핀/UI-008 수동삽입 무변경 + 재요청 종류 승계(`fireReRequest`)·종류 불일치 비-게이트(`decideDiagramOutcome` 무변경); `npm run typecheck`/`test`/`lint` + `cargo test`/`clippy` + 기존 Playwright | RED→GREEN + (게이트) | REQ-014, REQ-017, REQ-019, REQ-020, REQ-021, REQ-022, REQ-024 | AC-010, AC-013 | T-001~T-006 | src/test/aiSelectionToolbar.test.ts, package.json/Cargo.toml(리뷰) | pending |

## 실행 순서

```
T-001 (Pre-RED 스냅샷) ──┐
T-002 (아이콘 추출) ─────┐│
T-003 (IPC 필드) ───────┼┼→ T-004 (서브메뉴 DOM) ─┐
T-005 (Rust 게이팅) ────┘│                        ├→ T-007 (가드+게이트)
T-006 (CSS) ── T-004 이후 ┘                        ┘
```

우선순위: T-001(스냅샷 기준선, D1/D2/D3 토대) → T-002(아이콘)·T-003(IPC)·T-005(Rust 게이팅) > T-004(서브메뉴 DOM) > T-006(스타일) > T-007(가드·게이트). T-005(Rust)·T-004(프론트)는 IPC 계약(T-003) 합의 후 병행 가능.

## REQ → Task 커버리지 (001–025 전수)

001→T-004 · 002→T-002/T-004 · 003→T-004/T-006 · 004→T-004 · 005→T-004 · 006→T-004 · 007→T-004 · 008→T-004 · 009→T-003/T-004 · 010→T-003/T-005 · 011→T-004 · 012→T-004 · 013→T-004 · 014→T-007(재요청 승계; `fireReRequest` 무변경 부수효과) · 015→T-004 · 016→T-004(토글 OFF 시 `buildToolbarDecorations` 미노출; AC-011은 T-004 어서션) · 017→T-007(종류 불일치 비-게이트, `decideDiagramOutcome` 무변경) · 018→T-001/T-005 · 019→T-007 · 020→T-007 · 021→T-007 · 022→T-007 · 023→T-002 · 024→T-007 · 025→T-001/T-005. 미커버 REQ 없음.

## AC → Task 커버리지 (001–014 전수)

AC-001→T-004 · AC-002→T-004 · AC-003→T-002/T-004 · AC-004→T-001/T-005 · AC-005→T-003/T-004 · AC-006→T-003/T-005 · AC-007→T-004 · AC-008→T-004 · AC-009→T-004 · AC-010→T-007 · AC-011→T-004 · AC-012→T-006 · AC-013→T-007 · AC-014→T-001/T-002/T-005. 미커버 AC 없음.
