import { afterEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  isStartupDiagnosticsOpen,
  loadStartupDiagnostics,
  openStartupDiagnostics
} from './startup-diagnostics.store';

const dialogPath = '$lib/components/startup-diagnostics/StartupDiagnosticsDialog.svelte';

afterEach(() => {
  isStartupDiagnosticsOpen.set(false);
  vi.doUnmock(dialogPath);
  vi.restoreAllMocks();
});

it('closes after an import failure and permits a subsequent open and load', async () => {
  const failure = new Error('Failed to fetch dynamically imported module');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});

  vi.doMock(dialogPath, () => {
    throw failure;
  });

  openStartupDiagnostics();

  expect(await loadStartupDiagnostics()).toBeNull();
  expect(get(isStartupDiagnosticsOpen)).toBe(false);

  expect(log).toHaveBeenCalledWith(
    '[Startup diagnostics] Could not load dialog:',
    expect.any(Error)
  );

  const dialog = vi.fn();
  vi.doMock(dialogPath, () => ({ default: dialog }));
  openStartupDiagnostics();

  expect((await loadStartupDiagnostics())?.default).toBe(dialog);
  expect(get(isStartupDiagnosticsOpen)).toBe(true);
});
