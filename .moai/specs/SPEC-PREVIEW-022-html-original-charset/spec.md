---
id: SPEC-PREVIEW-022
title: "HTML 원본 보기 문자 인코딩 — meta charset 없는 UTF-8 HTML의 한글 깨짐 수정"
version: "0.1.0"
status: draft
created: 2026-11-09
updated: 2026-11-09
author: jw (bjw202)
priority: High
phase: "v0.21.0 target"
module: "src-tauri/"
lifecycle: spec-anchored
tags: "preview, html, charset, encoding, asset-protocol, tauri, windows, security"
tier: M
depends_on: [SPEC-SEC-001]
related_specs: [SPEC-PREVIEW-004, SPEC-PREVIEW-018, SPEC-PREVIEW-019, SPEC-PREVIEW-020]
---

# SPEC-PREVIEW-022: HTML 원본 보기 문자 인코딩

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-09 | jw | 최초 작성. 계기: 백로그 카드 t3 — "HTML 원본 보기(asset iframe)에서 `<meta charset>` 없는 UTF-8 HTML의 한글이 깨짐. asset 프로토콜 응답에 charset이 없어 WebView가 다른 인코딩으로 해석. SPEC-PREVIEW-020으로 Windows 기본값이 원본 보기가 되어 노출 증가. 선명 모드(srcdoc)는 영향 없음." 원인은 소스 판독으로 확인했고 실기기 관찰은 아직 없다(research.md §1, §5). 코디네이터 브리프는 "앱이 `asset` 스킴을 재등록해 내장 핸들러를 대체"하는 안(research.md 안 A)을 권장했으나, 작성 중 소스를 다시 읽어 **그 안이 SPEC-SEC-001의 거부 판정을 무너뜨린다**는 근거를 찾았다(research.md §3). 그래서 요구사항은 설계와 무관한 관찰 가능한 동작으로 쓰고, 설계 선택은 plan.md §D-1의 열린 결정으로 남겼다. 이 문서의 권장안은 tauri 크레이트를 로컬 패치하는 안 X다. 코디네이터 세션이 §3의 근거(`webview/mod.rs:1698-1720`, `:1769-1775`)를 다시 읽어 안 A 기각을 확정했다. 남은 결정은 X와 X2 중 패치 전달 방식뿐이다(구현 승인 때 결정). |

## §1 Overview

### 배경

- 원본 보기(SPEC-PREVIEW-004, 019, 020)는 HTML 파일을 `convertFileSrc`로 만든 asset 주소(`asset://localhost/…`, Windows는 `http://asset.localhost/…`)에 iframe으로 띄운다. 파일을 있는 그대로 보여 주는 경로다.
- 선명 모드(019)는 파일을 텍스트로 읽어 `srcdoc`으로 넣으므로 문자 인코딩 문제가 없다.
- SPEC-PREVIEW-020 이후 Windows 기본값이 원본 보기가 되었다. 그래서 `<meta charset>`이 없는 UTF-8 HTML을 Windows에서 열면 기본 경로에서 한글이 깨질 수 있다.

### 원인 (소스 판독, 실기기 미관찰)

- tauri 2.10.3의 내장 asset 핸들러는 `Content-Type`을 `text/html`로만 보낸다. charset 매개변수가 없다(research.md §1-1, §1-2).
- wry는 그 헤더를 macOS(WKWebView)와 Windows(WebView2) 양쪽에 그대로 넘긴다(research.md §1-3).
- HTML 인코딩 판별 순서(BOM → 전송 계층 charset → `<meta>` 사전 탐색 → 구현 기본값)상, BOM과 `<meta>`가 없는 UTF-8 파일은 WebView 기본값(로캘에 따른 레거시 인코딩)으로 해석되어 한글이 깨진다. 카드 증상과 일치한다.
- **확인되지 않은 것**: 실제 응답 헤더를 기기에서 캡처한 적이 없다. run 단계 첫 작업이 이를 캡처하고 깨짐을 재현한다(REQ-PREVIEW022-011).

### 해법의 형태 (설계 비의존)

- 응답 MIME이 `text/html`이고 파일 전체가 올바른 UTF-8일 때만 `Content-Type: text/html; charset=utf-8`을 보낸다. 그 밖의 모든 응답은 지금과 바이트 단위로 같다.
- asset 출처, 프런트엔드, iframe `sandbox`, CSP, capability는 바꾸지 않는다. asset 출처 프레임이 앱 명령·플러그인 명령을 호출하지 못한다는 SPEC-SEC-001의 성질은 유지되어야 한다.

### 설계 선택 상태

- 이 SPEC은 구현 방식을 정하지 않은 채 동작만 규정한다. 후보와 판단은 research.md §3·§4, 열린 결정은 plan.md §D-1이다.
- **권장안 X**: tauri 2.10.3 크레이트를 저장소에 들여와(`[patch.crates-io]`) 내장 asset 핸들러의 한 곳만 고친다. 앱이 URI 스킴을 등록하지 않으므로 asset 출처는 계속 원격으로 분류된다.
- **기각한 안 A(브리프 권장)**: 앱이 `Builder`에 `asset` 스킴을 등록하면, tauri는 앱이 등록한 스킴을 로컬 출처로 판정한다(`webview/mod.rs:1680-1720`). 그러면 asset iframe이 `main` capability를 얻어 앱 명령 26개와 `opener:allow-open-path`(`**`)를 호출할 수 있게 된다. SPEC-SEC-001이 막은 것을 다시 여는 셈이다(research.md §3).

### Tier 판단

- **Tier M.** 새로 쓰는 코드는 판정 함수와 핸들러 한 곳의 수정, 테스트 1개 파일로 약 100~200줄이다. 들여오는 tauri 소스(143개 파일, 1.6 MB)는 기계적 복사라 규모 판단에서 뺐다. Tier M으로 두는 이유는 보안 경계(SPEC-SEC-001)에 닿고, 의존 크레이트를 패치하는 구조 결정이 있으며, 두 OS의 실기기 확인이 필요하기 때문이다. 마일스톤은 6개(M0~M5)지만 새로 쓰는 파일이 10개 미만이라 Tier L 조건(3개 이상 마일스톤 AND 10개 이상 파일)에 해당하지 않는다.

## §2 Requirements (GEARS)

#### REQ-PREVIEW022-001: UTF-8 HTML에 charset을 밝힌다 (Event-driven)

- **When** asset 핸들러가 Range 헤더 없는 GET 요청에 응답하고, 응답 MIME의 본질(essence)이 `text/html`이며, 파일 내용 전체가 올바른 UTF-8이면, the asset 핸들러 shall `Content-Type`을 정확히 `text/html; charset=utf-8`로 보낸다.

#### REQ-PREVIEW022-002: 판정은 파일 전체로 한다 (Ubiquitous)

- The UTF-8 판정 shall 파일의 모든 바이트를 대상으로 한다. MIME 판별용으로 읽는 앞부분(8,192바이트)만으로 판정하지 않는다. 사유: 앞 8 KB가 ASCII이고 그 뒤가 EUC-KR인 파일을 UTF-8로 선언하면 뒷부분이 깨진다.
- The UTF-8 BOM으로 시작하는 파일 shall 올바른 UTF-8로 본다(BOM이 헤더보다 우선하므로 결과가 같다). 빈 파일도 올바른 UTF-8로 본다.

#### REQ-PREVIEW022-003: UTF-8이 아닌 HTML은 지금과 같다 (Unwanted)

- The asset 핸들러 shall not 올바른 UTF-8이 아닌 HTML(예: `<meta>` 유무와 상관없는 EUC-KR, BOM 있는 UTF-16)에 charset 매개변수를 붙인다. 이때 `Content-Type`은 `text/html`이며 지금의 내장 핸들러 응답과 바이트 단위로 같다.
- 사유: 전송 계층 charset은 `<meta>`보다 우선한다. EUC-KR 파일에 `charset=utf-8`을 선언하면 `<meta charset="euc-kr">`로 바르게 보이던 파일이 깨진다.

#### REQ-PREVIEW022-004: Range·HEAD 요청은 지금과 같다 (State-driven)

- **While** 요청에 Range 헤더가 있거나 메서드가 HEAD인 동안, the asset 핸들러 shall MIME이 `text/html`이어도 charset을 붙이지 않고 지금의 동작(단일 범위 응답의 `Content-Type`, 다중 범위 응답의 `multipart/byteranges` 및 각 부분의 `Content-Type` 줄)을 그대로 유지한다.
- 사유: 이 경우 핸들러는 파일 전체를 읽지 않으므로 REQ-002의 판정을 할 수 없다. 판정만을 위해 추가로 파일을 읽지 않는다.

#### REQ-PREVIEW022-005: HTML이 아닌 응답은 바이트 단위로 같다 (Unwanted)

- The asset 핸들러 shall not HTML이 아닌 응답(이미지, CSS, JS, SVG, 미디어, 그 밖의 모든 MIME)의 상태 코드, 헤더 이름·값·순서, 본문을 바꾼다. Range·다중 범위 응답도 포함한다.

#### REQ-PREVIEW022-006: 범위 검사와 오류 경로를 유지한다 (Ubiquitous)

- The asset 핸들러 shall 지금과 같은 조건에서 같은 응답을 낸다: 경로가 안전하지 않으면 403, asset 범위(scope) 밖이면 403, 파일이 없으면 404, OS 권한이 없으면 403, 그 밖의 읽기 오류는 500(본문 `text/plain`). 모든 응답의 `Access-Control-Allow-Origin` 값도 같다.

#### REQ-PREVIEW022-007: asset 출처 프레임의 명령 호출은 계속 거부된다 (Unwanted + Event-driven)

- The 앱 shall not asset 출처(`asset://localhost`, `http://asset.localhost`)를 로컬 출처로 분류되게 만드는 변경을 한다. 따라서 the 앱 shall not `tauri::Builder`나 앱이 만든 플러그인으로 URI 스킴 핸들러를 등록한다. 사유: tauri 2.10.3은 앱·플러그인이 등록한 스킴을 로컬 출처로 판정한다(research.md §3).
- **When** asset 출처 iframe 안의 스크립트가 앱 명령(예: `read_file`, `ai_policy_status`)이나 플러그인 명령(예: `plugin:app|version`)을 호출하면, the 런타임 shall 그 호출을 거부하고 명령 본문을 실행하지 않는다. 프레임이 다른 asset 경로 문서로 이동한 뒤에도 같다(SPEC-SEC-001 REQ-SEC001-004 유지).

#### REQ-PREVIEW022-008: 출처·프런트엔드·보안 구성은 바꾸지 않는다 (Unwanted)

- The 이 SPEC shall not 바꾼다: asset 주소 형태와 출처, `convertFileSrc` 사용, `src/` 아래 프런트엔드 소스(`HtmlFileViewer.tsx` 포함), iframe `sandbox` 값(원본 `allow-scripts allow-same-origin`, 선명 `allow-scripts`), 앱 CSP(`null`), `src-tauri/capabilities/`, `tauri.conf.json`, 선명 모드 동작.

#### REQ-PREVIEW022-009: charset 판정은 순수 함수다 (Ubiquitous)

- The charset 판정 shall 입력 두 개(MIME 문자열, 파일 전체 바이트 또는 "없음")만으로 결과 `Content-Type` 문자열을 정하는 순수 함수로 분리된다. 파일·네트워크·전역 상태에 접근하지 않는다. Range·HEAD처럼 전체 바이트가 없는 경우는 "없음"으로 넘겨 MIME을 그대로 돌려받는다.
- The 이 함수 shall 로컬 `cargo test`로 검증된다. CI는 `cargo test`를 실행하지 않는다(SPEC-SEC-001 범위 밖 항목 유지).

#### REQ-PREVIEW022-010: 상류 차이를 추적한다 (Event-driven)

- **When** `src-tauri/Cargo.lock`의 `tauri` 버전이 고친 핸들러의 기준 버전(2.10.3)과 다르거나, 패치가 적용되지 않은 상태(`tauri`가 레지스트리 출처)이면, the 로컬 `cargo test` shall 실패하고 실패 메시지에 다시 맞추는 절차(research.md §6)의 위치를 적는다.
- 사유: tauri를 올리면 고친 코드가 조용히 사라지거나, 상류 수정이 고친 사본에 반영되지 않는다.

#### REQ-PREVIEW022-011: 재현을 먼저 한다 (Event-driven, run 첫 마일스톤)

- **When** run 단계가 시작되면, the 구현자 shall 코드를 바꾸기 전에 현재 빌드에서 재현 fixture를 원본 보기로 열어, Windows와 macOS 각각 (a) 실제 응답 `Content-Type`, (b) `document.characterSet`, (c) 한글 깨짐 여부를 기록한다.
- **When** 기록된 `Content-Type`에 이미 charset이 있거나 한글이 깨지지 않으면, the 구현자 shall 구현을 멈추고 차단 보고를 돌려준다(원인 가설이 틀렸다는 뜻이다).

#### REQ-PREVIEW022-012: 고친 핸들러가 실제로 응답함을 보인다 (Event-driven)

- **When** 수정 후 빌드에서 같은 fixture를 원본 보기로 열면, the 기록 shall 두 OS 모두에서 응답 `Content-Type`이 `text/html; charset=utf-8`이고 `document.characterSet`이 `UTF-8`임을 보인다. 이 기록이 고친 코드가 실제 요청을 처리한다는 런타임 증거다(정적 검사만으로는 패치 미적용을 놓칠 수 있다).

## §3 Acceptance Criteria

Tier M이므로 수용 기준은 `acceptance.md`에 둔다(AC-PREVIEW022-001 ~ AC-PREVIEW022-011).

## §4 REQ → AC 대응

| REQ | AC | 검증 기법 |
|-----|-----|----------|
| REQ-PREVIEW022-001 | AC-001, AC-009 | unit 표 + 실기기 |
| REQ-PREVIEW022-002 | AC-001, AC-009 | unit 표(8 KB 뒤 비ASCII fixture) + 실기기 |
| REQ-PREVIEW022-003 | AC-001, AC-009 | unit 표(EUC-KR, UTF-16) + 실기기 |
| REQ-PREVIEW022-004 | AC-002, AC-004, AC-010 | unit + 상류 diff 허용 목록 + 실기기(미디어 Range) |
| REQ-PREVIEW022-005 | AC-004, AC-010 | 상류 diff 허용 목록 + 실기기 |
| REQ-PREVIEW022-006 | AC-004 | 상류 diff 허용 목록 |
| REQ-PREVIEW022-007 | AC-005, AC-011 | grep + 실기기 탐침 |
| REQ-PREVIEW022-008 | AC-006, AC-007 | git diff 이름 목록 + 회귀 스위트 |
| REQ-PREVIEW022-009 | AC-001, AC-002 | unit |
| REQ-PREVIEW022-010 | AC-003 | unit(RED 증거 포함) |
| REQ-PREVIEW022-011 | AC-008 | 실기기 수동 |
| REQ-PREVIEW022-012 | AC-009 | 실기기 수동 |

## §5 Constraints and Assumptions

### SPEC-SEC-001과의 관계

- SPEC-SEC-001(completed, 0.2.4)은 asset 출처 프레임이 보내는 앱 명령이 ACL 단계에서 거부됨을 Windows·macOS에서 확인했다(Windows는 사용자 보고, 캡처 없음). 그 판정은 asset 출처가 원격(Remote)으로 분류된다는 전제에 선다.
- SEC-001 본문도 같은 한계를 적어 두었다: "로컬 출처로 분류되는 프레임(예: 사용자 정의 스킴을 `Builder`에 등록한 경우)의 호출은 `main` capability가 그대로 적용되므로 막지 못한다." REQ-PREVIEW022-007은 이 전제를 깨지 않겠다는 요구다.

### 가정 (측정하지 않은 것)

- **원인**: 소스 판독에 근거한다. 기기 캡처는 M0(REQ-011)이 처음 한다.
- **WebView 기본 인코딩**: Windows는 시스템 로캘에 따라 windows-1252 또는 EUC-KR 계열, macOS는 WebKit 기본값으로 떨어진다고 본다. M0이 `document.characterSet`으로 확인한다.
- **iframe 문서 요청에는 Range가 없다**: WebView가 HTML 문서 자체를 Range로 요청하면 REQ-004에 따라 charset이 붙지 않아 수정 효과가 없다. M0·M2의 헤더 기록이 이를 드러낸다.

### 알려진 한계 (수용)

- 전송 계층 charset이 `<meta>`보다 우선한다. 그래서 (1) ASCII로만 된 파일이 `<meta charset="euc-kr">`을 선언했으면 이제 `document.characterSet`이 `UTF-8`로 보고된다. 글자는 똑같이 보인다. (2) 바이트는 올바른 UTF-8인데 `<meta>`가 레거시 인코딩을 선언한 파일은 UTF-8로 해석된다. 레거시 인코딩 텍스트가 우연히 올바른 UTF-8이 되는 일은 드물다고 본다(측정하지 않음).
- 문서가 UTF-8로 해석되면 charset을 밝히지 않은 하위 CSS·클래식 스크립트도 문서 인코딩을 따르므로 UTF-8로 읽힌다. 헤더는 그대로지만 해석 결과는 달라질 수 있다(대개 개선). REQ-005는 헤더와 본문에 대한 요구다.
- 확장자가 알 수 없는 파일은 tauri가 `text/html`로 떨어뜨린다(`mime_type.rs:72`). 그런 파일이 올바른 UTF-8이면 charset이 붙는다. 해롭지 않다고 본다.

## §6 Exclusions (What NOT to Build)

### Out of Scope — meta 없는 EUC-KR HTML

- `<meta charset>`도 BOM도 없는 EUC-KR(또는 그 밖의 레거시 인코딩) HTML의 표시는 바꾸지 않는다. 지금처럼 WebView 기본값으로 해석된다.
- 사유: 레거시 인코딩을 추측하는 것은 이 SPEC의 범위를 넘고, 틀리게 추측하면 REQ-003이 지키는 파일을 깨뜨린다.

### Out of Scope — 프런트엔드·보안 구성 변경

- `HtmlFileViewer.tsx`, `convertFileSrc` 사용, iframe `sandbox`, CSP, capability, `tauri.conf.json`은 바꾸지 않는다.
- HTML 텍스트를 고쳐 쓰거나 `<meta charset>`을 끼워 넣는 일은 하지 않는다(원본 보기는 파일을 있는 그대로 보여 주는 경로다).

### Out of Scope — 사용자 파일 변경

- 사용자 파일에 BOM을 붙이거나 인코딩을 바꾸지 않는다. 같은 폴더에 임시 사본을 만들지도 않는다.

### Out of Scope — 다른 텍스트 MIME과 상류 기여

- `text/css`, `text/javascript`, `text/plain`, `image/svg+xml`에는 charset을 붙이지 않는다.
- tauri 상류에 이슈나 PR을 올리는 일은 이 SPEC에 넣지 않는다(plan.md §D-3).
- `cargo test`를 CI에 추가하지 않는다.

## §7 Open Questions

1. **패치 전달 방식 (run 시작 전 구현 승인 때 결정)**: 권장안 X(tauri 소스를 저장소에 들여와 `path`로 패치, 기본값)와 변형 X2(사용자 GitHub 포크를 `git`+`rev`로 패치) 중 하나를 사용자가 고른다. 요구사항·수용 기준은 어느 쪽이든 같다. 상세는 plan.md §D-1, research.md §4.
2. **안 A 기각 확정**: 앱 `asset` 스킴 재등록(안 A)은 SEC-001을 깨므로 기각한다(research.md §3, plan.md §D-2). 근거는 소스 판독이며 코디네이터 세션이 재확인했다. 이 SPEC의 요구사항(REQ-007)은 앱이 스킴을 등록하지 않는 것을 전제로 한다.
3. **macOS 검증**: macOS 기본은 선명 모드라 원본 보기를 토글로 골라 확인한다. 사용자가 macOS 확인을 생략하려면 정해야 한다.

## §8 References

- 조사 근거(file:line), 대안 평가, 상류 재동기화 규칙: `research.md`. 구현 계획: `plan.md`. 수용 기준: `acceptance.md`. 진행 기록: `progress.md`.
- 의존: `.moai/specs/SPEC-SEC-001-app-command-acl/` (앱 명령 ACL, asset 출처 거부).
- 관련: SPEC-PREVIEW-004(HTML 원본 보기 도입), 018(배율), 019(선명 모드·원본 보기 토글), 020(OS별 기본값 — Windows 원본 보기).
- 코드 앵커(main `cdaadcf` 기준): `src-tauri/Cargo.toml`(`tauri` features `protocol-asset`), `src-tauri/tauri.conf.json`(`csp: null`, `assetProtocol`), `src-tauri/src/lib.rs`(`Builder`, URI 스킴 등록 없음), `src-tauri/src/commands/directory_ops.rs:136-144`(`register_asset_scope`), `src/components/preview/HtmlFileViewer.tsx`(`convertFileSrc`, `sandbox`).
