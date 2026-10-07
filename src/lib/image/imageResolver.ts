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
    const toAbsolute = (p: string) => {
      const normalizedSrc = p.startsWith('./') ? p.substring(2) : p;
      return `${mdDir}${sep}${normalizedSrc.replace(/\//g, sep)}`;
    };

    // SPEC-PREVIEW-014: markdown-it은 상대경로의 한글·단독 % 를 퍼센트 인코딩하므로
    // 디코드한 경로를 먼저 읽는다. 파일명 자체에 %XX 가 든 경우(a%20b.png)를 위해
    // 실패하면 원문 경로로 한 번 더 읽는다. 잘못된 시퀀스는 원문만 쓴다.
    // 절대경로는 기존대로 디코드하지 않으며, `..` 거부는 Rust validate_path 가 담당한다.
    let candidates = [src];
    if (!src.startsWith('/')) {
      let decoded = src;
      try {
        decoded = decodeURIComponent(src);
      } catch {
        // 잘못된 퍼센트 시퀀스 — 원문 사용
      }
      candidates = decoded === src ? [toAbsolute(src)] : [toAbsolute(decoded), toAbsolute(src)];
    }

    for (const absolutePath of candidates) {
      try {
        const dataUri = await readImageAsBase64(absolutePath);
        resolved.set(src, dataUri);
        result = result.replace(full, full.replace(src, dataUri));
        break;
      } catch {
        // Keep original src if the file cannot be read
      }
    }
  }

  return result;
}
