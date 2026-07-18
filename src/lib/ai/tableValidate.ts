import MarkdownIt from 'markdown-it';

// @MX:SPEC: SPEC-AI-004
// @MX:NOTE: [AUTO] 표 검증은 renderer.ts 의 전체 인스턴스를 재사용하지 않고 로컬 최소
// 인스턴스를 쓴다 — shiki highlight/katex/mermaid/imageResolver 플러그인은 구조 검증과
// 무관하며 토큰 스트림에 잡음만 더한다. table 활성화는 renderer.ts:311 과 동일 계약.
const md = new MarkdownIt();
md.enable('table');

export interface TableValidationResult {
  valid: boolean;
  /** valid=false 일 때 재요청 프롬프트에 그대로 동봉되는 사유(구체적 수치 포함). */
  error?: string;
}

/**
 * markdown-it 의 escapedSplit 과 동일 규칙으로 표 행을 셀 단위 분해한다.
 * (`\|` 는 이스케이프, 백틱 안 파이프는 markdown-it 도 구분자로 취급하므로 동일하게 둔다 —
 * 실제 렌더 결과와 셀 수 해석이 어긋나면 안 된다.)
 */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let lastPos = 0;
  let escaped = false;
  for (let pos = 0; pos < line.length; pos++) {
    const ch = line[pos];
    if (ch === '|') {
      if (escaped) {
        current += line.slice(lastPos, pos - 1);
        lastPos = pos;
      } else {
        cells.push(current + line.slice(lastPos, pos));
        current = '';
        lastPos = pos + 1;
      }
    }
    escaped = ch === '\\';
  }
  cells.push(current + line.slice(lastPos));
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells;
}

// @MX:ANCHOR: [AUTO] validateMarkdownTable — 표 삽입 전 구조 계약(감지 + 열 수 일치)
// @MX:REASON: [AUTO] 본문 행의 셀 수는 토큰(td_open)으로 셀 수 없다 — markdown-it 은 본문
//   행을 항상 헤더 열 수만큼만 td 로 밀어내며 초과 셀은 조용히 버린다. 따라서 초과 셀 검출은
//   반드시 table_open.map 으로 원본 라인을 되짚어 세야 한다. 토큰 카운트로 되돌리면 "헤더보다
//   셀이 많은 행"이 영구 미검출된다.
/**
 * AI 가 생성한 마크다운 표를 삽입 전에 사전 검증한다(다이어그램 사전 검증과 대칭).
 * (a) table_open 토큰 존재 — 표로 파싱되지 않은 출력(구분선 누락, 코드펜스로 감싼 응답,
 *     그냥 산문)을 한 번에 걸러낸다. 펜스는 fence 토큰이 되므로 별도 처리가 필요 없다.
 * (b) 헤더 열 수와 모든 본문 행의 셀 수가 일치하는지.
 */
export function validateMarkdownTable(text: string): TableValidationResult {
  const tokens = md.parse(text, {});
  const openIdx = tokens.findIndex((t) => t.type === 'table_open');
  if (openIdx === -1) {
    return {
      valid: false,
      error: '표가 감지되지 않았어요 — 구분선(|---|---|) 행이 필요합니다.',
    };
  }

  const closeIdx = tokens.findIndex((t, i) => i > openIdx && t.type === 'table_close');
  const headerCols = tokens
    .slice(openIdx, closeIdx === -1 ? tokens.length : closeIdx)
    .filter((t) => t.type === 'th_open').length;

  // table_open.map = [시작 라인, 끝 라인(제외)]. +2 는 헤더행·구분선행을 건너뛴다.
  const map = tokens[openIdx].map;
  if (!map) return { valid: true };
  const lines = text.split('\n');
  for (let line = map[0] + 2; line < map[1]; line++) {
    const cols = splitRow(lines[line] ?? '').length;
    if (cols !== headerCols) {
      return {
        valid: false,
        error: `열 개수가 맞지 않아요 — 헤더는 ${headerCols}열인데 ${line - map[0] - 1}번째 행은 ${cols}열입니다.`,
      };
    }
  }
  return { valid: true };
}
