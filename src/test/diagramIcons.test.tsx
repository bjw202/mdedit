// @MX:SPEC: SPEC-UI-008
// Tests for the 7 preset diagram skeleton icons (REQ-002, REQ-003, AC-002).
// TDD RED phase: written before the icons are added to icons.tsx.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Icons from '@/components/icons';

const DIAGRAM_ICON_NAMES = [
  'FlowchartIcon',
  'SequenceDiagramIcon',
  'GanttIcon',
  'ClassDiagramIcon',
  'StateDiagramIcon',
  'PieChartIcon',
  'MindmapIcon',
] as const;

describe('diagram preset icons', () => {
  it('exports all 7 preset icons from the barrel', () => {
    for (const name of DIAGRAM_ICON_NAMES) {
      expect(typeof (Icons as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('renders each icon as an <svg> that inherits stroke="currentColor"', () => {
    for (const name of DIAGRAM_ICON_NAMES) {
      const Icon = (Icons as Record<string, (p: unknown) => JSX.Element>)[name];
      const markup = renderToStaticMarkup(<Icon />);
      expect(markup.startsWith('<svg')).toBe(true);
      expect(markup).toContain('stroke="currentColor"');
      // no hard-coded color literals
      expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  it('gives each of the 7 icons a distinct inner markup (no two share a shape)', () => {
    const inner = DIAGRAM_ICON_NAMES.map((name) => {
      const Icon = (Icons as Record<string, (p: unknown) => JSX.Element>)[name];
      const markup = renderToStaticMarkup(<Icon />);
      // strip the outer <svg ...> wrapper to compare only the shape paths
      return markup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    });
    const unique = new Set(inner);
    expect(unique.size).toBe(DIAGRAM_ICON_NAMES.length);
  });
});

// @MX:SPEC: SPEC-AI-008
// AC-AI-008-014 (D3): 아이콘 SVG 마크업을 명령형 서브메뉴와 공유하는 단일 소스로 추출하는
// 리팩터 전/후, SPEC-UI-008 JSX 아이콘 7종의 렌더 SVG가 바이트 동일해야 한다. 아래 스냅샷은
// 추출 리팩터 전에 캡처한 기준선이다(Pre-RED, T-001).
const DIAGRAM_ICON_RENDER_SNAPSHOT: Record<string, string> = {
  FlowchartIcon:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="10" height="5" rx="1"></rect><path d="M9 8v4"></path><rect x="4" y="12" width="10" height="5" rx="1"></rect><path d="M14 14.5h4V20"></path></svg>',
  SequenceDiagramIcon:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v18"></path><path d="M18 3v18"></path><path d="M6 9h12"></path><path d="m15 6 3 3-3 3"></path></svg>',
  GanttIcon:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h9"></path><path d="M7 10h11"></path><path d="M5 16h8"></path></svg>',
  ClassDiagramIcon:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="1"></rect><path d="M5 9h14"></path><path d="M8 13h8"></path><path d="M8 16h6"></path></svg>',
  StateDiagramIcon:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="7" r="3"></circle><circle cx="18" cy="17" r="3"></circle><path d="M8.5 9.5 15 15"></path></svg>',
  PieChartIcon:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v9l6.4 6.4"></path></svg>',
  MindmapIcon:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M14.5 10 19 5"></path><path d="M14.5 14 19 19"></path><path d="M9 12H4"></path></svg>',
};

describe('diagram preset icons: byte-identity across single-source extraction (SPEC-AI-008 AC-014)', () => {
  it('renders each JSX icon byte-identically to the pre-extraction snapshot', () => {
    for (const name of DIAGRAM_ICON_NAMES) {
      const Icon = (Icons as Record<string, (p: unknown) => JSX.Element>)[name];
      const markup = renderToStaticMarkup(<Icon />);
      expect(markup).toBe(DIAGRAM_ICON_RENDER_SNAPSHOT[name]);
    }
  });
});
