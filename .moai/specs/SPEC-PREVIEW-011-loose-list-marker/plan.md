# SPEC-PREVIEW-011 — 구현 계획

> 본 문서는 WHAT/WHY(spec.md)에 대한 HOW를 다룬다. 개발 방법론은 **TDD**(quality.yaml, RED-GREEN-REFACTOR)이며 브라운필드 CSS 수정이다. 확정 결정(패딩값·마커 배치·여백 제거 셀렉터), 두 스타일시트의 표현 차이, 구현 순서, 테스트 계획, 리스크를 기록한다. 실행 가능한 검증 체크리스트는 acceptance.md 참조.

## 핵심 문제 요약 (Root Cause)

1. `src/index.css:180-190` — `.preview-content ul`/`ol`이 `list-inside`(= `list-style-position: inside`). 마커가 `<li>` 콘텐츠 박스 **안의 인라인 박스**가 된다.
2. CommonMark loose list(항목 사이 빈 줄)는 `<li>`의 내용을 `<p>`로 감싼다. `<p>`는 **블록 박스**이므로 인라인 마커와 같은 줄에 놓일 수 없고 새 줄에서 시작 → **마커만 한 줄, 텍스트는 다음 줄**.
3. 동시에 `ul`/`ol`의 `space-y-1`과 `li > p`의 `mb-4`(`src/index.css:176-178`)가 합산되어 loose list 항목 간격이 tight list보다 넓다 → 같은 문서 안에서 간격이 들쭉날쭉.
4. 동일 결함이 내보내기 스타일시트(`src/lib/export/exportUtils.ts:126-145`)에도 **독립적으로 복제**되어 있다. 이쪽은 Tailwind가 아닌 평문 CSS 문자열이다.

즉 파서 문제가 아니라 **CSS 문제**이며, 두 벌의 CSS 소스를 함께 고쳐야 화면과 출력물이 일치한다.

## 결정 사항 (Decisions)

| # | 결정 | 내용 | 상태 | 근거 |
|---|------|------|------|------|
| D1 | **마커 배치 = `outside`** | `ul`/`ol`에서 `list-inside`(Tailwind) / `list-style-position: inside`(평문)를 제거하고 `outside`로 전환한다. 마커가 콘텐츠 박스 밖으로 나가면 `<li>` 내부의 `<p>`(블록)와 같은 줄 흐름을 다투지 않는다. | 확정 | 근본 원인 1·2 직접 제거. 표준 렌더러(GitHub/VS Code)와 동일 동작. |
| D2 | **좌측 패딩 = `padding-left: 1.5rem`** | 마커가 차지할 공간을 `ul`/`ol`의 좌측 패딩으로 확보한다. 프리뷰·내보내기 **동일 값**. | 확정(사용자 승인) | 마커가 컨테이너 밖으로 잘려나가지 않게 하는 표준 관행. Run phase는 명시된 AC가 실패할 때만 조정. |
| D3 | **`li`의 좌측 여백 제거** | `.preview-content li`의 `@apply ml-2`(프리뷰) / `margin-left: 0.5rem`(내보내기)를 **삭제**한다. D2 패딩과 합산되면 들여쓰기가 2rem으로 과도해지고 중첩 시 누적된다. | 확정(사용자 승인) | 두 좌측 오프셋이 공존하면 R3(PDF 폭) 위험이 커진다. 들여쓰기 원천을 `ul`/`ol` 패딩 하나로 단일화. |
| D4 | **중첩 인덴트 = 패딩 상속 구조** | 중첩 `ul`/`ol`은 동일 셀렉터에 걸리므로 자체 `padding-left: 1.5rem`을 갖는다. 부모 텍스트 시작선 기준으로 자식이 1.5rem 더 들어가 REQ-004의 점증 인덴트가 **별도 규칙 없이** 성립한다. | 확정 | 추가 셀렉터 없이 요구 충족(단순성). AC-004로 x 좌표 대소를 검증. |
| D5 | **loose 간격 정규화 = `li > p:last-child` 하단 여백 0** | 리스트 항목 내부 **마지막** 문단의 `margin-bottom`만 0으로 만든다. `.preview-content p`의 전역 `mb-4`는 건드리지 않는다. | 확정 | REQ-007(간격 일치)을 만족시키면서 REQ-009(다문단 항목의 문단 구분)를 동시에 보존. `li > p` 전체를 0으로 만들면 REQ-009가 깨진다. |
| D6 | **항목 간격 원천 = `space-y-1` 유지** | `ul`/`ol`의 `space-y-1`(항목 간 상단 여백)은 그대로 둔다. D5로 `<p>` 여백이 사라지면 tight/loose 모두 `space-y-1`만 남아 간격이 일치한다. | 확정 | tight list 현재 간격을 기준선으로 삼아 REQ-011(tight 무회귀)을 지킨다. |
| D7 | **테마 분기 미도입** | 본 변경은 색상이 아닌 레이아웃이므로 `dark:` variant나 테마별 규칙을 추가하지 않는다. | 확정 | REQ-010. 라이트/다크는 육안 점검만 수행(AC-009). |
| D8 | **동등성은 리뷰로 강제** | 프리뷰↔내보내기 규칙 동등성(REQ-008)은 문자열 스냅샷 테스트를 만들지 않고 **코드 리뷰(diff) 계층**으로 강제한다. | 확정(사용자 승인) | Playwright는 앱 프리뷰만 렌더하므로 내보내기 CSS 문자열의 동등성을 증명할 수 없다. 검증 불가한 것을 "테스트가 보장한다"고 쓰지 않는다. |

## 두 스타일시트의 표현 차이 (REQ-008 드리프트 위험 지점)

동일한 렌더 결과를 **서로 다른 문법**으로 써야 한다는 점이 이 SPEC의 최대 드리프트 위험이다.

| 규칙 | `src/index.css` (Tailwind `@apply`) | `exportUtils.ts` (평문 CSS 문자열) |
|------|-------------------------------------|-------------------------------------|
| 마커 종류 | `list-disc` / `list-decimal` | `list-style-type: disc` / `decimal` |
| 마커 배치 | `list-outside`(= `list-inside` 제거) | `list-style-position: outside` |
| 좌측 패딩 | `pl-6`(= 1.5rem) 또는 임의값 유틸리티 | `padding-left: 1.5rem` |
| 리스트 하단 여백 | `mb-4` (유지) | `margin-bottom: 1rem` (유지) |
| 항목 간격 | `space-y-1` (유지) | `space-y-1` 대응 규칙이 **없음** — 평문 쪽은 현재 `li { margin-bottom: 0.25rem }`가 그 역할을 한다 |
| `li` 좌측 여백 | `ml-2` **삭제**(D3) | `margin-left: 0.5rem` **삭제**(D3) |
| 항목 내부 마지막 문단 | `.preview-content li > p:last-child { @apply mb-0; }` | `.preview-content li > p:last-child { margin-bottom: 0; }` |

주의점:
- Tailwind `space-y-1`은 `& > * + * { margin-top: 0.25rem }`로 컴파일되고, 내보내기 쪽은 `li { margin-bottom: 0.25rem }`로 항목 간격을 만든다. **메커니즘이 다르다**(상단 여백 vs 하단 여백). 값은 같지만 마지막 항목 뒤 여백 유무가 미세하게 다를 수 있으므로, 내보내기 쪽은 기존 `li { margin-bottom: 0.25rem }`를 유지하는 편이 현행 출력물과의 차이를 최소화한다.
- `pl-6`은 Tailwind 기본 스케일에서 1.5rem이다. 임의값(`pl-[1.5rem]`)보다 표준 스케일 유틸리티를 우선한다.
- 두 파일을 **같은 커밋**에서 수정한다. 한쪽만 바뀐 중간 상태를 커밋하지 않는다.

## 구현 순서 (Implementation Ordering)

TDD 순서를 따르되, 대상이 CSS이므로 검증 수단은 Playwright 기하 테스트다.

1. **[RED] E2E 픽스처 준비** — loose list / tight list / 중첩 리스트 / `ol` / 태스크 리스트 표기 / 다문단 항목 / 긴 줄바꿈 항목을 포함한 마크다운 픽스처를 준비한다. 기존 `e2e/fixtures/test-content.md` 확장 또는 신규 픽스처 파일 중 택일(Run phase 재량, 기존 heading/table/mermaid 어서션 회귀 금지가 조건).
2. **[RED] E2E 테스트 작성** — `e2e/markdown-render.spec.ts`에 AC-001~007에 대응하는 `boundingBox()` 기반 어서션을 추가한다. 현재 CSS에서 **AC-001(마커·텍스트 동일 줄)과 AC-002(간격 일치)가 실패**하는 것을 먼저 확인한다(RED 확정). AC-003~007은 현행에서 통과할 수도 있으므로 회귀 가드 성격이다.
3. **[GREEN] 프리뷰 CSS 수정** — `src/index.css:180-190`에 D1·D2·D3·D5를 적용한다. 2번 테스트가 그린으로 전환되는지 확인한다.
4. **[GREEN] 내보내기 CSS 수정** — `src/lib/export/exportUtils.ts:126-145`에 동일 렌더 결과를 평문 CSS로 적용한다(위 대조표). 이 단계는 자동 테스트가 없으므로 **3번 결과와 나란히 diff 리뷰**한다(D8).
5. **[REFACTOR/검증] 육안 점검** — 라이트/다크 테마 프리뷰 + HTML 내보내기 + PDF 내보내기를 각각 열어 AC-009 체크리스트를 채운다. 프로젝트 문서(`README.md`, `ROADMAP.md` 등)를 프리뷰로 열어 정렬선·중첩 깊이를 확인하되 **문서 내용은 수정하지 않는다**.
6. **[검증] 회귀 게이트** — `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run lint` 전체 통과. `package.json`·`renderer.ts` diff 0줄 확인.

순서 근거: 3번(프리뷰)을 먼저 그린으로 만들어야 4번(내보내기)이 참조할 **확정된 기준 규칙**이 생긴다. 반대로 하면 내보내기 규칙이 추측이 된다.

## 테스트 계획 (Playwright 기하 검증)

게이트 = tsc + vitest + Playwright + eslint(PR #37로 `.eslintrc.cjs` 복구되어 실질 게이트).

### 왜 computed style 단독 검증은 불충분한가

`getComputedStyle(ul).listStylePosition === 'outside'`를 단언해도, `li > p`의 여백이나 패딩 조합이 잘못되어 실제로 마커와 텍스트가 어긋나는 경우를 잡지 못한다. 이 결함의 본질은 **레이아웃 결과**이므로 `boundingBox()` 좌표로 검증한다.

### 어서션 설계

| 테스트 | 검증 방법 |
|--------|-----------|
| 마커·텍스트 동일 줄 (AC-001) | loose `<li>`의 boundingBox와 그 안 텍스트 노드(또는 `<p>`)의 boundingBox를 얻어, 텍스트 box의 `y`가 `<li>`의 `y`와 허용 오차 이내로 일치하는지 단언. 결함 상태에서는 텍스트 `y`가 `<li>.y + 1행 높이`만큼 밀려 있어 실패한다 |
| 간격 일치 (AC-002) | tight 리스트와 loose 리스트 각각에서 `li[n+1].y - (li[n].y + li[n].height)`를 계산해 두 값의 차이가 허용 오차(2px) 이내인지 단언 |
| 행잉 인덴트 (AC-003) | 뷰포트 폭에서 반드시 줄바꿈되는 긴 항목을 픽스처에 넣고, `<li>` 높이가 1행 초과임을 확인한 뒤 텍스트 컨테이너의 `x`가 마커 영역보다 오른쪽이며 항목 전체가 동일 `x`에서 시작함을 단언 |
| 중첩 인덴트 (AC-004) | 부모 `li > p`(또는 텍스트 컨테이너)의 `x` < 자식 `li`의 `x`를 단언 |
| `ol` 동등 (AC-005) | loose `ol`에 AC-001과 동일한 y 일치 판정을 적용 |
| 태스크 표기 (AC-006) | `[x]`/`[ ]`를 포함한 항목의 텍스트 `x`가 같은 리스트의 일반 항목 텍스트 `x`와 일치함을 단언 |
| 다문단 항목 (AC-007) | 한 `<li>` 안 두 `<p>`의 `y` 간격이 첫 `<p>` 높이보다 큼(= 문단 사이 여백 > 0)을 단언 |

허용 오차는 렌더링 서브픽셀 차이를 흡수할 수 있도록 2px 내외를 사용한다(정확한 값은 Run phase에서 실측 후 확정).

### 기존 테스트 회귀

- `e2e/markdown-render.spec.ts`의 기존 `renders heading, table, and mermaid from fixture content` 테스트는 **수정하지 않는다**. 픽스처를 확장할 경우 기존 어서션(h1/table/mermaid 가시성)이 그대로 통과해야 한다.
- `e2e/` 전체에서 `toHaveScreenshot` 또는 좌표 기반 어서션을 grep으로 확인한다. 인덴트 변화로 baseline이 깨질 수 있다(R4).

## [DELTA] Brownfield Change Map

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [MODIFY] | `src/index.css` (180-190) | `ul`/`ol`: `list-inside` 제거 → `list-outside` + `pl-6`(1.5rem), `mb-4`·`space-y-1` 유지. `li`: `ml-2` 삭제. 신규: `.preview-content li > p:last-child { @apply mb-0; }` |
| [MODIFY] | `src/lib/export/exportUtils.ts` (126-145) | `ul`/`ol`: `list-style-position: outside` + `padding-left: 1.5rem`, `margin-bottom: 1rem` 유지. `li`: `margin-left: 0.5rem` 삭제, `margin-bottom: 0.25rem` 유지. 신규: `.preview-content li > p:last-child { margin-bottom: 0; }` |
| [MODIFY] | `e2e/markdown-render.spec.ts` | loose list 기하 회귀 테스트 추가(AC-001~007). 기존 테스트 무변경 |
| [MODIFY 또는 NEW] | `e2e/fixtures/test-content.md` 확장 또는 신규 픽스처 | loose/tight/중첩/`ol`/태스크 표기/다문단/긴 줄 리스트 포함 |
| [EXISTING] | `src/lib/markdown/renderer.ts` | 무변경 — 파서·플러그인·토큰 규칙 무변경(REQ-012) |
| [EXISTING] | `package.json` | 무변경 — 신규 의존성 0건(REQ-012) |
| [EXISTING] | `src/components/preview/PreviewRenderer.tsx` | 무변경 — 스크롤 싱크·SVG sanitize·mermaid 경로 무변경(REQ-014) |
| [EXISTING] | `ROADMAP.md`, `README.md` 등 콘텐츠 파일 | 무변경 — 육안 점검 대상일 뿐 수정 금지 |

## @MX Tag Targets

- **`src/index.css` 리스트 규칙 블록** — CSS 파일이므로 코드 주석 형태의 `@MX:NOTE`를 남긴다: "마커는 `outside` + `ul/ol` `padding-left`로 배치. `li`에 좌측 여백을 추가하면 패딩과 합산되어 중첩 시 누적됨(SPEC-PREVIEW-011 REQ-003/004). `li > p:last-child`의 `mb-0`는 loose list 간격 정규화용이며 제거 시 tight/loose 간격이 어긋남(REQ-007)."
- **`exportUtils.ts` CSS 문자열의 리스트 구간** — `@MX:WARN` + `@MX:REASON`: "이 규칙은 `src/index.css`의 `.preview-content` 리스트 규칙과 **동등한 렌더 결과**를 유지해야 한다(SPEC-PREVIEW-011 REQ-008). 자동 테스트가 두 파일의 동등성을 검증하지 않으므로 한쪽만 수정하면 화면과 내보내기 출력이 조용히 어긋난다."
- **`e2e/markdown-render.spec.ts` 신규 테스트** — `@MX:NOTE`: "boundingBox 기반 기하 검증. computed style 단독 검증은 이 결함을 잡지 못한다(SPEC-PREVIEW-011)."

## 리스크 및 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| **프리뷰만 고치고 내보내기를 빠뜨림**(가장 큰 실패 모드) | 높음(기능) — 화면과 출력물이 조용히 어긋나고 자동 테스트는 그린 | D8(리뷰 계층 명시) + 구현 순서 4번을 별도 단계로 분리 + `exportUtils.ts`에 `@MX:WARN` 부여. 두 파일을 같은 커밋에 담는다 |
| `li`의 `ml-2`/`margin-left`를 남겨 패딩과 합산 | 중간(시각) — 들여쓰기 과도, 중첩 시 누적 | D3을 확정 결정으로 명시 + AC-004(중첩 x 좌표)로 간접 검출 |
| `li > p` 전체 여백을 0으로 만들어 다문단 항목 붕괴 | 중간(기능) | D5에서 `:last-child`로 한정 + AC-007(문단 간격 > 0)로 고정 |
| PDF 페이지네이션·폭 변화 | 중간(출력) | 패딩 1.5rem 고정 + `li` 좌측 여백 제거로 순증가 폭을 1rem으로 제한. AC-009에 PDF 육안 점검 포함 |
| 기존 E2E 스냅샷/좌표 어서션 파손 | 낮음 | 구현 전 `e2e/`에서 `toHaveScreenshot`·좌표 어서션 grep. 현재 `markdown-render.spec.ts`에는 가시성 어서션만 존재 |
| 태스크 리스트가 실제 체크박스가 아님 | 낮음(전제) | 파서에 task-list 플러그인이 없어 `[x]`는 리터럴 텍스트(spec.md Environment). REQ-006은 텍스트 정렬로 정의됨. 플러그인 도입 시 별도 SPEC에서 재검증 |
| 스크롤 싱크 오프셋 변화 | 낮음 | REQ-014로 싱크 로직 무변경 고정. 육안 점검 시 긴 리스트 문서에서 싱크 이상 여부 확인 |

## 검증 게이트

- 본 저장소 게이트: **tsc + vitest + Playwright + eslint**(PR #37로 `.eslintrc.cjs` 복구, lint 실패는 실제 결함).
- must-pass: AC-001(마커·텍스트 동일 줄), AC-002(간격 일치), AC-008(프리뷰↔내보내기 동등성 리뷰), AC-010(회귀 게이트). 상세 체크리스트는 acceptance.md 참조.
