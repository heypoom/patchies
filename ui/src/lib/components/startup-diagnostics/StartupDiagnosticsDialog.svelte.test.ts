import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import StartupDiagnosticsDialog from './StartupDiagnosticsDialog.svelte';
import type { StartupDiagnosticsSnapshot, StartupResource } from '$lib/startup/startup-diagnostics';

const slow: StartupResource = {
  id: 1,
  url: 'https://patchies.test/slow.js',
  durationMs: 2500,
  startTimeMs: 10,
  encodedBodySize: 1024,
  initiatorType: 'script'
};
const large: StartupResource = {
  id: 2,
  url: 'https://patchies.test/large.wasm',
  durationMs: 4,
  startTimeMs: 20,
  encodedBodySize: 10_000_000,
  initiatorType: 'fetch'
};
const snapshot: StartupDiagnosticsSnapshot = {
  durationMs: 10_000,
  downloadedBytes: 10_001_024,
  resourceCount: 2,
  route: '/',
  browser: 'Test browser',
  online: true,
  serviceWorkerControlled: false,
  slowest: [slow, large],
  largest: [large, slow],
  errors: ['A startup dependency failed'],
  milestones: ['10s · Interface ready'],
  pendingDownloads: ['https://patchies.test/pending.css'],
  pendingImports: []
};

let component: ReturnType<typeof mount> | undefined;

afterEach(async () => {
  if (component) await unmount(component);

  component = undefined;
  vi.restoreAllMocks();
});

it('shows retained totals and switches between slowest and largest resources', async () => {
  component = mount(StartupDiagnosticsDialog, {
    target: document.body,
    props: { open: true, snapshot }
  });

  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

  expect(document.body.textContent).toContain('10.0s');
  expect(document.body.textContent).toContain('10.0MB known downloaded');
  expect(document.querySelector('tbody tr')?.textContent).toContain(slow.url);

  const largestButton = Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'Largest downloads'
  )!;

  largestButton.click();

  await vi.waitFor(() =>
    expect(document.querySelector('tbody tr')?.textContent).toContain(large.url)
  );
  expect(largestButton.getAttribute('aria-pressed')).toBe('true');

  document.querySelector<HTMLDetailsElement>('details')!.open = true;

  expect(document.querySelector('details')?.textContent).toContain('A startup dependency failed');
  expect(document.querySelector('details')?.textContent).toContain('pending.css');
});

it('copies both rankings, errors, and pending requests as one report', async () => {
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  component = mount(StartupDiagnosticsDialog, {
    target: document.body,
    props: { open: true, snapshot }
  });

  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

  const copyButton = Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'Copy report'
  )!;

  copyButton.click();

  await vi.waitFor(() => expect(copyButton.textContent).toBe('Copied'));

  const report = writeText.mock.calls[0][0];

  expect(report).toContain('Slowest downloads\n2500ms · 1.0kB · https://patchies.test/slow.js');
  expect(report).toContain('Largest downloads\n4ms · 10.0MB · https://patchies.test/large.wasm');

  expect(report).toContain('A startup dependency failed');
  expect(report).toContain('pending.css');
});

it('explains when startup diagnostics are unavailable', async () => {
  component = mount(StartupDiagnosticsDialog, {
    target: document.body,
    props: { open: true }
  });

  await vi.waitFor(() =>
    expect(document.body.textContent).toContain('No startup report is available')
  );

  expect(document.querySelector('table')).toBeNull();
});

it('colors duration and size independently using strict thresholds in both rankings', async () => {
  const resources = [
    { ...slow, id: 1, durationMs: 2000, encodedBodySize: 20_000 },
    { ...slow, id: 2, durationMs: 2001, encodedBodySize: 20_001 },
    { ...slow, id: 3, durationMs: 4000, encodedBodySize: 50_000 },
    { ...slow, id: 4, durationMs: 4001, encodedBodySize: 50_001 },
    { ...slow, id: 5, durationMs: 4001, encodedBodySize: null }
  ];
  component = mount(StartupDiagnosticsDialog, {
    target: document.body,
    props: { open: true, snapshot: { ...snapshot, slowest: resources, largest: resources } }
  });

  await vi.waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(5));

  for (const mode of ['Slowest downloads', 'Largest downloads']) {
    const button = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === mode
    )!;
    button.click();

    await vi.waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('true'));

    const rows = Array.from(document.querySelectorAll('tbody tr'));

    expect(rows[0].children[0].classList.contains('text-blue-300')).toBe(true);
    expect(rows[0].children[1].classList.contains('text-zinc-400')).toBe(true);

    for (const index of [1, 2]) {
      expect(rows[index].children[0].classList.contains('text-yellow-300')).toBe(true);
      expect(rows[index].children[1].classList.contains('text-yellow-300')).toBe(true);
    }

    expect(rows[3].children[0].classList.contains('text-red-300')).toBe(true);
    expect(rows[3].children[1].classList.contains('text-red-300')).toBe(true);

    expect(rows[4].children[0].classList.contains('text-red-300')).toBe(true);
    expect(rows[4].children[1].classList.contains('text-zinc-400')).toBe(true);
    expect(rows[4].children[1].textContent).toBe('Unknown');
  }
});
