# SPEC-PREVIEW-015 — Progress

## §E.1 Plan-phase Audit-Ready Signal

- plan 산출물: research.md(조사 단계), spec.md(v0.2.0), design.md, plan.md, acceptance.md, progress.md (status: draft, tier: L)
- plan-audit iteration 1: FAIL 0.76 (`.moai/reports/plan-audit/SPEC-PREVIEW-015-review-1.md`) → D1–D12 반영, iteration 2 대기
- SPEC ID 정규식 검사: `SPEC-PREVIEW-015` PASS (2026-10-26, Bash 실행)
- REQ 25건, AC 25건 (Tier L 상한 25, REQ-025·AC-025는 M1b 뒤 확정되는 잠정 항목), 모든 REQ가 AC 1건 이상에 연결됨
- 남은 미결 표지: 없음 (`images` 옵션은 사용자가 `images: false`로 결정, plan.md D13)
- plan-audit iteration 2: PASS 0.91 (`.moai/reports/plan-audit/SPEC-PREVIEW-015-review-2.md`) → 소견 N1–N5 반영, spec-compact.md·MX Tag Plan 추가
- plan_complete_at: 2026-10-26T16:34:40+09:00
- plan_status: audit-ready

## §E.2 Run-phase Evidence

### M1 시험 렌더링 증거 (2026-10-26, 기준 HEAD 57eb160 위 작업 트리)

- 설치: `npm ci`(postinstall `patch-package` → `mermaid@11.12.3 ✔`) 후 `npm i -E pele@1.10.0`. `npm ls mermaid pele --depth=0` → `mermaid@11.12.3`, `pele@1.10.0`. `package.json` `"pele": "1.10.0"`(캐럿 없음).
- 산출물: `m1/report.html`(나란히 비교·내보내기·시간), `m1/checks.md`(확인 항목 1–13 표 + MANUAL 3건), `m1/evidence/*.json`, `m1/img/`, `m1/exports/`(HTML·Chromium 대용 PDF·DOCX·PNG), `src/test/fixtures/pele/`(`unit/` 77개·`browser/` 76개, `manifest.json` 153항목).
- 확인 항목 상태: PASS 1·2·3·4a·7·8·9·10·11·12·13(측정), PASS+주의 5·6(다크 literal 대비), MANUAL 4b·5(PDF 앱 경로)·13 기준선. FAIL 없음.
- 측정 환경: `vitest 2.1.9 jsdom 28.1.0`, `playwright 1.58.2 webkit 26.0`, `chromium 145.0.7632.6`(PDF 대용).
- 첫 렌더 시간(다이어그램 32개, webkit): mermaid 579 / 516 / 507ms, pele 32 / 34 / 32ms.
- 관찰된 `--pele-*`: accent, bg, border, fg, font, font-mono, heading-weight, line, muted, radius, series-1…4, surface, surface-alt, title-weight. 소스에만: series-5…8, error, critical, zoom-*.
- jsdom: 캔버스 없음(`getContext('2d')` null) → pele 내장 측정기로 결정적 렌더. 픽스처 재렌더 검증 `unitChecked=76 browserChecked=76 mismatches=0`.
- 판정 참고 사항(report F1–F10): 수식 라벨이 mermaid에서는 수식으로, pele에서는 `$$…$$` 원문으로 보임 / 다크 literal 내보내기의 흰 DOCX 페이지 대비 문제 / `line≥1·column 0` 오류 위치 미관찰 / 정화기가 `role` 속성 제거 / mindmap·서브그래프 내부 방향 등 배치 차이.
- 이 브랜치 영향: `src/test/diagramRegressionGuard.test.ts` 의존성 집합 단언 1건 실패(pele 추가, M2 범위).

### M1 사용자 판정 (2026-10-26, AskUserQuestion으로 수집)

- 판정(통과/보류): **통과** — 다이어그램 안 수식(`$$…$$`)은 미지원으로 확정. M1 측정에서 현재 mermaid strict는 KaTeX로 수식을 그리고 pele는 원문을 보이므로 이것은 실제 퇴보이며, SPEC 제외 범위와 사용자 문서에 명시한다(D15 추정 정정).
- `responsive` 선택: **true** (패널 폭에 맞춰 축소)
- DOCX 다크 색: **DOCX는 내보내기 테마와 상관없이 항상 라이트 색 값**을 넣는다(흰 페이지 대비). HTML·PDF는 내보내기 테마를 따른다.
- D5 `--pele-*` 변수 목록: 출력에서 관찰된 accent, bg, border, fg, font, font-mono, heading-weight, line, muted, radius, series-1…4, surface, surface-alt, title-weight + 소스에만 있는 series-5…8, error, critical (zoom-* 제외, enableZoom 미사용). `--md-*` 대응은 M2에서 확정(보고서의 임시 대응은 제안일 뿐).
- D14 단위 테스트 측정기: **`jsdom-default`** — 근거: 픽스처 재렌더 검증 `unitChecked=76 browserChecked=76 mismatches=0` (오케스트레이터가 `npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/verify.capture.ts`로 직접 재실행, exit 0)
- 남은 수동 확인: MANUAL-1(앱 클릭, M3 이후), MANUAL-2(앱 PDF 내보내기), MANUAL-3(현재 앱의 수식 표시 기준선)

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## §F Phase 4 Mode Selection

- Input: tier L, M1 scope = spike only (spike/pele/, m1/ report, src/test/fixtures/pele/), domains = frontend render + export + test tooling, language mix TS/HTML, concurrency benefit LOW (sequential capture/compare pipeline)
- Plan Audit Gate: skip-eligible (iteration 2 PASS 0.91 ≥ Tier L 0.85); artifacts were edited after the audit (N1–N5 wording folds, spec-compact.md, MX plan) — disclosed to the user, who chose to proceed without re-audit at Implementation Kickoff Approval (2026-10-26)
- Mode evaluation: direct — not selected (multi-file spike); serial — **selected**; fanout — not selected (coding-heavy, single pipeline); sweep — not selected (not mechanical bulk)
- Decision: serial
- Justification: M1 is one ordered pipeline (install → collect samples → render both engines → capture fixtures → report), so a single implementation agent avoids coordination overhead. Executor is `general-purpose` carrying the manager-develop role, because the manager-develop definition pins `isolation: worktree`, which previously created an empty nested worktree inside a session worktree (project lesson feedback-worktree-hook-failure).
