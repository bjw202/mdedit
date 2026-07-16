// @MX:NOTE: [AUTO] 래스터 이미지(.png/.jpg/.jpeg/.gif/.webp/.bmp/.ico/.avif) 전용 보기 컴포넌트.
//   asset://(convertFileSrc)로 OS 파일 스트리밍 로드 — base64 미사용(D2, 메모리 적재 없음).
//   fit/100%/줌 인·아웃 + 드래그 팬, 투명 체커보드 배경, 픽셀 크기·파일 크기 메타 표시.
//   FILE_SIZE_THRESHOLD를 적용하지 않는다(REQ-PREVIEW008-003) — 대용량 이미지도 계속 표시.
// @MX:SPEC: SPEC-PREVIEW-008 REQ-PREVIEW008-001 REQ-PREVIEW008-002 REQ-PREVIEW008-003

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type SyntheticEvent,
} from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useFileStore } from '@/store/fileStore';
import { useUIStore } from '@/store/uiStore';
import { findFileNodeSize } from '@/lib/preview/fileTreeUtils';

type ZoomMode = 'fit' | 'custom';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;

// @MX:NOTE: [AUTO] 평가 결함 2 수정 — 투명 배경 이미지 판별용 체커보드 패턴(REQ-PREVIEW008-002).
// 테마 무관한 중간 회색 2톤(Figma/VSCode 등 업계 관례)을 repeating-conic-gradient로 구성해
// 라이트/다크 전환 시에도 별도 분기 없이 일관되게 보이도록 한다. 인라인 style로 적용해
// 외부 스텁시트 로딩 여부와 무관하게 항상 실제 배경이 렌더된다(테스트 가능성 확보).
const CHECKERBOARD_TILE_PX = 16;
const CHECKERBOARD_BACKGROUND_STYLE: CSSProperties = {
  backgroundImage:
    'repeating-conic-gradient(#808080 0% 25%, #ffffff 0% 50%)',
  backgroundSize: `${CHECKERBOARD_TILE_PX}px ${CHECKERBOARD_TILE_PX}px`,
};

/** 바이트를 사람이 읽기 쉬운 B/KB/MB 문자열로 변환한다. */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ImageFileViewerProps {
  /** 표시할 래스터 이미지의 절대 경로 */
  imagePath: string;
}

/**
 * 래스터 이미지 전용 보기 컴포넌트.
 *
 * - `<img>` src는 convertFileSrc(asset://)로 변환 — 편집기 버퍼에는 로드하지 않는다(보기 전용).
 * - fit(맞춤) 모드: CSS object-contain으로 컨테이너에 맞춰 표시.
 * - custom 모드(100%/줌 인·아웃): transform: translate() scale()로 확대·축소 + 드래그 팬.
 * - naturalWidth/Height(픽셀 크기)와 FileNode.size(파일 크기)를 메타 영역에 표시한다.
 */
export function ImageFileViewer({ imagePath }: ImageFileViewerProps): JSX.Element {
  const [mode, setMode] = useState<ZoomMode>('fit');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const draggingRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );

  const fileTree = useFileStore((s) => s.fileTree);
  const theme = useUIStore((s) => s.theme);
  const fileSize = findFileNodeSize(fileTree, imagePath);
  const filename = imagePath.split(/[/\\]/).pop() ?? imagePath;

  // 파일이 바뀌면 줌/팬 상태를 초기화한다
  useEffect(() => {
    setMode('fit');
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setNaturalSize(null);
  }, [imagePath]);

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>): void => {
    const img = event.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

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

  // convertFileSrc는 슬래시를 %2F/%5C로 인코딩한다. HtmlFileViewer와 동일하게 정규화한다.
  const assetUrl = convertFileSrc(imagePath).replace(/%2F/gi, '/').replace(/%5C/gi, '/');

  return (
    <div
      className="image-file-viewer h-full flex flex-col"
      data-testid="image-file-viewer"
      data-theme={theme}
    >
      <div className="image-toolbar flex items-center gap-2 p-2 text-xs border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleFit}
          aria-pressed={mode === 'fit'}
          data-testid="image-zoom-fit"
        >
          Fit
        </button>
        <button
          type="button"
          onClick={handleActualSize}
          aria-pressed={mode === 'custom' && scale === 1}
          data-testid="image-zoom-100"
        >
          100%
        </button>
        <button type="button" onClick={handleZoomIn} data-testid="image-zoom-in">
          +
        </button>
        <button type="button" onClick={handleZoomOut} data-testid="image-zoom-out">
          -
        </button>
        <span data-testid="image-meta" className="ml-auto text-gray-400 dark:text-gray-500">
          {naturalSize ? `${naturalSize.w}×${naturalSize.h}` : ''}
          {naturalSize && fileSize !== undefined ? ' · ' : ''}
          {formatFileSize(fileSize)}
        </span>
      </div>
      <div
        className="image-canvas flex-1 overflow-hidden relative"
        data-testid="image-checkerboard"
        style={CHECKERBOARD_BACKGROUND_STYLE}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={assetUrl}
          alt={filename}
          onLoad={handleLoad}
          data-testid="image-file-viewer-img"
          data-zoom-mode={mode}
          data-scale={scale}
          className={mode === 'fit' ? 'max-w-full max-h-full object-contain m-auto block' : 'block'}
          style={
            mode === 'custom'
              ? {
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'center',
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
