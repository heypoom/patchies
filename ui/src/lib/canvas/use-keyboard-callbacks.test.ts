import { describe, expect, it, vi } from 'vitest';

import { useKeyboardCallbacks } from './use-keyboard-callbacks.svelte';

describe('useKeyboardCallbacks', () => {
  it('dispatches registered callbacks and detaches its listeners', () => {
    const target = new EventTarget();
    const keyboard = useKeyboardCallbacks();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();

    keyboard.onKeyDown(onKeyDown);
    keyboard.onKeyUp(onKeyUp);

    const detach = keyboard.attach(target as unknown as HTMLElement);

    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('keyup'));

    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(onKeyUp).toHaveBeenCalledOnce();

    detach();
    target.dispatchEvent(new Event('keydown'));

    expect(onKeyDown).toHaveBeenCalledOnce();
  });

  it('clears callbacks on reset and routes callback errors', () => {
    const target = new EventTarget();
    const onError = vi.fn();
    const keyboard = useKeyboardCallbacks({ onError });

    keyboard.onKeyDown(() => {
      throw new Error('keyboard callback failed');
    });

    keyboard.attach(target as unknown as HTMLElement);
    target.dispatchEvent(new Event('keydown'));

    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    keyboard.reset();
    target.dispatchEvent(new Event('keydown'));

    expect(onError).toHaveBeenCalledOnce();
  });
});
