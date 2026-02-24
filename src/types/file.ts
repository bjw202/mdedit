// @MX:ANCHOR: [AUTO] Core TypeScript types for filesystem operations
// @MX:REASON: FileNode type is used throughout the frontend for file tree rendering (fan_in >= 3)
// @MX:SPEC: SPEC-FS-001

/**
 * Represents a file or directory node in the filesystem tree.
 * Mirrors the Rust FileNode struct with camelCase field names.
 */
export interface FileNode {
  /** File or directory name (not full path) */
  name: string;
  /** Absolute path to the file or directory */
  path: string;
  /** True if this node represents a directory */
  isDirectory: boolean;
  /** Child nodes (only populated for directories) */
  children?: FileNode[];
  /** File size in bytes (undefined for directories) */
  size?: number;
  /** Last modified time as Unix timestamp in seconds */
  modifiedTime?: number;
}

/**
 * Structured error returned from file operation IPC calls.
 */
export interface FileError {
  /** Error category code */
  code: string;
  /** Human-readable error message */
  message: string;
}
