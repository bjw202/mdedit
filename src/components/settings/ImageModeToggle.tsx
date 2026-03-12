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

  return (
    <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
      <span>Image:</span>
      <select
        aria-label="Image insert mode"
        value={imageInsertMode}
        onChange={handleChange}
        className="text-xs rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 cursor-pointer"
      >
        <option value="inline-blob">Inline</option>
        <option value="file-save">File</option>
      </select>
    </label>
  );
}
