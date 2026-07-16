# SPEC-PREVIEW-010 — 수용 기준

> 게이트 = tsc + vitest + Playwright(eslint 아님). 렌더·테마 배선·재초기화 인자는 Vitest + @testing-library/react(mermaid 모듈 mock, `initialize`/`render`/`parse` 스파이)로, 실제 라이트↔다크 토글 시 라이브 재채색은 Playwright로 검증한다. 방법론은 TDD이므로 각 시나리오의 실패 테스트를 먼저 작성(RED)한다. 보안(시나리오 D)·핵심 재채색(B)·회귀(F)가 must-pass.

## 사전 준비

- **픽스처(마크다운)**: mermaid 코드펜스(```mermaid ... ```) 1개를 포함한 `.md`, mermaid 2개(정상 + 문법 오류) 포함 `.md`, mermaid + 인라인 `<svg>` 동시 포함 `.md`.
- **mock**: `mermaid` 모듈(`initialize`/`render`/`parse` 스파이, `render`는 `{ svg }` 반환), `useUIStore.theme`(light/dark/system 주입), `window.matchMedia('(prefers-color-scheme: dark)')`(system 모드용), `document.documentElement`의 `.dark`/`data-theme` 상태.
- **관찰 대상**: `mermaid.initialize` 호출 인자(특히 `theme`, `securityLevel`, `startOnLoad`), `mermaid.render` 재호출 횟수, `.mermaid-container.innerHTML` 교체 여부.

---

## 기능 시나리오

### 시나리오 A: 앱 테마에 맞는 초기 렌더 (REQ-001)
- **Given** 앱이 다크 모드(`useUIStore.theme='dark'`, `document.documentElement`에 `.dark`)이고 mermaid 다이어그램을 포함한 마크다운이 주어지고
- **When** 프리뷰가 처음 마운트되어 다이어그램이 최초 렌더되면
- **Then** `mermaid.initialize`가 `theme: 'dark'`로 호출되고 다이어그램이 다크 팔레트로 렌더된다
- **And** 라이트 모드에서는 동일 흐름에서 `theme: 'default'`로 호출된다
- **And** 다크에서 라이트 테마로 먼저 그렸다가 교체하지 않는다(처음부터 다크).

### 시나리오 B: 테마 토글 시 라이브 재채색 (REQ-002) — must-pass (핵심)
- **Given** 라이트 모드에서 mermaid 다이어그램이 이미 프리뷰에 렌더되어 보이는 상태에서
- **When** 사용자가 앱 테마를 다크로 토글하면(문서 내용/`safeHtml` 불변)
- **Then** `mermaid.initialize`가 `theme: 'dark'`로 다시 호출되고 `.mermaid-container`의 다이어그램이 `mermaid.render`로 다시 렌더되어 SVG가 교체된다
- **And** 편집·재입력 없이 이미 보이던 다이어그램이 다크 색으로 재채색된다
- **And** 다시 라이트로 토글하면 `theme: 'default'`로 재렌더되어 라이트 색으로 복귀한다.

### 시나리오 C: system 테마 모드 (REQ-003)
- **Given** `useUIStore.theme='system'`이고 `matchMedia('(prefers-color-scheme: dark)')`가 다크로 mock된 상태에서
- **When** 프리뷰가 렌더되면
- **Then** 다이어그램이 다크 테마로 렌더되고
- **When** OS 색 구성이 라이트로 바뀌는 `change` 이벤트가 발생하면
- **Then** 다이어그램이 라이트 테마로 재렌더되어 dark/light 명시 모드와 동일한 재채색 경로를 탄다.

### 시나리오 D: 보안 불변식 유지 (REQ-004) — must-pass (보안)
- **Given** 임의의 테마 상태와 테마 토글 시퀀스에서
- **When** `mermaid.initialize`가 최초 및 재초기화로 호출될 때마다
- **Then** 모든 호출 인자에 `securityLevel: 'strict'`와 `startOnLoad: false`가 포함된다
- **And** 어떤 호출도 `securityLevel`을 `'loose'`/`'antiscript'`/`'sandbox'` 등으로 약화하지 않는다.

### 시나리오 E: 문법 오류 폴백 유지 (REQ-005)
- **Given** 정상 다이어그램 1개 + 문법 오류 다이어그램 1개를 포함한 마크다운에서(`mermaid.parse`가 오류 다이어그램에 대해 throw하도록 mock)
- **When** 프리뷰를 렌더하고 이후 테마를 토글하면
- **Then** 오류 다이어그램은 `⚠ Diagram syntax error` 안내를 표시하고
- **And** 정상 다이어그램은 새 테마로 재채색되며
- **And** 오류가 앱·다른 다이어그램·프리뷰 전체를 중단시키지 않는다.

### 시나리오 F: 기존 프리뷰·인라인 SVG·내보내기 회귀 차단 (REQ-006) — must-pass
- **Given** mermaid + 인라인 `<svg>`를 함께 포함한 마크다운, 그리고 내보내기 호출 경로가 주어지고
- **When** 프리뷰를 렌더하고 테마를 토글하면
- **Then** 인라인 SVG는 SPEC-PREVIEW-008 sanitize/복원대로 렌더되고 zoom·링크 핸들러가 기존대로 동작하며
- **And** 내보내기(`exportUtils.ts`)의 테마 대응 mermaid 배경 로직은 변경 없이 그대로 동작하고
- **And** mermaid 버전 핀(11.12.3, SPEC-PREVIEW-006)이 변경되지 않는다.

---

## 테스트 매핑 (REQ → 시나리오 → 도구)

| REQ | 시나리오 | 도구 | must-pass |
|-----|----------|------|-----------|
| REQ-PREVIEW010-001 | A | Vitest(initialize theme 인자 스파이) | - |
| REQ-PREVIEW010-002 | B | Vitest(테마 토글 시 재init+재render 스파이) + Playwright(라이브 재채색) | Y |
| REQ-PREVIEW010-003 | C | Vitest(system 실효 테마 + matchMedia change) | - |
| REQ-PREVIEW010-004 | D | Vitest(모든 initialize 인자 securityLevel/startOnLoad 단언) | Y |
| REQ-PREVIEW010-005 | E | Vitest(parse throw → 폴백, 정상은 재채색) | - |
| REQ-PREVIEW010-006 | F | Vitest(인라인 SVG·zoom·링크 회귀) + Playwright(내보내기 무변경) | Y |

> 시나리오 C(system/OS 테마 변경)는 must-pass가 아니다: 핵심 재채색 로직은 B가 이미 must-pass로 검증하며, C는 동일 재채색 경로를 OS 신호로 트리거하는 파생 케이스다. 다만 plan.md에서 medium 리스크(store 구독이 DOM-only `.dark` 변경을 놓칠 수 있음)로 표시했으므로, C는 반드시 Vitest 커버리지를 유지하고 회귀 시 즉시 승격한다.

## Definition of Done

- [ ] 시나리오 A~F 전체 통과, must-pass(B·D·F) 100%.
- [ ] `tsc` 0 에러, `vitest` 전체 그린, Playwright E2E(라이트↔다크 라이브 재채색) 그린.
- [ ] 테마 토글 시 이미 보이는 다이어그램이 편집 없이 재채색됨을 E2E로 고정(핵심 실패 모드 방어).
- [ ] 모든 `mermaid.initialize` 호출에 `securityLevel: 'strict'`·`startOnLoad: false` 유지 가드.
- [ ] `⚠ Diagram syntax error` 폴백 유지 확인(테마 토글 후에도).
- [ ] 인라인 SVG(SPEC-PREVIEW-008)·zoom·링크·내보내기 회귀 없음, mermaid 11.12.3 핀 무변경.
- [ ] `PreviewRenderer.tsx`에 @MX 태그(plan.md @MX Tag Targets: SPEC-PREVIEW-010 SPEC 태그, 보안 WARN) 부여.
- [ ] TDD 준수: 각 시나리오의 실패 테스트(RED)를 구현 전에 작성했음을 커밋 이력으로 확인.
