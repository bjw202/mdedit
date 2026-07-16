# SPEC-AI-002 구현 계획 — AI 작업 중 로딩 인디케이터

> WHAT/WHY는 spec.md, 관측 가능한 수용 기준은 acceptance.md. 본 문서는 파일별 구현 접근을 정리한다. 시간 추정 없이 우선순위·순서로만 기술한다.

## 개요

단일 마일스톤 **M0**. 소규모·잘 정의된 UI 피처로, 4개 파일에 시각 레이어를 추가하고 유닛/E2E 테스트로 회귀를 막는다. 개발 방법론은 TDD(RED-first, `quality.yaml`).

## 기술적 접근

### 원칙

- CSS 전용 애니메이션(keyframes). JS 애니메이션 루프·타이머·신규 의존성 없음.
- 모든 색·간격·모션 값은 `--md-*` 토큰. 글로우 그라데이션 색은 신규 시맨틱 토큰으로 라이트/다크 팔레트에 추가.
- 스켈레톤·플레이스홀더는 데코레이션/위젯 계층 전용 — 문서 텍스트 무오염(REQ-AI2-002).
- `prefers-reduced-motion: reduce` 미디어 쿼리로 애니메이션을 정적 대체(REQ-AI2-010).

## 마일스톤 M0 — 작업 단위(우선순위순)

### T1 (High) — CSS 인디케이터 토큰·keyframes

- 파일: `src/styles/mdedit-components.css`
- 신규 글로우 시맨틱 토큰(`--md-ai-glow-from`/`--md-ai-glow-to` 등)을 라이트/다크 팔레트 양쪽에 정의(accent 계열 재사용 가능, hex 리터럴 금지).
- `@keyframes`: 글로우 테두리 흐름(gradient 위치 이동), shimmer(배경 위치 이동), pulse(투명도 breathing).
- `.mdedit-ai-card-streaming` 글로우 테두리, `.mdedit-ai-skeleton-line` shimmer, `.mdedit-ai-ghost-placeholder` pulse 셀렉터.
- `@media (prefers-reduced-motion: reduce)`: 위 애니메이션 `animation: none` + 정적 은은한 테두리/텍스트로 대체.
- 대응 REQ: 001, 003, 004, 006, 010.

### T2 (High) — 제안 카드 스켈레톤 + 글로우

- 파일: `src/components/editor/extensions/ai-suggestion-card.ts`
- `renderSuggestionCard` streaming 분기(약 276행): `input.streamBuffer`가 비면 본문에 3줄 `.mdedit-ai-skeleton-line` 렌더, 비어있지 않으면 기존 `.mdedit-ai-stream` 텍스트 렌더. `✕ 취소` 버튼은 두 경우 모두 유지(REQ-AI2-009).
- 카드 컨테이너의 `mdedit-ai-card-streaming` 클래스는 이미 `mdedit-ai-card-${phase}`로 부여됨 — 글로우는 CSS만으로 걸린다.
- `SuggestionCardWidget.eq()` 키(약 532행)에 "버퍼 빈/찬" 상태를 반영해 스켈레톤→텍스트 전환 시 1회 DOM 재생성, 이후 청크에서는 재생성하지 않아 글로우가 유지되도록 한다. 버퍼 길이 자체를 key에 넣지 않는다(REQ-AI2-013). `buildCardDecorations`의 `key`(약 560행) 생성부와 정합.
- 대응 REQ: 003, 004, 005, 013.
- @MX:ANCHOR — eq() 연속성 계약.

### T3 (High) — 고스트 대기 플레이스홀더

- 파일: `src/components/editor/extensions/ai-ghost-text.ts`
- `ghostDecorations`(114행): 현재 `!value || !value.text` → `Decoration.none`. 이를 `value && value.text === ''` → 상수 `eq()`의 `GhostPlaceholderWidget`("✨ 작성 중…", `.mdedit-ai-ghost-placeholder`) 반환으로 변경. `!value`는 여전히 `Decoration.none`.
- 첫 청크 도착 시 `value.text` 비어있지 않음 → 기존 `GhostWidget`(text 비교 eq) 경로로 자연 전환(REQ-AI2-007).
- `confirmGhostCommand`(152행)는 이미 `if (!ghost || !ghost.text) return false` — 대기 중 Mod+Enter 무삽입 보장(REQ-AI2-011). 변경 없이 테스트로 고정.
- 대응 REQ: 002, 006, 007, 011.

### T4 (Medium) — 스파클 툴바 펄스 (선택)

- 파일: `src/components/editor/extensions/ai-selection-toolbar.ts`
- in-flight(`aiStore.requestState === 'streaming'`) 동안 `.mdedit-ai-sparkle-btn`에 펄스 클래스 토글. 우선순위 낮음, 시간 제약 시 후순위.
- 대응 REQ: 008.

### T5 (High) — 유닛 테스트 (RED-first)

- `src/test/aiSuggestionCardRender.test.ts`: streaming + 빈 버퍼 → `.mdedit-ai-skeleton-line` 3개 존재; 버퍼 채움 → 스켈레톤 없고 `.mdedit-ai-stream` 텍스트 존재; eq() — 같은 phase·버퍼상태면 동일 키(재생성 없음), 빈→찬 전환 시 키 변경.
- `src/test/aiGhostConfirm.test.ts`: 고스트 `text===''` → 플레이스홀더 데코레이션 존재; Mod+Enter/`confirmGhostCommand` → 문서 길이 무변경; `text` 채움 → `GhostWidget` 렌더.
- 기존 jsdom EditorView 마운트/DOM 렌더 패턴 재사용.

### T6 (Medium) — E2E 확장

- `e2e/ai-inline-edit.spec.ts` + `e2e/fixtures/tauri-v2-ai-mock.ts`의 `hang` 시나리오(스트림 미도착)로: 인라인 편집 트리거 → 스켈레톤·글로우 가시성 단언; 섹션 채우기 트리거 → 플레이스홀더 가시성 단언; 대기 중 취소 동작 단언.

## 파일 의존성·순서

1. T1(CSS 토큰·keyframes) 먼저 — T2/T3 셀렉터가 참조.
2. T2·T3는 독립(서로 다른 파일) — 병렬 가능.
3. T5는 T2/T3에 선행(RED) 또는 병행(TDD 사이클).
4. T4·T6는 마지막.

## 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| **CM6 위젯 갱신 시 애니메이션 재시작** | 청크마다 `toDOM` 재호출되면 글로우/펄스가 매번 처음부터 → 깜빡임 | `SuggestionCardWidget.eq()` 키에 버퍼 길이가 아닌 "빈/찬" 불리언만 반영 → 스트리밍 중 DOM 안정, 스켈레톤→텍스트 1회만 전환. 플레이스홀더 위젯은 상수 eq()로 대기 중 재생성 없음. 유닛 테스트로 고정(T5) |
| 스켈레톤/텍스트 이중 렌더 경로가 기존 스트림 텍스트 표시를 깨뜨림 | 스트리밍 텍스트 미표시 회귀 | 빈 버퍼일 때만 스켈레톤, 그 외 기존 경로 그대로. 유닛 테스트로 양 분기 커버 |
| `prefers-reduced-motion` 누락 | 접근성 위반, 모션 민감 사용자 불편 | T1에서 미디어 쿼리 필수 작성 + E2E/유닛에서 정적 대체 확인 |
| 플레이스홀더가 확정되어 문서 오염 | 무손상 원칙 위반 | `confirmGhostCommand`가 이미 빈 텍스트 거부 — 변경 없이 테스트로 회귀 방지(AC-AI2-005) |
| 글로우 색 hex 하드코딩 유혹 | 다크/라이트 미대응, 프로젝트 컨벤션 위반 | 신규 `--md-*` 토큰만 사용, CSS grep으로 hex 0 확인 |

## Definition of Done

- REQ-AI2-001~013이 코드·테스트로 충족(선택 008 제외 시 명시).
- acceptance.md의 AC-AI2-001~010 검증 통과.
- Quality Gates: `tsc --noEmit` 0, vitest 전체 그린(기존 860 + 신규), cargo 213 무변경, Playwright AI 여정 무변경 통과.
- `mdedit-components.css` AI 인디케이터 셀렉터에 hex 리터럴 0, 신규 의존성 0.
</content>
