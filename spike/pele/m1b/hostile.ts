// SPEC-PREVIEW-015 M1b spike only (deleted in M7). Hand-written HOSTILE inputs for the sanitizer
// (these are attack probes, not fixtures; nothing here is stored under src/test/fixtures).
const FO = (cls: string | null, inner: string) =>
  `<foreignObject${cls === null ? '' : ` class="${cls}"`} x="0" y="0" width="80" height="20"><div xmlns="http://www.w3.org/1999/xhtml">${inner}</div></foreignObject>`;

export const HOSTILE: Record<string, string> = {
  foreignObjectNoClass: `<svg xmlns="http://www.w3.org/2000/svg">${FO(null, '<span class="katex">NOCLASS</span>')}</svg>`,
  foreignObjectOtherClass: `<svg xmlns="http://www.w3.org/2000/svg">${FO('evil', '<span>OTHERCLASS</span>')}${FO('pele-math evil', '<span>MIXEDCLASS</span>')}</svg>`,
  scriptInsideMath: `<svg xmlns="http://www.w3.org/2000/svg">${FO('pele-math', '<span class="katex">ok<script>window.__pwned=1</script></span>')}<script>window.__pwned=2</script></svg>`,
  onloadInsideMath: `<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=3">${FO('pele-math', '<span class="katex" onclick="window.__pwned=4" onmouseover="x()">ok</span><img src="x" onerror="window.__pwned=5">')}</svg>`,
  javascriptHrefInsideMath: `<svg xmlns="http://www.w3.org/2000/svg">${FO('pele-math', '<span class="katex"><a href="javascript:alert(1)">ja</a><span href="javascript:alert(2)">s</span></span>')}<a href="javascript:alert(3)"><text>t</text></a></svg>`,
  htmlOutsideForeignObject: `<svg xmlns="http://www.w3.org/2000/svg"><g><div>OUTSIDE</div></g></svg><div>ROOTDIV</div><math><mi>ROOTMATH</mi></math>`,
  formsInsideMath: `<svg xmlns="http://www.w3.org/2000/svg">${FO('pele-math', '<form action="https://evil.example"><input name="p"></form><iframe src="https://evil.example"></iframe><style>*{display:none}</style><span class="katex">ok</span>')}</svg>`,
  annotationXmlInsideMath: `<svg xmlns="http://www.w3.org/2000/svg">${FO('pele-math', '<math><semantics><mi>x</mi><annotation-xml encoding="text/html"><img src="x" onerror="window.__pwned=6"><span>AXML</span></annotation-xml></semantics></math>')}</svg>`,
  dataHrefImage: `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AAAA" width="1" height="1"/><image href="https://evil.example/t.png" width="1" height="1"/><use href="#frag"/></svg>`,
};

/** Markers that MUST NOT survive the diagram path. */
export const MUST_STRIP = ['NOCLASS', 'OTHERCLASS', 'MIXEDCLASS', '<script', 'onload=', 'onclick=', 'onmouseover=', 'onerror=', 'javascript:', 'OUTSIDE', 'ROOTDIV', 'ROOTMATH', '<form', '<input', '<iframe', '<style', 'data:image', 'evil.example', '<img', 'AXML', 'annotation-xml'];
