import type { RefObject } from 'react';
import { usePreview } from '@/hooks/usePreview';
import { useUIStore } from '@/store/uiStore';
import { getPreviewZoom } from '@/lib/preview/previewZoom';
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
  // fontSize를 zoom 비율로 변환 — 헤딩·코드 등 고정 Tailwind 크기 포함 전체 비례 스케일
  const zoom = getPreviewZoom(fontSize);

  return (
    <div ref={previewRef} className="h-full overflow-auto p-4 preview-scroll">
      {html ? (
        <PreviewRenderer html={html} zoom={zoom} />
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm select-none">
          Start writing...
        </div>
      )}
    </div>
  );
}
