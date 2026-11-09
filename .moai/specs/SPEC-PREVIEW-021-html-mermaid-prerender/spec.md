---
id: SPEC-PREVIEW-021
title: "HTML 미리보기 선명 모드에서 mermaid 블록을 pele로 미리 렌더"
version: "0.1.1"
status: draft
created: 2026-11-09
updated: 2026-11-09
author: jw (bjw202)
priority: Medium
phase: "v0.21.0 target"
module: src/lib/preview
lifecycle: spec-anchored
tags: "preview, html, mermaid, pele, srcdoc, crisp, diagram"
tier: M
depends_on: [SPEC-PREVIEW-019, SPEC-PREVIEW-015]
related_specs: [SPEC-PREVIEW-016, SPEC-PREVIEW-017, SPEC-PREVIEW-020, SPEC-SEC-002]
---

# SPEC-PREVIEW-021: HTML 미리보기 선명 모드에서 mermaid 블록 미리 렌더

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-09 | jw | 최초 작성. 백로그 카드 t2. 배경: 선명 모드(SPEC-PREVIEW-019, `srcdoc` + `sandbox="allow-scripts"`)는 셸 CSP를 상속해 페이지 자체 스크립트(mermaid CDN 포함)가 막히므로, HTML 파일 안의 mermaid 블록이 그림 대신 원문 글자로 보인다. 사용자 결정(2026-11-09, 코디네이터 경유): (1) 선명 모드에만 적용, 원본 보기는 그대로 (2) `<pre class="mermaid">`·`<div class="mermaid">`만 감지 (3) 색은 앱 팔레트(잉크 앤 허니), 페이지의 mermaid 테마·init 무시 (4) pele 실패 시 원문을 두고 짧은 안내를 붙인다. |
| 0.1.1 | 2026-11-09 | jw | plan-audit 1차(FAIL 0.84, `.moai/reports/plan-audit/SPEC-PREVIEW-021-review-1.md`) 반영. D1: REQ-006 예외에 글꼴 `<style>`·`data-processed` 삽입 추가, 글꼴 삽입 위치를 "블록 밖 마지막 `</body>`"로 고정, AC-007 비교 방식 수정. D2: 감싸개 대체값을 앱 토큰 리터럴로 통일. D3·D14: M1에 Windows 측정·`document.fonts.load` 선행·굵기 대응 기록, Windows 미측정 시 정지 규칙. D4·D7: 원문 추출 주장 축소(한계 8), dedent 공백 정의. D5: AC-009에 UTF-8 폴백. D6: 한 번 훑는 가림 스캐너, 원문 텍스트 요소 목록 확장, 따옴표 안 `>` 처리, `<svg` 검사 대소문자 무관(한계 9). D8·D11: 문구·DoD 정정. D9: `result.svg.outerHTML`로 확정. D10: 두 번째 호출 성공 시 접미사 없음. D12: 성공 블록 시작 태그에 `data-processed="true"` 추가. D15: `readPeleThemeValues` 1회 호출을 REQ-004로 이동. |

## §1 Overview

### 배경

- HTML 파일 미리보기의 선명 모드는 파일 텍스트를 앱이 읽어 `<base>`·초기 zoom `<style>`·고정 스크립트를 주입한 `srcdoc` 문서로 렌더한다(`src/lib/preview/htmlSrcdoc.ts` `buildSrcdoc`, `src/components/preview/HtmlFileViewer.tsx` `CrispHtmlView`).
- `srcdoc` 문서는 앱 셸 메타 CSP를 상속한다. `script-src`에는 고정 주입 스크립트의 sha256 해시 1개만 있으므로 페이지의 mermaid 스크립트(CDN·인라인 `mermaid.initialize`)는 실행되지 않고, `<pre class="mermaid">` 등은 원문 텍스트로 남는다.
- 앱에는 Mermaid 문법을 정화된 SVG로 그리는 유일한 경로가 이미 있다: pele 1.10.0을 감싼 `src/lib/diagram/diagramRenderer.ts` `renderDiagram`(SPEC-PREVIEW-015). 내보내기용 `src/lib/export/exportUtils.ts` `renderExportDiagram`은 그 결과에 모양 톤(SPEC-PREVIEW-017)을 넣고 모든 `var(--pele-…)`를 실제 값으로 치환해, **앱 CSS 없이도 같은 색으로 보이는** 자체 완결 SVG를 만든다.
- 해법: 선명 모드 조립 직전에 앱(부모 문서)이 HTML 텍스트에서 mermaid 블록을 찾아 `renderExportDiagram`으로 그린 SVG를 블록 안에 미리 넣는다. 스크립트가 필요 없으므로 CSP·sandbox를 넓히지 않는다.

### Tier 판단

- **Tier M.** 운영 코드 2개(새 모듈 `src/lib/preview/htmlMermaid.ts`, `HtmlFileViewer.tsx` 호출 지점)와 테스트 2~3개, e2e 1개·픽스처 1개. 추정 300~550 LOC(테스트 포함). 활성 REQ 10건·AC 12건(Tier M 상한 각 16 안). HTML 텍스트 직접 탐색(주석·raw text 요소 가리기, 중첩 `div` 깊이 계산)과 글꼴 관문(§3) 때문에 Tier S로 낮추지 않는다.

## §2 Requirements (GEARS)

#### REQ-PREVIEW021-001: 적용 범위 — 선명 모드만 (State-driven + Unwanted)

- **While** 실제 렌더 모드(`resolveHtmlRenderMode(htmlRenderMode, detectPlatform())`)가 `'crisp'`이고 `CrispHtmlView`가 파일 텍스트를 읽었을 때, the HTML 미리보기 shall `buildSrcdoc`에 넘기기 전에 텍스트를 REQ-002~006대로 변환한다.
- The 원본 보기(`OriginalHtmlView`, asset iframe) shall not 이 변환을 거치거나 동작이 바뀐다. 선명 모드에서 원본 보기로 폴백하는 경우(REQ-PREVIEW019-007: 크기·읽기·UTF-8)에도 변환하지 않는다.
- The 변환 shall not `buildSrcdoc`·`HTML_ZOOM_FRAME_SCRIPT`·셸 `index.html` CSP·iframe `sandbox` 값을 바꾼다.

#### REQ-PREVIEW021-002: 블록 감지 (Ubiquitous + Unwanted)

- The 변환 shall 시작 태그 이름이 `pre` 또는 `div`(태그·속성 이름과 닫는 태그는 대소문자 무관)이고 `class` 속성 값을 공백으로 나눈 토큰 중 정확히 `mermaid`(대소문자 구분)가 있는 요소를 mermaid 블록으로 본다. 속성 값은 큰따옴표·작은따옴표·따옴표 없음 세 형식을 모두 인식한다.
- The 변환 shall not 다음을 블록으로 본다: `<code class="language-mermaid">`, 스크립트로 `mermaid.render()`를 부르는 페이지의 결과물, `class="mermaid-x"`처럼 토큰이 다른 경우, HTML 주석과 원문 텍스트 요소(`script`·`style`·`textarea`·`title`·`template`·`xmp`·`iframe`·`noembed`·`noframes`·`noscript`) 안의 같은 모양 문자열.
- The 위치 탐색 shall 원본과 길이가 같은 가림 사본에서 한다. 가림 사본은 문서를 앞에서부터 **한 번** 훑으며 만든다: 주석 `<!--`를 만나면 다음 `-->`(없으면 끝)까지, 위 원문 텍스트 요소의 시작 태그를 만나면 그 안쪽을 짝이 되는 닫는 태그(대소문자 무관, 없으면 끝)까지 공백으로 바꾼다. 원문 텍스트 요소 안의 `<!--`는 주석으로 보지 않는다. 시작 태그 일치는 따옴표 안의 `>`를 태그 끝으로 보지 않는다.
- `pre` 블록은 그 뒤 첫 `</pre>`로 닫힌다. `div` 블록은 그 안의 `<div …>`·`</div>` 깊이를 세어 짝이 맞는 `</div>`로 닫힌다. 닫는 태그를 찾지 못한 블록은 건드리지 않는다.
- **When** 블록이 이미 그려진 상태(가림 사본의 블록 안쪽에 `<svg` 시작 태그가 대소문자 무관하게 있거나, 시작 태그에 `data-processed` 속성이 있음)이면, the 변환 shall 그 블록을 건드리지 않는다.

#### REQ-PREVIEW021-003: 블록 원문 추출 (Ubiquitous + Event-driven)

- The 변환 shall 블록의 안쪽 HTML을 비활성 `<template>` 요소로 파싱하고(스크립트 실행·자원 요청 없음), `<br>` 요소를 글자 `<br/>`로 바꾼 뒤 `textContent`를 원문으로 쓴다. 이로써 `&amp;`·`&lt;`·`&gt;`·`&quot;`·숫자 문자 참조가 디코드되고 다른 태그는 버려진다. 엔티티 디코드 결과는 같은 소스를 마크다운 펜스에 쓴 경우의 pele 입력과 같지만, `<b>x</b>`처럼 블록 안에 실제 태그로 쓴 부분은 마크다운 펜스(글자 그대로 전달)와 달리 버려진다(§3 한계 8).
- The 변환 shall 원문을 줄(`\n`, `\r\n`)로 나눠, 공백·탭이 아닌 글자가 있는 줄들의 앞쪽 공백·탭 접두사 중 가장 긴 공통 접두사를 모든 줄에서 걷어 내고(dedent, 공백·탭만 있는 줄은 계산에서 빼고 그 줄은 비운다), 마지막으로 `String.prototype.trim`으로 앞뒤 공백을 걷어 낸다. dedent의 공통 접두사에는 공백(U+0020)·탭만 넣고 디코드된 `&nbsp;`(U+00A0)는 넣지 않는다(trim은 U+00A0도 지운다).
- **When** 원문이 비어 있으면, the 변환 shall 블록을 건드리지 않고 안내도 붙이지 않는다.

#### REQ-PREVIEW021-004: 렌더와 삽입 (Event-driven + Ubiquitous)

- **When** 원문이 비어 있지 않으면, the 변환 shall `renderExportDiagram(원문, values)`로 렌더한다. `values`는 변환 1회 호출마다 `readPeleThemeValues('light')`를 정확히 한 번 불러 얻고 모든 블록이 같이 쓴다. 페이지 안의 mermaid 테마·`mermaid.initialize` 설정은 반영하지 않는다(pele 고정 옵션 `PELE_RENDER_OPTIONS` 불변). `'light'` 탐침은 다이어그램 팔레트가 테마와 무관하게 같은 값이라는 SPEC-PREVIEW-016 결정에 따른다.
- **When** 렌더가 성공하면, the 변환 shall (a) 블록 안쪽 내용만 다음으로 바꾼다: 인라인 style로 바탕·테두리 1px solid·반경·가운데 정렬을 준 `<div data-mdedit-diagram="">` 안에 `result.svg.outerHTML`(HTML 직렬화) 1개. 감싸개 색 값은 `values['--pele-bg']`·`values['--pele-border']`·`values['--pele-radius']`이고, 값이 없으면 앱 토큰 리터럴 `#FAF9F6`·`#97A4B1`·`3px`(`mdedit-tokens.css` `:root`와 같은 값)를 쓴다. 페이지 바탕색을 알 수 없으므로 테두리·반경은 라이트·다크와 무관하게 항상 넣는다(마크다운 미리보기의 다크 종이 카드 모양). (b) 시작 태그의 `>`(또는 `/>`) 바로 앞에 ` data-processed="true"`를 넣는다 — mermaid 원본 라이브러리가 그린 뒤 붙이는 표시와 같아, 이 표시가 없을 때 블록을 숨기는 페이지 CSS에서도 그림이 보이고 변환을 다시 돌려도 같은 결과가 된다. 닫는 태그는 그대로 둔다.
- The 삽입된 SVG shall `var(--pele-` 문자열을 0개 포함한다(앱 CSS가 없는 srcdoc에서도 같은 색).
- The 변환 shall 블록마다 독립적으로 렌더해 한 블록의 실패가 다른 블록에 영향을 주지 않는다.

#### REQ-PREVIEW021-005: 실패 안내 (Event-driven)

- **When** 렌더가 실패하면(문법 오류·지원하지 않는 다이어그램 종류·정화 실패, 즉 `renderExportDiagram`이 `null`), the 변환 shall 블록(시작 태그~닫는 태그)을 바이트 그대로 두고 닫는 태그 바로 뒤에 `<p data-mdedit-diagram-error="">` 안내 1개를 넣는다.
- The 안내 문구 shall `⚠ 이 다이어그램은 그릴 수 없었습니다`이고, 실패 경로에서만 `renderDiagram(원문)`을 한 번 더 불러 얻은 오류의 line·column이 모두 1 이상이면 ` (L행 C열)`을 붙인다. 두 번째 호출이 오류를 주지 않으면(예: 정화 단계만 실패하던 경우가 성공으로 바뀜) 접미사 없이 쓴다. 문구는 고정 문자열과 정수로만 만들며 원문·오류 메시지 문자열을 넣지 않는다.
- The 안내 shall 마크다운 미리보기 오류 표시(`text-sm text-amber-500 italic`)와 같은 인상의 인라인 style(작은 글자, 호박색 `#F59E0B`, 기울임)을 쓴다.

#### REQ-PREVIEW021-006: 원문 보존 (Unwanted)

- The 변환 shall not 다음 네 가지 외의 바이트를 바꾼다: (1) 성공 블록 안쪽 교체 (2) 성공 블록 시작 태그의 ` data-processed="true"` 삽입(REQ-004 b) (3) 실패 블록 바로 뒤 안내 삽입(REQ-005) (4) REQ-008 경로 (A)/(B)를 고른 경우의 글꼴 `<style>` 1개 삽입. 이 넷을 빼면 입력과 출력의 나머지 바이트가 같다. 그려진 블록·실패 블록이 하나도 없으면 출력은 입력과 같은 문자열이다.
- The 변환 shall not 페이지의 `<script>` 태그(mermaid CDN 포함)를 지우거나 고친다.

#### REQ-PREVIEW021-007: 동기 실행과 조립 시점 (Ubiquitous + Unwanted)

- The 변환 shall 동기 문자열 함수로, `CrispHtmlView`의 읽기 효과 안에서 `readFile` 직후·`buildSrcdoc` 직전에 한 번 호출된다. 배율 변경(postMessage)·앱 테마 변경으로 다시 실행되지 않는다.
- The 변환 shall not 예외를 밖으로 던진다. 내부 예외가 나면 입력 문자열을 그대로 돌려준다.

#### REQ-PREVIEW021-008: 다이어그램 글꼴 (Ubiquitous, M1 관문 결과에 따름)

- The 선명 모드 문서 shall pele가 글자 폭을 잰 글꼴(`DIAGRAM_FONT_FAMILY` = Barlow, `DIAGRAM_FONT_FAMILY_MONO` = IBM Plex Mono)로 다이어그램 글자를 그릴 수 있어야 한다. 수단은 plan.md M1 관문에서 실기기 측정으로 정하며 다음 순서로 고른다: (A) 블록이 1개 이상 렌더된 문서에만, 앱 번들 글꼴의 절대 주소를 쓰는 `@font-face` `<style data-mdedit-diagram-fonts="">` 1개를 가림 사본에서 어느 블록 안에도 있지 않은 마지막 `</body>` 바로 앞(없으면 문자열 끝)에 넣는다 → (A)가 막히고 셸 CSP `font-src`가 `data:`를 허용하면(SPEC-SEC-002 병합 뒤) (B) 같은 조건·위치에서 woff2를 `data:` 주소로 넣는다 → 둘 다 안 되면 (C) 시스템 글꼴 대체를 받아들이고 §3 한계로 적는다. (C)는 코디네이터를 거친 사용자 확인 없이 고르지 않는다.
- The 글꼴 처리 shall not 이 SPEC에서 셸 CSP를 바꾸거나, 렌더된 다이어그램이 없는 문서에 글꼴을 넣는다.

#### REQ-PREVIEW021-009: 보안 경계 (Unwanted)

- The 삽입 내용 shall 다이어그램 전용 정화 경로를 거친 SVG(`renderExportDiagram`이 돌려준 요소의 직렬화)와 앱이 만든 고정 감싸개·안내·글꼴 마크업뿐이다. 블록 원문이나 pele 오류 메시지를 HTML로 이어 붙이지 않는다.
- The 변환 shall not 블록 원문 파싱에 활성 문서(`document`에 붙은 노드)를 쓴다. 비활성 `<template>`만 쓴다.
- The 선명 모드 iframe shall `sandbox="allow-scripts"`를 그대로 가진다(REQ-PREVIEW019-002·011 불변).

#### REQ-PREVIEW021-010: 한계 기록 (Ubiquitous)

- The `HtmlFileViewer.tsx` 선명 모드 `@MX:NOTE`와 새 모듈 머리 주석 shall §3 알려진 한계 1·2·4를 한 줄씩 적는다: 감지 대상 2종만, 페이지 테마 무시, 원본 보기에는 미적용.

## §3 Constraints and Known Limitations

### 의존 — SPEC-PREVIEW-019, SPEC-PREVIEW-015

- 둘 다 `status: completed`(origin/main cdaadcf). 이 SPEC은 019의 `CrispHtmlView` 읽기 흐름, 015의 `renderDiagram`·정화 경로, 017의 `renderExportDiagram` 모양 톤을 고치지 않고 호출만 한다.

### 글꼴 — CORS와 CSP (plan 단계 확인, 실기기 미측정)

- 019 spec §3 한계 3: 선명 모드 문서는 불투명 출처라 `@font-face` 웹폰트가 CORS로 실패한다(asset 응답의 `Access-Control-Allow-Origin`이 앱 셸 출처로 고정). 앱 셸이 쓰는 Barlow(`src/styles/mdedit-fonts.css` → `public/fonts/*.woff2`, 각 약 10~16 KB)도 srcdoc 안에서 그대로 쓸 수 있는지는 미측정이다.
- 셸 CSP에는 `font-src`가 없어 `default-src 'self' tauri: asset: http://asset.localhost https://asset.localhost`가 적용된다. `data:` 글꼴은 현재 막힌다. 병행 계획 중인 SPEC-SEC-002(카드 t1)가 `font-src`를 다룬다. 이 SPEC은 CSP를 바꾸지 않는다.
- pele는 글자 폭을 캔버스 `measureText`로 부모 문서의 Barlow 기준으로 잰다(015 design.md D14). srcdoc에서 글꼴이 대체되면 글자가 노드 상자보다 넓어져 넘칠 수 있다. 그래서 REQ-008을 run 첫 관문(M1)으로 둔다.

### 알려진 한계 (규범)

1. 감지 대상은 `pre.mermaid`·`div.mermaid` 두 가지뿐이다. `<code class="language-mermaid">`(마크다운 변환기 출력), 스크립트가 `mermaid.render()`로 만드는 그림은 선명 모드에서 계속 원문이다.
2. 페이지의 mermaid 테마·init 설정은 반영하지 않는다. 그림은 마크다운 미리보기와 같은 잉크 앤 허니 팔레트다. 문법 안의 `classDef`·`style`은 pele가 지원하는 만큼 반영된다.
3. pele가 지원하지 않는 다이어그램 종류·문법은 실패 안내로 표시된다(mermaid 원본 라이브러리보다 지원 범위가 좁을 수 있다).
4. 원본 보기에는 적용되지 않는다(페이지 자체 mermaid가 그린다). 같은 파일이 두 모드에서 다른 색으로 보일 수 있다.
5. 페이지 CSS가 `.mermaid`·`pre`에 준 스타일(배경·여백·`white-space`)은 그대로 적용된다(블록 요소를 유지하므로 mermaid 원본 라이브러리와 같은 구조).
6. 블록 수에 상한을 두지 않는다. 블록이 아주 많은 문서는 렌더하는 동안 미리보기가 잠깐 멈출 수 있다(마크다운 미리보기와 같은 동기 방식).
7. 다이어그램 내부 id는 `pd<N>` 접두사다. 페이지가 같은 id를 쓰면 충돌할 수 있다(가능성 낮음).
8. 블록 안에 실제 태그로 쓴 글자(`A[<b>x</b>]`처럼 이스케이프하지 않은 마크업)는 버려진다. `<br>`만 `<br/>` 글자로 살린다. mermaid 원본 라이브러리는 안쪽 HTML을 그대로 넘기므로 이런 라벨은 결과가 다를 수 있다.
9. 가림 대상 원문 텍스트 요소 목록(REQ-002) 밖의 특수 문맥(예: `<plaintext>`, SVG·MathML 안의 `<pre>`)은 고려하지 않는다.

## §4 REQ-AC 대응

| REQ | AC | 검증 기법 |
|-----|----|----------|
| REQ-PREVIEW021-001 | AC-PREVIEW021-001, AC-PREVIEW021-009 | unit — 뷰어 모드별 srcdoc, 원본 보기·폴백 미적용 |
| REQ-PREVIEW021-002 | AC-PREVIEW021-002, AC-PREVIEW021-003 | unit — 감지 표 |
| REQ-PREVIEW021-003 | AC-PREVIEW021-004 | unit — 원문 추출 |
| REQ-PREVIEW021-004 | AC-PREVIEW021-005 | unit — 렌더 삽입·var 0개 |
| REQ-PREVIEW021-005 | AC-PREVIEW021-006 | unit — 실패 안내 |
| REQ-PREVIEW021-006 | AC-PREVIEW021-007 | unit — 블록 밖 바이트 보존 |
| REQ-PREVIEW021-007 | AC-PREVIEW021-008 | unit — 동기·예외 안전·재실행 없음 |
| REQ-PREVIEW021-008 | AC-PREVIEW021-010 | M1 관문 실측 기록 + unit(선택 경로) |
| REQ-PREVIEW021-009, 010 | AC-PREVIEW021-011 | unit + grep — 정화 경로·sandbox·CSP 불변·MX 주석 |
| REQ-PREVIEW021-001, 004, 008 | AC-PREVIEW021-012 | e2e(Playwright WebKit, 부분 증거) + 수동 M-1·M-2 (macOS·Windows) |

## §5 Exclusions (What NOT to Build)

### 5.1 Out of Scope — 원본 보기

- 원본 보기(asset iframe)는 페이지 스크립트가 돌므로 페이지 자체 mermaid가 그린다. 이 SPEC은 손대지 않는다.

### 5.2 Out of Scope — 다른 삽입 방식

- `<code class="language-mermaid">`, `<pre><code class="mermaid">`, 스크립트 `mermaid.render()`·사용자 지정 선택자 `mermaid.run({ querySelector })`는 지원하지 않는다(사용자 결정).

### 5.3 Out of Scope — CSP·sandbox 변경

- 셸 CSP(`font-src` 포함)와 iframe sandbox는 바꾸지 않는다. `font-src`는 SPEC-SEC-002 소관이다.

### 5.4 Out of Scope — 페이지 테마 반영·다크 전용 팔레트

- 페이지의 mermaid 테마나 앱 다크 테마에 맞춘 다른 색은 쓰지 않는다(고정 팔레트, SPEC-PREVIEW-016).

### 5.5 Out of Scope — 다이어그램 렌더 모듈 변경

- `diagramRenderer.ts`(pele 옵션·정화)와 `exportUtils.ts`(`renderExportDiagram`·`SHAPE_TONES`)의 동작은 바꾸지 않는다. 시그니처 확장이 필요해지면 blocker로 보고한다.

### 5.6 Out of Scope — 비동기·워커 렌더

- 렌더를 워커나 비동기로 옮기지 않는다(REQ-007). 대량 블록 성능은 한계 6으로 둔다.

## §6 References

- `.moai/specs/SPEC-PREVIEW-019-html-crisp-zoom/spec.md` — 선명 모드, CSP 상속, 한계 3(웹폰트 CORS)
- `.moai/specs/SPEC-PREVIEW-015-pele-renderer/design.md` — D3(단일 렌더 경로), D4(전용 정화), D6(색 치환), D14(캔버스 `measureText` 글자 폭 측정)
- `src/lib/preview/htmlSrcdoc.ts`, `src/components/preview/HtmlFileViewer.tsx`
- `src/lib/diagram/diagramRenderer.ts` (`renderDiagram`, `readPeleThemeValues`, `DIAGRAM_FONT_FAMILY*`)
- `src/lib/export/exportUtils.ts` (`renderExportDiagram`, `SHAPE_TONES`)
- `src/index.css` `.mermaid-container`(바탕 `--pele-bg`, 다크 카드 테두리·반경), `src/styles/mdedit-tokens.css`(`--pele-*` 고정 값, 다크 블록에 재정의 없음)

## §7 Open Questions (코디네이터/사용자)

1. SPEC-SEC-002(카드 t1)가 셸 CSP `font-src`에 `data:`를 넣는가? 넣는다면 REQ-008 경로 (B)가 열린다. 병합 순서가 t1 → t3 → t2이므로 run 시작 시 origin/main에서 확인한다.
2. M1에서 (A)·(B)가 모두 안 되면 (C) 시스템 글꼴 대체를 받아들일지 — run 단계에서 blocker로 코디네이터에 올린다.
