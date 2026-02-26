import { createHighlighter } from 'shiki';

// @MX:ANCHOR: [AUTO] getHighlighter - shared Shiki singleton used by renderer, usePreview, exportHtml
// @MX:REASON: [AUTO] Called by multiple modules; singleton prevents redundant initialization (fan_in >= 3)
// @MX:NOTE: [AUTO] Shiki singleton - lazy-initialized to avoid blocking startup
// Uses Shiki v1 API (createHighlighter, not deprecated getHighlighter)
// @MX:SPEC: SPEC-PREVIEW-001

type ShikiHighlighter = Awaited<ReturnType<typeof createHighlighter>>;

let highlighterInstance: ShikiHighlighter | null = null;

/**
 * Returns the shared Shiki highlighter instance, creating it on first call.
 * Subsequent calls return the cached instance without re-initialization.
 */
export async function getHighlighter(): Promise<ShikiHighlighter> {
  if (!highlighterInstance) {
    highlighterInstance = await createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [
        'javascript',
        'typescript',
        'python',
        'rust',
        'go',
        'json',
        'yaml',
        'bash',
        'markdown',
        'css',
        'html',
      ],
    });
  }
  return highlighterInstance;
}

/** Exported type for use in renderMarkdown signature */
export type { ShikiHighlighter };
