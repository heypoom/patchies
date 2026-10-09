import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { fromStore, get, writable } from 'svelte/store';
import { page, userEvent } from '@vitest/browser/context';
import MusicNodeHarness from './test-fixtures/MusicNodeHarness.svelte';
import type { MusicCodeLayoutData } from './music-code-layout';
import type { StrudelNodeData } from '$objects/strudel/strudel-settings';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { editorFontSize, editorFullscreenFontSize } from '../../stores/editor.store';
import {
  activeCodeEditorTarget,
  closeCodeEditorOverlay
} from '../../stores/code-editor-layout.store';
import { closeDetachedStrudelEditor } from '../../stores/detached-strudel-editor.store';

const data = writable<StrudelNodeData & { expr: string }>({
  expr: 'initial',
  code: 'initial'
});
const dataSource = fromStore(data);
const callbacks = new Map<string, (message: unknown, meta: { inlet: number }) => void>();
const send = vi.fn();
const removeNodeById = vi.fn();
const resume = vi.fn();
const setSyncTransport = vi.fn();
const shreds = writable([{ id: 1, code: 'running' }]);

vi.mock('@xyflow/svelte', async () => ({
  NodeResizer: (await import('./test-fixtures/MockNodeResizer.svelte')).default,
  useViewport: () => ({ current: { zoom: 1 } }),
  useUpdateNodeInternals: () => () => {},
  useSvelteFlow: () => ({
    updateNode: () => {},
    updateNodeData: (_id: string, updates: MusicCodeLayoutData) =>
      data.update((current) => ({ ...current, ...updates }))
  })
}));

vi.mock('$lib/audio/v2/AudioService', () => ({
  AudioService: {
    getInstance: () => ({
      createNode: () => {},
      removeNodeById,
      send,
      getNodeById: () => ({
        send,
        resume,
        setSyncTransport,
        getIsPaused: () => true,
        shredsStore: shreds
      })
    })
  }
}));

vi.mock('$lib/messages/MessageContext', () => ({
  MessageContext: class {
    constructor(nodeId: string) {
      this.queue = {
        addCallback: (callback: (message: unknown, meta: { inlet: number }) => void) =>
          callbacks.set(nodeId, callback),
        removeCallback: () => callbacks.delete(nodeId)
      };
    }
    queue;
    destroy() {}
  }
}));

vi.mock('$lib/composables/useAudioOutletWarning', () => ({
  useAudioOutletWarning: () => ({
    warnIfNoAudioConnection: () => {},
    warnIfNoOutletConnection: () => {}
  })
}));
vi.mock('$lib/codemirror/language', () => ({
  loadLanguageExtension: async (language: string) => {
    const { javascript } = await import('@codemirror/lang-javascript');

    return language === 'javascript' ? javascript() : [];
  }
}));
vi.mock('$lib/canvas/SurfaceOverlay', () => ({ isFullscreenActive: writable(false) }));
vi.mock('$lib/strudel/StrudelTransportSync', () => ({
  StrudelTransportSync: class {
    subscribe() {}
    unsubscribe() {}
    destroy() {}
  }
}));
vi.mock(
  '$lib/components/TypedHandle.svelte',
  () => import('./test-fixtures/MockNodeAuxiliary.svelte')
);
vi.mock(
  '$lib/components/VirtualConsole.svelte',
  () => import('./test-fixtures/MockNodeAuxiliary.svelte')
);
vi.mock(
  '$lib/components/StrudelEditor.svelte',
  () => import('./test-fixtures/MockStrudelEditor.svelte')
);

let component: ReturnType<typeof mount> | undefined;

beforeEach(async () => {
  editorFontSize.set(12);
  editorFullscreenFontSize.set(28);
  await page.viewport(800, 500);
  data.set({ expr: 'initial', code: 'initial' });
  callbacks.clear();
  send.mockClear();
  resume.mockClear();
  setSyncTransport.mockClear();
  removeNodeById.mockClear();
});

afterEach(async () => {
  if (component) await unmount(component);
  component = undefined;
  closeCodeEditorOverlay();
  closeDetachedStrudelEditor();
});

it.each(['csound~', 'chuck~'] as const)(
  'updates %s code while compact and runs the stored code',
  async (kind) => {
    data.set({ expr: 'initial', code: 'initial', editorCollapsed: true });

    component = mount(MusicNodeHarness, {
      target: document.body,
      props: {
        kind,
        get data() {
          return dataSource.current;
        }
      }
    });

    await vi.waitFor(() => expect(callbacks.has('music-1')).toBe(true));
    callbacks.get('music-1')!({ type: 'setCode', value: '// new program' }, { inlet: 1 });

    expect(dataSource.current.expr).toBe('// new program');
    expect(send).not.toHaveBeenCalled();
    expect(removeNodeById).not.toHaveBeenCalled();

    callbacks.get('music-1')!({ type: 'bang' }, { inlet: 1 });
    await tick();

    if (kind === 'csound~') {
      expect(send).toHaveBeenCalledWith('run', '// new program');
    } else {
      expect(send).toHaveBeenCalledWith('music-1', 'replace', '// new program');
    }

    await page.getByRole('button', { name: 'Edit code', exact: true }).click();
    await vi.waitFor(() =>
      expect(document.querySelector('.cm-content')?.textContent).toBe('// new program')
    );

    const expectHighlighting = () => {
      const content = document.querySelector<HTMLElement>('.cm-content')!;
      const comment = content.querySelector<HTMLElement>('.cm-line span');

      expect(comment).not.toBeNull();
      expect(getComputedStyle(comment!).color).not.toBe(getComputedStyle(content).color);
    };

    await vi.waitFor(expectHighlighting);
    await page.getByRole('button', { name: 'Floating editor options', exact: true }).click();
    await page.getByRole('button', { name: 'Keep Editor in Patch', exact: true }).click();
    await vi.waitFor(expectHighlighting);
    await page.getByRole('button', { name: 'Editor options', exact: true }).click();
    await page.getByRole('button', { name: 'Expand Editor', exact: true }).click();

    expect(get(activeCodeEditorTarget)).toMatchObject({ language: 'javascript' });
  }
);

it.each([false, true])(
  'toggles Csound transport sync directly in overflow (compact: %s)',
  async (editorCollapsed) => {
    data.set({ expr: 'initial', code: 'initial', editorCollapsed });
    const onCommit = vi.fn();
    const bus = PatchiesEventBus.getInstance();
    bus.addEventListener('nodeDataCommit', onCommit);

    try {
      component = mount(MusicNodeHarness, {
        target: document.body,
        props: {
          kind: 'csound~',
          get data() {
            return dataSource.current;
          }
        }
      });

      await page.getByRole('button', { name: 'Editor options', exact: true }).click();
      expect(document.querySelector('[data-slot="popover-content"]')?.textContent).not.toContain(
        'Settings'
      );
      const menu = document.querySelector('[data-slot="popover-content"]')!;
      expect(
        Array.from(menu.querySelectorAll('button'), (button) => button.textContent?.trim())
      ).toEqual([
        'Sync to transport',
        'Expand Editor',
        editorCollapsed ? 'Show Editor in Patch' : 'Hide Code',
        'Disable Resizing'
      ]);
      await page.getByRole('button', { name: 'Sync to transport', exact: true }).click();

      expect(dataSource.current.syncTransport).toBe(true);
      expect(setSyncTransport).toHaveBeenLastCalledWith(true);
      expect(onCommit.mock.calls.at(-1)?.[0]).toMatchObject({
        dataKey: 'syncTransport',
        oldValue: false,
        newValue: true
      });

      await page.getByRole('button', { name: 'Editor options', exact: true }).click();
      await page.getByRole('button', { name: 'Unsync from transport', exact: true }).click();
      expect(dataSource.current.syncTransport).toBe(false);
      expect(setSyncTransport).toHaveBeenLastCalledWith(false);
    } finally {
      bus.removeEventListener('nodeDataCommit', onCommit);
    }
  }
);

it('keeps ChucK actions visible and restores the inline editor after fullscreen', async () => {
  component = mount(MusicNodeHarness, {
    target: document.body,
    props: {
      kind: 'chuck~',
      get data() {
        return dataSource.current;
      }
    }
  });

  await vi.waitFor(() => expect(document.querySelector('.cm-content')).not.toBeNull());
  expect(document.querySelector('button[aria-label="Replace ChucK shred"]')).not.toBeNull();
  expect(document.querySelector('button[aria-label="Add ChucK shred"]')).not.toBeNull();
  expect(document.querySelector('button[aria-label="Remove ChucK shred"]')).not.toBeNull();

  await page.getByRole('button', { name: 'ChucK settings', exact: true }).click();
  await vi.waitFor(() =>
    expect(document.querySelector('button[aria-label="Close settings"]')).not.toBeNull()
  );
  await page.getByRole('button', { name: 'ChucK settings', exact: true }).click();
  await vi.waitFor(() =>
    expect(document.querySelector('button[aria-label="Close settings"]')).toBeNull()
  );

  await page.screenshot({
    element: document.querySelector('.dark')!,
    path: '/tmp/patchies-chuck-floating-editor.png'
  });
  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  expect(
    Array.from(
      document.querySelector('[data-slot="popover-content"]')!.querySelectorAll('button'),
      (button) => button.textContent?.trim()
    )
  ).toEqual(['Expand Editor', 'Hide Code', 'Disable Resizing']);
  await page.getByRole('button', { name: 'Expand Editor', exact: true }).click();
  await tick();

  expect(document.querySelector('.cm-content')).toBeNull();
  expect(get(activeCodeEditorTarget)).toMatchObject({
    nodeId: 'music-1',
    dataKey: 'expr',
    nodeType: 'chuck~',
    mode: 'overlay'
  });
  expect(dataSource.current.editorCollapsed).toBeUndefined();

  closeCodeEditorOverlay();
  await vi.waitFor(() => expect(document.querySelector('.cm-content')).not.toBeNull());
  expect(
    document.querySelector<HTMLElement>('.music-code-body')!.getBoundingClientRect().height
  ).toBe(240);
});

it('keeps Strudel mounted through compact mode and its fullscreen portal', async () => {
  component = mount(MusicNodeHarness, {
    target: document.body,
    props: {
      kind: 'strudel',
      get data() {
        return dataSource.current;
      }
    }
  });

  await tick();
  const editor = document.querySelector('.mock-strudel-editor');

  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  await page.getByRole('button', { name: 'Hide Code', exact: true }).click();
  callbacks.get('music-1')!({ type: 'setCode', value: 'new pattern' }, { inlet: 0 });
  await tick();
  expect(document.querySelector('.mock-strudel-editor')).toBe(editor);
  expect(editor?.textContent).toBe('new pattern');

  expect(document.querySelector('button[aria-label="Strudel settings"]')).toBeNull();
  await page.getByRole('button', { name: 'Edit code', exact: true }).click();
  const inspectionBounds = document.querySelector('.music-code-viewport')!.getBoundingClientRect();

  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await vi.waitFor(() =>
    expect(document.querySelector('input[aria-label="Font size"]')).not.toBeNull()
  );
  await vi.waitFor(() => {
    const panel = document
      .querySelector('input[aria-label="Font size"]')!
      .closest('[data-strudel-panel]')!;
    const bounds = panel.getBoundingClientRect();

    expect(bounds.left).toBeCloseTo(inspectionBounds.left, 0);
    expect(bounds.top).toBeCloseTo(inspectionBounds.top, 0);
    expect(document.querySelector('.music-code-viewport')!.getBoundingClientRect().height).toBe(0);
  });

  await page.getByRole('button', { name: 'Edit code', exact: true }).click();
  await vi.waitFor(() =>
    expect(document.querySelector('input[aria-label="Font size"]')).toBeNull()
  );
  await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
  await vi.waitFor(() =>
    expect(document.querySelector('input[aria-label="Font size"]')).not.toBeNull()
  );
  expect(document.querySelector('.mock-strudel-editor')).toBe(editor);
  expect(
    document.querySelector('.music-code-viewport')!.getBoundingClientRect().height
  ).toBeGreaterThan(0);
  await vi.waitFor(() => {
    const button = document.querySelector('button[aria-label="Strudel settings"]')!;
    const panel = document
      .querySelector('input[aria-label="Font size"]')!
      .closest('[data-strudel-panel]')!;

    expect(panel.getBoundingClientRect().left).toBeCloseTo(button.getBoundingClientRect().left, 0);
  });

  await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
  await vi.waitFor(() =>
    expect(document.querySelector('input[aria-label="Font size"]')).toBeNull()
  );
  expect(
    document.querySelector('.music-code-viewport')!.getBoundingClientRect().height
  ).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Close code inspection', exact: true }).click();

  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Editor', exact: true }).click();
  await tick();
  expect(document.querySelector('.strudel-detached-editor')?.parentElement).toBe(document.body);
  expect(document.querySelector('.mock-strudel-editor')).toBe(editor);

  await page.getByRole('button', { name: 'Close expanded Strudel editor', exact: true }).click();
  await tick();
  expect(document.querySelector('.mock-strudel-editor')).toBe(editor);
  expect(document.querySelector('.strudel-detached-editor')).toBeNull();
  expect(
    document.querySelector<HTMLElement>('.music-code-body')!.getBoundingClientRect().height
  ).toBe(0);
  expect(removeNodeById).not.toHaveBeenCalled();
  await page.screenshot({
    element: document.querySelector('.dark')!,
    path: '/tmp/patchies-strudel-compact.png'
  });
});

it('shares Strudel settings with messages, tracks edits, and switches between settings and console', async () => {
  const onCommit = vi.fn();
  const bus = PatchiesEventBus.getInstance();
  bus.addEventListener('nodeDataCommit', onCommit);
  component = mount(MusicNodeHarness, {
    target: document.body,
    props: {
      kind: 'strudel',
      get data() {
        return dataSource.current;
      }
    }
  });

  try {
    await page.getByRole('button', { name: 'Editor options', exact: true }).click();
    expect(
      Array.from(
        document.querySelector('[data-slot="popover-content"]')!.querySelectorAll('button'),
        (button) => button.textContent?.trim()
      )
    ).toEqual(['Mute', 'Show Console', 'Expand Editor', 'Hide Code']);
    await page.getByRole('button', { name: 'Mute', exact: true }).click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-slot="popover-content"]')).toBeNull()
    );
    await page.getByRole('button', { name: 'Editor options', exact: true }).click();
    expect(document.querySelector('[data-slot="popover-content"]')?.textContent).toContain(
      'Unmute'
    );
    await userEvent.keyboard('{Escape}');

    await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
    expect(
      document.querySelector('section[aria-label="Strudel settings"]')?.textContent
    ).not.toContain('Mute');
    const editorBounds = document.querySelector('.music-code-viewport')!.getBoundingClientRect();
    const settingsPanel = document.querySelector('section[aria-label="Strudel settings"]')!;
    const panelBounds = settingsPanel.getBoundingClientRect();

    expect(panelBounds.left).toBeCloseTo(editorBounds.right + 12, 0);
    expect(panelBounds.top).toBeCloseTo(editorBounds.top, 0);
    await page.getByRole('button', { name: 'Close Strudel settings', exact: true }).click();
    expect(document.querySelector('section[aria-label="Strudel settings"]')).toBeNull();
    await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
    await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
    expect(document.querySelector('section[aria-label="Strudel settings"]')).toBeNull();
    await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();

    // Editing code keeps the docked settings panel open.
    await page.getByText('initial', { exact: true }).click();
    expect(document.querySelector('section[aria-label="Strudel settings"]')).not.toBeNull();

    await page.getByRole('checkbox', { name: 'Sync to transport', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Resizing', exact: true }).click();
    expect(dataSource.current).toMatchObject({
      muted: true,
      syncTransport: true,
      editorResizingEnabled: false
    });
    expect(document.querySelector('.mock-node-resizer')).toBeNull();
    expect(onCommit.mock.calls.map(([event]) => event.dataKey)).toEqual([
      'muted',
      'syncTransport',
      'editorResizingEnabled'
    ]);

    callbacks.get('music-1')!({ type: 'setFontSize', value: 26 }, { inlet: 0 });
    callbacks.get('music-1')!({ type: 'setFontFamily', value: 'Monaco, monospace' }, { inlet: 0 });
    await tick();
    const sizeInput = document.querySelector<HTMLInputElement>('input[aria-label="Font size"]')!;
    const familyInput = document.querySelector<HTMLInputElement>(
      'input[aria-label="Font family"]'
    )!;
    expect(sizeInput.value).toBe('26');
    expect(familyInput.value).toBe('Monaco, monospace');

    sizeInput.focus();
    sizeInput.value = '30';
    sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    sizeInput.blur();
    expect(dataSource.current.fontSize).toBe(30);
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ dataKey: 'fontSize', oldValue: 26, newValue: 30 })
    );

    await page.getByRole('button', { name: 'Custom Styles…', exact: true }).click();
    await vi.waitFor(() => expect(document.querySelector('.cm-content')).not.toBeNull());
    callbacks.get('music-1')!(
      { type: 'setStyles', value: { container: 'padding: 16px;' } },
      { inlet: 0 }
    );
    await vi.waitFor(() =>
      expect(document.querySelector('.cm-content')?.textContent).toBe('padding: 16px;')
    );
    const cssEditor = document.querySelector<HTMLElement>('.cm-content')!;
    cssEditor.focus();
    await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}');
    await userEvent.keyboard('opacity: 0.8;');
    await vi.waitFor(() => expect(dataSource.current.styles?.container).toBe('opacity: 0.8;'));
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    expect(onCommit.mock.calls.some(([event]) => event.dataKey === 'styles')).toBe(true);

    await page.getByRole('button', { name: 'Editor options', exact: true }).click();
    await page.getByRole('button', { name: 'Show Console', exact: true }).click();
    expect(dataSource.current.showConsole).toBe(true);
    await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
    expect(dataSource.current.showConsole).toBe(false);
    expect(document.querySelector('input[aria-label="Font size"]')).not.toBeNull();
    data.update((value) => ({ ...value, showConsole: true }));
    await vi.waitFor(() =>
      expect(document.querySelector('input[aria-label="Font size"]')).toBeNull()
    );

    await page.getByRole('button', { name: 'Editor options', exact: true }).click();
    await page.getByRole('button', { name: 'Hide Console', exact: true }).click();
    await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
    await page.screenshot({ path: '/tmp/patchies-strudel-settings.png' });
  } finally {
    bus.removeEventListener('nodeDataCommit', onCommit);
  }
});

it('exposes Strudel settings and overflow in fullscreen and dismisses panels before the editor', async () => {
  component = mount(MusicNodeHarness, {
    target: document.body,
    props: {
      kind: 'strudel',
      get data() {
        return dataSource.current;
      }
    }
  });

  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Editor', exact: true }).click();
  expect(document.querySelector('.strudel-detached-editor')).not.toBeNull();
  await vi.waitFor(() => {
    expect(document.querySelector('input[aria-label="Expanded font size"]')).not.toBeNull();
    const panel = document.querySelector<HTMLElement>('section[aria-label="Strudel settings"]')!;
    expect(panel.getBoundingClientRect().right).toBe(window.innerWidth - 24);
  });
  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  await vi.waitFor(() =>
    expect(document.querySelector('input[aria-label="Expanded font size"]')).toBeNull()
  );
  expect(document.querySelector('.strudel-detached-editor')).not.toBeNull();
  const menu = document.querySelector('[data-slot="popover-content"]')!;

  expect(
    Array.from(menu.querySelectorAll('button'), (button) => button.textContent?.trim())
  ).toEqual(['Mute', 'Show Console']);

  await userEvent.keyboard('{Escape}');
  await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();

  await page.screenshot({ path: '/tmp/patchies-strudel-fullscreen-settings.png' });
  await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
  await vi.waitFor(() =>
    expect(document.querySelector('input[aria-label="Expanded font size"]')).toBeNull()
  );
  await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
  await vi.waitFor(() =>
    expect(document.querySelector('input[aria-label="Expanded font size"]')).not.toBeNull()
  );
  await userEvent.keyboard('{Escape}');
  await vi.waitFor(() =>
    expect(document.querySelector('input[aria-label="Expanded font size"]')).toBeNull()
  );
  expect(document.querySelector('.strudel-detached-editor')).not.toBeNull();

  await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
  await page.getByRole('button', { name: 'Custom Styles…', exact: true }).click();
  await vi.waitFor(() => expect(document.querySelector('.cm-content')).not.toBeNull());
  await page.screenshot({ path: '/tmp/patchies-strudel-fullscreen-styles.png' });
  await userEvent.keyboard('{Escape}');
  await vi.waitFor(() => expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull());
  expect(document.querySelector('.strudel-detached-editor')).not.toBeNull();

  await page.getByRole('button', { name: 'Close expanded Strudel editor', exact: true }).click();
  await vi.waitFor(() => expect(document.querySelector('.strudel-detached-editor')).toBeNull());
  expect(dataSource.current.editorCollapsed).not.toBe(true);
});

it('keeps normal and expanded Strudel font sizes separate and expanded text larger', async () => {
  data.update((value) => ({ ...value, fontSize: 14 }));
  component = mount(MusicNodeHarness, {
    target: document.body,
    props: {
      kind: 'strudel',
      get data() {
        return dataSource.current;
      }
    }
  });
  const editorFont = () =>
    getComputedStyle(document.querySelector('.mock-strudel-editor')!).fontSize;
  const onCommit = vi.fn();
  const bus = PatchiesEventBus.getInstance();
  bus.addEventListener('nodeDataCommit', onCommit);

  try {
    await vi.waitFor(() => expect(editorFont()).toBe('14px'));
    await page.getByRole('button', { name: 'Editor options', exact: true }).click();
    await page.getByRole('button', { name: 'Expand Editor', exact: true }).click();
    await vi.waitFor(() => expect(editorFont()).toBe('28px'));
    const expandedInput = document.querySelector<HTMLInputElement>(
      'input[aria-label="Expanded font size"]'
    )!;
    expect(expandedInput.value).toBe('28');

    expandedInput.focus();
    expandedInput.value = '36';
    expandedInput.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expandedInput.blur();
    expect(editorFont()).toBe('36px');
    expect(dataSource.current.fontSize).toBe(14);
    expect(dataSource.current.expandedFontSize).toBe(36);
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ dataKey: 'expandedFontSize', oldValue: undefined, newValue: 36 })
    );

    callbacks.get('music-1')!({ type: 'setFontSize', value: 18 }, { inlet: 0 });
    await tick();
    expect(editorFont()).toBe('36px');
    expect(expandedInput.value).toBe('36');
    callbacks.get('music-1')!({ type: 'setExpandedFontSize', value: 44 }, { inlet: 0 });
    await tick();
    expect(editorFont()).toBe('44px');
    expect(expandedInput.value).toBe('44');

    await page.getByRole('button', { name: 'Close expanded Strudel editor', exact: true }).click();
    await vi.waitFor(() => expect(editorFont()).toBe('18px'));
    await page.getByRole('button', { name: 'Strudel settings', exact: true }).click();
    const normalInput = document.querySelector<HTMLInputElement>('input[aria-label="Font size"]')!;
    expect(normalInput.value).toBe('18');
    normalInput.focus();
    normalInput.value = '20';
    normalInput.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    normalInput.blur();
    expect(editorFont()).toBe('20px');
    expect(dataSource.current.expandedFontSize).toBe(44);

    await page.getByRole('button', { name: 'Editor options', exact: true }).click();
    await page.getByRole('button', { name: 'Expand Editor', exact: true }).click();
    await vi.waitFor(() => expect(editorFont()).toBe('44px'));
    callbacks.get('music-1')!({ type: 'setFontSize', value: 50 }, { inlet: 0 });
    await tick();
    expect(editorFont()).toBe('51px');
    expect(
      document.querySelector<HTMLInputElement>('input[aria-label="Expanded font size"]')!.value
    ).toBe('51');
  } finally {
    bus.removeEventListener('nodeDataCommit', onCommit);
  }
});

it('applies Strudel container styles to the outer chrome within fixed editor bounds', async () => {
  component = mount(MusicNodeHarness, {
    target: document.body,
    props: {
      kind: 'strudel',
      get data() {
        return dataSource.current;
      }
    }
  });

  await vi.waitFor(() => expect(callbacks.has('music-1')).toBe(true));
  callbacks.get('music-1')!(
    {
      type: 'setStyles',
      value: { container: 'border: none; padding: 16px; background-color: rgb(12, 34, 56);' }
    },
    { inlet: 0 }
  );

  const viewport = () => document.querySelector<HTMLElement>('.music-code-viewport')!;
  const expectStyledViewport = () => {
    const style = getComputedStyle(viewport());
    expect(style.borderTopWidth).toBe('0px');
    expect(style.paddingLeft).toBe('16px');
    expect(style.backgroundColor).toBe('rgb(12, 34, 56)');
    expect(viewport().getBoundingClientRect().width).toBe(400);
    expect(viewport().getBoundingClientRect().height).toBe(242);
    expect(document.querySelector('.music-code-body')!.getBoundingClientRect().height).toBe(210);
  };

  await vi.waitFor(expectStyledViewport);
  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  await page.getByRole('button', { name: 'Hide Code', exact: true }).click();
  await page.getByRole('button', { name: 'Edit code', exact: true }).click();
  await vi.waitFor(expectStyledViewport);
  expect(document.querySelector('.music-code-container')!.getBoundingClientRect().height).toBe(42);

  await page.getByRole('button', { name: 'Editor options', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Editor', exact: true }).click();
  await vi.waitFor(() => {
    const detached = document.querySelector<HTMLElement>('.strudel-detached-editor')!;
    expect(getComputedStyle(detached).borderTopWidth).toBe('0px');
    expect(getComputedStyle(detached).paddingLeft).toBe('16px');
    expect(getComputedStyle(detached).backgroundColor).toBe('rgb(12, 34, 56)');
  });
  await page.getByRole('button', { name: 'Close expanded Strudel editor', exact: true }).click();
  await vi.waitFor(expectStyledViewport);
});
