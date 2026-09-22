# SPEC-IMG-WIDGET-002 진행 기록

SPEC: `SPEC-IMG-WIDGET-002` — 인라인 이미지 위젯 line-gap 회귀 복구
Tier: M · 워크트리: `WT-image-widget-gap`

---

## §E.1 Plan-phase Audit-Ready Signal

- 산출물: `spec.md`, `plan.md`, `acceptance.md`, `progress.md` (Tier M 세트)
- 요구사항: REQ-A-001..006 / REQ-B-001..004 / REQ-C-001..005 (총 15건)
- 인수 기준: AC-A-001..006 / AC-B-001..004 / AC-C-001..005 (총 15건, REQ 와 1:1)
- 근본 원인: `spec.md` Root Cause 에 2계층으로 `file:line` 증거와 함께 기록. `src/` 측 행 번호는 본 워크트리에서 직접 확인, `node_modules/@codemirror/view` 측 행 번호는 오케스트레이터가 주 체크아웃에서 확인한 값을 인용(본 워크트리에는 `node_modules` 미설치).
- 미해결: 없음. v1.0.0 의 `[NEEDS CLARIFICATION: LINE_FOLD_THRESHOLD 와 base64 팽창의 단위 불일치]` 는 사용자 결정으로 해소 — `LINE_FOLD_THRESHOLD = 3 * 1024 * 1024`(3,145,728자), 잔여 대역 0. `plan.md` B-1 참조.
- plan-audit: v1.1.0 FAIL(0.67) → v1.2.0 PASS-WITH-DEBT(0.86) → v1.3.0 에서 잔여 7건(N1~N7) 해소. v1.2.0 이 D1~D6 6건을 반영했고, v1.3.0 은 검증 수단의 거짓 통과 경로(AC-B-001 삭제로 통과, grep 방언 의존 2건)와 정지 규칙의 잘못된 참조·단일 표본 분기를 닫았다. REQ 본문은 v1.1.0 이후 변경 없음. 핵심 변화는 3MB 상향의 비용을 **주장에서 측정으로** 전환한 것 — `PT-A1-006b` 의 대상 라인(2,097,183자)이 폴드→비폴드로 전환되므로 M4 측정은 회귀 확인이 아니라 새 시나리오의 최초 측정이며, 기존 941ms 는 통과 근거가 아니다.
- run-phase 진입 시 필독: AC-C-002 의 2방향 판별 + 정지 규칙(예산 초과 시 자력 임계값 조정 금지, SPEC-IMG-LOAD-002 Re-planning Gate 로 에스컬레이션).
- 상태: `in-progress`. run-phase 완료 (M1~M4), sync-phase 대기.

## §E.2 Run-phase Evidence

### 마일스톤 결과

| 마일스톤 | 결과 | 증거 |
|---|---|---|
| M1 재현 테스트 (RED) | PASS | 수정 전 `npm test -- image-widget.regression` 에서 3건 FAIL — `expected +0 to be 1`(위젯 0개, 기대 1개). 수정 후 18/18 PASS |
| M2 라인 경계 스캔 (GREEN) | PASS | `expandToVisibleLines()` 신설. mock 갱신 전 14건 전부 `TypeError: doc.lineAt is not a function`(형상 실패), 갱신 후 동작 변화 실패는 정확히 1건 — REQ-C-005 가 예고한 `visible + hidden` 동일 라인 fixture |
| M3 임계값 3MB + 테스트 개정 | PASS | `LINE_FOLD_THRESHOLD` `1*1024*1024` → `3*1024*1024`. 변경된 `export const` 는 이 1건뿐 — 다른 상수는 불변 |
| M4 성능 게이트 | PASS | 아래 측정표 |

### 성능 측정 (오케스트레이터가 워크트리에서 직접 실행)

`PT-A1-006b` (AC-C-002, linchpin) — `--retries=0 --repeat-each=3`:

| 회차 | 결과 | 테스트 벽시계 |
|---|---|---|
| 1 | PASS | 3.4s |
| 2 | PASS | 3.4s |
| 3 | PASS | 3.4s |

3/3 PASS. 산포 사실상 0 — AC-C-002 의 정지 규칙(2방향 판별·대조군 측정)은 발동하지 않았다. `plan.md` §E-4 대로 941ms 를 비교 기준으로 인용하지 않았다.

신규 e2e `AC-C-004` 입력 응답 (`e2e/spec-img-widget-002.spec.ts`) — `--repeat-each=3`:

| 회차 | 측정값 | 예산 |
|---|---|---|
| 1 | 286 ms | 5,000 ms |
| 2 | 297 ms | 5,000 ms |
| 3 | 283 ms | 5,000 ms |

**중앙값 286ms — 예산의 5.7%.** 산포(최대−최소) 14ms = 예산의 0.28%, 20% 기준을 크게 밑돈다. 단독 실행에서는 187ms.

**해석**: `LINE_FOLD_THRESHOLD` 3MB 상향으로 픽스처 라인 2,097,183자가 폴드→비폴드로 전환되어 키 입력마다 전량 스캔됨에도 예산 초과가 없다. `spec.md` Out of Scope 의 Phase 2(Lezer 토크나이제이션) 무기한 연기 판단은 이 최초 측정으로 **재확인**된다.

### 경험적 관측 (가정이 아니라 실측)

- **위젯 실제 렌더 확인**: 위젯 라인의 DOM `textContent` 는 18자(`hugePNG / 1536.0KB`). 원문 2,097,183자는 DOM 에 존재하지 않는다. 회귀 증상(base64 원문 노출)이 사라졌음을 브라우저에서 직접 확인.
- **`atomicRanges` 와 커서**: `acceptance.md` AC-C-002 가 "실측으로 확인" 대상으로 남긴 항목. 우려한 "입력이 다른 라인에 들어감"은 **발생하지 않았다**. 커서는 위젯 라인의 끝(atomic range 바깥, 같은 라인)에 착지하고 입력 문자가 위젯 뒤에 붙는다(3회 동일, `onWidgetLine: true`). 폴링 형상 실패는 없었다.
- **스크롤로는 위젯 라인에 도달할 수 없다**: `scrollTop = scrollHeight` 로는 위젯이 나타나지 않는다. 위젯 부착 전 거대 라인의 추정 높이는 약 7,000,000px 이고 부착 순간 약 24,000~42,000px 로 붕괴하므로, 끝으로 스크롤하면 라인 중간에 착지했다가 붕괴 후 다시 벗어나 진동한다. 신규 e2e 는 `Meta+ArrowDown`(문서 끝으로 커서 이동)으로 CodeMirror 자체 스크롤을 유도해 결정적으로 재현한다. **후속 e2e 작성 시 재사용할 기법.**

### 최종 게이트 (오케스트레이터 직접 실행)

```
npm test          → Test Files 104 passed (104) / Tests 1593 passed (1593), 10.27s
npm run typecheck → exit 0
npm run lint      → exit 0 (--max-warnings 0)
npx playwright test e2e/spec-img-widget-002.spec.ts e2e/spec-img-load-002.spec.ts --retries=0
                  → 4 passed (4.5s)
```

기준선 대비 테스트 수 1579 → 1593 (+14). 픽스처 할당 3배 증가에도 측정 가능한 지연 없음.

### 변경 파일

| 파일 | 변경 | REQ |
|---|---|---|
| `src/components/editor/extensions/image-widget.ts` | `DocView.state.doc.lineAt` 추가, `expandToVisibleLines()` 신설(라인 경계 확장 + 반개구간 교집합 배제 + 정렬·병합), 본문은 `sliceString(line.from, line.to)` 로만 획득 | A-001~A-006 |
| `src/lib/preview/previewLimits.ts` | `LINE_FOLD_THRESHOLD` 3MB, 두 상수 주석에 단위(문자/바이트) 명시 및 "하위 이웃" 서술 교체 | B-001, B-004 |
| `src/test/image-widget.regression.test.ts` | `mockViewWithLineGap` + 계측형 mock 헬퍼, 재현·폴드 가드·엣지 테스트 추가 | C-001, A-002 |
| `src/test/image-widget.test.ts` | mock 5곳 갱신, `:311` 개정(hidden 을 다른 라인으로), `:332` 이름 정정, AC-A-003/A-004/C-003 신설 | A-003, A-004, C-003, C-005 |
| `src/test/imageHandler.test.ts` | 차원 불일치 단언 제거 → `base64Length` 기반 교체, 테스트 이름 정정, AC-B-001 단언 신설 | B-003, B-001 |
| `src/test/longLineFold.test.ts` | `?? 1024 * 1024` 폴백 4곳 정정, AC-B-002 단언 2건 신설 | B-001, B-002 |
| `src/test/previewLimits.test.ts` | `toBe(1 * 1024 * 1024)` → 3MB, 이름·주석 정정 | B-001 |
| `e2e/spec-img-widget-002.spec.ts` (신규) | 위젯 렌더 확인 + 입력 응답 측정(측정값을 콘솔에 남김) | C-004 |

`spec.md` Exclusions 의 파일은 하나도 변경되지 않았다. `long-line-fold.ts` 미변경(읽기 전용 확인). `e2e/spec-img-load-002.spec.ts` 미변경.

### plan.md 와의 편차 (조용히 고르지 않고 명시)

1. **`plan.md` §C 픽스처 할당 표의 사실 오류**: `longLineFold.test.ts` 가 `threshold + 1` 길이 문자열을 4회 생성한다고 적혀 있으나, `mockDoc(lineLengths)` 는 `{from, to, length}` 숫자만 보관하고 문자열을 materialize 하지 않는다. 할당이 실제로 3배가 되는 곳은 `imageHandler.test.ts:396` 한 곳뿐이다. 신규 AC-B-002 단언도 `mockDoc` 기반(할당 0)으로 작성했다.
2. **REQ-C-005 가 지목하지 않은 쌍둥이 테스트**: `image-widget.regression.test.ts:173` 에 `visible + hidden` 을 같은 라인에 두는 동일 형상 테스트가 하나 더 있었고, 이것이 M2 의 유일한 동작 변화 실패였다. 삭제하지 않고 같은 방식으로 개정했다(`spec.md` Traceability 가 이 파일을 C-001/C-005 대상으로 열거하므로 범위 내로 판단).
3. **AC grep 검증의 자기 간섭**: 구 단언을 설명하는 주석에 그 단언 문자열을, `previewLimits.ts` 주석에 '하위 이웃'을 인용하자 음성 grep 이 깨졌다. AC 의 grep 은 내용이 아니라 문자열 존재를 보므로, 단언을 약화시키지 않고 주석 표현만 바꿔 해소했다.
4. **`expandToVisibleLines` 미export**: AC-A-003 이 `buildDecorations` 경유 검증을 요구하므로 공개 표면을 늘리지 않았다.
5. **테스트 헬퍼 중복(DAMP)**: `buildLineIndex`/`instrumentedDoc` 이 두 테스트 파일에 각각 있다. 회귀 가드 파일의 독립 실행성 선언과 `plan.md` §C 에 없는 새 파일 추가 회피를 이유로 공용 추출 대신 중복을 택했다. 되돌리기 쉬운 결정.

### 절차상 기록

- 구현·e2e 는 각각 서브에이전트에 위임했고, 두 에이전트 모두 중첩 워크트리(`agent-*`)에서 작업했다. 변경분은 patch/copy 로 `WT-image-widget-gap` 에 회수한 뒤 중첩 워크트리와 브랜치를 제거했다.
- **함정**: 중첩 워크트리가 제거되기 전에는 vitest 가 그 사본까지 수집해 테스트 파일이 2배(104 → 208)로 잡히고 허위 실패 4건이 발생한다. 제거 후 정상화됐다. 위 최종 게이트 수치는 전부 제거 후 측정값이다.
- `package-lock.json` 의 부수 변경(잠금파일 `version` 필드 0.10.0 → 0.15.0, `peer` 표기 추가)은 본 SPEC 과 무관하므로 되돌렸다.

## §E.3 Run-phase Audit-Ready Signal

- **AC 충족**: 15건 중 자동 검증 가능한 전건이 통과. `UNIT:*` 계열은 `npm test` 1593/1593 에 포함, `E2E:load002`(AC-C-002) 3/3 PASS, AC-C-004 중앙값 286ms / 5,000ms.
- **must-pass 게이트**: AC-C-002(`PT-A1-006b`) PASS — 정지 규칙 미발동. AC-C-003 스캔 문자 수 결정적 단언 PASS.
- **미해결**: 없음. 임계값을 낮추거나 테스트를 삭제해 게이트를 통과시킨 곳은 없다.
- **잔여 위험**: `spec.md` Known Limitations 의 "부분 폴드 영역"(구문 기반 다중 라인 폴드)은 본 SPEC 에서 다루지 않았고 잔여 위험으로 유지된다.
- **sync-phase 인계 사항**: (가) `LINE_FOLD_THRESHOLD` 3MB 는 SPEC-IMG-LOAD-002 OD-1 확정값의 개정이므로 frontmatter `supersedes:` 선언이 이미 있다 — CHANGELOG 에 반영 필요. (나) 신규 e2e 파일 1건 추가. (다) 위 편차 1번(`plan.md` §C 사실 오류)은 문서 정정 후보.

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
