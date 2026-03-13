// @MX:SPEC: SPEC-IMG-WIDGET-001
// @MX:NOTE: [AUTO] CodeMirror 6 Image Widget Decoration extension
// Visually replaces data URI markdown images with compact thumbnail widgets.
// Source text is NOT modified — only visual representation via Decoration.replace().

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

/** Minimal view shape needed for buildDecorations — allows pure testing without full EditorView */
interface DocView {
  state: { doc: { toString(): string; length: number } };
}

/**
 * Builds a DecorationSet from the given EditorView's document.
 * Finds all data URI images and creates Decoration.replace() entries.
 */
export function buildDecorations(view: DocView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const text = view.state.doc.toString();
  const matches = parseDataUriImage(text);

  for (const match of matches) {
    const widget = new ImageWidget(match.alt, match.dataUri, match.mimeType);
    builder.add(
      match.from,
      match.to,
      Decoration.replace({ widget }),
    );
  }

  return builder.finish();
}

/**
 * ViewPlugin that maintains image widget decorations.
 * Updates decorations whenever the document changes.
 * Provides atomicRanges so Delete/Backspace removes the entire image markdown at once.
 */
const imageWidgetPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged) {
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
