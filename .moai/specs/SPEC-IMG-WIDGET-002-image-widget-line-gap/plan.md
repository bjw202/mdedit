# SPEC-IMG-WIDGET-002 구현 계획

관련 SPEC: `spec.md` (요구사항), `acceptance.md` (인수 기준)

---

## A. 컨텍스트

v0.15.0 에서 `buildDecorations` 가 full-doc 스캔에서 `visibleRanges` 스캔으로 바뀌면서(SPEC-IMG-LOAD-002 REQ-A-001) 인라인 이미지 위젯이 렌더되지 않는다. 원인은 CodeMirror 의 line gap 이 20,000자 초과 라인을 라인 **내부에서** 분절하고, `visibleRanges` 가 그 분절을 그대로 노출하기 때문이다. 상세 증거는 `spec.md` Root Cause 참조.

작업 위치: 워크트리 `WT-image-widget-gap` (`.claude/worktrees/img-widget-gap`). 개발 방법론은 TDD(RED-GREEN-REFACTOR) — 재현 테스트가 수정보다 먼저 온다.

---

## B. 결정 사항과 되돌리기 비용

가장 바꾸기 쉬운(따라서 리뷰가 집중되어야 할) 결정을 먼저 둔다.

### B-1. 확정 결정 — 폴딩 임계값 3MB (잔여 대역 폐쇄)

**해소됨.** 사용자가 선택지 (b) 를 선택하여 잔여 대역을 문서화된 한계로 남기지 않고 **완전히 제거**하기로 결정했다.

배경이 된 단위 불일치는 다음과 같다:

- `IMAGE_INLINE_THRESHOLD` = 원본 이미지 **바이트** 수 상한 (2,097,152)
- `LINE_FOLD_THRESHOLD` = 라인 **문자** 수
- base64 는 약 1.333배로 팽창 → 인라인 허용 최대 원본 2,097,151바이트는 `4 × ceil(2097151 / 3)` = **2,796,204자**가 된다

`LINE_FOLD_THRESHOLD` 를 2MB(2,097,152자)로 두면 2,097,152자 초과 ~ 약 2,796,234자 구간(원본 약 1.5MB~2MB)의 인라인 이미지 라인이 여전히 폴드된다. **3MB(3,145,728자)** 로 두면 2,796,204자를 여유 있게 덮으므로 이 대역이 사라진다.

확정 사항:

| 항목 | 값 |
|---|---|
| `LINE_FOLD_THRESHOLD` | `3 * 1024 * 1024` = 3,145,728 자 |
| 덮어야 할 최대 라인 길이 | `base64Length(2097151)` = 2,796,204 자 (+ 접두 약 30자) |
| 잔여 폴딩 대역 | 없음 |

**파급 — 기존 단언 교체 필요.** `imageHandler.test.ts:437` 의 `expect(IMAGE_INLINE_THRESHOLD).toBeGreaterThanOrEqual(LINE_FOLD_THRESHOLD)` 는 값 변경으로 거짓이 될 뿐 아니라, 애초에 **바이트와 문자를 직접 비교**하므로 도입 시점부터 차원상 무의미했다. 이 단언을 보존하려 해서는 안 되며, 같은 단위끼리 비교하는 `LINE_FOLD_THRESHOLD >= base64Length(IMAGE_INLINE_THRESHOLD)` 로 교체한다 (REQ-B-003). `base64Length(n) = 4 * Math.ceil(n / 3)` 의 배치(테스트 로컬 헬퍼 대 공용 export)는 run-phase 의 구현 선택이다.

선택되지 않은 대안 (c)(폴딩을 이미지 인식형으로 — data URI 를 포함한 라인은 폴드 제외)는 거대 라인마다 정규식을 돌게 되어 동결 위험이 재유입되므로 채택하지 않았다.

### B-2. 확정 결정 — 가시 라인 경계 확장 규칙 (D1)

스캔 대상 = "각 `visibleRange` 와 문자 1개 이상의 교집합을 갖는 모든 라인"의 합집합.

"문자 1개 이상 교집합"이라는 표현이 load-bearing 이다. 단순히 `doc.lineAt(range.from)` ~ `doc.lineAt(range.to)` 로 확장하면 **폴드된 라인이 다시 스캔 대상이 된다**:

```
라인 L 이 폴드된 경우 visibleRanges 는 다음 형태가 된다
  { ..., to: L.from }   ← doc.lineAt(L.from) === L  (L 전체가 끌려 들어옴)
  { from: L.to, ... }   ← doc.lineAt(L.to)   === L  (L 전체가 끌려 들어옴)
```

즉 순진한 확장은 SPEC-IMG-LOAD-002 가 제거한 동결을 되살린다. 교집합이 비어 있는 라인을 배제하는 규칙이 이를 구조적으로 막는다.

구현 형태(제안, 강제 아님): 각 range 에 대해 `startLine = doc.lineAt(range.from)`, `endLine = doc.lineAt(Math.max(range.from, range.to - 1))` 로 잡되, `range.from >= startLine.to && startLine.to > startLine.from` 인 경우 다음 라인으로 전진. 최종적으로 range 목록을 오름차순 정렬 후 인접/중첩 병합.

### B-3. 확정 결정 — 작업 격리

워크트리 `WT-image-widget-gap` 에서 작업하고, SPEC 산출물은 `.moai/specs/SPEC-IMG-WIDGET-002-image-widget-line-gap/` 에 둔다.

---

## C. 변경 대상 파일

| 파일 | 변경 내용 | 마일스톤 |
|---|---|---|
| `src/test/image-widget.regression.test.ts` | line-gap 형상 mock 헬퍼 추가 + 재현 테스트(RED) | M1 |
| `src/components/editor/extensions/image-widget.ts` | `buildDecorations` 라인 경계 확장 + 정규화 (REQ-A-001..004), **`DocView` 인터페이스(`:158-169`)에 라인 조회 멤버 추가** | M2 |
| `src/test/image-widget.regression.test.ts` · `src/test/image-widget.test.ts` | 모든 mock 에 라인 조회 멤버 추가 — `visibleRanges` 출현 18곳 / `buildDecorations` 호출 16곳(측정값) | M2 |
| `src/test/previewLimits.test.ts` | `:43-45` 의 `expect(LINE_FOLD_THRESHOLD).toBe(1 * 1024 * 1024)` 를 3MB 로 개정 + 테스트 이름 정정 (REQ-B-001) | M3 |
| `src/test/longLineFold.test.ts` | `:42/:59/:74/:84` 의 `LINE_FOLD_THRESHOLD_LOCAL ?? 1024 * 1024` 폴백 리터럴 정정 + AC-B-002 전용 단언 추가 | M3 |
| `src/lib/preview/previewLimits.ts` | `LINE_FOLD_THRESHOLD` 1MB → 3MB, 주석 갱신 (REQ-B-001, B-004) | M3 |
| `src/test/image-widget.test.ts` | 기존 단언 2건 개정 + 스캔 문자 수 계측 테스트 추가 (REQ-C-005, C-003) | M3 |
| `src/test/imageHandler.test.ts` | 차원 불일치 단언 제거 + `base64Length` 기반 단언 추가 + 테스트 이름 정정 (REQ-B-003) | M3 |
| `e2e/spec-img-widget-002.spec.ts` (신규) | 거대 base64 라인 위젯 렌더 + 입력 응답 e2e (REQ-C-004) | M4 |
| `e2e/spec-img-load-002.spec.ts` | 변경 없음 — `PT-A1-006b` 통과 여부만 확인 (REQ-C-002) | M4 |
| `src/components/editor/extensions/long-line-fold.ts` | 변경 없음 — 읽기 전용 확인 (REQ-B-002) | M3 |

`spec.md` Exclusions 에 열거된 파일은 어느 마일스톤에서도 변경하지 않는다.

### 픽스처 할당 파급 (실행 비용 증가 — 위 표의 변경과 별개 축)

`LINE_FOLD_THRESHOLD` 가 1MB → 3MB 가 되면 이 상수로 문자열을 만드는 기존 테스트의 할당량이 **3배**가 된다. 아래는 위 변경 표와 겹치는 파일을 **다른 축(실행 비용)에서** 다시 보는 것이며, 파일을 새로 추가하는 목록이 아니다. M3 에서 실측 확인한다.

| 위치 | 할당 | 변경 후 | 편집 필요 여부 |
|---|---|---|---|
| `src/test/longLineFold.test.ts:38-84` | `mockDoc` 의 `threshold + 1` 길이 라인 (4개 테스트가 각각 생성) | 1,048,577자 → 3,145,729자 | **편집 필요** — 폴백 리터럴 정정 + AC-B-002 단언 추가 (위 표 참조) |
| `src/test/imageHandler.test.ts:396` | `'A'.repeat(LINE_FOLD_THRESHOLD + 1)` | 동일 비율로 증가 | 이 줄 자체는 편집 불필요 (상수를 참조하므로 자동 추종). 같은 파일의 REQ-B-003 단언 교체는 별개 작업 |

`longLineFold.test.ts` 는 `LINE_FOLD_THRESHOLD_LOCAL ?? 1024 * 1024` 폴백을 쓰므로, 폴백이 실제로 사용되는 경로가 있다면 상수 개정 후에도 1MB 로 남아 테스트가 조용히 약해진다. 폴백 리터럴도 함께 정정한다.

---

## D. 마일스톤

### M1 — 재현 테스트 (RED) · 우선순위 High

수정보다 반드시 먼저 온다. 기존 단위 테스트가 이 회귀를 놓친 이유가 mock 형상이므로, 새 mock 이 결함을 표현할 수 있는지가 이 마일스톤의 전부다.

1. `image-widget.regression.test.ts` 에 헬퍼 `mockViewWithLineGap(fullText, gaps)` 추가 — 하나의 라인을 복수 `visibleRanges` 조각으로 분절하되 `![alt](data:...)` 구조가 경계를 가로지르도록 구성한다.
2. 재현 테스트 작성: 위 형상에서 `buildDecorations` 가 위젯 0개를 반환함을 **현행 코드에서** 확인한다(RED).
3. RED 상태를 증거로 기록한다 — 테스트 실행 출력 그대로.
4. 폴드 형상 테스트도 함께 작성: 라인 `L` 이 폴드된 상태(`{to: L.from}`, `{from: L.to}`)에서 `L` 이 스캔되지 않아야 한다(REQ-A-002). 현행 코드에서는 이미 통과하므로 회귀 가드 역할이다.

완료 조건: `npm test -- image-widget.regression` 실행 시 새 재현 테스트가 FAIL, 나머지는 PASS.

### M2 — 라인 경계 스캔 구현 (GREEN) · 우선순위 High

1. **`DocView` 계약 확장** — `image-widget.ts:158-169` 의 `DocView` 는 현재 `length` / `sliceString` / `visibleRanges` 만 노출하며 **라인 조회 멤버가 없다**. REQ-A-001 의 라인 경계 확장에 필요한 멤버(`lineAt` 계열)를 인터페이스에 추가한다. 이것이 M2 의 첫 산출물이다.
2. `buildDecorations` 에 라인 경계 확장 로직 추가 (REQ-A-001).
3. 교집합 공집합 라인 배제 (REQ-A-002). 반개구간 `[from, to)` 규약은 `spec.md` Assumptions 6 참조.
4. 확장 범위 정렬·병합 후 `RangeSetBuilder` 에 전달 (REQ-A-003) — 병합을 빠뜨리면 중복 `add()` 로 예외가 발생하므로 이 단계는 선택이 아니다.
5. `view.state.doc.toString()` 미호출 유지 (REQ-A-006).
6. **기존 mock 일괄 갱신** — 새 `DocView` 멤버를 제공하지 않는 mock 은 전부 FAIL 한다. 대상 범위는 `image-widget.test.ts` 와 `image-widget.regression.test.ts` 의 `visibleRanges` 출현 **18곳** / `buildDecorations` 호출 **16곳**(측정값). 기존 단언(특히 `toString` 호출 0회)은 보존한 채 멤버만 추가한다.

완료 조건: M1 의 재현 테스트 PASS, `image-widget.test.ts` / `image-widget.regression.test.ts` 전건 PASS.

예상 FAIL 범위 주의: 이 단계에서 FAIL 하는 것은 "M3 에서 개정할 2건"이 아니다. **라인 조회 멤버가 없는 모든 mock(최대 18곳)** 이 FAIL 하며, 그중 의미 있는 FAIL(REQ-C-005 의 근거가 되는 동작 변화)과 단순 mock 형상 FAIL 을 구분해 기록해야 한다. 둘을 뭉뚱그리면 실제 동작 변화가 mock 소음에 묻힌다.

### M3 — 폴딩 임계값 + 브라운필드 테스트 개정 · 우선순위 High

1. `previewLimits.ts`: `LINE_FOLD_THRESHOLD` 를 `3 * 1024 * 1024`(3,145,728) 로 변경 (REQ-B-001).
2. `previewLimits.ts`: `IMAGE_INLINE_THRESHOLD` 주석의 "하위 이웃" 서술을 새 관계(`LINE_FOLD_THRESHOLD >= base64Length(IMAGE_INLINE_THRESHOLD)`)로 갱신하고, 각 상수의 단위(바이트 / 문자)를 명시 (REQ-B-004).
3. `imageHandler.test.ts:437` 의 `expect(IMAGE_INLINE_THRESHOLD).toBeGreaterThanOrEqual(LINE_FOLD_THRESHOLD)` 를 **제거**하고, `LINE_FOLD_THRESHOLD >= base64Length(IMAGE_INLINE_THRESHOLD)` 단언으로 교체한다. 테스트 이름의 `(1MB)` 리터럴과 "하위 이웃 제약" 표현도 함께 정정한다 (REQ-B-003).
   - `base64Length(n) = 4 * Math.ceil(n / 3)`. 기대값은 `3,145,728 >= 2,796,204`.
   - 이 단언은 "통과 확인"이 아니라 **교체**다. 기존 단언을 살리려 시도하지 말 것 — 바이트와 문자를 직접 비교하므로 차원상 무의미하다.
   - `LINE_FOLD_THRESHOLD` 의 다른 소비자를 grep 으로 열거하고, 3MB 상향이 각 소비자에 미치는 영향을 개별 판단한다.
4. `image-widget.test.ts:311-331` 개정: `hidden` 을 다른 라인으로 이동시켜 "가시 라인이 아닌 라인은 스캔하지 않는다"는 원래 의도를 보존한다. 삭제 금지 (REQ-C-005).
5. `image-widget.test.ts:332-353` 개정: 테스트 이름/주석의 "각 범위를 독립 스캔"을 REQ-A-003(라인당 1회 스캔)에 맞게 정정한다. 기대값(위젯 2개)은 유지된다.
6. 스캔 문자 수 계측 테스트 추가 (REQ-C-003) — 측정 방법은 E절.

완료 조건: `npm test` 전건 PASS, `npm run typecheck` / `npm run lint` PASS.

### M4 — 성능 게이트 · 우선순위 High

1. `PT-A1-006b` 실행 및 통과 확인 (REQ-C-002, must-pass). **이는 새 시나리오의 최초 측정이다** — 대상 라인이 폴드 상태에서 비폴드 상태로 전환되므로 기존 941ms 는 통과 근거가 아니다(E-4 참조). 예산 초과 시 AC-C-002 의 2방향 판별(임계값만 1MB 로 되돌려 재측정) 후 정지·에스컬레이션하며, 자력으로 임계값을 조정해 통과시키지 않는다.
   - 폴링 형상 변화도 함께 확인한다: `e2e/spec-img-load-002.spec.ts:186-192` 의 `.cm-activeLine` `textContent` 가 위젯 치환으로 달라지고, `atomicRanges` 로 커서 위치가 밀릴 수 있다. 성능 실패와 폴링 형상 실패를 분리해 보고한다.
   - Phase 2(B/C) 무기한 연기 판단의 재확인도 이 측정에 달려 있다(`spec.md` Out of Scope — Lezer 토크나이제이션 최적화).
2. 신규 e2e `e2e/spec-img-widget-002.spec.ts` 추가 — 거대 base64 라인이 뷰포트에 있는 상태에서 (가) 위젯이 실제로 렌더되는지, (나) 키 입력이 `INPUT_RESPONSIVENESS_BUDGET_MS` 이내에 DOM 에 반영되는지 (REQ-C-004).
3. 기존 `spec-img-load-002.spec.ts` 의 `seedLargeFileScenario` 픽스처 구조를 재사용한다.

완료 조건: `npx playwright test e2e/spec-img-load-002.spec.ts e2e/spec-img-widget-002.spec.ts` PASS.

---

## E. 성능 측정 방법 (spec.md REQ-C-003 / 제약 5)

D1 은 SPEC-IMG-LOAD-002 REQ-A-001 이 절약한 비용의 일부를 되돌려 쓴다. 되돌려 쓰는 양을 명시적으로 측정한다.

### E-1. 무엇이 비용인가

D1 적용 후 키 입력(`docChanged`)마다 `buildDecorations` 는 **가시 라인 전체**를 `sliceString` 으로 잘라 정규식을 돌린다. 최악의 경우 단일 가시 라인이 약 2,796,234자(원본 2MB 미만 이미지의 base64 + 마크다운 접두)에 달한다. 문서 전체 길이와는 무관하다는 점이 REQ-A-001 의 보존 지점이다.

### E-2. 결정적 측정 — 스캔 문자 수 (1차 게이트)

벽시계 시간은 실행 머신에 좌우되므로 1차 게이트는 **스캔된 문자 수**로 둔다. mock 의 `sliceString` 을 계측형으로 감싸 `to - from` 을 누적한다.

[HARD] **텍스트 획득 경로는 `sliceString` 으로 한정한다.** CodeMirror 의 `Text.lineAt(pos)` 는 `.text` 프로퍼티를 가진 `Line` 을 반환하므로, 구현이 `lineAt(pos).text` 로 라인 본문을 가져와도 라인 경계는 지켜지고 REQ-A-006(full-doc 복사 금지)도 위반하지 않는다. 그러나 이 계측은 `sliceString` 만 감싸므로 그 경우 `scannedChars` 와 `sliceCalls` 가 **둘 다 0** 이 되어 AC-C-003 이 실패한다. 거짓 통과가 아니라 실패 쪽으로 기울므로 안전하지만, 올바른 구현을 놓고 원인 진단에 한 사이클을 낭비하게 된다. 따라서 라인 경계 확정에는 `lineAt` 을 쓰되 **본문 획득은 반드시 `sliceString(line.from, line.to)`** 로 한다. 이 제약은 성능이 아니라 계측 가능성을 위한 것이다.

측정 대상 지표:

| 지표 | 정의 | 단언 |
|---|---|---|
| `scannedChars` | 한 번의 `buildDecorations` 호출에서 `sliceString` 이 반환한 문자 수의 합 | 가시 라인 길이의 합과 **정확히 일치**해야 한다 |
| `sliceCalls` | `sliceString` 호출 횟수 | 병합 후 범위 개수와 일치. 하나의 라인에 대해 2회 이상 호출되면 REQ-A-003 위반 |
| `docLength 대비` | `scannedChars / doc.length` | 가시 라인이 문서의 일부일 때 1 미만이어야 한다 — full-doc 회귀 탐지 |

테스트 형상: 라인 3개짜리 문서(앞뒤는 짧은 텍스트, 가운데는 100,000자 base64 라인)에서 가운데 라인만 가시이고 line gap 으로 3조각 분절된 상태. 기대: `scannedChars == 가운데 라인 길이`, `sliceCalls == 1`.

이 지표는 머신 무관·결정적이므로 CI 에서 must-pass 로 둘 수 있다.

### E-3. 벽시계 측정 — e2e 입력 응답 (2차 게이트)

`INPUT_RESPONSIVENESS_BUDGET_MS`(5,000ms) 를 예산으로 하는 기존 관례를 따른다. 신규 e2e 테스트에서 거대 base64 라인이 뷰포트에 있는 상태로 키를 입력하고 DOM 반영까지의 경과 시간을 잰다. 기존 `PT-A1-006/006b` 와 동일하게 **로컬 must-pass, CI warning-only** 로 둔다(`previewLimits.ts` 의 `INPUT_RESPONSIVENESS_BUDGET_MS` 주석이 정한 관례).

### E-4. 기준선 — 기존 941ms 는 기준선이 아니다

`PT-A1-006b` 는 SPEC-IMG-LOAD-002 시점에 941ms / 5,000ms 로 측정되었다. 그러나 이 값은 본 SPEC 의 **비교 기준선이 될 수 없다** — 같은 테스트이지만 다른 시나리오를 측정한 값이기 때문이다.

픽스처 라인은 2,097,183자(`e2e/spec-img-load-002.spec.ts:55-56`)이고, 현행 `LINE_FOLD_THRESHOLD` 1,048,576 기준에서는 폴드되어 `visibleRanges` 에서 제외된다. 즉 941ms 는 **그 라인을 한 글자도 스캔하지 않은 상태**의 측정값이다. REQ-B-001 적용 후에는 3,145,728 미만이 되어 폴드되지 않고 전량 스캔된다.

따라서 M4 의 측정은 회귀 확인이 아니라 **최초 측정**이며, 941ms 를 근거로 통과를 예단하거나 비교 기준으로 인용해서는 안 된다. 비교 대상이 필요하면 M4 에서 `LINE_FOLD_THRESHOLD` 를 1MB 로 되돌린 대조군을 함께 측정한다(AC-C-002 의 2방향 판별과 동일한 절차).

---

## F. 위험

| 위험 | 영향 | 완화 |
|---|---|---|
| 확장 범위 병합 누락 → `RangeSetBuilder` 예외 | 편집기 전체가 죽는다 | REQ-A-003 전용 단위 테스트를 M2 에 포함 |
| 폴드 라인 재유입 → 동결 재발 | v0.15.0 이전 상태로 회귀 | REQ-A-002 테스트(M1 step 4) + `PT-A1-006b`(M4) 이중 게이트 |
| 브라운필드 테스트를 "고장난 테스트"로 오인해 삭제 | 문서화된 의도가 소실 | REQ-C-005 가 삭제를 금지. M3 step 4-5 가 개정 방향을 명시 |
| `previewLimits.ts` 상수 변경이 다른 소비자에 파급 | 예기치 않은 폴딩 동작 변화 | `LINE_FOLD_THRESHOLD` 소비자를 M3 시작 전에 grep 으로 열거하고 각각 영향 판단 |
| 폴딩 임계값 3MB 상향으로 `PT-A1-006b` 의 대상 라인이 **비폴드 전환** | 키 입력마다 2,097,183자를 전량 스캔 — 기존 941ms 측정이 대표하지 않는 새 비용 | 완화책 없음. **M4 의 측정이 이 시나리오의 최초 측정이다.** 픽스처 라인 2,097,183자는 `1,048,576 < 2,097,183 < 3,145,728` 이므로 현행에서는 폴드되어 스캔 0자, 개정 후에는 비폴드로 전량 스캔된다. 예산 초과 시 AC-C-002 의 2방향 판별 + 정지 규칙을 따른다 |
| `imageHandler.test.ts:437` 단언을 "고장난 테스트"로 보고 값만 맞춰 되살림 | 차원 불일치가 그대로 남아 같은 결함이 재발 | REQ-B-003 이 제거를 명시적으로 요구. AC-B-003 의 grep 검증이 잔존을 탐지 |

---

## G. 안티패턴

- `buildDecorations` 를 full-doc 스캔으로 되돌려 "간단히" 고치는 것 — REQ-A-006 위반이며 SPEC-IMG-LOAD-002 를 되돌린다.
- 정규식을 조각 경계에 관대하도록 완화하는 것(예: 부분 매칭 허용) — 잘못된 위젯을 만들고 근본 원인을 건드리지 않는다.
- line gap 을 끄기 위해 `EditorView.lineWrapping` 을 제거하는 것 — 줄바꿈은 사용자 요구 기능이며 SPEC 범위 밖이다.
- 재현 테스트 없이 수정부터 하는 것 — 이 회귀가 green 인 채로 출시된 이유가 정확히 그것이다.

---

## H. 상호 참조

- `spec.md` — 요구사항, Root Cause 증거, Known Limitations
- `acceptance.md` — AC 별 검증 명령
- SPEC-IMG-LOAD-002 — REQ-A-001(뷰포트 바운딩)이 본 회귀의 발생 지점, `PT-A1-006b` 가 must-pass 게이트
- SPEC-IMG-WIDGET-001 — 위젯 데코레이션의 원 SPEC, REQ-1..7 회귀 보존 대상
- SPEC-IMG-MODE-003 — `IMAGE_INLINE_THRESHOLD` 의 소유 SPEC (본 SPEC 은 값을 읽기만 함)
