// @MX:NOTE: [AUTO] Resolves relative image paths for preview rendering via base64 data URIs
// @MX:SPEC: SPEC-IMG-001

import { convertFileSrc } from '@tauri-apps/api/core';
import { readImageAsBase64 } from '@/lib/tauri/ipc';

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

  // Use the same path separator as the mdFilePath to avoid mixing on Windows
  const sep = mdFilePath.includes('\\') ? '\\' : '/';
  const normalizedSrcForOS = normalizedSrc.replace(/\//g, sep);
  const absolutePath = `${mdDir}${sep}${normalizedSrcForOS}`;

  return convertFileSrc(absolutePath);
}

/**
 * Embeds local images referenced in rendered HTML as base64 data URIs.
 *
 * Used by the preview panel to render images without relying on the Tauri
 * asset: protocol (which requires explicit scope configuration in production).
 * Relative paths like `./images/foo.png` are resolved against the markdown
 * file's directory and converted to `data:image/...;base64,...` URIs.
 *
 * @param html - Rendered HTML string containing img tags
 * @param mdFilePath - Absolute path to the markdown file, or null if unsaved
 * @returns HTML string with local image srcs replaced by base64 data URIs
 */
export async function embedPreviewImages(html: string, mdFilePath: string | null): Promise<string> {
  if (!mdFilePath || !html) return html;

  const imgRegex = /<img\s+[^>]*src="([^"]*)"[^>]*>/g;
  const matches: Array<{ full: string; src: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    matches.push({ full: match[0], src: match[1] });
  }

  if (matches.length === 0) return html;

  const mdDir = mdFilePath.substring(0, Math.max(mdFilePath.lastIndexOf('/'), mdFilePath.lastIndexOf('\\')));
  const sep = mdFilePath.includes('\\') ? '\\' : '/';

  let result = html;
  const resolved = new Map<string, string>();

  for (const { full, src } of matches) {
    // Skip HTTP/HTTPS URLs and data URIs
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      continue;
    }

    if (resolved.has(src)) {
      result = result.replace(full, full.replace(src, resolved.get(src)!));
      continue;
    }

    // Resolve relative path to absolute
    const normalizedSrc = src.startsWith('./') ? src.substring(2) : src;
    const absolutePath = src.startsWith('/')
      ? src
      : `${mdDir}${sep}${normalizedSrc.replace(/\//g, sep)}`;

    try {
      const dataUri = await readImageAsBase64(absolutePath);
      resolved.set(src, dataUri);
      result = result.replace(full, full.replace(src, dataUri));
    } catch {
      // Keep original src if the file cannot be read
    }
  }

  return result;
}
