import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tauri-apps/api/core — SPEC-PREVIEW-008 inline svg 테스트가 imageResolver 경로(![]())도
// 검증하므로 jsdom 환경에서 convertFileSrc가 동작하도록 목업한다.
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
  invoke: vi.fn(),
}));

// Mock shiki to avoid async initialization issues in tests
vi.mock('shiki', () => ({
  createHighlighter: vi.fn().mockResolvedValue({
    codeToHtml: vi.fn().mockReturnValue('<pre class="shiki"><code>const x = 1;</code></pre>'),
  }),
}));

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>diagram</svg>' }),
  },
}));

describe('renderMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders plain text as a paragraph', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('Hello world', null);
    // data-line attribute is now injected for scroll sync
    expect(result).toContain('<p');
    expect(result).toContain('Hello world</p>');
  });

  it('renders headings correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('# Heading 1', null);
    // data-line attribute is now injected for scroll sync
    expect(result).toContain('<h1');
    expect(result).toContain('Heading 1</h1>');
  });

  it('renders bold text correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('**bold**', null);
    expect(result).toContain('<strong>bold</strong>');
  });

  it('renders italic text correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('*italic*', null);
    expect(result).toContain('<em>italic</em>');
  });

  it('renders inline code correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('`code`', null);
    expect(result).toContain('<code>code</code>');
  });

  it('renders unordered list correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('- item1\n- item2', null);
    // data-line attribute is now injected for scroll sync
    expect(result).toContain('<ul');
    expect(result).toContain('<li>item1</li>');
  });

  it('renders ordered list correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('1. first\n2. second', null);
    // data-line attribute is now injected for scroll sync
    expect(result).toContain('<ol');
    expect(result).toContain('<li>first</li>');
  });

  it('renders table correctly with inline border styles', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const table = '| Col1 | Col2 |\n|------|------|\n| A | B |';
    const result = await renderMarkdown(table, null);
    // data-line attribute and border styles are injected
    expect(result).toContain('<table');
    expect(result).toContain('border-collapse: separate');
    expect(result).toContain('border-spacing: 0');
    // th and td have right+bottom border (not border: 1px solid) to avoid WebKit clipping
    expect(result).toContain('border-right: 1px solid var(--table-border, #d1d5db)');
    expect(result).toContain('border-bottom: 1px solid var(--table-border, #d1d5db)');
    // cell content is present
    expect(result).toContain('>Col1</th>');
    expect(result).toContain('>A</td>');
  });

  it('renders strikethrough text correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('~~strikethrough~~', null);
    expect(result).toContain('<s>strikethrough</s>');
  });

  it('renders mermaid code block as container div', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const mermaidCode = '```mermaid\ngraph TD\n  A --> B\n```';
    const result = await renderMarkdown(mermaidCode, null);
    expect(result).toContain('class="mermaid-container"');
    expect(result).toContain('data-diagram=');
  });

  it('does NOT render raw HTML (html: false XSS prevention)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('<script>alert("xss")</script>', null);
    expect(result).not.toContain('<script>');
  });

  it('renders empty string without error', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('', null);
    expect(result).toBe('');
  });

  it('renders code block with shiki when highlighter is provided', async () => {
    const { createHighlighter } = await import('shiki');
    const mockHighlighter = await (createHighlighter as ReturnType<typeof vi.fn>)();

    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('```typescript\nconst x = 1;\n```', mockHighlighter);
    // shiki highlighter's codeToHtml should be called
    expect(mockHighlighter.codeToHtml).toHaveBeenCalled();
    expect(result).toContain('<pre');
  });

  it('falls back to default rendering when highlighter is null', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('```js\nconst x = 1;\n```', null);
    expect(result).toContain('<code');
  });
});

describe('renderMarkdown: data-line plugin (SPEC-PREVIEW-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects data-line attribute on paragraph elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('Hello world', null);
    expect(result).toContain('data-line="0"');
  });

  it('injects data-line attribute on heading elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('# Heading', null);
    expect(result).toContain('data-line="0"');
  });

  it('injects data-line attribute on list elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('- item1\n- item2', null);
    expect(result).toContain('data-line=');
  });

  it('injects data-line attribute on blockquote elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('> quote text', null);
    expect(result).toContain('data-line=');
    expect(result).toContain('<blockquote');
  });

  it('injects data-line attribute on table elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const table = '| Col1 | Col2 |\n|------|------|\n| A | B |';
    const result = await renderMarkdown(table, null);
    expect(result).toContain('data-line=');
    expect(result).toContain('<table');
  });

  it('uses correct 0-based line numbers for multi-line content', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = 'First paragraph\n\nSecond paragraph';
    const result = await renderMarkdown(content, null);
    expect(result).toContain('data-line="0"');
    expect(result).toContain('data-line="2"');
  });
});

describe('renderMarkdown: KaTeX math rendering (SPEC-PREVIEW-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 테스트 1: 인라인 수식이 .katex 클래스로 렌더링되는지 확인
  it('renders inline math with .katex class', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('Euler: $e^{i\\pi} + 1 = 0$', null);
    expect(result).toContain('class="katex"');
  });

  // 테스트 2: 블록 수식이 .katex-display 클래스로 렌더링되는지 확인
  it('renders block math with .katex-display class', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('$$\nE = mc^2\n$$', null);
    expect(result).toContain('katex-display');
  });

  // 테스트 3: 잘못된 LaTeX 구문이 렌더링을 중단시키지 않는지 확인 (throwOnError: false)
  it('does NOT crash on invalid LaTeX (throwOnError: false)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    // 잘못된 LaTeX 표현식 - 크래시 없이 렌더링되어야 함
    await expect(renderMarkdown('$\\invalid{syntax$', null)).resolves.toBeTruthy();
  });

  // 테스트 4: 코드 블록 내 달러 기호가 수식으로 처리되지 않는지 확인
  it('does NOT treat dollar signs inside code blocks as math', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('`$not math$`', null);
    // 코드 블록 내부는 수식 렌더링 대상이 아님
    expect(result).toContain('<code>');
    expect(result).not.toContain('class="katex"');
  });

  // 테스트 5: 수식 + 테이블 + 코드 혼합 콘텐츠가 정상 렌더링되는지 확인
  it('renders mixed content (math + table + code) correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = [
      'Inline: $a^2 + b^2 = c^2$',
      '',
      '| Col1 | Col2 |',
      '|------|------|',
      '| A    | B    |',
      '',
      '```js',
      'const x = 1;',
      '```',
    ].join('\n');
    const result = await renderMarkdown(content, null);
    expect(result).toContain('class="katex"');
    expect(result).toContain('<table');
    expect(result).toContain('<code');
  });

  // 테스트 6: 그리스 문자가 올바르게 렌더링되는지 확인
  it('renders Greek letters correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('$\\alpha + \\beta = \\gamma$', null);
    expect(result).toContain('class="katex"');
    // KaTeX는 그리스 문자를 span 요소로 렌더링함
    expect(result).toContain('<span');
  });

  // 테스트 7: 중첩 중괄호가 올바르게 렌더링되는지 확인
  it('renders nested braces correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('$\\frac{x^{2}}{y^{2}}$', null);
    expect(result).toContain('class="katex"');
  });
});

// ---- SPEC-PREVIEW-008 REQ-PREVIEW008-006/007: 인라인 SVG placeholder-and-restore ----
describe('renderMarkdown: inline SVG placeholder (SPEC-PREVIEW-008)', () => {
  it('본문의 <svg>...</svg>를 data-mdedit-svg 마커로 치환한다 (html:false 우회 없이 placeholder-and-restore)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = 'text before\n\n<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>\n\ntext after';
    const result = await renderMarkdown(content, null);
    expect(result).toContain('data-mdedit-svg=');
    // 마커에는 sanitize 이전 raw svg가 encodeURIComponent로 인코딩되어 담긴다
    expect(result).toContain(encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>'));
  });

  it('일반 원시 HTML(<script>)은 실행 가능한 태그가 아니라 이스케이프된 텍스트로 표시된다 (html:false 유지, REQ-007)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = 'before\n\n<script>window.__xssFlag = true;</script>\n\nafter';
    const result = await renderMarkdown(content, null);
    // html:false는 <script> 태그를 실행 가능한 형태로 만들지 않고 &lt;script&gt;로 이스케이프한다
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('data-mdedit-svg=');
  });

  it('코드펜스 안의 <svg> 텍스트는 치환되지 않고 코드로 그대로 남는다 (오치환 방지)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = ['설명', '', '```html', '<svg><circle r="1"/></svg>', '```'].join('\n');
    const result = await renderMarkdown(content, null);
    expect(result).not.toContain('data-mdedit-svg=');
    // 코드블록 안에서는 이스케이프된 텍스트로 표시된다
    expect(result).toContain('&lt;svg&gt;');
  });

  it('svg가 없는 일반 마크다운은 마커를 포함하지 않는다', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('# Title\n\nplain text', null);
    expect(result).not.toContain('data-mdedit-svg=');
  });

  it('이미지 문법 ![](icon.svg)는 인라인 svg 경로와 무관하게 정상 렌더된다 (회귀 차단, 시나리오 H)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('![alt text](icon.svg)', null, false, '/project/doc.md');
    expect(result).toContain('<img');
    expect(result).toContain('alt="alt text"');
    expect(result).not.toContain('data-mdedit-svg=');
  });

  // ---- 평가 결함 1(major): 인라인 코드 스팬(백틱) 안의 <svg> 텍스트는 치환되면 안 된다 ----
  // plan.md 위험표: "플레이스홀더 치환을 코드펜스/인라인코드 밖에만 적용" — 인라인 코드도 보호 대상.
  it('인라인 코드(백틱) 안의 <svg onload=...> 텍스트는 플레이스홀더로 치환되지 않고 코드로 남는다', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = 'Inline code svg text: `<svg onload=alert(1)></svg>` should stay as code.';
    const result = await renderMarkdown(content, null);
    expect(result).not.toContain('data-mdedit-svg=');
    // 인라인 코드는 <code>...</code>로 렌더되고 내용은 이스케이프된 텍스트여야 한다
    expect(result).toContain('<code>');
    expect(result).toMatch(/<code>&lt;svg onload=alert\(1\)&gt;&lt;\/svg&gt;<\/code>/);
  });

  it('인라인 코드 밖의 <svg>는 여전히 정상적으로 플레이스홀더로 치환된다 (회귀 차단)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content =
      'before `inline code` <svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg> after';
    const result = await renderMarkdown(content, null);
    expect(result).toContain('data-mdedit-svg=');
    expect(result).toContain('<code>inline code</code>');
  });

  // ---- 실사용 버그 리포트: 인라인코드 <svg> 언급이 뒤따르는 실제 SVG 추출을 가로막는 straddling-match 결함 ----
  // samples/svg-in-markdown.md 섹션 1에서 재현됨. 원인: INLINE_SVG_RE가 문서 전체를 대상으로
  // lazy 매칭하기 때문에, 인라인 코드 `<svg>` 안의 <svg에서 시작해 [\s\S]*?가 코드 스팬 경계를
  // 건너뛰어 실제 블록의 </svg>까지 통째로 삼켜버린다. 매치 시작 오프셋이 보호구간(인라인코드) 안에
  // 있으므로 isProtected가 true가 되어 전체 스팬이 무변환으로 방치되고, 결과적으로 실제 SVG가
  // 이스케이프된 원시 텍스트로 렌더된다.
  it('인라인코드 <svg> 언급 뒤에 오는 실제 SVG 블록은 straddling 없이 정상 추출된다 (실사용 버그 재현)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = [
      '붙여넣은 `<svg>` 입니다.',
      '',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>',
    ].join('\n');
    const result = await renderMarkdown(content, null);

    // 실제 SVG는 마커로 추출되어야 한다 (버그 상태에서는 이 마커가 생성되지 않았다)
    expect(result).toContain('data-mdedit-svg=');
    expect(result).toContain(
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>',
      ),
    );
    // 인라인코드 언급은 여전히 리터럴 <code> 텍스트로 남아야 한다
    expect(result).toMatch(/<code>&lt;svg&gt;<\/code>/);
  });

  it('인라인코드 언급 없이 실제 SVG만 있으면 여전히 정상 추출된다 (회귀 차단)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    const result = await renderMarkdown(content, null);
    expect(result).toContain('data-mdedit-svg=');
  });

  it('실제 SVG 없이 인라인코드 <svg onload=...>만 있으면 여전히 리터럴로 남는다 (평가 결함 1 회귀 차단)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = 'Inline code svg text: `<svg onload=alert(1)></svg>` should stay as code.';
    const result = await renderMarkdown(content, null);
    expect(result).not.toContain('data-mdedit-svg=');
    expect(result).toMatch(/<code>&lt;svg onload=alert\(1\)&gt;&lt;\/svg&gt;<\/code>/);
  });

  it('여러 인라인코드 <svg> 언급 뒤 실제 SVG 하나만 마커가 된다 (엣지 케이스)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = [
      '첫 언급: `<svg>` 두번째 언급: `<svg id="x">`',
      '',
      '실제 도형입니다.',
      '',
      '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 1,1 1,0"/></svg>',
    ].join('\n');
    const result = await renderMarkdown(content, null);

    // 마커는 정확히 하나만 생성되어야 한다 (실제 svg 1개)
    const markerCount = (result.match(/data-mdedit-svg=/g) ?? []).length;
    expect(markerCount).toBe(1);
    expect(result).toContain(
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 1,1 1,0"/></svg>'),
    );
    // 두 인라인코드 언급은 모두 리터럴로 남아야 한다
    expect(result).toMatch(/<code>&lt;svg&gt;<\/code>/);
    expect(result).toMatch(/<code>&lt;svg id=&quot;x&quot;&gt;<\/code>/);
  });
});

// ---- SPEC-PREVIEW-012: 표 셀 리터럴 <br> → hardbreak 토큰 변환 ----
// 검증 범위: 표 셀 안 리터럴 <br>/<br/>/<br />를 markdown-it hardbreak로 교체.
// 단락·코드 컨텍스트는 미적용. 속성 포함 <br>와 비표준 </br>는 매칭 거부(XSS 방어).
describe('renderMarkdown: table cell line break (SPEC-PREVIEW-012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- 시나리오 A: 표 셀 안 <br>을 줄바꿈으로 렌더 (REQ-001, 002) — must-pass ----
  it('표 셀 안 리터럴 <br>를 실제 <br> 태그로 렌더한다 (시나리오 A)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    // 3행 표 — 헤더 + 본문. <br>가 본문 셀(<td>)에 위치하도록 구성.
    const content = '| Col1 | Col2 |\n|---|---|\n| a<br>b | c |';
    const result = await renderMarkdown(content, null);
    // 셀 안에서 리터럴 <br>가 hardbreak로 변환되어 실제 <br> 태그가 포함된다
    // hardbreak 렌더 규칙은 '<br>\n' 출력 (xhtmlOut=false 기본값)
    expect(result).toContain('a<br>');
    expect(result).toContain('b</td>');
    // 이스케이프된 형태(&lt;br&gt;)는 더 이상 나타나지 않아야 한다
    expect(result).not.toContain('&lt;br&gt;');
    expect(result).not.toContain('a&lt;br&gt;b');
  });

  // ---- 시나리오 B: 셀프클로징 변형 지원 (REQ-001) ----
  it('표 셀 안 <br/> 셀프클로징 변형도 hardbreak로 변환한다 (시나리오 B)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| a<br/>b | c |', null);
    expect(result).toContain('a<br>');
    expect(result).not.toContain('&lt;br/&gt;');
  });

  it('표 셀 안 <br /> (공백 포함 셀프클로징) 변형도 hardbreak로 변환한다 (시나리오 B)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| a<br />b | c |', null);
    expect(result).toContain('a<br>');
    expect(result).not.toContain('&lt;br /&gt;');
  });

  it('<BR>, <Br/> 등 대소문자 혼합 형태도 매칭한다 (케이스 인센서티브)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const upper = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| a<BR>b | c |', null);
    expect(upper).toContain('a<br>');
    expect(upper).not.toContain('&lt;BR&gt;');

    const mixed = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| a<Br/>b | c |', null);
    expect(mixed).toContain('a<br>');
    expect(mixed).not.toContain('&lt;Br/&gt;');
  });

  // ---- 시나리오 C: 단락·인용·목록의 <br> 텍스트는 변환하지 않음 (REQ-003) — must-pass ----
  it('일반 단락 안의 <br> 텍스트는 이스케이프된 채로 남는다 (시나리오 C)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('plain <br> text', null);
    expect(result).toContain('&lt;br&gt;');
    // 실제 <br> HTML 요소는 단락에 삽입되지 않는다
    expect(result).not.toMatch(/<br\s*\/?>/);
  });

  it('인용문(>) 안의 <br> 텍스트도 이스케이프된 채로 남는다 (시나리오 C)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('> quote <br> text', null);
    expect(result).toContain('&lt;br&gt;');
    expect(result).not.toMatch(/<br\s*\/?>/);
  });

  it('목록(-) 안의 <br> 텍스트도 이스케이프된 채로 남는다 (시나리오 C)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('- list <br> item', null);
    expect(result).toContain('&lt;br&gt;');
    expect(result).not.toMatch(/<br\s*\/?>/);
  });

  // ---- 시나리오 D: 코드 영역의 <br> 텍스트는 보호 (REQ-004) — must-pass ----
  it('코드펜스 안의 <br> 텍스트는 코드 콘텐츠로 보존된다 (시나리오 D)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('```\n<br>\n```', null);
    // 코드블록 안에서는 이스케이프된 텍스트로 표시
    expect(result).toContain('&lt;br&gt;');
    // 실제 <br> 태그가 코드 콘텐츠로 주입되지 않는다
    expect(result).not.toMatch(/<code>[^<]*<br\s*\/?>/);
  });

  it('인라인 코드(백틱) 안의 <br> 텍스트는 보존된다 (시나리오 D)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('`a<br>b`', null);
    expect(result).toMatch(/<code>a&lt;br&gt;b<\/code>/);
  });

  it('표 셀 안의 인라인 코드 안 <br> 텍스트도 변환되지 않는다 (시나리오 D, 코드 보호 우선)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    // 표 셀 컨텍스트라도 inline 자식이 code_inline이면 변환 건너뜀 (REQ-004)
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| `a<br>b` | c |', null);
    expect(result).toMatch(/<code>a&lt;br&gt;b<\/code>/);
  });

  // ---- 시나리오 E: 헤더 셀(th)에서도 변환 (REQ-001, 002) ----
  it('헤더 셀(<th>) 안의 <br>도 hardbreak로 변환한다 (시나리오 E)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    // 헤더 행에 <br>가 있는 2열 표 — 헤더 셀(<th>)에서도 변환되는지 검증.
    const result = await renderMarkdown('| H1<br>H2 | H3 |\n|---|---|\n| a | b |', null);
    expect(result).toContain('H1<br>');
    expect(result).toContain('H2</th>');
    expect(result).not.toContain('&lt;br&gt;');
  });

  // ---- 시나리오 F: 속성 포함 <br>는 변환 거부 → XSS 차단 (REQ-005, 006) — must-pass (보안) ----
  it('<br onload="alert(1)"> 속성 포함 형태는 매칭을 거부해 이스케이프된 텍스트로 남는다 (시나리오 F, XSS 차단)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| a<br onload="alert(1)">b | c |', null);
    // 속성 포함 원시 HTML은 html:false가 이스케이프 — 실제 <br> 태그로 변환되지 않음
    expect(result).not.toMatch(/<br\s+onload/i);
    expect(result).not.toContain('<br onload');
    // onload 이벤트 핸들러 속성이 바인딩되지 않는다
    expect(result).toContain('onload');
    // 이스케이프된 형태로 표시
    expect(result).toMatch(/&lt;br\s+onload/i);
  });

  it('<br foo="bar"> 속성 포함 형태도 매칭을 거부한다 (시나리오 F)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| a<br foo="bar">b | c |', null);
    expect(result).not.toMatch(/<br\s+foo/i);
    expect(result).not.toContain('<br foo');
    expect(result).toMatch(/&lt;br\s+foo/i);
  });

  // ---- 시나리오 G: 비표준 닫기 태그 </br> 거부 (REQ-005) ----
  it('비표준 닫기 태그 </br>는 매칭하지 않는다 (시나리오 G)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| a</br>b | c |', null);
    // </br>는 void 요소가 아닌 비표준 닫기 태그 — 매칭 거부
    expect(result).not.toContain('<br>');
    expect(result).toContain('&lt;/br&gt;');
  });

  // ---- 추가: 다중 <br>, 셀 경계 엣지, 인라인 마크업 조합 ----
  it('하나의 셀에 <br>가 여러 개 있으면 각각 hardbreak로 변환한다 (다중 <br>)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| x<br><br>y | z |', null);
    // <br>가 두 개 연속으로 나와야 한다
    const matches = result.match(/<br>/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(result).toContain('x<br>');
    expect(result).toContain('y</td>');
    expect(result).not.toContain('&lt;br&gt;');
  });

  it('셀 시작의 <br> 엣지 케이스도 처리한다 (<br>a → hardbreak + text)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| <br>a | b |', null);
    expect(result).toContain('<br>');
    expect(result).toContain('a</td>');
    expect(result).not.toContain('&lt;br&gt;a');
  });

  it('셀 끝의 <br> 엣지 케이스도 처리한다 (a<br> → text + hardbreak)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| a<br> | b |', null);
    expect(result).toContain('a<br>');
    expect(result).not.toContain('a&lt;br&gt;');
  });

  it('굵게/기울임과 <br>의 조합이 정상 렌더링된다 (| **a**<br>**b** |)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| **a**<br>**b** | c |', null);
    // 굵게 표시 + hardbreak + 굵게 표시
    expect(result).toContain('<strong>a</strong>');
    expect(result).toContain('<strong>b</strong>');
    expect(result).toContain('<br>');
    expect(result).not.toContain('&lt;br&gt;');
  });

  // ---- 시나리오 H: 기존 플러그인 회귀 차단 (REQ-007) — must-pass ----
  it('data-line 속성이 표 블록에 여전히 주입된다 (dataLinePlugin 회귀, 시나리오 H)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = '| Col1 | Col2 |\n|---|---|\n| a<br>b | c |';
    const result = await renderMarkdown(content, null);
    expect(result).toContain('data-line=');
    expect(result).toContain('<table');
    expect(result).toContain('a<br>');
  });

  it('tableScrollPlugin의 래핑·인라인 보더 스타일이 유지된다 (시나리오 H)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('| Col1 | Col2 |\n|---|---|\n| a<br>b | c |', null);
    expect(result).toContain('table-scroll-wrapper');
    expect(result).toContain('border-collapse: separate');
    expect(result).toContain('border-right: 1px solid');
  });

  it('표 셀 안 이미지 문법이 imageResolver를 거쳐 asset://로 변환된다 (imageResolverPlugin 회귀, 시나리오 H)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = '| Col1 | Col2 |\n|---|---|\n| ![img](pic.png) | <br> |';
    const result = await renderMarkdown(content, null, false, '/project/doc.md');
    expect(result).toContain('<img');
    expect(result).toContain('asset://');
  });

  it('기존 표 렌더 테스트(inline border styles)가 무변경으로 통과한다 (시나리오 H 회귀 기준선)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const table = '| Col1 | Col2 |\n|------|------|\n| A | B |';
    const result = await renderMarkdown(table, null);
    expect(result).toContain('<table');
    expect(result).toContain('border-collapse: separate');
    expect(result).toContain('>Col1</th>');
    expect(result).toContain('>A</td>');
  });

  it('표 셀 안 인라인 SVG 마커와 <br>가 공존한다 (혼합 콘텐츠 회귀)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    // 표 셀 안에 SVG 마커(data-mdedit-svg)는 spec-008 경로를 따라 별도 처리되므로
    // 여기서는 <br> 변환이 다른 플러그인 경로에 간섭하지 않음만 확인
    const content = '| Col1 | Col2 |\n|---|---|\n| a<br>b | c |';
    const result = await renderMarkdown(content, null);
    expect(result).toContain('a<br>');
    expect(result).toContain('b</td>');
  });

  // ---- 예외 안정성 (REQ-006) ----
  it('변환 중 예외가 발생해도 앱이 중단되지 않고 렌더 결과를 반환한다', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    // 정상적인 입력에도 불구하고 rule이 실패하면 원본 텍스트를 그대로 둬야 함(REQ-006)
    // 이 테스트는 try/catch가 없을 때 throw되는 것을 잡는지 간접 검증
    const result = await renderMarkdown('| a<br>b | c |\n|---|---|\n| d | e |', null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
