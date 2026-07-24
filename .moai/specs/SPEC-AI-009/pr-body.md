# SPEC-AI-009 — codex CLI 두 번째 AI 프로바이더 통합

## 요약

OpenAI `codex` CLI를 mdedit의 두 번째 로컬 AI 프로바이더로 추가합니다. 이제 `claude`와 `codex` 중 하나라도 설치·로그인되어 있으면 AI 글쓰기 도우미가 동작합니다. 두 CLI가 모두 설치된 환경에서는 **claude가 우선**으로 자동 선택되며, 설정에서 수동으로 provider를 지정할 수 있습니다.

codex는 빈 스크래치 작업 디렉터리 + `--ignore-user-config` + `--skip-git-repo-check` + `--ephemeral` + `--sandbox read-only` + stdin 차단(`Stdio::null()`)으로 철저히 격리됩니다. `CODEX_HOME` 분리는 시도하지 않습니다 — 인증이 풀리는 부작용이 실측으로 확인되었습니다.

기존 `claude` 경로(인자 조립·스트림 파싱·프롬프트 조립·프론트엔드 IPC 계약)는 **0줄 변경**이며, 바이트 단위 회귀 스냅샷 테스트로 보증합니다.

## 변경 파일 목록

### 신규
- `src-tauri/src/ai/codex_cli.rs` — codex 프로바이더 구현(인자 조립·JSONL 파싱·감지·스폰)

### 수정
- `src-tauri/src/ai/provider.rs` — `AiProvider` trait 확장, `ProviderRegistry` 다중 프로바이더 + 자동 감지(claude > codex) + `providerId` 수동 오버라이드
- `src-tauri/src/ai/detect.rs` — `resolve_codex_binary`(PATH → 표준 위치) + `~/.codex/auth.json` 로그인 판정(claude `oauthAccount`과 대칭)
- `src-tauri/src/ai/stream.rs` — codex `--json` JSONL 이벤트 라우팅(`item.completed`/`turn.completed`)
- `src-tauri/src/ai/mod.rs` — provider 매핑(claude{haiku,sonnet} / codex{gpt-5.5})
- `src-tauri/src/ai/claude_cli.rs` — `#[cfg(test)]` 회귀 스냅샷 추가(프로덕션 코드 무변경, plan.md M1.1)
- `README.md`, `CHANGELOG.md`, `docs/USER_GUIDE.md` — 문서 동기화

## SPEC-AI-009 달성

- **REQ**: 27/27 (v0.0.2 기준)
- **AC**: 15/15 PASS
  - AC-AI9-015 (수동 통합): `~/.codex/AGENTS.md` 자동 로딩 차단 검증 — input_tokens 15,022(정상 범위), 마커 침투 0건

## 검증 결과

- `cargo test`: **308 passed** (회귀 스냅샷 포함)
- `cargo clippy`: 무경고
- AC: 15/15 PASS
- AGENTS.md 자동 로딩 차단: 수동 PASS(32K 토큰 폭발 회귀 없음)

## 호환성

- **claude 무변경**: 기존 `build_claude_args`, `parse_text_delta`, `ClaudeProvider`, `spawn_claude`, prompt.rs 조립 경로는 동일 입력에 대해 동일 출력(바이트 동등 회귀 테스트로 검증)
- **IPC 무변경**: 프론트엔드 `ai://chunk|done|error` 이벤트 계약, `aiAdvancedModel` 토글, `waitNotice.ts` 플레이스홀더, `GhostPlaceholderWidget` 모두 그대로 재사용. 신규 IPC 필드 0건(기존 `AiRequestArgs.providerId` 재사용)
- **프롬프트 무변경**: system + user 프롬프트 결합(`\n\n`)만 추가, 각 프롬프트 본문은 바이트 동등
- **의존성 무추가**: 런타임 의존성 신규 0건

## 사용자 영향

- **codex 사용자**: `npm install -g @openai/codex`(또는 codex CLI 설치) + codex 로그인 후 AI 기능 사용 가능. 별도 설정 없이 자동 감지.
- **claude 사용자**: 기존과 완전히 동일. 회귀 없음.
- **둘 다 있는 사용자**: claude가 우선 선택. codex로 강제하려면 `providerId: "codex"` 지정.

## Known Limitations / Future

- `m1 detect` 결과를 아직 캐싱하지 않아 매 요청마다 재감지 비용이 발생할 수 있음(차후 캐싱 예정)
- `typical_latency_ms`는 실측값이 아닌 추정치 — 벤치마크 SPEc 후속에서 다룰 예정
- provider 전환 UI는 v1에서 도입하지 않음(수동 오버라이드는 설정 값으로만)

## 제안 커밋 메시지

```
feat(ai): codex CLI를 두 번째 AI 프로바이더로 통합 (SPEC-AI-009)

- codex(`codex` CLI 0.144.1 검증)를 ProviderRegistry에 추가 — 두 CLI 중
  하나라도 설치·로그인되면 AI 글쓰기 도우미 동작
- 자동 감지 우선순위: claude > codex. 수동 오버라이드는 기존
  AiRequestArgs.providerId 재사용(신규 IPC 필드 0건)
- codex 격리: 빈 스크래치 cwd + --ignore-user-config +
  --skip-git-repo-check + --ephemeral + --sandbox read-only +
  Stdio::null(). CODEX_HOME 분리는 미사용(auth 풀림, 실측)
- codex --json JSONL 파싱: item.completed(agent_message) →
  ai://chunk 1회 emit, turn.completed → ai://done
- 무변경 가드: claude 경로(인자 조립·스트림 파싱·프롬프트·프론트
  IPC 계약) 0줄 변경, 바이트 동등 회귀 스냅샷으로 보증
- 검증: cargo test 308 passed, clippy 무경고, AC 15/15 PASS
  (AGENTS.md 자동 로딩 차단: input_tokens 15022, 마커 침투 0건)

Refs: SPEC-AI-009 v0.0.2 (27 REQ, 15 AC)
```
