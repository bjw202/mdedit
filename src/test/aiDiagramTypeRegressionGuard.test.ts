// @MX:SPEC: SPEC-AI-008
// AC-AI-008-013 회귀 가드: 신규 런타임 의존성 0(npm + cargo), 서브메뉴 정확히 8항목(17종 미추가),
// mermaid 핀 무변경, SPEC-UI-008 수동 삽입 계약 무변경.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

describe('SPEC-AI-008 regression guard', () => {
  it('adds zero new npm runtime deps and keeps the mermaid pin (REQ-019, REQ-021)', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    // 플라이아웃/포털 라이브러리 도입 금지 — 순수 CSS 포지셔닝(REQ-019).
    for (const banned of [
      '@floating-ui/dom',
      '@floating-ui/react',
      'floating-ui',
      'tippy.js',
      '@popperjs/core',
      'react-popper',
    ]) {
      expect(all[banned]).toBeUndefined();
    }
    // mermaid 버전 핀 무변경(REQ-021).
    expect(pkg.dependencies.mermaid).toBe('11.12.3');
  });

  it('adds zero new cargo runtime dependencies (REQ-019)', () => {
    const cargo = readFileSync(resolve(repoRoot, 'src-tauri', 'Cargo.toml'), 'utf-8');
    const depsStart = cargo.indexOf('[dependencies]');
    const depsBlock = cargo.slice(depsStart, cargo.indexOf('[profile', depsStart));
    const crates = depsBlock
      .split('\n')
      .map((l) => l.match(/^([A-Za-z0-9_-]+)\s*=/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1])
      .sort();
    // diagram_type 은 Option<String> 평문 필드 — 새 크레이트가 필요 없다.
    expect(crates).toEqual([
      'base64',
      'notify',
      'serde',
      'serde_json',
      'tauri',
      'tauri-plugin-dialog',
      'tauri-plugin-opener',
      'tauri-plugin-shell',
      'tokio',
    ]);
  });

  it('the diagram submenu is exactly 8 items — no 17-type expansion (REQ-022)', async () => {
    const mod = await import('@/components/editor/extensions/ai-selection-toolbar');
    const menu = mod.createPresetMenu({
      selectionLength: 100,
      callbacks: { onSelectPreset: vi.fn(), onSubmitCustom: vi.fn(), onClose: vi.fn() },
    });
    document.body.appendChild(menu.dom);
    menu.dom
      .querySelector<HTMLButtonElement>('[data-preset="diagram"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.dom.querySelectorAll('.mdedit-ai-diagram-submenu-item').length).toBe(8);
    menu.destroy();
  });

  it('does not touch SPEC-UI-008 manual insert (insertDiagram/DIAGRAM_PRESETS unchanged, 8 presets incl custom)', async () => {
    const ks = await import('@/components/editor/extensions/keyboard-shortcuts');
    expect(typeof ks.insertDiagram).toBe('function');
    // UI-008 수동 삽입은 custom 포함 8개 프리셋(빈 펜스) — AI 서브메뉴(자동+7종)와 별개.
    expect(ks.DIAGRAM_PRESETS.map((p) => p.preset)).toEqual([
      'flowchart',
      'sequenceDiagram',
      'gantt',
      'classDiagram',
      'stateDiagram',
      'pie',
      'mindmap',
      'custom',
    ]);
  });
});
