# SPEC-AI-014 수용 기준

판정 규칙: 각 항목 뒤에 PASS 조건을 적었다. 명령은 저장소 루트(run worktree)에서 실행한다. Rust 테스트는 `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml`로 로컬에서 실행한다(CI는 `cargo test`를 돌리지 않는다). 테스트 이름은 예시이며, 같은 내용을 단언하면 이름은 달라도 된다.

- `<base>`는 run 시작 시점의 `$(git merge-base origin/main HEAD)`다.
- "판정 조건부" 표시가 있는 AC는 M1 판정(`codex-list-verdict`)에 따라 적용 범위가 갈린다. 해당 줄에 두 경우를 모두 적었다.

## 추적표

| REQ | AC |
|-----|----|
| REQ-AI14-001 | AC-001, AC-002 |
| REQ-AI14-002 | AC-003, AC-004 |
| REQ-AI14-003 | AC-005 |
| REQ-AI14-004 | AC-006 |
| REQ-AI14-005 | AC-006 |
| REQ-AI14-006 | AC-007 |
| REQ-AI14-007 | AC-008, AC-021, AC-019 |
| REQ-AI14-008 | AC-009, AC-019 |
| REQ-AI14-009 | AC-010 |
| REQ-AI14-010 | AC-011 |
| REQ-AI14-011 | AC-010 |
| REQ-AI14-012 | AC-012 |
| REQ-AI14-013 | AC-013, AC-014 |
| REQ-AI14-014 | AC-015, AC-016 |
| REQ-AI14-015 | AC-016 |
| REQ-AI14-016 | AC-017 |
| REQ-AI14-017 | AC-018 |
| REQ-AI14-018 | AC-020, AC-019 |

## 제거

- **AC-001 (설정에 토글 없음)**: vitest — 설정 모달 AI 섹션을 렌더하면 `queryByRole('checkbox', { name: /고급 모델/ })`와 `queryByText(/고급 모델/)`가 모두 `null`이다. 그리고 `uiStore` 상태에 `aiAdvancedModel` 키가 없다(`'aiAdvancedModel' in useUIStore.getState()`가 거짓). PASS: 둘 다 성립.
- **AC-002 (카드 단발 버튼 없음)**: vitest — retry-exhausted 상태 카드에 `.mdedit-ai-advanced` 요소와 텍스트 `고급 모델`이 없고, 안내 문구("방향을 알려주시면 더 정확해요 (위 입력칸)")와 방향 지시 입력칸은 있다. 그리고 `git grep -n "mdedit-ai-advanced" -- src` 출력이 비어 있다(종료 코드 1). PASS: 둘 다 성립.

## 중복 제거

- **AC-003 (프런트엔드 모델 문자열 한 곳)**: `git grep -nE "[\"'\`](haiku|sonnet|opus|fable)[\"'\`]" -- src ':!src/test'`(작은따옴표·큰따옴표·백틱 모두)의 모든 결과가 `src/store/uiStore.ts`에 있다. 그리고 `git grep -n "resolveModel" -- src` 출력이 비어 있다. PASS: 둘 다 성립.
- **AC-004 (백엔드 enum·매핑 삭제)**: `git grep -nE "AiModel|from_opt|codex_model_arg|codex_reasoning_effort|codex_effort_display|advanced_model_label|claude_thinking_env" -- src-tauri/src` 출력이 비어 있다. PASS: 종료 코드 1.

## 선택과 저장

- **AC-005 (드롭다운)**: vitest — 감지 결과를 claude `models: [{id:'haiku',label:'Haiku'},{id:'opus',label:'Opus'}]`, codex `models: [{id:'m-a',label:'M A'}]`(둘 다 설치·로그인)로 주입하면:
  - `getByRole('combobox', { name: 'Claude 모델' })`과 `getByRole('combobox', { name: 'Codex 모델' })`이 있다.
  - claude 선택지 텍스트가 정확히 `['CLI 기본값','Haiku','Opus']`, codex는 `['CLI 기본값','M A']`다.
  - AI 섹션 안에 모델 입력용 `textbox`가 없다.
  - claude에서 `Opus`를 고르면 `useUIStore.getState().aiModels.claude === 'opus'`, `CLI 기본값`을 고르면 `null`이다.
  - 정책 잠금 상태, codex 미설치, codex 설치·미로그인 세 경우 각각 해당 드롭다운이 `disabled`다.
  PASS: 다섯 단언 모두 성립.
- **AC-006 (기본값과 이전)**: vitest(`uiStore.test.ts`) —
  - 새 저장소의 `aiModels`는 `{ claude: 'haiku', codex: null }`.
  - 버전 1 저장 상태 `{ aiAdvancedModel: true, fontSize: 16 }`을 이전하면 `aiModels`가 `{ claude: 'sonnet', codex: null }`, `aiAdvancedModel` 키가 없고, `fontSize`는 16이다.
  - 버전 1 `{ aiAdvancedModel: false }` → `{ claude: 'haiku', codex: null }`.
  - 버전 2 `{}`(필드 없음) → `{ claude: 'haiku', codex: null }`.
  - 버전 3 `{ aiModels: { claude: 42, codex: 'm-a' } }`를 합치면(merge) `{ claude: 'haiku', codex: 'm-a' }`.
  - 영속 `version`이 3이다.
  PASS: 여섯 단언 모두 성립.
- **AC-007 (목록 밖 저장값 표시)**: vitest — 저장소 `aiModels.codex = 'gone-model'`, 감지 목록에 그 값이 없을 때 codex 드롭다운의 선택된 선택지 텍스트가 `gone-model (목록에 없음)`이고, 렌더 뒤에도 저장소 값이 `'gone-model'` 그대로다. PASS: 둘 다 성립.

## 요청과 검증

- **AC-008 (요청 인자)**: vitest — 저장소 `aiModels = { claude: 'opus', codex: 'm-a' }`일 때 `aiRequest` 모의 함수가 받은 인자에서:
  - ✨ 툴바 프리셋 1회, 고스트 텍스트 이어쓰기 1회, 자유 위치 이어쓰기 1회 모두 `args.models`가 `{ claude: 'opus', codex: 'm-a' }`이고 `'model' in args`가 거짓이다.
  PASS: 세 진입점 모두 성립.
- **AC-009 (모르는 모델 거부)**: `cargo test models::` —
  - `validate("claude", Some("opus"))` → `Ok(Some("opus"))`(`opus`가 M1 통과 별칭일 때. 아니면 통과한 다른 별칭으로 단언).
  - `validate("claude", Some("gpt-x"))` → `Err(msg)`이고 `msg`에 `gpt-x`와 `Claude`, `설정`이 들어 있다.
  - `validate("codex", Some("-c"))` → `Err`.
  - `validate("codex", None)`, `validate("claude", None)` → `Ok(None)`.
  - `mod.rs` 테스트: 허용 목록에 없는 모델이 담긴 `AiRequestArgs`로 검증 단계 함수를 부르면 `Err`이고 스폰 함수가 호출되지 않는다(검증 단계를 스폰 앞의 순수 함수로 분리해 단언한다).
  PASS: 모두 성립.
- **AC-010 (인자 모양과 격리 플래그)**: `cargo test claude_cli:: codex_cli::` —
  - `build_claude_args(None, …)`에 `--model`이 없고, `build_claude_args(Some("opus"), …)`에는 `--model` 바로 뒤에 `opus`가 한 번 있다.
  - `build_codex_args(None, …)`에 `--model`이 없고, `Some("m-a")`이면 `--model` 뒤에 `m-a`가 있다.
  - 두 경우 모두 REQ-AI14-011의 격리 플래그가 전부 있다(기존 격리 테스트 유지).
  PASS: 모두 성립.
- **AC-011 (추론 설정 없음)**: `git grep -nE "MAX_THINKING_TOKENS|model_reasoning_effort" -- src-tauri/src` 출력이 비어 있다(종료 코드 1). 그리고 `cargo test`의 codex 인자 테스트가 `args.iter().all(|a| a != "-c")`(원소가 정확히 `-c`인 것이 없음, 대문자 `-C` 스크래치 플래그는 해당 없음)를 단언한다. PASS: 둘 다 성립.

## 목록 출처

- **AC-012 (claude 고정 목록)**: `cargo test models::` — `list_for("claude")`의 `id` 목록이 `progress.md` §E.2 "M1 실측"의 `claude-aliases` 줄과 같은 순서·같은 원소이고, `label`은 첫 글자 대문자다(예: `opus` → `Opus`). PASS: 성립.
- **AC-013 (codex 목록 해석, 판정 조건부)**: `cargo test models::` —
  - `CATALOG`이면: fixture `src-tauri/tests/fixtures/codex-models-sample.json`을 `parse_codex_catalog`에 넣으면 `hide` 항목이 빠지고 `priority` 오름차순이며 `label`이 `display_name`이다. `"{}"`, `"not json"`, `{"models":[]}`는 `None`이다.
  - `FIXED-ONLY`이면: `list_for("codex")`가 고정 목록과 같고, `git grep -n '"debug"' -- src-tauri/src` 출력이 비어 있다(조회 코드 없음).
  PASS: 판정에 해당하는 줄이 성립.
- **AC-014 (조회 실패 시 고정 목록, 판정 조건부: `CATALOG`일 때만)**: `cargo test models::` — 시간 한도를 인자로 받는 조회 함수에 (a) 시간 한도(테스트값 100ms)보다 오래 걸리는 실행기, (b) 실패를 돌려주는 실행기, (c) 해석 불가 출력을 넣으면 세 경우 모두 결과가 고정 목록이고, (a)는 한도의 3배 안에 돌아온다. `FIXED-ONLY`이면 이 AC는 N/A로 기록한다. PASS: 성립 또는 N/A 기록.
- **AC-015 (캐시, 판정 조건부: `CATALOG`일 때만)**: `cargo test models::` — 호출 횟수를 세는 실행기로:
  - 성공 뒤 `list_for`·`allowed`를 여러 번 불러도 실행기 호출이 1회다.
  - 실패 뒤 요청 검증 경로를 두 번 부르면 실행기 호출이 1회이고, 새로 고침 경로(`ai_detect_providers`가 쓰는 함수)를 부르면 1회 더 호출된다.
  - 캐시가 빈 상태에서 요청 검증 경로를 다음 입력으로 부르면 실행기 호출이 0회다: (a) 도구 claude, (b) codex + `None`, (c) codex + 고정 목록에 있는 모델. 고정 목록에 없는 codex 모델이면 1회다.
  `FIXED-ONLY`이면 N/A로 기록한다. PASS: 성립 또는 N/A 기록.
- **AC-016 (감지 결과에 목록)**: `cargo test` —
  - `ProviderStatus` 직렬화 JSON에 `advancedModelLabel` 키가 없고, 목록이 있으면 `models: [{ "id": …, "label": … }]`이 있다.
  - 트레이트 `ClaudeProvider::detect()`·`CodexProvider::detect()` 결과의 `models`가 비어 있다(조회하지 않음).
  - 감지 결과에 목록을 붙이는 순수 함수에 `[claude 상태, codex 상태]`와 가짜 목록 함수를 넣으면, 각 상태의 `models`가 그 도구 id로 받은 목록과 같다.
  - `src-tauri/src/ai/mod.rs`에 `pub async fn ai_detect_providers`가 있다(`git grep -n "pub async fn ai_detect_providers" -- src-tauri/src` 결과 1줄).
  PASS: 모두 성립.

## 실측

- **AC-017 (M1 기록)**: `progress.md` §E.2 "M1 실측"에 후보 모델 전부(claude 별칭 4개와 `--model` 없음, codex 후보 전부와 `--model` 없음)의 행이 있고, 판정 줄 다섯 개(`codex-list-verdict`, `claude-aliases`, `codex-fixed-list`, `codex-default`, `haiku-thinking`)가 값으로 채워져 있다. 판정이 기본 설계와 다르면 spec.md HISTORY에 manager-spec의 개정 행이 있다. 순서 확인: `A=$(git log --reverse --format=%H <base>..HEAD -- .moai/specs/SPEC-AI-014-model-picker/progress.md | head -1)`, `B=$(git log --reverse --format=%H <base>..HEAD -- src-tauri/src src | head -1)`일 때 `A`와 `B`가 비어 있지 않고 서로 다르며 `git merge-base --is-ancestor $A $B`의 종료 코드가 0이다. PASS: 모두 성립.

## 재요청

- **AC-018 (재요청이 선택을 이어받음)**: vitest — `models: { claude: 'opus', codex: null }`로 시작한 카드에서 ↻ 방향 지시, ↻ 다시, 오류 상태의 다시 시도, intruded 상태의 다시 요청을 각각 누르면, 재요청마다 `aiRequest` 인자의 `models`가 `{ claude: 'opus', codex: null }`이다. 카드가 열린 뒤 저장소를 `{ claude: 'haiku', codex: null }`로 바꿔도 같다. 고스트 텍스트도 같은 조건에서 ↻ 재시도하면 `models`가 원래 값이다. PASS: 다섯 경로 모두 성립.

## 오류 표시와 라우팅

- **AC-020 (고스트 경로 거부 표시)**: vitest — `aiRequest` 모의 함수가 문자열 `Claude에서 x 모델을 쓸 수 없어요`로 거부하게 하고 고스트 이어쓰기 1회, 자유 위치 이어쓰기 1회, 고스트 ↻ 재시도 1회를 시작하면, 매번 `useUIStore.getState().statusMessage`가 그 거부 메시지와 같고 `useAiStore`의 `failRequest`도 불린다. PASS: 세 경로 모두 성립.
- **AC-021 (라우팅된 도구의 선택 사용)**: `cargo test` —
  - `ModelSelection { claude: Some("opus"), codex: Some("m-a") }`에서 `for_provider("claude") == Some("opus")`, `for_provider("codex") == Some("m-a")`, 모르는 도구 id는 `None`.
  - `models` 키가 없는 `ai_request` IPC JSON을 `AiRequestArgs`로 역직렬화하면 성공하고 두 항목이 모두 `None`이다.
  - 검증 단계 함수에 같은 선택과 도구 id `codex`를 넣으면 결과가 codex 항목(`m-a`가 허용 목록에 있을 때 `Ok(Some("m-a"))`)이고, `claude`를 넣으면 claude 항목이다.
  PASS: 모두 성립.

## 종합

- **AC-019 (실기기, macOS 개발 빌드)**: 다음을 사람이 확인하고 `progress.md`에 결과를 적는다.
  1. 설정에서 claude 모델을 `opus`(또는 통과한 다른 비기본 별칭)로 고르고 ✨ 툴바 요청을 보내면 카드에 결과가 나온다.
  2. codex를 선택하고 목록의 모델 하나로 요청하면 결과가 나온다(codex가 설치·로그인된 경우).
  3. 개발자 도구로 `localStorage`의 `mdedit-ui-store`에서 `aiModels.claude`를 `no-such-model`로 바꾸고 다시 불러온 뒤, (a) ✨ 툴바 요청을 보내면 카드에 `no-such-model`과 설정 안내가 담긴 오류가 나오고, (b) 고스트 이어쓰기를 시작하면 상태 표시줄에 같은 메시지가 나온다. 두 경우 모두 요청 직후 `ps -ax | grep -c '[c]laude -p'`가 0이다(CLI가 실행되지 않음).
  4. 이전 버전 앱에서 "고급 모델 사용"을 켠 상태로 쓰던 저장 상태가 새 빌드에서 claude `Sonnet`으로 표시된다.
  PASS: 네 항목 확인 기록. codex 미설치면 2는 "미확인(사유)"로 적는다.
- **품질 게이트**: `npm run typecheck`, `npm run lint`, `npm test`, `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml`, `npm run test:e2e`가 모두 종료 코드 0. 기준 커밋에서 이미 실패하던 테스트가 있으면 run 시작 때 기준 결과를 기록하고 새 실패만 판정한다.

## 완료 정의 (DoD)

- AC-001~AC-018, AC-020, AC-021 자동 항목 PASS(판정 조건부 N/A 기록 포함), AC-019 수동 기록, 품질 게이트 통과.
- `progress.md` §E.2에 각 AC의 명령과 출력 경로를 적는다.
