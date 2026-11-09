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

- sync_status: audit-ready (status `implemented`; `completed`는 수동 M-1~M-4 확인 후 별도 close PR에서 — SPEC-PREVIEW-018과 같은 방식)
- sync_commit_sha: pending-backfill
- 문서: CHANGELOG `[Unreleased]` 항목, README HTML 행, `docs/USER_MANUAL.md` §4-4, SPEC-PREVIEW-019 HISTORY 주석 행(REQ-001 기본값은 SPEC-PREVIEW-020이 OS별로 개정)
- spec.md `status: draft → implemented`

### 동기화 시점 게이트 (이 트리, 코드 HEAD `34095b3` 기준; 로그 `.moai/state/verify/sync-020/`)
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `npx vitest run --dir src` → exit 0, `Test Files  116 passed (116)`, `Tests  1967 passed (1967)` (run 단계의 117/1991은 `src` 밖 테스트 파일까지 포함한 수치)
- `npx playwright test e2e/html-file-viewer.spec.ts` (webkit) → exit 0, `4 passed`

### AC-007 문구 결정
- 사실: 구현은 `Header.tsx`의 `htmlRenderMode` 선언부 한 곳에서 해소한 값을 만들고, `aria-pressed`·`is-active`·클릭 핸들러 세 줄은 그대로 둔다(diff에 없음). AC-007이 허용한 줄 목록과 글자 그대로는 다르다.
- 결정: **AC-007 문구는 고치지 않는다.** 이유: (1) AC의 의도(`aria-label`·버튼 글자 줄 불변, diff 최소)는 지켜졌고 실제 diff가 허용 목록보다 작다. (2) 허용 목록은 "허용 상한"이지 "반드시 바꿔야 할 줄"이 아니며 선언부 한 줄 변경은 같은 해소 값을 쓰는 세 줄을 바꾼 것과 동등하다. (3) spec 본문 수정은 manager-spec 소관이고 재감사를 부르는데 결함이 아니라 문구 차이라 비용이 크다. 코드는 바꾸지 않는다.
- 이 차이는 sync 감사에 그대로 제출한다.

### 수동 확인 (사용자 실행, 병합 전) — 모두 PENDING
M-1 Windows 새 프로필(원본 열림·토글 눌림·Mermaid 그림 표시), M-2 macOS 새 프로필(선명 모드 기본), M-3 두 OS에서 명시 선택 영속(재시작), M-4 두 OS 업그레이드 경로(v1 저장소 심기).

### sync-auditor 판정
- 판정: **PASS-WITH-DEBT**, 종합 88.2 (Functionality 92 / Security 88 / Craft 86 / Consistency 82), 차단 결함 없음. 보고서: `.moai/reports/sync-audit/SPEC-PREVIEW-020.md`(추적 안 함).
- 감사자 자체 관찰: 대상 테스트 7파일 189건 통과, 제외 없는 `npx vitest run` 117 파일·1991 테스트 통과, typecheck·lint exit 0, e2e 4건 통과, 12가지 주입 회귀를 기존 테스트가 모두 잡음.
- 결함 처리: F1(매뉴얼이 Windows 선명도·해당 없음을 사실처럼 서술 — M-1 대기 중) 문구를 "사용자 관찰, 정식 확인 전"으로 수정. F2(옛 기본값 주석 4곳) 수정. F4(CHANGELOG의 stale 제외 문구) 삭제. F3(AC-007 문구)은 위 결정대로 유지. F5(기존 merge의 문자열 persisted 처리, 가설)·F6(타입 합집합 중복, 순환 import 회피 추정)은 범위 밖으로 두었다.
- 잔여 위험: 실기기 렌더·플랫폼 문자열·롤백 경로 미관찰, Windows 기본이 원본 보기(`allow-scripts allow-same-origin`)가 되므로 SPEC-SEC-001의 Windows 증거(사용자 보고, 캡처 없음)에 의존.

## 수동 확인 결과 (v0.21.0 초안 빌드)

- 일시·빌드: 2026-11-09, v0.21.0 초안 빌드(f14fa99). 결과는 사용자 보고이며 캡처는 대화에만 있다.
- Windows: HTML 기본 렌더 = 원본 보기 (사용자 보고, 캡처 없음).
- macOS: 0.19.0 위에 0.21.0 설치. 스크린샷으로 기본 선명 모드 관찰.
- 갭: Windows 명시 선택 영속과 0.20.0→0.21.0 업그레이드 경로는 "기본 원본 보기"로만 관찰, 캡처 없음.
