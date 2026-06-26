# SPEC-PREVIEW-006 — 구현 계획

> mermaid 11.12.3의 flowchart subgraph(cluster) 제목이 긴 한글에서 2줄로 줄바꿈되는 문제(#6110)를, patch-package로 mermaid 소스를 패치하여 1줄로 고정한다. 앱 소스(SPEC-PREVIEW-001 파이프라인)는 변경하지 않는다(이상적으로 변경 0). 신규 런타임 의존성 0, mermaid 정확 버전 고정(`11.12.3`).

## 기술 접근

- **소스 패치 우선**: 근본 원인이 mermaid 소스의 하드코딩 `width = 200`이므로, 설정·CSS·JS 후처리로는 해결 불가(소스로 검증). patch-package로 `node_modules/mermaid` 소스를 직접 패치하고 `postinstall`로 결정론적 재적용한다.
- **앱 소스 무변경**: 수정은 mermaid 패치 파일 + 빌드 설정(`package.json`/`package-lock.json`)에 위치. `mermaidPlugin.ts`/`PreviewRenderer.tsx`는 손대지 않는다.
- **버전 고정**: 패치가 조용히 어긋나지 않도록 mermaid를 정확히 `11.12.3`으로 고정(`^` 제거). 회귀 가드 테스트가 버전 드리프트를 실패로 잡는다.
- **2-tier 점진 적용**: 최소 패치(Tier 1) 우선, 수평 겹침이 관측되면 더 깊은 패치(Tier 2). tier 확정은 실제 렌더 검증으로.

## 설계 결정

### 결정 1 — 해결 수단: patch-package (채택), 대안 전부 기각

- **채택**: patch-package로 mermaid 소스를 패치. 근본 원인을 직접 제거하는 유일한 결정론적 수단.
- **기각 (재논의 금지, spec.md "결정 기록" 참조)**:
  - **config-only** (`flowchart.wrappingWidth`): 불가능 — `createText` 기본 `width` 하드코딩 200, cluster 경로가 config 무시(소스 검증).
  - **CSS / JS post-render patchwork**: 5회 실패 — 1줄 강제 시 dagre가 수평 공간 미예약이라 cluster `rect` 넘침·형제 겹침.
  - **ELK 레이아웃**: spike로 1줄 미달성 확인 + +1.1MB·전 다이어그램 영향·securityLevel 재검토 필요 → 기각.

### 결정 2 — 패치 범위: Tier 1 우선, Tier 2 조건부

- **Tier 1 (mini-patch, 1차)**: cluster `rect` 렌더러의 `createText` 호출(`chunk-JZLCHNYA.mjs:363`)에 명시적 `width` 전달(`kanbanSection`(`:524`) 모사). 렌더 함수가 라벨에 맞춰 `rect`를 확장(`:376`)하므로 1줄 라벨이면 더 넓은 박스가 산출됨. 수직 스택(TD/TB)에서는 수평 형제가 없어 충분.
- **Tier 2 (deep-patch, 비상)**: 수평 인접 subgraph 겹침이 수용 테스트에서 관측될 때만, dagre 래퍼(`dagre-6UL2VRFP.mjs`)의 cluster 사이징이 외부 레이아웃 **전에** 1줄 제목 폭을 반영하도록 추가 패치. 더 크고 fragile → Tier 1 실패 시에만.
- **확정 시점**: Tier 1 패치 작성 → 대표 픽스처(수직/수평) 렌더 검증 → 수평 겹침 없으면 Tier 1 확정, 있으면 Tier 2 추가. **이 분기는 run/GREEN 단계의 렌더 검증으로 결정**(미해결 사항 #1).

### 결정 3 — 검증 도구: Playwright(주) + vitest(보조)

- **주(主) — Playwright e2e**: 실제 브라우저 렌더에서 cluster 제목 1줄(예: cluster-label `foreignObject`/`div` 높이가 단일 라인 범위) + 형제 cluster/노드 무겹침을 단언. 진짜 1줄/겹침 판정에 필요한 `getBBox`·레이아웃 측정은 실제 브라우저에서만 신뢰 가능.
- **보조 — vitest+jsdom**: 패치 적용 여부·버전 일치 등 결정론적 단언의 가벼운 보조. jsdom `getBBox`는 불안정하므로 레이아웃 판정에는 쓰지 않는다.
- 프로젝트에 이미 존재하는 테스트 도구(Playwright `test:e2e`, vitest `test`)를 그대로 사용. 신규 테스트 러너 도입 없음.

## 위험 분석

| 위험 | 심각도 | 대비책 | 검증 |
|------|--------|--------|------|
| Tier 1만으로 수평 인접 subgraph 겹침 | 높음 | Tier 2(dagre cluster 사이징 패치)로 승급. 수직/수평 픽스처 모두로 사전 판정 | 시나리오 B·C (수직 무겹침 / 수평 무겹침) |
| mermaid 버전 드리프트 시 패치 silently 미적용 | 높음 | mermaid를 정확 `11.12.3` 고정(`^` 제거) + 회귀 가드가 버전·패치 부재 시 실패 | 시나리오 E (가드) |
| 패치가 비-subgraph 다이어그램/노드 라벨에 회귀 유발 | 중간 | 패치 범위를 cluster `rect` 경로로 한정. 노드 라벨 경로 무수정 | 시나리오 D (무회귀) |
| `getBBox` 불안정으로 1줄/겹침 오판 | 중간 | 레이아웃 판정은 Playwright(실 브라우저)로, jsdom은 결정론 단언 보조만 | 결정 3 |
| patch-package가 CI/clean install에서 미실행 | 중간 | `postinstall` 스크립트로 결정론적 재적용 + 가드 테스트가 미적용 시 실패 | 시나리오 E |
| 깊은 dagre 패치(Tier 2)의 fragility | 중간 | Tier 1 우선, Tier 2는 필요 시에만. 패치를 최소 hunk로 유지 | run 단계 검증 |

## 작업 분해 (Run 단계 순서)

> development_mode = tdd. 각 단계는 RED(실패 테스트) → GREEN(최소 구현) → REFACTOR 순. 회귀 가드(RED)를 먼저 세워 패치가 그것을 GREEN으로 만들게 한다.

### Phase 1 — 버전 고정 + patch-package 인프라

- **Task 1.1** `package.json`: `dependencies.mermaid`를 `^11.12.3` → `11.12.3`(캐럿 제거). `devDependencies`에 `patch-package` 추가. `scripts.postinstall`에 `patch-package` 추가(없으면 신설).
- **Task 1.2** `npm install` 후 `package-lock.json` 갱신 확인(mermaid 정확 버전 + patch-package).

### Phase 2 — 회귀 가드 테스트 (RED 우선)

- **Task 2.1** (RED) 대표 subgraph 픽스처(수직 TD/TB 변형 + 수평 인접 변형)를 실제 브라우저로 렌더하는 Playwright e2e 작성. 단언: (a) cluster 제목 1줄, (b) 형제 cluster/노드 무겹침, (c) 클리핑 없음. 패치 전이므로 실패해야 함(RED 확인).
- **Task 2.2** (보조) 패치 존재 + mermaid 버전 `11.12.3` 일치를 단언하는 vitest 가드(결정론적). 패치/버전 드리프트 시 실패.

### Phase 3 — Tier 1 패치 작성 (GREEN 1차)

- **Task 3.1** cluster `rect` 렌더러의 `createText` 호출(`chunk-JZLCHNYA.mjs:363`)에 명시적 `width` 전달(`kanbanSection` 모사). `npx patch-package mermaid`로 `patches/mermaid+11.12.3.patch` 생성.
- **Task 3.2** (GREEN 검증) Phase 2 e2e 재실행 — 수직 스택 픽스처에서 1줄 + 무겹침 통과 확인.

### Phase 4 — 수평 겹침 판정 → Tier 2 (조건부)

- **Task 4.1** 수평 인접 픽스처 e2e 결과 확인. 겹침 **없으면 Tier 1 확정**(Phase 4 종료). 겹침 **있으면** Task 4.2 진행.
- **Task 4.2** (조건부) dagre 래퍼(`dagre-6UL2VRFP.mjs`)의 cluster 사이징이 외부 레이아웃 전에 1줄 제목 폭을 반영하도록 Tier 2 패치 추가 → 패치 재생성 → e2e 무겹침 재확인.

### Phase 5 — 무회귀 검증 + MX 태그

- **Task 5.1** 비-subgraph 다이어그램·노드 라벨·기존 마크다운 렌더 경로(SPEC-PREVIEW-001/002/003)의 무회귀를 기존 테스트로 확인.
- **Task 5.2** MX 태그(아래 계획) 부착. 단, 앱 소스 무변경 원칙상 코드 주석은 패치/빌드 설정 인접 문서에 한정.

### MX 태그 계획

- 패치는 vendored(`node_modules`) 소스이므로 앱 소스에 `@MX` 주석을 추가하지 않는다(스코프 규율). 대신:
  - `patches/mermaid+11.12.3.patch` 인접 또는 본 SPEC plan에 **패치 의도·tier·#6110 출처**를 명시(`@MX:NOTE` 상당). 코드 주석 언어: `language.yaml`의 `code_comments: ko` 준수.
  - 회귀 가드 테스트 파일에 `@MX:NOTE` — 1줄/무겹침/버전 가드 의도 + `@MX:SPEC: SPEC-PREVIEW-006 REQ-PREVIEW006-007`.
- `mermaidPlugin.ts`(SPEC-PREVIEW-001) 기존 태그는 변경하지 않는다(앱 소스 무변경).

## 마일스톤 (우선순위 기반, 시간 추정 없음)

- **M1 (Priority High)**: Phase 1 — 버전 고정 + patch-package 인프라.
- **M2 (Priority High)**: Phase 2 — 회귀 가드 e2e/vitest (RED).
- **M3 (Priority High)**: Phase 3 — Tier 1 패치 + 수직 스택 GREEN.
- **M4 (Priority Medium)**: Phase 4 — 수평 겹침 판정 → 필요 시 Tier 2.
- **M5 (Priority Medium)**: Phase 5 — 무회귀 검증 + MX 태그.

순서 제약: M1(인프라) → M2(가드 RED) → M3(Tier 1) 순서 고정. M4의 Tier 2 진입 여부는 M3 후 수평 픽스처 렌더 결과로 결정.

## Definition of Done

- spec.md의 7개 EARS 요구가 모두 구현·검증됨.
- acceptance.md의 모든 Given/When/Then 시나리오 통과 — 특히 1줄 표시(A)·수직 무겹침(B)·수평 무겹침(C)·무회귀(D)·가드(E).
- mermaid가 정확히 `11.12.3`으로 고정되고(`package.json`/`package-lock.json`), `patch-package`가 `postinstall`로 결정론적 적용됨.
- 신규 **런타임** 의존성 0(`patch-package`는 devDependency).
- 앱 소스 변경 0(이상적). 변경이 불가피하면 그 사유를 plan에 기록.
- 프런트엔드 타입체크 + vitest + Playwright e2e 통과(development_mode = tdd, RED 우선).

## 미해결 사항 (run 단계 확인 필요)

- **#1 Tier 1 vs Tier 2 결정** — **Tier 1(mini-patch) 적용 후 수평 인접 subgraph 픽스처를 실제 브라우저로 렌더하여 겹침 여부를 보고 확정한다.** 겹침이 없으면 Tier 1로 종료, 있으면 Tier 2(dagre cluster 사이징 패치)를 추가한다. 이 분기는 렌더 검증으로만 결정한다.
- **#2 가드 테스트 1줄 판정 지표** — cluster-label `foreignObject`/`div` 높이의 단일 라인 임계, 또는 제목 텍스트 폭 un-clamp 중 어느 지표로 1줄을 단언할지 run 단계에서 실측으로 확정.
- **#3 패치 hunk 최소화** — Tier 1/2 패치를 어느 hunk 단위로 분리·유지할지(업스트림 #6110 수정 시 충돌 최소화 관점) run 단계에서 확정.
