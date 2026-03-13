import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// @MX:ANCHOR: [AUTO] PreviewRenderer - renders sanitized HTML and triggers mermaid diagram rendering
// @MX:REASON: [AUTO] Central render target used by MarkdownPreview and exported HTML functions (fan_in >= 3)
// @MX:SPEC: SPEC-PREVIEW-001
// @MX:NOTE: [AUTO] dangerouslySetInnerHTML is intentionally used here
// This is safe because markdown-it renders with html:false which blocks raw HTML injection
// @MX:WARN: [AUTO] mermaid.render() is async inside forEach - errors per-diagram are caught individually
// @MX:REASON: [AUTO] One broken diagram must not prevent other diagrams or the preview from rendering
// @MX:NOTE: [AUTO] mermaid.parse() is called before render() to pre-validate syntax
// This prevents mermaid's native bomb-icon error SVG from being rendered into the DOM

// Initialize mermaid once at module load time
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

/** Props for the PreviewRenderer component */
interface PreviewRendererProps {
  html: string;
  /** Font size in px applied to preview content */
  fontSize?: number;
}

/**
 * Renders pre-sanitized HTML from markdown-it into the DOM.
 * After mounting/updating, also handles:
 * 1. Mermaid diagram rendering (finds .mermaid-container divs)
 * 2. (Extension point) Copy buttons for code blocks
 */
export function PreviewRenderer({ html, fontSize }: PreviewRendererProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const containers = containerRef.current.querySelectorAll('.mermaid-container');
    containers.forEach(async (el) => {
      const diagram = el.getAttribute('data-diagram') ?? '';
      try {
        await mermaid.parse(diagram);
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, diagram);
        el.innerHTML = svg;
      } catch {
        el.innerHTML = '<p class="text-sm text-amber-500 italic py-2">⚠ Diagram syntax error</p>';
      }
    });
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="preview-content"
      style={fontSize !== undefined ? { fontSize: `${fontSize}px` } : undefined}
      // Safe: markdown-it html:false prevents raw HTML injection
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
