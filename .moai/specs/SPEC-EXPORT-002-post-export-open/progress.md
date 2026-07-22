# SPEC-EXPORT-002 Run Phase Progress

생성: 2026-07-22 (Run phase 착수)
브랜치: `feature/SPEC-EXPORT-002-post-export-open`
방법론: TDD (RED-GREEN-REFACTOR, 브라운필드 Pre-RED 특성화 포함)

---

## T0a / T0b 선행 조건 확인 (랜딩 완료)

- **T0a (ConfirmDialog)**: `src/components/common/ConfirmDialog.tsx` 존재 (SPEC-FS-003 랜딩, commit 5e56451). 계약(DialogActionVariant/DialogAction/ConfirmDialogProps)이 spec.md §4 와 문자 단위 일치 확인. **본 SPEC은 소비만 한다(정의 금지).**
- **T0b (Playwright 가상 FS 픽스처)**: `e2e/fixtures/tauri-mock.ts` 존재 (SPEC-FS-003 T2b). 확장 포인트 `window.__TAURI_MOCK_HANDLERS__` 확인. **본 SPEC은 확장한다(포크 금지).**

---

## T1. 반환값 호출자 감사 (읽기 전용) — 완료

grep 기반 전수 조사(`src/` 전역, 프로덕션 + 테스트 양쪽).

### `exportToHtml` (`src/lib/export/exportHtml.ts:21`, 현 반환 = HTML 문서 문자열)

| 호출 지점 | 분류 | 반환값 사용 여부 |
|-----------|------|------------------|
| `src/components/layout/AppLayout.tsx:132` | 프로덕션 | **await 후 폐기** (할당 없음) |
| `src/test/exportHtml.test.ts:49-50` | 테스트 | `result` 바인딩 — HTML 본문 단언 |
| `src/test/exportHtml.test.ts:67-68` | 테스트 | `result` — 취소 null 단언 |
| `src/test/exportHtml.test.ts:82-83` | 테스트 | `result` — script 부재 단언 |
| `src/test/exportHtml.test.ts:103-104` | 테스트 | `result` — 마크다운 포함 단언 |
| `src/exportHtml.test.ts:120-121` | 테스트 | `result` — dark 테마 단언 |
| `src/test/exportHtml.test.ts:137-138` | 테스트 | `result` — light 테마 단언 |
| `src/test/exportHtml.test.ts:154-155` | 테스트 | await 후 폐기 (다이얼로그 인자 단언) |

→ **프로덕션 호출자 1곳, 반환값 폐기.** 반환값 사용처는 테스트 단언 6건뿐.

### `exportToDocx` (`src/lib/export/exportDocx.ts:45`, 현 반환 = `void`)

| 호출 지점 | 분류 | 반환값 사용 여부 |
|-----------|------|------------------|
| `src/components/layout/AppLayout.tsx:174` | 프로덕션 | await 후 폐기 (void) |
| `src/test/exportDocx.test.ts:87,117,154,187` | 테스트 | 전부 await 후 폐기 (void라 사용 불가) |

→ **프로덕션 호출자 1곳, 폐기. 테스트도 반환값 미사용.**

### `generateHtmlContent` (`src/lib/export/exportHtml.ts:70`, 별도 export)

| 호출 지점 | 분류 |
|-----------|------|
| `src/lib/export/exportPdf.ts:29` | 프로덕션 (PDF 경로) — 반환값 사용 (`htmlContent`) |
| `src/test/exportPdf.test.ts` | 테스트 |

### REQ-019 충돌 검증 (HARD)

`exportPdf.ts:29` 가 호출하는 것은 **`generateHtmlContent`** (exportHtml.ts:70) 이지 **`exportToHtml`** (exportHtml.ts:21) 이 아니다. 따라서 `exportToHtml` 반환 타입/의미 변경은 PDF 경로에 닿지 않는다. **REQ-019 충돌 없음 독립 확인.**

---

## T2. 반환 계약 결정 (REQ-007) — 결정 기록

### 결정: **후보 A (경로만 반환)** 채택

- `exportToHtml`: 시그니처 `Promise<string | null>` 형태 유지, `string` 의미를 **저장 경로**로 변경. `return savePath` (구 `return htmlDocument`). 취소 시 `null` (기존과 동일).
- `exportToDocx`: 시그니처 `Promise<void>` → `Promise<string | null>` 로 확장. 성공 시 `return savePath`, 취소 시 `return null`.

### 결정 근거 (plan.md T2 결정 규칙 적용)

> "T1 감사에서 반환값(HTML 문자열)을 실제로 사용하는 프로덕션 호출자가 하나라도 있으면 후보 A는 조용한 회귀 위험이 있으므로 B를 택한다. 없다면 A가 더 단순하며 테스트 단언 갱신으로 충분하다."

T1 감사 결과:
1. **프로덕션 호출자 0곳이 `exportToHtml` 반환값을 사용** (AppLayout.tsx:132 폐기).
2. `exportToDocx` 반환값은 애초에 `void`라 사용자 자체가 없음.
3. 반환값 사용처는 **테스트 단언 6건뿐** (`exportHtml.test.ts` `result` 바인딩). 이들은 검증 의도를 보존하여 `writeFile` 페이로드 기반으로 갱신한다(HTML 본문이 파일에 쓰여지는지 확인).
4. PDF 경로는 `generateHtmlContent` 분리로 무영향 (REQ-019).

→ 후보 A 의 조용한 회귀 위험(= HTML 문자열 쓰던 프로덕션 호출자가 조용히 잘못된 값 받음)이 **현실적으로 발생할 수 없음이 grep으로 증명되었다.** 따라서 후보 A 안전. 결정 근거는 코드의 `@MX:NOTE` 에도 기록.

### 갱신 대상 (테스트)

- `src/test/exportHtml.test.ts`: 6건 `result` HTML 단언을 `writeFile` 페이로드 단언으로 마이그레이션(검증 의도 보존) + 신규 "성공 시 경로 반환" 단언 추가.
- `src/test/exportDocx.test.ts`: 신규 "성공 시 경로 반환" + "취소 시 null 반환" 단언 추가.

---

## T3. 브라운필드 특성화 기준선 (변경 전)

- **전체 vitest**: 81 파일 / 1216 테스트 통과 (2026-07-22 기준).
- **기존 회귀 가드 2종 무수정 통과 확인**:
  - `src/test/diagramRegressionGuard.test.ts` (3 tests) ✓
  - `src/test/aiDiagramTypeRegressionGuard.test.ts` (4 tests) ✓
- **AppLayout 핸들러 기준선**:
  - `handleExportHtml` (:126-145): try → `await exportToHtml` (폐기) / catch → console.error + window.alert / finally → setExportLoading(false).
  - `handleExportPdf` (:147-166): try → `await exportToPdf` / catch → console.error + alert / finally → loading 해제. **본 SPEC이 한 글자도 건드리지 않음 (REQ-019).**
  - `handleExportDocx` (:168-187): try → `await exportToDocx` (폐기) / catch → alert / finally → loading 해제.
- **PDF 경로 기준선**: `exportPdf.ts` → `generateHtmlContent` (NOT exportToHtml). `printCurrentWindow` (`ipc.ts:123`) → `print_current_window`. 무변경 예정.

---

## 작업 분해 진행 상태 (T1~T8)

| 태스크 | 상태 | 비고 |
|--------|------|------|
| T0a ConfirmDialog | ✅ 선행 랜딩 (FS-003) | 소비만 |
| T0b Playwright 픽스처 | ✅ 선행 랜딩 (FS-003) | 확장 예정 |
| T1 호출자 감사 | ✅ 완료 (본 문서) | 읽기 전용 |
| T2 반환 계약 결정+구현 | 🔄 착수 | 후보 A, 근거 본 문서 + @MX:NOTE |
| T3 Pre-RED 특성화 | ✅ 완료 (본 문서) | 기준선 1216 tests green |
| T4 opener IPC 래퍼 | ⏳ 대기 | `openPath` / `revealItemInDir` 래핑 |
| T5 capability 권한 | ⏳ 대기 | `opener:allow-reveal-item-in-dir` 추가 (수동 검증 항목) |
| T6 완료 모달 상태+라우팅 | ⏳ 대기 | AppLayout 단일 슬롯 + handleExportDialogAction |
| T7 정적 회귀 가드 | ⏳ 대기 | 신규 exportOpenRegressionGuard.test.ts |
| T8 E2E + 품질 게이트 | ⏳ 대기 | 픽스처 확장 + Playwright + 4종 게이트 |

---

## 수동 검증 항목 (자동화 한계 밖)

- **T5 reveal 권한 충분성** (spec.md A3, 신뢰도 Medium): `opener:allow-reveal-item-in-dir` 추가만으로 permission denied 없이 동작하는지 실제 앱(`tauri dev`)에서 확인 불가 → **수동 검증 항목으로 기록.** 실패 시 추가 permission/scope 식별 필요.
- **크로스플랫폼 스모크 S1~S4** (acceptance.md): open/reveal 의 실제 OS 앱 실행은 Playwright 관측 범위 밖. macOS/Windows/Linux 에서 수동 확인 필요.
