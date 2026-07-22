# SPEC-FS-003 수동 검증 — 윈도우 종료 가드 (AC-010)

AC-010은 Playwright로 검증 불가(Tauri 런타임 필요). `npm run tauri dev` 또는 릴리즈 빌드에서
아래 M1~M6을 수행하고 결과를 PR 본문에 기록한다. 모킹 단위 테스트(src/test/windowCloseGuard.test.tsx)
+ diff 리뷰(useWindowCloseGuard.ts, lib.rs 무변경)로 보강된다.

## V1 해소 근거 (중복 구현 회피)
`node_modules/@tauri-apps/api/window.js:1622-1631` — 프런트엔드 `getCurrentWindow().onCloseRequested()` +
`event.preventDefault()` 단독으로 종료 보류가 충분. 핸들러가 `preventDefault()`를 호출하면
`destroy()`가 호출되지 않아 창이 유지된다. Rust `on_window_event` + `api.prevent_close()` 불필요 →
`src-tauri/src/lib.rs` 무변경. REQ-018의 Rust 요구는 spec amendment 제안(프런트엔드 단독 허용).

## 체크리스트
- [ ] M1: 문서를 편집(dirty)한 뒤 창 닫기 → 3버튼 모달 표시, 창 닫히지 않음
- [ ] M2: 모달에서 `취소` → 앱 계속 실행, 편집 내용 유지
- [ ] M3: 모달에서 `저장 안 함` → 즉시 종료(디스크 파일 변경 없음)
- [ ] M4: 모달에서 `저장` → 저장 완료 후 종료(재실행 시 저장 내용 확인)
- [ ] M5: 깨끗한 상태(dirty=false)에서 창 닫기 → 모달 없이 즉시 종료
- [ ] M6: 편집 후 다른 파일 클릭해 모달이 뜬 상태에서 창 닫기 → 승격(두 번째 모달 없이 기존 모달 유지),
      `취소` 시 창 유지 + **다시 창 닫기 시도 시 정상 동작**(deadlock 부재)

## 자동화 검증(이미 통과)
- src/test/windowCloseGuard.test.tsx: dirty false/true 분기 + 비-Tauri no-op (3 tests)
- src/test/useUnsavedChangesGuard.test.tsx: 종료 승격 3분기 + cancel 후 재종료 deadlock 부재 (26 tests)
- diff 리뷰: useWindowCloseGuard.ts 구현 + lib.rs 무변경 확인
