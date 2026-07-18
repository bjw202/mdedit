import React from 'react';
import { colors, font, radius, space } from '../tokens';

export interface HighlightProps {
  /** Spotlight rectangle in pixels, relative to the enclosing AppFrame. */
  rect: { x: number; y: number; width: number; height: number };
  label?: string;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Dimmed-overlay + spotlight rectangle with a label callout, for S2a's
 * region-by-region walkthrough (file explorer / editor / header tools).
 */
export function Highlight({ rect, label, labelPosition = 'bottom' }: HighlightProps): JSX.Element {
  const pad = 6;
  const spotlight = {
    left: rect.x - pad,
    top: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  const labelStyle: React.CSSProperties = { position: 'absolute' };
  switch (labelPosition) {
    case 'top':
      labelStyle.left = spotlight.left;
      labelStyle.top = spotlight.top - 44;
      break;
    case 'bottom':
      labelStyle.left = spotlight.left;
      labelStyle.top = spotlight.top + spotlight.height + 12;
      break;
    case 'left':
      labelStyle.left = spotlight.left - 220;
      labelStyle.top = spotlight.top;
      break;
    case 'right':
      labelStyle.left = spotlight.left + spotlight.width + 12;
      labelStyle.top = spotlight.top;
      break;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
      {/* Dimmed overlay with a rectangular cutout via box-shadow spread trick */}
      <div
        style={{
          position: 'absolute',
          left: spotlight.left,
          top: spotlight.top,
          width: spotlight.width,
          height: spotlight.height,
          borderRadius: radius.md,
          boxShadow: '0 0 0 9999px rgba(15, 16, 17, 0.62)',
          border: `2px solid ${colors.accent}`,
        }}
      />
      {label && (
        <div
          style={{
            ...labelStyle,
            maxWidth: 220,
            background: colors.accent,
            color: colors.accentContrast,
            fontFamily: font.ui,
            fontSize: 16,
            fontWeight: 600,
            padding: `${space[2]}px ${space[3]}px`,
            borderRadius: radius.md,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
