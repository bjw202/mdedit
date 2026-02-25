---
id: SPEC-EXPORT-001
version: 1.0.0
status: implemented
created: 2026-02-25
updated: 2026-02-25
author: jw
priority: medium
domain: EXPORT
title: "Markdown Document Export (PDF/HTML/DOCX)"
tags:
  - SPEC-EXPORT-001
  - export
  - pdf
  - html
  - docx
  - mermaid
  - shiki
lifecycle: spec-first
---

# SPEC-EXPORT-001: Markdown Document Export (PDF/HTML/DOCX)

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-02-25 | jw | 초기 SPEC 작성 |

---

## 1. Environment (환경)

### 프로젝트 컨텍스트
- **애플리케이션**: MdEdit (Tauri v2 + React 18 마크다운 에디터)
- **플랫폼**: macOS, Windows, Linux (크로스 플랫폼)
- **기술 스택**: TypeScript (strict mode), React 18, Zustand 5.x, Tauri v2, markdown-it 14.x, Shiki v1.x, Mermaid v11.x
- **대상 영역**: 렌더링된 마크다운 문서를 외부 파일 포맷(PDF, HTML, DOCX)으로 내보내기

### 현재 상태
- 마크다운 렌더링 파이프라인이 완성되어 있음 (`renderer.ts:56-96` -> `PreviewRenderer.tsx:22-51`)
- markdown-it + Shiki(구문 강조) + Mermaid(다이어그램) 조합으로 HTML 생성
- Shiki는 인라인 스타일 `<span>` 요소를 생성하여 CSS 의존성 없음
- Mermaid는 클라이언트 사이드에서 SVG로 비동기 렌더링
- `save_file_as` Tauri 명령어와 파일 저장 다이얼로그 패턴이 이미 구현됨 (`file_ops.rs:85-111`)
- IPC 래퍼 패턴 확립 (`ipc.ts`)
- Header 컴포넌트에 버튼 배치 패턴 존재 (`Header.tsx:31-54`)
- 프리뷰 CSS 클래스가 정의됨 (`index.css:25-117`)

### 제약 조건
- `html: false` markdown-it 설정은 보안 요구사항이므로 변경 금지
- Mermaid는 클라이언트 사이드에서만 렌더링 가능 (비동기 SVG 주입)
- Shiki 테마는 현재 `github-light`로 하드코딩됨 (`renderer.ts:75`)
- TypeScript strict mode 준수 필수
- 크로스 플랫폼 경로 처리 필요 (Windows `\` vs Unix `/`)

---

## 2. Assumptions (가정)

| ID | 가정 | 신뢰도 | 근거 | 위반 시 영향 |
|----|------|--------|------|-------------|
| A1 | Webview Print-to-PDF API가 모든 타겟 플랫폼에서 동작한다 | Medium | Tauri v2의 WebView2(Windows), WKWebView(macOS), WebKitGTK(Linux) 기반이며, 각각 print 기능을 지원하나 세부 동작 차이 가능 | PDF 내보내기가 특정 OS에서 미동작, 대체 방안 필요 |
| A2 | `docx` npm 패키지(~50KB gzip)가 Tauri 환경에서 정상 동작한다 | High | 순수 JavaScript 패키지이므로 브라우저/Node 환경 모두 호환 | DOCX 내보내기 기능 불가, 대체 패키지 탐색 필요 |
| A3 | Mermaid SVG가 렌더링 완료된 후 DOM에서 추출 가능하다 | High | 현재 `PreviewRenderer`가 `dangerouslySetInnerHTML`로 렌더링 후 Mermaid가 SVG를 주입하는 패턴 확인 | HTML/PDF에 다이어그램 누락, 렌더링 완료 대기 로직 필요 |
| A4 | 프리뷰 패널의 CSS를 인라인으로 변환하여 self-contained HTML 생성이 가능하다 | High | `index.css:25-117`의 프리뷰 CSS가 분리되어 있으며, CSS 인라인화는 표준 기법 | HTML 내보내기 파일이 스타일 없이 렌더링됨 |
| A5 | `tauri-plugin-dialog`의 `blocking_save_file`로 PDF/HTML/DOCX 파일 필터를 적용할 수 있다 | High | 기존 `save_file_as`에서 `.md` 필터를 사용하는 패턴이 동작 중 (`file_ops.rs:85-111`) | 파일 저장 다이얼로그에서 포맷별 필터링 불가 |
| A6 | Mermaid SVG를 canvas를 통해 PNG로 변환할 수 있다 | Medium | 표준 `canvas.drawImage` + `toDataURL` 기법이지만, SVG foreignObject 포함 시 CORS/보안 제약 가능 | DOCX에 다이어그램을 이미지로 포함 불가, 텍스트 대체 필요 |

---

## 3. Requirements (요구사항)

### Module 1: HTML 내보내기 (HTML Export)

**REQ-EXPORT-001** (Event-Driven)
> **WHEN** 사용자가 Export 메뉴에서 "HTML"을 선택하면,
> **THEN** 시스템은 현재 렌더링된 마크다운을 self-contained HTML 파일로 변환하고, OS 네이티브 파일 저장 다이얼로그를 `.html` 필터와 함께 표시하여 사용자가 지정한 경로에 저장해야 한다.

**REQ-EXPORT-002** (Ubiquitous)
> 시스템은 **항상** HTML 내보내기 시 모든 CSS를 인라인으로 포함하여 외부 의존성 없는 self-contained HTML 파일을 생성해야 한다.

**REQ-EXPORT-003** (Ubiquitous)
> 시스템은 **항상** HTML 내보내기 시 Mermaid 다이어그램을 인라인 SVG로 포함해야 한다 (JavaScript 의존성 제거).

**REQ-EXPORT-004** (Ubiquitous)
> 시스템은 **항상** HTML 내보내기 시 Shiki 구문 강조의 인라인 스타일을 보존해야 한다.

### Module 2: PDF 내보내기 (PDF Export)

**REQ-EXPORT-005** (Event-Driven)
> **WHEN** 사용자가 Export 메뉴에서 "PDF"를 선택하면,
> **THEN** 시스템은 Webview Print-to-PDF 기능을 통해 현재 렌더링된 마크다운을 PDF로 변환하고, 사용자가 저장 위치를 선택할 수 있도록 해야 한다.

**REQ-EXPORT-006** (Ubiquitous)
> 시스템은 **항상** PDF 내보내기 시 프리뷰 패널에 표시되는 것과 동일한 시각적 품질을 유지해야 한다 (Mermaid 다이어그램, Shiki 구문 강조 포함).

### Module 3: DOCX 내보내기 (DOCX Export)

**REQ-EXPORT-007** (Event-Driven)
> **WHEN** 사용자가 Export 메뉴에서 "DOCX"를 선택하면,
> **THEN** 시스템은 현재 마크다운 콘텐츠를 포맷이 보존된 DOCX 파일로 변환하고, OS 네이티브 파일 저장 다이얼로그를 `.docx` 필터와 함께 표시하여 저장해야 한다.

**REQ-EXPORT-008** (Ubiquitous)
> 시스템은 **항상** DOCX 내보내기 시 마크다운 요소(제목, 리스트, 표, 코드 블록, 인용구, 볼드, 이탤릭, 링크)를 해당하는 DOCX 서식으로 매핑해야 한다.

**REQ-EXPORT-009** (Ubiquitous)
> 시스템은 **항상** DOCX 내보내기 시 Shiki 구문 강조 색상을 `docx.TextRun`의 color 속성으로 변환하여 보존해야 한다.

**REQ-EXPORT-010** (Event-Driven)
> **WHEN** DOCX 내보내기 시 Mermaid 다이어그램이 포함된 마크다운을 처리하면,
> **THEN** 시스템은 SVG를 PNG로 변환하여 DOCX에 이미지로 삽입해야 한다.

### Module 4: Export UI (내보내기 인터페이스)

**REQ-EXPORT-011** (Event-Driven)
> **WHEN** 사용자가 Header의 Export 버튼/드롭다운을 클릭하면,
> **THEN** 시스템은 내보내기 포맷 선택 메뉴(HTML, PDF, DOCX)를 표시해야 한다.

**REQ-EXPORT-012** (State-Driven)
> **IF** 에디터에 콘텐츠가 없으면 (`content === ""`),
> **THEN** 시스템은 Export 버튼을 비활성화(disabled) 상태로 표시해야 한다.

**REQ-EXPORT-013** (Event-Driven)
> **WHEN** 내보내기 처리가 진행 중이면,
> **THEN** 시스템은 사용자에게 진행 상태를 시각적으로 표시해야 한다 (예: 버튼 로딩 상태, 스피너).

### Module 5: 테마 인식 내보내기 (Theme-Aware Export)

**REQ-EXPORT-014** (State-Driven)
> **IF** 사용자가 다크 모드를 사용 중이면,
> **THEN** HTML 및 PDF 내보내기 시 다크 모드 스타일이 적용되어야 한다.

**REQ-EXPORT-015** (State-Driven)
> **IF** 사용자가 라이트 모드를 사용 중이면,
> **THEN** HTML 및 PDF 내보내기 시 라이트 모드 스타일이 적용되어야 한다.

### Module 6: 파일 저장 다이얼로그 (Save Dialog)

**REQ-EXPORT-016** (Ubiquitous)
> 시스템은 **항상** 내보내기 시 현재 편집 중인 파일명을 기본 파일명으로 제안해야 한다 (예: `document.md` -> `document.html`).

**REQ-EXPORT-017** (Event-Driven)
> **WHEN** 사용자가 파일 저장 다이얼로그를 취소하면,
> **THEN** 시스템은 내보내기를 중단하고 에디터 상태를 변경하지 않아야 한다.

### Module 7: 에러 처리 (Error Handling)

**REQ-EXPORT-018** (Unwanted)
> 시스템은 내보내기 실패 시 사용자에게 에러를 알리지 않고 조용히 실패**하지 않아야 한다**. 실패 시 사용자에게 명확한 에러 메시지를 표시해야 한다.

**REQ-EXPORT-019** (Unwanted)
> 시스템은 내보내기 도중 에디터 콘텐츠를 수정**하지 않아야 한다**.

**REQ-EXPORT-020** (Unwanted)
> 시스템은 내보내기 파일에 JavaScript를 포함**하지 않아야 한다** (HTML 내보내기 시 Mermaid JS 제거, SVG만 포함).

---

## 4. Specifications (사양)

### 4.1 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│  Header.tsx                                          │
│  [Export ▼] 드롭다운 버튼                             │
│    ├── HTML                                          │
│    ├── PDF                                           │
│    └── DOCX                                          │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  src/lib/export/ (신규 모듈)                          │
│  ├── exportHtml.ts    - HTML 내보내기 로직            │
│  ├── exportPdf.ts     - PDF 내보내기 로직             │
│  ├── exportDocx.ts    - DOCX 내보내기 로직            │
│  ├── exportUtils.ts   - 공통 유틸리티                 │
│  └── types.ts         - 내보내기 관련 타입 정의        │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  Tauri IPC (src/lib/tauri/ipc.ts)                    │
│  ├── exportSaveDialog() - 포맷별 저장 다이얼로그       │
│  └── writeExportFile()  - 바이너리/텍스트 파일 쓰기    │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  Rust Backend (src-tauri/src/commands/file_ops.rs)   │
│  ├── export_save_dialog() - 포맷별 파일 필터 다이얼로그│
│  └── write_binary_file()  - 바이너리 파일 쓰기 (DOCX) │
└─────────────────────────────────────────────────────┘
```

### 4.2 HTML 내보내기 사양

#### 전략: Self-Contained HTML
1. `renderMarkdown(content)`로 HTML 본문 생성
2. DOM에서 렌더링된 Mermaid SVG 추출 (JavaScript 의존성 제거)
3. 프리뷰 CSS (`index.css:25-117`)를 `<style>` 태그로 인라인
4. Shiki 인라인 스타일은 이미 HTML에 포함되어 있으므로 추가 처리 불필요
5. 완전한 HTML 문서 구조 (`<!DOCTYPE html>`, `<head>`, `<body>`) 생성
6. 현재 테마(dark/light)의 CSS 변수를 인라인으로 포함

#### 출력 구조
```html
<!DOCTYPE html>
<html lang="en" data-theme="{light|dark}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{filename}</title>
  <style>/* 인라인 프리뷰 CSS */</style>
</head>
<body>
  <div class="preview-content">
    {렌더링된 HTML + 인라인 Mermaid SVG}
  </div>
</body>
</html>
```

### 4.3 PDF 내보내기 사양

#### 전략: Webview Print-to-PDF (프론트엔드 주도)
1. 프리뷰 패널의 렌더링된 콘텐츠를 기반으로 `window.print()` 활용
2. 또는 숨겨진 iframe/새 창에 self-contained HTML을 로드하여 print 호출
3. Webview의 print 기능이 Mermaid SVG와 Shiki 스타일을 자동으로 보존
4. 사용자가 OS print 다이얼로그에서 PDF 저장 위치를 선택

#### Print CSS 고려사항
- `@media print` 스타일 정의: 불필요한 UI 요소 숨김
- 페이지 나눔 제어: 코드 블록과 다이어그램이 페이지 중간에서 잘리지 않도록 처리
- 배경색/이미지 강제 출력: `-webkit-print-color-adjust: exact`

### 4.4 DOCX 내보내기 사양

#### 전략: `docx` npm 패키지 + markdown-it 토큰 변환
1. `renderMarkdown(content)` 대신 `markdownIt.parse(content)` 사용하여 토큰 배열 획득
2. markdown-it 토큰을 순회하며 `docx` 패키지의 요소로 변환:
   - `heading_open` -> `Heading` (HeadingLevel 매핑)
   - `paragraph_open` -> `Paragraph`
   - `bullet_list_open` -> `Paragraph` with bullet numbering
   - `code_block` / `fence` -> `Paragraph` with monospace font + Shiki 색상
   - `table_open` -> `Table`
   - `blockquote_open` -> `Paragraph` with indent + border styling
   - `strong_open` -> `TextRun` with bold
   - `em_open` -> `TextRun` with italics
   - `link_open` -> `ExternalHyperlink`
3. Mermaid 코드 블록: SVG -> canvas -> PNG -> `ImageRun`
4. Shiki 색상 변환: `<span style="color:#xxx">` -> `TextRun({ color: "xxx" })`
5. `docx.Packer.toBlob()`으로 바이너리 생성
6. Tauri IPC를 통해 바이너리 파일 저장

### 4.5 Export UI 사양

#### Header 컴포넌트 변경 (`src/components/layout/Header.tsx`)
- 기존 버튼 영역에 Export 드롭다운 버튼 추가
- 드롭다운 메뉴 항목: "Export as HTML", "Export as PDF", "Export as DOCX"
- 콘텐츠가 비어있을 때 disabled 상태
- 내보내기 진행 중 로딩 스피너 표시

#### 드롭다운 동작
```
[Export ▼]
  ├── Export as HTML   (Ctrl+Shift+E, H)
  ├── Export as PDF    (Ctrl+Shift+E, P)
  └── Export as DOCX   (Ctrl+Shift+E, D)
```

### 4.6 Rust 백엔드 사양

#### 신규 Tauri 명령어

**`export_save_dialog`**: 포맷별 파일 필터가 적용된 저장 다이얼로그
- 입력: `format: String` ("html" | "pdf" | "docx"), `default_name: String`
- 출력: `Option<String>` (선택된 파일 경로 또는 None)
- 필터: 각 포맷에 맞는 확장자 필터 적용

**`write_binary_file`**: 바이너리 데이터 파일 쓰기 (DOCX용)
- 입력: `path: String`, `data: Vec<u8>`
- 출력: `Result<(), String>`

### 4.7 상태 관리

- `editorStore.content`: Raw 마크다운 소스 (읽기 전용 사용)
- `uiStore.theme`: 현재 테마 (dark/light) - 내보내기 스타일 결정
- `fileStore.currentFile`: 현재 파일명 - 기본 내보내기 파일명 생성

### 4.8 영향 범위

| 파일 | 변경 유형 | 위험도 |
|------|---------|--------|
| `src/components/layout/Header.tsx` | Export 드롭다운 버튼 추가 | Low |
| `src/lib/export/exportHtml.ts` | **신규** - HTML 내보내기 로직 | N/A |
| `src/lib/export/exportPdf.ts` | **신규** - PDF 내보내기 로직 | N/A |
| `src/lib/export/exportDocx.ts` | **신규** - DOCX 내보내기 로직 | N/A |
| `src/lib/export/exportUtils.ts` | **신규** - 공통 유틸리티 | N/A |
| `src/lib/export/types.ts` | **신규** - 타입 정의 | N/A |
| `src/lib/tauri/ipc.ts` | IPC 래퍼 함수 추가 | Low |
| `src-tauri/src/commands/file_ops.rs` | Tauri 명령어 추가 | Low |
| `src-tauri/src/lib.rs` | 명령어 등록 | Low |
| `src/index.css` | Print CSS 미디어 쿼리 추가 | Low |
| `src/lib/markdown/renderer.ts` | Mermaid SVG 추출 유틸리티 (선택적) | Low |
| `package.json` | `docx` 의존성 추가 | Low |

---

## 5. Out of Scope (범위 제외)

- 여러 파일의 일괄 내보내기 (Batch export)
- 커스텀 내보내기 템플릿/테마 선택
- 인쇄 설정 커스터마이징 (페이지 크기, 여백, 방향)
- 클라우드 내보내기 또는 공유 기능
- LaTeX 또는 ePub 포맷 내보내기
- 목차(TOC) 자동 생성

---

## 6. Dependencies (의존성)

### 내부 의존성

| SPEC ID | 의존 내용 |
|---------|-----------|
| SPEC-EDITOR-001 | editorStore (content, currentFile) |
| SPEC-UI-001 | AppLayout, Header 컴포넌트 |
| SPEC-FS-001 | Tauri 파일 저장 다이얼로그 패턴 |

### 외부 라이브러리

| 라이브러리 | 버전 | 용도 | 비고 |
|-----------|------|------|------|
| docx | ^9.x | DOCX 파일 생성 | ~50KB gzip, 신규 추가 |
| markdown-it | 14.x | 토큰 파싱 (DOCX 변환용) | 기존 설치됨 |
| shiki | 1.x | 구문 강조 (색상 추출) | 기존 설치됨 |
| mermaid | 11.x | 다이어그램 SVG (추출 대상) | 기존 설치됨 |
| tauri-plugin-dialog | 2.x | 파일 저장 다이얼로그 | 기존 설치됨 |

### 신규 Cargo 의존성

없음 (MVP 범위에서 Rust 백엔드 추가 의존성 불필요)

---

## 7. Non-Functional Requirements (비기능 요구사항)

### 성능

| 지표 | 목표값 | 비고 |
|------|--------|------|
| HTML 내보내기 완료 | < 2초 | 50KB 이하 마크다운 기준 |
| PDF 내보내기 (다이얼로그 표시까지) | < 3초 | webview print 호출까지 |
| DOCX 내보내기 완료 | < 5초 | Mermaid PNG 변환 포함 |
| Export 드롭다운 표시 | < 16ms | UI 반응성 |

### 파일 품질

- HTML: 모든 최신 브라우저에서 올바르게 렌더링
- PDF: 프리뷰 패널과 시각적으로 동일
- DOCX: Microsoft Word 2016+, Google Docs, LibreOffice Writer에서 정상 열림

### 크로스 플랫폼

- macOS, Windows, Linux 모두에서 동일한 내보내기 기능 동작
- 파일 경로 처리 시 OS별 경로 구분자 자동 처리

---

## 8. Traceability (추적성)

| 요구사항 ID | 모듈 | 구현 파일 | 테스트 시나리오 |
|------------|------|----------|---------------|
| REQ-EXPORT-001 | Module 1 | `exportHtml.ts`, `ipc.ts`, `file_ops.rs` | ACC-01 |
| REQ-EXPORT-002 | Module 1 | `exportHtml.ts` | ACC-01 |
| REQ-EXPORT-003 | Module 1 | `exportHtml.ts`, `exportUtils.ts` | ACC-01 |
| REQ-EXPORT-004 | Module 1 | `exportHtml.ts` | ACC-01 |
| REQ-EXPORT-005 | Module 2 | `exportPdf.ts` | ACC-02 |
| REQ-EXPORT-006 | Module 2 | `exportPdf.ts` | ACC-02 |
| REQ-EXPORT-007 | Module 3 | `exportDocx.ts`, `ipc.ts`, `file_ops.rs` | ACC-03 |
| REQ-EXPORT-008 | Module 3 | `exportDocx.ts` | ACC-03 |
| REQ-EXPORT-009 | Module 3 | `exportDocx.ts` | ACC-03 |
| REQ-EXPORT-010 | Module 3 | `exportDocx.ts`, `exportUtils.ts` | ACC-03 |
| REQ-EXPORT-011 | Module 4 | `Header.tsx` | ACC-04 |
| REQ-EXPORT-012 | Module 4 | `Header.tsx` | ACC-04 |
| REQ-EXPORT-013 | Module 4 | `Header.tsx` | ACC-05 |
| REQ-EXPORT-014 | Module 5 | `exportHtml.ts`, `exportPdf.ts` | ACC-06 |
| REQ-EXPORT-015 | Module 5 | `exportHtml.ts`, `exportPdf.ts` | ACC-06 |
| REQ-EXPORT-016 | Module 6 | `exportUtils.ts`, `ipc.ts` | ACC-07 |
| REQ-EXPORT-017 | Module 6 | `exportUtils.ts` | ACC-07 |
| REQ-EXPORT-018 | Module 7 | `exportUtils.ts`, `Header.tsx` | ACC-08 |
| REQ-EXPORT-019 | Module 7 | 전체 export 모듈 | ACC-08 |
| REQ-EXPORT-020 | Module 7 | `exportHtml.ts` | ACC-01 |

### Product Reference
- product.md - V3.0+ Future Exploration: "Export to HTML/PDF with themes"
- product.md - Non-Goals 목록에서 "HTML/Rich Text Export" 제거 (V3 기능을 앞당겨 구현)

### Structure Reference
- `src/components/layout/Header.tsx` - 내보내기 UI 배치
- `src/lib/tauri/ipc.ts` - IPC 래퍼 패턴
- `src-tauri/src/commands/file_ops.rs` - Tauri 명령어 패턴

### Tech Reference
- tech.md - markdown-it 14.x, Shiki 1.x, Mermaid 11.x, Tauri v2, React 18, Zustand 5.x
