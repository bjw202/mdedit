// Windows 프로덕션 빌드 직전 cargo clean을 강제하는 prebuild 훅.
//
// 배경: Windows 환경에서 `tauri build`를 돌릴 때 stale한 incremental 빌드
//       산출물 때문에 프로덕션 빌드가 실패하는 케이스가 있어 도입함.
//       (자세한 재현 케이스/이슈 링크는 차후 보강 필요)
//
// 우회: 빌드가 느려져서 일시적으로 건너뛰고 싶다면 SKIP_CARGO_CLEAN=1 을 지정.
//       예) SKIP_CARGO_CLEAN=1 npm run build

import { execSync } from "node:child_process";

const isWindows = process.platform === "win32";
const skip = process.env.SKIP_CARGO_CLEAN === "1";

if (!isWindows) {
  process.exit(0);
}

if (skip) {
  console.log("[prebuild] SKIP_CARGO_CLEAN=1 감지 — cargo clean 생략");
  process.exit(0);
}

console.log("[prebuild] Windows 프로덕션 빌드 — src-tauri 에서 cargo clean 실행 중...");
execSync("cargo clean", { stdio: "inherit", cwd: "src-tauri" });
