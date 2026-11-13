// @MX:SPEC: SPEC-AI-017 M3 — 실제 renderMarkdown 출력과 실제 renderDiagram SVG 로 검증한다(손으로 만든 마크업 금지).
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '@/lib/markdown/renderer';
import { renderDiagram } from '@/lib/diagram/diagramRenderer';
import {
  classifyTarget,
  locatePointBlock,
  buildPointerInfo,
  buildPointerSummary,
  isPointStale,
  decideHighlightRestore,
  evaluatePointLength,
  isPointingActive,
  type PointBlock,
  type PointClassification,
} from './pointTarget';

/** PreviewRenderer 와 같은 순서로 마크다운을 DOM 에 그린다(다이어그램 컨테이너마다 renderDiagram). */
async function mountPreview(source: string): Promise<HTMLElement> {
  const html = await renderMarkdown(source, null, false);
  const root = document.createElement('div');
  root.className = 'preview-content';
  root.innerHTML = html;
  root.querySelectorAll('.mermaid-container').forEach((el) => {
    const diagram = el.getAttribute('data-diagram') ?? '';
    if (diagram.trim() === '') return;
    const r = renderDiagram(diagram);
    if (r.ok) el.innerHTML = r.svg;
  });
  document.body.appendChild(root);
  return root;
}

const fence = (code: string): string => '```mermaid\n' + code + '\n```';

/** 노드 ID 의 안쪽 글자 요소를 찾아 분류한다. */
function nodeTarget(root: HTMLElement, id: string, nth = 0): PointClassification {
  const g = root.querySelectorAll(`g.pele-node[data-id="${id}"]`)[nth];
  const inner = g?.querySelector('text, path, rect') ?? g ?? null;
  return classifyTarget(inner, root);
}

function cellTarget(root: HTMLElement, tableIdx: number, selector: string): PointClassification {
  const table = root.querySelectorAll('table')[tableIdx];
  return classifyTarget(table.querySelector(selector), root);
}

function mustLocate(root: HTMLElement, source: string, t: PointClassification): PointBlock {
  const r = locatePointBlock(root, source, t);
  if (!r.ok) throw new Error(`locate 실패: ${r.reason}`);
  return r.block;
}

const UNPOINTABLE = { ok: false, reason: 'unpointable' };

describe('R1: 문자 참조가 든 다이어그램은 일치 확인을 통과한다', () => {
  it('A[R&amp;D] --> B[x &lt; y] 와 &copy 라벨이 있어도 노드가 대상이 된다', async () => {
    const source = fence('flowchart LR\n  A[R&amp;D] --> B[x &lt; y]\n  B --> C[&copy]');
    const root = await mountPreview(source);
    const t = nodeTarget(root, 'A');
    expect(t.kind).toBe('node');
    expect(locatePointBlock(root, source, t).ok).toBe(true);
  });
});

// 계획 단계 예시 문서(acceptance.md) — 줄 번호는 0부터.
const DOC = [
  '# 요금',
  '',
  '| 요금제 | 월 요금 | 저장 공간 |',
  '|---|---:|---|',
  '| 무료 | 0원 | 5GB |',
  '| 기본 | [9,900원](https://example.com/p) | 100GB |',
  '| 프로 | 19,900원 | 1TB |',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[장바구니] --> B[주문서 작성]',
  '  B --> C{결제}',
  '  C -->|성공| D[주문 완료]',
  '  C -->|실패| B',
  '```',
  '',
  '- 목록 안 표',
  '  | a | b |',
  '  |---|---|',
  '  | 1 | 2 |',
].join('\n');

describe('AC-AI17-002: 대상 판정', () => {
  it('머리 칸은 열, 본문 칸은 칸(링크 글자 포함), 노드 글자는 노드', async () => {
    const root = await mountPreview(DOC);
    expect(cellTarget(root, 0, 'thead th:nth-child(2)')).toMatchObject({ kind: 'column', col: 2 });
    expect(cellTarget(root, 0, 'tbody tr:nth-child(2) a')).toMatchObject({ kind: 'cell', row: 2, col: 2 });
    const c = nodeTarget(root, 'C');
    expect(c).toMatchObject({ kind: 'node', nodeId: 'C', nodeText: '결제' });
  });

  it('연결선·목록 안 표는 대상이 아니다', async () => {
    const root = await mountPreview(DOC);
    const edge = root.querySelector('g.pele-edge text, g.pele-edge path');
    expect(edge).not.toBeNull();
    expect(classifyTarget(edge, root).kind).toBe('none');
    expect(cellTarget(root, 1, 'tbody td').kind).toBe('none');
    expect(cellTarget(root, 1, 'thead th').kind).toBe('none');
  });
});

// spike/sanitize-data-id.test.ts.txt 의 SAMPLES
const SAMPLES: Record<string, string> = {
  flowchart: 'flowchart LR\n  A[주문] --> B{결제}\n  B -->|성공| C[완료]\n  subgraph S[묶음]\n    C\n  end',
  sequence: 'sequenceDiagram\n  participant U as 사용자\n  participant S as 서버\n  U->>S: 요청\n  S-->>U: 응답',
  state: 'stateDiagram-v2\n  [*] --> 대기\n  대기 --> 실행: 시작\n  실행 --> [*]',
  class: 'classDiagram\n  class 주문 {\n    +id: string\n  }\n  주문 --> 결제',
  er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
  mindmap: 'mindmap\n  root((계획))\n    조사\n    실행',
  pie: 'pie\n  "A": 3\n  "B": 5',
  gantt: 'gantt\n  title 일정\n  section 단계\n  설계 :a1, 2026-01-01, 3d',
};

describe('AC-AI17-003: 노드 마크업 계약 (pele 버전이 올라 깨지면 실패)', () => {
  for (const name of ['flowchart', 'sequence', 'state', 'class', 'er', 'mindmap']) {
    it(`${name}: g.pele-node[data-id] 가 있고 안쪽 요소에서 ID 를 되찾는다`, async () => {
      const root = await mountPreview(fence(SAMPLES[name]));
      const nodes = root.querySelectorAll('g.pele-node[data-id]');
      expect(nodes.length).toBeGreaterThan(0);
      const inner = nodes[0].querySelector('text, path, rect, circle, ellipse, polygon');
      expect(inner).not.toBeNull();
      expect(inner!.closest('g.pele-node')?.getAttribute('data-id')).toBe(nodes[0].getAttribute('data-id'));
    });
  }

  it('sequence 참가자는 같은 ID 의 노드가 2개다', async () => {
    const root = await mountPreview(fence(SAMPLES.sequence));
    expect(root.querySelectorAll('g.pele-node[data-id="U"]').length).toBe(2);
  });

  it('state: 가상 노드 root_start 는 대상 아님, 한글 ID 대기 는 대상', async () => {
    const src = fence(SAMPLES.state);
    const root = await mountPreview(src);
    const virtual = nodeTarget(root, 'root_start');
    expect(virtual.kind).toBe('node');
    expect(locatePointBlock(root, src, virtual)).toEqual({ ok: false, reason: 'not-target' });
    expect(locatePointBlock(root, src, nodeTarget(root, '대기')).ok).toBe(true);
  });

  it('pie·gantt 는 노드가 없다', async () => {
    for (const name of ['pie', 'gantt']) {
      const root = await mountPreview(fence(SAMPLES[name]));
      expect(root.querySelectorAll('g.pele-node[data-id]').length).toBe(0);
    }
  });
});

describe('AC-AI17-004: 순번 블록 찾기', () => {
  it('표: 표 다섯 줄(2~6줄), 기본 행 칸의 소스 줄은 5줄. 목록 안 표가 순번을 흔들지 않는다', async () => {
    const root = await mountPreview(DOC);
    const block = mustLocate(root, DOC, cellTarget(root, 0, 'tbody tr:nth-child(2) td:nth-child(2)'));
    expect(block).toMatchObject({ kind: 'table', ordinal: 0, startLine: 2, endLine: 7 });
    expect(block.text.split('\n')).toHaveLength(5);
    expect(block.text.split('\n')[3]).toContain('[9,900원]');
  });

  it('다이어그램: selection 은 펜스 안 코드 다섯 줄, 범위는 펜스 포함 7줄(8~14줄)', async () => {
    const root = await mountPreview(DOC);
    const block = mustLocate(root, DOC, nodeTarget(root, 'C'));
    expect(block).toMatchObject({ kind: 'diagram', ordinal: 0, startLine: 8, endLine: 15 });
    expect(block.text.split('\n')).toHaveLength(5);
    expect(block.text.startsWith('flowchart LR')).toBe(true);
    expect(block.text.endsWith('C -->|실패| B')).toBe(true);
  });

  it('표 앞에 여러 줄 인라인 <svg> 가 있어도 줄 범위가 에디터 문서 기준으로 맞다', async () => {
    const svg = '<svg width="10" height="10">\n<rect width="10" height="10"/>\n<circle r="2"/>\n<line x1="0"/>\n</svg>';
    const doc = `${svg}\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n${fence('flowchart LR\n  X --> Y')}`;
    const root = await mountPreview(doc);
    const t = mustLocate(root, doc, cellTarget(root, 0, 'tbody td'));
    expect(t).toMatchObject({ startLine: 6, endLine: 9, text: '| a | b |\n|---|---|\n| 1 | 2 |' });
    const d = mustLocate(root, doc, nodeTarget(root, 'Y'));
    expect(d).toMatchObject({ startLine: 10, endLine: 14, text: 'flowchart LR\n  X --> Y' });
  });

  it('```mermaid 뒤에 공백이 붙은 펜스 2개: 두 번째 노드는 두 번째 펜스', async () => {
    const doc = '```mermaid \nflowchart LR\n  A --> B\n```\n\n```mermaid \nflowchart LR\n  C --> D\n```';
    const root = await mountPreview(doc);
    expect(root.querySelectorAll('.mermaid-container')).toHaveLength(2);
    const b = mustLocate(root, doc, nodeTarget(root, 'D'));
    expect(b).toMatchObject({ ordinal: 1, startLine: 5, text: 'flowchart LR\n  C --> D' });
  });

  it('표 모양 줄이 든 $$ 블록 뒤의 표: 수식 블록이 표로 세어지지 않는다', async () => {
    const doc = '$$\n| a | b |\n|---|---|\n| 1 | 2 |\n$$\n\n| x | y |\n|---|---|\n| 3 | 4 |';
    const root = await mountPreview(doc);
    const b = mustLocate(root, doc, cellTarget(root, 0, 'tbody td'));
    expect(b).toMatchObject({ ordinal: 0, startLine: 6, text: '| x | y |\n|---|---|\n| 3 | 4 |' });
  });

  it('일치 확인: 표 수·다이어그램 수·data-diagram·머리 칸 수가 어긋나면 unpointable', async () => {
    const root = await mountPreview(DOC);
    const col = cellTarget(root, 0, 'thead th');
    const node = nodeTarget(root, 'C');
    expect(locatePointBlock(root, '| p |\n|---|\n| 1 |\n\n' + DOC, col)).toEqual(UNPOINTABLE);
    expect(locatePointBlock(root, DOC + '\n\n' + fence('flowchart LR\n  Z --> W'), node)).toEqual(UNPOINTABLE);
    expect(locatePointBlock(root, DOC.replace('A[장바구니]', 'A[바구니]'), node)).toEqual(UNPOINTABLE);
    const fewerHeaders = DOC.replace('| 요금제 | 월 요금 | 저장 공간 |\n|---|---:|---|', '| 요금제 | 월 요금 |\n|---|---:|');
    expect(locatePointBlock(root, fewerHeaders, col)).toEqual(UNPOINTABLE);
  });
});

describe('AC-AI17-005: 낡은 미리보기', () => {
  const block = { kind: 'table', ordinal: 0 } as const;
  it('표 칸이 바뀌면 낡음, 표 밖(제목)만 바뀌면 낡음 아님, 블록이 사라져도 낡음', () => {
    expect(isPointStale(DOC, DOC.replace('100GB', '200GB'), block)).toBe(true);
    expect(isPointStale(DOC, DOC.replace('# 요금', '# 요금표'), block)).toBe(false);
    expect(isPointStale(DOC, '# 요금', block)).toBe(true);
  });
  it('강조 복원 판정: 제목만 바뀌면 restore, 대상 표 칸이 바뀌면 clear', () => {
    const text = DOC.split('\n').slice(2, 7).join('\n');
    expect(decideHighlightRestore(text, DOC.replace('# 요금', '# X'), block)).toBe('restore');
    expect(decideHighlightRestore(text, DOC.replace('100GB', '200GB'), block)).toBe('clear');
    expect(decideHighlightRestore(text, '# 요금', block)).toBe('clear');
  });
});

describe('AC-AI17-006: 대상 정보 문자열', () => {
  it('열·칸·노드', async () => {
    const root = await mountPreview(DOC);
    const col = cellTarget(root, 0, 'thead th:nth-child(2)');
    expect(buildPointerInfo(col, mustLocate(root, DOC, col))).toBe('대상: 열\n열 번호: 2 (왼쪽부터)\n열 머리: 월 요금');
    const cell = cellTarget(root, 0, 'tbody tr:nth-child(2) td:nth-child(2)');
    expect(buildPointerInfo(cell, mustLocate(root, DOC, cell))).toBe(
      '대상: 칸\n행 번호: 2 (머리 행 다음부터)\n열 번호: 2 (왼쪽부터)\n열 머리: 월 요금\n칸 내용: [9,900원](https://example.com/p)',
    );
    const node = nodeTarget(root, 'C');
    expect(buildPointerInfo(node, mustLocate(root, DOC, node))).toBe('대상: 노드\n노드 ID: C\n표시 글자: 결제');
  });

  it('소스 행에 칸이 모자라면 칸 내용은 빈 값', async () => {
    const doc = '| a | b | c |\n|---|---|---|\n| 1 |';
    const root = await mountPreview(doc);
    const t = cellTarget(root, 0, 'tbody td:nth-child(3)');
    expect(t).toMatchObject({ kind: 'cell', row: 1, col: 3 });
    expect(buildPointerInfo(t, mustLocate(root, doc, t))).toBe(
      '대상: 칸\n행 번호: 1 (머리 행 다음부터)\n열 번호: 3 (왼쪽부터)\n열 머리: c\n칸 내용: ',
    );
  });

  it('입력창 요약 한 줄', async () => {
    const root = await mountPreview(DOC);
    const col = cellTarget(root, 0, 'thead th:nth-child(2)');
    expect(buildPointerSummary(col, mustLocate(root, DOC, col))).toBe('열: 월 요금');
    const cell = cellTarget(root, 0, 'tbody tr:nth-child(2) td:nth-child(2)');
    expect(buildPointerSummary(cell, mustLocate(root, DOC, cell))).toBe('칸: 2행 · 월 요금');
    const node = nodeTarget(root, 'C');
    expect(buildPointerSummary(node, mustLocate(root, DOC, node))).toBe('노드: 결제 (C)');
  });

  it('이스케이프된 파이프는 | 로 풀린 값이 들어간다', async () => {
    const doc = '| a | b |\n|---|---|\n| x \\| y | 2 |';
    const root = await mountPreview(doc);
    const t = cellTarget(root, 0, 'tbody td:nth-child(1)');
    expect(buildPointerInfo(t, mustLocate(root, doc, t))).toContain('칸 내용: x | y');
  });
});

describe('AC-AI17-008: 길이 판정', () => {
  const v = (n: number) => evaluatePointLength({ kind: 'table', text: 'x'.repeat(n) });
  it('12,001자는 막힘, 12,000자·6,001자는 삽입 전용, 6,000자는 보통', () => {
    expect(v(12001).allowed).toBe(false);
    expect(v(12001).reason).toContain('개요·표·다이어그램·짧게는');
    expect(v(12000)).toMatchObject({ allowed: true, insertOnly: true });
    expect(v(6001)).toMatchObject({ allowed: true, insertOnly: true });
    expect(v(6000)).toMatchObject({ allowed: true, insertOnly: false });
  });
  it('다이어그램도 같은 판정', () => {
    expect(evaluatePointLength({ kind: 'diagram', text: 'x'.repeat(12001) }).allowed).toBe(false);
  });
});

describe('AC-AI17-001: 활성 조건', () => {
  it('켜짐 + 잠금 없음 + split 에서만 활성', () => {
    expect(isPointingActive({ userEnabled: true, policyDisabled: false, viewMode: 'split' })).toBe(true);
    expect(isPointingActive({ userEnabled: false, policyDisabled: false, viewMode: 'split' })).toBe(false);
    expect(isPointingActive({ userEnabled: true, policyDisabled: true, viewMode: 'split' })).toBe(false);
    expect(isPointingActive({ userEnabled: true, policyDisabled: false, viewMode: 'editor' })).toBe(false);
    expect(isPointingActive({ userEnabled: true, policyDisabled: false, viewMode: 'preview' })).toBe(false);
  });
});
