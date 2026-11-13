---
id: SPEC-AI-016
title: "AI 웹 리서치 동작 — 구현 계획"
version: "0.2.1"
status: implemented
created: 2026-11-13
updated: 2026-11-13
---

# SPEC-AI-016 구현 계획

## 등급과 방법론

- 등급: **Tier M** — 기존 운영 파일 12개(Rust 6, TS 6) + 새 순수 모듈 1개(TS) + 픽스처(캡처 8개 + 기준 프롬프트 2개), 예상 500~800줄(테스트 포함). 산출물 3종(spec·plan·acceptance) + progress.md.
- 방법론: TDD(RED → GREEN → REFACTOR). 파서·인자·판정은 모두 순수 함수로 두고 실측 캡처로 먼저 실패하는 테스트를 쓴다.
- 실행 형태: 순차 서브에이전트 1개(코딩 위주, 파일 간 의존이 있음). 하위 에이전트를 `isolation: "worktree"` 로 띄우지 않는다.

## 구현 원칙

1. 웹 허용 판단은 백엔드 한 곳(`AiFeature::allows_web()` → `AiRequest`)에서만 한다(D2).
2. 리서치가 아닌 경로는 바이트까지 그대로 둔다 — claude 인자, 모든 프롬프트(범위 절 동사 포함), 릴레이 동작. codex 인자만 강화 플래그가 늘어난다(REQ-AI16-014).
3. 새 IPC 는 `ai://research` 이벤트 하나뿐이다. `ai://done` payload·`aiStore` 는 바꾸지 않는다(출처 검증은 카드가 마지막 활동 목록으로 한다, A1).
4. 외부 CLI 스트림 파서는 `spike/` 실측 캡처로만 테스트한다. 실패 모양도 실측 캡처(R12·R13)를 쓴다.

## Milestones (우선순위 순서)

### M1 — 픽스처 복사와 실측 재확인 (Priority: High)
- `spike/*.jsonl` 8개를 `src-tauri/tests/fixtures/` 로 **복사**한다(이름 그대로). `spike/` 는 SPEC 증거로 남긴다. `spike/research-system.txt`·`research-user.txt` 도 복사해 AC-AI16-003 의 바이트 비교 기준으로 쓴다.
- M2 가 끝난 뒤 최종 인자로 AC-AI16-014 를 실행한다(codex 세 프롬프트 + 대조 1회). 결과를 progress.md 에 남긴다.

### M2 — 백엔드 기능·프롬프트·인자 (Priority: High)
- `prompt.rs`:
  - `AiFeature::Research`, `resolve` 의 `"research"`, `task_text` 에 spec.md 「정본 문구」의 작업 문장(상수), `allows_web()`.
  - 리서치 전용 범위 절 함수를 새로 두고(첫 문장 동사만 `조사 대상으로 삼아라`, 나머지 문장은 기존과 같음) 리서치 조립에서만 쓴다. 기존 `scope_clause(&tags)` 는 시그니처·출력을 그대로 둔다 — 이를 직접 부르는 기존 테스트(`prompt.rs:1108`)를 고치지 않기 위해서다.
  - `allows_markdown_fence()` 는 리서치에서 거짓(현행 기본).
- `provider.rs`: `AiRequest` 에 웹 허용 필드(이름은 구현 시 정하되 프런트 인자에서 오지 않을 것).
- `mod.rs`: 리서치면 `build_inline_prompt_ex(&feature, selection, "", "", None, additional, request_id)`; 웹 허용 = `feature.allows_web()`; 워치독 `if 웹 허용 { 180 } else { watchdog_timeout_secs(n) }`(리서치 상수 이름을 두고 TS 상수와 짝 테스트); 릴레이에 리서치 여부 전달.
- `claude_cli.rs`: `build_claude_args(model, path, 웹 허용)` — D3. `@MX:ANCHOR`(:87) 문구를 "기본 `--tools \"\"`, 리서치만 WebSearch·WebFetch 를 이름으로 나열하고 허용 목록에도 넣는다"로 고친다.
- `codex_cli.rs`: `build_codex_args(model, scratch, 웹 허용)` — D4. `-c` 쌍 네 개는 `read-only` 뒤, `--model` 앞에 둔다(`--json` 은 계속 마지막). 문서 주석의 원소 수(옛 값 11/13)를 17/19 로 고치고, `@MX:ANCHOR` 이유 줄에 R2·R3 근거를 한 줄 추가한다. 기존 테스트 2개를 AC-AI16-006 대로 고친다.
- 테스트: AC-AI16-002·003·005·006, 기존 프롬프트 스냅샷 테스트 무수정 통과 확인.

### M3 — 스트림 처리 (Priority: High)
- `stream.rs` 에 순수 파서와 누적기:
  - claude: `assistant` 줄 `message.content` 의 `tool_use` 중 `name == "WebSearch"` 를 검색 1회로, `user` 줄의 `tool_use_result` 가 객체이고 `url` 과 2xx `code` 를 가지면 그 `url` 을 열어 본 주소로.
  - codex: `item.completed` + `item.type == "web_search"` 에서 `action.type == "search"` → 검색 1회, `"open_page"` 이고 `results` 에 `url` 이 `action.url` 과 정규화 후 같은 항목이 있으면 `action.url` 을 열어 본 주소로.
  - 누적기 `ResearchActivity { searches, opened }` — 한 줄을 넣어 누적값이 바뀌었을 때만 `Some(스냅샷)` 을 돌려준다.
- `claude_cli.rs` `relay_process` / `codex_cli.rs` `relay_codex_process`: 리서치면 청크 발행을 건너뛰고, 누적기가 스냅샷을 주면 `ai://research` 를 발행한다. 최종 결과·단일 발행(`claim_terminal`)·완결 추적은 그대로.
  - "한 줄 → (청크?, 활동 스냅샷?)" 을 돌려주는 순수 판정 함수로 빼서 테스트한다(스레드·emit 은 얇게 유지).
- 테스트: AC-AI16-007·008·009.

### M4 — 프런트 (Priority: High)
- `ai-length-guard.ts`: `AiPresetKind` 에 `'research'`, `EDIT_PRESETS` 에 추가, `EDIT_PRESET_NAMES = '다듬기·직접 입력·리서치는'`.
- `ai-selection-toolbar.ts`: `PRESET_DEFS` 에 `{ kind: 'research', label: '🔎 리서치' }` 를 `custom` 앞에, `buildMenuNoticePartial` 문구에 리서치 추가.
- `waitNotice.ts`: `RESEARCH_WATCHDOG_MS = 180_000`, `researchBackstopDelayMs() = RESEARCH_WATCHDOG_MS + FRONTEND_BACKSTOP_GRACE_MS`. Rust 상수와 같은 값인지 양쪽 테스트(180/185 단언).
- `aiEventRouter.ts`: `onResearch?(activity)` 핸들러 + `dispatchAiResearch`. `useAiRelay.ts`: `ai://research` 리스너(라우터로만 발송, 스토어 변경 없음).
- `researchSources.ts`(신규): `extractUrls`, `normalizeUrl`, `findUnverifiedSources` — spec.md D7 의 추출·정규화 규칙 그대로.
- `ai-suggestion-card.ts`:
  - `deriveCardActions`: `presetKind === 'research'` 면 `insert-below` 하나.
  - `getRenderInput`: 리서치면 `applyCompletionToActions` 를 건너뛰어 `completionNotice` 를 비운다(D9).
  - 컨트롤러에 리서치 활동 상태. 라우터 구독에 `onResearch` 추가 — 스토어 슬롯 여부와 무관하게 반영(활동 이벤트는 스토어를 거치지 않으므로). 재요청 시 활동 상태를 초기화한다.
  - 스트리밍 렌더: 리서치면 진행 문구, 대기 안내 숨김. 완료 렌더: 리서치면 `findUnverifiedSources` 결과가 있을 때 알림 한 줄.
  - 백스톱: 리서치면 `researchBackstopDelayMs()`.
- 테스트: AC-AI16-001·004·010·011·012·013. TS 테스트에 쓰는 최종 텍스트·열어 본 목록은 캡처에서 뽑아 작은 JSON 픽스처로 둔다(값은 acceptance.md 표와 같아야 한다).

### M5 — 통합 확인 (Priority: Medium)
- `cargo test --manifest-path src-tauri/Cargo.toml`(원문을 progress.md 에), 바뀐 파일의 `npx vitest run`, `npx tsc --noEmit`, 바뀐 파일 eslint.
- AC-AI16-014(실 CLI), AC-AI16-015(macOS 앱) 수동 확인 → progress.md. AC-AI16-016 은 가능하면.

## 변경 파일 목록 (코디네이터 겹침 확인용)

| 파일 | 마일스톤 |
|------|----------|
| `src-tauri/src/ai/prompt.rs` | M2 |
| `src-tauri/src/ai/provider.rs` | M2 |
| `src-tauri/src/ai/mod.rs` | M2, M3 |
| `src-tauri/src/ai/claude_cli.rs` | M2, M3 |
| `src-tauri/src/ai/codex_cli.rs` | M2, M3 |
| `src-tauri/src/ai/stream.rs` | M3 |
| `src-tauri/tests/fixtures/` (캡처 8개 + 기준 프롬프트 2개 추가) | M1 |
| `src/components/editor/extensions/ai-length-guard.ts` (+ 테스트) | M4 |
| `src/components/editor/extensions/ai-selection-toolbar.ts` (+ 테스트) | M4 |
| `src/components/editor/extensions/ai-suggestion-card.ts` (+ 테스트) | M4 |
| `src/lib/ai/waitNotice.ts` (+ 테스트) | M4 |
| `src/lib/ai/aiEventRouter.ts` (+ 테스트) | M4 |
| `src/hooks/useAiRelay.ts` | M4 |
| `src/lib/ai/researchSources.ts` (신규, + 테스트) | M4 |

다른 진행 중 카드와 겹칠 수 있는 곳: `ai-suggestion-card.ts`·`mod.rs`·`claude_cli.rs`·`codex_cli.rs`(SPEC-AI-012~015 가 모두 거친 파일). origin/main 7480a95 기준으로 작성했다.

## Risks & Mitigations

| 위험 | 영향 | 대응 |
|------|------|------|
| `ai://research` 와 `ai://done` 의 도착 순서가 뒤집힘(A1) | 열어 본 주소까지 "확인 기록 없음"으로 뜬다 | 같은 릴레이 스레드에서 순서대로 발행. AC-AI16-015 에서 확인하고, 어긋나면 열어 본 목록을 `ai://done` 에도 실어 카드가 그 값을 쓰게 바꾼다(스토어 필드 1개 추가) |
| codex 가 `web_search` 값 이름을 바꿈 | 아는 키의 모르는 값은 설정 오류로 실행 실패(R9) — 모든 codex 동작이 오류 카드가 된다 | 실패는 기존 `decide_outcome` 이 오류 카드로 보여 준다(조용히 깨지지 않음). 기능 끄기는 이름 무시형 `-c features.*` 라 그쪽 위험은 없다. 검증 버전(0.167.0)을 `@MX:NOTE` 에 적는다 |
| 옛 codex(0.144 등)가 `web_search` 키를 모름(A3) | 키가 무시되어(R11) 그 버전의 내장 웹 검색이 꺼지지 않을 수 있다. 앱은 깨지지 않는다 | progress.md·sync 문서에 "codex 0.167 이상 권장"으로 적는다. 버전 검사 기능은 범위 밖 |
| codex 하위 에이전트 | R10: `--ephemeral` 에서 시작하지 못함 | AC-AI16-014 에서 최종 인자로 다시 확인. 시작되면 실패로 판정하고 `-c features.multi_agent=false` 추가를 사용자에게 보고(이름 무시형이라 부작용 없음) |
| claude WebFetch 의 로컬·사내 HTTPS 접근(R12) | 주입 지시가 성공하면 인증 없이 열리는 로컬·사내 HTTPS 서비스 내용이 샐 수 있다 | spec.md 「잔여 위험」. 도메인 차단은 범위 밖, 후속 과제 후보로 sync 보고에 적는다 |
| 리서치 비용(haiku 약 $0.2, sonnet 약 $0.7) | 사용량 한도 소진 | sync 문서·사용자 안내에 실측 값을 적는다. 비용 확인 창은 범위 밖 |
| 웹·선택 텍스트 속 주입 지시 | 선택 텍스트(최대 6,000자)가 외부 주소로 새어 나갈 수 있다 | spec.md 「잔여 위험」 표의 장치 |
| Windows 미확인 | `.cmd` 셈 경로에서 새 인자 처리 | 인자에 특수 문자가 없음(A4). AC-AI16-016 수동 |
| Rust 테스트가 CI 에서 돌지 않음(`release.yml:11` 머리말) | Rust 회귀를 CI 가 못 잡는다 | M5 에서 로컬 `cargo test` 원문을 progress.md 에 남긴다 |

## Out of Scope

spec.md 「Exclusions」 를 따른다.
