# Tauri v2 Security Model Reference

Tauri v2 introduces a capabilities-based permission system, replacing v1's allowlist.

---

## Core Concepts

### Three-part access control:

1. **Permissions** — on/off toggles for individual Tauri commands
2. **Scopes** — parameter validation (e.g., allowed file paths)
3. **Capabilities** — attaching permissions+scopes to specific windows/webviews

---

## capabilities/main.json

Full example for a markdown editor app:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capabilities for the main editor window",
  "windows": ["main"],
  "permissions": [
    "core:path:default",
    "core:event:default",
    "core:window:default",
    "core:app:default",
    "core:resources:default",
    "core:menu:default",
    "core:tray:default",

    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$HOME/**" },
        { "path": "$DOCUMENT/**" },
        { "path": "$DESKTOP/**" }
      ]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [
        { "path": "$HOME/**" },
        { "path": "$DOCUMENT/**" },
        { "path": "$DESKTOP/**" }
      ]
    },
    {
      "identifier": "fs:allow-create",
      "allow": [
        { "path": "$HOME/**" },
        { "path": "$DOCUMENT/**" }
      ]
    },
    {
      "identifier": "fs:allow-remove",
      "allow": [
        { "path": "$HOME/**" },
        { "path": "$DOCUMENT/**" }
      ]
    },
    {
      "identifier": "fs:allow-rename",
      "allow": [
        { "path": "$HOME/**" },
        { "path": "$DOCUMENT/**" }
      ]
    },
    "fs:allow-read-dir",
    "fs:allow-exists",

    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-ask",

    "shell:default",
    "shell:allow-open"
  ]
}
```

---

## Path Variables

| Variable | Resolves To |
|----------|------------|
| `$HOME` | User's home directory |
| `$DOCUMENT` | User's Documents folder |
| `$DESKTOP` | User's Desktop |
| `$APPDATA` | App-specific data directory |
| `$APPCONFIG` | App config directory |
| `$APPLOG` | App log directory |
| `$APPLOCAL` | App local data |
| `$AUDIO` | Audio directory |
| `$PICTURE` | Pictures directory |
| `$VIDEO` | Video directory |
| `$DOWNLOAD` | Downloads directory |

---

## v1 → v2 Migration

```json
// v1 allowlist (DEPRECATED)
{
  "tauri": {
    "allowlist": {
      "fs": {
        "all": true,
        "readFile": true,
        "writeFile": true
      }
    }
  }
}

// v2 capabilities (CORRECT)
{
  "permissions": [
    "fs:default",
    { "identifier": "fs:allow-read-text-file", "allow": [{ "path": "$HOME/**" }] }
  ]
}
```

---

## XSS Prevention

### markdown-it configuration

```typescript
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,        // Disable raw HTML in markdown (XSS prevention)
  xhtmlOut: false,
  breaks: true,
  linkify: true,
  typographer: true,
});
```

### Mermaid configuration

```typescript
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',   // Prevents XSS in diagram code
  theme: 'default',
});
```

### External link handling

```typescript
import { open } from '@tauri-apps/plugin-shell';

// Never use window.open() directly in Tauri
// Instead, intercept clicks and use shell:open
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const link = target.closest('a');
  if (link?.href?.startsWith('http')) {
    e.preventDefault();
    open(link.href);
  }
});
```

---

## Content Security Policy

In `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:"
    }
  }
}
```

For development with Vite hot-reload, set `csp: null` or allow the dev URL.

---

## Custom Command Permissions

For app-specific commands (not using plugins), add to permissions:

```json
// src-tauri/capabilities/main.json
{
  "permissions": [
    "core:default",
    "read_file",
    "write_file",
    "read_directory",
    "open_directory_dialog",
    "start_watch",
    "stop_watch"
  ]
}
```

Or use the `"core:default"` shorthand which allows all app-defined commands.

---

## Security Checklist

- [ ] `html: false` in markdown-it (prevents XSS from markdown content)
- [ ] `securityLevel: 'strict'` in Mermaid config
- [ ] External links use `shell:open` not `window.open()`
- [ ] File paths constrained to `$HOME/**` or specific directories
- [ ] No `fs:allow-read-text-file` with `{ "path": "**" }` (too broad)
- [ ] CSP configured in tauri.conf.json
- [ ] Input validation in Rust commands before file operations
