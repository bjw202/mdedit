---
id: SPEC-EXPORT-002
version: "0.0.2"
status: planned
created: "2026-07-22"
updated: "2026-07-22"
author: "jw"
priority: medium
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.1 | 2026-07-22 | jw | Run-entry plan 최초 작성 — 선행 조건 체인을 T0(SPEC-FS-003 랜딩) → T1(호출자 감사) → T2(반환 계약 결정) 순으로 명시. 반환 형태(path-only vs 객체)는 본 plan이 결정하지 않으며 호출자 감사 결과를 입력으로 하는 Run phase 결정 사항으로 남긴다. 개발 방법론 = TDD. 브랜치 = `feature/SPEC-EXPORT-002-post-export-open`. |
| 0.0.2 | 2026-07-22 | jw | plan-auditor 리뷰 반영, spec.md v0.0.2와 정합 재번호(REQ-001~021). 주요 변경: **(a)** 선행 체인에 **T0b(Playwright 가상 FS 픽스처)** 추가 — Playwright에는 Tauri 런타임이 없어 스텁 없이는 완료 모달이 절대 뜨지 않는다. SPEC-FS-003 산출 픽스처를 **확장**한다(포크 금지). **(b)** `actions` 배열 순서 근거 정정 — 구 문구는 FS-003 관례를 "안전한 선택지를 마지막에"로 서술했으나 본 SPEC은 **부수효과 있는 `열기`를 마지막에** 둔다. 실제 규칙은 "마지막 항목 = primary + 초기 포커스, 어느 액션이 그 자리를 가질지는 각 SPEC이 결정"이다. **(c)** 구 T7 회귀 가드 축소 — `Command` spawn 금지·`browser_ops.rs` 무변경은 vitest로 단언 불가(baseline 부재, `git diff` 속성)하므로 코드 리뷰 항목으로 강등. **(d)** 의존성 가드의 실제 강도 반영 — devDependencies는 가드가 고정하지 않는다(리스크 #9 신설). **(e)** T2에 감사 결과 예비 신호(후보 A 안전, 독립 검증됨) 기록, 단 T1은 필수 유지. **(f)** 앵커 정정(`capabilities/main.json:11`, `Cargo.toml:25`, `ipc.ts:16-186`), PDF 메커니즘 정정(`WebviewWindow::print()` 네이티브 호출). **(g)** 모달 단일 슬롯 덮어쓰기 시맨틱을 T6에 명시. |

## Overview

HTML/DOCX 내보내기가 **실제로 파일 쓰기까지 성공**했을 때, 저장 경로를 표시하고 3개 액션(`닫기` / `폴더에서 보기` / `열기`)을 제공하는 완료 모달을 띄운다. 취소·실패 시에는 표시하지 않는다. PDF는 명시적 비목표다(후속: `SPEC-EXPORT-003` 예약).

본 SPEC은 **신규 기능 추가가 아니라 기존 내보내기 파이프라인의 종료 지점에 피드백을 붙이는 최소 침습 변경**이다. 다만 그 최소 침습을 가능하게 하려면 **반환 계약 변경이 선행되어야 하며, 이것이 본 SPEC의 유일한 실질적 리스크**다(§ Prerequisite Chain).

- 개발 방법론: **TDD** (`quality.yaml` `development_mode: tdd`, RED-GREEN-REFACTOR, 브라운필드 Pre-RED 특성화 포함)
- 브랜치: `feature/SPEC-EXPORT-002-post-export-open` (`/moai run` 단계에서 생성)
- 신규 런타임 의존성: **없음** (`tauri-plugin-opener` v2 기설치·기등록)
- 요구/수용 기준: spec.md REQ-EXPORT-002-001~021, acceptance.md AC-EXPORT-002-001~014 (본 plan은 이를 구현 관점으로 분해하며 요구사항 자체를 변경하지 않는다)

## Confirmed Design Decisions (사용자 승인, 재검토 금지)

1. **대상 포맷 = HTML·DOCX 한정.** PDF는 명시적 비목표 — `print_current_window`(`file_ops.rs:184-187`)가 **Rust `WebviewWindow::print()` 네이티브 인쇄 API**를 호출하며(JavaScript `window.print()`가 아니다 — `exportPdf.ts:22-23` 주석이 이를 명시적으로 반박한다), OS 인쇄 다이얼로그가 출력 경로를 소유한다. 게다가 print IPC는 다이얼로그가 닫히기 전에 반환되므로(`exportPdf.ts:24`) 신뢰할 수 있는 성공 신호조차 없다.
2. **액션 3종 고정** = `cancel`(`닫기`) / `reveal`(`폴더에서 보기`) / `open`(`열기`, `variant: 'primary'`). 좌→우 순서 고정. Escape·백드롭은 `cancel`과 동일.
3. **다이얼로그 셸은 SPEC-FS-003 소유 `ConfirmDialog`를 소비만 한다.** 본 SPEC 전용 모달 컴포넌트 신설 금지.
4. **opener 플러그인 사용** — 기설치·기등록(`src-tauri/Cargo.toml:25`, `package.json`, `src-tauri/src/lib.rs:17`).
5. **신규 npm/Cargo 의존성 0건.**
6. **`capabilities/main.json`에 `opener:allow-reveal-item-in-dir` 추가** — 현재 `opener:default`(`:11`)만 존재.
7. **실패 알림은 기존 `window.alert` 유지** — 토스트 시스템 미도입.
8. **초기 포커스는 `열기`.** 사용자가 직접 내보내기를 실행하고 저장 위치까지 골랐으므로 여는 것이 기대되는 다음 행동이며 파괴적이지 않다(REQ-005).

## Prerequisite Chain (선행 조건 체인) [HARD]

아래 순서는 **엄격한 선행 관계**다. 앞 항목이 해소되지 않으면 뒤 항목을 착수할 수 없다.

```
T0a. SPEC-FS-003 랜딩 (ConfirmDialog 존재)        ← 외부 의존
T0b. SPEC-FS-003 Playwright 가상 FS 픽스처 확보    ← 외부 의존 (E2E 전제)
        ▼
T1. exportToHtml / exportToDocx 호출자 감사 (읽기 전용)
        │  ※ 반환 형태를 고르기 전에 "무엇이 깨지는가"를 먼저 확정
        ▼
T2. 반환 계약 결정 + 구현 (REQ-007)
        │  ※ 이것 없이는 모달에 넘길 경로 자체가 존재하지 않음
        ▼
T3~T8. 나머지 전 요구사항
```

### T0a. SPEC-FS-003 `ConfirmDialog` 선행 랜딩 [외부 의존]

- **SPEC-FS-003이 `src/components/common/ConfirmDialog.tsx`를 먼저 랜딩해야 한다.** Plan phase 확인 결과 **`src/components/common/` 디렉터리는 아직 존재하지 않는다.**
- **계약은 FROZEN이다.** spec.md § 4의 `ConfirmDialogProps` 정의를 그대로 신뢰한다. `checkbox` prop은 **양 SPEC 통틀어 소비자가 0이었으므로 계약에서 삭제되었다.**
- **`actions` 배열 순서 규칙 — 실제 규칙**: 계약이 규정하는 것은 "**마지막 항목이 primary이며 초기 포커스를 받는다**"이다. **어느 액션이 그 자리를 차지할지는 각 소비자 SPEC이 스스로 결정한다.** SPEC-FS-003의 워처 모달은 파괴적 선택지를 포함하므로 안전한 쪽을 마지막에 두지만, 본 SPEC은 **부수효과가 있는 `열기`를 마지막에 둔다**(사용자 결정, § Confirmed Design Decisions 8). 두 SPEC의 배치가 다른 것은 모순이 아니라 동일 규칙의 서로 다른 적용이다. **본 SPEC의 배열 순서를 바꾸지 말 것.**
- **순서 역전 시 폴백**: spec.md § 4 "Dependency Ordering" 폴백을 따른다 — 계약 그대로 최소 구현 + `// @MX:NOTE: 계약 소유 SPEC = SPEC-FS-003` 헤더 주석. 어느 순서든 **ConfirmDialog는 정확히 하나만 존재**해야 한다.
- **재동기화**: SPEC-FS-003이 계약 세부(`'danger'` variant의 마지막 항목 배치 규칙, 미사용 `'default'` variant 처리, `'cancel'` 매직 id 불변식)를 확정 보고하면 spec.md § 4 사본을 즉시 갱신해 문자 단위 동일성을 유지한다.
- Done: `src/components/common/ConfirmDialog.tsx`가 존재하고 spec.md § 4 계약과 문자 단위로 일치한다.

### T0b. Playwright 가상 FS 모킹 픽스처 확보 [외부 의존, E2E 전제]

- **Playwright 환경에는 Tauri 런타임이 없다.** `playwright.config.ts`는 webkit 프로젝트로 **Vite dev 서버**(`baseURL: 'http://localhost:1420'`)에 대해 실행된다 — Tauri 앱 바이너리가 아니다. 스텁 없이는 `exportSaveDialog`(`ipc.ts:104`)의 `invoke`가 reject되고, 흐름은 `AppLayout`의 `catch`로 떨어져 `alert`만 뜨며 **완료 모달은 절대 나타나지 않는다.** 즉 E2E 시나리오는 픽스처 없이 0건 실행 가능하다.
- **SPEC-FS-003이 동일 사유로 가상 FS 모킹 픽스처를 명시적 산출물로 만들고 있다**(자체 E2E 6건 중 5건이 같은 이유로 실행 불가였음).
- **[HARD] 그 픽스처를 확장한다. 포크하지 않는다.** 본 SPEC이 추가할 스텁: `export_save_dialog`, `write_file`, `write_binary_file`, opener open-path / reveal-item-in-dir.
- 픽스처를 사용할 수 없으면 E2E를 포기하고 컴포넌트 테스트로 커버한 뒤 **미검증 항목으로 명시적으로 남긴다**(조용히 넘어가지 않는다).
- Done: 픽스처가 존재하고 본 SPEC의 스텁이 추가되어 최소 1개 E2E 시나리오가 실행 가능하다.

### T1. [Pre-RED, 읽기 전용] 반환값 호출자 감사 — 결정의 입력 [HARD]

> **반환 형태를 제안하기 전에 반드시 먼저 수행한다.** 감사 없이 반환 형태를 고르면 조용한 회귀가 발생한다.

- **문제**: 두 함수 모두 저장 경로를 호출자에게 넘기지 않는다.
  - `exportToHtml`: `Promise<string | null>` — 이 `string`은 **저장 경로가 아니라 `buildHtmlDocument`가 만든 HTML 문서 문자열**이다(`exportHtml.ts:21` 시그니처, `:59` `return htmlDocument`). 이름만 보고 경로로 오인하기 쉬운 함정이다.
  - `exportToDocx`: `Promise<void>`(`exportDocx.ts:45`) — 반환값 자체가 없다.
- **수행할 감사(Run phase 필수 착수 작업)**:
  1. `exportToHtml` / `exportToDocx` / `generateHtmlContent`의 **모든 호출 지점**을 grep한다(`src/` 전역, 프로덕션 코드 + 테스트 코드 **양쪽**).
  2. 각 호출 지점을 두 부류로 분류한다: **반환값을 사용하는 곳** vs **`await`만 하고 버리는 곳**.
  3. 반환값을 사용하는 곳 각각에 대해 **"반환 형태를 바꾸면 구체적으로 무엇이 깨지는가"를 명시적으로 기술한다**(타입 에러인지, 런타임 동작 변화인지, 테스트 단언 실패인지).
  4. `exportPdf.ts`가 `exportToHtml`이 아니라 `generateHtmlContent`(`exportHtml.ts:70`)를 쓰는지 확인한다 — 만약 `exportToHtml`을 쓴다면 REQ-019(PDF 무변경)와 충돌하므로 **즉시 에스컬레이션**한다.
- Done: 호출자 목록 + "무엇이 깨지는가" 기술이 완료되어 T2의 입력으로 존재한다.

### T2. [RED→GREEN] 반환 계약 결정 및 구현 (REQ-007) — 하드 선행 조건

> **결정 권한은 Run phase에 있다. 본 plan은 반환 형태를 고르지 않는다.** 아래는 트레이드오프 제시일 뿐이며, T1 감사 결과를 입력으로 결정한다.

| 후보 | 장점 | 단점 |
|------|------|------|
| **A. 경로만 반환** (`Promise<string \| null>`, `string` = 저장 경로) | 시그니처 형태 유지(타입만 의미 변경). `exportToDocx`와 동형이 되어 두 함수 계약이 통일됨. 호출부가 단순 | **타입은 그대로인데 의미가 바뀌는 조용한 파괴** — 컴파일러가 잡아주지 않는다. HTML 문서 문자열을 쓰던 곳이 있으면 런타임에 조용히 잘못된 값을 받는다 |
| **B. 객체 반환** (`Promise<{ path: string; html: string } \| null>` 등) | 기존 소비자와 신규 소비자를 **둘 다** 만족. 타입이 바뀌므로 모든 호출 지점을 컴파일러가 강제로 드러냄(조용한 회귀 불가) | 호출부 전부 수정 필요. `exportToDocx`는 `html`에 해당하는 것이 없어 두 함수 형태가 비대칭이 될 수 있음 |

- **결정 규칙**: T1 감사에서 반환값(HTML 문자열)을 **실제로 사용하는 프로덕션 호출자가 하나라도 있으면** 후보 A는 조용한 회귀 위험이 있으므로 B 또는 그 변형을 택한다. 없다면(테스트 단언만 존재) A가 더 단순하며 테스트 단언 갱신으로 충분하다. 어느 쪽이든 **결정 근거를 커밋 메시지 또는 `@MX:NOTE`에 남긴다.**
- **예비 신호(강함, 단 T1을 대체하지 않음)**: plan phase 조사와 이후의 독립적인 plan-auditor 검증이 일치했다 — 프로덕션 호출자는 `AppLayout.tsx:146`·`:188` 정확히 두 곳이며 **둘 다 반환값을 버린다**. 반환값 단언은 `src/test/exportHtml.test.ts`의 `result` 바인딩 6곳(`:50`, `:68`, `:83`, `:104`, `:121`, `:138`)이 전부다. `exportPdf.ts:29`는 `generateHtmlContent`(별도 export, `exportHtml.ts:70`)를 사용하므로 `exportToHtml`의 반환 타입 변경이 PDF 경로에 닿을 수 없다 — **REQ-019 충돌 없음이 독립 확인되었다.** 위 결정 규칙에 따르면 **후보 A가 안전**하다. 그럼에도 T1은 **필수 단계로 유지한다**(문서가 T2를 선결정하지 않는다).
- 공통 요구(후보와 무관): 저장 다이얼로그 취소 시(`exportHtml.ts:29-31`, `exportDocx.ts:50-52`) **성공과 구분 가능한 값**(`null`)을 반환한다(REQ-007, REQ-017).
- 파일: `src/lib/export/exportHtml.ts`, `src/lib/export/exportDocx.ts`, `src/lib/export/types.ts`. **`generateHtmlContent`(`:70`)는 건드리지 않는다.**
- @MX: 두 함수에 `@MX:NOTE`(반환 의미 = 저장 경로임을 명시, 과거 HTML 문자열 반환에서 변경된 이력) + `@MX:SPEC: SPEC-EXPORT-002`.
- 테스트(RED first): `src/test/exportHtml.test.ts` / `src/test/exportDocx.test.ts` 확장 — 저장 성공 시 경로 반환, 취소 시 `null` 반환. 기존 6개 `result` 단언은 삭제가 아니라 **갱신**한다(기존 검증 의도를 보존할 것).
- 매핑: REQ-007/017, AC-001/002/009.

## Task Decomposition (T3 이후)

T0~T2 완료 후 착수한다. TDD 순서(RED → GREEN → REFACTOR)를 따르며, 브라운필드 영역(`AppLayout` 내보내기 핸들러)은 Pre-RED 특성화로 기존 동작을 고정한 뒤 확장한다.

### T3. [Pre-RED] 브라운필드 특성화 — 내보내기 핸들러 기존 동작 고정

- 목적: `handleExportHtml`/`handleExportPdf`/`handleExportDocx`의 기존 동작을 회귀 기준선으로 고정한다(REQ-018/019 방어).
- 확인 대상:
  - `AppLayout.tsx:140-159`·`:161-180`·`:182-201` — 예외 시 `console.error` + `window.alert` + `finally` 로딩 해제 경로가 현재 통과함을 확인/보강.
  - PDF 경로가 `printCurrentWindow`(`ipc.ts:123`)를 호출하고 그 외 아무것도 하지 않음을 고정(REQ-019 기준선).
  - 기존 회귀 가드 2종(`diagramRegressionGuard.test.ts:19-43`, `aiDiagramTypeRegressionGuard.test.ts:45-55`)이 green임을 확인 — 이들은 **수정 금지 대상**이다.
- Done: 변경 전 전체 vitest green, 위 기준선이 명시적으로 존재.

### T4. [RED→GREEN] opener IPC 래퍼 — `src/lib/tauri/ipc.ts`

- `@tauri-apps/plugin-opener`의 open-path / reveal-item-in-dir API를 감싸는 래퍼 2종을 추가한다. 기존 얇은 래퍼 관례(`ipc.ts:16-186` 구간)를 따른다.
- **주의**: 기존 래퍼는 전부 `invoke<T>('command', args)` 형태지만, opener는 **플러그인이 제공하는 JS 함수를 호출**한다(신규 Tauri command 금지 — REQ-021). 래퍼 계층에 두는 이유는 컴포넌트가 플러그인 API를 직접 import하지 않게 하여 테스트 모킹 지점을 한 곳으로 모으기 위함이다(REQ-006).
- @MX: 두 래퍼에 `@MX:NOTE`(opener 플러그인 사용 근거 = capability ACL 통제 + 크로스플랫폼 reveal 정확성) + `@MX:SPEC: SPEC-EXPORT-002`.
- 테스트(RED first, 신규 `src/test/openerIpc.test.ts`): 플러그인 모듈을 모킹하고, 각 래퍼가 **올바른 플러그인 API를 올바른 경로 인자로 정확히 1회** 호출하는지 단언.
- 매핑: REQ-006/011/012, AC-005/006.

### T5. [GREEN] capability 권한 추가 — `src-tauri/capabilities/main.json`

- permissions 배열에 `opener:allow-reveal-item-in-dir`를 추가한다. **현재 `:11`이 `opener:default`이며 `:12`는 `shell:allow-execute`다 — 줄 번호 혼동 금지.**
- **[Run phase 검증 항목 — 추측 금지]** `opener:allow-reveal-item-in-dir` 추가**만으로** reveal이 동작하는지, 아니면 추가 scope 항목이 필요한지는 **plan phase에서 확정하지 못했다**(spec.md A3, 신뢰도 Medium). **실제 앱을 띄워 reveal을 호출해 확인한다.** permission denied가 발생하면 필요한 permission/scope 항목을 식별해 추가하고 그 결과를 spec.md A3에 반영한다. **문서만 보고 추측해서 넘어가지 말 것.**
- 실패해도 REQ-014 경로(alert)로 노출되므로 앱이 죽지는 않으나, 기능 자체가 미동작이므로 **AC-006 통과의 전제**다.
- 매핑: REQ-008, AC-013.

### T6. [RED→GREEN→REFACTOR] 완료 모달 상태 + 액션 라우팅 — `src/components/layout/AppLayout.tsx`

- 상태: **단일 경로 슬롯**(예: `exportedPath: string | null`). 경로가 있으면 열림으로 파생 가능(Run phase 재량).
- **연속 내보내기 시맨틱(REQ-016)**: 모달이 이미 열린 상태에서 또 다른 내보내기 성공이 도달하면 슬롯을 **최신 경로로 덮어쓴다.** 큐잉·모달 중첩을 하지 않는다. 실무상 REQ-015의 상호작용 차단(modal) 때문에 트리거하기 어렵지만, 그 방어는 **우연이 아니라 명세된 것**이어야 한다.
- 배선: `handleExportHtml`(`:140-159`)·`handleExportDocx`(`:182-201`)의 `try` 블록에서 T2 반환값이 non-null일 때만 슬롯을 설정한다. **`catch` 블록에서는 절대 설정하지 않는다**(REQ-018). `finally`의 로딩 해제는 유지하되, 모달 표시가 로딩 해제 이후가 되도록 한다(REQ-015).
- `handleExportPdf`(`:161-180`)는 **한 글자도 건드리지 않는다**(REQ-019).
- 렌더: `<ConfirmDialog open={...} title="내보내기 완료" message={...경로 포함...} actions={[cancel, reveal, open]} onAction={handleExportDialogAction} />`.
- `onAction` 라우팅: `'open'` → open 래퍼, `'reveal'` → reveal 래퍼, `'cancel'` → 아무 호출 없이 닫기. open/reveal은 `catch`로 감싸 실패 시 `window.alert` + 모달 닫힘(REQ-014), 예외 미전파.
- @MX: `handleExportDialogAction`에 `@MX:NOTE`(액션 id 라우팅 + `cancel` 부수효과 0 + PDF 비대상 근거 + 단일 슬롯 덮어쓰기 규칙) + `@MX:SPEC: SPEC-EXPORT-002`.
- 테스트(RED first, 신규 `src/test/ExportCompletionDialog.test.tsx`, opener 래퍼 모킹): acceptance.md AC-001~012 전 시나리오.
- 매핑: REQ-002/003/004/005/009/010/011/012/013/014/015/016/018/019, AC-001~012.

### T7. [GREEN] 정적 회귀 가드 — 신규 `src/test/exportOpenRegressionGuard.test.ts`

가드에는 **실제로 증명할 수 있는 것만** 넣는다:

- `src-tauri/capabilities/main.json` 파싱 → permissions에 `opener:allow-reveal-item-in-dir` 포함 + 기존 항목 미제거(REQ-008).
- `src-tauri/src/lib.rs` `invoke_handler` 등록 목록 파싱 → 본 SPEC 관련 신규 command 0건(REQ-021).
- 리포지토리 스캔 → 완료 모달 용도의 별도 다이얼로그 컴포넌트가 존재하지 않음(REQ-001 부정절).
- **의존성(REQ-020)은 새 가드를 만들지 않는다.** 기존 가드 2종이 `dependencies`·Cargo 배열을 `toEqual`로 고정한다. **기존 가드를 수정해서 통과시키지 말 것** — 수정이 필요하다면 그것이 REQ-020 위반 신호다.
- **가드에 넣지 않는 것(넣을 수 없는 것)**: `browser_ops.rs` 무변경, PDF 관련 파일 무변경, `src-tauri/` 변경 1건 한정, devDependencies 무변경. 이들은 baseline hash가 없어 vitest로 단언 불가하며 **`git diff` 속성**이다. 코드 리뷰 체크리스트로 처리한다(spec.md § 3 리뷰 노트, § 7 계층 표의 "코드 리뷰(diff)" 행).
- 매핑: REQ-001/008/021, AC-003/013/014.

### T8. [GREEN] E2E + 품질 게이트

- Playwright(T0b 픽스처 전제): 내보내기 → 모달 가시성 → 배경 UI 입력 차단(REQ-015) → `닫기` 시 모달 소멸. **open/reveal은 IPC 경계 모킹으로 invoke payload 단언까지만** — 실제 OS 앱 실행은 Playwright 관측 범위 밖이다(acceptance.md § 검증 불가 경계).
- 게이트: `npm run typecheck` 클린 → `npm test` 전체 통과 → `npm run lint` 통과 → `npm run test:e2e` 통과.
- 매핑: Quality Gate Criteria.

### 실행 순서 및 의존성

```
T0a (ConfirmDialog, 외부) ──────────────────┐
T1 (호출자 감사, 읽기 전용) → T2 (반환 계약) ─┼→ T6 (모달+라우팅) ─┐
T3 (Pre-RED 특성화) ────────────────────────┤                     ├→ T8 (E2E+게이트)
T4 (opener 래퍼) ───────────────────────────┤                     │
T5 (capability) ────────────────────────────┘                     │
T7 (정적 가드) — T5 이후 언제든                                     │
T0b (E2E 픽스처, 외부) ───────────────────────────────────────────┘
```

우선순위: **T0a → T1 → T2**(하드 체인, 순서 고정) > T3(기준선) > T4·T5(병행 가능) > T6(통합) > T7 > T8(T0b 필요).
T1/T3은 읽기 전용이므로 T0a 대기 중에도 착수 가능하다. T4·T5는 T0a/T2와 독립적으로 병행 가능하다. T0b는 T8에만 영향을 주므로 늦게 해소되어도 T1~T7을 막지 않는다.

## Risk Analysis & Mitigation

| # | 리스크 | 영향 | 완화 |
|---|--------|------|------|
| 1 | **반환 계약 변경(최우선)** — `exportToHtml`이 HTML 문자열을 반환하는데(`exportHtml.ts:59`) 시그니처가 `string \| null`이라 경로로 오인하기 쉽다. 형태를 잘못 고르면 타입 에러 없이 조용히 깨진다 | 기존 소비자 런타임 회귀, 테스트 단언 실패 | **T1 호출자 감사를 T2 결정보다 먼저 강제**. 사용 중인 프로덕션 호출자가 있으면 타입이 바뀌는 후보(B)를 택해 컴파일러가 전부 드러내게 함. 결정 근거를 `@MX:NOTE`에 기록. 예비 신호는 후보 A 안전을 시사(독립 검증됨) |
| 2 | **SPEC-FS-003 미랜딩** — `src/components/common/`이 아직 없음(확인 완료) | 본 SPEC Run phase 착수 불가 | T0a를 하드 선행 조건으로 명시. 순서 역전 시 spec.md § 4 폴백. ConfirmDialog 중복 생성 절대 금지 |
| 3 | **reveal 권한 불충분 가능성** — `opener:allow-reveal-item-in-dir`만으로 충분한지 미확정(spec.md A3, Medium) | reveal 기능 미동작 | T5에서 **실제 앱 실행 검증을 필수 작업으로 지정**. 추측 금지. 실패 시 필요한 permission/scope를 식별해 추가하고 spec.md A3 갱신 |
| 4 | **PDF 경로 오염** — 세 핸들러가 구조적으로 유사해 복사·붙여넣기 중 `handleExportPdf`에도 모달이 붙을 위험 | REQ-019 위반, 존재하지 않는 경로로 open 호출 | T3에서 PDF 경로 기준선 고정 + AC-011 전용 테스트. `handleExportPdf`(`:161-180`)·`exportPdf.ts`는 diff에 나타나서는 안 됨(코드 리뷰) |
| 5 | **의존성 가드 오수정** — 가드 테스트가 실패했을 때 가드를 고쳐서 통과시키는 유혹 | REQ-020 위반, 번들 증가 | T7에 명시: 기존 가드 2종은 **수정 금지**. 실패는 결함 신호로 취급 |
| 6 | **`browser_ops.rs` 재사용 유혹** — 이미 `Command` spawn 방식이 있어 "한 줄 추가"가 쉬워 보임 | ACL 우회 + Linux reveal 취약 | T4 `@MX:NOTE`에 opener 선택 근거 명기. 단 **가드 테스트로 강제하지 않는다**(파일 무변경은 vitest가 단언할 수 없다) — 코드 리뷰 항목. REQ-006/021이 구조적으로 이미 차단한다 |
| 7 | **모달과 로딩 스피너 동시 표시** — `finally` 로딩 해제와 모달 표시의 순서 | UI 깜빡임/중첩 | REQ-015를 AC-012로 검증. 모달 표시를 로딩 해제 이후로 배치 |
| 8 | **E2E가 Tauri 런타임 없이 실행됨** — 스텁 없으면 완료 모달 시나리오 0건 실행 가능 | 검증 공백 | T0b에서 SPEC-FS-003 픽스처 확장을 전제로 명시. 픽스처 미확보 시 E2E 포기 + **미검증 항목으로 명시적 기록**(조용히 넘어가지 않음) |
| 9 | **devDependencies 무방비** — 가드가 devDeps 배열을 고정하지 않는데(`:45-47`의 부재 단언 2건뿐) 본 SPEC은 테스트 파일 3개를 추가한다 | REQ-020을 CI green 상태로 위반 가능 | spec.md § 3에 검증 강도 표를 명시. AC-013이 devDeps는 **diff 리뷰** 항목임을 분명히 함. 실제로 vitest·@testing-library·Playwright 모두 기설치되어 추가가 불필요하다 |

## MX Tag Plan

`code_comments = ko`(`language.yaml`).

| 위치 | 태그 | 사유 |
|------|------|------|
| `exportHtml.ts` `exportToHtml` / `exportDocx.ts` `exportToDocx` | `@MX:NOTE` + `@MX:SPEC: SPEC-EXPORT-002` | 반환 의미 = 저장 경로임을 명시(과거 HTML 문자열 반환에서 변경). 취소 시 `null` 규약. T2 결정 근거 기록 |
| `ipc.ts` opener 래퍼 2종 | `@MX:NOTE` + `@MX:SPEC: SPEC-EXPORT-002` | opener 플러그인 선택 근거(capability ACL 통제 + 크로스플랫폼 reveal 정확성) |
| `AppLayout.tsx` `handleExportDialogAction` | `@MX:NOTE` + `@MX:SPEC: SPEC-EXPORT-002` | 액션 id 라우팅, `cancel` 부수효과 0, PDF 비대상 근거, 단일 슬롯 덮어쓰기 규칙 |
| `exportHtml.ts` `generateHtmlContent` / `AppLayout.tsx` `handleExportPdf` | (무변경) | 기존 태그 유지. 본 SPEC은 이 둘을 건드리지 않는다 |

## Exclusions (Non-Goals)

spec.md § 10 "Exclusions (What NOT to Build)"와 동일 — 요약: PDF 완료 모달 없음(의도된 비목표, 후속 `SPEC-EXPORT-003` 예약), `ConfirmDialog` 정의 없음(SPEC-FS-003 소유), 가상 FS 픽스처 신규 작성 없음(확장만), 토스트/스낵바 없음, "다시 묻지 않기" 설정 없음, 자동 열기 없음, 신규 npm/Cargo 의존성 없음, 신규 Tauri command 없음, `browser_ops.rs` 변경 없음, 내보내기 파이프라인 로직 변경 없음(반환 계약만), 모달 큐잉/중첩 없음, 내보내기 이력 UI 없음.

## Quality Gates (TDD)

- RED-GREEN-REFACTOR 준수, 테스트 선행 필수(`test_first_required: true`). 브라운필드 영역(AppLayout 핸들러, export 반환 계약)은 Pre-RED 특성화 선행.
- `npm run typecheck`(`tsc --noEmit`) 클린 · `npm test`(vitest) 전체 통과 · `npm run lint`(eslint) 통과 · `npm run test:e2e`(Playwright) 통과.
- **기존 회귀 가드 2종(`diagramRegressionGuard.test.ts`, `aiDiagramTypeRegressionGuard.test.ts`) 무수정 통과가 필수다.** 수정하여 통과시키는 것은 REQ-020 위반이다.
- **코드 리뷰(diff) 체크리스트 — 자동 검증 불가 항목**: PDF 관련 파일(`exportPdf.ts`, `handleExportPdf`) 미변경, `browser_ops.rs` 미변경, `src-tauri/` 변경이 `capabilities/main.json` 1건 한정, `package.json` devDependencies 미변경.
- 커밋당 커버리지 80%+, 전체 목표 85%.
- LSP run 게이트: errors 0 / type errors 0 / lint errors 0.

## Related Documents

- `spec.md` — EARS 요구사항(REQ-EXPORT-002-001~021) + ConfirmDialog 소비 계약 + Test Strategy + Delta + Traceability
- `acceptance.md` — Given-When-Then 시나리오(AC-EXPORT-002-001~014) + 수동 크로스플랫폼 스모크 + Quality Gate Criteria + Definition of Done
- 선행 SPEC: `.moai/specs/SPEC-FS-003-unsaved-changes-guard/` (ConfirmDialog + Playwright 가상 FS 픽스처 소유)
- 기반 SPEC: `.moai/specs/SPEC-EXPORT-001/spec.md` (내보내기 파이프라인)
- 후속 SPEC(예약): `SPEC-EXPORT-003` (PDF 완료 모달 — 앱이 경로를 소유하는 PDF 생성 경로 전환이 선행)
- 형식 선례: `.moai/specs/SPEC-UI-008-diagram-insert-menu/{plan,acceptance}.md`
