// @MX:NOTE: [AUTO] .svg 파일 전용 렌더/소스 토글 뷰어.
//   기본은 렌더 뷰(svgSanitize된 SVG를 dangerouslySetInnerHTML로 표시, 줌·팬).
//   소스 토글 시 CodeFileViewer(lang="xml")를 재사용해 Shiki 강조된 원본 XML을 표시한다(D6).
//   FILE_SIZE_THRESHOLD는 소스 뷰에만 적용한다(D3) — 렌더 뷰는 파일 크기와 무관하게 계속 표시.
// @MX:SPEC: SPEC-PREVIEW-008 REQ-PREVIEW008-004 REQ-PREVIEW008-005

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useFileStore } from '@/store/fileStore';
import { sanitizeSvg } from '@/lib/preview/svgSanitize';
import { findFileNodeSize } from '@/lib/preview/fileTreeUtils';
import { FILE_SIZE_THRESHOLD } from '@/lib/preview/previewLimits';
import { CodeFileViewer } from './CodeFileViewer';

type ViewMode = 'render' | 'source';
type ZoomMode = 'fit' | 'custom';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;

interface SvgFileViewerProps {
  /** 표시할 SVG 파일의 절대 경로 */
  svgPath: string;
}

/**
 * `.svg` 파일 전용 뷰어. 렌더 뷰(기본)와 소스 뷰(Shiki XML 강조)를 토글한다.
 *
 * - 렌더 뷰: useEditorStore.content(openFile이 로드한 원본 SVG 텍스트, SPEC-PREVIEW-008 D1)를
 *   svgSanitize로 정화한 뒤 DOM에 직접 삽입한다. 위험 요소(script, on-이벤트 핸들러, foreignObject)는
 *   sanitizeSvg 단계에서 이미 제거되었으므로 dangerouslySetInnerHTML이 안전하다.
 * - 소스 뷰: FILE_SIZE_THRESHOLD를 초과하면 CodeFileViewer 대신 대용량 안내를 표시한다(D3).
 */
export function SvgFileViewer({ svgPath }: SvgFileViewerProps): JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('render');
  const [mode, setMode] = useState<ZoomMode>('fit');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const draggingRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );

  const content = useEditorStore((s) => s.content);
  const fileTree = useFileStore((s) => s.fileTree);
  const fileSize = findFileNodeSize(fileTree, svgPath);
  const isTooLargeForSource = fileSize !== undefined && fileSize > FILE_SIZE_THRESHOLD;

  // @MX:NOTE: sanitize 실행 지점 — 인라인 SVG(PreviewRenderer)와 동일한 svgSanitize 유틸을 사용한다.
  const safeSvg = useMemo(() => sanitizeSvg(content ?? ''), [content]);

  // 파일이 바뀌면 뷰/줌 상태를 초기화한다
  useEffect(() => {
    setViewMode('render');
    setMode('fit');
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [svgPath]);

  const handleFit = (): void => {
    setMode('fit');
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleActualSize = (): void => {
    setMode('custom');
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleZoomIn = (): void => {
    setMode('custom');
    setScale((s) => Math.min(MAX_SCALE, s * ZOOM_STEP));
  };

  const handleZoomOut = (): void => {
    setMode('custom');
    setScale((s) => Math.max(MIN_SCALE, s / ZOOM_STEP));
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    if (mode !== 'custom') return;
    draggingRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    const drag = draggingRef.current;
    if (!drag) return;
    setOffset({
      x: drag.origX + (event.clientX - drag.startX),
      y: drag.origY + (event.clientY - drag.startY),
    });
  };

  const handleMouseUp = (): void => {
    draggingRef.current = null;
  };

  return (
    <div className="svg-file-viewer h-full flex flex-col" data-testid="svg-file-viewer">
      <div className="svg-toolbar flex items-center gap-2 p-2 text-xs border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setViewMode('render')}
          aria-pressed={viewMode === 'render'}
          data-testid="svg-view-render"
        >
          Render
        </button>
        <button
          type="button"
          onClick={() => setViewMode('source')}
          aria-pressed={viewMode === 'source'}
          data-testid="svg-view-source"
        >
          Source
        </button>
        {viewMode === 'render' && (
          <>
            <button
              type="button"
              onClick={handleFit}
              aria-pressed={mode === 'fit'}
              data-testid="svg-zoom-fit"
            >
              Fit
            </button>
            <button
              type="button"
              onClick={handleActualSize}
              aria-pressed={mode === 'custom' && scale === 1}
              data-testid="svg-zoom-100"
            >
              100%
            </button>
            <button type="button" onClick={handleZoomIn} data-testid="svg-zoom-in">
              +
            </button>
            <button type="button" onClick={handleZoomOut} data-testid="svg-zoom-out">
              -
            </button>
          </>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {viewMode === 'render' ? (
          <div
            className="svg-render-canvas h-full overflow-hidden relative"
            data-testid="svg-render-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              data-testid="svg-render-content"
              data-zoom-mode={mode}
              data-scale={scale}
              className={mode === 'fit' ? 'w-full h-full flex items-center justify-center' : ''}
              style={
                mode === 'custom'
                  ? {
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                      transformOrigin: 'center',
                    }
                  : undefined
              }
              // Safe: sanitizeSvg가 script/on*/foreignObject 등을 제거한 이후의 값이다
              // (SPEC-PREVIEW-008 REQ-PREVIEW008-005)
              dangerouslySetInnerHTML={{ __html: safeSvg }}
            />
          </div>
        ) : isTooLargeForSource ? (
          <div
            className="h-full flex flex-col items-center justify-center gap-1 p-4 text-center text-xs text-gray-400 dark:text-gray-500"
            data-testid="svg-source-too-large"
          >
            파일이 커서 소스 강조를 건너뜁니다.
          </div>
        ) : (
          <CodeFileViewer lang="xml" />
        )}
      </div>
    </div>
  );
}
