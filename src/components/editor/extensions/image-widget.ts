// @MX:SPEC: SPEC-IMG-WIDGET-001, SPEC-IMG-LOAD-002, SPEC-IMG-WIDGET-002
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
interface DocLine {
  from: number;
  to: number;
}

interface DocView {
  state: {
    doc: {
      length: number;
      sliceString(from: number, to: number): string;
      /**
       * SPEC-IMG-WIDGET-002 REQ-A-001: 라인 경계 조회 (CodeMirror Text.lineAt 호환).
       * 경계 확정 전용이다 — 라인 본문은 반드시 sliceString(line.from, line.to) 으로 가져온다
       * (plan.md §E-2: 계측이 sliceString 만 감싸므로 lineAt(pos).text 경로는 측정 불가).
       */
      lineAt(pos: number): DocLine;
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

// @MX:WARN: [AUTO] 교집합 공집합 라인 배제는 제거 금지 — 동결 재발 방지의 유일한 구조적 장치.
// @MX:REASON: 폴드된 라인 L 주변의 visibleRanges 는 `{..., to: L.from}` / `{from: L.to, ...}` 형태다.
//   doc.lineAt(L.from) 과 doc.lineAt(L.to) 는 **둘 다 라인 L** 을 반환하므로, 반개구간 교집합 검사
//   (`range.from < line.to && range.to > line.from`) 없이 순진하게 확장하면 폴드된 수백만 자 라인이
//   스캔 대상으로 재유입되어 SPEC-IMG-LOAD-002 REQ-A-001 이 제거한 키 입력 동결이 되살아난다.
// @MX:SPEC: SPEC-IMG-WIDGET-002 REQ-A-001, REQ-A-002, REQ-A-003
/**
 * 각 visibleRange 를 라인 경계로 확장하고, 오름차순·비중첩으로 정규화한다.
 *
 * - REQ-A-001: 확장 범위 = "해당 range 와 문자 1개 이상 교집합을 갖는 모든 라인"의 합집합.
 * - REQ-A-002: 교집합이 공집합인 라인은 배제한다 (위 @MX:WARN 참조).
 * - REQ-A-003: 정렬 + 병합으로 하나의 라인이 정확히 한 번만 스캔되게 한다.
 *   line gap 은 **같은 라인** 을 가리키는 복수 range 를 만들므로 병합은 선택이 아니다 —
 *   빠뜨리면 RangeSetBuilder.add() 가 중복/역순 입력으로 예외를 던진다.
 *
 * 범위 규약은 반개구간 [from, to) 다 (spec.md Assumptions 6).
 */
function expandToVisibleLines(
  doc: DocView['state']['doc'],
  ranges: readonly { from: number; to: number }[],
): DocLine[] {
  const expanded: DocLine[] = [];

  for (const range of ranges) {
    if (range.to <= range.from) continue; // 빈 범위는 어떤 라인과도 교집합이 없다
    let pos = range.from;
    while (pos < range.to) {
      const line = doc.lineAt(pos);
      // REQ-A-002: 문자 1개 이상 교집합일 때만 채택.
      // pos === line.to 인 경우(폴드 라인 직후에서 시작하는 range)가 여기서 걸러진다.
      if (range.from < line.to && range.to > line.from) {
        expanded.push({ from: line.from, to: line.to });
      }
      pos = line.to + 1; // 다음 라인으로 전진 (+1 은 개행 문자)
    }
  }

  // REQ-A-003: 오름차순 정렬 후 인접·중첩 병합.
  expanded.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: DocLine[] = [];
  for (const range of expanded) {
    const last = merged[merged.length - 1];
    if (last && range.from <= last.to) {
      last.to = Math.max(last.to, range.to);
    } else {
      merged.push({ from: range.from, to: range.to });
    }
  }
  return merged;
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
  const doc = view.state.doc;
  for (const { from, to } of expandToVisibleLines(doc, view.visibleRanges)) {
    // [HARD] 본문 획득은 sliceString 으로만 한다 (lineAt(pos).text 금지 — plan.md §E-2).
    const text = doc.sliceString(from, to);
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
