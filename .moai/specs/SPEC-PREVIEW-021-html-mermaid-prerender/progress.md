# SPEC-PREVIEW-021 progress.md

## Phase Notes (plan)

- 백로그 카드 t2. 사용자 결정(2026-11-09, 코디네이터 경유): 선명 모드(srcdoc)만, `pre.mermaid`·`div.mermaid`만, 앱 팔레트(잉크 앤 허니), 실패 시 원문 유지 + 짧은 안내.
- 기준 origin/main `cdaadcf`(SPEC-PREVIEW-020 병합 직후). worktree `.claude/worktrees/html-mermaid-prerender`, 브랜치 `WT-mermaid-prerender`.
- plan 단계에서 직접 읽은 것: SPEC-PREVIEW-019 spec/acceptance/progress, SPEC-PREVIEW-015 design.md(D3·D4·D6·D14), `htmlSrcdoc.ts`, `HtmlFileViewer.tsx`, `diagramRenderer.ts`, `exportUtils.ts`(`renderExportDiagram`), `exportHtml.ts`(자리 치환 방식), `PreviewRenderer.tsx`(오류 표시), `index.css` `.mermaid-container`, `mdedit-tokens.css`(다크 블록에 `--pele-*` 재정의 없음), `mdedit-fonts.css`·`public/fonts/`, `index.html` CSP(`font-src` 없음), `e2e/html-file-viewer.spec.ts` 선명 모드 describe, `diagramRenderer.test.ts` 오류 픽스처.
- 핵심 판단: (1) 렌더는 내보내기 경로 `renderExportDiagram`을 그대로 쓴다(모양 톤 + `var(--pele-)` 치환으로 앱 CSS 없는 srcdoc에서도 같은 색) (2) HTML 전체를 DOM으로 다시 직렬화하지 않고 오프셋으로 블록 안쪽만 교체 (3) 동기 실행 (4) CSP·sandbox·`buildSrcdoc` 불변.
- 미측정 위험: srcdoc 안 다이어그램 글꼴(Barlow). 019 한계 3(웹폰트 CORS)과 셸 CSP의 `data:` 글꼴 차단 때문에 run M1 관문으로 둠. SPEC-SEC-002(t1)의 `font-src` 결정에 따라 경로 (B)가 열릴 수 있음.
- Tier M. 산출물: spec.md / plan.md / acceptance.md / progress.md. 활성 REQ 10·AC 12.

## Plan-audit History

- review-1(2026-11-09, 커밋 490f887 대상): **FAIL 0.84**(Tier M 기준 0.80, 점수는 넘었으나 BLOCKING D1) — `.moai/reports/plan-audit/SPEC-PREVIEW-021-review-1.md`. 차원: Clarity 0.80 / Completeness 0.95 / Testability 0.75 / Traceability 0.90. MP-1~7 통과. D1(REQ-006 vs REQ-008 바이트 보존 모순) BLOCKING, D2~D4 SHOULD-FIX, D5~D15 MINOR. 감사자가 vitest를 돌리지 못함(이 worktree에 `node_modules` 없음) — 오류 픽스처 위치는 읽기로만 확인.
- v0.1.1 개정(2026-11-09): D1~D12·D14·D15 반영(spec HISTORY 0.1.1 참조). D13은 조치 불필요(pre-flight 2가 이미 확인). 계획 정규식은 작성자가 `node -e`로 7개 입력에 대해 의도대로 일치함을 확인(따옴표 안 `>`, 대문자, 따옴표 없음, `/>`, `<header>` 불일치).
- review-2(2026-11-09, 커밋 f334037 대상): **FAIL 0.88**(+0.04) — `review-2.md`. 차원: Clarity 0.88 / Completeness 0.95 / Testability 0.78 / Traceability 0.95. 이전 결함 13건 해소, 남은 BLOCKING N1(글꼴 `<style>`이 AC-001·002·005 단언과 충돌), SHOULD-FIX N2(같은 모듈 함수는 모의 불가), MINOR N3~N6.
- v0.1.2 개정(2026-11-09): N1~N5 반영(spec HISTORY 0.1.2). 작성자 확인: `node -p 'String.fromCharCode(160).concat("x").trim().length'` → `1`(trim이 U+00A0 제거, AC-004 예시 성립).

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: pending-audit
- 구현 착수 승인(Implementation Kickoff Approval)은 받지 않았다.
