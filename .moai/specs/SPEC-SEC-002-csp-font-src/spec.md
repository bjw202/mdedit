---
id: SPEC-SEC-002
title: "KaTeX 글꼴 CSP 거부 해소 — 글꼴 자산을 data URI로 넣지 않기"
version: "0.1.0"
status: draft
created: 2026-11-09
updated: 2026-11-09
author: jw (bjw202)
priority: Medium
phase: "v0.20.1 target"
module: "vite.config.ts"
lifecycle: spec-anchored
tags: "security, csp, vite, katex, font, build"
tier: S
---

# SPEC-SEC-002: KaTeX 글꼴 CSP 거부 해소

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-09 | jw | 최초 작성. 근거: 백로그 카드 t1, `.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/checks.md` M1b 5번. 두 해결안(CSP `font-src` 추가 / Vite 인라인 기준 조정) 비교 후 후자 채택. REQ 4 / AC 4 + 수동 1. |

## Overview

### 배경과 문제

- 앱 셸 메타 CSP(`index.html:7`)에는 `font-src`가 없다. 그래서 글꼴은 `default-src 'self' tauri: asset: http://asset.localhost https://asset.localhost`를 따르며, 여기에는 `data:`가 없다(직접 읽음).
- `src/main.tsx:6`이 `katex/dist/katex.min.css`를 정적으로 가져온다. Vite 5.4.21의 기본 인라인 기준은 4,096바이트 미만이다(`build.assetsInlineLimit` 기본값). KaTeX 0.16.44의 글꼴 파일 60개 가운데 이 기준보다 작은 것은 `KaTeX_Size3-Regular.woff2`(3,624B) 하나뿐이다(`node_modules/katex/dist/fonts/`를 크기순으로 직접 확인). 이 파일만 CSS 안에 `data:font/woff2;base64,…`로 들어간다.
- 그 결과 해당 글꼴이 필요할 때 CSP가 `data:` 글꼴을 거부해 콘솔 오류가 나고, 브라우저는 같은 `@font-face`의 다음 후보인 `.woff` 파일로 대신 받는다. 수식은 표시되지만 콘솔 오류가 매번 남는다. SPEC-PREVIEW-015 M1b 5번이 같은 원인을 앱 프로덕션 빌드 CSS에서 확인했다(그 기록을 인용, 이 SPEC 작성 중 앱 전체 빌드는 다시 하지 않음 — 아래 측정 참고).
- **이번 plan 단계 측정**(scratchpad 실험, `katex.min.css` 하나만 넣은 최소 Vite 프로젝트, 앱과 같은 Vite 5.4.21):
  - 기본 설정: CSS 안 `data:font/woff2` 1건, 출력 woff2 파일 19개, CSS 29,265B.
  - 글꼴 확장자만 인라인 금지(`assetsInlineLimit` 함수, 아래 B안): `data:font` 0건, woff2 파일 20개(`KaTeX_Size3-Regular-*.woff2` 1개 포함), CSS 24,452B.
  - 앱 전체 빌드는 이 worktree에 `node_modules`가 없고 상위의 주 체크아웃 `node_modules`에 `pele`가 없어 실패했다(`Rollup failed to resolve import "pele"`). run 단계에서 `npm ci` 뒤 다시 잰다(AC-002).
- Vite 개발 서버는 자산을 인라인하지 않고 경로로 내보낸다(Vite 동작, 미측정). 그래서 개발 모드에서는 이 오류가 없을 것으로 추정하며, run 단계가 전·후를 함께 기록한다(M-1).

### 두 해결안 비교

| 기준 | A안: CSP에 `font-src 'self' data:` 추가 | B안(채택): 글꼴 파일만 인라인 금지 |
|---|---|---|
| 바뀌는 파일 | `index.html`, `src/test/htmlSrcdocCsp.test.ts`(기준 집합에 `font-src` 추가 필요 — 지금 테스트는 지시어 이름 집합이 기준과 같은지 검사한다) | `vite.config.ts`, 새 테스트 1개 |
| 보안 범위 | 앱 문서 전체에 `data:` 글꼴 허용. 선명 모드 HTML 미리보기(`srcdoc`, `HtmlFileViewer.tsx:154-158`)는 자기 CSP 메타를 넣지 않으므로(`htmlSrcdoc.ts` 전체에 CSP 문자열 없음, 직접 확인) 부모 문서의 정책을 물려받는다(HTML 명세의 srcdoc 정책 컨테이너 상속 — 이 SPEC에서 실측하지 않음). 그러면 사용자가 연 HTML도 `data:` 글꼴을 쓸 수 있게 넓어진다. | CSP 문자열 변화 없음. 앱 셸과 srcdoc 프레임의 실효 정책이 모두 그대로다. |
| 번들 영향 | 없음(CSS 그대로) | CSS −4,813B(base64 제거), 별도 woff2 파일 +3,624B, 첫 수식 렌더 때 로컬 요청 1건 추가 |
| 재발 | 다른 작은 글꼴도 인라인되어 계속 허용됨 | 앞으로 4KB 미만 글꼴이 추가돼도 인라인되지 않음 |
| 다른 자산 | 영향 없음 | 글꼴 외 자산(이미지 등)은 기본 4,096B 기준 유지(함수가 `undefined`를 돌려주면 Vite가 기본값을 쓴다 — `vite/dist/node/chunks/dep-BK3b2jBa.js:20478-20482`에서 확인) |

**결정: B안.** 이유는 (1) 최소 권한 원칙 — 정책을 넓히지 않고 원인(빌드가 만든 data URI)을 없앤다, (2) srcdoc 미리보기 프레임의 정책이 넓어지지 않는다, (3) CSP 기준 테스트를 고칠 필요가 없어 "CSP가 그대로다"가 기존 테스트로 증명된다. A안의 실제 위험은 낮다(글꼴은 수동 자원이고 `data:`는 외부 전송 경로가 아니다). 그래도 얻는 것이 없는 확장이므로 기각한다.

### 이 SPEC이 해결하는 것 / 하지 않는 것

- 해결: 배포 빌드에서 KaTeX 글꼴이 CSP에 거부되는 콘솔 오류를 없앤다. `KaTeX_Size3-Regular.woff2`는 별도 파일로 나와 `'self'`로 허용된다.
- 하지 않음: CSP 변경, KaTeX 버전 변경, 수식 렌더 방식 변경. 아래 Exclusions 참고.

## Requirements (GEARS)

### REQ-SEC002-001: 글꼴 자산 인라인 금지 (Ubiquitous)
The build **shall** emit every font asset (`.woff2`, `.woff`, `.ttf`, `.otf`, `.eot`, with or without a query string) as a separate file and never inline it as a `data:` URI, regardless of its size.

### REQ-SEC002-002: 다른 자산의 인라인 기준 유지 (Ubiquitous)
The build **shall** keep Vite's default inline threshold (4,096 bytes) for all non-font assets.

### REQ-SEC002-003: CSP 무변경 (Ubiquitous)
The app shell meta CSP in `index.html` and the srcdoc assembly in `src/lib/preview/htmlSrcdoc.ts` **shall** remain byte-identical to the base commit, and `src/test/htmlSrcdocCsp.test.ts` **shall** pass without modification.

### REQ-SEC002-004: 글꼴 거부 오류 없음 (Event-driven)
**When** a KaTeX expression that needs the `KaTeX_Size3` face is rendered in a release build or in the dev server, the app **shall** produce no CSP font-load refusal in the console, and the `.woff2` face **shall** be the one loaded.

## Acceptance Criteria

판정 규칙: 모든 명령은 worktree 루트에서 실행한다. run 단계 첫 작업은 `npm ci`(이 worktree에 `node_modules`가 없다)다. `$OUT`은 저장소 밖 임시 폴더(예: `"$TMPDIR/sec002-dist"`)이며, 저장소의 `dist/`를 덮지 않는다.

| REQ | AC |
|-----|----|
| REQ-SEC002-001 | AC-001, AC-002 |
| REQ-SEC002-002 | AC-001 |
| REQ-SEC002-003 | AC-003 |
| REQ-SEC002-004 | AC-002, M-1 |
| (전체) | AC-004 |

### AC-001: 인라인 판정 함수 단위 테스트 (REQ-001, 002)
- Given `vite.config.ts`가 `build.assetsInlineLimit`에 함수를 넘기고, 그 함수를 이름 있는 export로 내보낸다(테스트가 같은 함수를 import한다).
- When 새 테스트 `src/test/viteFontInline.test.ts`가 함수에 경로를 넣으면
- Then `…/KaTeX_Size3-Regular.woff2`, `a.woff`, `a.ttf`, `a.otf`, `a.eot`, `a.woff2?v=1`, 대문자 `A.WOFF2` → `false`. `a.png`, `a.svg`, `a.css` → `undefined`(Vite 기본 4,096B 기준 적용).
- 명령: `npx vitest run src/test/viteFontInline.test.ts` → PASS = 종료 코드 0. RED 증거: 함수가 없는 상태에서 먼저 실행해 실패 출력을 progress.md에 붙인다.

### AC-002: 배포 빌드 산출물 (REQ-001, 004)
- 수정 전(main 그대로)과 수정 후에 각각 `npx vite build --outDir "$OUT" --emptyOutDir`를 실행하고 아래 세 값을 progress.md에 전·후로 붙인다.
  - `grep -o 'data:font/[a-z0-9]*' "$OUT"/assets/*.css | wc -l` → 수정 전 1 이상(재현), **수정 후 0**
  - `ls "$OUT/assets" | grep -c '^KaTeX_Size3-Regular-.*\.woff2$'` → 수정 전 0, **수정 후 1**
  - `grep -o 'KaTeX_Size3-Regular-[A-Za-z0-9_-]*\.woff2' "$OUT"/assets/*.css | sort -u` → 수정 후 출력된 파일 이름이 위 `ls` 결과와 같다(R-1, 참조 깨짐 없음)
- 참고: CSS 크기도 전·후로 적는다(기대: 약 4.8KB 감소, 판정 기준 아님).

### AC-003: CSP 무변경 (REQ-003)
- `git diff --exit-code "$(git merge-base origin/main HEAD)" -- index.html src/lib/preview/htmlSrcdoc.ts src/test/htmlSrcdocCsp.test.ts` → PASS = 종료 코드 0
- `npx vitest run src/test/htmlSrcdocCsp.test.ts` → PASS = 종료 코드 0(기준 집합 무수정 상태에서 통과)

### AC-004: 정적 검사 (전체)
- `npx tsc -p tsconfig.node.json --noEmit` → 종료 코드 0(`vite.config.ts`는 `tsconfig.json`이 아니라 이 설정에 속한다 — plan 단계에서 수정 전 기준 종료 코드 0 확인함)
- `npm run typecheck` → 종료 코드 0
- `npx eslint vite.config.ts src/test/viteFontInline.test.ts --max-warnings 0` → 종료 코드 0

### M-1: 실제 앱 콘솔 확인 (REQ-004, 수동, macOS)
- 문서에 `$$\bigg( \frac{a}{b} \bigg)$$`(KaTeX는 `\bigg`에 Size3 글꼴을 쓴다)를 넣고 미리보기를 연다.
- (a) 개발 모드 `npm run dev`, (b) 배포 빌드 앱(`npm run build` 산출물)에서 각각 Web Inspector 콘솔을 본다. 배포 빌드 앱의 Web Inspector는 Tauri `devtools` 기능 없이는 열리지 않을 수 있다. 그때는 (b)를 `npx vite preview`(같은 `dist/`, 같은 메타 CSP)를 Safari로 여는 것으로 대신하고 그렇게 했다고 적는다.
- PASS = 수정 후 두 경우 모두 `Refused to load the font` 류 CSP 메시지 0건, 네트워크(또는 `document.fonts`)에서 `KaTeX_Size3` woff2가 로드됨. 수정 전 같은 절차의 결과도 적는다(개발 모드는 전·후 모두 0건일 수 있음, R-3).
- Windows는 같은 빌드 산출물을 쓰므로 AC-002로 갈음한다(WebView2에서 별도 확인하지 않음 — 잔여 위험으로 기록).

## Exclusions (Out of Scope)

- CSP에 `font-src` 지시어를 추가하는 것(A안, 기각).
- SPEC-PREVIEW-015 M1b 5번의 "mermaid 수식 렌더(webkit)에서만 위반 이벤트 5건". 다른 원인이며 카드 t1 범위가 아니다. 지금도 남아 있는지 이 SPEC에서 확인하지 않았다.
- HTML 내보내기에 KaTeX CSS·글꼴을 넣는 문제(M1b 3번).
- `src-tauri/tauri.conf.json`의 `"csp": null`(Tauri가 정책을 주입하지 않고 메타 CSP만 쓰는 현재 구조) 변경.

## Risks

- R-1: Vite가 글꼴을 별도 파일로 내보내도 해시 파일 이름이 CSS의 `url()`과 맞지 않으면 글꼴이 404가 된다. 대응: AC-002가 빌드 산출물에서 CSS의 `KaTeX_Size3` 참조와 실제 파일 존재를 함께 확인한다.
- R-2: srcdoc 정책 상속은 명세 근거이고 실측하지 않았다. B안은 CSP를 바꾸지 않으므로 이 가설이 틀려도 결과가 달라지지 않는다.
- R-3: 개발 모드에서 오류가 원래 없을 가능성이 높다(추정). 그러면 M-1의 개발 모드 항목은 "전·후 모두 0건"으로 기록된다. 그 자체로 통과다.

## References

- 백로그 카드 t1 (코디네이터 브리프 원문 인용)
- `.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/checks.md` M1b 5번
- `index.html:7`, `src/main.tsx:6`, `vite.config.ts`, `src/test/htmlSrcdocCsp.test.ts`, `src/lib/preview/htmlSrcdoc.ts`, `src/components/preview/HtmlFileViewer.tsx:154-158`
- SPEC-PREVIEW-019(srcdoc 선명 모드와 CSP 해시), SPEC-SEC-001(앱 명령 ACL)
