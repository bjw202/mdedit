# SPEC-AI-003 "M2 자유 위치 이어쓰기(시나리오 E)" 리서치 보고서

## 0. 핵심 발견 요약 (가장 중요)

**"이어쓰기"는 이미 부분 구현되어 있다 — 단, "문서 끝(document-end)" 분기만.** SPEC-AI-001 구현 중 Gap 2로 다음이 이미 존재한다:

- `getContinueContext()` — `src/components/editor/extensions/ai-ghost-text.ts:80-92` (단, `after.trim() !== ''`이면 null → **커서 뒤에 내용이 있으면 자격 없음**, 88행)
- `startContinueWritingCommand` — ai-ghost-text.ts:323-346 (`feature:'section-fill'` + `presetKind:'continue'` IPC 계약)
- `AiFeature::Continue` enum variant — `src-tauri/src/ai/prompt.rs:36`, resolve 매핑 prompt.rs:67
- `build_continue_prompt()` — prompt.rs:199-215 (**[문서 개요] + [직전 본문]만 있고 [뒤 문맥]이 없다**)
- 문체 상속 시스템 프롬프트 — prompt.rs:99-101
- 힌트 라벨 '이어쓰기' — ai-ghost-text.ts:387-390

따라서 SPEC-AI-003의 실제 델타는 **(1) 자격 판정을 임의 위치로 확장, (2) 프롬프트에 [뒤 문맥](truncate_head) 추가 + "뒤 문맥을 반복/선점하지 말 것" 지시, (3) 힌트 스팸 억제 정책, (4) 리스트/표/코드블록 내부 안전장치**다. 스트리밍·고스트·확정·취소 인프라는 전부 재사용된다.

**중복 SPEC 없음**: `.moai/specs/`에는 SPEC-AI-001, SPEC-AI-002만 AI 관련이며, SPEC-AI-001 spec.md의 Exclusions에 "M2 자유 위치 이어쓰기(시나리오 E)는 범위 밖"으로 명시(spec.md:260). SPEC-AI-002는 순수 시각 피드백(글로우/스켈레톤/플레이스홀더)으로 이어쓰기와 무관.

---

## 1. 아키텍처 분석

### 1.1 설계서 원본 의도 (`.moai/design/ai-features-mvp-design.md`)

- **§5.1 시나리오 E** (253-285행): 문서 끝 3초 유휴 → 힌트 버튼(토큰 0) → 클릭/Mod+Enter → 회색 고스트 스트리밍 → [✓ 넣기 Mod+Enter]/[✕ 지우기 Esc]/[■ 중지]. **Tab은 확정 키가 아님**(283행, 들여쓰기 습관으로 인한 문서 파손 시뮬레이션 근거).
- **문체 상속** (285행): "커서 앞 본문 꼬리에서 어조·종결어미를 그대로 따를 것" 지시 포함.
- **§5.2** (300-311행): 힌트 = 순수 로컬 판정(토큰 0), 요청은 버튼/Mod+Enter에서만. 커서급 자동 트리거는 구조적 불가(요청당 첫 응답 2.3초 + 입력 12~18K 고정 오버헤드).
- **§7 토큰 상한** (397행): 이어쓰기 = "헤딩 아웃라인 전체 + 커서 앞 본문 꼬리 1.5K자", 교체 대상 없음(삽입만).
- **§10** (503행): M2 = 자유 위치 이어쓰기, "M0 스트리밍 재활용"이 승격 근거. §12 킬 크라이테리아(538행): ✨ 리텐션 급감 시 "M2 조기 투입"이 대응책 — 본 SPEC의 존재 이유.
- 주의: 설계서 v0.4의 시나리오 E는 "문서 끝" 기준으로 서술되어 있고 [뒤 문맥]은 명시하지 않는다. **뒤 문맥 포함(truncate_head) + "뒤 문맥 반복/선점 금지" 지시는 SPEC-AI-003에서 새로 확정해야 할 프롬프트 설계**다(§5.1 "문서 끝 판정" 310행을 임의 위치로 일반화).

### 1.2 SPEC-AI-001 인프라 (전부 재사용 가능)

| 인프라 | 위치 | 상태 |
|---|---|---|
| CLI 스폰·격리(빈 스크래치 cwd, `--setting-sources ""`, `MAX_THINKING_TOKENS=0`) | `src-tauri/src/ai/claude_cli.rs` | 완성 |
| 스트리밍 릴레이 `ai://chunk\|done\|error` | claude_cli.rs `relay_process`, mod.rs:186-193 | 완성 |
| stream-json 파싱 + stderr 분류(순수 함수) | `src-tauri/src/ai/stream.rs:40-126` | 완성 |
| 동시 1개 in-flight 교체 + 취소 통보 | mod.rs:146-166, `ai_cancel` mod.rs:210-234 | 완성 |
| 고스트 텍스트 StateField + 위젯 + 컨트롤 버튼 | ai-ghost-text.ts:117-256 | 완성 |
| Mod-Enter 삼중 커맨드(확정→섹션채우기→이어쓰기) | ai-ghost-text.ts:351-352 | 완성 |
| 3초 유휴 힌트 ViewPlugin | ai-ghost-text.ts:431-500 | 완성(자격 판정만 확장 필요) |
| aiStore(요청 상태·스트림 버퍼, 비영속) | `src/store/aiStore.ts` | 완성 |
| useAiRelay(이벤트→store, stale-event 가드) | `src/hooks/useAiRelay.ts:36-86` | 완성 |
| 제안 카드(1,065줄, 인라인 편집 전용) | ai-suggestion-card.ts | 이어쓰기는 카드가 아닌 고스트를 사용 — 직접 관여 없음 |
| SPEC-AI-002 대기 시각물(플레이스홀더 "✨ 작성 중…", 글로우) | ai-ghost-text.ts:145-191 | 고스트 경로라 그대로 상속됨 |

SPEC-AI-001 handoff.md의 핵심 계약(41행): IPC camelCase, feature `'inline-edit'|'section-fill'|'diagram'` + presetKind, `ai://chunk|done(truncated?)|error(kind, cancelledBy?)`. 실기기 버그 3건 교훈: block widget은 반드시 StateField로 공급(handoff.md:16), invoke는 `{ args }` 래핑 필수(handoff.md:17, ipc.ts:225-231, mod.rs:363-384 회귀 가드 테스트).

### 1.3 SPEC-AI-002가 추가한 것

시각 피드백 레이어만: 카드 글로우+스켈레톤(ai-suggestion-card.ts:276-299, `buildCardKey` 538-550), 고스트 빈 텍스트 구간 `GhostPlaceholderWidget`(ai-ghost-text.ts:178-191), ✨ 버튼 펄스(ai-selection-toolbar.ts:428-434). 계약: `text===''` 동안 `confirmGhostCommand`가 확정 거부(ai-ghost-text.ts:267 `if (!ghost || !ghost.text) return false`) — 플레이스홀더 삽입 불가 불변식(REQ-AI2-011). **M2 고스트도 이 시각물을 자동 상속한다.**

### 1.4 IPC·Rust 요청 경로

- `aiRequest(args)` → `invoke('ai_request', { args })` (ipc.ts:229-231). `AiRequestArgs` 필드: `requestId, feature, presetKind?, model, selection?, contextBefore?, contextAfter?, outline?, customInstruction?` (ipc.ts:195-205 ↔ mod.rs:74-94 serde camelCase).
- `ai_request` 흐름(mod.rs:100-206): 정책 → `AiFeature::resolve` → 프롬프트 조립 분기(mod.rs:122-127: `FillSection`→`build_section_prompt`, `Continue`→`build_continue_prompt(outline, before)`, 그 외→`build_inline_prompt`) → in-flight 교체 → 스폰 → 릴레이.
- **모드 enum 존재**: `AiFeature`(prompt.rs:20-37)가 요청 종류 enum이며 `Continue` variant가 이미 있다. M2에서 `contextAfter`를 continue 분기에 전달하도록 mod.rs:125와 `build_continue_prompt` 시그니처만 확장하면 된다(예: `build_continue_prompt(outline, before, after)`).
- **프롬프트 헬퍼**: `truncate_tail_at_paragraph`(prompt.rs:135-146, 앞 문맥용 — 뒤쪽 유지) / `truncate_head_at_paragraph`(prompt.rs:119-129, 뒤 문맥용 — 앞쪽 유지). `build_inline_prompt`(prompt.rs:149-176)가 정확히 [앞 문맥]/[대상]/[뒤 문맥] 패턴의 레퍼런스. `truncated` 플래그가 `ai://done`으로 프론트에 전달되어 P7 절단 고지에 쓰인다(mod.rs:128, aiStore.ts:29).

---

## 2. 재사용할 기존 패턴 / 레퍼런스 구현

1. **트리거→고스트→요청 패턴**: `startContinueWritingCommand`(ai-ghost-text.ts:323-346)가 M2의 뼈대 그 자체 — requestId 생성(`cw-` prefix), `startRequest`, `startGhostEffect` + `scrollIntoView`(BUG-8), `aiRequest({feature:'section-fill', presetKind:'continue', outline, contextBefore})`, invoke 거부 시 `failRequest(ipcErrorMessage)`. M2는 자격 판정과 `contextAfter` 추가만 바꾼다.
2. **스트림→고스트 미러링**: `ghostStoreBridge`(ai-ghost-text.ts:514-558) — `useAiStore.subscribe`로 `feature==='section-fill'`의 streamBuffer/requestState를 `setGhostTextEffect`/`setGhostStatusEffect`로 반영, done 전환 시 1회 스크롤. **feature 필터가 'section-fill' 문자열 하드코딩**(524행)이므로 M2가 feature 값을 바꾸면 이 필터도 함께 바꿔야 한다(안 바꾸면 고스트가 영원히 빈 채로 남음 — 암묵 계약).
3. **컨텍스트 추출 프론트 관례**: 인라인 편집은 `extractParagraphContext`(ai-selection-toolbar.ts:134-146)로 문단 경계 추출 후 절단은 Rust에 위임. 섹션 채우기/이어쓰기는 `view.state.sliceDoc(0, head)` 원문 전체를 넘기고 1.5K 절단은 Rust(ai-ghost-text.ts:305-313 주석 "백엔드 계약"). M2도 `sliceDoc(0, head)` + `sliceDoc(head)` 통째 전달 + Rust 절단이 정합.
4. **프리셋/기능 해석 tolerant 매핑**: `AiFeature::resolve`(prompt.rs:51-70) — presetKind 우선, 미지 키는 Err.
5. **e2e 목**: `e2e/fixtures/tauri-v2-ai-mock.ts` — `__TAURI_INTERNALS__` 충실 목, `{ args }` 래핑 검증(74-79행), 시나리오 `success|login-error|network-error|invoke-reject|hang|diagram-fenced-then-valid`(10-18행), `window.__AI_MOCK__.requests`로 페이로드 계약 단언. `hang`이 플레이스홀더/취소 테스트에 최적.

---

## 3. 세 가지 난제에 대해 기존 코드가 제공하는 것

### 3.1 힌트 스팸 UX (임의 위치 = 항상 자격)

현재 힌트 파이프라인: `AiHintPluginValue`(ai-ghost-text.ts:431-500) — 3초 타이머(`HINT_IDLE_DELAY_MS=3000`, 384행), `docChanged || selectionSet || ghostChanged`마다 hide+재무장(486-489행), 자격은 `evaluateHintEligibility`(377-381행: section-fill 우선 → continue → null). 현재는 자격 조건이 희소(빈 헤딩 아래/문서 끝의 빈 줄)해서 스팸이 없다.

**M2에서 자격이 "거의 모든 위치"가 되면 3초 멈출 때마다 힌트 알약이 뜨는 스팸이 구조적으로 발생.** 기존 코드가 주는 레버:
- `evaluateHintEligibility`가 순수 함수로 분리되어 있어 자격 정책(예: "줄 끝 + 비어있지 않은 줄에서만", "문장 미종결일 때만", "타이핑 직후 N초 내 제외")을 순수 로직으로 좁혀 vitest로 매트릭스 테스트 가능(aiContinueContext.test.ts:23-84, aiGhostConfirm.test.ts:55-95의 자격 매트릭스 패턴 그대로).
- 힌트 없이도 진입 경로가 유지됨: `modEnterCommand`(351-352행) 체인에 자유 위치 커맨드를 추가하면 **Mod+Enter는 어디서나 동작하되 힌트는 보수적으로만 표시**하는 분리 설계가 가능 — 설계서 P4(진입점 최소)·REQ-AI-032(수동 호출)와 정합. 단 현 Mod-Enter 체인은 "자격 없으면 false"로 폴스루하므로, 자유 위치가 항상 자격이면 체인 마지막이 항상 소비함 → 기존 Mod-Enter 기본 동작(있다면)과의 충돌 검토 필요.
- 힌트 위젯은 커서 위치 인라인 위젯(461-467행)이라, 대안 UX(상태바/거터 표시)는 선례가 없음 — 신규라면 비용 큼.

### 3.2 리스트/표/코드블록 내부 삽입 안전

**기존 코드에 구문 인지(syntax-aware) 위치 로직은 전무하다.** 전수 검색 결과:
- `@codemirror/lang-markdown ^6.5.0` + `@codemirror/language ^6.12.1` 설치됨(package.json:21-27), `markdown({ base: markdownLanguage })`가 에디터에 로드됨(markdown-extensions.ts:90-93) → **`syntaxTree(state)` / `syntaxTree(state).resolveInner(pos)`로 lezer 마크다운 노드(`FencedCode`, `CodeBlock`, `Table`, `ListItem`, `Blockquote`) 질의가 추가 의존성 0으로 가능**하다. 이것이 M2의 신규성 중 가장 큰 부분.
- 현존하는 마크다운 구조 판정은 전부 정규식/문자열: `HEADING_RE`(ai-ghost-text.ts:25), `buildOutline`(28-33행), 문단 경계 `\n\n`(prompt.rs, ai-suggestion-card.ts:436), 문장 종결 부호(ai-suggestion-card.ts:435). lezer 사용 시 아웃라인 추출(`buildOutline`)도 장기적으로 트리 기반으로 통일할 여지가 있으나 M2 범위는 아님.
- 참고: 프리뷰 쪽 `mermaidPlugin.ts`/`renderer.ts`는 markdown-it 기반이라 에디터 위치 판정에 못 쓴다.
- 정책 선택지(SPEC에서 확정 필요): (a) 코드펜스/표 내부는 힌트·트리거 자체를 비활성(자격 판정에서 배제 — `evaluateHintEligibility`에 syntaxTree 게이트 추가), (b) 허용하되 프롬프트에 구조 정보를 실음. 무손상 원칙(REQ-AI-033) 관점에서 (a)가 보수적이며 기존 "자격 없으면 false" 커맨드 계약과 자연 정합.

### 3.3 고스트 앵커 보정 (스트리밍 중 문서 변경)

**실제 메커니즘: 앵커를 매핑하지 않는다. 문서가 바뀌면 고스트를 파괴한다.**
- `aiGhostField.update`(ai-ghost-text.ts:117-140): 고스트 effect가 실린 트랜잭션이면 값 갱신, **effect 없이 `tr.docChanged`이면 `null` 반환**(138행 `if (next && tr.docChanged) return null`) — `from`을 `tr.changes.mapPos()`로 매핑하는 코드가 없다. 확정 삽입은 `clearGhostEffect`를 changes와 같은 트랜잭션에 실어 이 파괴 경로를 우회한다(115-116행 @MX:NOTE, confirmGhostCommand 266-276행).
- 스트리밍 청크는 effect-only 트랜잭션(`setGhostTextEffect`, ghostStoreBridge 529-539행)이라 docChanged가 아니므로 앵커가 흔들릴 일이 없다. 즉 "스트리밍 중 사용자 편집 → 고스트 즉시 소멸(사용자 입력 우선, REQ-AI-030/031)"이 앵커 보정의 대체 전략이다. 단 **소멸 시 in-flight 요청은 취소하지 않는다** — 취소는 `dismissGhostCommand`(279-289행)만 수행하므로, 타이핑 소멸 후 스트림이 백그라운드에서 계속 도는 누수성 동작이 있다(ghostStoreBridge가 ghost가 없으면 무시, 526행 `if (ghost)`). M2 SPEC에서 "타이핑 소멸 시 요청도 취소할지 + P7 통보"를 결정해야 할 암묵 이슈.
- 대조: 제안 카드는 파괴 대신 클램프+재검증 전략 — `buildCardDecorations`가 범위를 `docLen`으로 클램프(ai-suggestion-card.ts:595-601), `applySuggestion`이 dispatch 직전 원문 스냅샷 재검증으로 stale 판정(498-515행, @MX:ANCHOR 487-491행). M2가 "삽입만"인 고스트를 쓰는 한 파괴 전략으로 충분하며, 진짜 mapPos 매핑을 도입할 필요는 현재 계약상 없다.
- 뷰포트 보정: 시작 시 1회 + done 전환 시 1회만 `scrollIntoView`(BUG-8, ai-ghost-text.ts:301-303, 533-537; 테스트 aiGhostConfirm.test.ts:256-292).

---

## 4. 리스크 & 암묵 계약

1. **`ghostStoreBridge`의 feature 필터 하드코딩**(ai-ghost-text.ts:524 `s.feature !== 'section-fill'`): M2가 새 feature 문자열(예: 'continue')을 도입하면 브리지·aiStore `AiFeature` 유니온(aiStore.ts:14)·ipc.ts를 동시 수정해야 함. 기존 구현이 `feature:'section-fill'+presetKind:'continue'` 하위호환 경로를 택한 이유(ai-ghost-text.ts:320-322 주석)이므로, **M2도 같은 경로 유지가 최소 변경**.
2. **`AiFeature::resolve`의 키 충돌 잠재**: presetKind가 feature보다 우선(prompt.rs:57)이므로 새 presetKind 문자열은 기존 프리셋 키와 절대 겹치면 안 됨.
3. **동시 1개 원칙**: 새 이어쓰기 요청이 검토 중 제안 카드를 죽이면 안 됨(§3, REQ-AI-008) — `startSuggestionCard`는 streaming 카드만 `cancelByNew()`(ai-suggestion-card.ts:991-994). 고스트와 카드가 공존하는 시나리오(카드 검토 중 다른 위치에서 이어쓰기)의 상호작용은 미검증 영역.
4. **`getContinueContext`의 문서 끝 제약 완화 시 기존 테스트 파괴**: aiContinueContext.test.ts:47-53이 "문서 중간 빈 줄은 null"을 명시 단언 — M2는 이 테스트의 의도적 개정(또는 신규 판정 함수 병행)이 필요. 기존 문서-끝 동작의 하위호환을 어떻게 다룰지 SPEC에 명시해야 함.
5. **stale-event 가드**: useAiRelay는 `requestId === store.requestId`만 통과(useAiRelay.ts:36-38) — 새 requestId prefix(`cw-`)는 자유지만 시작 시 `startRequest` 선행이 필수 순서.
6. **`truncated` 고지**: 이어쓰기 tail 절단 시 `ai://done{truncated}`가 오지만 **고스트 UI에는 절단 고지 렌더가 없다**(카드만 있음, ai-suggestion-card.ts:404-410) — P7 관점 기존 갭, M2에서 [뒤 문맥]까지 절단되면 더 커짐.
7. **프롬프트 출력 계약**: `COMMON_INSTRUCTION`(prompt.rs:15-16) "결과 텍스트만" — 이어쓰기 응답이 앞 문맥을 반복하거나 뒤 문맥을 선점하는 품질 문제는 프롬프트 지시("끊긴 문장 완성, 뒤 문맥에 자연 연결, 반복·선점 금지")로만 제어 가능하며 프론트 후처리 선례 없음(diagram의 `stripMermaidFence`류 후처리 선례는 있음, ai-suggestion-card.ts:871-874).
8. **알려진 게이트 제약**: `npm run lint` 상시 실패(eslint config 부재) — 게이트는 `tsc --noEmit`+`vitest run`+`cargo test`+`cargo clippy`+Playwright(webkit) (handoff.md:38-39). 기준선: vitest 913 / cargo 221.

---

## 5. 테스트 자산 & 신규 테스트가 따를 패턴

- **vitest**: `src/test/aiContinueContext.test.ts`(자격 매트릭스 + "aiRequest 미호출 = 토큰 0" 단언), `aiHint.test.ts`(fake timer로 3초 유휴/리셋/클릭 트리거), `aiGhostConfirm.test.ts`(headless `EditorState` + `history()`+`aiGhostField`만 넣은 최소 EditorView, 확정 단일 트랜잭션→undo 1회 복원, Tab 비확정, 플레이스홀더 계약, BUG-8 스크롤 1회). M2 신규: 자유 위치 자격 매트릭스(리스트/표/코드펜스 내부 배제 케이스 — syntaxTree가 필요하므로 `markdown()` 확장을 테스트 state에 추가해야 함), contextAfter 전달 계약.
- **Rust**: prompt.rs `#[cfg(test)]`(217-524행)의 순수 함수 테스트 — `build_continue_prompt`의 [뒤 문맥] 조립·truncate_head 절단·빈 섹션 생략·"반복 금지" 지시 포함 단언을 같은 스타일로 추가. mod.rs:336-350의 IPC 역직렬화 계약 테스트 패턴(`request_args_deserialize_continue_preset_kind`)에 contextAfter 케이스 추가.
- **Playwright**: `e2e/ai-inline-edit.spec.ts` 여정 패턴(선택→클릭→카드→적용, `__AI_MOCK__.requests` 페이로드 계약 검증, 콘솔 에러 0 가드) + `tauri-v2-ai-mock.ts` `hang` 시나리오. M2용은 "문서 중간 클릭 → Mod+Enter → 고스트 스트리밍 → 넣기 → 뒤 문맥 보존" 여정.

---

## 6. 권장 구현 접근 스케치 (분석만, 코드 아님)

1. **판정 계층 (프론트, 순수)**: `getContinueContext`를 일반화하거나 `getFreeContinueContext(state, pos)` 신설 — 반환에 `contextBefore`/`contextAfter` 포함. `@codemirror/language`의 `syntaxTree(state).resolveInner(pos, -1)`로 `FencedCode`/`Table`(+정책에 따라 ListItem) 내부를 배제하는 게이트를 순수 함수로 추가. 기존 우선순위 유지: section-fill > (document-end) continue > free-position continue.
2. **힌트 정책**: `evaluateHintEligibility`에 free-position은 **보수적 조건**(예: 비어있지 않은 줄의 줄 끝 + 문장 미종결)에서만 힌트를 노출하고, Mod+Enter 트리거는 더 넓게 허용하는 2단 자격을 SPEC 요구사항으로 명문화 — 커서급 자동 트리거 금지(REQ-AI-032)와 P4 원칙 준수.
3. **IPC/Rust**: 기존 하위호환 경로 유지 — `feature:'section-fill'` + `presetKind:'continue'` + `contextAfter` 신규 전달. mod.rs:125 분기에서 `build_continue_prompt(outline, before, after)`로 확장, `after`는 `truncate_head_at_paragraph`(신규 상한 상수, 예: CONTINUE_HEAD_MAX) 적용, 시스템 프롬프트에 "끊긴 문장 완성·뒤 문맥 자연 연결·뒤 문맥 반복/선점 금지" 추가(`AiFeature::Continue.system_prompt()` 개정 또는 뒤 문맥 존재 시 조건부 문구).
4. **고스트/스트리밍**: 변경 불필요 — 기존 파괴형 앵커 계약과 SPEC-AI-002 시각물을 그대로 상속. 단 "타이핑 소멸 시 in-flight 취소 여부 + P7 통보"를 요구사항으로 확정할 것.
5. **테스트**: §5 패턴 준수. syntaxTree 게이트는 `markdown()` 포함 state로 vitest 매트릭스, Rust는 prompt 조립 순수 테스트, e2e는 mock success/hang으로 중간 위치 여정.
