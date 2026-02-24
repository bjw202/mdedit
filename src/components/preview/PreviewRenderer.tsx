import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// @MX:NOTE: [AUTO] dangerouslySetInnerHTML is intentionally used here
// This is safe because markdown-it renders with html:false which blocks raw HTML injection
// @MX:SPEC: SPEC-PREVIEW-001

// Initialize mermaid once at module load time
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

/** Props for the PreviewRenderer component */
interface PreviewRendererProps {
  html: string;
}

/**
 * Renders pre-sanitized HTML from markdown-it into the DOM.
 * After mounting/updating, also handles:
 * 1. Mermaid diagram rendering (finds .mermaid-container divs)
 * 2. (Extension point) Copy buttons for code blocks
 */
export function PreviewRenderer({ html }: PreviewRendererProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const containers = containerRef.current.querySelectorAll('.mermaid-container');
    containers.forEach(async (el) => {
      const diagram = el.getAttribute('data-diagram') ?? '';
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, diagram);
        el.innerHTML = svg;
      } catch {
        el.innerHTML = '<p class="text-red-500">Diagram error</p>';
      }
    });
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="preview-content"
      // Safe: markdown-it html:false prevents raw HTML injection
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
