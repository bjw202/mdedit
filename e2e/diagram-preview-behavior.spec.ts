// @MX:NOTE: [AUTO] SPEC-PREVIEW-015 미리보기 다이어그램(pele) 동작 e2e — 테마 전환 시 노드 유지·색 변경(AC-011),
//   다이어그램 클릭 시 이동 없음·외부 이미지 요청 없음(AC-012), 다이어그램 수식 배치·CSP 새 위반 0(AC-025).
//   다이어그램 소스는 spike/pele/samples/18·19·20 과 같은 문법이며, SVG는 실제 pele 렌더 결과만 측정한다.
// @MX:SPEC: SPEC-PREVIEW-015 AC-PREVIEW015-011, AC-PREVIEW015-012, AC-PREVIEW015-025

import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/tauri-mock';

const SVG_SELECTOR = '.preview-content .mermaid-container svg';

const FLOW_DOC = `# 다이어그램

\`\`\`mermaid
flowchart LR
  A[시작] --> B[끝]
\`\`\`
`;

// spike/pele/samples/19-link-click.mmd 와 같은 노드 링크 문법 + 대조용 본문 링크
const LINK_DOC = `# 링크

[본문 링크](https://example.com/control)

\`\`\`mermaid
flowchart LR
  A[링크 노드] --> B[대상]
  click A "https://example.com/" "툴팁"
  click B href "javascript:alert(1)"
\`\`\`
`;

// spike/pele/samples/20-image-node.mmd 와 같은 외부 이미지 문법
const IMAGE_DOC = `# 이미지

\`\`\`mermaid
flowchart LR
  A@{ img: "https://example.com/logo.png", label: "외부 이미지", pos: "t", w: 60, h: 60, constraint: "on" }
  A --> B[다음]
\`\`\`
`;

// spike/pele/samples/18-math-label.mmd
const MATH_DOC = `# 수식

\`\`\`mermaid
flowchart LR
  A["$$x^2 + y^2$$"] --> B["$$\\frac{a}{b}$$"]
  B --> C[일반 라벨]
\`\`\`
`;

// 같은 문서에서 수식만 뺀 기준 렌더
const MATH_BASELINE_DOC = `# 수식

\`\`\`mermaid
flowchart LR
  A["x^2 + y^2"] --> B["a/b"]
  B --> C[일반 라벨]
\`\`\`
`;

/** 테마를 localStorage(zustand persist)에 미리 저장한다. 페이지 이동 전에 호출. */
async function seedTheme(page: Page, theme: 'light' | 'dark' | 'system'): Promise<void> {
  await page.addInitScript((t) => {
    localStorage.setItem('mdedit-ui-store', JSON.stringify({ state: { theme: t }, version: 1 }));
  }, theme);
}

async function openWithContent(page: Page, content: string): Promise<void> {
  await page.goto('/');
  await page.locator('.cm-editor').waitFor({ timeout: 15_000 });
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await editor.fill(content);
}

interface NodeColors {
  fill: string;
  stroke: string;
  /** 현재 테마의 --md-surface / --md-border-strong 를 계산한 값(--pele-surface / --pele-border 의 연결 대상) */
  tokenFill: string;
  tokenStroke: string;
  theme: string | null;
}

/** 첫 노드 rect의 계산된 채움·선 색과, 지금 테마 토큰의 계산값을 함께 읽는다. */
async function readNodeColors(page: Page): Promise<NodeColors> {
  return page.evaluate((sel) => {
    const rect = document.querySelector(`${sel} .pele-node rect`) as SVGRectElement;
    const probe = document.createElement('div');
    probe.style.color = 'var(--md-surface)';
    probe.style.borderTopColor = 'var(--md-border-strong)';
    probe.style.borderTopStyle = 'solid';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const tokenFill = cs.color;
    const tokenStroke = cs.borderTopColor;
    probe.remove();
    const rs = getComputedStyle(rect);
    return {
      fill: rs.fill,
      stroke: rs.stroke,
      tokenFill,
      tokenStroke,
      theme: document.documentElement.getAttribute('data-theme'),
    };
  }, SVG_SELECTOR);
}

/** 첫 렌더된 SVG를 기억해 두고, 이후 같은 객체가 붙어 있는지 확인할 수 있게 한다. */
async function rememberSvg(page: Page): Promise<void> {
  await page.evaluate((sel) => {
    (window as unknown as { __firstSvg?: Element }).__firstSvg = document.querySelector(sel) ?? undefined;
  }, SVG_SELECTOR);
}

async function isSameSvg(page: Page): Promise<boolean> {
  return page.evaluate((sel) => {
    const first = (window as unknown as { __firstSvg?: Element }).__firstSvg;
    return !!first && first.isConnected && document.querySelector(sel) === first;
  }, SVG_SELECTOR);
}

/** 테마가 바뀐 뒤 색이 지금 테마 토큰과 같아질 때까지 기다리고 그 값을 돌려준다. */
async function expectColorsMatchTheme(page: Page, theme: 'light' | 'dark'): Promise<NodeColors> {
  await expect.poll(async () => (await readNodeColors(page)).theme, { timeout: 5_000 }).toBe(theme);
  await expect
    .poll(
      async () => {
        const c = await readNodeColors(page);
        return c.fill === c.tokenFill && c.stroke === c.tokenStroke;
      },
      { timeout: 5_000 },
    )
    .toBe(true);
  return readNodeColors(page);
}

test.describe('SPEC-PREVIEW-015 AC-011: 테마 전환은 SVG를 다시 만들지 않고 색만 바꾼다', () => {
  test('system 모드 prefers-color-scheme 변경과 테마 토글에서 같은 SVG 노드가 유지되고 채움·선 색이 테마 토큰을 따른다', async ({
    tauriPage,
  }) => {
    await tauriPage.emulateMedia({ colorScheme: 'light' });
    await seedTheme(tauriPage, 'system');
    await openWithContent(tauriPage, FLOW_DOC);
    await tauriPage.locator(`${SVG_SELECTOR} .pele-node rect`).first().waitFor({ timeout: 15_000 });
    await rememberSvg(tauriPage);

    const light = await expectColorsMatchTheme(tauriPage, 'light');

    // system 모드에서 OS 다크 전환
    await tauriPage.emulateMedia({ colorScheme: 'dark' });
    const dark = await expectColorsMatchTheme(tauriPage, 'dark');
    expect(await isSameSvg(tauriPage), 'system → 다크 전환 뒤 SVG가 교체됨').toBe(true);

    test.info().annotations.push({ type: 'node-colors', description: JSON.stringify({ light, dark }) });

    // 라이트와 다크의 계산된 색이 실제로 다르다(색이 토큰을 따른다는 단언이 공허하지 않음).
    expect(dark.fill, '노드 채움색이 라이트·다크에서 같음').not.toBe(light.fill);
    expect(dark.stroke, '노드 선 색이 라이트·다크에서 같음').not.toBe(light.stroke);

    await tauriPage.emulateMedia({ colorScheme: 'light' });
    const lightAgain = await expectColorsMatchTheme(tauriPage, 'light');
    expect(lightAgain.fill).toBe(light.fill);
    expect(await isSameSvg(tauriPage), 'system → 라이트 복귀 뒤 SVG가 교체됨').toBe(true);

    // 헤더 테마 토글: system(라이트) → dark → light
    const toggle = tauriPage.getByRole('button', { name: 'Toggle theme' });
    await toggle.click();
    const toggledDark = await expectColorsMatchTheme(tauriPage, 'dark');
    expect(toggledDark.fill).toBe(dark.fill);
    expect(await isSameSvg(tauriPage), '토글(다크) 뒤 SVG가 교체됨').toBe(true);

    await toggle.click();
    const toggledLight = await expectColorsMatchTheme(tauriPage, 'light');
    expect(toggledLight.fill).toBe(light.fill);
    expect(await isSameSvg(tauriPage), '토글(라이트) 뒤 SVG가 교체됨').toBe(true);
  });

  test('다크 테마로 시작하면 처음 붙은 SVG의 채움색이 곧바로 다크 토큰 값이고, 이후 노드가 교체되지 않는다', async ({
    tauriPage,
  }) => {
    await seedTheme(tauriPage, 'dark');
    await openWithContent(tauriPage, FLOW_DOC);

    const handle = await tauriPage.waitForSelector(SVG_SELECTOR, { timeout: 15_000 });
    // 처음 붙은 요소를 받은 직후 그 노드의 계산된 채움색을 읽는다.
    const first = await handle.evaluate((svg) => {
      const rect = svg.querySelector('.pele-node rect') as SVGRectElement;
      const probe = document.createElement('div');
      probe.style.color = 'var(--md-surface)';
      document.body.appendChild(probe);
      const token = getComputedStyle(probe).color;
      probe.remove();
      return {
        fill: getComputedStyle(rect).fill,
        token,
        theme: document.documentElement.getAttribute('data-theme'),
      };
    });
    expect(first.theme).toBe('dark');
    expect(first.fill, '첫 렌더 채움색이 다크 토큰 값이 아님').toBe(first.token);

    // 같은 노드가 이후 교체되지 않는다.
    await tauriPage.waitForTimeout(1_000);
    expect(await handle.evaluate((svg) => svg.isConnected), '첫 SVG가 문서에서 떨어짐').toBe(true);
    expect(
      await handle.evaluate((svg, sel) => document.querySelector(sel) === svg, SVG_SELECTOR),
      '첫 SVG가 다른 노드로 교체됨',
    ).toBe(true);

    // 라이트 토큰과 다른 값인지 대조(다크가 라이트 대체값으로 새지 않음).
    await tauriPage.getByRole('button', { name: 'Toggle theme' }).click();
    const light = await expectColorsMatchTheme(tauriPage, 'light');
    expect(light.fill).not.toBe(first.fill);
  });
});

test.describe('SPEC-PREVIEW-015 AC-012: 다이어그램에는 이동할 링크도 외부 이미지도 없다', () => {
  test('노드 링크 문법이 든 다이어그램을 클릭해도 URL·IPC·팝업 변화가 없다(본문 링크는 대조로 IPC 1회)', async ({
    tauriPage,
  }) => {
    await tauriPage.addInitScript(() => {
      const w = window as unknown as {
        __OPEN_URL_CALLS__: string[];
        __TAURI_MOCK_HANDLERS__: Record<string, (a: Record<string, unknown>) => unknown>;
      };
      w.__OPEN_URL_CALLS__ = [];
      w.__TAURI_MOCK_HANDLERS__.open_url_in_browser = (args) => {
        w.__OPEN_URL_CALLS__.push(String(args.url));
        return null;
      };
    });
    let popups = 0;
    tauriPage.on('popup', () => {
      popups += 1;
    });

    await openWithContent(tauriPage, LINK_DOC);
    const nodeA = tauriPage.locator(`${SVG_SELECTOR} .pele-node[data-id="A"]`);
    const nodeB = tauriPage.locator(`${SVG_SELECTOR} .pele-node[data-id="B"]`);
    await nodeA.waitFor({ timeout: 15_000 });

    const anchors = await tauriPage.evaluate(
      (sel) =>
        Array.from(document.querySelectorAll(`${sel} a`)).filter(
          (a) => a.hasAttribute('href') || a.hasAttribute('xlink:href'),
        ).length,
      SVG_SELECTOR,
    );
    expect(anchors, '다이어그램에 href가 있는 <a>가 있음').toBe(0);

    const urlBefore = tauriPage.url();
    await nodeA.click();
    await nodeB.click();
    await tauriPage.waitForTimeout(500);

    expect(tauriPage.url(), '다이어그램 클릭 뒤 URL이 바뀜').toBe(urlBefore);
    expect(
      await tauriPage.evaluate(() => (window as unknown as { __OPEN_URL_CALLS__: string[] }).__OPEN_URL_CALLS__),
      '다이어그램 클릭으로 open_url_in_browser가 호출됨',
    ).toEqual([]);
    expect(popups, '다이어그램 클릭으로 팝업이 열림').toBe(0);

    // 대조: 본문 링크 클릭은 같은 수집기로 1회 잡힌다(측정 장치가 동작함을 확인).
    await tauriPage.locator('.preview-content a', { hasText: '본문 링크' }).click();
    await expect
      .poll(() =>
        tauriPage.evaluate(() => (window as unknown as { __OPEN_URL_CALLS__: string[] }).__OPEN_URL_CALLS__),
      )
      .toEqual(['https://example.com/control']);
    expect(tauriPage.url()).toBe(urlBefore);
  });

  test('외부 이미지 문법이 든 다이어그램은 외부 href·<image>가 없고 외부 요청을 보내지 않는다', async ({
    tauriPage,
  }) => {
    const externalRequests: string[] = [];
    tauriPage.on('request', (req) => {
      if (req.url().includes('example.com')) externalRequests.push(req.url());
    });

    await openWithContent(tauriPage, IMAGE_DOC);
    await tauriPage.locator(`${SVG_SELECTOR} .pele-node`).first().waitFor({ timeout: 15_000 });
    await tauriPage.waitForTimeout(500);

    const found = await tauriPage.evaluate((sel) => {
      const svg = document.querySelector(sel)!;
      const external = Array.from(svg.querySelectorAll('*')).flatMap((el) =>
        ['href', 'xlink:href']
          .map((n) => el.getAttribute(n))
          .filter((v): v is string => !!v && /^(https?:|\/\/)/i.test(v.trim())),
      );
      return { external, images: svg.querySelectorAll('image').length };
    }, SVG_SELECTOR);

    expect(found.external, '다이어그램에 외부 href가 있음').toEqual([]);
    expect(found.images, '다이어그램에 <image>가 있음').toBe(0);
    expect(externalRequests, '외부 이미지 요청이 나감').toEqual([]);
  });
});

test.describe('SPEC-PREVIEW-015 AC-025: 다이어그램 수식은 상자 안에 그려지고 새 CSP 위반이 없다', () => {
  test('수식 foreignObject 안 <math>가 상자 안에 있고, 수식 없는 기준 렌더보다 CSP 위반·거부가 늘지 않는다', async ({
    tauriPage,
  }) => {
    await tauriPage.addInitScript(() => {
      const w = window as unknown as { __CSP_VIOLATIONS__: string[] };
      w.__CSP_VIOLATIONS__ = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__CSP_VIOLATIONS__.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    const cspConsole: string[] = [];
    tauriPage.on('console', (msg) => {
      const text = msg.text();
      if (/content security policy|refused to/i.test(text)) cspConsole.push(text);
    });

    // 페이지마다 새로 열어 각 렌더의 (가) 위반 이벤트 수, (나) 콘솔 거부 수를 따로 센다.
    const measure = async (doc: string, expectMath: boolean) => {
      const consoleStart = cspConsole.length;
      await openWithContent(tauriPage, doc);
      await tauriPage.locator(`${SVG_SELECTOR} .pele-node`).first().waitFor({ timeout: 15_000 });
      if (expectMath) {
        await tauriPage.locator(`${SVG_SELECTOR} foreignObject.pele-math math`).first().waitFor({ timeout: 5_000 });
      }
      await tauriPage.evaluate(() => document.fonts.ready.then(() => undefined));
      await tauriPage.waitForTimeout(500);
      const violations = await tauriPage.evaluate(
        () => (window as unknown as { __CSP_VIOLATIONS__: string[] }).__CSP_VIOLATIONS__,
      );
      return { violations, consoleRejects: cspConsole.slice(consoleStart) };
    };

    const baseline = await measure(MATH_BASELINE_DOC, false);
    const withMath = await measure(MATH_DOC, true);

    const placement = await tauriPage.evaluate((sel) => {
      return Array.from(document.querySelectorAll(`${sel} foreignObject.pele-math`)).map((fo) => {
        const f = fo.getBoundingClientRect();
        const m = fo.querySelector('math')?.getBoundingClientRect();
        return {
          fo: { l: f.left, t: f.top, r: f.right, b: f.bottom },
          math: m ? { l: m.left, t: m.top, r: m.right, b: m.bottom, w: m.width, h: m.height } : null,
        };
      });
    }, SVG_SELECTOR);

    // 측정값을 보고서에 남긴다(증거 기록용, 단언에는 영향 없음).
    test.info().annotations.push({
      type: 'csp-counts',
      description: JSON.stringify({ baseline, withMath }),
    });

    expect(placement.length, '수식 foreignObject 개수').toBe(2);
    const tol = 1;
    for (const p of placement) {
      expect(p.math, '수식 foreignObject 안에 <math>가 없음').not.toBeNull();
      const m = p.math!;
      expect(m.w > 0 && m.h > 0, `<math> 크기가 0 ${JSON.stringify(p)}`).toBe(true);
      expect(
        m.l >= p.fo.l - tol && m.r <= p.fo.r + tol && m.t >= p.fo.t - tol && m.b <= p.fo.b + tol,
        `<math>가 foreignObject 상자 밖에 있음 ${JSON.stringify(p)}`,
      ).toBe(true);
    }

    expect(
      withMath.violations.length,
      `CSP 위반 이벤트 증가: 기준 ${JSON.stringify(baseline.violations)} / 수식 ${JSON.stringify(withMath.violations)}`,
    ).toBeLessThanOrEqual(baseline.violations.length);
    expect(
      withMath.consoleRejects.length,
      `콘솔 CSP 거부 증가: 기준 ${JSON.stringify(baseline.consoleRejects)} / 수식 ${JSON.stringify(withMath.consoleRejects)}`,
    ).toBeLessThanOrEqual(baseline.consoleRejects.length);

    // 대조: 이 페이지에 CSP가 실제로 걸려 있고 두 수집기가 위반을 잡는지 확인한다(위 0건 비교가
    // 공허하지 않음). img-src에 없는 외부 주소 이미지를 하나 붙이면 위반 1건이 생겨야 한다.
    const consoleBeforeControl = cspConsole.length;
    await tauriPage.evaluate(() => {
      const img = document.createElement('img');
      img.src = 'https://csp-control.invalid/x.png';
      document.body.appendChild(img);
    });
    await expect
      .poll(() =>
        tauriPage.evaluate(
          () => (window as unknown as { __CSP_VIOLATIONS__: string[] }).__CSP_VIOLATIONS__.length,
        ),
      )
      .toBeGreaterThan(withMath.violations.length);
    await expect.poll(() => cspConsole.length).toBeGreaterThan(consoleBeforeControl);
  });
});
