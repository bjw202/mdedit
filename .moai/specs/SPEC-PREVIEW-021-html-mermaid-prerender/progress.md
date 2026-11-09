# SPEC-PREVIEW-021 progress.md

## Phase Notes (plan)

- 백로그 카드 t2. 사용자 결정(2026-11-09, 코디네이터 경유): 선명 모드(srcdoc)만, `pre.mermaid`·`div.mermaid`만, 앱 팔레트(잉크 앤 허니), 실패 시 원문 유지 + 짧은 안내.
- 기준 origin/main `cdaadcf`(SPEC-PREVIEW-020 병합 직후). worktree `.claude/worktrees/html-mermaid-prerender`, 브랜치 `WT-mermaid-prerender`.
- plan 단계에서 직접 읽은 것: SPEC-PREVIEW-019 spec/acceptance/progress, SPEC-PREVIEW-015 design.md(D3·D4·D6·D14), `htmlSrcdoc.ts`, `HtmlFileViewer.tsx`, `diagramRenderer.ts`, `exportUtils.ts`(`renderExportDiagram`), `exportHtml.ts`(자리 치환 방식), `PreviewRenderer.tsx`(오류 표시), `index.css` `.mermaid-container`, `mdedit-tokens.css`(다크 블록에 `--pele-*` 재정의 없음), `mdedit-fonts.css`·`public/fonts/`, `index.html` CSP(`font-src` 없음), `e2e/html-file-viewer.spec.ts` 선명 모드 describe, `diagramRenderer.test.ts` 오류 픽스처.
- 핵심 판단: (1) 렌더는 내보내기 경로 `renderExportDiagram`을 그대로 쓴다(모양 톤 + `var(--pele-)` 치환으로 앱 CSS 없는 srcdoc에서도 같은 색) (2) HTML 전체를 DOM으로 다시 직렬화하지 않고 오프셋으로 블록 안쪽만 교체 (3) 동기 실행 (4) CSP·sandbox·`buildSrcdoc` 불변.
- 미측정 위험: srcdoc 안 다이어그램 글꼴(Barlow). 019 한계 3(웹폰트 CORS)과 셸 CSP의 `data:` 글꼴 차단 때문에 run M1 관문으로 둠. SPEC-SEC-002(t1)의 `font-src` 결정에 따라 경로 (B)가 열릴 수 있음.
- Tier M. 산출물: spec.md / plan.md / acceptance.md / progress.md. 활성 REQ 10·AC 12.

## Plan-audit History

- review-1(2026-11-09, 커밋 490f887 대상): **FAIL 0.84**(Tier M 기준 0.80, 점수는 넘었으나 BLOCKING D1) — `.moai/reports/plan-audit/SPEC-PREVIEW-021-review-1.md`. 차원: Clarity 0.80 / Completeness 0.95 / Testability 0.75 / Traceability 0.90. MP-1~7 통과. D1(REQ-006 vs REQ-008 바이트 보존 모순) BLOCKING, D2~D4 SHOULD-FIX, D5~D15 MINOR. 감사자가 vitest를 돌리지 못함(이 worktree에 `node_modules` 없음) — 오류 픽스처 위치는 읽기로만 확인.
- v0.1.1 개정(2026-11-09): D1~D12·D14·D15 반영(spec HISTORY 0.1.1 참조). D13은 조치 불필요(pre-flight 2가 이미 확인). 계획 정규식은 작성자가 `node -e`로 7개 입력에 대해 의도대로 일치함을 확인(따옴표 안 `>`, 대문자, 따옴표 없음, `/>`, `<header>` 불일치).
- review-2(2026-11-09, 커밋 f334037 대상): **FAIL 0.88**(+0.04) — `review-2.md`. 차원: Clarity 0.88 / Completeness 0.95 / Testability 0.78 / Traceability 0.95. 이전 결함 13건 해소, 남은 BLOCKING N1(글꼴 `<style>`이 AC-001·002·005 단언과 충돌), SHOULD-FIX N2(같은 모듈 함수는 모의 불가), MINOR N3~N6.
- v0.1.2 개정(2026-11-09): N1~N5 반영(spec HISTORY 0.1.2). 작성자 확인: `node -p 'String.fromCharCode(160).concat("x").trim().length'` → `1`(trim이 U+00A0 제거, AC-004 예시 성립).

- review-3(2026-11-09, 커밋 b417ac7 대상): **PASS 0.92**(+0.04, 단조 증가) — `review-3.md`. 차원: Clarity 0.90 / Completeness 0.95 / Testability 0.88 / Traceability 0.95. N1~N5 해소, 새 모순 없음. 선택 사항 R1(`P` 정의에 `{ fonts: false }`)·R2(속성 값 안 `</div>` 시험 행)는 직후 반영. R3(병행 SPEC 부재)는 조치 불필요.
- 감사 3회 모두 vitest 미실행(이 worktree에 `node_modules` 없음). 실기기 글꼴 동작은 미측정 — run M1이 맡는다.

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-09
- 구현 착수 승인(Implementation Kickoff Approval)은 받지 않았다. run은 (1) origin/main 병합(t1 SPEC-SEC-002·t3 SPEC-PREVIEW-022 반영) (2) SPEC-PREVIEW-019·015 `completed` 확인 (3) M1 글꼴 관문(macOS 필수, Windows 가능하면) 순서로 시작한다.
- 열린 질문: spec.md §7 — SEC-002가 `font-src`에 `data:`를 넣는지, M1에서 (A)·(B) 모두 실패 시 (C) 수용 여부.

## §E.2 Run-phase Evidence

### 사전 점검 (§C)

- origin/main 대비 HEAD: `0 5`(뒤처짐 없음). SPEC-PREVIEW-019·015 둘 다 `completed`. 셸 CSP(`index.html`)에 `font-src` 없음 → 경로 (B)(`data:`) 불가, (A) 또는 (C)만 남음. `HtmlFileViewer.tsx`에 t3 변경 아직 없음.

### M1 글꼴 관문 결과 (AC-010)

| OS·빌드 | 앱 출처 | 굵기 ↔ 파일 | 관찰 | 판정 |
|---------|---------|-------------|------|------|
| macOS 개발 빌드(WKWebView) | `http://localhost:1420` | 400 → `barlow-400.woff2`, 600 → `barlow-700.woff2`, mono 400 → `ibm-plex-mono-400.woff2` | 선명 모드·원본 보기, 100%·150% 모두 줄1(Barlow 시도)이 monospace 대체가 아닌 비례폭으로 그려지고 줄2(시스템 sans-serif)와 폭이 다름(100% 'Authentication Service' 상자 약 361px ↔ 347px) | (A) PASS — 사용자 화면 관찰(2026-11-09) |
| macOS 배포 빌드 | `tauri://localhost` | 위와 같음 | **미측정** — 사용자가 마지막 수동 확인(M-1·M-2) 때 한꺼번에 측정하기로 함. 시안 `m1-font-gate-A-release.html`과 `.app`은 준비됨 | 수동 확인으로 이월 |
| Windows(WebView2) | `http://tauri.localhost` | 위와 같음 | **Windows 미측정** | 수동 M-2로 이월 — 실패 시 run 정지·blocker |

- 선택 경로: **(A) 앱 출처 `@font-face`**. 근거: 개발 빌드에서 로드 성공을 화면으로 확인, (B)는 셸 CSP 때문에 불가, (C)는 필요 없음.
- 갭: 개발 빌드의 `document.fonts.check` 값과 네트워크·콘솔 오류는 받지 못했다(화면 관찰만). 배포·Windows 결과 없음. 배포에서 실패하면 그때 멈추고 코디네이터에 보고한다.
- 측정용 시안 파일(`.moai/state/verify/m1-font-gate-A*.html`, 빌드 로그)은 추적하지 않는 파일이라 커밋하지 않았다.

### 구현 요약

- 신규 `src/lib/preview/htmlMermaid.ts`(`prerenderMermaidBlocks(html, { fonts? })`), `src/test/htmlMermaid.test.ts`(57 케이스). 수정: `HtmlFileViewer.tsx`(호출 1곳 + import + `@MX:NOTE`), `HtmlFileViewerCrisp.test.tsx`(+4 케이스), `e2e/html-file-viewer.spec.ts`(+1 describe).
- 글꼴 `<style>`은 `location.origin` 기준 `/fonts/*.woff2`를 가리키며, 출처가 `scheme://host[:port]` 형식이 아니면 넣지 않는다.
- TDD: `htmlMermaid.test.ts`를 먼저 작성해 모듈 부재로 실패(RED, `Failed to resolve import "@/lib/preview/htmlMermaid"`, `Test Files 1 failed, Tests no tests`)를 본 뒤 구현해 57/57 통과(GREEN).

### 게이트 명령과 결과 (이 트리, HEAD a318b41 + 작업 트리 변경)

| 명령 | 종료 코드 | 꼬리 출력 |
|------|-----------|-----------|
| `npm run typecheck` | 0 | `> tsc --noEmit` (오류 없음) |
| `npm run lint` | 0 | `> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` (경고·오류 없음) |
| `npx vitest run src/test/htmlMermaid.test.ts src/test/HtmlFileViewerCrisp.test.tsx src/test/HtmlFileViewer.test.tsx src/test/htmlSrcdoc.test.ts src/test/htmlSrcdocCsp.test.ts src/test/exportDiagram.test.ts` | 0 | `Test Files 6 passed (6)` / `Tests 167 passed (167)` |
| `npx vitest run --dir src` (전체 1회) | 0 | `Test Files 117 passed (117)` / `Tests 2028 passed (2028)` |
| `npx playwright test e2e/html-file-viewer.spec.ts` | 0 | `5 passed (5.9s)` (webkit, 새 케이스 포함) |
| `git diff origin/main -- index.html src/lib/preview/htmlSrcdoc.ts src/lib/diagram src/lib/export src-tauri` | 0 | 출력 없음 |

로그 원본: `.moai/state/verify/{typecheck,lint,vitest-full,e2e}.log`(추적 안 함).

### AC 매트릭스

| AC | 상태 | 근거 |
|----|------|------|
| 001 | PASS | `HtmlFileViewerCrisp.test.tsx` mermaid 케이스 1 — srcdoc에 `<svg` 1, `data-mdedit-diagram=""` 1, sandbox `allow-scripts`, `<base`·`<style>html{zoom:` 각 1 |
| 002 | PASS | `htmlMermaid.test.ts` 감지 표 12행 + 중첩 div 뒤 `<p>after</p>` 보존 |
| 003 | PASS | 감지 제외 표 17행, 모두 `P(x) === x` |
| 004 | PASS | 원문 추출 8케이스(엔티티·dedent·`<br/>`·태그 제거·숫자 엔티티·탭·U+00A0·body 자식 수) |
| 005 | PASS | 렌더 삽입(표시 속성, 감싸개 style, `/>`·공백 종료, `readPeleThemeValues` 1회, 모양 톤 `--_s:`, 블록 20개) |
| 006 | PASS | 실패 안내(실제 pele `2행 14열`/위치 0, 오류 메시지 미포함, 두 번째 호출 ok 시 접미사 없음, 성공+실패 혼합) |
| 007 | PASS | 블록 밖 바이트 보존(글꼴 끔·켬 두 경우, 스크립트 태그 보존), AC-003 표 전부 동일 |
| 008 | PASS | 동기 `string`, 렌더 예외 시 입력 반환, 뷰어에서 배율 변경 후 `renderExportDiagram` 호출 수·srcdoc 불변 |
| 009 | PASS | 원본 보기·크기/읽기/UTF-8 폴백에서 `renderExportDiagram` 미호출 |
| 010 | PARTIAL | M1 표(macOS 개발 (A) PASS)와 글꼴 `<style>` 위치·수 단위 시험(블록 안 `</body>` 무시, 성공 0개면 없음) PASS. 배포·Windows 실측은 수동 이월 |
| 011 | PASS | 불변 파일 diff 출력 없음, `sandbox="allow-scripts"` 유지, `innerHTML`은 `createElement('template')` 요소 1곳(`htmlMermaid.ts:133`), `@MX:WARN`+`@MX:REASON` 있음, `HtmlFileViewer.tsx` 주석에 `pre.mermaid`·`div.mermaid` 한계 서술 |
| 012 | PARTIAL | e2e 부분 증거 PASS(`[data-mdedit-diagram] svg` 1, 안내 1, `code.language-mermaid` 원문 유지, 페이지 스크립트 미실행). 수동 M-1·M-2 대기 |

### 갭·잔여 위험

- 미검증: 배포 빌드(`tauri://localhost`)·Windows(`http://tauri.localhost`)에서 글꼴 로드, 라벨 넘침, 150%·200% 선명도, 실제 색(`#FAF9F6`·판단 노드 톤). jsdom은 구조만 본다.
- 개발 빌드 M1은 화면 관찰만 있고 `document.fonts.check`·네트워크 탭 값은 없다.
- 병행 카드 t1(SEC-002)·t3(PREVIEW-022) 병합 후 origin/main 병합과 충돌 확인은 이 worktree에서 아직 하지 않았다(`HtmlFileViewer.tsx` 변경은 호출 1곳·import·주석뿐).

### 사용자 수동 확인 대기

- M-0(배포 빌드·Windows 글꼴), M-1(그림 표시·색·원본 보기 대조), M-2(라벨 넘침 없음·150%·200% 선명도) — macOS와 Windows 각각. 배포나 Windows에서 글꼴이 막히면 run을 멈추고 보고한다.

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_status: audit-ready
sync_complete_at: 2026-11-09
sync_commit_sha: pending-backfill
spec_status_transition: in-progress -> implemented   # completed로 올리지 않음 (수동 확인 M-0/M-1/M-2 대기)
changelog_entry_position: "[Unreleased] > ### Added (SPEC-PREVIEW-021 1건)"
```

### origin/main 병합

- origin/main 8e5f1b8(SPEC-SEC-002, 카드 t1)을 이 브랜치에 병합했고 충돌은 없었다. 병합 커밋이 HEAD 2af2c2b이다. (위 갭 목록의 "병합 확인 안 함" 항목은 이 병합으로 해소됐다.)

### 병합 후 게이트 재실행 (HEAD 2af2c2b)

| 명령 | 종료 코드 | 결과 |
|------|-----------|------|
| `npm run typecheck` | 0 | 오류 없음 |
| `npm run lint` | 0 | 경고·오류 없음 |
| `npx vitest run --dir src` | 0 | 118 파일 / 2039 테스트 통과 |
| `npx playwright test e2e/html-file-viewer.spec.ts` | 0 | 5건 통과 |

위 값은 오케스트레이터가 병합 후 재실행해 전달한 결과이며, 이 sync 단계에서 manager-docs가 직접 다시 실행한 것은 아니다.

### 이번 sync에서 바꾼 문서

- `CHANGELOG.md`: `[Unreleased]`에 `### Added` 항목 1건 추가. 추가 전 `grep -c 'SPEC-PREVIEW-021' CHANGELOG.md`는 0이었고, 항목에 적은 변경 파일 5개는 `ls`로 존재를 확인했다.
- `docs/USER_MANUAL.md`: §4-4 '선명 모드의 한계' 첫 글머리와 '이럴 때 원본 보기를 쓰세요'의 mermaid 예시를 새 동작에 맞게 수정.
- `spec.md`: frontmatter `status: in-progress -> implemented`만 변경(`updated`는 이미 2026-11-09). 본문·HISTORY 불변.
- `README.md`, `docs/USER_GUIDE.md`: 모순이 없어 수정하지 않음(README는 HTML 보기 방식만 서술, USER_GUIDE의 mermaid 절은 마크다운 안 코드 블록 설명).

### 수동 확인 대기 (사용자, 0.21.0 초안 빌드 통합 세션)

- M-0: 배포 빌드(`tauri://localhost`)와 Windows에서 글꼴 로드.
- M-1: 색(`#FAF9F6`, 판단 노드 톤)과 그림을 원본 보기와 대조.
- M-2: 라벨 넘침 없음, 150%·200% 선명도.
- 규칙: 배포 빌드나 Windows에서 글꼴 확인이 실패하면 중단하고 보고한다.
- M1 글꼴 관문은 macOS 개발 빌드에서 사용자의 화면 관찰로만 통과했고 `document.fonts.check`·네트워크 값은 없다.
- 따라서 AC-PREVIEW021-010과 AC-PREVIEW021-012는 수동 확인 전까지 PARTIAL로 남는다.

sync-audit verdict: **PASS-WITH-DEBT 0.85** (Functionality 0.85 / Security 0.84 / Craft 0.82 / Consistency 0.88, Tier M 기준 0.80) — 보고서 `.moai/reports/sync-audit/SPEC-PREVIEW-021.md`. BLOCKING 없음.
- 반영한 지적: F1(`>` 없는 조작 입력에서 시작 태그 정규식 이차 시간 — 4만 개에 15초) → `prerenderMermaidBlocks` 앞에서 `mermaid` 글자나 `>`가 없으면 입력 그대로 반환, RED 테스트 2건(실패 15.5초·15.8초 확인) 후 GREEN. F2(판단 노드 톤 단언이 공허) → `#8a6410` 유무 대조로 교체. F3(CHANGELOG 호출 순서 서술 오류) 정정.
- 남긴 지적(조치 안 함): F4 한계 주석 일부 누락, F5 앱 테마 변경 시험 부재, F6 속성 값 안 `<!--`가 뒤 블록을 가림(원문 유지 방향, 안전), F7 AC-010 PARTIAL(수동 확인 이월, 사용자 결정 기록됨). 잔여: `mermaid`와 `<div ` 수만 개가 있고 `>`가 하나라도 있는 조작 입력의 이차 시간은 막지 못했다(정상 HTML 5 MB는 15 ms).
- 감사 후 재실행(HEAD 반영 전 작업 트리): `npm run typecheck` 0, `npm run lint` 0, `npx vitest run --dir src` 0(118 파일, 2041 테스트), `npx playwright test e2e/html-file-viewer.spec.ts` 0(5 통과).

## 수동 확인 결과 (v0.21.0 초안 빌드)

- 일시·빌드: 2026-11-09, v0.21.0 초안 빌드(f14fa99). 결과는 사용자 보고이며 캡처는 대화에만 있다.
- macOS 릴리스 빌드(사용자 스크린샷): 선명 모드에서 mermaid가 앱 팔레트로 그려지고, 라벨은 Barlow(고정폭 아님)이며, 넘침 없음. 원본 보기는 페이지 자체 mermaid 테마로 표시됨(예상대로).
- 갭: Windows 글꼴·색 미확인. `document.fonts.check`·네트워크 값 미캡처. 150%·200% 선명도는 따로 보고되지 않음.
