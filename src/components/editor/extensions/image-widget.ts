// @MX:SPEC: SPEC-IMG-WIDGET-001, SPEC-IMG-LOAD-002
// @MX:NOTE: [AUTO] CodeMirror 6 Image Widget Decoration extension
// Visually replaces data URI markdown images with compact thumbnail widgets.
// Source text is NOT modified — only visual representation via Decoration.replace().
//
// SPEC-IMG-LOAD-002 REQ-A-001 (실제 동결 제거 주체 — D1 수정):
//   buildDecorations 가 view.state.doc.toString() (full-doc copy) 호출을 제거하고
//   view.visibleRanges 기반 부분 스캔으로 교체했다. docChanged 마다 발생하던
//   동기 전체 문서 복사 + 글로벌 정규식 실행 비용이 사라진다.
//   WIDGET-001 spec.md:165 (viewport-bounding) 미구현 제약의 최초 이행.

import { WidgetType, ViewPlugin, Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { Extension } from '@codemirror/state';

// ============================================================
// Types
// ============================================================

export interface DataUriImageMatch {
  alt: string;
  dataUri: string;
  mimeType: string;
  base64Data: string;
  from: number;
  to: number;
}

// ============================================================
// TASK-001: Pure Utility Functions
// ============================================================

/** Pattern matching ![alt](data:image/...;base64,...) */
const DATA_URI_IMAGE_PATTERN = /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([A-Za-z0-9+/=]+))\)/g;

/**
 * Parses a document string and finds all data URI markdown images.
 * Returns an array of matches with position and metadata.
 */
export function parseDataUriImage(text: string): DataUriImageMatch[] {
  const results: DataUriImageMatch[] = [];
  const regex = new RegExp(DATA_URI_IMAGE_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    results.push({
      alt: match[1],
      dataUri: match[2],
      mimeType: 'image/' + match[3],
      base64Data: match[4],
      from: match.index,
      to: match.index + match[0].length,
    });
  }

  return results;
}

/**
 * Calculates the approximate file size in KB from a base64 string.
 * Formula: sizeInBytes = ceil(base64Length * 3 / 4), then convert to KB.
 */
export function calculateBase64Size(base64String: string): string {
  if (!base64String) return '0.0';
  const sizeInBytes = Math.ceil(base64String.length * 3 / 4);
  const sizeInKB = (sizeInBytes / 1024).toFixed(1);
  return sizeInKB;
}

/**
 * Returns a short display label for a MIME type.
 * e.g. "image/png" -> "PNG"
 */
function getMimeLabel(mimeType: string): string {
  const sub = mimeType.split('/')[1] ?? mimeType;
  return sub.toUpperCase();
}

// ============================================================
// TASK-002: WidgetType Subclass
// ============================================================

/**
 * CodeMirror 6 WidgetType that renders a compact image thumbnail widget.
 * Displays: thumbnail preview, alt text, MIME type, file size.
 */
export class ImageWidget extends WidgetType {
  constructor(
    readonly alt: string,
    readonly dataUri: string,
    readonly mimeType: string,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    if (!(other instanceof ImageWidget)) return false;
    return this.alt === other.alt && this.dataUri === other.dataUri;
  }

  toDOM(): HTMLElement {
    const base64Data = this.dataUri.split(',')[1] ?? '';
    const sizeKB = calculateBase64Size(base64Data);
    const mimeLabel = getMimeLabel(this.mimeType);

    // Root container
    const span = document.createElement('span');
    span.className = 'cm-image-widget';

    // Thumbnail image
    const img = document.createElement('img');
    img.className = 'cm-image-widget-thumb';
    img.src = this.dataUri;
    img.alt = this.alt;
    img.style.maxHeight = '80px';
    img.style.display = 'inline-block';
    img.style.verticalAlign = 'middle';
    span.appendChild(img);

    // Info section
    const info = document.createElement('span');
    info.className = 'cm-image-widget-info';

    // Alt text
    const altSpan = document.createElement('span');
    altSpan.className = 'cm-image-widget-alt';
    altSpan.textContent = this.alt;
    info.appendChild(altSpan);

    // Meta: MIME type + size
    const metaSpan = document.createElement('span');
    metaSpan.className = 'cm-image-widget-meta';
    metaSpan.textContent = `${mimeLabel} / ${sizeKB}KB`;
    info.appendChild(metaSpan);

    span.appendChild(info);

    return span;
  }

  ignoreEvent(): boolean {
    // Allow click events to pass through for cursor placement
    return false;
  }
}

// ============================================================
// TASK-003: ViewPlugin + DecorationSet
// ============================================================

/**
 * Minimal view shape needed for buildDecorations — allows pure testing without full EditorView.
 *
 * SPEC-IMG-LOAD-002 REQ-A-001: visibleRanges 기반 부분 스캔.
 * view.state.doc.toString() (full-doc copy) 은 호출하지 않는다 — sliceString(from, to) 만 사용.
 */
interface DocView {
  state: {
    doc: {
      length: number;
      sliceString(from: number, to: number): string;
      // toString() is intentionally OMITTED from this type — REQ-A-001 forbids full-doc copy.
      // (kept at runtime for backward-compat with older callers, but never invoked by buildDecorations)
    };
  };
  /** CodeMirror EditorView.visibleRanges — visible viewport fragments (folded regions split this). */
  visibleRanges: readonly { from: number; to: number }[];
}

/**
 * REQ-IMG-LOAD-2-A-002 helper: decide whether the ViewPlugin.update should recompute decorations.
 * Returns true when the document changed OR the viewport changed.
 *
 * Extracted as a pure function so unit tests can verify the trigger logic without spinning up
 * a real EditorView lifecycle in jsdom.
 */
export function shouldRecomputeDecorations(update: {
  docChanged: boolean;
  viewportChanged: boolean;
}): boolean {
  return update.docChanged || update.viewportChanged;
}

/**
 * Builds a DecorationSet from the given EditorView's **visible viewport only**.
 *
 * SPEC-IMG-LOAD-002 REQ-A-001 (D1 핵심 — 실제 동결 제거 주체):
 *   - Iterates view.visibleRanges instead of view.state.doc.toString() (full-doc copy).
 *   - For each visible range, sliceString(from, to) extracts only that fragment.
 *   - The data URI regex runs on visible fragments only — frozen large documents no longer
 *     pay O(N) full-doc copy on every keystroke.
 *   - Match positions are offset by range.from to produce absolute document positions.
 *
 * WIDGET-001 spec.md:165 (viewport-bounding constraint, never implemented before) fulfillment.
 */
export function buildDecorations(view: DocView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const match of parseDataUriImage(text)) {
      const widget = new ImageWidget(match.alt, match.dataUri, match.mimeType);
      // match.from/to are local to the slice — offset by range.from for absolute document positions.
      builder.add(
        from + match.from,
        from + match.to,
        Decoration.replace({ widget }),
      );
    }
  }
  return builder.finish();
}

/**
 * ViewPlugin that maintains image widget decorations.
 *
 * SPEC-IMG-LOAD-002 REQ-A-002: recomputes decorations on docChanged AND viewportChanged,
 * so newly-visible data URI images render without lag when the user scrolls.
 *
 * Provides atomicRanges so Delete/Backspace removes the entire image markdown at once
 * (WIDGET-001 REQ-3 보존).
 */
const imageWidgetPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      // REQ-A-002: viewportChanged 트리거 추가 (docChanged 전용이 아니라).
      if (shouldRecomputeDecorations(update)) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => {
        return view.plugin(plugin)?.decorations ?? Decoration.none;
      }),
  },
);

// ============================================================
// TASK-004: Extension Registration
// ============================================================

/**
 * Returns the complete image widget extension for the Markdown editor.
 * Plug into createMarkdownExtensions() to enable data URI image thumbnails.
 */
export function imageWidgetExtension(): Extension {
  return imageWidgetPlugin;
}
