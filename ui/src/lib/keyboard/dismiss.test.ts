import { describe, expect, it } from 'vitest';

import {
  getDismissShortcutLabel,
  getExpandedDismissShortcutLabel,
  isDismissKey,
  isExpandedDismissKey
} from './dismiss';

const keydown = (key: string, options: KeyboardEventInit = {}) =>
  ({ key, ...options }) as KeyboardEvent;

describe('dismiss shortcuts', () => {
  it('accepts Escape and Cmd/Ctrl+period as a standard dismissal', () => {
    expect(isDismissKey(keydown('Escape'))).toBe(true);
    expect(isDismissKey(keydown('.', { metaKey: true }))).toBe(true);
    expect(isDismissKey(keydown('.', { ctrlKey: true }))).toBe(true);
  });

  it('does not turn unrelated modified keys into dismissals', () => {
    expect(isDismissKey(keydown('.', { altKey: true }))).toBe(false);
    expect(isDismissKey(keydown('.', { metaKey: true, shiftKey: true }))).toBe(false);
    expect(isDismissKey(keydown('Escape', { metaKey: true }))).toBe(true);
  });

  it('uses the same dismissal keys for expanded overlays', () => {
    expect(isExpandedDismissKey(keydown('Escape', { shiftKey: true }))).toBe(true);
    expect(isExpandedDismissKey(keydown('Escape'))).toBe(true);
    expect(isExpandedDismissKey(keydown('.', { metaKey: true }))).toBe(true);
  });

  it('shows compact platform-specific dismissal hints', () => {
    expect(getDismissShortcutLabel(false)).toBe('Esc');
    expect(getDismissShortcutLabel(true, true)).toBe('Cmd + .');
    expect(getExpandedDismissShortcutLabel(true, false)).toBe('Ctrl + .');
  });
});
