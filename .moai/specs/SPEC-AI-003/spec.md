---
id: SPEC-AI-003
version: "0.1.1"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 15
dependencies:
  - SPEC-AI-001
  - SPEC-AI-002
tags:
  - ai
  - editor
  - codemirror
  - ghost-text
  - prompt
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.1 | 2026-07-17 | jw | plan-audit 리뷰(SPEC-AI-003-review-1, FAIL 0.78) 반영. **D1** frontmatter에 프로젝트 스키마 필드 추가(`tags`, `dependencies: [SPEC-AI-001, SPEC-AI-002]`, `lifecycle: spec-anchored` — SPEC-AI-001/002 관례). **D2** `issue_number: 0` → `null`(전 문서 세트 동일 적용). **D3** 규범 REQ 본문에서 구현 메커니즘(`sliceDoc`/`resolveInner`/truncate 헬퍼명)을 제거하고 대괄호 추적 주석·설계 결정 섹션으로 이동(REQ-AI3-001/003/009/014 행동 서술화). **D4** "종결 부호" 문자 집합을 닫힌 목록으로 확정(REQ-AI3-005). **D5** REQ-AI3-014를 WHILE+사건 복합형에서 정규 WHEN 형태(Event-Driven)로 재구성. 요구사항 내용·AC 매핑·Exclusions 무변경. |
| 0.1.0 | 2026-07-17 | jw | 최초 SPEC 작성 — M2 자유 위치 이어쓰기(시나리오 E). 설계서 `.moai/design/ai-features-mvp-design.md` §5.1의 "문서 끝" 판정을 임의 커서 위치로 일반화. research.md 기반 델타 4개 확정: (1) 자격 판정 자유 위치 확장 + syntaxTree 게이트, (2) `build_continue_prompt`에 [뒤 문맥](truncate_head) + 반복·선점 금지 지시, (3) 2단 힌트 자격(보수적 힌트 / 넓은 수동 트리거), (4) 타이핑 소멸 시 in-flight 취소(D1). 사전 합의 제약 5건 반영: 하위호환 IPC 경로(`feature:'section-fill'`+`presetKind:'continue'`+`contextAfter`), 파괴형 고스트 앵커 유지(mapPos 금지), 커서급 자동 트리거 금지(REQ-AI-032 승계), `syntaxTree.resolveInner` 신규 의존성 0, FencedCode/Table 내부 배제. 결정 D1~D4 확정(plan.md Decision Log). |

## Summary

`mdedit`의 "이어쓰기"를 문서 끝 전용에서 **문서 임의 커서 위치**로 확장한다(M2, 설계서 시나리오 E 일반화). 사용자가 문서 중간에서 `Mod+Enter`(또는 힌트 버튼)로 이어쓰기를 트리거하면, AI는 **[문서 개요(outline)] + [앞 문맥](truncate_tail) + [뒤 문맥](truncate_head)** 을 받아 끊긴 문장부터 완성하고 뒤 문맥에 매끄럽게 연결되는 텍스트를 회색 고스트로 스트리밍한다. AI는 뒤 문맥을 반복하거나 선점해서는 안 된다.

SPEC-AI-001/002의 스트리밍·고스트 텍스트·확정([✓ 넣기]/Mod+Enter)·소멸([✕ 지우기]/Esc/타이핑)·플레이스홀더 인프라는 **전부 재사용**하며, 본 SPEC의 델타는 자격 판정 계층(프론트 순수 함수 + lezer 구문 게이트), 힌트 2단 정책, IPC `contextAfter` 전달, Rust 프롬프트 확장, 그리고 타이핑 소멸 시 in-flight 취소(기존 누수성 동작 폐쇄)로 한정된다.

## Background & Rationale

- 설계서 §10: M2 = 자유 위치 이어쓰기, "M0 스트리밍 재활용"이 승격 근거. §12 킬 크라이테리아의 "✨ 리텐션 급감 시 M2 조기 투입"이 본 SPEC의 존재 이유.
- 이어쓰기는 이미 **문서 끝 분기만** 부분 구현되어 있다(research.md §0): `getContinueContext`(`ai-ghost-text.ts:80-92`, 커서 뒤 내용 있으면 null), `startContinueWritingCommand`(ai-ghost-text.ts:323-346), `AiFeature::Continue`(prompt.rs:36), `build_continue_prompt`(prompt.rs:199-215, [뒤 문맥] 없음).
- `[뒤 문맥]` 조립의 레퍼런스 패턴은 `build_inline_prompt`(prompt.rs:149-176)의 [앞 문맥]/[대상]/[뒤 문맥] 구조와 `truncate_head_at_paragraph`(prompt.rs:119-129)가 이미 제공한다. `AiRequestArgs.contextAfter` 필드도 이미 존재한다(ipc.ts:195-205 ↔ mod.rs:74-94).
- 구문 인지 게이트는 `@codemirror/lang-markdown` + `@codemirror/language`가 이미 로드되어 있어(markdown-extensions.ts:90-93) `syntaxTree(state).resolveInner(pos)`로 **신규 의존성 0**으로 가능하다(research.md §3.2).

## 사전 합의 설계 결정 (재검토 금지)

1. **IPC 하위호환 경로 유지**: `feature:'section-fill'` + `presetKind:'continue'` + 신규 `contextAfter` 전달. 새 feature 문자열('continue' 등) 도입 금지 — `ghostStoreBridge`의 feature 필터 하드코딩(ai-ghost-text.ts:524)·aiStore 유니온·ipc.ts 동시 수정 리스크 회피(research.md §4.1).
2. **프롬프트**: `build_continue_prompt(outline, before)` → `after` 파라미터 추가(`truncate_head_at_paragraph` 절단). 시스템 지시에 "끊긴 문장부터 완성, 뒤 문맥으로 매끄럽게 연결, 뒤 문맥 반복·선점 금지" 추가.
3. **고스트 앵커**: 기존 파괴형 계약 유지(effect 없는 docChanged → 고스트 파괴, ai-ghost-text.ts:138). mapPos 매핑 도입 금지 — 삽입 전용이므로 불필요(research.md §3.3).
4. **힌트 스팸 억제 = 2단 자격**: 힌트 알약은 보수적 조건에서만, `Mod+Enter` 수동 트리거는 더 넓은 위치에서 허용. 커서급 자동 트리거 없음(REQ-AI-032 승계).
5. **구조 안전장치**: `syntaxTree(state).resolveInner(pos)`로 FencedCode/Table 내부를 자격에서 **배제**(보수적 옵션 (a)). ListItem/Blockquote 정책은 D2로 확정(수동 트리거 허용 + 힌트 제외).

## Environment & Assumptions

- SPEC-AI-001(M0+M1) 및 SPEC-AI-002(대기 시각 피드백)가 main에 머지 완료(b343d17). 스트리밍 릴레이·고스트 StateField·힌트 ViewPlugin·aiStore·useAiRelay 전부 가용.
- 테스트 기준선: vitest 913 / cargo 221 / Playwright(webkit) (SPEC-AI-001 handoff.md).
- `npm run lint`는 eslint config 부재로 main 포함 항상 실패 — 게이트에서 제외(회귀 오판 금지).
- 신규 런타임 의존성 없음: lezer 구문 트리 질의는 설치된 `@codemirror/language ^6.12.1` 재사용.
- vitest에서 syntaxTree 게이트를 검증하려면 테스트 `EditorState`에 `markdown()` 확장을 추가해야 한다(기존 aiGhostConfirm.test.ts의 최소 확장 구성에 추가).

## Requirements (EARS)

### 모듈 1 — 자유 위치 자격 판정 (프론트 순수 로직)

#### Ubiquitous

- **REQ-AI3-001**: The system **shall** 자유 위치 이어쓰기의 자격 판정과 컨텍스트 추출을 토큰을 소모하지 않는 프론트 순수 함수로 수행하고, 반환 컨텍스트에 커서 앞 원문 전체와 커서 뒤 원문 전체를 포함하며, 상한 절단은 Rust에 위임한다. [MODIFY: `ai-ghost-text.ts` 자격 계층 — 추출 메커니즘은 `sliceDoc(0, head)`/`sliceDoc(head)` 통째 전달 관례(ai-ghost-text.ts:305-313) 유지, Design 참조]
- **REQ-AI3-002**: The system **shall** 트리거 자격의 우선순위를 기존과 동일하게 유지한다: 빈 섹션 채우기(section-fill) > 문서 끝 이어쓰기 > 자유 위치 이어쓰기. 상위 자격이 성립하는 위치에서는 상위 경로가 소비한다. [MODIFY: `evaluateHintEligibility` ai-ghost-text.ts:377-381, `modEnterCommand` 체인 ai-ghost-text.ts:351-352]

#### Unwanted Behaviour

- **REQ-AI3-003**: **IF** 커서가 마크다운 구문 구조상 코드펜스 또는 표 내부에 있으면, **then the system shall** 자유 위치 이어쓰기 자격을 부정하여 힌트를 표시하지 않고, `Mod+Enter` 커맨드는 false를 반환해 다음 바인딩으로 폴스루하며, 어떤 AI 요청도 발생시키지 않는다(토큰 0). [NEW: 구문 게이트 순수 함수 — 판정 메커니즘은 `syntaxTree(state).resolveInner(pos)` 기반 FencedCode/CodeBlock/Table 노드 탐지(사전 합의 5, 신규 의존성 0), research.md §3.2 옵션 (a)]

#### State-Driven

- **REQ-AI3-004**: **WHILE** 커서가 리스트 항목(ListItem) 또는 인용(Blockquote) 내부에 있는 동안, **the system shall** `Mod+Enter` 수동 트리거는 허용하되 유휴 힌트는 표시하지 않는다(D2 확정 — 구조 파손 위험은 낮으나 스팸 위험은 높은 중간 지대). [NEW: 구문 게이트 정책]

### 모듈 2 — 힌트 2단 자격 정책

#### State-Driven

- **REQ-AI3-005**: **WHILE** 커서가 자유 위치 힌트의 보수적 조건 — 비어있지 않은 줄의 줄 끝에 있고, 해당 줄이 문장 종결 부호로 끝나지 않았으며, 배제 노드(REQ-AI3-003/004) 밖 — 을 모두 충족한 채 3초 이상 멈춘 동안, **the system shall** 토큰을 소모하지 않는 로컬 판정만으로 "이어쓰기" 힌트 버튼을 단축키 표기와 함께 표시한다. **문장 종결 부호는 다음 닫힌 집합으로 정의한다: `.`(U+002E), `!`(U+0021), `?`(U+003F), `。`(U+3002), `…`(U+2026)** — 줄 끝의 후행 공백과 닫는 따옴표/괄호(`"` `'` `)` `」` `』`)는 무시하고 그 직전 문자로 판정한다. [MODIFY: `AiHintPluginValue` ai-ghost-text.ts:431-500, `HINT_IDLE_DELAY_MS` 재사용 — 기존 코드 선례(ai-suggestion-card.ts:435)가 이 집합과 다르면 본 SPEC의 집합이 규범이며 Run phase에서 정합화]

#### Unwanted Behaviour

- **REQ-AI3-006**: **IF** 커서 위치가 힌트의 보수적 조건(REQ-AI3-005)을 충족하지 않으면(줄 중간, 빈 줄, 종결된 문장 뒤 등), **then the system shall** 힌트를 표시하지 않는다 — 단 `Mod+Enter` 수동 트리거 자격(모듈 1)은 이와 독립적으로 판정된다(2단 자격).
- **REQ-AI3-007**: **IF** 사용자의 명시적 힌트 클릭 또는 `Mod+Enter` 입력이 없으면, **then the system shall** 어떤 AI 요청도 발생시키지 않는다(커서 이동·타이핑·유휴만으로는 요청 없음 — REQ-AI-032 승계).

### 모듈 3 — 요청·프롬프트 ([뒤 문맥] 확장)

#### Event-Driven

- **REQ-AI3-008**: **WHEN** 사용자가 자격 있는 자유 위치에서 힌트 클릭 또는 `Mod+Enter`로 이어쓰기를 트리거하면, **the system shall** 이 시점에 처음으로 AI 요청을 발생시키되 기존 하위호환 IPC 계약(`feature:'section-fill'` + `presetKind:'continue'`)에 `contextAfter`(커서 뒤 원문)를 추가로 전달하고, 결과를 커서 위치의 회색 고스트 텍스트로 스트리밍하며 [✓ 넣기]·[✕ 지우기]·[■ 중지]를 항상 표시한다. [MODIFY: `startContinueWritingCommand` ai-ghost-text.ts:323-346 일반화 / `AiRequestArgs.contextAfter`는 기존 필드 ipc.ts:195-205]
- **REQ-AI3-009**: **WHEN** Rust가 `presetKind:'continue'` 요청에서 비어있지 않은 `contextAfter`를 수신하면, **the system shall** 프롬프트에 [문서 개요] + [앞 문맥](뒤쪽 유지 절단) + **[뒤 문맥]**(앞쪽 유지 절단, 전용 상한) 세 섹션을 조립하고, 시스템 지시에 "끊긴 문장부터 완성할 것, 뒤 문맥으로 매끄럽게 연결할 것, 뒤 문맥의 내용을 반복하거나 선점하지 말 것"을 포함한다. [MODIFY: `build_continue_prompt` prompt.rs:199-215 + mod.rs:125 분기 — 절단 메커니즘은 `truncate_tail_at_paragraph`(앞 문맥)/`truncate_head_at_paragraph`(뒤 문맥, 전용 상한 상수) 재사용, 레퍼런스 패턴 `build_inline_prompt` prompt.rs:149-176]

#### Unwanted Behaviour

- **REQ-AI3-010**: **IF** `contextAfter`가 없거나 빈 문자열이면(문서 끝 이어쓰기), **then the system shall** [뒤 문맥] 섹션과 뒤 문맥 관련 지시를 프롬프트에 포함하지 않고 기존 문서 끝 이어쓰기와 관찰 가능하게 동일한 프롬프트를 조립한다(하위호환, 빈 섹션 생략 관례 유지).

#### Optional

- **REQ-AI3-011**: **WHERE** 앞 문맥 또는 뒤 문맥이 상한으로 절단된 경우, **the system shall** 기존 계약대로 `ai://done`의 `truncated` 플래그를 프론트에 전달한다(고스트 UI 절단 고지 렌더는 본 SPEC 범위 밖 — Exclusions·D4 참조). [EXISTING: mod.rs:128, aiStore.ts:29 — 동작 유지 확인만]

### 모듈 4 — 고스트 수명주기 (기존 계약 상속 + D1)

#### Ubiquitous

- **REQ-AI3-012**: The system **shall** 자유 위치 이어쓰기 고스트에 SPEC-AI-001/002의 고스트 계약을 그대로 적용한다: 확정은 [✓ 넣기]/`Mod+Enter` 단일 트랜잭션(Mod+Z 1회 복원), Tab은 들여쓰기 유지(확정 아님), 빈 텍스트 동안 확정 거부 + "✨ 작성 중…" 플레이스홀더, 시작·done 각 1회 `scrollIntoView`. 확정 시 커서 뒤 문맥은 한 글자도 변경되지 않는다(삽입 전용). [EXISTING: ai-ghost-text.ts:117-303 — 재사용, 신규 코드 없음]

#### Event-Driven

- **REQ-AI3-013**: **WHEN** 고스트 활성 중 사용자가 타이핑하여 고스트가 소멸하면, **the system shall** 진행 중(in-flight)인 이어쓰기 요청도 함께 취소(`ai_cancel`)하고, 별도 토스트·배너를 표시하지 않는다(타이핑 소멸은 Esc와 동급의 사용자 자발 종료 — 무통보 금지 원칙 REQ-AI-034의 예외로 명시, D1 확정). [MODIFY: 고스트 파괴 경로에 취소 연동 — 기존에는 `dismissGhostCommand`(ai-ghost-text.ts:279-289)만 취소했음, research.md §3.3 누수성 동작 폐쇄]
- **REQ-AI3-014**: **WHEN** 고스트가 활성인 상태에서 고스트 effect가 실리지 않은 문서 변경 트랜잭션이 발생하면, **the system shall** 고스트를 즉시 소멸시키고 위치 매핑을 시도하지 않는다. [EXISTING: 기존 파괴형 앵커 계약(ai-ghost-text.ts:138) 유지 확인 — mapPos 도입 금지는 사전 합의 3]

### 모듈 5 — 하위호환·기존 동작 보존

#### Ubiquitous

- **REQ-AI3-015**: The system **shall** 기존 문서 끝 이어쓰기와 빈 섹션 채우기의 관찰 가능한 동작(힌트 라벨·트리거·프롬프트·고스트 흐름)을 변경 없이 유지한다. 자유 위치 자격은 기존 `getContinueContext`(문서 끝 판정)와 **별도 판정 함수의 병행**으로 구현하여 기존 판정 함수의 계약과 테스트 단언(aiContinueContext.test.ts:47-53 "문서 중간 빈 줄 → null")을 깨지 않는다(D3 확정). [MODIFY: `ai-ghost-text.ts` — 신규 판정 함수 병행, 기존 함수 무변경]

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src/components/editor/extensions/ai-ghost-text.ts` | 자유 위치 자격 판정 순수 함수 신설(병행, `getContinueContext`:80-92 무변경) + syntaxTree 게이트 + `evaluateHintEligibility`(377-381) 2단 자격 확장 + `startContinueWritingCommand`(323-346) 일반화(contextAfter 전달) + 타이핑 소멸 시 in-flight 취소(D1) |
| [MODIFY] | `src-tauri/src/ai/prompt.rs` | `build_continue_prompt`(199-215)에 `after` 파라미터 + [뒤 문맥] 섹션(`truncate_head_at_paragraph`:119-129, 전용 상한 상수) + 반복·선점 금지 지시. 빈 after 시 기존 조립과 동일 |
| [MODIFY] | `src-tauri/src/ai/mod.rs` | continue 분기(mod.rs:125)에서 `contextAfter` 전달, IPC 역직렬화 계약 테스트(mod.rs:336-350 패턴)에 contextAfter 케이스 추가 |
| [EXISTING] | `ghostStoreBridge`(ai-ghost-text.ts:514-558), `aiStore.ts`, `useAiRelay.ts`, `claude_cli.rs`, `stream.rs` | 무변경 — `feature:'section-fill'` 하위호환 경로 유지로 feature 필터(524행)·스트리밍 릴레이 전부 재사용 |
| [EXISTING] | SPEC-AI-002 시각물(플레이스홀더·글로우) | 고스트 경로 자동 상속(ai-ghost-text.ts:145-191), 무변경 |
| [NEW] | `src/test/aiFreeContinue.test.ts`(가칭) | 자유 위치 자격 매트릭스(`markdown()` 확장 포함 state) + contextAfter 페이로드 계약 + 타이핑 소멸 취소 |
| [MODIFY] | `src/test/aiHint.test.ts` | 2단 힌트 자격(보수 조건) 케이스 추가 — 기존 케이스 무개정 |
| [MODIFY] | `e2e/ai-*.spec.ts` + `e2e/fixtures/tauri-v2-ai-mock.ts` | 문서 중간 이어쓰기 여정(mock success/hang) + `__AI_MOCK__.requests` contextAfter 계약 단언 |

## Acceptance Criteria 매핑

> acceptance.md의 Given-When-Then과 대응. REQ-AI3-001~015 전 요구사항이 최소 1개 AC에 매핑된다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI3-001 | REQ-AI3-001, 002, 008, 012 | 문서 중간 트리거 → 고스트 스트리밍 → 확정 → 뒤 문맥 원문 그대로 보존 |
| AC-AI3-002 | REQ-AI3-003, 007 | 코드펜스 내부 → 힌트 없음, Mod+Enter false 폴스루, aiRequest 미호출(토큰 0) |
| AC-AI3-003 | REQ-AI3-013, 014 | 스트리밍 중 타이핑 → 고스트 소멸 + in-flight 취소 + 무토스트 |
| AC-AI3-004 | REQ-AI3-008, 009 | contextAfter 페이로드 계약(mock 요청 단언) + Rust [뒤 문맥] 프롬프트 조립 |
| AC-AI3-005 | REQ-AI3-005, 006 | 2단 힌트 자격 매트릭스(보수 조건 충족/미충족 × 힌트/수동 트리거) |
| AC-AI3-006 | REQ-AI3-004 | 리스트/인용 내부 — 수동 트리거 O, 힌트 X |
| AC-AI3-007 | REQ-AI3-010, 011, 015 | 문서 끝 하위호환(빈 after → 기존 프롬프트 동일) + truncated 플래그 유지 + 기존 테스트 무개정 |

## mx_plan

code_comments = ko (`language.yaml`). `@MX:SPEC: SPEC-AI-003` 공통 부착.

| 위치 | 태그 | 사유 |
|------|------|------|
| 자유 위치 자격 판정 순수 함수 + syntaxTree 게이트 | `@MX:ANCHOR` | 토큰 0 불변식(REQ-AI3-003/007)과 트리거 자격의 단일 진입 계약 |
| `build_continue_prompt` (after 확장 후) | `@MX:ANCHOR` | 프롬프트 3섹션 조립 + 반복·선점 금지 지시 계약(REQ-AI3-009/010) |
| `ghostStoreBridge` feature 필터(ai-ghost-text.ts:524) | `@MX:NOTE` | `'section-fill'` 하드코딩이 이어쓰기 하위호환 경로의 암묵 계약임을 명시(변경 시 브리지·aiStore·ipc 동시 수정 필요) |
| 타이핑 소멸→취소 연동 지점 | `@MX:NOTE` | REQ-AI-034 무통보 금지의 명시적 예외(D1)·Esc 동급 근거 기록 |

## Exclusions (What NOT to Build)

- **절단 고지 고스트 UI(D4)** — `truncated` 플래그의 고스트 렌더링은 카드 경로에도 없는 기존 갭(research.md §4.6)으로, 릴레이 유지(REQ-AI3-011)만 하고 UI 표면화는 후속 SPEC으로 이관.
- **새 feature 문자열('continue' 등) 도입** — `ghostStoreBridge`·aiStore 유니온·ipc 동시 수정 리스크로 금지, 하위호환 경로 고정(사전 합의 1).
- **트리 기반 아웃라인 리팩토링** — `buildOutline`(정규식 기반)의 lezer 전환은 M2 범위 밖(research.md §3.2).
- **`ai-suggestion-card.ts`(1,065줄) 파일 분할** — 이어쓰기는 카드를 사용하지 않으므로 무관, 후속 리팩토링 과제.
- **고스트 앵커 mapPos 매핑** — 파괴형 계약으로 충분(삽입 전용), 도입 금지(사전 합의 3).
- **커서급 자동 트리거** — 키 입력 연동 자동완성 없음(REQ-AI-032 승계, 설계서 §5.2 구조적 불성립).
- **상태바/거터 등 신규 힌트 UX** — 기존 커서 인라인 힌트 알약만 사용(선례 없는 신규 표면 비용, research.md §3.1).
- **카드-고스트 공존 상호작용 개선** — 검토 중 제안 카드 + 이어쓰기 고스트 동시 시나리오의 UX 개선은 기존 동시 1개 계약(REQ-AI-008) 유지 확인만 하고 신규 설계는 범위 밖.
- **신규 런타임 의존성** — `syntaxTree`는 설치된 `@codemirror/language` 재사용, npm/cargo 추가 없음.
