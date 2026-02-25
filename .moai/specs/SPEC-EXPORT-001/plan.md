---
id: SPEC-EXPORT-001
type: plan
version: 1.0.0
tags:
  - SPEC-EXPORT-001
---

# SPEC-EXPORT-001 구현 계획: Markdown Document Export (PDF/HTML/DOCX)

## 1. 작업 분해 (Task Decomposition)

### Primary Goal: 내보내기 인프라 및 HTML 내보내기

**Task 1: Rust 백엔드 - 내보내기 저장 다이얼로그 및 바이너리 쓰기 명령어**
- 파일: `src-tauri/src/commands/file_ops.rs`, `src-tauri/src/lib.rs`
- 작업:
  - `export_save_dialog(format, default_name)` Tauri 명령어 추가
  - `write_binary_file(path, data)` Tauri 명령어 추가
  - 두 명령어를 `lib.rs`에 등록
- 레퍼런스: 기존 `save_file_as` 패턴 (`file_ops.rs:85-111`)
- 의존성: 없음

**Task 2: IPC 래퍼 함수 추가**
- 파일: `src/lib/tauri/ipc.ts`
- 작업:
  - `exportSaveDialog(format: ExportFormat, defaultName: string): Promise<string | null>` 추가
  - `writeBinaryFile(path: string, data: number[]): Promise<void>` 추가
- 레퍼런스: 기존 `saveFileAs` 래퍼 패턴 (`ipc.ts`)
- 의존성: Task 1

**Task 3: 공통 유틸리티 및 타입 정의**
- 파일: `src/lib/export/types.ts`, `src/lib/export/exportUtils.ts`
- 작업:
  - `ExportFormat` 타입 정의 (`'html' | 'pdf' | 'docx'`)
  - `ExportOptions` 인터페이스 정의 (content, filename, theme)
  - 기본 파일명 생성 유틸리티 (`document.md` -> `document.html`)
  - Mermaid SVG DOM 추출 유틸리티
  - 프리뷰 CSS 인라인 추출 유틸리티
- 의존성: 없음

**Task 4: HTML 내보내기 로직 구현**
- 파일: `src/lib/export/exportHtml.ts`
- 작업:
  - `exportToHtml(options: ExportOptions): Promise<string>` 구현
  - 렌더링된 HTML + 인라인 CSS + Mermaid SVG -> self-contained HTML 문서 조립
  - 테마별 CSS 변수 인라인화
  - 완전한 HTML 문서 구조 생성
  - IPC를 통한 파일 저장 플로우
- 레퍼런스: `renderMarkdown()` (`renderer.ts:56-96`), 프리뷰 CSS (`index.css:25-117`)
- 의존성: Task 2, Task 3

### Secondary Goal: PDF 및 DOCX 내보내기

**Task 5: PDF 내보내기 로직 구현**
- 파일: `src/lib/export/exportPdf.ts`, `src/index.css`
- 작업:
  - `exportToPdf(options: ExportOptions): Promise<void>` 구현
  - self-contained HTML을 숨겨진 iframe에 로드
  - `window.print()` 호출을 통한 PDF 생성
  - `@media print` CSS 추가 (UI 요소 숨김, 페이지 나눔 제어)
  - 배경색 강제 출력 (`-webkit-print-color-adjust: exact`)
- 의존성: Task 3, Task 4 (HTML 생성 로직 재사용)

**Task 6: DOCX 내보내기 로직 구현**
- 파일: `src/lib/export/exportDocx.ts`
- 작업:
  - `docx` npm 패키지 설치
  - `exportToDocx(options: ExportOptions): Promise<void>` 구현
  - markdown-it 토큰 -> docx 요소 변환 매핑
    - heading -> `Heading` (레벨 매핑)
    - paragraph -> `Paragraph`
    - bullet_list -> `Paragraph` with NumberFormat.BULLET
    - fence/code_block -> monospace `Paragraph` + Shiki 색상 `TextRun`
    - table -> `Table` + `TableRow` + `TableCell`
    - blockquote -> `Paragraph` with indent
    - strong -> `TextRun({ bold: true })`
    - em -> `TextRun({ italics: true })`
    - link -> `ExternalHyperlink`
  - Mermaid SVG -> canvas -> PNG -> `ImageRun` 변환
  - `Packer.toBlob()` -> Uint8Array -> Tauri IPC 바이너리 저장
- 의존성: Task 2, Task 3

### Tertiary Goal: UI 통합

**Task 7: Header Export 드롭다운 UI 구현**
- 파일: `src/components/layout/Header.tsx`
- 작업:
  - Export 드롭다운 버튼 추가
  - 포맷 선택 메뉴 (HTML, PDF, DOCX) 렌더링
  - 빈 콘텐츠 시 disabled 상태 처리
  - 내보내기 진행 중 로딩 상태 표시
  - 각 메뉴 항목과 내보내기 함수 연결
- 레퍼런스: 기존 Header 버튼 패턴 (`Header.tsx:31-54`)
- 의존성: Task 4, Task 5, Task 6

### Optional Goal: 폴리싱

**Task 8: Print CSS 최적화 및 에러 핸들링 강화**
- 파일: `src/index.css`, `src/lib/export/exportUtils.ts`
- 작업:
  - `@media print` 스타일 세밀 조정
  - 코드 블록/다이어그램 페이지 나눔 방지
  - 포괄적 에러 핸들링 및 사용자 피드백
  - Mermaid SVG -> PNG 변환 실패 시 텍스트 대체 로직
- 의존성: Task 5, Task 6

---

## 2. 구현 순서

```
Task 1 (Rust 백엔드) ─── Task 2 (IPC 래퍼) ───┐
                                                 │
Task 3 (유틸리티/타입) ────────────────────────────┤
                                                 │
                                                 ├── Task 4 (HTML 내보내기)
                                                 │       │
                                                 │       ├── Task 5 (PDF 내보내기)
                                                 │       │
                                                 ├── Task 6 (DOCX 내보내기)
                                                 │
                                                 └── Task 7 (UI 드롭다운)
                                                         │
                                                         └── Task 8 (폴리싱)
```

권장 순서:
1. Task 1 + Task 3 (병렬 실행 가능)
2. Task 2 (Task 1 완료 후)
3. Task 4 (HTML 내보내기 - 핵심 기능 + 가장 단순)
4. Task 5 + Task 6 (병렬 실행 가능, Task 4 완료 후)
5. Task 7 (UI 통합 - 모든 내보내기 로직 완료 후)
6. Task 8 (폴리싱 - 독립적 실행 가능)

---

## 3. 기술적 접근 방식

### HTML 내보내기: Self-Contained HTML
- 전략: 프리뷰 렌더링 결과를 재사용하여 완전한 HTML 문서 생성
- CSS 인라인화: `getComputedStyle` 또는 프리뷰 CSS 파일 직접 삽입
- Mermaid 처리: DOM에서 렌더링된 SVG 추출 (Mermaid JS 제거)
- Shiki 처리: 인라인 스타일이 이미 포함되어 있으므로 추가 작업 불필요
- 장점: 구현 단순, 시각적 일관성 보장, 추가 의존성 없음

### PDF 내보내기: Webview Print API
- 전략: self-contained HTML을 iframe에 로드 후 `window.print()` 호출
- 장점: 100% 시각적 일치, Mermaid/Shiki 자동 보존, 추가 의존성 없음
- 제한: print 다이얼로그가 표시됨 (프로그래밍적 PDF 생성 아님)
- 향후 개선: headless-chrome 크레이트로 프로그래밍적 PDF 생성 가능

### DOCX 내보내기: markdown-it 토큰 -> docx 변환
- 전략: HTML 대신 markdown-it의 토큰 배열을 직접 변환
- 장점: 마크다운 구조적 정보 보존, 정확한 서식 매핑
- Mermaid 처리: SVG -> canvas drawImage -> toDataURL('image/png') -> ImageRun
- Shiki 처리: 인라인 style 속성에서 color 추출 -> TextRun color 매핑

### 파일 저장: 기존 패턴 확장
- Rust `save_file_as` 패턴을 확장하여 포맷별 파일 필터 지원
- 바이너리 데이터(DOCX) 저장을 위한 별도 명령어 추가
- 프론트엔드 IPC 래퍼로 일관된 API 제공

---

## 4. 기술 제약 사항

### TypeScript Strict Mode
- 모든 새 코드는 `strict: true` 환경에서 에러 없이 컴파일되어야 함
- `any` 타입 사용 금지
- 모든 함수 파라미터와 반환 타입 명시

### 기존 패턴 준수
- Tauri 명령어: `#[tauri::command]` 매크로 + `tauri_plugin_dialog::DialogExt`
- IPC 래퍼: `invoke<T>('command_name', { params })` 패턴
- 컴포넌트 스타일: Tailwind CSS 유틸리티 클래스 사용
- 상태 접근: `useEditorStore.getState()`, `useUIStore.getState()`

### 보안 제약
- `html: false` markdown-it 설정 변경 금지
- HTML 내보내기 시 JavaScript 포함 금지 (XSS 방지)
- 사용자 입력 콘텐츠의 적절한 이스케이프 처리

### 크로스 플랫폼
- Windows `\` vs Unix `/` 경로 구분자 자동 처리
- Webview Print API 동작 차이 고려 (WebView2, WKWebView, WebKitGTK)

---

## 5. 리스크 분석

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| Webview Print-to-PDF가 특정 OS에서 다르게 동작 | Medium | High | 각 OS별 테스트 필수; 대안으로 HTML 다운로드 + "브라우저에서 PDF로 인쇄" 가이드 제공 |
| Mermaid SVG -> PNG 변환 실패 (CORS/보안 제약) | Medium | Medium | 실패 시 "[Diagram]" 텍스트 플레이스홀더로 대체; foreignObject 제거 후 재시도 |
| `docx` 패키지의 테이블 렌더링이 복잡한 마크다운 테이블과 불일치 | Low | Medium | 기본 테이블 스타일로 시작, 점진적 개선; 복잡한 테이블은 이미지 대체 고려 |
| Shiki 색상 추출이 테마 변경 시 불일치 | Low | Low | 현재 테마 기반으로 `renderMarkdown` 재호출하여 최신 색상 반영 |
| 대용량 마크다운(50KB+) 내보내기 시 성능 저하 | Low | Medium | 프로그레스 인디케이터 표시; Web Worker 활용 고려 (향후) |
| print 다이얼로그가 UX를 저하시킴 (PDF) | Medium | Low | 사용자에게 "Save as PDF" 안내 표시; 향후 headless 방식으로 개선 |

---

## 6. 레퍼런스 구현 (Reference Implementations)

| 패턴 | 파일:라인 | 설명 |
|------|----------|------|
| 파일 저장 다이얼로그 | `file_ops.rs:85-111` | `save_file_as` Tauri 명령어 (파일 필터 + 저장) |
| IPC 래퍼 | `ipc.ts` | `invoke()` 기반 Tauri 호출 패턴 |
| 마크다운 렌더링 | `renderer.ts:56-96` | `renderMarkdown()` HTML 생성 |
| 코드 하이라이팅 | `codeHighlight.ts:1-39` | Shiki 초기화 및 코드 강조 |
| Mermaid 플러그인 | `mermaidPlugin.ts:13-24` | markdown-it Mermaid 통합 |
| 프리뷰 렌더링 | `PreviewRenderer.tsx:22-51` | `dangerouslySetInnerHTML` 렌더링 |
| 프리뷰 CSS | `index.css:25-117` | `.preview-content` 스타일 정의 |
| Header 버튼 | `Header.tsx:31-54` | 기존 Header 버튼 레이아웃 |
| Tauri 명령어 등록 | `lib.rs:18-29` | 명령어 핸들러 등록 패턴 |

---

## 7. 품질 기준

- 모든 새 코드에 대한 단위 테스트 작성 (TDD: RED-GREEN-REFACTOR)
- TypeScript 컴파일 에러 0건
- `cargo clippy` 경고 0건
- 기존 305개 테스트 전체 통과 (회귀 없음)
- HTML 내보내기: 3개 이상 브라우저에서 정상 렌더링 확인
- DOCX 내보내기: Word / Google Docs / LibreOffice에서 정상 열림 확인
- PDF 내보내기: 프리뷰 패널과 시각적 일치 확인
- 50KB 마크다운 기준 각 포맷 내보내기 5초 이내 완료
