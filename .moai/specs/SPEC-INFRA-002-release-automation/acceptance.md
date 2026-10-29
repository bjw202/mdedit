# SPEC-INFRA-002 acceptance — 수용 기준

> 요구는 `spec.md`. 각 AC는 통과/실패가 이분법으로 갈린다. **자동** AC(001~012)는 로컬·CI에서 명령으로 판정하고, **수동** AC(013~016)는 외부 효과(태그 푸시·실기기 실행)가 있어 사용자의 명시적 행동과 승인이 필요하다.

## 공통 준비 (자동 AC)

- `npm ci`를 먼저 실행한다. YAML 파싱에는 `js-yaml` 4.1.1을 쓴다 — `package-lock.json:4930`에 eslint를 거친 개발 의존성으로 이미 들어 있어 **새 의존성이 아니다**. 한계: 직접 선언한 의존성이 아니라 eslint 업그레이드로 빠질 수 있다(그때는 이 AC 명령이 `Cannot find module`로 실패해 드러난다). js-yaml 4는 YAML 1.2 규칙이라 `on:` 키를 문자열로 읽는다(실행 확인은 run 단계 첫 명령).
- js-yaml 단언 명령은 모두 같은 줄 맨 앞에서 셸 변수 `W`(파싱 준비 코드)를 정의한 뒤 `node -e "$W …"`를 실행한다. Bash 호출끼리 셸 상태를 공유하지 않으므로 **명령을 그대로 한 번에 실행**해야 한다(감사 N9). `W`가 비어 있으면 `ReferenceError`로 실패하므로 거짓 통과는 없다.

- 각 명령은 단언이 어긋나면 `AssertionError`로 종료 코드 1을 낸다. 아래 "Then"마다 그것을 판정하는 명령을 붙였다. 워크플로 파일이 없는 지금의 저장소에서는 모두 실패한다(`ENOENT`).

## 자동 수용 기준

### AC-INFRA002-001: 버전 검사 함수 (단위) — REQ-002

- Given 태그 `v0.19.0`과 세 파일 버전이 모두 `0.19.0`인 입력
- When 검사 함수를 호출하면
- Then 오류 목록이 비어 있다.
- Given 세 파일 중 하나만 `0.18.0`인 입력(파일마다 한 번씩, 3사례)
- When 검사 함수를 호출하면
- Then 오류가 정확히 1개이고, 메시지에 해당 파일 경로·값 `0.18.0`·태그 `v0.19.0`이 들어 있다.
- Given 태그 `v0.19.0-rc.1`, `0.19.0`, `v0.19`, `v0x19x0`, `v0.19.0.1` 각각
- When 검사 함수를 호출하면
- Then 형식 위반 오류가 난다(`v0x19x0`은 점을 이스케이프하지 않은 정규식을 잡는 사례).
- Given `[package]` 절 `version = "0.19.0"` 뒤 `[dependencies]` 절에 `tauri = { version = "2" }`가 있는 Cargo.toml 문자열
- When Cargo 버전을 읽으면
- Then `0.19.0`이다.
- 판정: `npx vitest run scripts/check-release-version.test.mjs` 종료 코드 0, 그리고 `grep -oE "v0x19x0|v0\.19\.0\.1|rc\.1" scripts/check-release-version.test.mjs | sort -u | wc -l` → 3(줄 수가 아니라 서로 다른 사례 수를 센다 — 한 줄에 여러 사례를 둔 표 기반 테스트도 통과).

### AC-INFRA002-002: 직전 버전 태그 계산 (단위) — REQ-005

- Given 태그 목록 `v0.13.2, v0.14.0, v0.15.0, v0.16.1, v0.17.0, v0.18.0, latest, v0.19.0-rc.1`과 현재 태그 `v0.19.0`
- When 직전 태그를 계산하면
- Then `v0.18.0`이다.
- Given 현재 태그보다 작은 `vX.Y.Z` 태그가 없는 목록
- When 계산하면
- Then 빈 값이다.
- Given `v0.9.0`과 `v0.10.0`
- When `v0.11.0`의 직전 태그를 계산하면
- Then `v0.10.0`이다(문자열 비교가 아닌 숫자 비교).
- 판정: 같은 테스트 파일 종료 코드 0.

### AC-INFRA002-003: 트리거와 job 순서 (정적) — REQ-001·002

- Given `.github/workflows/release.yml`
- When actionlint와 js-yaml 단언을 실행하면
- Then 문법 오류가 없다.
  - `actionlint .github/workflows/release.yml` → 종료 코드 0, 출력 없음(설치: `brew install actionlint`, research.md §8)
- Then 트리거는 `push.tags` 하나뿐이고 값은 `v[0-9]+.[0-9]+.[0-9]+` 하나다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W a.deepStrictEqual(Object.keys(w.on),['push']);a.deepStrictEqual(Object.keys(w.on.push),['tags']);a.deepStrictEqual(w.on.push.tags,['v[0-9]+.[0-9]+.[0-9]+'])"`
- Then job은 `version-check` → `create-release` → `build` 순으로 이어지고, 버전 검사 job이 스크립트를 실행한다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W a.deepStrictEqual(Object.keys(J).sort(),['build','create-release','version-check']);a.deepStrictEqual([].concat(J['create-release'].needs),['version-check']);a.deepStrictEqual([].concat(J.build.needs),['create-release']);a.ok(S('version-check').some(s=>run(s).includes('node scripts/check-release-version.mjs')))"`

### AC-INFRA002-004: 초안 보장과 게시 금지 (정적) — REQ-003

- Given `release.yml`
- When 생성 job의 단계를 보면
- Then 릴리스 생성 API 호출 단계가 `draft=true`를 보낸다(이 값을 지우면 실패한다).
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W a.ok(S('create-release').some(s=>/gh api/.test(run(s))&&/(-F|--field) +draft=true/.test(run(s))))"`
- Then 파일 어디에도 초안 해제·프리릴리스·Latest 지정·삭제·수정 호출이 없다.
  - `grep -nE "draft[\"']?[:=] *false|draft=false|make_latest|--latest|prerelease=true|prerelease: *true|gh release (create|edit|delete|upload)|-X *(DELETE|PATCH)|--method *(DELETE|PATCH)" .github/workflows/release.yml` → 일치 0건(종료 코드 1)
- Then 빌드 job은 `tagName`이 아니라 생성 job이 넘긴 `releaseId`로 올린다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const s=S('build').find(x=>/tauri-apps\/tauri-action@/.test(x.uses||''));a.ok(s);a.ok(/needs\.create-release\.outputs/.test(String(s.with.releaseId)));a.ok(!('tagName' in s.with))"`

### AC-INFRA002-005: 기존 릴리스 보호와 본문 구성 (정적) — REQ-004·005

- Given `release.yml`과 `.github/release-notes-header.md`
- When 구조를 단언하면
- Then 생성 job에 같은 태그 릴리스를 목록에서 찾아 있으면 실패하는 단계가 생성 호출보다 앞에 있다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const s=S('create-release');const i=s.findIndex(x=>/tag_name/.test(run(x))&&/exit 1/.test(run(x)));const j=s.findIndex(x=>/draft=true/.test(run(x)));a.ok(i>=0&&i<=j)"`
- Then 빌드 job에 대상 릴리스의 `draft` 값을 조회해 아니면 실패하는 단계가 빌드 액션보다 앞에 있다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const s=S('build');const i=s.findIndex(x=>/gh api/.test(run(x))&&/\.draft/.test(run(x))&&/exit 1/.test(run(x)));const j=s.findIndex(x=>/tauri-apps\/tauri-action@/.test(x.uses||''));a.ok(i>=0&&i<j)"`
- Then 빌드 job의 셸 명령 단계(초안 확인 포함)는 모두 `bash`로 실행된다 — 단계의 `shell` 또는 job `defaults.run.shell`이 `bash`가 아니면 실패한다(Windows 기본 셸 `pwsh` 방지, 감사 N1).
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const d=((J.build.defaults||{}).run||{}).shell;const r=S('build').filter(x=>x.run);a.ok(r.some(x=>/\.draft/.test(run(x))));a.ok(r.every(x=>(x.shell||d)==='bash'))"`
- Then 생성 job이 고정 안내 블록 파일과 직전 태그로 노트를 만든다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const r=S('create-release').map(run).join('\n');a.ok(r.includes('.github/release-notes-header.md'));a.ok(r.includes('generate-notes'));a.ok(r.includes('previous_tag_name'));a.ok(/name=.*mdedit v/.test(r))"`
- Then 안내 블록 파일에 세 파일 패턴과 저장소 첫 화면(README) 링크 `https://github.com/bjw202/mdedit`가 있고, 그 주소 뒤에 `/releases`나 `#`가 붙은 링크는 하나도 없다. Releases 페이지 링크만 있거나 앵커 링크가 있으면 실패한다(파일이 없는 지금 저장소에서도 MISSING으로 실패).
  - `f=.github/release-notes-header.md; for p in '_aarch64.dmg' '-setup.exe' '.msi'; do grep -qF -- "$p" "$f" || echo "MISSING $p"; done; grep -qE 'https://github\.com/bjw202/mdedit([])>[:space:]"]|$)' "$f" || echo "MISSING README link"; grep -nE 'github\.com/bjw202/mdedit(/releases|/?#)' "$f"` → 출력 없음
- 한계: 정적 단언은 단계가 그 자리에 있고 해당 조회·`exit 1`을 담고 있음까지만 보장한다. 조건 분기가 실제로 옳은지는 코드 리뷰와 AC-014 리허설로 본다.

### AC-INFRA002-006: 행렬 (정적) — REQ-006

- Given `release.yml`
- When 빌드 job 행렬을 단언하면
- Then 항목이 정확히 2개(`macos-latest` + `--target aarch64-apple-darwin`, `windows-latest`)이고 `fail-fast: false`다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const st=J.build.strategy,m=st.matrix.include;a.strictEqual(st['fail-fast'],false);a.strictEqual(m.length,2);a.deepStrictEqual(m.map(x=>x.platform).sort(),['macos-latest','windows-latest']);a.ok(/--target aarch64-apple-darwin/.test(m.find(x=>x.platform==='macos-latest').args));a.ok(!m.find(x=>x.platform==='windows-latest').args);a.strictEqual(J.build['runs-on'],'\${{ matrix.platform }}')"`
- Then 빌드 job에 게이트 명령이 없다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const r=S('build').map(run).join('\n');a.ok(!/npm run lint|npm run typecheck|npm test|test:e2e|cargo test/.test(r))"`
- Then 빌드 job에 Linux·Intel 맥 대상이 없다(다른 job은 `ubuntu-latest`를 쓰므로 빌드 job만 본다).
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W a.ok(!/ubuntu|x86_64-apple-darwin|universal/.test(JSON.stringify(J.build)))"`

### AC-INFRA002-007: macOS ad-hoc 서명 설정 — REQ-007

- Given 수정된 `src-tauri/tauri.conf.json`과 기준 커밋의 같은 파일
- When 두 JSON을 비교하면
- Then 새 파일의 `bundle.macOS.signingIdentity`는 `"-"`이고, `bundle.macOS`를 빼면 기준 파일과 완전히 같다(지금 저장소에서는 `bundle.macOS`가 없어 실패한다).
  - `git show "$(git merge-base origin/main HEAD)":src-tauri/tauri.conf.json | node -e "const a=require('assert'),o=JSON.parse(require('fs').readFileSync(0,'utf8')),n=require('./src-tauri/tauri.conf.json');a.strictEqual(n.bundle.macOS.signingIdentity,'-');a.deepStrictEqual(Object.keys(n.bundle.macOS),['signingIdentity']);delete n.bundle.macOS;a.deepStrictEqual(n,o)"`

### AC-INFRA002-008: 권한·토큰·시크릿·동시성 (정적) — REQ-008·009·010

- Given `release.yml`
- When 단언하면
- Then 최상위 권한은 `contents: read` 하나, 생성·빌드 job은 `contents: write` 하나, 버전 검사 job은 쓰기 없음이다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W a.deepStrictEqual(w.permissions,{contents:'read'});a.deepStrictEqual(J['create-release'].permissions,{contents:'write'});a.deepStrictEqual(J.build.permissions,{contents:'write'});a.ok(!JSON.stringify(J['version-check'].permissions||{}).includes('write'))"`
- Then 쓰기 job의 체크아웃은 모두 `persist-credentials: false`다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W for(const j of ['create-release','build'])for(const s of S(j))if(/actions\/checkout@/.test(s.uses||''))a.strictEqual((s.with||{})['persist-credentials'],false)"`
- Then 토큰은 워크플로·job 단위 `env`에 없다(`secrets.*`와 `github.token` 두 형태 모두 검사, 감사 N5).
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const bad=/secrets\.|github\.token/;a.ok(!bad.test(JSON.stringify(w.env||{})));for(const j in J)a.ok(!bad.test(JSON.stringify(J[j].env||{})))"`
- Then 참조하는 시크릿은 `GITHUB_TOKEN` 하나다.
  - `grep -oE "secrets\.[A-Za-z_]+" .github/workflows/release.yml | sort -u` → 정확히 `secrets.GITHUB_TOKEN` 한 줄
- Then 동시성 그룹이 태그 참조를 담고 진행 중 취소를 하지 않는다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W a.ok(/github\.ref/.test(w.concurrency.group));a.strictEqual(w.concurrency['cancel-in-progress'],false)"`

### AC-INFRA002-009: 액션 출처·고정·Node 버전 (정적) — REQ-011

- Given `release.yml`
- When 모든 `uses:`를 모으면
- Then 허용 목록(`actions/checkout@v4`, `actions/setup-node@v4`, `tauri-apps/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f`) 밖의 것이 없고 tauri-action이 1번 이상 쓰인다. 다른 40자 SHA(태그 객체 SHA `944946e…`·`2d793bf…` 포함)는 실패한다(감사 N3).
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const u=Object.values(J).flatMap(j=>j.steps).map(s=>s.uses).filter(Boolean);a.ok(u.length>0);a.ok(u.every(x=>/^(actions\/(checkout|setup-node)@v4|tauri-apps\/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f)$/.test(x)));a.ok(u.some(x=>x.startsWith('tauri-apps/')))"`
- Then tauri-action 고정 줄마다 `# v1.0.0` 주석이 붙어 있다(js-yaml은 주석을 버리므로 원문 grep).
  - `test "$(grep -cE 'uses: *tauri-apps/tauri-action@' .github/workflows/release.yml)" -ge 1 && test "$(grep -cE 'uses: *tauri-apps/tauri-action@' .github/workflows/release.yml)" -eq "$(grep -cE 'uses: *tauri-apps/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f +# v1\.0\.0[[:space:]]*$' .github/workflows/release.yml)"` → 종료 코드 0
- Then 모든 setup-node 단계가 Node 24를 쓴다.
  - `W='const fs=require("fs"),a=require("assert"),t=fs.readFileSync(".github/workflows/release.yml","utf8"),w=require("js-yaml").load(t),J=w.jobs,S=(j)=>J[j].steps,run=(s)=>s.run||"";'; node -e "$W const n=Object.values(J).flatMap(j=>j.steps).filter(s=>/setup-node@/.test(s.uses||''));a.ok(n.length>0);a.ok(n.every(s=>String(s.with['node-version'])==='24'))"`

### AC-INFRA002-010: frontend-gates 무변경 — REQ-012

- Given 이 SPEC의 브랜치
- When `git diff --stat "$(git merge-base origin/main HEAD)" -- .github/workflows/frontend-gates.yml`을 실행하면
- Then 출력이 비어 있다(기준점은 병합 기준 커밋 — main이 그 사이 바뀌어도 거짓 차이가 나지 않는다).

### AC-INFRA002-011: 문서 (절 범위 검사) — REQ-013·014·015

- Given 수정된 `README.md`
- When `## 설치 파일 내려받기` 절만 잘라 검색하면
- Then 필요한 문구가 모두 있고 금지 문구가 없다(지금 README에는 이 절이 없어 모두 MISSING).
  - `s=$(awk '/^## 설치 파일 내려받기/{f=1;next}/^## /{f=0}f' README.md); for p in 'https://github.com/bjw202/mdedit/releases' '_aarch64.dmg' '-setup.exe' '.msi' '개인정보 보호 및 보안' '그래도 열기' 'SmartScreen'; do printf '%s' "$s" | grep -qF -- "$p" || echo "MISSING $p"; done; printf '%s' "$s" | grep -nE "xattr|\.deb|\.rpm|AppImage|x64\.dmg"` → 출력 없음
- Given 수정된 `docs/BUILD.md`
- When `## GitHub Releases로 배포하기`부터 파일 끝까지 검색하면
- Then 새 절차 문구가 있고 낡은 수동 절차가 없다(지금 파일은 `gh release create`·`v0.9.0`·`우클릭`·`xattr`이 있어 실패). 절차 문장은 다음 고정 문구로 판정한다 — 단순히 `main`을 언급하는 것으로는 통과하지 못한다(감사 N4): `main에 이미 병합된 커밋에 태그`(태그 위치), `완전히 끝난 뒤`(게시 시점, R-8 규칙), `다시 실행`(게시 후 재실행 금지), `ad-hoc`(로컬 macOS 빌드 서명 안내, 감사 N8).
  - `s=$(awk '/^## GitHub Releases로 배포하기/{f=1}f' docs/BUILD.md); for p in 'release.yml' '초안' 'main에 이미 병합된 커밋에 태그' '완전히 끝난 뒤' 'push --delete origin' '그래도 열기' '다시 실행' 'ad-hoc'; do printf '%s' "$s" | grep -qF -- "$p" || echo "MISSING $p"; done; printf '%s' "$s" | grep -nE "gh release create|v0\.9\.0|우클릭|xattr"` → 출력 없음
- Given `CHANGELOG.md`
- When `## [0.19.0]` 절과 `## [Unreleased]` 절을 보면
- Then `[0.19.0]` 절에 `SPEC-INFRA-002` 항목이 1개, `[Unreleased]` 절에는 0개다.
  - `awk '/^## \[0\.19\.0\]/{f=1;next}/^## \[/{f=0}f' CHANGELOG.md | grep -c "SPEC-INFRA-002"` → 1
  - `awk '/^## \[Unreleased\]/{f=1;next}/^## \[/{f=0}f' CHANGELOG.md | grep -c "SPEC-INFRA-002"` → 0

### AC-INFRA002-012: 회귀 없음 — 전체

- Given 변경이 끝난 트리
- When `npm test`, `npm run lint`, `npm run typecheck`를 실행하면
- Then 셋 다 종료 코드 0이고, `npm test`의 통과 테스트 수가 기준(병합 기준 커밋에서 측정한 값) + 새 테스트 수와 같다.

## 수동 수용 기준 (사용자 명시 행동 필요, 병합 후)

### AC-INFRA002-013: 실패 경로 리허설 — 불일치 차단 — REQ-002

- Given 이 SPEC이 main에 병합되어 있고, 사용자가 버림용 태그 푸시를 승인했다
- When `git tag v0.0.1 origin/main && git push origin v0.0.1`을 실행하면
- Then 릴리스 실행에서 `version-check` job이 실패하고 로그에 세 파일 경로와 값이 보이며, `create-release`·`build`는 건너뛰고(skipped), `gh release view v0.0.1`은 "release not found"다.
- 정리: `git push --delete origin v0.0.1 && git tag -d v0.0.1`.

### AC-INFRA002-014: 정상 경로 리허설 — 초안·파일·본문 — REQ-003·005·006

- Given 사용자가 `v0.19.0` 태그 푸시를 승인했고, 태그는 main에 병합된 커밋에 달린다
- When 태그를 푸시하고 실행이 끝나면
- Then 모든 job이 성공한다: `gh run list --workflow release.yml --limit 1 --json conclusion --jq '.[0].conclusion'` → `success`.
- Then 초안·이름·파일 구성이 맞다: `gh release view v0.19.0 --json isDraft,isPrerelease,name,assets --jq '[.isDraft,.isPrerelease,.name,([.assets[].name|select(endswith("_aarch64.dmg"))]|length),([.assets[].name|select(endswith("-setup.exe"))]|length),([.assets[].name|select(endswith(".msi"))]|length),([.assets[].name|select(test("\\.(deb|rpm|AppImage)$|_x64\\.dmg$"))]|length)]'` → `[true,false,"mdedit v0.19.0",1,1,1,0]`.
- Then 본문이 안내 블록으로 시작하고 노트 범위가 `v0.18.0...v0.19.0`이다: `gh release view v0.19.0 --json body --jq .body | head -1`이 `.github/release-notes-header.md` 첫 줄과 같고, `gh release view v0.19.0 --json body --jq .body | grep -c "v0.18.0...v0.19.0"` ≥ 1.
- Then CI에서 prebuild 훅이 돌지 않았다: `gh run view <run-id> --log | grep -c "\[prebuild\]"` → 0.
- 결함 시 정리: `gh release delete v0.19.0 --yes`, `git push --delete origin v0.19.0`, `git tag -d v0.19.0`, 수정 후 다시 태그.

### AC-INFRA002-015: Apple Silicon 첫 실행·서명 확인 — REQ-007·016

- Given Apple Silicon 맥에서 **브라우저로** 초안의 `_aarch64.dmg`를 내려받아 앱을 `/Applications`로 옮겼다
- When `codesign -dv --verbose=2 /Applications/mdedit.app 2>&1 | grep -E "^Signature="`와 `codesign --verify --deep --strict /Applications/mdedit.app; echo $?`를 실행하면
- Then 각각 `Signature=adhoc`과 `0`이다(v0.14.0 앱은 strict 검증이 실패했다 — research.md §6).
- When README 안내대로 앱을 열면(시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기 → 열기)
- Then mdedit 창이 열리고 "손상됨" 경고가 나오지 않는다. 다른 경고가 나오면 화면 문구를 그대로 progress.md에 기록한다.

### AC-INFRA002-016: Windows 첫 실행 — REQ-016

- Given Windows x64 PC에서 초안의 `-setup.exe`를 내려받았다
- When README의 Windows 안내대로 설치하고 실행하면
- Then mdedit 창이 열리고, SmartScreen 경고가 났다면 실제 버튼 문구가 README 안내와 같다(다르면 README를 화면 문구로 고친다).

## 품질 게이트

- 자동 AC 001~012 전부 PASS가 run 단계 완료 조건이다.
- 수동 AC 013~016은 병합 뒤 사용자 행동으로 판정하며, sync 단계에서 결과(또는 미실행 Gap)를 progress.md에 기록한다.
- 스크립트 커버리지 목표 85%(quality.yaml). 커버리지 도구가 없으면 Gap으로 보고한다.

## Definition of Done

- [ ] 자동 AC 12건 PASS, 명령 출력이 progress.md §E.2에 남음
- [ ] `actionlint` 출력 없음
- [ ] 수동 AC 4건의 실행 여부와 결과가 기록됨(미실행이면 Gap 명시)
