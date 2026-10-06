import { describe, expect, it } from 'vitest';
import { getPrimaryButtonLayout } from './primary-button-layout';
import type { PrimaryButton } from '$lib/eventbus/events';

const modes: (PrimaryButton | undefined)[] = [undefined, 'run', 'code', 'settings'];

describe('js primary button layout', () => {
  it.each(modes)('places compact actions for mode %s', (mode) => {
    const body = mode ?? 'run';

    expect(getPrimaryButtonLayout('js', mode, false, true)).toEqual({
      body,
      floating: body === 'run' ? 'code' : 'run',
      codeInMenu: body === 'settings'
    });
  });

  it.each(modes)('keeps execution in the expanded console for mode %s', (mode) => {
    expect(getPrimaryButtonLayout('js', mode, true, true)).toEqual({
      body: 'run',
      floating: mode === 'settings' ? 'settings' : 'code',
      codeInMenu: mode === 'settings'
    });
  });

  it.each([false, true])('falls back without visible settings (console: %s)', (showConsole) => {
    expect(getPrimaryButtonLayout('js', 'settings', showConsole, false)).toEqual({
      body: 'run',
      floating: 'code',
      codeInMenu: false
    });

    expect(getPrimaryButtonLayout('js', 'settings', showConsole, true)).toEqual({
      body: showConsole ? 'run' : 'settings',
      floating: showConsole ? 'settings' : 'run',
      codeInMenu: true
    });
  });
});

describe('other code blocks', () => {
  it.each(modes)('keeps the body run action for worker mode %s', (mode) => {
    expect(getPrimaryButtonLayout('worker', mode, false, true)).toEqual({
      body: 'run',
      floating: mode === 'settings' ? 'settings' : 'code',
      codeInMenu: mode === 'settings'
    });
  });
});
