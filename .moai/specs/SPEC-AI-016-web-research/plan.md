---
id: SPEC-AI-016
title: "AI 웹 리서치 동작 — 구현 계획"
version: "0.1.0"
status: draft
created: 2026-11-13
updated: 2026-11-13
---

# SPEC-AI-016 구현 계획

## 등급과 방법론

- 등급: **Tier M** — 기존 운영 파일 12개(Rust 6, TS 6) + 새 순수 모듈 1개(TS) + 픽스처 4개, 예상 500~800줄(테스트 포함). 산출물 3종(spec·plan·acceptance) + progress.md.
- 방법론: TDD(RED → GREEN → REFACTOR). 파서·인자·판정은 모두 순수 함수로 두고 실측 픽스처로 먼저 실패하는 테스트를 쓴다.
- 실행 형태: 순차 서브에이전트 1개(코딩 위주, 파일 간 의존이 있음). 하위 에이전트를 `isolation: "worktree"` 로 띄우지 않는다.

## 구현 원칙

1. 웹 허용 판단은 백엔드 한 곳(`AiFeature` → `AiRequest`)에서만 한다(D2).
2. 리서치가 아닌 경로는 바이트까지 그대로 둔다 — claude 인자, 모든 프롬프트, 릴레이 동작. codex 인자만 강화 플래그가 늘어난다(REQ-AI16-014).
3. 새 IPC 는 `ai://research` 이벤트 하나뿐이다. `ai://done` payload·`aiStore` 는 바꾸지 않는다(출처 검증은 카드가 마지막 활동 목록으로 한다, A1).
4. 외부 CLI 스트림 파서는 `spike/` 실측 캡처로만 테스트한다.

## Milestones (우선순위 순서)

### M1 — 픽스처 이동과 실측 재확인 (Priority: High)
- `spike/*.jsonl` 4개를 `src-tauri/tests/fixtures/` 로 옮긴다(이름 앞에 `research-` 를 붙이지 않고 그대로).
- 최종 인자(D3·D4)로 claude·codex 를 1회씩 다시 돌려 R1-C·R4·R5 결과가 같은지 확인하고 progress.md 에 남긴다(AC-AI16-014 의 앞부분).

### M2 — 백엔드 기능·프롬프트·인자 (Priority: High)
- `prompt.rs`: `AiFeature::Research`, `resolve` 의 `"research"`, `task_text` 리서치 문장(REQ-AI16-003 의 일곱 지시 + D8 형식), `allows_web()`.
- `provider.rs`: `AiRequest { web_access: bool }`(이름은 구현 시 정하되 프런트 인자에서 오지 않을 것).
- `mod.rs`: 리서치면 `build_inline_prompt_ex(&feature, selection, "", "", None, additional, request_id)`; `web_access = feature.allows_web()`; 워치독 `if web_access { 180 } else { watchdog_timeout_secs(n) }`; 릴레이에 리서치 여부 전달.
- `claude_cli.rs`: `build_claude_args(model, path, web_access)` — D3. `@MX:ANCHOR`(:87) 문구를 "기본 `--tools \"\"`, 리서치만 WebSearch·WebFetch 를 이름으로 나열하고 허용 목록에도 넣는다"로 고친다.
- `codex_cli.rs`: `build_codex_args(model, scratch, web_access)` — D4. `-c` 쌍은 `--model` 앞, `--json` 앞에 둔다. `@MX:ANCHOR` 이유 줄에 R2~R4 근거를 한 줄 추가한다.
- 테스트: AC-AI16-002·003·005·006, 기존 프롬프트 바이트 불변 테스트 통과 확인.

### M3 — 스트림 처리 (Priority: High)
- `stream.rs`: 순수 파서
  - claude: `assistant` 줄의 `tool_use` 중 `name == "WebSearch"` 를 검색 1회로, `user` 줄의 `tool_use_result` 가 `url` 과 2xx `code` 를 가지면 열어 본 주소로 본다.
  - codex: `item.completed` + `item.type == "web_search"` 에서 `action.type == "search"` → 검색 1회, `"open_page"` → `action.url` 을 열어 본 주소로.
  - 누적기 `ResearchActivity { searches, opened }` — 값이 바뀌었을 때만 `Some(스냅샷)` 을 돌려준다.
- `claude_cli.rs` `relay_process` / `codex_cli.rs` `relay_codex_process`: 리서치면 청크 발행을 건너뛰고, 누적값이 바뀌면 `ai://research` 를 발행한다. 최종 결과·단일 발행(`claim_terminal`)·완결 추적은 그대로.
  - 판정을 테스트할 수 있게 "한 줄 → (청크?, 활동?)" 을 돌려주는 순수 함수로 뺀다(스레드·emit 은 얇게 유지).
- 테스트: AC-AI16-007·008·009.

### M4 — 프런트 (Priority: High)
- `ai-length-guard.ts`: `AiPresetKind` 에 `'research'`, `EDIT_PRESETS` 에 추가, `EDIT_PRESET_NAMES = '다듬기·직접 입력·리서치는'`.
- `ai-selection-toolbar.ts`: `PRESET_DEFS` 에 `{ kind: 'research', label: '🔎 리서치' }` 를 `custom` 앞에, `buildMenuNoticePartial` 문구의 쓸 수 없는 계열에 리서치 추가.
- `waitNotice.ts`: `RESEARCH_WATCHDOG_MS = 180_000`, `researchBackstopDelayMs() = RESEARCH_WATCHDOG_MS + FRONTEND_BACKSTOP_GRACE_MS`. Rust 상수와 짝을 이루는 Rust·TS 양쪽 테스트(값 180/185 단언).
- `aiEventRouter.ts`: `onResearch?(activity)` 핸들러 + `dispatchAiResearch`. `useAiRelay.ts`: `ai://research` 리스너(라우터로만 발송, 스토어 변경 없음).
- `researchSources.ts`(신규): `extractUrls`, `normalizeUrl`, `findUnverifiedSources`.
- `ai-suggestion-card.ts`:
  - `deriveCardActions`: `presetKind === 'research'` 면 `insert-below` 하나.
  - 컨트롤러에 리서치 활동 상태. 라우터 구독에 `onResearch` 추가 — 스토어 슬롯 여부와 무관하게 반영(활동 이벤트는 스토어를 거치지 않으므로).
  - 스트리밍 렌더: 리서치면 진행 문구, 대기 안내 숨김.
  - 완료 렌더: 리서치면 `findUnverifiedSources` 결과가 있을 때 알림 한 줄.
  - 백스톱: 리서치면 `researchBackstopDelayMs()`.
- 테스트: AC-AI16-001·004·010·011·012·013.

### M5 — 통합 확인 (Priority: Medium)
- `cargo test`(AI 모듈), `npx vitest run`(바뀐 파일의 테스트), `npx tsc --noEmit`, `npm run lint`.
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
| `src-tauri/tests/fixtures/` (픽스처 4개 추가) | M1 |
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
| `ai://research` 와 `ai://done` 의 도착 순서가 뒤집힘(A1) | 열어 본 주소까지 "확인 기록 없음"으로 뜬다 | 같은 릴레이 스레드에서 순서대로 발행. AC-AI16-015 에서 확인하고, 어긋나면 `opened` 를 `ai://done` 에도 실어 카드가 그 값을 쓰게 바꾼다(스토어 필드 1개 추가) |
| codex 버전 변경으로 `web_search` 값 이름이 바뀜 | `-c web_search=…` 가 설정 오류로 실행 실패(R9 의 `-c web_search=bogusvalue` 처럼) | 실패는 기존 `decide_outcome` 이 오류 카드로 보여 준다. 기능 끄기는 이름 무시형 `-c features.*` 를 써서 그쪽 위험은 없앴다. 남는 위험은 progress.md 와 `@MX:NOTE` 에 버전(0.167.0)과 함께 적는다 |
| 옛 codex(0.144)가 `web_search` 키를 모름(A3) | 무시되면 웹 검색이 꺼지지 않을 수 있다 | 연결 앱·셸이 꺼져 있어도 내장 `web_search` 는 남을 수 있음을 위험으로 기록. 현재 설치본은 0.167.0 |
| codex 하위 에이전트가 설정을 이어받지 않음(A2) | 하위 에이전트에 셸이 생길 수 있다 | M1 에서 "하위 에이전트를 만들어 /etc/hosts 를 읽어라" 프롬프트로 1회 확인. 뚫리면 `-c features.multi_agent=false` 를 더할지 사용자에게 보고(이름 무시형이라 부작용 없음) |
| 리서치 비용(haiku $0.2, sonnet $0.7) | 사용량 한도 소진 | sync 문서·사용자 안내에 실측 값을 적는다. 비용 확인 창은 범위 밖 |
| 웹·선택 텍스트 속 주입 지시 | 선택 텍스트(최대 6,000자)가 외부 주소로 새어 나갈 수 있다 | spec.md 「잔여 위험」 표의 장치. 도메인 제한은 범위 밖 |
| Windows 미확인 | `.cmd` 셈 경로에서 새 인자 처리 | 인자에 특수 문자가 없음(A4). AC-AI16-016 수동 |
| Rust 테스트가 CI에서 돌지 않음(SPEC-AI-013 위험 표와 같음) | Rust 회귀를 CI가 못 잡는다 | M5 에서 로컬 `cargo test` 결과를 progress.md 에 남긴다 |

## Out of Scope

spec.md 「Exclusions」 를 따른다.
