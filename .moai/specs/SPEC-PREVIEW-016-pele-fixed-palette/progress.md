# SPEC-PREVIEW-016 progress.md

## Phase 1 SKIP Rationale

- Phase 2 Explore — SKIP: 선행 세션에서 디자인이 확정됐고 코드 앵커까지 검증됐다(origin/main 39c39e9). 추가 탐색으로 얻을 미결 정보가 없다.
- Phase 3 명확도 게이트 — SKIP: clarity 10/10, 기술 키워드 5개 이상으로 skip 조건을 충족한다.
- Phase 4 인터뷰 — SKIP: 열린 질문이 없다. 사용자 결정은 DP1 한 건뿐이다.
- Phase 5 — SKIP 아님(상태 기록): ultrathink 키워드가 진입 시 활성 상태였다.
- Phase 6 리서치 — plan.md §A Context로 접어 넣었다(Tier M 산출물 집합에는 research.md가 없다).
- Phase 7 디자인 방향 — SKIP: 디자인 2026-10-28 확정. Option B(액센트 `#C08A28`) 기각 포함.

## Approved Decisions

- DP1: Proceed — Phase 8 기획 제안을 사용자가 승인(2026-10-28).
- Tier M — 산출물 5종(spec.md / plan.md / acceptance.md / spec-compact.md / progress.md), design.md·research.md 없음.
- 출시 목표(frontmatter `phase`): "v0.18.0 target".
- 라이트 테마 무카드(다크 전용 종이 카드) — 승인된 제안 기본값.

## Environment Caveat

- 로컬 작업 트리는 v0.16.1(pre-pele)이다. run 단계는 반드시 origin/main 기반 브랜치에서 실행하며, pele 사실 확인은 `git show origin/main:<path>`로만 한다. 본 SPEC의 앵커는 전부 origin/main 블롭 39c39e9(v0.17.0, pele 1.10.0) 기준이다.

## Late-Branch / Run Entry Decision (2026-10-28, 사용자 확정)

- BODP(EntryPlanLateBranch): base = **origin/main**. pele 코드는 origin/main(39c39e9)에만 존재하고 로컬 main은 plan 커밋 3c55ee3을 포함해 분기 상태다.
- run 진입 절차: (1) origin/main 기반 워크트리/브랜치 생성 → (2) `git checkout main -- .moai/specs/SPEC-PREVIEW-016-pele-fixed-palette/` 으로 SPEC 문서를 구현 브랜치에 반입 → (3) run 실행.
- Plan Audit Gate: plan-audit PASS 0.97(review-3, iteration 3/3) + 산출물 무변경 → skip-eligible(spec-workflow § Plan Audit Gate skip policy 3조건 충족). 스킵 시 run 위임 프롬프트 Section A에 근거를 기록할 것.
- Implementation Kickoff Approval은 여전히 필수 — 본 결정은 gate 우회가 아니다.

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-10-28T05:17:13Z
- plan_status: audit-ready
- plan_audit: PASS 0.97 (iteration 3/3, trajectory 0.85 → 0.92 → 0.97 · report: .moai/reports/plan-audit/SPEC-PREVIEW-016-review-3.md — gitignored local artifact)

## §E.2 Run-phase Evidence

### M1 — 팔레트 토큰 고정 + 형태 테스트 (2026-10-28, 구현 기준 HEAD bcdfb56)

- AC-PREVIEW016-001 PASS — `npx vitest run src/test/diagramRenderer.test.ts` → `Tests 81 passed (81)`: :root pele 선언 연속 23개 묶음 가드 + 다크 블록 pele 0개 + 파일 전체 23개 + pele 값 내 `var(--md-` 0건 가드 신설·통과
- AC-PREVIEW016-002 PASS — 동일 실행: 23개 토큰 값이 승인 잉크 앤 허니 표와 일치(accent == line == `#3A5673`, series 정확히 8종 서로 다른 값)
- AC-PREVIEW016-003 PASS — 동일 실행: `--pele-font`·`--pele-font-mono`가 `DIAGRAM_FONT_FAMILY`·`DIAGRAM_FONT_FAMILY_MONO`와 바이트 동일, radius `3px`, 굵기 `600`
- E8 RED 증거(CSS 변경 전 캡처): `Tests 3 failed | 78 passed (81)` — (1) 다크 블록 pele 잔여 23개, (2) `--pele-bg: "var(--md-bg)" ≠ "#FAF9F6"`, (3) `--pele-radius: "var(--md-radius-sm)" ≠ "3px"` — 전부 계획된 테마 가정 파손 형태
- E2 게이트 — vitest 전체: `Test Files 108 passed (108) / Tests 1754 passed (1754)` · `npm run typecheck`(tsc --noEmit) exit 0 · `npm run lint`(--max-warnings 0) exit 0 · cargo test는 CSS+테스트 전용 변경(Rust 표면 없음)으로 SKIP
- 경계 grep — `git grep -in '#c08a28' -- ':!.moai/specs'` → 0건(exit 1), pele 선언 파일 전체 23개, pele 값 내 체이닝 0건(직접 실행 확인)
- 관찰 편차(양수): B-K1 예상과 달리 `exportDiagram.test.ts` 유닛은 통과 — 실측상 CSS 파일 본문을 읽지 않고 계산값 주입 방식이라 유닛 레벨 파손 없음. 실제 CSS를 로드해 읽는 e2e 2종만 M3 교체 대상으로 남음(미실행)
- 주석 스코프 조정 1건: 기각 Option B의 16진 리터럴을 tracked 소스 주석에서 제외(AC-009 잔여 0 grep 보호) — 기각 사실·출처는 주석에 유지하고 리터럴은 `.moai/specs/` 의사결정 기록에만 존재
- 환경 비고: 워크트리에 node_modules 미설치로 최초 vitest가 pele 해석 실패(transform 오류) → `npm ci`로 재설계 후 pele 1.10.0 확인하고 게이트 재실행

### M2 — 다크 카드 + 미리보기/내보내기 이음매 (2026-10-28, 구현 기준 fdda742)

- AC-PREVIEW016-006 PASS — `npx vitest run src/test/export.test.ts` → `Tests 20 passed (20)`: `getPreviewCss('light')`·`getPreviewCss('dark')` 컨테이너 규칙 모두 `background-color: #FAF9F6`(문자열 수준, 신설 단정). 이음매 3항 선택(`#191b1d`/`#f2f2f3`)은 `#FAF9F6` 상수로 폐지
- AC-PREVIEW016-005 PASS(unit 부분) — 동일 실행: 다크 출력 컨테이너 규칙에 `border: 1px solid #97A4B1` + `border-radius: 3px` 카드 선언, 라이트 출력에 카드 선언 0(무카드 가드). e2e 부분은 M3(`diagram-export-colors.spec.ts`), 시각 확인은 manual로 각각 귀속
- AC-PREVIEW016-008 PASS — `npx vitest run src/test/PreviewRenderer.test.tsx` → `Tests 21 passed (21)`: 재렌더 금지 가드 3건(`PreviewRenderer.test.tsx` 240-297) 무변경 통과. PreviewRenderer.tsx는 `@MX:NOTE` 문구 재작성만(주석 전용)
- E8 RED 증거(구현 전 캡처): `Tests 2 failed | 18 passed (20)` — (1) AC-006 배경 단정 실패(라이트 `#f2f2f3` 관찰), (2) AC-005 다크 카드 단정 실패(`#191b1d` + 카드 선언 없음 관찰). 라이트 무카드 가드는 RED에서도 통과(이미 무카드) — 계획된 형태
- E2 게이트 — vitest 전체: `Test Files 108 passed (108) / Tests 1757 passed (1757)` · `npm run typecheck`(tsc --noEmit) exit 0 · `npm run lint`(--max-warnings 0) exit 0 · cargo test는 CSS+테스트 전용 변경(Rust 표면 없음)으로 SKIP
- index.css 다크 스코프 카드 규칙 신설(`.dark .preview-content .mermaid-container`: 배경 `var(--pele-bg)`, 테두리 `var(--pele-border)`, 반경 `var(--pele-radius)`, 특이도 0-3-0으로 다크에서만 승리) — 라이트 경로 바이트 무변경
- 이음매 형태 수정 1건(스코프 내): 임무 지시대로 카드 선언을 `var(--pele-border)`로 썼더니 전체 스위트에서 0-잔여 계약 테스트 2건 파손(`exportDiagram.test.ts` — 015 AC-020 유지, 내보낸 문서 전체에 `var(--pele-` 금지). 내보낸 HTML에는 `--pele-*` 정의가 없어 var() 참조는 계산 시 currentColor로 무너지므로(M3 계산 스타일 e2e도 실패 예정) 내보내기 카드 값은 승인 팔레트 상수의 리터럴(`#97A4B1`/`3px`)로 확정. 수정은 exportUtils.ts와 신설 단정 안에서만 — M3 소관 파일 무변경. 라이브 미리보기(index.css)는 앱 `:root` 정의가 있으므로 var() 그대로
- export.test.ts 스코프 추가 근거(오케스트레이터 승인 항목): AC-005/006의 unit 검증 기법이 "getPreviewCss 출력 문자열 수준 검사"이고 TDD(E8)가 이음매 수정 전 실패 테스트를 요구하므로 기존 일반형 단정(135-148행, 회귀 감시로 무변경 유지) 옆에 3건 추가. plan §A의 "export.test.ts 필수 변경 없음"은 기존 단정 생존을 뜻하며 추가 커버리지와 양립
- PreviewRenderer 직렬화 동일성 단정 — 미추가 판단: 기존 가드가 이미 노드 객체 동일성(`toBe(svg)`) + pele 호출 0회 + 오류 문구 보존까지 단정하므로 추가 시 중복 커버리지(단순성 원칙)
- 경계 grep — `git grep -in '#c08a28'` 신규 추가분 0건(기각 옵션 16진 리터럴 미도입)

### M3 — 테스트 정렬 + 015 폐기 포인터 + 최종 게이트 (2026-10-28, 구현 기준 HEAD 83dfeaa)

- E8 RED 증거(e2e, 전환 전 캡처 — M1/M2로 이미 착지한 고정 팔레트 동작에 구 테마 가정 단정이 실패하는 것을 기록): `npx playwright test e2e/diagram-preview-behavior.spec.ts e2e/diagram-export-colors.spec.ts` → `4 failed | 3 passed` — (1) colors:57 `Error: dark --pele-bg` received `#FAF9F6`(구 --md-* 체이닝 기대와 불일치), (2) colors:98 `라이트 SVG에 라이트 surface 값 없음`(라이트·다크 내보내기가 같은 고정 값을 담아 테마 구분 단정 붕괴), (3) preview:141 `expect(dark.fill).not.toBe(light.fill)` → `Received: false`(양측 색이 같음), (4) preview:181 `첫 렌더 채움색이 다크 토큰 값이 아님` received `rgb(238, 243, 247)`(= #EEF3F7 고정 pele surface). 전부 계획된 테마 가정 파손 형태이며 구조 전용 3건(AC-012×2·AC-025)은 무변경 통과. 전문: `.moai/state/verify/m3-evidence/red-e2e-before-m3.txt`(gitignored 로컬 증거)
- 유닛 전환의 RED 미획득 사유(명시): `exportDiagram.test.ts`는 CSS를 계산하지 않고 readPeleThemeValues 주입 표로 치환 경로를 검증하므로(B-K5 실측, jsdom 한계), 유닛의 고정 팔레트 전환은 "이미 착지한 동작에 대한 정렬"이다 — 새 단정의 RED는 물리적으로 얻을 수 없다(동작은 M1 fdda742에서 착지). 팔레트 값 자체의 진위는 M1의 diagramRenderer.test.ts 가드(AC-001..003)가, 주입값의 정합은 본 파일 신설 가드가 분담한다.
- AC-PREVIEW016-004 PASS — unit: `npx vitest run src/test/exportDiagram.test.ts` → `Tests 22 passed (22)`(기존 21 + 신설 주입 표 일치 가드 1): THEME 표를 synthetic 테마별 생성기에서 mdedit-tokens.css :root pele 리터럴 파싱으로 교체, 라이트·다크가 같은 객체, 6-조합 행렬은 테마 라벨 시나리오로 유지하며 기대값을 고정 팔레트로 전환(onlyIn 상호배타 검사는 테마 불변화로 개념 소멸 — 삭제). e2e: `npx playwright test e2e/diagram-preview-behavior.spec.ts e2e/diagram-export-colors.spec.ts` → `8 passed (13.2s)` — 테마 불일치 단정 2곳을 테마 동일성 단정으로 전환, readNodeColors 프로브를 `var(--pele-surface)`/`var(--pele-border)`로 재조준, 다크 첫 렌더를 고정 팔레트 값 단정으로 전환, 내보내기 SVG 양테마 동일값 단정. isSameSvg 가드 보존 확인
- AC-PREVIEW016-005 PASS(unit+e2e 부분) — 신설 e2e: 다크 내보낸 HTML 카드 계산 스타일 — iframe srcdoc으로 내보낸 HTML을 적재해 .mermaid-container 측정: 다크 bg rgb(250, 249, 246) + 테두리 1px solid rgb(151, 164, 177) + 반경 3px, 라이트 무카드(테두리 0px·반경 0px, 배경은 동일 종이색). manual(다크 화면 종이 카드 시각 확인)은 사용자 확인 대기 — **manual pending**
- AC-PREVIEW016-006 PASS(M2 증거의 M3 재확인) — 전체 스위트에 export.test.ts 포함 통과(AC-006 단정 3건 포함)
- AC-PREVIEW016-007 PASS — unit 6-조합 테마 라벨 무관 단정 + classDef·style 사용자 색 6종 보존 단정(`#f96 #333 #9cf #036 #ffd54f #8d6e00`) 통과; e2e 내보내기 양테마 동일값 통과
- AC-PREVIEW016-008 PASS — 전체 스위트에 PreviewRenderer.test.tsx 재렌더 금지 가드 3건 포함 통과(240-297 무변경)
- AC-PREVIEW016-009 PASS — 본 SPEC spec.md "다른 SPEC 개정" 표 존재(plan 단계 기록, pre-flight 재확인) + `git grep -in '#c08a28' -- ':!.moai/specs'` → 0건(exit 1). 015 문서 폐기 포인터 5곳 삽입(REQ-008·REQ-013은 spec.md, AC-011·AC-015·AC-020은 acceptance.md) — `git diff --stat` = 10 insertions(+), 0 deletions(본문 재작성 0, 삽입 전용)
- E2 최종 게이트 — vitest 전체: `Test Files 108 passed (108) / Tests 1758 passed (1758)`(M2 대비 +1: 신설 가드) · `npm run typecheck`(tsc --noEmit) exit 0 · `npm run lint`(--max-warnings 0) exit 0 · Playwright webkit: 변환 2종 `8 passed (13.2s)` + 회귀 `e2e/mermaid-subgraph-label.spec.ts` `2 passed (4.4s)` · `cargo test` → `367 passed; 0 failed`(exit 0) — Rust 표면 무변경 확인(`git diff bcdfb56..83dfeaa -- diagramRenderer.ts exportHtml.ts exportDocx.ts` 공백)
- 앵커 재측정 기록(plan §A vs 83dfeaa 실측): exportDiagram.test.ts THEME 표·모킹 36-63(계획 36-60, 모킹 팩토리 포함 +3), combos 296-303(일치), 기대값 소비 317-322(계획 318-319, ±3행), 탐침 테스트 ~404-414(무변경 유지 확인). e2e preview: 프로브 92-93·단정 159-165·두 번째 테스트 181-217 전부 일치. e2e colors: 36-37·85-94 일치, 내보내기 단정 117-125(계획 119-127, -2행). 전부 소폭 편차이며 실측 앵커 기준으로 구현
- B-K5 실측 정정 기록: exportDiagram.test.ts는 CSS 원문을 파싱해 단정하는 게 아니라 readPeleThemeValues 주입 표로 치환 경로를 검증한다(계획 가정과 다름 — M1 관찰 유지). M3 전환으로 주입 표의 값 공급원을 synthetic 테마별 생성기 → CSS :root 파싱으로 바꿔 "주입값 = 실제 팔레트"를 같은 파일 가드로 고정했다(검증 기법은 주입 방식 그대로 — 값 공급만 CSS 기반으로 변경)
- plan §C.4 오픈 아이템 해소: pele 패키지(node_modules/pele = dist·LICENSE·package.json·README)에 `.mockup` 자산 없음(`find` 0건, dist `grep -c mockup` = 0). dist 내부 폴백 `var(--pele-accent,#5b7bd5)`·`var(--pele-surface,#f3f3f3)`·`var(--pele-surface-alt,#e6e6e6)`은 토큰 표가 채워지면 불활성 — 앱은 :root 고정 팔레트가 항상 표를 채우므로 폴백 소비 없음. 조치 불요
- Playwright webkit: 1.58.2 + webkit 바이너리 캐시 존재(webkit-2248/2311/2336) — 신규 설치 불요

## §E.3 Run-phase Audit-Ready Signal

- run_complete_at: 2026-10-28T16:12:00Z (M3 최종 게이트 완료)
- run_status: audit-ready
- run_commit_sha: 333c104
- ac_pass_count: 9 (AC-PREVIEW016-001..009)
- ac_fail_count: 0
- ac_manual_pending: 1 (AC-005 다크 종이 카드 시각 확인 — 사용자 manual 1회 대기; unit·e2e 증거는 PASS)
- preserve_list_post_run_count: 3 (diagramRenderer.ts·exportHtml.ts·exportDocx.ts — diff 공백으로 무변경 확인)
- l44_pre_commit_fetch: 미실행 — push는 오케스트레이터가 수행(위임 지시), 본 에이전트 권한 밖
- l44_post_push_fetch: 미실행 — 동일 사유
- new_warnings_or_lints_introduced: 0 (lint --max-warnings 0 exit 0, cargo warning 0)
- cross_platform_build.rust: cargo test darwin/aarch64 exit 0 (367 passed) — Rust 무변경이므로 크로스 플랫폼 영향 없음
- total_run_phase_files: 11 (M1 2 + M2 4 + M3 5, plan §F 인도 파일 기준; progress.md·spec.md frontmatter 제외)
- m1_to_mN_commit_strategy: 마일스톤당 1커밋(M1 fdda742, M2 83dfeaa, M3 본 커밋) — 각 커밋마다 당시 전체 게이트 통과 후 착지

## §E.4 Sync-phase Audit-Ready Signal

- sync_complete_at: 2026-10-28
- sync_status: audit-ready
- sync_commit_sha: 8812ef6
- changelog_entry: [Unreleased] § Changed — 다이어그램 고정 팔레트 전환(SPEC-PREVIEW-016), AC 9건 기준
- e3_backfill.run_commit_sha: 333c104 (본 sync 커밋에서 권한 백필 완료 — D3 패턴)
- readme_docs_surface: README.md 주요 기능 목록의 "라이트/다크 테마 연동"을 "고정 팔레트"로 최소 수정(8812ef6, item 5 판단) — 그 외 문서 표면 영향 없음
- frontmatter_status_transitions: in-progress → completed (본 sync 커밋, 3-phase close)
- mx_compliance_check: 신규 @MX:NOTE 1건(mdedit-tokens.css 팔레트 고정 결정, SPEC 참조 보유) — 규약 위반 0
- b12_self_test_a: 사전 grep -c 'SPEC-PREVIEW-016' CHANGELOG.md = 0(중복 없음 확인)
- b12_self_test_b: acceptance.md AC 식별자 9건(AC-PREVIEW016-001..009) — CHANGELOG 항목 AC 수 일치
- b12_self_test_c: CHANGELOG 기재 파일 3건 실존 확인(mdedit-tokens.css·exportUtils.ts·index.css)

## §F Phase 4 Mode Selection

- Input: tier=M · scope=구현 5파일 + 테스트 4파일(<10) · domain=2(프런트 토큰/내보내기 + 테스트 정렬) · 언어 혼합=CSS/TS/e2e · 동시성 이익=LOW(코딩 중심, 마일스톤 순서 의존 M1→M2→M3) · Agent Teams 전제=미요청
- Mode 평가: direct 미선정(다중 파일 의미 변경) / fanout 미선정(코딩 중심 — Anthropic coding-task caveat) / sweep 미선정(30파일 미만, 단일 기계 변환 아님) / serial 선정
- Decision: serial
- Justification: 마일스톤이 순서 의존(토큰 고정이 이음매·테스트 정렬의 전제)이고 코딩 중심 과업이라 serial이 기본값. 반자동 진행(사용자 승인 2026-10-28)에 맞춰 마일스톤당 1회 manager-develop spawn으로 검증 게이트를 구성한다.
- Plan Audit Gate skip 근거: plan-audit PASS 0.97(review-3, iteration 3/3) ≥ Tier M 기준 0.80 + plan 산출물 무변경 → skip policy 3조건 충족으로 재실행 생략.
