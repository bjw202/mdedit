// @MX:NOTE: Scroll synchronization hook between CodeMirror editor and markdown preview.
// Uses line-number-based mapping via data-line attributes injected by the markdown renderer.
// @MX:WARN: Feedback loop prevention is critical - use isProgrammaticScrollRef flag
// @MX:REASON: [AUTO] Without prevention, editor scroll triggers preview scroll which triggers editor scroll (infinite loop)

import { useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import type { RefObject } from 'react';

/**
 * Synchronizes editor scrolling to the markdown preview panel.
 *
 * When the editor is scrolled, this hook finds the top visible line number
 * and scrolls the preview to the corresponding data-line element.
 *
 * Requirements:
 * - REQ-PREVIEW002-E01: Editor scroll -> find top visible line -> scroll preview to data-line element
 * - REQ-PREVIEW002-N01: NO infinite scroll loop feedback between editor and preview
 * - REQ-PREVIEW002-N03: When sync disabled, don't process scroll events
 */
export function useScrollSync(
  editorView: EditorView | null,
  previewRef: RefObject<HTMLDivElement>,
  enabled: boolean,
): void {
  // Flag to prevent feedback loop: skip programmatic scroll events
  const isProgrammaticScrollRef = useRef(false);
  // Animation frame handle for throttling
  const rafHandleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !editorView) return;

    const scrollDom = editorView.scrollDOM;

    const handleEditorScroll = (): void => {
      // Cancel pending frame
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
      }

      rafHandleRef.current = requestAnimationFrame(() => {
        if (isProgrammaticScrollRef.current) {
          isProgrammaticScrollRef.current = false;
          return;
        }

        const preview = previewRef.current;
        if (!preview || !editorView) return;

        // Get the top visible line block from the editor's scroll position
        const scrollTop = scrollDom.scrollTop;
        let lineNumber: number;

        try {
          const lineBlock = editorView.lineBlockAtHeight(scrollTop);
          const line = editorView.state.doc.lineAt(lineBlock.from);
          lineNumber = line.number - 1; // Convert to 0-based to match data-line attributes
        } catch {
          return;
        }

        // Find elements with data-line attributes in the preview
        const lineElements = preview.querySelectorAll<HTMLElement>('[data-line]');
        if (lineElements.length === 0) return;

        // Find the closest matching element (exact match or nearest previous)
        let targetEl: HTMLElement | null = null;
        let closestLine = -1;

        for (const el of lineElements) {
          const elLine = parseInt(el.getAttribute('data-line') ?? '-1', 10);
          if (elLine <= lineNumber && elLine > closestLine) {
            closestLine = elLine;
            targetEl = el;
          }
        }

        // Fall back to first element if no match found
        if (targetEl === null && lineElements.length > 0) {
          targetEl = lineElements[0] as HTMLElement;
        }

        if (targetEl !== null) {
          // Use direct scrollTo instead of scrollIntoView to prevent ancestor
          // overflow-hidden containers from being scrolled, which would shift
          // the flex layout and cause the sidebar to visually disappear.
          isProgrammaticScrollRef.current = true;
          const containerTop = previewRef.current.getBoundingClientRect().top;
          const targetTop = targetEl.getBoundingClientRect().top;
          const scrollTarget = targetTop - containerTop + previewRef.current.scrollTop;
          previewRef.current.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        }
      });
    };

    scrollDom.addEventListener('scroll', handleEditorScroll, { passive: true });

    return () => {
      scrollDom.removeEventListener('scroll', handleEditorScroll);
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
      }
    };
  }, [editorView, previewRef, enabled]);
}
