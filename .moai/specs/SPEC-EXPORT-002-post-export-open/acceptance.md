---
id: SPEC-EXPORT-002
version: "0.0.2"
status: draft
created: "2026-07-22"
updated: "2026-07-22"
author: "jw"
priority: medium
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.1 | 2026-07-22 | jw | 최초 acceptance 작성 — Given-When-Then 시나리오 14건 + 수동 크로스플랫폼 스모크 + 품질 게이트. spec.md의 dangling `acceptance.md` 참조 해소. 검증 불가 경계(외부 OS 앱 실행) 명시. |
| 0.0.2 | 2026-07-22 | jw | plan-auditor 리뷰 반영, spec.md v0.0.2(REQ-001~021)와 재정합. 주요 변경: **(a)** `checkbox` prop이 계약에서 삭제되어 "미전달" 단언을 제거(부인할 대상이 사라짐). **(b)** AC-013의 의존성 주장 정정 — 인용한 가드는 `pkg.dependencies`와 Cargo 크레이트만 `toEqual`로 고정하며 **devDependencies는 고정하지 않는다**(부재 단언 2건이 전부). devDeps는 diff 리뷰 항목으로 분리. **(c)** 구 AC-012의 editor/file 상태 불변 절 삭제(공허하게 참) — 실제 상호작용인 배경 입력 차단 + 로딩 해제 + 연속 내보내기 단일 슬롯으로 대체. **(d)** 구 AC-014에서 "`browser_ops.rs` 무변경"·"`src-tauri/` 1건 한정" 자동 단언을 제거하고 diff 리뷰로 이관(vitest가 단언 불가). **(e)** AC-003에 `title` 문자열·초기 포커스·리포지토리 스캔 추가. **(f)** 검증 불가 경계 (2) 신설 — Playwright에 Tauri 런타임이 없어 스텁 없이는 모달이 뜨지 않는다. SPEC-FS-003 픽스처 확장이 E2E 전제. **(g)** PDF 메커니즘 정정(`WebviewWindow::print()` 네이티브 호출). |

# Acceptance Criteria — SPEC-EXPORT-002 (내보내기 완료 모달 — 열기 / 폴더에서 보기)

검증 방식: **단위/컴포넌트 테스트 중심** — vitest + @testing-library/react(모달 렌더·액션 라우팅) + 모듈 모킹(opener 래퍼, `ipc` 모듈) + 정적 파일 파싱/리포지토리 스캔(회귀 가드). Playwright E2E는 모달 가시성·배경 차단·닫힘 흐름과 **IPC payload 단언**까지만 담당한다.

## 검증 불가 경계 [중요]

### (1) 외부 OS 애플리케이션의 실제 실행

Playwright는 앱 webview 내부만 관측하며, Finder / 탐색기 / Preview / Word가 떴는지는 관측 범위 밖이다.

- **검증 대상**: "앱이 `<정확한 저장 경로>`를 인자로 opener 래퍼를 정확히 1회 호출했다" — IPC 경계를 모킹하고 payload를 단언한다.
- **검증 대상 아님**: "OS가 실제로 파일을 열었다 / 폴더를 띄웠다" — 이 경계 아래는 `tauri-plugin-opener`의 책임이다.
- 실제 OS 동작은 § 수동 크로스플랫폼 스모크로 분리하여 **추적 가능한 미검증 항목**으로 남긴다.

### (2) Playwright 환경에는 Tauri 런타임이 없다

`playwright.config.ts`는 webkit 프로젝트로 **Vite dev 서버**(`baseURL: 'http://localhost:1420'`)에 대해 실행된다 — Tauri 앱 바이너리가 아니다. 스텁이 없으면 `exportSaveDialog`(`ipc.ts:104`)의 `invoke`가 reject되고, 흐름은 `AppLayout`의 `catch`로 떨어져 `alert`만 뜨며 **완료 모달은 절대 나타나지 않는다.** 즉 **E2E 시나리오는 스텁 없이 0건 실행 가능**하다.

**전제 조건**: SPEC-FS-003이 동일 사유로 산출 중인 **Playwright 가상 FS 모킹 픽스처를 확장**한다(포크 금지, plan.md T0b). 본 SPEC이 추가할 스텁: `export_save_dialog`, `write_file`, `write_binary_file`, opener open-path / reveal-item-in-dir.

**픽스처를 확보하지 못한 경우**: E2E를 포기하고 컴포넌트 테스트로 커버한 뒤, **아래 Definition of Done에 미검증 항목으로 명시한다.** 조용히 넘어가지 않는다.

### (3) 파일 "무변경"은 vitest로 단언할 수 없다

baseline hash가 없고, 변경 후에 작성된 가드 테스트는 아무것도 증명하지 못한다. 다음 항목은 모두 **`git diff` 속성**이며 코드 리뷰로 확인한다:

- PDF 관련 파일(`exportPdf.ts`, `handleExportPdf`) 무변경
- `src-tauri/src/commands/browser_ops.rs` 무변경
- `src-tauri/` 변경이 `capabilities/main.json` 1건으로 한정
- `package.json` **devDependencies** 무변경(§ AC-013 참조 — 가드가 보장하지 않는다)

## Given-When-Then Scenarios

### AC-EXPORT-002-001: HTML 내보내기 성공 시 모달 표시 (REQ-007 성공절, 009)

- **Given** 에디터에 콘텐츠가 있고 사용자가 HTML 내보내기를 실행하여 저장 다이얼로그에서 경로 `<PATH>`를 선택한 상태일 때
- **When** 파일 쓰기(`write_file`)가 예외 없이 완료되면
- **Then** `exportToHtml`이 저장 경로를 호출자에게 반환한다.
- **And** 완료 모달이 표시되고, 모달에 전달된 경로가 `<PATH>`와 일치한다.

### AC-EXPORT-002-002: DOCX 내보내기 성공 시 모달 표시 (REQ-007 성공절, 010)

- **Given** 에디터에 콘텐츠가 있고 사용자가 DOCX 내보내기를 실행하여 저장 다이얼로그에서 경로 `<PATH>`를 선택한 상태일 때
- **When** 바이너리 파일 쓰기(`write_binary_file`)가 예외 없이 완료되면
- **Then** `exportToDocx`가 저장 경로를 반환하고, 완료 모달이 표시되며 전달된 경로가 `<PATH>`와 일치한다.

### AC-EXPORT-002-003: ConfirmDialog 소비 + props 계약 + 초기 포커스 (REQ-001, 002, 003, 005)

- **Given** 완료 모달이 표시된 상태일 때
- **When** `ConfirmDialog`에 전달된 props를 검사하면
- **Then** 모달이 `src/components/common/ConfirmDialog.tsx`(SPEC-FS-003 소유)로 렌더된다.
- **And** `actions` 배열이 정확히 3개이고 좌→우 순서가 `cancel` → `reveal` → `open`이며, 라벨이 각각 `닫기` / `폴더에서 보기` / `열기`다.
- **And** `open`만 `variant: 'primary'`를 가지며 `cancel`·`reveal`에는 `variant`가 없거나 `'default'`다.
- **And** `title`이 정확히 문자열 `'내보내기 완료'`다.
- **And** 모달이 열린 직후 키보드 포커스가 `열기` 버튼에 놓인다(마지막 항목 = primary + 초기 포커스 규칙의 의도된 적용).
- **When** 리포지토리를 스캔하면
- **Then** 완료 모달 용도의 별도 다이얼로그 컴포넌트가 존재하지 않는다(ConfirmDialog가 유일).

### AC-EXPORT-002-004: 저장 경로 표시 (REQ-004)

- **Given** 완료 모달이 표시된 상태일 때
- **When** 모달 본문(`message`)의 렌더 결과를 검사하면
- **Then** 내보낸 파일의 저장 경로 문자열이 화면에 포함되어, 사용자가 모달만 보고 파일 위치를 확인할 수 있다.

### AC-EXPORT-002-005: `열기` 액션 → open-path 호출 (REQ-006, 011)

- **Given** 완료 모달이 저장 경로 `<PATH>`와 함께 표시된 상태일 때
- **When** 사용자가 `열기`(id `open`)를 선택하면
- **Then** opener open-path 래퍼가 인자 `<PATH>`로 **정확히 1회** 호출된다(모킹된 호출 인자 단언).
- **And** 호출이 `src/lib/tauri/ipc.ts`의 래퍼를 경유하며, 컴포넌트가 `@tauri-apps/plugin-opener`를 직접 import하지 않는다.
- **And** 모달이 닫히고, reveal 래퍼는 호출되지 않는다(0회).

### AC-EXPORT-002-006: `폴더에서 보기` 액션 → reveal 호출 (REQ-006, 012)

- **Given** 완료 모달이 저장 경로 `<PATH>`와 함께 표시된 상태일 때
- **When** 사용자가 `폴더에서 보기`(id `reveal`)를 선택하면
- **Then** opener reveal-item-in-dir 래퍼가 인자 `<PATH>`로 **정확히 1회** 호출된다.
- **And** 모달이 닫히고, open-path 래퍼는 호출되지 않는다(0회).

### AC-EXPORT-002-007: 닫기 / Escape / 백드롭 — 부수효과 0 (REQ-013) [edge]

- **Given** 완료 모달이 표시된 상태일 때
- **When** 사용자가 `닫기`(id `cancel`)를 선택하면
- **Then** open·reveal 래퍼가 **모두 0회** 호출되고 모달이 닫힌다.
- **When** (다시 연 상태에서) Escape 키가 눌리면
- **Then** `onAction('cancel')`이 emit되어 동일하게 부수효과 없이 닫힌다.
- **When** (다시 연 상태에서) 백드롭이 클릭되면
- **Then** 마찬가지로 `onAction('cancel')`이 emit되어 부수효과 없이 닫힌다.

### AC-EXPORT-002-008: open / reveal 실패 처리 (REQ-014) [edge]

- **Given** 완료 모달이 표시되어 있고 opener 래퍼가 reject하도록 모킹된 상태일 때(예: 기본 앱 없음, 파일 이동됨, 권한 거부)
- **When** 사용자가 `열기` 또는 `폴더에서 보기`를 선택하면
- **Then** `window.alert`가 호출되어 사용자에게 실패가 통지된다(기존 내보내기 실패 알림과 동일한 채널).
- **And** 모달이 닫힌다.
- **And** unhandled promise rejection이 발생하지 않는다.

### AC-EXPORT-002-009: 저장 다이얼로그 취소 → 모달 미표시 (REQ-007 취소절, 017)

- **Given** 사용자가 HTML(또는 DOCX) 내보내기를 실행한 상태일 때
- **When** 저장 다이얼로그에서 취소하여 `exportSaveDialog`가 `null`을 반환하면(`exportHtml.ts:29-31`, `exportDocx.ts:50-52` 경로)
- **Then** `exportToHtml` / `exportToDocx`가 저장 경로 없음을 나타내는 값(`null`)을 반환한다.
- **And** 완료 모달이 표시되지 않는다.
- **And** 파일 쓰기(`write_file` / `write_binary_file`)가 호출되지 않는다.

### AC-EXPORT-002-010: 내보내기 예외 → 모달 미표시 (REQ-018) [edge]

- **Given** 내보내기 처리 중 예외가 발생하도록 모킹된 상태일 때(렌더 실패 또는 파일 쓰기 실패)
- **When** HTML(또는 DOCX) 내보내기를 실행하면
- **Then** 완료 모달이 표시되지 않는다.
- **And** 기존 실패 처리(`console.error` + `window.alert`, `AppLayout.tsx:154-155`·`:196-197`)가 그대로 동작한다.
- **And** 로딩 상태가 `finally`에서 해제된다.

### AC-EXPORT-002-011: PDF 경로 무변경 (REQ-019)

- **Given** 에디터에 콘텐츠가 있는 상태일 때
- **When** 사용자가 PDF 내보내기를 실행하면
- **Then** 완료 모달이 표시되지 않는다.
- **And** `printCurrentWindow`(`ipc.ts:123` → `print_current_window`, `file_ops.rs:184-187` → Rust `WebviewWindow::print()`) 호출 경로가 변경 전과 동일하다.
- **And** `handleExportPdf`(`AppLayout.tsx:161-180`)의 에러 처리(`:175-176`)가 변경되지 않는다.
- **And** (diff 리뷰) `handleExportPdf`와 `src/lib/export/exportPdf.ts`가 변경 목록에 나타나지 않는다.

### AC-EXPORT-002-012: 모달 상호작용 차단 + 로딩 해제 + 연속 내보내기 (REQ-015, 016)

- **Given** 완료 모달이 표시된 상태일 때
- **When** 배경 UI(툴바 버튼, 에디터, 내보내기 메뉴)에 키보드·포인터 입력을 시도하면
- **Then** 입력이 배경 UI에 전달되지 않는다(모달이 상호작용을 차단한다).
- **And** 내보내기 로딩 상태가 해제되어 있어 모달과 로딩 스피너가 동시에 표시되지 않는다.
- **When** 모달이 열린 상태에서 또 다른 내보내기 성공(경로 `<PATH2>`)이 도달하면
- **Then** 표시되는 경로가 `<PATH2>`로 교체되고 모달은 **1개만** 유지된다(큐잉·중첩 없음).

### AC-EXPORT-002-013: capability 권한 + 의존성 (REQ-008, 020)

- **Given** 본 SPEC의 전체 변경이 적용된 상태에서
- **When** `src-tauri/capabilities/main.json`을 파싱하면
- **Then** permissions 배열에 `opener:allow-reveal-item-in-dir`가 포함되어 있다.
- **And** 기존 항목(`core:default`, `dialog:allow-*`, `opener:default`, `shell:allow-*`)이 제거되지 않았다.
- **When** 의존성 회귀 가드를 실행하면
- **Then** 기존 가드 2종이 **무수정 상태로 통과**한다 — 즉 `package.json` **dependencies**(런타임) 배열과 `src-tauri/Cargo.toml` 크레이트 배열이 변경되지 않았다.
- **And** [**자동 검증 아님 — diff 리뷰**] `package.json` **devDependencies**가 변경되지 않았다. **인용한 가드는 devDependencies 배열을 고정하지 않는다** — `diagramRegressionGuard.test.ts:45-47`의 `lucide-react`·`@floating-ui/react` 부재 단언 2건이 전부이므로, 그 외 devDependency는 추가해도 가드가 통과한다. 따라서 이 절은 `git diff`로 확인한다.

### AC-EXPORT-002-014: 신규 Tauri command 부재 (REQ-021)

- **Given** 본 SPEC의 전체 변경이 적용된 상태에서
- **When** `src-tauri/src/lib.rs`의 `invoke_handler` 등록 목록과 `src-tauri/src/commands/`를 파싱하면
- **Then** 본 SPEC을 위한 신규 Tauri command가 0건이며 등록 목록이 변경되지 않았다.
- **And** [**자동 검증 아님 — diff 리뷰**] `src-tauri/` 변경이 `capabilities/main.json` 1건으로 한정되고 `browser_ops.rs`가 변경되지 않았다(§ 검증 불가 경계 (3)).

## 수동 크로스플랫폼 스모크 (자동화 불가 — 추적 항목)

> 아래는 **Playwright로 커버할 수 없는** 항목이다(§ 검증 불가 경계 (1)). AC로 승격되지 않으며 게이트를 차단하지 않는다. 다만 미검증 상태임을 명시적으로 남긴다.

| # | 항목 | 플랫폼 | 기대 동작 | 비고 |
|---|------|--------|-----------|------|
| S1 | `열기` → OS 기본 앱으로 내보낸 파일이 열림 | macOS / Windows / Linux | HTML은 브라우저, DOCX는 Word/LibreOffice 등 | 기본 앱 미등록 시 AC-008 실패 경로로 처리되는지 함께 확인 |
| S2 | `폴더에서 보기` → 파일이 **선택된 상태로** 폴더가 열림 | macOS (Finder) | 파일 하이라이트 상태로 Finder 창 표시 | |
| S3 | `폴더에서 보기` → 파일이 **선택된 상태로** 폴더가 열림 | Windows (탐색기) | 파일 하이라이트 상태로 탐색기 창 표시 | |
| S4 | `폴더에서 보기` 동작 | Linux | **파일 관리자 구현에 따라 폴더만 열리고 파일 선택이 되지 않을 수 있음**(spec.md A2). 폴더가 열리기만 하면 기능적 저하로 **허용** | 선택 미동작은 결함 아님. **폴더조차 열리지 않으면 결함** |
| S5 | reveal 권한 충분성 검증 | 임의 1개 플랫폼 | `opener:allow-reveal-item-in-dir` 추가만으로 permission denied 없이 동작 | **plan.md T5의 필수 검증 항목**(spec.md A3, 신뢰도 Medium). 실패 시 필요한 permission/scope를 식별해 추가하고 spec.md A3 갱신 |

## Quality Gate Criteria

| 게이트 | 기준 |
|--------|------|
| 선행 조건 (T0a) | SPEC-FS-003의 `src/components/common/ConfirmDialog.tsx`가 존재하고 spec.md § 4 계약과 문자 단위 일치(또는 plan.md T0a 폴백 적용). ConfirmDialog가 프로젝트 내 **정확히 하나만** 존재 |
| 선행 조건 (T0b) | Playwright 가상 FS 모킹 픽스처(SPEC-FS-003 산출)를 **확장**하여 `export_save_dialog`·파일 쓰기·opener 스텁 확보. 미확보 시 E2E 포기 + 미검증 항목으로 명시 |
| 반환 계약 | `exportToHtml` / `exportToDocx`가 저장 성공 시 경로를, 취소 시 `null`을 반환. plan.md T1 호출자 감사가 선행 완료되고 결정 근거가 `@MX:NOTE` 또는 커밋 메시지에 기록됨 |
| 타입 체크 | `npm run typecheck`(`tsc --noEmit`) 클린 (에러 0) |
| 단위/컴포넌트 테스트 | `npm test`(vitest) 전체 통과 — 신규(`openerIpc.test.ts`, `ExportCompletionDialog.test.tsx`, `exportOpenRegressionGuard.test.ts`) + 확장(`exportHtml.test.ts`, `exportDocx.test.ts`) + 기존 전체 무변경 통과 |
| E2E | `npm run test:e2e`(Playwright) 통과 — 내보내기 → 모달 표시 → 배경 입력 차단 → 닫기. open/reveal은 IPC payload 단언까지만 |
| Lint | `npm run lint` 통과 — PR #37(2026-07-20)에서 eslint 설정이 추가되어 정상 게이트로 복귀했으므로, lint 실패는 본 SPEC 구현의 실제 결함으로 취급한다 |
| 커버리지 | 신규 코드 커밋당 80% 이상, 전체 목표 85% |
| 의존성 (자동) | `package.json` **dependencies**와 `src-tauri/Cargo.toml` 크레이트 배열 무변경 — **기존 회귀 가드 2종 무수정 통과 필수**. 가드를 수정하여 통과시키는 것은 REQ-020 위반 |
| 의존성 (리뷰) | `package.json` **devDependencies** 무변경 — 가드가 고정하지 않으므로 `git diff`로 확인 |
| 코드 리뷰(diff) | PDF 관련 파일 무변경, `browser_ops.rs` 무변경, `src-tauri/` 변경 1건 한정 |

## Definition of Done

- [ ] AC-EXPORT-002-001 ~ 014 전 시나리오에 대응하는 테스트가 존재하고 통과
- [ ] REQ-EXPORT-002-001 ~ 021 전 요구사항이 테스트 또는 diff 리뷰로 검증됨(spec.md § 9 REQ→AC 대조 참조)
- [ ] plan.md 선행 조건 체인 완료: T0a(ConfirmDialog 존재) → T0b(E2E 픽스처 확장 또는 미확보 기록) → T1(호출자 감사 + "무엇이 깨지는가" 기술) → T2(반환 계약 결정 + 근거 기록)
- [ ] HTML/DOCX 성공 시에만 모달 표시 확인 — 취소·예외·PDF 3경로 모두 미표시 확인
- [ ] `actions` 배열이 `cancel`/`reveal`/`open` 순서·라벨·`open`만 primary로 고정, `title === '내보내기 완료'`, 초기 포커스가 `열기`에 위치함을 확인
- [ ] open/reveal 호출이 저장 경로를 인자로 정확히 1회 발생함을 모킹 payload로 확인; `cancel`·Escape·백드롭은 호출 0건 확인
- [ ] open/reveal 실패 시 `window.alert` + 모달 닫힘 + unhandled rejection 0건 확인
- [ ] 모달 상호작용 차단 + 연속 내보내기 단일 슬롯 덮어쓰기 확인
- [ ] `capabilities/main.json`에 `opener:allow-reveal-item-in-dir` 추가 확인 + **실제 앱 실행으로 reveal 권한 충분성 검증(S5)** 완료, 결과를 spec.md A3에 반영
- [ ] 신규 런타임 dependency·Cargo 크레이트 0건 확인 (기존 가드 2종 **무수정** 통과)
- [ ] devDependencies 무변경을 `git diff`로 확인 (가드가 보장하지 않음)
- [ ] `handleExportPdf` / `exportPdf.ts` / `browser_ops.rs`가 diff에 없음 확인, `src-tauri/` 변경 1건 한정 확인
- [ ] 수동 크로스플랫폼 스모크 S1~S4 수행 및 결과 기록(Linux 파일 선택 미동작은 허용, 폴더 미개방은 결함)
- [ ] E2E를 실행하지 못한 경우 그 사실과 사유를 **미검증 항목으로 명시적으로 기록**
- [ ] `npm run typecheck` 클린, `npm test` 전체 통과, `npm run lint` 통과, `npm run test:e2e` 통과
- [ ] @MX 태그 적용(export 반환 계약 `@MX:NOTE`, opener 래퍼 `@MX:NOTE`, `handleExportDialogAction` `@MX:NOTE`)
- [ ] PDF 후속 과제 추적 아티팩트 생성 — `SPEC-EXPORT-003` 디렉터리 또는 추적 이슈(사용자 요청 "html, pdf, word 모두" 중 PDF는 미해결 요청이지 폐기가 아님)
