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

## §E.3 Run-phase Audit-Ready Signal

_pending run-phase_

## §E.4 Sync-phase Audit-Ready Signal

_pending sync-phase_

## §F Phase 4 Mode Selection

- Input: tier=M · scope=구현 5파일 + 테스트 4파일(<10) · domain=2(프런트 토큰/내보내기 + 테스트 정렬) · 언어 혼합=CSS/TS/e2e · 동시성 이익=LOW(코딩 중심, 마일스톤 순서 의존 M1→M2→M3) · Agent Teams 전제=미요청
- Mode 평가: direct 미선정(다중 파일 의미 변경) / fanout 미선정(코딩 중심 — Anthropic coding-task caveat) / sweep 미선정(30파일 미만, 단일 기계 변환 아님) / serial 선정
- Decision: serial
- Justification: 마일스톤이 순서 의존(토큰 고정이 이음매·테스트 정렬의 전제)이고 코딩 중심 과업이라 serial이 기본값. 반자동 진행(사용자 승인 2026-10-28)에 맞춰 마일스톤당 1회 manager-develop spawn으로 검증 게이트를 구성한다.
- Plan Audit Gate skip 근거: plan-audit PASS 0.97(review-3, iteration 3/3) ≥ Tier M 기준 0.80 + plan 산출물 무변경 → skip policy 3조건 충족으로 재실행 생략.
