import { usePreview } from '@/hooks/usePreview';
import { PreviewRenderer } from './PreviewRenderer';

// @MX:NOTE: [AUTO] Main preview panel container - replaces PlaceholderPreview in AppLayout
// Wraps usePreview hook and PreviewRenderer for the 3-pane layout
// @MX:SPEC: SPEC-PREVIEW-001

/**
 * Markdown preview panel component.
 *
 * Displays a rendered HTML preview of the current editor content.
 * Shows a placeholder when there is no content to render.
 */
export function MarkdownPreview(): JSX.Element {
  const { html } = usePreview();

  return (
    <div className="h-full overflow-y-auto p-4">
      {html ? (
        <PreviewRenderer html={html} />
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm select-none">
          Start writing...
        </div>
      )}
    </div>
  );
}
