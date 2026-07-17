# SPEC-AI-004 "AI 프롬프트 핫픽스(인라인 문맥 흡수·재복창·펜스·과잉 생성)" 리서치 보고서

## 0. 핵심 발견 요약 (가장 중요)

SPEC-AI-003 완료 후 실 Claude Code CLI(`haiku`, 12개 시나리오) 시뮬레이션에서 **프롬프트 품질 결함 4종**이 확정 재현됐다(증거: `.moai/specs/SPEC-AI-003/manual-verification.md`, 이제 main). 4종 모두 **코드 로직 버그가 아니라 프롬프트 지시문의 커버리지 공백**이며, 스트리밍·고스트·IPC·절단·수명주기 인프라는 전부 정상이다.

- **D-A 인라인 문맥 흡수** (s07 짧게 줄이기 / s09 개요로 정리): `build_inline_prompt`(prompt.rs:151-178)가 `[앞 문맥]`/`[대상]`/`[뒤 문맥]` 3구획을 조립하지만 **어느 프롬프트에도 마커의 의미·스코프를 설명하는 지시가 없다.** 요약류 동사("핵심만 남겨 짧게 줄여라", "개괄식 불레틴으로 정리하라")는 "주어진 텍스트"를 프롬프트 전체로 일반화해 `[앞/뒤 문맥]`까지 변환 대상으로 흡수한다. 교체 삽입 시 문서 파손(치명).
- **D-B 앞 꼬리 재복창** (s11 리스트 항목 이어쓰기): SPEC-AI-003 강화 프롬프트("뒤 문맥 반복·선점 금지")로 실행됐음에도 재현. **금지 지시가 뒤 문맥만 조준**하고 "이미 쓴 직전 본문 꼬리의 재출력"은 미금지. 삽입 시 어절 중복(치명).
- **D-C mermaid 펜스+사족 재발** (s10 인라인 다이어그램): 프롬프트 펜스 금지(prompt.rs:88-90, BUG-3(b) 수정분)가 있어도 haiku가 위반. 프론트 `stripMermaidFence`(ai-suggestion-card.ts:870-874)가 실질 방어 중이나 **정규식이 `` ```mermaid `` 태그 펜스만 매칭** — 무태그/타 태그 펜스는 스트립 실패 → `validateMermaid` 실패 → 불필요한 자동 재요청(품질/토큰·지연).
- **D-D 이어쓰기 과잉 생성** (s02 자유 위치 이어쓰기): 분량·형식 상한 지시 부재 — 미요청 `` ```typescript `` 코드 블록 추가(COMMON_INSTRUCTION "펜스는 요청받은 경우에만" 실증 위반). 강화 프롬프트로도 재현(품질).

**중복 SPEC 없음**: `.moai/specs/`의 AI 계열은 SPEC-AI-001/002/003. 본 SPEC은 그중 프롬프트 지시문을 핫픽스한다.

---

## 1. 원인 지시문 원문 인용 (prompt.rs / ai-suggestion-card.ts)

### 1.1 공통 출력 지시 — 스코프 설명 부재의 뿌리

```rust
// prompt.rs:16-18
/// 모든 기능 공통 출력 지시 — 결과만, 설명·펜스 금지(§7).
const COMMON_INSTRUCTION: &str =
    "결과 텍스트만 출력하라. 설명·인사·사족을 붙이지 말라. 마크다운 코드펜스는 요청받은 경우에만 사용하라.";
```

`COMMON_INSTRUCTION`은 "결과 텍스트만"을 말하지만 **"결과 텍스트"가 `[대상]`만을 가리키는지, `[앞/뒤 문맥]`을 배제하는지는 정의하지 않는다.** D-A/D-D의 공통 근원.

### 1.2 프리셋별 시스템 프롬프트 (prompt.rs:75-107)

```rust
// prompt.rs:80-82 — Outline(s09 문맥 흡수)
"주어진 텍스트를 개괄식 불레틴으로 정리하라. 핵심 항목을 들여쓰기 계층으로 나누고 명사형으로 종결하라. 이미 개조식이면 계층과 표현만 다듬어라."
// prompt.rs:92-94 — Shorten(s07 문맥 흡수)
"주어진 텍스트에서 핵심만 남겨 짧게 줄여라. 중요한 정보는 잃지 말라."
```

"주어진 텍스트"라는 표현이 `[대상]`으로 결박되지 않아 프롬프트 전체(문맥 포함)로 일반화된다. 대조적으로 **1:1 결박형 동사는 생존**:

```rust
// prompt.rs:78-79 — Polish(s06 생존)
"…맞춤법과 문장을 자연스럽게 다듬되 의미와 정보는 그대로 유지하라."
// prompt.rs:84-85 — Table(s08 생존)
"주어진 텍스트의 내용을 마크다운 표로 변환하라. …"
```

"다듬되 그대로 유지"/"내용을 변환"은 대상 텍스트와 1:1 대응이 강해 우연히 문맥을 흡수하지 않았다. **그러나 이는 우연이며 지시 차원의 보호는 전무** — `Custom`(prompt.rs:95-97, 사용자 자유 지시)도 잠재 결함이다.

### 1.3 이어쓰기 시스템 프롬프트 (D-B/D-D 대상)

```rust
// prompt.rs:101-103 — Continue base
"너는 문서 작성 보조자다. 문서의 어조와 종결어미를 그대로 이어받아 직전 본문에 자연스럽게 이어지는 다음 내용을 작성하라. 문서 개요와 직전 본문의 맥락에서 벗어나지 말라."
// prompt.rs:234-243 — continue_system_prompt(has_after=true)에서 조건부로 덧붙는 문구
"끊긴 문장부터 이어서 완성하고, 뒤 문맥으로 자연스럽게 연결하라. 뒤 문맥의 내용을 반복하거나 선점하는 것은 금지한다."
```

- **D-B**: 조건부 문구의 "반복하거나 선점하는 것은 금지"는 **뒤 문맥만 조준**한다. "직전 본문(=커서 앞 텍스트) 꼬리의 재출력" 금지는 어디에도 없다. 게다가 "끊긴 문장부터 이어서 완성"이 haiku에서 "끊긴 문장을 처음부터 다시 써서 완성"으로 중의 해석됐다(s11 증거).
- **D-D**: base·조건부 어디에도 **분량·형식 상한**이 없다. `COMMON_INSTRUCTION`의 "펜스는 요청받은 경우에만"만으로는 haiku의 코드펜스 임의 도입을 막지 못했다(s02).

### 1.4 프롬프트 조립 지점 (변경 좌표)

```rust
// prompt.rs:151-171 — build_inline_prompt: [앞 문맥]/[대상]/[뒤 문맥] 조립(D-A 주입 지점)
// prompt.rs:207-229 — build_continue_prompt: [문서 개요]/[직전 본문]/[뒤 문맥] 조립
// prompt.rs:234-243 — continue_system_prompt(has_after): 조건부 후미 지시
// mod.rs:122-128 — 기능별 프롬프트 분기(FillSection/Continue/inline)
```

### 1.5 mermaid 프론트 방어 경로 (D-C 대상)

```typescript
// ai-suggestion-card.ts:800-816 — handleDiagramComplete
const stripped = stripMermaidFence(code);              // :804
const validation = await validateMermaid(stripped);    // :805
const outcome = decideDiagramOutcome(validation, this.diagramAttempts, stripped);
// outcome.kind === 'auto-retry' → onReRequest (:809-812, 불필요 자동 재요청)
// outcome.kind === 'fallback'   → 'diagram-fallback' (:813-814, 목록 폴백)

// ai-suggestion-card.ts:870-874 — 문제의 정규식(태그 고정)
export function stripMermaidFence(code: string): string {
  const m = code.match(/```mermaid\s*\n([\s\S]*?)```/);
  return (m ? m[1] : code).trim();
}
```

`` ```mermaid `` 태그가 붙은 펜스만 매칭한다. haiku가 무태그 `` ``` `` 또는 `` ```mmd `` 등으로 감싸면 `m===null` → 펜스 포함 원문이 그대로 `validateMermaid`로 넘어가 **항상 실패** → `auto-retry`(1회) 후 `fallback`. 즉 프론트 안전망이 "일부 펜스"만 커버한다. `ensureMermaidFence`(ai-suggestion-card.ts:881-885)는 삽입 경로용이라 무관.

---

## 2. 시뮬레이션 증거 요약 (SPEC-AI-003 manual-verification.md)

| # | 시나리오 | 프리셋 | 결함 | 증거 |
|---|---|---|---|---|
| s02 | 자유 위치 이어쓰기 | continue | **D-D** | 끊긴 문장 완성은 정확하나 미요청 `` ```typescript `` 코드펜스 + 추가 문단 과잉 생성 |
| s07 | 인라인 짧게 줄이기 | shorten | **D-A**(치명) | `[대상]` 문단만 줄이지 않고 `[앞/뒤 문맥]`까지 흡수해 문서 전체 요약본 생성 → 교체 삽입 시 파손 |
| s09 | 인라인 개요로 정리 | outline | **D-A** | s07과 동일 — 개발 환경·테스트 섹션까지 흡수해 전체 문서 개요 생성 |
| s10 | 인라인 다이어그램 | diagram | **D-C** | 서두 사족 + 명시 금지된 `` ```mermaid `` 펜스 출력(BUG-3(b) 재발) → 사전 검증 실패·자동 재요청 트리거 |
| s11 | 리스트 항목 이어쓰기 | continue | **D-B**(치명) | 커서 앞 "온보딩 개편 시안 확정 담당은"을 출력 첫머리에 재복창 → 삽입 시 어절 중복 |

**핵심 계약(뒤 문맥 반복·선점 금지)은 실효 확인**: 5개 continue 시나리오(SPEC-AI-003 manual-verification.md 기준 s01/s02/s03/s11/s12 — s12는 본 SPEC 재검증 세트 밖)에서 뒤 문맥 문면 반복·선점 0/5. 즉 SPEC-AI-003 조건부 문구는 정상 작동하며, 본 SPEC은 그 문구가 **커버하지 못한 인접 실패**만 메운다.

**통과(회귀 감시 대상) 시나리오**: s01(에세이 이어쓰기, 5/5/5/4/5), s03(회의록 이어쓰기, 최우수), s04(문서 끝 이어쓰기 — 빈 after 하위호환), s06(인라인 다듬기 — 과교정 없음), s08(인라인 표 — 문맥 미흡수). 이들의 점수 퇴행이 없어야 한다.

---

## 3. 사용자 확정 결정 배경 (Decision Log 근거)

- **성공 기준 이원화(D2)**: haiku 지시 순응도의 확률적 한계가 실증됐으므로(강화 프롬프트로도 s02/s10/s11 재현), 치명 결함(D-A/D-B — 문서 파손·중복)은 결정론적 0회 재현을, 안전망이 흡수하는 품질 결함(D-C 자동 재요청 흡수 / D-D `[지우기]` 가능)은 확률적 ≤1/3을 요구.
- **병행 방어(D3)**: 프롬프트 단독은 D-C에서 이미 1회 실패한 확률적 접근이므로, 프롬프트 양성 예시 + `stripMermaidFence` 정규식 일반화(결정적 보험)를 병행. 스트립은 **펜스만** 제거하며 본문 리라이팅은 절대 금지(무손상 원칙).
- **주입 위치(D4/D5)**: D-A는 `build_inline_prompt` user-prompt 선두(문맥 구획 ≥1일 때만) — per-preset은 Custom 미보호, COMMON_INSTRUCTION은 FillSection/Continue 오염이라 기각. D-B/D-D는 Continue base 한 곳(doc-end·자유 위치 양쪽 자동 적용).

---

## 4. 리스크 & 테스트 회귀면

### 4.1 회귀 표면 (기존 테스트)

| 테스트(prompt.rs) | 단언 | D6 개정 필요? |
|---|---|---|
| `continue_prompt_omits_after_instruction_when_after_empty`(:570-575) | `assert_eq!(system_prompt, Continue.system_prompt())` **+** `!contains("금지")` | **개정 필요** — D-D 온건형 분량 지시가 "금지" 어휘를 base에 넣으면 `!contains("금지")` 파손. `assert_eq!`는 양변 동시 변경이라 유지. 개정: 후자를 "뒤 문맥 관련 금지 부재"로 특정(예: `!contains("뒤 문맥")` 또는 `!contains("반복하거나 선점")`) |
| `continue_prompt_instructs_forbidding_after_context_repetition_when_present`(:562-568) | `contains("뒤 문맥")`, `contains("금지")`, `contains("끊긴 문장")` | 무개정(조건부 후미 지시 유지) |
| `continue_system_prompt_instructs_style_inheritance`(:351-356) | `contains("이어")`, `contains("어조와 종결어미")`, `contains("결과 텍스트만 출력")` | 무개정(D-B/D-D 추가 후에도 성립). **주의**: D-B/D-D 문구가 이 키워드와 어긋나지 않게 |
| `diagram_prompt_forbids_markdown_fence_output`(:410-426) | `contains("mermaid")`, `!contains("코드펜스로 감싸")`, `contains("펜스")&&contains("없이")` | 무개정 — D-C 프롬프트 양성 예시 추가 시 이 단언과 **충돌 없는 문구** 선택 필수(예: "출력은 mermaid 키워드로 시작, 백틱 문자 미포함" — "코드펜스로 감싸" 문자열 미도입) |
| `inline_prompt_omits_empty_context`(:496-501) | `!contains("[앞 문맥]")`, `!contains("[뒤 문맥]")`, `contains("[대상]")` | 무개정 — D-A 가드는 문맥 ≥1일 때만 주입, 문맥 0개면 미주입이라 바이트 동일 |
| `inline_prompt_includes_context_sections`(:484-493) | 섹션·내용 `contains` + `!truncated` | 무개정(가드 1줄 추가는 contains 단언 무영향) |
| `every_feature_includes_common_instruction`(:368-386) | 전 프리셋 `contains("결과 텍스트만 출력")` | 무개정 |

### 4.2 어휘 충돌 회피 규칙

- D-A 가드 문구에 기존 단언 키워드(`"펜스"`, `"결과 텍스트만"`, `"코드펜스로 감싸"`)를 재사용하지 말 것 — 오탐 방지.
- D-C 양성 예시는 `diagram_prompt_forbids_markdown_fence_output`의 `!contains("코드펜스로 감싸")`를 깨지 않도록 "백틱"·"키워드로 시작" 어휘 사용.
- D-D 분량 지시가 base에 "금지"를 도입하면 4.1의 `:570-575` 테스트를 반드시 D6 개정 목록에 등재.

### 4.3 그 외 리스크

1. **haiku 확률성**: 프롬프트 지시만으로는 결정론 불가(D-C/D-D가 실증) → D2 이원 기준 + D-C 결정적 스트립 병행으로 완화.
2. **stripMermaidFence 과일반화**: 정규식을 `` ```[a-z]* `` 수준으로 넓히면 **일반 마크다운 코드블록(예: `` ```bash ``)** 도 잘못 벗길 위험. 그러나 이 함수는 `handleDiagramComplete`(presetKind==='diagram') 경로에서만 호출되므로(ai-suggestion-card.ts:788) 대상 자체가 다이어그램 응답 — 오작동 표면 없음. @MX:NOTE로 호출 스코프 명시.
3. **본문 리라이팅 금지 불변식**: 스트립은 펜스 마커만 제거, 내부 코드 무변경(기존 계약 유지) — D3 명시.
4. **알려진 게이트 제약**: `npm run lint` 상시 실패(eslint config 부재) — 게이트 아님. 기준선 vitest 936 / cargo 227(SPEC-AI-003 완료 후).

---

## 5. 테스트 자산 & 신규 테스트 패턴

- **Rust `#[cfg(test)]`**(prompt.rs:245-592): 기존 `continue_*`/`inline_*`/`diagram_*` contains 단언 스타일 그대로. 신규 — D-B/D-D base 지시 포함(재복창 금지·분량 상한), D-A 가드 포함/제외(문맥 유무)·바이트 동일 스냅샷, D-A 프리셋 루프(polish/outline/table/diagram/shorten/custom), D-C 양성 예시.
- **vitest**(src/test/aiSuggestionCard.test.ts:397-411 `stripMermaidFence` describe 블록): 신규 — 무태그 `` ``` `` 펜스, `` ```mmd `` 타 태그 펜스, 태그 뒤 공백 케이스 스트립 성공 단언. 기존 3케이스(:398-411) 무개정 통과.
- **수동 실 CLI 재검증**(SPEC-AI-004 manual-verification.md): 결함 5종(s07/s09/s10/s11/s02) × 3회 + 통과 5종(s01/s03/s04/s06/s08) × 1회, D2 판정 기준 적용. 원본 문서·조립 프롬프트·raw 출력은 세션 스크래치에 보존하되, 소실 대비 판정 기준을 acceptance.md 표에 고정.
