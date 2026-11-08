---
id: SPEC-PREVIEW-018
title: "HTML 미리보기 브라우저식 배율(zoom) — 단계 배율 컨트롤·단축키·휠/핀치·전역 영속화"
version: "0.2.0"
status: in-progress
created: 2026-11-08
updated: 2026-11-09
author: jw (bjw202)
priority: Medium
phase: "v0.20.0 target"
module: src/components/preview
lifecycle: spec-anchored
tags: "preview, html, zoom, iframe, header, shortcut, persist"
tier: S
related_specs: [SPEC-PREVIEW-004, SPEC-PREVIEW-008]
---

# SPEC-PREVIEW-018: HTML 미리보기 브라우저식 배율(zoom)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-08 | jw | 최초 작성. 사용자 결정(2026-11-08 인터뷰, 오케스트레이터 경유): (1) HTML 전용 퍼센트 배율 컨트롤을 헤더에 두고 `html` 보기에서 A-/A+ 글자 크기 단계 조절 대신 표시, 단계 67·75·80·90·100·110·125·150·175·200, 퍼센트 표시를 누르면 100%로 복귀 (2) 입력은 버튼·Cmd/Ctrl+`=`/`+`/`-`/`0`·Cmd/Ctrl+휠(트랙패드 핀치 포함) 셋 다 (3) 모든 HTML 파일에 하나의 전역 값, 앱 재시작 후에도 유지. Tier S이나 오케스트레이터 요청으로 검증 층을 `acceptance.md`로 분리한다(요구 층은 이 파일). 코드 앵커는 main HEAD 00c0edb 기준. REQ 7건·AC 8건. |
| 0.2.0 | 2026-11-09 | jw | plan-audit 1차(`.moai/reports/plan-audit/SPEC-PREVIEW-018-review-1.md`, FAIL 0.76) 반영. 사용자 결정(2026-11-09, 오케스트레이터 경유, D4·D5 해소): "먼저 측정하고 결정한다" — 휠·핀치는 사용자 요청대로 범위 안에 유지하고, run 단계 첫 작업으로 macOS·Windows 실기기에서 iframe 위 Cmd/Ctrl+휠·핀치가 앱 셸에 도달하는지 측정한다. 도달하면 REQ-005대로 구현하고, 도달하지 않으면 run은 멈추고 차단 보고를 돌려 사용자가 고른다. 이에 따라 "앱 셸이 받지 못하면 결함 아님" 문구를 삭제하고, 어떤 형태의 덮개도 사용자 결정 없이 구현하지 않는다고 명시했다. D1 sandbox 검증을 속성 줄 기준으로 교체(문자열 리터럴은 파일에 3회 — L2·L24·L72, 속성 줄은 L72 1회, 직접 grep 확인). D2 휠 단위를 "제스처당 한 단계, 제스처 경계 = 150ms 무입력, 누적 문턱 50px"로 통일. D3 Windows 수동 항목 필수화. 경미 D6~D15 반영(아래 각 절). REQ·AC 식별자 변경 없음. |

## §1 Overview

### 배경

- 미리보기에서 마크다운·코드·텍스트 파일은 헤더의 A-/A+ 단계 조절(`uiStore.fontSize`, 10~24px)이 CSS `zoom`(`getPreviewZoom(fontSize)` = fontSize/14)으로 크기를 바꾼다.
- HTML 파일은 샌드박스 iframe(`HtmlFileViewer`)으로 렌더되어 이 경로가 닿지 않고 배율이 100%로 고정이다. iframe 내용은 `asset://` origin이라 앱 셸(`tauri://`)과 cross-origin이고, 앱은 iframe 문서에 CSS를 넣거나 `contentDocument`를 읽을 수 없다.
- 사용자는 브라우저와 같은 방식의 배율(글자가 커지면 줄바꿈이 다시 계산되고 반응형 규칙도 반응하는 방식)을 원한다.

### Tier 판단

- Tier S. 소스 변경은 4~5개(새 배율 단계 모듈, 상태 저장소, HTML 뷰어, 헤더, 키 리스너 위치)로 Tier S의 "5개 미만" 경계 안이다. 테스트 파일(4개 안팎)은 소스 1개당 짝이 되는 검증 파일이라 파일 수 기준에서 제외해 판단했다. 알고리즘 난도도 낮다. 다만 iframe 경계 때문에 실기기 수동 검증 항목이 많아, 오케스트레이터 요청으로 검증 층을 `acceptance.md`로 분리했다.

## §2 Requirements (GEARS)

#### REQ-PREVIEW018-001: HTML 전용 배율 컨트롤 (State-driven + Ubiquitous)

- **While** 현재 파일의 보기 종류(`getFileViewType`)가 `html`일 때, the 헤더 shall 글자 크기 단계 조절(A-/A+) 자리에 HTML 배율 컨트롤 `[− N% +]`를 표시한다.
- **While** 현재 파일의 보기 종류가 `html`이 아닐 때, the 헤더 shall 기존 글자 크기 단계 조절을 지금과 같이 표시하고 HTML 배율 컨트롤을 표시하지 않는다.
- The HTML 배율 컨트롤 shall 현재 배율을 정수 퍼센트(예: `110%`)로 표시하고, 세 조작 요소의 접근성 이름을 "Zoom out", "Zoom in", "Reset zoom to 100%"로 둔다.

#### REQ-PREVIEW018-002: 단계 배율과 경계 (Event-driven + State-driven)

- The HTML 배율 shall 다음 단계 값만 가진다: 67, 75, 80, 90, 100, 110, 125, 150, 175, 200(%). 기본값은 100이다.
- **When** 사용자가 `+`를 누르면, the HTML 배율 shall 바로 위 단계로 오른다. **When** 사용자가 `−`를 누르면, the HTML 배율 shall 바로 아래 단계로 내린다.
- **When** 배율이 이미 최댓값(200) 또는 최솟값(67)일 때 같은 방향 입력이 들어오면, the HTML 배율 shall 값을 바꾸지 않는다.
- **While** 배율이 최댓값이면, the "Zoom in" 버튼 shall 비활성화된다. **While** 배율이 최솟값이면, the "Zoom out" 버튼 shall 비활성화된다.
- **When** 사용자가 퍼센트 표시를 누르면, the HTML 배율 shall 100으로 돌아간다.

#### REQ-PREVIEW018-003: 브라우저식 적용 (Ubiquitous + Unwanted)

- The HTML 미리보기 shall 배율 z에서 iframe 문서의 레이아웃 뷰포트 폭을 미리보기 영역 폭의 1/z로 만들고, 그 결과를 z배로 확대·축소해 미리보기 영역을 정확히 채운다(본문 줄바꿈과 미디어 쿼리가 배율에 반응한다).
- The HTML 미리보기 shall 배율과 무관하게 iframe 자체 스크롤로 문서 전체를 볼 수 있게 한다.
- The HTML 미리보기 shall not iframe의 `sandbox` 속성 값(`allow-scripts allow-same-origin`)이나 `src` 변환 방식을 바꾼다(SPEC-PREVIEW-004 acceptance.md "보안 시나리오 3: 앱 권한 탈취 시도 차단", 파일의 `@MX:WARN`).

#### REQ-PREVIEW018-004: 키보드 단축키 (State-driven + Event-driven + Unwanted)

- **While** 보기 종류가 `html`이고 키보드 초점이 앱 셸 문서 안에 있을 때, **when** 사용자가 수정키와 `=` 또는 `+`를 누르면, the 앱 shall 배율을 한 단계 올리고, `-`를 누르면 한 단계 내리고, `0`을 누르면 100으로 되돌린다. 수정키는 macOS에서 Cmd(`metaKey`)만, 그 밖의 OS에서 Ctrl(`ctrlKey`)만이다.
- **When** 위 단축키를 처리하면, the 앱 shall 그 키 이벤트의 기본 동작을 막아 웹뷰 자체 배율이 함께 바뀌지 않게 한다.
- **While** 보기 종류가 `html`이 아니거나, 모달 대화상자(`role="dialog"` + `aria-modal="true"`)가 열려 있거나, 한국어 등 입력 조합 중(`isComposing`)일 때, the 앱 shall not 위 키로 HTML 배율이나 글자 크기를 바꾸고, 그 키 이벤트의 기본 동작도 막지 않는다.

#### REQ-PREVIEW018-005: Cmd/Ctrl + 휠·핀치 (State-driven + Event-driven)

- **While** 보기 종류가 `html`일 때, **when** 포인터가 HTML 미리보기 영역(iframe 위 포함) 위에 있는 상태에서 수정키(macOS Cmd 또는 핀치가 만드는 `ctrlKey`, 그 밖의 OS Ctrl)가 켜진 휠 이벤트가 발생하면, the 앱 shall 그 이벤트의 기본 동작을 막고 배율을 바꾼다. 확대 방향(`deltaY` 음수)은 한 단계 올리기, 축소 방향(`deltaY` 양수)은 한 단계 내리기다.
- The 휠 처리 shall 제스처당 최대 한 단계만 배율을 바꾼다. 제스처는 수정키가 켜진 휠 이벤트가 이어지는 구간이며, 직전 이벤트로부터 150ms 동안 휠 이벤트가 없으면 끝난다. 한 제스처 안에서는 `deltaY` 누적 절댓값이 처음으로 50px 이상이 되는 순간 그 누적값의 부호 방향으로 한 단계 움직이고, 그 제스처가 끝날 때까지 더 움직이지 않는다. 줄 단위(`deltaMode` 1) 값은 16px, 페이지 단위(`deltaMode` 2) 값은 문턱값 이상으로 환산한다.
- 이 요구의 충족 여부는 실기기 측정으로 판정한다(§3 실측 관문).

#### REQ-PREVIEW018-006: 전역 영속화 (Ubiquitous + Event-driven)

- The HTML 배율 shall 모든 HTML 파일에 공통인 하나의 값이고, 기존 UI 저장소(`mdedit-ui-store`)에 함께 저장되어 앱 재시작 후에도 유지된다.
- **When** 저장된 상태에 HTML 배율 값이 없으면, the 앱 shall 100을 쓴다.
- **When** 저장된 HTML 배율 값의 형(typeof)이 `number`가 아니거나 유한하지 않으면(숫자 문자열 `"150"` 포함), the 앱 shall 100을 쓴다.
- **When** 저장된 HTML 배율 값이 유한한 수이지만 단계 목록에 없으면, the 앱 shall 가장 가까운 단계 값을 쓴다(같은 거리면 작은 쪽).

#### REQ-PREVIEW018-007: 다른 크기 조절과 분리 (Unwanted)

- The HTML 배율 shall not `uiStore.fontSize`와 마크다운·코드·텍스트 미리보기의 배율을 바꾼다.
- The HTML 배율 shall not SVG 뷰어(`SvgFileViewer`)의 자체 배율 동작을 바꾼다.
- The HTML 배율 shall not 앱 전체 웹뷰 배율(Tauri 웹뷰 zoom API, `zoomHotkeysEnabled`)을 쓰거나 켜며, 사용자의 배율 입력 결과로 헤더·탐색기 등 앱 UI 전체의 크기가 바뀌어서는 안 된다.

## §3 Constraints and Known Limitations

### 휠·핀치 실측 관문 (run 단계 첫 작업, 사용자 결정 2026-11-09)

- 배율 적용 뒤에도 iframe이 미리보기 영역을 채우고, iframe 문서는 cross-origin이다. 그래서 iframe 위에서 생긴 Cmd/Ctrl+휠·핀치가 앱 셸에 도달하는지는 알 수 없고, plan 단계는 이를 측정하지 않았다.
- run 단계는 어떤 구현보다 먼저 macOS(WKWebView)와 Windows(WebView2) 실기기에서 포인터가 iframe 위에 있을 때 Cmd/Ctrl+휠과 트랙패드 핀치가 앱 셸에 도달하는지 측정해 기록한다.
- 두 OS 모두 도달하면 REQ-005대로 구현한다.
- 한 OS에서라도 도달하지 않으면 run 단계는 휠·핀치 구현을 시작하지 않고 멈추며, 측정 결과를 담은 차단 보고를 오케스트레이터에 돌려준다. 이후 방향은 사용자가 정하며, 그 결정은 이 SPEC의 개정으로 반영한다. 도달하지 않는 결과를 이 SPEC 안에서 결함 아님이나 허용 제한으로 미리 정하지 않는다.

### 입력 덮개 금지

- iframe 위에 입력을 가로채는 덮개는 상시든 조건부든(예: 수정키를 누른 동안만 표시) 사용자 결정 없이 구현하지 않는다.

### iframe 안 키보드 초점 (키 단축키 한정)

- 키보드 초점이 iframe 문서 안에 있으면 키 이벤트는 iframe 문서로 가고 cross-origin이라 앱 셸이 받지 못한다. 이때 REQ-004 단축키는 동작하지 않는다. 사용자가 헤더·탐색기·편집기 등 앱 셸을 한 번 누르면 다시 동작한다. 이 제한은 키보드 단축키에만 해당하며, 휠·핀치에는 위 실측 관문이 적용된다.

### 샌드박스 불변

- iframe `sandbox` 속성 값과 asset URL 정규화는 바꾸지 않는다.

## §4 REQ-AC 대응

| REQ | AC | 검증 기법 |
|-----|-----|----------|
| REQ-PREVIEW018-001 | AC-PREVIEW018-001 | unit — 헤더 렌더링(vitest + RTL) |
| REQ-PREVIEW018-002 | AC-PREVIEW018-002 | unit — 단계 함수·저장소·버튼 비활성 |
| REQ-PREVIEW018-003 | AC-PREVIEW018-003 | unit(스타일·sandbox) + 수동 M-1 |
| REQ-PREVIEW018-004 | AC-PREVIEW018-004, AC-PREVIEW018-008 | unit(키 이벤트) + 수동 M-2·M-4 |
| REQ-PREVIEW018-005 | AC-PREVIEW018-005 | unit(제스처 논리) + 수동 M-3 필수(두 OS) |
| REQ-PREVIEW018-006 | AC-PREVIEW018-006 | unit — 재수화 |
| REQ-PREVIEW018-007 | AC-PREVIEW018-007, AC-PREVIEW018-008 | unit + grep + git diff + 수동 M-5 |

## §5 Exclusions (What NOT to Build)

### Out of Scope — 다른 뷰어의 크기 조절

- 마크다운·코드·텍스트 미리보기의 A-/A+ 글자 크기 조절 동작은 바꾸지 않는다.
- SVG 뷰어의 자체 배율(맞춤·100%·확대·축소)은 바꾸지 않는다.
- 이미지 뷰어에 배율을 더하지 않는다.

### Out of Scope — 파일별·고급 배율

- 파일마다 다른 배율을 기억하지 않는다(전역 값 하나).
- 단계 밖의 임의 배율 입력(직접 숫자 입력, 슬라이더)은 만들지 않는다.
- 설정 화면에 배율 항목을 더하지 않는다.

### Out of Scope — iframe 경계 우회

- iframe 문서에 스크립트·CSS를 주입하거나 `sandbox` 권한을 넓히지 않는다.
- iframe 위에 입력을 가로채는 덮개(상시·조건부 모두)를 사용자 결정 없이 두지 않는다.
- 앱 전체 웹뷰 배율이나 웹뷰 기본 배율 단축키를 켜지 않는다.

### Out of Scope — 내보내기

- HTML 배율은 화면 미리보기에만 적용하며 내보내기 결과에 영향을 주지 않는다.

## §6 References

- 수용 기준: `acceptance.md`. 구현 계획·기술 결정·위험: `plan.md`.
- 선행 SPEC: `.moai/specs/SPEC-PREVIEW-004/`(HTML 샌드박스 iframe, acceptance.md "보안 시나리오 3"), `.moai/specs/SPEC-PREVIEW-008-image-svg-viewer/`(SVG 자체 배율).
- plan-audit: `.moai/reports/plan-audit/SPEC-PREVIEW-018-review-1.md`.
- 코드 앵커: `src/components/preview/HtmlFileViewer.tsx`, `src/components/layout/Header.tsx`(A-/A+ 단계 조절), `src/store/uiStore.ts`(`mdedit-ui-store`, persist version 1), `src/lib/preview/previewZoom.ts`, `src/components/preview/PreviewContainer.tsx`(`getFileViewType`).
