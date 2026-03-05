// @MX:NOTE: [AUTO] Resolves relative image paths to Tauri asset: protocol URLs for preview rendering
// @MX:SPEC: SPEC-IMG-001

import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Resolves an image src attribute for use in the preview panel.
 *
 * - Absolute paths and http/https URLs are returned as-is
 * - Relative paths (e.g., `./images/photo.png`) are resolved against
 *   the markdown file's directory and converted to Tauri `asset:` URLs
 *
 * @param src - The image src from the markdown (could be relative or absolute)
 * @param mdFilePath - Absolute path to the current markdown file, or null if unsaved
 * @returns The resolved URL suitable for use in an <img> tag
 */
export function resolveImageSrc(src: string, mdFilePath: string | null): string {
  if (!src) return src;

  // HTTP/HTTPS URLs pass through unchanged
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }

  // Data URIs pass through unchanged
  if (src.startsWith('data:')) {
    return src;
  }

  // Absolute paths convert directly
  if (src.startsWith('/')) {
    return convertFileSrc(src);
  }

  // Relative paths need the markdown file's directory as base
  if (!mdFilePath) {
    return src; // Cannot resolve without a base path
  }

  // Get the directory containing the markdown file
  const lastSep = Math.max(mdFilePath.lastIndexOf('/'), mdFilePath.lastIndexOf('\\'));
  if (lastSep < 0) {
    return src;
  }

  const mdDir = mdFilePath.substring(0, lastSep);

  // Normalize the relative path: strip leading ./
  const normalizedSrc = src.startsWith('./') ? src.substring(2) : src;
  const absolutePath = `${mdDir}/${normalizedSrc}`;

  return convertFileSrc(absolutePath);
}
