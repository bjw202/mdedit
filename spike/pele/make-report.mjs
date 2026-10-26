// SPEC-PREVIEW-015 M1 spike only (deleted in M7). Generates m1/report.html (self-contained,
// offline) from the evidence JSON written by unit.capture.ts and run-browser.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M1 = path.join(ROOT, '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(M1, 'evidence', f), 'utf8'));
const run = rd('browser-run.json');
const unit = rd('unit-capture.json');
const svgs = rd('browser-svgs.json');
const findings = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'report-findings.html'), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const vars = (t) => Object.entries(t).map(([k, v]) => `${k}:${v}`).join(';');
const LIGHT = vars(run.tokens.light), DARK = vars(run.tokens.dark);
const samples = run.sampleIds.map((id) => ({ id, source: fs.readFileSync(path.join(ROOT, 'spike/pele/samples', `${id}.mmd`), 'utf8') }));

let copy = 0;
function mermaidCell(svg) {
  const m = svg.match(/<svg[^>]*\sid="([^"]+)"/);
  if (!m) return svg;
  const nid = `${m[1]}-c${copy++}`;
  return svg.split(m[1]).join(nid);
}
function cell(theme, width, content, label) {
  const bg = theme === 'dark' ? '#191b1d' : '#f2f2f3';
  const style = theme === 'dark' ? DARK : LIGHT;
  return `<figure class="cell" style="width:${width}px"><figcaption>${label}</figcaption><div class="box" data-theme="${theme}" style="background:${bg};${style}">${content}</div></figure>`;
}
function err(msg) { return `<p class="err">${esc(msg)}</p>`; }

const sections = samples.map((s) => {
  const p = svgs[s.id].pele, mm = svgs[s.id].mermaid;
  const g = run.geometry?.[s.id];
  const rows = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [560, 800]) {
      const mer = mm[theme].ok ? mermaidCell(mm[theme].svg) : err(`mermaid 실패: ${mm[theme].error}`);
      const pt = p.rtrue.ok ? p.rtrue.sanitized : err(`PeleError ${p.rtrue.error.code} (L${p.rtrue.error.line} C${p.rtrue.error.column}): ${p.rtrue.error.message}`);
      const pf = p.rfalse.ok ? p.rfalse.sanitized : err(`PeleError ${p.rfalse.error.code}`);
      rows.push(`<div class="row"><div class="rowlabel">${theme === 'light' ? '라이트' : '다크'} · ${width}px</div>${cell(theme, width, mer, `mermaid 11.12.3 (패치·strict·${theme === 'dark' ? 'dark' : 'default'})`)}${cell(theme, width, pt, 'pele 1.10.0 · responsive: true')}${cell(theme, width, pf, 'pele 1.10.0 · responsive: false')}</div>`);
    }
  }
  const meta = p.rtrue.ok
    ? `pele 자연 크기 ${p.rtrue.width}×${p.rtrue.height} (webkit 캔버스 측정기) · 유형 <code>${p.rtrue.type}</code> · 라벨 넘침 ${g?.[800]?.labelOverflow?.length ?? '-'}건`
    : `pele 거부: <code>${esc(p.rtrue.error.code)}</code> line ${p.rtrue.error.line} column ${p.rtrue.error.column}`;
  return `<section class="sample" id="s-${s.id}"><h3>${esc(s.id)}</h3><p class="meta">${meta}</p><details><summary>소스</summary><pre>${esc(s.source)}</pre></details><div class="grid">${rows.join('')}</div></section>`;
});

const t = run.timing;
const timingRows = t.runs.map((r) => `<tr><td>${r.run}</td><td>${r.engine}</td><td>${r.totalMs.toFixed(0)}</td><td>${r.totalWithLayoutMs.toFixed(0)}</td><td>${r.firstMs.toFixed(0)}</td><td>${r.maxMs.toFixed(0)}</td></tr>`).join('');
const singleRows = t.single.map((r) => `<tr><td>${r.run}</td><td>${r.engine}</td><td>${r.totalMs.toFixed(0)}</td></tr>`).join('');

const exportRows = Object.entries(run.exports.html).map(([k, v]) => `<tr><td>${k}</td><td><a href="${v.file}">HTML</a></td><td>${v.varPeleInFile}</td><td><a href="exports/pdf-proxy-${k}.pdf">PDF(Chromium 대용)</a></td><td><a href="exports/docx-${k}.docx">DOCX</a></td></tr>`).join('');
const exportShots = Object.keys(run.exports.html).map((k) => `<figure class="shot"><figcaption>HTML ${k} (webkit, file://)</figcaption><img src="exports/html-${k}.png" alt="HTML export ${k}"></figure><figure class="shot"><figcaption>DOCX ${k} (Quick Look 미리보기)</figcaption><img src="exports/docx-${k}.docx.png" alt="DOCX ${k}"></figure>`).join('');
const pngRows = Object.entries(run.exports.docx).flatMap(([k, arr]) => arr.map((p) => `<tr><td>${k}</td><td>${p.id}</td><td>${p.width}×${p.height} → PNG ${p.width * 2}×${p.height * 2}</td><td>${p.stats.opaque}</td><td>${p.stats.colored}</td><td>${p.stats.dark}</td><td>${p.stats.light}</td><td><a href="${p.file}">PNG</a></td></tr>`)).join('');

const mapping = Object.entries(run.tokens.light).map(([k, v]) => `<tr><td><code>${k}</code></td><td><code>${v}</code></td><td><code>${run.tokens.dark[k]}</code></td></tr>`).join('');

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>pele M1 비교 보고서</title>
<style>
:root{--bg:#fbfbfc;--fg:#1d1f20;--muted:#5d5d60;--line:#d6d6d8;--accent:#416180;--card:#ffffff}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#191b1d;--fg:#e7e7ea;--muted:#a4a6a9;--line:#3a3d41;--accent:#9ec0e2;--card:#212427}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif}
main{max-width:1900px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:26px;margin:0 0 4px}h2{margin-top:40px;border-bottom:1px solid var(--line);padding-bottom:4px}h3{margin:28px 0 4px}
table{border-collapse:collapse;margin:8px 0 16px;font-size:13.5px}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
code,pre{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}pre{background:var(--card);border:1px solid var(--line);padding:8px;overflow:auto}
.meta,.note{color:var(--muted)}a{color:var(--accent)}
.grid{display:flex;flex-direction:column;gap:10px;overflow-x:auto}.row{display:flex;gap:10px;align-items:flex-start}
.rowlabel{width:90px;flex:none;font-size:12.5px;color:var(--muted);padding-top:22px}
.cell{margin:0;flex:none}.cell figcaption{font-size:12px;color:var(--muted)}
.box{overflow:auto;border:1px solid var(--line);padding:8px;display:flex;justify-content:center}.box svg{display:block}
.err{color:#b0473c;font-size:12.5px;white-space:pre-wrap;margin:0}
.shots{display:flex;flex-wrap:wrap;gap:12px}.shot{margin:0;max-width:600px}.shot img{max-width:100%;border:1px solid var(--line)}
.pending{border:2px dashed var(--accent);padding:8px 12px;display:inline-block}
</style></head><body><main>
<h1>SPEC-PREVIEW-015 M1 — mermaid ↔ pele 1.10.0 시험 렌더링 비교</h1>
<p class="meta">생성: ${esc(run.finishedAt)} · 브라우저 측정: ${esc(run.environment)} · 단위 측정: ${esc(unit.environment)} · 기계 확인 표는 <code>checks.md</code></p>
<p class="pending">판정(통과/보류)·<code>responsive</code> 선택·<code>--pele-*</code> 변수 목록·단위 테스트 측정기는 <b>사용자 판정 대기</b>입니다. 이 보고서는 근거만 제시합니다.</p>
${findings}
<h2>첫 렌더 시간 (같은 기기, webkit 헤드리스)</h2>
<p class="note">다이어그램 ${t.diagrams}개 문서(서로 다른 샘플 ${t.distinctSamples.length}종을 반복), 실행마다 페이지 새로 열기. mermaid는 앱과 같은 방식(initialize 1회 + forEach(async) parse·render)으로, pele는 동기 render + sanitizeSvg + innerHTML로 측정했습니다. 단위 ms (performance.now, 브라우저 정밀도 제한으로 정수에 가깝게 보임).</p>
<table><tr><th>실행</th><th>엔진</th><th>전체</th><th>전체+레이아웃</th><th>첫 다이어그램</th><th>가장 느린 다이어그램</th></tr>${timingRows}</table>
<table><tr><th>실행</th><th>엔진</th><th>다이어그램 1개(01-test-content) 콜드 렌더</th></tr>${singleRows}</table>
<h2>내보내기 시제품 (색 값을 풀어 넣음 literal / 그대로 as-is)</h2>
<p class="note">literal = 내보내기 테마의 <code>--pele-*</code> 값(아래 임시 매핑)으로 모든 <code>var(--pele-…)</code>를 치환. as-is = pele 출력 그대로(대체값 = pele 라이트 기본색). HTML은 앱의 <code>getPreviewCss</code>·<code>buildHtmlDocument</code>를 그대로 썼습니다. PDF는 앱 인쇄 경로가 아니라 Chromium 인쇄(대용)이고, 앱 경로는 checks.md MANUAL 항목입니다. DOCX PNG는 <code>exportDocx.ts:154-201</code>과 같은 data URI → Image → canvas 경로(크기만 pele width·height, D8)로 만들고 <code>docx</code> 라이브러리로 문서에 넣었습니다.</p>
<table><tr><th>테마-방식</th><th>HTML</th><th>파일 안 var(--pele- 개수</th><th>PDF</th><th>DOCX</th></tr>${exportRows}</table>
<table><tr><th>테마-방식</th><th>샘플</th><th>크기</th><th>불투명 픽셀</th><th>유채색 픽셀</th><th>어두운 픽셀</th><th>밝은 픽셀</th><th>파일</th></tr>${pngRows}</table>
<div class="shots">${exportShots}</div>
<h2>--pele-* 변수</h2>
<p>pele 1.10.0 출력에 실제로 나온 변수(19개 샘플): ${unit.peleVarsEmitted.map((v) => `<code>${v}</code>`).join(' ')}</p>
<p>소스(<code>dist/pele.js</code>)에만 있고 이번 샘플에서는 나오지 않은 변수: <code>--pele-series-5</code>…<code>--pele-series-8</code>(차트 계열 순환, 대체값 #72b7b2 #eeca3b #b279a2 #9d755d), <code>--pele-error</code>(#e45756), <code>--pele-critical</code>(#e45756, 간트 crit), <code>--pele-zoom-cursor</code>·<code>--pele-zoom-top/right/bottom/left</code>(enableZoom UI 전용).</p>
<p>아래는 이 보고서의 다크 칸과 literal 내보내기에 쓴 <b>임시 매핑</b>입니다(D5 제안, 확정 아님). 글꼴 변수는 일부러 연결하지 않았습니다(결과 F3 참고).</p>
<table><tr><th>변수</th><th>라이트 값</th><th>다크 값</th></tr>${mapping}</table>
<h2>샘플별 나란히 비교</h2>
<p class="note">칸 폭 560px(640px 아래)·800px(640px 위). pele는 정화 후(sanitizeSvg) 출력이며, 다크 칸은 위 임시 매핑 값을 칸에 지정해 다시 그리지 않고 색만 바꿨습니다. mermaid는 테마마다 다시 렌더했습니다.</p>
${sections.join('\n')}
</main></body></html>
`;
fs.writeFileSync(path.join(M1, 'report.html'), html);
console.log('report.html bytes', Buffer.byteLength(html));
