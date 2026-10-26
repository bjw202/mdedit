---
id: SPEC-PREVIEW-006
version: "1.0.1"
status: planned
created: "2026-06-26"
updated: "2026-10-26"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-PREVIEW-001
tags:
  - preview
  - mermaid
  - subgraph
  - cluster
  - patch-package
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-26 | jw | 최초 SPEC 작성 — mermaid 11.12.3의 flowchart subgraph(cluster) 제목이 하드코딩 `foreignObject width=200` 때문에 긴 한글 제목에서 2줄로 줄바꿈되는 문제(mermaid #6110)를, patch-package로 mermaid 소스를 패치하여 1줄 표시로 고정. config-only / CSS·JS patchwork / ELK 대안은 소스 검증·spike로 기각. 신규 런타임 의존성 0, mermaid 정확 버전 고정(`11.12.3`), patch-package devDependency + postinstall 추가. |
| 1.0.1 | 2026-10-26 | jw | SPEC-PREVIEW-015로 개정 — 다이어그램 렌더러가 mermaid에서 pele 1.10.0으로 바뀌어 패치가 사라졌다. REQ-001~003의 목표(긴 한글 subgraph 제목 1줄, 클리핑·겹침 없음)는 유지하고 REQ-003의 "Tier 2 패치" 언급만 지웠다. REQ-004(패치 결정론적 적용)는 폐기하고 "패치를 쓰지 않음"으로 대체, REQ-005는 pele `1.10.0` 정확 고정, REQ-006은 "패치 적용" 전제를 없앤 무회귀 요구, REQ-007은 pele 버전 변경·mermaid 재유입 가드로 바꿨다. 같은 날 정리 작업으로 Overview를 현재 상태(pele 기본 동작으로 목표 만족, 패치 제거) 중심으로 고치고, 근거·결정 기록·선택한 해결 방향·[DELTA] 절에 1.0.0 당시 mermaid 기록임을 밝혔다. Glossary의 patch-package·Tier·회귀 가드 항목, Exclusions(앱 소스·보안 설정·렌더러 버전), References, acceptance.md의 측정 방법(pele `text.pele-cluster-label`)·시나리오 A~E·엣지 케이스·DoD에서 패치 전제를 걷어 냈다. |

## Overview

`mdedit`(마크다운 전용 편집기)의 미리보기에서 **Mermaid 문법 flowchart의 subgraph(cluster) 제목이 긴 한글 문자열일 때 2줄로 줄바꿈되는 문제**를 해결한다.

> **현재 상태 (SPEC-PREVIEW-015, 2026-10-26)**: 다이어그램 렌더러가 mermaid 11.12.3에서 pele 1.10.0으로 바뀌었다. pele는 subgraph 제목을 기본 동작으로 1줄에 그리므로 이 SPEC의 목표(REQ-001~003)는 패치 없이 만족한다. mermaid 패치, `patch-package`, `postinstall`은 모두 제거되었다(REQ-004). 아래 "근거", "결정 기록", "선택한 해결 방향", "[DELTA]" 절은 1.0.0 당시 mermaid 기준 기록이다.

1.0.0의 해결 방향은 **patch-package로 mermaid 소스를 패치**하여 cluster 제목을 1줄로 렌더하는 것이었다. 당시 근본 원인은 mermaid 11.12.3 소스에서 cluster 제목의 `foreignObject` 폭이 **하드코딩된 `width = 200`** 으로 고정되어 있고, cluster 렌더 경로가 `flowchart.wrappingWidth` 설정을 읽지 않는다는 것이었다(아래 "근거 — 소스 검증" 참조). 노드(node) 라벨은 영향이 없었고 cluster 제목만 영향을 받았다(mermaid 버그 #6110).

이 SPEC은 앱 소스(`PreviewRenderer.tsx` 등 SPEC-PREVIEW-001 파이프라인)를 변경하지 않는 것을 원칙으로 했고, 1.0.0의 수정은 mermaid 패치 파일과 빌드 설정에만 있었다. 그 수정은 SPEC-PREVIEW-015에서 렌더러 교체와 함께 걷어 냈다.

## Glossary

- **subgraph / cluster**: Mermaid 문법 flowchart에서 `subgraph A["..."] ... end`로 묶이는 노드 그룹. 그룹을 감싸는 사각형(`rect`)과 그 위쪽의 **그룹 제목(cluster title)** 으로 구성된다. 본 SPEC의 문제 대상은 이 **cluster 제목**이다.
- **cluster 제목 줄바꿈 문제**: (mermaid 11.12.3 시절) cluster 제목을 그리는 `foreignObject`의 폭이 하드코딩 200px라서, 200px를 넘는 긴 한글 제목(예: `🔵 tree-sitter (자/줄자) — 결정론적 · 100% 재현 가능`)이 2줄로 wrap되는 현상. mermaid #6110.
- **`createText`**: mermaid 내부에서 라벨 텍스트를 `foreignObject`로 그리는 공용 함수. 기본 파라미터 `width`가 **하드코딩 200**이며 cluster 경로에서 이 기본값으로 호출된다.
- **patch-package**: `node_modules` 내 패키지 소스를 `patches/<pkg>+<version>.patch`로 패치하고 `npm install` 시점(`postinstall`)에 결정론적으로 재적용하는 도구. 1.0.0의 채택 수단이었고 SPEC-PREVIEW-015에서 제거되었다.
- **Tier 1 (mini-patch)**: (1.0.0 패치 안, 폐기) cluster `rect` 렌더러의 `createText` 호출에 명시적 `width`를 넘겨 제목을 1줄로 만드는 최소 패치(`kanbanSection` 렌더러를 모사).
- **Tier 2 (deep-patch)**: (1.0.0 패치 안, 폐기) 수평 인접 subgraph가 겹치는 경우에만 추가로, 외부 dagre 레이아웃 실행 전에 cluster 폭이 1줄 제목 폭을 반영하도록 dagre 래퍼의 cluster 사이징을 패치하는 비상안.
- **회귀 가드 테스트(regression guard)**: 대표 subgraph 다이어그램을 실제 브라우저로 렌더하여 cluster 제목이 1줄인지 + 형제 cluster/노드가 겹치지 않는지 검증하는 e2e, 그리고 pele 버전이 `1.10.0`에서 바뀌거나 mermaid가 의존성에 다시 들어오면 실패하는 단위 가드(REQ-007).

## 근거 — 소스 검증 (이 SPEC의 배경 증거)

> 1.0.0 당시 기록이다. mermaid는 SPEC-PREVIEW-015에서 의존성에서 빠져 아래 `node_modules` 경로는 지금 저장소에 없다.

mermaid 11.12.3 `node_modules` 직접 검사로 확인된 사실:

- **`node_modules/mermaid/dist/chunks/mermaid.core/chunk-JA3XYJ7Z.mjs:386`** — `createText`의 기본 파라미터가 `width = 200`으로 하드코딩되어 있고 `flowchart.wrappingWidth`를 읽지 않는다.
- **`node_modules/mermaid/dist/chunks/mermaid.core/chunk-JZLCHNYA.mjs:363`** — cluster `rect` 렌더러가 `createText(labelEl, node.label, { style, useHtmlLabels, isNode: true })`를 **`width` 인자 없이** 호출하여 하드코딩 200으로 폴백한다. (대조: 같은 파일 `:524`의 `kanbanSection` 렌더러는 `width: node.width`를 **명시적으로 전달**한다.)
- **`node_modules/mermaid/dist/chunks/mermaid.core/dagre-6UL2VRFP.mjs:430-439`** — mermaid의 dagre 레이아웃은 `updateNodeBounds`로 cluster 크기를 **내부 콘텐츠 경계**에서 산출하며, 제목을 위해서는 `subGraphTitleTotalMargin`(`:500-538`)으로 **수직 공간만** 예약하고 **수평 공간은 예약하지 않는다.**

→ 따라서 cluster 제목이 1줄로 길어지면 dagre가 수평 공간을 확보해 두지 않았기 때문에, 단순히 1줄로 강제하면 cluster `rect`가 좌우로 넘쳐 형제와 겹칠 위험이 생긴다(Tier 2 필요성의 근거).

## 결정 기록 — 기각된 대안 (재논의 금지)

아래 대안들은 1.0.0 당시 mermaid 11.12.3 기준 소스 검증·spike로 기각되었다. 렌더러가 pele로 바뀐 지금은 해당하지 않는 기록이다.

- **config-only** (`mermaid.initialize({ flowchart: { wrappingWidth: N } })`): **불가능.** `createText`의 기본 `width`가 하드코딩 200이고 cluster 경로가 config를 무시함이 소스로 확인됨.
- **CSS / JS post-render patchwork** (이전 5회 시도): **전부 실패.** CSS로 1줄을 강제하면 dagre가 수평 공간을 예약하지 않았기 때문에 cluster `rect`가 넘쳐 형제와 겹친다. 재시도 금지.
- **ELK 레이아웃** (`@mermaid-js/layout-elk`): spike로 검증한 결과 **ELK도 1줄 제목을 만들지 못함**(`foreignObject` 여전히 width=200, 제목 여전히 2줄). ELK는 겹침 방지를 위한 수직 공간만 예약할 뿐이다. 게다가 +1.1MB 의존성, 모든 다이어그램 레이아웃 변경, securityLevel 재검토 필요. 1줄 목표에는 부적합하여 기각.

## 선택한 해결 방향

> 1.0.0 당시 해결 방향이다. SPEC-PREVIEW-015에서 패치와 아래 인프라가 모두 제거되었고, 지금은 pele 1.10.0 기본 동작으로 목표를 만족한다(REQ-004).

1.0.0은 **patch-package로 mermaid 소스를 패치**하여 cluster 제목을 1줄로 렌더했다. 2단계(tier)로 구성했고, 최종 채택 tier는 run/GREEN 단계의 실제 렌더 검증으로 확정하기로 했다.

- **Tier 1 (mini-patch, 1차 채택)**: cluster `rect` 렌더러의 `createText` 호출(`chunk-JZLCHNYA.mjs:363`)에 명시적 큰/동적 `width`를 전달하여 제목을 wrap하지 않게 만든다(`kanbanSection`(`:524`) 패턴 모사). 렌더 함수는 라벨에 맞춰 `rect`를 확장하므로(`chunk-JZLCHNYA.mjs:376`), wrap되지 않은 1줄 라벨이면 더 넓은 박스가 올바르게 산출된다. subgraph가 수직으로 쌓이는 경우(flowchart TD/TB)에는 겹칠 수평 형제가 없으므로 Tier 1만으로 충분하다.
- **Tier 2 (deep-patch, 비상)**: 수용 테스트에서 **수평 인접 subgraph가 겹치는 경우에만** 추가로, 외부 dagre 레이아웃 실행 **전에** cluster 폭이 1줄 제목 폭을 반영하도록 dagre 래퍼의 cluster 사이징을 패치한다. 더 크고 깨지기 쉬우므로 Tier 1이 무겹침 기준을 통과하지 못할 때만 사용한다.

요구 인프라:
- `patch-package` 도입(devDependency 추가, `postinstall` 스크립트, `patches/mermaid+11.12.3.patch`).
- mermaid를 **정확히 `11.12.3`** 으로 고정(`^` 캐럿 제거) — 패치가 조용히 어긋나지 않도록.
- 회귀 가드 테스트 1건 — 대표 subgraph 다이어그램을 렌더하여 cluster 제목이 1줄인지 + 형제 cluster/노드 무겹침을 단언하고, 패치 미적용·버전 드리프트 시 실패. (진짜 1줄/겹침 검증은 jsdom의 `getBBox`가 불안정하므로 실제 브라우저(Playwright)가 필요하다.)

## EARS Requirements

### REQ-PREVIEW006-001: 긴 한글 cluster 제목 1줄 표시 (Event-driven)

- **WHEN** flowchart에 제목이 긴 한글 문자열인 subgraph가 포함되면, **the system shall** 렌더된 cluster 제목을 **단일 줄(줄바꿈 없음)** 로 표시한다.

### REQ-PREVIEW006-002: 수직 스택 subgraph 무겹침·무클리핑 (Event-driven)

- **WHEN** 여러 subgraph가 수직으로 쌓인(flowchart TD/TB) 다이어그램을 렌더하면, **the system shall** 1줄 제목을 **클리핑 없이** 표시하고, 내부 노드 및 다른 cluster와 **겹치지 않게** 렌더한다.

### REQ-PREVIEW006-003: 수평 인접 subgraph 무겹침 (Event-driven)

- **WHEN** subgraph가 수평으로 인접 배치되면, **the system shall** 인접 cluster끼리 **겹치지 않게** 렌더한다.

### REQ-PREVIEW006-004: 다이어그램 렌더 무패치 (Ubiquitous)

- The system **shall** 다이어그램 렌더에 패치를 쓰지 않는다. subgraph 제목 1줄 배치는 pele 1.10.0 기본 동작으로 만족한다(SPEC-PREVIEW-015).

### REQ-PREVIEW006-005: 다이어그램 렌더러 정확 버전 고정 (Ubiquitous)

- The system **shall** `package.json`에서 다이어그램 렌더러 `pele`를 정확히 `1.10.0`으로 고정한다(SPEC-PREVIEW-015 REQ-021).

### REQ-PREVIEW006-006: 비대상 렌더 무회귀 (Ubiquitous)

- The system **shall** pele 교체(SPEC-PREVIEW-015) 뒤에도 subgraph가 아닌 다이어그램·노드 라벨·기존 마크다운 렌더 경로(SPEC-PREVIEW-001/002/003)를 회귀 없이 렌더한다.

### REQ-PREVIEW006-007: 버전 드리프트·mermaid 재유입 가드 (Event-driven)

- **When** pele 버전이 `1.10.0`에서 바뀌거나 mermaid가 다시 의존성에 들어오면, the regression guard tests **shall** 실패한다.

## [DELTA] Brownfield Change Map

> 1.0.0 당시 변경 계획이다. 패치 파일, `patch-package`, `postinstall`, mermaid 고정은 SPEC-PREVIEW-015에서 모두 제거되었다. 지금 렌더 경로는 SPEC-PREVIEW-015의 다이어그램 모듈이다.

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [NEW] | `patches/mermaid+11.12.3.patch` | patch-package 패치 파일. Tier 1: cluster `rect` 렌더러의 `createText` 호출(`chunk-JZLCHNYA.mjs`)에 명시적 `width` 전달. Tier 2(조건부): dagre 래퍼(`dagre-6UL2VRFP.mjs`)의 cluster 사이징이 1줄 제목 폭을 레이아웃 전에 반영. 채택 tier는 run/GREEN 렌더 검증으로 확정. |
| [MODIFY] | `package.json` | (1) `dependencies.mermaid`를 `^11.12.3` → `11.12.3`(캐럿 제거)로 고정. (2) `devDependencies`에 `patch-package` 추가. (3) `scripts.postinstall`에 `patch-package` 추가(없으면 신설). |
| [MODIFY] | `package-lock.json` | mermaid 정확 버전 고정 + `patch-package` devDependency 반영으로 갱신. |
| [NEW] | 회귀 가드 테스트 (e2e 권장: `tests/e2e/*` 또는 프로젝트 e2e 디렉터리) | 대표 subgraph 다이어그램(아래 픽스처)을 실제 브라우저로 렌더하여 cluster 제목 1줄 + 형제 무겹침을 단언. 패치 미적용/버전 드리프트 시 실패. 단위(vitest+jsdom)는 `getBBox` 불안정으로 보조용. |
| [EXISTING] | `src/lib/markdown/mermaidPlugin.ts` (SPEC-PREVIEW-001) | 변경 없음 — mermaid 플러그인·`mermaid.render()` 호출 경로는 그대로. 수정은 mermaid 패치에 위치. |
| [EXISTING] | `src/components/preview/PreviewRenderer.tsx` 등 앱 소스 | 변경 없음(이상적). 수정은 mermaid 패치 + 빌드 설정에 한정. |

## Exclusions (What NOT to Build)

- **렌더러 교체·앱 소스 변경 미포함** — 렌더러 교체와 그에 따른 `PreviewRenderer.tsx`·`mermaidPlugin.ts` 변경은 SPEC-PREVIEW-015 범위다. 이 SPEC은 subgraph 제목 1줄·무겹침 목표와 가드만 정한다.
- **ELK 레이아웃 채택 미포함** — `@mermaid-js/layout-elk`는 1.0.0 당시 1줄 제목을 만들지 못함이 spike로 검증되어 기각했다.
- **보안 설정 변경 미포함** — 다이어그램 보안 설정(strict 모드)은 SPEC-PREVIEW-015 소관이며 이 SPEC은 바꾸지 않는다.
- **config-only / CSS·JS patchwork 재시도 미포함** — 1.0.0 당시 mermaid 기준으로 소스 검증·5회 실패로 기각된 방식이다.
- **node 라벨·비-subgraph 다이어그램 변경 미포함** — 문제·수정 범위는 cluster 제목에 한정한다.
- **다이어그램 렌더러 버전 변경 미포함** — pele 버전은 `1.10.0` 고정이며(REQ-005), 업그레이드는 별개 후속 작업이다.

## References

- SPEC-PREVIEW-015 — 다이어그램 렌더러 mermaid → pele 1.10.0 교체(패치 제거 근거)
- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인 + `mermaidPlugin.ts` (다이어그램 펜스 처리 출처, 회귀 검증 대상)
- 아래 mermaid 이슈·`node_modules/mermaid` 경로는 1.0.0 당시 근거다(현재 저장소에 mermaid 없음).
- mermaid 이슈 #6110 — flowchart subgraph(cluster) 제목 하드코딩 200px wrap 버그
- `node_modules/mermaid/dist/chunks/mermaid.core/chunk-JA3XYJ7Z.mjs:386` — `createText` 하드코딩 `width = 200`
- `node_modules/mermaid/dist/chunks/mermaid.core/chunk-JZLCHNYA.mjs:363` / `:376` / `:524` — cluster `rect` 렌더러(`width` 미전달) / rect 확장 / `kanbanSection`(`width` 전달, 모사 대상)
- `node_modules/mermaid/dist/chunks/mermaid.core/dagre-6UL2VRFP.mjs:430-439` / `:500-538` — dagre cluster 사이징(`updateNodeBounds`) / 제목 수직 마진(`subGraphTitleTotalMargin`)
- patch-package — (1.0.0 당시) `patches/mermaid+11.12.3.patch` + `postinstall` 결정론적 재적용, SPEC-PREVIEW-015에서 제거
