# SPEC-PREVIEW-019 progress.md

## Phase Notes (plan)

- 사용자 결정(2026-11-09, 오케스트레이터 경유): 100% 초과 확대는 선명해야 함(최우선), 방식은 srcdoc, 보안 SPEC(SPEC-SEC-001)과 병행 계획·구현은 SEC-001 이후. Q1=A(셸 CSP `script-src`에 고정 주입 스크립트 sha256 1개, `unsafe-inline` 금지, 페이지 자체 스크립트는 선명 모드에서 차단됨을 제약으로 명시), Q2=토글 포함(기본 선명 모드, 헤더 '원본 보기', 전역 영속 `htmlRenderMode`).
- 코디네이터 기본값(열린 질문, spec.md §7-1): 원본 보기에서는 018 동작 유지(transform 배율, 100% 초과 흐림). 해시-스크립트 일치 테스트를 AC에 포함(AC-006).
- plan 단계 확인(2026-11-09, origin/main 57b3231): 018 spec/plan/acceptance/progress, 기각된 018 v0.4.0 문서, review-3, advisor 처방 전문, `HtmlFileViewer.tsx`, `uiStore.ts`, `Header.tsx`, `ipc.ts`, `file_ops.rs`, `index.html` 메타 CSP, `tauri.conf.json`.
- 실측: Chromium에서 셸 메타 CSP가 sandbox srcdoc iframe의 인라인 스크립트를 차단함(대조군 실행됨). WebKit·WebView2 미실측.
- Tier M. 산출물: spec.md / plan.md / acceptance.md / progress.md. 활성 REQ 12·AC 15.
- 병행 SPEC-SEC-001은 다른 worktree에서 계획 중이며 이 worktree에는 없다. `depends_on`에 선언. run 착수 전 `status: completed` 확인 필수.

## Plan-audit History

(감사 후 기록)

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: draft (감사 전)
