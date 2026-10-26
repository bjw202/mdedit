# SPEC-EXPORT-004 — 수용 기준

> 게이트 = vitest + tsc + eslint + `cargo test`. 이미지 해석·임베드는 문자열 입력과 IPC 호출로 단언할 수 있어 Vitest 단위 테스트로 충분하다. 완료 모달·PDF 확인 다이얼로그 배선은 `@testing-library/react` 컴포넌트 테스트. 전용 Rust 명령은 임시 디렉터리 기반 Rust 단위 테스트. 포인터 상호작용 순서에 의존하는 요구는 없다.
> 이 문서는 검증 계층이다. 요구사항(REQ)은 spec.md에 있고, 여기서는 Given-When-Then으로 확인 방법만 적는다.

## 사전 준비

- **배치 원칙**: 검증하려는 함수를 mock하는 파일에는 그 함수의 테스트를 두지 않는다. 기존 `src/test/exportHtml.test.ts`(renderer를 mock함)와 `src/test/exportDocx.test.ts`는 **한 글자도 바꾸지 않는다**(R3·R4).
- **신규 `src/test/exportImageEmbed.test.ts`** (H·X·E1·P1·F3·F6·F7·F10·DM1·R5):
  - 실제 `renderMarkdown`과 실제 markdown-it을 쓴다. `@/lib/markdown/renderer`와 `@/lib/export/exportHtml`은 mock하지 않는다. 그래야 재현 테스트가 실제 인코딩·이스케이프를 받고, `generateHtmlContent`(P1)도 실제 함수가 실행된다.
  - `@/lib/tauri/ipc`만 mock한다: `readImageAsBase64`, 새 전용 명령 래퍼, `exportSaveDialog`, `writeFile`, `writeBinaryFile`. 경로별로 resolve/reject를 지정한다.
  - `docx`는 `exportDocx.test.ts`와 같은 방식으로 `ImageRun`·`TextRun`을 감시 래퍼로 감싸고, 전역 `Image`는 같은 `MockImage` 스텁(src 설정 시 비동기 `onload`)으로 바꾼다.
  - **격리**: 이 파일은 `afterEach`에서 DM1이 바꾼 `HTMLCanvasElement.prototype.getContext`·`toBlob` 스텁을 저장해 둔 원본으로 되돌린다. SPEC-PREVIEW-015 이후 내보내기는 미리보기 DOM을 읽지 않고 원본 펜스에서 다이어그램을 렌더하므로, 문서 DOM의 `.mermaid-container` 정리는 더 필요하지 않다(0.1.3 당시에는 `replaceMermaidPlaceholders`가 같은 `document`를 읽어 정리가 필요했다).
- **`src/test/exportPdf.test.ts`** (PF1~PF3): 기존 3건은 그대로 두고 새 `describe` 블록을 추가한다. 실제 `exportToPdf`를 실행한다. `generateHtmlContent`는 기존처럼 mock하되, mock 구현이 `options.onUnembeddedImages?.(names)`를 호출한 뒤 HTML을 돌려주게 해 누락을 흉내 낸다.
- **`src/test/ExportCompletionDialog.test.tsx`** (F1·F2·F4·F5·F9): 내보내기 함수는 기존처럼 mock한다. mock 구현이 `options.onUnembeddedImages` 또는 `options.confirmUnembeddedImages`를 호출해, 다이얼로그 렌더와 "다이얼로그 액션 → Promise 값" 배선만 검증한다. 실제 인쇄 흐름은 PF가 맡는다.
- **공통 입력**: `mdFilePath = '/docs/a.md'`(Windows 케이스만 `C:\docs\a.md`).
- **Rust**: 기존 `image_ops.rs` 테스트처럼 `std::env::temp_dir()` 아래에 테스트마다 고유한 하위 디렉터리를 만들고 `docs/a.md`, `assets/a.png`, `assets/secret.txt` 등을 둔다. `tempfile` 크레이트는 쓰지 않는다(`Cargo.toml` 무변경).

## 테스트 목록 ↔ 요구사항

### 재현 테스트 (별도 표기가 없으면 수정 전 main에서 실패해야 함)

| ID | 파일 | 대상 | 입력 | 기대 | 수정 전 실패 이유 | REQ |
|----|------|------|------|------|-------------------|-----|
| H1 | exportImageEmbed | `exportToHtml` | `![](./images/사진.png)` | `readImageAsBase64` 첫 호출 `/docs/images/사진.png`, 쓴 HTML에 data URI | `/docs/images/%EC%82%AC%EC%A7%84.png`로 호출 | 001, 002 |
| H2 | exportImageEmbed | `exportToHtml` | `![](<./images/my photo.png>)` | 첫 호출 `/docs/images/my photo.png` | `%20` 그대로 | 002 |
| H3 | exportImageEmbed | `exportToHtml` | `![](images/a&b.png)` | 첫 호출 `/docs/images/a&b.png`, 결과 HTML의 해당 `<img>` src가 data URI | `a&amp;b.png`로 호출 | 003 |
| H4 | exportImageEmbed | `exportToHtml` | `![](../assets/a.png)` | 전용 명령 래퍼가 (`/docs/a.md`, `../assets/a.png`)로 1회, `readImageAsBase64`는 이 이미지로 0회, 결과 HTML에 data URI | `readImageAsBase64('/docs/../assets/a.png')` 호출 | 005 |
| H5 | exportImageEmbed | `exportToHtml` | `mdFilePath = C:\docs\a.md`, `![](images/x.png)` | 첫 호출 `C:\docs\images\x.png` | `C:\docs/images/x.png`(구분자 혼용) | 004 |
| X1~X5 | exportImageEmbed | `exportToDocx` | H1~H5와 같은 입력 | 같은 호출 기대, `ImageRun` 생성(`[alt]` 폴백 아님). X3은 토큰 src가 `a&b.png`이므로 `/docs/images/a&b.png` | 같은 이유. X3만 수정 전에도 통과(엔티티 이스케이프가 없는 토큰 경로) | 001~005 |
| E1 | exportImageEmbed | `exportToHtml`·`exportToDocx` | `![](a\&amp;b.png)` (디스크 파일명이 문자 그대로 `a&amp;b.png`) | 두 경로 모두 첫 호출 `/docs/a&amp;b.png`. HTML은 src 속성 `a&amp;amp;b.png`를 한 번만 되돌린 값, DOCX는 토큰 src `a&amp;b.png`를 되돌리지 않은 값 | HTML 쪽은 `/docs/a&amp;amp;b.png`로 호출. DOCX 쪽은 수정 전에도 통과하며, 토큰 경로에 엔티티 디코드를 잘못 걸면 `/docs/a&b.png`가 되어 실패하는 판별 테스트 | 003 |
| P1 | exportImageEmbed | `generateHtmlContent` (mock 없음) | `![](./images/사진.png)` | 첫 호출 `/docs/images/사진.png`, 반환 HTML에 data URI | 인코딩된 경로 | 001, 002 |
| V1 | imageResolver | `embedPreviewImages` | `<img src="images/a&amp;b.png">` | 첫 호출 `/docs/images/a&b.png`, 결과 src data URI | `a&amp;b.png`로 호출 | 003 |
| V2 | imageResolver | `embedPreviewImages` | `<img src="../assets/a.png">` | 전용 명령 래퍼 (`/docs/a.md`, `../assets/a.png`) 1회 | `readImageAsBase64` 호출 | 005 |
| V3 | imageResolver | `embedPreviewImages` | (a) `../images/%EC%82%AC%EC%A7%84.png`, 두 후보 모두 실패 (b) `..%5Cx.png`, 두 후보 모두 실패 | (a) 전용 명령이 (`/docs/a.md`, `../images/사진.png`) → (`/docs/a.md`, `../images/%EC%82%AC%EC%A7%84.png`) 순서로 2회, `readImageAsBase64` 0회 (b) 디코드 후보 `..\x.png`는 `\`로 나눈 `..` 조각 때문에 전용 명령 (`/docs/a.md`, `..\x.png`) 1회, 원문 후보 `..%5Cx.png`는 `..` 조각이 없어 `readImageAsBase64('/docs/..%5Cx.png')` 1회. 둘 다 원래 src 유지 | 전용 명령 없음 | 002, 005 |

### 누락 보고

| ID | 파일 | 조건 | 기대 | REQ |
|----|------|------|------|-----|
| F1 | ExportCompletionDialog | HTML 내보내기 mock이 `onUnembeddedImages(['./img/없음.png'])` 호출 후 경로 반환 | 완료 모달 본문에 `이미지 1개를 포함하지 못했습니다.`와 `./img/없음.png` 표시, 제목·저장 경로·액션 3종 무변경 | 009 |
| F2 | ExportCompletionDialog | 누락 0개 | `data-testid="unembedded-images"` 요소 없음. 기존 AC-001~012가 **수정 없이** 통과 | 009, 011 |
| F3 | exportImageEmbed | `mdFilePath = null`, 서로 다른 상대경로 이미지 2개 + `![](/abs/x.png)` (HTML·DOCX 각각) | `readImageAsBase64` 0회, 전용 명령 0회. 세 이미지 모두 임베드되지 않음(HTML src 불변, DOCX `[alt]`). 콜백은 이름 3개(상대경로 2개 + `/abs/x.png`)로 1회. 반환값은 저장 경로 문자열 | 008, 011, 012 |
| F4 | ExportCompletionDialog | 누락 12개 | 이름 10개 표시 + `외 2개` | 009 |
| F5 | ExportCompletionDialog | PDF 내보내기 mock이 `await options.confirmUnembeddedImages(['a.png'])`를 호출하고 결과를 기록, 사용자가 `계속 인쇄` 선택 | `ConfirmDialog`(`role="dialog"`)가 열리고 본문에 `이미지 1개를 포함하지 못했습니다.`와 `a.png`, 액션은 `cancel`→`print` 순서이며 `print`만 primary. 선택 후 기록된 값 `true`, 다이얼로그 닫힘. `window.alert` 0회 | 010 |
| F9 | ExportCompletionDialog | F5와 같되 `취소`·Escape·백드롭을 각각 실행 | 세 경우 모두 기록된 값 `false`, 다이얼로그 닫힘, 로딩 표시 해제(Export 버튼 다시 활성), unhandled rejection 없음, `window.alert` 0회 | 010 |
| F6 | exportImageEmbed | `http://e.com/a.png`, `data:image/png;base64,AA`만 있음 | 읽기 IPC 0회, 콜백 미호출, HTML의 해당 src 불변 | 008, 012 |
| F7 | exportImageEmbed | 같은 실패 src가 문서에 2회: (a) `exportToHtml` (b) `exportToDocx` | (a) 콜백 이름 1개, 두 `<img>` 모두 원래 src 유지 (b) 콜백 이름 1개, 두 위치 모두 `[alt]` 폴백 | 008, 012 |
| F8 | exportPdf (기존) + ExportCompletionDialog (기존) | 누락 0개 | 기존 `exportPdf.test.ts` 3건과 `ExportCompletionDialog.test.tsx` AC-011("PDF 내보내기 시 완료 모달 미표시")이 **수정 없이** 통과. 확인 콜백 미호출은 PF3 | 010 |
| F10 | exportImageEmbed | `exportToDocx`, `readImageAsBase64`가 `data:image/png;base64,@@@`(잘못된 base64) 반환 | 읽기는 성공했지만 `atob`가 실패해 `[alt]` 폴백, 그 이미지 이름이 콜백으로 보고됨 | 008 |

### PDF 실제 흐름 (`exportPdf.test.ts` 새 describe)

| ID | 조건 | 기대 | REQ |
|----|------|------|-----|
| PF1 | `generateHtmlContent` mock이 `onUnembeddedImages(['a.png'])` 호출, 확인 콜백이 `true`로 resolve | 확인 콜백이 `['a.png']`로 정확히 1회 호출된다. **확인 콜백이 호출되는 시점에** `document.title`은 호출 전 값, `#pdf-export-print`·`#pdf-export-print-style` 없음, `window.addEventListener('afterprint', …)` 호출 0회. resolve 후 인쇄 IPC 1회 | 010 |
| PF2 | PF1과 같되 확인 콜백이 `false`로 resolve | 인쇄 IPC 0회. 반환 후 `#pdf-export-print`·`#pdf-export-print-style` 없음, `document.title`이 호출 전 값과 같음, `afterprint` 리스너 등록 0회, 가짜 타이머 기준 `vi.getTimerCount() === 0`(5분 정리 타이머 미등록). 예외 없이 반환 | 010 |
| PF3 | `onUnembeddedImages`가 호출되지 않음(누락 0개) | 확인 콜백 0회, 인쇄 IPC 1회 | 010 |

### DOCX Mermaid 회귀

| ID | 조건 | 기대 | REQ |
|----|------|------|-----|
| DM1 | 문서 DOM에 `.mermaid-container`가 하나도 없는 상태에서, `HTMLCanvasElement.prototype.getContext`를 래스터 단계에서만 `{ scale, drawImage }`를 돌려주는 스텁으로, `toBlob`을 고정 바이트의 `arrayBuffer()`를 가진 객체로 콜백하는 스텁으로 바꾼다. 마크다운은 ` ```mermaid ` 펜스 1개 | 원본 펜스를 다이어그램 모듈로 렌더해 `ImageRun`이 `type: 'png'`와 스텁 바이트로 1회 생성되고, 그 펜스의 코드 텍스트(`TextRun`)는 생성되지 않는다(SPEC-PREVIEW-015 REQ-015에 맞춰 재작성된 회귀 가드. 0.1.3 당시에는 문서 DOM의 미리보기 SVG를 캡처하는 형태였다) | 012 |

### 보안 (Rust 전용 명령)

| ID | 조건 | 기대 | REQ |
|----|------|------|-----|
| S1 | `docs/a.md` + `../assets/a.png`(존재하는 PNG) | `data:image/png;base64,…` 반환, 바이트 일치 | 006 |
| S2 | `../assets/secret.txt`(존재) | 오류 반환, 파일 내용 미포함 | 006 |
| S3 | (unix) `assets/evil.png` → `secret.txt` 심볼릭 링크 | 오류 반환(해석된 경로 확장자 기준 거부) | 006 |
| S4 | 상대경로 인자에 루트·접두사 구성요소가 있음. 모든 OS: `/etc/x.png`. `#[cfg(windows)]`: `\x.png`, `C:x.png`, `C:\x.png`, `\\server\share\x.png` | 각 입력이 "루트·접두사 구성요소 거부" 오류로 실패하고 파일을 읽지 않는다. 비Windows에서 Windows형 문자열은 일반 파일 이름으로 해석되므로 그 OS에서는 "오류 반환(읽지 않음)"만 단언한다 | 006 |
| S5 | md 경로가 빈 문자열, 상대경로(`docs/a.md`), 또는 `..` 포함 | 오류 반환 | 006, 007 |
| S6 | `../assets/missing.png` | 오류 반환 | 006 |
| S7 | `../assets/A.PNG`(대문자 확장자) | 성공 | 006 |
| S9 | (unix, `#[cfg(unix)]`) `assets/x.png`라는 이름의 FIFO. 새 의존성 없이 테스트 안에서 `std::process::Command::new("mkfifo")`로 만든다(`libc`는 `Cargo.toml`에 없음) | 열기 전 메타데이터 검사로 즉시 오류 반환, 쓰는 쪽 없이도 막히지 않음. **시간 제한 가드(N8)**: 검사 대상 호출을 별도 `std::thread`에서 실행하고(async 명령은 그 스레드 안에서 `tauri::async_runtime::block_on`으로 구동), 결과를 채널로 받아 `recv_timeout(Duration::from_secs(5))`로 기다린다. 시간이 지나면 FIFO를 쓰기용으로 열었다가 핸들을 바로 놓아 막힌 읽기 열기를 풀어 준 뒤 `panic!("S9 timed out — implementation opened FIFO before type check")`로 실패한다. 이렇게 하는 이유: `#[tokio::test]`는 기본이 단일 스레드라 막힌 동기 `open`이 런타임을 붙잡으면 `tokio::time::timeout`이 발화할 수 없고, `cargo test`에는 테스트별 시간 제한이 없어 테스트가 영원히 멈춘다. **건너뛰기 표지(N9)**: `mkfifo` 실행이 실패하면 고정 문구 `S9 SKIPPED: mkfifo unavailable`를 출력하고 건너뛴다. run 단계 보고는 `cargo test -- --nocapture` 출력에 이 문구가 **없음**을 인용해 S9가 실제로 실행되었음을 보인다 | 006 |
| S10 | `assets/d.png`라는 이름의 디렉터리 | 오류 반환, 읽기 없음 | 006 |
| S8 | 기존 Rust 테스트(`test_read_image_path_traversal_prevention` 등 `image_ops.rs`·`file_ops.rs` 전체) | **수정 없이** 통과 — `read_image_as_base64('/x/../y.png')`는 계속 거부 | 007 |

### 회귀

| ID | 조건 | 기대 | REQ |
|----|------|------|-----|
| R1 | 기존 `imageResolver.test.ts` T1~T10 | 수정 없이 통과 | 012 |
| R2 | T11 개정본: `%2E%2E/secret.png`, 두 후보 모두 실패 | 디코드 후보 `../secret.png`는 전용 명령 (`/docs/a.md`, `../secret.png`)으로 1회, 원문 후보는 `..` 조각이 없으므로 `readImageAsBase64('/docs/%2E%2E/secret.png')`로 1회, 클라이언트는 `..`를 정리하지 않음, 원래 src 유지 | 005, 012 |
| R3 | `exportHtml.test.ts` 전체(“writes HTML without script tags” 포함) | 파일 무수정, 전부 통과(`<script` 없음) | 012 |
| R4 | `exportDocx.test.ts` 전체(data URI·http 폴백·jpeg·반환 계약) | 파일 무수정, 전부 통과 | 011, 012 |
| R5 | exportImageEmbed: 저장된 문서에서 `/abs/x.png` (HTML·DOCX) | `readImageAsBase64('/abs/x.png')` 1회, 디코드 없음, 전용 명령 0회 | 012 |
| R6 | `exportOpenRegressionGuard.test.ts` | 기준선 배열에 새 명령 정확히 1줄만 추가된 상태로 통과(나머지 줄 diff 0) | 006, 007 |

## 시나리오 (Given-When-Then)

### AC-EXPORT004-01: 비ASCII·공백·`&` 파일명 이미지가 내보내기에 포함된다 — must-pass

- **Given** `mdFilePath`가 `/docs/a.md`이고 마크다운에 `![](./images/사진.png)`, `![](<./images/my photo.png>)`, `![](images/a&b.png)`, `![](a\&amp;b.png)`가 있으며, IPC mock이 디코드된 실제 파일 경로에 대해 data URI를 돌려줄 때
- **When** 실제 렌더러로 HTML 내보내기, PDF용 HTML 생성, DOCX 내보내기를 각각 실행하면
- **Then** 각 이미지의 첫 읽기 경로는 `/docs/images/사진.png`, `/docs/images/my photo.png`, `/docs/images/a&b.png`, `/docs/a&amp;b.png`이고(엔티티는 출처마다 정확히 한 번만 되돌림), HTML 결과의 해당 `<img>` src는 data URI이며, DOCX에는 `ImageRun`이 생성된다. (H1~H3, X1~X3, E1, P1, V1)

### AC-EXPORT004-02: 상위 폴더 이미지는 후보별로 전용 명령에 라우팅된다 — must-pass

- **Given** 마크다운에 `![](../assets/a.png)`가 있거나, 읽기 후보에 `/`·`\`로 나눈 `..` 조각이 있을 때
- **When** 미리보기, HTML, DOCX 경로에서 이미지를 해석하면
- **Then** `..` 조각이 있는 후보마다 전용 명령 래퍼가 (`/docs/a.md`, 후보 문자열)로 호출되고, `..` 조각이 없는 후보는 일반 `readImageAsBase64`로 읽히며, 성공 시 결과에 이미지가 들어간다. (H4, X4, V2, V3, R2)

### AC-EXPORT004-03: Windows 마크다운 경로에서 구분자가 통일된다 — must-pass

- **Given** `mdFilePath`가 `C:\docs\a.md`이고 `![](images/x.png)`가 있을 때
- **When** HTML과 DOCX 내보내기를 실행하면
- **Then** 첫 읽기 경로는 `C:\docs\images\x.png`다. (H5, X5)

### AC-EXPORT004-04: 임베드되지 않은 이미지가 사용자에게 보고된다 — must-pass

- **Given** 내보내기 중 로컬 이미지 하나 이상이 임베드되지 않을 때(읽기 실패, 또는 DOCX의 base64·크기 변환 실패)
- **When** HTML·DOCX 내보내기가 성공하면
- **Then** 완료 모달에 `이미지 N개를 포함하지 못했습니다.`와 이름(최대 10개, 나머지 `외 K개`)이 표시되고, 제목·저장 경로·액션은 SPEC-EXPORT-002와 같다. (F1, F4, F7, F10)
- **And Given** 문서가 저장되지 않았다면 **Then** 상대경로·`/` 절대경로 로컬 이미지 모두 읽기 시도 없이 누락으로 보고된다. (F3)

### AC-EXPORT004-05: PDF는 확인 후에만 인쇄하고, 취소하면 아무것도 남기지 않는다 — must-pass

- **Given** PDF 내보내기에서 인쇄용 HTML 생성 중 누락 이름이 보고될 때
- **When** `exportToPdf`가 실행되면
- **Then** 확인 콜백은 그 이름 목록으로 1회 호출되고, 호출 시점에 문서 제목·인쇄 요소·`afterprint` 리스너는 아직 바뀌지 않은 상태다. 확인 결과가 `true`면 인쇄 IPC가 1회 호출되고, `false`면 인쇄 IPC 0회, 인쇄 요소 없음, 문서 제목 그대로, `afterprint` 리스너와 정리 타이머 미등록이다. (PF1, PF2)
- **And When** 앱 화면에서 같은 상황이 오면 **Then** `ConfirmDialog`가 HTML·DOCX와 같은 문구 형식으로 열리고, `계속 인쇄`는 `true`, `취소`·Escape·백드롭은 `false`로 이어지며, 어느 경우에도 `window.alert`는 호출되지 않는다. (F5, F9)

### AC-EXPORT004-06: 누락이 없으면 기존 화면·흐름과 같다 — must-pass

- **Given** 누락 이미지가 없을 때(이미지가 없거나, 모두 임베드되었거나, http·data 이미지뿐일 때)
- **When** HTML·DOCX·PDF 내보내기를 실행하면
- **Then** 완료 모달은 SPEC-EXPORT-002와 같은 내용이고, PDF는 확인 콜백 없이 인쇄로 간다. 기존 `ExportCompletionDialog.test.tsx` 12건과 `exportPdf.test.ts` 3건이 수정 없이 통과한다. (F2, F6, F8, PF3)

### AC-EXPORT004-07: 전용 명령은 이미지만 읽고 기존 경로 검증은 그대로다 — must-pass

- **Given** 임시 디렉터리에 마크다운 파일, PNG, 텍스트 파일, 텍스트 파일을 가리키는 `.png` 이름의 심볼릭 링크가 있을 때
- **When** 전용 명령을 각 상대경로와 비정상 인자로 호출하고, 기존 Rust 테스트 전체와 등록 명령 기준선 가드를 실행하면
- **Then** PNG(대문자 확장자 포함)만 data URI로 돌아오고, 텍스트 파일·심볼릭 링크·루트/접두사 구성요소가 있는 인자·비정상 md 경로·없는 파일·`x.png`라는 FIFO·`d.png`라는 디렉터리는 내용 없이(막히지 않고) 오류로 돌아온다. 기존 Rust 테스트는 수정 없이 통과하고(`read_image_as_base64`는 계속 `..`를 거부), 기준선 가드는 새 명령 1줄 추가 외 차이 없이 통과한다. (S1~S10, R6)

### AC-EXPORT004-08: 기존 내보내기 계약과 DOCX Mermaid 회귀 없음 — must-pass

- **Given** 기존 내보내기 테스트와 Mermaid 다이어그램이 있는 DOCX 입력이 있을 때
- **When** 전체 스위트를 실행하면
- **Then** `exportToHtml`·`exportToDocx`는 여전히 성공 시 경로 문자열, 취소 시 `null`을 돌려주고, 내보낸 HTML에 `<script`가 없으며, `exportHtml.test.ts`·`exportDocx.test.ts`가 무수정으로 통과하고, DOCX가 Mermaid 펜스를 원본에서 렌더해 `ImageRun`을 만들며(SPEC-PREVIEW-015 REQ-015), 미리보기 T1~T10이 수정 없이 통과한다. (R1, R3, R4, R5, DM1)

### AC-EXPORT004-09: 다른 폴더로 내보낸 HTML에서 이미지가 보인다 — manual (사용자 수행)

- **Given** 앱에서 한글 파일명, 공백 파일명, `&` 파일명, `../` 상위 폴더 이미지를 각각 참조하는 저장된 `.md` 문서가 있을 때
- **When** HTML로 내보내 이미지 폴더와 **다른 폴더**(예: 바탕화면)에 저장하고 브라우저로 열면
- **Then** 네 이미지가 모두 보이고, 완료 모달에는 누락 경고가 없다.
- **And** 일부러 없는 이미지 하나를 추가해 다시 내보내면 완료 모달에 그 이름이 누락으로 표시되고, 같은 문서를 PDF로 내보내면 인쇄 대화상자 전에 확인 다이얼로그가 뜨며 `취소`하면 인쇄 대화상자가 뜨지 않는다.
- 권장 추가 확인: 같은 문서를 DOCX로 내보내 Word에서 이미지와 Mermaid 다이어그램이 보이는지.

## 기계 검증 게이트

| 명령 | 기대 |
|------|------|
| `npx vitest run src/test/exportImageEmbed.test.ts src/test/imageResolver.test.ts src/test/exportHtml.test.ts src/test/exportDocx.test.ts src/test/exportPdf.test.ts src/test/export.test.ts src/test/ExportCompletionDialog.test.tsx src/test/exportOpenRegressionGuard.test.ts src/test/usePreview.test.ts` | exit 0 |
| `npx vitest run` | exit 0 (전체 회귀) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | exit 0 (S1~S10 포함) |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |

## 검증 경계 (자동으로 증명하지 않는 것)

- `validate_path`·`has_parent_dir_escape` "무변경"과 `exportHtml.test.ts`·`exportDocx.test.ts` "무수정"은 baseline 해시가 없어 테스트로 단언하지 않는다. 기존 테스트 무수정 통과(S8·R3·R4)와 `git diff`(코드 리뷰)로 확인한다.
- 심볼릭 링크 테스트(S3)와 FIFO 테스트(S9)는 unix에서만 실행된다. Windows 심볼릭 링크 거부와 Windows의 비일반 파일(명명된 파이프 등) 거부는 자동 검증하지 않는다. S9는 `mkfifo` 명령이 없는 환경에서는 건너뛰므로, run 단계 보고에 S9가 실제로 실행되었는지(건너뛰지 않았는지)를 출력으로 남긴다.
- **Windows CI가 없다**(`frontend-gates.yml`은 macOS에서 실행되며 cargo 단계가 없다). S4의 `#[cfg(windows)]` 케이스(`\x.png`, `C:x.png`, `C:\x.png`, `\\server\share\x.png`)는 `std::path::Component`가 실행 OS 기준으로 경로를 해석한다는 사실에 기대며, Windows에서 로컬로만 실행된다. **수동 확인 항목**: Windows 머신에서 `cargo test --manifest-path src-tauri/Cargo.toml` 1회 실행해 S4 Windows 케이스 통과를 확인한다.
- 하드링크와 "경로 해석 ↔ 열기" 사이 TOCTOU는 테스트하지 않는다. spec Design Note에 받아들인 잔여 위험으로 기록했다.
- 실제 브라우저·Word·인쇄 대화상자 표시는 수동 확인(AC-09)이다.

## Definition of Done

- 위 기계 검증 게이트 5종 exit 0 (명령 출력 인용).
- 재현 테스트(H1~H5, X1·X2·X4·X5, E1의 HTML 쪽, P1, V1~V3, R2, F3, F7, F10, PF1·PF2)와 S1~S7·S9·S10이 수정 전 코드에서 실패했음을, DM1·X3·E1의 DOCX 쪽이 수정 전에도 통과했음을 run 단계 보고(progress.md §E.2)에 기록.
- 변경 파일이 plan.md 변경 표 안으로 한정.
- 수동 수용(AC-09)과 Windows `cargo test` 1회 결과를 사용자가 확인.
