# SPEC-AI-006 "AI 프롬프트 정밀도·지연 워치독·이어쓰기 보조 UX" 리서치 보고서

> 본 문서는 SPEC-AI-006 착수 전 확정된 사실을 수록한다. 아래 사실은 재조사 불필요.
> 근거: 사용성 리서치(`.moai/reports/ai-usability-research-2026-07-17.md`), 오너 도그푸딩 노트(`프롬프트-핫픽스-테스트.md`·`이어쓰기-테스트.md`), main(731f05f) 실제 코드 정독.

## 0. 핵심 발견 요약 (가장 중요)

SPEC-AI-006의 5개 항목은 **전부 기존 계층 위의 국소 수정**이며, 새 인프라·새 표면·새 아웃오브스코프(채팅/에이전트)를 도입하지 않는다.

- **프롬프트 계층은 전부 Rust(`src-tauri/src/ai/prompt.rs`)** — 단일 소스. 항목 1(대상 스코핑·언어 편향)은 **프롬프트 문자열 수정**으로 한정되며, 인라인 조립 지점(`build_inline_prompt`)이 유일 삽입점이다.
- **프로세스 스폰·릴레이는 `mod.rs`+`claude_cli.rs`** — 요청마다 `claude` 자식 프로세스를 스폰하고 별도 스레드로 릴레이하나 **타임아웃/워치독이 없다**. 항목 2는 하드 타임아웃 + 신규 `timeout` 오류 종류를 추가한다(Rust + 프론트 union 각 1곳).
- **고스트·카드 인프라 재사용** — 카드에는 재요청(`fireReRequest`)이 있으나 고스트에는 없다(항목 3). 이어쓰기 길이 제어는 없다(항목 4). 로딩 표면(카드 스켈레톤·고스트 플레이스홀더)은 대기 안내 문구를 붙일 자리다(항목 5).

**항목별 델타 요약**: (1) `build_inline_prompt` 시스템 프롬프트에 대상-스코핑·언어-유지 절 추가 + Polish 언어 중립화, (2) 요청 워치독 스레드(하드 타임아웃) + `timeout` 오류 종류, (3) `GhostControlsWidget` done 상태에 ↻ 버튼 + 마지막 트리거 인자 보관, (4) `uiStore` `aiContinueLength` + `build_continue_prompt_with_length` + IPC `length`, (5) 로딩 표면 대기 문구(프론트 상수 8초).

**중복 SPEC 없음**: `.moai/specs/`의 AI SPEC은 001/002/003/005. 본 SPEC은 **미생성 유령 SPEC-AI-004의 프롬프트 핫픽스 의도를 계승·상위대체**한다(§9 참조).

---

## 1. 프롬프트 계층 — 항목 1 근거 (`src-tauri/src/ai/prompt.rs`)

- `AiFeature::system_prompt()`(L75-106): Polish/Outline/Table/Diagram/Shorten/Custom/FillSection/Continue. `COMMON_INSTRUCTION`(L17-18, "결과 텍스트만 출력…")은 전 기능 공통.
- **Polish 언어 편향 확정**: L78 `"너는 한국어 문장 교정기다. 주어진 텍스트의 맞춤법과 문장을 자연스럽게 다듬되…"` — 영어/혼용 문단에 한국어 교정기 지시가 나간다(리서치 케이스 d/g).
- **대상 스코핑 부재 확정**: 인라인 조립 `build_inline_prompt`(L151-178)는 `[앞 문맥]`/`[대상]`/`[뒤 문맥]`을 user_prompt에 나눠 담지만, 시스템 프롬프트 어디에도 "`[대상]`만 변환하고 `[앞/뒤 문맥]`은 읽기 전용 참고"라는 지시가 없다. haiku가 앞뒤 문맥까지 "주어진 텍스트"로 오해하면 흡수(absorption)가 발생한다(오너 A-1/A-2 ❌).
- **삽입점 확정**: `build_inline_prompt`가 인라인 6기능(polish/outline/table/diagram/shorten/custom)의 유일 조립 지점이다. `Custom`은 `system_prompt()`에서 조기 return(L95-97)하므로 각 기능 문자열이 아닌 **조립 지점에서 스코핑 절을 덧붙여야** 6기능 전부 균일 커버된다.
- **하위호환 계약(불변)**: `build_section_prompt`(L181)/`build_continue_prompt`(L207)는 인라인이 아니며 `[대상]` 개념이 없다. 이어쓰기엔 바이트 동일 하위호환 테스트가 존재한다:
  - `continue_prompt_backward_compat_when_after_empty_matches_legacy_shape`(L586-591): `system_prompt == AiFeature::Continue.system_prompt()` 단언.
  - `continue_prompt_omits_after_instruction_when_after_empty`(L570-575): `!contains("금지")` 단언.
  → **스코핑·언어-유지 절을 `COMMON_INSTRUCTION`이나 `Continue` base에 넣으면 이 바이트 계약이 깨진다.** 따라서 인라인 조립 지점 한정 삽입이 강제된다(D1).
- **깨지지 않는 기존 인라인 테스트**: `every_feature_includes_common_instruction`(L368, COMMON 포함 확인), `feature_templates_are_distinct`(L389, polish≠outline·diagram 포함 mermaid), `inline_prompt_includes_context_sections`(L484, user_prompt에 [앞/대상/뒤]·문맥 문자열 포함), `inline_prompt_keeps_selection_verbatim`(L476). Polish 문자열만 바꾸고 스코핑을 system_prompt 조립에 덧붙이는 방식이면 이들은 무개정 통과한다.

## 2. 프로세스 스폰·릴레이 — 항목 2 근거 (`mod.rs`, `claude_cli.rs`, `stream.rs`)

- `ai_request`(mod.rs:99-207): 정책 확인 → 프롬프트 조립 → in-flight 교체 → `provider.spawn`(→`spawn_claude` claude_cli.rs:142) → `relay_process` → `InFlightRequest{request_id, child, cancel_flag}`를 `state.in_flight`에 저장(동시 1개).
- `relay_process`(claude_cli.rs:162-224): `std::thread::spawn`으로 stdout `reader.lines()`를 **블로킹** 순회. 프로세스가 행(hang)이면 스레드가 무한 대기 → 프론트 스켈레톤 무한. **타임아웃/워치독이 코드 어디에도 없다**(리서치 지연 축 ★★).
- `decide_outcome`(stream.rs 인접, claude_cli.rs:117-137): 우선순위 취소→결과→stderr 분류→parse/other. `cancelled`(cancel_flag)면 `RelayOutcome::Silent`(무발행). 정상 완료는 `ai://done`, 오류는 `ai://error{kind}`.
- **터미널 `ai://error`는 릴레이 외에도 두 지점에서 무조건 발행된다**: `ai_cancel`(mod.rs:224, `cancelledBy:"user"`)과 신규 요청 교체(mod.rs:156, `cancelledBy:"new-request"`). 이 둘은 현재 `cancel_flag`만 세우고 자체 emit하므로, 워치독을 릴레이하고만 결속하면 취소·교체 emit과 워치독 emit이 동일 requestId에 이중 발행된다(M1 근거) → 단일발행 선점은 **이 4지점 전부**를 결속해야 한다.
- **오류 종류 표면**:
  - Rust: `ErrorPayload.kind: String`(claude_cli.rs:47-49), `friendly_error_message(kind)`(L101-110)이 login/network/parse/other 매핑. `classify_stderr`(stream.rs:78)의 NETWORK_MARKERS에 "timeout"이 이미 있으나 이는 stderr 문자열 분류일 뿐, **하드 타임아웃 종류는 없다**.
  - 프론트: `AiErrorKind = 'login'|'network'|'parse'|'other'`(aiStore.ts:11). `useAiRelay`(useAiRelay.ts:62-66)가 `ai://error{kind,message}`를 `failRequest`로 릴레이. 카드는 login이면 "연결 안내 보기", 그 외 "다시 시도"(리서치 실패상태 축).
- **워치독 삽입 설계(D2, 단일 발행 보장)**: 요청당 워치독 스레드 + **요청별 공유 `Arc<AtomicBool> finished`**. 종료 주체는 `finished.swap(true)`로 **선점(claim)**한다 — false→true를 먼저 성공시킨 쪽만 terminal 이벤트를 발행한다. **선점에 참여하는 발행 지점은 넷**이다: (1) 릴레이 `relay_process`가 **모든 outcome(done·error·EOF Silent 포함)**에서 발행 전 claim, (2) 워치독이 타임아웃(기본 60초) 시 claim 성공하면 자식 kill + `state.in_flight` 정리 + `ai://error{kind:"timeout"}`, (3) `ai_cancel`(mod.rs:224)이 발행 전 claim, (4) 신규 요청 교체(mod.rs:156)가 발행 전 claim. claim 실패 지점은 무발행. 릴레이가 Silent(취소) 경로에서도 claim해야 순차 시나리오(5초 취소 → 60초 워치독)에서 워치독이 억제된다. 이는 정상 완료 시 in_flight 슬롯이 즉시 비워지지 않는(죽은 child 잔류) 현 구조에서 이중발행·오탐을 막는 유일한 안전 장치다(REQ-AI6-006, AC-AI6-002).
- **타임아웃 기본값 근거**: 프로바이더 실측 typical_latency ~2.7초, 첫 텍스트 ~2.3초(`Capabilities`, claude_cli.rs:256-260). 사내 프록시 환경은 콜드스타트가 더 길 수 있어, 하드 kill 기본값은 정당한 지연을 죽이지 않도록 **60초**(p99 훨씬 상회)로 잡고 무한 행만 차단한다. 소프트 안내(항목 5)는 별개의 짧은 임계(8초).

## 3. 고스트·카드 인프라 — 항목 3 근거

- 카드 재요청(선례): `fireReRequest(originalArgs, overrides)`(card.ts:968, `@MX:ANCHOR`), `onReRequest` 콜백들(L1024-1034). 원본 `request.args`를 보관했다가 override로 재발행한다.
- 고스트 컨트롤: `GhostControlsWidget.toDOM`(ghost-text.ts:334-350) — streaming이면 `[■ 중지]`(dismiss), done이면 `[✓ 넣기]`(confirm)·`[✕ 지우기]`(dismiss). **재요청 버튼이 없다**(리서치 채택 제안 1).
- 고스트 발행 경로: `startSectionFillCommand`(L390)/`startContinueWritingCommand`(L421)/`startFreeContinueWritingCommand`(L452) — 각기 `requestId` 생성 + `startRequest` + `aiRequest({feature,presetKind?,model,outline,contextBefore,contextAfter?})`. **재요청을 위해서는 마지막 발행 인자(feature/presetKind/model/outline/before/after/anchor)를 보관**했다가 done 상태에서 새 `requestId`로 재발행하면 된다(문서/커서 이동 위험 때문에 재파생보다 인자 재사용이 안전 — 카드 `fireReRequest`와 동일 의미론).
- 확정 경로 불변: `confirmGhostCommand`(L364, `@MX:ANCHOR`)는 단일 트랜잭션 계약 — ↻는 이 경로를 건드리지 않는다.

## 4. 이어쓰기 길이 제어 — 항목 4 근거

- 이어쓰기(continue) 발행은 **정확히 2경로**다: `startContinueWritingCommand`(문서 끝, ghost-text.ts:421, `aiRequest` L435)와 `startFreeContinueWritingCommand`(자유 위치, L452, `aiRequest` L465) — 둘 다 `presetKind:'continue'`. `startSectionFillCommand`(L390, `aiRequest` L406)는 `feature:'section-fill'`·**presetKind 없음** → `AiFeature::FillSection`이므로 continue가 아니다(length 미대상). Rust에서 `AiFeature::Continue` → `build_continue_prompt(outline, before, after)`(prompt.rs:207)로 조립.
- **길이 제어 없음** → haiku가 문단을 통으로 뽑는다(리서치 케이스 a 걸림돌).
- **시그니처 하위호환(D3)**: `build_continue_prompt`는 기존 테스트 ~10개(prompt.rs:531-591)가 3인자로 호출한다. 4번째 인자를 추가하면 전 호출부가 깨진다. 따라서 `ContinueLength{Short, Normal}` enum + `build_continue_prompt_with_length(outline, before, after, length)` 신설, 기존 `build_continue_prompt`는 `Normal`로 위임(바이트 동일) → **기존 테스트 무개정**. `Normal`은 추가 지시 없음(현 바이트 유지), `Short`는 "짧게, 한두 문장만" 지시 덧붙임.
- IPC: `AiRequestArgs`(mod.rs:74-94)에 `#[serde(default)] length: Option<String>` 추가. mod.rs `ai_request`가 `Continue` 분기에서만 length를 매핑해 `build_continue_prompt_with_length` 호출. 인라인/섹션 채우기 분기는 무영향(REQ-AI6-014). 프론트에서도 length는 continue 발행 2곳(L435/L465)에서만 실어 보낸다.
- **배치 결정(D4)**: 길이 선택은 발행 *전*에 정해져야 하는데, 이어쓰기 트리거는 힌트 클릭과 `Mod+Enter` 두 경로가 있고 `Mod+Enter`엔 힌트 알약이 없다. 두 경로를 균일 커버하고 재요청(항목 3)에도 그대로 실리는 유일 배치는 **지속 설정**이다 → `uiStore` `aiContinueLength: 'short'|'normal'`(기본 'normal', `aiAdvancedModel` 선례 복제) + SettingsModal AI 섹션 토글. 힌트 알약에 길이 변형을 얹는 대안은 알약 다중화·`Mod+Enter` 미커버로 기각.

## 5. 로딩 표면 대기 문구 — 항목 5 근거

- 카드 스켈레톤: `streamBuffer` 빈 동안 3줄 shimmer 생성(card.ts:287-294, 판정 L286). `mdedit-ai-truncated-note` DOM 노트 선례(card.ts:405-407)로 보조 문구 삽입 패턴 존재.
- 고스트 플레이스홀더: `GhostPlaceholderWidget` "✨ 작성 중…"(ghost-text.ts:276-289, `eq()` 상수라 pulse 유지).
- **설계**: 프론트 상수(기본 8초) 경과 + 아직 응답 없음(첫 청크 전)일 때 두 표면에 "아직 생성 중이에요 — 취소할 수 있어요" 보조 문구 표시. 첫 청크/완료/오류/취소 시 제거. **가짜 진행률 금지**(스트림엔 % 없음 — 리서치 "만들지 말 것"). 항목 2의 60초 하드 kill과 짝을 이루는 소프트 절반.

## 6. 오류 종류 확장 영향 범위 (항목 2 표면)

- Rust: `friendly_error_message`에 "timeout" arm 추가, 워치독이 `ErrorPayload{kind:"timeout"}` 발행.
- 프론트: `AiErrorKind` union에 `'timeout'` 추가(aiStore.ts:11), `useAiRelay`는 kind를 그대로 통과하므로 무변경. 카드 오류 렌더는 login 외 종류를 "다시 시도"로 이미 폴백하므로 timeout도 "다시 시도"에 귀속(별도 분기 불요). friendly 메시지: "응답이 너무 오래 걸려 중단했어요. 다시 시도해주세요."

## 7. 테스트 선례·게이트 기준선

- Rust 프롬프트 테스트: `prompt.rs` `#[cfg(test)] mod tests`(33개) — 스코핑·언어-유지 신규 단언, `build_continue_prompt_with_length` Short 지시 단언은 이 패턴에 추가.
- Rust 릴레이/오류: `claude_cli.rs`(19개) `decide_outcome`·`friendly_error_message` 패턴 — "timeout" 메시지·워치독 단일발행 로직은 순수 함수로 분리해 단위 테스트 가능(예: 선점 claim 헬퍼).
- 프론트: `aiSuggestionCardRender.test.ts`(카드 렌더), `aiRelay.test.ts`(릴레이), 고스트 관련 `aiHint`/`aiFreeContinue` 패턴, `uiStore.test.ts`(persist), `SettingsModal.test.tsx`(토글·policyMock).
- e2e(webkit): `ai-inline-edit.spec.ts`·`ai-free-continue.spec.ts`·`ai-toggle.spec.ts` 존재 → 재사용 패턴.
- **게이트 기준선**: vitest **962+**(main 현재). cargo는 SPEC-AI-005 시점 ~235였으나 **본 SPEC은 Rust(항목 1·2·4)를 수정하므로 cargo 테스트가 증가**한다 — 착수 시 `cargo test`로 기준선 재확정 후 신규 포함 전량 통과. `tsc --noEmit`·`cargo clippy` 클린. `npm run lint`는 **게이트 아님**(eslint config 부재, main 포함 상시 실패 — 회귀 오판 금지).

## 8. 리스크 & 암묵 계약

1. **프롬프트 하위호환 파손**: 스코핑·언어절을 COMMON/Continue base에 넣으면 이어쓰기 바이트 계약(prompt.rs:570-575, 586-591) 파손 → **인라인 조립 지점 한정 삽입**으로 회피(D1).
2. **워치독 오탐·이중발행**: 정상 완료 시 in_flight 죽은 child 잔류 구조 + 터미널 emit 4지점(릴레이·워치독·`ai_cancel` mod.rs:224·교체 mod.rs:156) → 단일발행 선점(`finished.swap`)에 **4지점 전부 참여**해야 오탐·이중발행 차단(D2, REQ-AI6-006, AC-AI6-002). 릴레이는 Silent(취소) EOF에서도 claim해 순차 취소→타임아웃 시나리오를 흡수.
3. **타임아웃 기본값 과소/과대**: 60초는 p99 상회로 정당 지연 보존 + 무한 행 차단. 상수로 노출해 조정 여지(D2).
4. **길이 옵션 시그니처 파손**: `build_continue_prompt` 3인자 유지 + `_with_length` 위임으로 기존 테스트 무개정(D3).
5. **대기 문구 타이머 누수**: 응답/취소/언마운트 시 타이머 clear 필수(항목 5). 가짜 진행률 금지.
6. **오류 union 확장 회귀**: `AiErrorKind`에 'timeout' 추가 시 exhaustive switch가 있으면 컴파일 강제 — 카드 폴백이 login 외를 이미 흡수하므로 런타임 무해.
7. **고스트 재요청 인자 staleness**: 재요청은 보관 인자 재사용(재파생 아님) — 문서가 이동해도 원 컨텍스트로 재생성(카드 의미론과 동일, 수용).

## 9. 미생성 유령 SPEC-AI-004 계승 관계

- `.moai/reports/plan-audit/SPEC-AI-004-review-1.md`(PASS 0.93)는 REQ-AI4-001~012로 프롬프트 핫픽스 4종(D-A 흡수/D-B 재복창/D-C 펜스/D-D 과잉생성)을 감사했으나 **`.moai/specs/SPEC-AI-004/` 디렉토리는 생성되지 않았다**.
- 그중 **D-C(다이어그램 펜스)·D-B(반복 금지)는 SPEC-AI-003 코드로 이미 반영**(prompt.rs:86-91 펜스 금지, L234-243 반복/선점 금지)됐고, **D-A(대상 스코핑 흡수)·언어 편향은 미해결**(리서치 "핫픽스 2탄 필요"). 본 SPEC 항목 1이 이 미해결분을 흡수·상위대체한다. spec.md Background에 명시.

---

## 10. 권장 구현 접근 스케치 (분석만, 코드 아님)

1. **항목 1**: `build_inline_prompt`에서 `system_prompt = feature.system_prompt() + INLINE_SCOPE`(대상 한정 + 입력 언어 유지). Polish 문자열 언어 중립화. 신규 단언 + 기존 무개정.
2. **항목 2**: 워치독 스레드 + 공유 `finished` 선점 헬퍼(순수 함수 단위 테스트) — 릴레이(Silent 포함)·워치독·`ai_cancel`·교체 4지점이 발행 전 claim. "timeout" 종류 Rust/프론트 각 1곳 추가. 기본 60초 상수.
3. **항목 3**: `GhostControlsWidget` done에 ↻ 버튼 + 마지막 트리거 인자 보관 모듈. 새 requestId로 재발행.
4. **항목 4**: `ContinueLength` + `build_continue_prompt_with_length`(기존 위임). `uiStore.aiContinueLength` + SettingsModal 토글 + IPC `length` + continue 발행부 2곳(ghost-text.ts:421/452)에 length 전달(섹션 채우기 L390 제외).
5. **항목 5**: 로딩 표면 대기 타이머(기본 8초) + 보조 문구, 응답/취소 시 clear.
6. **테스트**: §7 패턴. e2e는 기존 스펙 확장(인라인 스코핑·이어쓰기 길이·대기 문구 중 webkit 검증 가능 범위).
