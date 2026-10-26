// @MX:SPEC: SPEC-UI-008 SPEC-PREVIEW-015
// Regression guard (REQ-019/021/022, AC-013): no new runtime deps, exactly 8 presets,
// markdownKeyBindings unchanged (no new global shortcut).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

describe('SPEC-UI-008 regression guard', () => {
  it('adds zero new runtime dependencies to package.json (REQ-019)', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    // Baseline dependency set at SPEC-UI-008 start — must remain exactly this.
    expect(Object.keys(pkg.dependencies).sort()).toEqual(
      [
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/lang-markdown',
        '@codemirror/language',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@tauri-apps/api',
        '@tauri-apps/plugin-opener',
        '@tauri-apps/plugin-shell',
        '@traptitech/markdown-it-katex',
        '@types/dompurify',
        'docx',
        'dompurify',
        'katex',
        'markdown-it',
        'pele',
        'react',
        'react-dom',
        'shiki',
        'zustand',
      ].sort(),
    );
    // No icon/popover library was introduced.
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(all['lucide-react']).toBeUndefined();
    expect(all['@floating-ui/react']).toBeUndefined();
    // @MX:NOTE: [AUTO] pele는 1.10.0 정확 고정(캐럿·틸드 없음). 올릴 때는 별도 SPEC에서 SPEC-PREVIEW-015 M1과 같은 비교를 거친다.
    //   package.json에는 주석을 달 수 없어 이 가드에 둔다(SPEC-PREVIEW-015 REQ-021·022, AC-023).
    expect(pkg.dependencies.pele).toBe('1.10.0');
    // mermaid·patch-package·postinstall은 SPEC-PREVIEW-015에서 제거됐다 — 다시 들어오면 실패한다.
    expect(all.mermaid).toBeUndefined();
    expect(all['patch-package']).toBeUndefined();
    expect((pkg as { scripts?: Record<string, string> }).scripts?.postinstall).toBeUndefined();
    expect(existsSync(resolve(repoRoot, 'patches', 'mermaid+11.12.3.patch'))).toBe(false);
  });

  it('exposes exactly 8 diagram presets — 7 + custom, no other mermaid types (REQ-021)', async () => {
    const { DIAGRAM_PRESETS } = await import('@/components/editor/extensions/keyboard-shortcuts');
    expect(DIAGRAM_PRESETS).toHaveLength(8);
    const keys = DIAGRAM_PRESETS.map((p) => p.preset);
    expect(keys).toEqual([
      'flowchart',
      'sequenceDiagram',
      'gantt',
      'classDiagram',
      'stateDiagram',
      'pie',
      'mindmap',
      'custom',
    ]);
    // None of the excluded 17 types leaked in.
    for (const excluded of ['er', 'journey', 'gitGraph', 'quadrantChart', 'C4', 'sankey', 'block']) {
      expect(keys).not.toContain(excluded);
    }
  });

  it('does not register any new keyboard shortcut — markdownKeyBindings unchanged (REQ-022)', async () => {
    const { markdownKeyBindings } = await import('@/components/editor/extensions/keyboard-shortcuts');
    expect(markdownKeyBindings).toHaveLength(3);
    expect(markdownKeyBindings.map((b) => b.key)).toEqual(['Mod-b', 'Mod-i', 'Ctrl-/']);
  });
});
