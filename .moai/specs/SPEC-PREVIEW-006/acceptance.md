# SPEC-PREVIEW-006 — 수용 기준

> development_mode = tdd. 레이아웃(1줄/겹침) 판정 시나리오는 **실제 브라우저(Playwright)** 로 검증한다(jsdom `getBBox` 불안정). 결정론적 단언(패치 존재·버전 일치)은 vitest로 보조한다. 1줄 표시(A)·수직 무겹침(B)·수평 무겹침(C)·무회귀(D)·가드(E)가 must-pass 기준이다.

## 사전 준비

- **대표 픽스처 다이어그램 (수평 인접 변형)** — cluster 제목이 긴 한글:

  ```
  flowchart TB
    Start[시작] --> A
    Start --> B
    subgraph A["🔵 tree-sitter (자/줄자) — 결정론적 · 100% 재현 가능"]
      A1[파싱] --> A2[AST]
    end
    subgraph B["🟢 LSP (현미경) — 의미 분석 · 타입 추론 가능"]
      B1[심볼] --> B2[정의]
    end
  ```

- **대표 픽스처 다이어그램 (수직 스택 변형)** — A와 B를 수직으로 쌓아 수평 형제가 없는 경우:

  ```
  flowchart TB
    Start[시작] --> A
    subgraph A["🔵 tree-sitter (자/줄자) — 결정론적 · 100% 재현 가능"]
      A1[파싱] --> A2[AST]
    end
    A --> B
    subgraph B["🟢 LSP (현미경) — 의미 분석 · 타입 추론 가능"]
      B1[심볼] --> B2[정의]
    end
  ```

- **대조 픽스처**: 노드 라벨만 긴 비-subgraph flowchart, mermaid 외 일반 마크다운 문서(회귀 대조용).
- 렌더 환경: 실제 브라우저(Playwright)로 미리보기 패널에서 mermaid SVG를 렌더. cluster 제목은 `.cluster` 그룹 내 `foreignObject`/`div`로 그려짐.
- 1줄/겹침 측정: cluster-label `foreignObject`/`div`의 높이(단일 라인 임계)와 cluster `rect`들의 bounding box 교집합으로 판정.

---

## 기능 시나리오

### 시나리오 A: 긴 한글 cluster 제목 1줄 표시 (REQ-PREVIEW006-001) — must-pass

- **Given** 제목이 `🔵 tree-sitter (자/줄자) — 결정론적 · 100% 재현 가능`인 subgraph를 포함한 flowchart가 주어지고
- **When** 패치가 적용된 상태에서 해당 다이어그램을 미리보기에 렌더하면
- **Then** cluster 제목이 **단일 줄**로 표시된다(제목 텍스트 컨테이너 높이가 1줄 범위, 줄바꿈 없음).

### 시나리오 B: 수직 스택 subgraph 무겹침·무클리핑 (REQ-PREVIEW006-002) — must-pass

- **Given** A와 B가 수직으로 쌓인(flowchart TD/TB) 수직 스택 픽스처가 주어지고
- **When** 패치(Tier 1)가 적용된 상태에서 렌더하면
- **Then** 두 cluster 제목이 모두 1줄로 표시되고
- **And** cluster `rect`가 내부 노드(A1/A2, B1/B2) 및 다른 cluster와 **겹치지 않으며** 제목이 **클리핑되지 않는다.**

### 시나리오 C: 수평 인접 subgraph 무겹침 (REQ-PREVIEW006-003) — must-pass

- **Given** A와 B가 수평으로 인접 배치된 수평 인접 픽스처가 주어지고
- **When** 패치가 적용된 상태에서 렌더하면
- **Then** 인접한 cluster `rect`들의 bounding box가 **겹치지 않는다.**
- **And** Tier 1만으로 겹침이 발생하면 Tier 2 패치를 적용한 뒤 본 시나리오를 재검증하여 무겹침을 만족한다.

### 시나리오 D: 비대상 렌더 무회귀 (REQ-PREVIEW006-006) — must-pass

- **Given** 노드 라벨만 긴 비-subgraph flowchart와 일반 마크다운 문서(대조 픽스처)가 주어지고
- **When** 패치 적용 전/후로 각각 렌더하면
- **Then** 노드 라벨·비-subgraph 다이어그램·마크다운 렌더 결과가 패치 적용 전과 **동일**하다(SPEC-PREVIEW-001/002/003 회귀 없음).

### 시나리오 E: 패치 결정론적 적용 + 부재/드리프트 가드 (REQ-PREVIEW006-004, 005, 007) — must-pass

- **Given** `patch-package`가 `postinstall`에 등록되고 mermaid가 정확 `11.12.3`으로 고정된 상태이고
- **When** clean install(`npm install`) 후 가드 테스트를 실행하면
- **Then** 패치가 적용되어 가드가 통과하고
- **And** 패치를 제거하거나 mermaid 버전이 `11.12.3`에서 드리프트하면 가드 테스트가 **실패**하여 누락을 즉시 드러낸다.

---

## 엣지 케이스

- **이모지 포함 제목**: `🔵`/`🟢` 같은 이모지가 포함된 긴 제목도 1줄로 표시되고 폭 계산이 깨지지 않는다.
- **매우 긴 제목**: 제목이 cluster 내부 콘텐츠 폭보다 훨씬 길어도, Tier 1(라벨에 맞춘 `rect` 확장) 또는 Tier 2(레이아웃 전 폭 반영)로 1줄 + 무클리핑이 유지된다.
- **TD/TB vs LR 방향**: 수직(TD/TB) 다이어그램은 Tier 1로 충분, 수평 형제가 생기는 배치는 Tier 2 필요성 판정 대상.
- **단일 subgraph**: subgraph가 하나뿐인 다이어그램은 형제 겹침이 없으므로 1줄 표시만 확인한다.
- **mermaid 외 코드블록**: ` ```mermaid `이 아닌 일반 코드블록은 Shiki 경로로 그대로 처리되어 영향이 없다(회귀 대조).

---

## 품질 게이트 / Definition of Done

- [ ] 기능 시나리오 A 통과 (**must-pass — 1줄 표시**)
- [ ] 기능 시나리오 B 통과 (**must-pass — 수직 스택 무겹침/무클리핑**)
- [ ] 기능 시나리오 C 통과 (**must-pass — 수평 인접 무겹침; 필요 시 Tier 2 적용**)
- [ ] 기능 시나리오 D 통과 (**must-pass — 비대상 렌더 무회귀**)
- [ ] 기능 시나리오 E 통과 (**must-pass — 결정론적 적용 + 부재/드리프트 가드**)
- [ ] 엣지 케이스 5건 확인
- [ ] mermaid 정확 `11.12.3` 고정(`package.json`/`package-lock.json`), `patch-package` `postinstall` 등록
- [ ] 신규 런타임 의존성 0(`patch-package`는 devDependency)
- [ ] 앱 소스 변경 0(이상적) — 변경 시 사유 기록
- [ ] 프런트엔드 타입체크 + vitest + Playwright e2e 통과 (development_mode = tdd, RED 우선)
- [ ] `.html`(SPEC-PREVIEW-004)·마크다운 렌더(SPEC-PREVIEW-001/002/003) 회귀 없음
- [ ] MX 태그(가드 테스트 `@MX:NOTE`/`@MX:SPEC`) 부착 — plan.md MX 계획 준수
