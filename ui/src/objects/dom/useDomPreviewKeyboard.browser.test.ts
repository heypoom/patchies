import { expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import DomPreviewKeyboard from './test-fixtures/DomPreviewKeyboard.svelte';
import type { useDomPreviewKeyboard } from './useDomPreviewKeyboard.svelte';

it('receives shadow DOM keys, focuses the preview or controls, and cleans up on unmount', async () => {
  const target = document.createElement('div');
  document.body.appendChild(target);

  let keyboard: ReturnType<typeof useDomPreviewKeyboard> | undefined;

  const component = mount(DomPreviewKeyboard, {
    target,
    props: { onReady: (value) => (keyboard = value) }
  });

  let isMounted = true;

  try {
    await tick();

    const preview = target.firstElementChild as HTMLDivElement;
    const root = preview.firstElementChild as HTMLDivElement;
    const shadow = root.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    const editorKeyDown = vi.fn();

    target.addEventListener('keydown', editorKeyDown);
    keyboard!.focusPreview();

    expect(document.activeElement).toBe(preview);

    shadow.appendChild(input);
    keyboard!.focusPreview();

    expect(shadow.activeElement).toBe(input);

    keyboard!.onKeyDown(onKeyDown);
    keyboard!.onKeyUp(onKeyUp);

    const keydown = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      composed: true,
      cancelable: true
    });

    input.dispatchEvent(keydown);

    input.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: 'ArrowRight',
        bubbles: true,
        composed: true
      })
    );

    expect(onKeyDown).toHaveBeenCalledWith(keydown);
    expect(onKeyUp).toHaveBeenCalledOnce();
    expect(editorKeyDown).not.toHaveBeenCalled();
    expect(keydown.defaultPrevented).toBe(false);

    keyboard!.reset();
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true }));

    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(editorKeyDown).toHaveBeenCalledOnce();

    keyboard!.onKeyDown(onKeyDown);
    await unmount(component);
    isMounted = false;

    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true }));

    expect(onKeyDown).toHaveBeenCalledOnce();
  } finally {
    if (isMounted) await unmount(component);

    target.remove();
  }
});
