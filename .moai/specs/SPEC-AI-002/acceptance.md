# SPEC-AI-002 수용 기준 — AI 작업 중 로딩 인디케이터

> spec.md의 Acceptance Criteria 표와 1:1 대응. 모든 시나리오는 관측 가능(DOM 존재/부재, 문서 길이 불변, 애니메이션 상태)해야 한다. `hang` 픽스처(`e2e/fixtures/tauri-v2-ai-mock.ts`)는 스트림이 도착하지 않는 대기 상태를 재현하므로 대기 시각물 단언에 사용한다.

## AC-AI2-001 — 스트리밍 진입 시 글로우 테두리 + 스켈레톤 (REQ-AI2-003, 004)

- **Given** 사용자가 텍스트를 선택하고 인라인 편집 프리셋을 실행했고, 스트림이 아직 도착하지 않은 상태(`hang`, `streamBuffer === ''`)
- **When** 제안 카드가 스트리밍 단계로 렌더된다
- **Then** 카드 요소에 `mdedit-ai-card-streaming` 클래스가 붙고 글로잉 그라데이션 테두리 애니메이션이 활성이며, 카드 본문에 `.mdedit-ai-skeleton-line` 3개가 렌더되고 `.mdedit-ai-stream` 텍스트 노드는 비어 있다.

## AC-AI2-002 — 첫 청크 도착 시 스켈레톤→텍스트 교체 (REQ-AI2-005)

- **Given** AC-AI2-001의 스켈레톤 대기 상태
- **When** 첫 스트림 청크가 도착해 `streamBuffer`가 비어있지 않게 된다
- **Then** `.mdedit-ai-skeleton-line`이 사라지고 `.mdedit-ai-stream`에 스트리밍 텍스트가 표시되며, 카드의 글로우 테두리는 계속 활성이다(done/error까지).

## AC-AI2-003 — 고스트 대기 플레이스홀더 (REQ-AI2-006)

- **Given** 커서가 빈 헤딩 아래에 있어 섹션 채우기 자격이 있고, `Mod+Enter`로 요청을 트리거했으나 스트림이 아직 도착하지 않음(`hang`, 고스트 `text === ''`)
- **When** `ghostDecorations`가 계산된다
- **Then** 고스트 앵커 위치에 `.mdedit-ai-ghost-placeholder` 위젯("✨ 작성 중…")이 렌더되고 펄스 애니메이션이 활성이다(`Decoration.none` 아님).

## AC-AI2-004 — 고스트 첫 청크 교체 (REQ-AI2-007)

- **Given** AC-AI2-003의 플레이스홀더 대기 상태
- **When** 첫 고스트 청크가 도착해 고스트 `text`가 비어있지 않게 된다
- **Then** 플레이스홀더가 사라지고 `.cm-ai-ghost` 회색 고스트 텍스트가 표시된다.

## AC-AI2-005 — 플레이스홀더는 확정 불가 (REQ-AI2-011, 002)

- **Given** 고스트 플레이스홀더가 표시 중이고 고스트 `text === ''`
- **When** 사용자가 `Mod+Enter`(또는 `confirmGhostCommand` 호출)를 실행한다
- **Then** 문서 텍스트 길이가 변하지 않고("✨ 작성 중…" 미삽입), `confirmGhostCommand`가 `false`를 반환하며 고스트는 유지된다.

## AC-AI2-006 — prefers-reduced-motion 대응 (REQ-AI2-010)

- **Given** OS/브라우저가 `prefers-reduced-motion: reduce`로 설정됨
- **When** 스트리밍 카드/고스트 플레이스홀더가 표시된다
- **Then** 글로우·shimmer·pulse 애니메이션이 실행되지 않고(`animation: none`), 정적 은은한 테두리와 정적 플레이스홀더 텍스트로 대체된다.

## AC-AI2-007 — 대기 중 취소 + 종료 전환 (REQ-AI2-009, 012)

- **Given** 스켈레톤 또는 플레이스홀더 대기 상태
- **When** 사용자가 ✕ 취소 버튼 또는 Esc를 누르거나, 스트림이 done/error/cancel로 전환된다
- **Then** 취소는 정상 동작하고(in-flight 요청 취소), 대기 시각물(스켈레톤·플레이스홀더·글로우)이 제거되며 SPEC-AI-001의 기존 종료 시각물(제안 카드/오류 카드/고스트 소멸)이 변경 없이 표시된다.

## AC-AI2-008 — 토큰·의존성·무오염 (REQ-AI2-001, 002)

- **Given** 본 SPEC의 CSS·확장 변경 일체
- **When** 정적 검사한다
- **Then** `mdedit-components.css`의 AI 인디케이터 셀렉터에 hex 색 리터럴이 0이고(모두 `--md-*` 토큰), `package.json`에 신규 런타임 의존성이 추가되지 않았으며, 스켈레톤·플레이스홀더가 문서 텍스트(EditorState doc)를 변경하지 않는다.

## AC-AI2-009 — 스파클 툴바 펄스 (선택) (REQ-AI2-008)

- **Given** AI 요청이 in-flight(`streaming`)인 상태
- **When** ✨ 스파클 툴바 버튼이 렌더된다
- **Then** `.mdedit-ai-sparkle-btn`에 펄스 클래스가 적용되고 요청 종료 시 제거된다. (낮은 우선순위 — 미구현 시 명시)

## AC-AI2-010 — 위젯 eq() 애니메이션 연속성 (REQ-AI2-013)

- **Given** 스트리밍 카드가 표시되고 청크가 연속 도착한다
- **When** 버퍼가 채워진 이후 추가 청크로 데코레이션이 재계산된다
- **Then** `SuggestionCardWidget.eq()`가 동일 키를 반환해 DOM이 재생성되지 않고 글로우 애니메이션이 육안으로 재시작되지 않는다. 빈 버퍼→첫 청크 전환에서만 1회 DOM이 재생성된다. 고스트 플레이스홀더 위젯은 상수 eq()로 대기 중 펄스가 재시작되지 않는다.

## Quality Gate Criteria

- **타입**: `tsc --noEmit` 오류 0.
- **유닛**: 전체 vitest 통과 — 기존 860 + 신규(스켈레톤 렌더·플레이스홀더·eq() 안정성·확정 불가).
- **Rust**: `cargo test` 213 무변경 통과(본 SPEC은 프론트 전용, Rust 무변경).
- **E2E**: 기존 Playwright(webkit) AI 여정 무변경 통과 + `hang` 픽스처 기반 스켈레톤/플레이스홀더 가시성·취소 단언 추가.
- **린트**: `npm run lint`는 eslint config 부재로 게이트 제외(알려진 프로젝트 제약, 회귀 오판 금지).
- **정적 스캔**: AI 인디케이터 CSS에 hex 리터럴 0, 신규 npm/cargo 의존성 0.

## Definition of Done

- [ ] REQ-AI2-001~013 충족(선택 008 제외 시 명시).
- [ ] AC-AI2-001~010 검증 통과.
- [ ] `prefers-reduced-motion` 대체 확인.
- [ ] 플레이스홀더/스켈레톤 문서 무오염 + 확정 불가 확인.
- [ ] Quality Gates 전부 그린.
</content>
