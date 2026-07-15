// @MX:NOTE: Markdown editor formatting toolbar component
// Provides format buttons (Bold, Italic, H1-H3, UL, OL, Code, Link, Quote)
// Calls onFormat callback with format type string for each button click.

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
  ImageIcon,
  type IconProps,
} from '@/components/icons';

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
const TOOLBAR_BUTTONS: Array<{ Icon: (props: IconProps) => JSX.Element; action: FormatAction; title: string }> = [
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
  { Icon: ImageIcon,     action: 'image',  title: 'Insert Image (Cmd+Shift+I)' },
];

/**
 * EditorToolbar - Markdown formatting buttons toolbar.
 *
 * Renders a horizontal row of buttons for common Markdown formatting operations.
 * Each button calls onFormat with the corresponding FormatAction type.
 */
export function EditorToolbar({ onFormat }: EditorToolbarProps): JSX.Element {
  return (
    <div role="toolbar" aria-label="Markdown formatting toolbar" className="md-toolbar">
      {TOOLBAR_BUTTONS.map(({ Icon, action, title }, i) => (
        <ToolbarButton
          key={`${action}-${i}`}
          Icon={Icon}
          action={action}
          title={title}
          onFormat={onFormat}
        />
      ))}
    </div>
  );
}
