# MdEdit

타우리(Tauri) v2 + React 18 기반 크로스 플랫폼 마크다운 에디터 데스크톱 앱

**상태**: MVP — 핵심 기능 구현 완료, 사용자 테스트 준비됨

---

## 주요 기능

- **마크다운 에디터**: CodeMirror 6 기반 구문 강조
- **실시간 미리보기**: markdown-it + 300ms 디바운스로 쾌적한 성능
- **Mermaid 다이어그램 지원**: 순서도, 시퀀스 다이어그램, 클래스 다이어그램 등
- **코드 블록 구문 강조**: Shiki 기반 200+ 언어 지원
- **파일 탐색기**:
  - 폴더 열기 및 파일 시스템 탐색
  - 파일 생성/삭제/이름 변경
  - 하위 폴더 클릭으로 탐색, 상위 폴더 이동(`..`) 지원
  - 헤더의 위로 이동(↑) 버튼
  - 디렉토리 내용 동기화 새로고침 버튼
  - 파일 검색/필터링 기능
- **크기 조절 가능한 패널**: 사이드바, 에디터, 미리보기 자유롭게 조정
- **다크/라이트 테마**: 시스템 설정 자동 연동
- **크로스 플랫폼**: macOS, Windows, Linux 지원
- **헤더 파일 작업 버튼**:
  - 새 파일 생성 (Ctrl+N)
  - 저장 (Ctrl+S)
  - 다른 이름으로 저장 (Ctrl+Shift+S)
- **현재 파일명 표시**: 제목 표시줄에 파일명과 미저장 상태(● 표시)
- **에디터-미리보기 스크롤 동기화**: 편집 시 미리보기 자동 스크롤
- **저장 상태 표시**: 저장됨/저장 안 됨/저장 중 상태 시각화
- **실시간 통계**: 단어 수 및 글자 수 실시간 표시
- **에디터 툴바**:
  - 굵게, 이탤릭, 제목(H1-H3) 삽입
  - 코드, 링크, 목록, 인용문 빠른 삽입
- **키보드 단축키**: Ctrl+S (저장), Ctrl+Shift+S (다른 이름으로 저장), Ctrl+N (새 파일)
- **미저장 변경 사항 경고**: 미저장 데이터가 있을 때 파일 열기 전 경고 다이얼로그

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 18, TypeScript 5, Vite |
| 에디터 | CodeMirror 6 |
| 미리보기 | markdown-it 14, Shiki 3, Mermaid 11 |
| 상태 관리 | Zustand 5 |
| 백엔드 | Rust (Tauri v2) |
| 테스트 | Vitest + Testing Library |

---

## 빠른 시작

### 개발 환경 설정

```bash
git clone https://github.com/bjw202/mdedit.git
cd mdedit
npm install
```

### 개발 서버 실행

```bash
npm run tauri dev
```

최초 실행 시 Rust 의존성 컴파일에 5~10분이 소요됩니다.

### 테스트 실행

```bash
# 프론트엔드 테스트 (Vitest)
npm run test

# Rust 테스트
cd src-tauri && cargo test
```

### 배포 파일 빌드

```bash
npm run tauri build
```

---

## macOS에서 배포 파일 빌드하기

### 사전 요구사항

#### 1. Xcode Command Line Tools (필수)

터미널을 열고 다음 명령어를 실행합니다:

```bash
xcode-select --install
```

이미 설치된 경우 건너뜁니다.

#### 2. Node.js 20 이상

**방법 1**: [nodejs.org](https://nodejs.org)에서 macOS용 LTS 버전 `.pkg` 파일 다운로드 후 설치

**방법 2**: Homebrew 사용

```bash
brew install node
```

버전 확인:

```bash
node --version
```

#### 3. Rust (rustup)

터미널에서 다음을 실행합니다:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

완료 후 새 터미널 창을 열거나 다음을 실행합니다:

```bash
source ~/.cargo/env
```

버전 확인:

```bash
rustc --version
```

Rust 버전은 1.77.2 이상이어야 합니다.

#### 4. Homebrew (선택 사항)

Node.js를 Homebrew로 설치하려면 먼저 Homebrew를 설치합니다:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 프로젝트 설정

1. 저장소 클론:

```bash
git clone https://github.com/bjw202/mdedit.git
cd mdedit
```

2. 의존성 설치:

```bash
npm install
```

### 개발 서버 실행

```bash
npm run tauri dev
```

최초 실행 시 Rust 의존성을 컴파일하므로 5~10분이 소요됩니다.

### 배포 파일 빌드

```bash
npm run tauri build
```

빌드 완료 후:

- **설치 파일 (.dmg)**: `src-tauri/target/release/bundle/dmg/`
- **.app 번들**: `src-tauri/target/release/bundle/macos/`

생성된 `.dmg` 파일을 열어 애플리케이션을 설치합니다.

### 자주 발생하는 문제

**문제**: `xcode-select: error: tool 'xcode-select' not found`

**해결**: 다음을 다시 실행합니다:

```bash
xcode-select --install
```

---

**문제**: Rust 컴파일 오류 (`error: linker 'cc' not found` 등)

**해결**: Rust를 최신 버전으로 업데이트합니다:

```bash
rustup update stable
```

그 후 빌드를 재시도합니다.

---

**문제**: npm 오류 (`ERR! code EACCES` 등)

**해결**: 모듈과 캐시를 초기화하고 재설치합니다:

```bash
rm -rf node_modules package-lock.json
npm install
```

---

**문제**: Apple Silicon (M1/M2)에서의 호환성

기본 설정으로 네이티브 ARM64 바이너리가 빌드됩니다. 추가 설정이 필요하지 않습니다.

---

## Windows에서 배포 파일 빌드하기

### 사전 요구사항

#### 1. Node.js 20 이상

1. [nodejs.org](https://nodejs.org)에서 Windows용 LTS 버전 다운로드
2. 설치 중 **"Add to PATH" 옵션 반드시 체크**
3. 설치 후 PowerShell 또는 CMD 재시작

버전 확인:

```powershell
node --version
```

#### 2. Rust (rustup)

1. [rustup.rs](https://rustup.rs)에서 `rustup-init.exe` 다운로드 및 실행
2. 설치 중 Enter 키로 기본 설정 선택
3. 설치 후 PowerShell 재시작

버전 확인:

```powershell
rustc --version
```

Rust 버전은 1.77.2 이상이어야 합니다.

#### 3. Visual Studio Build Tools 2022 (필수)

이 도구는 Rust에서 C++ 네이티브 코드 컴파일에 필수입니다.

1. [Visual Studio 다운로드](https://visualstudio.microsoft.com)에서 "Visual Studio 2022용 빌드 도구" 검색
2. 설치 파일 다운로드 및 실행
3. 설치 관리자에서 다음 항목 확인:
   - **"C++를 사용한 데스크톱 개발"** 워크로드 선택
   - MSVC v143 컴파일러 포함 (자동 선택)
   - Windows SDK 최신 버전 포함 (자동 선택)
4. 설치 완료 후 **컴퓨터 재시작**

#### 4. WebView2 Runtime

Windows 10/11에는 기본으로 포함되어 있습니다. 미설치 시:

1. Microsoft 공식 사이트에서 "WebView2 Runtime" 검색
2. "Evergreen Bootstrapper" 버전 다운로드 및 설치

#### 5. Git (선택 사항)

저장소 클론을 위해 필요합니다. [git-scm.com](https://git-scm.com)에서 다운로드

### 프로젝트 설정

1. 저장소 클론:

```bash
git clone https://github.com/bjw202/mdedit.git
cd mdedit
```

2. 의존성 설치:

```bash
npm install
```

### 개발 서버 실행

PowerShell 또는 CMD를 열고:

```powershell
npm run tauri dev
```

최초 실행 시 Rust 의존성을 컴파일하므로 5~10분이 소요됩니다.

### 배포 파일 빌드

```powershell
npm run tauri build
```

빌드 완료 후:

- **설치 파일 (.msi)**: `src-tauri\target\release\bundle\msi\`
- **독립 실행 파일 (.exe)**: `src-tauri\target\release\MdEdit.exe`

생성된 `.msi` 파일을 실행하여 애플리케이션을 설치합니다.

### 자주 발생하는 문제

**문제**: `error: linker 'link.exe' not found`

**해결**: Visual Studio Build Tools 2022가 설치되지 않았거나 C++ 워크로드가 누락되었습니다. 설치 관리자를 다시 열고 "C++를 사용한 데스크톱 개발" 워크로드를 추가합니다. 설치 후 컴퓨터를 재시작합니다.

---

**문제**: WebView2 관련 오류 (`error: no file named` 등)

**해결**: WebView2 Runtime을 설치합니다:

1. Microsoft 공식 사이트에서 "WebView2 Runtime" 다운로드
2. Evergreen Bootstrapper 설치
3. 앱 재실행

---

**문제**: npm 또는 의존성 오류

**해결**: 캐시를 초기화하고 재설치합니다:

```powershell
npm cache clean --force
rm -r node_modules
npm install
```

---

**문제**: Rust 컴파일 오류

**해결**: Rust를 최신 버전으로 업데이트합니다:

```powershell
rustup update stable
```

그 후 빌드를 재시도합니다.

---

**문제**: 경로에 공백 포함

Windows 경로에 공백이 있으면 문제가 발생할 수 있습니다.

**해결**: 공백 없는 경로에 프로젝트를 설치합니다. 예: `C:\Projects\mdedit`

---

**문제**: 첫 빌드가 매우 느림

이는 정상입니다. Rust는 최초 빌드 시 약 200개의 의존성을 컴파일합니다. 이후 빌드는 훨씬 빠릅니다.

---

## 프로젝트 구조

```
markdown-editor-rust/
├── src/                     # React 프론트엔드
│   ├── components/
│   │   ├── editor/          # MarkdownEditor, EditorToolbar
│   │   ├── layout/          # AppLayout, Header, Footer, ResizablePanels
│   │   ├── preview/         # MarkdownPreview, PreviewRenderer
│   │   └── sidebar/         # FileExplorer, FileTree, FileTreeNode, FileSearch
│   ├── hooks/               # useFileSystem, useTheme, useScrollSync
│   ├── lib/tauri/           # IPC 래퍼
│   ├── store/               # fileStore, uiStore
│   ├── test/                # 컴포넌트 및 통합 테스트
│   └── types/               # TypeScript 타입 정의
└── src-tauri/               # Rust 백엔드
    └── src/
        ├── commands/        # directory_ops, file_ops, watcher
        └── models/          # file_node
```

---

## 아키텍처

MdEdit는 Tauri v2 아키텍처를 사용합니다.

### 백엔드 (Rust)

Rust 백엔드는 다음을 담당합니다:

- **파일 시스템 작업**: 경로 순회 방지 및 적절한 오류 처리를 포함한 모든 파일 시스템 작업
- **보안**: 사용자 입력 검증 및 경로 정규화
- **성능**: 비동기 I/O 및 메모리 효율성

### 프론트엔드 (React)

React 프론트엔드는 다음을 담당합니다:

- **UI 상태 관리**: Zustand를 사용한 중앙화된 상태 관리
- **에디터 렌더링**: CodeMirror 6 기반 마크다운 편집
- **미리보기 렌더링**: markdown-it로 Markdown을 HTML로 변환, Shiki로 코드 블록 강조, Mermaid로 다이어그램 렌더링
- **파일 탐색**: 트리 구조 기반 파일 시스템 네비게이션

### IPC 레이어

타우리 IPC 레이어는 다음을 수행합니다:

- 프론트엔드와 Rust 커맨드를 연결
- 타입 안전 래퍼를 통해 통신
- 비동기 처리 및 오류 처리

### 주요 설계 결정

**FileNode 직렬화**: `FileNode`는 TypeScript 인터페이스와 맞추기 위해 `camelCase`로 직렬화됩니다. Rust 구조체에 `#[serde(rename_all = "camelCase")]` 속성을 사용합니다.

**파일 감시기**: `startWatch` 커맨드는 비차단 방식입니다. 감시기 실패가 파일 탐색을 방해하지 않으므로 사용자 경험에 영향을 주지 않습니다.

**XSS 방지**: 미리보기 렌더링에서 `html: false` 설정을 사용하여 인라인 HTML을 비활성화하고 XSS 공격을 방지합니다.

---

## 성능 목표

| 지표 | 목표 |
|------|------|
| 시작 시간 | 500ms 미만 |
| 유휴 메모리 사용량 | 80MB 미만 |
| 바이너리 크기 | 15MB 미만 |
| 미리보기 렌더링 | 300ms 디바운스 |

---

## 라이선스

MIT
