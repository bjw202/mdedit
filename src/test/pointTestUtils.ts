// @MX:SPEC: SPEC-AI-017 M4b — 가리키기 테스트 공용 도우미. 실제 renderMarkdown·renderDiagram 출력으로 DOM 을 만든다.
import { renderMarkdown } from '@/lib/markdown/renderer';
import { renderDiagram } from '@/lib/diagram/diagramRenderer';

/** 계획 단계 예시 문서(acceptance.md) — 줄 번호는 0부터. 표 2~6줄, 펜스 8~14줄. */
export const POINT_DOC = [
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

/** PreviewRenderer 와 같은 순서로 마크다운을 DOM 에 그린다(다이어그램 컨테이너마다 renderDiagram). */
export async function mountPreview(source: string): Promise<HTMLElement> {
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
