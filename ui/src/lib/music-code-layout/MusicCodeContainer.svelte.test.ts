import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { fromStore, writable } from 'svelte/store';
import { page } from '@vitest/browser/context';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import MusicCodeContainerHarness from './test-fixtures/MusicCodeContainerHarness.svelte';
import type { MusicCodeLayoutData } from './music-code-layout';
import { defaultEditorLayout } from '../../stores/editor-layout-settings.store';

const data = writable<MusicCodeLayoutData>({});
const value = writable('SinOsc osc => dac;\n1::second => now;');
const expanded = writable(false);
const dataSource = fromStore(data);
const valueSource = fromStore(value);
const expandedSource = fromStore(expanded);
const onMount = vi.fn();
const onDestroy = vi.fn();
const onCommit = vi.fn();
const bus = PatchiesEventBus.getInstance();

vi.mock('@xyflow/svelte', async () => ({
  NodeResizer: (await import('./test-fixtures/MockNodeResizer.svelte')).default,
  useViewport: () => ({ current: { x: 0, y: 0, zoom: 0.5 } }),
  useUpdateNodeInternals: () => () => {},
  useSvelteFlow: () => ({
    updateNode: () => {},
    updateNodeData: (_id: string, updates: MusicCodeLayoutData) =>
      data.update((current) => ({ ...current, ...updates }))
  })
}));

vi.mock('$lib/codemirror/language', () => ({ loadLanguageExtension: async () => [] }));

let component: ReturnType<typeof mount> | undefined;

const button = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

const body = () => document.querySelector<HTMLElement>('.music-code-body')!;
const container = () => document.querySelector<HTMLElement>('.music-code-container')!;
const content = () => document.querySelector<HTMLElement>('.cm-content')!;

beforeEach(async () => {
  await page.viewport(800, 500);
  defaultEditorLayout.set('inline');
  data.set({});
  value.set('SinOsc osc => dac;\n1::second => now;');
  expanded.set(false);
  onMount.mockClear();
  onDestroy.mockClear();
  onCommit.mockClear();
  bus.addEventListener('nodeDataCommit', onCommit);

  component = mount(MusicCodeContainerHarness, {
    target: document.body,
    props: {
      get data() {
        return dataSource.current;
      },
      get value() {
        return valueSource.current;
      },
      get expanded() {
        return expandedSource.current;
      },
      onExpand: () => expanded.set(true),
      onMount,
      onDestroy
    }
  });

  await vi.waitFor(() => expect(content()).not.toBeNull());
});

afterEach(async () => {
  if (component) await unmount(component);
  component = undefined;
  bus.removeEventListener('nodeDataCommit', onCommit);
});

it('keeps its editor mounted through compact inspection and restores the saved size', async () => {
  data.set({ editorSize: { width: 520, height: 180 } });
  await tick();

  const originalContent = content();
  expect(container().getBoundingClientRect().width).toBe(520);
  expect(body().getBoundingClientRect().height).toBe(180);
  expect(document.querySelector('button')?.textContent).toBe('Replace');

  button('Editor options').click();
  await page.getByRole('button', { name: 'Hide Code', exact: true }).click();
  await tick();

  await vi.waitFor(() => expect(body().getBoundingClientRect().height).toBe(0));
  expect(container().getBoundingClientRect().height).toBeLessThan(60);
  expect(onDestroy).not.toHaveBeenCalled();

  value.set('updated while compact');
  button('Edit code').click();
  await tick();

  expect(content()).toBe(originalContent);
  expect(content().textContent).toBe('updated while compact');
  expect(body().getBoundingClientRect().height).toBe(180);
  expect(body().getBoundingClientRect().left).toBeGreaterThan(
    container().getBoundingClientRect().right
  );

  expect(document.querySelector('button[aria-label="Keep editor in patch"]')).toBeNull();
  button('Floating editor options').click();
  await page.getByRole('button', { name: 'Keep Editor in Patch', exact: true }).click();
  await tick();

  expect(container().getBoundingClientRect().width).toBe(520);
  expect(body().getBoundingClientRect().height).toBe(180);
  expect(content()).toBe(originalContent);
  expect(onMount).toHaveBeenCalledTimes(1);
  expect(onCommit.mock.calls.map(([event]) => event.newValue)).toEqual([true, false]);
});

it('scrolls long code without growing the viewport or hiding runtime actions', async () => {
  const originalHeight = container().getBoundingClientRect().height;
  value.set(Array.from({ length: 100 }, (_, index) => `// line ${index}`).join('\n'));
  await tick();

  await vi.waitFor(() => {
    const scroller = document.querySelector<HTMLElement>('.cm-scroller')!;
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
  });

  expect(body().getBoundingClientRect().height).toBe(240);
  expect(container().getBoundingClientRect().height).toBe(originalHeight);
  expect(document.querySelector('button')?.getBoundingClientRect().bottom).toBeLessThan(
    body().getBoundingClientRect().top
  );
});

it('toggles the standard resizer while retaining the chosen editor size', async () => {
  data.set({ editorSize: { width: 320, height: 130 } });
  await tick();
  expect(document.querySelector('.mock-node-resizer')).not.toBeNull();

  button('Editor options').click();
  await page.getByRole('button', { name: 'Disable Resizing' }).click();
  await vi.waitFor(() => expect(document.querySelector('.mock-node-resizer')).toBeNull());

  expect(body().getBoundingClientRect().height).toBe(130);
  expect(dataSource.current.editorResizingEnabled).toBe(false);

  button('Editor options').click();
  await page.getByRole('button', { name: 'Enable Resizing' }).click();
  await vi.waitFor(() => expect(document.querySelector('.mock-node-resizer')).not.toBeNull());
  expect(dataSource.current.editorSize).toEqual({ width: 320, height: 130 });
});

it('returns from expansion to the previous compact layout and size', async () => {
  data.set({ editorCollapsed: true, editorSize: { width: 480, height: 160 } });
  await tick();

  button('Edit code').click();
  await tick();
  expect(document.querySelector('button[aria-label="Expand editor"]')).toBeNull();

  button('Floating editor options').click();
  await page.getByRole('button', { name: 'Expand Editor', exact: true }).click();
  await tick();
  expect(expandedSource.current).toBe(true);

  expanded.set(false);
  await tick();
  expect(body().getBoundingClientRect().height).toBe(160);
  expect(dataSource.current).toEqual({
    editorCollapsed: true,
    editorSize: { width: 480, height: 160 }
  });
  expect(onDestroy).not.toHaveBeenCalled();
});

it('uses the JS compact code button and its preferred-layout and Shift-click behavior', async () => {
  data.set({ editorCollapsed: true });
  defaultEditorLayout.set('overlay');
  await tick();

  button('Edit code').click();
  await tick();
  expect(expandedSource.current).toBe(true);
  expect(body().getBoundingClientRect().height).toBe(0);

  expanded.set(false);
  button('Edit code').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
  await tick();
  expect(expandedSource.current).toBe(false);
  expect(body().getBoundingClientRect().height).toBe(240);
  expect(container().getBoundingClientRect().width).toBe(100);
});
