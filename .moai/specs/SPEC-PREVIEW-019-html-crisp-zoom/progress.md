# SPEC-PREVIEW-019 progress.md

## Phase Notes (plan)

- 사용자 결정(2026-11-09, 오케스트레이터 경유): 100% 초과 확대는 선명해야 함(최우선), 방식은 srcdoc, 보안 SPEC(SPEC-SEC-001)과 병행 계획·구현은 SEC-001 이후. Q1=A(셸 CSP `script-src`에 고정 주입 스크립트 sha256 1개, `unsafe-inline` 금지, 페이지 자체 스크립트는 선명 모드에서 차단됨을 제약으로 명시), Q2=토글 포함(기본 선명 모드, 헤더 '원본 보기', 전역 영속 `htmlRenderMode`).
- 코디네이터 기본값(열린 질문, spec.md §7-1): 원본 보기에서는 018 동작 유지(transform 배율, 100% 초과 흐림). 해시-스크립트 일치 테스트를 AC에 포함(AC-006).
- plan 단계 확인(2026-11-09, origin/main 57b3231): 018 spec/plan/acceptance/progress, 기각된 018 v0.4.0 문서, review-3, advisor 처방 전문, `HtmlFileViewer.tsx`, `uiStore.ts`, `Header.tsx`, `ipc.ts`, `file_ops.rs`, `index.html` 메타 CSP, `tauri.conf.json`.
- 실측: Chromium에서 셸 메타 CSP가 sandbox srcdoc iframe의 인라인 스크립트를 차단함(대조군 실행됨). WebKit·WebView2 미실측.
- Tier M. 산출물: spec.md / plan.md / acceptance.md / progress.md. 활성 REQ 12·AC 15.
- 병행 SPEC-SEC-001은 다른 worktree에서 계획 중이며 이 worktree에는 없다. `depends_on`에 선언. run 착수 전 `status: completed` 확인 필수.

## Plan-audit History

- review-1(2026-11-09): **FAIL 0.74** (Tier M 기준 0.80) — `.moai/reports/plan-audit/SPEC-PREVIEW-019-review-1.md`. blocking D1~D6, minor D7~D14. 핵심 실측(Playwright Chromium·WebKit): 해시 1개로 주입 스크립트 실행·`postMessage` 배율 적용은 성립, 그러나 상속된 `style-src`가 asset 스타일시트를 막고(D1), 프레임 이동(링크·meta refresh)으로 CSP 없는 문서의 스크립트가 실행되며(D2), `srcdoc`은 항상 표준 모드다(D3).
- v0.1.0 개정 1차(2026-11-09, plan 단계 작성자): D2~D14 반영(D2 보안 주장 정정·AC-014 이동 경로 시험, D3 quirks 한계 10 추가, D4 018 `implemented` 충돌 명시, D5 AC-006 토큰 집합·고정 기대값, D6 e2e를 기존 webkit 프로젝트로, D7~D14 경미). D1은 사용자 결정 **D1=A**(2026-11-09, 코디네이터 경유 AskUserQuestion): 셸 CSP `style-src`에 `asset: http://asset.localhost https://asset.localhost`만 추가, 나머지 지시어 불변. spec REQ-006·AC-006·plan M3/§D·한계 목록 반영. D2 정정(프레임 이동 후 CSP 없는 문서 스크립트 실행)은 코디네이터가 SEC-001 run 워커에 '프레임 이동 후 invoke 거부' 시험으로 전달.
- review-2(2026-11-09, 커밋 447350c 대상): **PASS 0.92** — `.moai/reports/plan-audit/SPEC-PREVIEW-019-review-2.md`. D1~D14 전부 해소(D1은 Chromium·WebKit에서 `style-src` 수정값으로 스타일시트·`@import`·CSS `url()` 적용을 재실측; macOS `asset:` 스킴 자체는 미실측 → M-2·M-5). 신규 minor N1~N3(문구)는 직후 수정(spec §5 예외 명시, §3 default-src/img-src 값 정확화, acceptance M-4 행). 점수 하락 없음, STOP 신호 없음.

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-09
- 구현 착수 승인(Implementation Kickoff Approval)은 받지 않았다. run은 (1) SPEC-SEC-001 `status: completed` (2) macOS M-1 프로토타입 관문 통과 (3) 018 상태 확인 뒤에만 시작한다.
- 열린 질문: spec.md §7 — 원본 보기의 배율 처리(코디네이터 기본값: 018 동작 유지), SEC-001 권한 범위 확정 뒤 REQ-011·M-6 대조.

## Run-phase Notes (2026-11-09)

- 작업 위치: worktree `.claude/worktrees/crisp-zoom`, 브랜치 `WT-crisp-zoom`. origin/main 병합 2회(1b4fe30: 7302a2d SEC-001 코드 포함, 44ee43b: a97d63c SEC-001 completed 문서). 충돌 없음.
- 구현 착수 승인(Implementation Kickoff Approval): 사용자 승인됨(코디네이터 전달). `/moai goal`은 장착하지 않음.
- **Pre-flight (§C)**:
  1. `depends_on` SPEC-SEC-001: `status: completed` (a97d63c, `grep -n "^status:" .moai/specs/SPEC-SEC-001*/spec.md` → `5:status: completed`).
  2. §A 앵커: 병합 뒤에도 `HtmlFileViewer.tsx`·`uiStore.ts`·`Header.tsx`·`index.html`은 SEC-001이 건드리지 않았다(`git diff 57b3231 HEAD -- index.html src-tauri/tauri.conf.json`이 비어 있음). 행 번호는 이 SPEC 편집 전 상태에서 plan과 같았다.
  3. SEC-001의 CSP/설정 변경: 없음(R6 해당 없음). SEC-001은 `src-tauri/capabilities/main.json`에 앱 명령 26개 허용(`windows: ["main"]`, `remote` 항목 없음)과 `src-tauri/app_commands.rs`·`build.rs`를 추가했다. AC-006 기준 토큰 집합은 편집 전 `index.html` 메타 CSP에서 해시를 뺀 값으로 `src/test/htmlSrcdocCsp.test.ts`에 고정했다.
  3a. SPEC-PREVIEW-018 `status: implemented`. **018의 수동 M-1·M-2·M-4·M-5는 019 병합 뒤 기본값(선명 모드)에서 수행하면 한계 5(미디어 쿼리 비반응)로 실패해 보이므로 '원본 보기'로 바꾼 상태에서 수행해야 한다.**
  4. 기준선(§C.4): 변경 전 vitest/tsc/eslint 기준선은 **측정하지 못했다**(Gaps). 변경 후 전체 결과는 §E.2.
- **REQ-011 / 수동 M-6 대조(열린 질문 §7-2)**: SEC-001 최종 상태(`main.json` + `app_commands.rs`)는 앱 명령을 로컬 `main` 창 capability에만 허용하고 `remote` 항목이 없다. 선명 모드는 새 앱 명령을 추가하지 않으며(`read_file`·`read_file_size` 재사용, 둘 다 허용 목록에 있음) 이 SPEC은 Rust를 바꾸지 않았다. SEC-001 progress의 실기기 기록: macOS `probe-srcdoc.html`(origin `"null"`)·M-2b(링크·meta refresh 이동 뒤)에서 `__TAURI_INTERNALS__` undefined → 호출 불가, Windows는 사용자 구두 보고 PASS(원문 JSON 없음). 따라서 REQ-011 세 번째 항목과 AC-014의 기대값은 SEC-001 문서와 일치하며 바꿀 필요가 없다. 단 이 SPEC 자신의 AC-014(M-6) 실기기 시험은 아직 수행되지 않았다(아래 수동 목록).
- 열린 질문 §7-1(원본 보기 배율): 코디네이터 기본값 유지 — 원본 보기는 018 동작(transform 배율, 100% 초과 흐림) 그대로.
- spec §3-9 / R9(같은 경로 파일이 바뀐 뒤 갱신): 코드 판독 결과 원본 방식은 `src`가 같으면 iframe을 다시 로드하지 않고, 선명 모드도 읽기 효과의 의존성이 `htmlPath`뿐이라 같은 경로면 다시 읽지 않는다 — 두 모드가 같은 수준이다. **런타임 재측정은 하지 않았다**(Gaps).

## M1 프로토타입 관문 결과 (macOS, 사용자 실측, 2026-11-09)

- 대상: 이 worktree의 프로토타입(`srcdoc` + 해시 허용 스크립트 + `postMessage` 문서 `zoom`), `tauri dev`(포트 1431; 1420은 다른 worktree `sec-acl`의 vite가 점유해 건드리지 않고 `--config` 덮어쓰기로 우회).
- 결과(사용자 보고, 캡처 3장): 100%·150%·200% 모두 "내 눈에는 선명하다" → **M1 관문 PASS(macOS)**. 캡처로 확인: 외부 `style.css` 적용(남색 제목·금색 밑줄·붉은 굵은 문단), 같은 폴더 SVG 이미지 표시, 배율에 따른 줄바꿈 재계산(재렌더), 11px 작은 글자·한글 또렷.
- **미확인(사용자 미보고)**: 배율 변경 시 스크롤 유지, `#bottom`·'맨 위로' 링크 동작, `test-plain.html`의 인라인 스크립트 차단. 같은 배율의 원본 보기와 나란히 놓은 비교도 응답에 없었다. 캡처 파일 경로는 이 worktree에 전달되지 않았다(코디네이터 보유). 따라서 AC-012의 PASS 조건(두 모드 스크린샷 파일 경로 기록)은 **미충족 → pending-manual**.
- 참고: 200% 캡처에 iframe `title` 툴팁('HTML 파일 미리보기')이 떠 있었음 — 포인터 호버 툴팁이며 결함 아님.
- 시험 자료(커밋 안 함, gitignore): `.moai/state/crisp-proto/`(`test-ext-css.html`, `test-plain.html`, `style.css`, `img.svg`).

## §F Phase 4 Mode Selection

- Decision: serial (dispatched worker가 직접 구현, 하위 에이전트 미사용 — 브리프 지시)
- 입력: Tier M, 변경 파일 소스 4 + index.html 1 + 테스트/e2e 7, 도메인 1(프런트 미리보기), 코딩 중심 → fanout/sweep 해당 없음.
- Implementation Kickoff Approval 통과 확인됨(코디네이터 전달).

## §E.2 Run-phase Evidence

기준: 이 트리, 코드 HEAD `e080b35`(검증은 커밋 직전 같은 내용의 작업 트리에서 실행, 이후 코드 편집 없음). 로그 원문: `.moai/state/verify/crisp/{lint,tsc,vitest,cargo-test}.log`(gitignore).

| 항목 | 명령 | 종료 코드 | 출력 꼬리 |
|------|------|----------|-----------|
| lint | `npm run lint` | 0 | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` (추가 출력 없음) |
| 타입 | `npx tsc --noEmit` | 0 | (출력 없음) |
| 단위 | `npx vitest run` | 0 | `Test Files  116 passed (116)` / `Tests  1924 passed (1924)` |
| Rust | `cargo test --manifest-path src-tauri/Cargo.toml` | 0 | lib `367 passed; 0 failed`, `tests/app_acl.rs` `3 passed; 0 failed` |
| e2e | `npx playwright test e2e/html-file-viewer.spec.ts --config .moai/state/crisp-proto/pw.config.ts` | 0 | `4 passed (3.2s)` (원본 3 + 선명 1) |
| 번들 CSP | `npx vite build --outDir .moai/state/crisp-proto/dist --emptyOutDir` 후 산출 `index.html` 메타 | 0 | `script-src 'self' 'wasm-unsafe-eval' 'sha256-oyux3QZNmUPrmPgj1PQsAEYRaLYv48OE/pDD2kgerII='` 및 `style-src … asset: http://asset.localhost https://asset.localhost` 보존 확인 |
| AC-008 grep | `grep -cE '^[[:space:]]+sandbox="allow-scripts allow-same-origin"$' src/components/preview/HtmlFileViewer.tsx` | — | `1` |
| AC-010 git diff | `git diff --quiet 57b3231 -- src/lib/preview/htmlZoom.ts src/components/preview/SvgFileViewer.tsx src/lib/preview/previewZoom.ts src/test/SvgFileViewer.test.tsx src/test/previewZoom.test.ts` | 0 | (변경 없음) |
| AC-010 grep | `grep -rnE '\bsetZoom\b|set_zoom|zoomHotkeysEnabled|zoom_hotkeys_enabled|addEventListener\(.wheel' src src-tauri/src src-tauri/tauri.conf.json` (테스트 제외) | 1 | (무일치) |
| AC-011 grep | `grep -nE "addEventListener\(['\"]message['\"]" src/components/preview/HtmlFileViewer.tsx` | 1 | (무일치) |

- **e2e 실행 경로**: `playwright.config.ts`(포트 1420, `reuseExistingServer`)는 다른 worktree의 vite가 1420을 점유해 그 worktree 코드를 시험할 위험이 있어, gitignore된 임시 설정(`.moai/state/crisp-proto/pw.config.ts`, 포트 1431의 이 worktree vite)으로 실행했다. 저장소의 `playwright.config.ts`는 바꾸지 않았다.
- **변형 검증(사전 확인)**: 주입 스크립트 상수의 한 글자를 바꾸면 `htmlSrcdocCsp.test.ts` 3건이 실패(원복 후 6건 통과). `index.html` 해시 한 글자를 틀리면 선명 모드 e2e가 `Expected "1.1" / Received ""`로 실패(원복 확인).
- **RED 증거**: M4 `uiStoreRenderMode.test.ts`는 구현 전 `7 failed | 4 passed`, M6 `HeaderRenderMode.test.tsx`는 구현 전 `4 failed | 3 passed`를 확인한 뒤 구현했다. M2 조립 모듈과 M5 뷰어는 M1 프로토타입이 먼저 있었기 때문에 테스트가 구현 뒤에 쓰였다(첫 실행부터 통과) — 이 두 마일스톤에는 RED 출력이 없다.

### AC 결과

| AC | 상태 | 근거 |
|----|------|------|
| AC-001 저장소 | PASS | `src/test/uiStoreRenderMode.test.ts` 11건 |
| AC-002 선명 렌더 | PASS | `HtmlFileViewerCrisp.test.tsx` (sandbox·src 없음·srcdoc·로딩·경로 경쟁) |
| AC-003 조립 함수 | PASS | `htmlSrcdoc.test.ts` (표 11행 + zoom + 이스케이프 + base 계산) |
| AC-004 재렌더 없는 배율 | PASS | 뷰어 테스트(동일 iframe·srcdoc, postMessage 스파이) + 자식 처리기 하네스 |
| AC-005 해시 링크 | PASS | 자식 iframe 하네스 8건 |
| AC-006 CSP 해시 | PASS | `htmlSrcdocCsp.test.ts` 6건, 변형 검증 완료 |
| AC-007 폴백 | PASS | 뷰어 테스트(UTF-8·읽기 실패·초과·경계·크기조회 실패·복귀·안내 중 모드 변경) |
| AC-008 018 회귀 | PASS | 기존 018 시나리오(원본 시드, 어서션 무변경) + `HtmlFileViewerCrisp` 원본 시나리오 + grep `1` |
| AC-009 헤더 | PASS | `HeaderRenderMode.test.tsx` 7건, 기존 `Header.test.tsx` 25건 무수정 통과 |
| AC-010 018 UX 불변 | PASS | git diff 종료 0, grep 무일치, 기존 018 테스트 무수정 통과 |
| AC-011 보안 형태 | PASS | sandbox 토큰 집합 `{allow-scripts}`, message 리스너 grep 무일치, 스크립트 금지 토큰 검사, `@MX:WARN` 갱신 |
| AC-012 선명도 | pending-manual | macOS 눈 확인 PASS(M1), 원본과 나란히 비교·스크린샷 경로 기록 없음; Windows 미수행 |
| AC-013 상대 자원·해시 링크·한계 | pending-manual | macOS 상대 CSS·이미지는 M1 캡처로 확인; 스크롤 유지·해시 링크·한계 관찰(M-3·M-4) 및 Windows 미수행 |
| AC-014 앱 명령 거부(M-6) | pending-manual | 두 OS 미수행(SEC-001 쪽 macOS 실기기 기록은 위 참조) |
| AC-015 엔진별 CSP·해시 실행(M-5) | 부분: e2e PASS / 실기기 pending-manual | Playwright WebKit에서 해시 스크립트 실행·인라인 차단 확인(부분 증거). macOS WKWebView는 M1에서 해시 스크립트 실행(배율 적용)이 확인됨; Windows·인라인 차단 실기기 미확인 |

## §E.3 Run-phase Audit-Ready Signal

- run_status: 구현·자동 검증 완료 / 수동 M-1~M-6 중 일부 pending
- 커밋: 5d6e253(M2+상태 in-progress) · c4028be(M3) · 3fe5965(M4) · 805a165(M5) · 7740a8b(M6) · e080b35(M7 e2e); 병합 1b4fe30·44ee43b.
- 수동 항목(OS별):
  - macOS: M-1 부분 PASS(선명, 스크린샷 비교 기록 필요), M-2 부분 확인(CSS·이미지), M-3 미수행, M-4 미수행, M-5 미수행(해시 스크립트 실행만 M1에서 간접 확인), M-6 미수행.
  - Windows: M-1~M-6 전부 미수행.
- Gaps: 변경 전 기준선 미측정; Windows 전 항목; 스크롤 유지·해시 링크·페이지 스크립트 차단 실기기 확인; 원본 대비 나란히 스크린샷; 갱신 동작(R9) 런타임 재측정; 릴리스 빌드(번들)에서 실기기 확인(번들 CSP 문자열만 확인).
- Residual-risk: WKWebView/WebView2의 CSP 상속 차이(R2), 프레임 이동 뒤 CSP 없는 문서의 스크립트 실행(보안 경계 아님, 방어는 SEC-001 + M-6), 원본 보기에서 100% 초과 흐림(§7-1), quirks 모드 차이(한계 10).
- 편차: (1) 원본 분기의 `convertFileSrc` 정규화를 선명 분기와 공유하려고 `toAssetUrl` 헬퍼로 뺐다(동작 동일, `sandbox` 속성 줄은 그대로). (2) 위 e2e 임시 설정. (3) RED 증거 없는 마일스톤 2개(M2·M5).


## §E.4 Sync-phase Audit-Ready Signal

- sync 단계 독립 재검증(오케스트레이터 직접 실행, 이 트리, HEAD edee991 + 문서 변경): `npm run lint` 종료 0, `npx tsc --noEmit` 종료 0, `npx vitest run` 종료 0(`Test Files 116 passed`, `Tests 1924 passed`), `cargo test --manifest-path src-tauri/Cargo.toml` 종료 0(lib 367 passed, `tests/app_acl.rs` 3 passed). 로그: `.moai/state/verify/sync-019/`(gitignore).

- sync_complete_at: 2026-11-09
- sync_commit_sha: 0c3a89f7f98d6a41dc2e7d586f80777825173f78
- sync_status: docs written, SPEC frontmatter `status: in-progress -> implemented` (spec.md only; plan.md and acceptance.md carry no frontmatter)
- 문서 목록: `CHANGELOG.md` [Unreleased] ### Added 항목 1건 / `docs/USER_MANUAL.md` 새 소절 4-4(HTML 파일 보기와 '원본 보기') / `README.md` 지원 파일 형식 표 `.html` 행에 토글 한 구절.
- B12 자기 점검: (1) `grep -c 'SPEC-PREVIEW-019' CHANGELOG.md` 작성 전 0 (2) acceptance.md 고유 AC 식별자 `grep -oE 'AC-([A-Z0-9]+-)*[0-9]+' ... | sort -u | wc -l` = 25(비영); CHANGELOG는 AC 개별 나열 없이 AC-001~011 PASS / AC-012~015 대기로 기술 (3) CHANGELOG에 적은 경로(`index.html`, `src/store/uiStore.ts` 등)는 `git diff origin/main...HEAD --stat` 출력에 존재.
- 상태 전환과 사유: `implemented`로 두고 `completed`로 올리지 않았다. AC-012~015(수동, macOS·Windows)가 미종결이기 때문이다. SEC-001이 a97d63c에서 한 것처럼 수동 확인이 닫힌 뒤 `completed`로 올린다.
- 대기 중 수동 항목(OS별):
  - macOS: AC-012 원본 보기와 나란히 놓은 스크린샷 파일 경로 기록(선명함 자체는 사용자가 100/150/200%에서 눈으로 확인함); AC-012 M-1 스크롤 유지(재로드 없음), AC-013 M-3 해시 링크·M-4 한계 관찰; AC-014 M-6 앱 명령 호출 거부(프레임 이동 뒤 포함); AC-015 실기기 CSP(인라인 스크립트 차단 포함).
  - Windows: AC-012~015 전부 미수행.
- 알려진 한계(후속): HTML 안의 mermaid 다이어그램은 선명 모드에서 페이지 스크립트가 막혀 그려지지 않고 앱 pele 팔레트도 쓰지 않음 -> 백로그 카드 t2.
- SPEC-PREVIEW-018의 대기 중 수동 M-1·M-2·M-4·M-5는 '원본 보기'로 바꾼 상태에서 수행해야 한다.
- Gaps: lint·tsc·vitest·cargo는 위 재검증으로 sync 단계에서 직접 다시 실행했다. Playwright e2e는 다시 실행하지 않았고 §E.2의 4건 통과를 인용했다. USER_MANUAL/README 문구를 실제 화면에서 확인하지 않았다. 커버리지 도구가 설치돼 있지 않아 측정하지 못했다.
