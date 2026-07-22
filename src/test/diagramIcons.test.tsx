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
