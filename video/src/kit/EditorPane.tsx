import React from 'react';
import { colors, font, fontSize, lineHeight, space } from '../tokens';
import { TypingText, type TypingTextProps } from './TypingText';

export interface EditorPaneProps {
  /** Lines of source text. Each line can be a plain string (typed together) or a TypingText config. */
  lines: Array<string | (Omit<TypingTextProps, 'text'> & { text: string })>;
  showLineNumbers?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Monospace editor look approximating mdedit's CodeMirror pane
 * (src/styles/mdedit-components.css .md-editorpane / .cm-content —
 * font-family: var(--md-font-mono), font-size: var(--md-fs-editor)).
 */
export function EditorPane({
  lines,
  showLineNumbers = true,
  className,
  style,
}: EditorPaneProps): JSX.Element {
  return (
    <div
      className={className}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: colors.surfaceRaised,
        fontFamily: font.mono,
        fontSize: fontSize.editor,
        lineHeight: lineHeight.editor,
        color: colors.textPrimary,
        display: 'flex',
        padding: `${space[3]}px 0`,
        ...style,
      }}
    >
      {showLineNumbers && (
        <div
          style={{
            flex: 'none',
            width: 40,
            textAlign: 'right',
            paddingRight: space[3],
            color: colors.textFaint,
            userSelect: 'none',
          }}
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}
      <div style={{ flex: 1, paddingLeft: showLineNumbers ? 0 : space[4] }}>
        {lines.map((line, i) => {
          if (typeof line === 'string') {
            return <div key={i}>{line || ' '}</div>;
          }
          const { text, ...typingProps } = line;
          return (
            <div key={i}>
              <TypingText text={text} {...typingProps} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
