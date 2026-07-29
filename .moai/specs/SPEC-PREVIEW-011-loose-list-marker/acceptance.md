# SPEC-PREVIEW-011 — 수용 기준

> 게이트 = tsc + vitest + Playwright + eslint. 이 결함은 **레이아웃 결과**이므로 주 검증 수단은 Playwright `boundingBox()` 기하 어서션이다(computed style 단독 검증은 불충분). 프리뷰↔내보내기 동등성은 자동 테스트가 증명할 수 없으므로 **코드 리뷰(diff) 계층**으로 강제한다. must-pass = AC-001, AC-002, AC-008, AC-010.

## 사전 준비

- **픽스처(마크다운)**: 아래 7종 구조를 한 문서(또는 분리된 픽스처)에 포함한다.
  1. loose `ul` — 항목 사이 빈 줄 (`- 항목 A` / 빈 줄 / `- 항목 B`)
  2. tight `ul` — 빈 줄 없는 연속 항목
  3. loose `ol` — 항목 사이 빈 줄이 있는 번호 목록
  4. 중첩 리스트 — `ul` 안에 `ul`(및 `ol` 혼합 1건)
  5. 태스크 표기 — `- [x] 완료`, `- [ ] 미완료`, 같은 리스트에 일반 항목 1건 포함
  6. 다문단 항목 — 한 `<li>` 안에 문단 2개(항목 내부 빈 줄 + 들여쓴 두 번째 문단)
  7. 긴 항목 — 뷰포트 폭에서 반드시 2행 이상으로 줄바꿈되는 항목
- **DOM 관찰 대상**: `.preview-content li`, `.preview-content li > p`, `.preview-content ul`, `.preview-content ol`의 `boundingBox()`(`x`, `y`, `width`, `height`).
- **허용 오차**: 서브픽셀 렌더링 차이를 흡수하기 위한 좌표 비교 오차 2px 내외(정확한 값은 Run phase 실측 후 확정).
- **육안 점검용 산출물**: 라이트/다크 프리뷰 스크린샷, HTML 내보내기 결과 파일, PDF 내보내기 결과 파일.

---

## 실행 체크리스트

### AC-001: loose list 마커·텍스트 동일 줄 — must-pass
- **discharge**: REQ-PREVIEW-011-001
- **검증 방법**: `npm run test:e2e -- markdown-render` (Playwright)
- **절차**: loose `ul` 픽스처를 에디터에 주입 → 프리뷰의 첫 `.preview-content li`와 그 자식 `p`의 `boundingBox()`를 얻는다.
- **기대 결과**: 텍스트(`p`) box의 `y`가 `<li>` box의 `y`와 허용 오차 이내로 일치한다. 즉 텍스트가 `<li>.y + 1행 높이`만큼 아래로 밀려나지 않는다.
- **RED 확인**: 수정 전 CSS에서 이 어서션이 **실패**해야 한다(실패하지 않으면 재현 픽스처가 loose list가 아니다).
- [ ] 통과

### AC-002: tight/loose 항목 간격 일치 — must-pass
- **discharge**: REQ-PREVIEW-011-001, -007, -011
- **검증 방법**: `npm run test:e2e -- markdown-render` (Playwright)
- **절차**: tight 리스트와 loose 리스트 각각에서 인접 항목 간격 `li[n+1].y - (li[n].y + li[n].height)`를 계산한다.
- **기대 결과**: 두 간격의 차이가 허용 오차(2px) 이내. tight 리스트 쪽 간격이 수정 전 대비 변하지 않는다(REQ-011).
- **RED 확인**: 수정 전에는 loose 간격이 tight보다 약 1rem 넓어 **실패**해야 한다.
- [ ] 통과

### AC-003: 행잉 인덴트(줄바꿈 연속행 정렬)
- **discharge**: REQ-PREVIEW-011-003
- **검증 방법**: `npm run test:e2e -- markdown-render` (Playwright)
- **절차**: 긴 항목 픽스처에서 해당 `<li>`의 `height`가 1행 높이를 초과함을 먼저 확인한 뒤, 텍스트 컨테이너의 `x` 좌표를 확인한다.
- **기대 결과**: 두 번째 줄 텍스트의 좌측 `x`가 첫 줄 텍스트의 좌측 `x`와 동일하다(마커 아래로 흘러내리지 않음). 텍스트 `x`는 `ul`의 콘텐츠 시작점(패딩 1.5rem 적용 위치)과 일치한다.
- [ ] 통과

### AC-004: 중첩 리스트 인덴트
- **discharge**: REQ-PREVIEW-011-004
- **검증 방법**: `npm run test:e2e -- markdown-render` (Playwright)
- **절차**: 중첩 픽스처에서 부모 `<li>` 텍스트의 `x`와 자식 `<li>` 텍스트의 `x`를 비교한다.
- **기대 결과**: 자식 `x` > 부모 `x` (자식이 더 들여쓰기됨). 차이는 `ul`/`ol`의 `padding-left: 1.5rem`에서 비롯된다.
- **추가 확인**: `ul` 안 `ol` 혼합 케이스에서도 동일하게 성립한다.
- [ ] 통과

### AC-005: 순서 있는 목록(`ol`) 동등 처리
- **discharge**: REQ-PREVIEW-011-005
- **검증 방법**: `npm run test:e2e -- markdown-render` (Playwright)
- **절차**: loose `ol` 픽스처에 AC-001과 동일한 y 일치 판정을 적용하고, 항목 텍스트 `x`가 동일 깊이 `ul`의 텍스트 `x`와 일치하는지 확인한다.
- **기대 결과**: 번호 마커와 항목 텍스트가 같은 줄. 텍스트 정렬선 규칙이 `ul`과 동일(마커 종류만 다름).
- [ ] 통과

### AC-006: 태스크 리스트 표기 정렬
- **discharge**: REQ-PREVIEW-011-006
- **검증 방법**: `npm run test:e2e -- markdown-render` (Playwright)
- **절차**: `- [x] 완료` / `- [ ] 미완료` / 일반 항목이 섞인 리스트에서 각 항목 텍스트의 `x`와 `y`를 비교한다.
- **기대 결과**: `[x]`/`[ ]` 텍스트가 마커와 같은 줄(y 일치)이며, 해당 항목 텍스트의 `x`가 같은 리스트 일반 항목의 `x`와 동일하다.
- **전제(spec.md Environment)**: 현재 파서에는 task-list 플러그인이 없어 `[x]`는 **리터럴 텍스트**로 렌더된다. `<input type="checkbox">` 존재를 단언하지 않는다.
- [ ] 통과

### AC-007: 다문단 리스트 항목의 문단 구분 보존
- **discharge**: REQ-PREVIEW-011-009
- **검증 방법**: `npm run test:e2e -- markdown-render` (Playwright)
- **절차**: 한 `<li>` 안 두 `<p>`의 `boundingBox()`를 얻어 `p[1].y - (p[0].y + p[0].height)`를 계산한다.
- **기대 결과**: 값이 0보다 크다(문단 사이 여백 존재). 즉 `li > p:last-child`의 `margin-bottom: 0` 규칙이 마지막 문단에만 적용되었음이 확인된다.
- **역검증**: `li > p` 전체를 `margin-bottom: 0`으로 만들면 이 어서션이 실패해야 한다.
- [ ] 통과

### AC-008: 프리뷰↔내보내기 스타일 규칙 동등성 — must-pass (코드 리뷰)
- **discharge**: REQ-PREVIEW-011-002, -008
- **검증 방법**: **수동 코드 리뷰(diff)** — 자동 테스트 없음(plan.md D8)
- **절차**: `git diff src/index.css src/lib/export/exportUtils.ts`를 나란히 열고 plan.md "두 스타일시트의 표현 차이" 대조표의 각 행을 확인한다.
- **기대 결과**:
  - [ ] `ul`/`ol` 마커 배치가 양쪽 모두 `outside`이며, `list-style-position: inside` / `list-inside` 잔존 **0건** (`grep -rn "list-inside\|list-style-position: inside" src/` 결과 0줄)
  - [ ] `ul`/`ol` 좌측 패딩이 양쪽 모두 **1.5rem** 등가
  - [ ] `li`의 좌측 여백(`ml-2` / `margin-left: 0.5rem`)이 양쪽 모두 **삭제됨** (`grep -n "ml-2\|margin-left: 0.5rem" src/index.css src/lib/export/exportUtils.ts` 결과 리스트 규칙 구간에서 0줄)
  - [ ] `li > p:last-child`의 하단 여백 0 규칙이 **양쪽 모두** 존재
  - [ ] 리스트 블록 하단 여백(1rem)이 양쪽 모두 유지
  - [ ] 두 파일이 **같은 커밋**에 포함됨
- [ ] 통과

### AC-009: 라이트/다크 테마 + HTML/PDF 육안 점검
- **discharge**: REQ-PREVIEW-011-010, spec.md Visual Change Notice
- **검증 방법**: **수동 육안 점검** — 각 항목을 실행하고 체크한다
- [ ] 라이트 테마 프리뷰에서 loose/tight/중첩/`ol`/태스크 리스트 정렬 확인
- [ ] 다크 테마 프리뷰에서 동일 확인(레이아웃이 라이트와 동일한지)
- [ ] 프로젝트 문서(`README.md` 또는 `ROADMAP.md` 등 리스트가 많은 문서)를 프리뷰로 열어 정렬선·중첩 깊이 확인 — **문서 내용은 수정하지 않는다**
- [ ] HTML 내보내기 실행 → 결과 파일을 브라우저로 열어 프리뷰와 동일 정렬인지 확인
- [ ] PDF 내보내기 실행 → 리스트가 우측으로 넘치지 않고 페이지 경계 항목이 정상 표시되는지 확인(R3)
- [ ] 긴 리스트 문서에서 스크롤 싱크 이상 없음 확인(R6)
- [ ] 들여쓰기가 전역적으로 소폭 변한 것은 **의도된 변경**임을 확인(회귀로 보고하지 않음)
- [ ] 통과

### AC-010: 회귀 게이트 — must-pass
- **discharge**: REQ-PREVIEW-011-012, -013, -014
- **검증 방법**: 아래 명령 전체 실행
- [ ] `npm run typecheck` — 0 에러
- [ ] `npm test` — vitest 전체 그린
- [ ] `npm run test:e2e` — Playwright 전체 그린(기존 `renders heading, table, and mermaid from fixture content` 포함)
- [ ] `npm run lint` — 통과
- [ ] `git diff --stat package.json` — **출력 0줄**(신규 의존성 없음)
- [ ] `git diff --stat src/lib/markdown/renderer.ts` — **출력 0줄**(파서 무변경)
- [ ] `git diff --stat src/components/preview/PreviewRenderer.tsx` — **출력 0줄**(스크롤 싱크·SVG·mermaid 무변경)
- [ ] `git diff --stat ROADMAP.md README.md` — **출력 0줄**(콘텐츠 파일 무변경)
- [ ] `src/index.css` diff에서 리스트 외 블록 요소(heading/blockquote/table/pre/code) 규칙 변경 0건, `.preview-content p`의 전역 `mb-4` 값 무변경
- [ ] 통과

---

## 테스트 매핑 (REQ → AC → 도구)

| REQ | AC | 도구 | must-pass |
|-----|----|------|-----------|
| REQ-PREVIEW-011-001 | AC-001, AC-002 | Playwright(boundingBox y 일치, 간격 비교) | Y |
| REQ-PREVIEW-011-002 | AC-008 | 코드 리뷰(diff) | Y |
| REQ-PREVIEW-011-003 | AC-003 | Playwright(줄바꿈 항목 x 일치) | - |
| REQ-PREVIEW-011-004 | AC-004 | Playwright(부모/자식 x 대소) | - |
| REQ-PREVIEW-011-005 | AC-005 | Playwright(`ol` y 일치 + x 정렬) | - |
| REQ-PREVIEW-011-006 | AC-006 | Playwright(`[x]` 항목 x/y 일치) | - |
| REQ-PREVIEW-011-007 | AC-002 | Playwright(tight/loose 간격 차 < 오차) | Y |
| REQ-PREVIEW-011-008 | AC-008 | 코드 리뷰(diff) + grep | Y |
| REQ-PREVIEW-011-009 | AC-007 | Playwright(문단 간 여백 > 0) | - |
| REQ-PREVIEW-011-010 | AC-009 | 육안 점검(라이트/다크) | - |
| REQ-PREVIEW-011-011 | AC-002, AC-010 | Playwright(tight 간격 무변경) + 게이트 | Y |
| REQ-PREVIEW-011-012 | AC-010 | `git diff --stat`(package.json, renderer.ts) | Y |
| REQ-PREVIEW-011-013 | AC-010 | 코드 리뷰(diff, 리스트 외 규칙 무변경) | Y |
| REQ-PREVIEW-011-014 | AC-010 | `git diff --stat`(PreviewRenderer.tsx) | Y |

> AC-003~007이 must-pass가 아닌 이유: 핵심 실패 모드(마커 분리·간격 doubling)는 AC-001/002가 이미 must-pass로 고정한다. AC-003~007은 `outside` 전환의 파생 결과를 고정하는 회귀 가드이며, 실패 시 즉시 승격한다. AC-009(육안)는 자동화할 수 없으므로 must-pass로 두지 않지만 **체크리스트 전 항목 기록 없이는 완료로 간주하지 않는다**.

## Definition of Done

- [ ] AC-001~010 전체 통과, must-pass(AC-001·002·008·010) 100%.
- [ ] `tsc` 0 에러, `vitest` 전체 그린, Playwright E2E 전체 그린, `eslint` 통과.
- [ ] loose list 마커·텍스트가 같은 줄에 렌더됨을 boundingBox 기하 어서션으로 고정(핵심 실패 모드 방어).
- [ ] tight/loose 항목 간격 일치를 기하 어서션으로 고정.
- [ ] `src/index.css`와 `src/lib/export/exportUtils.ts`가 **같은 커밋**에서 동등한 규칙으로 수정됨(diff 리뷰 기록 첨부).
- [ ] `list-style-position: inside` / `list-inside` 잔존 0건.
- [ ] 라이트/다크 프리뷰 + HTML 내보내기 + PDF 내보내기 육안 점검 체크리스트 전 항목 기록 완료.
- [ ] `package.json`·`renderer.ts`·`PreviewRenderer.tsx`·콘텐츠 파일 diff 0줄.
- [ ] `src/index.css`·`exportUtils.ts`·신규 E2E 테스트에 plan.md "@MX Tag Targets"의 태그 부여(특히 `exportUtils.ts`의 동등성 `@MX:WARN` + `@MX:REASON`).
- [ ] TDD 준수: AC-001/002의 실패 테스트(RED)를 CSS 수정 전에 작성했음을 커밋 이력으로 확인.
