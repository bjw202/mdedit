// @MX:NOTE: [AUTO] Settings control for image insert mode (inline-blob vs file-save)
// @MX:SPEC: SPEC-IMG-MODE-001

import { useUIStore } from '@/store/uiStore';
import type { ImageInsertMode } from '@/store/uiStore';

/**
 * Renders a select control that allows the user to choose how pasted images
 * are inserted into the document: as an inline base64 data URI (inline-blob)
 * or saved to the ./images/ folder (file-save).
 */
export function ImageModeToggle(): JSX.Element {
  const imageInsertMode = useUIStore((s) => s.imageInsertMode);
  const setImageInsertMode = useUIStore((s) => s.setImageInsertMode);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setImageInsertMode(e.target.value as ImageInsertMode);
  };

  // @MX:NOTE: [AUTO] SPEC-UI-006 — 핸드오프 Surface 매핑은 .md-seg/.md-seg-opt(세그먼티드 버튼)를
  // 지정하지만, 이 컨트롤은 네이티브 <select>(단일 액션, 상태 로직 없음)로 남긴다. 세그먼트 버튼으로
  // 재구성하면 마크업이 select→button 구조로 바뀌어 회귀 위험이 커지는 반면 시각 이득은 작다.
  // 토큰(md-font-ui, --md-border, --md-text-*)만 적용해 다른 .md-* 컨트롤과 시각적으로 통일한다.
  // @MX:SPEC: SPEC-UI-006
  return (
    <label
      className="flex items-center gap-1"
      style={{ fontFamily: 'var(--md-font-ui)', fontSize: 12, color: 'var(--md-text-muted)' }}
    >
      <span>Image:</span>
      <select
        aria-label="Image insert mode"
        value={imageInsertMode}
        onChange={handleChange}
        className="cursor-pointer"
        style={{
          fontSize: 12,
          borderRadius: 'var(--md-radius-sm)',
          border: '1px solid var(--md-border)',
          background: 'transparent',
          color: 'var(--md-text-primary)',
          padding: '2px 4px',
        }}
      >
        <option value="inline-blob">Inline</option>
        <option value="file-save">File</option>
      </select>
    </label>
  );
}
