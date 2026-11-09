# SPEC-PREVIEW-020 — Progress

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-09
- plan 산출물: spec.md, plan.md (Tier S의 계획 산출물 2개, status: draft). progress.md는 생애주기 기록(bookkeeping)이며 계획 산출물 수에 넣지 않는다.
- SPEC ID 정규식 검사: `SPEC-PREVIEW-020` PASS
- 기준: origin/main `ce18e23`, 브랜치 `WT-os-render-default`
- 열린 질문: spec.md §7 (macOS 기본값 재검토, Linux 미검증, 툴팁 불일치, 019 역참조). Windows 기본 보안 자세는 열린 질문에서 빠지고 spec.md §5의 SPEC-SEC-001 증거로 정리됨(§7-4는 선택 사항 하나만 남음).
- plan-audit 1차: PASS 0.82 (Tier S 기준 0.75), 보고서 `.moai/reports/plan-audit/SPEC-PREVIEW-020-review-1.md`. 결함 D1~D10을 spec.md/plan.md v0.1.1에서 반영(요구·수용 기준의 의미 변경 없음). 반영 후 재감사 여부는 오케스트레이터가 정한다.

## §E.2 Run-phase Evidence

### M1 관문 — Windows 원본 보기 선명도 (2026-11-09)

- 결과: **PASS (사용자 관찰)**. 사용자가 Windows v0.20.0 릴리스 빌드에서 원본 보기 150%·200% 글자가 선명했다고 답했다(코디네이터 전달, 2026-11-09).
- 근거의 성격: 사용자 관찰이며 **캡처 없음**. 우리가 측정하거나 자동화로 관찰한 값이 아니다. 수동 M-1의 나머지(새 프로필 기본 열림, Mermaid 그림 표시)는 아직 미확인.
- 선행: SPEC 개정 0.1.2(툴팁 OS 인식 REQ-PREVIEW020-008) 커밋 `ab6d255`.

### M2~M6 구현 증거 (2026-11-09, 코드 HEAD `3a983dc`, 이 실행·이 트리 기준)

커밋: M2 `ed8fdcd`, M3 `22ff50c`, M4 `45d2dfc`, M5 `ed1f731`, M6 `3a983dc`. 방식: TDD(M2·M3·M4는 테스트를 먼저 쓰고 실패를 확인한 뒤 구현).

**RED 증거(구현 전 실패)**
- M2: `npx vitest run src/test/uiStoreRenderMode.test.ts src/test/uiStore.test.ts` → `Tests  28 failed | 154 passed (182)`. 실패 예: 버전 단언 `persist version이 2로 범프되었다`, `migrate는 version 1 상태 {"htmlRenderMode":"crisp",...} 를 {"htmlRenderMode":null,...} 로 바꾼다`, `setHtmlRenderMode(null)는 null로 정규화한다`.
- M3: (1) 함수 부재 상태 `npx vitest run src/test/htmlZoom.test.ts` → `Tests  18 failed | 12 passed (30)`. (2) 앞 고정 없는 `/win/i` 임시 구현 → `× 플랫폼 "Darwin" 의 기본값은 crisp 이다` / `AssertionError: expected 'original' to be 'crisp'` / `Tests  1 failed | 29 passed (30)`. (3) `/^win/i`로 고정 → `Tests  30 passed (30)`.
- M4: `npx vitest run src/test/htmlZoom.test.ts src/test/HeaderRenderMode.test.tsx src/test/HtmlFileViewerOsMode.test.tsx` → `Tests  14 failed | 46 passed (60)` (Windows 해소·전환·툴팁 케이스 실패).

**최종 게이트(HEAD `3a983dc`)**
- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0 (`--max-warnings 0`).
- `npx vitest run --exclude "**/agent-a94c670808f25e62a/**"` → exit 0, `Test Files  117 passed (117)`, `Tests  1991 passed (1991)`. 착수 전 기준선은 같은 명령으로 `1924 passed (116 files)`.
- `npx playwright test e2e/html-file-viewer.spec.ts` (webkit) → exit 0, `4 passed`.
- 제외 없는 `npx vitest run`은 exit 1(`15 failed | 3900 passed`)이다. 실패 파일은 전부 worktree 안에 남은 중첩 디렉터리 `.claude/worktrees/agent-a94c670808f25e62a/src/test/`의 사본(specImgLoadBWatcher, uiStore, uiStoreRenderMode)이다. 이 디렉터리 때문에 착수 전 기준선도 `4 failed`였다(수정 전 코드). 이 SPEC 변경 파일에서 난 실패는 없다.

**AC-007 변경 범위**: `git diff --name-only ce18e23...HEAD`의 소스는 `src/store/uiStore.ts`, `src/lib/preview/htmlZoom.ts`, `src/components/layout/Header.tsx`, `src/components/preview/HtmlFileViewer.tsx` 4개. `index.html`·`src-tauri/` 없음. Header.tsx diff는 import 두 줄, `htmlRenderMode` 선언부(해소 호출로 감쌈), `title` 줄뿐이며 `aria-label`·버튼 글자 줄은 diff에 없음. HtmlFileViewer.tsx diff는 import 한 줄과 분기 한 줄뿐. (참고: 계획은 `aria-pressed`·`is-active`·핸들러 줄을 고치는 것으로 적었으나, 선언부에서 한 번 해소해 세 줄을 그대로 둔 것이 diff가 더 작아 이렇게 했다.)

**AC-008 수동 확인 (모두 PENDING, 우리가 관찰한 항목 없음)**
- M-1 Windows 새 프로필: PENDING. 선명도 부분은 M1 관문에서 사용자 관찰(캡처 없음)로 통과했고, 새 프로필 원본 열림·토글 눌림·Mermaid 그림 표시는 릴리스 빌드에서 미확인.
- M-2 macOS 새 프로필: PENDING.
- M-3 두 OS 명시 선택 영속(재시작): PENDING.
- M-4 두 OS 업그레이드 경로(v1 저장소 심기): PENDING.

**Gaps**: 실기기(WKWebView·WebView2) 렌더 미관찰. e2e는 Playwright WebKit이며 마이그레이션은 e2e 범위 밖(단위 테스트 전담). 플랫폼 문자열(`"Win32"`/`"MacIntel"`)이 실기기에서 그렇게 나오는지 미확인(spec §5 가정). 롤백 시 v2 저장소를 v1 코드가 읽는 경로(R6)는 시험하지 않음.

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
