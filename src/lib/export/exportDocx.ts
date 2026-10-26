// @MX:NOTE: [AUTO] DOCX export using docx npm package for SPEC-EXPORT-001
// @MX:SPEC: SPEC-EXPORT-001
// @MX:SPEC: SPEC-EXPORT-004
// @MX:SPEC: SPEC-PREVIEW-015

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
import { exportSaveDialog, writeBinaryFile } from '@/lib/tauri/ipc';
import { isLocalImageSrc, readLocalImage } from '@/lib/image/imageResolver';
import { readPeleThemeValues, type PeleThemeValues } from '@/lib/diagram/diagramRenderer';
import { generateExportFilename, previewDiagramInput, renderExportDiagram } from './exportUtils';
import type { ExportOptions } from './types';

// @MX:NOTE: [AUTO] DOCX page width in points (~595pt A4) minus margins (~1.25in each side = 180pt)
const DOCX_MAX_IMAGE_WIDTH = 415;

// @MX:WARN: [AUTO] DOCX export uses complex markdown token traversal - handle edge cases carefully
// @MX:REASON: [AUTO] markdown-it tokens have nested structure that requires careful state tracking

type DocxChild = Paragraph | Table;

/**
 * SPEC-EXPORT-004: 토큰 변환 중 이미지 해석에 필요한 문맥.
 * unembedded 는 임베드하지 못한 로컬 이미지 이름(중복 없음, 등장 순서)을 모은다.
 */
interface ImageContext {
  mdFilePath: string | null;
  unembedded: Set<string>;
  /** SPEC-PREVIEW-015 D6: DOCX 다이어그램 색 값 — 내보내기 테마와 상관없이 항상 라이트 */
  diagramColors: PeleThemeValues;
}

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
 * @returns 저장 경로(string)를 반환. 사용자가 다이얼로그를 취소하면 null.
 */
// @MX:ANCHOR: [AUTO] DOCX 내보내기의 유일한 진입점이자 외부 시스템(Tauri IPC) 경계.
//   불변식: exportSaveDialog 가 null(사용자 취소)을 주면 즉시 null 을 반환하고 writeBinaryFile 을
//   포함한 어떤 부수효과도 실행하지 않는다(REQ-007 취소절/REQ-017). 성공 시에는 반드시 저장 경로
//   문자열을 반환한다 — void 나 boolean 으로 되돌리지 말 것.
// @MX:REASON: [AUTO] 취소 경로에서 조기 반환이 사라지면 사용자가 취소했는데도 파일이 만들어지거나
//   빈 경로로 쓰기가 시도된다. 반환값은 호출자(AppLayout.tsx)가 "내보내기 완료" 모달에서 열기·폴더
//   표시에 그대로 쓰는 값이라, 경로를 잃으면 완료 모달이 동작 불능이 된다(exportToHtml 과 동형 계약).
// @MX:NOTE: [AUTO] SPEC-EXPORT-002 (REQ-007) 반환 계약 — 과거 Promise<void> 에서
//   Promise<string | null> 로 확장. 완료 모달이 저장 경로를 필요로 함. exportToHtml 과 동형.
//   후보 A 선택: 프로덕션 호출자(AppLayout.tsx:174)가 폐기하므로 회귀 없음(progress.md T2).
// @MX:SPEC: SPEC-EXPORT-002
export async function exportToDocx(options: ExportOptions): Promise<string | null> {
  const { content, filename, mdFilePath } = options;

  const defaultName = generateExportFilename(filename, 'docx');
  const savePath = await exportSaveDialog('docx', defaultName);
  if (savePath === null) {
    // SPEC-EXPORT-002 REQ-007 (취소절) + REQ-017: null 반환, 파일 쓰기 없음.
    return null;
  }

  // Parse markdown to tokens
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
  });
  md.enable('table');
  md.enable('strikethrough');

  const tokens = md.parse(content, {});
  const imageCtx: ImageContext = {
    mdFilePath: mdFilePath ?? null,
    unembedded: new Set(),
    // DOCX 페이지는 항상 흰색이라 다크 값으로 그리면 글자가 거의 보이지 않는다(design.md D6, M1 report F3).
    diagramColors: readPeleThemeValues('light'),
  };
  const docxChildren = await convertTokensToDocx(tokens, imageCtx);
  // SPEC-EXPORT-004 (REQ-008): 이미지 임베드 단계가 끝난 직후 누락을 한 번 알린다.
  if (imageCtx.unembedded.size > 0) options.onUnembeddedImages?.([...imageCtx.unembedded]);

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

  // SPEC-EXPORT-002 REQ-007: 저장 경로를 반환.
  return savePath;
}

interface MermaidImageData {
  data: Uint8Array;
  width: number;
  height: number;
}

// @MX:WARN: [AUTO] 다이어그램 PNG는 펜스 토큰을 만난 자리에서 그 펜스 원문으로 렌더·변환한다 — 결과를 큐에 모아 순서로 짝짓지 말 것
// @MX:REASON: [AUTO] SVG→data URI→Image→canvas 변환은 비동기다. 예전처럼 미리 모은 배열을 shift()로 꺼내면 실패·빈 펜스나
//   목록 안 펜스 하나만 어긋나도 뒤 그림이 모두 한 칸씩 밀린다(AC-PREVIEW015-019). 펜스마다 await해 위치와 결과를 짝짓는다.
/**
 * 펜스 원문 1개를 다이어그램 PNG로 바꾼다(SPEC-PREVIEW-015 REQ-015·017·019).
 * 입력은 미리보기와 같은 문자열(previewDiagramInput), 색은 항상 라이트(D6), 크기는 pele width·height(D8).
 * 빈 펜스·렌더 실패·래스터 실패는 null — 호출자가 코드 텍스트로 대신 넣는다(D7).
 */
async function renderFenceDiagramPng(fenceContent: string, colors: PeleThemeValues): Promise<MermaidImageData | null> {
  if (typeof document === 'undefined') return null;
  const diagram = renderExportDiagram(previewDiagramInput(fenceContent), colors);
  if (!diagram) return null;
  try {
    return await svgToPng(diagram.svg, diagram.width, diagram.height);
  } catch {
    return null;
  }
}

/**
 * Converts an SVG element to a PNG image using canvas.
 * Uses data URI instead of blob URL to comply with CSP img-src restrictions.
 * 크기는 pele가 알려 준 자연 크기를 쓴다 — 화면 배치(getBoundingClientRect)·zoom·패널 폭과 무관(D8).
 */
async function svgToPng(svg: SVGElement, naturalWidth: number, naturalHeight: number): Promise<MermaidImageData | null> {
  const svgData = new XMLSerializer().serializeToString(svg);
  // Use data URI (allowed by CSP img-src 'data:') instead of blob URL (blocked by CSP)
  const utf8Bytes = new TextEncoder().encode(svgData);
  let binaryStr = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binaryStr += String.fromCharCode(utf8Bytes[i]);
  }
  const dataUri = `data:image/svg+xml;base64,${btoa(binaryStr)}`;

  const width = naturalWidth;
  const height = naturalHeight;
  if (!(width > 0 && height > 0)) return null;
  // DOCX 삽입 크기(pt) = 0.75배, 페이지 폭을 넘으면 비율을 지켜 줄인다.
  let docxWidth = width * 0.75;
  let docxHeight = height * 0.75;
  if (docxWidth > DOCX_MAX_IMAGE_WIDTH) {
    docxHeight = docxHeight * (DOCX_MAX_IMAGE_WIDTH / docxWidth);
    docxWidth = DOCX_MAX_IMAGE_WIDTH;
  }

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
            width: Math.round(docxWidth), // points
            height: Math.round(docxHeight),
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
async function convertTokensToDocx(tokens: Token[], imageCtx: ImageContext): Promise<DocxChild[]> {
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
          const runs = await convertInlineTokensToRuns(inlineToken.children, imageCtx);
          result.push(new Paragraph({ children: runs }));
        }
        i += 3; // paragraph_open, inline, paragraph_close
        break;
      }

      case 'fence': {
        // 다이어그램 펜스는 이 자리에서 원본으로 렌더한다. 실패·빈 펜스는 아래 코드 텍스트로 넘어간다(D7).
        if (token.info?.trim() === 'mermaid') {
          const imageData = await renderFenceDiagramPng(token.content ?? '', imageCtx.diagramColors);
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
            const runs = await convertInlineTokensToRuns(tokens[j].children ?? [], imageCtx);
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
            const runs = await convertInlineTokensToRuns(tokens[j].children ?? [], imageCtx);
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
            const runs = await convertInlineTokensToRuns(tokens[j].children ?? [], imageCtx);
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
        const tableResult = await parseTable(tokens, i, imageCtx);
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
async function parseTable(tokens: Token[], startIndex: number, imageCtx: ImageContext): Promise<{ table: Table | null; nextIndex: number }> {
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
              ? await convertInlineTokensToRuns(inlineToken.children, imageCtx)
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
async function convertInlineTokensToRuns(inlineChildren: Token[], imageCtx: ImageContext): Promise<Array<TextRun | ExternalHyperlink | ImageRun>> {
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
        } else if (imgSrc && isLocalImageSrc(imgSrc)) {
          // SPEC-EXPORT-004: 경로 해석은 공용 readLocalImage(토큰 src → 엔티티 디코드 없음)에 위임한다.
          // 미저장 문서(mdFilePath null)는 readLocalImage 가 아무것도 읽지 않고 누락으로 돌려준다(REQ-008, plan D8).
          const { dataUri, displayName } = await readLocalImage(imgSrc, imageCtx.mdFilePath, false);
          try {
            if (dataUri === null) throw new Error('image not read');
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
          // SPEC-EXPORT-004 (REQ-008, plan D9): 읽기·base64·크기 계산 어느 단계든 실패하면 누락으로 기록
          if (!embedded) imageCtx.unembedded.add(displayName);
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
