# mdedit

Tauri v2 + React 18 + CodeMirror 6 기반 크로스 플랫폼 마크다운 에디터 데스크톱 앱.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg) ![Tauri](https://img.shields.io/badge/Tauri-v2-blue) ![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

로컬에서 빠르게 켜지는 데스크톱 마크다운 편집기입니다. 실시간 미리보기, 다양한 파일 뷰어, 그리고 로컬 Claude Code CLI로 동작하는 AI 편집 기능을 제공합니다.

> 전체 사용법은 [사용자 가이드(docs/USER_GUIDE.md)](docs/USER_GUIDE.md)를 참고하세요.

---

## 주요 기능

- **마크다운 편집 + 실시간 미리보기**: CodeMirror 6 편집, markdown-it 렌더링(약 300ms 디바운스), KaTeX 수식, Mermaid 다이어그램(라이트/다크 테마 연동), Shiki 코드 강조
- **AI 어시스턴트** (아래 [AI 기능](#ai-기능) 참고): ✨ 선택 툴바 6종 프리셋, 이어쓰기, 섹션 채우기 — 로컬 **Claude Code CLI** 또는 **codex CLI** 중 설치된 것으로 자동 동작
- **서식 툴바**: 굵게·이탤릭·제목·목록·코드·링크·인용, 8×8 그리드 표 삽입 피커, 이미지 삽입
- **다양한 파일 뷰어**: 마크다운, HTML, 이미지, SVG, 코드/설정 파일, 평문 등 확장자별 자동 라우팅([지원 형식](#지원-파일-형식) 참고)
- **뷰 모드 토글**: 편집 / 분할 / 미리보기 (상태 영속)
- **파일 탐색기**: 폴더 열기, 생성·삭제·이름 변경, 상·하위 탐색, 검색
- **내보내기**: HTML / PDF / DOCX
- **테마·글꼴**: 라이트/다크 자동 연동, 글꼴 크기 조절
- **크로스 플랫폼**: macOS, Windows, Linux
- **크기 조절 패널**: 사이드바·에디터·미리보기 폭 자유 조정

---

## AI 기능

mdedit의 AI는 로컬에 설치된 **Claude Code CLI(`claude`)** 또는 **codex CLI(`codex`)** 를 통해 동작합니다. 두 CLI 중 하나라도 설치·로그인되어 있으면 AI 기능을 바로 쓸 수 있습니다. 앱 자체 서버는 없으며, 문서 내용은 로컬 CLI 프로세스를 거쳐서만 처리됩니다(요청당 CLI 프로세스 1개, 동시 1개 요청).

- **✨ 선택 툴바**: 텍스트를 선택하면 나타나는 ✨ 버튼으로 프리셋 실행 — 🖊 다듬기 · 📋 개요로 정리 · 📊 표로 만들기 · 🧜 다이어그램으로 · ✂️ 짧게 줄이기 · ✏️ 직접 입력. 결과는 실시간 스트리밍 제안 카드로 보여지고 **바꾸기 / 아래 삽입**, Cmd/Ctrl+Z 1회 복원, ↻ 재요청을 지원합니다.
- **이어쓰기**: 문서 끝 또는 자유 위치에서 Cmd/Ctrl+Enter(또는 힌트)로 문체를 이어받아 계속 씁니다. 회색 고스트로 미리 보고 확정합니다.
- **섹션 채우기**: 빈 헤딩 아래 빈 줄에서 Cmd/Ctrl+Enter로 섹션 내용을 생성합니다.

사전 조건: 아래 둘 중 하나를 설치·로그인합니다.

- [Claude Code CLI](https://claude.com/product/claude-code) — `npm install -g @anthropic-ai/claude-code`
- [codex CLI](https://github.com/openai/codex) — `npm install -g @openai/codex`

둘 다 설치된 경우 **claude가 우선**으로 자동 선택되며, 설정(헤더 톱니)에서 수동으로 provider를 지정할 수도 있습니다. 아무 것도 없으면 온보딩이 안내합니다. 조직 정책으로 끄려면 `MDEDIT_AI_DISABLED=1` 환경 변수 또는 정책 파일을 사용하세요.

각 기능의 단계별 사용법, 제안 카드 조작, 대기·타임아웃 동작, 유즈케이스는 [사용자 가이드](docs/USER_GUIDE.md#4-ai-어시스턴트)에 정리되어 있습니다.

---

## 지원 파일 형식

| 확장자 | 열리는 방식 |
| --- | --- |
| `.md`, `.markdown` | 마크다운 편집 + 실시간 미리보기 |
| `.html` | 샌드박스 iframe 보기 전용 렌더링 |
| `.png` `.jpg` `.jpeg` `.gif` `.webp` `.bmp` `.ico` `.avif` | 이미지 뷰어(zoom/pan, 메타 표시) |
| `.svg` | SVG 뷰어(렌더 ↔ 소스 토글, DOMPurify 정화) |
| `.py` `.js` `.mjs` `.cjs` `.ts` `.json` `.jsonl` `.yaml` `.yml` `.toml` `.sh` `.bash` `.css` | 코드 뷰어(Shiki 구문 강조) |
| 기타 텍스트 파일 | 평문 표시 + 편집 가능 |
| 바이너리·읽기 불가 / 100MB 초과 | "미리보기 불가" / "미리보기 건너뜀" 플레이스홀더 |

---

## 빠른 시작 (개발 환경)

필수 도구: **Node.js 20+**, **Rust 1.77.2+**, 플랫폼별 빌드 도구(macOS: Xcode CLT / Windows: VS Build Tools 2022 + C++ 워크로드 / Linux: webkit2gtk 등).

```bash
git clone https://github.com/bjw202/mdedit.git
cd markdown-editor-rust
npm install
npm run dev          # 개발 실행 (최초 Rust 컴파일 5~10분)
```

### 배포 빌드

```bash
npm run build
```

빌드 결과물:

- macOS: `src-tauri/target/release/bundle/dmg/*.dmg`
- Windows: `src-tauri/target/release/bundle/nsis/*-setup.exe`, `.../msi/*.msi`
- Linux: `.../deb/*.deb`, `.../rpm/*.rpm`, `.../appimage/*.AppImage`

### 테스트

```bash
npm run test          # 프론트엔드 단위 테스트 (Vitest)
npm run typecheck     # 타입 체크 (tsc --noEmit)
npm run test:e2e      # E2E (Playwright)
cd src-tauri && cargo test   # Rust 테스트
```

> 플랫폼별 사전 요구사항 설치와 상세 빌드·배포 절차, 트러블슈팅·오류 패턴 표는 [docs/BUILD.md](docs/BUILD.md)를 참고하세요.

---

## 기술 스택

| 레이어 | 기술 |
| --- | --- |
| 프론트엔드 | React 18, TypeScript 5, Vite 5 |
| 에디터 | CodeMirror 6 |
| 미리보기 | markdown-it 14, Shiki 3, Mermaid 11.12.3, KaTeX |
| 상태 관리 | Zustand 5 |
| 백엔드 | Rust (Tauri v2) |
| 테스트 | Vitest, Testing Library, Playwright |

---

## 아키텍처 (요약)

Tauri v2 구조로, Rust 백엔드가 파일 시스템 작업·경로 검증·비동기 I/O를 담당하고 React 프론트엔드가 편집·미리보기·상태 관리를 담당합니다. 둘은 타입 안전 IPC 래퍼로 통신합니다. 미리보기는 `html: false`로 인라인 HTML을 비활성화해 XSS를 방지합니다.

```
markdown-editor-rust/
├── src/                 # React 프론트엔드
│   ├── components/      # editor, layout, preview, sidebar, settings
│   ├── hooks/           # useFileSystem, useTheme, useScrollSync ...
│   ├── lib/             # tauri IPC, markdown, preview, ai
│   └── store/           # fileStore, uiStore, aiStore
└── src-tauri/           # Rust 백엔드 (commands, models)
```

---

## 라이선스

MIT
