---
id: SPEC-EXPORT-004
title: "내보내기(HTML/PDF/DOCX) 로컬 이미지 누락 수정 — 공용 이미지 경로 해석기 + 상위 폴더 이미지 제한적 허용 + 누락 보고"
version: "0.1.3"
status: in-progress
created: 2026-10-26
updated: 2026-10-26
author: jw (bjw202)
priority: Medium
phase: "v0.16.2 target"
module: lib/export
lifecycle: spec-anchored
tags: "export, html, pdf, docx, image, bugfix, i18n, percent-encoding, security, tauri"
tier: M
issue_number: 0
related_specs: [SPEC-EXPORT-001, SPEC-EXPORT-002, SPEC-PREVIEW-014, SPEC-IMG-001]
---

# SPEC-EXPORT-004: 내보내기 로컬 이미지 누락 수정

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-10-26 | jw | 최초 작성 — HTML/PDF/DOCX 내보내기에서 로컬 이미지가 빠지는 결함을 고친다. 원인은 (1) 익스포트 쪽 이미지 경로 해석이 SPEC-PREVIEW-014 수정을 받지 못한 옛 복사본이라 퍼센트 디코드·HTML 엔티티 디코드·OS 구분자 처리가 없고, (2) `validate_path`가 `..`를 모두 거부해 상위 폴더 이미지(`../assets/a.png`)를 읽을 수 없으며, (3) 실패를 `catch {}`가 삼켜 사용자가 모른다는 것. 사용자 확정 결정(2026-10-26): 상위 폴더 이미지는 이미지 확장자만 읽는 전용 명령으로 제한적 허용, "이미지를 옆 폴더로 내보내기" 옵션은 이번에 제외, 누락은 사용자에게 보고. |
| 0.1.1 | 2026-10-26 | jw | 사용자 결정 반영(plan-phase, 미결 질문 4건 해소). (1) SPEC 번호를 EXPORT-003 → **EXPORT-004**로 변경 — SPEC-EXPORT-002가 `SPEC-EXPORT-003`을 "PDF 완료 모달" 후속 SPEC으로 이미 예약해 두었으므로(EXPORT-002 spec.md:16·52·351·390) 그 예약을 그대로 두고 다음 번호를 쓴다. (2) PDF 누락 알림을 `window.alert`에서 앱 내 `ConfirmDialog`로 변경(REQ-010) — Tauri WKWebView에서 `alert` 동작이 검증되지 않았고, `exportPdf.ts:22` 주석이 같은 WebView에서 `window.print()`가 동작하지 않는다고 기록하고 있다. (3) 전용 명령 대상은 디코드 결과에 `..`가 있는 상대경로로 한정(기존안 유지). (4) 읽기 범위에 루트 제한을 두지 않고 이미지 확장자 제한만 둔다(기존안 유지). |
| 0.1.2 | 2026-10-26 | jw | plan-audit iteration 1(FAIL 0.75) 결함 D1–D14 반영. 요구사항 변경: REQ-005 후보 경로별 라우팅과 구성요소 구분자(`/`·`\`) 명시(D7), REQ-006 루트·접두사 구성요소 거부 목록과 "한 번 열고 그 핸들로 검사·읽기" 순서 명시(D9·D10), REQ-008 "누락 = 임베드되지 않음"으로 정의하고 미저장 문서의 절대경로 이미지는 계속 임베드(D8·D11), REQ-010 확인 대기 시점을 HTML 생성 직후·문서 제목/인쇄 요소/리스너/타이머 변경 전으로 고정(D4), REQ-012 절대경로 절을 저장 여부와 무관하게 정리. Design Note에 TOCTOU·하드링크 잔여 위험 기록(D10). 테스트 배치(D1–D3·D5·D6·D11·D12)는 acceptance.md, 누락 이름 전달 경로(D14)와 변경 표(D13)는 plan.md. REQ 12건·AC 9건 유지. |
| 0.1.3 | 2026-10-26 | jw | plan-audit iteration 2(FAIL 0.875) 결함 N1–N7 반영. **사용자 결정(N3)**: 0.1.2의 "미저장 문서에서 절대경로 이미지 임베드"를 되돌린다 — 미저장 문서는 상대·절대 어떤 로컬 이미지도 읽지 않고 모두 누락으로 보고한다(REQ-008, REQ-012). 이유: `read_image_as_base64`에 확장자 검사가 없어, 붙여 넣은 내용의 절대경로가 임의 파일을 공유용 HTML에 넣을 수 있다. 현재 main과 미리보기 동작이 그대로 유지되므로 REQ-001의 미리보기·내보내기 동일성 모순(N1)도 해소된다. REQ-006에 열기 전 일반 파일 확인과 비일반 파일(FIFO·디렉터리) 거부를 추가(N2). REQ 12건·AC 9건 유지. |

## Overview

### 증상

- HTML·PDF·DOCX로 내보낸 문서에서 로컬 이미지가 빠진다. 한글 파일명, 공백이 든 파일명(`<./images/my photo.png>`), `&`가 든 파일명, 상위 폴더 경로(`../assets/a.png`)가 대표 사례다.
- 내보낸 HTML은 이미지 폴더와 같은 위치에서 열 때만 이미지가 보인다. 임베드에 실패한 이미지가 상대경로 src로 남기 때문이다.
- DOCX는 실패한 이미지 자리에 `[alt]` 텍스트만 남는다.
- 어느 경우에도 사용자에게 알림이 없다.

### 원인 (오케스트레이터가 2026-10-26 코드 읽기와 markdown-it 실행으로 확인)

1. `src/lib/export/exportHtml.ts:133-174`의 `embedLocalImages`(`exportToHtml`과, PDF가 쓰는 `generateHtmlContent`가 함께 사용)와 `src/lib/export/exportDocx.ts:589-632`의 이미지 분기는 미리보기 해석기의 옛 복사본이다. 퍼센트 디코드, HTML 엔티티 디코드, OS 구분자 처리가 모두 없다(`${mdDir}/${src}`로 고정 조립). 미리보기 쪽 `embedPreviewImages`(`src/lib/image/imageResolver.ts:72-136`)만 SPEC-PREVIEW-014 수정(디코드 우선, 원문 대체)을 받았다.
2. markdown-it(`html: false`, `src/lib/markdown/renderer.ts:385`) 실측 결과(2026-10-26 재확인):

   | 마크다운 | 토큰 `src` (DOCX가 읽는 값) | 렌더 HTML `src` (HTML·PDF가 읽는 값) |
   |----------|------------------------------|----------------------------------------|
   | `![](./images/사진.png)` | `./images/%EC%82%AC%EC%A7%84.png` | 동일 |
   | `![](<./images/my photo.png>)` | `./images/my%20photo.png` | 동일 |
   | `![](images/a&b.png)` | `images/a&b.png` | `images/a&amp;b.png` |
   | `![](../assets/a.png)` | `../assets/a.png` | 동일 |

   따라서 `read_image_as_base64`(`src-tauri/src/commands/image_ops.rs:129`)는 존재하지 않는 경로를 받고 실패한다. 오류는 `catch {}`가 삼킨다.
3. `validate_path`(`src-tauri/src/commands/file_ops.rs:22`, `@MX:ANCHOR` 보안 경계)는 `has_parent_dir_escape`로 `..` 구성요소가 하나라도 있으면 거부한다. 그래서 `../` 이미지는 미리보기와 익스포트 모두에서 읽히지 않는다.

## Requirements (GEARS)

### REQ-EXPORT004-001: 이미지 경로 해석을 한 곳으로 모은다 (Ubiquitous)

- The image source resolver shall 미리보기, HTML 내보내기, PDF 내보내기, DOCX 내보내기가 로컬 이미지 src를 읽을 경로로 바꾸는 유일한 로직이 된다.
- The export modules shall not 상대경로 조립, 퍼센트 디코드, 구분자 치환 로직을 자체적으로 다시 구현한다.
- **When** 같은 `src`와 같은 `mdFilePath`가 주어지면, the image source resolver shall 미리보기와 세 가지 내보내기 모두에서 같은 읽기 시도 순서(같은 경로, 같은 순서)를 만든다.

### REQ-EXPORT004-002: 퍼센트 인코딩된 상대경로를 디코드해서 읽는다 (Event-driven)

- **When** 상대경로 src(`http://`·`https://`·`data:`·`/`로 시작하지 않는 src)를 해석하면, the image source resolver shall 퍼센트 디코드한 경로를 먼저 읽고, 디코드 결과가 원문과 다르고 첫 읽기가 실패하면 원문 경로로 정확히 한 번 더 읽는다(SPEC-PREVIEW-014 REQ-001·002와 같은 의미).
- **When** 퍼센트 디코드가 잘못된 시퀀스 때문에 실패하면, the image source resolver shall 예외를 밖으로 던지지 않고 원문 경로로 한 번만 읽는다.

### REQ-EXPORT004-003: 렌더 HTML에서 뽑은 src의 HTML 엔티티를 되돌린다 (Event-driven)

- **When** src를 렌더된 HTML 문자열에서 뽑으면(미리보기, HTML, PDF), the image source resolver shall 경로를 만들기 전에 markdown-it이 이스케이프한 엔티티(`&amp;`, `&lt;`, `&gt;`, `&quot;`)를 원래 문자로 되돌린다.
- The image source resolver shall not 마크다운 토큰에서 직접 얻은 src(DOCX)에 엔티티 디코드를 적용한다. 토큰 src는 이스케이프되지 않은 값이기 때문이다(파일명이 문자 그대로 `a&amp;b.png`인 경우를 보호).
- The HTML embedders shall 결과 HTML에서 원래 속성 문자열을 data URI로 치환한다(속성 값 매칭은 엔티티 디코드 전 원문 기준).

### REQ-EXPORT004-004: 구분자는 마크다운 파일 경로를 따른다 (Ubiquitous)

- The image source resolver shall 상대경로를 마크다운 파일 디렉터리와 이을 때 `mdFilePath`가 쓰는 구분자(`\`가 있으면 `\`, 없으면 `/`)로 통일한다(기존 `resolveImageSrc`·`embedPreviewImages`와 같은 규칙).

### REQ-EXPORT004-005: 상위 폴더 이미지는 전용 제한 경로로 읽는다 (Event-driven)

- The image source resolver shall 상대경로 src의 읽기 후보(REQ-002의 디코드 후보와 원문 대체 후보)를 **후보마다 따로** 라우팅한다. 후보 문자열을 `/`와 `\` 두 구분자로 나눈 구성요소 중 하나라도 정확히 `..`이면 그 후보는 상위 폴더 이미지 전용 읽기 명령(REQ-006)으로, 그렇지 않으면 일반 이미지 읽기 IPC로 읽는다.
- **When** 후보가 전용 명령으로 라우팅되면, the image source resolver shall 마크다운 파일 경로와 그 후보 문자열(마크다운 디렉터리와 잇지 않은 상대경로)을 그대로 인자로 넘긴다.
- 예: `../images/%EC%82%AC%EC%A7%84.png`는 디코드 후보 `../images/사진.png`와 원문 후보 모두 전용 명령으로 간다. `%2E%2E/secret.png`는 디코드 후보 `../secret.png`만 전용 명령으로 가고, 원문 후보(`..` 구성요소 없음)는 일반 IPC로 간다.
- The image source resolver shall not 클라이언트에서 `..`를 정규화하거나 제거한다. 정규화와 검증은 Rust 쪽 전용 명령이 맡는다.
- 이 요구는 미리보기와 세 가지 내보내기에 모두 적용된다.

### REQ-EXPORT004-006: 상위 폴더 이미지 전용 읽기 명령의 경계 (Ubiquitous + Unwanted)

- The parent-directory image read command shall 마크다운 파일의 디렉터리와 상대경로를 이어 붙인 뒤 실제 경로로 해석(심볼릭 링크 해소 포함)하고, 해석된 경로의 확장자가 `png`·`jpg`·`jpeg`·`gif`·`webp`·`svg`·`bmp`(대소문자 무시) 중 하나인지 확인한다. 그다음 **열기 전에** 해석된 경로의 메타데이터로 일반 파일인지 확인한다(FIFO·디렉터리·장치 파일이면 열지 않고 거부). 확인을 통과하면 해석된 경로를 **한 번만 열어**, 그 열린 파일 핸들의 메타데이터로 일반 파일인지 다시 확인하고, 같은 핸들에서 내용을 읽어 data URI로 돌려준다.
- The parent-directory image read command shall not 일반 파일이 아닌 대상(예: 이름이 `x.png`인 FIFO, 이름이 `d.png`인 디렉터리)을 열거나, 그런 대상 때문에 응답 없이 멈춘다.
- The parent-directory image read command shall not 위 확장자가 아닌 파일을 읽는다. 심볼릭 링크 이름이 이미지 확장자여도 해석된 대상이 이미지 확장자가 아니면 거부한다.
- The parent-directory image read command shall not 루트 구성요소나 드라이브·UNC 접두사 구성요소를 하나라도 가진 상대경로 인자를 받아들인다. 거부 대상은 최소한 `/x.png`, `\x.png`, `C:x.png`, `C:\x.png`, `\\server\share\x.png`이다(경로 구성요소 해석 기준이며, 절대경로 여부 하나만으로 판단하지 않는다).
- The parent-directory image read command shall not 마크다운 파일 경로가 비어 있거나, 절대경로가 아니거나, 기존 `validate_path` 검사를 통과하지 못하면 아무것도 읽지 않는다.
- **When** 거부하거나 읽기에 실패하면, the parent-directory image read command shall 파일 내용 없이 오류만 돌려준다.

### REQ-EXPORT004-007: 기존 경로 검증은 약화하지 않는다 (Unwanted)

- The path validation boundary shall not 바뀐다. `validate_path`와 `has_parent_dir_escape`의 동작은 그대로이며, `read_image_as_base64`를 포함한 기존 모든 명령은 계속 `..` 경로를 거부한다.

### REQ-EXPORT004-008: 내보내기는 임베드하지 못한 이미지를 모은다 (Event-driven + State-driven)

- "누락"은 **임베드되지 않음**을 뜻한다. 읽기 실패뿐 아니라 읽은 뒤의 변환 실패(예: DOCX의 base64 디코드나 이미지 크기 계산 실패)로 HTML의 src가 그대로 남거나 DOCX에 `[alt]` 폴백이 들어간 경우를 모두 포함한다.
- **When** 내보내기 중 로컬 이미지(`http://`·`https://`·`data:`가 아닌 src)가 임베드되지 않으면, the export pipeline shall 그 이미지의 표시 이름(퍼센트·엔티티 디코드한 src, 디코드 실패 시 원문)을 누락 목록에 한 번 기록하고 내보내기를 계속 진행한다.
- **While** 문서가 저장되지 않은 상태(`mdFilePath`가 `null`)이면, the export pipeline shall 상대경로든 `/`로 시작하는 절대경로든 **어떤 로컬 이미지도 읽지 않고**, 그 이미지를 모두 누락으로 기록한다. 이는 현재 동작(미저장 문서에서는 로컬 파일을 읽지 않음)과 미리보기의 동작을 그대로 유지한다.
- The export pipeline shall 같은 src가 문서에 여러 번 나와도 누락 목록에는 한 번만 기록한다.
- The export pipeline shall not `http://`·`https://`·`data:` 이미지를 누락으로 기록한다.

### REQ-EXPORT004-009: HTML·DOCX 완료 모달에 누락을 보고한다 (Event-driven)

- **When** HTML 또는 DOCX 내보내기가 성공하고 누락 목록에 1개 이상이 있으면, the export completion dialog shall 기존 본문(저장 경로)에 더해 `이미지 N개를 포함하지 못했습니다.` 문구와 누락 이미지 이름을 표시한다. 이름은 최대 10개까지 보이고 나머지는 `외 K개`로 요약한다.
- **When** 누락 목록이 비어 있으면, the export completion dialog shall SPEC-EXPORT-002가 정한 것과 같은 제목·본문·액션으로 표시된다.

### REQ-EXPORT004-010: PDF는 인쇄 대화상자 전에 알린다 (Event-driven)

- **When** PDF 내보내기에서 누락 목록에 1개 이상이 있으면, the PDF export flow shall 네이티브 인쇄 대화상자를 띄우기 전에 HTML·DOCX 완료 모달과 같은 앱 내 다이얼로그 컴포넌트(`ConfirmDialog`)를 열어 REQ-009와 같은 문구와 이름 목록 형식으로 알린다. 다이얼로그의 액션은 `취소`와 `계속 인쇄`(마지막·primary)다.
- **When** 사용자가 그 다이얼로그에서 `계속 인쇄`를 선택하면, the PDF export flow shall 지금과 같은 경로로 인쇄 대화상자를 띄운다.
- The PDF export flow shall 이 확인을 인쇄용 HTML 생성이 끝난 **직후**, 그리고 문서 제목 변경·이전 인쇄 요소 정리·인쇄용 요소 삽입·`afterprint` 리스너 등록·정리용 타이머 등록 중 어느 것보다도 **먼저** 기다린다.
- **When** 사용자가 그 다이얼로그에서 `취소`를 선택하거나 Escape·백드롭으로 닫으면, the PDF export flow shall 인쇄 대화상자를 띄우지 않고, 문서 제목을 바꾸지 않으며, 인쇄용 요소를 문서에 넣지 않고, `afterprint` 리스너와 정리용 타이머를 등록하지 않으며, 로딩 표시를 해제한다.
- **When** 누락 목록이 비어 있으면, the PDF export flow shall 다이얼로그 없이 지금과 같이 인쇄 대화상자를 띄운다.
- The PDF export flow shall not 누락 알림에 `window.alert`를 쓴다.

### REQ-EXPORT004-011: 내보내기 반환 계약을 유지한다 (Ubiquitous)

- The `exportToHtml` and `exportToDocx` functions shall SPEC-EXPORT-002 REQ-007의 반환 계약(성공 시 저장 경로 문자열, 저장 다이얼로그 취소 시 `null`)을 그대로 지킨다.
- The export pipeline shall 누락 목록을 반환값이 아닌 선택적 전달 경로로 넘기며, 호출자가 그 경로를 제공하지 않으면 동작은 지금과 같다.

### REQ-EXPORT004-012: 기존 동작 회귀 금지 (Ubiquitous)

- The export pipeline shall `http://`·`https://`·`data:` 이미지에 대해 읽기를 호출하지 않고 src를 바꾸지 않는다.
- **While** 문서가 저장된 상태이면, the export pipeline shall `/`로 시작하는 절대경로 src를 디코드 없이 그 경로 그대로 일반 이미지 읽기 IPC로 읽는다(미저장 문서는 REQ-008에 따라 읽지 않음).
- The HTML export shall not 내보낸 파일에 JavaScript를 넣는다(SPEC-EXPORT-001 REQ-EXPORT-020).
- The DOCX export shall Mermaid 다이어그램 캡처·삽입 동작과, 임베드하지 못한 이미지 자리에 `[alt]` 텍스트를 넣는 동작을 지금과 같이 유지한다.
- The preview image embedder shall SPEC-PREVIEW-014의 T1~T10 동작을 그대로 유지한다. T11(디코드 결과에 `..`가 생기는 경우)만 REQ-005에 따라 전용 명령 경로로 바뀐다.

## Design Note — 왜 이 범위인가

- **상위 폴더 허용이 새 노출을 만들지 않는 이유**: `read_image_as_base64`는 이미 `/`로 시작하는 절대경로 이미지를 디스크 어디서든 읽는다(루트 제한 없음). 전용 명령은 같은 범위를 상대경로 표기로 열 뿐이고, 오히려 확장자 제한과 심볼릭 링크 해소 후 재검사를 추가로 건다. `validate_path` 자체는 건드리지 않으므로 다른 명령(파일 읽기·쓰기·삭제·이름 바꾸기)의 `..` 거부는 유지된다.
- **받아들인 잔여 위험 — TOCTOU·하드링크**: 경로 해석과 파일 열기 사이에 마지막 구성요소가 비이미지 파일을 가리키는 링크로 바뀌거나, 비이미지 파일을 가리키는 하드링크가 이미지 확장자 이름을 가진 경우(실제 경로 해석은 하드링크를 풀지 않는다), 전용 명령이 그 바이트를 이미지로 돌려줄 수 있다. 이 위험은 받아들인다. 근거: (1) 전용 명령은 언제나 이미지 MIME의 data URI로만 돌려주고 렌더러 밖으로 경로나 파일 목록을 내보내지 않으며, (2) 기존 `read_image_as_base64`가 이미 절대경로로 디스크의 어떤 파일이든(비이미지 포함) 읽을 수 있어 이 명령이 새 도달 범위를 만들지 않고, (3) 이 공격에는 사용자 디스크에 대한 로컬 쓰기 권한이 필요하다. "한 번 열고 그 핸들로 검사·읽기" 순서는 검사와 읽기 사이의 교체만 막는다.
- **엔티티 디코드를 렌더 HTML 경로에만 거는 이유**: 같은 `![](images/a&b.png)`이 HTML 경로에서는 `a&amp;b.png`, DOCX 토큰에서는 `a&b.png`로 들어온다. 출처마다 한 번씩만 되돌려야 이중 디코드가 생기지 않는다.
- **반환 계약을 바꾸지 않는 이유**: `exportToDocx`의 `@MX:ANCHOR`와 SPEC-EXPORT-002 테스트(`ExportCompletionDialog.test.tsx`)가 `string | null`에 묶여 있다. 누락 정보는 선택적 전달 경로로 보내면 기존 호출자와 테스트를 고치지 않아도 된다. 구체 방식은 plan.md D4.

## Exclusions (What NOT to Build)

### Out of Scope — 이미지를 옆 폴더로 내보내기

- HTML 내보내기 시 이미지를 base64로 넣는 대신 `<이름>_files/` 같은 옆 폴더로 복사하는 옵션은 만들지 않는다(사용자 결정, 2026-10-26). 이번에는 base64 임베드를 유지한다. 후속 SPEC 후보.

### Out of Scope — 새 설정·캐시

- 이미지 해석 결과 캐시 계층, 새 설정 토글, 누락 이미지 재시도 UI는 만들지 않는다.

### Out of Scope — 절대경로·URL 이미지

- `/`로 시작하는 절대경로 src의 퍼센트 디코드는 넣지 않는다(기존 동작 유지). 한글이 든 절대경로 이미지는 계속 읽히지 않을 수 있으며, 이번 SPEC부터는 누락 보고에 나타난다.
- Windows 드라이브 문자로 시작하는 src(`C:/x.png`)를 절대경로로 다루는 일은 하지 않는다(기존 동작 유지).
- `http://`·`https://` 이미지를 내려받아 임베드하지 않는다. 이들은 누락으로 보고하지도 않는다.

### Out of Scope — 미리보기 누락 알림·기타 결함

- 미리보기 패널에서 깨진 이미지를 사용자에게 알리는 UI는 만들지 않는다(미리보기는 해석 경로 통일만 받는다).
- 기존 `read_image_as_base64`가 이미지가 아닌 확장자도 읽는 동작(`application/octet-stream` 폴백)은 이번에 바꾸지 않는다. 별도 보안 정리 후보로 기록한다.
- DOCX에서 `svg`·`webp`·`gif` 이미지의 형식 변환, 한글 파일명의 NFC/NFD 정규화, 공백이 든 꺾쇠 없는 목적지(`![](a b.png)`, markdown-it이 이미지로 파싱하지 않음)는 다루지 않는다.

### Out of Scope — 다이어그램 렌더러

- Mermaid 렌더러 교체 등 다이어그램 관련 변경은 이 SPEC 범위가 아니다.

## Acceptance

수용 기준과 테스트 목록은 `acceptance.md` 참조.

## References

- `src/lib/image/imageResolver.ts:18-58` `resolveImageSrc`, `:72-136` `embedPreviewImages` — 공용 해석기의 출발점
- `src/lib/export/exportHtml.ts:26-66` `exportToHtml`, `:76-87` `generateHtmlContent`, `:133-174` `embedLocalImages` — 대체 대상
- `src/lib/export/exportDocx.ts:18-60` `exportToDocx`(`@MX:ANCHOR`), `:547-640` `convertInlineTokensToRuns` 이미지 분기 — 대체 대상
- `src/lib/export/exportPdf.ts:28-29` — `generateHtmlContent` 소비
- `src/lib/export/types.ts:9-20` `ExportOptions`
- `src/components/layout/AppLayout.tsx:144-210` 내보내기 핸들러, `:484-500` 완료 모달(`ConfirmDialog`)
- `src/lib/tauri/ipc.ts:184-186` `readImageAsBase64`
- `src-tauri/src/commands/image_ops.rs:129-160` `read_image_as_base64`, `:177-393` 테스트
- `src-tauri/src/commands/file_ops.rs:10-30` `has_parent_dir_escape`·`validate_path`
- `src-tauri/src/lib.rs:78-97` `invoke_handler`
- `src/test/exportOpenRegressionGuard.test.ts:54-96` — 등록 명령 목록 기준선 가드
- SPEC-EXPORT-002 REQ-007(반환 계약), SPEC-EXPORT-001 REQ-EXPORT-020(JavaScript 금지), SPEC-PREVIEW-014(디코드 우선·원문 대체)
