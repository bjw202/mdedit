---
name: project-spec-ai-009-state
description: SPEC-AI-009(codex CLI 두 번째 AI 프로바이더 통합) 구현물 회의 평가 완료 — 2026-07-24
metadata:
  type: project
---

SPEC-AI-009 "codex CLI 두 번째 AI 프로바이더 통합" 평가 완료 (2026-07-24, 아직 main에 미머지 상태 — 작업 디렉토리에 수정분 staged 안 됨).

구현 핵심 (src-tauri/src/ai/):
- `codex_cli.rs` 신규 504줄 (CodexProvider, build_codex_args, spawn_codex, relay_codex_process)
- `default_registry()`가 claude+codex 2개 등록 (claude_registry() 리네임)
- `first_available()`이 installed && logged_in 첫 provider 선택 (route 분기)
- codex는 `--ignore-user-config --sandbox read-only --ephemeral --skip-git-repo-check` + 빈 cwd + Stdio::null()로 격리
- CODEX_HOME env setter는 코드에 없음 (REQ-AI9-008 준수)
- agent_message 1회 emit + turn.completed에서 done (또는 chunk 후 EOF 폴백 REQ-AI9-013a)
- claim_terminal(finished AtomicBool) 단일발행이 codex 경로에도 동일 적용

**Why:** SPEC-AI-001~008 시리즈(claude 단일 프로바이더)의 자연스러운 확장. provider.rs가 본 확장을 전제로 trait을 확정했으므로 codex 어댑터만 추가하는 구조.
**How to apply:** 이 SPEC 이후 새 provider를 추가할 때는 `match provider_id { ... }` 폴백(claude_cli.rs:239-260)이 `_` 와일드카드로 codex가 아닌 모든 provider를 claude 파서로 라우팅한다는 점 주의. 새 provider 추가 시 이 match 분기에 새 케이스를 명시하지 않으면 silent breakage 발생.

평가 결함 중 주요 것: (1) match _ 폴백의 확장성 결함(major), (2) first_available() 매 요청마다 detect() 외부 프로세스 spawn하는 성능 문제(minor-moderate), (3) parse_codex_turn_completed의 type=="event" 검사 누락(minor, 비대칭). [[skeptical-eval-request-style]]
