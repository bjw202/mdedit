import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

/**
 * 렌더용 브라우저를 "이미 설치된 로컬 Chrome"으로 고정한다.
 *
 * 기본 동작에서 Remotion 은 렌더 시점에 Chrome Headless Shell 을 Google CDN 에서
 * 내려받는다. 사내망처럼 해당 도메인이 차단된 환경에서는 이 다운로드가
 * ECONNRESET 으로 끊기면서 렌더 자체가 실패한다. 로컬에 설치된 Chrome /
 * Edge 를 직접 지정하면 렌더 경로에서 네트워크 접근이 사라진다.
 *
 * 우선순위:
 *   1. REMOTION_BROWSER_EXECUTABLE 환경변수 (사용자가 경로를 직접 지정)
 *   2. 플랫폼별 표준 설치 경로 자동 탐색 (Chrome 우선, 없으면 Edge)
 *   3. 둘 다 실패하면 미지정 — Remotion 기본 동작(다운로드)으로 되돌아간다
 */
const BROWSER_CANDIDATES: Record<string, string[]> = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ],
};

function resolveBrowserExecutable(): string | null {
  const fromEnv = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (fromEnv) {
    if (existsSync(fromEnv)) {
      return fromEnv;
    }
    console.warn(
      `[remotion.config] REMOTION_BROWSER_EXECUTABLE 경로를 찾을 수 없습니다: ${fromEnv}`,
    );
  }

  for (const candidate of BROWSER_CANDIDATES[process.platform] ?? []) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const browserExecutable = resolveBrowserExecutable();

if (browserExecutable) {
  Config.setBrowserExecutable(browserExecutable);
} else {
  console.warn(
    '[remotion.config] 로컬 Chrome/Edge 를 찾지 못했습니다. Remotion 이 헤드리스 셸을 ' +
      '다운로드하려 시도하며, 네트워크가 차단된 환경에서는 ECONNRESET 으로 실패할 수 ' +
      '있습니다. REMOTION_BROWSER_EXECUTABLE 환경변수로 경로를 직접 지정하세요.',
  );
}
