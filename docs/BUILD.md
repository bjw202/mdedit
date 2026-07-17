# mdedit 빌드 가이드

플랫폼별 배포 파일 빌드 절차, 사전 요구사항, 트러블슈팅을 정리한 문서입니다. 앱 사용법은 [사용자 가이드(USER_GUIDE.md)](./USER_GUIDE.md)를, 빠른 개발 실행은 저장소 [README](../README.md)를 참고하세요.

---

## 목차

- [AI 에이전트 자동 빌드 가이드](#ai-에이전트-자동-빌드-가이드)
- [macOS에서 배포 파일 빌드하기](#macos에서-배포-파일-빌드하기)
- [Windows에서 배포 파일 빌드하기](#windows에서-배포-파일-빌드하기)
- [Linux에서 배포 파일 빌드하기](#linux에서-배포-파일-빌드하기)
- [GitHub Releases로 배포하기](#github-releases로-배포하기)

---

## AI 에이전트 자동 빌드 가이드

> **AI 에이전트(Claude Code 등)를 위한 섹션**입니다. 이 섹션의 명령어를 순서대로 실행하면 현재 시스템을 자동으로 감지하여 의존성을 설치하고 배포 파일을 빌드할 수 있습니다. 사람도 이 섹션만 따라도 빌드할 수 있습니다.

### 프로젝트 메타데이터

```yaml
name: mdedit
version: 0.9.0
type: desktop-app (Tauri v2 cross-platform)
languages:
  backend: Rust (>= 1.77.2)
  frontend: TypeScript + React 18
package_manager: npm
commands:
  install: npm install
  dev: npm run dev
  build: npm run build        # 배포 패키지 생성
  test: npm run test          # 프론트엔드 테스트 (Vitest)
  test_rust: cd src-tauri && cargo test
build_output:
  macOS: src-tauri/target/release/bundle/dmg/*.dmg
  windows_nsis: src-tauri/target/release/bundle/nsis/*-setup.exe
  windows_msi: src-tauri/target/release/bundle/msi/*.msi
  linux_deb: src-tauri/target/release/bundle/deb/*.deb
  linux_rpm: src-tauri/target/release/bundle/rpm/*.rpm
  linux_appimage: src-tauri/target/release/bundle/appimage/*.AppImage
first_build_time: 5-10 minutes (Rust dependency compilation)
```

### 단계 1: OS 감지

```bash
uname -s 2>/dev/null || echo "Windows"
```

| 출력값 | OS |
| --- | --- |
| `Darwin` | macOS |
| `Linux` | Linux |
| `Windows` 또는 명령 없음 | Windows |

### 단계 2: 필수 도구 확인 및 설치

각 도구를 확인하고 없으면 설치합니다.

#### Node.js (버전 20 이상 필요)

```bash
# 버전 확인
node --version
# 기대 출력: v20.x.x 이상
```

버전이 낮거나 설치되지 않은 경우:

```bash
# macOS (Homebrew)
brew install node

# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs

# Linux (Fedora/RHEL)
sudo dnf install -y nodejs

# Windows: https://nodejs.org 에서 LTS 다운로드 ("Add to PATH" 옵션 체크 필수)
```

#### Rust (버전 1.77.2 이상 필요)

```bash
# 버전 확인
rustc --version
# 기대 출력: rustc 1.77.2 이상
```

설치되지 않은 경우:

```bash
# macOS / Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env   # 또는 새 터미널 열기

# Windows: https://rustup.rs 에서 rustup-init.exe 다운로드 후 실행
```

#### macOS 전용: Xcode Command Line Tools

```bash
# 설치 여부 확인
xcode-select --print-path
# 기대 출력: /Library/Developer/CommandLineTools (경로가 없으면 미설치)

# 미설치 시
xcode-select --install
```

#### Windows 전용: Visual Studio Build Tools

```powershell
# link.exe 존재 여부 확인 (설치되어 있으면 경로 출력)
where.exe link.exe
```

없으면: Visual Studio 2022용 빌드 도구 설치 → "C++를 사용한 데스크톱 개발" 워크로드 선택 → 설치 후 재시작

#### Linux 전용: 시스템 의존성

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf build-essential libssl-dev libayatana-appindicator3-dev

# Fedora/RHEL
sudo dnf install -y \
  webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel
```

### 단계 3: 의존성 설치

```bash
npm install
# 완료 확인: node_modules/ 디렉토리 생성됨
```

### 단계 4: 배포 파일 빌드

```bash
npm run build
# 최초 빌드: 5~10분 소요 (Rust 의존성 200여 개 컴파일)
# 이후 빌드: 1~2분
```

### 단계 5: 빌드 결과물 확인

```bash
# macOS
ls src-tauri/target/release/bundle/dmg/ 2>/dev/null || echo "빌드 결과물 없음"

# Linux
ls src-tauri/target/release/bundle/deb/ 2>/dev/null || echo "빌드 결과물 없음"
ls src-tauri/target/release/bundle/appimage/ 2>/dev/null || echo "빌드 결과물 없음"
```

```powershell
# Windows PowerShell
Get-ChildItem src-tauri\target\release\bundle\nsis\
Get-ChildItem src-tauri\target\release\bundle\msi\
```

### 오류 패턴 및 해결 방법

AI 에이전트가 빌드 오류를 만났을 때 참조하는 테이블입니다.

| 오류 메시지 (포함 여부로 판단) | 원인 | 해결 명령어 |
| --- | --- | --- |
| `linker 'cc' not found` | macOS: Xcode CLT 미설치 | `xcode-select --install` |
| `linker 'link.exe' not found` | Windows: VS Build Tools 미설치 | VS Build Tools 2022 + C++ 워크로드 설치 |
| `cannot find -lwebkit2gtk` | Linux: 시스템 의존성 누락 | 위 apt/dnf 명령 실행 |
| `rustc: command not found` | Rust 미설치 | `curl ... rustup.rs | sh` |
| `node: command not found` | Node.js 미설치 | Node.js 20+ 설치 |
| `ERR! code EACCES` | npm 권한 오류 | `rm -rf node_modules && npm install` |
| `error[E0...]: use of undeclared` | Rust 버전 낮음 | `rustup update stable` |
| `Cannot find module` | node_modules 손상 | `rm -rf node_modules && npm install` |

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
cd markdown-editor-rust
```

2. 의존성 설치:

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

최초 실행 시 Rust 의존성을 컴파일하므로 5\~10분이 소요됩니다.

### 배포 파일 빌드

```bash
npm run build
```

빌드 완료 후:

- **설치 파일 (.dmg)**: `src-tauri/target/release/bundle/dmg/`
- **.app 번들**: `src-tauri/target/release/bundle/macos/`

생성된 `.dmg` 파일을 열어 애플리케이션을 설치합니다.

### Universal Binary (Apple Silicon + Intel) 빌드

Apple Silicon (M1/M2/M3)과 Intel 맥에서 모두 실행되는 Universal Binary를 만들려면:

```bash
# 두 가지 아키텍처 타겟 설치
rustup target add aarch64-apple-darwin x86_64-apple-darwin

# Universal binary 빌드
npm run build -- --target universal-apple-darwin
```

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
cd markdown-editor-rust
```

2. 의존성 설치:

```bash
npm install
```

### 개발 서버 실행

PowerShell 또는 CMD를 열고:

```powershell
npm run dev
```

최초 실행 시 Rust 의존성을 컴파일하므로 5\~10분이 소요됩니다.

### 배포 파일 빌드

```powershell
npm run build
```

빌드 완료 후 Tauri v2는 두 가지 설치 형식을 생성합니다:

- **NSIS Installer (.exe)**: `src-tauri\target\release\bundle\nsis\` (권장 - 더 간단한 설치 경험)
- **MSI Installer (.msi)**: `src-tauri\target\release\bundle\msi\` (엔터프라이즈 배포용)

일반 사용자는 NSIS `.exe` 설치 파일을 사용하세요. MSI는 엔터프라이즈 환경이나 정책 배포가 필요할 때 사용합니다.

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

**문제**: `git pull` 후 빌드 시 이전 버전 캐시와 충돌

기존에 빌드한 프로젝트에서 `git pull`로 최신 코드를 받은 뒤 `npm run build`를 실행하면, Rust의 이전 컴파일 캐시와 새 코드가 충돌하여 빌드가 실패하거나 이전 버전 바이너리가 생성될 수 있습니다.

**해결**: Rust 컴파일 캐시를 초기화한 뒤 빌드합니다:

```powershell
cd src-tauri
cargo clean
cd ..
npm run build
```

`cargo clean`은 `src-tauri/target/` 디렉토리를 삭제하여 Rust 의존성을 처음부터 다시 컴파일합니다. 이 때문에 빌드 시간이 최초 빌드와 동일하게 5\~10분 소요됩니다.

---

## Linux에서 배포 파일 빌드하기

### 사전 요구사항

#### 1. Node.js 20 이상

**Ubuntu/Debian**:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Fedora/RHEL**:

```bash
sudo dnf install -y nodejs
```

버전 확인:

```bash
node --version
```

#### 2. Rust (rustup)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

버전 확인:

```bash
rustc --version
```

#### 3. 시스템 의존성

**Ubuntu/Debian**:

```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev
```

**Fedora/RHEL**:

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

### 프로젝트 설정

```bash
git clone https://github.com/bjw202/mdedit.git
cd markdown-editor-rust
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

### 배포 파일 빌드

```bash
npm run build
```

빌드 완료 후:

- **Debian/Ubuntu**: `src-tauri/target/release/bundle/deb/*.deb`
- **Fedora/RHEL**: `src-tauri/target/release/bundle/rpm/*.rpm`
- **범용 AppImage**: `src-tauri/target/release/bundle/appimage/*.AppImage`

---

## GitHub Releases로 배포하기

빌드한 패키지를 GitHub Releases를 통해 배포하면 사용자가 GitHub에서 직접 다운로드할 수 있습니다.

### 1단계: 릴리즈 파일 준비

각 플랫폼에서 빌드 후 생성된 파일:

| 플랫폼 | 파일 위치 | 설명 |
| --- | --- | --- |
| macOS | `src-tauri/target/release/bundle/dmg/*.dmg` | 디스크 이미지 (권장) |
| Windows | `src-tauri\target\release\bundle\nsis\*.exe` | NSIS 설치 파일 (권장) |
| Windows | `src-tauri\target\release\bundle\msi\*.msi` | MSI 설치 파일 |
| Linux | `src-tauri/target/release/bundle/deb/*.deb` | Debian/Ubuntu |
| Linux | `src-tauri/target/release/bundle/rpm/*.rpm` | Fedora/RHEL |

### 2단계: GitHub Release 생성 (gh CLI 사용)

gh CLI가 설치되어 있다면:

```bash
# 버전 태그 생성
git tag v0.9.0
git push origin v0.9.0

# GitHub Release 생성 및 파일 업로드
gh release create v0.9.0 \
  "src-tauri/target/release/bundle/dmg/mdedit_0.9.0_x64.dmg" \
  "src-tauri/target/release/bundle/nsis/mdedit_0.9.0_x64-setup.exe" \
  --title "mdedit v0.9.0" \
  --notes "릴리즈 노트"
```

### 3단계: GitHub Release 수동 생성

1. GitHub 저장소 페이지에서 **Releases** 클릭
2. **Create a new release** 클릭
3. Tag: `v0.9.0` 입력 및 생성
4. Title: `mdedit v0.9.0` 입력
5. 빌드된 파일을 드래그 앤 드롭으로 첨부
6. **Publish release** 클릭

### macOS 설치 (Gatekeeper 보안)

코드 서명이 없는 배포의 경우, macOS의 Gatekeeper가 앱 실행을 차단할 수 있습니다. 다음 방법 중 하나를 사용하세요.

**방법 1: Finder에서 앱 열기 (권장)**

1. Finder에서 다운로드한 `mdedit.app` 찾기
2. 우클릭하여 **열기** 선택
3. 보안 경고 대화상자에서 **열기** 버튼 클릭
4. 이후 일반적으로 앱이 실행됨

**방법 2: 터미널에서 격리 속성 제거**

```bash
xattr -d com.apple.quarantine /Applications/mdedit.app
```

### Windows 설치

1. `mdedit_x.x.x_x64-setup.exe`를 다운로드
2. 파일을 두 번 클릭하여 설치 프로그램 실행
3. "Windows가 보호하는 PC" 경고가 나타나면 **자세한 정보** 클릭 후 **실행** 선택
4. 설치 마법사 완료
