# SPEC-AI-014 설계 결정

사용자가 잠든 동안 자율 진행 권한을 받아(코디네이터 브리프, 2026-11-13) 열려 있던 선택을 아래처럼 정했다. 바뀔 가능성이 큰 결정부터 적었다. 각 결정에는 고른 안, 이유, 버린 안을 함께 적었다.

## D-1. 요청 계약: 두 도구의 선택을 함께 보낸다

- **결정**: `ai_request` 인자의 `model: 'haiku'|'sonnet'`을 `models: { claude: string | null; codex: string | null }`로 바꾼다. 백엔드는 라우팅이 끝난 뒤 그 도구의 항목을 꺼낸다. Rust 쪽은 `#[serde(default)]` 구조체 `ModelSelection { claude: Option<String>, codex: Option<String> }`와 `fn for_provider(&self, id: &str) -> Option<&str>`이다.
- **이유**: 자동 모드에서는 어느 도구가 쓰일지 백엔드가 요청 시점에 정한다(`ProviderRegistry::route(None)` → `first_available`). 프런트엔드가 미리 도구를 맞히려면 감지 결과를 따로 캐시하고 백엔드 판정과 똑같이 흉내 내야 한다. 둘 다 보내면 그 중복이 없다.
- **버린 안**: (a) `model: string` 하나만 보내기 — 자동 모드에서 어느 도구 모델인지 알 수 없다. (b) 도구별 맵(`HashMap<String, Option<String>>`) — 확장성은 있지만 도구가 둘뿐이고, 구조체가 검증과 테스트를 단순하게 한다.
- **호환성**: 앱 안의 프런트엔드와 백엔드가 함께 배포되므로 옛 `model` 필드를 받을 외부 호출자가 없다. Rust 구조체는 모르는 필드를 무시하므로 혹시 옛 필드가 와도 오류가 나지 않는다.

## D-2. 실제 요청 시험(M1) 절차와 판정 규칙

- **후보**:
  - claude: `haiku`, `sonnet`, `opus`, `fable`, 그리고 `--model` 없음.
  - codex: `codex debug models`(조회)와 `codex debug models --bundled`(내장)의 `visibility == "list"` 항목 합집합(계획 시점 9개, research.md §2), 그리고 `--model` 없음.
- **요청 모양**: 앱이 실제로 보내는 인자와 같게 하되, 모델 인자만 바꾸고 추론 강도 인자는 뺀다(이 SPEC의 최종 모양). 빈 임시 디렉터리를 cwd로 쓰고 stdin을 막는다. 프롬프트는 "Reply with exactly: OK" 한 줄이다. SPEC-AI-013 병합 뒤라면 그 SPEC의 프롬프트 전달 방식(표준 입력)을 그대로 쓴다.
- **기록**: 모델마다 종료 코드, 결과에 `OK`가 들어 있는지, 오류 메시지 앞 200자, 소요 시간. 실패한 모델은 한 번 더 시도해 일시 오류를 거른다(두 번 다 실패해야 실패).
- **haiku 사고 예산 비교**: 고스트 텍스트와 같은 크기의 프롬프트로 `MAX_THINKING_TOKENS=0` 설정과 미설정을 각각 3회 보내 첫 출력까지 시간과 전체 시간의 중앙값을 적는다.
- **판정 규칙**:
  - R1 (claude): 성공한 별칭만 고정 목록에 넣는다. `haiku`가 실패하면 기본값을 잃으므로 멈추고 코디네이터에게 묻는다.
  - R2 (codex `CATALOG`): 조회 목록의 모든 모델이 성공하면 `codex-list-verdict: CATALOG`. 런타임에 조회하고, 고정 목록은 성공한 모델(조회 목록 ∩ 성공)이다.
  - R3 (codex `FIXED-ONLY`): 조회 목록에 실패한 모델이 하나라도 있거나 이 기기에서 조회 자체가 실패하면 `FIXED-ONLY`. 조회 목록을 믿을 수 없으므로 런타임 조회를 하지 않고, 고정 목록은 성공한 모델 전체다.
  - R4 (codex 기본값): `--model` 없는 요청이 실패하면 codex 기본값을 "CLI 기본값"에서 고정 목록 첫 모델로 바꾸고 spec.md를 개정한다.
  - 내장 목록에만 있는 모델(계획 시점 `gpt-5.5`)의 결과는 참고로만 적는다. 내장 목록은 쓰지 않는다.
- **"고정 목록만으로 충분한가"의 답**: R3이면 "충분하다(조회는 오히려 틀린 목록을 줄 수 있다)", R2이면 "조회 목록이 정확하므로 조회를 쓰고 고정 목록은 대비용이다". 어느 쪽이든 모델 이름이 앱 코드 한 곳(`models.rs`)에만 남는다.
- **비용**: 요청 약 22회(claude 5 + codex 10 + haiku 비교 6 + 재시도). 사용자가 받아들인 비용이다.

## D-3. 기본값: claude `haiku`, codex "CLI 기본값"

- **결정**: 저장소 초기값은 `{ claude: 'haiku', codex: null }`.
- **이유**: claude는 지금 기본 동작(빠르고 싼 haiku)을 바꾸지 않는다. codex는 앱이 박아 둔 `gpt-5.5`가 계정 목록에서 이미 빠졌다. CLI 기본 모델은 codex가 계정에 맞춰 정하므로 목록이 바뀌어도 깨지지 않는다.
- **버린 안**: (a) claude도 CLI 기본값 — Claude Code의 기본 모델이 haiku가 아닐 수 있어(계정·버전에 따라 다르며 계획 단계에서 재지 않았다) 고스트 텍스트가 느려지거나 비용이 늘 수 있다. M1이 `--model` 없는 claude 요청의 결과를 기록한다. (b) codex 기본값을 목록 첫 모델로 — 목록 순서(priority)가 바뀌면 사용자 모르게 기본 모델이 바뀐다.
- **"CLI 기본값" 선택지를 claude에도 두는 이유**: 두 드롭다운의 모양과 코드 경로가 같아진다. 별도 분기를 두는 것보다 단순하다.

## D-4. 목록 전달 경로: `ai_detect_providers`에 싣는다

- **결정**: `ProviderStatus`에 `models: Vec<ModelOption { id, label }>`를 더하고(`#[serde(skip_serializing_if = "Vec::is_empty")]`), `advanced_model_label`을 지운다. 트레이트 `detect()`는 빈 목록을 돌려주고, 명령 `ai_detect_providers`가 `models::list_for(id)`로 채운다.
- **이유**: 설정은 열릴 때 이미 `ai_detect_providers`를 부른다. 새 명령을 만들면 SPEC-SEC-001의 앱 ACL 세 곳(`lib.rs` 핸들러, `app_commands.rs`, `capabilities/main.json`)을 함께 고쳐야 하고 왕복이 하나 늘어난다. `detect()`에서 채우지 않는 이유는 자동 모드가 요청마다 `detect()`를 부르기 때문이다.
- **버린 안**: 새 명령 `ai_list_models` — 위 이유로 버렸다.

## D-5. 추론 강도: 앱은 어떤 추론 설정도 넘기지 않는다

- **결정**: codex `-c model_reasoning_effort=…`를 지우고, claude `MAX_THINKING_TOKENS`도 모든 모델에서 지운다(haiku 포함).
- **이유**: 사용자 결정은 "CLI 기본값, 별도 선택 없음"이다. 모델을 자유롭게 고르게 되면 "haiku만 사고 예산 0" 같은 모델별 예외는 근거가 없다(opus나 fable에는 왜 없는가). 예외를 남기면 앱이 다시 모델 지식을 갖게 된다. 이 SPEC이 없애려는 것이 바로 그것이다.
- **영향**: haiku가 사고를 하게 되면 고스트 텍스트 첫 응답이 늦어질 수 있다. M1이 차이를 재서 기록한다(D-2). 수치가 크면 코디네이터가 사용자에게 알린다(spec.md §7 Q1). 되돌리는 결정은 이 SPEC 밖이다.
- **버린 안**: haiku 예외 유지 — 위 이유로 버렸다.

## D-6. 검증 위치와 허용 목록

- **결정**: 새 모듈 `src-tauri/src/ai/models.rs`가 고정 목록 상수, codex 조회·해석·캐시, `allowed(provider_id) -> Vec<String>`, `validate(provider_id, Option<&str>) -> Result<Option<String>, String>`을 가진다. `ai_request`는 라우팅 직후, CLI 실행 전에 `validate`를 부른다. 실패하면 `Err(message)`를 돌려준다(기존 invoke 거부 경로로 카드에 표시된다: `ai-selection-toolbar.ts:882`, `ai-suggestion-card.ts:1365`, `ai-ghost-text.ts` 4곳의 `.catch`).
- **허용 목록**: claude는 고정 목록. codex는 캐시된 조회 목록 ∪ 고정 목록(`FIXED-ONLY`이면 고정 목록). `None`은 항상 허용.
- **이유**: 조용한 대체(`AiModel::from_opt`)를 없애려면 거부가 필요하다. 목록 소속 검사는 셸 인자 주입(`-`로 시작하는 값 등)도 함께 막는다. 모델 값은 `Command::args`의 별도 원소이고 셸을 거치지 않는다.

## D-7. codex 조회 실행 방식

- **결정**: `crate::ai::detect::codex_binary()`가 돌려준 절대 경로로 `debug models`를 실행한다(`no_window`, stdin null, stdout piped, stderr null). 별도 스레드가 `wait_with_output`을 하고 호출 쪽은 채널 `recv_timeout(3초)`로 기다린다. 시간이 넘으면 자식 프로세스를 `kill`하고 고정 목록을 쓴다. 해석 함수 `parse_codex_catalog(&str) -> Option<Vec<ModelOption>>`는 순수 함수로 두고 M1에서 캡처한 실제 출력을 fixture로 테스트한다.
- **캐시**: `static CODEX_MODELS: Mutex<Option<(Vec<ModelOption>, Source)>>`. 조회 성공은 프로세스가 끝날 때까지 유지한다. 실패 결과(고정 목록)도 저장해 `ai_request` 검증에 재사용하고, `ai_detect_providers`는 저장된 결과가 실패 결과이면 다시 조회한다. 테스트를 위해 조회 함수는 실행기(클로저)와 시간 한도를 인자로 받는 내부 함수와, 실제 실행기를 넣는 얇은 공개 함수로 나눈다.
- **이유**: 표준 라이브러리만으로 시간 한도를 걸 수 있다(새 의존성 없음). 3초는 이 기기 측정값 0.57초의 약 5배다.

## D-8. 프런트엔드 구조

- **저장소**: `uiStore`에 `aiModels: AiModelSelection`과 `setAiModel(provider: 'claude'|'codex', model: string | null)`을 두고 `aiAdvancedModel`·`setAiAdvancedModel`을 지운다. 영속 버전을 2→3으로 올리고 `migrate`에 REQ-AI14-005 규칙을, `merge`에 모양 정규화를 더한다.
- **읽기 함수 하나**: `uiStore.ts`에 `export function currentAiModels(): AiModelSelection`(= `useUIStore.getState().aiModels`)을 둔다. 고스트 텍스트·툴바·카드가 모두 이 함수만 쓴다. `aiPolicy.ts`의 순환 import 주석은 근거가 사라지므로 고친다.
- **툴바**: `AiToolbarUiState.advancedModel`을 `models`로 바꾸고, `fire()`는 그 값을 그대로 싣는다. `resolveModel` 두 개를 지운다.
- **카드**: `RenderCardInput.model`, `SuggestionCardModel.model`, `CardCallbacks.onReRequest`의 `model` 인자를 지운다. 모든 재요청은 원래 `request.args`를 이어받으므로(`fireReRequest`가 `{ ...originalArgs, ...overrides }`로 합친다) 모델을 따로 실을 필요가 없다. "⚡ 고급 모델로 다시 시도" 버튼과 CSS 규칙 `.mdedit-ai-advanced`를 지운다.
- **설정**: `ProviderRow` 아래(또는 안)에 `<select aria-label="{표시명} 모델">`을 둔다. 첫 선택지 "CLI 기본값"(value `""` → `null`), 그다음 `provider.models`. 저장값이 목록에 없으면 "`<id>` (목록에 없음)" 선택지를 더한다. `AdvancedModelToggle`과 `deriveAdvancedModelLabel`을 지운다.
- **e2e 고정 상태**: `e2e/*.spec.ts` 4개 파일은 버전 1 저장 상태에 `aiAdvancedModel: false`를 넣는다. 이전 규칙이 처리하므로 손대지 않는다.
