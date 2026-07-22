// @MX:NOTE: [AUTO] SPEC-AI-008: 뷰포트 경계 인지 메뉴 배치 순수 헬퍼. 좁은 창에서 다이어그램
// 메뉴(AI 플라이아웃 서브메뉴 + 툴바 드롭다운)가 화면 밖으로 잘리는 결함을 막기 위해, 측정된
// rect 로 오버플로 여부만 판정한다. 실제 위치 전환은 소비자가 CSS 클래스 토글로 수행한다.
// @MX:SPEC: SPEC-AI-008

/** 메뉴 왼쪽 모서리 + 너비가 뷰포트 오른쪽 경계를 넘어서면 true(오른쪽 잘림). */
export function wouldOverflowRight(leftEdge: number, menuWidth: number, viewportRight: number): boolean {
  return leftEdge + menuWidth > viewportRight;
}

/** 메뉴 위쪽 모서리 + 높이가 뷰포트 아래 경계를 넘어서면 true(아래쪽 잘림). */
export function wouldOverflowBottom(topEdge: number, menuHeight: number, viewportBottom: number): boolean {
  return topEdge + menuHeight > viewportBottom;
}
