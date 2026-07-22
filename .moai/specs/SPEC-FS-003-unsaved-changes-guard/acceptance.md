---
id: SPEC-FS-003
version: "0.0.3"
status: draft
created: "2026-07-22"
updated: "2026-07-23"
author: "jw"
priority: high
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.2 | 2026-07-22 | jw | plan-auditor 리뷰 반영 — `checkbox` 관련 DoD 항목 삭제(계약에서 제거). AC-002/AC-004의 코드 검토 성격 항목을 `[review]`로 명시 라벨링(jsdom은 스타일시트 미로드, 참조 부재는 테스트 불가). **AC-010에서 Rust 자동화 테스트 층 철회** — 런타임 없이 `CloseRequested`/`CloseRequestApi` 구성 불가, 순수 함수 추출 시 `prevent_close()`가 검증 범위 밖에 남음. diff 리뷰 + 모킹 테스트 + 수동 확인으로 정정하고 `cargo test` 게이트 주장 제거. AC-012에 새 문서·워처 트리거 시나리오 추가(REQ-024 커버리지 인플레 해소) + 워처 이벤트 폐기의 알려진 한계(재알림 없음) 명시. AC-013에서 REQ-027 참조 제거(요구 삭제됨). 신규 AC-018(INV-3 강제)·019(종료 승격 deadlock 부재)·020(AI 취소 + 부분 저장)·021(AI 고지 문구)·022(E2E 가상 FS 픽스처). 수동 체크리스트에 M6(승격 + 재종료) 추가. |
| 0.0.3 | 2026-07-23 | jw | **REQ-018 V1 해소 연동**(spec.md v0.0.4) — AC-010에서 Rust `on_window_event` diff 리뷰 항목을 철회했다. V1 검증으로 프런트엔드 `onCloseRequested` + `preventDefault` 단독이 충분해 Rust를 사용하지 않으므로, AC-010은 프런트엔드 모킹 단위 테스트(`windowCloseGuard.test.tsx`) + 수동 체크리스트(M1~M6)만으로 검증한다. |
| 0.0.1 | 2026-07-22 | jw | 최초 acceptance 작성 — Given-When-Then 시나리오 17건(AC-FS-003-001~017) + 품질 게이트 + 수동 검증 체크리스트. spec.md v0.0.2(REQ-001~035)와 1:1 정합하며 spec.md의 dangling `acceptance.md` 참조를 해소한다. 사용자 결정 3건 반영: 폴더 이동 허위 가드 제거(AC-014), 워처 모달 안전 선택지 기본 포커스(AC-016), `saveDocument` 기본 디렉터리 통일(AC-017). 윈도우 종료 가드(AC-010)는 Playwright로 검증 불가하므로 3층(Rust 테스트 + 모킹 단위 테스트 + 수동 체크리스트)으로 분리 명시. |

# Acceptance Criteria — SPEC-FS-003 (미저장 변경 가드)

검증 방식: **단위/컴포넌트 테스트 중심 + 핵심 사용자 흐름 E2E**.

- 단위/컴포넌트: vitest + @testing-library/react + jsdom
- E2E: Playwright (`npm run test:e2e`) — 파일 전환·새 문서·재진입 흐름
- Rust: `cargo test` (`src-tauri`)
- **E2E 선행 조건**: `e2e/fixtures/tauri-mock.ts`는 현재 모든 IPC에 `null`을 반환하는 24줄 스텁이다. 이 상태에서는 `read_directory`가 null을 반환해 파일 트리가 비고 **클릭할 파일이 없어** AC-007/008/009/012/013의 E2E 층이 실행조차 되지 않는다. 가상 파일시스템 픽스처(AC-022, plan.md T2b)가 먼저 완성되어야 한다.
- **윈도우 종료 가드(AC-010)는 Playwright 대상이 아니다.** Playwright E2E는 Vite dev 서버(일반 브라우저)에서 실행되어 Tauri 런타임이 없고, `WindowEvent::CloseRequested`가 발생하지 않으며 `@tauri-apps/api/window`의 `getCurrentWindow()`도 동작하지 않는다.
- **AC-010은 프런트엔드 모킹 단위 테스트 + 수동 체크리스트로 검증한다.** V1 해소(spec.md v0.0.4)로 Rust `on_window_event`를 사용하지 않아 Rust 측 검증 항목은 존재하지 않는다. `cargo test`는 컴파일 게이트일 뿐 AC-010의 근거가 아니다.

### 검증 층위 표기

시나리오 제목 뒤 표기가 없으면 자동화 테스트로 검증한다. `[review]`는 코드 검토·grep 기준(실행 테스트 아님), `[manual]`은 Tauri 런타임이 필요해 자동화 불가능한 항목이다.

## Given-When-Then Scenarios

### AC-FS-003-001: ConfirmDialog 계약 + 액션 렌더 (REQ-001, 003)

- **Given** `ConfirmDialog`에 `actions: [{id:'a'}, {id:'b'}, {id:'c', variant:'primary'}]`를 전달하고 `open={true}`로 렌더할 때
- **When** 렌더 결과를 검사하면
- **Then** 모듈이 `DialogActionVariant`·`DialogAction`·`ConfirmDialogProps` 타입을 spec.md "ConfirmDialog Contract"와 동일한 형태로 export한다(타입 테스트 또는 `tsc` 통과로 검증).
- **And** 세 버튼이 `a` → `b` → `c` 순서(좌→우)로 DOM에 나타난다.
- **And** 마지막 항목 `c`가 primary 시각 스타일을 갖고, 모달이 열린 직후 `document.activeElement`가 `c` 버튼이다.

### AC-FS-003-002: 다이얼로그 구조 + 토큰 (REQ-002, 006)

- **Given** `ConfirmDialog`가 `open={true}`로 렌더된 상태에서
- **When** DOM을 검사하면
- **Then** 백드롭 요소가 존재하고, 다이얼로그 요소가 `role="dialog"`와 `aria-modal="true"`를 갖는다. *(자동화)*
- **And** **`[review]`** `src/styles/mdedit-components.css`의 `.md-dialog*` 신규 클래스가 `--md-*` 토큰 및 `currentColor`만 참조하며 raw hex 색상 리터럴이 0건이다(다크모드는 `[data-theme="dark"]` 토큰 전환으로 자동). **jsdom은 스타일시트를 로드하지 않으므로 이 항목은 실행 테스트가 아니라 CSS grep 기반 리뷰 기준이다.**

### AC-FS-003-003: 포커스 트랩 + 복귀 + testid (REQ-004, 005)

- **Given** 트리거 버튼에 포커스가 있는 상태에서 다이얼로그를 열었을 때
- **When** Tab을 반복해서 누르면
- **Then** 포커스가 다이얼로그 내부 요소들만 순환하고 배경 요소로 빠져나가지 않는다(Shift+Tab 역방향도 동일).
- **When** 다이얼로그가 닫히면
- **Then** 포커스가 다이얼로그를 연 트리거 요소로 복귀한다.
- **And** 다이얼로그 루트와 각 액션 버튼이 `data-testid` 속성을 갖는다.

### AC-FS-003-004: dirty 단일 소스 + saveStatus 비영속화 (REQ-007, 008)

- **Given** 애플리케이션이 실행 중일 때
- **When** **`[review]`** 가드 판정 코드 경로를 grep으로 검사하면
- **Then** 어떤 가드도 `uiStore.saveStatus`를 읽지 않으며 `editorStore.dirty`만 참조한다. **참조 부재는 테스트로 증명할 수 없으므로 이 항목은 코드 리뷰 기준이다.**
- **When** `saveStatus`가 `'unsaved'`인 상태에서 `uiStore`의 `partialize` 결과를 검사하면
- **Then** 결과 객체에 `saveStatus` 키가 존재하지 않는다.
- **And** 해당 상태를 localStorage(`mdedit-ui-store`)에 저장한 뒤 재hydration해도 `saveStatus`가 `'unsaved'`로 복원되지 않는다(앱 재시작 시 stale 배지 없음).

### AC-FS-003-005: 단일 저장 함수 (REQ-009, 010)

- **Given** `saveDocument()`가 구현된 상태에서
- **When** 헤더 저장 버튼 / `Mod-s` / `Mod-Shift-s` / 모달 `저장` 4개 진입점을 각각 실행하면
- **Then** 네 경로 모두 동일한 `saveDocument()`를 호출한다(IPC를 직접 호출하는 경로가 남아 있지 않다).
- **When** `currentFilePath`가 있는 상태에서 저장이 성공하면
- **Then** `editorStore.dirty`가 false가 되고 `uiStore.saveStatus`가 `'saved'`가 된다.
- **When** 저장(IPC)이 실패하면
- **Then** `dirty`가 true로 유지되고 `saveStatus`가 `'unsaved'`가 되며, `saveDocument()`는 false를 반환한다.

### AC-FS-003-006: openFile 전 분기 dirty 리셋 (REQ-011)

- **Given** `editorStore.dirty === true`인 상태에서
- **When** `openFile`을 5개 분기 각각에 대해 호출하면 — (a) `.html`, (b) 래스터 이미지, (c) `.svg`(성공), (d) `.svg`(readFile reject), (e) too-large, (f) 일반 텍스트(성공), (g) 일반 텍스트(readFile reject)
- **Then** 모든 경우에 `editorStore.setDirty(false)`가 호출되어 `dirty`가 false가 된다(성공·실패 무관).
- **And** [E2E 회귀] 파일 A를 연 직후 파일 B를 클릭하면 미저장 변경 모달이 표시되지 않는다(결함 A 회귀 가드).

### AC-FS-003-007: 3버튼 모달 트리거 (REQ-012, 013)

- **Given** 사용자가 문서를 편집해 `dirty === true`인 상태에서
- **When** 탐색기에서 다른 파일을 클릭하면
- **Then** 인앱 모달이 열리고 `취소` / `저장 안 함` / `저장` 세 버튼이 이 순서(좌→우)로 표시되며, `저장`이 primary + 초기 포커스를 갖는다.
- **When** (동일 dirty 상태에서) 헤더 새 문서 버튼을 클릭하거나 `Mod-n`을 누르면
- **Then** 동일한 3버튼 모달이 표시되고 `resetEditor()`는 아직 실행되지 않았다.

### AC-FS-003-008: 저장 / 저장 안 함 (REQ-014, 015)

- **Given** 3버튼 모달이 열려 있고 원래 의도한 동작이 "파일 B 열기"일 때
- **When** `저장`을 선택하면
- **Then** 저장이 먼저 완료되고(파일 A의 내용이 디스크에 기록됨) **그 다음에** 파일 B가 열린다. 순서가 뒤바뀌지 않는다.
- **When** (다시 dirty 상태에서) `저장 안 함`을 선택하면
- **Then** 저장 없이 즉시 파일 B가 열리고 파일 A의 변경사항은 폐기된다(디스크의 A는 변경되지 않음).

### AC-FS-003-009: 취소 / 저장 실패 (REQ-016, 017) [edge]

- **Given** 3버튼 모달이 열려 있을 때
- **When** `취소`를 선택하거나, Escape를 누르거나, 백드롭을 클릭하면
- **Then** 모달이 닫히고 의도한 동작이 수행되지 않으며, `editorStore`의 `content`·`dirty`·`currentFilePath`가 모두 변경되지 않는다.
- **When** `저장`을 선택했으나 `saveDocument()`가 실패하거나 Save As 다이얼로그를 사용자가 취소하면
- **Then** 의도한 동작이 수행되지 **않고** `dirty`가 true로 유지된다(암묵적 데이터 손실 없음).

### AC-FS-003-010: 윈도우 종료 가드 (REQ-018, 019, 020) `[manual]` + 모킹 단위 테스트

> **Playwright 검증 대상이 아니다.** V1 해소(v0.0.4)로 Rust를 사용하지 않아 diff 리뷰 항목도 없다. `@tauri-apps/api/window` 모킹 단위 테스트로 분기를, 최종 실동작은 수동 체크리스트(M1~M6)로 확인한다.

- **Rust `on_window_event`는 V1 해소(v0.0.4)로 미사용** — 등록하지 않았으므로 diff 리뷰 항목도 없다. 종료 보류는 프런트엔드 `onCloseRequested` + `preventDefault`, 실제 종료는 `getCurrentWindow().destroy()`로 처리한다(아래 모킹 단위 테스트 + 수동 체크리스트로 검증).
- **Given** `dirty === false`인 상태에서
- **When** 종료 요청을 수신하면
- **Then** 모달을 표시하지 않고 즉시 윈도우가 닫힌다.
- **Given** `dirty === true`인 상태에서
- **When** 종료 요청을 수신하면
- **Then** 3버튼 모달이 표시되고, `저장` → 저장 완료 후 종료 / `저장 안 함` → 즉시 종료 / `취소` → 종료 취소 및 앱 계속 실행이 각각 수행된다.

### AC-FS-003-011: 워처 자동 재로드 / 충돌 모달 (REQ-021, 022, 023)

- **Given** 현재 열린 파일이 외부에서 수정되었고 `dirty === false`일 때
- **When** 워처가 `Modified` 이벤트를 전달하면
- **Then** 모달 없이 디스크 내용으로 자동 재로드된다(기존 동작 유지).
- **Given** 동일 상황에서 `dirty === true`일 때
- **When** 워처가 `Modified` 이벤트를 전달하면
- **Then** 자동 재로드가 수행되지 않고, "이 파일이 외부에서 변경되었습니다" 취지의 **미저장 변경 모달과 구분되는 별도 모달**이 표시된다.
- **And** 이 모달의 버튼은 `디스크에서 다시 읽기`와 `내 버전 유지` 두 개이며, 3버튼 세트(`취소`/`저장 안 함`/`저장`)가 아니다.
- **When** `내 버전 유지`를 선택하거나 Escape/백드롭으로 닫으면
- **Then** 에디터 내용이 변경되지 않고 `dirty`가 true로 유지된다.
- **When** `디스크에서 다시 읽기`를 선택하면
- **Then** `readFile` 결과로 내용이 덮어써지고 `dirty`가 false가 된다.

### AC-FS-003-012: 비동기 재진입 차단 — 세 트리거 전수 (REQ-024, 025) [edge]

> REQ-024는 파일 클릭·새 문서·워처 세 종류의 트리거를 억제 대상으로 규정한다. 아래는 **세 종류를 각각** 검증한다(종료 요청은 억제 대상이 아니며 AC-019가 다룬다).

- **Given** 문서가 dirty이고 파일 B를 클릭해 3버튼 모달이 열린 상태에서
- **When** 모달이 열려 있는 동안 파일 C, 파일 D를 연속으로 클릭하면
- **Then** 두 번째 모달이 중첩 표시되지 않는다.
- **And** 이후 `저장 안 함`을 선택하면 **파일 B만** 열린다(C·D는 열리지 않음 — 후속 트리거가 큐잉되지 않고 폐기됨).
- **When** `저장`을 선택한 뒤 저장이 진행되는 동안 파일 C를 클릭하면
- **Then** 저장이 두 번 수행되지 않고, 파일 C도 열리지 않는다.
- **When** (새 시나리오) 모달이 열려 있는 동안 새 문서(버튼 또는 `Mod-n`)를 실행하면
- **Then** 모달이 중첩되지 않고 `resetEditor()`가 호출되지 않으며, 원래 의도(파일 B 열기)만 유지된다.
- **When** (새 시나리오) 모달이 열려 있는 동안 현재 파일의 워처 `Modified` 이벤트가 도착하면
- **Then** 워처 모달이 중첩 표시되지 않고 자동 재로드도 수행되지 않으며, 에디터 내용이 변경되지 않는다.
- **And** **[알려진 한계 — 명시적 동작]** 이 워처 이벤트는 큐잉되지 않고 폐기되므로(REQ-025), 모달 해소 후 **디스크 변경에 대한 재알림이 오지 않는다.** 사용자는 외부 변경이 있었다는 사실을 알지 못한 채 작업을 이어갈 수 있다. 이는 큐잉 금지 결정의 의도된 대가이며, 테스트는 "재알림이 없다"를 명시적으로 어서션해 이 동작이 우연이 아님을 고정한다.

### AC-FS-003-013: dirty=false 무모달 (REQ-026)

- **Given** `dirty === false`인 상태에서
- **When** 탐색기 파일 클릭 / 새 문서 / 종료 요청 중 어떤 것을 수행해도
- **Then** 미저장 변경 모달이 표시되지 않고 의도한 동작이 즉시 수행된다(앱 최초 실행 직후의 빈 미편집 버퍼 상태도 `dirty === false`이므로 이 시나리오에 포함된다).

### AC-FS-003-014: 네이티브 다이얼로그 제거 + 폴더 이동 무가드 (REQ-028, 029)

- **Given** 본 SPEC의 전체 변경이 적용된 상태에서
- **When** 코드베이스를 검사하면
- **Then** 미저장 변경 경고 목적의 `window.confirm` / `window.alert` / `window.onbeforeunload` / Tauri 네이티브 ask·confirm 호출이 0건이다(`useFileSystem.ts:143`의 기존 호출 제거 확인).
- **Given** `dirty === true`인 상태에서
- **When** 폴더 열기(`openFolder`) / 경로로 폴더 열기(`openFolderPath`) / 폴더 변경(`changeFolder`) / 탐색기 폴더 클릭 / 상위 폴더 이동(Go-Up)을 각각 수행하면
- **Then** 어떤 경우에도 미저장 변경 모달이 표시되지 않는다.
- **And** 다섯 경로 모두에서 `editorStore`의 `content`·`dirty`·`currentFilePath`가 변경되지 않는다(문서가 그대로 유지되므로 가드가 불필요함을 코드로 고정 — 향후 가드 "복원" 시도를 실패시키는 회귀 가드).

### AC-FS-003-015: 회귀 불변식 (REQ-030, 031, 032, 033)

- **Given** 본 SPEC의 전체 변경이 적용된 상태에서
- **When** `package.json`과 기존 계약을 검사하면
- **Then** dependencies/devDependencies에 신규 런타임 의존성이 0건이다(모달/다이얼로그/focus-trap 라이브러리 미추가; `@tauri-apps/api`는 기존 의존성).
- **And** `SettingsModal.tsx`의 동작·마크업이 변경되지 않고 기존 `SettingsModal` 테스트가 무변경 통과한다.
- **And** `editorStore`의 `EditorState` 필드·액션 시그니처와 `@MX:ANCHOR`가 변경되지 않는다.
- **And** 자동 저장·크래시 복구·다중 탭/다중 문서 기능이 도입되지 않았다.

### AC-FS-003-016: 워처 모달 액션 순서 + 안전 선택지 기본 포커스 (REQ-022, 034)

- **Given** `dirty === true`인 상태에서 워처 충돌 모달이 열렸을 때
- **When** `actions` 배열과 렌더 결과를 검사하면
- **Then** 배열이 정확히 `[{ id: 'reload', label: '디스크에서 다시 읽기', variant: 'danger' }, { id: 'cancel', label: '내 버전 유지', variant: 'primary' }]` 순서다.
- **And** 모달이 열린 직후 `document.activeElement`가 `내 버전 유지` 버튼이며, 이 버튼이 primary 시각 스타일을 갖는다.
- **And** `디스크에서 다시 읽기` 버튼은 초기 포커스를 갖지 않으며 `danger` 시각 스타일로 렌더된다.
- **And** 모달이 열린 상태에서 Enter를 누르면 `내 버전 유지`가 실행된다(미저장 작업이 파괴되지 않음).

### AC-FS-003-017: Save As 기본 디렉터리 통일 (REQ-035)

- **Given** `fileStore.watchedPath`가 설정된 상태이고 `currentFilePath`가 null일 때
- **When** 헤더 저장 버튼 / `Mod-s` / `Mod-Shift-s` / 모달 `저장` 4개 진입점 각각에서 저장을 실행하면
- **Then** 네 경우 모두 Save As IPC 호출 시 `watchedPath`가 기본 디렉터리 인자로 전달된다(경로에 따른 차이 0건).
- **And** `watchedPath`가 null이면 네 경우 모두 기본 디렉터리 인자가 `undefined`로 전달된다(동작 일치).

### AC-FS-003-018: `'cancel'` 계약 불변식 강제 (REQ-036)

- **Given** 개발 빌드(`import.meta.env.DEV === true`)에서
- **When** `actions`에 `id === 'cancel'` 항목이 없는 `ConfirmDialog`를 렌더하면
- **Then** 콘솔 오류가 출력되어 계약 위반(INV-3)이 즉시 드러난다.
- **When** `id === 'cancel'` 항목이 정확히 하나 있는 `actions`로 렌더하면
- **Then** 콘솔 출력이 없다.
- **And** 프로덕션 빌드에서는 두 경우 모두 콘솔 출력이 없다(검사 미수행).

### AC-FS-003-019: 종료 승격 — deadlock 부재 (REQ-037, 024, 025)

- **Given** 문서가 dirty이고 파일 B를 클릭해 3버튼 모달이 열린 상태에서
- **When** 윈도우 종료 요청이 도착하면
- **Then** 두 번째 모달이 표시되지 않고 기존 모달이 그대로 유지된다(사용자가 보기에 화면 변화 없음).
- **And** 종료 요청이 폐기되지 않는다(REQ-024/025의 억제 대상 제외 확인).
- **When** 이 승격된 모달에서 `저장`을 선택하면
- **Then** 저장이 완료된 뒤 **파일 B는 열리지 않고** 윈도우가 닫힌다.
- **When** (동일 상황에서) `저장 안 함`을 선택하면
- **Then** 저장 없이 **파일 B는 열리지 않고** 윈도우가 닫힌다.
- **When** (동일 상황에서) `취소`를 선택하면
- **Then** 윈도우가 닫히지 않고, 파일 B도 열리지 않으며, 에디터 상태가 변경되지 않는다.
- **And** **`취소` 이후 다시 종료를 시도하면 모달이 정상적으로 다시 뜬다** — 승격 플래그가 리셋되어 창이 영구히 닫히지 않는 상태에 빠지지 않는다(deadlock 회귀 가드).
- **And** 워처 모달이 승격된 경우, `내 버전 유지`(= `'cancel'`)는 종료를 중단하고 `디스크에서 다시 읽기`는 재로드 후 윈도우를 닫는다.

### AC-FS-003-020: AI 스트리밍 취소 (REQ-038, 040, 011)

- **Given** `aiStore.requestState === 'streaming'`이고 `requestId`가 설정된 상태에서 문서가 dirty이고 3버튼 모달이 열려 있을 때
- **When** `저장 안 함`을 선택하면
- **Then** `aiCancel(requestId)`가 호출되고, **그 호출이 `openFile` 실행보다 먼저** 일어난다(호출 순서 어서션).
- **And** 취소 이후 도착하는 스트림 청크가 새로 연 파일의 버퍼에 반영되지 않으며, 새로 연 파일의 `dirty`가 false로 유지된다(REQ-011이 무효화되지 않음).
- **When** (동일 상황에서) `저장`을 선택하면
- **Then** `aiCancel(requestId)`가 저장 실행 전에 호출된다.
- **And** 그 시점까지 버퍼에 기록된 **부분 생성 결과가 그대로 디스크에 기록된다** — 부분 응답을 잘라내거나 스트림 완료를 기다리지 않는다(REQ-040, 화면과 디스크의 일치 우선).
- **When** (동일 상황에서) `취소`를 선택하면
- **Then** `aiCancel`이 호출되지 않고 스트리밍이 계속된다(사용자가 아무것도 바꾸지 않기로 했으므로).

### AC-FS-003-021: AI 중단 고지 문구 (REQ-039)

- **Given** `aiStore.requestState === 'streaming'`인 상태에서
- **When** 미저장 변경 모달이 표시되면
- **Then** 모달 메시지에 진행 중인 AI 응답이 중단된다는 고지 문구가 포함된다.
- **Given** `aiStore.requestState !== 'streaming'`인 상태에서
- **When** 동일 모달이 표시되면
- **Then** 해당 고지 문구가 포함되지 않는다.

### AC-FS-003-022: E2E 가상 파일시스템 픽스처 (E2E 인프라)

- **Given** `e2e/fixtures/tauri-mock.ts`가 가상 파일시스템 목으로 확장되고 테스트가 두 개의 파일(`a.md`, `b.md`)을 시드한 상태에서
- **When** E2E 테스트가 앱을 로드하면
- **Then** 파일 탐색기에 시드한 파일들이 렌더되고 클릭 가능한 노드로 존재한다(현재 널 스텁에서는 트리가 비어 불가능했던 상태).
- **And** `read_file`이 시드 내용을 반환하고, `write_file` 이후 `read_file`이 기록된 내용을 반환하며, `save_file_as`가 경로 또는 취소(null)를 반환하고, `start_watch`가 오류 없이 resolve한다.
- **And** 지원하지 않는 IPC 명령 호출 시 조용히 `null`을 반환하지 않고 실패하거나 경고를 남긴다(유령 통과 방지).
- **And** 기존 `e2e/html-file-viewer.spec.ts`가 무변경으로 통과한다.

## Quality Gate Criteria

| 게이트 | 기준 |
|--------|------|
| 타입 체크 | `npm run typecheck`(`tsc --noEmit`) 클린 (에러 0). `ConfirmDialogProps` 계약이 타입 수준에서 spec.md와 일치 |
| 단위/컴포넌트 테스트 | `npm test`(vitest) 전체 통과 — 신규(`ConfirmDialog.test.tsx`, `useUnsavedChangesGuard.test.ts`, `saveDocument.test.ts`, `windowCloseGuard.test.ts`) + 확장(`useFileSystem.test.ts`) + 기존 전체 무변경 통과 |
| E2E | `npm run test:e2e`(Playwright) 통과 — 신규 `e2e/unsaved-changes-guard.spec.ts` 포함. **가상 FS 픽스처(AC-022) 선행 필수**. **종료 가드(AC-010)는 E2E 범위 밖** |
| Rust | `cargo test`(`src-tauri`) 통과 — **컴파일 게이트 역할만 하며 AC-010의 검증 근거가 아니다.** V1 해소로 `on_window_event` 미사용이라 종료 핸들러 diff 리뷰 항목 없음 |
| 코드 리뷰 | `[review]` 표기 항목(AC-002 CSS 토큰, AC-004 가드 경로의 `saveStatus` 미참조, AC-010 Rust 등록) 확인 및 PR 본문 기록 |
| Lint | `npm run lint` 통과 — PR #37(2026-07-20)에서 eslint 설정이 추가되어 정상 게이트로 복귀했으므로, lint 실패는 본 SPEC 구현의 실제 결함으로 취급한다 |
| 커버리지 | 신규 코드 커밋당 80% 이상, 전체 목표 85% |
| 의존성 | `package.json` dependencies/devDependencies 무변경 |
| 수동 검증 | 아래 "수동 검증 체크리스트" 5건 전부 완료 및 결과 기록 |

## 수동 검증 체크리스트 — 윈도우 종료 가드 (자동화 게이트 아님)

`npm run tauri dev` 또는 릴리즈 빌드에서 수행하고 결과를 PR 본문에 기록한다. Playwright로 대체 불가한 항목이다(Tauri 런타임 필요).

- [ ] M1: 문서를 편집(dirty)한 뒤 창 닫기 → 3버튼 모달이 표시되고 창이 닫히지 않는다
- [ ] M2: 모달에서 `취소` → 앱이 계속 실행되고 편집 내용이 유지된다
- [ ] M3: 모달에서 `저장 안 함` → 즉시 종료된다(디스크 파일은 변경되지 않음)
- [ ] M4: 모달에서 `저장` → 저장이 완료된 뒤 종료된다(재실행 시 저장된 내용 확인)
- [ ] M5: 깨끗한 상태(dirty=false)에서 창 닫기 → 모달 없이 즉시 종료된다
- [ ] M6: 편집 후 다른 파일을 클릭해 모달이 뜬 상태에서 창 닫기 → 두 번째 모달 없이 기존 모달이 승격되고, `취소` 시 창이 유지되며 **다시 창 닫기를 시도하면 정상 동작한다**(deadlock 부재)

## Definition of Done

- [ ] AC-FS-003-001 ~ 022 전 시나리오에 대응하는 테스트가 존재하고 통과(AC-010은 모킹 단위 테스트 + 수동 체크리스트로 대체, `[review]` 항목은 리뷰 기록으로 대체)
- [ ] REQ-FS-003-001 ~ 040(027 결번) 전 요구사항이 테스트 또는 diff 리뷰로 검증됨(spec.md AC 표 하단 REQ→AC 대조 참조)
- [ ] `ConfirmDialog`가 spec.md 계약과 **문자 그대로** 일치하고 `checkbox` 관련 필드가 **존재하지 않으며**, SPEC-EXPORT-002의 계약 정의와 문자 단위로 동일함
- [ ] 계약 불변식 INV-1/INV-2/INV-3이 구현·테스트됨(특히 INV-3 개발 빌드 콘솔 오류)
- [ ] E2E 가상 FS 픽스처 완성 — 파일 트리가 렌더되고 파일 클릭 E2E가 실제로 실행됨(널 스텁 상태 탈출)
- [ ] 종료 승격 동작 확인 — 모달 열린 상태 종료 요청이 폐기되지 않고, `취소` 후 재종료가 가능함(deadlock 부재)
- [ ] AI 스트리밍 중 `저장`·`저장 안 함` 양쪽에서 `aiCancel` 선행 호출 확인, 잔여 청크가 새 파일을 오염시키지 않음 확인
- [ ] 워처 충돌 모달의 `actions` 배열 순서가 `['reload', 'cancel']`이고 `내 버전 유지`가 초기 포커스를 가짐
- [ ] `openFile` 5개 분기 전부 `setDirty(false)` 호출 확인, 파일 열기 직후 재클릭 시 무모달 확인
- [ ] `saveStatus`가 localStorage에 저장되지 않음 확인(재시작 후 stale `unsaved` 없음)
- [ ] 저장 5중 중복이 단일 `saveDocument()`로 수렴, 4개 진입점 전부 `watchedPath` 전달 확인
- [ ] 폴더 이동 5경로 무가드 + 문서 무변경 확인(허위 가드 제거가 테스트로 고정됨)
- [ ] 미저장 경고용 `window.confirm`/`onbeforeunload`/네이티브 다이얼로그 0건 확인
- [ ] 모달 열린 동안 재진입 차단(파일 1개, 저장 1회) 확인
- [ ] `npm run typecheck` 클린, `npm test` 전체 통과, `npm run test:e2e` 통과, `npm run lint` 통과, `cargo test` 통과
- [ ] 수동 검증 M1~M6 완료 및 PR 본문 기록
- [ ] 신규 런타임 의존성 0 확인, `SettingsModal` 무변경 확인, `EditorState` 계약 무변경 확인
- [ ] @MX 태그 적용(`ConfirmDialog` @MX:ANCHOR, `saveDocument` @MX:ANCHOR, 종료 리스너 @MX:WARN, 워처 액션 순서 @MX:NOTE, `useFileSystem`/`lib.rs` 기존 @MX:ANCHOR 유지)
- [ ] SPEC-EXPORT-002 담당자에게 `ConfirmDialog` 머지 완료 통지(언블록 신호)
