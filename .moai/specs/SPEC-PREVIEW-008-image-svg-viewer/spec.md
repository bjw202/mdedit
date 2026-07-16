---
id: SPEC-PREVIEW-008
version: "1.0.0"
status: draft
created: "2026-07-16"
updated: "2026-07-16"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-PREVIEW-001
  - SPEC-PREVIEW-004
  - SPEC-PREVIEW-005
  - SPEC-PREVIEW-007
  - SPEC-IMG-001
tags:
  - preview
  - image-viewer
  - svg-viewer
  - inline-svg
  - sanitization
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-16 | jw | 최초 SPEC 작성 — 독립 이미지 뷰어(래스터)·독립 SVG 뷰어(렌더/소스 토글)·마크다운 인라인 `<svg>` 렌더 3종을 추가한다. `getFileViewType`(라우팅 진입점, @MX:ANCHOR)에 이미지·SVG **확장자 분기**를 `previewStatus`보다 앞에 삽입한다(확장자 기반, `PreviewStatus`는 확장하지 않음). 신규 `ImageFileViewer`·`SvgFileViewer` 컴포넌트를 추가한다. 인라인 SVG는 `html:false`를 유지한 채 DOMPurify SVG 프로파일로 `<svg>` 서브트리만 허용한다. CSV/JSON/PDF/ipynb는 명시적으로 후속 SPEC으로 이연. |

## Overview

`mdedit`는 현재 **독립 이미지·SVG 파일에 전용 프리뷰가 없다.** 소스 검증 결과 두 갈래로 결함이 나뉜다:

1. **래스터 이미지**(`.png`/`.jpg`/`.jpeg`/`.gif`/`.webp`/`.bmp`/`.ico`/`.avif`) — `read_file`(`file_ops.rs`)이 `read_to_string`으로 비-UTF-8을 reject하므로 `openFile`(`useFileSystem.ts:184-199`)이 `previewStatus='binary'`로 분류하고, `getFileViewType`(`PreviewContainer.tsx:53`)이 `'unsupported'`로 라우팅한다. → **미리보기 불가 플레이스홀더만 표시(그림이 안 보임).**
2. **SVG**(`.svg`) — SVG는 UTF-8 텍스트라 `read_file`이 성공하므로 `previewStatus='text'`로 분류되고 `CodeFileViewer lang='text'`(**평문 XML**)로 표시된다. → 그림이 아니라 XML 소스가 평문으로 보인다. 신규 `SvgFileViewer`가 `.svg` 라우팅을 이 평문 경로에서 넘겨받는다.

또한 마크다운 본문에 직접 삽입된 원시 `<svg>...</svg>` 마크업은 렌더되지 않는다. `renderer.ts:141`이 XSS 방지를 위해 markdown-it `html:false`를 하드코딩해 모든 원시 HTML을 제거하기 때문이다.

본 SPEC은 이 3가지 공백을 다음으로 채운다:
- **독립 이미지 뷰어**(줌/팬, 투명 체커보드, 픽셀 크기·파일 크기 표시, 테마 대응)
- **독립 SVG 뷰어**(렌더 ↔ 소스 토글, 렌더 뷰 줌/팬, 안전 렌더)
- **마크다운 인라인 SVG 렌더**(`html:false` 유지, `<svg>` 서브트리만 DOMPurify SVG 프로파일로 허용)

기존 마크다운 파이프라인(SPEC-PREVIEW-001), `.html` 보기(004), 코드 뷰어(005), 전체 파일 노출·분류(007), 그리고 **이미지 문법 `![](x.png)`/`![](x.svg)`의 imageResolver 경로(SPEC-IMG-001)** 는 회귀 없이 유지한다.

구현 계획·브라운필드 변경 지도·@MX 태그 대상은 plan.md, Given-When-Then 수용 시나리오·테스트 매핑은 acceptance.md 참조.

## Glossary

- **파일 종류 분기(file-type routing)**: 선택된 파일을 어떤 프리뷰로 보낼지 결정하는 순수 함수 `getFileViewType`(`PreviewContainer.tsx:32-58`, @MX:ANCHOR). 현재 `'html' | 'code' | 'unsupported' | 'text' | 'markdown'`을 반환. 본 SPEC에서 `'image'`·`'svg'`를 추가한다.
- **확장자 우선 분기(extension-first branch)**: 이미지·SVG 판정은 **파일 경로(확장자)만으로** 이뤄지며 `previewStatus`(binary/text) 판정보다 **반드시 앞에** 위치한다. `PreviewStatus` 타입은 확장하지 않는다(확정 결정). 그렇지 않으면 래스터는 `'unsupported'`, SVG는 `'text'`로 잘못 라우팅된다(현재 결함). SPEC-PREVIEW-007의 `.html`·`.md` 분기가 `previewStatus`보다 앞에 놓인 것과 동일한 패턴.
- **이미지 뷰어(ImageFileViewer)**: 래스터 이미지를 표시하는 신규 보기 전용 컴포넌트. `asset://`(`convertFileSrc`) OS 스트리밍으로 이미지를 로드한다(메모리 적재 없음). 줌·팬, 투명 체커보드, 픽셀 크기·파일 크기 메타를 표시.
- **SVG 뷰어(SvgFileViewer)**: `.svg` 파일을 표시하는 신규 컴포넌트. 기본은 **렌더 뷰**(sanitize된 SVG를 표시, 줌·팬), 토글 시 **소스 뷰**(기존 Shiki 강조로 XML 표시).
- **인라인 SVG(inline SVG)**: `.md` 본문에 직접 쓰인 원시 `<svg>...</svg>` 마크업. 이미지 문법(`![](x.svg)`)과 구별된다 — 후자는 imageResolver 경로로 이미 동작하며 본 SPEC에서 건드리지 않는다.
- **SVG sanitize 단계(SVG sanitization)**: DOMPurify를 SVG 프로파일(`USE_PROFILES: { svg: true, svgFilters: true }` 또는 동등 설정)로 실행해 `<script>`·이벤트 핸들러(`onload` 등)·`<foreignObject>`·외부 참조를 제거하고 순수 SVG 도형만 남기는 처리. 인라인 SVG(마크다운)와 SVG 뷰어(파일)의 렌더 뷰 양쪽에 동일 유틸로 적용한다.
- **줌 규약(zoom convention)**: `previewZoom.ts`의 `getPreviewZoom(fontSize) = fontSize / 14`. CSS `zoom`으로 적용. 이미지·SVG 렌더 뷰의 fit/100%/증감 줌은 이 규약과 정합해야 한다(구체 배선은 plan).
- **대용량 임계값(size threshold)**: `previewLimits.ts`의 `FILE_SIZE_THRESHOLD`(5MB). 텍스트 read 회피용. 래스터 이미지와 SVG 렌더 뷰는 `asset://` OS 스트리밍이라 임계값을 적용하지 않으며, SVG **소스 뷰**(텍스트 메모리 적재)에만 임계값을 적용한다(plan 결정).

## EARS Requirements

### REQ-PREVIEW008-001: 이미지 파일 전용 뷰어 라우팅 (Event-driven)

- **WHEN** 사용자가 래스터 이미지 파일(`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.ico`, `.avif`; 대소문자 무관)을 선택하면, **the system shall** 해당 파일을 신규 `ImageFileViewer`로 라우팅하여 이미지를 표시하고, `'unsupported'`(미리보기 불가) 플레이스홀더로 보내지 않는다.
- The system **shall** `getFileViewType`에서 이미지 확장자 분기를 `previewStatus`(binary/text) 판정보다 **앞에** 배치하여, `read_file` reject로 인한 `previewStatus='binary'`가 이미지 라우팅을 덮어쓰지 않도록 한다.
- The system **shall** 이미지 뷰어를 보기 전용으로 두고 편집기 버퍼에 파일 내용을 로드하지 않는다.

### REQ-PREVIEW008-002: 이미지 뷰어 표시 기능 (Ubiquitous)

- The system **shall** 이미지 뷰어에서 fit(맞춤)·100%(원본 픽셀)·확대·축소 줌과 팬(드래그 이동)을 제공한다.
- The system **shall** 투명 배경 이미지에 대해 체커보드 패턴 배경을 표시하여 투명 영역을 시각적으로 구분한다.
- The system **shall** 이미지의 픽셀 크기(가로×세로)와 파일 크기(바이트/KB/MB)를 표시한다.
- The system **shall** 라이트/다크 테마에 대응하여 뷰어 크롬(배경·메타 텍스트)을 현재 테마에 맞춘다.

### REQ-PREVIEW008-003: 대용량 이미지도 미리보기 유지 (Unwanted behavior)

- **IF** 선택된 래스터 이미지의 크기가 `FILE_SIZE_THRESHOLD`(5MB)를 초과하더라도, **then the system shall** `'too-large'`(미리보기 건너뜀)로 처리하지 않고 이미지를 계속 표시한다.
- The system **shall** 이미지 로드에 `asset://`(`convertFileSrc`, OS 파일 스트리밍) 경로를 사용하여, 대용량 가드(SPEC-PREVIEW-007 REQ-005)가 이미지에 적용되지 않도록 한다.

### REQ-PREVIEW008-004: SVG 파일 렌더/소스 토글 뷰어 (Event-driven)

- **WHEN** 사용자가 `.svg` 파일을 선택하면, **the system shall** 해당 파일을 신규 `SvgFileViewer`로 라우팅하고, 기본으로 **렌더 뷰**(SVG 그림)를 표시한다(`'text'` 평문 뷰로 보내지 않는다).
- **WHEN** 사용자가 렌더/소스 토글을 조작하면, **the system shall** 렌더 뷰와 소스 뷰(기존 Shiki 구문 강조로 XML 표시) 사이를 전환한다.
- **WHILE** 렌더 뷰가 활성인 동안, **the system shall** 이미지 뷰어와 동일한 줌·팬 조작을 제공한다.
- **IF** `.svg` 파일 크기가 `FILE_SIZE_THRESHOLD`를 초과하면, **then the system shall** 소스 뷰에서만 대용량 안내를 적용하고 렌더 뷰는 계속 표시한다.

### REQ-PREVIEW008-005: 안전한 SVG 렌더 (Unwanted behavior)

- **IF** SVG(파일 또는 인라인)에 `<script>`, 이벤트 핸들러 속성(`onload`·`onclick` 등), `<foreignObject>`, 외부 리소스 참조 등 잠재적 위험 요소가 포함되어 있으면, **then the system shall** 렌더 전에 DOMPurify SVG 프로파일 sanitize로 이를 제거하고 스크립트를 실행하지 않는다.
- The system **shall** sanitize 실패 또는 파싱 오류 시 앱을 중단시키지 않고 안전한 대체 상태(빈 렌더 또는 소스 뷰 폴백)를 표시한다.

### REQ-PREVIEW008-006: 마크다운 인라인 SVG 렌더 (Event-driven)

- **WHEN** `.md` 본문에 원시 `<svg>...</svg>` 마크업이 포함되어 렌더되면, **the system shall** 해당 `<svg>` 서브트리를 DOMPurify SVG 프로파일로 sanitize한 뒤 프리뷰에 렌더한다.
- The system **shall** 이 처리를 `PreviewRenderer`(`dangerouslySetInnerHTML` 직전, @MX:ANCHOR)의 sanitize 단계에서 placeholder-and-restore 방식으로 수행하고, 이미지 문법(`![](x.svg)`)의 imageResolver 경로는 변경하지 않는다.

### REQ-PREVIEW008-007: 일반 원시 HTML 차단 유지 (Unwanted behavior)

- The system **shall** markdown-it `html:false`(`renderer.ts:141`)를 유지하여 `<svg>` 외의 원시 HTML을 계속 차단한다.
- **IF** `.md` 본문에 `<svg>`가 아닌 원시 HTML(`<script>`, `<iframe>`, `<div onclick>`, `<img onerror>` 등)이 포함되면, **then the system shall** 이를 렌더하지 않고 이스케이프 또는 제거하여 XSS 벡터를 차단한다.
- The system **shall** 인라인 SVG 허용을 위해 `html:true`로 전환하지 않는다(전역 원시 HTML 허용 금지).

### REQ-PREVIEW008-008: 기존 렌더·이미지 문법 회귀 차단 (Unwanted behavior)

- **IF** 선택된 파일이 `.md`/`.html`/코드 매핑 확장자/미매핑 텍스트/바이너리이면, **then the system shall** 기존 라우팅(SPEC-PREVIEW-001/004/005/007)을 그대로 유지하여 동작을 변경하지 않는다.
- **IF** 마크다운 본문이 이미지 문법 `![](x.png)`·`![](x.svg)`를 포함하면, **then the system shall** 기존 imageResolver(`asset://` 변환)로 처리하고 본 SPEC의 인라인 SVG/이미지 뷰어 경로를 적용하지 않는다.

## Security

본 SPEC의 핵심 보안 결정은 **"인라인 SVG를 허용하되 일반 HTML은 계속 차단한다"** 이다.

### 왜 `html:false`를 유지하는가

markdown-it `html:false`는 원시 HTML 토큰을 아예 생성하지 않아 `<script>`·`<iframe>`·이벤트 핸들러 주입을 원천 차단한다(현재 mdedit의 1차 XSS 방어선; `PreviewRenderer`가 `dangerouslySetInnerHTML`을 안전하게 쓰는 근거). `html:true`로 전환하면 모든 원시 HTML이 통과되어 방어선이 무너진다. 따라서 **전역 플래그는 건드리지 않는다.**

### `<svg>`만 선택적으로 허용하는 전략 (placeholder-and-restore, 확정)

1. **placeholder-and-restore 후처리**: markdown-it 렌더 전/후에 `<svg>...</svg>` 블록을 플레이스홀더 토큰으로 치환해 `html:false` 제거를 우회한 뒤, 렌더된 HTML에서 플레이스홀더를 sanitize된 SVG로 복원한다. **커스텀 markdown-it 블록 룰은 사용하지 않는다**(확정 결정). 나머지 원시 HTML은 여전히 `html:false`로 제거된다.
2. **DOMPurify SVG 프로파일 sanitize**: 복원되는 `<svg>` 서브트리는 렌더 직전 DOMPurify로 정화한다. 설정 방향(plan에서 확정):
   - SVG 프로파일(`USE_PROFILES: { svg: true, svgFilters: true }`)로 SVG 도형·필터 태그만 허용
   - `<script>`, `on*` 이벤트 핸들러, `<foreignObject>`, `href`/`xlink:href`의 `javascript:`·외부 참조, `<use>` 외부 참조 제거
   - `data:`·외부 URL 리소스 로드 차단
3. **적용 지점 단일화**: 인라인 SVG(마크다운)와 SVG 파일 뷰어의 렌더 뷰 모두 **동일한 sanitize 유틸**을 경유하여 정책 분기를 방지한다.
4. **의존성 추가**: DOMPurify는 현재 프로젝트 의존성이 아니다(`package.json` 검증 완료). `dompurify` + `@types/dompurify` 추가가 필요하다.

### 잔여 위험

- DOMPurify 버전·설정 드리프트로 정책이 약화될 수 있으므로 sanitize 설정은 가드 테스트로 고정한다(악성 SVG 픽스처 → 스크립트 미실행 검증).
- SVG 필터·애니메이션(SMIL)의 리소스 소모(빌보드/DoS)는 본 SPEC 범위 밖이며 리스크로만 기록한다.

## Exclusions (What NOT to Build) / Non-Goals

- **CSV 뷰어 미포함** — `.csv`는 기존 평문 텍스트 뷰(SPEC-PREVIEW-007) 유지. 표 렌더링은 후속 SPEC 대상.
- **JSON 전용 뷰어 미포함** — `.json`은 기존 코드 뷰어(Shiki) 유지. 트리/폴딩 뷰는 후속 SPEC 대상.
- **PDF 뷰어 미포함** — `.pdf`는 계속 바이너리 → `'unsupported'`. 후속 SPEC 대상.
- **Jupyter Notebook(.ipynb) 뷰어 미포함** — 후속 SPEC 대상.
- **일반 원시 HTML 허용 미포함** — `html:true` 전환 금지. `<svg>` 외 원시 HTML은 계속 차단(이것이 본 SPEC의 보안 불변식).
- **`PreviewStatus` 타입 확장 미포함** — 이미지/SVG는 확장자 기반 라우팅으로만 처리하며 `'image'`/`'svg'` 상태값을 store에 추가하지 않는다(확정 결정, fileStore 변경 최소화).
- **이미지 편집/주석 미포함** — 크롭·회전·필터·마크업 등 편집 기능은 범위 밖. 보기 전용.
- **SVG 편집 미포함** — SVG 소스 뷰는 Shiki 강조 표시에 한정하며 편집 저장은 다루지 않는다(별도 SPEC).
- **SMIL 애니메이션/필터 DoS 방어 미포함** — 리소스 소모형 SVG 방어는 범위 밖, 리스크로만 기록.
- **이미지 문법 imageResolver 경로 변경 미포함** — `![](x.png)`/`![](x.svg)`는 이미 동작하므로 건드리지 않는다.

## References

- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인 + `PreviewRenderer`(sanitize/inject 지점, 회귀 검증 대상)
- SPEC-PREVIEW-004 — `.html` iframe 보기 + `getFileViewType` 단일 라우팅 진입점(분기 삽입 대상)
- SPEC-PREVIEW-005 — `extensionLangMap` 코드 뷰어 + `CodeFileViewer`(SVG 소스 뷰 재사용 후보)
- SPEC-PREVIEW-007 — 전체 파일 노출 + `previewStatus` 4분류 + `getFileViewType` `'text'`/`'unsupported'` 분기(확장자 우선 순서 근거)
- SPEC-IMG-001 — `image_ops.rs`(`read_image_as_base64`, svg mime 포함) + `imageResolver`(이미지 문법 경로, 무변경)
- `src/components/preview/PreviewContainer.tsx:32-58` — `getFileViewType`(@MX:ANCHOR, 확장 대상)
- `src/hooks/useFileSystem.ts:137-200` — `openFile` 파일 분류(이미지/SVG 조기 분기 대상)
- `src/lib/markdown/renderer.ts:140-141` — markdown-it `html:false`(유지, svg placeholder-and-restore)
- `src/components/preview/PreviewRenderer.tsx:36,110` — `dangerouslySetInnerHTML`(인라인 svg sanitize 단계 삽입)
- `src/lib/preview/previewZoom.ts` — 줌 규약(`getPreviewZoom`)
- `src/lib/preview/previewLimits.ts` — `FILE_SIZE_THRESHOLD`(이미지·SVG 렌더 뷰에 미적용, SVG 소스 뷰에만 적용)
