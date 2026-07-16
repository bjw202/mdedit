# SPEC-PREVIEW-010 — 구현 계획

> 본 문서는 WHAT/WHY(spec.md)에 대한 HOW를 다룬다. 개발 방법론은 **TDD**(quality.yaml, RED-GREEN-REFACTOR)이며 브라운필드 확장이다. 확정/후보 기술 결정, 테마 감지 배선 옵션, 재렌더 트리거 설계, TDD 테스트 계획, 리스크를 기록한다. Given-When-Then 수용 시나리오는 acceptance.md 참조.

## 핵심 문제 요약 (Root Cause)

1. `PreviewRenderer.tsx:24` — `mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' })`가 **모듈 로드 시 1회** 실행. `'default'`는 라이트 테마 고정.
2. `PreviewRenderer.tsx:66-128` — 다이어그램 렌더 `useEffect`의 의존성이 **`[safeHtml]`뿐**. 테마 토글은 이 effect를 재실행하지 않는다.
3. `mermaid.render`가 산출한 SVG는 색을 굽어 넣으므로(baked), 이미 DOM에 삽입된 다이어그램은 테마가 바뀌어도 재채색되지 않는다 → **재초기화 + 재렌더가 반드시 필요**하다.

## 결정 사항 (Decisions)

| # | 결정 | 내용 | 상태 | 근거 |
|---|------|------|------|------|
| D1 | **테마별 mermaid theme 매핑** | 다크 → `theme: 'dark'`, 라이트 → `theme: 'default'`. `'base'`+커스텀 토큰은 팔레트 미세조정이 필요할 때의 후속 옵션으로만 남긴다. | 권장(기본) | spec.md 요구. 최소 변경으로 즉시 조화. 팔레트 튜닝은 Non-Goal. |
| D2 | **설정 상수 단일화** | `startOnLoad`/`securityLevel`을 고정한 베이스 설정 객체를 두고 `theme`만 교체해 `initialize`에 넘긴다. | 확정 | 재초기화 시 `securityLevel: 'strict'` 누락/약화 방지(REQ-004 보안 불변식). |
| D3 | **재렌더 = 재초기화 + 재render** | 테마 변경 시 ①현재 테마로 `mermaid.initialize` 재호출 → ②`.mermaid-container`를 다시 순회하며 `mermaid.render`로 SVG 교체. CSS-only 재채색은 불가(baked). | 확정 | REQ-002 핵심. 렌더된 SVG는 자동 재채색 안 됨. |
| D4 | **테마 감지 배선 = `useTheme`/store 파생 우선, MutationObserver는 폴백** | 아래 "테마 감지 배선 옵션" 참조. 1순위: `useUIStore.theme`(+system 실효값)을 effect 의존성에 추가. | 권장(결정 지점) | 앱 상태를 직접 구독하는 편이 DOM 관찰보다 명시적이고 테스트 용이. system 모드 OS 변경은 useTheme가 이미 처리. |
| D5 | **effect 의존성 확장** | 다이어그램 렌더 effect의 의존성에 `[safeHtml, effectiveTheme]`를 사용해 테마 변경만으로도 재렌더가 트리거되게 한다. | 확정 | 현재 `[safeHtml]`만이라 테마 트리거 부재(근본 원인 2). |
| D6 | **문법 오류 폴백·개별 catch 유지** | 재렌더 경로에서도 다이어그램별 `try/catch`와 `⚠ Diagram syntax error`를 그대로 유지. | 확정 | REQ-005. 한 다이어그램 실패가 재채색 전체를 막지 않도록. |

## 테마 감지 배선 옵션 (결정 지점 D4)

| 옵션 | 방법 | 장점 | 단점 | 권장 |
|------|------|------|------|------|
| **A. store/훅 파생 (권장)** | `useUIStore.theme`를 구독하고, `system`이면 `prefers-color-scheme`로 실효 라이트/다크를 파생해 `effectiveTheme`를 만든 뒤 렌더 effect 의존성에 추가. system OS 변경은 `useTheme`가 이미 `.dark`를 토글하므로, 실효값 파생을 `matchMedia`로 동기화하거나 `useTheme`가 노출하는 값을 재사용. | 앱 상태를 명시적으로 구독 → 테스트에서 store mock으로 결정론적 검증 가능. React 관용. | `system` 실효값 파생 로직을 컴포넌트에서 한 번 구현해야 함. | **O** |
| **B. MutationObserver 폴백** | `document.documentElement`의 `class`/`data-theme` 속성 변화를 관찰해 재렌더 트리거. | 테마 소스가 무엇이든(다른 코드가 `.dark`를 바꿔도) 반응. `CodeFileViewer`가 읽는 신호와 동일 소스. | effect 정리(observer disconnect) 필요, 테스트가 DOM 변이 시뮬레이션 의존. store 대비 암묵적. | 폴백 |

권장: **옵션 A**를 기본으로 하고, 옵션 A가 `system` OS 변경(앱 상태 불변, DOM `.dark`만 변경)을 놓칠 경우에 한해 옵션 B(또는 `matchMedia('change')` 구독)를 보완으로 채택. 최종 배선은 RED 테스트가 요구하는 최소 형태로 GREEN에서 확정.

## 재렌더 트리거 설계

- 현재 렌더 로직(`PreviewRenderer.tsx:66-128`)의 다이어그램 렌더 블록을 **테마 변경에도 반응**하도록 확장한다.
- 렌더 직전에 `mermaid.initialize({ ...BASE_CONFIG, theme: effectiveTheme })`를 호출(D2 상수 재사용) → `.mermaid-container` 순회 재렌더(D3).
- 이미 렌더된 컨테이너는 `el.innerHTML`을 새 SVG로 덮어써 굽힌 색을 교체한다. (컨테이너의 원본 `data-diagram` 속성은 소스로 보존되어 있으므로 재렌더 입력이 유실되지 않음 — `PreviewRenderer.tsx:74` 참조.)
- 링크 클릭 핸들러 등 다른 effect 부수효과는 기존 동작을 유지(스코프 규율).

## TDD 테스트 계획 (RED → GREEN → REFACTOR)

방법론: TDD. **먼저 실패하는 테스트(RED)** 를 작성하고 최소 구현(GREEN) 후 정리(REFACTOR). 게이트 = tsc + vitest + Playwright(eslint 아님 — `npm run lint`는 설정 부재로 항상 실패, 회귀 오판 금지).

### RED 우선 테스트 목록

1. **초기 다크 렌더(REQ-001)** — 다크 신호가 주어진 상태에서 마운트 시 `mermaid.initialize`가 `theme: 'dark'`로 호출되고, 라이트 신호면 `theme: 'default'`로 호출됨을 검증(mermaid 모듈 mock, `initialize`/`render` 스파이). 현재 코드는 항상 `'default'`이므로 다크 케이스에서 RED.
2. **테마 토글 재채색(REQ-002, 핵심)** — 라이트로 다이어그램을 렌더한 뒤 테마를 다크로 토글하면, **safeHtml 불변** 상태에서 `mermaid.initialize(theme:'dark')` + `mermaid.render`가 다시 호출됨을 검증. 현재 effect 의존성이 `[safeHtml]`뿐이라 RED.
3. **system 모드(REQ-003)** — `theme: 'system'` + `prefers-color-scheme: dark` mock에서 다크 렌더, OS 변경 이벤트 시 재렌더 트리거 검증.
4. **보안 불변식(REQ-004)** — 모든 `initialize` 호출 인자에 `securityLevel: 'strict'`, `startOnLoad: false`가 포함됨을 스파이로 단언(재초기화 시에도).
5. **문법 오류 폴백(REQ-005)** — `mermaid.parse`가 throw하도록 mock했을 때 `⚠ Diagram syntax error`가 표시되고, 테마 토글 후에도 폴백이 유지되며 다른 정상 다이어그램은 재채색됨.
6. **회귀(REQ-006)** — 인라인 SVG 복원(SPEC-PREVIEW-008), zoom 적용, 링크 핸들러가 기존대로 동작. 내보내기(`exportUtils.ts`) 무변경 확인.

### Playwright(E2E)
- 실제 라이트↔다크 토글 후 이미 보이는 mermaid 다이어그램의 배경색이 다크 팔레트로 바뀌는지(스냅샷/계산 스타일) 검증 — **편집 없이** 재채색됨을 확인(핵심 시나리오).

## [DELTA] Brownfield Change Map

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [MODIFY] | `src/components/preview/PreviewRenderer.tsx` | (1) 모듈 로드 `mermaid.initialize`를 베이스 설정 상수(D2)로 리팩터, `theme`만 동적. (2) 컴포넌트에서 `effectiveTheme`(D4, store/훅 파생)를 구독. (3) 다이어그램 렌더 `useEffect` 의존성을 `[safeHtml, effectiveTheme]`로 확장(D5), 렌더 직전 현재 테마로 재초기화 후 `.mermaid-container` 재렌더(D3). (4) `securityLevel:'strict'`/`startOnLoad:false`/문법 오류 폴백 유지. @MX:ANCHOR 유지, @MX:SPEC에 SPEC-PREVIEW-010 추가. |
| [EXISTING] | `src/hooks/useTheme.ts` | 무변경 — 테마 신호 소스로만 사용. 필요 시 실효 테마 파생 값 재사용. |
| [EXISTING] | `src/store/uiStore.ts` | 무변경 — `theme`(light/dark/system) 구독 원천. |
| [EXISTING] | `src/lib/export/exportUtils.ts` | 무변경 — 이미 테마 대응(선례). 본 SPEC 범위 밖. |
| [EXISTING] | `src/lib/preview/svgSanitize.ts`, `src/lib/markdown/renderer.ts` | 무변경 — 인라인 SVG/파이프라인 회귀 검증 대상. |

## @MX Tag Targets

- **`PreviewRenderer`(`PreviewRenderer.tsx`)** — 이미 `@MX:ANCHOR`(fan_in >= 3). 테마 연동 추가 시 ANCHOR 유지 + `@MX:SPEC: SPEC-PREVIEW-010` 추가. 재초기화 시 `securityLevel:'strict'` 유지 불변식을 `@MX:WARN`/`@MX:REASON`으로 명시(약화 시 XSS).
- **`mermaid.initialize` 라인** — `@MX:NOTE`: "theme만 동적, securityLevel:'strict'·startOnLoad:false는 베이스 상수로 고정. 테마 토글 시 재초기화+재렌더 필요(렌더 SVG는 색을 굽어 넣음)".
- **테마 재렌더 effect** — 신규 트리거 배선 구간은 초기 `@MX:TODO`(GREEN에서 해소), 완료 후 `@MX:NOTE`(테마 파생·재채색 의도).

## 리스크 및 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 재초기화 시 `securityLevel` 누락으로 보안 약화 | 높음(보안) | D2 베이스 상수 단일화 + RED 테스트 4로 모든 initialize 인자 단언. |
| **재렌더 트리거 누락**(가장 큰 실패 모드) — 테마 토글 후 기존 다이어그램이 옛 색 유지 | 높음(기능) | RED 테스트 2(핵심) + Playwright 재채색 E2E로 고정. effect 의존성에 `effectiveTheme` 포함 확인. |
| system 모드 OS 변경을 store 구독이 놓침(앱 상태 불변, DOM만 변경) | 중간 | 옵션 A가 놓치면 `matchMedia('change')` 또는 MutationObserver(옵션 B) 보완. RED 테스트 3으로 검증. |
| 재렌더 중 다이어그램 소스 유실 | 낮음 | `data-diagram` 속성이 원본 소스를 보존(기존 구조 재사용). |
| mermaid 다크 팔레트가 앱 다크 배경과 완전히 일치하지 않음 | 낮음 | 기본은 `'dark'` 사용, 필요 시 `'base'`+토큰은 후속(Non-Goal). |

## 검증 게이트

- 본 저장소 게이트: **tsc + vitest + Playwright**(eslint 아님).
- must-pass: 시나리오 B(테마 토글 재채색), D(보안 불변식), F(회귀). acceptance.md 테스트 매핑 참조.
