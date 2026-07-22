// @MX:NOTE: [AUTO] SPEC-AI-008: 클리핑 경계 인지 메뉴 배치 헬퍼. 좁은/넓은 창 모두에서 다이어그램
// 메뉴(AI 플라이아웃 서브메뉴 + 툴바 드롭다운/표 피커)가 잘리는 결함을 막는다. 배치 판정의 경계는
// 창(window)이 아니라 getClipBoundary 가 계산한 "실효 클리핑 경계"다(에디터 패널 overflow:hidden).
// 측 선택(flip)만으로는 부족해 — 뒤집은 뒤에도 경계를 넘으면 경계 안으로 민다(clamp). 두 순수 함수
// computeFlyoutOffset/computeDropdownOffset 가 앵커 기준 최종 오프셋(px)을 돌려주고, 소비자는 그것을
// inline style(left/top)로 적용한다(클래스 토글로는 clamp 를 표현할 수 없음).
// @MX:SPEC: SPEC-AI-008

/** 메뉴 왼쪽 모서리 + 너비가 실효 클리핑 경계 오른쪽을 넘어서면 true(오른쪽 잘림). 저수준 판정. */
export function wouldOverflowRight(leftEdge: number, menuWidth: number, boundaryRight: number): boolean {
  return leftEdge + menuWidth > boundaryRight;
}

/** 메뉴 위쪽 모서리 + 높이가 실효 클리핑 경계 아래를 넘어서면 true(아래쪽 잘림). 저수준 판정. */
export function wouldOverflowBottom(topEdge: number, menuHeight: number, boundaryBottom: number): boolean {
  return topEdge + menuHeight > boundaryBottom;
}

/** 뷰포트 좌표계 사각형(px). */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 메뉴 크기(px). */
export interface Size {
  width: number;
  height: number;
}

/** 앵커(=offsetParent) 기준 오프셋(px) — 소비자가 inline left/top 으로 적용한다. */
export interface Offset {
  left: number;
  top: number;
}

/** getClipBoundary 가 돌려주는 실효 클리핑 사각형(뷰포트 ∩ 모든 클리핑 조상). */
export interface ClipBoundary {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// overflow 가 이 값들이면 자식을 시각적으로 잘라낸다(visible 만 잘리지 않음).
const CLIPPING_OVERFLOW = new Set(['auto', 'scroll', 'hidden', 'clip']);

// @MX:ANCHOR: [AUTO] SPEC-AI-008 근본 원인 수정 — 세 메뉴 배치 판정이 공유하는 경계 계산.
// @MX:REASON: fan_in 3(ai-selection-toolbar 서브메뉴, EditorToolbar 표 피커/다이어그램 드롭다운).
// 경계를 창으로 잡으면 넓은 창에서 패널 밖으로 잘린다 — 이 함수가 잘림의 실제 원인을 없앤다.
/**
 * el 을 실제로 잘라내는 경계를 돌려준다. 메뉴 배치 판정의 경계는 창(window.innerWidth/Height)이
 * 아니다 — 넓은 창이라도 에디터 패널(overflow:hidden)·CodeMirror 스크롤러(overflow:auto)가 스플릿
 * 위치에서 메뉴를 자르며, 그 오른쪽/아래 모서리는 뷰포트보다 한참 안쪽에 있다. el 의 조상을 위로
 * 훑어 overflow 가 잘리는 모든 조상 rect 와 뷰포트를 교집합해 실효 경계를 만든다. 클리핑 조상이
 * 없으면 뷰포트가 그대로 경계가 된다.
 *
 * DOM 의존(getComputedStyle/getBoundingClientRect)이라 순수 함수는 아니지만, jsdom 목킹으로 단위
 * 테스트 가능하다(순수 판정/clamp 는 아래 순수 함수가 담당, 이 헬퍼는 경계 수집만 한다).
 */
export function getClipBoundary(el: HTMLElement): ClipBoundary {
  const boundary: ClipBoundary = {
    left: 0,
    top: 0,
    right: typeof window !== 'undefined' ? window.innerWidth : 0,
    bottom: typeof window !== 'undefined' ? window.innerHeight : 0,
  };
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    const clipsX = CLIPPING_OVERFLOW.has(style.overflowX) || CLIPPING_OVERFLOW.has(style.overflow);
    const clipsY = CLIPPING_OVERFLOW.has(style.overflowY) || CLIPPING_OVERFLOW.has(style.overflow);
    if (clipsX || clipsY) {
      const r = node.getBoundingClientRect();
      if (clipsX) {
        boundary.left = Math.max(boundary.left, r.left);
        boundary.right = Math.min(boundary.right, r.right);
      }
      if (clipsY) {
        boundary.top = Math.max(boundary.top, r.top);
        boundary.bottom = Math.min(boundary.bottom, r.bottom);
      }
    }
    node = node.parentElement;
  }
  return boundary;
}

/**
 * 한 축(가로/세로)에서 메뉴의 최종 시작 좌표(뷰포트 기준)를 정한다(순수). 절차:
 * 1) 기본 위치가 경계 안에 완전히 들면 그대로. 2) 넘치면 대체(반대편) 위치가 완전히 들면 그쪽.
 * 3) 둘 다 부족하면 여유 공간이 더 큰 쪽. 4) 마지막에 경계 안으로 clamp(양끝). 경계가 메뉴보다
 * 작으면(담을 수 없음) 시작을 boundaryStart 로 핀(소비자가 스크롤 가드로 처리).
 */
export function fitAxisStart(
  preferredStart: number,
  altStart: number,
  size: number,
  boundaryStart: number,
  boundaryEnd: number,
): number {
  const fits = (s: number): boolean => s >= boundaryStart && s + size <= boundaryEnd;
  let start: number;
  if (fits(preferredStart)) start = preferredStart;
  else if (fits(altStart)) start = altStart;
  else {
    const roomPreferred = boundaryEnd - preferredStart; // 기본 방향(오른쪽/아래) 여유
    const roomAlt = altStart + size - boundaryStart; // 대체 방향(왼쪽/위) 여유
    start = roomPreferred >= roomAlt ? preferredStart : altStart;
  }
  if (boundaryEnd - boundaryStart <= size) return boundaryStart; // 경계가 더 작음 → 시작에 핀
  return Math.max(boundaryStart, Math.min(start, boundaryEnd - size));
}

/**
 * 옆으로 여는 플라이아웃(AI 다이어그램 서브메뉴)의 앵커(=offsetParent) 기준 오프셋. 기본은 앵커
 * 오른쪽에 열고(gap 만큼 띄움), 오른쪽이 잘리면 왼쪽으로 뒤집은 뒤 경계 안으로 clamp. 세로는 앵커
 * 상단 정렬(아래로 성장)이 기본, 아래가 잘리면 앵커 하단 정렬(위로 성장) 후 clamp.
 */
export function computeFlyoutOffset(anchor: Rect, size: Size, clip: ClipBoundary, gap: number): Offset {
  const left = fitAxisStart(anchor.right + gap, anchor.left - size.width - gap, size.width, clip.left, clip.right);
  const top = fitAxisStart(anchor.top, anchor.bottom - size.height, size.height, clip.top, clip.bottom);
  return { left: left - anchor.left, top: top - anchor.top };
}

/**
 * 아래로 여는 드롭다운(툴바 표 피커/다이어그램 메뉴)의 앵커(=offsetParent) 기준 오프셋. 기본은 앵커
 * 왼쪽 정렬(아래로, gap 만큼 띄움), 오른쪽이 잘리면 앵커 오른쪽 정렬로 뒤집은 뒤 경계 안으로 clamp.
 * 세로는 아래가 기본, 아래가 잘리면 위로 뒤집은 뒤 clamp.
 */
export function computeDropdownOffset(anchor: Rect, size: Size, clip: ClipBoundary, gap: number): Offset {
  const left = fitAxisStart(anchor.left, anchor.right - size.width, size.width, clip.left, clip.right);
  const top = fitAxisStart(anchor.bottom + gap, anchor.top - size.height - gap, size.height, clip.top, clip.bottom);
  return { left: left - anchor.left, top: top - anchor.top };
}
