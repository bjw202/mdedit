# SPEC-SEC-002 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-09T14:35:22+0900
- 백로그 카드: t1
- worktree: `.claude/worktrees/csp-font-src`, 브랜치 `WT-csp-font-src` (base origin/main cdaadcf)
- plan-audit: 1차 FAIL 0.67 → 2차 FAIL 0.80 → 3차 **PASS 0.92** (Tier S 기준 0.75). 보고서 `.moai/reports/plan-audit/SPEC-SEC-002-review-{1,2,3}.md`(로컬, gitignore 여부는 저장소 설정을 따름).
- 남은 MINOR: D-14(AC-004의 추적표 "(전체)" 매핑, 의도적으로 유지). D-15는 plan.md M0에 반영.
- run 단계로 넘기는 미확인 사항: `npm run typecheck`가 TS6305 없이 통과하는지(plan.md M2), node 환경 테스트가 `setup.ts` 가드 뒤에 실제로 시작되는지(AC-001), 앱 전체 빌드 전·후 수치(AC-002).

## §E.2 Run-phase Evidence

- 기준 커밋: 코드 `fd3a872`(M1-M2), `d35a1bb`(M0). base origin/main `cdaadcf`. 브랜치 `WT-csp-font-src`. 측정은 모두 이 worktree에서, 2026-11-09.
- 방법론: TDD (RED → GREEN). 앱 전체 빌드는 `npm ci` 후 처음 성공했다.

### M0 — setup.ts 가드
- 변경: `src/test/setup.ts` 두 블록(`window.matchMedia` 정의, `navigator.clipboard` 정의)을 `typeof window/navigator !== 'undefined'` 가드로 감쌌다. 한국어 주석 1줄 추가. 다른 줄 변경 없음(들여쓰기만 바뀐 블록 포함 +22/−17).
- 다른 카드(t2·t3) 겹침 확인용 정확한 위치: 변경 전 기준 L4-L16(matchMedia 블록, 앞에 주석 1줄 추가)과 L20-L25(clipboard 블록). L1-L3, L18-L19 주석, L27-L33(`Element.scrollIntoView` 블록)은 그대로다. 같은 줄을 건드리는 카드와 충돌하면 이 두 블록만 다시 적용하면 된다.
- `npx vitest run src/test/htmlSrcdocCsp.test.ts src/test/useTheme.test.ts` → `Test Files 2 passed (2)`, `Tests 13 passed (13)` (jsdom에서 matchMedia 모의 객체 정상: useTheme 7건 통과).

### M1 — 기준 측정 (main 그대로, 수정 전)
명령: `npx vite build --outDir <scratchpad>/before --emptyOutDir` → 종료 코드 0.
- `grep -o 'data:font/[a-z0-9]*' assets/*.css | wc -l` → **1**
- `ls assets | grep -c '^KaTeX_Size3-Regular-.*\.woff2$'` → **0**
- CSS 크기 `cat assets/*.css | wc -c` → **79006** B (`index-DCyVhain.css`), assets 파일 수 358

RED 테스트: `src/test/viteFontInline.test.ts` 작성 후, `vite.config.ts` 수정 전 실행.
`npx vitest run src/test/viteFontInline.test.ts` →
```
 FAIL  ... > 글꼴 /x/KaTeX_Size3-Regular.woff2 는 크기와 무관하게 인라인하지 않는다(false)
 ... (글꼴 7건·비글꼴 3건 모두 FAIL)
TypeError: fn is not a function
 Test Files  1 failed (1)
      Tests  11 failed (11)
```
(첫 케이스 "assetsInlineLimit 가 함수로 연결"도 함께 실패. node 환경에서 setup.ts가 정상 시작하고 `resolveConfig`가 설정을 읽는 것까지 확인됨 — 실패 원인은 함수 미연결이다.)

### M2 — GREEN
- 변경: `vite.config.ts`에 `FONT_ASSET_RE = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i`, `assetsInlineLimit(file)`(글꼴이면 `false`, 아니면 `undefined`), `build: { assetsInlineLimit }`, 한국어 `@MX:NOTE` 추가.
- `npx vitest run src/test/viteFontInline.test.ts` → `Test Files 1 passed (1)`, `Tests 11 passed (11)`.
- `npm run typecheck` → 종료 코드 0 (TS6305 없음 — plan D-2 가설은 해당 없음).

### M3 — 검증 (수정 후)
명령: `npx vite build --outDir <scratchpad>/after --emptyOutDir` → 종료 코드 0.

| 항목 | 수정 전 | 수정 후 |
|---|---|---|
| `data:font` 개수 (AC-002 ①) | 1 | **0** |
| `KaTeX_Size3-Regular-*.woff2` 파일 수 (AC-002 ②) | 0 | **1** (`KaTeX_Size3-Regular-gV2CO0n9.woff2`, 3,624 B) |
| CSS 참조 일치 `diff <(ls …) <(grep -oh …)` (AC-002 ③) | — | 종료 코드 **0**, 두 목록 모두 비어 있지 않음(파일 1개, CSS 참조 1개) |
| CSS 크기 | 79006 B | 74193 B (−4813 B, 계획 예상 약 4.8KB와 일치) |
| assets 파일 수 | 358 | 359 |

AC별:
- AC-001: PASS — `viteFontInline.test.ts` 11/11.
- AC-002: PASS — 위 표.
- AC-003: PASS — `git diff --exit-code cdaadcfca16d6458f6440a142e790af4d1812ba3 -- index.html src-tauri/tauri.conf.json src/lib/preview/htmlSrcdoc.ts src/components/preview/HtmlFileViewer.tsx src/test/htmlSrcdocCsp.test.ts` → 종료 코드 0; `npx vitest run src/test/htmlSrcdocCsp.test.ts` → 6/6 통과.
- AC-004: PASS — `npx tsc -p tsconfig.node.json --noEmit` 종료 코드 0; `npm run typecheck` 종료 코드 0; `npx eslint src/test/viteFontInline.test.ts src/test/setup.ts --max-warnings 0` 종료 코드 0.
- 전체: `npx vitest run --dir src` → 종료 코드 0, `Test Files 117 passed (117)`, `Tests 1978 passed (1978)`.
- REQ-002(다른 자산 기준 유지): 단위 테스트(png·svg·css → `undefined`)로 확인. 빌드 산출물에서 이미지 인라인 수는 전·후 비교하지 않았다(Gap).

### 건너뛴 항목 (사용자 결정)
- D-2: Windows(WebView2) 실기기 확인은 **생략**한다. 이유: 이번 변경은 빌드 설정(Vite 산출물)이라 OS와 무관하고, AC-002가 같은 산출물을 검증한다. 잔여 위험으로 남긴다.

## §E.3 Run-phase Audit-Ready Signal

- run_status: audit-ready (자동 검증 완료, 수동 M-1 대기)
- run_complete_at: 2026-11-09
- 커밋: `d35a1bb` (M0), `fd3a872` (M1-M2), 이 기록 커밋
- 대기 중: **M-1 (사용자, macOS)** — 아래 절차.

### M-1 수동 확인 절차 (대기)
D-1 결정: 배포 빌드 앱의 Web Inspector가 열리지 않으면 `vite preview` + Safari로 대신하는 것을 인정한다. 단, 이 경우 progress.md에 "패키징된 앱의 콘솔이 아니라 대체 확인"이라고 적는다.
1. `$$\bigg( \frac{a}{b} \bigg)$$` 가 든 문서를 만든다(KaTeX는 `\bigg`에 Size3 글꼴 사용).
2. (a) `npm run dev` 로 연 앱, (b) 배포 빌드 앱의 Web Inspector 콘솔을 본다. (b)가 열리지 않으면 `npm run build` 후 `npx vite preview` 를 Safari로 열어 대신한다.
3. (i) 앱을 불러온 직후, (ii) 수식을 렌더한 뒤 두 시점에 콘솔을 기록한다. 기대: `Refused to load the font` 류 메시지 0건.
4. (ii) 시점에 콘솔에서 `performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('KaTeX_Size3'))` 실행. 기대: `.woff2` 로 끝나는 항목 1개 이상, `/\.woff$/` 에 걸리는 항목 0개.
5. 수정 전(main) 같은 절차의 결과도 적는다(개발 모드는 전·후 모두 0건일 수 있음).
- 결과: (미기록)

## §E.4 Sync-phase Audit-Ready Signal

- sync_status: audit-ready (PR 대기, 병합 전)
- sync_complete_at: 2026-11-09
- sync_commit_sha: pending-backfill
- SPEC status: `implemented` (`completed`가 아님). 이유: 수동 확인 M-1이 아직 없고, Windows 확인은 사용자 결정(D-2)으로 생략했다. M-1이 끝나면 별도 close 커밋으로 `completed`로 올린다.
- 문서 변경: `CHANGELOG.md` [Unreleased] > Changed에 SPEC-SEC-002 항목 추가. README·docs는 이 변경을 언급하지 않아 수정하지 않았다(`grep -rn "font-src\|SEC-002" README.md docs` 결과 없음).
- 백로그 카드 t1: PR 본문에서 해소로 표기. `moai todo` 변경은 코디네이터가 한다.
- 대기 중인 수동 확인: **M-1 (macOS)** — 위 절차. 병합 전 수행 권장.
- Gap: 이미지 등 다른 자산의 인라인 수 전·후 비교 없음(단위 테스트로만 확인). Windows 실기기 미확인.
- sync-audit: **PASS 0.87** (Tier S 기준 0.75; Functionality 0.85 / Security 0.92 / Craft 0.85 / Consistency 0.88). 차단 결함 0건. 보고서 `.moai/reports/sync-audit/SPEC-SEC-002.md`(로컬, git 미추적). 반영: D-1(CHANGELOG "4,096B 미만"), D-5(이 줄). 미반영: D-2·D-4·D-6(선택/범위 밖), D-3(M-1 수동 확인 대기).

## 수동 확인 결과 (v0.21.0 초안 빌드)

- 일시·빌드: 2026-11-09, v0.21.0 초안 빌드(f14fa99). 결과는 사용자 보고이며 캡처는 대화에만 있다.
- macOS 콘솔 글꼴 거부 확인: 수행하지 않음(갭). Windows: 사용자 결정 D-2로 생략.
- 위 갭을 명시하고 completed 처리. CI 빌드 측정 결과는 위 §E에 이미 기록되어 있다.
