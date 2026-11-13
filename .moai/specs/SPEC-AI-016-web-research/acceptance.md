---
id: SPEC-AI-016
title: "AI 웹 리서치 동작 — 인수 기준"
version: "0.1.0"
status: draft
created: 2026-11-13
updated: 2026-11-13
---

# SPEC-AI-016 인수 기준

픽스처는 계획 단계 실측 캡처(`spike/*.jsonl`)를 run 단계에서 `src-tauri/tests/fixtures/` 로 옮긴 것을 쓴다. 문서로 추정한 모양을 새로 만들지 않는다.

## 자동 테스트

### AC-AI16-001 — 메뉴 항목 (REQ-AI16-001)
- Given: `buildPresetMenuItems(100)`
- Then: 항목 종류 순서가 `polish, outline, table, diagram, shorten, research, custom` 이고, `research` 라벨은 `🔎 리서치`, 마지막은 `custom` 이다.
- And: `buildSelectionRequest({ presetKind: 'research', … })` 의 `args.feature` 는 `inline-edit`, `args.presetKind` 는 `research` 이며, 웹 허용을 뜻하는 필드는 `args` 에 없다(키 목록이 다른 프리셋과 같다).

### AC-AI16-002 — 기능 해석과 웹 허용 판정 (REQ-AI16-002)
- `AiFeature::resolve("inline-edit", Some("research"), None)` → `Ok(AiFeature::Research)`.
- 웹 허용 판정 함수(예: `AiFeature::allows_web()`)는 `Research` 에서만 참이고 나머지 8개 변형(Polish·Outline·Table·Diagram·Shorten·Custom·FillSection·Continue)에서는 거짓이다.
- `AiRequestArgs` 역직렬화 시 어떤 JSON 키를 넣어도(예: `"webAccess": true`) 리서치가 아닌 기능의 웹 허용이 참이 되지 않는다.

### AC-AI16-003 — 리서치 프롬프트 (REQ-AI16-003)
- Given: 리서치 조립에 선택 `S`, 앞 문맥 `B-표지`, 뒤 문맥 `A-표지` 를 넘긴다(`mod.rs` 분기 함수 또는 같은 경로를 쓰는 순수 함수).
- Then: `user_prompt` 에 `B-표지`·`A-표지` 가 없고, 대상 태그 안에 `S` 가 그대로 있다. `truncated` 는 거짓이다.
- And: `system_prompt` 와 재확인 블록에 REQ-AI16-003 의 일곱 지시가 모두 들어 있다(문장별 부분 문자열 단언).
- And: 추가 지시 `근거 3개만` 을 주면 `추가 지시(재요청): 근거 3개만` 이 시스템 프롬프트와 재확인 블록에 붙는다.

### AC-AI16-004 — 길이 한도 (REQ-AI16-004)
- `evaluateSelectionGuard(6000, 'research')` → `{ allowed: true, insertOnly: false }`.
- `evaluateSelectionGuard(6001, 'research')` → `allowed: false`, `reason` 에 `다듬기·직접 입력·리서치는` 과 `6,000자` 가 들어 있다.
- `evaluateMenuNotice(6001)` 의 삽입 전용 안내 문구에도 리서치가 쓸 수 없는 계열로 들어 있다.

### AC-AI16-005 — claude 인자 (REQ-AI16-005, 014)
- 웹 허용 거짓: 인자 목록이 현재 테스트 기대값과 원소 단위로 같다(`--tools` 다음 원소가 빈 문자열, `--allowedTools` 없음).
- 웹 허용 참: `--tools` 다음 원소가 `WebSearch,WebFetch`, `--allowedTools` 다음 원소가 `WebSearch,WebFetch` 이고, 빈 문자열 원소가 `--setting-sources` 다음 하나뿐이다.
- 두 경우 모두 인자에 프롬프트 본문·줄바꿈이 없다(SPEC-AI-013 AC-AI13-001 단언 유지).

### AC-AI16-006 — codex 인자 (REQ-AI16-006, 007, 014)
- 웹 허용 거짓, 모델 없음: 인자에 `-c` 쌍 `features.apps=false`, `features.shell_tool=false`, `features.view_image=false`, `web_search=disabled` 가 정확히 하나씩 있고 `web_search=live` 는 없다. 기존 원소(`exec`, `-C`, 작업 폴더, `--ignore-user-config`, `--skip-git-repo-check`, `--ephemeral`, `--sandbox`, `read-only`, `--json`)는 순서대로 그대로 있다.
- 웹 허용 참: 위와 같되 `web_search=live` 이고 `web_search=disabled` 는 없다.
- `--disable` 원소는 어느 경우에도 없다(R9).

### AC-AI16-007 — claude 리서치 스트림: 서술이 카드로 가지 않는다 (REQ-AI16-008)
- Given: 픽스처 `claude-research-narration.jsonl` 의 줄을 리서치 릴레이 판정 함수(순수)에 차례로 넣는다.
- Then: 내보낼 청크가 0개이고, 최종 결과는 픽스처 `result` 줄의 문자열과 같으며 `검색하겠습니다`·`열어보겠습니다` 를 포함하지 않는다.
- And: 같은 픽스처를 리서치가 아닌 판정에 넣으면 기존처럼 `text_delta` 마다 청크가 나온다(회귀 없음).

### AC-AI16-008 — claude 도구 활동 집계 (REQ-AI16-009)
- 픽스처 `claude-research-haiku.jsonl` → 최종 누적값 `searches = 2`, `opened = [https://v2.tauri.app/security/capabilities/, https://v2.tauri.app/blog/tauri-20/]`(발생 순서).
- 픽스처 `claude-research-narration.jsonl` → `searches = 1`, `opened` 2개(`tauri-2-0-0-beta/`, `tauri-20/`).
- 누적값이 바뀔 때마다 한 번씩 발행 대상이 되며(같은 값 중복 발행 없음), 마지막 발행이 최종 결과 판정보다 앞선다.
- `WebFetch` 결과의 `code` 가 2xx 가 아니면 `opened` 에 넣지 않는다(픽스처 한 줄의 `code` 를 404로 바꾼 변형으로 단언).

### AC-AI16-009 — codex 리서치 스트림 (REQ-AI16-008, 009)
- 픽스처 `codex-research-live.jsonl` → `searches = 1`, `opened = [https://v2.tauri.app/blog/tauri-20/]`. `action.type` 이 `other` 인 항목은 세지 않는다.
- 리서치 판정에서는 `agent_message` 가 청크로 나가지 않고, 최종 결과는 마지막 `agent_message` 본문이다.
- 리서치가 아닌 판정에서는 기존대로 `agent_message` 마다 청크가 나간다.

### AC-AI16-010 — 진행 문구 (REQ-AI16-010)
- 리서치 카드, 스트리밍, 활동 없음 → `웹에서 찾는 중…` 이 보이고, `waitingLong: true` 여도 `WAIT_NOTICE_TEXT` 가 보이지 않는다.
- 활동 `{ searches: 2, opened: [2개] }` 수신 후 → `검색 2회 · 페이지 2개 열어 봄`.
- 리서치가 아닌 카드는 현재와 같다(8초 뒤 `WAIT_NOTICE_TEXT`, 진행 문구 없음).
- 라우터 경로(카드가 스토어 슬롯을 갖지 않은 경우)와 스토어 경로 양쪽에서 진행 문구가 갱신된다.

### AC-AI16-011 — 삽입 전용 (REQ-AI16-011)
- 리서치 카드의 적용 버튼은 선택 길이 100자·`completion: 'complete'` 에서도 `insert-below` 하나뿐이다.
- 다른 프리셋의 `deriveCardActions` 결과는 바뀌지 않는다(기존 테스트 유지).

### AC-AI16-012 — 출처 검증 (REQ-AI16-012)
- 순수 함수 `findUnverifiedSources(result, opened)`:
  - 픽스처 `codex-research-live.jsonl` 의 최종 텍스트와 그 `opened` → `[https://v2.tauri.app/security/capabilities/]` 하나.
  - 픽스처 `claude-research-haiku.jsonl` 의 최종 텍스트와 그 `opened` → 빈 목록.
  - 정규화: `https://Example.com/a/` 와 `https://example.com/a#x` 는 같은 주소로 본다. 경로 대소문자는 구분한다.
  - 마크다운 링크 `[t](https://a.b/c)` 와 맨 주소 `https://a.b/c` 를 모두 뽑고, 닫는 괄호·`]`·`>`·문장 끝 `.`·`,` 는 주소에 넣지 않는다. 같은 주소는 한 번만 보고한다.
- 카드: 미검증 주소가 있으면 `AI가 직접 열어 확인한 기록이 없는 출처:` 줄이 보이고 「아래에 삽입」은 활성이다. 없으면 줄이 없다. 삽입되는 텍스트는 결과 그대로다.

### AC-AI16-013 — 대기 한도 (REQ-AI16-013)
- Rust: 리서치 요청의 워치독 값이 선택 0자·6,000자 모두 180초. 리서치가 아니면 공유 표(`ai-timeout-table.json`) 그대로.
- TS: 리서치 카드 백스톱 185,000ms(선택 0자·6,000자). 리서치가 아니면 `frontendBackstopDelayMs(n)` 그대로. 순서 불변식(대기 안내 < 워치독 < 백스톱)은 리서치에서도 성립한다.

## 수동 확인 (run 단계)

### AC-AI16-014 — codex 실 CLI: 일반 동작은 웹을 못 쓴다 (REQ-AI16-006, 007)
- run 단계 최종 `build_codex_args(웹 허용 거짓)` 출력 그대로, 검색을 요구하는 프롬프트(`spike/probe-search-prompt.txt`, R4)와 도구 목록 질의 프롬프트(`spike/probe-tools-prompt.txt`, R6)를 빈 작업 폴더에서 표준 입력으로 실행한다.
- 통과: JSONL 에 `web_search`·`command_execution` 항목이 없고, `mcp_tool_call` 이 있다면 `codex_apps` 서버가 아니며, 답에 "읽을 수 없다/검색 도구가 없다"가 나온다. 같은 인자에 웹 허용 참이면 `open_page` 가 1회 이상 나온다.
- 기록: progress.md 에 명령과 JSONL 요약.

### AC-AI16-015 — macOS 실기기 전체 흐름 (REQ-AI16-001, 008~012)
- 앱에서 문단을 선택 → 🔎 리서치 → 카드에 `웹에서 찾는 중…` → 검색·페이지 수 갱신 → 결과(근거 목록 + 출처) 표시, 서술 문장 없음 → 「아래에 삽입」만 있음 → 삽입하면 선택 문단 아래에 마크다운이 들어간다. claude·codex 각 1회.
- 출처 검증 알림이 열어 보지 않은 주소에만 뜨는지 확인한다. 이벤트 순서(A1)가 어긋나 열어 본 주소까지 알림에 뜨면 실패로 기록한다.
- 다른 프리셋(다듬기 1회)이 전과 같이 빠르게 끝나는지 확인한다.

### AC-AI16-016 — Windows 실기기 (REQ-AI16-005, 006)
- Windows 에서 리서치 1회(claude 또는 codex)가 끝까지 동작하는지 확인한다. 기기가 없으면 미확인으로 남기고 sync 보고에 적는다.

## 완료 정의

- AC-AI16-001 ~ 013 자동 테스트 통과(`cargo test`, `npx vitest run` 대상 파일), lint·tsc 통과.
- AC-AI16-014·015 결과가 progress.md 에 기록됨. AC-AI16-016 은 확인 또는 미확인 명시.
- 리서치가 아닌 동작의 기존 테스트(프롬프트 바이트 불변·claude 인자·대기 한도 공유 표)가 그대로 통과.
