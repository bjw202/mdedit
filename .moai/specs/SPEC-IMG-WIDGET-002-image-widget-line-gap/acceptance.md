# SPEC-IMG-WIDGET-002 인수 기준

각 AC 는 명명된 명령 또는 명명된 테스트 하나로 독립 검증 가능하다. 모든 AC 는 Given-When-Then 형식이며, 이는 검증 계층이다. 요구사항 계층(GEARS)은 `spec.md` 의 REQ 항목이 소유한다.

검증 명령 사전:

| 약칭 | 명령 |
|---|---|
| `UNIT` | `npm test` |
| `UNIT:widget` | `npm test -- image-widget` |
| `UNIT:handler` | `npm test -- imageHandler` |
| `TYPE` | `npm run typecheck` |
| `LINT` | `npm run lint` |
| `E2E:load002` | `npx playwright test e2e/spec-img-load-002.spec.ts` |
| `E2E:widget002` | `npx playwright test e2e/spec-img-widget-002.spec.ts` |

---

## Axis A — 가시 라인 경계 스캔

### AC-A-001 (REQ-A-001) — 라인 경계로 확장한다

**Given** 하나의 라인이 `visibleRanges` 상에서 `[{from: L.from, to: m}, {from: n, to: L.to}]` 두 조각으로 분절되어 있고, `![alt](data:image/png;base64,...)` 구조가 `m`~`n` 경계를 가로지른다
**When** `buildDecorations` 를 호출한다
**Then** 해당 data URI 에 대한 위젯 데코레이션이 1개 생성된다

검증: `UNIT:widget` — `image-widget.regression.test.ts` 의 `'line gap 으로 분절된 라인의 data URI 도 위젯이 된다'`

### AC-A-002 (REQ-A-002) — 교집합이 없는 라인은 스캔하지 않는다

**Given** 라인 `L` 이 폴드되어 `visibleRanges` 가 `[{from: P.from, to: L.from}, {from: L.to, to: N.to}]` 형태이고, 라인 `L` 에 data URI 이미지가 있다
**When** `buildDecorations` 를 호출한다
**Then** 라인 `L` 에 대한 위젯은 0개이고, 계측형 `sliceString` 이 라인 `L` 의 구간을 한 번도 잘라내지 않는다

검증: `UNIT:widget` — `image-widget.regression.test.ts` 의 `'폴드된 라인은 경계 확장으로 재유입되지 않는다'`

### AC-A-003 (REQ-A-003) — 라인당 정확히 1회 스캔, 예외 없음

**Given** 하나의 라인이 `visibleRanges` 상에서 3개 조각으로 분절되어 있다
**When** `buildDecorations` 를 호출한다
**Then** `sliceString` 호출 횟수가 1회이고, `RangeSetBuilder` 가 중복/역순 입력으로 예외를 던지지 않는다

검증: `UNIT:widget` — `image-widget.test.ts` 의 `'분절된 라인은 병합되어 1회만 스캔된다'`

### AC-A-004 (REQ-A-004) — 중복 위젯 0개

**Given** 한 라인에 data URI 이미지가 2개 있고, 라인이 3개 조각으로 분절되어 각 이미지가 서로 다른 경계를 가로지른다
**When** `buildDecorations` 를 호출한다
**Then** 위젯 데코레이션이 정확히 2개 생성된다(누락 0, 중복 0)

검증: `UNIT:widget` — `image-widget.test.ts` 의 `'분절 라인의 복수 이미지 — 중복/누락 없음'`

### AC-A-005 (REQ-A-005) — 실제 편집기에서 위젯이 보인다

**Given** 인라인 모드로 20,000자를 초과하는 base64 data URI 이미지가 포함된 `.md` 파일을 연다
**When** 해당 라인이 뷰포트에 들어온다
**Then** 편집 영역에 `.cm-image-widget` 요소가 1개 이상 나타나고, 원시 base64 문자열은 활성 라인 텍스트로 노출되지 않는다

검증: `E2E:widget002` — `'20,000자 초과 base64 라인에 위젯이 렌더된다'`

### AC-A-006 (REQ-A-006) — full-doc 복사 없음

**Given** `toString` 스파이가 달린 mock view
**When** `buildDecorations` 를 호출한다
**Then** `view.state.doc.toString()` 호출 횟수가 0 이다

검증: `UNIT:widget` — `image-widget.test.ts:293` 의 기존 테스트 `'view.state.doc.toString() 은 호출되지 않는다 (full-doc copy 회피)'`

비고: 이 테스트는 **변경 없이 통과할 수 없다**. `image-widget.ts:158-169` 의 `DocView` 인터페이스는 `length` / `sliceString` / `visibleRanges` 만 노출하며 라인 조회 멤버가 없다. REQ-A-001 이 라인 경계 확장을 요구하므로 `DocView` 에 라인 조회 멤버가 추가되어야 하고, 기존 mock 들은 그 멤버를 제공하지 않으므로 함께 갱신되어야 한다. 따라서 이 AC 는 **mock 에 라인 조회 멤버를 추가하는 변경을 허용**하되, 단언 자체(`toString` 호출 0회)는 보존될 것을 요구한다. mock 갱신 범위: `image-widget.test.ts` 와 `image-widget.regression.test.ts` 의 `visibleRanges` 출현 18곳 / `buildDecorations` 호출 16곳(측정값).

---

## Axis B — 폴딩 임계값 정렬

### AC-B-001 (REQ-B-001) — 상수값 3MB

**Given** `src/lib/preview/previewLimits.ts`
**When** `LINE_FOLD_THRESHOLD` 를 읽는다
**Then** 값이 `3 * 1024 * 1024`(3,145,728)이고, `base64Length(IMAGE_INLINE_THRESHOLD)`(= 2,796,204) 보다 크다

검증 항목 (4건 모두 필요):
1. `UNIT` — `src/test/previewLimits.test.ts:43-45` 의 `expect(LINE_FOLD_THRESHOLD).toBe(1 * 1024 * 1024)` 가 `3 * 1024 * 1024` 로 개정되어 PASS 한다. 테스트 이름의 `(1MB) 이다 (OD-1)` 문구도 함께 정정한다
2. **존재 확인(양성)**: `grep -Fn 'toBe(3 * 1024 * 1024)' src/test/previewLimits.test.ts` 매치 **1건 이상**
3. **부재 확인(음성)**: `grep -Fn 'toBe(1 * 1024 * 1024)' src/test/previewLimits.test.ts` 매치 0건
4. `UNIT:handler` — 신규 테스트 `'LINE_FOLD_THRESHOLD 는 3MB(3,145,728자) 이다'` PASS

비고 1: 검증 1 이 누락되면 `npm test` 전건 통과라는 완료 조건이 구조적으로 달성 불가능하다.

비고 2: 검증 2(양성)가 없으면 **해당 테스트 블록을 통째로 삭제하는 것만으로 이 AC 가 통과한다** — 스위트는 실패할 것이 없어 PASS 하고, 음성 grep 은 줄이 사라졌으니 0건이 되며, 남은 항목은 다른 파일에 있기 때문이다. AC-C-005 가 같은 실패 형상을 막으려고 라인 수 대리지표를 내용 검사로 바꾼 것과 동일한 이유로, 여기에도 양성 확인이 반드시 함께 있어야 한다.

비고 3: 세 grep 은 모두 `-F`(고정 문자열)를 쓴다. 괄호와 `*` 가 정규식 메타문자이므로, `grep -E` 방언에서는 `(...)` 가 그룹으로 해석되어 **항상 0건**이 되고 음성 확인이 무조건 통과하는 거짓 양성이 된다.

### AC-B-002 (REQ-B-002) — 3MB 초과 라인이 폴드 대상으로 판정되고, 폴드된 라인에는 위젯이 없다

**Given** 3,145,728자를 초과하는 순수 텍스트 라인(인라인 이미지로는 도달 불가)을 포함한 문서
**When** `findLinesToFold(doc, considered)` 를 호출하고, 그 라인이 폴드된 상태의 `visibleRanges` 로 `buildDecorations` 를 호출한다
**Then** 다음 두 명제가 **모두** 성립한다:
1. **폴드 트리거**: 해당 라인이 폴드 대상 목록에 포함되고, 3,145,728자 이하의 라인은 포함되지 않는다
2. **위젯 미생성**(REQ-B-002 의 규범 절): 폴드된 그 라인에 data URI 이미지가 있어도 위젯이 0개다

검증:
- 명제 1 — `npm test -- longLineFold`: `src/test/longLineFold.test.ts` 의 `'findLinesToFold 가 LINE_FOLD_THRESHOLD 초과 라인만 반환한다'`(`:38` 이하). 기존 테스트가 `LINE_FOLD_THRESHOLD_LOCAL ?? 1024 * 1024` 폴백 리터럴을 쓰므로(`:42`, `:59`, `:74`, `:84`) 이 폴백값도 함께 정정한다
- 명제 2 — `UNIT:widget`: AC-A-002 의 폴드 형상 테스트가 이 단언을 수행한다. AC-B-002 는 그 결과를 자신의 Then 으로 함께 요구한다(위임이 아니라 공동 요구)

비고: v1.1.0 은 이 AC 전체를 AC-A-002 에 위임했으나, AC-A-002 의 Given 은 손으로 만든 `visibleRanges` mock 이라 `LINE_FOLD_THRESHOLD` 가 실제로 폴딩을 유발하는지를 전혀 실행하지 않았다. v1.2.0 은 폴드 트리거 단언을 독립시켰으나 이번에는 Then 이 REQ-B-002 의 규범 절("폴드된 라인에 위젯 없음")과 달라져 REQ↔AC 대응이 이름만 남았다. v1.3.0 은 두 명제를 모두 Then 에 두어 REQ-B-002 를 온전히 덮으면서 폴드 트리거 검증도 유지한다.

### AC-B-003 (REQ-B-003) — 차원이 맞지 않는 단언이 교체되었다

**Given** `src/test/imageHandler.test.ts`
**When** `UNIT:handler` 를 실행하고 파일을 읽는다
**Then** 다음 세 가지가 모두 성립한다:
1. `expect(IMAGE_INLINE_THRESHOLD).toBeGreaterThanOrEqual(LINE_FOLD_THRESHOLD)` 형태의 바이트 대 문자 직접 비교 단언이 파일에 존재하지 않는다
2. `LINE_FOLD_THRESHOLD >= base64Length(IMAGE_INLINE_THRESHOLD)` 를 단언하는 테스트가 존재하고 PASS 한다. 여기서 `base64Length(n) = 4 * Math.ceil(n / 3)` 이며, 구체적 기대값은 `3,145,728 >= 2,796,204` 이다
3. 해당 테스트 이름에 `(1MB)` 리터럴과 "하위 이웃" 표현이 남아 있지 않다

검증:
- `grep -Fn 'toBeGreaterThanOrEqual(LINE_FOLD_THRESHOLD)' src/test/imageHandler.test.ts` 매치 0건
- `grep -Fn 'base64Length' src/test/imageHandler.test.ts` 매치 1건 이상 (양성 확인)
- `grep -Fn '하위 이웃' src/test/imageHandler.test.ts` 매치 0건
- `UNIT:handler` PASS

비고: 첫 grep 은 반드시 `-F`(고정 문자열)를 쓴다. 괄호가 정규식 메타문자이므로 `grep -E` 방언에서는 `(LINE_FOLD_THRESHOLD)` 가 그룹으로 해석되어 매치가 **항상 0건**이 되고, 단언이 남아 있어도 통과하는 거짓 양성이 된다. 이 결함은 v1.0.0 부터 있었다.

비고: `base64Length` 가 테스트 로컬 헬퍼인지 공용 유틸의 export 인지는 run-phase 의 선택이며 본 AC 는 위치를 규정하지 않는다.

### AC-B-004 (REQ-B-004) — 주석이 새 관계와 단위를 명시한다

**Given** `previewLimits.ts` 의 `IMAGE_INLINE_THRESHOLD` 문서 주석
**When** 주석을 읽는다
**Then** 다음이 모두 성립한다:
1. `LINE_FOLD_THRESHOLD` 를 "하위 이웃"으로 기술하지 않는다
2. `LINE_FOLD_THRESHOLD >= base64Length(IMAGE_INLINE_THRESHOLD)` 관계를 명시한다
3. 두 상수의 단위(`IMAGE_INLINE_THRESHOLD` = 원본 바이트, `LINE_FOLD_THRESHOLD` = 라인 문자)를 명시한다

검증: `grep -Fn '하위 이웃' src/lib/preview/previewLimits.ts` 가 `IMAGE_INLINE_THRESHOLD` 주석 블록에서 매치 0건 + 주석 육안 확인

---

## Axis C — 회귀 방지 · 성능

### AC-C-001 (REQ-C-001) — 재현 테스트가 수정 전 FAIL 한다

**Given** `image-widget.ts` 가 수정되기 전(M1 시점)의 작업 트리
**When** `UNIT:widget` 을 실행한다
**Then** 새 재현 테스트가 FAIL 하고, 실패 출력에 "기대 위젯 1개, 실제 0개"에 해당하는 단언 실패가 나타난다

검증: M1 완료 시 `UNIT:widget` 출력을 그대로 기록한다. 이 AC 는 수정 **후**에는 재현 불가하므로, M1 시점의 출력 증거가 유일한 근거다.

### AC-C-002 (REQ-C-002) — PT-A1-006b must-pass (새 시나리오의 최초 측정)

**Given** 본 SPEC 의 모든 변경이 적용된 작업 트리
**When** `E2E:load002` 를 실행한다
**Then** `'SPEC-IMG-LOAD-002 PT-A1-006b (linchpin): base64 라인 뷰포트 진입 시 Lezer 동결 (REQ-A-006 잔여)'` 이 PASS 하고, 측정 경과 시간이 `INPUT_RESPONSIVENESS_BUDGET_MS`(5,000ms) 미만이다

검증: `E2E:load002`

#### 이 측정은 회귀 확인이 아니라 최초 측정이다

`e2e/spec-img-load-002.spec.ts:55-56` 의 픽스처 라인은 `'A'.repeat(2 * 1024 * 1024)` + 마크다운·URI 접두 30자 + `)` 1자 = **2,097,183자**다.

| 기준값 | 판정 | 결과 |
|---|---|---|
| 현행 `LINE_FOLD_THRESHOLD` = 1,048,576 | 2,097,183 > 1,048,576 → **폴드됨** | `visibleRanges` 에서 제외 → 스캔 문자 0 |
| REQ-B-001 = 3,145,728 | 2,097,183 < 3,145,728 → **폴드 안 됨** | REQ-A-001 확장으로 키 입력마다 전량 스캔 |

즉 기존 941ms 는 **대상 라인이 폴드된 상태**에서 측정된 값이므로 본 SPEC 적용 후의 비용을 대표하지 않는다. 이전 측정값을 통과 근거로 인용해서는 안 된다.

#### 정지 규칙 (FAIL 시)

경과 시간이 `INPUT_RESPONSIVENESS_BUDGET_MS` 를 초과하면 **진행하지 말고 정지**한다. 정지 전에 원인을 2방향으로 판별한다:

1. **측정 방법**: 예산 근처에서는 같은 코드가 실행마다 경계 양쪽에 떨어질 수 있고, 그 한 번의 값이 D1/D2 귀속과 에스컬레이션 방향을 결정해 버린다. 따라서 조건마다 **3회 실행 후 중앙값**으로 판정한다. 개별 측정값 3개를 모두 기록하고, 3회의 산포가 예산의 20%를 넘으면 귀속 자체를 신뢰할 수 없는 것으로 보고 그 사실을 함께 보고한다.
2. **대조군**: `LINE_FOLD_THRESHOLD` 만 1,048,576 으로 되돌리고(다른 변경은 유지) 같은 테스트를 3회 재측정한다.
3. 판별 (양쪽 모두 중앙값 기준):
   - **되돌리면 통과** → 원인은 D2(임계값 상향으로 대상 라인이 비폴드 전환). 대응: **자체 대응 없음, 즉시 에스컬레이션**. 임계값을 낮추는 것은 사용자가 D2 에서 명시적으로 닫기로 한 잔여 대역을 다시 여는 것이므로 run 단계의 재량이 아니다
   - **되돌려도 실패** → 원인은 D1(라인 경계 확장 자체의 비용). 대응: REQ-A-001 의 확장 규칙 재설계 — 이는 사용자 결정을 건드리지 않으므로 run 단계에서 설계안을 제시할 수 있다
4. 어느 경우든 SPEC-IMG-LOAD-002 **Re-planning Gate** 로 에스컬레이션하고, 판별 결과와 두 조건의 측정값 6개(3회 × 2조건)를 함께 보고한다. 자력으로 임계값을 조정해 통과시키지 않는다.

> **대안 (c) 에 대하여**: `plan.md` B-1(`:41`)은 대안 (c)(폴딩을 이미지 인식형으로 — data URI 를 포함한 라인은 폴드 제외)를 **기각**했다. 사유는 거대 라인마다 정규식을 돌게 되어 동결 위험이 재유입된다는 것이며, D2 귀속 실패는 바로 그 "거대 라인을 매번 훑는 비용"이 현실화된 상황이므로 기각 사유가 오히려 강해진다. 따라서 (c) 는 이 정지 규칙의 선택지가 **아니다**. 재검토하려면 (c) 자체의 동결 비용을 새로 측정해야 하며, 그 판단은 Re-planning Gate 에 속한다. (v1.2.0 은 이 대안을 `spec.md` Design Note 에 있는 것으로 잘못 가리키면서 선택지로 제시했다 — 문서·절 이름이 모두 틀렸고, 기각된 안을 대응책으로 제시한 것도 잘못이었다.)

#### 폴링 형상 변화 평가

`e2e/spec-img-load-002.spec.ts:186-192` 는 `.cm-activeLine` 의 `textContent` 에 입력 문자가 포함되는지를 폴링한다. 본 SPEC 적용 후 이 라인은 폴드되지 않고 **위젯으로 치환**되므로 형상이 바뀐다:

- 치환 전 활성 라인의 `textContent` 는 약 2MB 의 base64 문자열이었으나, 위젯 치환 후에는 위젯이 기여하는 텍스트가 사실상 없어 입력 문자 위주의 짧은 문자열이 된다. `includes('Y')` 단언 자체는 여전히 성립할 것으로 보인다.
- 다만 `imageWidgetPlugin` 이 제공하는 `atomicRanges` 때문에 클릭 후 커서가 위젯 경계 밖으로 밀릴 수 있어, 입력 문자가 어느 라인에 들어가는지가 달라질 가능성이 있다. 이는 **가정이 아니라 M4 에서 실측으로 확인**해야 한다.
- 폴링이 형상 변화로 실패할 경우, 그것은 성능 실패가 아니라 테스트 형상 문제이므로 위 정지 규칙의 대상이 아니다. 두 가지를 혼동하지 말고 경과 시간과 폴링 실패 원인을 분리해 보고한다.

### AC-C-003 (REQ-C-003) — 스캔 문자 수가 가시 라인 길이 합과 일치한다

**Given** 라인 3개 문서(짧은 라인 / 100,000자 base64 라인 / 짧은 라인) 중 가운데 라인만 가시이고 line gap 으로 3조각 분절된 mock view
**When** 계측형 `sliceString` 으로 `buildDecorations` 를 호출한다
**Then** `scannedChars` 가 가운데 라인 길이와 정확히 일치하고, `sliceCalls` 가 1이며, `scannedChars < doc.length` 이다

검증: `UNIT:widget` — `image-widget.test.ts` 의 `'스캔 문자 수는 가시 라인 길이 합과 같다 (REQ-C-003)'`
비고: 머신 무관·결정적 지표다. 벽시계 시간은 AC-C-004 가 담당한다.

### AC-C-004 (REQ-C-004) — 거대 라인 가시 상태에서 입력이 5초 이내 반영된다

**Given** 4MB 규모 `.md` 문서의 거대 base64 라인이 뷰포트 안에 있는 상태
**When** 키를 한 글자 입력한다
**Then** DOM 반영까지의 경과 시간이 `INPUT_RESPONSIVENESS_BUDGET_MS`(5,000ms) 미만이다

검증: `E2E:widget002` — `'거대 base64 라인 가시 상태에서 키 입력이 5s 이내 반영된다'`
비고: 로컬 must-pass, CI warning-only (`previewLimits.ts` 의 `INPUT_RESPONSIVENESS_BUDGET_MS` 주석 관례).

### AC-C-005 (REQ-C-005) — 브라운필드 테스트가 개정되고 삭제되지 않았다

**Given** `src/test/image-widget.test.ts`
**When** 파일을 읽는다
**Then** 다음 두 가지가 모두 성립한다:
1. 뷰포트 밖 비스캔을 단언하는 테스트가 여전히 존재하되, fixture 의 `hidden` data URI 가 `'\n'` 으로 분리된 **다른 라인**에 있다
2. `'visible 범위 밖의 data URI 는 위젯 생성 안 함'` 블록이 통째로 삭제되지 않았다(이름 개정은 허용)

검증 (내용 검사 — 라인 수 대리지표는 쓰지 않는다):
- `grep -nE 'visible|가시' src/test/image-widget.test.ts` 결과에 "가시 라인이 아닌 라인은 스캔하지 않는다"는 취지의 `it(...)` 블록이 1건 이상 존재 (교대 `|` 를 쓰므로 `-E` 고정 — BRE 의 `\|` 형태는 `grep -E` 에서 리터럴이 되어 매치가 사라진다)
- 해당 블록의 fixture 에 `'\n'` 이 포함되어 `hidden` data URI 가 별도 라인에 있음을 육안 확인
- 해당 블록이 `expect(count).toBe(1)` 형태로 "가시 라인의 1개만"을 단언
- `UNIT:widget` PASS

비고: v1.1.0 은 `git diff --stat` 의 삭제/추가 라인 수 비교를 검증 수단으로 썼으나, AC-A-006 이 18곳의 mock 에 라인 조회 멤버를 추가하도록 허용하므로 추가 라인이 크게 늘어난다. 그러면 이 테스트를 **통째로 삭제해도** 라인 수 조건이 만족되어 대리지표가 무력화된다. 따라서 내용 검사로 교체한다.

---

## 엣지 케이스

| # | 상황 | 기대 |
|---|---|---|
| E-1 | `visibleRanges` 가 빈 배열 | 위젯 0개, 예외 없음 (기존 테스트 `'빈 문서 (visibleRanges 빈) → 위젯 0개, 예외 없음'` 유지) |
| E-2 | 문서 전체가 한 라인이고 전부 가시 | 확장해도 동일 범위 1개, 중복 `add()` 없음 |
| E-3 | data URI 가 라인의 맨 끝에서 끝남 (`line.to` 와 일치) | 위젯 1개 — 경계 off-by-one 없음 |
| E-4 | 인접한 두 `visibleRanges` 가 각각 서로 다른 라인 | 병합되지 않고 2개 범위로 유지 (라인이 다르면 합치지 않아도 중복 없음) |
| E-5 | 폴드된 라인이 문서의 첫 라인 | 앞쪽 `visibleRange` 가 없으므로 뒤쪽 `{from: L.to, ...}` 만으로 판정 — 라인 `L` 배제 |
| E-6 | 폴드된 라인이 문서의 마지막 라인 | 앞쪽 `{..., to: L.from}` 만으로 판정 — 라인 `L` 배제 |

---

## 품질 게이트

| 게이트 | 명령 | 기준 |
|---|---|---|
| 단위 테스트 | `UNIT` | 전건 PASS |
| 타입 | `TYPE` | 에러 0 |
| 린트 | `LINT` | `--max-warnings 0` 통과 |
| e2e (회귀) | `E2E:load002` | 전건 PASS, `PT-A1-006b` 포함 |
| e2e (신규) | `E2E:widget002` | 전건 PASS |

---

## Definition of Done

- [x] AC-A-001 ~ AC-A-006 전건 PASS
- [x] AC-B-001 ~ AC-B-004 전건 PASS
- [x] AC-C-001 의 RED 증거(M1 시점 테스트 출력)가 `progress.md` §E.2 에 기록됨
- [x] AC-C-002 (`PT-A1-006b`) PASS — 실행 출력 인용
- [x] AC-C-003 스캔 문자 수 단언 PASS
- [x] AC-C-004 입력 응답 e2e PASS — 측정값 기록
- [x] AC-C-005 브라운필드 테스트 개정 확인 (삭제 아님)
- [x] 품질 게이트 5종 전건 PASS
- [x] `spec.md` Exclusions 의 파일이 `git diff --stat` 에 나타나지 않음
- [x] `LINE_FOLD_THRESHOLD` 가 3,145,728 로 기록되어 있고, base64 팽창 잔여 대역이 0 임이 AC-B-003 로 단언됨
