import React from 'react';
import { colors, font, radius, shadow } from '../tokens';

export interface KeycapProps {
  /** Key labels in order, e.g. ['⌘', '⏎'] for Cmd+Enter. */
  keys: string[];
}

/** Keyboard shortcut visual (e.g. Cmd+Enter rendered as two adjacent keycaps). */
export function Keycap({ keys }: KeycapProps): JSX.Element {
  return (
    <span style={{ display: 'inline-flex', gap: 4, verticalAlign: 'middle' }}>
      {keys.map((k, i) => (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 28,
            height: 28,
            padding: '0 6px',
            fontFamily: font.mono,
            fontSize: 15,
            fontWeight: 600,
            color: colors.textPrimary,
            background: colors.surfaceRaised,
            border: `1px solid ${colors.borderStrong}`,
            borderBottom: `2px solid ${colors.borderStrong}`,
            borderRadius: radius.sm,
            boxShadow: shadow.sm,
          }}
        >
          {k}
        </span>
      ))}
    </span>
  );
}
