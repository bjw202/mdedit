# Sync Audit — SPEC-AI-016 (AI '🔎 리서치' 웹 리서치 동작, 카드 t8)

감사자: sync-auditor (독립·읽기 전용, 소스 코드와 SPEC 본문은 수정하지 않음)
작업 트리: `.claude/worktrees/t8`, 브랜치 `WT-web-research`, HEAD `bae91d9`
감사 범위: `git diff 03450c1..HEAD` (코드 + 테스트 + 문서 55개 파일)
프로필: 기본 프로필(Functionality 40 / Security 25 / Craft 20 / Consistency 15, 필수 통과 = Functionality + Security), 평면 가중 조화평균

## 쉬운 말 요약

리서치 기능은 SPEC이 요구한 대로 구현되어 있고, 제가 직접 돌린 검사(프런트 테스트 219개, Rust AI 테스트 293개, 타입 검사, 린트)가 모두 통과했습니다. 웹 도구는 리서치에서만 열리고, 그 밖의 모든 동작(claude·codex)은 이전처럼 잠겨 있다는 것을 인자 조립 코드와 테스트로 확인했습니다. 막아야 할 결함(BLOCKING)은 없습니다. 다만 고쳐야 할 것이 둘 있습니다. 하나는 codex가 중간에 죽으면 "검색하겠습니다" 같은 서술 문장이 리서치 결과로 카드에 뜰 수 있는 경로이고, 다른 하나는 CHANGELOG·사용자 가이드가 실제 동작과 다르게 "출처 미검증 안내가 항상 붙는다"고 적은 점입니다. 실기기 흐름(AC-AI16-015)과 Windows(AC-AI16-016)는 아직 아무도 확인하지 않았으며, 이 감사도 확인하지 못했습니다.

## Overall Verdict: PASS-WITH-DEBT

종합 점수 0.84 (가중 조화평균, 0.87 / 0.85 / 0.80 / 0.80). 막힘(BLOCKING) 결함 0건, 고칠 것(SHOULD-FIX) 2건, 사소한 것(MINOR) 7건. 필수 통과 차원인 Functionality와 Security는 둘 다 기준을 넘었습니다(Critical/High 보안 결함 없음). 부채는 (a) 수동 확인 2건 미완, (b) 이벤트 순서 가정 A1이 실제 Tauri 이벤트 루프에서 관찰되지 않음, (c) Rust 커버리지 미측정, (d) 위 SHOULD-FIX 2건입니다.

## 차원별 점수

| 차원 | 점수 | 판정 | 근거(이번 실행에서 직접 관찰) |
|------|------|------|-------------------------------|
| Functionality (40%) | 0.87 | PASS | REQ-AI16-001~014가 모두 코드와 테스트에 대응. `npx vitest run src/test/aiResearch.test.ts src/test/researchSources.test.ts src/test/aiSelectionToolbar.test.ts src/test/aiRelay.test.ts` → `Test Files  4 passed (4)` / `Tests  160 passed (160)`. `cargo test --manifest-path src-tauri/Cargo.toml --lib ai::` → `test result: ok. 293 passed; 0 failed`. 감점: 수동 AC-015·016 미확인, A1 순서 미관찰, codex EOF 폴백 경로(F1). |
| Security (25%) | 0.85 | PASS | 웹 허용이 `AiFeature::allows_web()` 한 곳에서만 나오고 인자 조립에 선택 텍스트가 닿지 않음. 비리서치 인자 불변 테스트 통과. 픽스처 8개는 spike 캡처와 `cmp` 동일, 개인 경로·토큰 grep 0건. Critical/High 없음. 감점: 알림이 http(s) 외 스킴을 보지 않음(F6), 잔여 위험(수용됨)은 감점하지 않음. |
| Craft (20%) | 0.80 | PASS | `npx tsc --noEmit` → exit 0. `npx eslint --max-warnings 0 <변경 TS 9개>` → exit 0. 변경 TS 모듈 커버리지: `researchSources.ts` 100/95.45/100/100, `waitNotice.ts` 100, `ai-length-guard.ts` 100, `aiEventRouter.ts` 94.59, `useAiRelay.ts` 88. 감점: Rust 커버리지 도구로 측정하지 못함(UNVERIFIED), rustfmt 미준수 신규 줄(F7), 군더더기 조립(F8). |
| Consistency (15%) | 0.80 | PASS | 이웃 코드의 `@MX` 규약·한글 주석·테스트 배치를 따름. 감점: 문서가 실제 동작과 어긋남(F2), 새 CSS 클래스 2개에 스타일 없음(F4), `acceptance.md`·`plan.md` 상태 `draft` 잔존(F5). |

가중 조화평균: 1 / (0.40/0.87 + 0.25/0.85 + 0.20/0.80 + 0.15/0.80) = 0.839 → 0.84.

## 1. 주장 (Claim)

- C1. 웹 도구(claude `WebSearch`·`WebFetch`, codex `web_search=live`)는 리서치 동작에서만 켜지고, 다른 모든 경로는 잠겨 있다.
- C2. 리서치 결과는 「아래에 삽입」만 가능하며 「바꾸기」 버튼이 없다.
- C3. `ai://research` 이벤트는 항상 같은 요청의 `ai://done`보다 먼저 발행되고, 서술 텍스트는 카드로 흘러가지 않는다.
- C4. 열어 본 기록이 없는 출처는 카드가 한 줄로 알린다. 선택 6,000자 초과 시 리서치는 비활성화된다.
- C5. progress.md §E.2·§E.4와 CHANGELOG의 검증 수치·갭 목록은 사실과 일치한다.

## 2. 증거 (Evidence)

### 2.1 REQ → 코드 → 테스트 대응 (코드 직접 읽음)

| REQ | 구현 위치 | 테스트(이름) | 테스트 없이 구현만 빠지면 실패하는가 |
|-----|-----------|--------------|--------------------------------------|
| 001 메뉴 | `ai-selection-toolbar.ts:139` | `aiResearch.test.ts` "종류 순서와 라벨" | 예(순서 배열 완전 비교) |
| 002 웹 허용 단일 출처 | `prompt.rs:73-78` `allows_web`, `mod.rs:59-69` `build_ai_request` | `allows_web_only_for_research`, `web_allowed_comes_only_from_feature`, `unknown_web_access_key_is_ignored_and_polish_stays_offline` | 예 |
| 003 프롬프트 바이트 동일 | `prompt.rs` `build_research_prompt`, `research_scope_clause` | `research_prompt_is_byte_identical_to_captured_fixtures` | 예(픽스처 두 파일과 `assert_eq!`) |
| 004 6,000자 | `ai-length-guard.ts:25,28` | `aiResearch.test.ts` AC-004 3건 | 예 |
| 005 claude 인자 | `claude_cli.rs` `build_claude_args` | `claude_args_web_allowed_lists_web_tools_and_allow_list`, 기존 `build_claude_args_haiku_snapshot_byte_equal`(무수정 통과) | 예 |
| 006 codex 인자 | `codex_cli.rs` `build_codex_args` | `codex_args_web_allowed_switches_only_web_search_value`(17/19개, 차이 1원소) | 예 |
| 008 서술 억제 | `stream.rs` `decide_claude_line`·`decide_codex_line` | `claude_research_narration_emits_no_chunks_but_normal_mode_emits_113`(실캡처 대조) | 예 |
| 009 활동 집계 | `stream.rs` `ResearchActivity::apply` | `claude_snapshots_emit_once_per_change` 외 | 예 |
| 010 진행 문구 | `ai-suggestion-card.ts:436-441` | AC-010 6건(스토어 슬롯 유무 양쪽) | 예 |
| 011 삽입 전용 | `ai-suggestion-card.ts:172`, `getRenderInput` | `it.each` 3건 + 다른 프리셋 불변 | 예(`polish`는 같은 입력에서 버튼 2개라 분기 제거 시 실패) |
| 012 출처 알림 | `researchSources.ts`, `ai-suggestion-card.ts:332-339` | AC-012 카드 3건 + `researchSources.test.ts` 16건 | 예 |
| 013 대기 한도 | `mod.rs:46-55`, `waitNotice.ts` | `research_watchdog_is_fixed_180_regardless_of_selection_length`, 184,999ms/185,000ms 경계 테스트 | 예 |
| 014 회귀 없음 | 기존 스냅샷 테스트 무수정 | `ai::` 293개 통과 | 예 |

공허한(vacuous) 테스트는 찾지 못했습니다. 단, `useAiRelay` 테스트(`aiResearch.test.ts:294-311`)는 Tauri `listen`을 가짜로 대체하므로 이벤트 **순서**(A1)는 증명하지 않습니다.

### 2.2 보안 확인

- 웹 허용 흐름: `AiFeature::resolve`(문자열 `"research"` → `Research`) → `allows_web()` → `build_ai_request` → `AiRequest.web_allowed` → `build_claude_args`/`build_codex_args`. 인자 벡터에는 고정 문자열만 들어가며 선택 텍스트·추가 지시는 stdin 프롬프트로만 간다(`claude_cli.rs` `spawn_claude(&args, cwd, &request.user_prompt)`, `codex_cli.rs` `combine_prompts` → stdin). `AiRequestArgs`에 웹 허용 필드 없음: `grep -rn "webAllowed\|web_allowed\|webAccess\|allowWeb" src` → (출력 없음).
- 비리서치 경로: 기존 테스트 `build_claude_args_haiku_snapshot_byte_equal`(전체 Vec 하드코딩)이 수정 없이 통과. codex는 `features.apps/shell_tool/view_image=false` 3쌍이 웹 허용 여부와 무관하게 항상 존재하고(`c_values(&on)` 단언), 비리서치는 `web_search=disabled`. t10 핫픽스(03450c1)가 이미 같은 3쌍+disabled를 넣어 둔 것을 `git show 03450c1:src-tauri/src/ai/codex_cli.rs`로 확인.
- 픽스처 진위: `cmp` 로 spike 8개 JSONL과 `src-tauri/tests/fixtures/` 8개가 모두 동일, `research-system.txt`·`research-user.txt`도 동일. `grep -l "/Users/\|byunjungwon\|sk-ant\|Bearer\|api_key"` → 0건. 캡처에 실제 세션 ID·`msg_…` ID·`thread_id`가 들어 있어 손으로 지은 것이 아님(`head -c` 로 확인). 정리 스크립트는 경로·init 목록만 걷어 냄.
- 출처 URL 처리: 카드는 `textContent`로만 그리므로 HTML 주입 경로가 없다(`ai-suggestion-card.ts:336-338, 553`; 이번 diff에 `innerHTML` 추가 없음). 삽입된 마크다운이 미리보기에서 위험해지는지는 직접 관찰: `markdown-it({html:false,linkify:true}).render('[a](javascript:alert(1)) [b](file:///etc/passwd) [c](data:text/html,x) [d](https://x.y)')` → `<p>[a](javascript:alert(1)) [b](file:///etc/passwd) [c](data:text/html,x) <a href="https://x.y">d</a></p>` — 위험 스킴은 링크가 되지 않는다. 클릭 처리는 `http://`·`https://`만 연다(`PreviewRenderer.tsx:112-119`). `rel`/`target`은 이 SPEC이 만든 HTML에 없다(카드는 앵커를 만들지 않음).
- 수용된 잔여 위험(claude WebFetch의 로컬·사내 HTTPS 접근, 카드 t11)은 결함으로 세지 않았습니다.

### 2.3 정적 검사

```
$ npx tsc --noEmit                                       → exit 0
$ npx eslint --max-warnings 0 <변경 TS 9개>              → exit 0
$ cargo test --manifest-path src-tauri/Cargo.toml --lib ai::
test result: ok. 293 passed; 0 failed; 0 ignored; 0 measured; 150 filtered out
(전문: .moai/state/verify/sync-audit-ai016/cargo-ai.txt)
```

### 2.4 progress.md·CHANGELOG 대조

- §E.2 게이트 원문은 `.moai/logs/gate-cargo.txt`(`443 passed`, `3 passed`, `8 passed`)와 `gate-vitest.txt`(`Test Files  124 passed (124)` / `Tests  2159 passed (2159)`)에서 일치함을 확인. `find src -name '*.test.ts*' | wc -l` → 124로 파일 수도 일치. 단, 이 전체 수치를 이번에 다시 실행하지는 않았습니다(지시: 전체 스위트 금지).
- 프리셋 개수 7: `PRESET_DEFS`가 polish·outline·table·diagram·shorten·research·custom 7개 → README·USER_GUIDE 일치.
- `mod.rs:68`·`:296` 인용: `build_ai_request`가 `mod.rs:59-69`, `let web_allowed`가 `:296`으로 일치.

## 3. Baseline 귀속

모든 수치는 이번 실행에서 `HEAD bae91d9` 트리에 대해 측정했습니다. 이월한 값은 별도 표기했습니다: §E.2의 전체 vitest 2159개·cargo 443+3+8개(로그 파일 대조만, 재실행 없음), RED 단계 증거(에이전트 보고, 검증 불가), AC-AI16-014 실 CLI 프로브(원문 미보관, 항목 개수만 progress.md에 기록).

## 4. 미검증 (Gaps)

- G1. AC-AI16-015(macOS 실기기 전체 흐름)·016(Windows): 아무도 실행하지 않음. 특히 이벤트 순서 A1(`ai://research` → `ai://done`)은 Rust 쪽 같은 스레드 발행 순서 코드(`claude_cli.rs` 루프 안 emit → 루프 뒤 done)로 보장되나 실제 Tauri 루프에서는 관찰되지 않았습니다.
- G2. Rust 커버리지: `cargo llvm-cov` 등 측정 도구를 쓰지 않았습니다. 85% 기준 충족은 증명되지 않았고, TS 변경 모듈 커버리지만 측정했습니다.
- G3. 전체 vitest·cargo 스위트·Playwright: 지시에 따라 실행하지 않았습니다. `e2e/ai-custom-input-grow.spec.ts`는 메뉴가 위/아래로 뒤집히는 위치를 단언하는데, 메뉴 항목이 6개에서 7개로 늘어 높이가 바뀐 영향은 관찰하지 않았습니다.
- G4. 사용자 PC에 MCP 서버가 설정된 경우 claude 리서치 요청이 그 도구를 노출하는지(`--tools`는 내장 도구만 제한)는 관찰하지 못했습니다. 캡처의 `mcp_servers`는 `[]`였으나 개발 PC에 설정이 없었던 것일 수 있습니다. 비대화 모드에서는 허용 목록 밖 호출이 거부되므로 위험은 낮다고 보지만 확인은 안 했습니다.
- G5. codex `web_search=live`·`--ephemeral` 상태에서 하위 에이전트가 실제로 시작하지 못한다는 것(R10)은 spec·progress의 기록을 믿었고 직접 재실행하지 않았습니다.
- G6. 문서 줄 길이·마크다운 린트·링크 검사는 하지 않았습니다.

## 5. 잔여 위험 (Residual Risk)

- 수용됨(문서화): claude WebFetch의 로컬·사내 HTTPS 도달(후속 카드 t11), 선택 텍스트에 섞인 주입 지시(프롬프트 수준 완화만 존재), 구버전 codex가 `web_search` 키를 무시함(A3).
- 웹뷰가 침해되면 어떤 요청이든 `presetKind:"research"`를 직접 보낼 수 있다. 웹 허용이 "사용자가 메뉴를 눌렀을 때만"이라는 보장은 UI 수준이지 백엔드 수준이 아니다. 이는 `ai_request`의 기존 신뢰 모델과 같아 새 결함으로 세지 않았지만, t11 설계 때 같이 고려할 만합니다.
- 출처 알림은 "열어 본 기록이 없다"를 알릴 뿐 내용이 맞는지는 보증하지 않습니다(SPEC도 같은 입장).

## 결함 목록

| ID | 심각도 | 위치 | 한 줄 요약 |
|----|--------|------|-----------|
| F1 | SHOULD-FIX | `src-tauri/src/ai/codex_cli.rs:244-258` | 리서치 중 codex가 `turn.completed` 없이 끝나면 서술 문장이 최종 결과로 `ai://done`에 실림 |
| F2 | SHOULD-FIX | `CHANGELOG.md:8`, `docs/USER_GUIDE.md:245` | "출처 미검증 안내가 항상 붙는다"는 서술이 실제 동작과 다름 |
| F3 | MINOR | `.moai/specs/SPEC-AI-016-web-research/progress.md` §E.4 표 4행 | 비용·시간 수치의 출처를 "§E.2"로 적었으나 실제는 spec.md 실측표이며 sonnet $0.7·33초 상한은 정본 프롬프트 측정이 아님 |
| F4 | MINOR | `src/styles/mdedit-components.css`(누락), `ai-suggestion-card.ts:336,438` | 새 클래스 `.mdedit-ai-unverified-notice`·`.mdedit-ai-research-progress`에 스타일 없음 |
| F5 | MINOR | `acceptance.md:5`, `plan.md:5` | spec.md만 `implemented`이고 나머지 둘은 `status: draft` |
| F6 | MINOR | `src/lib/ai/researchSources.ts:30` | `https?://`만 추출해 `file:`·`ftp:` 등 다른 스킴 출처는 알림 대상이 아니고, `**URL**`은 `**`가 주소에 붙어 오탐 |
| F7 | MINOR | `src-tauri/src/ai/claude_cli.rs:329-333` 외 | 새 줄 일부가 rustfmt 기준과 다름(기존 코드도 동일 상태라 게이트는 아님) |
| F8 | MINOR | `src-tauri/src/ai/mod.rs:296-305` | `build_ai_request`에 넘기려고 `AssembledPrompt`를 다시 조립하고 `web_allowed`를 두 번 계산함 |
| F9 | MINOR | `progress.md` §E.2 | 인용한 게이트 로그 `.moai/logs/gate-*.txt`가 추적되지 않아 worktree 정리와 함께 사라지고, AC-014 프로브 원문은 아예 보관되지 않음 |

### F1 — SHOULD-FIX (확신도 중간)

- 위치: `codex_cli.rs:244-258`의 `if let Some(result) = last_message { … ai://done … }`.
- 설명: 리서치 모드에서는 `agent_message`가 청크로 나가지 않고 `last_message`에만 쌓인다. codex는 도구 호출 앞에 서술 메시지를 자주 낸다(캡처 `codex-nonresearch-hardened.jsonl` 3번째 줄: `"웹 검색 도구로 공식 출시일과 출처를 확인하겠습니다."`). 서술 메시지만 받고 프로세스가 `turn.completed` 없이 끝나면(네트워크 오류·CLI 종료 등), EOF 폴백이 그 서술을 정상 결과로 `ai://done`에 실어 보낸다. 비리서치에서는 같은 폴백이 의도된 동작이지만, 리서치에서는 서술이 곧 "결과 없음"이다. 카드는 서술 문장을 연구 결과처럼 보여 주고 「아래에 삽입」을 활성화하며, URL이 없으니 출처 알림도 뜨지 않는다. claude 쪽은 `result` 줄에서만 최종 결과를 얻으므로 해당 없음.
- 재현: 끝까지 재현한 것은 아님(AppHandle 필요). 근거 확인 명령 — `grep -n '"agent_message"' src-tauri/tests/fixtures/codex-nonresearch-hardened.jsonl | cut -c1-200` 로 서술 메시지(item_0)가 실제로 존재함을 보고, `sed -n 244,258p src-tauri/src/ai/codex_cli.rs` 로 폴백이 `research`를 보지 않음을 확인.
- 수정 지시: 리서치(`research == true`)일 때는 `turn.completed`를 본 경우에만 `last_message`를 결과로 쓰고, 그렇지 않으면 `decide_outcome` 오류 경로로 보낸다. 판정 부분을 순수 함수로 빼서 "서술 1건만 받고 EOF" 단위 테스트를 추가한다.

### F2 — SHOULD-FIX (확신도 높음)

- 위치: `CHANGELOG.md:8` ("앱이 출처를 검증한 것이 아니라는 안내(미검증 출처 고지)가 함께 붙습니다"), `docs/USER_GUIDE.md:245` ("출처는 앱이 검증한 것이 아니라는 안내가 붙습니다").
- 설명: 코드는 정적 안내를 두지 않는다. 안내 줄은 결과 속 주소가 "열어 본 목록"에 없을 때만 나온다(`ai-suggestion-card.ts:332-339`, `:1371-1375`). 테스트 `aiResearch.test.ts` "모두 열어 봤으면 줄이 없다"가 바로 그 반대 경우를 단언한다. 사용자가 "항상 경고가 붙는다"고 믿고 경고가 없을 때 안심하게 되는 것이 위험이다. README의 "출처는 검증되지 않았으니 직접 확인하세요"는 일반 조언이라 허용.
- 재현: `grep -n "검증되\|직접 확인\|확인하세요" src/components/editor/extensions/ai-suggestion-card.ts` → 정적 안내 문구 없음(주석 2건만).
- 수정 지시: 문서를 "AI가 직접 열어 본 기록이 없는 출처가 있으면 카드가 그 주소를 알려 줍니다"로 고친다(코드를 바꾸지 않는 쪽이 SPEC D7과 일치).

### F3 — MINOR

- `progress.md` §E.4 표 4행은 비용·소요 시간·권장 버전의 근거를 "§E.2 실측 기록"이라 적었으나 §E.2에는 그 수치가 없고 spec.md R1-C·R7·R14에 있다. 또 sonnet $0.7은 정본이 아닌 1차 프롬프트 측정(R1-C)이고, 33초는 서술을 유도한 R7 실험값이다(정본 측정은 haiku 25.4초·codex 20.5초). "약"이라는 표현 안에는 들어가지만 출처 표기를 바로잡는 것이 좋다.
- 재현: `grep -n '\$0\.7\|32\.6\|25\.4' .moai/specs/SPEC-AI-016-web-research/progress.md` → 0건, `spec.md` 에서는 82·88·95행.

### F4 — MINOR

- `.mdedit-ai-completion-notice`는 `mdedit-components.css:502`에서 흐린 색으로 꾸미지만 새 클래스 둘은 스타일이 없다. 형제 클래스 `.mdedit-ai-wait-notice`도 원래 스타일이 없어 완전히 어긋난 것은 아니나, 출처 경고는 안전 신호라 눈에 띄는 편이 낫다.
- 재현: `grep -n "research-progress\|unverified-notice" src/styles/mdedit-components.css` → 출력 없음.

### F5 — MINOR

- `grep -n "^status" .moai/specs/SPEC-AI-016-web-research/*.md` → `acceptance.md:5: status: draft`, `plan.md:5: status: draft`, `spec.md:5: status: implemented`.

### F6 — MINOR (스펙 D7 그대로라 구현 결함은 아님)

- 실제 관찰: `extractUrls('근거 **https://a.b/c** 및 [https://x.y](https://x.y/z) … [f](file:///etc/hosts) [j](javascript:alert(1)) *https://q.r/s*')` → `["https://a.b/c**","https://x.y","https://x.y/z","https://q.r/s*"]`. `findUnverifiedSources('[f](file:///etc/hosts) [j](javascript:alert(1)) **https://a.b/c**', ['https://a.b/c'])` → `["https://a.b/c**"]`. 즉 굵게 표시한 주소는 열어 봤어도 오탐이 나고, `file:`·`javascript:` 출처는 알림에 안 잡힌다. 미리보기가 두 스킴을 링크로 만들지 않으므로(2.2) 실질 위험은 낮다.
- 재현: `node --experimental-strip-types -e "import('./src/lib/ai/researchSources.ts').then(m=>console.log(JSON.stringify(m.extractUrls('**https://a.b/c**'))))"` (repo 루트).
- 수정 지시(선택): `BARE_STOP`에 `*`·`_`를 더하고 `https?://` 외 스킴은 별도 문구로 알린다.

### F7 — MINOR

- `rustfmt --check --edition 2021 src-tauri/src/ai/claude_cli.rs` 가 `claude_cli.rs:329-333`의 `app_handle.emit(` 줄바꿈 차이를 보고한다. 같은 명령이 기존 코드(`spawn_stdin_writer`, `spawn_claude`)에도 차이를 보고하고 `rustfmt.toml`·CI 게이트가 없어 강제 항목은 아니다.

### F8 — MINOR (선택)

- `mod.rs:296-305`: `ai_request`가 이미 있는 `assembled`를 해체해 `AssembledPrompt { …, truncated: false }`를 다시 만든 뒤 `build_ai_request`에 넘기고, `build_ai_request` 안에서 `feature.allows_web()`를 다시 계산한다. 같은 값을 두 번 구하는 구조라, `build_ai_request`가 문자열 둘과 `web_allowed`를 받도록 하면 더 단순하다. 동작에는 영향 없음.

### F9 — MINOR

- 게이트 로그는 `?? .moai/logs/`(미추적)라서 worktree를 정리하면 증거 경로가 풀리지 않는다. progress.md에 발췌는 인라인돼 있어 일부는 남지만, AC-014 프로브의 JSONL 원문은 "연결 앱 목록이 담길 수 있어" 보관하지 않았고 항목 개수 표만 남아 있다. 개수 표는 정직하게 적혀 있으나 재검증은 불가능하다.

## 정직성 점검 (progress.md §E.4·CHANGELOG)

- CHANGELOG의 "확인하지 못한 것" 5건은 progress.md 갭 목록과 일치하고, AC-015/016 미확인을 숨기지 않았다. `implemented`로 두고 `completed`로 올리지 않은 판단도 맞다.
- 추가로 갭 목록에 없는 것: (a) codex 중단 시 서술이 결과가 되는 경로(F1), (b) e2e 메뉴 위치 영향(G3), (c) Rust 커버리지 미측정(G2), (d) 안내 문구 서술 오류(F2).
- §E.4의 "spec.md 변경은 status 한 줄뿐"은 `git diff --stat 594bce0..HEAD`(spec.md 1줄)로 맞다고 확인했습니다. §E.2의 RED 증거는 "에이전트 보고 발췌"로 정직하게 표시돼 있으며 검증할 수 없었습니다.
- `sync_commit_sha` 필드는 §E.4에 없다. 상태가 `completed`가 아니라서 지금은 문제가 아니며, 완료 처리 때 채우면 됩니다.

## 권고

1. F1을 고친다(리서치에서는 `turn.completed` 없는 EOF를 결과로 치지 않기). 작고 국소적인 수정입니다.
2. F2의 문서 두 곳을 실제 동작에 맞게 고친다.
3. 사용자 수동 확인 AC-015(순서 A1 포함)·016을 마친 뒤 `completed`로 올린다.
4. 선택: F4·F6·F8은 다음 손볼 때 같이 처리해도 됩니다.
