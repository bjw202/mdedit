# SPEC-PREVIEW-018 progress.md

## Phase Notes (plan)

- 사용자 결정(2026-11-08 인터뷰, 오케스트레이터 경유): HTML 전용 퍼센트 배율 컨트롤(단계 67~200, 퍼센트 표시 클릭 시 100%), 입력 3종(버튼·Cmd/Ctrl+`=`/`+`/`-`/`0`·Cmd/Ctrl+휠·핀치), 전역 값 하나를 `mdedit-ui-store`에 영속화.
- plan 단계 실측(manager-spec, 2026-11-08, main HEAD 00c0edb): `HtmlFileViewer.tsx`·`uiStore.ts`·`Header.tsx:202-210`·`previewZoom.ts`·`PreviewContainer.tsx` 읽기, 단축키 충돌 grep(결과는 plan.md §A). 앱 코드 안 Cmd/Ctrl+`=`/`-`/`0`·`wheel` 바인딩 없음, `zoomHotkeysEnabled` 미설정.
- Tier S. 산출물: spec.md / plan.md / acceptance.md(오케스트레이터 요청으로 검증 층 분리) / progress.md.

## Plan-audit History

- review-1(2026-11-08): FAIL 0.76 — `.moai/reports/plan-audit/SPEC-PREVIEW-018-review-1.md`. blocking D1~D5, minor D6~D16.
- v0.2.0 개정(2026-11-09, manager-spec): D1~D5 해소, 경미 D6~D15 반영(D16은 감사 권고대로 유지).
  - 개정 중 재확인(HEAD 00c0edb): `grep -c 'sandbox="allow-scripts allow-same-origin"' src/components/preview/HtmlFileViewer.tsx` → `3`, `grep -cE '^[[:space:]]+sandbox="allow-scripts allow-same-origin"$' …` → `1`, `grep -rnE '\bsetZoom\b|set_zoom|zoomHotkeysEnabled|zoom_hotkeys_enabled' src src-tauri/src src-tauri/tauri.conf.json` → 출력 없음(exit 1), `src/test/SvgFileViewer.test.tsx`·`src/test/previewZoom.test.ts` 존재, 두 모달 `role="dialog"` + `aria-modal="true"` 보유.

## Resolved Decisions

- 휠·핀치(사용자, 2026-11-09, 오케스트레이터 경유): "먼저 측정하고 결정한다". 휠·핀치는 범위 안에 유지. run 단계 첫 작업 = macOS·Windows 실기기에서 iframe 위 Cmd/Ctrl+휠·핀치가 앱 셸에 도달하는지 측정(plan.md §F M0). 도달 → REQ-005 구현. 미도달 → run 정지 + 차단 보고, 오케스트레이터가 사용자에게 선택지(제한 수용 / 수정키 누른 동안의 조건부 덮개 / 휠 제외)를 제시. 어떤 덮개도 사용자 결정 없이 구현하지 않는다.

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-09
- plan 단계 미결 사용자 결정 없음. run 단계 M0 측정 결과에 따라 조건부 차단 관문이 예약되어 있다(spec.md §3, plan.md §F M0).

## §E.2 Run-phase Evidence

> 기준: worktree `.claude/worktrees/preview-018`, 브랜치 `WT-html-zoom`, 구현 커밋 83ad52c (base dbaed65). 증거 로그: `.moai/state/verify/preview-018/`(로컬, 비추적).

### 진행 범위 (2026-11-09, 중간 기록)

- M0 관문 전에 끝낸 범위(휠·핀치 무관): M1 단계/저장소/뷰어 감싸개, M3 헤더 컨트롤, M2의 키보드 단축키(문서 단위 keydown, Header 안).
- 보류: 휠·핀치 핸들러와 제스처 상수(`WHEEL_*`) — M0 통과 전에는 작성하지 않음(plan §C.4, §G).
- M0 실측: **미수행(사람 필요)**. 아래 "M0 실측" 표는 coordinator 회신 뒤 채운다. PASS로 적지 않았다.

### 설계 결정

- persist 버전: **1 유지**. 필드 추가만으로는 범프가 필요 없고(persist가 초기 상태 위에 얕게 병합), 단계 밖/비숫자 값 정규화는 `merge` 옵션에서 `snapToStep`으로 처리. 기존 `migrate`(0→1)와 충돌 없음, 기존 테스트 "version이 1" 그대로 통과.
- 키 리스너 위치: `Header.tsx`의 `useEffect`(html 보기일 때만 등록). 이유: 헤더가 이미 보기 종류와 `htmlZoom`을 읽고, 컨트롤과 단축키를 한 곳에서 같은 액션(`stepHtmlZoom`/`resetHtmlZoom`)으로 구동.
- `getFileViewType`을 `src/lib/preview/fileViewType.ts`로 분리(동작 무변경) 후 `PreviewContainer`에서 재공개. 이유: 헤더가 `PreviewContainer`를 import하면 뷰어 전체(그리고 mermaid/pele 체인)가 헤더 테스트에 딸려 들어와 불필요하게 무거워짐. 기존 import 경로(AppLayout, ResizablePanels 등)는 그대로 동작.

### plan-audit 2차 경미 N1~N3 처리 (`.moai/reports/plan-audit/SPEC-PREVIEW-018-review-2.md`)

- N1(AC-005 "같은 조건에서 deltaY: 60" 상태 이월): 휠 단위 테스트를 작성할 때 각 경우를 별도 `it`(새 상태)로 나눈다. — M0 통과 후 적용(대기)
- N3(deltaMode 2 단위 테스트 부재): 휠 단위 테스트에 `deltaMode: 2, deltaY: -1 → 한 단계`를 추가한다. — M0 통과 후 적용(대기)
- N2(plan L66 문구 정밀화): SPEC 본문(plan.md) 변경이므로 run 단계가 고치지 않는다. manager-spec 개정 사항으로 보고에 남긴다. — 미적용

### 검증 명령과 결과 (this run, HEAD 83ad52c 기준 작업 트리)

| 명령 | 결과 |
|------|------|
| `npx vitest run src/test/htmlZoom.test.ts` | exit 0, 12 passed (RED 선행: exit 1, 모듈 없음) |
| `npx vitest run src/test/uiStore.test.ts` | exit 0, 67 passed (RED 선행: 신규 케이스 실패 확인) |
| `npx vitest run src/test/HtmlFileViewer.test.tsx` | exit 0, 8 passed (RED 선행: 1 failed) |
| `npx vitest run src/test/Header.test.tsx` | exit 0, 25 passed, act 경고 0 (RED 선행: 5 failed) |
| `npx vitest run src/test/PreviewContainer.test.tsx src/test/SPEC-PREVIEW-007-routing.test.tsx src/test/specImgLoadBRouting.test.ts` | exit 0 (분리한 `getFileViewType` 회귀) |
| `npx eslint <변경 10개 파일> --report-unused-disable-directives --max-warnings 0` | exit 0, 출력 없음 |
| `npx tsc --noEmit` | exit 2, 20줄 — **전부 `pele` 모듈 미설치(TS2307)와 그 파생 오류**. 작업 전 주 체크아웃도 동일 20줄. 변경분에서 새로 생긴 오류 0 |
| `npx vitest run` (전체, worktree) | exit 1, 41 files / 345 tests failed (110 files, 1128 passed) |
| `npx vitest run` (전체, 작업 전 주 체크아웃 기준선) | exit 1, 88 files / 710 tests failed (219 files; worktree 사본 포함 집계) |
| 실패 파일 비교 | worktree 실패 파일 중 기준선에 없는 파일 0건 (`comm -13` 빈 출력) |

- 전체 vitest 실패의 공통 원인: `Failed to resolve import "pele" from src/lib/diagram/diagramRenderer.ts`. `package.json`은 `pele 1.10.0`을 요구하지만 공유 `node_modules`에 설치돼 있지 않음(`npm ls pele` → empty). 이번 변경과 무관한 환경 결함이며, 기능 게이트(lint+tsc+vitest 3종 완전 녹색)는 `npm install` 이후에 의미가 있다.
- Gaps: Playwright(`e2e/html-file-viewer.spec.ts`) 미실행(앱 실행 환경 필요), 수동 M-0~M-5 전부 미수행, `pele` 설치 후 전체 vitest/tsc 재측정 미수행, CodeMirror 기본 키맵의 `Mod-=`/`Mod--`/`Mod-0` 충돌 확인(plan §A "남은 확인") 미수행.

### M0 실측 (macOS WKWebView / Windows WebView2) — _<사람 측정 대기>_

_<pending: coordinator 회신 후 기록>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
