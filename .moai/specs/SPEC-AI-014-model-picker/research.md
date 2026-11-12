# SPEC-AI-014 조사 근거

계획 단계(2026-11-13)에 직접 읽거나 실행해 확인한 사실만 적었다. 측정하지 않은 것은 "미측정"으로 표시했다.

## §1 환경

- 기준 커밋: `origin/main` `5c617ae`, 브랜치 `WT-model-picker`, worktree `.claude/worktrees/t6`.
- CLI 버전(이 기기): `codex --version` → `codex-cli 0.167.0`, `claude --version` → `2.1.322 (Claude Code)`.
- 참고: `codex_cli.rs` 머리 주석은 "codex-cli 0.144.1 검증"이라고 적고 있다. 지금 설치본은 0.167.0이다.

## §2 codex 모델 목록 세 가지

| 출처 | 명령·파일 | `visibility: list` 항목 | `gpt-5.5` |
|------|-----------|------------------------|-----------|
| 조회(계정 반영, 네트워크) | `codex debug models` | `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6.1-terra`, `gpt-6-sol`, `gpt-6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` (8개) | 없음 |
| 내장(오프라인) | `codex debug models --bundled` | 위 8개 + `gpt-5.5` (9개) | 있음 |
| 계정 캐시 | `~/.codex/models_cache.json` | 조회와 같은 8개 | 없음 |

- 숨김(`hide`) 항목: 조회 쪽 `gpt-6-chat-thinking`, `gpt-reserve`, `codex-auto-review`; 내장 쪽 `gpt-daybreak-blue-latest`, `gpt-daybreak-red-latest`, `codex-auto-review`.
- 소요 시간(`/usr/bin/time -p`, 이 기기, 1회): 조회 `real 0.57`, 내장 `real 0.03`. 종료 코드 0. 네트워크가 느리거나 끊긴 환경의 시간은 미측정.
- JSON 모양: 최상위 `{ "models": [ … ] }`, 항목마다 `slug`, `display_name`, `visibility`, `priority`, `default_reasoning_level`, `supported_reasoning_levels`, `context_window` 등. 조회 출력 크기 약 686 KB(대부분 모델별 지시문).
- 기본 추론 강도(`default_reasoning_level`)는 모델마다 `low` 또는 `medium`이다. 앱이 `-c model_reasoning_effort`를 빼면 이 값이 쓰인다(CLI 실제 동작은 M1에서 확인).
- 시사점: 앱이 박아 둔 `gpt-5.5`는 내장 목록에만 있고 계정 목록에는 없다. 실제 요청이 되는지는 미측정(M1 대상). 내장 목록을 그대로 보여 주면 계정에서 안 되는 모델이 섞일 수 있다.

## §3 바뀔 코드 위치 (기준 커밋 `5c617ae`)

### 백엔드 (`src-tauri/src/ai/`)

| 파일 | 위치 | 내용 |
|------|------|------|
| `provider.rs` | 13-35행 | `enum AiModel { Haiku, Sonnet }`, `as_arg`, `from_opt`(모르는 값 → Haiku) |
| `provider.rs` | 38-43행 | `AiRequest { model: AiModel, … }` |
| `provider.rs` | 48-62행 | `ProviderStatus.advanced_model_label` |
| `provider.rs` | 128-136행 | `first_available` — 요청마다 등록 도구 전부 `detect()` |
| `claude_cli.rs` | 82-99행 | `build_claude_args(model: AiModel, …)` — `--model` 항상 포함 |
| `claude_cli.rs` | 106-117행 | `claude_thinking_env`(haiku → `MAX_THINKING_TOKENS=0`), `claude_advanced_model_label` |
| `claude_cli.rs` | 194-208행 | `spawn_claude(args, cwd, model)` — 사고 예산 환경 변수 설정 |
| `claude_cli.rs` | 310-321행 | `ClaudeProvider::detect`(라벨 채움), `spawn` |
| `codex_cli.rs` | 41-82행 | `codex_model_arg`(둘 다 `gpt-5.5`), `codex_reasoning_effort`, `codex_effort_display`, `codex_advanced_model_label` |
| `codex_cli.rs` | 97-118행 | `build_codex_args(model, …)` — `--model`, `-c model_reasoning_effort=…` |
| `codex_cli.rs` | 293-307행 | `CodexProvider::detect`(라벨 채움), `spawn` |
| `mod.rs` | 84-110행 | `AiRequestArgs.model: Option<String>` |
| `mod.rs` | 169-170행 | `AiModel::from_opt(args.model.as_deref())` |
| `mod.rs` | 349-352행 | `ai_detect_providers` |
| `detect.rs` | 297, 419행 | `advanced_model_label: None` 두 곳 |
| `provider.rs` | 174, 206, 295, 310행 부근 | 테스트용 목 프로바이더의 `advanced_model_label` 필드 4곳 |

새 앱 명령을 만들면 `src-tauri/app_commands.rs` 머리 주석대로 세 곳(`lib.rs` 핸들러, `APP_COMMANDS`, `capabilities/main.json`)을 함께 고쳐야 한다. 이 SPEC은 새 명령을 만들지 않는다(design.md D-4).

### 프런트엔드 (`src/`)

| 파일 | 위치 | 내용 |
|------|------|------|
| `lib/tauri/ipc.ts` | 258-259행 | `type AiModel = 'haiku' \| 'sonnet'` |
| `lib/tauri/ipc.ts` | 266행 | `AiRequestArgs.model: AiModel` |
| `lib/tauri/ipc.ts` | 303-309행 | `AiProviderStatus.advancedModelLabel` |
| `store/uiStore.ts` | 66-67, 105, 146, 189행 | `aiAdvancedModel` 상태·기본값 `false`·설정 함수 |
| `store/uiStore.ts` | 204-249행 | 영속: `version: 2`, `partialize`, `merge`, `migrate`(0→1, 1→2) |
| `components/settings/SettingsModal.tsx` | 45-48행 | `resolveModel(advanced: boolean)` |
| `components/settings/SettingsModal.tsx` | 195행 | `<AdvancedModelToggle …>` |
| `components/settings/SettingsModal.tsx` | 268-347행 | `findEffectiveAdvancedProvider`, `deriveAdvancedModelLabel`, `AdvancedModelToggle` |
| `components/settings/SettingsModal.tsx` | 424-486행 | `ProviderRow` |
| `components/editor/extensions/ai-selection-toolbar.ts` | 30-38, 77, 168-178, 777, 857-864행 | `AiToolbarUiState.advancedModel`, `BuildSelectionRequestInput.model`, `resolveModel(uiState)`(@MX:WARN 이름 충돌), `fire()`, 상태 조립 |
| `components/editor/extensions/markdown-extensions.ts` | 139-144행 | `advancedModel: useUIStore.getState().aiAdvancedModel === true` |
| `components/editor/extensions/ai-ghost-text.ts` | 21, 569, 603, 641행 | `SettingsModal`의 `resolveModel` import·사용 3곳 |
| `components/editor/extensions/ai-ghost-text.ts` | 509, 578, 616, 655행; 919-924행 | `aiRequest(...).catch` → `failRequest`만 부름; 상태 구독은 `error`에서 고스트만 지운다(거부 메시지가 화면에 안 나옴, 감사 1차 D1) |
| `components/editor/extensions/ai-suggestion-card.ts` | 218-225, 247, 293, 406, 426, 508-513, 698, 1136, 1153, 1255, 1397, 1425-1438행 | `onReRequest(instruction, model, kind)`, `model ?? 'haiku'`, ⚡ 버튼(`'sonnet'`), 카드 모델 |
| `styles/mdedit-components.css` | 497, 507, 511행 | `.mdedit-ai-advanced` 규칙(목록 폴백 버튼과 묶임) |
| `store/aiPolicy.ts` | 3-4행 | `resolveModel` 순환 import를 근거로 든 주석 |

- invoke 거부는 세 경로 모두 `useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) })`를 부른다(`ai-selection-toolbar.ts:882`, `ai-suggestion-card.ts:1365`, `ai-ghost-text.ts:509·578·616·655`). 카드는 자기 `requestId`의 오류만 구독해 표시한다(`ai-suggestion-card.ts:1470` 부근). 고스트 경로는 표시하지 않는다(위 표). `uiStore.setStatusMessage`는 상태 표시줄(`Footer.tsx`)에 2초 동안 메시지를 띄운다(`uiStore.ts:175-187`).
- 카드 재요청은 `fireReRequest`가 `{ ...originalArgs, ...overrides, requestId, providerId }`로 합친다(`ai-suggestion-card.ts:1361`).

### 테스트

- 모델 토글을 참조하는 vitest 파일: `src/test/` 아래 `SettingsModal.test.tsx`, `aiSuggestionCard.test.ts`, `aiCardRetryLimit.test.ts`, `aiCardRerequestProgress.test.ts`, `aiSelectionToolbar.test.ts`, `aiGhostConfirm.test.ts`, `aiFreeContinue.test.ts`, `aiHint.test.ts`, `aiToggle.test.ts` (grep 결과 9개). 저장소 테스트: `uiStore.test.ts`, `uiStoreRenderMode.test.ts`.
- e2e: `e2e/spec-img-load-001.spec.ts`(35·125행), `spec-img-load-002.spec.ts`, `spec-img-mode-003.spec.ts`, `spec-img-widget-002.spec.ts`(41행), `unsaved-changes-guard.spec.ts`가 버전 1 저장 상태에 `aiAdvancedModel: false`를 넣는다(5개 파일 6곳). 이전 규칙이 처리하므로 바꾸지 않는다.
- Rust 테스트는 CI에서 돌지 않는다. 로컬 명령: `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml <필터>`.

## §4 관찰만 하는 것 (범위 밖)

- 자동 모드(`providerId` 없음)에서는 요청마다 `first_available()`이 등록 도구 전부에 `detect()`를 부르고, 각 `detect()`가 CLI `--version`을 실행한다(`provider.rs:128-136`, `detect.rs` `detect_claude`·`detect_codex`). 이 SPEC은 고치지 않는다. 다만 목록 조회를 `detect()`에 넣지 않는 근거다(design.md D-4).

## §M1 실제 요청 시험 기록 양식

아래는 양식이다. run 단계 첫 마일스톤에서 구현자가 **progress.md §E.2 "M1 실측"**에 채운다(spec.md REQ-AI14-016, design.md D-2). 이 파일은 고치지 않는다.

| 도구 | 모델 | 종료 코드 | `OK` 포함 | 오류 요약 | 소요(초) |
|------|------|-----------|-----------|-----------|----------|
| (run M1에서 기록) | | | | | |

```
codex-list-verdict: <CATALOG|FIXED-ONLY>
claude-aliases: <통과한 별칭>
codex-fixed-list: <성공한 slug>
codex-default: <CLI 기본값|slug>
haiku-thinking: <0 설정 중앙값> vs <미설정 중앙값>
```
