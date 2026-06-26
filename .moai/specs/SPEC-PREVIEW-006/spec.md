---
id: SPEC-PREVIEW-006
version: "1.0.0"
status: planned
created: "2026-06-26"
updated: "2026-06-26"
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

## Overview

`mdedit`(마크다운 전용 편집기)의 미리보기에서 **mermaid flowchart의 subgraph(cluster) 제목이 긴 한글 문자열일 때 2줄로 줄바꿈되는 문제**를 해결한다. 해결 방향은 **patch-package로 mermaid 소스를 패치**하여 cluster 제목이 항상 1줄로 렌더되도록 만드는 것이다.

문제의 근본 원인은 mermaid 11.12.3 소스에 cluster 제목의 `foreignObject` 폭이 **하드코딩된 `width = 200`** 으로 고정되어 있고, cluster 렌더 경로가 `flowchart.wrappingWidth` 설정을 읽지 않기 때문이다(아래 "근거 — 소스 검증" 참조). **노드(node) 라벨은 동적 폭 + nowrap으로 정상 렌더되며 영향이 없다.** 오직 cluster 제목만 영향을 받는다. 이는 mermaid 버그 #6110이다.

이 SPEC은 앱 소스(`PreviewRenderer.tsx` 등 SPEC-PREVIEW-001 파이프라인)를 변경하지 않는 것을 원칙으로 한다. 수정은 전적으로 **mermaid 패치 파일 + 빌드 설정(`patch-package`, `postinstall`, 정확 버전 고정)** 에 위치한다.

신규 **런타임** 의존성은 0이다(`patch-package`는 devDependency). ELK 레이아웃 채택, securityLevel 변경은 하지 않는다.

## Glossary

- **subgraph / cluster**: mermaid flowchart에서 `subgraph A["..."] ... end`로 묶이는 노드 그룹. 그룹을 감싸는 사각형(`rect`)과 그 위쪽의 **그룹 제목(cluster title)** 으로 구성된다. 본 SPEC의 문제 대상은 이 **cluster 제목**이다.
- **cluster 제목 줄바꿈 문제**: cluster 제목을 그리는 `foreignObject`의 폭이 하드코딩 200px라서, 200px를 넘는 긴 한글 제목(예: `🔵 tree-sitter (자/줄자) — 결정론적 · 100% 재현 가능`)이 2줄로 wrap되는 현상. mermaid #6110.
- **`createText`**: mermaid 내부에서 라벨 텍스트를 `foreignObject`로 그리는 공용 함수. 기본 파라미터 `width`가 **하드코딩 200**이며 cluster 경로에서 이 기본값으로 호출된다.
- **patch-package**: `node_modules` 내 패키지 소스를 `patches/<pkg>+<version>.patch`로 패치하고 `npm install` 시점(`postinstall`)에 결정론적으로 재적용하는 도구. 본 SPEC의 채택 수단.
- **Tier 1 (mini-patch)**: cluster `rect` 렌더러의 `createText` 호출에 명시적 `width`를 넘겨 제목을 1줄로 만드는 최소 패치(`kanbanSection` 렌더러를 모사). 1차 채택안.
- **Tier 2 (deep-patch)**: 수평 인접 subgraph가 겹치는 경우에만 추가로, 외부 dagre 레이아웃 실행 전에 cluster 폭이 1줄 제목 폭을 반영하도록 dagre 래퍼의 cluster 사이징을 패치하는 안. Tier 1로 불충분할 때만 사용하는 비상안.
- **회귀 가드 테스트(regression guard)**: 대표 subgraph 다이어그램을 렌더하여 cluster 제목이 1줄인지 + 형제 cluster/노드가 겹치지 않는지 검증하고, 패치 미적용·mermaid 버전 드리프트 시 실패하는 테스트.

## 근거 — 소스 검증 (이 SPEC의 배경 증거)

mermaid 11.12.3 `node_modules` 직접 검사로 확인된 사실:

- **`node_modules/mermaid/dist/chunks/mermaid.core/chunk-JA3XYJ7Z.mjs:386`** — `createText`의 기본 파라미터가 `width = 200`으로 하드코딩되어 있고 `flowchart.wrappingWidth`를 읽지 않는다.
- **`node_modules/mermaid/dist/chunks/mermaid.core/chunk-JZLCHNYA.mjs:363`** — cluster `rect` 렌더러가 `createText(labelEl, node.label, { style, useHtmlLabels, isNode: true })`를 **`width` 인자 없이** 호출하여 하드코딩 200으로 폴백한다. (대조: 같은 파일 `:524`의 `kanbanSection` 렌더러는 `width: node.width`를 **명시적으로 전달**한다.)
- **`node_modules/mermaid/dist/chunks/mermaid.core/dagre-6UL2VRFP.mjs:430-439`** — mermaid의 dagre 레이아웃은 `updateNodeBounds`로 cluster 크기를 **내부 콘텐츠 경계**에서 산출하며, 제목을 위해서는 `subGraphTitleTotalMargin`(`:500-538`)으로 **수직 공간만** 예약하고 **수평 공간은 예약하지 않는다.**

→ 따라서 cluster 제목이 1줄로 길어지면 dagre가 수평 공간을 확보해 두지 않았기 때문에, 단순히 1줄로 강제하면 cluster `rect`가 좌우로 넘쳐 형제와 겹칠 위험이 생긴다(Tier 2 필요성의 근거).

## 결정 기록 — 기각된 대안 (재논의 금지)

아래 대안들은 소스 검증·spike로 명확히 기각되었으며, run 단계에서 재시도하지 않는다.

- **config-only** (`mermaid.initialize({ flowchart: { wrappingWidth: N } })`): **불가능.** `createText`의 기본 `width`가 하드코딩 200이고 cluster 경로가 config를 무시함이 소스로 확인됨.
- **CSS / JS post-render patchwork** (이전 5회 시도): **전부 실패.** CSS로 1줄을 강제하면 dagre가 수평 공간을 예약하지 않았기 때문에 cluster `rect`가 넘쳐 형제와 겹친다. 재시도 금지.
- **ELK 레이아웃** (`@mermaid-js/layout-elk`): spike로 검증한 결과 **ELK도 1줄 제목을 만들지 못함**(`foreignObject` 여전히 width=200, 제목 여전히 2줄). ELK는 겹침 방지를 위한 수직 공간만 예약할 뿐이다. 게다가 +1.1MB 의존성, 모든 다이어그램 레이아웃 변경, securityLevel 재검토 필요. 1줄 목표에는 부적합하여 기각.

## 선택한 해결 방향

**patch-package로 mermaid 소스를 패치**하여 cluster 제목을 1줄로 렌더한다. 2단계(tier)로 구성하며, 최종 채택 tier는 run/GREEN 단계의 실제 렌더 검증으로 확정한다.

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

- **WHEN** subgraph가 수평으로 인접 배치되면, **the system shall** 인접 cluster끼리 **겹치지 않게** 렌더한다. (Tier 1로 무겹침이 보장되지 않으면 Tier 2 패치를 적용한다.)

### REQ-PREVIEW006-004: 패치 결정론적 적용 (Ubiquitous)

- The system **shall** patch-package를 통해 매 `npm install`마다(`postinstall`) mermaid 패치를 **결정론적으로** 적용한다.

### REQ-PREVIEW006-005: mermaid 정확 버전 고정 (Ubiquitous)

- The system **shall** `package.json`에서 mermaid 의존성을 캐럿(`^`) 없이 **정확히 `11.12.3`** 으로 고정한다.

### REQ-PREVIEW006-006: 비대상 렌더 무회귀 (Unwanted behavior)

- **IF** 패치가 적용된 상태에서 subgraph가 아닌 다이어그램·노드 라벨·기존 마크다운 렌더 경로(SPEC-PREVIEW-001/002/003)를 렌더하면, **then the system shall** 패치 적용 전과 **동일하게** 렌더한다(어떤 회귀도 발생시키지 않는다).

### REQ-PREVIEW006-007: 패치 부재·버전 드리프트 가드 (Unwanted behavior)

- **IF** 패치가 적용되지 않았거나 mermaid 버전이 `11.12.3`에서 드리프트하면, **then the system shall** 회귀 가드 테스트를 **실패**시켜 누락을 즉시 드러낸다.

## [DELTA] Brownfield Change Map

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [NEW] | `patches/mermaid+11.12.3.patch` | patch-package 패치 파일. Tier 1: cluster `rect` 렌더러의 `createText` 호출(`chunk-JZLCHNYA.mjs`)에 명시적 `width` 전달. Tier 2(조건부): dagre 래퍼(`dagre-6UL2VRFP.mjs`)의 cluster 사이징이 1줄 제목 폭을 레이아웃 전에 반영. 채택 tier는 run/GREEN 렌더 검증으로 확정. |
| [MODIFY] | `package.json` | (1) `dependencies.mermaid`를 `^11.12.3` → `11.12.3`(캐럿 제거)로 고정. (2) `devDependencies`에 `patch-package` 추가. (3) `scripts.postinstall`에 `patch-package` 추가(없으면 신설). |
| [MODIFY] | `package-lock.json` | mermaid 정확 버전 고정 + `patch-package` devDependency 반영으로 갱신. |
| [NEW] | 회귀 가드 테스트 (e2e 권장: `tests/e2e/*` 또는 프로젝트 e2e 디렉터리) | 대표 subgraph 다이어그램(아래 픽스처)을 실제 브라우저로 렌더하여 cluster 제목 1줄 + 형제 무겹침을 단언. 패치 미적용/버전 드리프트 시 실패. 단위(vitest+jsdom)는 `getBBox` 불안정으로 보조용. |
| [EXISTING] | `src/lib/markdown/mermaidPlugin.ts` (SPEC-PREVIEW-001) | 변경 없음 — mermaid 플러그인·`mermaid.render()` 호출 경로는 그대로. 수정은 mermaid 패치에 위치. |
| [EXISTING] | `src/components/preview/PreviewRenderer.tsx` 등 앱 소스 | 변경 없음(이상적). 수정은 mermaid 패치 + 빌드 설정에 한정. |

## Exclusions (What NOT to Build)

- **앱 소스 동작 변경 미포함** — `PreviewRenderer.tsx`/`mermaidPlugin.ts` 등 SPEC-PREVIEW-001 파이프라인의 동작은 변경하지 않는다. 이상적으로 앱 소스 변경 0이며, 수정은 mermaid 패치 + 빌드 설정에만 위치한다.
- **ELK 레이아웃 채택 미포함** — `@mermaid-js/layout-elk`는 1줄 제목을 만들지 못함이 spike로 검증되어 기각. 도입하지 않는다.
- **securityLevel 변경 미포함** — mermaid `securityLevel` 설정은 변경하지 않는다.
- **config-only / CSS·JS patchwork 재시도 미포함** — 소스 검증·5회 실패로 기각됨. run 단계에서 재시도하지 않는다.
- **node 라벨·비-subgraph 다이어그램 변경 미포함** — 노드 라벨은 이미 정상(동적 폭 nowrap). 문제·수정 범위는 cluster 제목에 한정한다.
- **mermaid 버전 업그레이드 미포함** — 업스트림 #6110 수정 버전으로의 업그레이드는 별개 후속 작업. 본 SPEC은 `11.12.3` 고정 + 패치로 한정한다.
- **신규 런타임 의존성 추가 미포함** — `patch-package`는 devDependency이며 런타임 번들에 포함되지 않는다.

## References

- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인 + `mermaidPlugin.ts`/`mermaid.render()` (mermaid 도입 출처, 회귀 검증 대상)
- mermaid 이슈 #6110 — flowchart subgraph(cluster) 제목 하드코딩 200px wrap 버그
- `node_modules/mermaid/dist/chunks/mermaid.core/chunk-JA3XYJ7Z.mjs:386` — `createText` 하드코딩 `width = 200`
- `node_modules/mermaid/dist/chunks/mermaid.core/chunk-JZLCHNYA.mjs:363` / `:376` / `:524` — cluster `rect` 렌더러(`width` 미전달) / rect 확장 / `kanbanSection`(`width` 전달, 모사 대상)
- `node_modules/mermaid/dist/chunks/mermaid.core/dagre-6UL2VRFP.mjs:430-439` / `:500-538` — dagre cluster 사이징(`updateNodeBounds`) / 제목 수직 마진(`subGraphTitleTotalMargin`)
- patch-package — `patches/mermaid+11.12.3.patch` + `postinstall` 결정론적 재적용
