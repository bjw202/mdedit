// @MX:NOTE: [AUTO] DOCX export using docx npm package for SPEC-EXPORT-001
// @MX:SPEC: SPEC-EXPORT-001

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  ExternalHyperlink,
  ImageRun,
  AlignmentType,
  BorderStyle,
  WidthType,
} from 'docx';
import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { exportSaveDialog, writeBinaryFile, readImageAsBase64 } from '@/lib/tauri/ipc';
import { generateExportFilename } from './exportUtils';
import type { ExportOptions } from './types';

// @MX:NOTE: [AUTO] DOCX page width in points (~595pt A4) minus margins (~1.25in each side = 180pt)
const DOCX_MAX_IMAGE_WIDTH = 415;

// @MX:WARN: [AUTO] DOCX export uses complex markdown token traversal - handle edge cases carefully
// @MX:REASON: [AUTO] markdown-it tokens have nested structure that requires careful state tracking
// @MX:NOTE: [AUTO] mermaidImages array is consumed via shift() - order must match DOM order of .mermaid-container elements

type DocxChild = Paragraph | Table;

/**
 * Exports the markdown content as a DOCX file.
 *
 * Strategy:
 * 1. Parse markdown with markdown-it to get tokens
 * 2. Convert tokens to docx elements
 * 3. Pack to binary using Packer.toBlob()
 * 4. Save via Tauri IPC
 *
 * @param options - Export options
 */
export async function exportToDocx(options: ExportOptions): Promise<void> {
  const { content, filename, mdFilePath } = options;

  const defaultName = generateExportFilename(filename, 'docx');
  const savePath = await exportSaveDialog('docx', defaultName);
  if (savePath === null) {
    return;
  }

  // Capture mermaid SVGs from DOM before conversion
  const mermaidImages = await captureMermaidImages();

  // Parse markdown to tokens
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
  });
  md.enable('table');
  md.enable('strikethrough');

  const tokens = md.parse(content, {});
  const docxChildren = await convertTokensToDocx(tokens, mermaidImages, mdFilePath ?? null);

  const doc = new Document({
    sections: [
      {
        children: docxChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const buffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  const byteArray = Array.from(uint8Array);

  await writeBinaryFile(savePath, byteArray);
}

interface MermaidImageData {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Captures rendered mermaid SVGs from the DOM and converts them to PNG images.
 * Returns an array of image data in the order they appear in the DOM.
 */
async function captureMermaidImages(): Promise<MermaidImageData[]> {
  if (typeof document === 'undefined') return [];

  const containers = document.querySelectorAll('.mermaid-container');
  if (containers.length === 0) return [];

  const results: MermaidImageData[] = [];

  for (const container of containers) {
    const svg = container.querySelector('svg');
    if (!svg) continue;

    try {
      const pngData = await svgToPng(svg);
      if (pngData) {
        results.push(pngData);
      }
    } catch {
      // Skip failed SVG conversions
    }
  }

  return results;
}

/**
 * Converts an SVG element to a PNG image using canvas.
 * Uses data URI instead of blob URL to comply with CSP img-src restrictions.
 */
async function svgToPng(svg: SVGElement): Promise<MermaidImageData | null> {
  const svgData = new XMLSerializer().serializeToString(svg);
  // Use data URI (allowed by CSP img-src 'data:') instead of blob URL (blocked by CSP)
  const utf8Bytes = new TextEncoder().encode(svgData);
  let binaryStr = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binaryStr += String.fromCharCode(utf8Bytes[i]);
  }
  const dataUri = `data:image/svg+xml;base64,${btoa(binaryStr)}`;

  const svgRect = svg.getBoundingClientRect();
  const width = Math.max(svgRect.width, 400);
  const height = Math.max(svgRect.height, 200);

  return new Promise<MermaidImageData | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2; // 2x for retina quality
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          resolve(null);
          return;
        }
        pngBlob.arrayBuffer().then((buf) => {
          resolve({
            data: new Uint8Array(buf),
            width: Math.round(width * 0.75), // Scale down for DOCX (points)
            height: Math.round(height * 0.75),
          });
        });
      }, 'image/png');
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = dataUri;
  });
}

/**
 * Converts markdown-it tokens to docx document elements.
 */
async function convertTokensToDocx(tokens: Token[], mermaidImages: MermaidImageData[], mdFilePath: string | null): Promise<DocxChild[]> {
  const result: DocxChild[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    switch (token.type) {
      case 'heading_open': {
        const level = parseInt(token.tag.replace('h', ''), 10);
        const inlineToken = tokens[i + 1];
        const text = extractInlineText(inlineToken?.children ?? []);
        const headingLevel = getHeadingLevel(level);
        result.push(
          new Paragraph({
            text,
            heading: headingLevel,
          }),
        );
        i += 3; // heading_open, inline, heading_close
        break;
      }

      case 'paragraph_open': {
        const inlineToken = tokens[i + 1];
        if (inlineToken?.type === 'inline' && inlineToken.children) {
          const runs = await convertInlineTokensToRuns(inlineToken.children, mdFilePath);
          result.push(new Paragraph({ children: runs }));
        }
        i += 3; // paragraph_open, inline, paragraph_close
        break;
      }

      case 'fence': {
        // Check if this is a mermaid diagram
        if (token.info?.trim() === 'mermaid' && mermaidImages.length > 0) {
          const imageData = mermaidImages.shift();
          if (imageData) {
            result.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageData.data,
                    transformation: { width: imageData.width, height: imageData.height },
                    type: 'png',
                  }),
                ],
              }),
            );
            i++;
            break;
          }
        }
        const codeLines = (token.content ?? '').split('\n');
        for (const line of codeLines) {
          result.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line || ' ',
                  font: 'Courier New',
                  size: 20, // 10pt
                }),
              ],
            }),
          );
        }
        i++;
        break;
      }

      case 'code_block': {
        const codeLines = (token.content ?? '').split('\n');
        for (const line of codeLines) {
          result.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line || ' ',
                  font: 'Courier New',
                  size: 20,
                }),
              ],
            }),
          );
        }
        i++;
        break;
      }

      case 'blockquote_open': {
        // Find the content until blockquote_close
        let j = i + 1;
        const quoteParagraphs: DocxChild[] = [];
        let depth = 1;
        while (j < tokens.length && depth > 0) {
          if (tokens[j].type === 'blockquote_open') depth++;
          if (tokens[j].type === 'blockquote_close') depth--;
          if (depth > 0 && tokens[j].type === 'inline' && tokens[j].children) {
            const runs = await convertInlineTokensToRuns(tokens[j].children ?? [], mdFilePath);
            quoteParagraphs.push(
              new Paragraph({
                children: runs,
                indent: { left: 720 }, // 0.5 inch indent
                border: {
                  left: {
                    color: '999999',
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6,
                  },
                },
              }),
            );
          }
          j++;
        }
        result.push(...quoteParagraphs);
        i = j;
        break;
      }

      case 'bullet_list_open': {
        // Find all list items
        let j = i + 1;
        let depth = 1;
        while (j < tokens.length && depth > 0) {
          if (tokens[j].type === 'bullet_list_open') depth++;
          if (tokens[j].type === 'bullet_list_close') depth--;
          if (depth > 0 && tokens[j].type === 'inline' && tokens[j].children) {
            const runs = await convertInlineTokensToRuns(tokens[j].children ?? [], mdFilePath);
            result.push(
              new Paragraph({
                children: [new TextRun({ text: '• ' }), ...runs],
                indent: { left: 360 },
              }),
            );
          }
          j++;
        }
        i = j;
        break;
      }

      case 'ordered_list_open': {
        let j = i + 1;
        let depth = 1;
        let itemNum = 1;
        while (j < tokens.length && depth > 0) {
          if (tokens[j].type === 'ordered_list_open') depth++;
          if (tokens[j].type === 'ordered_list_close') depth--;
          if (depth > 0 && tokens[j].type === 'inline' && tokens[j].children) {
            const runs = await convertInlineTokensToRuns(tokens[j].children ?? [], mdFilePath);
            result.push(
              new Paragraph({
                children: [new TextRun({ text: `${itemNum}. ` }), ...runs],
                indent: { left: 360 },
              }),
            );
            itemNum++;
          }
          j++;
        }
        i = j;
        break;
      }

      case 'table_open': {
        const tableResult = await parseTable(tokens, i, mdFilePath);
        if (tableResult.table) {
          result.push(tableResult.table);
        }
        i = tableResult.nextIndex;
        break;
      }

      case 'hr': {
        result.push(
          new Paragraph({
            children: [new TextRun({ text: '' })],
            border: {
              bottom: {
                color: 'auto',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
          }),
        );
        i++;
        break;
      }

      default:
        i++;
        break;
    }
  }

  return result;
}

/**
 * Parses a table from tokens starting at the given index.
 * Returns the Table element and the next token index after the table.
 */
async function parseTable(tokens: Token[], startIndex: number, mdFilePath: string | null): Promise<{ table: Table | null; nextIndex: number }> {
  let i = startIndex + 1;
  const tableRows: TableRow[] = [];
  let isHeader = false;

  while (i < tokens.length && tokens[i].type !== 'table_close') {
    const token = tokens[i];

    if (token.type === 'thead_open') {
      isHeader = true;
    } else if (token.type === 'thead_close') {
      isHeader = false;
    } else if (token.type === 'tr_open') {
      const cells: TableCell[] = [];
      i++;
      while (i < tokens.length && tokens[i].type !== 'tr_close') {
        if (tokens[i].type === 'th_open' || tokens[i].type === 'td_open') {
          const inlineToken = tokens[i + 1];
          const runs =
            inlineToken?.type === 'inline' && inlineToken.children
              ? await convertInlineTokensToRuns(inlineToken.children, mdFilePath)
              : [new TextRun({ text: '' })];

          cells.push(
            new TableCell({
              children: [
                new Paragraph({
                  children: runs,
                  alignment: AlignmentType.LEFT,
                }),
              ],
              shading: isHeader ? { fill: 'F3F4F6' } : undefined,
            }),
          );
          i += 3; // th/td_open, inline, th/td_close
        } else {
          i++;
        }
      }
      tableRows.push(new TableRow({ children: cells }));
    }
    i++;
  }

  if (tableRows.length === 0) {
    return { table: null, nextIndex: i + 1 };
  }

  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  return { table, nextIndex: i + 1 };
}

/**
 * Extracts plain text from inline tokens (ignoring formatting).
 */
function extractInlineText(inlineChildren: Token[]): string {
  return inlineChildren
    .filter((t) => t.type === 'text' || t.type === 'softbreak' || t.type === 'code_inline')
    .map((t) => (t.type === 'softbreak' ? ' ' : t.content ?? ''))
    .join('');
}

/**
 * Converts inline tokens to docx TextRun/ExternalHyperlink/ImageRun elements.
 */
async function convertInlineTokensToRuns(inlineChildren: Token[], mdFilePath: string | null): Promise<Array<TextRun | ExternalHyperlink | ImageRun>> {
  const runs: Array<TextRun | ExternalHyperlink | ImageRun> = [];
  let bold = false;
  let italic = false;
  let strikethrough = false;
  let currentLink: string | null = null;
  let linkRuns: TextRun[] = [];

  for (const token of inlineChildren) {
    switch (token.type) {
      case 'strong_open':
        bold = true;
        break;
      case 'strong_close':
        bold = false;
        break;
      case 'em_open':
        italic = true;
        break;
      case 'em_close':
        italic = false;
        break;
      case 's_open':
        strikethrough = true;
        break;
      case 's_close':
        strikethrough = false;
        break;
      case 'link_open': {
        currentLink = token.attrGet('href') ?? null;
        linkRuns = [];
        break;
      }
      case 'link_close': {
        if (currentLink && linkRuns.length > 0) {
          runs.push(
            new ExternalHyperlink({
              link: currentLink,
              children: linkRuns,
            }),
          );
        }
        currentLink = null;
        linkRuns = [];
        break;
      }
      case 'code_inline': {
        const codeRun = new TextRun({
          text: token.content ?? '',
          font: 'Courier New',
          size: 20,
          bold,
          italics: italic,
        });
        if (currentLink !== null) {
          linkRuns.push(codeRun);
        } else {
          runs.push(codeRun);
        }
        break;
      }
      case 'text':
      case 'softbreak': {
        const text = token.type === 'softbreak' ? ' ' : (token.content ?? '');
        if (!text) break;
        const textRun = new TextRun({
          text,
          bold,
          italics: italic,
          strike: strikethrough,
          style: currentLink ? 'Hyperlink' : undefined,
        });
        if (currentLink !== null) {
          linkRuns.push(textRun);
        } else {
          runs.push(textRun);
        }
        break;
      }
      case 'image': {
        const imgSrc = token.attrGet('src') ?? '';
        const altText = token.attrGet('alt') ?? token.content ?? 'image';

        let embedded = false;

        // Handle data URI images (inline-blob captures, e.g. screenshots)
        if (imgSrc.startsWith('data:')) {
          try {
            // Decode base64 payload to raw bytes
            const base64Data = imgSrc.split(',')[1] ?? '';
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let j = 0; j < binaryStr.length; j++) {
              bytes[j] = binaryStr.charCodeAt(j);
            }

            // Determine image dimensions (scale to fit DOCX page width)
            const dimensions = await getImageDimensions(imgSrc);
            let width = dimensions.width;
            let height = dimensions.height;
            if (width > DOCX_MAX_IMAGE_WIDTH) {
              const scale = DOCX_MAX_IMAGE_WIDTH / width;
              width = DOCX_MAX_IMAGE_WIDTH;
              height = Math.round(height * scale);
            }

            // Determine image type from data URI mime
            const mimeMatch = imgSrc.match(/^data:image\/(\w+)/);
            const imgType = mimeMatch?.[1] === 'jpeg' || mimeMatch?.[1] === 'jpg' ? 'jpg' : 'png';

            runs.push(
              new ImageRun({
                data: bytes,
                transformation: { width, height },
                type: imgType as 'jpg' | 'png' | 'gif' | 'bmp',
              }),
            );
            embedded = true;
          } catch {
            // Fall through to alt text fallback
          }
        } else if (mdFilePath && imgSrc && !imgSrc.startsWith('http://') && !imgSrc.startsWith('https://')) {
          // Try to embed the image if we have a markdown file path
          try {
            // Resolve relative path to absolute
            const mdDir = mdFilePath.substring(0, Math.max(mdFilePath.lastIndexOf('/'), mdFilePath.lastIndexOf('\\')));
            let absolutePath: string;
            if (imgSrc.startsWith('/')) {
              absolutePath = imgSrc;
            } else {
              const normalizedSrc = imgSrc.startsWith('./') ? imgSrc.substring(2) : imgSrc;
              absolutePath = `${mdDir}/${normalizedSrc}`;
            }

            const dataUri = await readImageAsBase64(absolutePath);
            // Extract raw base64 data (remove data:mime;base64, prefix)
            const base64Data = dataUri.split(',')[1] ?? '';
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let j = 0; j < binaryStr.length; j++) {
              bytes[j] = binaryStr.charCodeAt(j);
            }

            // Determine image dimensions (scale to fit DOCX page width)
            const dimensions = await getImageDimensions(dataUri);
            let width = dimensions.width;
            let height = dimensions.height;
            if (width > DOCX_MAX_IMAGE_WIDTH) {
              const scale = DOCX_MAX_IMAGE_WIDTH / width;
              width = DOCX_MAX_IMAGE_WIDTH;
              height = Math.round(height * scale);
            }

            // Determine image type from data URI
            const mimeMatch = dataUri.match(/^data:image\/(\w+)/);
            const imgType = mimeMatch?.[1] === 'jpeg' || mimeMatch?.[1] === 'jpg' ? 'jpg' : 'png';

            runs.push(
              new ImageRun({
                data: bytes,
                transformation: { width, height },
                type: imgType as 'jpg' | 'png' | 'gif' | 'bmp',
              }),
            );
            embedded = true;
          } catch {
            // Fall through to alt text fallback
          }
        }

        if (!embedded) {
          // Fallback: output alt text
          runs.push(new TextRun({ text: `[${altText}]`, italics: true }));
        }
        break;
      }
      default:
        break;
    }
  }

  return runs;
}

/**
 * Maps a heading level number (1-6) to a HeadingLevel enum value.
 */
function getHeadingLevel(level: number): typeof HeadingLevel[keyof typeof HeadingLevel] {
  switch (level) {
    case 1: return HeadingLevel.HEADING_1;
    case 2: return HeadingLevel.HEADING_2;
    case 3: return HeadingLevel.HEADING_3;
    case 4: return HeadingLevel.HEADING_4;
    case 5: return HeadingLevel.HEADING_5;
    case 6: return HeadingLevel.HEADING_6;
    default: return HeadingLevel.HEADING_1;
  }
}

/**
 * Gets the natural dimensions of an image from its data URI.
 * Falls back to a default size if dimensions cannot be determined.
 */
function getImageDimensions(dataUri: string): Promise<{ width: number; height: number }> {
  if (typeof document === 'undefined') {
    return Promise.resolve({ width: DOCX_MAX_IMAGE_WIDTH, height: 300 });
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve({ width: DOCX_MAX_IMAGE_WIDTH, height: 300 });
    };
    img.src = dataUri;
  });
}
