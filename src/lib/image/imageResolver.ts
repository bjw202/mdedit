// @MX:NOTE: [AUTO] Resolves relative image paths for preview rendering via base64 data URIs
// @MX:NOTE: [AUTO] SPEC-EXPORT-004: 미리보기·HTML·PDF·DOCX 가 공유하는 로컬 이미지 해석기(readLocalImage·embedImagesInHtml)
// @MX:SPEC: SPEC-IMG-001
// @MX:SPEC: SPEC-EXPORT-004

import { convertFileSrc } from '@tauri-apps/api/core';
import { readImageAsBase64, readRelativeImageAsBase64 } from '@/lib/tauri/ipc';

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

/** http(s)·data src 가 아니면 로컬 이미지다(읽기·누락 보고 대상). */
export function isLocalImageSrc(src: string): boolean {
  return !!src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:');
}

/**
 * markdown-it escapeHtml 이 이스케이프하는 4종만 되돌린다. `&amp;` 를 마지막에 처리해
 * `&amp;lt;` 같은 값이 두 번 디코드되지 않게 한다(SPEC-EXPORT-004 REQ-003, plan D3).
 */
function decodeHtmlEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** 후보 문자열을 `/`·`\` 로 나눈 조각 중 정확히 `..` 인 것이 있으면 상위 폴더 후보다(REQ-005, plan D2). */
function hasParentSegment(candidate: string): boolean {
  return candidate.split(/[\\/]/).some((seg) => seg === '..');
}

/** 로컬 이미지 해석 결과. dataUri 가 null 이면 임베드하지 못한 것이다. */
export interface LocalImageResult {
  dataUri: string | null;
  /** 누락 보고용 이름 — 엔티티·퍼센트 디코드한 src(디코드 실패 시 원문). */
  displayName: string;
}

/**
 * 로컬 이미지 src 하나를 data URI 로 읽는다. 미리보기·HTML·PDF·DOCX 의 유일한 경로 해석 로직이다.
 *
 * 순서: (HTML 출처면) 엔티티 디코드 → 퍼센트 디코드(실패 시 원문) → 후보 목록
 * [디코드, 원문] → 후보마다 `..` 조각이 있으면 전용 명령, 없으면 md 디렉터리와 이어 일반 IPC.
 * `/` 절대경로는 퍼센트 디코드 없이 그대로 일반 IPC 로 읽는다. 미저장 문서(mdFilePath null)는 아무것도 읽지 않는다.
 *
 * @param src - img src (http·data 가 아닌 로컬 src)
 * @param mdFilePath - 마크다운 파일 절대경로, 미저장이면 null
 * @param fromHtml - 렌더된 HTML 에서 뽑은 src 면 true(엔티티 디코드 적용), 마크다운 토큰 src 면 false
 */
// @MX:ANCHOR: [AUTO] 미리보기·HTML·PDF·DOCX 이미지 경로 해석의 단일 소스
// @MX:REASON: [AUTO] 호출자 4곳(usePreview→embedPreviewImages, exportToHtml, generateHtmlContent, exportDocx).
//   불변식: 디코드 우선·원문 대체 순서, 엔티티 디코드는 HTML 출처에만(토큰 src 에 걸면 a&amp;b.png 파일을 놓침),
//   클라이언트는 `..` 를 정리하지 않고 후보별로 전용 명령에 넘긴다, 미저장 문서는 로컬 파일을 읽지 않는다.
// @MX:SPEC: SPEC-EXPORT-004
export async function readLocalImage(
  src: string,
  mdFilePath: string | null,
  fromHtml: boolean,
): Promise<LocalImageResult> {
  const raw = fromHtml ? decodeHtmlEntities(src) : src;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // 잘못된 퍼센트 시퀀스 — 원문만 쓴다
  }
  const displayName = decoded;
  if (!mdFilePath) return { dataUri: null, displayName };

  const readers: Array<() => Promise<string>> = [];
  if (raw.startsWith('/')) {
    readers.push(() => readImageAsBase64(raw));
  } else {
    const mdDir = mdFilePath.substring(0, Math.max(mdFilePath.lastIndexOf('/'), mdFilePath.lastIndexOf('\\')));
    const sep = mdFilePath.includes('\\') ? '\\' : '/';
    const candidates = decoded === raw ? [raw] : [decoded, raw];
    for (const c of candidates) {
      if (hasParentSegment(c)) {
        readers.push(() => readRelativeImageAsBase64(mdFilePath, c));
      } else {
        const normalized = c.startsWith('./') ? c.substring(2) : c;
        const absolutePath = `${mdDir}${sep}${normalized.replace(/\//g, sep)}`;
        readers.push(() => readImageAsBase64(absolutePath));
      }
    }
  }

  for (const read of readers) {
    try {
      return { dataUri: await read(), displayName };
    } catch {
      // 이 후보를 읽지 못함 — 다음 후보를 시도한다
    }
  }
  return { dataUri: null, displayName };
}

/**
 * 렌더된 HTML 의 로컬 img src 를 data URI 로 치환하고, 임베드하지 못한 이미지 이름을 모은다.
 * 치환은 엔티티 디코드 전 원래 속성 문자열 기준이다(REQ-003). 같은 src 는 한 번만 읽고 한 번만 보고한다.
 */
export async function embedImagesInHtml(
  html: string,
  mdFilePath: string | null,
): Promise<{ html: string; unembedded: string[] }> {
  if (!html) return { html, unembedded: [] };

  const imgRegex = /<img\s+[^>]*src="([^"]*)"[^>]*>/g;
  const matches: Array<{ full: string; src: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    matches.push({ full: match[0], src: match[1] });
  }

  let result = html;
  const resolved = new Map<string, LocalImageResult>();
  const unembedded = new Set<string>();

  for (const { full, src } of matches) {
    if (!isLocalImageSrc(src)) continue;
    let r = resolved.get(src);
    if (!r) {
      r = await readLocalImage(src, mdFilePath, true);
      resolved.set(src, r);
    }
    if (r.dataUri !== null) {
      const dataUri = r.dataUri;
      result = result.replace(full, full.replace(`src="${src}"`, () => `src="${dataUri}"`));
    } else {
      unembedded.add(r.displayName);
    }
  }

  return { html: result, unembedded: [...unembedded] };
}

/**
 * Embeds local images referenced in rendered HTML as base64 data URIs.
 *
 * Used by the preview panel to render images without relying on the Tauri
 * asset: protocol (which requires explicit scope configuration in production).
 * SPEC-EXPORT-004: 경로 해석은 공용 embedImagesInHtml 에 위임한다(시그니처 무변경).
 *
 * @param html - Rendered HTML string containing img tags
 * @param mdFilePath - Absolute path to the markdown file, or null if unsaved
 * @returns HTML string with local image srcs replaced by base64 data URIs
 */
export async function embedPreviewImages(html: string, mdFilePath: string | null): Promise<string> {
  if (!mdFilePath || !html) return html;
  return (await embedImagesInHtml(html, mdFilePath)).html;
}
