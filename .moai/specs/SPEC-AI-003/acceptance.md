---
id: SPEC-AI-003
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 15
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 acceptance 작성 — 자유 위치 이어쓰기(M2). 핵심 시나리오 7건 + 엣지 케이스 + 품질 게이트 + DoD. |

# Acceptance Criteria — SPEC-AI-003 (M2 자유 위치 이어쓰기)

검증 방식:
- **vitest(jsdom)**: 자격 매트릭스(`markdown()` 확장 포함 headless `EditorState`), 힌트 fake timer, 고스트 파괴+취소, mock `aiRequest` 페이로드 계약. 선례: `aiContinueContext.test.ts`, `aiHint.test.ts`, `aiGhostConfirm.test.ts`.
- **Rust `#[cfg(test)]`**: `build_continue_prompt` 조립·절단·지시 포함(순수 함수), `AiRequestArgs` contextAfter 역직렬화.
- **Playwright(webkit)**: `tauri-v2-ai-mock.ts`(`success`/`hang`) 여정 + `__AI_MOCK__.requests` 계약 단언 + 콘솔 에러 0. Tauri IPC 실물 스폰은 실행되지 않음(기존 제약).
- **수동 검증**: 뒤 문맥 반복·선점 금지의 실제 출력 품질(프롬프트 지시로만 제어되는 영역), Windows Ctrl+Enter.

## 핵심 시나리오

### AC-AI3-001: 문서 중간 트리거 → 고스트 → 확정 → 뒤 문맥 보존 (REQ-AI3-001, 002, 008, 012)

- **Given** 문서 중간의 일반 문단에서 끊긴 문장 뒤에 커서가 있고 커서 뒤에 후속 문단이 존재할 때
- **When** 사용자가 `Mod+Enter`를 누르면
- **Then** 이 시점에 처음으로 AI 요청이 발생하고, 커서 위치에 회색 고스트 텍스트가 스트리밍되며 [✓ 넣기]·[✕ 지우기]·[■ 중지]가 항상 표시된다.
- **When** 사용자가 [✓ 넣기] 또는 `Mod+Enter`를 재입력하면
- **Then** 고스트가 단일 트랜잭션으로 커서 위치에 삽입되고(Mod+Z 1회 복원), **커서 뒤 문맥은 삽입 전과 바이트 단위로 동일하게 보존**된다(삽입 전용, 교체·삭제 없음).

### AC-AI3-002: 코드펜스 내부 = 완전 배제 + 토큰 0 (REQ-AI3-003, 007) [edge]

- **Given** 커서가 마크다운 코드펜스(```) 내부에 있을 때
- **When** 3초 이상 커서가 멈추고 이어서 사용자가 `Mod+Enter`를 누르면
- **Then** 힌트 알약이 표시되지 않고, 자유 위치 이어쓰기 커맨드는 false를 반환해 다음 키 바인딩으로 폴스루하며, **`aiRequest`가 한 번도 호출되지 않는다**(토큰 0 — mock 호출 카운트 0 단언).
- **And** 표(Table) 내부에서도 동일하다.

### AC-AI3-003: 스트리밍 중 타이핑 → 고스트 소멸 + in-flight 취소 (REQ-AI3-013, 014) [D1]

- **Given** 자유 위치 이어쓰기 고스트가 스트리밍 중일 때
- **When** 사용자가 문서에 타이핑하면(고스트 effect 없는 docChanged 트랜잭션)
- **Then** 고스트가 즉시 소멸하고(mapPos 위치 매핑 시도 없음), **진행 중이던 요청이 `ai_cancel`로 취소**되며, 별도 토스트·배너는 표시되지 않는다(사용자 자발 종료 — D1).
- **And** 반대로 [✓ 넣기] 확정 트랜잭션(clearGhostEffect 동승)에서는 취소가 호출되지 않는다(오취소 금지).

### AC-AI3-004: contextAfter 페이로드 + [뒤 문맥] 프롬프트 계약 (REQ-AI3-008, 009)

- **Given** 커서 앞뒤에 본문이 있는 문서 중간 위치에서
- **When** 이어쓰기 요청이 발생하면
- **Then** mock 요청 페이로드(`__AI_MOCK__.requests` / vitest mock)에 `feature:'section-fill'`, `presetKind:'continue'`, `outline`, `contextBefore`(커서 앞 원문 전체), **`contextAfter`(커서 뒤 원문 전체)** 가 `{ args }` 래핑으로 전달된다.
- **And** (Rust 유닛) `build_continue_prompt`가 [문서 개요]+[앞 문맥]+[뒤 문맥] 3섹션을 조립하고, [뒤 문맥]은 `truncate_head_at_paragraph`로 앞쪽 유지 절단되며, 시스템 지시에 "끊긴 문장부터 완성·뒤 문맥으로 매끄럽게 연결·뒤 문맥 반복/선점 금지" 문구가 포함된다.

### AC-AI3-005: 2단 힌트 자격 매트릭스 (REQ-AI3-005, 006)

- **Given** 커서가 비어있지 않은 줄의 줄 끝, 문장 종결 부호 없이 3초 이상 멈춘 상태일 때
- **When** 유휴 타이머가 만료되면
- **Then** "이어쓰기" 힌트 버튼이 단축키 표기와 함께 표시된다(토큰 0 로컬 판정).
- **When** 커서가 줄 중간이거나, 종결 부호(닫힌 집합: `.` `!` `?` `。` `…` — REQ-AI3-005 정의, 후행 공백·닫는 따옴표/괄호 무시)로 끝난 문장 뒤이거나, 빈 줄이면
- **Then** 힌트는 표시되지 않지만 `Mod+Enter` 수동 트리거는 (배제 노드 밖이라면) 여전히 동작한다 — 힌트 자격과 트리거 자격의 독립 판정.

### AC-AI3-006: 리스트/인용 내부 — 트리거 O, 힌트 X (REQ-AI3-004) [D2]

- **Given** 커서가 리스트 항목(ListItem) 또는 인용(Blockquote) 내부의 끊긴 문장 뒤에 있을 때
- **When** 3초 이상 멈추면 힌트가 표시되지 않고,
- **When** 사용자가 `Mod+Enter`를 누르면
- **Then** 이어쓰기 요청이 정상 발생하고 고스트가 스트리밍된다.

### AC-AI3-007: 문서 끝 하위호환 (REQ-AI3-010, 011, 015) [regression]

- **Given** 기존 문서 끝 이어쓰기 상황(커서 뒤 공백뿐)일 때
- **When** 이어쓰기가 트리거되면
- **Then** `contextAfter`가 없거나 빈 값이고, (Rust 유닛) 조립된 프롬프트에 [뒤 문맥] 섹션과 뒤 문맥 지시가 포함되지 않아 기존 문서 끝 프롬프트와 동일하다.
- **And** 기존 `getContinueContext` 및 `aiContinueContext.test.ts`의 전 단언(문서 중간 빈 줄 → null 포함)이 **무개정으로 통과**한다(D3 병행 전략의 증명).
- **And** 컨텍스트 절단 시 `ai://done`의 `truncated` 플래그 전달이 유지된다(고스트 UI 고지는 범위 밖 — Exclusion).

## 엣지 케이스

- **빈 문서 / 1글자 문서**: 자격 판정이 예외 없이 처리(문서 끝 경로 우선순위 소비 또는 자격 부정), 크래시·NaN 없음.
- **빈 헤딩 바로 아래**: section-fill 자격이 우선 소비 — 자유 위치 이어쓰기가 선점하지 않는다(REQ-AI3-002 우선순위).
- **코드펜스 경계 직전/직후 커서**: 펜스 밖 판정이면 자격 허용, 안이면 배제 — `resolveInner` 경계 케이스를 매트릭스에 포함.
- **스트리밍 중 검토 대기 제안 카드 존재**: 새 이어쓰기 요청은 in-flight만 취소하고 카드는 유지(REQ-AI-008 회귀 확인).
- **`hang` 시나리오**: 첫 청크 전 타이핑 → 플레이스홀더 고스트 소멸 + 취소(AC-AI3-003과 동일 계약, 빈 텍스트 확정 거부 불변식 유지).
- **Tab**: 고스트 활성 중 Tab은 들여쓰기 + 고스트 소멸(REQ-AI-031 승계, 확정 아님) — 이때도 D1 취소 동작.

## Quality Gate Criteria

- `tsc --noEmit` 클린
- `vitest run` 전량 통과 — **기준선 913개 이상**(신규 자유 위치 매트릭스·힌트·취소 테스트 포함, 기존 테스트 무개정)
- `cargo test` 전량 통과 — **기준선 221개 이상**(prompt 조립·역직렬화 신규 포함)
- `cargo clippy` 클린
- Playwright(webkit) 통과 + 신규 여정에서 콘솔 에러 0
- `npm run lint`는 **게이트 아님** — eslint config 부재로 main 포함 상시 실패(알려진 프로젝트 제약, 회귀 오판 금지)

## Definition of Done

- [ ] REQ-AI3-001~015 전부가 AC-AI3-001~007 중 최소 1개에 매핑되어 검증됨
- [ ] 결정 D1~D4가 구현·테스트에 반영됨(D4는 Exclusion 유지 확인)
- [ ] 기존 문서 끝 이어쓰기·빈 섹션 채우기 동작 무변경(기존 테스트 무개정 통과)
- [ ] 신규 런타임 의존성 0 확인(package.json/Cargo.toml diff 없음)
- [ ] MX 태그 부착(plan.md MX Tag Plan): @MX:ANCHOR 3곳 + @MX:NOTE 2곳
- [ ] 뒤 문맥 반복·선점 금지 수동 검증(실 CLI, 대표 문서 3종) 기록
