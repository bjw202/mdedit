// @MX:NOTE: Markdown editor formatting toolbar component
// Provides format buttons (Bold, Italic, H1-H3, UL, OL, Code, Link, Quote)
// Calls onFormat callback with format type string for each button click.

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
  label: string;
  action: FormatAction;
  title: string;
  onFormat?: (action: FormatAction) => void;
}

function ToolbarButton({ label, action, title, onFormat }: ToolbarButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={() => onFormat?.(action)}
      className="
        px-2 py-1 text-sm font-medium
        text-gray-700 dark:text-gray-300
        hover:bg-gray-200 dark:hover:bg-gray-700
        rounded transition-colors duration-100
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
      "
    >
      {label}
    </button>
  );
}

const TOOLBAR_BUTTONS: Array<{ label: string; action: FormatAction; title: string }> = [
  { label: 'B',   action: 'bold',   title: 'Bold (Ctrl+B)' },
  { label: 'I',   action: 'italic', title: 'Italic (Ctrl+I)' },
  { label: 'H1',  action: 'h1',     title: 'H1 Heading' },
  { label: 'H2',  action: 'h2',     title: 'H2 Heading' },
  { label: 'H3',  action: 'h3',     title: 'H3 Heading' },
  { label: '•',   action: 'ul',     title: 'Unordered List' },
  { label: '1.',  action: 'ol',     title: 'Ordered List' },
  { label: '</>',  action: 'code',   title: 'Code' },
  { label: '🔗',  action: 'link',   title: 'Link' },
  { label: '"',   action: 'quote',  title: 'Blockquote (Quote)' },
  { label: '🖼',  action: 'image',  title: 'Insert Image (Cmd+Shift+I)' },
];

/**
 * EditorToolbar - Markdown formatting buttons toolbar.
 *
 * Renders a horizontal row of buttons for common Markdown formatting operations.
 * Each button calls onFormat with the corresponding FormatAction type.
 */
export function EditorToolbar({ onFormat }: EditorToolbarProps): JSX.Element {
  return (
    <div
      role="toolbar"
      aria-label="Markdown formatting toolbar"
      className="
        flex flex-row items-center gap-1 px-2 py-1
        border-b border-gray-200 dark:border-gray-700
        bg-gray-50 dark:bg-gray-800
      "
    >
      {TOOLBAR_BUTTONS.map(({ label, action, title }) => (
        <ToolbarButton
          key={action}
          label={label}
          action={action}
          title={title}
          onFormat={onFormat}
        />
      ))}
    </div>
  );
}
