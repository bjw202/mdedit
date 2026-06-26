---
id: SPEC-PREVIEW-007
version: "1.0.0"
status: draft
created: "2026-06-26"
updated: "2026-06-26"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-PREVIEW-001
  - SPEC-PREVIEW-004
  - SPEC-PREVIEW-005
supersedes:
  - SPEC-PREVIEW-004 (파일 탐색기 확장자 allowlist 노출 동작)
  - SPEC-PREVIEW-005 (파일 탐색기 확장자 allowlist 노출 동작)
tags:
  - preview
  - file-explorer
  - graceful-degradation
  - binary-files
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-26 | jw | 최초 SPEC 작성 — 파일 탐색기의 확장자 allowlist 필터(`filterViewableFiles`/`filterMdOnly`)를 제거하여 모든 파일(dotfile 포함)을 노출하고, 비-렌더 파일을 graceful 처리한다. `getFileViewType`에 `'text'`(평문)·`'unsupported'`(플레이스홀더) 분기 추가, `openFile` 파일 분류(text/binary/too-large/html) 로직, 신규 `UnsupportedFileViewer` 컴포넌트. SPEC-PREVIEW-004/005의 탐색기 노출 동작을 대체(supersede). |

## Overview

`mdedit`의 **파일 탐색기에서 확장자 allowlist 필터를 제거**하여 폴더 안의 **모든 파일(dotfile·확장자 없는 파일 포함)과 디렉터리를 노출**하고, 렌더링이 불가능한 파일을 선택해도 앱이 깨지지 않도록 **graceful 처리**를 추가한다.

현재 파일 탐색기는 `filterViewableFiles`(별칭 `filterMdOnly`, `FileExplorer.tsx` line 50-67)로 `.md`/`.html` 또는 `extensionLangMap` 등록 확장자만 노출한다(SPEC-PREVIEW-004/005에서 도입). 사용자는 이 allowlist를 **없애고 모든 파일을 보기를 원한다.** 본 SPEC은 이 노출 동작을 대체(supersede)한다.

allowlist를 풀면 두 가지 결함이 노출된다(소스 검증 완료):

1. **`getFileViewType` 폴백 결함** — `PreviewContainer.tsx` line 25-36의 라우팅은 `.html`→`'html'`, `extensionLangMap` 매핑→`'code'`, **그 외 전부→`'markdown'`** 으로 폴백한다. 필터를 풀면 `.gitignore`/`.rs`/`.csv`/확장자 없는 파일 등이 **마크다운으로 잘못 렌더**되고, 바이너리(`.png`/`.pdf`/`.zip`)는 깨진다.
2. **`read_file` 바이너리 reject 미처리** — `file_ops.rs` line 25-35의 `read_file`은 `std::fs::read_to_string`을 사용하므로 **바이너리는 읽기 단계에서 reject**된다. `useFileSystem.ts` `openFile`(line 132-160)은 이 reject를 **핸들링하지 않아 클릭이 조용히 깨진다.**

본 SPEC은 이 두 결함을 닫으면서, 사용자가 확정한 3가지 처리 규칙(평문 텍스트 / 미리보기 불가 플레이스홀더 / 대용량 건너뜀)에 따라 모든 파일 클릭을 안전하게 만든다. 마크다운 렌더링 파이프라인(SPEC-PREVIEW-001/002/003), `.html` 보기(SPEC-PREVIEW-004), 코드 뷰어(SPEC-PREVIEW-005)의 기존 동작은 회귀 없이 유지한다.

## Glossary

- **파일 탐색기 필터(file-explorer filter)**: `FileExplorer.tsx`에서 파일 트리를 노출 전 가공하는 함수들. `filterTree`(검색 쿼리 필터, 유지)와 `filterViewableFiles`(별칭 `filterMdOnly`, 확장자 allowlist — **본 SPEC에서 제거**)가 있다. 현재 `visibleTree = filterTree(filterMdOnly(fileTree), searchQuery)`.
- **파일 종류 분기(file-type routing)**: 선택된 파일을 어떤 프리뷰로 보낼지 결정하는 순수 함수 `getFileViewType`. 현재 `'html' | 'code' | 'markdown'`을 반환. 본 SPEC에서 `'text'`·`'unsupported'`를 추가한다.
- **평문 텍스트 뷰(text view)**: 코드 매핑에 없지만 텍스트로 읽히는 파일(`.gitignore`/`.rs`/`.log`/`.csv`/확장자 없는 파일 등)을 **구문 강조 없이 평문으로 표시**하고 **편집 가능**하게 두는 보기. 구현 힌트: `CodeFileViewer`를 `lang='text'`로 재사용.
- **미리보기 불가(unsupported view)**: 바이너리/읽기 불가/대용량 파일을 선택했을 때 표시하는 보기 전용 플레이스홀더. 신규 `UnsupportedFileViewer`가 사유(바이너리 / 대용량)와 파일명을 표시한다. 편집기에는 내용을 로드하지 않는다.
- **프리뷰 상태(preview status)**: 파일을 연 시점(`openFile`)에 판정한 분류 결과(text / binary / too-large / html). `getFileViewType`은 경로만으로는 바이너리·대용량 여부를 알 수 없으므로, 라우팅이 이 상태를 함께 참조해야 한다. 배선 방식은 plan에서 확정한다.
- **대용량 임계값(size threshold)**: 이 크기를 초과하면 전체 로드 대신 "미리보기 건너뜀"으로 처리하는 바이트 단위 경계값(제안 5MB, plan에서 확정). `FileNode.size`로 열기 전에 판정한다.
- **FileNode.size**: `directory_ops.rs`의 `new_file`이 채우는 파일 크기(바이트) 메타데이터. 프론트엔드가 파일을 열기 전에 크기를 알 수 있어, 대용량 가드에 Rust 신규 호출이 불필요하다.
- **editor-disable 플레이스홀더(editor-disable placeholder)**: `.html` 파일 선택 시 편집기 패널에 표시되는 "이 형식은 편집할 수 없습니다" 안내(`AppLayout.tsx` line 258-284, SPEC-PREVIEW-004). 바이너리/대용량 파일에 동일 패턴을 재사용한다.

## EARS Requirements

### REQ-PREVIEW007-001: 파일 탐색기 전체 파일 노출 (Ubiquitous)

- The system **shall** 파일 탐색기가 열린 폴더 안의 모든 파일과 디렉터리를 확장자에 무관하게 노출하며, dotfile(`.gitignore` 등)과 확장자 없는 파일도 포함한다.
- The system **shall** 확장자 allowlist 필터(`filterViewableFiles`/`filterMdOnly`)를 노출 경로(`visibleTree`)에서 제거하고, 검색 쿼리 필터(`filterTree`)는 그대로 유지한다.

### REQ-PREVIEW007-002: 폴더 열기 시 전체 파일 표시 (Event-driven)

- **WHEN** 사용자가 폴더를 열면, **the system shall** 확장자 필터링 없이 폴더의 전체 파일·디렉터리 트리를 사이드바에 표시한다.
- **WHEN** 사용자가 검색어를 입력하면, **the system shall** 기존 `filterTree` 동작으로 이름 일치 파일과 그 조상 디렉터리만 표시한다(allowlist 재도입 없음).

### REQ-PREVIEW007-003: 인식 안 되는 텍스트 파일 평문 표시 + 편집 (Event-driven)

- **WHEN** 사용자가 코드 매핑(`extensionLangMap`)에 없고 마크다운/HTML도 아니지만 텍스트로 읽히는 파일(예: `.gitignore`, `.rs`, `.log`, `.csv`, 확장자 없는 파일)을 선택하면, **the system shall** 프리뷰를 평문 텍스트로 표시하고 편집기에 파일 내용을 로드하여 편집 가능하게 한다.
- The system **shall** 평문 텍스트 표시를 기존 `CodeFileViewer`를 `lang='text'`로 재사용하여 구현하고, 별도의 신규 마크다운 렌더 경로를 만들지 않는다.

### REQ-PREVIEW007-004: 바이너리/읽기 불가 파일 graceful 처리 (Event-driven)

- **WHEN** 사용자가 바이너리/읽기 불가 파일(예: `.png`, `.pdf`, `.zip`, 실행파일)을 선택하면, **the system shall** "미리보기 불가" 플레이스홀더(사유: 바이너리, 파일명 포함)를 프리뷰에 표시하고 편집기에는 내용을 로드하지 않는다.
- **WHEN** `read_file`이 비-UTF-8(바이너리) 사유로 reject되면, **the system shall** `openFile`이 이 reject를 잡아 해당 파일을 바이너리로 분류하고, 예외를 상위로 전파하지 않는다.

### REQ-PREVIEW007-005: 대용량 파일 미리보기 건너뜀 (Event-driven)

- **WHEN** 사용자가 대용량 임계값을 초과하는 파일을 선택하면, **the system shall** 파일 전체를 로드하지 않고 "파일이 커서 미리보기를 건너뜁니다" 안내(사유: 대용량, 파일명 포함)를 표시한다.
- The system **shall** 대용량 여부를 `FileNode.size`로 파일을 열기 전에 판정하여, 임계값 초과 파일에 대해서는 `read_file` 호출 자체를 회피한다.

### REQ-PREVIEW007-006: 클릭 안정성 — 어떤 파일도 앱을 깨뜨리지 않음 (Unwanted behavior)

- **IF** 사용자가 어떤 종류의 파일(바이너리·대용량·읽기 실패·확장자 없음·dotfile 포함)을 선택하더라도, **then the system shall** 처리되지 않은 예외나 콘솔 에러 없이 적절한 프리뷰(평문 / 미리보기 불가 / 건너뜀) 중 하나를 표시한다.
- **IF** `read_file`이 바이너리 외의 사유(권한·삭제·I/O 오류 등)로 reject되면, **then the system shall** 앱을 중단시키지 않고 "미리보기 불가" 플레이스홀더 또는 안전한 안내 상태로 처리한다.

### REQ-PREVIEW007-007: 기존 렌더 동작 회귀 차단 (Unwanted behavior)

- **IF** 선택된 파일이 `.md`이면, **then the system shall** 기존 마크다운 렌더링 파이프라인(SPEC-PREVIEW-001/002/003)으로 처리하여 동작을 변경하지 않는다.
- **IF** 선택된 파일이 `.html`이면, **then the system shall** 기존 HTML iframe 보기(SPEC-PREVIEW-004)로 처리하고 편집기 editor-disable 플레이스홀더를 유지한다.
- **IF** 선택된 파일 확장자가 `extensionLangMap`에 등록되어 있으면, **then the system shall** 기존 코드 뷰어(SPEC-PREVIEW-005, Shiki 구문 강조)로 처리한다.
- The system **shall** 마크다운 폴백 동작을 `.md` 외 파일에 적용하지 않는다(이 폴백이 본 SPEC이 닫는 결함이다).

## [DELTA] Brownfield Change Map

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [MODIFY] | `src/components/sidebar/FileExplorer.tsx` | `visibleTree`를 `filterTree(filterMdOnly(fileTree), searchQuery)` → `filterTree(fileTree, searchQuery)`로 변경해 allowlist 제거. `filterViewableFiles`/`filterMdOnly` 함수와 `getLangForExtension` import 정리. 검색 필터(`filterTree`)는 무변경. |
| [MODIFY] | `src/components/preview/PreviewContainer.tsx` | `getFileViewType` 반환 타입에 `'text'`·`'unsupported'` 추가. 분기 우선순위: `.html`→`'html'` → 매핑 확장자→`'code'` → (프리뷰 상태가 binary/too-large/read-fail) → `'unsupported'` → 그 외 읽힌 텍스트 → `'text'`. 라우팅이 바이너리·대용량을 알아야 하므로 `getFileViewType`이 프리뷰 상태를 인자로 받거나 store에서 읽는 방식으로 확장(plan 결정 1에서 확정). `viewType === 'unsupported'`일 때 `UnsupportedFileViewer` 렌더, `'text'`일 때 `CodeFileViewer lang='text'` 렌더 분기 추가. |
| [MODIFY] | `src/hooks/useFileSystem.ts` | `openFile`에 파일 분류 로직 추가: (1) `.html`은 기존 경로 유지, (2) `FileNode.size > 임계값`이면 too-large로 분류 후 read 회피 + 플레이스홀더 상태 설정, (3) `readFile` 시도 → 성공이면 text(편집기 로드), reject면 binary로 분류(편집기 미로드 + 플레이스홀더 상태). `readFile` reject try/catch 추가. |
| [MODIFY] | `src/store/fileStore.ts` (또는 신규 상태 슬라이스) | 프리뷰 상태(예: `previewStatus: 'text' \| 'binary' \| 'too-large' \| 'html' \| null`) 추가 — `openFile`이 판정해 set, `getFileViewType`/`UnsupportedFileViewer`가 read. 정확한 배선(store 필드 vs 컴포넌트 prop)은 plan 결정 1에서 확정. |
| [NEW] | `src/components/preview/UnsupportedFileViewer.tsx` | "미리보기 불가" 보기 전용 플레이스홀더. props로 사유(`'binary' \| 'too-large'`)와 파일명을 받아 안내 문구를 표시. `AppLayout`의 editor-disable 플레이스홀더(line 258-284) 시각 패턴 참고. |
| [MODIFY] | `src/components/layout/AppLayout.tsx` | editor-disable 조건을 `.html`뿐 아니라 binary·too-large(=프리뷰 상태가 unsupported)까지 확장하여, 해당 파일 선택 시 편집기 대신 보기 전용 플레이스홀더를 표시. `isHtmlFile` → 더 일반적인 `isViewOnly` 판정으로 확장. |
| [MODIFY] | `src-tauri/src/commands/file_ops.rs` (선택, plan 결정 3) | (옵션) `read_file`이 바이너리를 명시적 타입으로 구분해 반환하거나 null-byte 스니프 추가. **최소 변경 원칙상 프론트엔드 reject 캐치만으로 충분한지 plan에서 판단** — 불필요하면 무변경. |
| [EXISTING] | `src/components/preview/CodeFileViewer.tsx` | 변경 없음 — `lang='text'`로 평문 표시에 재사용(SPEC-PREVIEW-005에서 이미 임의 lang 수용). |
| [EXISTING] | `src/components/preview/MarkdownPreview.tsx`, `HtmlFileViewer.tsx` | 변경 없음 — `.md`/`.html` 라우팅은 기존 그대로. |
| [EXISTING] | `src/lib/preview/extensionLangMap.ts` | 변경 없음 — 코드 뷰어 라우팅 판정에 계속 사용. |
| [REMOVE] | `FileExplorer` allowlist 테스트 | `filterViewableFiles`/`filterMdOnly` 동작을 검증하던 기존 테스트 제거 또는 "전체 노출" 검증으로 전환. |

## Exclusions (What NOT to Build)

- **이미지 전용 뷰어 미포함** — `.png`/`.jpg` 등 이미지는 바이너리로 간주해 "미리보기 불가"로 처리한다. 인라인 이미지 미리보기는 별도 후속 SPEC 대상이며 본 SPEC 범위 밖이다.
- **바이너리 hex/octet 뷰어 미포함** — 바이너리 파일의 16진수 덤프나 메타데이터 표시는 제공하지 않는다. 플레이스홀더만 표시한다.
- **securityLevel / asset scope 변경 미포함** — Tauri 보안 설정·asset 프로토콜 범위는 건드리지 않는다.
- **`.md` 외 파일의 마크다운 폴백 유지 미포함** — 기존 마크다운 폴백을 비-마크다운 파일에 유지하지 않는다(그 폴백이 본 SPEC이 닫는 결함이다).
- **평문 텍스트 파일 구문 강조 추가 미포함** — `'text'` 뷰는 평문 표시에 한정한다. `.rs`/`.go` 등을 `extensionLangMap`에 추가해 코드 강조하는 것은 별개의 SPEC-PREVIEW-005 후속 작업이며 본 SPEC 범위 밖이다.
- **대용량 텍스트 청크/가상 스크롤 렌더 미포함** — 임계값 초과 파일은 "건너뜀"으로 안내만 하며, 부분 로드·가상화·스트리밍 표시는 후속 SPEC 대상으로 리스크에만 기록한다.
- **파일 트리 lazy-load·가상화 변경 미포함** — 전체 파일 노출로 트리 노드가 늘어나는 성능 영향은 plan에 리스크로만 기록하며, 본 SPEC에서 트리 가상화를 도입하지 않는다.

## References

- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인 + Shiki 싱글톤 (회귀 검증 대상)
- SPEC-PREVIEW-004 — `.html` 파일 보기 + `getFileViewType`/`PreviewContainer` 단일 라우팅 진입점 + editor-disable 플레이스홀더 패턴 (탐색기 노출 동작 대체, 플레이스홀더 패턴 재사용)
- SPEC-PREVIEW-005 — `extensionLangMap` 기반 코드 뷰어 + `filterViewableFiles` allowlist (탐색기 노출 동작 대체, 코드 뷰어 회귀 검증 대상)
- `src/components/sidebar/FileExplorer.tsx` line 50-67, 127 — 제거 대상 allowlist 필터
- `src/components/preview/PreviewContainer.tsx` line 25-36 — 확장 대상 라우팅 폴백 결함
- `src/hooks/useFileSystem.ts` line 132-160 — reject 미처리 `openFile`
- `src-tauri/src/commands/file_ops.rs` line 25-35 — 바이너리 reject `read_file`
- `src/types/file.ts` line 18-19 — `FileNode.size`(대용량 가드 입력)
- `src/components/layout/AppLayout.tsx` line 250-284 — 재사용 대상 editor-disable 플레이스홀더
