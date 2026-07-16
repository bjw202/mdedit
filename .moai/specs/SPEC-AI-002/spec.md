---
id: SPEC-AI-002
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: null
dependencies:
  - SPEC-AI-001
tags:
  - ai
  - editor
  - codemirror
  - ux
  - loading
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 SPEC 작성 — SPEC-AI-001(c1d4881, 구현 완료) 후속 UX 결함 수정. AI 첫 청크까지 2~7초 동안 시각 피드백이 전혀 없어 사용자가 앱이 멈춘 것으로 오인. "글로잉 그라데이션 테두리 + shimmer 스켈레톤"(Apple Intelligence/Gemini 트렌드) 방향 확정(사용자 인터뷰). M0 단일 마일스톤. 하드 제약: CSS 전용 애니메이션·신규 의존성 0·`--md-*` 토큰만·`prefers-reduced-motion` 대응·플레이스홀더 문서 오염 금지·플레이스홀더 확정 불가. 진행률/예상 시간/사운드는 비범위. |

## Summary

SPEC-AI-001로 추가된 AI 인라인 편집·섹션 채우기는 로컬 `claude` CLI를 백엔드로 쓴다. 실기기에서 첫 스트림 청크까지 지연이 2~7초인데, 그 구간에 **시각 피드백이 전혀 없어** 사용자가 앱이 멈춘 것으로 오인한다. 본 SPEC은 대기~스트리밍 구간에 "글로잉 그라데이션 테두리 + shimmer 스켈레톤"(Apple Intelligence / Gemini 트렌드) 시각 피드백을 추가한다.

- **제안 카드(인라인 편집)**: 스트리밍 단계 내내 `.mdedit-ai-card-streaming`에 흐르는 보라→파랑 그라데이션 글로잉 테두리를 애니메이션한다. `streamBuffer`가 비어 있는 동안에는 본문에 3줄 shimmer 스켈레톤을 표시하고, 첫 청크가 도착하면 스켈레톤을 스트리밍 텍스트로 교체한다(테두리 글로우는 done/error까지 지속).
- **섹션 채우기(고스트)**: 고스트 텍스트가 비어 있는 동안(첫 청크 대기) 앵커 위치에 "✨ 작성 중…" 펄스 플레이스홀더 위젯을 렌더하고, 청크가 도착하면 실제 고스트 텍스트로 교체한다.
- **(선택, 낮은 우선순위)**: 요청이 in-flight인 동안 ✨ 스파클 툴바 버튼이 펄스한다.

모든 애니메이션은 CSS 전용이며 신규 의존성이 없고, 색상을 포함한 모든 값은 기존 `--md-*` 테마 토큰으로 정의해 다크/라이트에 자동 대응하고 `prefers-reduced-motion: reduce`에서 비활성화된다. 대기 시각물은 문서 텍스트를 절대 오염시키지 않으며 확정 대상이 아니다.

## Background & Rationale

SPEC-AI-001은 `claude -p` 프로세스를 스폰해 stdout 델타를 `ai://chunk` 이벤트로 릴레이한다(부록 A: 첫 텍스트 ~2.3초, 실기기·저사양 Windows·실시간 백신 환경에서는 더 길어 2~7초). 현재 대기 구간이 시각적으로 비어 있는 두 지점이 결함이다.

1. **제안 카드 스트리밍 단계** (`src/components/editor/extensions/ai-suggestion-card.ts` `renderSuggestionCard` streaming 분기, 약 276행): `body.textContent = streamBuffer` + `✕ 취소` 버튼만 렌더한다. `streamBuffer`가 비면 카드가 시각적으로 비어 보인다.
2. **섹션 채우기 고스트** (`src/components/editor/extensions/ai-ghost-text.ts` `ghostDecorations`, 114행): `value.text`가 비면 `Decoration.none`을 반환 → Cmd+Enter 트리거와 첫 청크 사이에 화면에 아무것도 없다.

기존 코드 근거:
- `confirmGhostCommand`(ai-ghost-text.ts:152–162)는 `if (!ghost || !ghost.text) return false;` — 고스트 텍스트가 비면 확정을 거부한다. 대기 중 플레이스홀더는 `text === ''` 동안만 보이므로 Mod+Enter가 플레이스홀더를 문서에 삽입하지 못한다(REQ-AI2-011의 근거이자 이미 만족되는 불변식).
- `SuggestionCardWidget.eq()`(ai-suggestion-card.ts:532)는 `key = ${requestId}:${phase}`로 비교한다 — 스트리밍 단계 내내 key가 안정적이어서 글로우 애니메이션이 유지된다(청크마다 재시작되지 않음). 단 스켈레톤→텍스트 전환에는 "버퍼 빈/찬" 구분이 key에 반영되어야 한다(리스크 참조).
- `GhostWidget.eq()`(ai-ghost-text.ts:128)는 `text` 비교로 청크마다 위젯을 재생성한다. 플레이스홀더는 상수 eq()의 별도 위젯으로 두어 대기 중 펄스가 재시작되지 않게 한다.
- CSS 토큰(`mdedit-components.css`): `--md-accent`, `--md-accent-soft`, `--md-surface-raised`, `--md-border`, `--md-dur-fast`, `--md-ease` 등 시맨틱 롤만 사용(SPEC-AI-001 T-019: 38개 AI 셀렉터, hex 리터럴 0). 글로우 그라데이션 색도 토큰화한다.

## 핵심 설계 결정 (사용자 승인, 재검토 금지)

1. **시각 언어 = 글로잉 그라데이션 테두리 + shimmer 스켈레톤.** Apple Intelligence / Gemini 트렌드. 스피너·프로그레스 바·퍼센트 표기는 도입하지 않는다.
2. **CSS 전용 애니메이션, 신규 의존성 0.** keyframes(glow/shimmer/pulse) + `prefers-reduced-motion` 미디어 쿼리만 사용한다.
3. **모든 색상 토큰화.** 글로우 그라데이션 색을 포함해 `--md-*` 토큰만 사용한다(hex 리터럴 금지, 다크/라이트 자동).
4. **접근성 필수.** `prefers-reduced-motion: reduce`에서 애니메이션을 끄고 정적 은은한 테두리 + 정적 플레이스홀더 텍스트로 대체한다.
5. **뷰 레이어 전용.** 스켈레톤·플레이스홀더는 데코레이션/위젯 계층에만 존재하고 문서 텍스트를 절대 변경하지 않으며 확정 대상이 아니다.
6. **기존 동작 불변.** 대기 중 취소(✕/Esc) 동작, done/error 전환, 검토 카드 공존 등 SPEC-AI-001 동작을 그대로 유지한다.

## Environment & Assumptions

- **프론트엔드**: React 18, TypeScript strict, CodeMirror 6(`@codemirror/view ^6.39`), zustand ^5. 신규 런타임 의존성 없음.
- **대상 파일**: `ai-suggestion-card.ts`, `ai-ghost-text.ts`, `ai-selection-toolbar.ts`(선택), `mdedit-components.css`.
- **테스트**: vitest(jsdom) — `src/test/aiSuggestionCardRender.test.ts`·`aiGhostConfirm.test.ts`의 EditorView 마운트/DOM 렌더 패턴 재사용. Playwright(webkit) `e2e/ai-inline-edit.spec.ts` 확장 — `e2e/fixtures/tauri-v2-ai-mock.ts`의 `hang` 시나리오(스트림이 오지 않음)가 스켈레톤/플레이스홀더 가시성 단언에 최적이다.
- **회귀 기준**: 기존 vitest 860 / cargo 213 / `tsc --noEmit` 0 / Playwright AI 여정 전부 그린 유지. `npm run lint`는 eslint config 부재로 게이트 제외(알려진 제약).

## Requirements (EARS)

### Ubiquitous

- **REQ-AI2-001**: The system **shall** 모든 AI in-flight 시각 인디케이터를 CSS 전용 애니메이션과 기존 `--md-*` 테마 토큰만으로 구현하고, 신규 런타임 의존성이나 hex 색 리터럴을 도입하지 않는다.
- **REQ-AI2-002**: The system **shall** 대기·스트리밍 시각물(스켈레톤·플레이스홀더·글로우)을 데코레이션/위젯 계층에만 렌더하여 문서 텍스트를 변경하지 않는다.

### Event-Driven

- **REQ-AI2-003**: **WHEN** 인라인 편집 제안 카드가 스트리밍 단계에 진입하면, **the system shall** 카드(`.mdedit-ai-card-streaming`)에 흐르는 보라→파랑 그라데이션 글로잉 테두리를 스트리밍 단계 내내 애니메이션한다.
- **REQ-AI2-004**: **WHEN** 제안 카드가 스트리밍 단계이고 `streamBuffer`가 비어 있으면, **the system shall** 카드 본문에 3줄 shimmer 스켈레톤 플레이스홀더를 렌더한다.
- **REQ-AI2-005**: **WHEN** 첫 스트림 청크가 도착하면, **the system shall** 스켈레톤을 스트리밍 텍스트로 교체하고 테두리 글로우는 done/error 전환까지 지속한다.
- **REQ-AI2-006**: **WHEN** 섹션 채우기 고스트가 활성이고 그 텍스트가 비어 있으면, **the system shall** 고스트 앵커 위치에 펄스하는 "✨ 작성 중…" 플레이스홀더 위젯을 렌더한다.
- **REQ-AI2-007**: **WHEN** 첫 고스트 청크가 도착하면, **the system shall** 플레이스홀더를 실제 회색 고스트 텍스트로 교체한다.
- **REQ-AI2-008**: **WHEN** AI 요청이 in-flight로 시작되면, **the system shall** (선택, 낮은 우선순위) ✨ 스파클 툴바 버튼을 요청이 끝날 때까지 펄스시킨다.

### State-Driven

- **REQ-AI2-009**: **WHILE** 대기·스트리밍 시각물이 표시되는 동안, **the system shall** 취소 수단(✕/Esc)을 항상 동작 가능한 상태로 유지한다(SPEC-AI-001 REQ-AI-005/007 불변).
- **REQ-AI2-010**: **WHILE** `prefers-reduced-motion: reduce`가 설정된 동안, **the system shall** 모든 인디케이터 애니메이션을 비활성화하고 정적 은은한 테두리 + 정적 플레이스홀더 텍스트로 대체한다.

### Unwanted Behaviour

- **REQ-AI2-011**: **IF** 고스트 플레이스홀더가 표시 중(고스트 `text === ''`)인 상태에서 `Mod+Enter`가 눌리면, **then the system shall** 플레이스홀더 문자열을 문서에 삽입하지 않는다(확정은 비어있지 않은 고스트 텍스트를 요구 — `confirmGhostCommand` 계약).
- **REQ-AI2-012**: **IF** 스트림이 done·error·cancel로 전환되면, **then the system shall** 스켈레톤·플레이스홀더·글로우를 제거하고 해당 종료 시각물(제안/오류/소멸)을 표시하되 SPEC-AI-001의 기존 전환 동작을 변경하지 않는다.
- **REQ-AI2-013**: **IF** 스트림 갱신으로 위젯이 재생성되면, **then the system shall** 위젯 `eq()` 구현으로 애니메이션 연속성을 보장하여 청크마다 글로우·펄스가 육안으로 재시작되지 않게 한다.

## Design Notes / Future Considerations

> 아래는 요구사항(AC 대상)이 아니며 Run phase 설계 참고 사항이다.

- **카드 위젯 eq() 키**: 스트리밍 단계에서 글로우를 유지하면서 스켈레톤→텍스트 전환만 DOM 재생성하려면 `eq()` 키에 "버퍼 빈/찬" 상태를 반영한다(예: `${requestId}:${phase}:${buffer ? 'filled' : 'skeleton'}`). 정확한 형태는 Run phase 재량이나, 청크마다 key가 바뀌어 글로우가 재시작되지 않도록 버퍼 길이 자체를 key에 넣지 않는다(리스크 REQ-AI2-013).
- **플레이스홀더 위젯**: `ghostDecorations`가 `value && value.text === ''`일 때 상수 `eq()`의 전용 `GhostPlaceholderWidget`를 반환한다. 첫 청크에서 `GhostWidget`(text 비교)로 교체된다. 상수 eq()라 대기 중 펄스가 재시작되지 않는다.
- **스켈레톤 마크업**: 3줄 `<div class="mdedit-ai-skeleton-line">` + shimmer keyframes. 폭은 토큰 기반 %로 변주.
- **글로우 토큰**: `--md-ai-glow-from`/`--md-ai-glow-to`(또는 기존 accent 계열 재사용) 신규 시맨틱 토큰을 라이트/다크 팔레트에 추가.

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src/components/editor/extensions/ai-suggestion-card.ts` | streaming 분기: `streamBuffer` 빈 경우 3줄 스켈레톤 렌더; `SuggestionCardWidget.eq()` 키에 버퍼 빈/찬 상태 반영(글로우 유지 + 스켈레톤→텍스트 1회 전환) |
| [MODIFY] | `src/components/editor/extensions/ai-ghost-text.ts` | `ghostDecorations`: `value` 존재 & `text === ''`일 때 "✨ 작성 중…" 펄스 플레이스홀더 위젯 반환(상수 eq()); 첫 청크에서 `GhostWidget`로 교체 |
| [MODIFY] | `src/components/editor/extensions/ai-selection-toolbar.ts` | (선택) in-flight 동안 ✨ 버튼 펄스 클래스 토글 |
| [MODIFY] | `src/styles/mdedit-components.css` | glow 테두리 keyframes + shimmer keyframes + pulse keyframes + `prefers-reduced-motion` 미디어 쿼리 + 신규 글로우 토큰(`--md-*`) |
| [MODIFY/NEW] | `src/test/aiSuggestionCardRender.test.ts` 등 | streaming 빈 버퍼 → 스켈레톤 렌더; 첫 청크 → 텍스트 교체; eq() 안정성 유닛 테스트 |
| [MODIFY/NEW] | `src/test/aiGhostConfirm.test.ts` 등 | 고스트 빈 텍스트 → 플레이스홀더 렌더; Mod+Enter 시 문서 무변경; 첫 청크 → 고스트 텍스트 |
| [MODIFY] | `e2e/ai-inline-edit.spec.ts` | `hang` 픽스처로 스켈레톤/플레이스홀더 가시성 + 취소 동작 단언 |

## Acceptance Criteria

> acceptance.md의 Given-When-Then과 대응. REQ-AI2-001 ~ 013 전 요구사항이 최소 1개의 AC에 매핑된다. 고아 AC 없음.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI2-001 | REQ-AI2-003, 004 | 스트리밍 진입 + 빈 버퍼 → 글로우 테두리 + 3줄 스켈레톤(hang 픽스처) |
| AC-AI2-002 | REQ-AI2-005 | 첫 청크 → 스켈레톤이 스트리밍 텍스트로 교체, 글로우 지속 |
| AC-AI2-003 | REQ-AI2-006 | 고스트 활성 + 빈 텍스트 → 앵커에 "✨ 작성 중…" 펄스 플레이스홀더(hang 픽스처) |
| AC-AI2-004 | REQ-AI2-007 | 첫 고스트 청크 → 플레이스홀더가 회색 고스트 텍스트로 교체 |
| AC-AI2-005 | REQ-AI2-011, 002 | 플레이스홀더 대기 중 Mod+Enter → 문서 무변경(플레이스홀더 미삽입) |
| AC-AI2-006 | REQ-AI2-010 | `prefers-reduced-motion: reduce` → 애니메이션 없음, 정적 테두리 + 정적 텍스트 |
| AC-AI2-007 | REQ-AI2-009, 012 | 대기 중 ✕/Esc 취소 동작; done/error/cancel 전환 시 대기 시각물 제거 |
| AC-AI2-008 | REQ-AI2-001, 002 | hex 리터럴 0 + 신규 의존성 0 + 문서 텍스트 무오염 |
| AC-AI2-009 | REQ-AI2-008 | (선택) in-flight 동안 ✨ 툴바 버튼 펄스 |
| AC-AI2-010 | REQ-AI2-013 | 위젯 eq()로 청크 갱신 시 글로우·펄스 육안 재시작 없음 |

**Quality Gates (AC 외 공통 게이트)**: `tsc --noEmit` 클린 + 전체 vitest 통과(기존 860 + 신규) + cargo 213 무변경 + 기존 Playwright(webkit) AI 여정 무변경 통과. `npm run lint`는 게이트 제외(알려진 제약). 상세는 acceptance.md "Quality Gate Criteria" 참조.

## mx_plan

code_comments = ko (`language.yaml`). `@MX:SPEC: SPEC-AI-002` 공통 부착.

| 위치 | 태그 | 사유 |
|------|------|------|
| `ai-suggestion-card.ts` `SuggestionCardWidget.eq()` | `@MX:ANCHOR` | 글로우 애니메이션 연속성 계약 — 청크마다 재생성되면 애니메이션 재시작(REQ-AI2-013), 버퍼 빈/찬 전환만 재생성 |
| `ai-ghost-text.ts` `ghostDecorations` / 플레이스홀더 위젯 | `@MX:NOTE` | 빈 텍스트 → 플레이스홀더, 첫 청크 → 고스트 텍스트 전환 규칙; 확정 불가 불변식(REQ-AI2-011) |
| `mdedit-components.css` glow/shimmer/pulse keyframes | `@MX:NOTE` | 애니메이션 토큰·`prefers-reduced-motion` 대체 규칙(REQ-AI2-010) 의도 기록 |

## Exclusions (What NOT to Build)

- **진행률(%) 표시** — 스트림 총량을 알 수 없고(스트리밍 CLI) 트렌드 시각 언어와 상충. 도입하지 않는다.
- **예상 남은 시간 표기** — 지연이 환경 편차가 커 신뢰 불가, 사용자 오인 유발. 제외.
- **사운드/햅틱 피드백** — 데스크톱 편집기 UX 범위 밖.
- **스피너·회전 아이콘·프로그레스 바** — 확정된 시각 언어(글로우+shimmer)와 충돌하므로 도입하지 않는다.
- **SPEC-AI-001 동작 변경** — 취소·done/error 전환·검토 카드 공존·무손상 원칙 등 기존 계약은 변경하지 않는다(시각 레이어만 추가).
- **신규 런타임 의존성** — 애니메이션 라이브러리(framer-motion 등) 도입 없음, CSS 전용.
- **새 테마/시각 언어** — 채팅앱풍 별도 시각 언어 도입 금지, 기존 `--md-*` 토큰 확장만.
</content>
</invoke>
