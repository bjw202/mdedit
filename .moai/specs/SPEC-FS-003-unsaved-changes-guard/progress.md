# SPEC-FS-003 Run Progress

## V1 Resolution — Tauri v2 윈도우 종료 API (GROUND TRUTH, not guessing)

**Evidence**: `node_modules/@tauri-apps/api/window.js:1622-1631` (installed dependency source)

```js
async onCloseRequested(handler) {
  return this.listen(TauriEvent.WINDOW_CLOSE_REQUESTED, async (event) => {
    const evt = new CloseRequestedEvent(event);
    await handler(evt);
    if (!evt.isPreventDefault()) {
      await this.destroy();   // close only if NOT prevented
    }
  });
}
```

**결론**: 프런트엔드 `getCurrentWindow().onCloseRequested(handler)` + `event.preventDefault()` **단독으로 충분**. Rust `on_window_event` + `api.prevent_close()`는 불필요. 공식 JSDoc 예제(window.js:1607-1613)도 이 패턴만 사용.

**REQ-018 영향**: REQ-018은 Rust 경로를 요구하지만, V1 결과는 "프런트엔드 단독 충분". plan 지시에 따라 임의 축소 없이 보고 → **spec amendment 제안**: REQ-018의 Rust 요구를 "또는 프런트엔드 onCloseRequested+preventDefault"로 완화. 구현은 프런트엔드 단독(공식 지원 패턴)으로 진행, `lib.rs` 무변경. 동일한 사용자 가시 동작(종료 차단 + 3버튼 가드) 달성.

## V2 Resolution — uiStore persist saveStatus (GROUND TRUTH)

**Evidence**: `node_modules/zustand/esm/middleware.mjs:328-422` (installed dependency source)

- Default `version: 0` (현재 코드에 version 없음 → 0)
- Default `merge: (persisted, current) => ({...current, ...persisted})` → persisted가 이김 (line 333-336)
- Line 390-403: version 불일치 + migrate 부재 시 `console.error` 후 persisted state **전체가 버려짐** (모든 환경설정 손실 위험)
- Line 357: WRITE는 partialize 결과만 저장

**현재 사용자 localStorage** `mdedit-ui-store`: `saveStatus: 'unsaved'` 포함 (현 partialize는 statusMessage만 제외).

**결론**: partialize에서 saveStatus 제외만 하면, 기존 사용자는 재hydration 시 stale `unsaved` 복원(AC-004 위반, 첫 세션). version bump 없이 migrate만 생략하면 persisted 전체 손실(다른 설정 날아감).

**해결**: `version: 1` bump + `migrate`에서 `saveStatus`만 제거(나머지 보존). AC-004 충족 + 기존 환경설정 보존.

## Task Status

| Task | Status | Notes |
|------|--------|-------|
| T1 Pre-RED 특성화 | DONE | 폴더 이동 무가드 회귀 가드(REQ-029 영구) + openFile dirty baseline |
| T2 ConfirmDialog | DONE | 21 tests, 계약 동결, EXPORT-002 언블록 |
| T2b E2E 가상 FS | DONE | seedFs + 확장 포인트(__TAURI_MOCK_HANDLERS__) |
| T3 openFile dirty | DONE | 5분기 전부 setDirty(false) (REQ-011) |
| T4 saveDocument | DONE | 5중 중복 수렴 + watchedPath 기본 디렉터리 (REQ-009/035) |
| T5 persist 제외 | DONE | version 1 + migrate (V2 해소) |
| T6 가드 훅 | DONE | 종료승격 + AI취소 + 재진입 폐기 (26 tests) |
| T7 트리거 배선 | DONE | GuardContext 공유, 허위 가드 제거 |
| T8 윈도우 종료 | DONE | frontend-only (V1), lib.rs 무변경 |
| T9 워처 모달 | DONE | [reload,cancel] 안전 선택지 기본 포커스 |
| T10 CSS | DONE | .md-dialog* 토큰 only, raw hex 0건 |
| T11 E2E+게이트 | DONE | 5/5 E2E + 전체 게이트 green |

## Baseline → Final
- vitest: 1146 → 1216 tests (+70 new, 81 files)
- cargo: 257 pass (컴파일 게이트, lib.rs 무변경)
- typecheck/lint: clean
- E2E: FS-003 5/5 pass. 기존 4 실패(ai-inline-edit/table-border)는 pre-existing(baseline에서도 실패, stash로 확인)

