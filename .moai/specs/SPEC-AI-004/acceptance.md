---
id: SPEC-AI-004
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 17
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 acceptance 작성 — 프롬프트 핫픽스 4종(D-A~D-D). 자동 게이트 AC 8건(AC-AI4-001~008) + 실 CLI 재검증 AC 2건(AC-AI4-009~010, D2 기준) + 시나리오 입력 고정 표 + 품질 게이트 + DoD. |

# Acceptance Criteria — SPEC-AI-004 (AI 프롬프트 핫픽스)

검증 방식:
- **Rust `#[cfg(test)]`**: `build_inline_prompt`/`AiFeature::Continue.system_prompt()`/`AiFeature::Diagram.system_prompt()` 조립·지시 포함(순수 함수). 선례: `prompt.rs:245-592`.
- **vitest(jsdom)**: `stripMermaidFence` 정규식 매칭(무태그·타 태그·태그 뒤 공백). 선례: `src/test/aiSuggestionCard.test.ts:397-411`.
- **실 CLI 재검증(수동)**: 프롬프트 지시로만 제어되는 출력 품질(문맥 흡수·재복창·펜스·과잉 생성). 자동 게이트와 분리, SPEC 완료 시 1회. `haiku` + `claude_cli.rs::build_claude_args` 동일 인자.

## 핵심 시나리오 (자동 게이트)

### AC-AI4-001: 인라인 문맥 가드 포함 (REQ-AI4-001, 002)

- **Given** `[앞 문맥]` 또는 `[뒤 문맥]`이 있는 인라인 편집 요청일 때
- **When** `build_inline_prompt`가 프롬프트를 조립하면
- **Then** user-prompt 선두에 "문맥은 참고용, `[대상]`만 변환·문맥 내용 미포함" 취지의 가드 지시가 포함된다(Rust 유닛 `contains`).

### AC-AI4-002: 프리셋 5종 + Custom 일괄 적용 (REQ-AI4-002) [격리]

- **Given** polish/outline/table/diagram/shorten 프리셋과 Custom 직접 입력 각각에 대해 문맥이 있는 요청일 때
- **When** `build_inline_prompt`가 조립하면
- **Then** 6종 모두 가드 지시를 포함한다(프리셋 루프 단언).
- **And** `AiFeature::FillSection`/`AiFeature::Continue`에는 인라인 가드가 새지 않는다(격리 — 별도 조립 함수).

### AC-AI4-003: 문맥 0개 → 가드 미포함 + 바이트 동일 (REQ-AI4-003, 012) [regression]

- **Given** `[앞 문맥]`과 `[뒤 문맥]`이 모두 없는 인라인 요청일 때
- **When** `build_inline_prompt`가 조립하면
- **Then** 가드 지시가 포함되지 않고, **조립된 user-prompt가 핫픽스 전 결과와 바이트 단위로 동일**하다(스냅샷 `assert_eq!`).
- **And** `inline_prompt_omits_empty_context`(prompt.rs:496-501) 기존 단언이 무개정 통과한다.

### AC-AI4-004: 재복창 금지 지시 + 양 경로 적용 (REQ-AI4-004, 005)

- **Given** 이어쓰기 시스템 프롬프트일 때
- **When** `AiFeature::Continue.system_prompt()`가 생성되면
- **Then** "직전 본문 재출력 금지·끊긴 지점 바로 다음부터 새 텍스트만" 취지의 재복창 금지 지시가 포함된다.
- **And** 빈 `contextAfter`(문서 끝)와 비어있지 않은 `contextAfter`(자유 위치) 양쪽 모두 base를 상속하므로 재복창 금지가 동일 적용된다(`continue_prompt_omits_after_instruction_when_after_empty` D6 개정본이 base 상속을 확인).

### AC-AI4-005: 분량·형식 상한 + 출력 절단 미도입 (REQ-AI4-006, 007)

- **Given** 이어쓰기 시스템 프롬프트일 때
- **When** `AiFeature::Continue.system_prompt()`가 생성되면
- **Then** "한두 문단 이내 + 직전 본문에 없던 새 형식(코드 블록·표·목차) 임의 도입 금지" 취지의 온건형 분량·형식 상한 지시가 포함된다(절대 금지형 아님).
- **And** 프론트 이어쓰기 고스트 경로에 출력 후처리·강제 절단·문장 수 삭감 로직이 도입되지 않는다(diff 부재 확인 — 펜스 스트립 1함수 예외).

### AC-AI4-006: 다이어그램 양성 예시 + 기존 단언 무충돌 (REQ-AI4-008)

- **Given** 다이어그램 시스템 프롬프트일 때
- **When** `AiFeature::Diagram.system_prompt()`가 생성되면
- **Then** "출력은 mermaid 키워드로 시작·백틱 미포함" 취지의 양성 예시 1줄이 포함된다.
- **And** `diagram_prompt_forbids_markdown_fence_output`(prompt.rs:410-426)의 `contains("mermaid")`/`!contains("코드펜스로 감싸")`/`contains("펜스")&&contains("없이")`가 무개정 통과한다(어휘 무충돌).

### AC-AI4-007: stripMermaidFence 일반화 + 기존 케이스 동일 (REQ-AI4-009, 012)

- **Given** 다이어그램 응답 문자열일 때
- **When** `stripMermaidFence`가 정규화하면
- **Then** 무태그 펜스(`` ```\nflowchart LR\n A-->B\n``` ``), 타 태그 펜스(`` ```mmd\n... ``), 태그 뒤 공백/개행 변형에서 **펜스 마커만 제거하고 내부 코드는 그대로** 반환한다(리라이팅 없음).
- **And** 기존 3케이스(`` ```mermaid `` 태그·펜스 없음·사족 동봉, src/test/aiSuggestionCard.test.ts:398-411)가 무개정 통과한다.

### AC-AI4-008: 무손상·하위호환 회귀 (REQ-AI4-010, 011)

- **Given** D-C 병행 방어 및 프롬프트 수정이 적용된 상태일 때
- **When** 다이어그램 요청이 처리되면
- **Then** `handleDiagramComplete`/`decideDiagramOutcome`/자동 재요청/목록 폴백(ai-suggestion-card.ts:800-816) 동작이 변경되지 않는다(스트립·검증 대상 문자열만 정확해질 뿐 흐름 무변경).
- **And** IPC 계약(`feature`/`presetKind`/`contextAfter`), 절단(`truncated` 플래그), 스트리밍 릴레이, 고스트/카드 수명주기가 무변경으로 유지된다.

## 실 CLI 재검증 시나리오 (수동, D2 기준)

### AC-AI4-009: 결함 5종 재실행 — D2 충족 (REQ-AI4-001~008)

- **Given** 아래 결함 시나리오 5종의 입력을 SPEC-AI-003 검증 방식으로 재실행할 때(각 3회)
- **When** 핫픽스된 프롬프트로 실 CLI(`haiku`)를 호출하면
- **Then** 치명 결함(D-A: s07/s09, D-B: s11)은 **3회 중 0회 재현**(결정론), 품질 결함(D-C: s10, D-D: s02)은 **3회 중 ≤1회**(확률)이다.

### AC-AI4-010: 통과 5종 교차 오염 회귀 없음 (REQ-AI4-011, 012)

- **Given** 기존 통과 시나리오 5종(s01/s03/s04/s06/s08)의 입력을 재실행할 때(각 1회)
- **When** 핫픽스된 프롬프트로 실 CLI를 호출하면
- **Then** 점수 퇴행이 없다 — 특히 s06(인라인 다듬기 무과교정), s04(문서 끝 이어쓰기 하위호환), s08(인라인 표 문맥 미흡수)이 기존 5점대를 유지한다.

## 시나리오 입력·판정 기준 고정 표 (스크래치 소실 대비)

> 원본 입력 전문은 세션 스크래치에 보존하되, 재현 가능성을 위해 요지와 기계적 판정 기준을 여기 고정한다. 판정은 출력 문자열에 대한 결정적 검사다.

| ID | 프리셋 | 입력 요지 | 판정 기준(기계적) |
|----|--------|-----------|-------------------|
| s07 | shorten(인라인) | 기술 문서 상태 관리 문단 하나를 `[대상]`, 앞뒤에 개요·개발 환경 섹션을 문맥으로 | **D-A**: 출력에 `[앞 문맥]`/`[뒤 문맥]` 문장(예: "# mdedit 플러그인 개발 가이드", "## 개요") 미포함 |
| s09 | outline(인라인) | 기술 문서 한 섹션을 `[대상]`, 개발 환경·테스트 섹션을 문맥으로 | **D-A**: 출력이 `[대상]` 섹션 범위를 벗어난 문맥 항목(개발 환경·테스트) 미포함 |
| s10 | diagram(인라인) | 절차 설명 문단을 mermaid로 변환 | **D-C**: 출력 첫 글자가 mermaid 키워드(graph/flowchart/sequenceDiagram 등), 백틱(`` ` ``) 문자 0개. 서두 사족 없음 → 자동 재요청 0회 |
| s11 | continue(리스트) | 회의록 리스트 항목 "- 온보딩 개편 시안 확정 담당은" 뒤 커서 | **D-B**: 출력 첫머리가 직전 본문 마지막 어절("담당은")을 재반복하지 않음 |
| s02 | continue(자유 위치) | 기술 문서 중간 끊긴 문장 뒤 커서 | **D-D**: 생성 ≤2문단, 미요청 코드펜스(`` ``` ``) 0개 |
| s01 | continue(문서 끝/중간) | 에세이 "나는 문득" 뒤 커서 | 회귀: 자연 완성 + 뒤 섹션 미선점(기존 5/5 유지) |
| s03 | continue | 회의록 "다만 최QA는" 뒤 커서 | 회귀: 1문장 완성 + 뒤 섹션(요금제) 미선점 |
| s04 | continue(문서 끝) | 에세이 끝(빈 after) | 회귀: `[뒤 문맥]` 섹션·뒤 문맥 지시 없는 프롬프트 + 자연 마무리(하위호환) |
| s06 | polish(인라인) | 이미 깨끗한 기술 문장 | 회귀: 사실상 원문 유지(과교정 없음, 의미 보존) |
| s08 | table(인라인) | 기술 문서 문단을 표로 | 회귀: 마크다운 표(헤더·구분선) + 문맥 미흡수 |

## 엣지 케이스

- **인라인 문맥 한쪽만 존재**: `[앞 문맥]`만 또는 `[뒤 문맥]`만 있어도 가드 삽입(문맥 구획 ≥1 조건).
- **Custom 지시가 문맥 참조를 요구**: 가드는 여전히 삽입되나(D4 일괄), Custom 지시 자체가 우선 — 가드와 사용자 지시 충돌 시 출력 품질은 수동 검증에서 관찰(자동 게이트는 가드 포함 여부만).
- **stripMermaidFence 이중 펜스/중첩**: 정규식은 첫 펜스 블록만 매칭(기존 동작 계승) — 무한 백트래킹 없음.
- **stripMermaidFence 무펜스 원문**: 매칭 실패 시 트림된 원문 반환(기존 fallback 유지).
- **빈 after 이어쓰기(s04)**: D-B/D-D base는 상속하되 조건부 뒤 문맥 블록만 생략 → REQ-AI3-010 하위호환 유지.

## Quality Gate Criteria

- `tsc --noEmit` 클린
- `vitest run` 전량 통과 — **기준선 936개 이상**(신규 stripMermaidFence 케이스 포함, 기존 무개정)
- `cargo test` 전량 통과 — **기준선 227개 이상**(신규 프롬프트 유닛 포함, `:570-575`만 D6 개정)
- `cargo clippy` 클린
- `npm run lint`는 **게이트 아님** — eslint config 부재로 main 포함 상시 실패(알려진 제약, 회귀 오판 금지)

## Definition of Done

- [ ] REQ-AI4-001~012 전부가 AC-AI4-001~010 중 최소 1개에 매핑되어 검증됨
- [ ] 결정 D1~D6이 구현·테스트에 반영됨(D6 개정은 `:570-575` 1건만, plan.md 열거대로)
- [ ] 기존 통과 테스트 무개정(D6 열거 밖 개정 0건) 확인
- [ ] 신규 런타임 의존성 0 + 모델 무변경 확인(package.json/Cargo.toml diff 없음)
- [ ] MX 태그 부착(plan.md MX Tag Plan): @MX:NOTE 2곳(stripMermaidFence, Continue base)
- [ ] 실 CLI 재검증(결함 5종×3회 + 통과 5종×1회) D2 기준 충족 기록 → `.moai/specs/SPEC-AI-004/manual-verification.md`
