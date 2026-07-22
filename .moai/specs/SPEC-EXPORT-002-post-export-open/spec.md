---
id: SPEC-EXPORT-002
version: "0.0.2"
status: draft
created: "2026-07-22"
updated: "2026-07-22"
author: "jw"
priority: medium
issue_number: 0
domain: EXPORT
title: "Post-Export Completion Dialog (Open / Reveal)"
dependencies:
  - SPEC-EXPORT-001
  - SPEC-FS-003
successor:
  - SPEC-EXPORT-003
tags:
  - export
  - html
  - docx
  - dialog
  - opener
  - ux
lifecycle: spec-anchored
---

# SPEC-EXPORT-002: Post-Export Completion Dialog (Open / Reveal)

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 0.0.1 | 2026-07-22 | jw | 최초 SPEC 작성 — HTML/DOCX 내보내기 성공 직후 완료 모달(닫기 / 폴더에서 보기 / 열기) 도입. 사용자 확정 결정 반영: (1) 대상 포맷 = HTML·DOCX 한정, PDF는 명시적 비목표, (2) 액션 3종 = `닫기`/`폴더에서 보기`/`열기`, Escape·백드롭은 닫기와 동일, (3) 다이얼로그 셸은 SPEC-FS-003 소유 `ConfirmDialog`를 **소비**, (4) `tauri-plugin-opener` v2 사용, 신규 npm/Cargo 의존성 0건, (5) `capabilities/main.json`에 `opener:allow-reveal-item-in-dir` 추가 필요. |
| 0.0.2 | 2026-07-22 | jw | plan-auditor 리뷰 반영 — 결함 9건 수정. **C1** `ConfirmDialogProps`에서 `checkbox` prop 삭제(양 SPEC 통틀어 소비자 0). 이에 따른 "미사용" 면책 문구도 전부 제거(선언이 사라졌으므로 부인할 대상이 없음). SPEC-FS-003과 문자 단위 동일 유지. **H1** 의존성 가드 주장 정정 — `diagramRegressionGuard.test.ts:19-43`은 `pkg.dependencies`만 `toEqual`로 고정하며 **devDependencies는 고정하지 않는다**(`:45-47`의 `lucide-react`/`@floating-ui/react` 부재 단언 2건이 전부). 요구/AC에서 자동 검증 범위와 diff 리뷰 범위를 분리했다. **H2** 구 REQ-013(모달 중 editor/file 상태 불변) 삭제 — 표시 전용 다이얼로그에서 공허하게 참이며 반증 불가. **H3** 구 REQ-019(`Command` spawn 금지) 삭제 — vitest로 "파일 무변경"을 단언할 수 없고(baseline 부재, `git diff` 속성), REQ-006(opener 래퍼 강제)·REQ-021(신규 command 금지)과 중복. 리뷰 노트로 강등하고 전용 가드 테스트를 제거했다. **M1** PDF 배제 근거의 메커니즘 정정 — JavaScript `window.print()`가 아니라 Rust `WebviewWindow::print()` 네이티브 호출이다(`exportPdf.ts:22-23` 주석이 명시적으로 반박, `file_ops.rs:185-186` 확인). 결론(OS가 출력 경로 소유)은 유지하되 근거를 사실로 교체. **M2** 앵커 정정 — `capabilities/main.json` `opener:default`는 `:11`(구 `:12`는 `shell:allow-execute`), `Cargo.toml` opener는 `:25`(구 `:24`), `ipc.ts` 래퍼 범위 `16-245`→`16-186`(파일 총 270줄). **M3** 모달 `title` 문자열 명시(신 REQ-003). **M4** 초기 포커스 = `열기` 요구 신설(신 REQ-005) — 사용자 결정 유지, 배열 순서 근거를 "마지막 항목 = primary + 초기 포커스, 어느 액션이 그 자리를 가질지는 각 SPEC이 결정"으로 정정. **M5** 모달의 상호작용 차단 + 연속 내보내기 단일 슬롯 시맨틱 명시(신 REQ-015/016). **M6** Test Strategy 표와 Delta 표의 REQ 배정 불일치 해소, REQ-001 부정절(전용 모달 부재)에 리포지토리 스캔 배정, REQ-007 성공절 매핑 명시. **M7** E2E 검증 경계 확장 — Playwright는 Tauri 런타임 없이 Vite dev 서버(webkit, localhost:1420)에서 실행되므로 스텁 없이는 `exportSaveDialog`가 reject되어 모달이 뜨지 않는다. SPEC-FS-003이 산출하는 가상 FS 모킹 픽스처를 **확장**하는 것으로 조율(포크 금지). **M8** PDF 후속 과제에 승계 SPEC ID `SPEC-EXPORT-003` 예약. **클린 재번호(001–021, 순차·결번 0)** 및 전 cross-reference 갱신. |

---

## Summary

`mdedit`(Tauri v2 + React 18 + TypeScript)의 **HTML / DOCX 내보내기**는 현재 파일을 저장한 뒤 **아무런 성공 피드백 없이 조용히 종료**한다. 사용자는 내보내기가 성공했는지, 파일이 어디에 저장되었는지 알 수 없다.

본 SPEC은 HTML/DOCX 내보내기가 **실제로 파일 쓰기까지 성공**했을 때 완료 모달을 표시한다. 모달은 저장된 파일 경로를 보여주고 3개 액션을 제공한다:

| 액션 ID | 라벨 | 동작 |
|---------|------|------|
| `cancel` | 닫기 | 모달만 닫음(부수효과 없음). Escape·백드롭 클릭도 동일 |
| `reveal` | 폴더에서 보기 | Finder/탐색기에서 해당 파일이 **선택된 상태로** 폴더를 염 |
| `open` | 열기 | OS 기본 애플리케이션으로 내보낸 파일을 염 (primary, 초기 포커스) |

핵심 설계 결정(사용자 승인, 재검토 금지):

- **대상 포맷은 HTML·DOCX 한정.** PDF는 명시적 비목표다(§ 10 참조, 누락이 아님). 후속 과제는 `SPEC-EXPORT-003`으로 예약한다.
- **다이얼로그 셸은 SPEC-FS-003 소유.** 본 SPEC은 `src/components/common/ConfirmDialog.tsx`를 **소비**만 하며 정의하지 않는다.
- **파일 열기/폴더 표시는 `tauri-plugin-opener` v2.** 이미 설치·등록되어 있다(`src-tauri/Cargo.toml:25`, `package.json` `"@tauri-apps/plugin-opener": "^2"`, `src-tauri/src/lib.rs:17`). npm 패키지는 현재 앱 코드에서 한 번도 import되지 않았다.
- **신규 의존성 0건(HARD).** 필요한 것은 모두 이미 설치되어 있다.
- **취소는 성공이 아니다.** 저장 다이얼로그를 취소하면 모달을 표시하지 않는다.

---

## 1. Environment (환경)

### 프로젝트 컨텍스트

- **애플리케이션**: mdedit (Tauri v2 + React 18 + TypeScript strict)
- **플랫폼**: macOS, Windows, Linux
- **대상 영역**: SPEC-EXPORT-001이 구현한 HTML/DOCX 내보내기 완료 지점의 사용자 피드백
- **테스트 게이트**: `npm run lint`(eslint) + `npm run typecheck`(tsc) + `npm test`(vitest) + `npm run test:e2e`(Playwright)

### 현재 경로 (소스 근거)

**HTML 내보내기 경로** — 사용자가 선택한 저장 경로를 앱이 **알고 있다**:

```
AppLayout.handleExportHtml   (src/components/layout/AppLayout.tsx:140-159)
  → exportToHtml             (src/lib/export/exportHtml.ts:21)
      → exportSaveDialog     (src/lib/tauri/ipc.ts:104)
          → export_save_dialog (src-tauri/src/commands/file_ops.rs:139-161)
      → writeFile            (src/lib/tauri/ipc.ts:24)
          → write_file       (src-tauri/src/commands/file_ops.rs:48)
```

**DOCX 내보내기 경로** — 저장 경로를 **알고 있다**:

```
AppLayout.handleExportDocx   (src/components/layout/AppLayout.tsx:182-201)
  → exportToDocx             (src/lib/export/exportDocx.ts:45)
      → exportSaveDialog     (ipc.ts:104) → export_save_dialog (file_ops.rs:139-161)
      → writeBinaryFile      (ipc.ts:115) → write_binary_file  (file_ops.rs:169-180)
```

**PDF 내보내기 경로** — 저장 경로를 **알 수 없다**:

```
AppLayout.handleExportPdf    (src/components/layout/AppLayout.tsx:161-180)
  → exportToPdf              (src/lib/export/exportPdf.ts:28)
      → self-contained HTML을 숨긴 div에 주입 + @media print CSS
      → printCurrentWindow   (ipc.ts:123)
          → print_current_window (file_ops.rs:184-187)
              → Rust WebviewWindow::print() = OS 네이티브 인쇄 API
```

**메커니즘 정정 [중요]**: 이 경로는 **JavaScript `window.print()`가 아니다.** `exportPdf.ts:22-23`이 바로 이 오해를 막기 위해 기록하고 있다:

> Note: JavaScript window.print() does NOT work in Tauri's WKWebView.
> Tauri's Rust-side WebviewWindow::print() uses the native print API directly.

`file_ops.rs:185-186`에서 확인된다 — 여기서 호출되는 `window.print()`는 **Rust `tauri::WebviewWindow`의 메서드**이며 OS 네이티브 인쇄 API를 직접 호출한다.

**결론은 동일하다**: 사용자가 인쇄 다이얼로그에서 "PDF로 저장"을 선택하면 **OS가 출력 경로를 소유**하며 그 경로는 앱에 반환되지 않는다(`print_current_window`의 반환 타입은 `Result<(), String>` — 경로가 없다). 나아가 `exportPdf.ts:24`에 따르면 print IPC는 **네이티브 다이얼로그가 닫히기 전에 반환**되므로 앱은 사용자가 저장을 완료했는지조차 알 수 없다. 따라서 PDF에는 열 대상 경로도, 신뢰할 수 있는 성공 신호도 존재하지 않는다.

### 현재 결함

1. **성공 피드백 부재** — `exportToHtml`/`exportToDocx` 성공 시 UI 변화가 로딩 스피너 해제뿐이다.
2. **취소와 성공이 구분 불가** — 저장 다이얼로그 취소 시 `exportHtml.ts:29-31`, `exportDocx.ts:50-52`가 조용히 early-return한다.
3. **반환 계약이 경로를 전달하지 않음** — `exportToHtml`은 `Promise<string | null>`(HTML **문서 문자열** 또는 null)을, `exportToDocx`는 `Promise<void>`를 반환한다. **어느 쪽도 저장 경로를 호출자에게 돌려주지 않는다.**

### 기존 자산

- `tauri-plugin-opener` v2: Cargo(`src-tauri/Cargo.toml:25`), npm(`package.json`), 플러그인 등록(`src-tauri/src/lib.rs:17`) 모두 완료. npm 패키지는 앱 코드에서 미사용.
- `src-tauri/capabilities/main.json:11`이 `opener:default`를 부여한다. 이는 `open-path`/`open-url`을 포함하나 **reveal은 포함하지 않는다.**
- `src/lib/tauri/ipc.ts`: 얇은 `invoke<T>` 래퍼 패턴이 확립되어 있다(파일 총 270줄, 파일·다이얼로그 래퍼는 `:16-186` 구간에 집중).
- `src-tauri/src/commands/browser_ops.rs:10-29` `open_url_in_browser`: `std::process::Command`로 `open`/`start`/`xdg-open`을 직접 실행하는 **별개의 기존 접근**(URL 전용). 본 SPEC은 이 방식을 따르지 않는다(§ 3 리뷰 노트).

---

## 2. Assumptions (가정)

| ID | 가정 | 신뢰도 | 근거 | 위반 시 영향 |
|----|------|--------|------|-------------|
| A1 | SPEC-FS-003이 `src/components/common/ConfirmDialog.tsx`를 § 4 계약대로 먼저 랜딩한다 | Medium | 병렬 작성 중인 형제 SPEC. 현재 `src/components/common/` 디렉터리는 **아직 존재하지 않음**(확인 완료) | 본 SPEC 구현 불가 → § 4의 폴백 적용 |
| A2 | `tauri-plugin-opener` v2의 `revealItemInDir`가 macOS/Windows/Linux에서 파일을 선택 상태로 폴더를 연다 | High | 플러그인의 공식 크로스플랫폼 API. Linux는 파일 관리자 구현에 따라 "선택" 강도가 다를 수 있음 | Linux에서 폴더만 열리고 파일 선택은 되지 않음(허용 가능한 기능적 저하) |
| A3 | `opener:allow-reveal-item-in-dir` 권한 추가만으로 reveal이 동작한다(추가 scope 불필요) | Medium | `opener:default`가 이미 부여되어 있고 reveal은 별도 permission 항목 | reveal 호출이 permission denied로 실패 → REQ-014 실패 경로로 처리. **plan.md T6에서 실제 앱 실행으로 검증 필수** |
| A4 | 내보내기 대상 경로가 파일 쓰기 성공 직후에도 유효하다 | High | 동일 세션 내 즉시 사용 | 파일이 외부에서 이동/삭제된 경우 open/reveal 실패 → REQ-014 |
| A5 | 신규 의존성 없이 요구 기능 전부 구현 가능하다 | High | opener 플러그인이 open-path와 reveal-item-in-dir 모두 제공 | 제약 위반. 단 자동 차단은 런타임 dependencies·Cargo에 한정된다(§ 3) |
| A6 | SPEC-FS-003이 산출하는 Playwright 가상 FS 모킹 픽스처를 확장하여 `export_save_dialog`를 스텁할 수 있다 | Medium | FS-003이 동일 사유(Tauri 런타임 부재)로 픽스처를 명시적 산출물로 만들고 있음 | E2E에서 완료 모달 흐름 검증 불가 → 컴포넌트 테스트로만 커버하고 미검증 항목으로 기록(§ 7) |

---

## 3. Constraints (제약)

- **[HARD] 신규 의존성 0건.** npm 패키지도 Cargo 크레이트도 추가하지 않는다.

  **자동 검증 범위와 리뷰 범위는 다르다 — 혼동 금지:**

  | 대상 | 강제 수단 | 실제 강도 |
  |------|-----------|-----------|
  | `package.json` **dependencies**(런타임) | `src/test/diagramRegressionGuard.test.ts:19-43` | **강함** — 배열 전체를 `toEqual`로 고정. 1건만 추가해도 실패 |
  | `src-tauri/Cargo.toml` 크레이트 | `src/test/aiDiagramTypeRegressionGuard.test.ts:45-55` | **강함** — 배열 전체를 `toEqual`로 고정 |
  | `package.json` **devDependencies** | 동 파일 `:45-47` | **약함** — `lucide-react`·`@floating-ui/react` 두 개의 부재 단언뿐. **배열 전체를 고정하지 않는다.** 그 외 devDependency는 추가해도 가드가 그대로 통과한다 |

  따라서 devDependencies 무변경은 **자동 검증되지 않으며 diff 리뷰로만 강제된다**(REQ-020, AC-013). 본 SPEC은 테스트 파일을 3개 추가하므로 devDependency 추가 유혹이 있는 쪽이며, 실제로는 vitest·@testing-library·Playwright가 모두 기설치되어 있어 추가가 불필요하다.

- **[HARD] `ConfirmDialog`를 본 SPEC이 정의하지 않는다.** SPEC-FS-003 소유 자산을 소비만 한다.
- TypeScript strict mode 준수. `src-tauri/` 변경은 capability JSON 1건으로 한정한다(신규 Tauri command 불필요 — opener는 JS API로 직접 호출).

### 리뷰 노트 (요구사항 아님, 테스트 대상 아님)

- 파일 열기/폴더 표시에 `std::process::Command`를 직접 spawn하지 않는다. 이는 REQ-006(opener 래퍼 경유 강제)과 REQ-021(신규 Tauri command 금지)에서 이미 따라 나오므로 **별도 요구사항으로 두지 않는다.** 또한 vitest로 "`browser_ops.rs`가 변경되지 않았다"를 단언할 수 없다 — baseline hash가 없고, 이는 `git diff`의 속성이다. 변경 후에 작성된 가드 테스트는 아무것도 증명하지 못한다. 코드 리뷰에서 확인한다.
- opener 플러그인을 선호하는 근거(참고용): (1) **권한 모델** — capability ACL(`capabilities/main.json`)의 통제를 받는다. (2) **크로스플랫폼 정확성** — "파일을 선택한 상태로 폴더 열기"는 플랫폼마다 인자가 다르다(macOS `open -R`, Windows `explorer /select,`, Linux는 파일 관리자별 상이). 직접 구현하면 Linux 분기가 취약해진다. (3) `browser_ops.rs`는 **URL** 전용이며 본 SPEC과 무관하다.

---

## 4. Consumed Dependency: ConfirmDialog (SPEC-FS-003 소유)

> **본 SPEC은 이 컴포넌트를 만들지 않는다.** 아래 계약은 SPEC-FS-003에서 **확정된 것**이며, 참조 목적으로만 재수록한다. 계약 변경 권한은 SPEC-FS-003에 있다. 두 SPEC의 사본은 **문자 단위로 동일**해야 한다.

```ts
export type DialogActionVariant = 'primary' | 'danger' | 'default';

export interface DialogAction {
  id: string;
  label: string;
  variant?: DialogActionVariant;
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  actions: DialogAction[];        // 좌→우 렌더, 마지막 항목이 primary/default + 초기 포커스
  onAction: (id: string) => void; // Escape·백드롭 클릭 모두 'cancel'을 emit
}
```

본 SPEC이 전달하는 `actions` 배열(고정):

```ts
[
  { id: 'cancel', label: '닫기' },
  { id: 'reveal', label: '폴더에서 보기' },
  { id: 'open',   label: '열기', variant: 'primary' },
]
```

### 배열 순서 규칙 — 실제 규칙

계약의 규칙은 "**마지막 항목이 primary이며 초기 포커스를 받는다**"이다. **어느 액션이 그 자리를 차지할지는 각 소비자 SPEC이 스스로 결정한다.**

- SPEC-FS-003의 워처 모달은 파괴적 선택지를 포함하므로 안전한 쪽을 마지막에 둔다.
- 본 SPEC은 **부수효과가 있는 `열기`를 마지막에 둔다.** 사용자가 직접 내보내기를 실행하고 저장 위치까지 골랐으므로 "여는 것"이 기대되는 다음 행동이며 파괴적이지 않기 때문이다(사용자 결정, 재검토 금지). 초기 포커스가 `열기`에 놓이는 것은 **의도된 설계**이며 REQ-005로 명문화한다.

### Dependency Ordering [HARD]

- **SPEC-FS-003이 먼저 랜딩해야 한다.** `src/components/common/ConfirmDialog.tsx`가 존재하지 않으면 본 SPEC의 Run phase는 착수 불가다(현재 해당 디렉터리 미존재 확인).
- **순서 역전 시 폴백**: 본 SPEC이 먼저 실행되어야 한다면 위 계약 그대로 최소 구현하여 생성하고 `// @MX:NOTE: 계약 소유 SPEC = SPEC-FS-003` 헤더 주석을 남긴다. 이 경우 SPEC-FS-003은 파일을 새로 만들지 않고 **확장**한다. 어느 순서든 **ConfirmDialog는 정확히 하나만 존재해야 한다**(REQ-001).
- **계약 불변식(확정됨)**: SPEC-FS-003 v0.0.3이 계약 세부 3건을 INV-1/2/3으로 확정했다. 정의는 SPEC-FS-003이 단독 소유하며 본 문서는 중복 기재하지 않고 참조한다.
  - **INV-1** — 위치가 초기 포커스를, `variant`가 스타일을 결정하며 서로 경합하지 않는다. 마지막 항목이 `'danger'`여도 danger 스타일로 렌더되면서 초기 포커스는 유지한다. 파괴적 액션을 기본 포커스에서 빼려면 **배열을 재정렬하지 계약을 수정하지 않는다.** 본 SPEC의 배열(`cancel`→`reveal`→`open`)은 이 규칙 아래 `열기`가 포커스를 갖도록 의도적으로 배치되었다(REQ-005).
  - **INV-2** — `'default'`는 `variant` 생략의 명시적 등가값이며 구현은 둘을 동일 취급한다. 본 SPEC은 사용하지 않는다.
  - **INV-3** — `'cancel'`은 예약된 **필수** id다. `actions` 배열에 해당 id 항목이 없으면 Escape·백드롭이 어떤 핸들러에도 매칭되지 않는다. 본 SPEC의 배열은 `cancel`을 포함하므로 준수한다(REQ-002). SPEC-FS-003 REQ-036이 개발 빌드에서 위반을 콘솔 에러로 강제한다.
- **계약 재동기화**: 위 3건 반영 이후 SPEC-FS-003이 계약을 추가 변경하면 본 문서의 사본을 즉시 갱신하여 문자 단위 동일성을 유지한다. 타입 선언 자체는 현재 양 문서가 문자 단위로 일치함이 확인되었다(2026-07-22).

---

## 5. Requirements (EARS)

> 요구사항 원자성: plan-audit 리뷰에서 공허하게 참인 요구(모달 중 editor/file 상태 불변)와 검증 불가·중복 요구(`Command` spawn 금지)를 삭제하고 001–021로 클린 재번호했다. 삭제된 항목은 § 3 리뷰 노트로 강등되었거나 완전히 제거되었다.

### Ubiquitous Requirements

- **REQ-EXPORT-002-001**: The system **shall** 항상 완료 모달을 `src/components/common/ConfirmDialog.tsx`(SPEC-FS-003 소유)로 렌더하며, 리포지토리 전체에 완료 모달 용도의 별도 다이얼로그 컴포넌트가 존재하지 않는다.
- **REQ-EXPORT-002-002**: The system **shall** 항상 완료 모달에 정확히 3개의 액션을 좌→우 순서 `cancel`(라벨 `닫기`) → `reveal`(라벨 `폴더에서 보기`) → `open`(라벨 `열기`, `variant: 'primary'`)로 전달한다.
- **REQ-EXPORT-002-003**: The system **shall** 항상 완료 모달의 `title`을 문자열 `"내보내기 완료"`로 전달한다.
- **REQ-EXPORT-002-004**: The system **shall** 항상 완료 모달의 `message`에 내보낸 파일의 저장 경로를 표시하여, 사용자가 파일 위치를 모달만 보고 확인할 수 있게 한다.
- **REQ-EXPORT-002-005**: The system **shall** 항상 완료 모달이 열릴 때 초기 키보드 포커스를 `open`(`열기`) 액션에 놓는다(계약의 "마지막 항목 = primary + 초기 포커스" 규칙의 결과이며, 본 SPEC이 의도적으로 선택한 배치다).
- **REQ-EXPORT-002-006**: The system **shall** 항상 파일 열기와 폴더 표시를 `@tauri-apps/plugin-opener`의 API를 감싼 `src/lib/tauri/ipc.ts` 래퍼 함수를 통해 수행한다(컴포넌트가 플러그인 API를 직접 import하지 않는다).
- **REQ-EXPORT-002-007**: The system **shall** 항상 `exportToHtml`과 `exportToDocx`가 저장이 성공한 경우 사용자가 선택한 **저장 경로**를 호출자에게 반환하고, 사용자가 저장 다이얼로그를 취소한 경우 저장 경로가 없음을 구분 가능한 값(`null`)으로 반환한다.
- **REQ-EXPORT-002-008**: The system **shall** 항상 `src-tauri/capabilities/main.json`의 permissions 배열에 `opener:allow-reveal-item-in-dir`를 포함한다.

### Event-Driven Requirements

- **REQ-EXPORT-002-009**: **WHEN** HTML 내보내기에서 파일 쓰기(`write_file`)가 예외 없이 완료되면, **the system shall** 저장 경로를 담은 완료 모달을 표시한다.
- **REQ-EXPORT-002-010**: **WHEN** DOCX 내보내기에서 바이너리 파일 쓰기(`write_binary_file`)가 예외 없이 완료되면, **the system shall** 저장 경로를 담은 완료 모달을 표시한다.
- **REQ-EXPORT-002-011**: **WHEN** 사용자가 완료 모달에서 `open` 액션을 선택하면, **the system shall** 내보낸 파일의 저장 경로를 인자로 opener open-path 래퍼를 정확히 1회 호출하고 모달을 닫는다.
- **REQ-EXPORT-002-012**: **WHEN** 사용자가 완료 모달에서 `reveal` 액션을 선택하면, **the system shall** 내보낸 파일의 저장 경로를 인자로 opener reveal-item-in-dir 래퍼를 정확히 1회 호출하고 모달을 닫는다.
- **REQ-EXPORT-002-013**: **WHEN** 사용자가 `cancel` 액션을 선택하거나 Escape 키를 누르거나 백드롭을 클릭하면(세 경우 모두 `onAction('cancel')`로 수렴), **the system shall** 어떤 opener 호출도 수행하지 않고 모달을 닫는다.
- **REQ-EXPORT-002-014**: **WHEN** `open` 또는 `reveal` 호출이 거부(rejected)되면, **the system shall** 모달을 닫고 기존 내보내기 실패 처리와 동일한 방식(`window.alert`)으로 사용자에게 실패를 알리며, 예외를 전역으로 전파시키지 않는다.

### State-Driven Requirements

- **REQ-EXPORT-002-015**: **WHILE** 완료 모달이 열려 있는 동안, **the system shall** 모달을 상호작용 차단(modal) 상태로 유지하여 배경 UI(툴바, 에디터, 내보내기 메뉴)가 키보드·포인터 입력을 받지 않게 하고, 내보내기 로딩 상태는 해제된 상태로 유지한다(모달과 로딩 스피너가 동시에 표시되지 않는다).
- **REQ-EXPORT-002-016**: **WHILE** 완료 모달이 이미 열려 있는 동안 또 다른 내보내기 성공이 도달하면, **the system shall** 저장 경로를 최신 값으로 교체하여 단일 모달만 표시한다(경로 슬롯은 1개이며 큐잉이나 모달 중첩을 하지 않는다).

### Unwanted Behavior Requirements

- **REQ-EXPORT-002-017**: The system **shall not** 사용자가 저장 다이얼로그를 취소한 경우(`exportSaveDialog`가 `null` 반환, `exportHtml.ts:29-31` / `exportDocx.ts:50-52` 경로) 완료 모달을 표시한다.
- **REQ-EXPORT-002-018**: The system **shall not** 내보내기 처리 중 예외가 발생한 경우(`handleExportHtml`/`handleExportDocx`의 catch 진입) 완료 모달을 표시한다. 기존 `window.alert` 실패 알림 동작은 변경하지 않는다(`AppLayout.tsx:154-155`, `:196-197`).
- **REQ-EXPORT-002-019**: The system **shall not** PDF 내보내기 경로(`handleExportPdf` — `AppLayout.tsx:161-180`, `exportToPdf` — `exportPdf.ts:28`, `printCurrentWindow` — `ipc.ts:123`, `print_current_window` — `file_ops.rs:184-187`)의 동작·계약·에러 처리(`AppLayout.tsx:175-176`)를 변경하거나 PDF 내보내기 후 완료 모달을 표시한다.
- **REQ-EXPORT-002-020**: The system **shall not** 신규 npm 의존성(dependencies 또는 devDependencies) 또는 신규 Cargo 크레이트를 추가한다. **검증 강도 주의(§ 3)**: dependencies와 Cargo 크레이트는 회귀 가드가 배열 전체를 고정하므로 자동 차단되지만, **devDependencies는 가드가 고정하지 않으므로 diff 리뷰로만 강제된다.**
- **REQ-EXPORT-002-021**: The system **shall not** 본 SPEC 전용의 신규 Tauri command를 `src-tauri/src/commands/`에 추가한다(opener 플러그인의 JS API로 충분하다).

---

## 6. Failure Handling (명시적 정의)

현재 `src/` 전체에서 `alert()` 호출은 정확히 3곳뿐이며 모두 내보내기 실패 경로다(`AppLayout.tsx:154-155`, `:175-176`, `:196-197`).

**결정**: 본 SPEC의 open/reveal 실패도 **`window.alert`를 유지**한다(REQ-014). 근거:

- 기존 내보내기 실패 UX와 일관되며, 사용자가 이미 익숙한 채널이다.
- 토스트/스낵바 시스템은 현재 코드베이스에 존재하지 않으며, 도입은 본 SPEC의 범위를 벗어난다(§ 10).
- 실패 사유는 사용자가 조치 가능한 것이 대부분이다(기본 앱 없음, 파일 이동됨, 권한 거부).

`alert` → 토스트 마이그레이션은 별도 SPEC의 과제로 남긴다. 이는 **미정의 상태가 아니라 의도된 현행 유지**다.

---

## 7. Test Strategy (테스트 전략)

이 저장소의 게이트는 `npm run lint` + `npm run typecheck` + `npm test`(vitest) + `npm run test:e2e`(Playwright)다.

### 검증 불가 경계 [중요]

**(1) 외부 OS 애플리케이션의 실제 실행은 단언할 수 없다.** Playwright는 앱 webview 안에서만 관측 가능하며, Finder/Preview/Word가 떴는지는 관측 범위 밖이다. 따라서 "OS가 파일을 열었다"가 아니라 "앱이 `<정확한 저장 경로>`를 인자로 open-path 래퍼를 정확히 1회 호출했다"를 검증한다. 이 경계 아래는 `tauri-plugin-opener`의 책임이다.

**(2) Playwright 환경에는 Tauri 런타임이 아예 없다.** `playwright.config.ts`는 webkit 프로젝트로 **Vite dev 서버**(`baseURL: 'http://localhost:1420'`)에 대해 실행된다 — Tauri 앱 바이너리가 아니다. 스텁이 없으면 `exportSaveDialog`(`ipc.ts:104`)의 `invoke`가 reject되고, 흐름은 `AppLayout`의 `catch`로 떨어져 `alert`만 뜨며 **완료 모달은 절대 나타나지 않는다.**

**대응**: SPEC-FS-003이 동일 사유로 **Playwright 가상 FS 모킹 픽스처를 명시적 산출물로 만들고 있다**(자체 E2E 6건 중 5건이 같은 이유로 실행 불가였음). 본 SPEC은 그 픽스처를 **확장**하여 `export_save_dialog` / `write_file` / `write_binary_file` / opener API를 스텁한다. **포크하지 않는다.** 픽스처를 사용할 수 없으면 E2E를 컴포넌트 테스트로 대체하고 그 사실을 미검증 항목으로 남긴다.

**(3) 파일 "무변경"은 vitest로 단언할 수 없다.** baseline hash가 없고, 변경 후 작성된 가드는 아무것도 증명하지 못한다. `browser_ops.rs` 무변경, `src-tauri/` 변경 1건 한정, PDF 파일 무변경, devDependencies 무변경은 모두 **`git diff` 속성**이며 코드 리뷰 항목이다.

### 계층별 배정

| 계층 | 도구 | 담당 요구사항 |
|------|------|--------------|
| **Unit — IPC 래퍼** | vitest + `@tauri-apps/plugin-opener` 모듈 모킹 | REQ-006, 011, 012 |
| **Unit — export 반환 계약** | vitest + `ipc` 모듈 모킹 | REQ-007(성공절 + 취소절), 017 |
| **Component — 모달 props 계약** | vitest + @testing-library/react | REQ-002, 003, 004, 005 |
| **Component — 액션 라우팅** | vitest + opener 래퍼 모킹 | REQ-011, 012, 013, 014 |
| **Component — 표시 조건/상태** | vitest + @testing-library/react | REQ-009, 010, 015, 016, 017, 018, 019 |
| **정적 회귀 가드** | vitest (파일 파싱 + 리포지토리 스캔) | REQ-001(부정절 — 완료 모달용 별도 다이얼로그 컴포넌트 부재 스캔), REQ-008(capability 배열), REQ-020(dependencies·Cargo 배열 — 기존 가드 2종 재실행), REQ-021(신규 command 부재) |
| **E2E** | Playwright + SPEC-FS-003 픽스처 확장 | REQ-009, 010, 013, 015: 내보내기 → 모달 가시성 → 배경 입력 차단 → 닫기. open/reveal은 invoke payload 단언까지만 |
| **코드 리뷰(diff)** | `git diff` | REQ-019(PDF 파일 무변경), REQ-020(devDependencies), REQ-021(`src-tauri/` 변경 1건 한정), § 3 리뷰 노트 |

### 신규/변경 테스트 파일

| Delta | 파일 | 내용 |
|-------|------|------|
| [NEW] | `src/test/openerIpc.test.ts` | opener 래퍼 단위 테스트(REQ-006/011/012) |
| [NEW] | `src/test/ExportCompletionDialog.test.tsx` | 모달 props 계약·액션 라우팅·표시 조건(REQ-002~005, 009~019) |
| [NEW] | `src/test/exportOpenRegressionGuard.test.ts` | capability 배열 + 신규 command 부재 + 완료 모달용 별도 다이얼로그 부재 스캔(REQ-001/008/021) |
| [MODIFY] | `src/test/exportHtml.test.ts`, `src/test/exportDocx.test.ts` | 반환 계약 변경 반영(REQ-007) |
| [MODIFY] | Playwright E2E 스펙 + SPEC-FS-003 픽스처 | 내보내기 → 모달 → 닫기 시나리오 |

---

## 8. Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src/lib/tauri/ipc.ts` | opener open-path / reveal-item-in-dir 래퍼 2종 추가(기존 얇은 래퍼 관례 `:16-186` 준수) |
| [MODIFY] | `src/lib/export/exportHtml.ts` | `exportToHtml` 반환값을 저장 경로 기반으로 변경(REQ-007). 취소 early-return(`:29-31`) 유지. `generateHtmlContent`(`:70`)는 **무변경**(PDF 전용 경로) |
| [MODIFY] | `src/lib/export/exportDocx.ts` | `exportToDocx` 반환값을 저장 경로 기반으로 변경(REQ-007). 취소 early-return(`:50-52`) 유지 |
| [MODIFY] | `src/lib/export/types.ts` | 내보내기 결과 타입(저장 경로 포함) 정의 |
| [MODIFY] | `src/components/layout/AppLayout.tsx` | `handleExportHtml`(`:140-159`)·`handleExportDocx`(`:182-201`)에 성공 시 모달 상태 설정 추가. 모달 상태(단일 경로 슬롯) + `onAction` 라우팅 핸들러 신설. `handleExportPdf`(`:161-180`) **무변경** |
| [MODIFY] | `src-tauri/capabilities/main.json` | permissions 배열에 `opener:allow-reveal-item-in-dir` 추가(현재 `:11`이 `opener:default`) |
| [CONSUME] | `src/components/common/ConfirmDialog.tsx` | **SPEC-FS-003 소유.** import·사용만 한다(§ 4 폴백 조건 제외) |
| [EXTEND] | Playwright 가상 FS 모킹 픽스처 | **SPEC-FS-003 소유 산출물.** `export_save_dialog`/파일 쓰기/opener 스텁을 추가한다. 포크 금지 |
| [UNCHANGED] | `src/lib/export/exportPdf.ts`, `src-tauri/src/commands/file_ops.rs`, `src-tauri/src/commands/browser_ops.rs`, `src-tauri/src/lib.rs`, `package.json`, `src-tauri/Cargo.toml` | 무변경(REQ-019/020/021) |

---

## 9. Acceptance Criteria

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-EXPORT-002-001 | REQ-007(성공절), 009 | HTML 파일 쓰기 성공 → `exportToHtml`이 저장 경로 반환 + 완료 모달 표시 |
| AC-EXPORT-002-002 | REQ-007(성공절), 010 | DOCX 바이너리 쓰기 성공 → `exportToDocx`가 저장 경로 반환 + 완료 모달 표시 |
| AC-EXPORT-002-003 | REQ-001, 002, 003, 005 | `ConfirmDialog`로 렌더 + 완료 모달용 별도 다이얼로그 컴포넌트 리포지토리 내 부재; `actions`가 `cancel`/`reveal`/`open` 순서·라벨·`open`만 primary; `title === '내보내기 완료'`; 초기 포커스가 `열기`에 위치 |
| AC-EXPORT-002-004 | REQ-004 | 모달 본문에 저장 경로 문자열이 포함되어 렌더 |
| AC-EXPORT-002-005 | REQ-006, 011 | `open` 선택 → open-path 래퍼가 저장 경로로 정확히 1회 호출(모킹 payload 단언), 모달 닫힘, reveal 0회 |
| AC-EXPORT-002-006 | REQ-006, 012 | `reveal` 선택 → reveal 래퍼가 저장 경로로 정확히 1회 호출, 모달 닫힘, open 0회 |
| AC-EXPORT-002-007 | REQ-013 | `cancel`·Escape·백드롭 각각 → opener 호출 0건, 모달 닫힘 |
| AC-EXPORT-002-008 | REQ-014 | open/reveal reject → `window.alert` + 모달 닫힘 + unhandled rejection 없음 |
| AC-EXPORT-002-009 | REQ-007(취소절), 017 | 저장 다이얼로그 취소 → `null` 반환 + 모달 미표시 + 파일 쓰기 미호출 |
| AC-EXPORT-002-010 | REQ-018 | 내보내기 예외 → 기존 `window.alert` 유지 + 모달 미표시 + 로딩 해제 |
| AC-EXPORT-002-011 | REQ-019 | PDF 내보내기 → 모달 미표시, `printCurrentWindow` 호출 경로·에러 처리 무변경, diff에 PDF 관련 파일 부재 |
| AC-EXPORT-002-012 | REQ-015, 016 | 모달 열림 중 배경 UI 입력 차단 + 로딩 스피너 미표시; 두 번째 내보내기 성공 도달 시 경로가 최신 값으로 교체되고 모달은 1개만 유지 |
| AC-EXPORT-002-013 | REQ-008, 020 | capability permissions에 `opener:allow-reveal-item-in-dir` 존재; 기존 가드 2종이 **무수정** 통과(dependencies·Cargo 배열 고정); devDependencies 무변경은 **diff 리뷰**로 확인(가드가 보장하지 않음) |
| AC-EXPORT-002-014 | REQ-021 | 본 SPEC용 신규 Tauri command 0건, `lib.rs` `invoke_handler` 등록 목록 무변경; `src-tauri/` 변경 1건 한정은 diff 리뷰로 확인 |

REQ 커버리지 대조(001–021 전수): 001→AC3, 002→AC3, 003→AC3, 004→AC4, 005→AC3, 006→AC5·AC6, 007→AC1·AC2(성공절)·AC9(취소절), 008→AC13, 009→AC1, 010→AC2, 011→AC5, 012→AC6, 013→AC7, 014→AC8, 015→AC12, 016→AC12, 017→AC9, 018→AC10, 019→AC11, 020→AC13, 021→AC14. 미커버 REQ 없음.

**Quality Gates (AC 외 공통 게이트)**: `npm run lint` 클린 + `npm run typecheck` 클린 + `npm test` 전체 통과 + `npm run test:e2e` 통과. 기존 회귀 가드 2종 무수정 통과가 필수다(수정하여 통과시키는 것은 REQ-020 위반).

---

## 10. Exclusions (What NOT to Build)

- **PDF 완료 모달 없음 — 의도된 비목표, 누락 아님.** PDF 내보내기는 `print_current_window`(`file_ops.rs:184-187`)를 통해 **Rust `WebviewWindow::print()` 네이티브 인쇄 API**를 호출한다(JavaScript `window.print()`가 아니다 — `exportPdf.ts:22-23` 주석이 이를 명시적으로 반박한다). OS 인쇄 다이얼로그가 출력 경로를 소유하므로 앱은 (a) 사용자가 PDF를 어디에 저장했는지, (b) 저장을 완료하기는 했는지 모두 알 수 없다(print IPC는 다이얼로그가 닫히기 전에 반환된다 — `exportPdf.ts:24`). 열 대상 경로도 신뢰할 수 있는 성공 신호도 없으므로 PDF는 현행 동작을 유지한다.

  **후속 과제 추적: `SPEC-EXPORT-003` (예약).** 사용자 요청은 "html, pdf, word 모두"였으므로 PDF는 **미해결 요청이지 폐기된 요청이 아니다.** PDF에 완료 모달을 붙이려면 먼저 **앱이 경로를 소유하는 PDF 생성 경로**(예: 헤드리스 렌더 후 `export_save_dialog('pdf', …)` → 파일 쓰기)로 전환해야 하며 그것이 `SPEC-EXPORT-003`의 범위다. 본 SPEC 랜딩 시 해당 SPEC 디렉터리 또는 추적 이슈를 생성한다.

- **ConfirmDialog 정의 없음** — SPEC-FS-003 소유. 본 SPEC은 소비자다(§ 4 폴백 조건 제외).
- **가상 FS 픽스처 신규 작성 없음** — SPEC-FS-003 산출물을 확장한다. 포크 금지.
- **토스트/스낵바 알림 시스템 없음** — 실패 알림은 기존 `window.alert` 유지(§ 6).
- **"다시 묻지 않기" 설정 없음** — 완료 모달 표시 여부를 제어하는 사용자 설정을 도입하지 않는다.
- **내보내기 후 자동 열기 없음** — 사용자가 명시적으로 `열기`를 선택해야만 파일이 열린다.
- **신규 의존성 없음** — npm(dependencies·devDependencies)·Cargo 모두 무변경.
- **신규 Tauri command 없음** — opener 플러그인 JS API 사용. `src-tauri/` 변경은 capability JSON 1건뿐.
- **`browser_ops.rs` 변경 없음** — URL 전용이며 본 SPEC과 무관.
- **내보내기 파이프라인 변경 없음** — 렌더링·CSS 인라인화·Mermaid SVG 추출·DOCX 토큰 변환 등 SPEC-EXPORT-001 로직은 무변경. 변경은 **반환 계약**(REQ-007)에 한정한다. `generateHtmlContent`(`exportHtml.ts:70`)는 PDF 전용이므로 무변경이다.
- **모달 큐잉/중첩 없음** — 연속 내보내기는 단일 경로 슬롯을 최신 값으로 덮어쓴다(REQ-016).
- **최근 내보내기 이력 없음** — 내보낸 파일 목록/히스토리 UI 미도입.

---

## 11. Traceability (추적성)

| 요구사항 ID | 구현 대상 | 소스 앵커 |
|------------|----------|----------|
| REQ-001~005 | 완료 모달 렌더·props | `src/components/common/ConfirmDialog.tsx`(SPEC-FS-003), `AppLayout.tsx` |
| REQ-006, 011, 012 | opener 래퍼 | `src/lib/tauri/ipc.ts:16-186`(래퍼 관례 구간), `package.json` `@tauri-apps/plugin-opener`, `src-tauri/src/lib.rs:17` |
| REQ-007 | 반환 계약 | `src/lib/export/exportHtml.ts:21`·`:59`(현 반환 = HTML 문자열)·`:29-31`; `src/lib/export/exportDocx.ts:45`·`:50-52`; `src/lib/export/types.ts` |
| REQ-008 | capability | `src-tauri/capabilities/main.json:11`(`opener:default`) |
| REQ-009 | HTML 성공 | `AppLayout.tsx:140-159` → `exportHtml.ts:21` → `ipc.ts:104`(`export_save_dialog`, `file_ops.rs:139-161`) → `ipc.ts:24`(`write_file`, `file_ops.rs:48`) |
| REQ-010 | DOCX 성공 | `AppLayout.tsx:182-201` → `exportDocx.ts:45` → `ipc.ts:104` → `ipc.ts:115`(`write_binary_file`, `file_ops.rs:169-180`) |
| REQ-013, 014 | 액션 라우팅·실패 | `AppLayout.tsx`, 기존 alert 선례 `AppLayout.tsx:154-155`, `:196-197` |
| REQ-015, 016 | 모달 상태 | `AppLayout` 단일 경로 슬롯 + `exportLoading` |
| REQ-017, 018 | 취소·실패 시 미표시 | `exportHtml.ts:29-31`, `exportDocx.ts:50-52`, `AppLayout.tsx:153-156`, `:195-198` |
| REQ-019 | PDF 무변경 | `AppLayout.tsx:161-180`, `exportPdf.ts:22-24`(메커니즘 주석)·`:28`, `ipc.ts:123`, `file_ops.rs:184-187` |
| REQ-020 | 의존성 가드 | `src/test/diagramRegressionGuard.test.ts:19-43`(dependencies 배열 `toEqual`), `:45-47`(devDeps 부분 부재 단언 2건만), `src/test/aiDiagramTypeRegressionGuard.test.ts:45-55`(Cargo 배열 `toEqual`) |
| REQ-021 | 신규 command 금지 | `src-tauri/src/commands/file_ops.rs`, `src-tauri/src/lib.rs` |

### SPEC Dependencies

| SPEC ID | 관계 | 의존 내용 |
|---------|------|-----------|
| SPEC-EXPORT-001 | 기반 | HTML/PDF/DOCX 내보내기 파이프라인, `export_save_dialog`/`write_binary_file`/`print_current_window` |
| SPEC-FS-003 | **선행(필수)** | `ConfirmDialog` 컴포넌트 계약 + Playwright 가상 FS 모킹 픽스처(§ 4, § 7) |
| SPEC-EXPORT-003 | **후속(예약)** | PDF 완료 모달 — 앱이 출력 경로를 소유하는 PDF 생성 경로 전환이 선행 조건(§ 10) |
