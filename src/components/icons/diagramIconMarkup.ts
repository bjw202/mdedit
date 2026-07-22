// @MX:NOTE: [AUTO] SPEC-AI-008 다이어그램 아이콘 7종 SVG inner 마크업 단일 소스.
// JSX 컴포넌트(icons.tsx FlowchartIcon~MindmapIcon)와 명령형 서브메뉴(ai-selection-toolbar.ts)가
// 함께 이 상수를 소비한다 — path 데이터를 두 곳에 중복 타이핑하지 않는다(REQ-AI-008-023).
// 마크업은 renderToStaticMarkup(JSX) 출력 형식과 바이트 동일하다(child 요소는 명시적 닫는 태그).
// @MX:SPEC: SPEC-AI-008
import type { DiagramType } from '@/components/editor/extensions/keyboard-shortcuts';

/** 7종 다이어그램 아이콘의 `<svg>` inner 마크업(단일 소스). */
export const DIAGRAM_ICON_INNER: Record<DiagramType, string> = {
  flowchart:
    '<rect x="4" y="3" width="10" height="5" rx="1"></rect><path d="M9 8v4"></path><rect x="4" y="12" width="10" height="5" rx="1"></rect><path d="M14 14.5h4V20"></path>',
  sequenceDiagram:
    '<path d="M6 3v18"></path><path d="M18 3v18"></path><path d="M6 9h12"></path><path d="m15 6 3 3-3 3"></path>',
  gantt: '<path d="M3 4h9"></path><path d="M7 10h11"></path><path d="M5 16h8"></path>',
  classDiagram:
    '<rect x="5" y="4" width="14" height="16" rx="1"></rect><path d="M5 9h14"></path><path d="M8 13h8"></path><path d="M8 16h6"></path>',
  stateDiagram:
    '<circle cx="6" cy="7" r="3"></circle><circle cx="18" cy="17" r="3"></circle><path d="M8.5 9.5 15 15"></path>',
  pie: '<circle cx="12" cy="12" r="9"></circle><path d="M12 3v9l6.4 6.4"></path>',
  mindmap:
    '<circle cx="12" cy="12" r="3"></circle><path d="M14.5 10 19 5"></path><path d="M14.5 14 19 19"></path><path d="M9 12H4"></path>',
};
