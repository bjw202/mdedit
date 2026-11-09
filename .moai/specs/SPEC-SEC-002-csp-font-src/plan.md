# SPEC-SEC-002 구현 계획

## A. 사전 확인 사항 (plan 단계에서 읽거나 잰 사실)

- `index.html:7` 메타 CSP 지시어: `default-src`, `style-src`, `script-src`(해시 1개), `img-src`(`data:` 있음), `connect-src`, `frame-src`. `font-src` 없음.
- `src-tauri/tauri.conf.json:22` `"csp": null` — Tauri는 정책을 주입하지 않는다. 메타 CSP가 유일한 정책이다.
- `src/test/htmlSrcdocCsp.test.ts`는 지시어 **이름 집합**이 기준과 같은지 검사한다. 그래서 A안(`font-src` 추가)은 이 테스트의 `BASELINE`도 고쳐야 한다. B안은 고칠 필요가 없다.
- `src/lib/preview/htmlSrcdoc.ts`(98줄)의 `buildSrcdoc`(L73-98)은 `<base>`·`<style>`·`<script>`만 주입하고 CSP `<meta>`는 넣지 않는다(L3·L5 주석에 CSP라는 말만 나온다).
- `.eslintrc.cjs` `ignorePatterns`에 `*.config.ts`가 있어 `vite.config.ts`는 eslint 대상이 아니다(1차 감사 D-1 실측). 앱 코드에 `?inline` import가 없다(`grep -rn "?inline" src index.html` 출력 없음). 선명 모드 iframe은 `sandbox="allow-scripts"` + `srcDoc`(`HtmlFileViewer.tsx:154-158`)이다.
- `vite.config.ts`: `build` 블록 없음. `defineConfig(async () => ({…}))` 형태. `tsconfig.node.json`(composite)이 이 파일만 포함하며 `npx tsc -p tsconfig.node.json --noEmit`은 수정 전 종료 코드 0(직접 실행).
- Vite 5.4.21 `shouldInline`(`dep-BK3b2jBa.js:20473-20488`): `assetsInlineLimit`가 함수면 그 반환값이 `null`/`undefined`가 아닐 때 그대로 쓰고, 아니면 기본 4,096을 쓴다.
- KaTeX 0.16.44 글꼴 60개 중 4,096B 미만은 `KaTeX_Size3-Regular.woff2`(3,624B) 하나.
- 최소 Vite 프로젝트 실험(scratchpad, 커밋 안 함): 기본 설정 `data:font/woff2` 1건·woff2 19개·CSS 29,265B → 글꼴 인라인 금지 함수 적용 시 0건·20개·24,452B.
- 앱 전체 빌드는 이 worktree에서 아직 못 돌렸다(`node_modules` 없음, 상위 주 체크아웃 `node_modules`에 `pele` 없음). run 단계 M1에서 `npm ci` 후 측정.

## B. 접근 방식

1. **결정 — B안**: `vite.config.ts`에 글꼴 확장자 판정 함수를 두고 `build.assetsInlineLimit`에 연결한다. 글꼴이면 `false`, 아니면 `undefined`. 비교 근거는 spec.md "두 해결안 비교" 표.
2. **함수 위치·테스트 방식**: 판정 함수는 `vite.config.ts` 안에 두고 export하지 않는다. 테스트는 `vite.config.ts`를 정적 import하지 않고 `resolveConfig`(Vite 공개 API)로 설정을 읽어 `config.build.assetsInlineLimit`를 꺼낸다. 이렇게 하면 (a) `tsconfig.json`이 composite 프로젝트 파일을 끌어오지 않아 `npm run typecheck`가 안전하고(1차 감사 D-2), (b) 함수가 실제로 설정에 연결됐는지도 함께 증명된다. 테스트 파일 맨 위에 `// @vitest-environment node`를 둔다(기본 환경은 jsdom). 공용 `src/test/setup.ts`가 node 환경에서도 먼저 실행되므로, 그 안의 `window.matchMedia`(L6)·`navigator.clipboard`(L20) 블록을 `if (typeof window !== 'undefined')`로 감싼다(L31 `Element` 블록과 같은 방식, 2차 감사 D-11). `resolveConfig`가 테스트 환경에서 실패하면 progress.md에 출력을 붙이고 blocker로 보고한다(SPEC 본문 수정은 plan 단계로 되돌린다).
3. **정규식**: `/\.(woff2?|ttf|otf|eot)(\?.*)?$/i`. 쿼리 문자열과 대문자 확장자를 허용한다. 실험에서 쓴 것과 같다.
4. **주석**: 판정 함수 위에 `@MX:NOTE`로 "index.html 메타 CSP에 font-src가 없어 data: 글꼴이 막힌다 — 글꼴은 항상 파일로 낸다. CSP에 data:를 더하는 대신 이 방식을 쓴다(SPEC-SEC-002)"를 한국어로 적는다(`code_comments: ko`).
5. **CSP·srcdoc 파일은 건드리지 않는다**(REQ-003, AC-003).

## C. 마일스톤

- **M0 — setup.ts 가드**: `src/test/setup.ts` 두 블록을 가드하고, `npx vitest run src/test/htmlSrcdocCsp.test.ts`(jsdom)가 그대로 통과함을 확인한다.
- **M1 — 기준 측정(RED)**: `npm ci` → main 그대로 `npx vite build --outDir "$TMPDIR/sec002-before" --emptyOutDir` → AC-002의 세 값을 progress.md §E.2에 붙인다(재현: `data:font` 1 이상). 새 테스트 `src/test/viteFontInline.test.ts`를 먼저 쓰고 실패 출력을 붙인다.
- **M2 — 구현(GREEN)**: `vite.config.ts`에 판정 함수 + `build.assetsInlineLimit` 연결 + `@MX:NOTE`. AC-001 통과. `npm run typecheck`를 이 시점에 한 번 돌려 D-2 가설(TS6305)이 해당 없음을 확인한다.
- **M3 — 검증**: AC-002(수정 후 빌드), AC-003, AC-004 실행 결과를 progress.md에 붙인다. M-1은 macOS에서 수행하고 결과(또는 `vite preview` 대체 여부)를 적는다.
- 커밋: 마일스톤마다 한국어 메시지, `SPEC-SEC-002`와 카드 `t1`을 적고 `🗿 MoAI <email@mo.ai.kr>`로 끝낸다. 명시 경로로만 stage한다.

## D. 열린 결정 (코디네이터 확인 권장)

- D-1: M-1에서 배포 빌드 앱의 Web Inspector가 열리지 않을 때 `vite preview` + Safari로 대신하는 것을 수용 기준으로 인정할지. 기본안: 인정한다(같은 `dist/`, 같은 메타 CSP).
- D-2: Windows(WebView2) 실기기 확인을 생략하고 AC-002 빌드 산출물로 갈음하는 것. 기본안: 생략한다(빌드 산출물이 OS와 무관하다).

## E. 위험 관리 요약

spec.md Risks R-1~R-3 참고. R-1(파일 이름 참조 깨짐)은 AC-002 셋째 명령이 잡는다.

## F. 범위·규모

- run 단계가 바꾸는 파일: `vite.config.ts`(수정, 약 10줄), `src/test/viteFontInline.test.ts`(신규, 약 30줄), `src/test/setup.ts`(가드 2곳, 약 4줄 — 모든 테스트가 쓰는 공용 파일이므로 다른 카드와 겹치는지 확인 필요), `.moai/specs/SPEC-SEC-002-csp-font-src/progress.md`(증거 기록).
- 바꾸지 않는 파일(다른 카드와 겹침 확인용): `index.html`, `src-tauri/tauri.conf.json`, `src/lib/preview/**`, `src/components/preview/**`, `src/lib/diagram/**`, `src/test/htmlSrcdocCsp.test.ts`.
- Tier S. REQ 4 / AC 4 + 수동 1.
