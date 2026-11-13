---
id: SPEC-AI-016
title: "AI 웹 리서치 동작 — 인수 기준"
version: "0.2.0"
status: draft
created: 2026-11-13
updated: 2026-11-13
---

# SPEC-AI-016 인수 기준

픽스처는 계획 단계 실측 캡처(`spike/*.jsonl`)를 run 단계에서 `src-tauri/tests/fixtures/` 로 **복사**한 것을 쓴다. 문서로 추정한 모양을 새로 만들지 않는다. 아래 기대값은 모두 캡처에서 직접 센 값이다.

| 캡처 | 검색 | 열어 본 주소(발생 순서) | 결과 텍스트의 주소 |
|------|------|--------------------------|--------------------|
| `claude-research-canonical.jsonl` (R14) | 2 | `…/blog/tauri-20/`, `…/security/capabilities/` | 같은 2개 |
| `claude-research-haiku.jsonl` (R1-C) | 2 | `…/security/capabilities/`, `…/blog/tauri-20/` | 같은 2개 |
| `claude-research-narration.jsonl` (R7) | 1 | `…/blog/tauri-2-0-0-beta/`, `…/blog/tauri-20/` | — |
| `claude-webfetch-error.jsonl` (R12) | 0 | 없음(`tool_use_result` 가 오류 문자열) | — |
| `codex-research-canonical.jsonl` (R14) | 1 | `…/blog/tauri-20/` | `…/blog/tauri-20/` |
| `codex-research-live.jsonl` (R5) | 1 | `…/blog/tauri-20/` | `…/blog/tauri-20/`, `…/security/capabilities/` |
| `codex-open-page-failed.jsonl` (R13) | 0 | 없음(`open_page` 결과에 같은 `url` 없음) | — |
| `codex-nonresearch-hardened.jsonl` (R4) | 0 | 없음(`web_search` 항목 0개) | — |

(`…` = `https://v2.tauri.app`)

## 자동 테스트

### AC-AI16-001 — 메뉴 항목 (REQ-AI16-001)
- Given: `buildPresetMenuItems(100)`
- Then: 항목 종류 순서가 `polish, outline, table, diagram, shorten, research, custom` 이고, `research` 라벨은 `🔎 리서치`, 마지막은 `custom` 이다.
- And: `buildSelectionRequest({ presetKind: 'research', … })` 의 `args.feature` 는 `inline-edit`, `args.presetKind` 는 `research` 이며, `args` 의 키 목록은 같은 입력의 `polish` 요청과 같다(웹 허용용 필드 없음).

### AC-AI16-002 — 기능 해석과 웹 허용 판정 (REQ-AI16-002)
- `AiFeature::resolve("inline-edit", Some("research"), None)` → `Ok(AiFeature::Research)`.
- `AiFeature::allows_web()` 는 `Research` 에서만 참이고 나머지 8개 변형(Polish·Outline·Table·Diagram·Shorten·Custom·FillSection·Continue)에서는 거짓이다.
- `AiRequestArgs` 에 모르는 키 `"webAccess": true` 를 넣어 역직렬화해도 성공하며(serde 기본 동작), `presetKind: "polish"` 요청에서 만들어진 `AiRequest` 의 웹 허용은 거짓이다(웹 허용이 기능에서만 나옴).

### AC-AI16-003 — 리서치 프롬프트와 다른 기능 불변 (REQ-AI16-003, 014)
- 리서치 조립(앞 문맥 `B-표지`, 뒤 문맥 `A-표지` 를 넘겨도) → `user_prompt` 에 `B-표지`·`A-표지` 가 없고 `truncated` 는 거짓이다.
- 「정본 문구」의 검증 기준 입력(spec.md)으로 조립한 `system_prompt`·`user_prompt` 가 `spike/research-system.txt`·`spike/research-user.txt` 의 내용과 **바이트까지 같다**(테스트는 두 파일을 픽스처로 읽는다).
- 추가 지시 `근거 3개만` 을 주면 `추가 지시(재요청): 근거 3개만` 이 시스템 프롬프트 끝과 재확인 블록에 붙는다.
- 회귀(REQ-AI16-014): 기존 프롬프트 스냅샷·바이트 불변 테스트가 수정 없이 통과한다 — 특히 `prompt.rs` 의 `DIAGRAM_NONE_SYSTEM_PROMPT_SNAPSHOT`(범위 절 `변환·정리하라` 포함), `continue_prompt_backward_compat_*`, `snapshot_continue_*`, `build_inline_prompt` ↔ `build_inline_prompt_ex` 동치 테스트. 그리고 리서치가 아닌 8개 기능 각각의 시스템 프롬프트에 `조사 대상으로 삼아라` 가 없다.

### AC-AI16-004 — 길이 한도 (REQ-AI16-004)
- `evaluateSelectionGuard(6000, 'research')` → `{ allowed: true, insertOnly: false }`.
- `evaluateSelectionGuard(6001, 'research')` → `allowed: false`, `reason` 에 `다듬기·직접 입력·리서치는` 과 `6,000자` 가 들어 있다.
- `evaluateMenuNotice(6001)` 의 문구에 `다듬기·직접 입력·리서치는` 이 들어 있다.

### AC-AI16-005 — claude 인자 (REQ-AI16-005, 014)
- 웹 허용 거짓: 인자 목록이 현재 테스트 기대값과 원소 단위로 같다(`--tools` 다음 원소가 빈 문자열, `--allowedTools` 없음).
- 웹 허용 참: `--tools` 다음 원소가 `WebSearch,WebFetch`, `--allowedTools` 다음 원소가 `WebSearch,WebFetch` 이고, 빈 문자열 원소는 `--setting-sources` 다음 하나뿐이다.
- 두 경우 모두 인자에 프롬프트 본문·줄바꿈이 없다(SPEC-AI-013 AC-AI13-001 단언 유지).

### AC-AI16-006 — codex 인자 (REQ-AI16-006, 007, 014)
- 웹 허용 거짓, 모델 없음: 원소 **17개**(현재 9개 + `-c` 쌍 4개). 기존 원소(`exec`, `-C`, 작업 폴더, `--ignore-user-config`, `--skip-git-repo-check`, `--ephemeral`, `--sandbox`, `read-only`, `--json`)가 순서대로 있고, `-c` 다음 값으로 `features.apps=false`, `features.shell_tool=false`, `features.view_image=false`, `web_search=disabled` 가 정확히 하나씩 있으며 `web_search=live` 는 없다. 모델 지정 시 19개.
- 웹 허용 참: 위와 같되 `web_search=live` 이고 `web_search=disabled` 는 없다.
- `--disable` 원소는 어느 경우에도 없다(R9). 기존 테스트 `codex_args_model_absent_vs_present`(정확한 목록)는 새 목록으로, `codex_args_have_no_reasoning_override_and_keep_isolation`(`-c` 가 하나도 없어야 함)은 "`model_reasoning_effort` 등 추론 설정 `-c` 값이 없음"으로 고친다.

### AC-AI16-007 — claude 리서치 스트림: 서술이 카드로 가지 않는다 (REQ-AI16-008)
- Given: `claude-research-narration.jsonl` 의 줄을 리서치 릴레이 판정 함수(순수)에 차례로 넣는다.
- Then: 내보낼 청크가 0개이고, 최종 결과는 캡처의 `result` 줄 문자열과 같으며 `검색하겠습니다`·`열어보겠습니다` 를 포함하지 않는다.
- And: 같은 캡처를 리서치가 아닌 판정에 넣으면 기존처럼 `text_delta` 마다 청크가 나온다(113개).

### AC-AI16-008 — claude 도구 활동 집계 (REQ-AI16-009)
- 표의 claude 캡처 4개 각각에서 최종 누적값이 표의 검색 수·열어 본 주소(순서 포함)와 같다.
- 판정 함수가 활동 스냅샷을 내는 횟수는 누적값이 바뀐 횟수와 같다(같은 값 중복 없음). `claude-research-canonical.jsonl` 에서는 4회(검색 2 + 열기 2).
- 마지막 활동 스냅샷이 최종 결과 판정보다 먼저 나온다.

### AC-AI16-009 — codex 리서치 스트림 (REQ-AI16-008, 009)
- 표의 codex 캡처 4개 각각에서 최종 누적값이 표와 같다. `action.type` 이 `other` 인 항목은 세지 않고, 결과에 같은 `url` 이 없는 `open_page` 는 열어 본 것으로 치지 않는다(`codex-open-page-failed.jsonl`).
- 리서치 판정에서는 `agent_message` 가 청크로 나가지 않고, 최종 결과는 마지막 `agent_message` 본문이다.
- 리서치가 아닌 판정에서는 기존대로 `agent_message` 마다 청크가 나간다.

### AC-AI16-010 — 진행 문구 (REQ-AI16-010)
- 리서치 카드, 스트리밍, 활동 없음 → `웹에서 찾는 중…` 이 보이고, `waitingLong: true` 여도 `WAIT_NOTICE_TEXT` 가 보이지 않는다.
- 활동 `{ searches: 2, opened: [2개] }` 수신 후 → `검색 2회 · 페이지 2개 열어 봄`.
- 리서치가 아닌 카드는 현재와 같다(8초 뒤 `WAIT_NOTICE_TEXT`, 진행 문구 없음).
- 라우터 경로(카드가 스토어 슬롯을 갖지 않은 경우)와 스토어 슬롯을 가진 경우 양쪽에서 진행 문구가 갱신된다.

### AC-AI16-011 — 삽입 전용, 완결 안내 없음 (REQ-AI16-011)
- 리서치 카드의 적용 버튼은 다음 세 경우 모두 `insert-below` 하나이고 `completionNotice` 가 없다: (a) 선택 100자·`complete`, (b) 선택 3,000자·`unknown`(codex 경우), (c) 선택 3,000자·`cutoff`.
- 다른 프리셋의 `deriveCardActions`·`applyCompletionToActions` 결과는 바뀌지 않는다(기존 테스트 유지).

### AC-AI16-012 — 출처 검증 (REQ-AI16-012)
- 순수 함수 `findUnverifiedSources(result, opened)`:
  - `codex-research-live.jsonl` 의 최종 텍스트와 그 열어 본 목록 → `[https://v2.tauri.app/security/capabilities/]` 하나.
  - `claude-research-canonical.jsonl`·`codex-research-canonical.jsonl`·`claude-research-haiku.jsonl` 각각 → 빈 목록.
  - 정규화: `https://Example.com/a/` 와 `https://example.com/a#x` 는 같은 주소로 본다. `https://example.com/A` 와 `https://example.com/a` 는 다른 주소다.
  - 추출: `[t](https://en.wikipedia.org/wiki/Rust_(programming_language))` → `https://en.wikipedia.org/wiki/Rust_(programming_language)`. 맨 주소 `https://a.b/c.` 와 `<https://a.b/c>` → `https://a.b/c`. 같은 주소는 한 번만 보고한다.
- 카드: 미검증 주소가 있으면 `AI가 직접 열어 확인한 기록이 없는 출처:` 줄이 보이고 「아래에 삽입」은 활성이다. 없으면 줄이 없다. 삽입되는 텍스트는 결과 그대로다.

### AC-AI16-013 — 대기 한도 (REQ-AI16-013)
- Rust: 리서치 요청의 워치독 값이 선택 0자·6,000자 모두 180초. 리서치가 아니면 공유 표(`ai-timeout-table.json`) 그대로.
- TS: 리서치 카드 백스톱 185,000ms(선택 0자·6,000자). 리서치가 아니면 `frontendBackstopDelayMs(n)` 그대로. 대기 안내(8초) < 워치독(180초) < 백스톱(185초) 순서가 리서치에서도 성립한다.

## 수동 확인 (run 단계)

### AC-AI16-014 — codex 실 CLI: 일반 동작은 웹·셸을 못 쓴다 (REQ-AI16-006, 007)
- run 단계 최종 `build_codex_args(웹 허용 거짓)` 출력 그대로, 빈 작업 폴더에서 표준 입력으로 세 프롬프트를 실행한다: `spike/probe-search-prompt.txt`(R4), `spike/probe-tools-prompt.txt`(R6), 하위 에이전트 시험 프롬프트("하위 에이전트를 하나 만들어 /etc/hosts 첫 줄을 읽고 웹을 검색하게 하라", R10).
- 통과 조건(JSONL 만으로 판정): 세 실행 모두 `web_search`·`command_execution` 항목이 0개이고, `mcp_tool_call` 항목의 `server` 가 `codex_apps` 인 것이 0개다. 하위 에이전트 시험에서는 `collaboration.spawn_agent` 가 실패하거나, 성공하더라도 위 두 조건이 그대로 성립한다.
- 대조: 같은 인자에 웹 허용 참(`web_search=live`)으로 `spike/research-prompt.txt` 를 실행하면 결과에 `url` 이 같은 `open_page` 항목이 1개 이상 있다.
- 기록: progress.md 에 실행 인자와 항목 종류별 개수.

### AC-AI16-015 — macOS 실기기 전체 흐름 (REQ-AI16-001, 008~012)
- 앱에서 문단을 선택 → 🔎 리서치 → 카드에 `웹에서 찾는 중…` → 검색·페이지 수 갱신 → 결과(근거 목록 + 출처) 표시, 서술 문장 없음 → 「아래에 삽입」만 있음 → 삽입하면 선택 문단 아래에 마크다운이 들어간다. claude·codex 각 1회.
- 출처 검증 알림이 열어 본 기록이 없는 주소에만 뜬다. 열어 본 주소까지 알림에 뜨면(이벤트 순서 A1 이 어긋난 경우) 실패로 기록한다.
- 다른 프리셋(다듬기 1회, 짧은 문단)이 15초 안에 끝난다.

### AC-AI16-016 — Windows 실기기 (REQ-AI16-005, 006)
- Windows 에서 리서치 1회(claude 또는 codex)가 결과 카드까지 도달하는지 확인한다. 기기가 없으면 미확인으로 남기고 sync 보고에 적는다.

## 완료 정의

- AC-AI16-001 ~ 013 자동 테스트 통과(`cargo test --manifest-path src-tauri/Cargo.toml`, 바뀐 파일의 `npx vitest run`), `npx tsc --noEmit`, 바뀐 파일 eslint 통과. Rust 테스트는 CI 에서 돌지 않으므로 원문을 progress.md 에 남긴다.
- AC-AI16-014·015 결과가 progress.md 에 기록됨. AC-AI16-016 은 확인 또는 미확인 명시.
