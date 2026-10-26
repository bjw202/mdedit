# SPEC-PREVIEW-010 — 수용 기준

> 게이트 = tsc + vitest + Playwright(eslint 아님). 1.0.1(SPEC-PREVIEW-015로 개정)부터 다이어그램 렌더러는 pele 1.10.0이고 테마는 `--pele-*` CSS 변수로 바뀐다. 아래 시나리오는 개정된 REQ-001~006을 검증하며, 각 시나리오를 실제로 고정하는 테스트는 SPEC-PREVIEW-015의 AC(괄호 안)다. 1.0.0의 mermaid `initialize`/`render`/`parse` 스파이 기반 시나리오는 이 개정으로 대체되었다. 보안(시나리오 D)·핵심 재채색(B)·회귀(F)가 must-pass.

## 사전 준비

- **픽스처(마크다운)**: ` ```mermaid ` 다이어그램 펜스 1개를 포함한 `.md`, 다이어그램 2개(정상 + 문법 오류) 포함 `.md`, 다이어그램 + 인라인 `<svg>` 동시 포함 `.md`.
- **상태 주입**: `useUIStore.theme`(light/dark/system), `window.matchMedia('(prefers-color-scheme: dark)')`(system 모드용), `document.documentElement`의 `.dark`/`data-theme` 상태.
- **관찰 대상**: 컨테이너 SVG 노드의 동일성(교체 여부), pele `render` 추가 호출 횟수, 노드의 계산된 채움색과 테마 토큰 값.

---

## 기능 시나리오

### 시나리오 A: 앱 테마에 맞는 초기 렌더 (REQ-001)
- **Given** 테마 설정을 다크로 저장해 둔 상태에서 다이어그램이 든 문서를 열 때
- **When** 다이어그램이 처음 DOM에 붙으면
- **Then** 그 노드의 계산된 채움색이 다크 토큰 값과 같고, 같은 노드가 이후 교체되지 않는다(라이트 색으로 먼저 그리지 않음)
- **And** `mdedit-tokens.css`의 라이트·다크 두 블록에 `--pele-*` 정의가 있다. (SPEC-PREVIEW-015 AC-011)

### 시나리오 B: 테마 토글 시 라이브 재채색 (REQ-002) — must-pass (핵심)
- **Given** 라이트 모드에서 다이어그램이 이미 프리뷰에 렌더되어 보이는 상태에서
- **When** 사용자가 앱 테마를 다크로, 다시 라이트로 토글하면
- **Then** (unit) 컨테이너의 SVG 노드가 처음과 같은 객체이고 pele `render` 추가 호출이 0회다
- **And** (e2e) 노드의 계산된 채움색이 라이트·다크에서 서로 다르고 각 테마 토큰 값과 같다. (SPEC-PREVIEW-015 AC-011)

### 시나리오 C: system 테마 모드 (REQ-003)
- **Given** `useUIStore.theme='system'`이고 다이어그램이 렌더된 상태에서
- **When** OS 색 구성(`prefers-color-scheme`)이 바뀌면
- **Then** SVG 노드가 교체되지 않고 pele `render` 추가 호출 없이 새 테마 색이 적용된다. (SPEC-PREVIEW-015 AC-011)

### 시나리오 D: 보안 불변식 유지 (REQ-004) — must-pass (보안)
- **Given** 미리보기·AI·내보내기·프리셋 경로의 다이어그램 렌더에서
- **When** pele `render`를 감시하면
- **Then** 모든 호출이 strict 모드 고정 옵션(`links: false`, `images: false` 포함)으로 이뤄지고 호출자가 그 옵션을 바꾸지 못한다
- **And** 출력은 다이어그램 전용 정화 경로를 거쳐 `<script>`·이벤트 핸들러 속성이 남지 않는다. (SPEC-PREVIEW-015 AC-004, AC-005, AC-012)

### 시나리오 E: 문법 오류 폴백 유지 (REQ-005)
- **Given** 유효·거부·유효 순서의 다이어그램 펜스가 있는 문서에서
- **When** 프리뷰를 렌더하면
- **Then** 거부된 다이어그램은 `⚠ Diagram syntax error`에 위치 접미사(위치가 있을 때 `(L행 C열)`)를 붙여 표시하고
- **And** 나머지 다이어그램은 정상 렌더되며 예외가 밖으로 나가지 않는다. (SPEC-PREVIEW-015 AC-007, AC-008)

### 시나리오 F: 기존 프리뷰·인라인 SVG·내보내기 회귀 차단 (REQ-006) — must-pass
- **Given** 다이어그램 + 인라인 `<svg>`를 함께 포함한 마크다운, 그리고 내보내기 호출 경로가 주어지고
- **When** 프리뷰를 렌더하고 테마를 토글하면
- **Then** 인라인 SVG는 SPEC-PREVIEW-008 sanitize/복원대로 렌더되고 zoom·링크 핸들러가 기존대로 동작하며
- **And** 내보낸 다이어그램 색은 SPEC-PREVIEW-015 REQ-018(HTML·PDF는 내보내기 테마 값, DOCX는 항상 라이트 값)을 따르고
- **And** pele 버전 핀(1.10.0, SPEC-PREVIEW-015)이 변경되지 않는다. (SPEC-PREVIEW-015 AC-020, AC-023)

---

## 테스트 매핑 (REQ → 시나리오 → 도구)

| REQ | 시나리오 | 도구 | must-pass |
|-----|----------|------|-----------|
| REQ-PREVIEW010-001 | A | Playwright(첫 렌더 채움색·노드 유지) | - |
| REQ-PREVIEW010-002 | B | Vitest(SVG 노드 동일·render 추가 호출 0) + Playwright(라이브 재채색) | Y |
| REQ-PREVIEW010-003 | C | Vitest(system 모드 OS 신호 변경 시 노드 유지) | - |
| REQ-PREVIEW010-004 | D | Vitest(고정 옵션·정화 결과 단언) | Y |
| REQ-PREVIEW010-005 | E | Vitest(위치 접미사·개별 실패 격리) | - |
| REQ-PREVIEW010-006 | F | Vitest(인라인 SVG·zoom·링크 회귀, 내보내기 색 치환, 버전 가드) | Y |

> 시나리오 C(system/OS 테마 변경)는 must-pass가 아니다: 핵심 재채색 경로는 B가 이미 must-pass로 검증하며, C는 같은 CSS 변수 경로를 OS 신호로 트리거하는 파생 케이스다.

## Definition of Done

- [ ] 시나리오 A~F 전체 통과, must-pass(B·D·F) 100%.
- [ ] `tsc` 0 에러, `vitest` 전체 그린, Playwright E2E(라이트↔다크 라이브 재채색) 그린.
- [ ] 테마 토글 시 이미 보이는 다이어그램이 다시 렌더되지 않고 색만 바뀜을 E2E로 고정.
- [ ] 모든 다이어그램 렌더가 strict 모드 고정 옵션으로 호출됨을 가드 테스트로 고정.
- [ ] `⚠ Diagram syntax error` 폴백(위치 접미사 포함) 유지 확인.
- [ ] 인라인 SVG(SPEC-PREVIEW-008)·zoom·링크·내보내기 회귀 없음, pele 1.10.0 핀 무변경.
- [ ] TDD 준수: 각 시나리오의 실패 테스트(RED)를 구현 전에 작성했음을 커밋 이력으로 확인.
