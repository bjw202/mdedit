---
id: SPEC-AI-003
version: "0.1.1"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 15
generated_from: spec.md
---

# SPEC-AI-003 Compact — M2 자유 위치 이어쓰기 (시나리오 E)

> Run phase용 압축본. 원본: spec.md / plan.md / acceptance.md / research.md.
> 이어쓰기를 문서 끝 전용 → 임의 커서 위치로 확장. AI 입력 = [개요]+[앞 문맥](truncate_tail)+[뒤 문맥](truncate_head). 스트리밍·고스트·확정·취소는 SPEC-AI-001/002 전부 재사용. IPC 하위호환: `feature:'section-fill'`+`presetKind:'continue'`+`contextAfter`. 방법론 TDD.

## Requirements (EARS)

### 모듈 1 — 자유 위치 자격 판정

- **REQ-AI3-001** (U): 자격 판정·컨텍스트 추출은 토큰 0 프론트 순수 함수. `sliceDoc(0,head)`/`sliceDoc(head)` 통째 전달, 절단은 Rust.
- **REQ-AI3-002** (U): 우선순위 유지 — section-fill > 문서 끝 continue > 자유 위치 continue.
- **REQ-AI3-003** (Un): IF `syntaxTree.resolveInner(pos)` 기준 FencedCode/CodeBlock/Table 내부, then 힌트 없음 + Mod+Enter false 폴스루 + 요청 0(토큰 0).
- **REQ-AI3-004** (S): WHILE ListItem/Blockquote 내부, Mod+Enter 수동 트리거 허용 + 힌트 제외(D2).

### 모듈 2 — 힌트 2단 자격

- **REQ-AI3-005** (S): WHILE 보수 조건(비어있지 않은 줄의 줄 끝 + 문장 미종결 + 배제 노드 밖) 3초 유휴, "이어쓰기" 힌트 버튼 + 단축키 표기(토큰 0). 종결 부호 닫힌 집합: `.` `!` `?` `。` `…`(후행 공백·닫는 따옴표/괄호 무시).
- **REQ-AI3-006** (Un): IF 보수 조건 미충족, 힌트 미표시 — 단 Mod+Enter 트리거 자격은 독립 판정.
- **REQ-AI3-007** (Un): IF 명시적 클릭/단축키 없음, AI 요청 없음(REQ-AI-032 승계).

### 모듈 3 — 요청·프롬프트

- **REQ-AI3-008** (E): WHEN 트리거, `feature:'section-fill'`+`presetKind:'continue'`+`contextAfter`(기존 필드) 전달, 고스트 스트리밍 + [넣기]/[지우기]/[중지].
- **REQ-AI3-009** (E): WHEN Rust가 비어있지 않은 contextAfter 수신, [개요]+[앞 문맥]+[뒤 문맥](truncate_head, 전용 상한) 조립 + 지시 "끊긴 문장 완성·뒤 문맥 연결·반복/선점 금지".
- **REQ-AI3-010** (Un): IF contextAfter 없음/빈 값, [뒤 문맥] 섹션·지시 생략 — 기존 문서 끝 프롬프트와 동일(하위호환).
- **REQ-AI3-011** (O): WHERE 문맥 절단 발생, `ai://done{truncated}` 릴레이 유지(고스트 UI 고지는 범위 밖).

### 모듈 4 — 고스트 수명주기

- **REQ-AI3-012** (U): AI-001/002 고스트 계약 전부 상속(단일 트랜잭션 확정·Tab 비확정·빈 텍스트 확정 거부·플레이스홀더·스크롤 2회). 확정 시 뒤 문맥 무변경(삽입 전용).
- **REQ-AI3-013** (E): WHEN 타이핑으로 고스트 소멸, in-flight 요청도 `ai_cancel` 취소 + 무토스트(D1 — REQ-AI-034의 명시적 예외).
- **REQ-AI3-014** (E): WHEN 고스트 활성 중 effect 없는 문서 변경 트랜잭션 발생, 고스트 즉시 파괴 — mapPos 매핑 금지(파괴형 계약 유지).

### 모듈 5 — 하위호환

- **REQ-AI3-015** (U): 문서 끝 이어쓰기·빈 섹션 채우기 관찰 동작 무변경. 신규 판정 함수 병행 — 기존 `getContinueContext`·aiContinueContext.test.ts 무개정(D3).

## Acceptance (요약)

| AC | 내용 |
|----|------|
| AC-AI3-001 | 문서 중간 트리거→고스트→확정, 뒤 문맥 바이트 동일 보존 |
| AC-AI3-002 | 코드펜스/표 내부: 힌트 X, Mod+Enter false, aiRequest 호출 0 |
| AC-AI3-003 | 스트리밍 중 타이핑→고스트 파괴 + ai_cancel + 무토스트; 확정 트랜잭션은 오취소 없음 |
| AC-AI3-004 | mock 페이로드 contextAfter 계약 + Rust 3섹션·금지 지시 조립 |
| AC-AI3-005 | 2단 힌트 자격 매트릭스(보수 조건 충족/미충족) |
| AC-AI3-006 | 리스트/인용: 트리거 O, 힌트 X |
| AC-AI3-007 | 빈 after→기존 프롬프트 동일, truncated 릴레이 유지, 기존 테스트 무개정 통과 |

## Files to Modify

| Delta | 파일 | 요지 |
|-------|------|------|
| [MODIFY] | `src/components/editor/extensions/ai-ghost-text.ts` | 신규 자유 위치 판정 함수 병행 + syntaxTree 게이트 + evaluateHintEligibility 2단 확장 + 트리거 일반화(contextAfter) + 타이핑 소멸 시 취소(D1). `getContinueContext`(80-92)·ghostStoreBridge(514-558) 무변경 |
| [MODIFY] | `src-tauri/src/ai/prompt.rs` | `build_continue_prompt(outline, before, after)` + truncate_head 절단 + 금지 지시 + 빈 after 생략 |
| [MODIFY] | `src-tauri/src/ai/mod.rs` | continue 분기(125행) contextAfter 전달 + 역직렬화 테스트 |
| [NEW] | `src/test/aiFreeContinue.test.ts` | 자격 매트릭스(markdown() 확장 state)·페이로드·취소 |
| [MODIFY] | `src/test/aiHint.test.ts`, `e2e/*` + `tauri-v2-ai-mock.ts` | 힌트 케이스 추가(기존 무개정), 중간 위치 여정 |

## Exclusions

절단 고지 고스트 UI(D4) / 새 feature 문자열 도입 금지 / 트리 기반 outline 리팩토링 / ai-suggestion-card 분할 / mapPos 앵커 매핑 / 커서급 자동 트리거 / 상태바·거터 힌트 UX / 카드-고스트 공존 UX 개선 / 신규 런타임 의존성.

## Gates

tsc 클린 / vitest ≥913 / cargo test ≥221 / clippy 클린 / Playwright(webkit) + 콘솔 에러 0. **lint는 게이트 아님**(eslint config 부재).
