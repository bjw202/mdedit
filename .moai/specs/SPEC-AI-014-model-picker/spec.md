---
id: SPEC-AI-014
title: "AI 모델 선택 — 고급 모델 토글을 도구별 모델 목록 선택으로 교체"
version: "0.1.4"
status: draft
created: 2026-11-13
updated: 2026-11-13
author: jw (bjw202)
priority: Medium
phase: "v0.22.0 target"
module: "src-tauri/src/ai/, src/"
lifecycle: spec-anchored
tags: "ai, model, settings, claude, codex, migration, validation"
tier: L
depends_on: [SPEC-AI-012, SPEC-AI-013]
related_specs: [SPEC-AI-001, SPEC-AI-005, SPEC-AI-009, SPEC-AI-010, SPEC-AI-015]
---

# SPEC-AI-014: AI 모델 선택

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-13 | jw | 최초 작성. 계기: 백로그 카드 t6(사용자 결정 2026-11-13). 계획 단계에서 코드와 두 CLI의 모델 목록을 직접 확인했다(research.md). 사용자가 잠든 동안 자율 진행 권한을 받아, 열려 있던 설계 선택은 기본값을 정해 design.md에 결정으로 기록했다. |
| 0.1.1 | 2026-11-13 | jw | plan-audit 1차(`.moai/reports/plan-audit/SPEC-AI-014-review-1.md`, FAIL 0.78) 반영. (D1, BLOCKING) 고스트 텍스트·이어쓰기 경로는 invoke 거부 메시지를 어디에도 표시하지 않는다는 사실을 코드에서 확인했다(`ai-ghost-text.ts` 상태 구독은 `error`에서 고스트만 지움). REQ-AI14-018을 새로 두어 그 경로의 거부 메시지를 상태 표시줄에 띄우고 AC-020을 더했다. (D2·D3) codex 조회가 동기 명령 안에서 UI를 막을 수 있다: `ai_detect_providers`를 비동기 명령으로 바꾸고(REQ-AI14-015), `ai_request`가 조회하는 조건을 좁히고 남는 멈춤을 알려진 한계로 적었다(REQ-AI14-014). (D4) M1 판정이 기본 설계와 다를 때 구현자가 spec.md를 고치지 않는다. 결과는 progress.md에 적고 차단 보고를 돌려주며, 개정은 manager-spec이 한다(REQ-AI14-016). (D5·D6) REQ-AI14-007의 라우팅 선택과 REQ-AI14-015의 목록 채우기에 AC를 더했다(AC-021, AC-016 보강). (D7) M1에서 `sonnet`이 빠지면 이전 규칙의 대상을 `haiku`로 한다(REQ-AI14-005). (D18) 고스트 ↻ 재시도도 원래 선택을 이어받는다고 REQ-AI14-017에 적었다. 나머지(D8~D17, D19)는 plan.md·acceptance.md·research.md의 사실·명령 정정이다. |
| 0.1.2 | 2026-11-13 | jw | plan-audit 2차(`.moai/reports/plan-audit/SPEC-AI-014-review-2.md`, PASS-WITH-DEBT 0.89) 반영. 캐시 잠금을 조회 대기 중에 잡지 않고 조회 중 표시로 중복 조회를 막으며, 조회가 필요 없는 검증은 잠금을 잡지 않는다(REQ-AI14-014). codex 미설치·미로그인이면 조회하지 않는다. 앱 시작 때 감지가 돌아 `CATALOG`이면 시작마다 조회한다는 사실과 멈춤 조건을 바로 적었다. 고스트 경로 네 명령 이름을 명시했다(REQ-AI14-018). §5에서 고스트 실행 오류는 표시되지 않음을 한계로, `models` 없는 요청이 CLI 기본값임을 의도로 적었다. AC-015·017·019·020·008, plan M0·A를 맞췄다. |
| 0.1.3 | 2026-11-13 | jw | plan-audit 3차(`.moai/reports/plan-audit/SPEC-AI-014-review-3.md`, PASS 0.91)의 MINOR 3건 반영. 조회 생략 시 캐시를 비워 둔다는 점과 목록 미확정 상태의 거부 문구를 REQ-AI14-014에 더했고, 알려진 한계 문장의 조회 조건을 규칙(캐시 비어 있음·진행 중 조회 없음)과 맞췄다. AC-019의 `ps`를 `-axww`로 바꿨다. |
| 0.1.4 | 2026-11-13 | jw | 코디네이터 지시(task_e6046de4fcf8): SPEC-AI-013(t5, 계획 커밋 9b6f82f)이 두 CLI의 프롬프트를 표준 입력으로 넘기기로 정했고 t5 run이 먼저 병합된다. REQ-AI14-011의 "codex는 stdin을 막는다" 서술을 t5 이후 상태(claude 사용자 프롬프트=stdin·`--system-prompt-file`, codex 결합 프롬프트=stdin·위치 인자 없음)로 고쳤다. design.md D-2 시험 요청 모양, plan.md §E 겹침 표, acceptance.md AC-010을 같이 맞췄다. 요구사항 수와 의미(모델·추론 설정)는 그대로다. |

## §1 Overview

### 배경

- 지금 앱은 모델을 두 값(`haiku`, `sonnet`)으로만 다룬다. 설정의 "고급 모델 사용" 체크박스가 켜지면 claude는 `sonnet`, 꺼지면 `haiku`를 쓴다. codex는 두 경우 모두 `gpt-5.5`이고 추론 강도만 `medium`/`high`로 바꾼다.
- 제안 카드는 재요청 3회를 다 쓰면 "⚡ 고급 모델로 다시 시도" 버튼으로 한 번만 `sonnet`을 쓴다.
- 문제 네 가지:
  1. 모델이 자주 바뀌는데(두 CLI 모두 업데이트가 잦다) 앱이 모델 이름을 코드에 박아 두었다. codex의 `gpt-5.5`는 이 계정의 모델 목록에 이미 없다(research.md §2).
  2. 백엔드가 모르는 모델 문자열을 받으면 조용히 `haiku`로 바꾼다(`provider.rs` `AiModel::from_opt`). 사용자는 다른 모델이 돌았다는 사실을 알 수 없다.
  3. 같은 이름의 `resolveModel`이 두 곳에 시그니처만 다르게 있고(`SettingsModal.tsx:47`, `ai-selection-toolbar.ts:177`), `'haiku'`·`'sonnet'` 문자열이 제안 카드 곳곳에 하드코딩되어 있다.
  4. 앱이 추론 강도를 직접 정한다(codex `-c model_reasoning_effort`, claude haiku의 `MAX_THINKING_TOKENS=0`).

### 사용자 결정 (2026-11-13, 백로그 카드 t6)

- "고급 모델 사용" 체크박스와 "⚡ 고급 모델로 다시 시도" 버튼을 없앤다.
- 도구(claude, codex)마다 모델을 **목록에서 고른다**. 사용자가 모델 이름을 직접 입력하는 칸은 없다.
- 추론 강도는 CLI 기본값을 따르고 따로 고르지 않는다.
- codex 목록은 `codex debug models`로 조회하고 실패하면 고정 목록을 쓴다. claude 목록은 고정 별칭(haiku, sonnet, opus, fable)이다.
- 고정 목록만으로 충분한지는 **실제 요청으로 시험해** 정한다. 후보 모델마다 작은 요청을 한 번씩 보내는 비용은 받아들인다.

### 해법의 형태

- 설정의 AI 도구 행 아래에 도구별 모델 드롭다운을 둔다. 첫 항목은 "CLI 기본값"(앱이 `--model`을 넘기지 않음)이고, 그 아래가 그 도구의 모델 목록이다.
- 요청은 두 도구의 선택을 함께 실어 보내고, 백엔드는 실제로 라우팅된 도구의 선택을 쓴다(자동 모드에서도 같다).
- 백엔드는 목록에 없는 모델을 거부하고 이유를 알린다. 조용한 대체는 없다.
- 실제 요청 시험(M1)이 먼저다. 그 결과로 claude 고정 목록과 codex 목록 출처를 확정한다(§2 REQ-AI14-016).

### Tier 판단

- **Tier L.** 실행 코드 파일은 14개(백엔드 6개, 새 파일 1개 포함; 프런트엔드 8개)이고 단위 테스트 파일이 약 10개 바뀌어, 영향 파일이 약 24개로 Tier M 상한(15개)을 넘는다. 코드 줄 수는 테스트를 포함해 약 600~900줄로 추정해 Tier M 범위다. 높은 쪽인 L로 분류했다.
- 다만 도메인은 하나의 기능(모델 선택)이고 백엔드→프런트엔드 순서 의존이 있어, run은 마일스톤을 차례로 진행하는 방식이 맞다(plan.md §F).

## §2 Requirements (GEARS)

### 제거

#### REQ-AI14-001: 고급 모델 토글과 단발 버튼을 없앤다 (Unwanted)

- The 앱 shall not "고급 모델 사용" 체크박스를 설정에 표시한다.
- The 제안 카드 shall not "⚡ 고급 모델로 다시 시도" 버튼을 표시한다. 재요청 소진(retry-exhausted) 상태의 안내 문구와 방향 지시 입력칸은 그대로 둔다.

#### REQ-AI14-002: 모델 지식의 중복을 없앤다 (Ubiquitous)

- The 프런트엔드 shall 현재 모델 선택을 읽는 함수를 하나만 둔다. 두 `resolveModel`은 없어진다.
- The 프런트엔드 실행 코드(테스트 제외) shall `'haiku'`·`'sonnet'` 같은 모델 이름 문자열을 저장소 기본값과 저장 상태 이전(migration) 코드에만 둔다.
- The 백엔드 shall 두 값 enum `AiModel`과 그 매핑 함수들(`AiModel::as_arg`, `AiModel::from_opt`, `codex_model_arg`, `codex_reasoning_effort`, `codex_effort_display`, `codex_advanced_model_label`, `claude_advanced_model_label`, `claude_thinking_env`)을 없애고, 모델 목록과 검증을 한 모듈(`src-tauri/src/ai/models.rs`)에 모은다.

### 선택과 저장

#### REQ-AI14-003: 도구별 모델 드롭다운 (Ubiquitous)

- The 설정 AI 섹션 shall claude와 codex 각각에 대해 모델 드롭다운 하나를 표시한다. 선택지는 "CLI 기본값" 하나와 그 도구의 모델 목록(REQ-AI14-012, 013)이다.
- The 모델 선택 UI shall 자유 입력칸을 두지 않는다.
- **While** 조직 정책으로 AI가 잠겨 있거나 그 도구 행이 사용 불가(미설치·미로그인)인 동안, the 그 도구의 드롭다운 shall 비활성화된다.

#### REQ-AI14-004: 기본값 (Ubiquitous)

- The 저장소 초기값 shall claude는 `haiku`, codex는 "CLI 기본값"이다.
- 사유: claude는 지금의 기본 속도·비용을 유지한다. codex는 앱이 이름을 박아 둔 `gpt-5.5`가 계정 목록에서 빠진 사례가 있어, CLI가 정하는 기본 모델을 따르는 편이 목록 변화에 강하다(design.md D-3).

#### REQ-AI14-005: 저장과 이전 (Event-driven)

- The 선택 shall `uiStore`에 도구별 값(`aiModels`)으로 영속된다. "CLI 기본값"은 `null`로 저장한다.
- **When** 저장 상태의 버전이 3 미만이면, the 저장소 shall `aiAdvancedModel`을 지우고 `aiModels`를 만든다. `aiAdvancedModel === true`이면 claude는 `sonnet`, 그 밖(거짓·없음)이면 `haiku`다. 단, M1에서 `sonnet`이 claude 목록에서 빠지면 `true`도 `haiku`로 옮긴다(모든 요청이 거부되는 상태를 만들지 않기 위해). codex는 `null`이다. 다른 설정은 그대로 둔다.
- **When** 저장된 `aiModels`의 모양이 틀리면(객체가 아님, 값이 문자열도 `null`도 아님), the 저장소 shall 그 항목만 기본값으로 되돌린다.

#### REQ-AI14-006: 목록에 없는 저장값을 숨기지 않는다 (Unwanted)

- The 설정 shall not 목록에 없는 저장값(예: CLI 업데이트로 사라진 모델)을 다른 값으로 조용히 바꾼다. 그 값을 "`<모델>` (목록에 없음)" 선택지로 보여 주고 선택된 상태로 둔다. 저장값은 사용자가 다른 항목을 고를 때만 바뀐다.

### 요청과 검증

#### REQ-AI14-007: 요청은 두 도구의 선택을 함께 싣는다 (Ubiquitous)

- The 모든 AI 요청(✨ 툴바, 고스트 텍스트·이어쓰기, 제안 카드 재요청) shall `ai_request` 인자에 `models: { claude, codex }`를 싣고, 기존 `model` 필드는 싣지 않는다.
- The 백엔드 shall 라우팅으로 정해진 도구(명시 선택이든 자동 감지든)의 항목만 쓴다.

#### REQ-AI14-008: 모르는 모델은 거부한다 (Unwanted + Event-driven)

- The 백엔드 shall not 라우팅된 도구의 허용 목록에 없는 모델로 CLI를 실행하거나, 그 모델을 다른 모델로 바꿔 실행한다.
- **When** 요청의 모델이 허용 목록에 없으면, the `ai_request` shall CLI를 실행하지 않고 오류를 돌려준다. 메시지는 모델 이름과 도구 표시명을 담고 설정에서 다시 고르라고 안내한다(예: "Codex에서 `gpt-5.5` 모델을 쓸 수 없어요. 설정 > AI에서 모델을 다시 골라 주세요."). 이 오류는 ✨ 툴바와 제안 카드 경로에서는 기존 invoke 거부 경로로 카드에 표시되고, 고스트 텍스트·이어쓰기 경로에서는 REQ-AI14-018대로 표시된다.
- 허용 목록 = claude는 고정 목록, codex는 (캐시된 조회 목록 ∪ 고정 목록). "CLI 기본값"(`null`)은 항상 허용된다.

#### REQ-AI14-009: CLI 기본값이면 `--model`을 넘기지 않는다 (State-driven)

- **While** 라우팅된 도구의 선택이 `null`인 동안, the CLI 인자 shall `--model`과 그 값을 담지 않는다. 그 밖에는 `--model <선택값>` 한 쌍을 담는다(모델 값은 별도 인자 원소이며 셸을 거치지 않는다).

#### REQ-AI14-010: 추론 강도는 CLI 기본값이다 (Unwanted)

- The codex 인자 shall not `-c model_reasoning_effort=…`를 담는다.
- The claude 프로세스 shall not 어떤 모델에서도 `MAX_THINKING_TOKENS` 환경 변수를 설정한다(haiku 포함, design.md D-5).

#### REQ-AI14-011: 격리 플래그는 그대로다 (Ubiquitous)

- The claude 인자 shall SPEC-AI-013 병합 후 상태 그대로 `-p`, `--system-prompt-file <app_data>/ai-prompt/system-prompt.txt`, `--setting-sources ""`, `--tools ""`, `--output-format stream-json`, `--include-partial-messages`, `--verbose`를 담는다. The codex 인자 shall `exec`, `-C <스크래치>`, `--ignore-user-config`, `--skip-git-repo-check`, `--ephemeral`, `--sandbox read-only`, `--json`을 담고 위치 인자(프롬프트)는 없다.
- The 프롬프트 전달 shall SPEC-AI-013이 정한 대로 둔다: claude는 사용자 프롬프트를, codex는 결합 프롬프트를 표준 입력으로 쓰고(전용 스레드, 다 쓴 뒤 EOF) 사용자 텍스트는 인자에 넣지 않는다. 이 SPEC은 모델 인자(`--model`)와 추론 설정만 바꾼다.

### 목록 출처

#### REQ-AI14-012: claude 목록은 고정 별칭이다 (Ubiquitous)

- The claude 모델 목록 shall `models.rs`의 고정 별칭 목록 하나다. 후보는 `haiku`, `sonnet`, `opus`, `fable`이고, M1에서 실제 요청이 실패한 별칭은 목록에서 뺀다(REQ-AI14-016). 표시 이름은 별칭의 첫 글자를 대문자로 바꾼 것이다(예: `Opus`).

#### REQ-AI14-013: codex 목록은 조회하고 실패하면 고정 목록이다 (Where + Event-driven)

- **Where** M1 판정이 `CATALOG`이면: **When** codex 목록이 필요하면, the 백엔드 shall `codex debug models`(`--bundled` 없음)를 codex 실행 파일 절대 경로로 실행해 JSON을 읽고, `visibility`가 `"list"`인 항목만 `priority` 오름차순으로 `{ id: slug, label: display_name }` 목록을 만든다. 실행 실패, 0이 아닌 종료 코드, 3초 시간 초과, JSON 해석 실패, 결과 0개, codex 미설치이면 고정 목록을 쓴다. 시간 초과 시 자식 프로세스를 종료한다.
- **Where** M1 판정이 `FIXED-ONLY`이면: the codex 목록 shall 고정 목록 하나이며, 앱은 `codex debug models`를 실행하지 않는다.
- The codex 고정 목록 shall M1에서 실제 요청에 성공한 모델로 정한다(REQ-AI14-016).

#### REQ-AI14-014: 조회 결과는 캐시한다 (State-driven)

- **Where** M1 판정이 `CATALOG`이면:
  - The 성공한 조회 목록 shall 앱 프로세스가 끝날 때까지 메모리에 캐시되고 다시 조회하지 않는다.
  - **While** 마지막 결과가 고정 목록(조회 실패)인 동안, `ai_request`의 검증은 그 결과를 다시 쓰고(요청마다 조회하지 않는다), `ai_detect_providers`는 조회를 다시 시도한다.
  - **When** `ai_request`가 검증할 때, the 백엔드 shall 다음이 모두 참일 때만 조회한다: 라우팅된 도구가 codex이고, 선택값이 `null`이 아니며, 그 값이 고정 목록에 없고, 캐시가 비어 있다. 그 밖에는 조회하지 않는다. 한 요청에서 조회는 많아야 한 번이다.
  - The 캐시 잠금 shall 하위 프로세스를 기다리는 동안 잡혀 있지 않다. 동시에 두 번 조회하지 않도록 조회 중 표시를 둔다. **While** 다른 조회가 진행 중인 동안, `ai_request`의 검증은 기다리지 않고 그 순간의 허용 목록(캐시가 비었으면 고정 목록)으로 판정한다. 조회가 필요 없는 검증(claude, `null`, 고정 목록 모델)은 캐시 잠금을 잡지 않는다.
  - **Where** codex가 설치·로그인되지 않았으면, the 백엔드 shall 조회하지 않고 고정 목록을 쓴다. 이 경우 캐시는 비운 채로 두어(실패로 기록하지 않음) 로그인 뒤 다음 감지나 요청 검증에서 조회한다.
  - **When** codex 목록이 아직 확정되지 않은 상태(조회 진행 중, 캐시 비어 있음, 마지막 조회 실패)에서 고정 목록에 없는 모델을 거부하면, the 오류 메시지 shall "모델 목록을 아직 확인하지 못했어요. 잠시 뒤 다시 시도하거나 설정 > AI에서 모델을 확인해 주세요."처럼 목록 미확정을 알린다. 목록이 확정된 상태의 거부만 "쓸 수 없어요" 문구(REQ-AI14-008)를 쓴다.
  - 알려진 한계: 앱 시작 때 `AppLayout`이 `ai_detect_providers`를 부르므로(`AppLayout.tsx:65`), `CATALOG`이면 codex가 설치·로그인된 기기에서 앱을 켤 때마다 `codex debug models`가 백그라운드로 한 번 돈다(이 기기 0.57초, 네트워크 사용). `ai_request`가 동기 조회를 하는 경우는 캐시가 비어 있고 진행 중인 조회가 없으며 고정 목록에 없는 codex 모델을 저장해 둔 경우뿐이다(예: 시작 감지가 돌기 전의 요청, 앱 시작 때 codex가 미로그인이었다가 나중에 로그인한 경우). 그때 최대 3초 멈출 수 있다. 시작 직후 조회가 진행 중인 짧은 동안에는 고정 목록에 없는 모델이 목록 미확정 문구로 거부될 수 있다(위 규칙).

#### REQ-AI14-015: 목록은 감지 결과로 전달한다 (Ubiquitous)

- The `ai_detect_providers` 결과 shall 도구마다 `models: [{ id, label }]`을 담고, `advancedModelLabel` 필드는 없어진다.
- The `ai_detect_providers` shall 비동기 명령(`async fn`)으로 바뀌어, 감지와 목록 조회가 UI 스레드를 막지 않는다. 사유: 동기 Tauri 명령은 메인 스레드에서 돈다(감사 1차 D2).
- The 트레이트 `AiProvider::detect()` shall 목록을 조회하지 않는다. 사유: 자동 모드에서 요청마다 `detect()`가 불리므로(`provider.rs` `first_available`), 거기서 조회하면 요청마다 프로세스가 하나 더 뜬다. 목록은 명령 계층에서 붙인다.

### 실측

#### REQ-AI14-016: 실제 요청 시험을 먼저 한다 (Event-driven, run 첫 마일스톤)

- **When** run 단계가 시작되면, the 구현자 shall 실행 코드를 바꾸기 전에 후보 모델마다 작은 요청을 한 번 보내 결과를 기록한다(plan.md M1, 절차와 판정 규칙은 design.md D-2). 후보는 claude 별칭 4개와 `--model` 없음, codex는 조회 목록과 내장(`--bundled`) 목록의 `list` 항목 합집합과 `--model` 없음이다.
- 기록은 표(모델, 종료 코드, `OK` 포함 여부, 오류 요약, 소요 시간)와 판정 줄 다섯 개다(`codex-list-verdict: CATALOG|FIXED-ONLY`, `claude-aliases`, `codex-fixed-list`, `codex-default`, `haiku-thinking`). 양식은 research.md §M1에 있다.
- The 기록 위치 shall `progress.md` §E.2의 "M1 실측" 절이다(구현자는 spec.md·plan.md·acceptance.md 본문을 고치지 않는다).
- **When** 판정이 기본 설계(`CATALOG`, 별칭 4개 전부 통과, codex `--model` 없음 성공)와 다르면, the 구현자 shall M2를 시작하지 않고 차단 보고를 돌려준다. 코디네이터가 manager-spec에 개정(HISTORY 행, 해당 REQ·AC 조정)을 맡기고, plan-auditor 재감사를 통과한 뒤 M2를 시작한다.
- **When** 판정이 기본 설계와 같으면, the 구현자 shall 개정 없이 M2로 간다. 고정 목록 값은 progress.md 기록을 그대로 `models.rs`에 옮긴다.

### 재요청

#### REQ-AI14-017: 재요청은 원래 요청의 선택을 이어받는다 (Ubiquitous)

- The 제안 카드의 모든 재요청(↻ 방향 지시, ↻ 다시, 다시 시도, 다시 요청, 표·다이어그램 검증 실패 자동 재시도, 목록 폴백) shall 원래 요청의 `models`를 그대로 싣는다. 카드에는 모델을 바꾸는 경로가 없다.
- The 고스트 텍스트 ↻ 재시도(`lastGhostTrigger` 재발행) shall 원래 요청의 `models`를 그대로 싣는다. 재시도 사이에 설정을 바꿔도 새 고스트 요청부터 반영된다.

### 오류 표시

#### REQ-AI14-018: 고스트 경로의 요청 거부를 숨기지 않는다 (Event-driven)

- **When** 고스트 경로 네 명령(`startSectionFillCommand` 섹션 채우기, `startContinueWritingCommand` 이어쓰기, `startFreeContinueWritingCommand` 자유 위치 이어쓰기, 고스트 ↻ 재시도)의 `ai_request` 호출이 거부되면(`aiRequest(...)` 프라미스 거부, 모델 검증 오류 포함), the 앱 shall 거부 메시지(`ipcErrorMessage(e)`)를 상태 표시줄(`uiStore.setStatusMessage`)에 띄운다. 지금처럼 `failRequest`도 부른다.
- 사유: 지금 이 경로는 거부되면 고스트만 지우고 이유를 보여 주지 않는다(`ai-ghost-text.ts` 상태 구독의 `error` 분기). 조용한 대체를 없앤 뒤에 거부 이유까지 숨으면 사용자는 아무 일도 안 일어난 것으로 본다.
- 범위: invoke 거부만 다룬다. 실행 뒤 `ai://error`로 오는 오류(로그인·네트워크 등)의 고스트 표시는 바꾸지 않는다. 상태 표시줄 메시지는 기존 규칙대로 2초 뒤 사라진다(알려진 한계).

## §3 Acceptance Criteria

acceptance.md에 있다(AC-001~AC-021). 요약: Rust `cargo test`, vitest, grep 검사로 된 자동 항목 19개, M1 실측 기록 확인 1개(AC-017), macOS 실기기 수동 확인 1개(AC-019). codex 목록 출처에 관한 AC-013~015는 M1 판정에 따라 적용 범위가 갈린다.

## §4 REQ → AC 대응

acceptance.md § 추적표를 따른다.

## §5 Constraints and Assumptions

### 선행 SPEC과 순서

- run 시작 전에 SPEC-AI-012와 SPEC-AI-013이 `main`에 병합되었는지 확인한다(이 계획의 기준 커밋에는 두 SPEC 디렉터리가 아직 없다). 확인 방법과 겹침 재확인은 plan.md §C M0다.
- SPEC-AI-013(t5)은 `claude_cli.rs`·`codex_cli.rs`의 프롬프트 전달 방식과 `ai/mod.rs`를 바꾸고, SPEC-AI-012(t4)는 `prompt.rs`와 `ai-suggestion-card.ts`를 바꾼다. 이 SPEC은 두 SPEC이 `main`에 병합된 뒤 그 위에서 run을 시작한다. 겹치는 함수 목록은 plan.md §E다.
- SPEC-AI-015(t7)는 `ai-selection-toolbar.ts`의 직접 입력 UI를 바꾼다. 이 SPEC이 고치는 함수(`resolveModel`, `AiToolbarUiState`, `fire()`의 모델 줄, `createAiSelectionToolbar` 상태 조립)와는 다르지만 같은 파일이다.

### 가정 (측정하지 않은 것)

- `codex debug models`의 출력 JSON 모양(`models[].slug`, `display_name`, `visibility`, `priority`)이 앞으로도 유지된다고 본다. 바뀌면 해석이 실패하고 고정 목록으로 떨어진다(조용한 오동작이 아니라 목록 축소).
- 조회는 이 기기에서 0.57초 걸렸다(research.md §2). 다른 네트워크 환경의 소요 시간은 재지 않았다. 3초 시간 초과는 그 가정 위의 값이다.
- claude CLI는 별칭과 전체 이름을 모두 받는다(`claude --help`). 별칭이 가리키는 실제 모델은 CLI 버전에 따라 바뀔 수 있고, 앱은 그것을 따른다.

### 알려진 한계 (수용)

- haiku에서 `MAX_THINKING_TOKENS=0`을 빼면 응답이 느려질 수 있다. M1이 고스트 텍스트 길이의 요청으로 차이를 재서 기록한다. 기록과 상관없이 이 SPEC은 사용자 결정(CLI 기본값)을 따른다(design.md D-5, §7).
- 목록에 있어도 계정 등급 때문에 실제 요청이 실패하는 모델은 CLI 실행 뒤 `ai://error`로 실패한다. ✨ 툴바·카드 경로는 오류 카드로 보이지만, 고스트 경로는 지금처럼 고스트만 지워지고 이유가 표시되지 않는다(REQ-AI14-018은 invoke 거부만 다룬다, `useAiRelay.ts` 69-74행). 앱은 요청 전에 모델별 가용성을 시험하지 않는다(요청마다 비용이 들기 때문).
- `models` 필드 없이 온 요청은 두 도구 모두 "CLI 기본값"으로 처리한다(claude도 haiku가 아니라 CLI 기본 모델). 앱 프런트엔드는 항상 `models`를 싣으므로 실제로는 생기지 않으며, 의도한 동작이다(AC-021).

## §6 Exclusions (What NOT to Build)

### Out of Scope — 입력·추론 선택 UI

- 모델 이름 직접 입력, 추론 강도 선택 UI(사용자 결정).

### Out of Scope — 기능별 모델

- 기능별(고스트 텍스트, 다이어그램 등)로 다른 모델을 고르는 기능. 도구당 하나다.

### Out of Scope — 목록 부가 기능

- 목록 출처 표시("조회됨/기본 목록")와 수동 새로고침 버튼.
- `codex debug models --bundled` 사용. 내장 목록은 계정 목록과 다르다(research.md §2).

### Out of Scope — 자동 모드 감지 비용

- 자동 모드에서 요청마다 도구별 `--version`을 실행하는 동작(`provider.rs` `first_available`) 개선. 관찰만 기록한다(research.md §4).

## §7 Open Questions

- (Q1) haiku 사고 예산: 결정은 "제거"(design.md D-5). M1에서 고스트 텍스트 첫 응답이 크게 느려진 것으로 나오면 코디네이터가 사용자에게 알릴 수 있도록 M1 보고에 수치를 적는다. 되돌리는 결정은 이 SPEC 범위 밖이다.
- (Q2) codex 기본값 "CLI 기본값": `--ignore-user-config` 때문에 사용자의 `~/.codex/config.toml` 모델 설정이 아니라 codex 내장 기본 모델이 쓰인다. M1이 그 요청의 성공 여부를 기록한다. 실패하면 판정 규칙(design.md D-2 R4)대로 기본값을 바꾼다.

## §8 References

- 백로그 카드 t6(2026-11-13), 코디네이터 브리프 `task_7390d0d3dbfb`.
- 코드 위치: research.md §3.
- 선행·관련: SPEC-AI-001(REQ-AI-016 고급 모델 토글), SPEC-AI-009(codex 어댑터, REQ-AI9-045~053 고급 티어 라벨), SPEC-AI-010(재요청 5종), SPEC-AI-012, SPEC-AI-013, SPEC-AI-015.
