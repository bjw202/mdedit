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

배포 파일은 GitHub Actions가 만듭니다. 버전 태그(`vX.Y.Z`)를 푸시하면 `.github/workflows/release.yml`이 실행되어 Apple Silicon 맥용 `_aarch64.dmg`와 Windows용 `-setup.exe`·`.msi`를 빌드하고, 이 파일들을 **초안** 릴리스에 올립니다. 워크플로는 릴리스를 게시하지 않습니다. 게시는 사람이 확인한 뒤 직접 합니다.

### 배포 절차

1. `package.json`·`src-tauri/Cargo.toml`·`src-tauri/tauri.conf.json`의 버전을 같은 값으로 맞춰 main에 병합합니다. 세 값 중 하나라도 태그와 다르면 워크플로의 첫 job(`version-check`)이 실패하고 릴리스는 만들어지지 않습니다.
2. **main에 이미 병합된 커밋에 태그**를 답니다(예: `git fetch origin && git tag v0.19.0 origin/main`). 워크플로는 태그가 main에 있는 커밋인지 검사하지 않으므로 이 조건은 직접 지켜야 합니다.
3. `git push origin v0.19.0`으로 태그를 올리면 Actions 탭에서 `release.yml` 실행이 시작됩니다. `v0.19.0-rc.1`처럼 숫자 세 개 형식이 아닌 태그로는 실행되지 않습니다.
4. 실행이 **완전히 끝난 뒤** Releases 페이지에서 초안을 열어 파일 세 개(`_aarch64.dmg`, `-setup.exe`, `.msi`)와 본문을 확인하고 **Publish release**를 누릅니다.

초안 본문은 `.github/release-notes-header.md`의 설치 안내 블록으로 시작하고, 그 뒤에 직전 버전 태그부터의 자동 생성 노트가 붙습니다.

### 지켜야 할 규칙

- 실행 중에는 게시하지 않습니다. 빌드 job은 빌드를 시작하기 전에 한 번 초안인지 확인합니다. 하지만 그 확인과 실제 업로드 사이에는 긴 빌드가 있어서, 실행 도중에 게시하면 게시본에 파일이 올라갈 수 있습니다.
- 게시한 뒤에는 실패한 job을 **다시 실행**하지 않습니다. 대상 릴리스가 초안이 아니면 빌드 job이 업로드 전에 실패하도록 되어 있지만, 게시본을 고치는 경로로 쓰지 않습니다.
- 같은 태그의 릴리스(초안 포함)가 이미 있으면 워크플로가 새로 만들지 않고 실패합니다.
- 초안이나 빌드에 결함이 있으면 아래 순서로 지운 뒤 고쳐서 다시 태그를 답니다.

```bash
gh release delete v0.19.0 --yes
git push --delete origin v0.19.0
git tag -d v0.19.0
```

### 로컬 macOS 빌드의 서명

`src-tauri/tauri.conf.json`에 `bundle.macOS.signingIdentity: "-"`가 들어 있어 이제 로컬 macOS 빌드(`npm run build`)도 **ad-hoc** 서명됩니다(Xcode 명령줄 도구의 `codesign` 사용). Apple 개발자 인증서는 필요 없고, Windows 빌드에는 영향이 없습니다.

### 처음 실행할 때 나오는 경고

이 앱은 Apple 공증이나 Windows 코드 서명을 받지 않았으므로 처음 열 때 경고가 나옵니다. 사용자 안내는 README의 "설치 파일 내려받기" 절에 있습니다.

- **macOS**: 앱을 한 번 열어 본 뒤 시스템 설정 → 개인정보 보호 및 보안으로 가서 아래쪽의 **그래도 열기**를 누르고, 다시 뜨는 안내에서 **열기**를 누릅니다.
- **Windows**: Microsoft Defender SmartScreen 경고가 뜨면 **추가 정보**를 누른 뒤 **실행**을 선택합니다.
