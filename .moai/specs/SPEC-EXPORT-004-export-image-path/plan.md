# SPEC-EXPORT-004 — 구현 계획

> 본 문서는 spec.md(WHAT/WHY)에 대한 HOW를 다룬다. Given-When-Then 수용 시나리오와 테스트 목록은 acceptance.md 참조. 개발 방식은 TDD(cycle_type=tdd, 재현 테스트 먼저).
> 순서 원칙: 바뀔 가능성이 큰 결정(계약·새 인터페이스·사용자에게 보이는 흐름)을 먼저 두고, 기계적인 배선과 정리는 뒤에 둔다.

## Tier 판단

**Tier M.** 근거:

- 변경 파일이 TypeScript와 Rust 양쪽에 걸쳐 약 10개(소스 8 + 기존 가드 1 + 테스트 여러 개)다.
- 새 보안 경계(상위 폴더 이미지 전용 Rust 명령)가 생긴다. 보안 경계 추가는 Tier S의 "단일 함수 수정" 범위를 넘는다.
- 사용자에게 보이는 흐름(완료 모달 문구, PDF 사전 알림)과 내보내기 옵션 계약이 바뀐다.
- 반면 마일스톤 3개 이상·파일 10개 이상을 동시에 만족하는 대규모 조정(Tier L)은 아니며 design.md·research.md가 따로 필요할 만큼 설계 불확실성이 크지 않다.

## 확정 결정 (Locked Decisions)

| # | 결정 | 내용 | 근거 |
|---|------|------|------|
| D1 | 상위 폴더 이미지 = 전용 Rust 명령 (사용자 결정) | 가칭 `image_ops::read_relative_image_as_base64(md_file_path, relative_src)`. 순서: (1) md 경로 `validate_path` + `is_absolute()` 확인, (2) `Path::new(rel).components()`에 `Component::Prefix(_)` 또는 `Component::RootDir`가 하나라도 있으면 거부(`/x`, `\x.png`, `C:x.png`, `C:\x`, `\\server\share` — `is_absolute()`만으로는 `\x.png`·`C:x.png`를 놓친다), (3) `md_dir.join(rel)` → `canonicalize()`, (4) **해석된 경로**의 확장자 화이트리스트 확인, (5) **열기 전** `std::fs::metadata(&canonical)?.is_file()` 확인 — 아니면 거부(FIFO를 읽기용으로 열면 쓰는 쪽이 나타날 때까지 막혀 async 명령의 런타임 스레드가 멈춘다), (6) `File::open(canonical)` 한 번 → (7) 그 핸들의 `metadata()?.is_file()` 재확인(5와 6 사이 교체 대비) → (8) 같은 핸들에서 `read_to_end` → data URI. 남는 하드링크·TOCTOU 노출은 spec Design Note의 받아들인 잔여 위험 | spec REQ-006. `validate_path` 무변경(REQ-007). 감사 D9·D10·N2 |
| D2 | 라우팅 = 후보 경로마다, `..` 구성요소가 있는 후보만 전용 명령으로 (사용자 결정 #3 "디코드 결과에 `..`가 있는 상대경로만"을 plan-audit iteration 1 이후 오케스트레이터가 후보별 판정으로 구체화 — 사용자 결정 아님) | 각 읽기 후보(디코드 후보, 원문 대체 후보)를 따로 판정한다. 후보 문자열을 `/`와 `\` **둘 다**로 나눠(`split(/[\\/]/)`) 정확히 `..`인 조각이 있으면 전용 명령에 (`mdFilePath`, 후보 문자열)을 넘기고, 없으면 지금처럼 프런트에서 `mdDir + sep + 후보`를 만들어 `readImageAsBase64`로 읽는다. 절대경로(`/`)는 판정 없이 일반 IPC | SPEC-PREVIEW-014 T1~T10 계약을 그대로 보존하고 IPC 변경 범위를 최소화. `\`도 나누는 이유: markdown-it이 `\`를 `%5C`로 인코딩하므로 디코드 후보에 `..\x.png`가 생길 수 있다. 대안(모든 상대경로를 전용 명령으로)은 미리보기 테스트 대량 수정이 필요해 기각. 감사 D7 |
| D3 | 엔티티 디코드 = 명시적 4종 되돌리기 | 렌더 HTML에서 정규식으로 뽑은 src에만 `&quot;`·`&lt;`·`&gt;`·`&amp;` 순으로(`&amp;`를 마지막에) 되돌린다. DOMParser로 HTML 전체를 다시 직렬화하지 않는다 | markdown-it `escapeHtml`이 이 4종만 이스케이프한다. DOM 재직렬화는 Mermaid SVG·Shiki 마크업을 바꿀 위험이 있다. 치환은 원문 속성 문자열 기준(REQ-003) |
| D4 | 누락 전달 = `ExportOptions`의 선택 필드 2개 | (a) 통지 콜백(가칭 `onUnembeddedImages?: (names: string[]) => void`) — 이미지 임베드 단계가 끝난 직후, 누락이 1개 이상일 때 한 번 호출. `exportToHtml`·`generateHtmlContent`·`exportToDocx` 모두 이 필드를 존중한다. (b) PDF용 확인 콜백(가칭 `confirmUnembeddedImages?: (names: string[]) => Promise<boolean>`) — `exportToPdf`만 사용(D6). 콜백이 없으면 지금 동작 그대로. 반환 타입(`exportToHtml`·`exportToDocx`의 `Promise<string \| null>`, `generateHtmlContent`의 `Promise<string>`, `exportToPdf`의 `Promise<void>`) 무변경. **PDF 이름 전달 경로(감사 D14)**: `exportToPdf`는 지역 배열 `collected`를 만들고 `generateHtmlContent({ ...options, onUnembeddedImages: (names) => { collected.push(...names); options.onUnembeddedImages?.(names); } })`로 호출한다. `generateHtmlContent`는 임베드 직후 이 콜백을 부르므로, 반환 후 `collected`에 이름이 모여 있다. `collected.length > 0`이고 `confirmUnembeddedImages`가 있으면 `exportToPdf`가 그 배열로 확인 콜백을 await한다. `generateHtmlContent` 호출자는 `exportToPdf` 하나뿐이고(현재 코드 기준), 공개 반환 타입은 바뀌지 않는다 | REQ-011. SPEC-EXPORT-002 테스트와 `exportToDocx`의 `@MX:ANCHOR` 불변식을 건드리지 않는 가장 작은 변경. 대안(반환을 `{ path, unembedded }`로 확장)은 EXPORT-002 REQ-007 개정과 테스트 수정이 필요해 기각 |
| D5 | 완료 모달 = `AppLayout` 안에서 본문만 확장 | 누락 이름 목록을 `exportedPath`와 함께 상태로 보관하고 기존 `ConfirmDialog` `message`에 경고 블록을 덧붙인다. 새 다이얼로그 컴포넌트·새 파일을 만들지 않는다 | `exportOpenRegressionGuard.test.ts`가 `export…complete/dialog` 이름의 별도 컴포넌트를 금지한다. 액션 배열·제목 무변경 |
| D6 | PDF 알림 = 인쇄 대화상자 직전 앱 내 `ConfirmDialog` (사용자 결정) | `exportToPdf`는 `await generateHtmlContent(...)` **바로 다음 문장**에서 D4(b) 확인 콜백을 await한다. 즉 현재 `exportPdf.ts`의 `cleanupPrintElements()`(:32), `document.title` 변경(:43-47), 컨테이너·스타일 삽입(:50-79), `afterprint` 리스너(:90)와 5분 `setTimeout`(:93) 등록보다 앞이다(감사 D4). `false`면 이 중 어느 것도 실행하지 않고 반환한다. `AppLayout`의 PDF 핸들러는 콜백 안에서 `ConfirmDialog`를 열고(제목 가칭 `PDF 내보내기`, 본문은 D5 경고 블록과 같은 형식, 액션 `cancel`('취소') → `print`('계속 인쇄', primary·초기 포커스)) 사용자의 선택으로 Promise를 resolve한다. `cancel`·Escape·백드롭 → `false` → 인쇄 IPC 호출 없이 반환(제목·인쇄 요소·리스너·타이머를 아직 건드리지 않았으므로 남는 것 없음). `window.alert` 사용 금지 | PDF에는 완료 모달이 없다(SPEC-EXPORT-002 비목표). 인쇄 IPC는 네이티브 대화상자가 닫히기 전에 돌아오므로 인쇄 뒤 알림은 대화상자와 겹친다. `alert`를 쓰지 않는 이유: Tauri WKWebView에서 `alert` 동작이 검증되지 않았고, `exportPdf.ts:22` 주석이 같은 WebView에서 `window.print()`가 동작하지 않는다고 기록한다. 같은 `ConfirmDialog`를 쓰면 jsdom 컴포넌트 테스트로 검증할 수 있다. 취소 = 인쇄 안 함은 "확인하면 인쇄 계속" 결정과 `ConfirmDialog`의 필수 `cancel` id(SPEC-FS-003 INV-3)에서 도출 |
| D7 | 표시 이름 = 디코드한 src | 퍼센트·엔티티 디코드 결과(실패 시 원문). 최대 10개, 나머지 `외 K개` | REQ-008·009. 사용자가 마크다운에 쓴 이름과 일치 |
| D8 | 미저장 문서 = 로컬 이미지를 하나도 읽지 않음 (사용자 결정 2026-10-26, 감사 N3) | `mdFilePath === null`이면 상대경로·`/` 절대경로 모두 읽기 IPC를 호출하지 않고 누락으로 기록한다. 현재 `embedLocalImages`(`exportHtml.ts:134`의 즉시 반환)와 DOCX 분기(`exportDocx.ts:589`의 `mdFilePath &&` 조건), 미리보기(`imageResolver.ts:73`)의 동작을 그대로 유지한다. DOCX의 `mdFilePath &&` 조건은 **남긴다** | REQ-008 State-driven 절. `read_image_as_base64`는 확장자 검사가 없어(임의 파일을 `application/octet-stream`으로 읽음), 미저장 문서에 붙여 넣은 `![](/Users/me/.ssh/id_rsa)` 같은 절대경로가 공유용 HTML에 들어갈 수 있다. 미리보기와 같은 동작이므로 REQ-001의 동일성 절과도 맞는다(N1). iteration 1에서 오케스트레이터가 잡았던 "미저장 문서의 절대경로 임베드"는 사용자 결정으로 되돌렸다 |
| D9 | 누락 판정 = 임베드되지 않음 (감사 D11) | 공용 해석기의 읽기 실패뿐 아니라 DOCX 분기의 `atob`·`getImageDimensions`·`ImageRun` 생성 단계 예외로 `[alt]` 폴백에 들어간 경우도 누락으로 기록한다. HTML은 src가 data URI로 바뀌지 않은 경우가 누락 | REQ-008 정의 절 |

## 마일스톤 (우선순위 순, 시간 추정 없음)

### M1 (Priority High) — 재현 테스트 작성 (RED)

테스트 파일 배치 원칙(감사 D1·D2·D3): 검증하려는 함수를 mock하는 파일에는 그 함수의 테스트를 두지 않는다. 기존 `exportHtml.test.ts`(renderer mock)와 `exportDocx.test.ts`는 **한 글자도 바꾸지 않는다**(R3·R4).

- **신규 `src/test/exportImageEmbed.test.ts`**: 실제 `renderMarkdown`과 실제 markdown-it을 쓰고, `@/lib/tauri/ipc`만 mock한다(`readImageAsBase64`, 새 전용 명령 래퍼, `exportSaveDialog`, `writeFile`, `writeBinaryFile`). `@/lib/export/exportHtml`은 mock하지 않는다. `docx`는 `exportDocx.test.ts`와 같은 `ImageRun`/`TextRun` 감시 래퍼로 감싸고, `Image`는 같은 `MockImage` 스텁을 쓴다. 담는 테스트: H1~H5, X1~X5, E1, P1, F3, F6, F7, F10, DM1, R5.
- **`src/test/exportPdf.test.ts`에 describe 블록 추가**(기존 3건 무수정): 실제 `exportToPdf`, `generateHtmlContent`는 기존처럼 mock하되 mock 구현이 `options.onUnembeddedImages`를 호출해 누락을 흉내 낸다. PF1~PF3.
- `src/test/imageResolver.test.ts`: 미리보기 `&`(V1)·`..` 전용 명령 라우팅(V2)·후보별 라우팅(V3) 추가. T11 기대값을 D2에 맞게 개정(R2).
- `src/test/ExportCompletionDialog.test.tsx`: 완료 모달 누락 보고 F1·F2·F4, PDF 확인 다이얼로그 배선 F5·F9(mock된 `exportToPdf`가 `options.confirmUnembeddedImages`를 호출하고, 액션별 resolve 값을 단언). 기존 AC-001~012는 **수정 없이** 통과해야 한다.
- `src-tauri/src/commands/image_ops.rs` `#[cfg(test)]`: S1~S7(acceptance.md). 전용 명령이 없으므로 컴파일 단계에서 실패하는 것이 RED다.
- RED 증거(명령 + 실패 출력)를 progress.md §E.2에 남긴다.

### M2 (Priority High) — 상위 폴더 이미지 전용 Rust 명령 (보안 경계)

- `image_ops.rs`에 D1 명령 추가(D1의 1~8 순서 그대로). 확장자 검사는 `canonicalize()` 이후 경로에 대해, 일반 파일 검사는 열기 전 경로 메타데이터와 열린 핸들 메타데이터 두 번 한다. S9(FIFO)·S10(디렉터리) 테스트가 "막히지 않고 거부"를 고정한다. S9는 별도 `std::thread` + 채널 `recv_timeout(5초)` 시간 제한 가드를 두고, 시간 초과 시 FIFO를 쓰기용으로 열어 막힌 열기를 푼 뒤 `panic!("S9 timed out — implementation opened FIFO before type check")`한다(`#[tokio::test]` 단일 스레드에서는 `tokio::time::timeout`이 발화하지 못하고 `cargo test`에 테스트별 시간 제한이 없기 때문, 감사 N8). `mkfifo`가 없으면 고정 문구 `S9 SKIPPED: mkfifo unavailable`을 출력하고 건너뛴다(감사 N9). MIME 매핑은 기존 `read_image_as_base64`와 같은 표를 쓰되, 화이트리스트 밖이면 열기 전에 거부한다. 신규 의존성 없이 `std::fs::File`·`std::io::Read`만 쓴다.
- `src-tauri/src/lib.rs` `invoke_handler`에 1줄 등록.
- `src/lib/tauri/ipc.ts`에 래퍼 1개(가칭 `readRelativeImageAsBase64(mdFilePath, relativeSrc)`).
- `src/test/exportOpenRegressionGuard.test.ts` 기준선 배열에 새 명령 1줄 추가 + 기존 관례대로 `// SPEC-EXPORT-004 (2026-10-26): …` 주석. 다른 줄은 바꾸지 않는다.
- S1~S7 통과, 기존 `test_read_image_path_traversal_prevention` 및 `file_ops.rs` 테스트 **무수정** 통과.

### M3 (Priority High) — 공용 이미지 해석기

- `src/lib/image/imageResolver.ts`에 공용 함수(가칭 `readLocalImage(src, mdFilePath, { fromHtml })` → `{ ok: true, dataUri } | { ok: false, displayName }`)를 둔다. 책임: 스킴 판별 → (HTML 출처면) 엔티티 디코드 → 퍼센트 디코드(실패 시 원문) → `..` 여부로 D2 라우팅 → 구분자 통일 → 후보 순서대로 읽기.
- HTML 문자열 임베드 공용 함수(가칭 `embedImagesInHtml(html, mdFilePath)` → `{ html, unembedded: string[] }`)를 함께 둔다. `embedPreviewImages`는 이 함수의 `html`만 돌려주는 얇은 래퍼로 바꾼다(시그니처 무변경, `usePreview.ts` 무변경).
- 미리보기 테스트 T1~T10 무수정 통과, T11 개정본(R2)·V1~V3 통과.

### M4 (Priority High) — 내보내기 배선

- `exportHtml.ts`: `embedLocalImages` 삭제, `exportToHtml`·`generateHtmlContent` 모두 공용 `embedImagesInHtml` 사용. 임베드 직후 누락이 있으면 D4(a) 콜백 호출. 미저장 문서 처리는 D8. 두 함수의 반환 무변경.
- `exportDocx.ts`: 이미지 분기의 경로 조립을 공용 `readLocalImage`(`fromHtml: false`)로 교체. 기존 `mdFilePath &&` 조건은 그대로 두어 미저장 문서에서는 어떤 로컬 이미지도 읽지 않고, 그 이미지를 누락으로 기록한다(D8). 읽기·`atob`·크기 계산 중 어느 단계든 실패하면 기존 `[alt]` 폴백 + 누락 기록(D9). data URI 분기와 Mermaid 캡처(`captureMermaidImages`·`fence` 분기) 무변경.
- `exportPdf.ts`: D4의 PDF 이름 전달 경로와 D6의 await 위치 그대로. 누락 0개이거나 콜백이 없으면 인쇄 경로·정리 로직 무변경.
- `types.ts`: D4 선택 필드 2개 추가.
- H1~H5, X1~X5, E1, P1, F3, F6, F7, F10, DM1, R5, PF1~PF3 통과.

### M5 (Priority Medium) — 누락 보고 UI

- `AppLayout.tsx`: HTML·DOCX 핸들러에 콜백을 넘겨 누락 목록 상태를 채우고, 완료 모달 `message`에 경고 블록(`data-testid="unembedded-images"`)을 추가한다(D5·D7). 새 내보내기 시작 시 이전 목록을 비운다(단일 슬롯 의미 유지, SPEC-EXPORT-002 REQ-016).
- PDF 핸들러는 D4(b) 확인 콜백에서 `ConfirmDialog`를 열고 사용자 선택으로 resolve한다(D6). 다이얼로그 상태는 완료 모달 슬롯과 따로 두고 `AppLayout` 안에서만 렌더한다(새 컴포넌트 파일 금지, D5와 같은 이유). 다이얼로그가 열린 동안의 로딩 스피너 처리는 SPEC-EXPORT-002 REQ-015(모달 중 스피너 미표시)에 맞춘다.
- F1·F2·F4·F5·F9 통과, 기존 AC-001~012 무수정 통과.

### M6 (Priority Medium) — 정리·게이트·MX 태그

- 게이트: acceptance.md "기계 검증 게이트" 표 전부 exit 0.
- @MX 태그(주석 언어 `code_comments: ko`):
  - 공용 해석기(`readLocalImage`/`embedImagesInHtml`): 호출자 4곳(usePreview, exportToHtml, generateHtmlContent, exportDocx) → `@MX:ANCHOR` + `@MX:REASON`("미리보기·HTML·PDF·DOCX 이미지 경로 해석의 단일 소스, 디코드 순서·엔티티 출처 구분 불변식").
  - 전용 Rust 명령: `@MX:ANCHOR`(보안 경계) + `@MX:WARN`("확장자 검사는 canonicalize 이후 경로로만, 상대경로 인자의 절대경로 거부 제거 금지") + `@MX:REASON`.
  - `exportHtml.ts` 파일 머리 `@MX:NOTE`에 `embedLocalImages` 제거와 공용 해석기 위임 사실 기록, `@MX:SPEC: SPEC-EXPORT-004` 추가.
  - `exportToDocx`의 기존 `@MX:ANCHOR` 불변식(반환 계약) 문구는 유지한다.

## 위험

| 위험 | 대응 |
|------|------|
| 전용 명령이 디스크의 임의 이미지 파일을 읽게 됨 | 기존 절대경로 읽기와 같은 범위임을 spec Design Note에 기록. 확장자 화이트리스트를 해석된 대상에 적용하고 심볼릭 링크 테스트(S3)로 고정 |
| `md_dir.join(rel)`에서 `rel`에 루트나 드라이브가 있으면 `join`이 앞 경로를 버리거나 드라이브 루트로 옮김 | `is_absolute()`가 아니라 구성요소 검사(`Prefix`·`RootDir`)로 거부(D1 (2), S4). `%2F` 디코드로 `/`가 앞에 생기는 경우도 걸린다. **Windows CI가 없으므로**(`frontend-gates.yml`은 macOS·cargo 단계 없음) `\x.png`·`C:x.png`·`C:\x`·`\\server\share` 거부는 `std::path::Component`가 실행 OS 기준으로 해석한다는 사실에 기대며, Windows 실기 `cargo test` 1회를 수동 확인 항목으로 둔다(acceptance.md 검증 경계) |
| TOCTOU·하드링크 | D1 (5)~(7) "한 번 열고 그 핸들로 검사·읽기"로 검사와 읽기 사이 교체는 막는다. 경로 해석과 열기 사이의 교체, 하드링크는 받아들인 잔여 위험(spec Design Note — 이미지 MIME data URI로만 반환, 기존 절대경로 읽기와 같은 도달 범위, 로컬 쓰기 권한 필요) |
| 실제 `renderMarkdown`이 jsdom에서 import·실행되지 않을 가능성(신규 `exportImageEmbed.test.ts`) | 기존 `MarkdownPreview`·`PreviewRenderer` 테스트가 jsdom에서 렌더러를 쓰는지 M1 시작 시 확인. 막히면 Shiki 하이라이터만 `null`로 두고 renderer 자체는 mock하지 않는 원칙을 지키며 blocker로 보고한다 |
| DM1에서 jsdom `canvas`·`Blob.arrayBuffer` 미구현 | `HTMLCanvasElement.prototype.getContext`를 `{ scale, drawImage }` 스텁으로, `toBlob`을 `arrayBuffer()`를 가진 객체로 콜백하는 스텁으로 바꾼다. `MockImage`는 `exportDocx.test.ts`와 같은 방식 |
| Windows `canonicalize()`가 `\\?\` 접두 경로를 돌려줌 | 읽기에만 쓰고 프런트로 경로를 돌려주지 않으므로 영향 없음 |
| 엔티티 디코드가 원문 치환 매칭을 깨뜨림 | 치환은 정규식으로 뽑은 원문 속성 문자열 기준(D3). V1·H3에서 결과 HTML의 data URI 치환 확인 |
| 등록 명령 기준선 가드 실패 | M2에서 기준선 1줄 추가가 의도된 변경임을 주석으로 남김(기존 SPEC-IMG-LOAD-001·SPEC-FS-004 선례) |
| SPEC-PREVIEW-014 T11 기대값 변경 | 의도된 개정. 미리보기 쪽 `..` 거부 대신 제한적 허용이 사용자 결정이며, 클라이언트가 `..`를 정리하지 않는다는 PREVIEW-014 REQ-005의 취지는 유지 |
| 완료 모달 본문이 길어짐 | 이름 최대 10개(D7) |
| PDF 확인 다이얼로그의 Promise가 resolve되지 않은 채 남음 | 모든 닫힘 경로(`cancel`·Escape·백드롭·`print`)가 같은 resolver를 한 번만 호출하게 하고 F5·F9로 고정. 다이얼로그가 열린 동안 배경 입력은 `ConfirmDialog`가 이미 차단(SPEC-EXPORT-002 REQ-015) |

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/lib/image/imageResolver.ts` | 공용 해석기·HTML 임베드 함수 추가, `embedPreviewImages`를 래퍼로 |
| `src/lib/export/exportHtml.ts` | `embedLocalImages` 제거, 공용 함수 사용, 누락 콜백 |
| `src/lib/export/exportDocx.ts` | 이미지 분기 경로 조립을 공용 함수로, 누락 기록 |
| `src/lib/export/exportPdf.ts` | 누락 이름 수집 + 확인 콜백 await(D4·D6) |
| `src/lib/export/types.ts` | `ExportOptions` 선택 필드 2개(`onUnembeddedImages`, `confirmUnembeddedImages`) |
| `src/components/layout/AppLayout.tsx` | 누락 목록 상태 + 완료 모달 본문 확장 + PDF 알림 |
| `src/lib/tauri/ipc.ts` | 전용 명령 래퍼 1개 |
| `src-tauri/src/commands/image_ops.rs` | 전용 명령 + 테스트 |
| `src-tauri/src/lib.rs` | `invoke_handler` 1줄 등록 |
| `src/test/exportOpenRegressionGuard.test.ts` | 기준선 1줄 추가 |
| `src/test/exportImageEmbed.test.ts` (신규) | 실제 renderer·markdown-it + ipc mock 재현 테스트(H·P1·X·E1·F3·F6·F7·F10·DM1·R5) |
| `src/test/exportPdf.test.ts` | describe 블록 추가(PF1~PF3), 기존 3건 무수정 |
| `src/test/imageResolver.test.ts` | V1~V3 추가, T11만 개정 |
| `src/test/ExportCompletionDialog.test.tsx` | F1·F2·F4·F5·F9 추가, 기존 12건 무수정 |

변경하지 않는 파일: `src-tauri/src/commands/file_ops.rs`(`validate_path`), `src/hooks/usePreview.ts`, `src/lib/markdown/renderer.ts`, `src/components/common/ConfirmDialog.tsx`, `src/test/exportHtml.test.ts`, `src/test/exportDocx.test.ts`, `package.json`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/main.json`.

## 결정 이력

- 2026-10-26: plan 초안의 미결 질문(SPEC 번호, PDF 알림 방식, 전용 명령 라우팅 범위, 읽기 범위)을 사용자가 결정했다. SPEC 번호는 SPEC-EXPORT-002가 003을 PDF 완료 모달 후속으로 예약해 두었으므로 004로 바꿨다. 나머지 결과는 D2·D6과 progress.md §E.1에 반영했다. 남은 미결 표지는 없다.
- 2026-10-26: plan-audit iteration 1(FAIL 0.75, `.moai/reports/plan-audit/SPEC-EXPORT-004-iter1.md`)의 결함 D1–D14를 반영했다. 오케스트레이터가 정한 기술 결정(테스트 파일 배치, PDF 확인 대기 위치, 후보별 라우팅과 `/`·`\` 구분자, 미저장 문서의 절대경로 임베드, 구성요소 기반 거부, 한 번 열기 순서, 누락 = 임베드되지 않음, PDF 이름 전달 경로)은 D1·D2·D4·D6·D8·D9와 M1·M2·M4에 반영했다.
- 2026-10-26: plan-audit iteration 2(FAIL 0.875, `.moai/reports/plan-audit/SPEC-EXPORT-004-iter2.md`)의 N1–N7을 반영했다. 사용자 결정으로 D8을 "미저장 문서는 로컬 이미지를 하나도 읽지 않음"으로 되돌렸고(N1·N3), D1에 열기 전 일반 파일 확인을 넣었으며(N2), D2의 출처를 오케스트레이터 구체화로 바로잡았다(N4).
