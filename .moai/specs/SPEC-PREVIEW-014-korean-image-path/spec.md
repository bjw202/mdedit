---
id: SPEC-PREVIEW-014
title: 미리보기 한글(비ASCII) 상대경로 이미지 깨짐 수정 (퍼센트 인코딩 디코드)
version: 1.0.2
status: implemented
created: 2026-10-07
updated: 2026-10-07
author: jw (bjw202)
priority: Medium
phase: "v0.16.1 target"
module: lib/image
lifecycle: spec-first
tags: "preview, image, bugfix, i18n, percent-encoding, korean"
tier: S
issue_number: 0
related_specs: [SPEC-PREVIEW-001, SPEC-PREVIEW-008, SPEC-IMG-MODE-003, SPEC-IMG-WIDGET-002]
---

# SPEC-PREVIEW-014: 미리보기 한글(비ASCII) 상대경로 이미지 깨짐 수정

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-10-07 | jw | 최초 작성 — 미리보기에서 파일명에 한글이 들어간 상대경로 이미지(`![도1](figures_svg/도01_frame.png)`)가 깨지는 결함을 고친다. 원인은 markdown-it이 링크 목적지를 퍼센트 인코딩한 src를 `embedPreviewImages`가 디코드 없이 파일 경로로 쓰는 것. 디코드한 경로를 먼저 읽고, 실패하면 원문 경로로 한 번 더 읽는다. 잘못된 퍼센트 시퀀스는 예외 없이 원문으로 처리한다. |
| 1.0.1 | 2026-10-07 | jw | plan-audit PASS-WITH-DEBT 반영: D1-D6 — `tags`를 따옴표 문자열로 변경(lint), T11 기대 호출 명시, 테스트 mock 인용 정정(`convertFileSrc`), 제외 항목에 `&`·NFC/NFD·익스포트 쌍둥이 결함 기록. 요구사항 변경 없음. |
| 1.0.2 | 2026-10-07 | jw | SPEC 번호를 PREVIEW-013 → PREVIEW-014로 변경 — CHANGELOG 0.16.0이 013을 폐기된 Web Worker 계획 이름으로 이미 사용 중이어서 충돌. 요구사항 변경 없음. |

## Overview

### 증상

미리보기 패널에서 `![도1](figures_svg/도01_frame.png)`처럼 파일명에 한글이 들어간 상대경로 이미지가 깨진 이미지로 표시된다. 같은 문서를 ASCII 파일명(`figures_svg/fig01_frame.png`)으로 바꾸면 정상 표시된다(사용자 실측 확인).

### 원인 (확인된 사실)

1. `src/hooks/usePreview.ts:54`는 `renderMarkdown(content, highlighter, isDark)`를 `mdFilePath` 없이 호출한다. 따라서 `src/lib/markdown/renderer.ts:329`의 `imageResolverPlugin`은 src를 재작성하지 않는다.
2. markdown-it은 링크 목적지의 비ASCII 문자를 퍼센트 인코딩한다. `figures_svg/도01_frame.png` → `figures_svg/%EB%8F%8401_frame.png` (재현 확인). ASCII 경로는 바뀌지 않는다.
3. `src/lib/image/imageResolver.ts:72`의 `embedPreviewImages`는 인코딩된 src 그대로 `mdDir + sep + normalizedSrc`(`:103-106`)를 만들어 `readImageAsBase64`(`:109`)를 호출한다.
4. Rust `read_image_as_base64`(`src-tauri/src/commands/image_ops.rs:129`)는 `validate_path` 후 `std::fs::read`를 수행하는데, 디스크에는 `%EB%8F%84…` 이름의 파일이 없으므로 실패한다.
5. `catch`(`imageResolver.ts:112-114`)가 오류를 삼키고 원래 src를 유지해 깨진 이미지가 남는다.

`src/lib/image/*.ts`와 `usePreview.ts`에는 `decodeURI`/`decodeURIComponent`가 없다. 두 파일의 최종 수정은 2026-03-05(커밋 1e742d7)이므로 최근 이미지 작업(SPEC-IMG-MODE-003, SPEC-IMG-WIDGET-002)으로 생긴 회귀가 아니다.

## Requirements (GEARS)

### REQ-PREVIEW014-001: 퍼센트 인코딩된 상대경로를 디코드해서 읽는다 (Event-driven)

- **When** `embedPreviewImages`가 상대경로 src(`http://`·`https://`·`data:`·`/`로 시작하지 않는 src)를 만나면, the preview image embedder shall 그 src를 퍼센트 디코드한 경로로 절대경로를 만들어 먼저 읽는다.
- The preview image embedder shall 디코드를 `./` 제거 및 OS 구분자 치환보다 먼저 적용한다(디코드 결과의 `/`도 기존과 같이 OS 구분자로 바뀐다).

### REQ-PREVIEW014-002: 디코드 경로 실패 시 원문 경로로 한 번 더 읽는다 (Event-driven)

- **When** 디코드한 경로가 원문(인코딩된) 경로와 다르고 디코드 경로 읽기가 실패하면, the preview image embedder shall 원문 경로로 정확히 한 번 더 읽는다.
- **When** 디코드한 경로가 원문 경로와 같으면(ASCII 경로 등), the preview image embedder shall 읽기를 한 번만 수행한다.
- **When** 두 경로 모두 읽기에 실패하면, the preview image embedder shall 해당 `<img>`의 원래 src를 그대로 둔다(기존 동작과 동일).

### REQ-PREVIEW014-003: 잘못된 퍼센트 시퀀스는 예외 없이 원문으로 처리한다 (Event-detected)

- **When** 퍼센트 디코드가 잘못된 시퀀스(예: `%E0%A4`처럼 완결되지 않은 UTF-8) 때문에 실패하면, the preview image embedder shall 예외를 밖으로 던지지 않고 원문 src로 경로를 만들어 한 번 읽는다.
- The preview image embedder shall 한 이미지의 디코드 실패나 읽기 실패와 무관하게 같은 문서의 나머지 이미지를 계속 처리한다.

### REQ-PREVIEW014-004: 기존 동작 회귀 금지 (Ubiquitous)

- The preview image embedder shall `http://`·`https://`·`data:` src에 대해 읽기를 호출하지 않고 src를 바꾸지 않는다.
- The preview image embedder shall `/`로 시작하는 절대경로 src를 기존과 같은 경로(디코드 없음)로 읽는다.
- The preview image embedder shall ASCII 상대경로와 `./` 접두 상대경로에 대해 기존과 동일한 절대경로로 한 번만 읽는다.
- The preview image embedder shall HTML 안의 src 치환과 같은 src 중복 처리(캐시) 키로 원문 src를 계속 사용한다.

### REQ-PREVIEW014-005: 경로 검증을 약화하지 않는다 (Unwanted)

- The preview image embedder shall not 디코드 경로든 원문 경로든 `readImageAsBase64` IPC(Rust `validate_path` 경유)를 거치지 않고 파일을 읽거나 존재 여부를 판단한다.
- The preview image embedder shall not 디코드 결과의 `..` 구성요소를 클라이언트에서 정규화하거나 제거한다. `..` 거부는 기존처럼 Rust `validate_path`가 담당한다.

## Design Note — 읽기 순서: 디코드 우선, 원문 대체

- **결정**: 디코드한 경로를 먼저 읽고, 실패하면 원문 경로를 읽는다.
- **근거**: markdown-it은 비ASCII 문자와 단독 `%`를 항상 인코딩한다(`100%.png` → `100%25.png`). 따라서 미리보기에 도달하는 src에서 디스크의 실제 파일명과 일치하는 쪽은 거의 언제나 디코드 결과다. 원문을 먼저 읽으면 한글 파일마다 실패하는 IPC 호출이 한 번씩 더 생긴다.
- **원문 대체가 필요한 경우**: 파일명 자체에 유효한 퍼센트 시퀀스가 들어 있는 경우(예: 디스크 파일명이 `a%20b.png`). markdown-it은 유효한 `%XX`를 그대로 두므로 디코드하면 `a b.png`가 되어 틀린다. 이때 원문 경로 재시도가 파일을 찾는다.
- **리터럴 `%` 파일명**(`100%.png`): markdown-it이 `100%25.png`로 인코딩하고, 디코드 결과 `100%.png`가 첫 시도에서 맞는다.
- **보안**: 두 경로 모두 같은 IPC와 `validate_path`를 거친다. 재시도는 검증 경로를 하나 더 만들 뿐 우회 경로를 만들지 않는다.

## Exclusions (What NOT to Build)

### Out of Scope — 공백이 든 파일명

- 파일명에 공백이 있는 이미지(`![](a b.png)`)는 markdown-it이 이미지로 파싱하지 않으므로 이 SPEC에서 다루지 않는다. 별도 SPEC 후보.

### Out of Scope — `&`가 든 파일명

- markdown-it은 src 속성에서 `&`를 HTML 이스케이프한다(`![x](a&b.png)` → `<img src="a&amp;b.png">`, markdown-it 14 실측). 퍼센트 디코드는 `&amp;`를 되돌리지 않으므로 파일명에 `&`가 든 이미지는 이 수정 후에도 해결되지 않는다. 후속 SPEC 후보.

### Out of Scope — 한글 파일명의 유니코드 정규화(NFC/NFD)

- 마크다운 본문의 파일명(보통 NFC)과 디스크 파일명(macOS에서 만든 파일은 NFD일 수 있음)의 정규화 형태가 다른 경우는 다루지 않는다. APFS·HFS+는 정규화에 무관하게 찾지만 NTFS·ext4는 정규화 형태를 구분하므로, macOS가 아닌 환경에서는 이런 파일이 계속 깨질 수 있다.

### Out of Scope — 편집기·렌더러 배선

- 편집기 인라인 이미지 위젯(`src/components/editor/extensions/image-widget.ts`)은 변경하지 않는다.
- `usePreview.ts`의 `renderMarkdown` 호출 인자, `renderer.ts`의 `imageResolverPlugin` 배선은 변경하지 않는다.

### Out of Scope — Rust·익스포트·절대경로

- Rust 코드(`image_ops.rs`, `validate_path`)는 변경하지 않는다.
- 익스포트 경로(`exportHtml.ts`, `exportDocx.ts`)는 변경하지 않는다. 단, `src/lib/export/exportHtml.ts`의 `embedLocalImages`(약 133-171행)는 같은 로직의 거의 복사본으로 인코딩된 src를 디코드 없이 경로로 쓰는 동일한 결함을 갖고 있다. 따라서 이 SPEC 이후에도 HTML 익스포트에서는 한글 파일명 이미지가 빠진다. 알려진 후속 SPEC 후보로 기록하며 여기서는 고치지 않는다.
- `/`로 시작하는 절대경로 src의 디코드는 이번 범위에 넣지 않는다(기존 동작 유지).

## Acceptance

수용 기준과 테스트 목록은 `acceptance.md` 참조.

## References

- `src/lib/image/imageResolver.ts:72-118` — `embedPreviewImages` (수정 대상)
- `src/hooks/usePreview.ts:54` — `renderMarkdown`을 `mdFilePath` 없이 호출 (변경 없음)
- `src/lib/markdown/renderer.ts:329` — `imageResolverPlugin` (변경 없음)
- `src-tauri/src/commands/image_ops.rs:129` — `read_image_as_base64` (변경 없음)
- `src-tauri/src/commands/file_ops.rs:22` — `validate_path` (`..` 거부, 변경 없음)
