# SPEC-AI-001 세션 핸드오프 (2026-07-16)

컨텍스트 클리어 전 상태 스냅샷. 다음 세션은 이 문서 + progress.md + tasks.md로 재개.

## 현재 위치

- **브랜치**: `feature/SPEC-AI-001-cli-inline-edit`
- **커밋 상태**: SPEC 문서만 커밋됨(c1e2f77). **구현 전체는 워킹 트리에 미커밋** — 사용자 확인 후 커밋하기로 결정된 상태.
- **GitHub Issue**: #13 (SPEC 연동 완료)
- **구현**: 19태스크(T-001~T-019) 전부 완료. 게이트: vitest 859 / cargo 212 / tsc 0 / clippy 클린(내 코드) / Playwright 회귀 0 / 신규 의존성 0.
- **품질 검증**: evaluator-active PASS 0.93 · TRUST 5 PASS (CRITICAL 0 / WARNING 4 비차단).

## 실기기 버그 체인 — 3건 전부 해결됨 ✅

1. ✅ 감지 실패 (GUI PATH에 ~/.local/bin 부재 + Keychain 로그인 오판) → detect.rs 절대경로 해석 + `~/.claude.json`의 `oauthAccount` 신호로 수정, 재검증 완료
2. ✅ 프리셋 클릭 무반응 → 근본 원인: **block widget을 ViewPlugin decorations로 공급(CM6 금지)** → RangeError 침묵 전파. StateField 이관으로 수정 (aiSuggestionCardRender.test.ts)
3. ✅ "요청을 시작할 수 없어요" invoke 거부 → 근본 원인: **Tauri 인자 래핑 불일치** — ipc.ts가 평면 spread로 보냈으나 Rust `fn ai_request(args: AiRequestArgs)`는 `{ args: {...} }` 요구. `invoke('ai_request', { args })`로 수정(ai_cancel 동일), invoke 거부 사유를 카드에 노출(ipcErrorMessage, P7). Rust 측에 래핑 계약 가드 테스트 추가.

최종 게이트: **vitest 860 / cargo 213 / tsc 클린** (오케스트레이터가 aiRelay 12/12 + ipc.ts `{ args }` 직접 재검증 완료).

## 재개 절차 (권장)

1. **사용자 실기기 재확인이 첫 단계**: `npm run tauri dev` 재시작(Rust 변경 포함이라 재빌드) → 프리셋 클릭 → 스트리밍 카드 → 제안 → 바꾸기/Cmd+Z, 섹션 채우기(고스트), 설정 모달. 버그 3건 수정 후 실기기 확인은 아직 안 됨.
2. 확인 완료 → 전체 커밋 (conventional commit, `Fixes #13`, .md 포맷터 이슈 있으므로 add+commit 단일 Bash 호출)
3. `/moai run SPEC-AI-001` 재개는 불필요(구현 완료) → 바로 `/moai sync SPEC-AI-001` (문서 동기화 + PR)

## 후속 권고 (비차단, sync 후 또는 후속 SPEC)

- `ai-suggestion-card.ts` 920줄 분할, 테스트 전용 export 2건(`getActiveCardController`, `clearCardRegistry`) 정리
- `vitest run --coverage`로 커버리지 수치 확정 (85% 목표)
- 수동 이월 3건: Windows 단축키(Ctrl) 실측, 저사양+백신 스폰 지연 실측, 실제 CLI 스트리밍 체감 확인
- mermaid render 예외 무음 처리(ai-suggestion-card.ts ~:802) 사용자 인지 개선
- M2(자유 이어쓰기)/M3(AI 패널)/M4(codex)는 후속 SPEC — 설계서 v0.4 §10

## 주의사항

- **`git stash list`에 "v0.5.0 prep" 백업 stash 존재 — 절대 blind pop 금지** (이번 세션에서 사고 1회 발생·복구됨)
- `npm run lint`는 eslint config 부재로 상시 실패 — 게이트 아님
- 실질 게이트: `npx tsc --noEmit` + `npx vitest run` + `cargo test` + `cargo clippy`
- IPC 계약(고정): camelCase, feature 'inline-edit'|'section-fill'|'diagram' + presetKind, ai://chunk|done(truncated?)|error(kind: login|network|parse|other, cancelledBy?) — 상세는 progress.md
- 실행 정책: 메인(Fable)=오케스트레이션, 구현 서브에이전트=Opus

## 산출물 위치

- 설계서: `.moai/design/ai-features-mvp-design.md` (v0.4) / 시뮬레이션: `ai-features-mvp-simulation-report.md`
- SPEC: `.moai/specs/SPEC-AI-001/` (spec v0.1.1, plan, acceptance, spec-compact, research, tasks, progress)
- 감사: `.moai/reports/plan-audit/SPEC-AI-001-review-{1,2}.md` (2차 PASS 0.93)
