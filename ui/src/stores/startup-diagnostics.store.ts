import { writable } from 'svelte/store';

export const isStartupDiagnosticsOpen = writable(false);

export const openStartupDiagnostics = () => isStartupDiagnosticsOpen.set(true);

export const loadStartupDiagnostics = () =>
  import('$lib/components/startup-diagnostics/StartupDiagnosticsDialog.svelte').catch((error) => {
    console.error('[Startup diagnostics] Could not load dialog:', error);
    isStartupDiagnosticsOpen.set(false);

    return null;
  });
