import { describe, expect, it } from 'vitest';
import { getPrimaryButtonLayout } from './primary-button-layout';
import type { PrimaryButton } from '$lib/eventbus/events';

const modes: (PrimaryButton | undefined)[] = [undefined, 'run', 'code', 'settings'];

describe.each(['js', 'worker'])('%s primary button layout', (nodeType) => {
  it.each(modes)('places compact actions for mode %s', (mode) => {
    const body = mode ?? 'run';

    expect(getPrimaryButtonLayout(nodeType, mode, false, true)).toEqual({
      body,
      floating: body === 'run' ? 'code' : 'run',
      codeInMenu: body === 'settings'
    });
  });

  it.each(modes)('keeps execution in the expanded console for mode %s', (mode) => {
    expect(getPrimaryButtonLayout(nodeType, mode, true, true)).toEqual({
      body: 'run',
      floating: mode === 'settings' ? 'settings' : 'code',
      codeInMenu: mode === 'settings'
    });
  });

  it.each([false, true])('falls back without visible settings (console: %s)', (showConsole) => {
    expect(getPrimaryButtonLayout(nodeType, 'settings', showConsole, false)).toEqual({
      body: 'run',
      floating: 'code',
      codeInMenu: false
    });

    expect(getPrimaryButtonLayout(nodeType, 'settings', showConsole, true)).toEqual({
      body: showConsole ? 'run' : 'settings',
      floating: showConsole ? 'settings' : 'run',
      codeInMenu: true
    });
  });
});
