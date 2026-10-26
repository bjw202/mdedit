---
id: SPEC-PREVIEW-010
version: "1.0.1"
status: draft
created: "2026-07-16"
updated: "2026-10-26"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-PREVIEW-001
  - SPEC-PREVIEW-006
tags:
  - preview
  - mermaid
  - dark-mode
  - theme
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-16 | jw | 최초 SPEC 작성 — 마크다운 프리뷰의 mermaid 다이어그램 테마를 앱의 라이트/다크 테마에 연동한다. 현재 `PreviewRenderer.tsx:24`가 `theme: 'default'`(mermaid 라이트 테마)를 모듈 로드 시 1회 하드코딩하므로, 다크 모드에서 다이어그램의 밝은 배경/색이 튄다. 핵심 요구는 **테마 토글 시 이미 그려진 다이어그램을 재렌더하여 재채색**하는 것(렌더된 SVG는 색을 굽어 넣으므로 자동 재채색되지 않음)이다. `securityLevel: 'strict'` 보안 불변식과 `⚠ Diagram syntax error` 폴백은 유지한다. 내보내기 경로(`exportUtils.ts`)는 이미 테마 대응하므로 범위 제외. |
| 1.0.1 | 2026-10-26 | jw | SPEC-PREVIEW-015로 개정 — 다이어그램 렌더러가 pele 1.10.0으로 바뀌면서 테마는 `--pele-*` CSS 변수를 앱 `--md-*` 토큰에 연결해 처리한다. REQ-001은 토큰 색 표시로, REQ-002·003은 "재렌더 없이 CSS 변수만으로 색 전환"으로 바꾸고 `initialize`·`render` 재호출 문구를 지웠다. REQ-004는 strict 모드(SPEC-PREVIEW-015 공통 정의), REQ-005는 위치 접미사가 붙는 오류 폴백으로, REQ-006은 둘째 줄(내보내기 색 = SPEC-PREVIEW-015 REQ-018)과 셋째 줄(pele 버전 핀 1.10.0)을 바꿨다. 같은 날 정리 작업으로 Overview 앞에 현재 상태 안내를 넣고 당시 소스 검증을 과거 기록으로, 목표 목록을 1.0.1 기준으로 고쳤다. Glossary에 `--pele-*`·strict 모드를 더하고 mermaid 용어를 1.0.0 기록으로 표시했으며, Security·Exclusions·References를 strict 모드·pele 핀 기준으로 바꿨다. acceptance.md는 시나리오 A~F를 개정된 REQ와 이를 고정하는 SPEC-PREVIEW-015 AC(004·005·007·008·011·012·020·023) 기준으로 다시 썼다. |

## Overview

> **현재 상태 (SPEC-PREVIEW-015, 2026-10-26)**: 다이어그램 렌더러가 mermaid 11.12.3에서 pele 1.10.0으로 바뀌었다. pele SVG는 색을 `var(--pele-…)` CSS 변수로 참조하고, 앱은 `mdedit-tokens.css`의 라이트·다크 블록에서 `--pele-*`를 `--md-*` 토큰에 연결한다. 그래서 테마 토글과 system 모드 변경은 다이어그램을 다시 렌더하지 않고 CSS 변수만으로 색을 바꾼다(REQ-001~003). 아래 문단과 Glossary의 mermaid 설명(`initialize`, `theme: 'default'`, 색 굽힘, 재렌더 트리거)은 1.0.0 당시 mermaid 기준 기록이다.

1.0.0 작성 당시 `mdedit`의 마크다운 프리뷰에서 mermaid 다이어그램은 **앱이 라이트/다크 어느 모드이든 항상 고정된 라이트 테마로 렌더되었다.** 당시 소스 검증 결과:

- `src/components/preview/PreviewRenderer.tsx:24`가 다음을 하드코딩한다:
  `mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });`
  `'default'`는 mermaid의 **라이트 테마**이며, 이 `initialize` 호출은 **모듈 로드 시 1회만** 실행되고 이후 테마 변경 시 갱신되지 않는다.
- 다이어그램 렌더는 `PreviewRenderer` 내부 `useEffect`(`.mermaid-container`를 찾아 `mermaid.render`)에서 수행되며, 이 effect의 의존성 배열은 **`[safeHtml]`뿐이다**(`PreviewRenderer.tsx:128`). 즉 문서 내용이 바뀔 때만 재렌더되고, **테마 토글만으로는 재렌더되지 않는다.**

결과적으로 다크 모드에서 다이어그램만 밝은 배경/색으로 남아 주변 다크 UI와 시각적으로 충돌했다(튀었다).

앱에는 이미 다크 모드 감지 인프라가 존재한다:
- `document.documentElement`에 `.dark` 클래스 + `data-theme="dark"` 속성이 설정된다(`useTheme` 훅, `src/hooks/useTheme.ts`, `useUIStore.theme` 연동, system/dark/light 3모드).
- 이 신호를 읽는 선례: `src/components/preview/CodeFileViewer.tsx:68`(`document.documentElement.classList.contains('dark')`로 Shiki github-dark/light 스와프), 에디터 커서 테마 스와프(`src/components/editor/extensions/markdown-extensions.ts`).
- **1.0.0 당시 내보내기 경로는 이미 테마 대응 mermaid 배경을 적용했다**: `src/lib/export/exportUtils.ts:71`(`theme === 'dark' ? '#1f2937' : '#f9fafb'`). 즉 **라이브 프리뷰만** 테마 인식이 빠져 있었다. 지금 내보내기 다이어그램 색은 SPEC-PREVIEW-015 REQ-018을 따른다.

본 SPEC은 이 공백을 다음으로 채운다(1.0.1 기준):
- **초기 렌더 테마 정합**: 다이어그램을 현재 앱 테마의 토큰 색으로 표시하고, 다크 모드에서 라이트 색으로 먼저 그리지 않는다.
- **테마 토글 시 라이브 재채색**: 라이트↔다크 전환 시 **이미 보이는** 다이어그램을 다시 렌더하지 않고 CSS 변수만으로 새 테마 색을 적용한다.
- **보안·폴백 불변식 유지**: strict 모드(SPEC-PREVIEW-015 공통 정의)와 위치 접미사가 붙는 문법 오류 폴백을 유지한다.

구현 전략·테마 감지 배선 옵션·재렌더 트리거 설계·TDD 테스트 계획은 plan.md, Given-When-Then 수용 시나리오·테스트 매핑은 acceptance.md 참조.

## Glossary

- **`--pele-*` 테마 변수**: pele SVG가 색·글꼴을 참조하는 CSS 사용자 정의 속성. `mdedit-tokens.css`의 라이트·다크 블록에서 앱 `--md-*` 토큰에 연결되어, 테마가 바뀌면 다시 렌더하지 않아도 색이 바뀐다(SPEC-PREVIEW-015 design.md D5).
- **strict 모드**: SPEC-PREVIEW-015 "다른 SPEC 개정" 절의 공통 정의(pele 기본 보안 + `links: false`·`images: false` + 다이어그램 전용 정화).

아래 항목 중 "mermaid 테마", "초기화 1회성", "색 굽힘", "재렌더 트리거"는 1.0.0 당시 mermaid 기준 용어로, 지금 렌더 경로에는 해당하지 않는다. "앱 테마 신호"는 지금도 그대로다.

- **mermaid 테마(mermaid theme)**: `mermaid.initialize({ theme })`에 전달하는 문자열. `'default'`는 라이트 팔레트, `'dark'`는 다크 팔레트. (`'base'` + 커스텀 토큰은 팔레트 미세 조정이 필요할 때의 대안이며 exact 선택은 plan 결정 사항.)
- **앱 테마 신호(app theme signal)**: 앱의 현재 라이트/다크 상태. 소스는 `useUIStore.theme`(light/dark/system)이며 `useTheme` 훅이 `document.documentElement`에 `.dark` 클래스 + `data-theme="dark"`로 반영한다. `system` 모드에서는 OS `prefers-color-scheme`를 따른다.
- **초기화 1회성(one-shot initialize)**: `mermaid.initialize`는 전역 설정을 갱신하는 부수효과 호출로, 모듈 로드 시 1회 실행되면 이후 자동 재적용되지 않는다. 테마를 바꾸려면 **현재 테마로 다시 `initialize`한 뒤 다이어그램을 재렌더**해야 한다.
- **색 굽힘(baked colors)**: `mermaid.render`가 산출한 SVG 문자열은 색상을 인라인으로 굽어 넣는다. 따라서 이미 DOM에 삽입된 SVG는 테마가 바뀌어도 CSS만으로는 자동 재채색되지 않으며, `render`를 다시 호출해 SVG를 교체해야 한다.
- **재렌더 트리거(re-render trigger)**: 테마 변경을 감지하여 `.mermaid-container`의 다이어그램을 다시 `render`하도록 만드는 신호. 현재는 `useEffect` 의존성이 `[safeHtml]`뿐이라 존재하지 않는다(본 SPEC의 핵심 추가 대상).
- **문법 오류 폴백(syntax-error fallback)**: pele가 다이어그램을 거부하면 `⚠ Diagram syntax error`에 위치 접미사(SPEC-PREVIEW-015 REQ-009)를 붙여 표시하는 동작. 본 SPEC에서 유지한다(1.0.0 당시에는 `mermaid.parse`/`render` 실패 시 접미사 없이 표시했다).

## EARS Requirements

### REQ-PREVIEW010-001: 앱 테마에 맞는 초기 다이어그램 렌더 (State-driven)

- **While** 앱이 다크(라이트) 모드이면, the preview **shall** 다이어그램을 `--pele-*`가 연결된 다크(라이트) 토큰 색으로 표시하고, 다크 모드에서 처음 열 때 라이트 색으로 먼저 그리지 않는다.

### REQ-PREVIEW010-002: 테마 토글 시 라이브 재채색 (Event-driven) — 핵심

- **When** 사용자가 테마를 토글하면, the preview **shall** 이미 보이는 다이어그램을 다시 렌더하지 않고 CSS 변수만으로 새 테마 색을 적용한다.

### REQ-PREVIEW010-003: system 테마 모드 대응 (Event-driven)

- **When** system 모드에서 OS 색 구성이 바뀌면, the preview **shall** REQ-PREVIEW010-002와 같이 재렌더 없이 색을 바꾼다.

### REQ-PREVIEW010-004: 보안 불변식 유지 (Ubiquitous)

- The diagram module **shall** 모든 렌더를 strict 모드(SPEC-PREVIEW-015 "다른 SPEC 개정" 절의 공통 정의)로 한다.

### REQ-PREVIEW010-005: 문법 오류 폴백 유지 (Event-driven)

- **When** pele가 다이어그램을 거부하면, the preview **shall** `⚠ Diagram syntax error`에 위치 접미사(SPEC-PREVIEW-015 REQ-009)를 붙여 표시하고, 다른 다이어그램을 막지 않는다.

### REQ-PREVIEW010-006: 기존 프리뷰·인라인 SVG·내보내기 회귀 차단 (Unwanted behavior)

- The system **shall** 마크다운 렌더 파이프라인(SPEC-PREVIEW-001), 인라인 SVG sanitize/복원(SPEC-PREVIEW-008), zoom 규약을 회귀 없이 유지한다.
- 내보내기 다이어그램 색은 SPEC-PREVIEW-015 REQ-018을 따른다.
- The system **shall** pele 버전 핀(1.10.0, SPEC-PREVIEW-015)을 바꾸지 않는다.

## Security

본 SPEC의 보안 불변식은 **"테마 연동 때문에 다이어그램 보안 설정을 약화하지 않는다"** 이다.

- 1.0.1부터 테마 전환은 CSS 변수만 바꾸고 다이어그램을 다시 렌더하지 않으므로, 테마 때문에 렌더 옵션을 다시 넘기는 경로 자체가 없다.
- 모든 렌더는 strict 모드(SPEC-PREVIEW-015 공통 정의)의 고정 옵션으로 한다. 옵션 고정은 SPEC-PREVIEW-015의 가드 테스트(AC-004)로 고정한다.
- 잔여 위험: pele 버전 업그레이드로 기본 보안 동작이 바뀔 수 있으나, 버전 핀(1.10.0)을 유지하므로 범위 밖이다.
- 1.0.0(mermaid) 당시에는 테마 스와프마다 `mermaid.initialize`를 다시 호출했고, 그때 `securityLevel: 'strict'`를 유지하는 것이 불변식이었다.

## Exclusions (What NOT to Build) / Non-Goals

- **내보내기 경로 변경 미포함** — 내보내기 다이어그램 색은 SPEC-PREVIEW-015 REQ-018 소관이며 이 SPEC은 라이브 프리뷰만 대상으로 한다.
- **커스텀 팔레트/브랜드 토큰 튜닝 미포함** — `--pele-*`는 기존 `--md-*` 토큰에 연결할 뿐이며(SPEC-PREVIEW-015 design.md D5), 다이어그램 전용 팔레트 조정은 별도 후속 작업 대상이다.
- **다이어그램 렌더러 버전 변경 미포함** — pele `1.10.0` 핀(SPEC-PREVIEW-006 REQ-005, SPEC-PREVIEW-015)을 유지한다.
- **다이어그램별 개별 테마 오버라이드 미포함** — `%%{init}%%` 프론트매터로 다이어그램마다 다른 테마를 지정하는 기능은 범위 밖.
- **문법 오류 폴백 UI 재설계 미포함** — `⚠ Diagram syntax error` 문구/모양은 유지하며 개선하지 않는다.
- **에디터/코드 뷰어/기타 프리뷰 기능 변경 미포함** — 변경은 `PreviewRenderer.tsx`와 기존 테마 신호 배선에 집중한다(스코프 규율).
- **보안 설정 완화 미포함** — 어떤 이유로도 strict 모드를 낮추지 않는다(보안 불변식).

## References

- SPEC-PREVIEW-015 — 다이어그램 렌더러 pele 1.10.0 교체, `--pele-*` 테마 변수, strict 모드 공통 정의, 내보내기 색(REQ-018)
- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인 + `PreviewRenderer`(다이어그램 렌더 지점, 회귀 검증 대상)
- SPEC-PREVIEW-006 — subgraph 제목 1줄 목표 + pele `1.10.0` 고정(버전 무변경 유지)
- SPEC-PREVIEW-008 — 인라인 SVG sanitize/복원(동일 컴포넌트 내 회귀 검증 대상)
- `src/styles/mdedit-tokens.css` — `--pele-*` ↔ `--md-*` 연결(라이트·다크 두 블록)
- 아래 `PreviewRenderer.tsx`·`exportUtils.ts` 줄 번호와 설명은 1.0.0 당시 mermaid 코드 기준이다.
- `src/components/preview/PreviewRenderer.tsx:24` — (1.0.0 당시) `mermaid.initialize({ theme: 'default' })`(테마 하드코딩)
- `src/components/preview/PreviewRenderer.tsx:66-128` — (1.0.0 당시) mermaid 렌더 `useEffect`, 의존성 `[safeHtml]`
- `src/hooks/useTheme.ts` — `.dark`/`data-theme` 토글 + system 모드(테마 신호 소스)
- `src/store/uiStore.ts` — `useUIStore.theme`(light/dark/system, 테마 상태 원천)
- `src/components/preview/CodeFileViewer.tsx:68` — `document.documentElement.classList.contains('dark')`(테마 신호 읽기 선례)
- `src/lib/export/exportUtils.ts:71` — (1.0.0 당시) 내보내기의 테마 대응 mermaid 배경(라이브 프리뷰 대응의 선례)
