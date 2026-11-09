---
id: SPEC-PREVIEW-020
title: "HTML 미리보기 OS별 기본 렌더 모드 — Windows는 원본 보기, macOS는 선명 모드"
version: "0.1.2"
status: implemented
created: 2026-11-09
updated: 2026-11-09
author: jw (bjw202)
priority: Medium
phase: "v0.21.0 target"
module: src/store
lifecycle: spec-anchored
tags: "preview, html, render-mode, platform, persist, migration, windows"
tier: S
depends_on: [SPEC-SEC-001]
related_specs: [SPEC-PREVIEW-018, SPEC-PREVIEW-019]
---

# SPEC-PREVIEW-020: HTML 미리보기 OS별 기본 렌더 모드

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-09 | jw | 최초 작성. 계기: 사용자가 v0.20.0 Windows 릴리스 빌드에서 확인한 두 가지(2026-11-09). (1) 원본 보기(asset iframe + transform 배율)가 Windows(WebView2/Chromium)에서는 확대해도 충분히 선명하다. macOS(WKWebView)에서는 100% 초과 시 흐리다. (2) 선명 모드는 페이지 자체 스크립트를 막으므로 HTML 안의 Mermaid가 그림이 아니라 텍스트로 보인다. 사용자 결정(구속): OS별 기본값 — Windows는 `'original'`, macOS는 `'crisp'`. 토글은 유지한다. 사용자가 명시적으로 고른 값(영속)이 항상 이기고, OS 기본값은 고른 적이 없을 때만 적용한다. Linux는 `'crisp'`(가정). 이 SPEC은 SPEC-PREVIEW-019 REQ-PREVIEW019-001의 기본값 조항을 부분 개정한다(§5). Mermaid 사전 렌더(백로그 t2)와 스크립트 페이지 자동 원본 전환은 범위 밖이다. |
| 0.1.1 | 2026-11-09 | jw | plan-audit 1차(`.moai/reports/plan-audit/SPEC-PREVIEW-020-review-1.md`, PASS 0.82) 결함 D1~D10 반영. 요구·수용 기준의 의미는 바꾸지 않았다. (D1) §5 "세 단위 테스트"를 구체 목록으로 바꾸고 `src/test/uiStore.test.ts`를 갱신 대상에 추가. (D2) §7-4의 열린 질문을 SPEC-SEC-001 증거로 대체하고 `depends_on: [SPEC-SEC-001]` 추가. (D3) e2e에는 v1 저장소 마이그레이션 사례가 없고 마이그레이션은 단위 테스트가 전담함을 명시. (D4) 사용자 기반 서술을 미측정 가정으로 고치고 조용한 선택 소실을 비용으로 명시. (D5) AC-001·002의 항진 문장 제거, 영속화 유발 방법을 명시. (D7) AC-007의 diff 범위에 import 줄 포함. (D8) REQ-001 첫 문장 재작성. |
| 0.1.2 | 2026-11-09 | jw | 사용자 결정(구속, 2026-11-09): 열린 질문 3(토글 툴팁 불일치)을 이 SPEC에서 해결한다. REQ-PREVIEW020-008 신설 — 토글 `title`이 현재 OS의 기본 모드를 말하고, 100% 초과 흐림 경고는 기본이 선명 모드인 OS(macOS·Linux)에만 남기며 Windows에서는 뺀다. REQ-007에서 "토글 `title` 문구 불변" 조항을 걷어내고 툴팁을 의도한 유일한 문구 변경으로 바꿨다. AC-006에 툴팁 검증(정확한 부분 문자열, 순수 헬퍼 단위 표)을 합치고 AC-007의 Header.tsx diff 허용 범위를 토글 상태·핸들러·`title` 식으로 넓혔다. §6 "UI 문구" 제외 항목과 §7-3을 해소로 고쳤다. 소스 파일 수(4개)와 AC 수(8건)는 그대로다. 개정 범위는 이 한 가지이며 재감사는 하지 않았다. |

## §1 Overview

### 배경

- SPEC-PREVIEW-019(completed, v0.20.0)가 `htmlRenderMode: 'crisp' | 'original'`을 `uiStore`에 넣었고 기본값을 모든 OS에서 `'crisp'`으로 했다. 선명 모드는 파일을 `srcdoc` iframe으로 렌더하며 페이지 자체 스크립트를 막는다(019 §3 한계 1).
- 사용자 관찰(Windows 릴리스 빌드): 원본 보기는 Windows에서 확대해도 충분히 선명하다. 그런데 기본값이 선명 모드라 스크립트가 필요한 페이지(HTML 안의 Mermaid)가 텍스트로 보인다. 이 선명도 판단은 사용자 관찰이며 우리가 측정한 값이 아니다. 수동 항목 M-1이 이를 확인하고, 실패하면 이 SPEC은 멈춘다(§5).
- macOS(WKWebView)는 원본 보기가 100% 초과에서 흐리므로 선명 모드가 계속 기본이어야 한다(019의 동기 그대로).

### 해법의 형태

- 영속 상태 `htmlRenderMode`를 `'crisp' | 'original' | null`로 넓힌다. `null`은 "사용자가 아직 고르지 않았다"는 뜻이다.
- 실제로 쓰는 모드는 순수 함수가 결정한다: 고른 값이 있으면 그 값, 없으면 OS 기본값. OS 기본값은 Windows(`/^win/i`)만 `'original'`, 나머지는 `'crisp'`이다.
- 토글은 지금 화면에 쓰이는(해소된) 모드의 반대 값을 명시적으로 저장한다.

### Tier 판단

- **Tier S.** 소스 변경 4개(`src/store/uiStore.ts`, `src/lib/preview/htmlZoom.ts`, `src/components/layout/Header.tsx`, `src/components/preview/HtmlFileViewer.tsx`), 소스 약 60~120 LOC. 활성 REQ 8건·AC 8건으로 Tier S 상한(각 8) 안이다(REQ-008은 AC-006에 합쳐 AC 수를 늘리지 않았다).
- Tier M으로 올리지 않는 이유: 새 보안 경계나 새 CSP 변경이 없고(019가 만든 두 렌더 경로를 그대로 쓴다), 새 모듈·새 UI·새 Rust 명령이 없으며, 소스 파일이 5개 미만이다. 유일하게 까다로운 부분은 영속 저장소 마이그레이션이며, 이는 표 구동 단위 테스트(AC-004)로 닫힌다. 테스트·e2e 파일 수정은 소스 1개당 짝이 되는 검증 파일이라 018과 같은 기준으로 파일 수에서 제외해 판단했다.

## §2 Requirements (GEARS)

#### REQ-PREVIEW020-001: 선택 상태 — 고르지 않음을 표현한다 (Ubiquitous + Event-driven)

- The `htmlRenderMode` 상태 shall 정확히 `'crisp'`, `'original'`, `null` 셋 중 하나를 가지며, 여기서 `null`은 사용자가 아직 고르지 않았음을 뜻한다. 새로 설치한 앱의 초기값은 `null`이다.
- **When** `setHtmlRenderMode`가 `'crisp'`·`'original'`을 받으면, the 앱 shall 그 값을 저장한다. **When** 그 밖의 값(다른 문자열, 숫자, `null`, `undefined` 포함)을 받으면, the 앱 shall `null`로 정규화한다. 이는 SPEC-PREVIEW-019의 "허용 밖 값은 `'crisp'`" 정규화를 대체한다(§5).

#### REQ-PREVIEW020-002: OS 기본값과 결정 해소 — 순수 함수 (Ubiquitous)

- The `defaultHtmlRenderMode(platform)` shall 플랫폼 문자열이 `^win`(대소문자 무시)으로 시작하면 `'original'`, 그 밖의 모든 값(빈 문자열 포함)이면 `'crisp'`을 돌려준다. 패턴은 문자열 앞에 고정(anchor)되어야 한다. 고정하지 않은 `win`은 "Darwin"과 맞아 macOS를 Windows로 오판한다.
- The `resolveHtmlRenderMode(choice, platform)` shall 고른 값(`choice`)이 `'crisp'`·`'original'`이면 그 값을, `null`이면 `defaultHtmlRenderMode(platform)`을 돌려준다.
- 두 함수는 `navigator`·저장소·DOM에 접근하지 않는 순수 함수다. 플랫폼 문자열은 호출자가 기존 `detectPlatform()`으로 얻어 넘긴다.

#### REQ-PREVIEW020-003: 소비자는 해소된 모드를 쓴다 (Ubiquitous + Event-driven)

- The HTML 미리보기 shall 저장된 `htmlRenderMode`를 `detectPlatform()`과 함께 `resolveHtmlRenderMode`에 넘겨 얻은 모드로 선명 모드(`CrispHtmlView`)와 원본 보기(`OriginalHtmlView`) 중 하나를 렌더한다.
- The 헤더 토글(접근성 이름 `Original view`) shall 해소된 모드가 `'original'`일 때 `aria-pressed="true"`와 `is-active` 클래스를 가진다.
- **When** 사용자가 토글을 누르면, the 앱 shall 해소된 모드의 반대 값(`'original'` ↔ `'crisp'`)을 `setHtmlRenderMode`로 명시 저장한다. 따라서 Windows 기본(`'original'`) 상태에서 누르면 `'crisp'`, macOS 기본(`'crisp'`) 상태에서 누르면 `'original'`이 저장된다.
- The 사용자가 명시 저장한 값 shall 플랫폼과 무관하게 OS 기본값보다 우선한다.

#### REQ-PREVIEW020-004: 재수화는 미선택을 미선택으로 둔다 (State-driven)

- **While** 저장소를 재수화하는 중에, **when** 저장된 `htmlRenderMode`가 `'crisp'`·`'original'`이면, the 앱 shall 그 값을 그대로 둔다.
- **When** 저장된 값이 없거나(필드 부재) `null`이거나 그 밖의 값(`'Crisp'`, `'srcdoc'`, 숫자, 불리언, 객체)이면, the 앱 shall `null`을 쓴다. `'crisp'`으로 바꾸지 않는다.

#### REQ-PREVIEW020-005: 영속 버전 1 → 2 마이그레이션 (Event-driven)

- **When** 저장된 상태의 영속 버전이 2보다 작으면, the 앱 shall 마이그레이션에서 저장된 `htmlRenderMode`가 `'original'`이면 그대로 두고, 그 밖의 모든 값(`'crisp'` 포함)은 `null`로 바꾼다. 다른 필드는 건드리지 않는다.
- The 마이그레이션 shall 기존 버전 0 → 1 단계(stale `saveStatus` 제거)를 그대로 유지하며, 버전 0 상태는 두 단계를 차례로 거친다.
- 사유: v0.20.0 이하 저장소는 기본값 `'crisp'`을 포함해 `htmlRenderMode` 전체를 쓰므로, 저장된 `'crisp'`은 "명시적으로 골랐다"와 "기본값이 그냥 저장됐다"를 구별할 수 없다. 구별이 불가능하므로 `'crisp'`을 버린다. 저장된 `'original'`은 기본값이 `'crisp'`이었으므로 토글로 골랐을 때만 생길 수 있어 보존한다.

#### REQ-PREVIEW020-006: OS 기본값은 저장하지 않는다 (Unwanted)

- The 앱 shall not 해소된 OS 기본값을 영속 저장소에 쓴다. 사용자가 토글로 고르기 전에는 저장된 `htmlRenderMode`가 `null`로 남는다.
- 사유: 기본값을 저장하면 그 순간부터 "명시 선택"과 구별할 수 없게 되어 이 SPEC이 풀려는 문제(REQ-005 사유)가 되살아난다.

#### REQ-PREVIEW020-007: 그 밖의 동작은 바꾸지 않는다 (Unwanted)

- The 이 SPEC shall not 선명 모드·원본 보기 두 렌더 경로의 내용과 동작, SPEC-PREVIEW-019 REQ-007의 폴백(`'original'` 방식 렌더, 저장된 모드 불변), 앱 셸 CSP, 018 배율 컨트롤·단축키·`htmlZoom` 영속화를 바꾼다.
- The 토글 `title`(툴팁) 문구는 REQ-PREVIEW020-008이 바꾸는 유일한 문구다. The 이 SPEC shall not 그 밖의 헤더 문구(`aria-label="Original view"`, 버튼 글자 `원본 보기`)를 바꾼다.
- The 이 SPEC shall not "OS 기본값으로 되돌리기" UI나 새 설정 항목을 더한다.

#### REQ-PREVIEW020-008: 토글 툴팁은 현재 OS의 기본값을 말한다 (Ubiquitous + capability-gate)

- The `htmlRenderToggleTitle(platform)` shall 플랫폼 문자열만의 순수 함수로서 토글 `title` 문구를 돌려준다. 저장된 선택·해소된 모드·`navigator`·DOM을 읽지 않는다. 헤더 토글의 `title`은 `detectPlatform()`을 넘긴 이 함수의 결과다.
- **Where** `defaultHtmlRenderMode(platform)`이 `'original'`이면(Windows), the 툴팁 shall 이 기기의 기본이 원본 보기임을 밝히고, 페이지 자체 스크립트·외부 리소스 제약이 선명 모드 쪽에 있음을 안내한다. 이 툴팁은 100% 초과 확대가 흐릿하다는 경고를 담지 않고, "선명 모드(기본)"이라는 표기도 담지 않는다.
- **Where** `defaultHtmlRenderMode(platform)`이 `'crisp'`이면(macOS·Linux·그 밖), the 툴팁 shall 이 기기의 기본이 선명 모드임을 밝히고, 선명 모드의 스크립트·외부 리소스 제약과 "원본 보기에서는 100% 초과 확대가 흐릿합니다" 경고를 담는다.
- The 툴팁 shall 사용자가 명시 저장한 선택에 따라 달라지지 않는다. 명시 선택은 `aria-pressed`와 `is-active`만 바꾼다.
- 사유: SPEC-PREVIEW-019의 문구는 모든 OS에서 선명 모드가 기본이고 원본 보기가 흐리다고 말한다. 이 SPEC 이후 Windows에서는 둘 다 사실이 아니다. 경고는 사실인 곳(WKWebView 계열의 기본 선명 모드)에만 남긴다.

## §3 Acceptance Criteria

Tier S이므로 수용 기준을 이 절에 둔다(별도 `acceptance.md` 없음). 개발 방식은 TDD이며 단위 테스트는 vitest다.

### AC-PREVIEW020-001 — 기본값·해소 함수 표 (unit, REQ-002)

- **Given** `defaultHtmlRenderMode`에 아래 플랫폼 문자열을 주면, **Then** 결과는 표와 같다.

| platform | 기대 |
|----------|------|
| `"Win32"`, `"Windows"`, `"win32"` | `'original'` |
| `"MacIntel"`, `"macOS"` | `'crisp'` |
| `"Darwin"` (고정 패턴 회귀 가드) | `'crisp'` |
| `"Linux x86_64"`, `"Linux"` | `'crisp'` |
| `""` | `'crisp'` |
| `"iPhone"` | `'crisp'` |

- **And** `resolveHtmlRenderMode`는 `(null, 'Win32')` → `'original'`, `(null, 'MacIntel')` → `'crisp'`, `(null, '')` → `'crisp'`, `('crisp', 'Win32')` → `'crisp'`, `('original', 'MacIntel')` → `'original'`, `('original', 'Win32')` → `'original'`, `('crisp', 'MacIntel')` → `'crisp'`을 돌려준다.
- **And** 두 함수는 `navigator`를 읽지 않는다. 검증: `navigator.platform`을 getter 스파이로 바꿔 두고(`vi.spyOn(navigator, 'platform', 'get')`) 위 표 전체를 호출한 뒤 스파이 호출 횟수가 0이다. 또한 `navigator.platform`을 `"Win32"`로 정의한 채 `defaultHtmlRenderMode("MacIntel")`을 부르면 `'crisp'`이고, `"MacIntel"`로 정의한 채 `defaultHtmlRenderMode("Win32")`를 부르면 `'original'`이다(인자만 결과를 정한다).

### AC-PREVIEW020-002 — 저장소 상태·기본값 비저장 (unit, REQ-001·006)

- **Given** 저장소를 비우고 새로 만든 상태에서, **Then** `htmlRenderMode`는 `null`이다.
- **And** (기본값 비저장, REQ-006) `detectPlatform`을 `"Win32"`로 모의하고 `htmlRenderMode`가 `null`인 채로 `HtmlFileViewer`를 렌더해 원본 보기가 해소되게 한 뒤, 다른 필드를 바꿔 persist가 쓰게 한다(예: `setFontSize`). 그 다음 `JSON.parse(localStorage['mdedit-ui-store']).state.htmlRenderMode`는 `null`이며 `'crisp'`·`'original'`이 아니다. 해소 결과(`'original'`)가 저장소에 새어 들어가면 이 단언이 실패한다. `"MacIntel"` 모의에서도 같은 단계를 반복해 `null`임을 확인한다.
- **And** `setHtmlRenderMode('original')`·`setHtmlRenderMode('crisp')` 뒤 저장된 JSON의 `state.htmlRenderMode`가 각각 그 값이다. (명시 선택이 OS 기본값을 이기는 동작은 AC-001의 `resolveHtmlRenderMode` 표와 AC-005·006이 검증한다.)
- **And** `setHtmlRenderMode`에 `'Crisp'`, `'srcdoc'`, `1`, `true`, `{}`, `null`, `undefined`를 주면 `htmlRenderMode`는 `null`이다.

### AC-PREVIEW020-003 — 재수화 (unit, REQ-004)

- **Given** 영속 버전 2 상태에 `htmlRenderMode`가 각각 `'original'`, `'crisp'`, `null`, 필드 없음, `'Crisp'`, `'srcdoc'`, `1`, `true`, `{}`로 저장되어 있을 때, **When** 저장소가 재수화되면 **Then** 결과는 순서대로 `'original'`, `'crisp'`, `null`, `null`, `null`, `null`, `null`, `null`, `null`이다.
- **And** 모든 경우에 `htmlZoom`·`fontSize` 등 다른 값은 그대로다.

### AC-PREVIEW020-004 — 마이그레이션 표 (unit, REQ-005)

- **Given** 아래 저장 상태로 재수화하면, **Then** 결과는 표와 같다.

| 저장 버전 | 저장 상태 | 기대 `htmlRenderMode` | 기타 |
|-----------|-----------|----------------------|------|
| 1 | `'original'` | `'original'` | 다른 필드 보존 |
| 1 | `'crisp'` | `null` | 다른 필드 보존 |
| 1 | 필드 없음 | `null` | |
| 1 | `'garbage'` | `null` | |
| 0 | `saveStatus: 'unsaved'` + `'original'` | `'original'` | `saveStatus` 제거됨 |
| 0 | `saveStatus: 'unsaved'` + `'crisp'` | `null` | `saveStatus` 제거됨 |
| 0 | `saveStatus: 'unsaved'` + 필드 없음 | `null` | `saveStatus` 제거됨 |
| 2 | `'crisp'` | `'crisp'` | 마이그레이션 미적용(명시 선택 보존) |

- **And** 저장된 상태가 객체가 아니거나(`null`, 문자열) 파싱할 수 없어도 예외를 던지지 않고 앱이 시작된다(초기값 `null`).
- **And** 마이그레이션 뒤 저장소를 다시 영속화하면 저장 버전이 2다.
- 검증 범위: 이 표는 vitest 단위 테스트가 전담한다. `e2e/html-file-viewer.spec.ts`에는 버전 1 저장소를 심는 마이그레이션 사례가 없고 이 SPEC도 더하지 않는다(e2e 시드는 모두 버전 2). 실기기 업그레이드 경로는 수동 M-4가 본다.

### AC-PREVIEW020-005 — 뷰어 (unit, REQ-003)

- **Given** `detectPlatform`을 `"Win32"`로 모의하고 `htmlRenderMode`가 `null`일 때 `HtmlFileViewer`를 렌더하면, **Then** 원본 보기(`sandbox`가 `"allow-scripts allow-same-origin"`, `src` 속성 있음, `srcdoc` 없음)가 렌더된다.
- **Given** `detectPlatform`을 `"MacIntel"`로 모의하고 `null`일 때, **Then** 선명 모드(`sandbox`가 `"allow-scripts"`, `srcdoc` 있음, `src` 없음)가 렌더된다.
- **Given** `"Win32"`이고 저장값이 명시적 `'crisp'`이면 선명 모드, `"MacIntel"`이고 명시적 `'original'`이면 원본 보기가 렌더된다.
- **And** 렌더 중에 저장값을 바꾸면(`setHtmlRenderMode`) 해소된 모드에 맞는 렌더 경로로 전환된다.

### AC-PREVIEW020-006 — 헤더 토글과 툴팁 (unit, REQ-003·008)

- **Given** `html` 파일이 열려 있고 `detectPlatform`이 `"Win32"`, 저장값 `null`이면, **Then** 토글 `Original view`는 `aria-pressed="true"`이고 `is-active` 클래스가 있다. 누르면 저장값이 `'crisp'`이 되고 `aria-pressed="false"`가 된다.
- **Given** `"MacIntel"`, 저장값 `null`이면, **Then** `aria-pressed="false"`이고 누르면 저장값이 `'original'`이 되고 `aria-pressed="true"`가 된다.
- **And** 명시 저장값이 있으면 플랫폼과 무관하게 그 값에 따라 `aria-pressed`가 정해진다(`"Win32"` + `'crisp'` → `false`, `"MacIntel"` + `'original'` → `true`).
- **And** `html`이 아닌 보기 종류에서는 토글이 보이지 않는다(019 AC-009 유지).
- **And** (툴팁, REQ-008 — 순수 헬퍼) `htmlRenderToggleTitle`은 `src/lib/preview/htmlZoom.ts`가 내보내는 순수 함수이며, `src/test/htmlZoom.test.ts`가 아래 표를 검증한다. 모든 문구는 공통으로 부분 문자열 `스크립트`, `외부`, `원본 보기`를 담는다(기존 `HeaderRenderMode.test.tsx`의 한계 안내 단언 유지).

  | platform | 반드시 포함하는 부분 문자열 | 포함하면 안 되는 부분 문자열 |
  |----------|---------------------------|----------------------------|
  | `"Win32"`, `"Windows"`, `"win32"` | `이 기기의 기본은 원본 보기입니다` | `흐릿`, `선명 모드(기본)` |
  | `"MacIntel"`, `"macOS"`, `"Darwin"`, `"Linux x86_64"`, `"Linux"`, `""` | `이 기기의 기본은 선명 모드입니다`, `원본 보기에서는 100% 초과 확대가 흐릿합니다` | `이 기기의 기본은 원본 보기입니다`, `선명 모드(기본)` |

- **And** (툴팁, 헤더 연결) `src/test/HeaderRenderMode.test.tsx`에서 `detectPlatform`을 `"Win32"`로 모의하면 토글의 `title` 속성이 위 Windows 행을 만족하고, `"MacIntel"`과 `"Linux x86_64"`로 모의하면 위 비Windows 행을 만족한다.
- **And** (툴팁은 명시 선택과 무관) 같은 플랫폼에서 저장값이 `null`·`'crisp'`·`'original'`이어도 `title` 문자열은 모두 같다(`"Win32"`와 `"MacIntel"` 각각). 저장값은 `aria-pressed`만 바꾼다. `navigator.platform`을 getter 스파이로 두고 `htmlRenderToggleTitle`을 표 전체에 호출했을 때 스파이 호출 횟수가 0이다(AC-001과 같은 방법).

### AC-PREVIEW020-007 — 변경 범위와 회귀 (unit + grep, REQ-007)

- **Given** 구현이 끝난 브랜치에서, **Then** `git diff --name-only <base>...HEAD`의 소스 파일은 `src/store/uiStore.ts`, `src/lib/preview/htmlZoom.ts`, `src/components/layout/Header.tsx`, `src/components/preview/HtmlFileViewer.tsx` 4개이며, `index.html`·`src-tauri/`는 diff에 없다.
- **And** `Header.tsx`의 diff는 해소된 모드를 쓰는 `aria-pressed`·`is-active`·클릭 핸들러 줄, `title` 속성 줄(툴팁 헬퍼 호출로 바뀜), `@/lib/preview/htmlZoom` import 줄로 한정된다. `aria-label="Original view"` 줄과 버튼 글자 `원본 보기` 줄은 diff에 없다(검증: `git diff -- src/components/layout/Header.tsx`의 `+`/`-` 줄을 위 허용 목록과 대조). 툴팁 문구 자체의 검증은 AC-006이 맡는다.
- **And** `HtmlFileViewer.tsx`에서 `OriginalHtmlView`·`CrispHtmlView` 본문, `sandbox` 속성 줄, `HTML_CRISP_MAX_BYTES` 폴백 로직은 diff에 없다. 이 파일에서 바뀌는 것은 `@/lib/preview/htmlZoom`에서 `detectPlatform`·`resolveHtmlRenderMode`를 가져오는 import 줄, 분기 줄, 해소 호출뿐이다(그 밖의 줄은 diff에 없다).
- **And** 019 폴백 테스트(`HtmlFileViewerCrisp.test.tsx`의 폴백 후 저장 모드 불변 단언)가 명시 `'crisp'` 시드로 계속 통과한다.
- **And** `npm run typecheck`, `npm run lint`, `npx vitest run`이 exit 0이다.

### AC-PREVIEW020-008 — 실기기 수동 확인 (manual, REQ-002·003·005·006)

릴리스 빌드에서 수행한다(수동 항목은 우리가 자동화로 관찰한 값이 아니다). 확인 기록은 `progress.md`에 남긴다.

- **M-1 (Windows, 새 프로필 — run 첫 관문)**: 저장소를 비운 Windows 빌드에서 HTML 파일을 열면 원본 보기로 열리고 토글이 눌려 있으며, 배율 150%·200%에서 글자가 선명하고, 스크립트가 필요한 HTML(Mermaid)이 그림으로 보인다. **실패하면(150%·200%가 흐리면) run을 멈추고 차단 보고를 돌려 사용자가 고른다.**
- **M-2 (macOS, 새 프로필)**: HTML 파일이 선명 모드로 열리고 토글이 눌려 있지 않으며, 배율 150%·200%에서 글자가 선명하다.
- **M-3 (두 OS, 명시 선택 영속)**: 토글을 눌러 기본값과 반대로 바꾼 뒤 앱을 종료·재시작해도 그 선택이 유지된다(Windows는 선명으로, macOS는 원본으로).
- **M-4 (두 OS, 업그레이드 경로)**: `localStorage['mdedit-ui-store']`에 `{state:{htmlRenderMode:'crisp'}, version:1}`을 심고 시작하면 Windows는 원본 보기, macOS는 선명 모드로 열린다. `{state:{htmlRenderMode:'original'}, version:1}`을 심으면 두 OS 모두 원본 보기로 열린다.

## §4 REQ → AC 대응

| REQ | AC | 검증 기법 |
|-----|-----|----------|
| REQ-PREVIEW020-001 | AC-PREVIEW020-002 | unit — 저장소 |
| REQ-PREVIEW020-002 | AC-PREVIEW020-001, AC-PREVIEW020-008 | unit 표 + 수동 M-1·M-2 |
| REQ-PREVIEW020-003 | AC-PREVIEW020-005, AC-PREVIEW020-006, AC-PREVIEW020-008 | unit — 뷰어·헤더 + 수동 M-1~M-3 |
| REQ-PREVIEW020-004 | AC-PREVIEW020-003 | unit — 재수화 |
| REQ-PREVIEW020-005 | AC-PREVIEW020-004, AC-PREVIEW020-008 | unit 표 + 수동 M-4 |
| REQ-PREVIEW020-006 | AC-PREVIEW020-002, AC-PREVIEW020-008 | unit + 수동 M-1~M-3 |
| REQ-PREVIEW020-007 | AC-PREVIEW020-007 | unit + git diff + grep |
| REQ-PREVIEW020-008 | AC-PREVIEW020-006 | unit — 순수 헬퍼 표 + 헤더 `title` 속성 |

## §5 Constraints, Assumptions, and Supersession

### SPEC-PREVIEW-019의 부분 개정 (명시)

- 이 SPEC은 SPEC-PREVIEW-019 REQ-PREVIEW019-001 중 다음을 대체한다: (a) "기본값은 `'crisp'`이다", (b) "저장된 상태에 값이 없거나 허용 밖이면 `'crisp'`을 쓴다", (c) "`setHtmlRenderMode`가 허용 밖 값을 받으면 `'crisp'`으로 정규화한다". 대체 후 규칙은 REQ-PREVIEW020-001·004다(미선택은 `null`, 기본값은 OS가 결정).
- 019의 나머지 REQ(002~012)와 AC는 그대로 유효하다. 019 문서는 이 SPEC에서 수정하지 않는다. 019 AC-PREVIEW019-001은 이 SPEC 병합 후 위 세 항목에 한해 AC-PREVIEW020-002·003이 정본이다.
- 이 개정으로 바뀌는 기존 단위 테스트는 다음과 같다(정본 목록과 새 기대값은 plan.md M5):
  - `src/test/uiStoreRenderMode.test.ts` — 기본값 단언, 재수화 표(부재·`null`·허용 밖 값의 기대), `setHtmlRenderMode` 허용 밖 값 정규화.
  - `src/test/uiStore.test.ts` — 영속 버전 단언(`version === 1` → 2), 버전 0 `migrate` 케이스(이제 `htmlRenderMode: null` 단계도 거침), 버전 1 `migrate` "그대로 반환" 케이스(REQ-005·AC-004에 맞게 재작성).
  - `src/test/HeaderRenderMode.test.tsx` — 시드와 플랫폼 모의.

### Windows 기본 보안 자세 — SPEC-SEC-001 증거

Windows 기본이 원본 보기(`sandbox="allow-scripts allow-same-origin"`, asset iframe)로 돌아간다. 이는 019 이전(004/018) 자세와 같고 이 SPEC이 권한을 새로 넓히지 않는다. 이 자세에 대한 앱 명령 방어는 SPEC-SEC-001(`.moai/specs/SPEC-SEC-001-app-command-acl/spec.md`, `status: completed`, version 0.2.4)이 맡으며, 그래서 `depends_on`에 둔다. 인용한 내용은 그 문서를 이 개정 때 다시 읽어 확인했다.

- **방어 내용**: SEC-001은 앱 ACL 매니페스트를 도입하고 `main` capability에만 앱 명령 26개를 허용한다. asset 출처(`asset://` / `http://asset.localhost`) 프레임이 보내는 앱 명령은 ACL 단계에서 거부되며 명령 본문은 실행되지 않는다(SEC-001 REQ-SEC001-004, Overview). 거부는 프레임이 다른 asset 경로 문서로 이동한 뒤에도 유지되어야 한다(M-2b).
- **Windows 실기기 결과**: SEC-001 HISTORY 0.2.4에 Windows M-2·M-2b·M-3 PASS가 기록되어 있다. 근거는 **사용자 보고("윈도우에서도 문제 없다")이며 캡처가 없다.** 우리가 관찰하거나 측정한 값이 아니다.
- **이 증거가 말하지 않는 것**: (1) SEC-001의 M-1 기준선(적용 전 탐침)은 미수행이라, ACL 이전에 이 호출이 실제로 성공했는지는 실기기에서 재현된 적이 없다(SEC-001은 원래 소스 판독에 근거한 가설이었다). (2) 거부 판정은 SEC-001이 정한 탐침 범위에 한한다. 이 SPEC은 그 범위를 넓히거나 재평가하지 않는다.
- **이 SPEC의 확인**: 별도 보안 점검을 더하지 않는다. 수동 M-1(Windows 원본 보기)을 수행하는 김에 앱 명령 호출이 거부된 채로 남는지를 SEC-001 탐침으로 한 번 더 보고 싶다면 사용자가 정한다(§7-4).

### 가정 (측정하지 않은 것)

- **Windows 원본 보기의 선명도**: 사용자 관찰이며 측정값이 아니다. M-1이 확인한다.
- **Linux 기본값 `'crisp'`**: Linux 웹뷰(WebKitGTK)는 WebKit이라 WKWebView와 같은 래스터 동작을 보일 것이라는 가정이다. 측정하지 않았고 Linux 빌드는 배포하지 않는다.
- **플랫폼 문자열**: `detectPlatform()`(018)이 `navigator.userAgentData?.platform || navigator.platform`을 돌려준다. WebView2에서 `"Windows"`/`"Win32"`, WKWebView에서 `"MacIntel"`이 나온다고 가정한다. M-1·M-2가 실기기에서 확인한다.

### 알려진 결과 (수용된 비용)

- v0.20.0을 쓰던 Windows 사용자는 업그레이드 후 원본 보기로 열린다(의도한 결과). 그중 선명 모드를 일부러 골랐던 사용자는 그 선택을 잃고 토글을 다시 눌러야 한다. 이 소실은 **조용하고(알림 없음) 한 번뿐**이다.
- 수용 근거는 **측정하지 않은 가정**이다: v0.20.0은 이 SPEC과 같은 날(2026-11-09) 만든 빌드이고 게시 전·직후라 선명 모드를 일부러 골라 둔 사용자는 적다고 본다. 설치 수나 토글 사용 이력은 측정하지 않았다. 다른 근거는 저장된 `'crisp'`을 보존하면 기존 Windows 사용자 전원에게 이 수정이 효과가 없다는 점이다. 보존안(저장된 `'crisp'` 유지)은 plan.md R2에 대안으로 남아 있고, 사용자가 반대하면 REQ-005만 바뀐다.
- macOS 사용자는 업그레이드 후 변화가 없다(저장된 `'crisp'`은 `null`이 되지만 해소 결과가 `'crisp'`). 일부러 `'original'`을 골랐던 사용자는 그대로 유지된다.
- 한 번 토글을 누르면 그 선택이 영속되어 OS 기본값을 다시 따르는 길은 저장소를 직접 지우는 것뿐이다(UI는 범위 밖).

## §6 Exclusions (What NOT to Build)

### Out of Scope — Mermaid 사전 렌더·스크립트 페이지 자동 전환

- HTML 안의 Mermaid를 앱이 미리 그림으로 바꾸는 기능(백로그 t2)은 만들지 않는다.
- 스크립트가 있는 페이지를 감지해 자동으로 원본 보기로 바꾸는 기능은 만들지 않는다.

### Out of Scope — 렌더 경로와 보안 구성

- 선명 모드·원본 보기의 렌더 내용, 앱 셸 CSP, `sandbox` 값, 019 REQ-007 폴백은 바꾸지 않는다.
- Rust 코드와 `index.html`은 건드리지 않는다.

### Out of Scope — UI 문구와 새 설정 UI

- 토글 `title`(툴팁)을 뺀 헤더 문구(`aria-label`, 버튼 글자)는 바꾸지 않는다. 툴팁은 REQ-PREVIEW020-008이 OS별로 바로잡으므로 더 이상 제외 항목이 아니다.
- "OS 기본값으로 되돌리기" 버튼이나 렌더 모드 설정 화면은 만들지 않는다.

### Out of Scope — 배율·다른 뷰어

- 018 배율 단계·컨트롤·단축키·`htmlZoom` 영속화, 휠·핀치, 다른 파일 종류의 뷰어는 바꾸지 않는다.

## §7 Open Questions

1. **macOS 기본값 재검토**: macOS에서 선명 모드가 스크립트 페이지(Mermaid)를 텍스트로 보이게 하는 문제는 그대로 남는다. 선명도 때문에 macOS는 `'crisp'`을 유지하지만, 스크립트 페이지 자동 원본 전환(범위 밖)이 생기면 기본값 정책을 다시 볼 수 있다.
2. **Linux 미검증**: 기본값 `'crisp'`은 가정이다. Linux 빌드를 배포하게 되면 WebKitGTK에서 원본 보기의 100% 초과 선명도를 측정해야 한다.
3. **툴팁 불일치 (해소됨 — REQ-PREVIEW020-008)**: 토글 `title`이 "선명 모드(기본)", "원본 보기에서는 100% 초과 확대가 흐릿합니다"라고 안내해 Windows 기본에서는 틀린 안내였다. 사용자 결정(2026-11-09)에 따라 이 SPEC에서 OS별 문구로 고친다. 열린 질문이 아니다. 번호는 다른 절의 참조(§7-4 등)를 위해 유지한다.
4. **Windows 기본 보안 자세 (증거로 정리됨)**: 열린 질문이 아니라 §5 "Windows 기본 보안 자세 — SPEC-SEC-001 증거"에 정리했다. 남은 선택 하나: 수동 M-1 때 SEC-001 탐침을 원본 보기에서 한 번 더 돌릴지는 사용자가 정한다. 돌리지 않아도 SEC-001의 Windows M-2 결과(사용자 보고, 캡처 없음)가 이미 있다.
5. **019 문서 역참조**: 019의 HISTORY에 "REQ-001 기본값은 SPEC-PREVIEW-020이 개정"이라는 한 줄을 sync 단계에서 달지 여부.

## §8 References

- 구현 계획·위험·기존 테스트 갱신 목록: `plan.md`. 진행 기록: `progress.md`.
- 의존: `.moai/specs/SPEC-SEC-001-app-command-acl/`(completed, 앱 명령 ACL — Windows 기본 보안 자세의 근거, §5).
- 선행: `.moai/specs/SPEC-PREVIEW-019-html-crisp-zoom/`(completed, REQ-001 부분 개정), `.moai/specs/SPEC-PREVIEW-018-html-preview-zoom/`(`detectPlatform`·`isMacPlatform`·배율).
- 코드 앵커(main `ce18e23` 기준): `src/store/uiStore.ts`(`HtmlRenderMode`, `normalizeHtmlRenderMode`, persist `version: 1`, `merge`, `migrate`), `src/lib/preview/htmlZoom.ts`(`detectPlatform`, `isMacPlatform`), `src/components/layout/Header.tsx`(토글, `isMacPlatform(detectPlatform())`), `src/components/preview/HtmlFileViewer.tsx`(`useUIStore(state => state.htmlRenderMode)` 분기).
