# SPEC-PREVIEW-005 — 수용 기준

> development_mode = tdd. 모든 시나리오는 vitest + @testing-library/react로 검증 가능해야 한다(GREEN 단계 대상). 라우팅(A)·폴백(B) 회귀 차단이 must-pass 기준이다.

## 사전 준비

- 코드 파일 경로 픽스처: `notes.py`, `app.ts`, `config.json`, `data.yaml`, `data.jsonl`, `Cargo-like.toml`, `script.sh`, `style.css`.
- 비코드 경로 픽스처: `readme.md`(마크다운), `index.html`(HTML), `archive.xyz`(미지원 확장자), 확장자 없는 파일.
- 에디터 버퍼/스토어 mock: `useEditorStore.content`, `useFileStore.currentFile`, `useUIStore.theme`.
- Shiki 하이라이터는 `getHighlighter()`를 통해 주입되며, 테스트에서는 mock 또는 실제 싱글톤으로 `codeToHtml(code, { lang, theme })` 출력을 검증한다.

---

## 기능 시나리오

### 시나리오 A: 코드 파일 라우팅 분기 (REQ-PREVIEW005-001, 005-002) — must-pass

- **Given** 파일 경로 `notes.py` / `config.json` / `data.yaml` / `app.ts`가 주어지고
- **When** `getFileViewType(path)`를 호출하면
- **Then** 각각 `'code'`를 반환하고
- **And** `index.html`은 `'html'`, `readme.md`와 확장자 없는 파일은 `'markdown'`을 반환하고
- **And** `PreviewContainer`가 `'code'` 경로에서 `CodeFileViewer`를 렌더한다(`MarkdownPreview`/`HtmlFileViewer` 미렌더).

### 시나리오 B: 미지원 확장자 폴백 — 회귀 차단 (REQ-PREVIEW005-005) — must-pass

- **Given** 파일 경로 `archive.xyz`(코드 매핑에 없음)가 주어지고
- **When** `getFileViewType(path)`를 호출한 뒤 `PreviewContainer`를 렌더하면
- **Then** `'markdown'`을 반환하여 `MarkdownPreview`가 렌더되고 `CodeFileViewer`는 렌더되지 않고
- **And** `index.html`(`'html'`)·`readme.md`(`'markdown'`)의 기존 라우팅 동작이 변경 없이 유지된다.

### 시나리오 C: Shiki 구문 강조 출력 렌더 (REQ-PREVIEW005-002, 005-003)

- **Given** 코드 파일 `notes.py`가 선택되어 에디터 버퍼에 `print("hi")`가 적재되어 있고(매핑 lang = python)
- **When** `CodeFileViewer`가 마운트되고 디바운스(300ms)가 경과하면
- **Then** Shiki가 생성한 강조 HTML(`<pre class="shiki">…</pre>` 및 토큰 `<span>`)이 DOM에 표시된다.

### 시나리오 D: 테마 전환 시 재강조 (REQ-PREVIEW005-004)

- **Given** `CodeFileViewer`가 라이트 테마(`github-light`)로 렌더된 상태이고
- **When** `useUIStore.theme`이 dark로 전환되어 `document.documentElement`에 `dark` 클래스가 적용되면
- **Then** 출력이 `github-dark` 테마로 재강조된 HTML로 갱신된다.

### 시나리오 E: 미로드/미지원 언어 안전 폴백 (REQ-PREVIEW005-005)

- **Given** 확장자가 매핑에는 있으나 Shiki 싱글톤에 해당 언어가 로드되어 있지 않은 상황(또는 강조 중 오류 발생)이고
- **When** 사용자가 그 파일을 코드 보기로 열면
- **Then** 앱이 중단되지 않고 plaintext 폴백 또는 안전한 표시로 처리되어 파일 내용이 손실 없이 보인다.

---

## 엣지 케이스

- 대문자 확장자(`NOTES.PY`, `CONFIG.JSON`): 소문자 비교로 `.py`/`.json`과 동일하게 `'code'` 라우팅된다.
- 빈 파일 / 0바이트 코드 파일: 빈 강조 영역이 표시되고 오류로 처리되지 않는다.
- `.jsonl`(멀티라인 JSON): `json` lang으로 강조되어 표시된다(라인 단위 정밀 토큰화는 비범위).
- 코드 보기 ↔ 마크다운 빠른 반복 전환: 매 전환마다 올바른 뷰어가 렌더되고 강조가 정상 동작한다.

---

## 품질 게이트 / Definition of Done

- [ ] 기능 시나리오 A·B 통과 (**must-pass — 라우팅/폴백 회귀 차단**)
- [ ] 기능 시나리오 C·D·E 통과
- [ ] 엣지 케이스 4건 확인
- [ ] 프런트엔드 타입체크 및 vitest 테스트 통과 (development_mode = tdd, RED 우선)
- [ ] 신규 npm 의존성 0 확인 (`package.json` 변경 없음)
- [ ] `.html`(SPEC-PREVIEW-004)·마크다운 렌더(SPEC-PREVIEW-001/002/003) 회귀 없음
- [ ] MX 태그 부착 완료 (plan.md Phase 5)
