# SPEC-INFRA-002 plan — 릴리스 자동화 구현 계획

> 요구는 `spec.md`, 근거는 `research.md`, 수용 기준은 `acceptance.md`. 바뀔 가능성이 큰 결정을 앞에, 기계적 작업을 뒤에 둔다. 시간 추정은 쓰지 않는다.

## §A Context

- 독립 SPEC(에픽 없음). 작성 기준 커밋 061e828, 이후 origin/main은 97b7db5(#81, 도구 설정 갱신)로 움직였다. plan-audit 1차가 `git diff --stat HEAD origin/main -- .github README.md docs/BUILD.md CHANGELOG.md package.json src-tauri scripts vite.config.ts` 빈 출력을 확인했다(대상 파일 무영향). run 시작 시 origin/main을 병합하거나 재기반한다.
- 워크트리 `.claude/worktrees/release-automation`, 브랜치 `WT-release-automation`.
- 개발 방법론: `quality.yaml` `development_mode: tdd`. TDD는 버전 검사 스크립트에만 적용한다(워크플로 YAML·설정·문서는 정적 검사와 리허설로 검증).
- run 단계는 `npm ci`부터 시작한다(자동 AC가 `js-yaml`을 쓴다).

## §B 결정 기록 (모두 확정, 2026-10-29)

| ID | 결정 | 반영 |
|----|------|------|
| D-1 | macOS ad-hoc 서명 포함. `bundle.macOS.signingIdentity: "-"`. `xattr` 우회는 문서에 안내하지 않음 | REQ-007, AC-007·015, README·BUILD.md는 Apple 공식 경로만 |
| D-2 | 첫 자동 릴리스 = `v0.19.0`(세 파일이 이미 0.19.0, 태그 없음) | `phase: "v0.19.0 target"`, REQ-015는 `[0.19.0]` 절, AC-014 |
| D-3 | main 포함 여부 검사는 워크플로에 두지 않음 | BUILD.md 절차 단계(REQ-014), 위험 R-7, 제외 목록 |
| D-4 | 자산 확인 job 삭제 | 실패한 빌드는 실행을 빨갛게 표시, 초안은 사람이 확인 |
| D-5 | 게시된 릴리스 보호 = 빌드 job의 업로드 직전 초안 확인 단계(감사 D10) | REQ-004, AC-005. 대안(빌드와 업로드 분리 후 직접 업로드)은 코드가 늘어 기각. 확인과 업로드 사이 틈(빌드 단계 전체)은 BUILD.md 규칙 "실행이 완전히 끝난 뒤 게시"로 막고, 남는 위험(R-8)은 사용자가 2026-10-29 승인 게이트에서 수용 |
| D-6 | Rust 툴체인·캐시 서드파티 액션 제거, 러너 이미지의 stable Rust 사용(감사 D11) | REQ-011, AC-009, R-5·R-9 |
| D-7 | tauri-action은 커밋 SHA `1deb371b0cd8bd54025b384f1cd735e725c4060f` + `# v1.0.0` 주석으로 고정(사용자 선택 Round 4, 감사 N3) | REQ-011, AC-009 |
| D-8 | 안내 블록 링크 = 저장소 첫 화면(README) `https://github.com/bjw202/mdedit`, 절 앵커 없음, Releases 페이지 링크 금지(순환). 첫 실행 대처법은 README에만 둔다(사용자 선택 Round 4 + 2026-10-29 정정) | REQ-005, AC-005 |
| D-9 | 빌드 job의 셸 단계는 `shell: bash`(job `defaults.run.shell: bash` 권장, 감사 N1) | REQ-004, AC-005 |

## §C 데이터 흐름(워크플로 구조)

```
태그 푸시 ─► version-check (ubuntu-latest, 쓰기 권한 없음)
                │ 출력: tag, version, previous_tag
                ▼
            create-release (ubuntu-latest, contents: write)
                │ 같은 태그 릴리스 목록 조회 → 있으면 exit 1
                │ generate-notes(tag_name, previous_tag_name) → 본문 = 안내 블록 + 노트
                │ POST /releases (name, draft=true) → 출력: release_id
                ▼
            build (matrix platform: macos-latest[--target aarch64-apple-darwin] · windows-latest,
                   fail-fast: false, contents: write)
                │ checkout(persist-credentials: false) → setup-node 24 + npm 캐시 → npm ci
                │ GET /releases/{id} → .draft != true 이면 exit 1   (shell: bash — Windows 기본 셸은 pwsh)
                │ tauri-action@1deb371… (# v1.0.0) releaseId=<id>
```

- 초안 상태는 `POST /releases`의 `draft=true`로만 정해진다. tauri-action은 `releaseId`를 받으면 `releaseDraft`를 보지 않는다(감사 D3, tauri-action `src/index.ts`). `releaseDraft` 입력은 넣지 않는다.
- 초안 조회: "Get a release by tag"는 게시본만 돌려주므로 생성 job은 목록(`GET /releases`)에서 `tag_name`으로 찾는다.
- 토큰: `GH_TOKEN`/`GITHUB_TOKEN`은 `gh api` 단계와 tauri-action 단계의 단계 단위 `env`로만 준다. `npm ci` 단계에는 토큰이 없다.

## §D 기술 선택

| 항목 | 선택 | 근거 |
|------|------|------|
| 트리거 | `on: push: tags: ['v[0-9]+.[0-9]+.[0-9]+']` | research.md §5 |
| 동시성 | `group: release-${{ github.ref }}`, `cancel-in-progress: false` | research.md §5 |
| 체크아웃 | `actions/checkout@v4`; `version-check`는 `fetch-depth: 0`(직전 태그 계산), 쓰기 job은 `persist-credentials: false` | REQ-005·008 |
| Node | `actions/setup-node@v4`, `node-version: '24'`, 빌드 job은 `cache: npm` | frontend-gates 관례 |
| Rust | 러너 이미지의 stable Rust(macOS 26 arm64·Windows 2025 모두 Rust 1.99 설치) — 별도 액션 없음, 캐시 없음 | research.md §4 |
| 빌드 | `tauri-apps/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f  # v1.0.0`(2026-06-29 커밋 "Apply Version Updates From Current Changes (#1191)", `v1`·`v1.0.0` 주석 태그가 가리킴 — 오케스트레이터가 `gh api`로 확인. 태그 객체 SHA `944946e…`·`2d793bf…`는 커밋이 아니므로 쓰지 않음), `releaseId`, macOS `args: --target aarch64-apple-darwin`. `tauriScript`는 지정하지 않음(기본 `npm exec tauri`로 동작, 감사 D13) | research.md §2 |
| 행렬 키 | `matrix.include[].platform`, `matrix.include[].args`, `runs-on: ${{ matrix.platform }}` | AC-006이 이 이름을 씀 |
| 의존성 | 빌드 job에서 `npm ci`(`beforeBuildCommand: npm run build-vite`). `npm ci --ignore-scripts` 가능 여부는 run에서 확인(가능하면 채택, 선택 사항) | research.md §4 |
| 버전 검사 | `node scripts/check-release-version.mjs "$GITHUB_REF_NAME"` — 의존성 없이 실행, 결과를 `GITHUB_OUTPUT`에 기록 | research.md §7 |
| 시간 제한 | 각 job에 `timeout-minutes` 설정(값은 run에서 정함, 빌드 job은 frontend-gates의 20보다 크게) | 무한 대기 방지 |

## §E Self-Verification (run 단계 산출 증거)

- `npm test` 출력(새 테스트 포함, 기존 스위트 회귀 없음), 스크립트 커버리지(커버리지 도구가 없으면 Gap으로 보고).
- `actionlint .github/workflows/release.yml` 출력.
- acceptance.md AC-001~012 명령 출력 전부.
- 리허설·실기기 결과는 사용자 행동 뒤 progress.md §E.2에 기록.

## §F Milestones (우선순위 순)

### M1 — 버전 검사 스크립트 (Priority High, TDD)

- RED: `scripts/check-release-version.test.mjs` — 일치, 파일별 불일치(3종), 형식 위반(`v0.19.0-rc.1`, `0.19.0`, `v0.19`, `v0x19x0`, `v0.19.0.1`), Cargo `[dependencies]`의 `version =`을 잘못 읽지 않음, 직전 태그 선택(숫자 비교, 없음, 비semver 무시).
- GREEN: `scripts/check-release-version.mjs` — 순수 함수(검사, 직전 태그 계산) + CLI 진입부(파일 읽기, `git tag` 목록, `GITHUB_OUTPUT` 기록, 실패 시 종료 코드 1). CLI 부분은 import 시 실행되지 않게 둔다.

### M2 — 워크플로·설정 (Priority High)

- `.github/workflows/release.yml`(§C 구조, §D 선택). 한국어 의도 주석은 frontend-gates 문체를 따른다.
- `.github/release-notes-header.md` 고정 설치 안내 블록 — OS별 파일(`_aarch64.dmg`, `-setup.exe` 권장 / `.msi`) + "처음 열 때 경고가 나오면 README의 설치 안내를 보세요" 문장과 링크 `https://github.com/bjw202/mdedit`(앵커·`/releases` 없음).
- `src-tauri/tauri.conf.json`에 `"macOS": { "signingIdentity": "-" }`(bundle 아래, 그 밖의 키 무변경).
- actionlint + AC-003~010 통과.

### M3 — 문서 (Priority Medium)

- `README.md`: "빠른 시작" 앞에 `## 설치 파일 내려받기` 절(REQ-013). 문구 초안은 §G.
- `docs/BUILD.md` 591-655행 재작성(REQ-014, 문구 초안은 §G) — 낡은 v0.9.0·x64 dmg 예시, 우클릭 열기, `xattr` 제거, 로컬 macOS ad-hoc 서명 안내 1문장 추가.
- `CHANGELOG.md` `## [0.19.0] - 2026-10-29` 절에 항목 1개(REQ-015).

### M4 — 리허설과 실기기 확인 (Priority Medium, 사용자 행동 필요, 병합 후)

- 실패 경로 리허설(AC-013) → 정상 경로 리허설 = 실제 v0.19.0(AC-014) → Apple Silicon·Windows 첫 실행(AC-015·016) → 문제가 없으면 사용자가 Publish.

## §F.1 파일별 변경 목록

| 파일 | 구분 | 마일스톤 |
|------|------|----------|
| `scripts/check-release-version.mjs` | [NEW] | M1 |
| `scripts/check-release-version.test.mjs` | [NEW] | M1 |
| `.github/workflows/release.yml` | [NEW] | M2 |
| `.github/release-notes-header.md` | [NEW] | M2 |
| `src-tauri/tauri.conf.json` | [MODIFY] `bundle.macOS.signingIdentity` 1개 키 | M2 |
| `README.md` | [MODIFY] 새 절 | M3 |
| `docs/BUILD.md` | [MODIFY] 591-655행 | M3 |
| `CHANGELOG.md` | [MODIFY] `[0.19.0]` 절 | M3 |
| `.github/workflows/frontend-gates.yml` | [EXISTING] 무변경 | — |

## §G 사용자 문서 문구 초안 (번역투 없이)

README `## 설치 파일 내려받기`(초안 — run에서 다듬되 AC-011 문구는 유지):

> [Releases 페이지](https://github.com/bjw202/mdedit/releases)에서 최신 버전을 받습니다.
>
> | 컴퓨터 | 받을 파일 |
> |---|---|
> | Apple Silicon 맥(M1 이후) | `mdedit_<버전>_aarch64.dmg` |
> | Windows(64비트) | `mdedit_<버전>_x64-setup.exe` (권장) 또는 `.msi` |
>
> **macOS에서 처음 열 때**: 이 앱은 Apple 공증을 받지 않아 처음 열면 차단 안내가 나옵니다. 한 번 열기를 시도한 뒤 시스템 설정 → 개인정보 보호 및 보안으로 가서 아래쪽의 "그래도 열기"를 누르고, 다시 뜨는 안내에서 "열기"를 누르세요. 다음부터는 바로 열립니다.
>
> **Windows에서 처음 실행할 때**: 서명하지 않은 설치 파일이라 Microsoft Defender SmartScreen이 경고를 띄울 수 있습니다. 경고 창의 추가 정보를 눌러 실행을 선택하세요. (버튼 이름은 AC-016에서 실제 화면으로 확인해 맞춘다.)

BUILD.md `## GitHub Releases로 배포하기` 절 요지(절차와 규칙의 정의는 spec.md REQ-INFRA002-014; AC-011이 굵게 표시한 고정 문구를 검사한다):

> 1. `package.json`·`src-tauri/Cargo.toml`·`src-tauri/tauri.conf.json`의 버전을 같은 값으로 맞춰 main에 병합합니다.
> 2. **main에 이미 병합된 커밋에 태그**를 답니다(예: `git tag v0.19.0 origin/main`). 워크플로는 이 조건을 검사하지 않으니 직접 지켜야 합니다.
> 3. `git push origin v0.19.0`으로 태그를 올리면 Actions의 `release.yml`이 실행됩니다.
> 4. 실행이 **완전히 끝난 뒤** **초안** 릴리스의 파일과 본문을 확인하고 Publish를 누릅니다.
>
> 지켜야 할 규칙: 실행 중에는 게시하지 않습니다. 게시한 뒤에는 실패한 job을 **다시 실행**하지 않습니다. 결함이 있으면 `gh release delete <태그> --yes` → `git push --delete origin <태그>` → `git tag -d <태그>` 순서로 지우고 다시 태그를 답니다.
>
> 참고: 이제 로컬 macOS 빌드(`npm run build`)도 **ad-hoc** 서명됩니다(Xcode 명령줄 도구의 `codesign` 사용). Windows 빌드에는 영향이 없습니다.
>
> macOS 첫 실행 안내는 README와 같은 Apple 공식 경로(시스템 설정 → 개인정보 보호 및 보안 → **그래도 열기** → 열기)를 씁니다.

## §H Anti-Patterns

- 빌드 행렬 job이 `tagName`으로 릴리스를 각자 만들게 두기(동시 생성 경합, research.md §2).
- 초안 해제(`publish`) job 추가 — 공식 예제에는 있지만 사용자 결정과 어긋남.
- `releaseDraft: true`를 초안 보장의 근거로 삼기(`releaseId`와 함께면 무시됨).
- 생성 노트 시작점을 기본값에 맡기기(research.md §3).
- 토큰을 job·워크플로 단위 `env`에 두기, 체크아웃 자격 증명 저장.
- 리허설 태그를 사용자 승인 없이 푸시하기.

## §I Cross-References

- `spec.md` REQ-INFRA002-001~016, `acceptance.md` AC-INFRA002-001~016, `research.md` §1~9, `interview.md` Round 1~3, `.moai/reports/plan-audit/SPEC-INFRA-002-iter1.md`.
