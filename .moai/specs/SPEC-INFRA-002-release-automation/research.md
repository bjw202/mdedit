# SPEC-INFRA-002 research — 릴리스 자동화 근거 조사

> 조사일 2026-10-29(v0.2.0에서 plan-audit 1차, v0.3.0에서 2차 결과로 보강). 저장소 사실은 워크트리 `WT-release-automation`에서 직접 읽었고, 외부 사실은 아래 URL을 WebFetch로 읽어 확인했다. 감사자가 직접 확인한 사실은 "감사 확인"으로 표시하고 `.moai/reports/plan-audit/SPEC-INFRA-002-iter1.md`의 해당 항목을 인용한다. "미확인"은 SPEC 본문에서 단정하지 않는다.

## 1. 저장소 실측

| 항목 | 값 | 출처 |
|------|-----|------|
| 앱 버전 | 0.19.0 (3곳 동일) | `package.json:4`, `src-tauri/Cargo.toml:3`, `src-tauri/tauri.conf.json:4` |
| 번들 대상 | `bundle.targets: "all"`, `beforeBuildCommand: npm run build-vite` | `src-tauri/tauri.conf.json` |
| macOS 서명 설정 | `bundle.macOS` 없음 → `signingIdentity` 미설정(이 SPEC이 `"-"` 추가) | `src-tauri/tauri.conf.json` |
| npm 스크립트 | `build: tauri build`, `prebuild: node scripts/prebuild.mjs`, `tauri` 스크립트 없음, devDependencies에 `@tauri-apps/cli: ^2` | `package.json` |
| prebuild 동작 | Windows에서만 `cargo clean`, `npm run build`에서만 실행 | `scripts/prebuild.mjs` |
| 기존 CI | `frontend-gates.yml`: `pull_request` + `push: main`, `macos-latest`, Node 24 + npm 캐시, `actions/*@v4`, 실행 단위 동시성 취소, 20분 제한, 한국어 의도 주석, "Rust 게이트는 별도 job" | `.github/workflows/frontend-gates.yml:1-90` |
| Vitest 범위 | include 미지정 → 기본값이 `scripts/*.test.mjs` 수집(감사 확인: vitest 2.1.9 기본 `**/*.{test,spec}.?(c|m)[jt]s?(x)`) | `vite.config.ts:38-48`, 감사 C |
| YAML 파서 | `js-yaml` 4.1.1이 eslint 경유 개발 의존성으로 이미 잠금 파일에 있음 | `package-lock.json:4930` |
| 기존 릴리스 | 게시본 v0.14.0 하나(`mdedit_0.14.0_aarch64.dmg`, Latest), v0.13.2 초안 | `gh release list` |
| 태그 | v0.4.0 … v0.14.0, v0.15.0, v0.16.1, v0.17.0, v0.18.0 — v0.16.0·v0.19.0 없음 | `git tag`, 감사 C(`git ls-remote`) |
| CHANGELOG | `## [0.19.0] - 2026-10-29`가 7행에 이미 있음 | `CHANGELOG.md:7` |
| 문서 | README에 최종 사용자 내려받기 절 없음. BUILD.md 591-655행 수동 절차(우클릭 열기·`xattr` 포함) | `README.md`, `docs/BUILD.md` |
| 새 문구 부재 확인 | `release.yml`, `초안`, `push --delete origin`, `그래도 열기`, `개인정보 보호 및 보안`, `mdedit/releases`, `SPEC-INFRA-002`, `signingIdentity` 모두 README·BUILD.md·CHANGELOG·tauri.conf.json에서 0건 → AC-011·007이 지금 저장소에서 실패함 | 2026-10-29 `grep -cF` 실행 |
| actionlint | 로컬 미설치 | `which actionlint` |

## 2. tauri-action

출처: https://github.com/tauri-apps/tauri-action, https://raw.githubusercontent.com/tauri-apps/tauri-action/dev/README.md, https://raw.githubusercontent.com/tauri-apps/tauri-action/dev/action.yml, https://github.com/tauri-apps/tauri-action/releases, https://raw.githubusercontent.com/tauri-apps/tauri-action/dev/examples/publish-to-manual-release.yml

- 최신 메이저 v1("action v1.0.0"), `runs.using: 'node24'`.
- `releaseId`: "The id of the release to upload artifacts as release assets". **감사 확인(D3)**: v1 `src/index.ts` L99-L129 — `releaseId`가 있으면 `releaseDraft`를 보지 않고 업로드만 한다. 초안 여부는 생성 호출이 정한다.
- **감사 확인(D10)**: `src/upload-release-assets.ts`(dev) — 업로드 전에 같은 이름의 기존 자산을 `deleteReleaseAsset`로 지운다. 게시된 릴리스에 재실행하면 게시본이 바뀐다 → 빌드 job의 업로드 전 초안 확인(REQ-004).
- `generateReleaseNotes`는 있으나 시작 태그를 받지 않는다 → 생성 job에서 직접 처리.
- **감사 확인(D13)**: `tauriScript` 기본 — v1 `src/runner.ts`는 `@tauri-apps/cli`가 package.json에 있고 npm을 쓰면 `tauri` 스크립트가 없을 때 `npm exec tauri`를 쓴다. 기본값으로 동작하므로 `tauriScript`를 지정하지 않는다. (v0.1.0의 "실패할 수 있음" 서술은 틀렸다.)
- 동시 생성 경합: 문서에 없음(미확인) → 공식 예제 `publish-to-manual-release.yml`처럼 `create-release` job이 먼저 만들고 행렬은 `releaseId`로 올린다(그 예제의 마지막 게시 job은 두지 않는다).

## 3. 자동 생성 노트, 초안 생성, 재실행

출처: https://docs.github.com/en/rest/releases/releases#create-a-release, https://docs.github.com/en/rest/releases/releases#generate-release-notes-content-for-a-release, https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes, https://cli.github.com/manual/gh_release_create, https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-github-cli, https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs

- Create a release: `draft` "true to create a draft (unpublished) release"(기본 false — 빠뜨리면 바로 게시된다), `make_latest` "Drafts and prereleases cannot be set as latest".
- Generate release notes content: `previous_tag_name` "The name of the previous tag to use as the starting point". 생략 시 기본 시작점은 문서에 없음(**미확인**) → 직전 `vX.Y.Z` 태그를 명시한다.
- "Get a release by tag name"은 "Get a published release" — 초안 조회는 목록으로. "List releases": "Only users with push access will receive listings for draft releases" → 생성 job에 `contents: write` 필요.
- `gh`: "GitHub CLI is preinstalled on all GitHub-hosted runners", 단계마다 `GH_TOKEN` 필요.
- 재실행: "The workflow will also use the same `GITHUB_SHA` … and `GITHUB_REF`", "Re-runs use the privileges of the actor who initially triggered the workflow", 30일 이내·최대 50회. **"Re-run failed jobs"가 성공한 job의 출력(`release_id`)을 재사용하는지는 문서에 없음(미확인).** 설계는 양쪽 모두에서 안전하다: 재사용되면 업로드 전 초안 확인이 게시본을 막고, 생성 job이 다시 돌면 기존 릴리스 때문에 실패한다.

## 4. 행렬·러너·툴체인

출처: https://github.com/actions/runner-images, https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md, https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-VS2026-Readme.md, https://v2.tauri.app/distribute/pipelines/github/, https://v2.tauri.app/distribute/windows-installer/

- `macos-latest` = macOS 26 arm64, `windows-latest` = Windows Server 2025 x64(조회일 2026-10-29).
- **러너 이미지에 Rust가 있다**: macOS 26 arm64 이미지(Image Version 20261013.0424.1) "Rust 1.99.0", "Cargo 1.99.0", "Rustup 1.29.0"; Windows 2025 이미지(20261021.278.1) "Rust 1.99.1", "Cargo 1.99.1", "Rustup 1.29.2". `Cargo.toml` `rust-version = "1.77.2"`보다 높다 → Rust 툴체인 액션·캐시 액션을 쓰지 않는다(REQ-011).
- macOS arm64 러너의 호스트 대상은 aarch64라 `--target aarch64-apple-darwin`에 추가 설치가 필요 없다(추론 — rustup 호스트 대상은 설치 시 포함). Windows 이미지 문서는 기본 대상(`x86_64-pc-windows-msvc`)을 적지 않는다(**미확인**, 정상 경로 리허설에서 확인).
- **감사 확인**: Tauri 번들러가 Windows에서 WiX·NSIS를 직접 내려받는다 — `crates/tauri-bundler/src/bundle/windows/msi/mod.rs` L39 `WIX_URL`, L290 `download_and_verify`; `nsis/mod.rs` L38 `NSIS_URL`, L140. (Windows 2025 이미지에 "WiX Toolset 3.14.1.8722"도 있다.) 내려받기 실패는 Windows 빌드 job 실패로 드러난다.
- **감사 확인**: tauri-action은 `npm exec tauri build`를 부르므로 npm `prebuild` 수명주기(`npm run build`에서만 실행)가 돌지 않는다. CI에서 `scripts/prebuild.mjs`는 무관하다. AC-014가 로그로 재확인한다.
- MSI의 프리릴리스 버전 제한은 문서 절단으로 **미확인** — 프리릴리스 태그는 버전 검사에서 거부하므로 빌드까지 가지 않는다.

## 5. 권한·동시성·필터 패턴·고정

출처: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax (permissions·concurrency·filter pattern cheat sheet·jobs outputs)

- "`contents: write` allows the action to create a release." "If you specify the access for any of these permissions, all of those that are not specified are set to `none`."
- 동시성: 기본은 대기 중 실행만 교체, 실행 중 취소는 `cancel-in-progress: true`일 때만.
- 필터: `+` "Matches one or more of the preceding character", `[]` 범위 `0-9`, `.`은 특수 문자 아님. 예 `v[12].[0-9]+.[0-9]+` "Matches all semantic versioning branches and tags", `v2*`는 "start with `v2`" — 감사는 이를 전체 일치로 해석(접두어 일치에는 `*`가 필요)하며 `v0.19.0-rc.1`은 트리거되지 않을 가능성이 높다고 본다. 명시 문구는 없어 **미확인**으로 두고, 스크립트가 정확한 형식만 통과시키는 이중 방어를 유지한다. 필터 문자열을 정규식으로 재사용하면 `.`이 아무 문자와 맞으므로(`v0x19x0`) 스크립트는 `^v\d+\.\d+\.\d+$`를 쓴다.
- 체크아웃 자격 증명: `actions/checkout`은 기본으로 토큰을 `.git/config`에 남긴다(`persist-credentials` 기본 true — 감사 D11 인용, 액션 문서는 이번에 직접 조회하지 않음). 쓰기 job은 `persist-credentials: false`.
- 고정: `actions/*`는 frontend-gates와 같은 `@v4`. 서드파티는 `tauri-apps/tauri-action` 하나만 남기고 커밋 SHA로 고정한다. 값: `1deb371b0cd8bd54025b384f1cd735e725c4060f`(2026-06-29 커밋 "Apply Version Updates From Current Changes (#1191)"). 오케스트레이터가 `gh api`로, 감사 2차가 `git ls-remote`로 `refs/tags/v1`(태그 객체 `944946e…`), `v1.0`(`94d8812…`), `v1.0.0`(`2d793bf…`)이 모두 이 커밋으로 풀린다(peel)고 확인했다 — 태그 객체 SHA는 고정 값으로 쓰지 않는다.
- 기본 셸(감사 2차 N1 인용, workflow-syntax 표): Windows의 기본 셸은 `pwsh`("This is the default shell used on Windows"). bash 문법 단계는 `shell: bash`(Windows 러너의 Git Bash)가 필요하다.

## 6. 서명 없는 앱의 첫 실행

출처: https://support.apple.com/en-us/102445, https://support.apple.com/ko-kr/102445, https://v2.tauri.app/distribute/sign/macos/, https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/

macOS:
- Apple 한국어 페이지("Mac에서 앱 안전하게 열기", 절 "공증을 받지 않은 앱이나 확인되지 않은 개발자가 제공한 앱을 열려는 경우"): "시스템 설정을 엽니다." → "'개인정보 보호 및 보안'을 클릭하고 아래로 스크롤한 다음 '그래도 열기' 버튼을 클릭하여 앱을 열거나 설치하겠다는 의사를 확인해 줍니다." → "경고 메시지가 다시 나타납니다. 그래도 앱을 열려는 의사가 확실하면 '열기'를 클릭합니다." README·BUILD.md 문구는 이 표현을 따른다.
- 우클릭(Control-click) 열기는 현재 Apple 페이지에 없다 → 문서에서 뺀다.
- Tauri: ad-hoc 서명은 의사 신원 `-`, "This is useful on ARM (Apple Silicon) devices, where code-signing is required for all apps from the Internet"; 서명이 없으면 브라우저로 받은 앱에서 "a warning that your application is broken and can not be started"; "Ad-hoc code signing does not prevent MacOS from requiring users to" 개인정보 보호 및 보안에서 승인하도록 요구 → ad-hoc 서명 뒤에도 "그래도 열기" 안내는 그대로 필요하다.
- **감사 확인(D8)**: 게시된 v0.14.0 dmg의 앱은 `flags=0x20002(adhoc,linker-signed)`, `Info.plist=not bound`, `Sealed Resources=none`이고 `codesign --verify --deep --strict`가 실패한다(링커 서명만 있고 번들 봉인이 없음).
- **미확인**: `signingIdentity: "-"`로 CI에서 만든 앱이 strict 검증을 통과하고 "손상됨" 없이 열리는지 — CI 빌드가 아직 없다. AC-015가 실기기에서 판정한다.
- 감사 2차(N8) 인용: `signingIdentity: "-"`를 넣으면 로컬 macOS `npm run build`도 `codesign --force -s -`를 실행한다(Tauri 번들러 `keychain.rs` L221). macOS 빌드에 이미 필요한 Xcode 명령줄 도구의 `codesign`을 쓰므로 해롭지 않고, Windows 빌드는 영향이 없다 → BUILD.md에 한 문장으로 알린다(REQ-014).
- 기록용(안내하지 않음): `xattr -d com.apple.quarantine <앱>`으로 격리 속성을 지우는 방법이 널리 쓰이지만 Apple 공식 안내에는 없다. 사용자 결정(Round 3)으로 문서에 넣지 않는다.

Windows:
- SmartScreen은 내려받은 파일이 "a list of files that are well known and downloaded frequently"에 없으면 "shows a warning, advising caution", 평판은 "the digital signature used to sign a file"에도 붙는다 → 서명 없는 새 설치 파일은 경고가 뜬다고 보는 것이 타당하다.
- **미확인**: 경고 창 버튼 문구(영문 "More info"/"Run anyway", 한국어 표기). AC-016에서 실제 화면으로 확인해 README를 맞춘다.

## 7. 버전 검사 위치

| 안 | 장점 | 단점 |
|----|------|------|
| A. 워크플로 인라인 셸 | 파일 수 최소 | 단위 테스트 불가, 실패 경로를 태그 푸시로만 검증 |
| B. Node 스크립트 + Vitest 테스트 **(채택)** | 순수 함수로 일치·불일치·형식·직전 태그를 로컬·CI(`npm test`)에서 검증, 의존성 0(`node:fs`) | 파일 2개 추가 |

- 테스트 위치 `scripts/check-release-version.test.mjs`: Vitest 기본 include가 수집한다(감사 확인). jsdom 환경·`src/test/setup.ts`를 물려받지만 해롭지 않다. 스크립트는 import 시 CLI 부분(git 호출·종료)을 실행하지 않아야 한다. `src/test/*.ts`에서 `.mjs`를 import하면 typecheck 오류 가능성이 있어(추정, 실행 안 함) `scripts/`에 둔다. eslint(`--ext ts,tsx`) 대상은 아니다.

## 8. 테스트 전략

| 층 | 대상 | 방법 |
|----|------|------|
| 단위(자동) | 버전 일치·형식·직전 태그 | Vitest |
| 정적(자동) | `release.yml` 문법 | actionlint — 실행 시점에만 설치: `brew install actionlint`, `bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)`, `go install github.com/rhysd/actionlint/cmd/actionlint@latest` (https://github.com/rhysd/actionlint/blob/main/docs/install.md) |
| 정적(자동) | 트리거·job 순서·초안 호출·권한·토큰·동시성·액션 허용 목록·행렬 | `node -e` + 이미 있는 `js-yaml` 단언(acceptance.md) |
| 설정(자동) | ad-hoc 서명 키, 그 밖의 키 무변경 | JSON 비교 |
| 문서(자동) | 새 절에만 있을 문구, 낡은 절차 부재 | 절 범위 `awk` + `grep` |
| 리허설(수동) | 실제 초안·파일·본문, 불일치 차단 | 병합 후 태그 푸시(사용자 승인) |
| 실기기(수동) | Apple Silicon 서명·첫 실행, Windows 첫 실행 | 초안 파일을 내려받아 실행 |

리허설 절차: acceptance.md AC-013(버림 태그 `v0.0.1`로 실패 경로 확인 뒤 삭제), AC-014(실제 `v0.19.0`). 초안은 저장소 쓰기 권한자에게만 보인다(§3).

## 9. 남은 미확인 항목

- 같은 태그로 두 행렬 job이 동시에 릴리스를 만들 때의 tauri-action 동작(설계로 회피).
- 자동 생성 노트의 기본 시작점(명시로 회피).
- 태그 필터의 전체 일치 여부(스크립트 이중 방어).
- "실패한 job만 다시 실행"이 성공 job 출력을 재사용하는지(어느 쪽이든 안전한 설계).
- Windows 러너의 Rust 기본 대상이 `x86_64-pc-windows-msvc`인지(리허설).
- `signingIdentity: "-"` CI 산출물의 strict 검증·"손상됨" 여부(AC-015).
- MSI 프리릴리스 버전 제한(버전 검사로 회피).
- SmartScreen 버튼 문구(AC-016).
- `npm ci --ignore-scripts`로도 빌드되는지(run에서 확인, 선택 사항).
- 공개 저장소의 macOS·Windows 러너 무료 여부(GitHub 요금 문서 미조회, `frontend-gates.yml` 주석에 의존).
- `actions/checkout`의 `persist-credentials` 기본값(감사 인용, 액션 문서 직접 미조회).

정정된 항목(v0.1.0에서 미확인 → 확인): tauri-action 기본 스크립트 동작, CI에서 prebuild 미실행, Windows WiX·NSIS 자동 내려받기, 러너 이미지의 Rust 설치.
