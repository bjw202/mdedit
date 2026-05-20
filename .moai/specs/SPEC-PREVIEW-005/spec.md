---
id: SPEC-PREVIEW-005
version: "1.0.0"
status: draft
created: "2026-05-20"
updated: "2026-05-20"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-PREVIEW-001
  - SPEC-PREVIEW-004
tags:
  - preview
  - code-viewer
  - syntax-highlighting
  - shiki
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-05-20 | jw | 최초 SPEC 작성 — 이미 설치된 Shiki 하이라이터를 재사용하는 제네릭 소스/데이터 파일 뷰어. `getFileViewType`에 `'code'` 분기 추가, 신규 `CodeFileViewer` 컴포넌트, 확장자→Shiki 언어 매핑 모듈. 신규 의존성 0. |

## Overview

`mdedit`(마크다운 전용 편집기)에 **소스/설정 파일을 구문 강조(syntax highlighting)와 함께 보여주는 보기 전용 기능**을 추가한다.
이미 설치되어 사용 중인 **Shiki 하이라이터**(`getHighlighter()` 싱글톤, SPEC-PREVIEW-001)를 그대로 재사용하며 **신규 npm 의존성을 추가하지 않는다.**

대상 포맷은 사용자가 지명한 python·js·ts·json·jsonl·yaml과, 같은 Shiki 싱글톤으로 저비용 처리되는 extras(toml·sh/bash·css)이다.
JSON 트리 뷰·CSV 테이블·다이어그램 등 의미론적(semantic) 렌더링은 본 SPEC 범위가 아니며, 사용자가 "제네릭 코드 뷰어 우선, 최소 변경, 신규 의존성 0" 방향을 명시적으로 선택했다.

이 기능은 기존 프리뷰 라우팅 단일 진입점(SPEC-PREVIEW-004의 `PreviewContainer` / `getFileViewType`)을 **확장**하는 것이며, 마크다운 렌더링 파이프라인(SPEC-PREVIEW-001/002/003)과 `.html` 보기(SPEC-PREVIEW-004)는 변경하지 않는다.

## Glossary

- **코드 보기 모드(code view mode)**: 확장자가 코드 매핑에 등록된 파일을 선택했을 때 프리뷰 칸이 진입하는 상태. 신규 `CodeFileViewer`가 구문 강조된 파일 내용을 표시한다.
- **파일 종류 분기(file-type routing)**: 선택된 파일의 확장자를 보고 `'html'`/`'code'`/`'markdown'` 중 알맞은 화면으로 보내는 순수 함수 `getFileViewType`. SPEC-PREVIEW-004에서 도입한 단일 라우팅 진입점.
- **확장자→언어 매핑(extension-language map)**: 파일 확장자를 Shiki 언어 식별자로 변환하는 작고 명시적인 객체(`extensionLangMap`). 이 매핑에 없는 확장자는 코드 보기로 라우팅하지 않는다.
- **Shiki 싱글톤(Shiki singleton)**: `src/lib/markdown/codeHighlight.ts`의 `getHighlighter()`가 반환하는 공유 하이라이터 인스턴스. `github-dark`/`github-light` 테마와 사전 로드된 언어 목록을 보유한다. 마크다운 렌더러·`usePreview`·exportHtml과 공유된다.
- **에디터 버퍼(editor buffer)**: 현재 열린 파일의 텍스트가 적재되는 `useEditorStore.content`. 코드/데이터 파일을 열면 그 텍스트가 이미 이 버퍼에 들어 있어 라이브 렌더가 가능하다.
- **테마 상태(theme state)**: 다크 모드 여부는 `document.documentElement`의 `dark` 클래스로 표현되며, `useUIStore.theme` 구독으로 재렌더가 트리거된다.

## EARS Requirements

### REQ-PREVIEW005-001: 파일 종류 분기 순수 함수 확장 (Ubiquitous)

- The system **shall** 순수 함수 `getFileViewType(path)`가 확장자(대소문자 무관)가 확장자→언어 매핑에 등록된 경로에 대해 `'code'`를 반환하고, `.html` 경로에 대해 `'html'`을, 그 외 모든 경로(매핑 미등록·확장자 없음·null)에 대해 `'markdown'`을 반환하도록 한다.
- The system **shall** 분기 우선순위를 `.html` → `'code'`(매핑 조회) → `'markdown'`(폴백) 순으로 평가하여 기존 `.html`/`.md` 라우팅 동작을 변경하지 않는다.
- The system **shall** 확장자→언어 매핑을 단일 모듈(`extensionLangMap`)에 명시적 객체로 분리하여, 매핑에 포함된 확장자만 코드 보기 후보가 되도록 한다.

### REQ-PREVIEW005-002: 코드 보기 모드 라우팅 (Event-driven)

- **WHEN** 사용자가 사이드바에서 확장자가 코드 매핑에 등록된 파일(예: `.py`, `.ts`, `.json`, `.yaml`)을 선택하면, **the system shall** `PreviewContainer`가 `MarkdownPreview`/`HtmlFileViewer` 대신 신규 `CodeFileViewer`를 렌더한다.
- **WHEN** 사용자가 코드 보기 모드에서 다시 마크다운 파일을 선택하면, **the system shall** 프리뷰 칸을 기존 마크다운 렌더링 모드로 복귀시킨다.

### REQ-PREVIEW005-003: 에디터 버퍼 기반 라이브 재렌더 (Event-driven)

- **WHEN** 코드 종류 파일에 대해 에디터 버퍼(`useEditorStore.content`) 내용이 변경되면, **the system shall** `CodeFileViewer`가 공유 Shiki 하이라이터로 구문 강조된 출력을 기존 디바운스 간격(300ms) 경과 후 재렌더한다.
- The system **shall** 코드 보기의 라이브 렌더 경로를 마크다운 전용 `usePreview` 훅을 수정하지 않고 별도 경로(전용 훅 또는 컴포넌트 내부 effect)로 구현하여 마크다운 렌더 경로 회귀를 방지한다.

### REQ-PREVIEW005-004: 다크/라이트 테마 연동 (State-driven)

- **WHILE** 다크 모드가 활성 상태(`document.documentElement`에 `dark` 클래스)인 동안, **the system shall** `CodeFileViewer`가 `github-dark` 테마로 구문 강조한다.
- **WHILE** 다크 모드가 비활성 상태인 동안, **the system shall** `CodeFileViewer`가 `github-light` 테마로 구문 강조한다.
- **WHEN** 사용자가 테마를 전환(`useUIStore.theme` 변경)하면, **the system shall** 변경된 테마로 출력을 재강조한다.

### REQ-PREVIEW005-005: 미지원 확장자 폴백 및 회귀 차단 (Unwanted behavior)

- **IF** 파일 확장자가 코드 매핑에 등록되어 있지 않으면, **then the system shall** 코드 보기로 라우팅하지 않고 기존 마크다운 렌더링 경로로 폴백한다(`.html`/`.md` 동작 무변경).
- **IF** 확장자가 매핑에는 있으나 Shiki 싱글톤에 해당 언어가 로드되어 있지 않으면, **then the system shall** 앱을 중단시키지 않고 plaintext 폴백 또는 안전한 표시로 처리한다.
- **IF** 코드 파일을 강조·렌더하는 중 오류가 발생하면, **then the system shall** 앱을 중단시키지 않고 직전 출력을 유지하거나 안전한 빈/오류 안내 상태로 처리한다.

## [DELTA] Brownfield Change Map

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [MODIFY] | `src/components/preview/PreviewContainer.tsx` | `getFileViewType` 반환 타입을 `'html' \| 'markdown'`에서 `'html' \| 'code' \| 'markdown'`으로 확장. 분기 순서 `.html` → 코드 매핑 조회 시 `'code'` → 그 외 `'markdown'`. `viewType === 'code'`일 때 `CodeFileViewer` 렌더 분기 1개 추가. 기존 `'html'`/`'markdown'` 분기는 변경 없음. |
| [MODIFY] | `src/lib/markdown/codeHighlight.ts` | `getHighlighter()` 싱글톤의 `langs` 배열에 `toml` 추가(사용자/extras 매핑 중 유일 미로드 언어). 기존 사전 로드 언어(`javascript`/`typescript`/`python`/`json`/`yaml`/`bash`/`css` 등)는 그대로 재사용. |
| [NEW] | `src/lib/preview/extensionLangMap.ts` | 확장자→Shiki 언어 명시 객체 + 조회 헬퍼(순수 함수). v1 범위: `.py`→python, `.js`/`.mjs`/`.cjs`→javascript, `.ts`→typescript, `.json`→json, `.jsonl`→json, `.yaml`/`.yml`→yaml, `.toml`→toml, `.sh`/`.bash`→bash, `.css`→css. 매핑은 의도적으로 작고 명시적. |
| [NEW] | `src/components/preview/CodeFileViewer.tsx` | 에디터 버퍼(`useEditorStore.content`)를 구독하고 공유 Shiki 하이라이터로 구문 강조한 HTML을 표시하는 보기 전용 컴포넌트. 디바운스·테마 구독·하이라이터 초기화는 `usePreview` 패턴을 복제(전용 effect 또는 `useCodePreview`). `usePreview` 자체는 수정하지 않음. |
| [NEW] | `src/hooks/useCodePreview.ts` (선택) | `usePreview`의 디바운스/테마/하이라이터 패턴을 코드용으로 분리할 경우의 신규 훅. 또는 `CodeFileViewer` 내부 effect로 흡수 — 둘 중 하나만 채택. 마크다운 경로 무손상이 핵심 제약. |
| [EXISTING] | `src/components/preview/MarkdownPreview.tsx`, `PreviewRenderer.tsx` | 변경 없음 — `PreviewContainer`의 마크다운 분기에서 그대로 호출. |
| [EXISTING] | `src/hooks/usePreview.ts` | 변경 없음 — 마크다운 렌더 전용으로 유지. 코드 보기는 별도 경로 사용. |
| [EXISTING] | `src/components/preview/HtmlFileViewer.tsx` | 변경 없음 — `.html` 라우팅은 SPEC-PREVIEW-004 그대로 유지. |

## Exclusions (What NOT to Build)

- **신규 npm 의존성 추가 미포함** — Shiki·markdown-it·mermaid·katex가 이미 설치되어 있다. 본 SPEC은 기존 Shiki 싱글톤만 재사용하며 어떤 패키지도 추가하지 않는다.
- **의미론적(semantic) 렌더링 미포함** — JSON 트리 뷰, CSV 테이블 렌더, 데이터 파일의 구조적 시각화, 다이어그램 등은 범위 밖. 사용자가 "제네릭 코드 뷰어 우선"을 명시적으로 선택했다. v1은 텍스트의 구문 강조 표시에 한정한다.
- **코드 편집·포매팅·린팅 미포함** — 코드 보기는 보기 전용. CodeMirror 편집 기능을 코드/데이터 파일에 연결하지 않으며 라인 번호 거터·코드 폴딩·인라인 검색도 제공하지 않는다.
- **대용량 파일 가상 스크롤·청크 렌더 미포함** — v1은 단순 표시. 수 MB급 파일의 가상화/청크 강조는 별개의 후속 SPEC 대상이며 본 SPEC에서는 리스크로만 기록한다.
- **`.html` 라우팅 동작 변경 미포함** — SPEC-PREVIEW-004의 `.html` iframe 보기 경로는 그대로 유지한다.
- **Shiki 싱글톤 언어 대량 확장 미포함** — 사용자 지명 포맷 + 무료 extras에 필요한 누락분(`toml`)만 최소 추가한다. `.rs`/`.go` 등은 매핑 미등록으로 두어 v1 범위를 작게 유지한다.

## References

- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인 + Shiki 싱글톤 `getHighlighter()` (재사용 대상, 회귀 검증 대상)
- SPEC-PREVIEW-004 — `.html` 파일 보기 + `getFileViewType`/`PreviewContainer` 단일 라우팅 진입점 (확장 대상)
- `src/lib/markdown/codeHighlight.ts` — Shiki 싱글톤 (`github-dark`/`github-light`, 사전 로드 언어 목록)
- `src/hooks/usePreview.ts` — 디바운스(300ms) + 테마 구독 + 하이라이터 초기화 패턴 (코드 경로에서 복제, 원본 무수정)
