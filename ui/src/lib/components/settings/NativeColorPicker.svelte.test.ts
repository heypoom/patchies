import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import type { Writable } from 'svelte/store';
import { isMobile } from '../../../stores/ui.store';
import NativeColorPicker from './NativeColorPicker.svelte';
import { loadSpectrumColorPicker } from '$lib/utils/spectrumColorPicker';

vi.mock('$lib/utils/spectrumColorPicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/utils/spectrumColorPicker')>();

  return { loadSpectrumColorPicker: vi.fn(actual.loadSpectrumColorPicker) };
});

vi.mock('../../../stores/ui.store', async () => ({
  isMobile: (await import('svelte/store')).writable(false)
}));

const mobile = isMobile as Writable<boolean>;
let component: ReturnType<typeof mount> | undefined;

afterEach(async () => {
  if (component) await unmount(component);

  component = undefined;
  mobile.set(false);
});

it.each([false, true])(
  'opens the color controls and forwards edits (mobile: %s)',
  async (isMobile) => {
    mobile.set(isMobile);
    const onOpen = vi.fn();
    const onInput = vi.fn();
    const onChange = vi.fn();
    component = mount(NativeColorPicker, {
      target: document.body,
      props: { value: '#ff0000', ariaLabel: 'Pick color', onOpen, onInput, onChange }
    });

    expect(document.querySelector('sp-color-area')).toBeNull();

    document.querySelector<HTMLButtonElement>('[aria-label="Pick color"]')!.click();

    await vi.waitFor(() => expect(document.querySelector('sp-color-area')).not.toBeNull());

    const area = document.querySelector<HTMLElement>('sp-color-area')!;
    await customElements.whenDefined('sp-color-area');

    Object.assign(area, { color: '#00ff00' });
    area.dispatchEvent(new Event('input', { bubbles: true }));
    area.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onOpen).toHaveBeenCalledOnce();
    expect(onInput).toHaveBeenCalledWith('#00ff00');
    expect(onChange).toHaveBeenCalledWith('#00ff00');
  }
);

it('shows a failed download and allows the picker to be retried', async () => {
  vi.mocked(loadSpectrumColorPicker).mockRejectedValueOnce(new Error('Download failed'));
  component = mount(NativeColorPicker, {
    target: document.body,
    props: { value: '#ff0000', ariaLabel: 'Retry color', onInput: vi.fn() }
  });

  document.querySelector<HTMLButtonElement>('[aria-label="Retry color"]')!.click();

  await vi.waitFor(() =>
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load')
  );

  const retry = Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent === 'Retry'
  )!;
  retry.click();

  await vi.waitFor(() => expect(document.querySelector('sp-color-area')).not.toBeNull());

  expect(document.querySelector('[role="alert"]')).toBeNull();
});
