# SPEC-AI-014 구현 계획

결정이 바뀔 가능성이 큰 것부터 적었다. 설계 결정의 근거는 design.md, 코드 위치와 측정 사실은 research.md다.

## A. 사전 확인 사항 (plan 단계에서 확인한 사실)

- 기준: `origin/main` `5c617ae`. run은 SPEC-AI-012(t4)와 SPEC-AI-013(t5)이 `main`에 병합된 뒤 그 `main`에서 새 worktree를 만들어 시작한다(§E).
- codex 조회 목록에는 `gpt-5.5`가 없고 내장 목록에는 있다. 조회는 이 기기에서 0.57초(research.md §2).
- 새 앱 명령을 만들지 않으므로 SPEC-SEC-001 앱 ACL(`app_commands.rs`, `capabilities/main.json`)은 바뀌지 않는다(design.md D-4).
- invoke 거부는 이미 카드 오류로 표시된다. 검증 오류에 새 UI 경로가 필요 없다(research.md §3).
- e2e 저장 상태 fixture 4개는 버전 1의 `aiAdvancedModel`을 담고 있어 이전 규칙의 실제 입력이 된다. 손대지 않는다.

## B. 접근 방식

1. **실측 먼저(M1)**: 실행 코드를 바꾸기 전에 후보 모델마다 작은 요청을 보내 목록과 기본값을 확정한다(design.md D-2). 결과가 기본 설계와 다르면 M2 전에 spec.md를 개정하고 plan-auditor를 다시 돌린다.
2. **백엔드가 목록과 검증의 단일 출처**: `src-tauri/src/ai/models.rs`(새 파일)가 고정 목록, codex 조회·해석·캐시, 허용 목록, 검증을 모두 가진다. 어댑터는 `Option<&str>` 모델을 받아 인자만 만든다.
3. **요청 계약 교체**: `models: { claude, codex }`(design.md D-1).
4. **프런트엔드는 선택과 저장만**: 목록은 감지 결과에서 받고, 선택은 `uiStore.aiModels` 하나에 둔다. 읽기 함수는 `currentAiModels()` 하나다.
5. **TDD**: 각 마일스톤은 실패하는 테스트를 먼저 쓴다. Rust는 순수 함수(인자 조립, 목록 해석, 검증, 캐시)를, 프런트엔드는 저장소 이전, 설정 렌더, 요청 인자를 테스트한다.

## C. 마일스톤 (순서)

### M1 — 실제 요청 시험 (실행 코드 변경 없음)

- 산출물: 시험 스크립트(커밋하지 않음, scratchpad), 결과를 `research.md` §M1 표와 판정 줄에 기록, 조회 출력 원본에서 테스트 fixture로 쓸 축약본 `src-tauri/tests/fixtures/codex-models-sample.json`(모델 3개 + `hide` 1개, 지시문 필드는 짧게 줄임).
- 판정 규칙: design.md D-2 R1~R4.
- 멈춤 조건: claude `haiku` 실패(R1) → 코디네이터에게 묻는다. 판정이 기본 설계와 다르면 spec.md 개정(HISTORY 행) 후 plan-auditor 재감사를 거쳐 M2로 간다.
- 결과 보고: haiku 사고 예산 비교 수치를 코디네이터 보고에 적는다(spec.md §7 Q1).

### M2 — 백엔드: 모델 모듈과 검증

- `models.rs`(새 파일): `ModelOption`, `ModelSelection`(serde), 고정 목록 상수(M1 결과), `parse_codex_catalog`, 시간 한도 조회(`query_with(runner, timeout)` + 실제 실행기), 캐시, `list_for`, `allowed`, `validate`.
- `provider.rs`: `AiModel` 삭제, `AiRequest.model: Option<String>`, `ProviderStatus.models` 추가·`advanced_model_label` 삭제.
- `claude_cli.rs`: `build_claude_args(model: Option<&str>, …)` — `None`이면 `--model` 없음. `claude_thinking_env`, `claude_advanced_model_label` 삭제. `spawn_claude`에서 모델 인자·환경 변수 제거.
- `codex_cli.rs`: `build_codex_args(model: Option<&str>, …)` — `-c model_reasoning_effort` 제거, `None`이면 `--model` 없음. 매핑 함수 4개 삭제.
- `mod.rs`: `AiRequestArgs.models: ModelSelection`(`model` 삭제), 라우팅 직후 `models::validate` 호출, 실패 시 `Err`. `ai_detect_providers`가 `models::list_for`로 `models`를 채움. `pub mod models;`.
- `detect.rs`: `advanced_model_label: None` 두 곳을 `models: Vec::new()`로.
- 기존 Rust 테스트 중 삭제 함수에 묶인 것은 새 계약 테스트로 바꾼다(스냅샷 테스트는 `--model` 유무 두 경우로).
- 검증: `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml ai::` 와 `cargo build`.

### M3 — 프런트엔드: 계약과 저장소

- `ipc.ts`: `AiModel` 삭제, `AiModelSelection` 추가, `AiRequestArgs.models`, `AiProviderStatus.models?: { id: string; label: string }[]`, `advancedModelLabel` 삭제.
- `uiStore.ts`: `aiModels`·`setAiModel`, `currentAiModels()`, 버전 3, `migrate`·`merge` 규칙(REQ-AI14-005).
- 테스트: `uiStore.test.ts`에 이전 4경우(v1 advanced true, v1 false, v2 필드 없음, 모양 틀림)와 기본값.

### M4 — 프런트엔드: 사용처

- `ai-ghost-text.ts`: `resolveModel` import 제거, 3곳을 `models: currentAiModels()`로.
- `ai-selection-toolbar.ts`: `resolveModel` 삭제, `AiToolbarUiState.models`, `fire()`가 그 값을 실음. `markdown-extensions.ts` 상태 조립도 같게.
- `ai-suggestion-card.ts`: 모델 필드·인자 삭제, ⚡ 버튼 삭제. `mdedit-components.css`에서 `.mdedit-ai-advanced` 선택자만 지움(목록 폴백 버튼 규칙은 유지).
- `SettingsModal.tsx`: `resolveModel`, `AdvancedModelToggle`, `deriveAdvancedModelLabel`, `findEffectiveAdvancedProvider` 삭제, 도구별 `<select>` 추가(design.md D-8).
- `aiPolicy.ts`: 근거가 사라진 순환 import 주석 수정.
- 테스트: research.md §3의 vitest 9개 파일을 새 계약으로 고치고 AC 테스트를 더한다.

### M5 — 검증

- 자동: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml`, acceptance.md의 grep AC.
- 수동(macOS 실기기, 개발 빌드): AC-019.

## D. 범위 밖으로 남긴 결정

- haiku 사고 예산을 되돌릴지: 이 SPEC은 제거한다(design.md D-5). 되돌리려면 별도 결정이 필요하다.
- 자동 모드의 요청당 `--version` 실행: 범위 밖(spec.md §6).

## E. 선행 SPEC과 겹치는 함수 (병합 순서: t4 → t5 → t6)

| 파일 | 이 SPEC이 고치는 곳 | 겹치는 선행 SPEC | 그 SPEC이 고칠 것으로 예상되는 곳(백로그 카드 기준) |
|------|------------------|----------------|------------------------------------------|
| `src-tauri/src/ai/claude_cli.rs` | `build_claude_args`, `claude_thinking_env`(삭제), `claude_advanced_model_label`(삭제), `spawn_claude`, `ClaudeProvider::detect`/`spawn`, 관련 테스트 | SPEC-AI-013 (t5) | 프롬프트를 인자 대신 표준 입력으로 전달 — `build_claude_args`, `spawn_claude`(stdin), `ClaudeProvider::spawn` |
| `src-tauri/src/ai/codex_cli.rs` | `codex_model_arg`·`codex_reasoning_effort`·`codex_effort_display`·`codex_advanced_model_label`(삭제), `build_codex_args`, `CodexProvider::detect`/`spawn`, 관련 테스트 | SPEC-AI-013 (t5) | `combine_prompts`, `build_codex_args`(마지막 인자), `build_codex_command`(stdin), `spawn_codex`, `CodexProvider::spawn` |
| `src-tauri/src/ai/mod.rs` | `AiRequestArgs`(`model`→`models`), `ai_request` 4단계(모델 결정) 직후 검증, `ai_detect_providers` | SPEC-AI-013 (t5) | 응답 대기 한도(60초)를 입력 크기에 따라 조정 — `ai_request` 안 워치독 부분 |
| `src/components/editor/extensions/ai-suggestion-card.ts` | `CardCallbacks.onReRequest` 시그니처, `RenderCardInput.model`, `renderDoneControls`, error/intruded 재시도 핸들러, retry-exhausted 분기(⚡ 버튼), `SuggestionCardModel.model`, 컨트롤러의 자동 재시도 2곳, `startSuggestionCard`의 `onReRequest` 배선 | SPEC-AI-012 (t4) | ↻ 재요청 때 원래 지시와 프리셋 추가 지시가 사라지는 버그 — `onReRequest`·`fireReRequest` 배선, `renderDoneControls` |
| `src/components/editor/extensions/ai-selection-toolbar.ts` | `resolveModel`(삭제), `AiToolbarUiState`, `fire()`의 모델 줄, `createAiSelectionToolbar` 상태 조립 | SPEC-AI-015 (t7, 병행 가능) | 직접 입력 칸 textarea 교체·메뉴 폭 — 다른 함수지만 같은 파일 |
| `src/styles/mdedit-components.css` | `.mdedit-ai-advanced` 선택자 | SPEC-AI-015 (t7) | 직접 입력 칸 스타일 — 다른 규칙 |

- `prompt.rs`(t4 범위)는 이 SPEC이 건드리지 않는다.
- t5가 `AiRequest`나 어댑터 시그니처를 바꾸면, run 시작 시 이 표의 함수 이름을 다시 확인하고 바뀐 시그니처 위에 모델 인자만 바꾼다. 시그니처 차이는 SPEC 개정 사유가 아니다(요구사항은 관찰 가능한 동작이므로).

## F. 범위·규모와 run 방식

- 실행 코드 14개 파일(백엔드 6: `models.rs` 새 파일 포함, 프런트엔드 8), 테스트 약 10개 파일, 테스트 fixture 1개. 추정 600~900줄.
- 마일스톤이 앞 단계 결과에 의존(M1 판정 → M2 상수, M2 계약 → M3·M4)하므로 차례로 진행한다. 한 번에 쓰기 에이전트 하나만 돈다.
- run worktree 안에서 하위 에이전트를 `isolation: "worktree"`로 띄우지 않는다(중첩 worktree 문제, 메모리 기록).

## G. 위험 관리 요약

| 위험 | 대응 |
|------|------|
| 조회 목록에 계정에서 안 되는 모델이 섞임 | M1 판정 R3이면 조회를 쓰지 않는다. 런타임에는 검증 오류가 카드에 드러난다 |
| codex 조회가 느리거나 멈춤 | 3초 한도 + 자식 종료 + 고정 목록. 요청당 많아야 1회(REQ-AI14-014) |
| haiku 사고 예산 제거로 고스트 텍스트가 느려짐 | M1 수치 기록·보고. 사용자 결정을 따른다 |
| 저장 상태 이전 실패로 설정 손실 | 이전은 `aiAdvancedModel`만 다루고 나머지는 그대로 둔다. 4경우 테스트 |
| 선행 SPEC과의 병합 충돌 | §E 표대로 t4·t5 병합 뒤 그 `main`에서 시작 |
| `codex debug models` 출력 형식 변경 | 해석 실패 → 고정 목록(목록이 줄 뿐 오동작 없음) |
