// [임시] SPEC-PREVIEW-018 M0 측정 프로브 — 커밋 금지. 측정 뒤 이 파일과 main.tsx의 import 줄을 지운다.
// window(캡처 단계)에서 wheel·gesture*·keydown(Cmd/Ctrl+=,-,0)을 받아 화면 우하단 패널과 콘솔에 남긴다.
if (import.meta.env.DEV) {
  const panel = document.createElement('pre');
  panel.id = 'm0-probe';
  panel.style.cssText =
    'position:fixed;right:8px;bottom:8px;z-index:99999;margin:0;padding:8px;max-width:520px;' +
    'max-height:45vh;overflow:auto;font:11px/1.35 monospace;background:rgba(0,0,0,.85);color:#7CFC00;' +
    'pointer-events:none;white-space:pre-wrap;';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));
  if (document.body) document.body.appendChild(panel);

  const lines: string[] = [];
  let n = 0;
  const log = (msg: string): void => {
    n += 1;
    lines.push(`#${n} ${msg}`);
    if (lines.length > 14) lines.shift();
    panel.textContent = 'M0 PROBE (앱 셸 window가 받은 이벤트)\n' + lines.join('\n');
    console.log('[M0]', msg);
  };

  const tgt = (e: Event): string => {
    const t = e.target as HTMLElement | null;
    return t ? `${t.tagName.toLowerCase()}${t.dataset?.testid ? `[${t.dataset.testid}]` : ''}` : '?';
  };
  const vv = (): string => `vvScale=${window.visualViewport?.scale ?? 'n/a'} dpr=${window.devicePixelRatio}`;

  window.addEventListener(
    'wheel',
    (e) =>
      log(
        `wheel target=${tgt(e)} ctrl=${e.ctrlKey} meta=${e.metaKey} dY=${e.deltaY.toFixed(1)} mode=${e.deltaMode} ${vv()}`
      ),
    { capture: true, passive: true }
  );
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    window.addEventListener(
      type,
      (e) => log(`${type} target=${tgt(e)} scale=${(e as unknown as { scale?: number }).scale ?? 'n/a'} ${vv()}`),
      { capture: true }
    );
  }
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.metaKey || e.ctrlKey) log(`keydown key=${e.key} ctrl=${e.ctrlKey} meta=${e.metaKey} target=${tgt(e)} ${vv()}`);
    },
    { capture: true }
  );
  log('probe ready');
}
