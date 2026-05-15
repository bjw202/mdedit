---
id: SPEC-PREVIEW-004
version: "1.3.1"
status: completed
created: "2026-05-14"
updated: "2026-05-15"
author: "jw"
priority: P2
issue_number: 0
dependencies:
  - SPEC-FS-001
  - SPEC-PREVIEW-001
  - SPEC-UI-001
  - SPEC-UI-003
tags:
  - preview
  - html-viewer
  - iframe-sandbox
  - tauri-asset-protocol
  - security
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-05-14 | jw | 최초 SPEC 작성 — 독립 HTML 파일 보기 기능 |
| 1.1.0 | 2026-05-14 | jw | REQ-003 재작성 — asset 프로토콜 런타임 scope 등록(`allow_directory`) 방식 확정. 정적 scope는 빈 배열, 폴더 열기 시 런타임 등록, 세션 누적 + 재시작 시 초기화, 경로 정규화 요구. [DELTA]에 Rust 폴더 열기 커맨드 [MODIFY] 추가. |
| 1.2.0 | 2026-05-14 | jw | REQ-003 + 인수 시나리오 5-A 정밀화 — asset scope 보안 불변식을 "재시작 시 빈 상태"에서 "사용자가 명시적으로 연 폴더만 포함(시작 시 자동 복원되는 직전 폴더 포함)"으로 수정. 수동 검증에서 SPEC-UI-003 자동 복원과의 상호작용 발견. dependencies에 SPEC-UI-003 추가. |
| 1.3.0 | 2026-05-15 | jw | 두 가지 사용성 개선 — (1) Windows WebView2에서 iframe이 CSP `frame-src` 누락 + `http://asset.localhost` 미허용으로 차단되던 회귀 수정. `tauri.conf.json` CSP에 `frame-src` 디렉티브 추가 및 Windows용 http 자산 호스트 허용. (2) REQ-PREVIEW004-005의 5MB 파일 크기 임계 제거. iframe + asset 프로토콜은 OS-level 스트리밍이므로 우리가 직접 메모리에 적재하지 않아 OOM 위협이 실재하지 않으며, Claude/Codex 산출물은 인라인 데이터로 흔히 5MB를 넘으므로 임계가 사용성만 해쳤다. |
| 1.3.1 | 2026-05-15 | jw | Windows asset URL 차단 회귀 수정 완결 — v1.3.0의 fix(commits eb6ce32 외 4건)가 잘못된 위치(`tauri.conf.json`)만 수정하여 실제로는 차단이 해소되지 않았다. 진짜 CSP 원본은 `index.html`의 `<meta http-equiv="Content-Security-Policy">` 태그였다(`tauri.conf.json`의 `csp`는 Tauri 런타임이 자동 삽입하는 CSP만 제어). `index.html`의 메타 CSP `default-src`/`img-src`/`connect-src`에 `http://asset.localhost` 추가, 명시적 `frame-src` 디렉티브 추가. 추가 방어로 `src-tauri/src/commands/directory_ops.rs`의 `canonicalize_folder_path`가 Windows `std::fs::canonicalize`가 붙이는 `\\?\` UNC 확장 경로 접두사를 제거(scope 패턴 가독성 개선). Playwright E2E 테스트(`e2e/html-file-viewer.spec.ts`)와 회귀 검증용 HTML 샘플(`samples/html/`) 추가. |

## Overview

`mdedit`(마크다운 전용 편집기)에 **독립 `.html` 파일을 웹브라우저처럼 보여주는 보기 전용 기능**을 추가한다.
HTML 파일은 편집하지 않고 보기만 하며, 내부 스크립트는 실제로 동작하고, 같은 폴더의 외부 자산(CSS·이미지)도 함께 로드된다.
앱 본체와 완전히 분리하기 위해 **샌드박스 처리된 iframe** 안에서 렌더링하며, Tauri **asset 프로토콜**을 **현재 작업 폴더로 범위를 제한**하여 활성화한다.

전체 배경·위험 분석·검증 계획·확정 결정 사항은 연구 산출물 `docs/design/html-preview.md`에 있다. 본 SPEC은 그 문서를 참조하며 내용을 중복하지 않고 EARS 요구사항과 수용 기준으로 증류한다.

이 기능은 마크다운 렌더링 파이프라인(SPEC-PREVIEW-001/002/003)과 별개의 독립 기능이며, "마크다운 안의 HTML"과도 무관하다.

## Glossary

- **HTML 보기 모드(HTML view mode)**: `.html` 파일을 선택했을 때 프리뷰 칸이 진입하는 상태. 편집기는 보기 전용 플레이스홀더를 표시한다.
- **샌드박스 iframe(sandboxed iframe)**: `sandbox` 속성으로 권한을 제한한 격리 프레임. 화면 렌더링과 스크립트 실행만 허용하고 앱 본체 접근은 차단한다.
- **asset 프로토콜(asset protocol)**: Tauri가 로컬 파일을 WebView로 안전하게 전달하는 통로. 빌드 타임 정적 설정은 `tauri.conf.json`의 `app.security.assetProtocol`이고, 런타임 허용 범위는 Rust 백엔드에서 앱 핸들의 asset 프로토콜 scope 객체(`tauri::scope::fs::Scope`)로 제어한다.
- **런타임 scope 등록(runtime scope registration)**: Rust 백엔드가 폴더를 열 때마다 asset 프로토콜 scope 객체의 `allow_directory(<정규화된 폴더 경로>, recursive=true)`를 호출해 해당 폴더를 허용 목록에 추가하는 동작. `forbid_*`는 영구적이며 allow보다 우선하므로 사용하지 않는다.
- **세션 누적(session-cumulative)**: 런타임 scope는 사용자가 이번 세션에서 명시적으로 연 폴더만 누적한다. Rust 프로세스는 빈 asset scope로 시작하지만, 프런트엔드의 시작 시 자동 복원(SPEC-UI-003)이 직전에 연 폴더를 즉시 다시 등록할 수 있다. 보안 불변식은 "scope는 사용자가 명시적으로 연 폴더만 포함한다"이며, "수동 조작 전까지 scope가 빈 상태"가 아니다.
- **시작 시 자동 복원(startup auto-restore)**: 앱이 시작할 때 직전 세션에서 열었던 폴더를 자동으로 다시 여는 기존 기능(SPEC-UI-003, `src/App.tsx`). 이 동작은 `openFolderPath`를 호출하므로 본 SPEC의 런타임 scope 등록도 함께 트리거한다. 자동 복원되는 폴더는 사용자가 직전 세션에서 명시적으로 연(따라서 이미 신뢰한) 폴더이며, 시작 시 HTML이 자동 렌더링되지는 않으므로(사용자가 `.html` 파일을 클릭해야 함) 자동 실행 공격면을 추가하지 않는다.
- **작업 폴더(working folder)**: 사이드바에 현재 열려 있는 루트 디렉터리(`fileStore.watchedPath`).
- **파일 종류 분기(file-type routing)**: 선택된 파일의 확장자를 보고 마크다운 경로와 HTML 경로 중 알맞은 화면으로 보내는 로직.

## EARS Requirements

### REQ-PREVIEW004-001: HTML 보기 모드 진입 (Event-driven)

- **WHEN** 사용자가 사이드바에서 `.html` 파일을 선택하면, **the system shall** 파일 종류 분기 로직으로 HTML 경로를 식별하고 프리뷰 칸을 HTML 보기 모드로 전환한다.
- **WHEN** 사용자가 `.html` 파일을 선택하면, **the system shall** 편집기에 파일 내용을 싣지 않고 "이 형식은 편집할 수 없습니다" 보기 전용 플레이스홀더를 표시한다.
- **WHEN** 사용자가 HTML 보기 모드에서 다시 `.md` 파일을 선택하면, **the system shall** 프리뷰 칸을 기존 마크다운 렌더링 모드로 복귀시키고 편집기를 정상 편집 가능 상태로 되돌린다.

### REQ-PREVIEW004-002: 샌드박스 iframe 렌더링 (Ubiquitous + State-driven)

- The system **shall** 모든 `.html` 파일을 `sandbox` 속성이 적용된 격리 iframe 안에서만 렌더링하며, 앱 본체 DOM에 직접 펼치지 않는다.
- The system **shall** iframe `sandbox`에 화면 렌더링과 스크립트 실행에 필요한 최소 권한(`allow-scripts` 등)만 부여하고, 앱 본체·앱 권한 접근에 해당하는 권한은 부여하지 않는다.
- **WHILE** HTML 보기 모드가 활성 상태인 동안, the system **shall** HTML의 스타일·레이아웃이 iframe 경계를 넘어 앱 셸로 새어 나가지 않도록 격리를 유지한다.

### REQ-PREVIEW004-003: 런타임 scope 등록 기반 asset 프로토콜 (Ubiquitous + Event-driven + Optional)

- The system **shall** `tauri.conf.json`에 `app.security.assetProtocol` 블록을 추가하여 `enable: true`로 설정하고 정적 `scope`는 빈 배열(`[]`)로 두어, 기본 상태에서는 어떤 로컬 파일도 asset 프로토콜로 전달되지 않도록 한다(보안 기본값).
- **WHEN** 사용자가 작업 폴더를 열거나 다른 폴더로 전환하면, the system **shall** Rust 백엔드의 폴더 열기 커맨드에서 asset 프로토콜 scope 객체의 `allow_directory(<폴더 경로>, recursive=true)`를 호출하여 해당 폴더와 하위 경로를 런타임 허용 범위에 등록한다.
- The system **shall** `allow_directory`에 전달하기 전 폴더 경로를 정규화(절대 경로화 + 심링크 해소)하며, 이는 SPEC-FS-001의 기존 경로 탈출 처리와 일관되게 수행한다.
- The system **shall** 런타임 asset scope를 세션 누적 방식으로 관리하여, scope가 **사용자가 명시적으로 연 폴더만** 포함하도록 보장한다. Rust 프로세스 시작 시점의 asset scope는 비어 있으나, **WHEN** 앱 시작 시 SPEC-UI-003의 자동 복원이 직전에 연 폴더를 다시 열면, the system **shall** 그 폴더를 런타임 scope에 등록한다 — 자동 복원되는 폴더는 사용자가 직전 세션에서 명시적으로 연 폴더이므로 보안 불변식("scope는 사용자가 명시적으로 연 폴더만 포함")이 그대로 유지된다. 보안 불변식은 "scope가 비어 있다"가 아니라 "scope가 사용자가 연 폴더로 한정된다(bounded)"이다. `forbid_*` 계열은 영구적이고 재오픈을 막으므로 사용하지 않는다.
- **Where** 하위 폴더의 HTML 파일이 상위 폴더의 자산을 참조하는 경우, the system **shall** 해당 자산이 등록된 폴더의 `폴더/**` glob 범위 안에 있는 한 정상적으로 로드한다.

> 구현 메모: Rust 측 정확한 accessor 이름(예: `asset_protocol_scope()`)은 run 단계에서 고정된 Tauri 버전에 대해 확인해야 한다. 메커니즘(런타임 `allow_directory` 등록 + 빈 정적 scope + 세션 누적 + 경로 정규화)은 확정 사항이다.
> SPEC-UI-003 상호작용 메모: `src/App.tsx`의 시작 시 자동 복원(REQ-UI-003-06/07)이 `openFolderPath(lastWatchedPath)`를 호출하므로, 본 SPEC의 M1 구현 이후에는 자동 복원이 `allow_directory`를 함께 호출하게 된다. 이는 의도된 동작이다 — 자동 복원되는 폴더는 사용자가 이전에 명시적으로 연 폴더이고, scope는 여전히 bounded(`/etc/passwd` 등은 차단)이므로 보안 약화가 아니다. 수동 검증에서 이 상호작용이 발견되었다(원래 "재시작 시 빈 상태" 문구는 SPEC-UI-003 자동 복원을 고려하지 못했다).

### REQ-PREVIEW004-004: 사이드바 HTML 파일 노출 (Event-driven)

- **WHEN** 사이드바 파일 트리가 필터링될 때, the system **shall** `filterMdOnly` 필터를 확장하여 `.md` 파일과 함께 `.html` 파일도 트리에 표시한다.
- The system **shall** 디렉터리는 기존과 동일하게 항상 표시하여 사용자가 폴더를 탐색할 수 있도록 한다.

### REQ-PREVIEW004-005: 비정상 입력 및 위험 차단 (Unwanted behavior)

- **IF** HTML 파일이 앱 권한(파일 읽기·쓰기·삭제 등)에 접근을 시도하면, **then the system shall** iframe 격리로 해당 접근을 차단한다.
- **IF** HTML 또는 그 참조 자산이 `../` 등으로 등록된 폴더 밖 경로에 접근을 시도하면, **then the system shall** 해당 경로가 등록된 `폴더/**` glob에 매칭되지 않으므로 asset 프로토콜 scope에 의해 자동으로 차단한다.
- **IF** HTML이 어떤 등록된 폴더에도 속하지 않는 절대 경로(예: `/etc/passwd`)를 참조하면, **then the system shall** 그 경로가 허용 패턴 중 어느 것에도 매칭되지 않으므로 차단한다.
- **IF** HTML 파일을 읽거나 iframe에 로드하는 중 오류가 발생하면, **then the system shall** 앱을 중단시키지 않고 오류 안내를 표시한다.

> v1.2.0의 "5MB 초과 시 미리보기 불가" 조건은 v1.3.0에서 제거되었다. iframe + asset 프로토콜이 OS-level 스트리밍이므로 우리 측에서 파일을 메모리에 적재하지 않아 OOM 보호 명목의 임계가 실재하지 않는 위협을 막고 있었고, 실제로는 Claude/Codex 산출물(인라인 base64 이미지·임베드 데이터)의 정상 사용을 차단하는 회귀였다.

## [DELTA] Brownfield Change Map

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [MODIFY] | `src-tauri/tauri.conf.json` | `app.security.assetProtocol` 블록 신규 추가 — 정확히 `{ "enable": true, "scope": [] }`. 정적 scope를 빈 배열로 두어 기본 상태에서 로컬 파일 전달이 차단된다(런타임 등록으로만 허용). 기존 `app.security.csp`는 이미 `asset:`·`https://asset.localhost`를 포함하므로 그대로 둔다. |
| [MODIFY] | `src-tauri/` 폴더/디렉터리 열기 커맨드 (SPEC-FS-001의 네이티브 디렉터리 다이얼로그·폴더 로딩 처리 커맨드) | asset 프로토콜 scope 객체의 `allow_directory(<정규화된 폴더 경로>, recursive=true)` 호출 추가. 폴더를 열거나 전환할 때마다 해당 폴더를 런타임 허용 범위에 등록. 경로는 SPEC-FS-001의 기존 처리와 일관되게 정규화. |
| [MODIFY] | `src/components/sidebar/FileExplorer.tsx` | `filterMdOnly` 함수(약 39-49행)의 `.endsWith('.md')` 조건을 `.md` 또는 `.html` 둘 다 통과하도록 확장. |
| [MODIFY] | `src/hooks/useFileSystem.ts` | `openFile` 동작에 확장자 분기 추가 — `.html` 파일은 `readFile`로 편집기에 싣지 않고 HTML 보기 상태(파일 경로·종류)를 store에 설정. |
| [MODIFY] | `src/components/editor/MarkdownEditor.tsx` (및 editor 패널) | HTML 파일이 선택된 상태일 때 편집기 대신 "이 형식은 편집할 수 없습니다" 보기 전용 플레이스홀더 표시. |
| [MODIFY] | `src/components/layout/AppLayout.tsx` | 프리뷰 슬롯을 파일 종류 분기 컴포넌트로 교체 — 마크다운이면 `MarkdownPreview`, HTML이면 신규 HTML 보기 컴포넌트. |
| [NEW] | `src/components/preview/HtmlFileViewer.tsx` | 샌드박스 iframe을 띄우고 그 안에 HTML을 펼치는 신규 컴포넌트. (설계문서가 가정한 `HtmlPreview`/`PreviewPanel` 명칭 대신 실제 코드베이스 명명 규칙에 맞춰 `HtmlFileViewer`로 확정.) |
| [NEW] | `src/components/preview/PreviewContainer.tsx` | 파일 종류 분기 컴포넌트 — 현재 선택 파일의 확장자를 보고 `MarkdownPreview` 또는 `HtmlFileViewer` 중 하나를 렌더. 기존 `MarkdownPreview`/`PreviewRenderer`는 변경 없이 마크다운 경로에서 그대로 재사용. |
| [EXISTING] | `src/components/preview/MarkdownPreview.tsx`, `PreviewRenderer.tsx` | 변경 없음 — `PreviewContainer`가 마크다운 분기에서 그대로 호출. |
| [EXISTING] | `src-tauri/` 파일 CRUD (SPEC-FS-001 경로 검증 로직) | 변경 없음 — 의존성으로만 사용. 단 폴더 열기 커맨드는 위 [MODIFY] 항목으로 별도 변경됨. |

## Exclusions (What NOT to Build)

- **HTML 편집 기능 미포함** — `.html` 파일은 보기 전용. 편집 대상은 마크다운에 한정한다. CodeMirror 편집기를 HTML에 연결하지 않는다.
- **네트워크 요청 차단 미포함** — "스크립트 실행"을 허용하므로 악성 HTML이 인터넷으로 정보를 전송할 가능성은 완전히 막을 수 없다. 이는 `docs/design/html-preview.md` 4·결정 사항에서 명시적으로 수용한 **잔존 위험**이며, "신뢰할 수 있는 HTML만 연다"는 전제로 진행한다. 읽을 수 있는 정보 자체는 작업 폴더로 제한된다.
- **마크다운 안의 HTML 처리 미포함** — 마크다운 문서 내부에 임베드된 raw HTML 처리(현재 `markdown-it` `html:false`로 차단)는 별개의 기존 관심사이며 본 SPEC 범위가 아니다.
- **HTML 검색·아웃라인·스크롤 싱크 미포함** — HTML 보기는 단순 표시에 한정. 마크다운 전용 기능(스크롤 싱크 SPEC-PREVIEW-002 등)을 HTML에 확장하지 않는다.
- **앱 본체 보안 설정 약화 미포함** — 기존 `app.security.csp`를 완화하지 않는다. 새 기능에 필요한 최소 설정(`assetProtocol` 블록)만 추가한다.
- **다중 작업 폴더·임의 경로 열람 미포함** — asset 프로토콜 scope는 현재 단일 작업 폴더로 한정한다.

## Implementation Notes

### 배포된 구현 (Commits 0196b74 ~ bc11570)

실제 구현에서 다음 요소들이 SPEC의 EARS 요구사항과 일치하게 확정되었다:

#### 1. Sandbox iframe 보안 개선 (Commit 48028f4)

**발견**: HtmlFileViewer의 iframe `sandbox` 속성이 초기에 `allow-scripts`만 포함했을 때, HTML의 external CSS와 이미지가 로드되지 않았다.

**원인**: iframe이 same-origin-only 정책으로 제한되어, 같은 폴더의 자산 접근이 차단됨.

**해결**: `sandbox="allow-scripts allow-same-origin"`으로 확장. asset 프로토콜의 scope로 인해 앱 권한 접근은 여전히 차단되며, `allow-same-origin`은 파일:// 기반 상대경로 자산 로드만 허용하므로 보안 불변식 유지.

**결과**: 시나리오 1(CSS·이미지·스크립트 정상 로드)·3(allow-same-origin 후에도 IPC 차단 유지) 모두 PASS.

#### 2. iframe Asset URL 디코딩 (Commit b9e64dd)

**발견**: HtmlFileViewer가 asset URL을 `asset://localhost/path%2Fto%2Ffile.html`로 구성할 때, 상대경로 자산(`<img src="image.png">`)이 해석되지 않음.

**원인**: iframe 내부의 상대경로는 현재 문서의 "location"을 기반으로 해석되는데, 퍼센트-인코딩된 슬래시(`%2F`)는 경로 구분자로 인식되지 않음.

**해결**: iframe 내부에서 사용할 asset URL을 `asset://localhost/path/to/file.html` (슬래시 정상화)로 제공. Tauri asset 프로토콜이 URL 디코딩을 자동 처리하므로 안전.

**결과**: 상대경로 자산(CSS, 이미지) 정상 해석 및 로드.

#### 3. Runtime Scope와 시작 시 자동 복원 상호작용 정밀화 (Commit bc11570)

**발견**: SPEC v1.1.0의 "재시작 시 빈 상태"라는 표현이 SPEC-UI-003의 자동 복원 메커니즘과 충돌 가능.

**정확한 모델**: 
- Rust 프로세스 시작 시 asset scope는 비어 있음.
- 그러나 SPEC-UI-003에서 즉시 자동 복원이 `openFolderPath(lastWatchedPath)`를 호출하여, 보안 불변식("scope는 사용자가 명시적으로 연 폴더만 포함")을 유지하면서 runtime scope에 직전 폴더를 등록함.
- 자동 복원되는 폴더는 사용자가 직전 세션에서 명시적으로 연 폴더이므로 신뢰 가능. HTML이 자동 렌더링되지는 않으므로 자동 실행 공격면 추가 없음.
- 보안 불변식의 핵심: "scope가 비어 있다"가 아니라 "scope가 사용자가 연 폴더로 한정(bounded)된다".

**갱신**: SPEC v1.2.0에서 REQ-PREVIEW004-003 및 관련 구현 메모 정밀화.

**결과**: 시나리오 5-A (restore=200, /etc/passwd=403) PASS로 scope의 bounded nature 증명.

#### 4. Windows WebView2 CSP 차단 회귀 수정 (v1.3.0, Commit eb6ce32)

**발견**: macOS에서 정상 작동하던 HTML 미리보기가 Windows에서 "이 콘텐츠는 차단되었습니다" 메시지로 막혔다.

**원인**: 두 가지 동시 누락.
- `tauri.conf.json`의 CSP에 `frame-src` 디렉티브가 명시되어 있지 않아 Chromium 기반 WebView2가 iframe 로드를 거부 (macOS WKWebView는 `default-src`로 fallback 허용).
- Windows Tauri v2의 자산 프로토콜 URL은 `http://asset.localhost`인데 CSP는 `https://asset.localhost`만 허용.

**해결**: CSP에 `frame-src 'self' asset: https://asset.localhost http://asset.localhost` 디렉티브 추가 + 기존 디렉티브들에 `http://asset.localhost` 도 함께 허용.

**보안 영향 검토**: iframe은 부모와 독립된 보안 컨텍스트이므로 부모 CSP는 "iframe을 로드할 수 있는지"만 결정한다. iframe 내부 렌더링은 `sandbox` 속성과 자체 보안 정책으로 격리되므로, CSP를 완화해도 시나리오 3(IPC 접근 차단) 등 보안 불변식은 그대로 유효하다.

#### 5. 5MB 파일 크기 임계 제거 (v1.3.0)

**발견**: Claude/Codex가 생성한 HTML(인라인 base64 이미지·임베드 데이터 포함)이 5MB를 초과하는 경우가 흔하며, 사용자가 정확히 그 용도로 mdedit을 사용하려 했다.

**원인 재분석**: 임계는 OOM 보호 명목으로 도입되었지만, iframe + asset 프로토콜 경로는 Tauri/OS-level 스트리밍이라 Rust/JS 어느 쪽도 파일을 메모리에 적재하지 않는다 (`read_file` IPC를 거치지 않음). 임계가 보호하려던 위협이 실재하지 않았다.

**해결**: `HtmlFileViewer`에서 `shouldRenderHtml`, `HTML_PREVIEW_MAX_BYTES`, `findFileSizeInTree` 제거. 컴포넌트는 iframe + asset URL 변환만 담당. REQ-PREVIEW004-005의 "IF 5MB 초과..." 항목 삭제.

**테스트 영향**: `src/test/HtmlFileViewer.test.tsx`의 `shouldRenderHtml` describe 블록 및 크기 분기 테스트 제거. `src/test/PreviewContainer.test.tsx`의 mock에서 관련 export 제거.

#### 6. Windows asset URL 차단 회귀 완결 수정 (v1.3.1)

**발견**: v1.3.0의 fix(commits eb6ce32 → c350b03 → 4d50d9d → 40e012d → 1a668c1, 총 5건)를 적용하고도 Windows에서 여전히 "콘텐츠 차단" 페이지가 떴다. 사용자가 GitHub에 푸시 후 Windows에서 clone 받아 다시 재현·디버깅.

**원인 재진단**: v1.3.0의 모든 CSP 수정 시도가 잘못된 파일을 대상으로 했다. CSP 원본은 `tauri.conf.json`이 아니라 `index.html`의 `<meta http-equiv="Content-Security-Policy">` 태그였다. `tauri.conf.json`의 `csp` 키는 Tauri 런타임이 자동 삽입하는 CSP만 제어하므로, `<meta>` 태그 기반 CSP에는 영향이 없다. (이전에 `csp: null`로 설정한 것도 같은 이유로 효과 없음.)

DevTools Console 메시지가 결정적 단서:
- `Framing 'http://asset.localhost/' violates the following Content Security Policy directive: "default-src 'self' tauri: asset: https://asset.localhost". 'frame-src' was not explicitly set, so 'default-src' is used as a fallback.`
- `default-src`가 `https://asset.localhost`만 허용하는데 Windows의 실제 자산 URL은 `http://asset.localhost`.
- WebView2(Chromium 기반)는 CSP 위반 시 iframe 로드를 차단하고 chrome-error 페이지를 표시 → 외형은 Tauri의 asset scope 거부(403)와 구분이 어렵다.

**해결**:
- `index.html` `<meta>` CSP 수정:
  - `default-src`, `img-src`, `connect-src`에 `http://asset.localhost` 추가
  - 명시적 `frame-src 'self' asset: http://asset.localhost https://asset.localhost` 추가 (default-src 폴백 의존 제거)
- 방어 강화: `src-tauri/src/commands/directory_ops.rs:canonicalize_folder_path`가 Windows `std::fs::canonicalize`가 붙이는 `\\?\` UNC 확장 경로 접두사를 제거. Tauri v2 `Scope::push_pattern`(crates/tauri-2.10.3/src/scope/fs.rs:75-131)이 내부적으로 UNC/일반 경로 양쪽 패턴을 생성하므로 본 fix가 매칭 실패를 유발하지는 않았지만, `register_asset_scope`가 등록하는 패턴 목록의 가독성이 향상되고 디버깅이 쉬워진다.

**테스트**:
- 새 Playwright E2E `e2e/html-file-viewer.spec.ts` — webkit 프로젝트에서 3개 시나리오 검증 (iframe 렌더링 / `%5C` URL 정규화 / `http://asset.localhost` 형식, Windows userAgent mock).
- 회귀 검증용 HTML 샘플 `samples/html/01-basic.html`, `02-rich-content.html`, `03-interactive.html` + `samples/html/README.md` 추가. `03-interactive.html`은 sandbox 격리(`window.parent` 접근 차단) 수동 검증도 겸한다.
- Rust 단위 테스트에 `test_canonicalize_folder_path_windows_unc_접두사_제거` 추가 — `\\?\` 접두사가 결과 PathBuf에 남지 않음을 검증.

**디버깅 노트**:
- CSP는 여러 곳(HTTP 응답 헤더, `<meta>` 태그, 프레임워크 자동 생성)에서 설정될 수 있다. 한 곳만 수정하면 다른 곳의 CSP가 계속 적용된다.
- DevTools Console의 CSP 위반 메시지를 가장 먼저 확인해야 한다. 그 한 줄에 정확한 위반 디렉티브와 차단된 URL이 모두 들어 있다.
- macOS의 자산 스킴 `asset://localhost/`은 `'self'` 또는 `asset:`로 허용되지만, Windows의 `http://asset.localhost`은 HTTP 스킴이라 `https://asset.localhost` 단독으로는 매칭되지 않는다.
- `tauri.conf.json` 수정으로 `<meta>` CSP를 우회/덮어쓸 수 없다 — 두 CSP는 독립적으로 강제된다.

**보안 영향**: iframe은 부모와 독립된 보안 컨텍스트이며 `sandbox="allow-scripts allow-same-origin"`으로 격리됨. 부모 CSP `frame-src`를 완화해도 iframe 내부 렌더링의 격리 불변식은 유지되므로 시나리오 3(IPC 접근 차단)·5-A(scope 외부 경로 차단) 등 보안 약속에는 영향 없음. `http://asset.localhost`은 Tauri가 가로채는 가짜 호스트(WebView2 WebResourceRequested 필터)이며 실제 네트워크 요청은 발생하지 않는다.

---

## References

- `docs/design/html-preview.md` — 권위 있는 설계문서 (범위·위험·검증·진행 순서·확정 결정)
- SPEC-FS-001 — Rust 파일 CRUD + 경로 탈출 검증 (의존성)
- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인 (회귀 검증 대상)
- SPEC-UI-001 — 레이아웃·테마 셸 (프리뷰 슬롯 통합 지점)
- SPEC-UI-003 — 시작 시 직전 폴더 자동 복원 (REQ-UI-003-06/07, `src/App.tsx`). 자동 복원이 `openFolderPath`를 통해 본 SPEC의 런타임 scope 등록을 트리거하므로 REQ-PREVIEW004-003의 보안 불변식과 직접 상호작용한다. (의존성)
