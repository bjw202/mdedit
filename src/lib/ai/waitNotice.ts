// @MX:NOTE: [AUTO] SPEC-AI-006 항목 5 / SPEC-AI-010 REQ-AI10-007 — AI 요청의 **세 타임아웃
// 계층**을 한 모듈에 모아 둔다. 값이 흩어지면 "어느 쪽이 먼저 발동하는가"를 코드를 뒤져야만
// 알 수 있고, 순서가 뒤집히면 사용자는 덜 유용한 오류를 보게 된다.
//
//   1) 소프트 대기 안내(8초)   — "아직 생성 중이에요" 보조 문구. 종결을 만들지 않는다.
//   2) 백엔드 하드 워치독(60초) — 자식 프로세스를 kill 하고 분류된 ai://error{kind:"timeout"}
//                                을 emit 한다. 실제 값은 Rust 에 있고 여기는 미러다.
//   3) 프론트 백스톱(2번 + 유예) — 2번의 종결 이벤트마저 프론트에 닿지 않았을 때의 최후 방어.
//
// 불변식: 1 < 2 < 3. 3이 2보다 먼저 발동하면 백엔드의 **분류된** timeout 오류를 가로채
// 덜 유용한 오류로 덮어쓴다. 그래서 3은 독립 리터럴이 아니라 2에서 파생시킨다 — 백엔드 값이
// 바뀔 때 편집 지점이 하나로 유지된다.
// @MX:SPEC: SPEC-AI-006 REQ-AI6-007 REQ-AI6-008 REQ-AI6-009 / SPEC-AI-010 REQ-AI10-007 REQ-AI10-008

/** (1) 대기 안내 문구를 표시하기까지의 지연(ms). 기본 8초. */
export const WAIT_NOTICE_DELAY_MS = 8000;

/** 대기 안내 문구 — 진행률 등 가짜 진행 표시는 사용하지 않는다(REQ-AI6-009). */
export const WAIT_NOTICE_TEXT = '아직 생성 중이에요 — 취소할 수 있어요';

/**
 * (2) 백엔드 하드 워치독의 **미러** 값(ms).
 *
 * 원본은 `src-tauri/src/ai/mod.rs:32` 의 `pub const WATCHDOG_TIMEOUT_SECS: u64 = 60` 이다.
 * 이 프론트 상수는 그것을 읽기 전용으로 반영할 뿐이며 백엔드 동작을 바꾸지 않는다.
 * **백엔드 값을 바꾸면 여기도 함께 바꿔야 한다** — 순서 불변식 테스트는 프론트 상수끼리만
 * 비교하므로 "백엔드만 바뀌는" 경우를 잡지 못하는 유일한 사각지대다.
 */
export const BACKEND_WATCHDOG_TIMEOUT_MS = 60_000;

/**
 * 백엔드 워치독이 만료된 뒤 `claim_terminal` → 자식 kill → `emit` 까지의 전달 지연과
 * 이벤트 큐 여유를 덮기 위한 고정 유예(ms). 크게 잡을수록 "진짜로 죽었을 때 사용자가
 * 기다리는 시간"이 늘어나므로, 전달 지연을 덮는 최소 폭(5초)으로 둔다.
 */
export const FRONTEND_BACKSTOP_GRACE_MS = 5_000;

/**
 * (3) 프론트 백스톱 임계(ms) — 백엔드 미러 값에서 **파생**한다(독립 리터럴 금지).
 * 이 시점까지 `ai://done`/`ai://error` 를 하나도 받지 못한 카드는 스스로 `error` 로 종결한다.
 */
export const FRONTEND_BACKSTOP_DELAY_MS = BACKEND_WATCHDOG_TIMEOUT_MS + FRONTEND_BACKSTOP_GRACE_MS;

/**
 * 프론트 백스톱이 만든 오류의 사용자 문구. 신규 `errorKind` 를 만들지 않고 기존 `other`
 * 분기(재시도 + 닫기)에 얹으므로, 원인을 짐작할 수 있는 분류 문구만 전달한다(REQ-AI10-009).
 */
export const BACKSTOP_ERROR_TEXT = '응답이 오지 않아 중단했어요. 다시 시도해 주세요';
