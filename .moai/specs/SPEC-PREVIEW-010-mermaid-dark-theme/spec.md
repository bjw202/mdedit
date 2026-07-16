---
id: SPEC-PREVIEW-010
version: "1.0.0"
status: draft
created: "2026-07-16"
updated: "2026-07-16"
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

## Overview

`mdedit`의 마크다운 프리뷰에서 mermaid 다이어그램은 **앱이 라이트/다크 어느 모드이든 항상 고정된 라이트 테마로 렌더된다.** 소스 검증 결과:

- `src/components/preview/PreviewRenderer.tsx:24`가 다음을 하드코딩한다:
  `mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });`
  `'default'`는 mermaid의 **라이트 테마**이며, 이 `initialize` 호출은 **모듈 로드 시 1회만** 실행되고 이후 테마 변경 시 갱신되지 않는다.
- 다이어그램 렌더는 `PreviewRenderer` 내부 `useEffect`(`.mermaid-container`를 찾아 `mermaid.render`)에서 수행되며, 이 effect의 의존성 배열은 **`[safeHtml]`뿐이다**(`PreviewRenderer.tsx:128`). 즉 문서 내용이 바뀔 때만 재렌더되고, **테마 토글만으로는 재렌더되지 않는다.**

결과적으로 다크 모드에서 다이어그램만 밝은 배경/색으로 남아 주변 다크 UI와 시각적으로 충돌한다(튄다).

앱에는 이미 다크 모드 감지 인프라가 존재한다:
- `document.documentElement`에 `.dark` 클래스 + `data-theme="dark"` 속성이 설정된다(`useTheme` 훅, `src/hooks/useTheme.ts`, `useUIStore.theme` 연동, system/dark/light 3모드).
- 이 신호를 읽는 선례: `src/components/preview/CodeFileViewer.tsx:68`(`document.documentElement.classList.contains('dark')`로 Shiki github-dark/light 스와프), 에디터 커서 테마 스와프(`src/components/editor/extensions/markdown-extensions.ts`).
- **내보내기 경로는 이미 테마 대응 mermaid 배경을 적용한다**: `src/lib/export/exportUtils.ts:71`(`theme === 'dark' ? '#1f2937' : '#f9fafb'`). 즉 **라이브 프리뷰만** 테마 인식이 빠져 있다 — 이를 선례로 삼는다.

본 SPEC은 이 공백을 다음으로 채운다:
- **초기 렌더 테마 정합**: 현재 앱 테마에 맞는 mermaid 테마로 다이어그램을 그린다(다크면 다크 테마, 라이트면 라이트 테마).
- **테마 토글 시 라이브 재채색**: 라이트↔다크 전환 시 **이미 보이는** 다이어그램을 편집/재입력 없이 재렌더하여 새 테마 색으로 다시 그린다.
- **보안·폴백 불변식 유지**: `securityLevel: 'strict'`와 문법 오류 폴백을 그대로 보존한다.

구현 전략·테마 감지 배선 옵션·재렌더 트리거 설계·TDD 테스트 계획은 plan.md, Given-When-Then 수용 시나리오·테스트 매핑은 acceptance.md 참조.

## Glossary

- **mermaid 테마(mermaid theme)**: `mermaid.initialize({ theme })`에 전달하는 문자열. `'default'`는 라이트 팔레트, `'dark'`는 다크 팔레트. (`'base'` + 커스텀 토큰은 팔레트 미세 조정이 필요할 때의 대안이며 exact 선택은 plan 결정 사항.)
- **앱 테마 신호(app theme signal)**: 앱의 현재 라이트/다크 상태. 소스는 `useUIStore.theme`(light/dark/system)이며 `useTheme` 훅이 `document.documentElement`에 `.dark` 클래스 + `data-theme="dark"`로 반영한다. `system` 모드에서는 OS `prefers-color-scheme`를 따른다.
- **초기화 1회성(one-shot initialize)**: `mermaid.initialize`는 전역 설정을 갱신하는 부수효과 호출로, 모듈 로드 시 1회 실행되면 이후 자동 재적용되지 않는다. 테마를 바꾸려면 **현재 테마로 다시 `initialize`한 뒤 다이어그램을 재렌더**해야 한다.
- **색 굽힘(baked colors)**: `mermaid.render`가 산출한 SVG 문자열은 색상을 인라인으로 굽어 넣는다. 따라서 이미 DOM에 삽입된 SVG는 테마가 바뀌어도 CSS만으로는 자동 재채색되지 않으며, `render`를 다시 호출해 SVG를 교체해야 한다.
- **재렌더 트리거(re-render trigger)**: 테마 변경을 감지하여 `.mermaid-container`의 다이어그램을 다시 `render`하도록 만드는 신호. 현재는 `useEffect` 의존성이 `[safeHtml]`뿐이라 존재하지 않는다(본 SPEC의 핵심 추가 대상).
- **문법 오류 폴백(syntax-error fallback)**: `mermaid.parse`/`render` 실패 시 `⚠ Diagram syntax error` 안내를 표시하는 현재 동작(`PreviewRenderer.tsx:81`). 본 SPEC에서 유지한다.

## EARS Requirements

### REQ-PREVIEW010-001: 앱 테마에 맞는 초기 다이어그램 렌더 (State-driven)

- **WHILE** 앱이 다크 모드인 동안(`document.documentElement`에 `.dark`/`data-theme="dark"`가 설정됨), **the system shall** mermaid 다이어그램을 다크 테마(권장: `theme: 'dark'`)로 렌더하여 다이어그램 배경/색이 다크 UI와 조화되게 한다.
- **WHILE** 앱이 라이트 모드인 동안, **the system shall** mermaid 다이어그램을 라이트 테마(권장: `theme: 'default'`)로 렌더한다.
- **WHEN** 프리뷰가 다크 모드에서 처음 열려 다이어그램이 최초 렌더되면, **the system shall** 라이트 테마로 먼저 그린 뒤 교체하지 않고, 처음부터 현재(다크) 테마로 렌더한다.

### REQ-PREVIEW010-002: 테마 토글 시 라이브 재채색 (Event-driven) — 핵심

- **WHEN** 사용자가 앱 테마를 라이트↔다크로 토글하면, **the system shall** 프리뷰에 **이미 보이는** mermaid 다이어그램을 편집·재입력 없이 새 테마로 재렌더하여 재채색한다.
- The system **shall** 테마 토글 시 현재 테마로 mermaid를 다시 초기화(`initialize`)한 뒤 `.mermaid-container`의 다이어그램을 다시 `render`하여, 이전 테마 색이 굽어 있는 기존 SVG를 교체한다.
- The system **shall** 재채색을 문서 내용 변경(`safeHtml` 변경)에 의존하지 않고 테마 신호 변경만으로 트리거한다.

### REQ-PREVIEW010-003: system 테마 모드 대응 (Event-driven)

- **WHEN** 앱 테마가 `system`으로 설정되어 있고 OS 색 구성(`prefers-color-scheme`)이 변경되면, **the system shall** 결과적으로 반영된 라이트/다크 상태에 맞춰 다이어그램을 재렌더한다.
- The system **shall** `system` 모드에서의 실효 테마(effective theme) 판정을 `.dark`/`data-theme` 신호 또는 `useUIStore`/`useTheme` 파생 값에서 읽어, dark/light 명시 모드와 동일한 재채색 경로를 사용한다.

### REQ-PREVIEW010-004: 보안 불변식 유지 (Unwanted behavior)

- The system **shall** 모든 `mermaid.initialize` 호출에서 `securityLevel: 'strict'`를 유지한다.
- **IF** 테마 연동을 위해 `mermaid.initialize`가 재호출되더라도, **then the system shall** `securityLevel`을 `'strict'`보다 약한 값(`'loose'`, `'antiscript'`, `'sandbox'` 등)으로 변경하지 않는다.
- The system **shall** `startOnLoad: false`를 유지하여 mermaid 자동 스캔/실행이 켜지지 않도록 한다.

### REQ-PREVIEW010-005: 문법 오류 폴백 유지 (Unwanted behavior)

- **IF** 다이어그램 소스에 문법 오류가 있어 `mermaid.parse`/`render`가 실패하면, **then the system shall** 현재와 동일하게 `⚠ Diagram syntax error` 안내를 표시하고 앱이나 다른 다이어그램/프리뷰 전체를 중단시키지 않는다.
- The system **shall** 테마 재렌더 경로에서도 다이어그램별 개별 오류 처리를 유지하여, 한 다이어그램의 실패가 다른 다이어그램의 재채색을 막지 않도록 한다.

### REQ-PREVIEW010-006: 기존 프리뷰·인라인 SVG·내보내기 회귀 차단 (Unwanted behavior)

- The system **shall** 마크다운 렌더 파이프라인(SPEC-PREVIEW-001), 인라인 SVG sanitize/복원(SPEC-PREVIEW-008), zoom 규약을 회귀 없이 유지한다.
- **IF** 내보내기(`exportUtils.ts`) 경로가 호출되면, **then the system shall** 기존의 자체 테마 대응 mermaid 배경 로직을 그대로 사용하고 본 SPEC은 이를 변경하지 않는다.
- The system **shall** mermaid 버전 핀(SPEC-PREVIEW-006, mermaid 11.12.3)을 변경하지 않는다.

## Security

본 SPEC의 보안 불변식은 **"테마 연동을 위해 `mermaid.initialize`를 재호출하더라도 `securityLevel: 'strict'`를 절대 약화하지 않는다"** 이다.

- mermaid의 `securityLevel: 'strict'`는 다이어그램 라벨의 HTML을 이스케이프하고 스크립트/클릭 바인딩을 차단한다. 테마 스와프를 위해 `initialize`를 다시 호출할 때 옵션 객체에서 `securityLevel`을 누락하거나 다른 값으로 덮어쓰면 방어선이 무너질 수 있다.
- 따라서 재초기화 시 `securityLevel: 'strict'`와 `startOnLoad: false`는 **theme만 바뀌고 나머지는 동일**하게 전달해야 한다(단일 설정 상수 재사용 권장, plan 결정).
- 잔여 위험: mermaid 버전 업그레이드로 기본 보안 동작이 바뀔 수 있으나, 본 SPEC은 버전 핀(11.12.3)을 유지하므로 범위 밖. `securityLevel: 'strict'` 유지 여부는 가드 테스트로 고정한다.

## Exclusions (What NOT to Build) / Non-Goals

- **내보내기 경로 변경 미포함** — `exportUtils.ts`는 이미 테마 대응 mermaid 배경(`#1f2937`/`#f9fafb`)을 적용하므로 건드리지 않는다. 라이브 프리뷰만 대상.
- **커스텀 팔레트/브랜드 토큰 튜닝 미포함(기본)** — 기본 권장은 `'dark'`/`'default'` 페어링이다. `'base'` + 커스텀 CSS 변수로 팔레트를 세밀 조정하는 것은 별도 결정/후속 작업 대상이며, 정확한 팔레트 선택은 plan의 결정 지점으로 남긴다.
- **mermaid 버전 변경 미포함** — SPEC-PREVIEW-006의 11.12.3 핀을 유지한다.
- **다이어그램별 개별 테마 오버라이드 미포함** — `%%{init}%%` 프론트매터로 다이어그램마다 다른 테마를 지정하는 기능은 범위 밖.
- **문법 오류 폴백 UI 재설계 미포함** — `⚠ Diagram syntax error` 문구/모양은 유지하며 개선하지 않는다.
- **에디터/코드 뷰어/기타 프리뷰 기능 변경 미포함** — 변경은 `PreviewRenderer.tsx`와 기존 테마 신호 배선에 집중한다(스코프 규율).
- **`securityLevel` 완화 미포함** — 어떤 이유로도 `'strict'`를 낮추지 않는다(보안 불변식).

## References

- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인 + `PreviewRenderer`(mermaid 렌더 지점, 회귀 검증 대상)
- SPEC-PREVIEW-006 — mermaid 11.12.3 핀 + 클러스터 라벨 patch-package 계약(버전 무변경 유지)
- SPEC-PREVIEW-008 — 인라인 SVG sanitize/복원(동일 컴포넌트 내 회귀 검증 대상)
- `src/components/preview/PreviewRenderer.tsx:24` — `mermaid.initialize({ theme: 'default' })`(테마 하드코딩, 변경 대상)
- `src/components/preview/PreviewRenderer.tsx:66-128` — mermaid 렌더 `useEffect`, 의존성 `[safeHtml]`(테마 트리거 추가 대상)
- `src/hooks/useTheme.ts` — `.dark`/`data-theme` 토글 + system 모드(테마 신호 소스)
- `src/store/uiStore.ts` — `useUIStore.theme`(light/dark/system, 테마 상태 원천)
- `src/components/preview/CodeFileViewer.tsx:68` — `document.documentElement.classList.contains('dark')`(테마 신호 읽기 선례)
- `src/lib/export/exportUtils.ts:71` — 내보내기의 테마 대응 mermaid 배경(라이브 프리뷰 대응의 선례, 무변경)
