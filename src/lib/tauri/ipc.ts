// @MX:ANCHOR: [AUTO] Type-safe IPC wrappers for Tauri filesystem commands
// @MX:REASON: Central IPC layer used by all frontend components accessing filesystem (fan_in >= 3)
// @MX:SPEC: SPEC-FS-001

import { invoke } from '@tauri-apps/api/core';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import type { FileNode } from '@/types/file';
import type { AiFeature } from '@/store/aiStore';
import type { DiagramType } from '@/components/editor/extensions/keyboard-shortcuts';

export type { DiagramType };

/**
 * Reads a file and returns its content as a UTF-8 string.
 * Throws if the file does not exist or is not valid UTF-8.
 */
export async function readFile(path: string): Promise<string> {
  return invoke<string>('read_file', { path });
}

/**
 * Writes UTF-8 content to a file, creating parent directories as needed.
 * Overwrites existing file content.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_file', { path, content });
}

/**
 * Creates an empty file at the given path.
 * Throws if the file already exists.
 */
export async function createFile(path: string): Promise<void> {
  return invoke<void>('create_file', { path });
}

/**
 * Deletes a single file.
 * Throws if the file does not exist or if the path points to a directory.
 */
export async function deleteFile(path: string): Promise<void> {
  return invoke<void>('delete_file', { path });
}

/**
 * Renames or moves a file from oldPath to newPath.
 * Throws if the source does not exist or if the destination already exists.
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  return invoke<void>('rename_file', { oldPath, newPath });
}

/**
 * Reads a directory recursively and returns a sorted FileNode tree.
 * Directories appear before files; both groups are sorted alphabetically.
 */
export async function readDirectory(path: string): Promise<FileNode[]> {
  return invoke<FileNode[]>('read_directory', { path });
}

/**
 * Opens a native folder picker dialog.
 * Returns the selected folder path, or null if the user cancels.
 */
export async function openDirectoryDialog(): Promise<string | null> {
  return invoke<string | null>('open_directory_dialog');
}

/**
 * Starts watching the given directory path for filesystem changes.
 * Emits `file-changed` Tauri events to the frontend when files change.
 * Stops any previously active watcher before starting.
 */
export async function startWatch(path: string): Promise<void> {
  return invoke<void>('start_watch', { path });
}

/**
 * Stops the active filesystem watcher.
 * No-op if no watcher is currently active.
 */
export async function stopWatch(): Promise<void> {
  return invoke<void>('stop_watch');
}

/**
 * Opens a native Save As dialog, writes the content to the selected file,
 * and returns the saved file path. Returns null if the user cancels.
 * `defaultPath` sets the initial directory shown in the dialog.
 */
export async function saveFileAs(content: string, defaultPath?: string): Promise<string | null> {
  return invoke<string | null>('save_file_as', { content, defaultPath: defaultPath ?? null });
}

// @MX:NOTE: [AUTO] Export IPC wrappers for SPEC-EXPORT-001 - format-specific save dialogs
// @MX:SPEC: SPEC-EXPORT-001

/**
 * Opens a native Save As dialog with a format-specific file filter.
 * Returns the selected file path, or null if the user cancels.
 *
 * @param format - Export format: 'html', 'pdf', or 'docx'
 * @param defaultName - Default filename to suggest in the dialog
 */
export async function exportSaveDialog(format: string, defaultName: string): Promise<string | null> {
  return invoke<string | null>('export_save_dialog', { format, defaultName });
}

/**
 * Writes binary data to a file at the given path.
 * Used for DOCX export where the content is a binary blob.
 *
 * @param path - Absolute path where the file should be saved
 * @param data - Binary data as an array of bytes
 */
export async function writeBinaryFile(path: string, data: number[]): Promise<void> {
  return invoke<void>('write_binary_file', { path, data });
}

/**
 * Triggers the native print dialog on the current webview window.
 * Used by PDF export since JavaScript window.print() does not work in Tauri's WKWebView.
 */
export async function printCurrentWindow(): Promise<void> {
  return invoke<void>('print_current_window');
}

// @MX:NOTE: [AUTO] SPEC-EXPORT-002 (REQ-006/011/012) opener 래퍼 — 내보낸 파일 열기/폴더 표시.
//   tauri-plugin-opener 의 JS API(openPath / revealItemInDir)를 감싼다. 신규 Tauri command 없이
//   플러그인 JS 함수를 직접 호출(REQ-021). 컴포넌트가 플러그인을 직접 import하지 못게 이 레이어로
//   모아 테스트 모킹 지점을 단일화한다(REQ-006). browser_ops.rs(Command spawn)와 별개 — URL 전용이며
//   본 SPEC 무관; opener 는 capability ACL 통제 + 크로스플랫폼 reveal 정확성을 제공한다.
// @MX:SPEC: SPEC-EXPORT-002

/**
 * 내보낸 파일을 OS 기본 애플리케이션으로 연다 (완료 모달 `열기` 액션, REQ-011).
 * openPath 는 capability ACL(opener:allow-open-path)의 통제를 받는다.
 * (opener:default 에는 open_path 가 포함되지 않는다 — 임의 경로 실행 위험으로 별도 explicit 권한 필요.)
 */
export async function openExportedFile(path: string): Promise<void> {
  await openPath(path);
}

/**
 * 내보낸 파일을 파일 관리자에서 선택된 상태로 드러낸다 (완료 모달 `폴더에서 보기`, REQ-012).
 * revealItemInDir 은 capability(opener:allow-reveal-item-in-dir)의 통제를 받는다.
 */
export async function revealExportedFile(path: string): Promise<void> {
  await revealItemInDir(path);
}

// @MX:NOTE: [AUTO] Image IPC wrappers for SPEC-IMG-001 - clipboard save, file copy, base64 read, dialog
// @MX:SPEC: SPEC-IMG-001

/**
 * Saves base64-encoded image data to the images/ subdirectory next to the markdown file.
 * Returns the relative path for use in markdown links (e.g., `./images/1234567890.png`).
 */
export async function saveImageFromClipboard(mdFilePath: string, imageDataBase64: string): Promise<string> {
  return invoke<string>('save_image_from_clipboard', { mdFilePath, imageDataBase64 });
}

/**
 * Copies an image file to the images/ subdirectory next to the markdown file.
 * Returns the relative path. Adds numeric suffix if filename already exists.
 */
export async function copyImageToFolder(sourcePath: string, mdFilePath: string): Promise<string> {
  return invoke<string>('copy_image_to_folder', { sourcePath, mdFilePath });
}

/**
 * Reads an image file and returns its content as a base64 data URI string.
 * Format: `data:{mime};base64,{data}`
 */
export async function readImageAsBase64(imagePath: string): Promise<string> {
  return invoke<string>('read_image_as_base64', { imagePath });
}

/**
 * Opens a native file dialog filtered for image files.
 * Returns the selected file path, or null if the user cancels.
 */
export async function openImageDialog(): Promise<string | null> {
  return invoke<string | null>('open_image_dialog');
}

// @MX:NOTE: [AUTO] asset 프로토콜 scope 등록 — SPEC-PREVIEW-004 HTML 파일 보기 기능
// @MX:SPEC: SPEC-PREVIEW-004

/**
 * 열린 폴더를 Tauri asset 프로토콜 런타임 scope에 등록한다.
 * 폴더와 하위 경로 전체를 WebView에서 asset:// URL로 접근 가능하게 허용한다.
 * 세션 누적 방식 — 앱 재시작 시 Tauri가 scope를 초기화한다.
 *
 * @param path - 열린 폴더의 절대 경로
 */
export async function registerAssetScope(path: string): Promise<void> {
  return invoke<void>('register_asset_scope', { path });
}

// @MX:NOTE: [AUTO] Browser IPC wrappers for system browser operations
// @MX:SPEC: SPEC-PREVIEW-001

/**
 * Opens a URL in the system's default browser using shell commands.
 * Uses platform-specific commands: open (macOS), start (Windows), xdg-open (Linux).
 *
 * @param url - The URL to open
 */
export async function openUrlInBrowser(url: string): Promise<void> {
  return invoke<void>('open_url_in_browser', { url });
}

// @MX:NOTE: [AUTO] AI IPC wrappers — SPEC-AI-001 (T-008). 프론트는 "기능 종류 + 텍스트 조각"만
// 넘기고, 프롬프트 조립·컨텍스트 절단은 전부 Rust 쪽에서 수행한다(설계 §3). Tauri 가 camelCase
// 키를 Rust snake_case 인자로 자동 매핑한다(기존 래퍼 관례와 동일).
// @MX:SPEC: SPEC-AI-001

/** AI 모델 선택 — 기본 haiku, "고급 모델" 토글 시 sonnet(설계 §8.2). */
export type AiModel = 'haiku' | 'sonnet';

/** ai_request 인자. feature 는 aiStore 와 단일 소스를 공유한다. */
export interface AiRequestArgs {
  requestId: string;
  feature: AiFeature;
  presetKind?: string;
  model: AiModel;
  selection?: string;
  contextBefore?: string;
  contextAfter?: string;
  outline?: string;
  customInstruction?: string;
  /**
   * SPEC-AI-006 REQ-AI6-012/013/014: 이어쓰기(continue) 길이 옵션('short'|'normal').
   * continue 발행 2곳(startContinueWritingCommand/startFreeContinueWritingCommand)에서만
   * 실어 보낸다 — 섹션 채우기·인라인 변환에는 영향을 주지 않는다.
   */
  length?: 'short' | 'normal';
  /**
   * SPEC-AI-008 REQ-009/010: AI 다이어그램 종류 제약(7종). 다이어그램 서브메뉴에서 종류를
   * 고르면 실린다 — "자동"은 필드 생략(하위호환). Rust `diagram_type`(`#[serde(default)]`)로
   * 매핑되어 feature 가 diagram 일 때만 프롬프트에 종류 조각을 부착한다.
   */
  diagramType?: DiagramType;
  /**
   * SPEC-AI-009 REQ-AI9-003: AI provider 강제 라우팅. undefined/생략 시 백엔드가 자동 감지
   * (claude > codex 우선, `ProviderRegistry::first_available()`). 'claude'/'codex' 명시 시
   * 해당 provider 로 라우팅된다. camelCase IPC 계약: Rust `provider_id: Option<String>`
   * (`#[serde(default)]`)와 짝을 이룬다.
   */
  providerId?: string;
}

/**
 * ai_detect_providers 결과 항목 — 설치·버전 + 로그인 선제 판정(설계 §8.1, REQ-AI-012).
 * SPEC-AI-009: id 는 string — 백엔드가 claude/codex 등 어떤 id 드도 반환할 수 있어 리터럴
 * 타입 제약을 풀었다(`ProviderStatus.id: String` 과 일치).
 */
export interface AiProviderStatus {
  id: string;
  installed: boolean;
  version?: string;
  loggedIn: boolean;
  /**
   * SPEC-AI-009 REQ-AI9-051: 백엔드가 공급하는 고급 티어 표시 문자열(claude → `sonnet`,
   * codex → `gpt-5.5 · 높은 추론`). 실제 인자를 조립하는 중앙 매핑 함수에서 파생되므로
   * 프론트는 이 값을 그대로 렌더하고 재구성하지 않는다(REQ-AI9-048/052). 부재·빈 값일 때의
   * 폴백은 REQ-AI9-053 참조.
   */
  advancedModelLabel?: string;
}

/** ai_policy_status 결과 — kill-switch 활성 여부와 출처(설계 §8.2, REQ-AI-017). */
export interface AiPolicyStatus {
  disabled: boolean;
  source?: 'env' | 'policy-file';
}

/**
 * AI 요청을 시작한다. 요청당 CLI 프로세스 1개가 스폰되고 stdout 이 ai:// 이벤트로 릴레이된다.
 * 델타/완료/오류는 useAiRelay 훅이 수신한다(REQ-AI-004).
 *
 * Rust 커맨드 `fn ai_request(args: AiRequestArgs, ...)` 는 파라미터 이름 `args` 키로
 * 역직렬화하므로 페이로드를 반드시 `{ args }` 로 감싼다 — 필드를 최상위로 펼치면 Tauri 가
 * `args` 를 못 찾아 본문 실행 전에 거부한다(모든 요청 실패).
 */
export async function aiRequest(args: AiRequestArgs): Promise<void> {
  return invoke<void>('ai_request', { args });
}

/** 진행 중(in-flight) 요청을 취소한다 — 프로세스 kill + 상태 취소 전환(REQ-AI-005). */
export async function aiCancel(requestId: string): Promise<void> {
  return invoke<void>('ai_cancel', { args: { requestId } });
}

/**
 * invoke 거부 사유를 사용자 문구로 정규화한다(P7 조용한 실패 금지). Rust Err(String) 은 이미
 * 분류된 한국어 메시지이므로 그대로 노출한다(REQ-AI-040 위반 아님). 사유가 비면 폴백 문구.
 */
export function ipcErrorMessage(reason: unknown, fallback = '요청을 시작할 수 없어요.'): string {
  const raw = typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : '';
  return raw.trim() || fallback;
}

/** 설치·버전·로그인 상태를 감지한다(MVP claude 단독, 설계 §8.1). */
export async function aiDetectProviders(): Promise<AiProviderStatus[]> {
  return invoke<AiProviderStatus[]>('ai_detect_providers');
}

/** 조직 정책 kill-switch 상태를 조회한다(env / 정책 파일, 설계 §8.2). */
export async function aiPolicyStatus(): Promise<AiPolicyStatus> {
  return invoke<AiPolicyStatus>('ai_policy_status');
}
