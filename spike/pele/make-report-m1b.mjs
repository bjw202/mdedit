// SPEC-PREVIEW-015 M1b spike only (deleted in M7). Builds m1/report-m1b.html from the M1b evidence
// JSON files (numbers are read from evidence, never typed by hand). Run: node spike/pele/make-report-m1b.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M1 = path.join(ROOT, '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1');
const unit = JSON.parse(fs.readFileSync(path.join(M1, 'evidence/m1b-unit.json'), 'utf8'));
const br = JSON.parse(fs.readFileSync(path.join(M1, 'evidence/m1b-browser.json'), 'utf8'));
const csp = JSON.parse(fs.readFileSync(path.join(M1, 'evidence/m1b-csp.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wk = br.webkit, cr = br.chromium;
const SAMPLES = Object.keys(wk.preview);
const OUT = ['html', 'mathml', 'mathml-bare'];
const shot = (f, cap) => (fs.existsSync(path.join(M1, f)) ? `<figure class="shot"><img src="${f}" alt="${esc(cap)}"><figcaption>${esc(cap)}</figcaption></figure>` : '');

const paintRows = SAMPLES.map((id) => `<tr><td>${id}</td>${OUT.map((o) => {
  const w = wk.preview[id][o].light?.paint, c = cr.preview[id][o].light?.paint;
  return `<td>${w ? w.insideRatio : '—'}</td><td>${c ? c.insideRatio : '—'}</td>`;
}).join('')}</tr>`).join('');

const sizeRows = SAMPLES.map((id) => `<tr><td>${id}</td>${OUT.map((o) => `<td>${wk.preview[id][o].log.map((l) => `${l.width}×${l.height}`).join(', ')}</td>`).join('')}<td>${wk.cold.log.filter((l) => wk.preview[id].html.log.some((x) => x.tex === l.tex)).map((l) => `${l.width}×${l.height}`).join(', ')}</td></tr>`).join('');

const docxRows = Object.entries(wk.docx).map(([k, v]) => {
  const c = cr.docx[k];
  return `<tr><td>${k}</td><td>${esc(v.toDataURL)} / ${esc(v.toBlob)}</td><td>${esc(c.toDataURL)} / ${esc(c.toBlob)}</td><td>${v.file ? `<a href="${v.file}">webkit PNG</a>` : ''} ${c.file ? `<a href="${c.file}">chromium PNG</a>` : ''}</td></tr>`;
}).join('');

const expRows = Object.entries(wk.htmlExport.variants).map(([k, v]) => `<tr><td>${k}</td><td>${v.bytes.toLocaleString('en-US')}</td><td>${v.webkit.katexHtmlVisibleInsideDiagram ? 'KaTeX HTML' : v.webkit.mathmlVisibleInsideDiagram ? 'MathML' : '없음'}</td><td>${esc(JSON.stringify(v.webkit.foOverflowX))}</td><td>${v.webkit.bodyMath ? `MathML ${v.webkit.bodyMath.mathmlVisible ? '보임' : '숨김'} · HTML ${v.webkit.bodyMath.htmlVisible ? '보임' : '숨김'}` : ''}</td><td><a href="${v.file}">HTML</a> · <a href="${v.webkitScreenshot}">webkit</a> · <a href="${v.chromiumScreenshot}">chromium</a></td></tr>`).join('');

const san = (s) => `a(이전/이후/마지막) 불일치 ${s.a_before.mismatches.length}/${s.a_afterDiagramInstance.mismatches.length}/${s.a_final.mismatches.length} (대상 ${s.a_before.checked}쌍)`;
const hostileRows = Object.keys(wk.sanitize.c_hostile).map((k) => `<tr><td>${k}</td><td>${unit.sanitize.c_hostile[k].survivors.length}</td><td>${wk.sanitize.c_hostile[k].survivors.length}</td><td>${cr.sanitize.c_hostile[k].survivors.length}</td><td><code>${esc(wk.sanitize.c_hostile[k].output.slice(0, 160))}</code></td></tr>`).join('');
const keepRows = Object.entries(unit.sanitize.b_math).map(([k, v]) => `<tr><td>${k}</td><td>${v.keptForeignObjects}/${v.rawForeignObjects}</td><td>${v.keptKatex}/${v.rawKatex}</td><td>${v.keptMath}/${v.rawMath}</td><td>${v.keptAnnotation}/${v.rawAnnotation}</td><td>${v.keptInlineStyles}/${v.rawInlineStyles}</td><td>${v.scriptOrHandler}</td><td>${v.sharedSanitizeKeepsForeignObject}</td></tr>`).join('');
const isoRows = Object.entries(wk.sanitize.isolation).map(([k, v]) => `<tr><td>${k}</td><td>${esc(unit.sanitize.isolation[k])}</td><td>${esc(v)}</td><td>${esc(cr.sanitize.isolation[k])}</td></tr>`).join('');
const cspRows = Object.keys(csp.webkit.scenarios).map((k) => `<tr><td>${k}</td><td>${csp.webkit.scenarios[k].violations} / ${csp.webkit.scenarios[k].consoleRefusals}</td><td>${csp.chromium.scenarios[k].violations} / ${csp.chromium.scenarios[k].consoleRefusals}</td></tr>`).join('');

const gallery = SAMPLES.map((id) => `<h3>${id}</h3><div class="shots">
${shot(`img/m1b-${id}-mermaid-light.png`, 'mermaid strict · 라이트 · webkit')}
${shot(`img/m1b-${id}-pele-html-light.png`, 'pele + KaTeX html · 라이트 · webkit')}
${shot(`img/m1b-${id}-pele-mathml-bare-light.png`, 'pele + KaTeX mathml-bare · 라이트 · webkit')}
${shot(`img/m1b-${id}-pele-html-light-chromium.png`, 'pele + KaTeX html · 라이트 · chromium')}
${shot(`img/m1b-${id}-mermaid-dark.png`, 'mermaid strict · 다크 · webkit')}
${shot(`img/m1b-${id}-pele-html-dark.png`, 'pele + KaTeX html · 다크 · webkit')}
${shot(`img/m1b-${id}-pele-mathml-bare-dark.png`, 'pele + KaTeX mathml-bare · 다크 · webkit')}
${shot(`img/m1b-${id}-pele-mathml-light.png`, 'pele + KaTeX mathml(.katex 감쌈) · 라이트 · webkit')}
</div>${wk.preview[id]['mermaid-light'] && !wk.preview[id]['mermaid-light'].ok ? `<p class="err">mermaid 오류: ${esc(wk.preview[id]['mermaid-light'].error)}</p>` : ''}`).join('\n');

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>pele M1b 수식 보고서</title>
<style>
:root{--bg:#fbfbfc;--fg:#1d1f20;--muted:#5d5d60;--line:#d6d6d8;--accent:#416180;--card:#ffffff}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#191b1d;--fg:#e7e7ea;--muted:#a4a6a9;--line:#3a3d41;--accent:#9ec0e2;--card:#212427}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif}
main{max-width:1400px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:26px;margin:0 0 4px}h2{margin-top:40px;border-bottom:1px solid var(--line);padding-bottom:4px}h3{margin:28px 0 4px}
table{border-collapse:collapse;margin:8px 0 16px;font-size:13.5px;display:block;overflow-x:auto}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
code{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;word-break:break-all}
.meta,.note{color:var(--muted)}a{color:var(--accent)}.err{color:#b0473c;font-size:12.5px;white-space:pre-wrap}
.shots{display:flex;flex-wrap:wrap;gap:12px}.shot{margin:0;max-width:440px}.shot img{max-width:100%;border:1px solid var(--line)}.shot figcaption{font-size:12px;color:var(--muted)}
.pending{border:2px dashed var(--accent);padding:8px 12px;display:inline-block}
</style></head><body><main>
<h1>SPEC-PREVIEW-015 M1b — 다이어그램 수식 해석기(pele <code>math</code> + KaTeX) 보강 측정</h1>
<p class="meta">생성: ${new Date().toISOString()} · 브라우저: ${esc(wk.environment)} / ${esc(cr.environment)} · 단위: ${esc(unit.environment)} · KaTeX ${esc(unit.katex)} · pele ${esc(unit.pele)} · 기계 확인 표는 <code>checks.md</code>의 "M1b" 절, 원본 수치는 <code>evidence/m1b-*.json</code>. <a href="report.html">M1 보고서로</a></p>
<p class="pending">판정(통과/보류)과 해석기 출력 방식·DOCX 처리 방식은 <b>사용자 판정 대기</b>입니다. 이 보고서는 근거만 제시합니다.</p>

<h2>주요 결과</h2>
<ol>
<li><b>F11 WebKit에서 KaTeX HTML 출력은 자리를 벗어나 그려진다.</b> 레이아웃 상자(<code>getBoundingClientRect</code>)는 <code>foreignObject</code> 안에 있지만, 화면에 칠해지는 위치는 SVG 왼쪽 위 구석이다. 수식이 있는 화면과 수식을 지운 화면의 픽셀 차이 중 <code>foreignObject</code> 상자 안에 떨어진 비율이 webkit에서 <code>html</code>·<code>mathml</code>(KaTeX <code>.katex</code> 감쌈) 모두 0, <code>mathml-bare</code>(감쌈 제거) 1이다. chromium은 세 방식 모두 1이다. 원인 후보는 앱이 전역으로 싣는 <code>katex.min.css</code>의 <code>.katex{position:relative}</code> 등 위치 지정 규칙이다 — <code>.katex</code>를 <code>position:static</code>으로 덮으면 mathml은 제자리에 그려지고(탐색 실험), html 출력은 내부 <code>.vlist</code> 요소들도 상대 위치를 써서 그렇게 해도 고쳐지지 않았다(<code>run-m1b-position.mjs</code>, <a href="exports/m1b/position-webkit-mathml-static.png">mathml+static</a> · <a href="exports/m1b/position-webkit-html-static.png">html+static</a> · <a href="exports/m1b/position-webkit-html.png">html</a>).</li>
<li><b>같은 현상이 지금 mermaid에도 보인다.</b> KaTeX CSS를 실은 페이지에서는 mermaid strict 출력의 수식도 webkit에서 왼쪽 위로 몰린다(<code>img/m1b-18-math-label-mermaid-light.png</code>). M1 비교 페이지는 KaTeX CSS를 싣지 않아 정상으로 보였다. 앱(WKWebView, KaTeX CSS 전역 로드)의 현재 표시는 MANUAL-3로 확인해야 한다 <b>(추정 — 앱에서 미확인)</b>.</li>
<li><b>KaTeX <code>output:'mathml'</code>에서 바깥 <code>&lt;span class="katex"&gt;</code>를 뗀 방식(<code>mathml-bare</code>)</b>은 미리보기(webkit·chromium, 라이트·다크), HTML 내보내기(KaTeX CSS·글꼴 없이), DOCX PNG(webkit·chromium) 세 경로 모두에서 제자리에 수식으로 그려졌다.</li>
<li><b>정화</b>: 별도 인스턴스 <code>DOMPurify(window)</code>에 건 훅은 공유 <code>sanitizeSvg</code> 호출에서 한 번도 실행되지 않았고(0회), 공유 경로의 M1 픽스처 출력은 앞·중간·끝 세 번 모두 바이트 단위로 같았다. 반대로 새 인스턴스는 공유 <code>href</code> 훅을 물려받지 않으므로 다이어그램 경로에 다시 걸어야 한다(물려받지 않으면 <code>data:</code> href가 남음 — 측정).</li>
<li><b>DOCX 캔버스는 오염되지 않는다.</b> webkit 26·chromium 145에서 <code>foreignObject</code>가 든 SVG를 data URI → <code>Image</code> → canvas로 그린 뒤 <code>toDataURL</code>·<code>toBlob</code>·<code>getImageData</code>가 모두 성공했다. 다만 이미지 안에는 문서 CSS가 들어가지 않아 KaTeX <code>html</code> 출력은 위첨자·분수·근호가 깨진 글자로 나온다.</li>
<li><b>CSP</b>: pele 수식 렌더 시나리오(html·mathml·mathml-bare)는 위반 이벤트 0건이다. 모든 시나리오(수식을 그리지 않는 load-only 포함)에서 페이지 로드 때 콘솔 거부 1건이 있다 — Vite가 4KB 미만인 <code>KaTeX_Size3-Regular.woff2</code>를 <code>data:</code> URI로 CSS에 넣고, 앱 CSP에는 <code>font-src</code>가 없어 <code>default-src</code>(data: 없음)로 막힌다. 앱 프로덕션 빌드 CSS에도 같은 <code>data:font/woff2</code>가 들어 있음을 확인했다(기존 결함, pele와 무관). 위반 이벤트 5건은 mermaid 수식 렌더(webkit)에서만 나왔다.</li>
<li><b>jsdom</b>: DOM 측정 해석기는 크기 0을 받아 <code>null</code>을 돌려주고, pele는 <code>$$…$$</code> 원문을 글자로 그린다. 텍스트 길이 추정 측정은 결정적이다. 단위 테스트에서는 실제 수식 크기를 확인할 수 없다.</li>
</ol>

<h2>그려진 위치 (픽셀 차이 중 foreignObject 상자 안 비율, 라이트)</h2>
<table><tr><th rowspan="2">샘플</th>${OUT.map((o) => `<th colspan="2">${o}</th>`).join('')}</tr><tr>${OUT.map(() => '<th>webkit</th><th>chromium</th>').join('')}</tr>${paintRows}</table>
<p class="note">chromium의 <code>mathml</code>(감쌈) 열은 스크린숏을 찍지 않아 비어 있다. 1 = 전부 상자 안, 0 = 전부 상자 밖.</p>

<h2>해석기가 돌려준 크기 (webkit, 글꼴 로드 뒤 / html은 로드 전 값도)</h2>
<table><tr><th>샘플</th>${OUT.map((o) => `<th>${o}</th>`).join('')}<th>html, 글꼴 로드 전</th></tr>${sizeRows}</table>
<p class="note">크기는 pele <code>foreignObject</code>의 <code>&lt;div&gt;</code>와 같은 스타일(<code>font-size:${'${size}'}px; line-height:normal; white-space:nowrap</code>)로 문서에 잠깐 붙여 <code>getBoundingClientRect</code>로 잰 값이다. KaTeX 웹폰트가 로드되기 전에는 html 출력 폭이 다르다(예: <code>x^2 + y^2</code> 53 → 61px). 렌더 비용(웹킷, 수식 다이어그램 ${wk.renderCost.diagrams}개 평균 ms/개): ${esc(JSON.stringify(wk.renderCost.msPerDiagram))}; chromium: ${esc(JSON.stringify(cr.renderCost.msPerDiagram))}.</p>

<h2>샘플별 나란히 비교</h2>
${gallery}

<h2>HTML 내보내기 (앱 밖, file:// 로 열기)</h2>
<table><tr><th>변형</th><th>파일 크기(B)</th><th>다이어그램 안 표시</th><th>fO 대비 넘침 px</th><th>본문 수식(현행 방식 재현)</th><th>링크</th></tr>${expRows}</table>
<p class="note">KaTeX CSS ${wk.htmlExport.katexCssBytes.toLocaleString('en-US')}B, woff2 글꼴 20개 합계 ${wk.htmlExport.katexWoff2Bytes.toLocaleString('en-US')}B(base64로 넣으면 약 4/3배). E0은 현재 내보내기와 같이 KaTeX CSS가 없다 — 근호의 KaTeX 내부 SVG가 6,396px 넘친다. 넘침 값은 <code>.katex</code>가 없는 mathml-bare에서는 <code>foreignObject</code> 자신을 재어 0으로 나오므로 의미가 없다(스크린숏으로 판단). 본문 수식은 지금 앱도 내보낸 HTML에 KaTeX CSS를 넣지 않아 MathML과 HTML이 함께 보인다(기존 동작).</p>

<h2>DOCX PNG (exportDocx.ts:154-201과 같은 경로)</h2>
<table><tr><th>샘플.방식</th><th>webkit toDataURL / toBlob</th><th>chromium</th><th>PNG</th></tr>${docxRows}</table>
<p class="note"><code>none</code> = 해석기 없음(<code>$$…$$</code> 원문), <code>textsvg</code> = 해석기가 TeX 원문을 <code>&lt;text&gt;</code>로 돌려줌(foreignObject 없음, 대체안 후보).</p>

<h2>정화 허용 목록 왕복</h2>
<p>공유 <code>sanitizeSvg</code> × M1 픽스처: jsdom ${san(unit.sanitize)}, webkit ${san(wk.sanitize)}, chromium ${san(cr.sanitize)}.</p>
<table><tr><th>수식 입력(jsdom, 추정 측정)</th><th>pele-math 유지</th><th>.katex 유지</th><th>&lt;math&gt; 유지</th><th>annotation 유지</th><th>인라인 style 유지</th><th>script·on*·javascript: 속성</th><th>공유 sanitizeSvg가 fO 남김</th></tr>${keepRows}</table>
<table><tr><th>적대 입력</th><th>남은 표지 jsdom</th><th>webkit</th><th>chromium</th><th>webkit 출력 앞부분</th></tr>${hostileRows}</table>
<table><tr><th>훅 격리 측정</th><th>jsdom</th><th>webkit</th><th>chromium</th></tr>${isoRows}</table>
<p class="note"><code>globalHookSeenBySanitizeSvg</code>는 대조 실험이다 — 같은 훅을 전역 기본 인스턴스에 걸면 <code>sanitizeSvg</code> 한 번에 수십 번 실행된다(누수). <code>removeHook</code> 뒤에는 더 늘지 않았다. <code>&lt;use href="#…"&gt;</code>는 공유·다이어그램 경로 모두 지운다(<code>use</code> 태그 자체가 허용 목록에 없음).</p>

<h2>CSP (앱 index.html:7과 같은 meta, 시나리오마다 새 페이지)</h2>
<table><tr><th>시나리오</th><th>webkit 위반 이벤트 / 콘솔 거부</th><th>chromium</th></tr>${cspRows}</table>

<h2>재현 명령</h2>
<pre>npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/m1b.capture.ts
SPIKE_OUT=&lt;임시 폴더&gt; npx vite build --config spike/pele/vite.m1b.config.ts
SPIKE_OUT=&lt;임시 폴더&gt; npx vite preview --config spike/pele/vite.m1b.config.ts   # http://localhost:4318
node spike/pele/run-m1b.mjs
node spike/pele/run-m1b-csp.mjs
node spike/pele/run-m1b-position.mjs
node spike/pele/make-report-m1b.mjs</pre>
</main></body></html>
`;
fs.writeFileSync(path.join(M1, 'report-m1b.html'), html);
console.log('wrote', path.relative(ROOT, path.join(M1, 'report-m1b.html')), html.length);
