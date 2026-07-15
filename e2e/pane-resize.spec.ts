import { test, expect } from './fixtures/tauri-mock';

// SPEC-UI-006 AC-UI-006-014 (must-pass): ResizablePanels drag-to-resize must be preserved
// after the visual reskin. The handoff's fixed CSS grid track sizing
// (.md-app/.md-body 232px/6px/1fr/6px/1fr) was explicitly NOT adopted (REQ-UI-006-020) —
// only visual tokens (.md-pane-divider / --md-divider-pane) were applied to the existing
// ResizablePanels drag logic. This test makes that invariant machine-verifiable: dragging
// the sidebar<->editor divider must actually change pane widths (drag-to-resize still works).
test.describe('Pane resize (SPEC-UI-006 AC-UI-006-014, must-pass)', () => {
  test('dragging the sidebar divider changes the sidebar pane width', async ({ tauriPage }) => {
    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 10_000 });

    // First divider = sidebar<->editor splitter (rendered whenever sidebar is not collapsed).
    const divider = tauriPage.locator('.cursor-col-resize').first();
    await expect(divider).toBeVisible({ timeout: 10_000 });

    // The divider carries the SPEC-UI-006 visual token class alongside the pre-existing
    // Tailwind hit-area class — visual reskin, not a markup/behavior replacement.
    await expect(divider).toHaveClass(/md-pane-divider/);
    await expect(divider).toHaveClass(/cursor-col-resize/);

    const sidebar = tauriPage.locator('.md-sidebar').first();
    const dividerBox = await divider.boundingBox();
    expect(dividerBox).not.toBeNull();
    if (!dividerBox) return;

    const widthBefore = (await sidebar.boundingBox())?.width ?? 0;
    expect(widthBefore).toBeGreaterThan(0);

    // Drag the divider 80px to the right.
    await tauriPage.mouse.move(
      dividerBox.x + dividerBox.width / 2,
      dividerBox.y + dividerBox.height / 2
    );
    await tauriPage.mouse.down();
    await tauriPage.mouse.move(
      dividerBox.x + dividerBox.width / 2 + 80,
      dividerBox.y + dividerBox.height / 2,
      { steps: 5 }
    );
    await tauriPage.mouse.up();

    const widthAfter = (await sidebar.boundingBox())?.width ?? 0;
    // Drag-to-resize invariant: width must have grown by roughly the drag delta.
    expect(widthAfter).toBeGreaterThan(widthBefore + 40);
  });
});
