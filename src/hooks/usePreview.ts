import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';
import { renderMarkdown } from '@/lib/markdown/renderer';
import { getHighlighter } from '@/lib/markdown/codeHighlight';
import type { ShikiHighlighter } from '@/lib/markdown/codeHighlight';

// @MX:ANCHOR: [AUTO] Preview rendering hook - consumed by MarkdownPreview component
// @MX:REASON: [AUTO] Public API boundary for debounced markdown rendering (fan_in >= 3)
// @MX:SPEC: SPEC-PREVIEW-001

// @MX:NOTE: [AUTO] DEBOUNCE_MS = 300ms - debounce delay before triggering markdown re-render; balances responsiveness and CPU usage
/** Debounce delay in milliseconds before triggering markdown re-render */
const DEBOUNCE_MS = 300;

/** Return type for the usePreview hook */
interface PreviewState {
  html: string;
  isLoading: boolean;
}

/**
 * Custom hook that subscribes to editor content and returns debounced HTML.
 *
 * - Waits 300ms after the last content change before rendering
 * - Keeps the previous HTML while re-rendering (smooth update)
 * - Handles rendering errors gracefully (keeps previous HTML on failure)
 */
export function usePreview(): PreviewState {
  const [html, setHtml] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [highlighter, setHighlighter] = useState<ShikiHighlighter | null>(null);

  const content = useEditorStore((s) => s.content);
  // Subscribe to theme so re-render triggers when user switches dark/light mode
  const theme = useUIStore((s) => s.theme);

  // Initialize Shiki highlighter once on mount
  useEffect(() => {
    getHighlighter()
      .then((h) => setHighlighter(h))
      .catch(() => {
        // Continue without syntax highlighting on initialization failure
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(true);
      // Read current dark state from the DOM class applied by useTheme()
      const isDark = document.documentElement.classList.contains('dark');
      renderMarkdown(content, highlighter, isDark)
        .then((rendered) => {
          setHtml(rendered);
        })
        .catch(() => {
          // Keep previous HTML on rendering error - do not update html state
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [content, highlighter, theme]);

  return { html, isLoading };
}
