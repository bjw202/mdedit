// @MX:NOTE: Markdown editor formatting toolbar component
// Provides format buttons (Bold, Italic, H1-H3, UL, OL, Code, Link, Quote, Insert Table, Image)
// Calls onFormat callback with format type string for each button click.
// SPEC-UI-007: Insert Table uses a dedicated onInsertTable(rows, cols) callback instead of
// widening the onFormat/FormatAction contract (see keyboard-shortcuts.ts insertTable helper).

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  CodeIcon,
  LinkIcon,
  TextQuoteIcon,
  TableIcon,
  ImageIcon,
  FlowchartIcon,
  SequenceDiagramIcon,
  GanttIcon,
  ClassDiagramIcon,
  StateDiagramIcon,
  PieChartIcon,
  MindmapIcon,
  type IconProps,
} from '@/components/icons';
import { DIAGRAM_PRESETS, type DiagramPreset } from '@/components/editor/extensions/keyboard-shortcuts';
import { wouldOverflowRight } from '@/lib/ui/menuPlacement';

/**
 * Supported format action types for the toolbar.
 */
export type FormatAction =
  | 'bold'
  | 'italic'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'ul'
  | 'ol'
  | 'code'
  | 'link'
  | 'quote'
  | 'image';

interface EditorToolbarProps {
  /** Called when a format button is clicked, with the format action type */
  onFormat?: (action: FormatAction) => void;
  /** Called when a table grid cell is clicked, with (rows, cols) — rows includes the header row */
  onInsertTable?: (rows: number, cols: number) => void;
  /** SPEC-UI-008: Called when a diagram preset menu item is chosen */
  onInsertDiagram?: (preset: DiagramPreset) => void;
}

interface ToolbarButtonProps {
  Icon: (props: IconProps) => JSX.Element;
  action: FormatAction;
  title: string;
  onFormat?: (action: FormatAction) => void;
}

function ToolbarButton({ Icon, action, title, onFormat }: ToolbarButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={() => onFormat?.(action)}
      className="md-tool-btn"
    >
      <Icon width={15} height={15} />
    </button>
  );
}

// SPEC-UI-006 Icon Mapping: 텍스트 글리프('•'/'1.'/'</>'/'🔗'/'"'/'🖼')를 핸드오프 Lucide SVG로 교체.
// ol(Ordered List)은 핸드오프 아이콘 목록에 전용 매핑이 없으므로 list 아이콘을 재사용한다(회귀 없음).
// SPEC-UI-007: 배열은 Quote까지(단순 액션 버튼)만 담고, Insert Table 그리드 피커와 Image 버튼은
// EditorToolbar 본문에서 별도로 렌더링한다(Quote–Image 사이 배치).
const TOOLBAR_BUTTONS_BEFORE_TABLE: Array<{
  Icon: (props: IconProps) => JSX.Element;
  action: FormatAction;
  title: string;
}> = [
  { Icon: BoldIcon,      action: 'bold',   title: 'Bold (Ctrl+B)' },
  { Icon: ItalicIcon,    action: 'italic', title: 'Italic (Ctrl+I)' },
  { Icon: Heading1Icon,  action: 'h1',     title: 'H1 Heading' },
  { Icon: Heading2Icon,  action: 'h2',     title: 'H2 Heading' },
  { Icon: Heading3Icon,  action: 'h3',     title: 'H3 Heading' },
  { Icon: ListIcon,      action: 'ul',     title: 'Unordered List' },
  { Icon: ListIcon,      action: 'ol',     title: 'Ordered List' },
  { Icon: CodeIcon,      action: 'code',   title: 'Code' },
  { Icon: LinkIcon,      action: 'link',   title: 'Link' },
  { Icon: TextQuoteIcon, action: 'quote',  title: 'Blockquote (Quote)' },
];

const TABLE_GRID_SIZE = 8;

interface TableGridPickerProps {
  onInsertTable?: (rows: number, cols: number) => void;
}

// @MX:NOTE: 팝오버는 외부 mousedown(Header.tsx export-menu 패턴) AND Escape 키 양쪽으로 닫힌다.
// Escape 리스너는 열려 있을 때만 등록하고 닫힘/언마운트 시 해제한다(선례 없는 신규 패턴, 범위 명시).
// @MX:SPEC: SPEC-UI-007
function TableGridPicker({ onInsertTable }: TableGridPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);
  // 좁은 창(오른쪽 근처)에서 left-0 그리드 피커가 화면 밖으로 잘리면 right-0 정렬로 뒤집는다.
  const [alignRight, setAlignRight] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // @MX:NOTE: [AUTO] SPEC-UI-007 후속(좁은 창): 열림 시 다음 프레임에 피커 rect 를 측정해 left-0
  // 기본 정렬이 오른쪽 뷰포트 경계를 넘으면 right-0 으로 뒤집는다(DiagramInsertMenu 와 동일 패턴).
  // @MX:SPEC: SPEC-UI-007
  useEffect(() => {
    if (!open) {
      setAlignRight(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const el = pickerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAlignRight(wouldOverflowRight(r.left, r.width, window.innerWidth));
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const handleCellClick = (rows: number, cols: number): void => {
    onInsertTable?.(rows, cols);
    setOpen(false);
    setHovered(null);
  };

  const rows = Array.from({ length: TABLE_GRID_SIZE }, (_, i) => i + 1);
  const cols = Array.from({ length: TABLE_GRID_SIZE }, (_, i) => i + 1);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        aria-label="Insert Table"
        title="Insert Table"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="md-tool-btn"
      >
        <TableIcon width={15} height={15} />
      </button>

      {open && (
        <div
          ref={pickerRef}
          className={`md-table-picker absolute ${alignRight ? 'right-0' : 'left-0'} top-full z-50`}
        >
          <div className="md-table-picker-grid" onMouseLeave={() => setHovered(null)}>
            {rows.map((r) => (
              <div key={r} className="md-table-picker-row">
                {cols.map((c) => {
                  const isArmed = hovered !== null && r <= hovered.row && c <= hovered.col;
                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      aria-label={`Insert ${r} by ${c} table`}
                      className={`md-table-picker-cell${isArmed ? ' is-armed' : ''}`}
                      onMouseOver={() => setHovered({ row: r, col: c })}
                      onClick={() => handleCellClick(r, c)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="md-table-picker-label">
            {hovered ? `${hovered.row} × ${hovered.col}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

// SPEC-UI-008: 프리셋 → 흑백 스켈레톤 아이콘 매핑(custom은 아이콘 없음, 라벨만).
const DIAGRAM_ICONS: Partial<Record<DiagramPreset, (props: IconProps) => JSX.Element>> = {
  flowchart: FlowchartIcon,
  sequenceDiagram: SequenceDiagramIcon,
  gantt: GanttIcon,
  classDiagram: ClassDiagramIcon,
  stateDiagram: StateDiagramIcon,
  pie: PieChartIcon,
  mindmap: MindmapIcon,
};

interface DiagramInsertMenuProps {
  onInsertDiagram?: (preset: DiagramPreset) => void;
}

// @MX:NOTE: [AUTO] 다이어그램 드롭다운 — TableGridPicker와 동일한 팝오버 셸(외부 mousedown +
// Escape 이중 닫힘)을 세로 리스트로 재사용한다. 방향키는 항목 포커스를 순회 이동시키고(래핑),
// Enter/Space는 preventDefault 후 포커스 항목을 선택해 네이티브 버튼 활성화와의 이중 발화를 막는다.
// 리스트/항목 스타일은 기존 .md-menu/.md-menu-item 토큰 클래스를 재사용한다.
// @MX:SPEC: SPEC-UI-008
function DiagramInsertMenu({ onInsertDiagram }: DiagramInsertMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  // 좁은 창(오른쪽 근처)에서 left-0 드롭다운이 화면 밖으로 잘리면 right-0 정렬로 뒤집는다.
  const [alignRight, setAlignRight] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // @MX:NOTE: [AUTO] SPEC-UI-008 후속(좁은 창): 열림 시 다음 프레임에 드롭다운 rect 를 측정해
  // left-0 기본 정렬이 오른쪽 뷰포트 경계를 넘으면 right-0 으로 뒤집는다(순수 판정은 menuPlacement).
  // @MX:SPEC: SPEC-UI-008
  useEffect(() => {
    if (!open) {
      setAlignRight(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const el = menuRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAlignRight(wouldOverflowRight(r.left, r.width, window.innerWidth));
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const handleSelect = (preset: DiagramPreset): void => {
    onInsertDiagram?.(preset);
    setOpen(false);
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    if (items.length === 0) return;
    const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = (activeIndex + delta + items.length) % items.length;
      items[next]?.focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(DIAGRAM_PRESETS[activeIndex].preset);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        aria-label="다이어그램 삽입"
        title="다이어그램 삽입"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="md-tool-btn"
      >
        <FlowchartIcon width={15} height={15} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className={`md-menu absolute ${alignRight ? 'right-0' : 'left-0'} top-full z-50 mt-1`}
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          {DIAGRAM_PRESETS.map((def, i) => {
            const Icon = DIAGRAM_ICONS[def.preset];
            return (
              <button
                key={def.preset}
                type="button"
                role="menuitem"
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                aria-label={`${def.label} 삽입`}
                className="md-menu-item"
                onClick={() => handleSelect(def.preset)}
              >
                {Icon ? <Icon width={15} height={15} /> : null}
                <span>{def.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * EditorToolbar - Markdown formatting buttons toolbar.
 *
 * Renders a horizontal row of buttons for common Markdown formatting operations.
 * Each button calls onFormat with the corresponding FormatAction type.
 * The Insert Table button (between Quote and Image) opens a grid-picker popover
 * and reports selections via onInsertTable(rows, cols). The Diagram button
 * (SPEC-UI-008) opens a dropdown of mermaid preset snippets via onInsertDiagram(preset).
 */
export function EditorToolbar({ onFormat, onInsertTable, onInsertDiagram }: EditorToolbarProps): JSX.Element {
  return (
    <div role="toolbar" aria-label="Markdown formatting toolbar" className="md-toolbar">
      {TOOLBAR_BUTTONS_BEFORE_TABLE.map(({ Icon, action, title }, i) => (
        <ToolbarButton
          key={`${action}-${i}`}
          Icon={Icon}
          action={action}
          title={title}
          onFormat={onFormat}
        />
      ))}
      <TableGridPicker onInsertTable={onInsertTable} />
      <DiagramInsertMenu onInsertDiagram={onInsertDiagram} />
      <ToolbarButton
        Icon={ImageIcon}
        action="image"
        title="Insert Image (Cmd+Shift+I)"
        onFormat={onFormat}
      />
    </div>
  );
}
