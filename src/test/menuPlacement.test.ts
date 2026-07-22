// @MX:SPEC: SPEC-AI-008
// 좁은 창에서 다이어그램 메뉴가 화면 밖으로 잘리는 실기기 결함(뷰포트 경계 인지 배치) 회귀 방어.
// 두 메뉴(AI 플라이아웃 서브메뉴, 툴바 드롭다운)가 공유하는 순수 오버플로 판정 헬퍼.
import { describe, it, expect } from 'vitest';
import { wouldOverflowRight, wouldOverflowBottom } from '@/lib/ui/menuPlacement';

describe('menuPlacement pure helpers', () => {
  it('wouldOverflowRight: true only when leftEdge + width exceeds the viewport right', () => {
    expect(wouldOverflowRight(900, 200, 1000)).toBe(true); // 1100 > 1000
    expect(wouldOverflowRight(700, 200, 1000)).toBe(false); // 900 <= 1000
    expect(wouldOverflowRight(800, 200, 1000)).toBe(false); // exactly fits (1000)
  });

  it('wouldOverflowBottom: true only when topEdge + height exceeds the viewport bottom', () => {
    expect(wouldOverflowBottom(700, 200, 800)).toBe(true); // 900 > 800
    expect(wouldOverflowBottom(500, 200, 800)).toBe(false); // 700 <= 800
    expect(wouldOverflowBottom(600, 200, 800)).toBe(false); // exactly fits (800)
  });
});
