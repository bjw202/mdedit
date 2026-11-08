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

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
