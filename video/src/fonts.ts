/**
 * mdedit video — 로컬 폰트 로딩
 *
 * 앱과 동일한 woff2 파일(`video/public/fonts/`, `../public/fonts/` 에서 벤더링)만
 * 사용한다. Google Fonts 등 외부 CDN 을 일절 호출하지 않으므로 폰트 다운로드가
 * 차단된 사내망에서도 그대로 렌더된다.
 *
 * 폰트 패밀리 이름은 `tokens.ts` 의 `font` 스택과 1:1 로 일치해야 한다.
 *
 * ── 왜 delayRender() 를 쓰지 않는가 ──────────────────────────────────────
 * 폰트를 `@font-face` CSS 로만 선언하고, JS 로 로딩을 기다리지 않는다.
 *
 * 처음에는 FontFace JS API + `delayRender()` 로 로딩 완료를 기다렸는데, S2 를
 * 통째로 렌더하면 프레임 364 근처에서 항상 다음 에러로 죽었다:
 *
 *   A delayRender() "로컬 woff2 폰트 로딩" was called but not cleared after 28000ms
 *
 * Remotion 은 프레임을 여러 페이지에 나눠 렌더하면서 중간에 페이지를 재활용/
 * 재생성하는데, 그렇게 새로 뜬 페이지에서 로딩 프라미스가 끝나지 않았다.
 * `setTimeout` 기반 안전장치도 소용없었다 — Remotion 은 결정론적 렌더를 위해
 * 타이머를 타임라인에 묶어 패치하므로 실시간으로 발화하지 않는다.
 *
 * `@font-face` 로 선언해 두면 해당 패밀리를 쓰는 텍스트가 레이아웃될 때 Chrome
 * 이 스스로 폰트를 로드하고, Remotion 은 페이지 리소스 로딩이 끝난 뒤 프레임을
 * 캡처한다. 즉 JS 게이트 없이도 폰트가 적용되며, 게이트가 없으니 렌더가 그것
 * 때문에 멈출 일도 없다. woff2 는 번들러가 로컬에서 서빙하므로 네트워크 지연도
 * 없다.
 *
 * `font-display: block` 은 폰트 준비 전에 폴백 서체로 그려서 프레임마다 서체가
 * 바뀌는 현상을 막는다.
 */
import { staticFile } from 'remotion';

type FaceSpec = {
  family: string;
  weight: number;
  file: string;
};

const FACES: FaceSpec[] = [
  { family: 'Barlow', weight: 400, file: 'barlow-400.woff2' },
  { family: 'Barlow', weight: 500, file: 'barlow-500.woff2' },
  { family: 'Barlow', weight: 700, file: 'barlow-700.woff2' },
  { family: 'Barlow Condensed', weight: 400, file: 'barlow-condensed-400.woff2' },
  { family: 'Barlow Condensed', weight: 600, file: 'barlow-condensed-600.woff2' },
  { family: 'IBM Plex Mono', weight: 400, file: 'ibm-plex-mono-400.woff2' },
  { family: 'IBM Plex Mono', weight: 500, file: 'ibm-plex-mono-500.woff2' },
  { family: 'IBM Plex Mono', weight: 600, file: 'ibm-plex-mono-600.woff2' },
];

const STYLE_MARKER = 'data-mdedit-fonts';

function injectFontFaceCss(): void {
  if (document.querySelector(`style[${STYLE_MARKER}]`)) {
    return; // Studio 핫 리로드 시 중복 삽입 방지
  }

  const css = FACES.map(
    ({ family, weight, file }) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: block;
  src: url("${staticFile(`fonts/${file}`)}") format("woff2");
}`,
  ).join('\n');

  const style = document.createElement('style');
  style.setAttribute(STYLE_MARKER, '');
  style.textContent = css;
  document.head.appendChild(style);
}

injectFontFaceCss();
