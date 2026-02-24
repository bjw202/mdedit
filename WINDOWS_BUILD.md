# Windows Build Guide for MdEdit

This guide provides step-by-step instructions for building MdEdit on Windows, including development setup and production builds.

## Prerequisites

Before starting, ensure your system meets these requirements:

### 1. Node.js 20 or Later

Node.js is required to manage JavaScript dependencies and run the build process.

Steps to install:

1. Visit https://nodejs.org/ in your web browser
2. Download the LTS version (20.x or later)
3. Run the installer and follow the on-screen prompts
4. Accept the default installation paths and components
5. When prompted about native modules, click Install to add build tools
6. Restart your computer after installation completes

Verify installation:

Open Command Prompt or PowerShell and run:

```
node --version
npm --version
```

You should see version numbers for both commands. Node 20+ is required for compatibility with project dependencies.

### 2. Rust 1.77.2 or Later

Rust is required for the Tauri backend and desktop application functionality.

Steps to install:

1. Download the Rust installer from https://rustup.rs/
2. The file is named rustup-init.exe
3. Double-click the installer and follow the on-screen prompts
4. When asked about the default toolchain, press Enter to accept the recommended settings
5. Installation takes 2-5 minutes depending on your internet connection
6. When complete, close any Command Prompt windows and open a new one
7. Restart your computer to ensure environment variables are properly set

Verify installation:

Open a new Command Prompt and run:

```
rustc --version
cargo --version
```

You should see version numbers. Ensure Rust is 1.77.2 or later by running `rustup update stable` to fetch the latest stable version.

### 3. Visual Studio Build Tools 2022

The C++ compiler is required to compile Rust code that depends on native libraries.

Steps to install:

1. Visit https://visualstudio.microsoft.com/downloads/
2. Scroll to "Tools for Visual Studio 2022" section
3. Click "Build Tools for Visual Studio 2022" to download
4. Run the installer executable
5. Click "Continue" when the installer starts
6. When the workload selection screen appears, check the box for "Desktop development with C++"
7. On the right side under "Installation details", ensure these components are selected:
   - MSVC v143 compiler (Visual Studio 2022 C++ x64 toolset)
   - Windows 11 SDK (or Windows 10 SDK if Windows 11 SDK is unavailable)
   - CMake tools for Windows
8. Click "Install" and wait for completion (15-30 minutes)
9. Restart your computer when the installer shows the completion screen

### 4. WebView2 Runtime

WebView2 is required for rendering web content in the desktop application.

WebView2 is usually pre-installed on Windows 10 (version 1803 or later) and Windows 11.

To verify if WebView2 is installed:

1. Open Control Panel and go to "Programs and Features"
2. Look for "Microsoft Edge WebView2 Runtime" in the list
3. If not present, download and install it from https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### 5. Git

Git is required to clone the project repository and manage version control.

Steps to install:

1. Download from https://git-scm.com/download/win
2. Run the installer
3. Accept the default installation settings
4. When prompted about line endings, select "Checkout as-is, commit as-is"

Verify installation:

```
git --version
```

## Project Setup

Once all prerequisites are installed, set up the project:

### Step 1: Clone the Repository

```
git clone <repository-url>
cd markdown-editor-rust
```

Replace `<repository-url>` with the actual repository URL.

### Step 2: Install Node Dependencies

From the project root directory, run:

```
npm install
```

This command downloads and installs all JavaScript dependencies listed in package.json. Installation takes 2-5 minutes and creates a `node_modules` folder.

### Step 3: Verify Installation

After installation completes, verify the setup:

```
npm list tauri
```

You should see `tauri@2.x.x` in the output, confirming Tauri is installed correctly.

## Development Build

To build and run MdEdit in development mode with hot reloading:

### Run Development Server

From the project root directory:

```
npm run tauri dev
```

This command:

1. Starts the Vite development server (frontend)
2. Compiles Rust code (backend) - first run takes 5-10 minutes
3. Opens the MdEdit window automatically
4. Enables hot reloading when you modify frontend code

On the first run, Rust compilation takes 5-10 minutes as it downloads and compiles approximately 200 dependencies. Subsequent runs are much faster (< 30 seconds) as dependencies are cached.

### Verify Development Build

When the development window opens:

1. Verify the application window appears with a header, sidebar, editor, and preview pane
2. Click "Open Folder" in the sidebar to navigate to a folder
3. Click on a Markdown file to open it
4. Type in the editor and verify text appears in the preview pane
5. Use Ctrl+S to save the file
6. Verify the footer shows save status

If the window does not open after 10 minutes, there may be a compilation error. Check the terminal for error messages.

## Production Build

To create a release build with an installer and standalone executable:

### Step 1: Build for Production

From the project root directory:

```
npm run tauri build
```

This command:

1. Optimizes frontend code with Vite
2. Compiles Rust in release mode (optimized for performance)
3. Creates platform-specific bundles
4. Generates an MSI installer and standalone executable

Compilation takes 5-15 minutes depending on your CPU and disk speed. Progress is shown in the terminal.

### Step 2: Locate Build Artifacts

After the build completes successfully, find the output files:

**MSI Installer** (recommended for distribution):

```
src-tauri/target/release/bundle/msi/MdEdit_<version>_x64_en-US.msi
```

This file is a Windows installer that users can download and run to install MdEdit.

**Standalone Executable**:

```
src-tauri/target/release/MdEdit.exe
```

This file is the compiled application that can be run directly without installation.

### Step 3: Test the Build

Before distribution, test the built application:

1. Run the executable directly:

```
src-tauri/target/release/MdEdit.exe
```

2. Verify all features work:
   - File operations (open, save, new file)
   - Markdown editing and preview
   - Keyboard shortcuts (Ctrl+S, Ctrl+Shift+S, Ctrl+N)
   - Theme switching (follows system dark/light mode)

## Common Issues and Solutions

### Issue: "linker 'link.exe' not found"

This error means the C++ compiler is not installed or not in the system PATH.

Solution:

1. Re-install Visual Studio Build Tools 2022 (see Prerequisites section)
2. Ensure "Desktop development with C++" workload is selected
3. Verify MSVC v143 compiler is installed
4. Restart your computer
5. Open a new Command Prompt and retry the build

### Issue: "WebView2 not found" or Application Won't Start

This error indicates WebView2 runtime is missing.

Solution:

1. Download WebView2 Runtime from https://developer.microsoft.com/en-us/microsoft-edge/webview2/
2. Run the installer
3. Restart the application

### Issue: "node_modules not found" or npm errors

This error means dependencies were not installed.

Solution:

1. Run `npm install` again from the project root
2. Delete `node_modules` folder and `package-lock.json` if the error persists
3. Run `npm install` again
4. Wait for completion before running the build

### Issue: Rust Compilation Errors

This error indicates Rust toolchain issues.

Solution:

1. Update Rust to the latest stable version:

```
rustup update stable
```

2. Verify Rust version is 1.77.2 or later:

```
rustc --version
```

3. If errors persist, reinstall Rust:

```
rustup self uninstall
```

Then download and run rustup-init.exe again from https://rustup.rs/

### Issue: "Long First Build" or Build Takes Over 20 Minutes

This is normal behavior on first build.

Explanation:

The first build compiles Rust's standard library and approximately 200 project dependencies from source. This is a one-time operation that takes 5-15 minutes on modern systems and up to 30 minutes on older systems.

Solution:

Wait for the build to complete. Subsequent builds are much faster (< 1 minute) because dependencies are cached. Do not interrupt the build process.

### Issue: Build Path Contains Spaces

Windows does not allow project paths with spaces for Rust compilation.

Example of problematic paths:

```
C:\My Projects\markdown-editor-rust
C:\Users\My User\Documents\markdown-editor-rust
```

Solution:

Move the project to a path without spaces:

```
C:\Projects\markdown-editor-rust
C:\Users\YourName\dev\markdown-editor-rust
```

Then clone the repository again to the new location.

## Development Workflow

### Edit-Test Cycle

The development server supports hot reloading for frontend changes:

1. Run `npm run tauri dev`
2. Edit React components in `src/components/`
3. Save the file
4. The application automatically reloads with your changes
5. See results immediately in the development window

For backend (Rust) changes:

1. Edit Rust files in `src-tauri/src/`
2. Save the file
3. The development server detects changes and recompiles
4. The application window automatically restarts with new code
5. Recompilation takes 5-30 seconds depending on the changes

### Running Tests

To run the test suite:

```
npm run test
```

This runs all Jest and Vitest unit tests. Tests are located in `src/test/` directory and should all pass before committing code.

For Rust tests:

```
cd src-tauri
cargo test
```

### Checking Code Quality

To verify code formatting and linting:

```
npm run lint
```

This runs ESLint to check TypeScript and React code for style and correctness issues.

## Verification Checklist

After successful build and before distribution, verify:

- [ ] Application window opens without errors
- [ ] File Explorer sidebar displays folder structure
- [ ] Clicking files opens them in the editor
- [ ] Markdown editor displays with syntax highlighting
- [ ] Preview pane renders Markdown correctly
- [ ] Formatting toolbar buttons work (Bold, Italic, etc.)
- [ ] Keyboard shortcuts work (Ctrl+S, Ctrl+Shift+S, Ctrl+N)
- [ ] Save status is displayed in the footer
- [ ] Word and character count updates in the footer
- [ ] Unsaved changes warning appears when needed
- [ ] Scroll sync between editor and preview works
- [ ] Application theme matches system dark/light mode
- [ ] Application launches in under 2 seconds
- [ ] Memory usage is under 100MB at idle

## Building for Distribution

To create an installer for users:

1. Complete the production build steps above
2. Locate the MSI installer file in `src-tauri/target/release/bundle/msi/`
3. Share this file for user downloads
4. Users can run the installer to install MdEdit
5. The installer handles all system integration and dependencies

The MSI installer is recommended for distribution as it handles installation, Windows registry updates, and uninstallation automatically.

## Next Steps

After successful build and verification:

- Review CHANGELOG.md for release notes
- Test on multiple Windows systems (if possible)
- Document any platform-specific issues
- Create GitHub releases with installer download links
- Share application with users and gather feedback
