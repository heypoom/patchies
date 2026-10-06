import type { PrimaryButton } from '$lib/eventbus/events';

export function getPrimaryButtonLayout(
  nodeType: string,
  primaryButton: PrimaryButton | undefined,
  showConsole: boolean,
  hasSettings: boolean
): { body: PrimaryButton; floating: PrimaryButton; codeInMenu: boolean } {
  const mode = primaryButton === 'settings' && !hasSettings ? undefined : primaryButton;

  if (nodeType !== 'js' && nodeType !== 'worker') {
    const floating = mode === 'settings' ? 'settings' : 'code';

    return { body: 'run', floating, codeInMenu: floating !== 'code' };
  }

  if (showConsole) {
    const floating = mode === 'settings' && hasSettings ? 'settings' : 'code';

    return { body: 'run', floating, codeInMenu: floating !== 'code' };
  }

  const body = mode === 'code' || (mode === 'settings' && hasSettings) ? mode : 'run';

  return {
    body,
    floating: body === 'run' ? 'code' : 'run',
    codeInMenu: body === 'settings'
  };
}
