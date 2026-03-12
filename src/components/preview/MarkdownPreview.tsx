import type { RefObject } from 'react';
import { usePreview } from '@/hooks/usePreview';
import { useUIStore } from '@/store/uiStore';
import { PreviewRenderer } from './PreviewRenderer';

// @MX:NOTE: [AUTO] Main preview panel container - replaces PlaceholderPreview in AppLayout
// Wraps usePreview hook and PreviewRenderer for the 3-pane layout
// @MX:SPEC: SPEC-PREVIEW-001, SPEC-PREVIEW-002

interface MarkdownPreviewProps {
  /** Ref to the scrollable preview container for scroll sync */
  previewRef?: RefObject<HTMLDivElement>;
}

/**
 * Markdown preview panel component.
 *
 * Displays a rendered HTML preview of the current editor content.
 * Shows a placeholder when there is no content to render.
 * Accepts a previewRef for scroll synchronization.
 */
export function MarkdownPreview({ previewRef }: MarkdownPreviewProps): JSX.Element {
  const { html } = usePreview();
  const fontSize = useUIStore((s) => s.fontSize);

  return (
    <div ref={previewRef} className="h-full overflow-auto p-4 preview-scroll">
      {html ? (
        <PreviewRenderer html={html} fontSize={fontSize} />
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm select-none">
          Start writing...
        </div>
      )}
    </div>
  );
}
