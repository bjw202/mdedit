---
id: SPEC-IMG-WIDGET-002
title: 인라인 이미지 위젯 line-gap 회귀 복구 (가시 라인 경계 스캔 + 폴딩 임계값 정렬)
version: 1.3.0
status: completed
created: 2026-09-22
updated: 2026-09-22
author: jw (bjw202)
priority: High
phase: "v0.15.1 target"
module: editor/extensions
lifecycle: spec-anchored
tags: [regression, codemirror, line-gap, image-widget, viewport, code-folding, frontend, performance]
tier: M
depends_on: [SPEC-IMG-WIDGET-001, SPEC-IMG-LOAD-002, SPEC-IMG-MODE-003]
related_specs: [SPEC-IMG-LOAD-001, SPEC-PREVIEW-007, SPEC-PREVIEW-008]
supersedes:
  - "SPEC-IMG-LOAD-002 REQ-IMG-LOAD-2-D-003 / AC-2-D3 (LINE_FOLD_THRESHOLD = 1MB, OD-1 확정값) — 본 SPEC REQ-B-001 이 3MB 로 개정한다. 개정 근거는 base64 팽창(바이트 대 문자 단위 불일치)이며, OD-1 의 폴딩 정책 자체는 유지된다"
---

# SPEC-IMG-WIDGET-002: 인라인 이미지 위젯 line-gap 회귀 복구

## HISTORY

- **2026-09-22 v1.3.0 (re-audit PASS-WITH-DEBT 0.86 잔여 7건 해소)**: 검증 수단의 거짓 통과 경로를 닫고, 정지 규칙의 잘못된 참조·단일 표본 분기를 바로잡는다. REQ 본문 변경 없음 — 전부 AC 와 `plan.md` 측 수정이다.
  - **N1 (blocking-minor) — AC-B-001 이 테스트 삭제로도 통과**: 검증 3항이 모두 "블록을 지우면 만족"되는 구조였다(스위트는 실패할 것이 없어 PASS, 음성 grep 은 줄이 사라져 0건, 나머지 항목은 다른 파일). 같은 버전의 AC-C-005 가 바로 이 실패 형상을 막으려 내용 검사로 바뀌었는데 AC-B-001 에는 적용되지 않은 내부 비대칭이었다. **양성 존재 확인**(`grep -Fn 'toBe(3 * 1024 * 1024)'` 1건 이상)을 추가해 4항으로 확장.
  - **N4 (blocking-minor) — 정지 규칙이 존재하지 않는 위치를 가리킴**: 대안 (c) 는 `spec.md` Design Note 가 아니라 `plan.md` B-1(`:41`)에 있으며, 거기서 **기각된** 안이다. 문서·절 이름이 모두 틀렸고, 기각된 안을 대응책으로 제시한 것 자체가 잘못이었다. 링크만 고치지 않고 (c) 를 선택지에서 제거했다 — D2 귀속 실패는 "거대 라인을 매번 훑는 비용"의 현실화이므로 (c) 의 기각 사유가 오히려 강해진다. 아울러 D2 귀속 시 대응을 "자체 대응 없음, 즉시 에스컬레이션"으로 바꿨다(임계값 인하는 사용자가 D2 에서 닫기로 한 잔여 대역을 다시 여는 것이므로 run 단계 재량이 아니다).
  - **N5 (blocking-minor) — AC-B-002 와 REQ-B-002 의 명제 불일치**: v1.2.0 의 Then 은 "폴드 대상으로 반환된다"인데 REQ-B-002 의 규범 절은 "폴드된 라인에 위젯 없음"이라 대응이 이름만 남았다. Then 을 2명제(폴드 트리거 + 위젯 미생성)로 확장해 REQ 를 온전히 덮으면서 v1.2.0 이 확보한 폴드 트리거 검증도 유지.
  - **N7 (minor) — grep 방언 의존 거짓 통과 2건**: `grep -n 'toBe(1 \* 1024 \* 1024)'` 와 AC-B-003 의 `grep -n 'toBeGreaterThanOrEqual(LINE_FOLD_THRESHOLD)'` 는 괄호가 리터럴이라는 전제에 의존한다. `grep -E` 방언에서는 그룹으로 해석되어 **항상 0건**이 되므로 음성 확인이 무조건 통과한다. 둘 다 `grep -Fn` 으로 교체(후자는 v1.0.0 부터 있던 결함).
  - **N2 (minor) — 계측 우회 가능**: `Text.lineAt(pos).text` 로 본문을 가져오면 라인 경계도 지켜지고 REQ-A-006 도 위반하지 않지만, `plan.md` §E-2 가 `sliceString` 만 계측하므로 `scannedChars`/`sliceCalls` 가 둘 다 0 이 되어 AC-C-003 이 실패한다. 거짓 통과가 아니라 실패 쪽이라 안전하지만 올바른 구현을 두고 진단 사이클을 낭비한다. §E-2 에 "본문 획득은 `sliceString` 으로 한정" 제약과 그 이유를 명시.
  - **N3 (minor) — 단일 벽시계 표본으로 분기**: 예산 근처에서 같은 코드가 실행마다 경계 양쪽에 떨어질 수 있고 그 한 번이 D1/D2 귀속과 에스컬레이션 방향을 정해 버린다. 조건마다 3회 측정 후 **중앙값** 판정 + 개별값 6개 보고 + 산포 20% 초과 시 귀속 불신 보고로 변경.
  - **N6 (minor) — `plan.md` §C 소제목이 자기 표와 모순**: 변경 표가 `longLineFold.test.ts` 를 변경 대상으로 올려놓고 아래 소제목은 "변경은 아니나"라고 선언했다. 소제목을 "실행 비용 증가 — 위 표의 변경과 별개 축"으로 바꾸고, 파급 표에 편집 필요 여부 열을 추가해 두 축을 구분.
- **2026-09-22 v1.2.0 (plan-audit FAIL 0.67 대응 — 비용을 주장에서 측정으로 전환)**: D1/D2/D3 사용자 결정은 그대로 두되, 3MB 상향의 비용을 근거 없이 주장하던 부분을 전부 측정 대상으로 바꾼다.
  - **D2 (critical) — `PT-A1-006b` 증거가 주장을 뒷받침하지 않음**: `e2e/spec-img-load-002.spec.ts:55-56` 의 픽스처 라인 길이를 계산한 결과 **2,097,183자**(`'A'.repeat(2 * 1024 * 1024)` + 마크다운/URI 접두 30자 + `)` 1자)다. 현행 1,048,576 기준에서는 폴드되어 `visibleRanges` 에서 제외되므로 941ms 는 **그 라인이 폴드된 상태에서 측정된 값**이다. REQ-B-001 의 3,145,728 기준에서는 `1,048,576 < 2,097,183 < 3,145,728` 이므로 **폴드되지 않으며**, REQ-A-001 의 라인 확장에 의해 키 입력마다 전량 스캔된다. 따라서 M4 의 측정은 회귀 확인이 아니라 **새 시나리오의 최초 측정**이다. `plan.md` F절 완화책과 `spec.md` Lezer Out-of-Scope 근거에서 941ms 인용을 제거하고, AC-C-002 에 정지 규칙을 추가했다.
  - **D1 (critical) — 구 임계값을 단언하는 테스트 누락**: `src/test/previewLimits.test.ts:43-45` 가 `expect(LINE_FOLD_THRESHOLD).toBe(1 * 1024 * 1024)` 를 단언하는데 v1.1.0 의 네 문서 어디에도 이 파일이 없었다. `npm test` 전건 통과를 완료 조건으로 두었으므로 완료 불가능한 상태였다. Traceability·`plan.md` §C·AC-B-001 에 반영.
  - **D3 (major) — `DocView` 에 `lineAt` 없음**: `image-widget.ts:158-169` 의 `DocView` 는 `length` / `sliceString` / `visibleRanges` 만 노출한다. AC-A-006 의 "변경 없이 통과" 주장은 성립하지 않으므로 mock 확장을 허용하도록 개정하고, M2 의 예상 FAIL 범위를 정정했다.
  - **D4 (major) — 타 SPEC 의 확정 결정 개정**: 1MB 는 `SPEC-IMG-LOAD-002` 의 OD-1 확정값이므로 frontmatter `supersedes:` 로 개정 사실을 선언했다(`SPEC-IMG-MODE-003` 의 관례를 따름).
  - **D5 (major) — AC-C-002 실패 원인 단일 귀속**: 실패 원인을 D1 로만 돌리던 서술을 D1/D2 2방향 판별로 재작성.
  - **D6 (minor, blocking) — AC-B-002 독립 검증 불가**: `findLinesToFold` 기반 전용 단언을 부여.
  - 부수 정정: `file:line` 3건 off-by-one(`image-widget.ts:34`→`:35`, `:196-211`→`:197-212`, `image-widget.test.ts:333`→`:332`), AC-C-005 의 라인 수 대리지표를 내용 검사로 교체, Assumptions 에 반개구간 규약 추가.
- **2026-09-22 v1.1.0 (잔여 대역 폐쇄 — 임계값 3MB 확정)**: v1.0.0 이 알려진 한계로 남겼던 base64 팽창 잔여 대역을 사용자 결정으로 **완전히 제거**한다.
  - `LINE_FOLD_THRESHOLD` 를 2MB 가 아니라 **3MB(3,145,728자)** 로 확정 (REQ-B-001 개정). 인라인 이미지가 만들 수 있는 최장 라인은 `base64Length(IMAGE_INLINE_THRESHOLD - 1)` = `4 × ceil(2097151 / 3)` = 2,796,204자이므로 3MB 문자 임계값이 여유를 두고 이를 덮는다. 원본 약 1.5MB~2MB 잔여 대역이 사라진다.
  - v1.0.0 Known Limitations 의 "base64 팽창으로 인한 잔여 폴딩 대역" 항목 **삭제** — 더 이상 존재하지 않는다. REQ-B-002(폴드된 라인에는 위젯 없음)는 진짜 거대한 비이미지 텍스트 라인에 대해 여전히 참이므로 유지한다.
  - REQ-B-003 전면 재작성: `imageHandler.test.ts:437` 의 기존 단언은 **보존 대상이 아니라 교체 대상**이다. 해당 단언은 바이트 수와 문자 수를 비교하므로 도입 시점부터 차원상 무의미했다. 같은 단위끼리 비교하는 단언으로 대체한다.
  - Design Note 신설 — 바이트/문자 단위 불일치가 본 대역의 잠복 결함이었음을 기록.
- **2026-09-22 v1.0.0**: 최초 작성. v0.15.0(SPEC-IMG-LOAD-002 REQ-A-001 머지) 이후 발생한 인라인 이미지 위젯 미렌더 회귀를 복구한다.
  - 근본 원인 2계층(CodeMirror line gap + 자동 라인 폴딩)을 `file:line` 증거와 함께 확정.
  - 확정 결정 D1(가시 라인 경계 스캔) / D2(`LINE_FOLD_THRESHOLD` 상향)를 요구사항으로 전개.
  - 신규 발견 2건을 요구사항에 반영: (가) 폴드된 라인이 라인 경계 확장으로 스캔 대상에 재유입되는 위험 → REQ-A-002, (나) base64 팽창(약 1.333배)으로 인해 임계값을 2MB 로 두면 잔여 대역이 남음 → v1.1.0 에서 3MB 로 폐쇄.

---

## Context & Problem Statement

v0.15.0 이전에는 인라인(`inline-blob`) 모드에서 이미지를 붙여넣으면 CodeMirror 편집 영역에 썸네일 위젯이 표시되었다. v0.15.0 이후에는 위젯이 사라지고 원시 base64 마크다운 텍스트(`![image](data:image/png;base64,iVBOR...)`)가 그대로 노출된다.

이 회귀는 예외적 상황이 아니라 **사실상 모든 인라인 이미지**에 적용된다. 약 15KB 이미지가 base64로 약 20,000자가 되므로, 일상적인 스크린샷이 아래 Root Cause 의 20,000자 경계를 즉시 초과한다.

### 영향 범위

| 축 | 증상 |
|---|---|
| 편집 화면 | 썸네일 대신 수만~수백만 자의 base64 문자열 노출 (SPEC-IMG-WIDGET-001이 해결했던 원래 고통의 완전 재발) |
| 미리보기 패널 | 영향 없음 (별도 경로) |
| 파일 저장/읽기 | 영향 없음 (소스 텍스트는 변경되지 않음) |

---

## Root Cause (검증 완료)

### 계층 1 — CodeMirror line gap 이 단일 라인을 내부적으로 분절한다

| # | 위치 | 사실 |
|---|---|---|
| 1 | `src/components/editor/extensions/markdown-extensions.ts:105` | `EditorView.lineWrapping` 활성화 |
| 2 | `node_modules/@codemirror/view/dist/index.js:6378` | `let margin = wrapping ? 10000 : 2000, doubleMargin = margin << 1;` → wrapping 시 `doubleMargin = 20000` |
| 3 | `node_modules/@codemirror/view/dist/index.js:6414` (`checkLine`) | `if (line.length < doubleMargin || line.type != BlockType.Text) return;` → **20,000자를 초과하는 라인**에 line-gap 데코레이션이 부여된다 |
| 4 | `node_modules/@codemirror/view/dist/index.js:6490-6498` (`computeVisibleRanges`) | line-gap 데코레이션이 `deco` 에 합성된 뒤 `RangeSet.spans(deco, viewport.from, viewport.to, { span(from,to){ranges.push(...)}, point(){} }, 20)` 로 처리된다. `point()` 콜백이 비어 있으므로 gap 이 덮는 구간은 `visibleRanges` 에서 **제외**된다 → 긴 라인이 **자기 자신 안에서** 복수 조각으로 분절된다 |
| 5 | `src/components/editor/extensions/image-widget.ts:197-212` (`buildDecorations`) | SPEC-IMG-LOAD-002 REQ-A-001 로 도입. `view.visibleRanges` 를 순회하며 각 `sliceString(from, to)` 조각에 대해 `parseDataUriImage()` 를 **독립 실행** |
| 6 | `src/components/editor/extensions/image-widget.ts:35` | 패턴 `/!\[([^\]]*)\]\((data:image\/([^;]+);base64,([A-Za-z0-9+/=]+))\)/g` 는 완결된 `![alt](data:...)` 구조가 **하나의 조각 안에** 있어야 매칭된다 |

결론: line gap 이 `![alt](data:...)` 구조를 가로지르면 어느 조각에서도 매칭되지 않고 → 위젯 0개 → 원시 base64 노출.

> 검증 범위 주석: 위 표의 `node_modules/@codemirror/view/dist/index.js` 행 번호는 `@codemirror/view` v6.39.15(`package.json:27`의 `^6.39.15`)를 대상으로 오케스트레이터가 주 체크아웃에서 확인한 값이다. sync-phase 독립 감사에서 주 체크아웃의 v6.39.15 실물과 대조해 재확인했으며, 이때 2개 행 번호의 1줄 오차(6413→6414, 6491→6490)를 정정했다. `src/` 측 행 번호(1, 5, 6행)는 본 워크트리에서 직접 확인했다.

### v0.15.0 이전 동작

`ee20de2^` 시점의 `buildDecorations` 는 `view.state.doc.toString()` 으로 문서 전체를 스캔했으므로 line gap 이 영향을 주지 않았다. 즉 본 회귀는 SPEC-IMG-LOAD-002 REQ-A-001(full-doc copy 제거, 동결 해소)의 **의도된 성능 개선이 가져온 의도치 않은 부작용**이다.

### 계층 2 — 자동 라인 폴딩이 별도로 위젯을 구조적으로 불가능하게 만든다

| # | 위치 | 사실 |
|---|---|---|
| 1 | `src/lib/preview/previewLimits.ts` | `LINE_FOLD_THRESHOLD = 1 * 1024 * 1024` (1MB), `IMAGE_INLINE_THRESHOLD = 2 * 1024 * 1024` (2MB) |
| 2 | `src/components/editor/extensions/long-line-fold.ts:84-87` | `LINE_FOLD_THRESHOLD` 초과 라인에 대해 `foldEffect.of({ from: t.from, to: t.to })` dispatch |
| 3 | (동일) | fold 는 state 데코레이션이므로 `visibleRanges` 에서 제외된다 — 계층 1과 동일한 메커니즘 |

결론: 인라인 이미지는 `IMAGE_INLINE_THRESHOLD`(2MB)까지 허용되는데 폴딩은 1MB에서 시작하므로, **1MB~2MB 대역의 이미지**는 계층 1을 고쳐도 위젯이 생성될 수 없다.

---

## Goal

1. line gap 으로 분절된 라인에서도 인라인 이미지 위젯이 렌더되도록 복구한다. (계층 1)
2. 폴딩 임계값을 인라인 이미지의 base64 팽창분을 넘도록 올려, 폴딩이 위젯을 가로막는 대역을 **제거**한다. (계층 2)
3. 위 두 가지를 **SPEC-IMG-LOAD-002 REQ-A-001 의 동결 해소를 되돌리지 않으면서** 달성한다.

---

## Assumptions

1. `view.visibleRanges` 는 항상 오름차순·비중첩으로 제공되며, 라인 경계로 확장한 뒤 정규화하면 여전히 오름차순·비중첩으로 만들 수 있다.
2. `RangeSetBuilder.add()` 는 오름차순·비중첩 입력을 요구하며, 중복/역순 입력 시 예외를 던진다. 따라서 확장 후 병합은 선택이 아니라 필수다.
3. 가시 라인 전체를 스캔하는 비용은 "가시 라인 길이 합"에 비례하며, 문서 전체 길이와는 무관하다.
4. `foldEffect` 로 폴드된 라인은 `visibleRanges` 에서 완전히 제외되며, `long-line-fold.ts` 는 `line.from`~`line.to` 전체를 폴드하므로 폴드 경계가 라인 경계와 일치한다.
5. 미리보기 패널(`renderer.ts` 경로)은 `buildDecorations` 와 무관하므로 본 SPEC 변경의 영향을 받지 않는다.
6. 범위 규약: 본 SPEC 의 모든 `from`~`to` 범위는 **반개구간 `[from, to)`** 로 해석한다. 따라서 "문자 1개 이상 교집합"은 `range.from < line.to && range.to > line.from` 과 동치이며, `range.to === line.from` 이나 `range.from === line.to` 는 교집합 없음이다.

---

## Requirements

### Axis A — 가시 라인 경계 스캔 (계층 1 복구)

#### REQ-A-001 (Ubiquitous)

`buildDecorations` 함수는 `view.visibleRanges` 의 각 항목을 **라인 경계로 확장한 범위**를 스캔 대상으로 삼아야 한다. 확장 범위는 "해당 `visibleRange` 와 문자 1개 이상의 교집합을 갖는 모든 라인"의 합집합(각 라인의 `line.from`~`line.to`)으로 정의된다.

#### REQ-A-002 (Unwanted — shall not)

`buildDecorations` 함수는 `visibleRange` 와의 교집합이 공집합인 라인을 스캔 대상에 포함해서는 안 된다.

> 근거: 폴드된 라인 `L` 주변의 `visibleRanges` 는 `{..., to: L.from}` 과 `{from: L.to, ...}` 형태가 된다. `doc.lineAt(L.from)` 과 `doc.lineAt(L.to)` 는 둘 다 라인 `L` 을 반환하므로, 경계 검사 없이 확장하면 폴드된 거대 라인이 스캔 대상으로 재유입되어 SPEC-IMG-LOAD-002 가 제거한 동결이 되살아난다. "문자 1개 이상 교집합" 규칙이 이 재유입을 구조적으로 차단한다.

#### REQ-A-003 (Ubiquitous)

확장된 범위들은 오름차순·비중첩이 되도록 정규화(인접·중첩 범위 병합)되어야 하며, 하나의 라인은 정확히 한 번만 스캔되어야 한다.

#### REQ-A-004 (Event-driven)

**When** 하나의 라인이 line gap 에 의해 복수의 `visibleRanges` 항목으로 분절된 상태에서 데코레이션이 재계산될 때, 편집기는 그 라인의 각 data URI 이미지마다 **정확히 하나의** 위젯 데코레이션을 생성해야 한다(중복 0개, 누락 0개).

#### REQ-A-005 (Event-driven)

**When** 사용자가 인라인 모드에서 이미지를 붙여넣어 20,000자를 초과하는 라인이 생성될 때, 편집기는 그 라인이 폴드되지 않은 한 base64 길이와 무관하게 썸네일 위젯을 렌더해야 한다.

#### REQ-A-006 (Unwanted — shall not)

`buildDecorations` 함수는 `view.state.doc.toString()` 을 호출해서는 안 되며, 그 밖의 어떤 방식으로도 문서 전체를 복사해서는 안 된다. (SPEC-IMG-LOAD-002 REQ-A-001 보존)

### Axis B — 폴딩 임계값 정렬 (계층 2 완화)

#### REQ-B-001 (Ubiquitous)

`src/lib/preview/previewLimits.ts` 의 `LINE_FOLD_THRESHOLD` 는 `3 * 1024 * 1024`(3,145,728자) 이어야 한다.

근거: 인라인 이미지가 만들 수 있는 최장 라인의 길이는 `base64Length(IMAGE_INLINE_THRESHOLD - 1)` = `4 × ceil(2097151 / 3)` = 2,796,204자다(마크다운·URI 접두 약 30자 별도). 3,145,728자 임계값은 이를 여유를 두고 덮으므로, 인라인으로 삽입 가능한 어떤 이미지도 자동 폴드 대상이 되지 않는다.

#### REQ-B-002 (State-driven)

**While** 어떤 라인이 폴드된 상태인 동안, 편집기는 그 라인의 data URI 이미지에 대해 위젯을 생성하지 않는다.

REQ-B-001 이후 이 상황은 인라인 이미지로는 도달할 수 없으며, 진짜 거대한 비이미지 텍스트 라인(3MB 초과의 순수 텍스트, 외부 도구가 생성한 단일 라인 데이터 등)에 대해서만 발생한다. 그런 라인에 위젯이 없는 것은 의도된 동작이다.

#### REQ-B-003 (Ubiquitous)

`src/test/imageHandler.test.ts` 의 이웃 제약 단언은 다음과 같이 **교체**되어야 한다.

1. **제거**: 기존 단언 `expect(IMAGE_INLINE_THRESHOLD).toBeGreaterThanOrEqual(LINE_FOLD_THRESHOLD)`(`imageHandler.test.ts:437`)는 삭제되어야 한다. 이 단언은 **바이트 수**(`IMAGE_INLINE_THRESHOLD`)와 **문자 수**(`LINE_FOLD_THRESHOLD`)를 직접 비교하므로 도입 시점부터 차원상 무의미했으며, REQ-B-001 이후에는 값 자체로도 거짓이 된다.
2. **추가**: 같은 단위끼리 비교하는 단언 `LINE_FOLD_THRESHOLD >= base64Length(IMAGE_INLINE_THRESHOLD)` 가 있어야 한다. 여기서 `base64Length(n) = 4 * Math.ceil(n / 3)` 이다. `base64Length` 를 테스트 로컬 헬퍼로 둘지 공용 유틸로 내보낼지는 run-phase 의 구현 선택이며 본 요구사항은 **계약만** 규정한다.
3. **정정**: 해당 테스트의 이름에 남은 `(1MB)` 리터럴과 "하위 이웃 제약"이라는 표현은 정정되어야 한다. 두 상수의 관계는 더 이상 "폴딩이 인라인보다 아래"가 아니라 **"폴딩이 인라인의 base64 팽창분을 초과해야 한다"** 이다.

#### REQ-B-004 (Ubiquitous)

`previewLimits.ts` 의 `IMAGE_INLINE_THRESHOLD` 문서 주석은 `LINE_FOLD_THRESHOLD` 를 "하위 이웃"으로 기술하고 있다. 이 서술은 REQ-B-003 이 규정한 새 관계(`LINE_FOLD_THRESHOLD >= base64Length(IMAGE_INLINE_THRESHOLD)`)를 반영하도록 갱신되어야 하며, 각 상수의 **단위**(바이트 / 문자)를 명시해야 한다.

### Axis C — 회귀 방지·성능 게이트

#### REQ-C-001 (Ubiquitous)

라인 갭 형상(하나의 라인이 복수 `visibleRanges` 조각으로 분절되고 data URI 구조가 그 경계를 가로지름)을 모델링한 자동 테스트가 존재해야 하며, 수정 전 코드에서 FAIL 하고 수정 후 PASS 해야 한다.

> 근거: 기존 단위 테스트가 이 회귀를 놓친 이유는 mock 형상에 있다. `src/test/image-widget.regression.test.ts:20` 과 `src/test/image-widget.test.ts:298` 은 `visibleRanges: [{ from: 0, to: text.length }]` — 문서 전체를 덮는 단일 범위 — 를 구성하므로 라인 **내부** 분절을 표현할 수 없다.

#### REQ-C-002 (Ubiquitous)

SPEC-IMG-LOAD-002 의 linchpin Playwright 테스트 `PT-A1-006b`(`e2e/spec-img-load-002.spec.ts:163`)는 본 SPEC 적용 후에도 통과해야 한다. 이는 must-pass 게이트이며 선택 항목이 아니다.

#### REQ-C-003 (Ubiquitous)

최악의 경우 단일 가시 라인은 약 2,796,234자(약 2.67MB — REQ-B-001 의 계산)에 달할 수 있다. 편집기는 키 입력당 스캔 문자 수가 "가시 라인 길이 합"을 초과하지 않아야 하며, 이 값은 결정적으로 측정 가능해야 한다.

#### REQ-C-004 (Event-driven)

**When** 4MB 규모 문서에서 거대 base64 라인이 뷰포트 안에 있는 상태로 키 입력이 발생할 때, 편집기는 `INPUT_RESPONSIVENESS_BUDGET_MS`(5,000ms) 이내에 입력을 DOM 에 반영해야 한다.

#### REQ-C-005 (Ubiquitous)

기존 테스트 `src/test/image-widget.test.ts:311-331`(`'visible 범위 밖의 data URI 는 위젯 생성 안 함'`)은 **개정되어야 하며 삭제되어서는 안 된다**. 아래 Revised Documented Behavior 가 무엇이 살아남고 무엇이 바뀌는지를 규정한다.

---

## Revised Documented Behavior (REQ-C-005 상세)

`image-widget.test.ts:311-331` 은 뷰포트 한정 비스캔을 **의도된 동작**으로 단언한다. D1 은 그 단언의 일부를 무효화하므로, 무엇이 유지되고 무엇이 바뀌는지를 명시한다.

| 항목 | v0.15.0 (현행) | 본 SPEC 적용 후 |
|---|---|---|
| 가시 라인 **위**에 있으나 `visibleRanges` 밖으로 밀려난 data URI | 위젯 생성 안 함 | **위젯 생성함** (변경됨 — REQ-A-001) |
| 가시 라인이 **아닌** 라인의 data URI | 위젯 생성 안 함 | 위젯 생성 안 함 (유지 — REQ-A-002) |
| 폴드된 라인의 data URI | 위젯 생성 안 함 | 위젯 생성 안 함 (유지 — REQ-B-002) |

개정 방향: 기존 테스트의 fixture 는 `visible` 과 `hidden` 이 **같은 라인**에 있으므로(`const full = visible + hidden;`) 개정 후에는 위젯 2개가 기대값이 된다. 원래 의도했던 "뷰포트 밖은 스캔하지 않는다"는 단언을 보존하려면 `hidden` 을 **다른 라인**(`'\n'` 로 분리)에 배치한 형상으로 재작성한다. 즉 단언의 의도는 보존되고 경계의 단위가 "문자 오프셋"에서 "라인"으로 이동한다.

동일 파일의 인접 테스트 `'여러 visibleRanges 분할 — 각 범위를 독립 스캔'`(`image-widget.test.ts:332-353`)은 두 범위가 같은 라인 위에 있으므로 D1 적용 후 병합되어 1회 스캔되지만 기대값(위젯 2개)은 변하지 않는다. 다만 테스트 이름의 "각 범위를 독립 스캔"이라는 서술이 REQ-A-003(라인당 1회 스캔)과 모순되므로 이름과 주석을 정정한다.

---

## Design Note — 임계값의 단위 불일치

본 회귀의 계층 2(폴딩)가 오래 잠복할 수 있었던 원인은 두 임계값이 **서로 다른 단위**를 쓰면서 마치 같은 축 위의 이웃인 것처럼 문서화되고 단언되어 있었다는 점이다.

- `IMAGE_INLINE_THRESHOLD` — 원본 이미지 **바이트** 수
- `LINE_FOLD_THRESHOLD` — 라인 **문자** 수
- 두 축을 잇는 변환은 base64 팽창 `base64Length(n) = 4 × ceil(n / 3)` (약 1.333배)

`imageHandler.test.ts:437` 의 기존 단언은 이 변환 없이 바이트와 문자를 직접 비교했으므로 도입 시점부터 차원상 무의미했고, 그 결과 "인라인 허용 이미지가 폴드될 수 있다"는 상태를 어떤 테스트도 잡아내지 못했다.

향후 두 상수 중 어느 쪽이든 변경할 때는 **각 상수의 단위를 명시하고, 비교는 반드시 변환을 거친 같은 단위끼리 수행한다.**

---

## Known Limitations

### 부분 폴드 영역

`long-line-fold.ts` 는 라인 전체를 폴드하므로 REQ-A-002 의 "문자 1개 이상 교집합" 규칙으로 충분하다. 그러나 `@codemirror/language` 의 구문 기반 폴딩(코드 블록 등)은 라인 경계와 일치하지 않는 다중 라인 폴드를 만들 수 있다. 이 경우 부분적으로 가시인 라인은 폴드된 부분까지 포함해 스캔된다. 마크다운 문서에서 이 경로가 거대 base64 라인과 겹칠 가능성은 낮으므로 본 SPEC 의 잔여 위험으로만 기록한다.

---

## Exclusions

본 SPEC 이 다루지 않는 범위를 명시한다. 아래 항목은 out of scope 이며 본 SPEC 의 작업 중 변경되어서는 안 된다.

### Out of Scope — 미리보기 패널 렌더링

- `src/lib/preview/renderer.ts` 및 마크다운에서 HTML 로 가는 렌더 경로 전반
- 미리보기 측 이미지 해석(`imageResolver.ts`)
- 근거: `buildDecorations` 는 CodeMirror 편집 영역 전용이며 미리보기와 코드 경로를 공유하지 않는다

### Out of Scope — 이미지 삽입 라우팅

- SPEC-IMG-MODE-003 의 `resolveImageRoute` 및 per-image 2MB 라우팅 분기
- `IMAGE_INLINE_THRESHOLD` 의 **값** 변경 (본 SPEC 은 이 값을 읽기만 하며 변경하지 않는다)
- 붙여넣기 / 드롭 / 다이얼로그 세 진입점의 동작

### Out of Scope — 파일 크기 게이팅

- `SOFT_THRESHOLD`(30MB), `HARD_CEILING`(100MB), deprecated alias `FILE_SIZE_THRESHOLD`(5MB)
- `useFileSystem.ts` 의 `previewStatus` 라우팅과 `UnsupportedFileViewer` 경로

### Out of Scope — 래스터/SVG 뷰어

- SPEC-PREVIEW-008 의 이미지/SVG 전용 뷰어
- `SvgFileViewer` 의 소스 뷰 가드

### Out of Scope — Lezer 토크나이제이션 최적화

- SPEC-IMG-LOAD-002 Phase 2(Group B 스트리밍 / Group C Worker)
- 뷰포트 바운디드 Lezer 파싱(후속 SPEC 후보)
- 근거: 본 SPEC 은 Phase 2 를 **구현하지 않는다**. 다만 Phase 2 연기 판단 자체는 재확인 대상이다 — REQ-B-001 이 `PT-A1-006b` 의 대상 라인(2,097,183자)을 **폴드 상태에서 비폴드 상태로 전환**하므로, 그 판단의 근거가 된 기존 측정값은 더 이상 같은 시나리오를 대표하지 않는다. M4 의 재측정 결과로 연기 판단을 재확인하며, 예산 초과 시 AC-C-002 의 정지 규칙에 따라 SPEC-IMG-LOAD-002 Re-planning Gate 로 에스컬레이션한다

---

## Traceability

| REQ | 대상 파일 |
|---|---|
| REQ-A-001 ~ REQ-A-006 | `src/components/editor/extensions/image-widget.ts` (`buildDecorations` + `DocView` 인터페이스 확장 — `:158-169` 에 라인 조회 멤버 추가) |
| REQ-B-001, REQ-B-004 | `src/lib/preview/previewLimits.ts` |
| REQ-B-001 (구 임계값 단언) | `src/test/previewLimits.test.ts:43-45` — `expect(LINE_FOLD_THRESHOLD).toBe(1 * 1024 * 1024)` 를 3MB 로 개정 |
| REQ-B-001 (픽스처 파급) | `src/test/longLineFold.test.ts:38-84`, `src/test/imageHandler.test.ts:396` — `LINE_FOLD_THRESHOLD + 1` 길이 문자열 할당이 3배로 증가 |
| REQ-B-002 | `src/components/editor/extensions/long-line-fold.ts` (`findLinesToFold`), `src/test/longLineFold.test.ts` |
| REQ-B-003 | `src/test/imageHandler.test.ts` |
| REQ-C-001, REQ-C-005 | `src/test/image-widget.test.ts`, `src/test/image-widget.regression.test.ts` |
| REQ-C-002, REQ-C-004 | `e2e/spec-img-load-002.spec.ts`, 신규 e2e 파일 `e2e/spec-img-widget-002.spec.ts` |
| REQ-C-003 | `src/test/image-widget.test.ts` (스캔 문자 수 계측) |
