# SPEC-PREVIEW-019 progress.md

## Phase Notes (plan)

- 사용자 결정(2026-11-09, 오케스트레이터 경유): 100% 초과 확대는 선명해야 함(최우선), 방식은 srcdoc, 보안 SPEC(SPEC-SEC-001)과 병행 계획·구현은 SEC-001 이후. Q1=A(셸 CSP `script-src`에 고정 주입 스크립트 sha256 1개, `unsafe-inline` 금지, 페이지 자체 스크립트는 선명 모드에서 차단됨을 제약으로 명시), Q2=토글 포함(기본 선명 모드, 헤더 '원본 보기', 전역 영속 `htmlRenderMode`).
- 코디네이터 기본값(열린 질문, spec.md §7-1): 원본 보기에서는 018 동작 유지(transform 배율, 100% 초과 흐림). 해시-스크립트 일치 테스트를 AC에 포함(AC-006).
- plan 단계 확인(2026-11-09, origin/main 57b3231): 018 spec/plan/acceptance/progress, 기각된 018 v0.4.0 문서, review-3, advisor 처방 전문, `HtmlFileViewer.tsx`, `uiStore.ts`, `Header.tsx`, `ipc.ts`, `file_ops.rs`, `index.html` 메타 CSP, `tauri.conf.json`.
- 실측: Chromium에서 셸 메타 CSP가 sandbox srcdoc iframe의 인라인 스크립트를 차단함(대조군 실행됨). WebKit·WebView2 미실측.
- Tier M. 산출물: spec.md / plan.md / acceptance.md / progress.md. 활성 REQ 12·AC 15.
- 병행 SPEC-SEC-001은 다른 worktree에서 계획 중이며 이 worktree에는 없다. `depends_on`에 선언. run 착수 전 `status: completed` 확인 필수.

## Plan-audit History

- review-1(2026-11-09): **FAIL 0.74** (Tier M 기준 0.80) — `.moai/reports/plan-audit/SPEC-PREVIEW-019-review-1.md`. blocking D1~D6, minor D7~D14. 핵심 실측(Playwright Chromium·WebKit): 해시 1개로 주입 스크립트 실행·`postMessage` 배율 적용은 성립, 그러나 상속된 `style-src`가 asset 스타일시트를 막고(D1), 프레임 이동(링크·meta refresh)으로 CSP 없는 문서의 스크립트가 실행되며(D2), `srcdoc`은 항상 표준 모드다(D3).
- v0.1.0 개정 1차(2026-11-09, plan 단계 작성자): D2~D14 반영(D2 보안 주장 정정·AC-014 이동 경로 시험, D3 quirks 한계 10 추가, D4 018 `implemented` 충돌 명시, D5 AC-006 토큰 집합·고정 기대값, D6 e2e를 기존 webkit 프로젝트로, D7~D14 경미). D1은 사용자 결정 **D1=A**(2026-11-09, 코디네이터 경유 AskUserQuestion): 셸 CSP `style-src`에 `asset: http://asset.localhost https://asset.localhost`만 추가, 나머지 지시어 불변. spec REQ-006·AC-006·plan M3/§D·한계 목록 반영. D2 정정(프레임 이동 후 CSP 없는 문서 스크립트 실행)은 코디네이터가 SEC-001 run 워커에 '프레임 이동 후 invoke 거부' 시험으로 전달.
- review-2: (진행 중)

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: draft (감사 전)
