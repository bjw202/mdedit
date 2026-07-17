import React from 'react';
import { colors, font, fontSize, lineHeight, space } from '../tokens';

/**
 * Markdown-rendered look approximating mdedit's preview pane
 * (src/styles/mdedit-components.css .md-preview and children).
 *
 * Deliberately NOT a markdown parser — scene authors compose these typed
 * blocks directly, mirroring the same content that EditorPane types out,
 * so the two panes stay in perfect lockstep without a heavyweight md library.
 */

export function PreviewPane({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}): JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: colors.bg,
        borderLeft: `1px solid ${colors.border}`,
        padding: space[5],
        fontSize: fontSize.preview,
        lineHeight: lineHeight.preview,
        color: colors.textPrimary,
        fontFamily: font.ui,
        maxWidth: 680,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PreviewH1({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h1
      style={{
        fontFamily: font.display,
        fontWeight: 600,
        lineHeight: 1.15,
        margin: '0.2em 0 0.5em',
        fontSize: fontSize.previewH1,
      }}
    >
      {children}
    </h1>
  );
}

export function PreviewH2({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h2
      style={{
        fontFamily: font.display,
        fontWeight: 600,
        lineHeight: 1.15,
        margin: '1.4em 0 0.5em',
        fontSize: fontSize.previewH2,
      }}
    >
      {children}
    </h2>
  );
}

export function PreviewH3({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h3
      style={{
        fontFamily: font.display,
        fontWeight: 600,
        lineHeight: 1.15,
        margin: '1.4em 0 0.5em',
        fontSize: fontSize.previewH3,
      }}
    >
      {children}
    </h3>
  );
}

export function PreviewParagraph({ children }: { children: React.ReactNode }): JSX.Element {
  return <p style={{ margin: '0 0 1em' }}>{children}</p>;
}

export function PreviewBold({ children }: { children: React.ReactNode }): JSX.Element {
  return <strong style={{ fontWeight: 700 }}>{children}</strong>;
}

export function PreviewItalic({ children }: { children: React.ReactNode }): JSX.Element {
  return <em>{children}</em>;
}

export function PreviewStrike({ children }: { children: React.ReactNode }): JSX.Element {
  return <s>{children}</s>;
}

export function PreviewInlineCode({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <code
      style={{
        fontFamily: font.mono,
        fontSize: '0.85em',
        background: colors.codeBg,
        borderRadius: 3,
        padding: '0.1em 0.35em',
      }}
    >
      {children}
    </code>
  );
}

export function PreviewCodeBlock({
  children,
  lang,
}: {
  children: string;
  lang?: string;
}): JSX.Element {
  return (
    <pre
      style={{
        fontFamily: font.mono,
        fontSize: 13.5,
        lineHeight: 1.6,
        background: colors.codeBg,
        borderRadius: 5,
        padding: space[3],
        overflow: 'auto',
        margin: '0 0 1em',
      }}
    >
      {lang && (
        <div style={{ color: colors.textFaint, fontSize: 11, marginBottom: 4 }}>{lang}</div>
      )}
      <code>{children}</code>
    </pre>
  );
}

export function PreviewList({
  ordered = false,
  items,
}: {
  ordered?: boolean;
  items: React.ReactNode[];
}): JSX.Element {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag style={{ margin: '0 0 1em', paddingLeft: '1.4em' }}>
      {items.map((item, i) => (
        <li key={i} style={{ margin: '0.2em 0' }}>
          {item}
        </li>
      ))}
    </Tag>
  );
}

export function PreviewBlockquote({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <blockquote
      style={{
        margin: '0 0 1em',
        padding: `0 0 0 ${space[4]}px`,
        borderLeft: `3px solid ${colors.border}`,
        color: colors.textMuted,
      }}
    >
      {children}
    </blockquote>
  );
}

export function PreviewTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}): JSX.Element {
  return (
    <table
      style={{
        borderCollapse: 'collapse',
        width: '100%',
        margin: '0 0 1em',
        fontSize: 14,
      }}
    >
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              style={{
                textAlign: 'left',
                border: `1px solid ${colors.border}`,
                padding: '0.4em 0.6em',
                background: colors.surface,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td
                key={c}
                style={{ border: `1px solid ${colors.border}`, padding: '0.4em 0.6em' }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PreviewImage({ src, alt }: { src: string; alt?: string }): JSX.Element {
  return (
    <img
      src={src}
      alt={alt}
      style={{
        maxWidth: '100%',
        borderRadius: 4,
        border: `1px solid ${colors.border}`,
        display: 'block',
        margin: '0 0 1em',
      }}
    />
  );
}
