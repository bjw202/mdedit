---
id: SPEC-SEC-002
title: "KaTeX 글꼴 CSP 거부 해소 — 글꼴 자산을 data URI로 넣지 않기"
version: "0.1.2"
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
| 0.1.2 | 2026-11-09 | jw | plan-audit 2차(`.moai/reports/plan-audit/SPEC-SEC-002-review-2.md`, FAIL 0.80) 반영: D-11 node 환경 테스트를 위해 `src/test/setup.ts`의 `window`·`navigator` 블록 가드를 AC-001 선행 조건으로 추가, D-12 woff2 확인 시점을 수식 렌더 뒤로, D-13 `.woff` 판정을 끝 일치로. REQ/AC 번호 변경 없음. |
| 0.1.1 | 2026-11-09 | jw | plan-audit 1차(`.moai/reports/plan-audit/SPEC-SEC-002-review-1.md`, FAIL 0.67) D-1~D-10 반영: AC-004 eslint 대상에서 `vite.config.ts` 제외, AC-001을 `resolveConfig` 방식으로(정적 import 제거), Out of Scope H3 제목, REQ-003·AC-003 경로에 `tauri.conf.json`·`HtmlFileViewer.tsx` 추가, AC-002 참조 일치를 `diff`로, REQ-001 예외 명시, 배경에 `load-only` 거부 반영, M-1 로드 확인을 resource timing으로, srcdoc 문구 정정. REQ/AC 번호 변경 없음. |
| 0.1.0 | 2026-11-09 | jw | 최초 작성. 근거: 백로그 카드 t1, `.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/checks.md` M1b 5번. 두 해결안(CSP `font-src` 추가 / Vite 인라인 기준 조정) 비교 후 후자 채택. REQ 4 / AC 4 + 수동 1. |

## Overview

### 배경과 문제

- 앱 셸 메타 CSP(`index.html:7`)에는 `font-src`가 없다. 그래서 글꼴은 `default-src 'self' tauri: asset: http://asset.localhost https://asset.localhost`를 따르며, 여기에는 `data:`가 없다(직접 읽음).
- `src/main.tsx:6`이 `katex/dist/katex.min.css`를 정적으로 가져온다. Vite 5.4.21의 기본 인라인 기준은 4,096바이트 미만이다(`build.assetsInlineLimit` 기본값). KaTeX 0.16.44의 글꼴 파일 60개 가운데 이 기준보다 작은 것은 `KaTeX_Size3-Regular.woff2`(3,624B) 하나뿐이다(`node_modules/katex/dist/fonts/`를 크기순으로 직접 확인). 이 파일만 CSS 안에 `data:font/woff2;base64,…`로 들어간다.
- 그 결과 CSP가 `data:` 글꼴을 거부해 콘솔 오류가 나고, 브라우저는 같은 `@font-face`의 다음 후보인 `.woff` 파일로 대신 받는다. 수식은 표시되지만 콘솔 오류가 남는다. SPEC-PREVIEW-015 M1b 5번(`checks.md:76`)은 이 거부 1건이 **수식을 렌더하지 않은 `load-only` 시나리오에도** 나타났다고 기록했다. 그러니 오류는 수식 렌더 때만이 아니라 페이지를 불러오기만 해도 날 수 있다(왜 불러오기만 해도 나는지는 이 SPEC에서 확인하지 않음). 같은 기록이 앱 프로덕션 빌드 CSS에서도 같은 data URI를 확인했다(인용, 이 SPEC 작성 중 앱 전체 빌드는 다시 하지 않음 — 아래 측정 참고).
- **이번 plan 단계 측정**(scratchpad 실험, `katex.min.css` 하나만 넣은 최소 Vite 프로젝트, 앱과 같은 Vite 5.4.21):
  - 기본 설정: CSS 안 `data:font/woff2` 1건, 출력 woff2 파일 19개, CSS 29,265B.
  - 글꼴 확장자만 인라인 금지(`assetsInlineLimit` 함수, 아래 B안): `data:font` 0건, woff2 파일 20개(`KaTeX_Size3-Regular-*.woff2` 1개 포함), CSS 24,452B.
  - 앱 전체 빌드는 이 worktree에 `node_modules`가 없고 상위의 주 체크아웃 `node_modules`에 `pele`가 없어 실패했다(`Rollup failed to resolve import "pele"`). run 단계에서 `npm ci` 뒤 다시 잰다(AC-002).
- Vite 개발 서버는 자산을 인라인하지 않고 경로로 내보낸다(Vite 동작, 미측정). 그래서 개발 모드에서는 이 오류가 없을 것으로 추정하며, run 단계가 전·후를 함께 기록한다(M-1).

### 두 해결안 비교

| 기준 | A안: CSP에 `font-src 'self' data:` 추가 | B안(채택): 글꼴 파일만 인라인 금지 |
|---|---|---|
| 바뀌는 파일 | `index.html`, `src/test/htmlSrcdocCsp.test.ts`(기준 집합에 `font-src` 추가 필요 — 지금 테스트는 지시어 이름 집합이 기준과 같은지 검사한다) | `vite.config.ts`, 새 테스트 1개 |
| 보안 범위 | 앱 문서 전체에 `data:` 글꼴 허용. 선명 모드 HTML 미리보기(`srcdoc`, `HtmlFileViewer.tsx:154-158`)는 자기 CSP 메타를 넣지 않으므로(`htmlSrcdoc.ts:73-98`의 `buildSrcdoc`은 `<base>`·`<style>`·`<script>`만 넣고 CSP `<meta>`는 넣지 않는다 — L3·L5 주석에 CSP라는 말이 나오지만 정책 주입은 아니다, 직접 확인) 부모 문서의 정책을 물려받는다(HTML 명세의 srcdoc 정책 컨테이너 상속 — 이 SPEC에서 실측하지 않음). 그러면 사용자가 연 HTML도 `data:` 글꼴을 쓸 수 있게 넓어진다. | CSP 문자열 변화 없음. 앱 셸과 srcdoc 프레임의 실효 정책이 모두 그대로다. |
| 번들 영향 | 없음(CSS 그대로) | CSS −4,813B(base64 제거), 별도 woff2 파일 +3,624B, 첫 수식 렌더 때 로컬 요청 1건 추가 |
| 재발 | 다른 작은 글꼴도 인라인되어 계속 허용됨 | 앞으로 4KB 미만 글꼴이 추가돼도 인라인되지 않음 |
| 다른 자산 | 영향 없음 | 글꼴 외 자산(이미지 등)은 기본 4,096B 기준 유지(함수가 `undefined`를 돌려주면 Vite가 기본값을 쓴다 — `vite/dist/node/chunks/dep-BK3b2jBa.js:20478-20482`에서 확인) |

**결정: B안.** 이유는 (1) 최소 권한 원칙 — 정책을 넓히지 않고 원인(빌드가 만든 data URI)을 없앤다, (2) srcdoc 미리보기 프레임의 정책이 넓어지지 않는다, (3) CSP 기준 테스트를 고칠 필요가 없어 "CSP가 그대로다"가 기존 테스트로 증명된다. A안의 실제 위험은 낮다(글꼴은 수동 자원이고 `data:`는 외부 전송 경로가 아니다). 그래도 얻는 것이 없는 확장이므로 기각한다.

### 이 SPEC이 해결하는 것 / 하지 않는 것

- 해결: 배포 빌드에서 KaTeX 글꼴이 CSP에 거부되는 콘솔 오류를 없앤다. `KaTeX_Size3-Regular.woff2`는 별도 파일로 나와 `'self'`로 허용된다.
- 하지 않음: CSP 변경, KaTeX 버전 변경, 수식 렌더 방식 변경. 아래 Exclusions 참고.

## Requirements (GEARS)

### REQ-SEC002-001: 글꼴 자산 인라인 금지 (Ubiquitous)
The build **shall** emit every font asset (`.woff2`, `.woff`, `.ttf`, `.otf`, `.eot`, with or without a query string) that reaches Vite's inline-limit decision as a separate file and never inline it as a `data:` URI, regardless of its size. (Vite decides `build.lib` builds, entry modules, and explicit `?inline` imports before consulting `assetsInlineLimit`; the app uses none of these — `grep -rn "?inline" src index.html` returns nothing, checked in plan phase.)

### REQ-SEC002-002: 다른 자산의 인라인 기준 유지 (Ubiquitous)
The build **shall** keep Vite's default inline threshold (4,096 bytes) for all non-font assets.

### REQ-SEC002-003: CSP 무변경 (Ubiquitous)
The files that determine the effective policy of the app shell and of the preview frames — `index.html` (meta CSP), `src-tauri/tauri.conf.json` (`"csp": null`), `src/lib/preview/htmlSrcdoc.ts` (srcdoc assembly), and `src/components/preview/HtmlFileViewer.tsx` (iframe `sandbox` / `srcDoc`) — **shall** remain byte-identical to the base commit, and `src/test/htmlSrcdocCsp.test.ts` **shall** pass without modification.

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
- Given `vite.config.ts`가 `build.assetsInlineLimit`에 함수를 넘긴다.
- When 새 테스트 `src/test/viteFontInline.test.ts`(맨 위 `// @vitest-environment node`)가 `vite.config.ts`를 정적 import하지 **않고** `import { resolveConfig } from 'vite'`로 `await resolveConfig({ configFile: path.resolve(process.cwd(), 'vite.config.ts') }, 'build')`를 불러, 결과의 `config.build.assetsInlineLimit`를 꺼내면
- Then 그 값은 함수다(`typeof === 'function'` — 설정에 실제로 연결됐다는 증거). 함수에 `(경로, Buffer.alloc(10))`을 넣으면 `…/KaTeX_Size3-Regular.woff2`, `a.woff`, `a.ttf`, `a.otf`, `a.eot`, `a.woff2?v=1`, 대문자 `A.WOFF2` → `false`. `a.png`, `a.svg`, `a.css` → `undefined`(Vite 기본 4,096B 기준 적용).
- 선행 조건 — 공용 설정 파일 가드: `vite.config.ts`의 `test.setupFiles`가 node 환경 테스트에서도 `src/test/setup.ts`를 먼저 실행하는데, `setup.ts:6`(`window.matchMedia`)과 `setup.ts:20`(`navigator.clipboard`)이 가드 없이 `window`·`navigator`를 쓴다. 그래서 그대로 두면 node 환경 테스트는 `ReferenceError: window is not defined`로 시작도 못 한다(2차 감사 D-11, `--environment node`로 재현). run 단계는 이 두 블록을 `if (typeof window !== 'undefined') { … }`로 감싼다(L31의 `Element` 블록이 이미 쓰는 방식과 같다). jsdom 환경에서는 동작이 바뀌지 않으며, 이는 AC-003의 jsdom 테스트 실행과 기존 테스트로 확인된다.
- node 환경을 고른 이유: esbuild(설정 파일 번들링)는 jsdom 환경에서 `Uint8Array` 판정 문제로 실패하는 일이 알려져 있어(미측정), 설정 로딩 테스트는 node 환경이 안전하다.
- 정적 import를 쓰지 않는 이유: `vite.config.ts`는 composite 프로젝트 `tsconfig.node.json`에 속해, `src/` 테스트가 정적으로 import하면 `npm run typecheck`(`tsconfig.json`)가 TS6305 류 오류를 낼 수 있다(1차 감사 D-2, 미재현).
- 명령: `npx vitest run src/test/viteFontInline.test.ts` → PASS = 종료 코드 0. RED 증거: 함수가 없는 상태에서 먼저 실행해 실패 출력을 progress.md에 붙인다.

### AC-002: 배포 빌드 산출물 (REQ-001, 004)
- 수정 전(main 그대로)과 수정 후에 각각 `npx vite build --outDir "$OUT" --emptyOutDir`를 실행하고 아래 세 값을 progress.md에 전·후로 붙인다.
  - `grep -o 'data:font/[a-z0-9]*' "$OUT"/assets/*.css | wc -l` → 수정 전 1 이상(재현), **수정 후 0**
  - `ls "$OUT/assets" | grep -c '^KaTeX_Size3-Regular-.*\.woff2$'` → 수정 전 0, **수정 후 1**
  - 참조 일치(R-1): `diff <(ls "$OUT/assets" | grep '^KaTeX_Size3-Regular-.*\.woff2$') <(grep -oh 'KaTeX_Size3-Regular-[A-Za-z0-9_-]*\.woff2' "$OUT"/assets/*.css | sort -u)` → **수정 후 종료 코드 0이고, 두 목록 모두 비어 있지 않다**(앞 명령의 1과 함께 판정)
- 참고: CSS 크기도 전·후로 적는다(기대: 약 4.8KB 감소, 판정 기준 아님).

### AC-003: CSP 무변경 (REQ-003)
- `git diff --exit-code "$(git merge-base origin/main HEAD)" -- index.html src-tauri/tauri.conf.json src/lib/preview/htmlSrcdoc.ts src/components/preview/HtmlFileViewer.tsx src/test/htmlSrcdocCsp.test.ts` → PASS = 종료 코드 0
- `npx vitest run src/test/htmlSrcdocCsp.test.ts` → PASS = 종료 코드 0(기준 집합 무수정 상태에서 통과). 이 테스트는 jsdom 환경에서 돈다. 그래서 `setup.ts` 가드(AC-001 선행 조건)가 jsdom 쪽 설정을 깨지 않았는지도 함께 확인한다.

### AC-004: 정적 검사 (전체)
- `npx tsc -p tsconfig.node.json --noEmit` → 종료 코드 0(`vite.config.ts`는 `tsconfig.json`이 아니라 이 설정에 속한다 — plan 단계에서 수정 전 기준 종료 코드 0 확인함)
- `npm run typecheck` → 종료 코드 0
- `npx eslint src/test/viteFontInline.test.ts --max-warnings 0` → 종료 코드 0. `vite.config.ts`는 넣지 않는다: `.eslintrc.cjs`의 `ignorePatterns`가 `*.config.ts`를 무시해, 파일을 직접 지정하면 수정 전에도 종료 코드 1이 난다(1차 감사 D-1, 실측). `vite.config.ts`는 위 `tsc -p tsconfig.node.json`이 검사한다.

### M-1: 실제 앱 콘솔 확인 (REQ-004, 수동, macOS)
- 문서에 `$$\bigg( \frac{a}{b} \bigg)$$`(KaTeX는 `\bigg`에 Size3 글꼴을 쓴다)를 넣고 미리보기를 연다.
- (a) 개발 모드 `npm run dev`, (b) 배포 빌드 앱(`npm run build` 산출물)에서 각각 Web Inspector 콘솔을 본다. 배포 빌드 앱의 Web Inspector는 Tauri `devtools` 기능 없이는 열리지 않을 수 있다. 그때는 (b)를 `npx vite preview`(같은 `dist/`, 같은 메타 CSP)를 Safari로 여는 것으로 대신하고 그렇게 했다고 적는다.
- 콘솔은 두 시점에 기록한다: (i) 앱을 불러온 직후(수식 렌더 전 — M1b `load-only`에서도 거부가 있었다), (ii) 위 수식을 렌더한 뒤.
- PASS = 수정 후 두 경우·두 시점(i·ii) 모두 `Refused to load the font` 류 CSP 메시지 0건. 그리고 **(ii) 수식 렌더 뒤에** Network 탭 또는 콘솔에서 `performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('KaTeX_Size3'))`를 실행하면, `.woff2`로 끝나는 항목이 1개 이상이고 `.woff`로 끝나는 항목(`/\.woff$/`, `.woff2`는 해당 없음)은 0개다. 렌더 전에는 글꼴을 아직 받지 않았을 수 있으므로 이 확인은 렌더 뒤에만 한다. `document.fonts`는 어느 파일이 로드됐는지 알려주지 않으므로 쓰지 않는다. 수정 전 같은 절차의 결과도 적는다(개발 모드는 전·후 모두 0건일 수 있음, R-3).
- Windows는 같은 빌드 산출물을 쓰므로 AC-002로 갈음한다(WebView2에서 별도 확인하지 않음 — 잔여 위험으로 기록).

## Exclusions (Out of Scope)

### Out of Scope — CSP 지시어 추가
- CSP에 `font-src` 지시어를 추가하지 않는다(A안, 기각).

### Out of Scope — mermaid 수식 렌더 위반 5건
- SPEC-PREVIEW-015 M1b 5번의 "mermaid 수식 렌더(webkit)에서만 위반 이벤트 5건"은 다루지 않는다. 원인을 확인하지 않았고, 카드 t1 범위가 아니며, 지금도 남아 있는지 이 SPEC에서 확인하지 않았다.

### Out of Scope — HTML 내보내기의 KaTeX 자산
- HTML 내보내기에 KaTeX CSS·글꼴을 넣는 문제(M1b 3번)는 다루지 않는다.

### Out of Scope — Tauri 정책 주입 구조
- `src-tauri/tauri.conf.json`의 `"csp": null`(Tauri가 정책을 주입하지 않고 메타 CSP만 쓰는 현재 구조)은 바꾸지 않는다.

## Risks

- R-1: Vite가 글꼴을 별도 파일로 내보내도 해시 파일 이름이 CSS의 `url()`과 맞지 않으면 글꼴이 404가 된다. 대응: AC-002가 빌드 산출물에서 CSS의 `KaTeX_Size3` 참조와 실제 파일 존재를 함께 확인한다.
- R-2: srcdoc 정책 상속은 명세 근거이고 실측하지 않았다. B안은 CSP를 바꾸지 않으므로 이 가설이 틀려도 결과가 달라지지 않는다.
- R-3: 개발 모드에서 오류가 원래 없을 가능성이 높다(추정). 그러면 M-1의 개발 모드 항목은 "전·후 모두 0건"으로 기록된다. 그 자체로 통과다.

## References

- 백로그 카드 t1 (코디네이터 브리프 원문 인용)
- `.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/checks.md` M1b 5번
- `index.html:7`, `src/main.tsx:6`, `vite.config.ts`, `src/test/htmlSrcdocCsp.test.ts`, `src/lib/preview/htmlSrcdoc.ts`, `src/components/preview/HtmlFileViewer.tsx:154-158`
- SPEC-PREVIEW-019(srcdoc 선명 모드와 CSP 해시), SPEC-SEC-001(앱 명령 ACL)
