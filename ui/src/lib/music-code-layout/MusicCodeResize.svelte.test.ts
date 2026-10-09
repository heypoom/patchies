import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { page, userEvent } from '@vitest/browser/context';
import MusicCodeFlowHarness from './test-fixtures/MusicCodeFlowHarness.svelte';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { defaultEditorLayout } from '../../stores/editor-layout-settings.store';

let component: ReturnType<typeof mount> | undefined;

afterEach(async () => {
  if (component) await unmount(component);
});

it('uses the real NodeResizer and restores editor dimensions after compact mode', async () => {
  const onCommit = vi.fn();
  defaultEditorLayout.set('inline');
  const bus = PatchiesEventBus.getInstance();
  bus.addEventListener('nodeDataCommit', onCommit);

  const instance = mount(MusicCodeFlowHarness, { target: document.body });
  component = instance;

  try {
    await vi.waitFor(() =>
      expect(
        document.querySelector('.svelte-flow__resize-control.bottom.right.handle')
      ).not.toBeNull()
    );
    const handle = document.querySelector<HTMLElement>(
      '.svelte-flow__resize-control.bottom.right.handle'
    )!;
    await userEvent.dragAndDrop(handle, page.getByTestId('resize-target'));

    await vi.waitFor(() => expect(instance.getNode().data.editorSize?.width).toBeGreaterThan(400));
    const size = instance.getNode().data.editorSize!;
    expect(size.height).toBeGreaterThan(240);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector<HTMLElement>('.music-code-body')!.getBoundingClientRect().height
    ).toBe(size.height);

    await page.getByRole('button', { name: 'Editor options', exact: true }).click();
    await page.getByRole('button', { name: 'Hide Code', exact: true }).click();
    await vi.waitFor(() => expect(instance.getNode().width).toBe(100));
    expect(document.querySelector('.svelte-flow__resize-control')).toBeNull();

    await page.getByRole('button', { name: 'Edit code', exact: true }).click();
    await vi.waitFor(() => {
      const node = document.querySelector<HTMLElement>('.svelte-flow__node')!;
      const viewport = document.querySelector<HTMLElement>('.music-code-viewport')!;
      const nodeBounds = node.getBoundingClientRect();
      const editorBounds = viewport.getBoundingClientRect();

      expect(getComputedStyle(viewport).position).toBe('absolute');
      expect(nodeBounds.width).toBe(100);
      expect(nodeBounds.height).toBe(42);
      expect(instance.getNode().measured).toEqual({ width: 100, height: 42 });
      expect(editorBounds.left).toBeGreaterThan(nodeBounds.right);
      expect(editorBounds.top).toBe(nodeBounds.top);
      expect(editorBounds.height).toBe(size.height + 2);
    });

    await page.getByRole('button', { name: 'Close code inspection', exact: true }).click();
    await page.getByRole('button', { name: 'Editor options', exact: true }).click();
    await page.getByRole('button', { name: 'Show Editor in Patch', exact: true }).click();
    await vi.waitFor(() => expect(instance.getNode().width).toBe(size.width));
    expect(instance.getNode().height).toBe(size.height + 2);
  } finally {
    bus.removeEventListener('nodeDataCommit', onCommit);
  }
});
