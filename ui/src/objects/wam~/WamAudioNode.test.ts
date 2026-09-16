import { describe, expect, it, vi } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import { WamAudioNode } from './WamAudioNode';

function createFakeGain() {
  return {
    gain: {
      setValueAtTime: vi.fn()
    },
    connect: vi.fn(),
    disconnect: vi.fn()
  };
}

function createFakeAudioContext(gains = [createFakeGain(), createFakeGain()]) {
  let gainIndex = 0;

  return {
    currentTime: 10,
    createGain: () => gains[gainIndex++] ?? createFakeGain()
  } as unknown as AudioContext;
}

function attachFakeWam(node: WamAudioNode, audioNode: Record<string, unknown>) {
  (node as unknown as { instance: { audioNode: Record<string, unknown> } }).instance = {
    audioNode
  };
}

describe('WamAudioNode message controls', () => {
  it('publishes only the simplified WAM control message schemas', () => {
    const messageInlet = WamAudioNode.inlets.find((inlet) => inlet.name === 'message');
    const schemas = messageInlet?.messages?.map(({ schema }) => schema) ?? [];
    const accepts = (message: Record<string, unknown>) =>
      schemas.some((schema) => Value.Check(schema, message));
    const controlTypes = schemas
      .map(
        (schema) =>
          (schema as { properties?: { type?: { const?: unknown } } }).properties?.type?.const
      )
      .slice(0, 8);

    expect(messageInlet?.description).toBe('message');
    expect(controlTypes).toEqual(['set', 'set', 'save', 'load', 'load', 'load', 'mute', 'unmute']);

    expect(accepts({ type: 'set', key: 'drive', value: 0.7 })).toBe(true);
    expect(accepts({ type: 'set', params: { drive: 0.7, tone: 0.35 } })).toBe(true);
    expect(accepts({ type: 'set', key: 'drive', value: 0.7, time: 12.5 })).toBe(true);
    expect(accepts({ type: 'save' })).toBe(true);
    expect(accepts({ type: 'load', url: 'https://example.com/wam/index.js' })).toBe(true);
    expect(accepts({ type: 'load', state: { drive: 0.7 } })).toBe(true);
    expect(
      accepts({
        type: 'load',
        url: 'https://example.com/wam/index.js',
        state: { drive: 0.7 }
      })
    ).toBe(true);
    expect(accepts({ type: 'mute' })).toBe(true);
    expect(accepts({ type: 'unmute' })).toBe(true);
  });

  it('sets one or more WAM parameters through the message inlet', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const setParameterValues = vi.fn();
    attachFakeWam(node, { setParameterValues });

    await node.send('message', { type: 'set', key: 'drive', value: 0.7 });
    await node.send('message', { type: 'set', params: { drive: 0.7, tone: 0.35 } });

    expect(setParameterValues).toHaveBeenNthCalledWith(1, {
      drive: { id: 'drive', value: 0.7, normalized: false }
    });
    expect(setParameterValues).toHaveBeenNthCalledWith(2, {
      drive: { id: 'drive', value: 0.7, normalized: false },
      tone: { id: 'tone', value: 0.35, normalized: false }
    });
  });

  it('sets a WAM parameter directly for settings controls', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const setParameterValues = vi.fn();
    attachFakeWam(node, { setParameterValues });

    await node.setParameter('drive', 0.42);

    expect(setParameterValues).toHaveBeenCalledWith({
      drive: { id: 'drive', value: 0.42, normalized: false }
    });
  });

  it('schedules WAM parameter events at absolute or relative automation times', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const scheduleEvents = vi.fn();
    attachFakeWam(node, { scheduleEvents });

    await node.send('message', {
      type: 'set',
      key: 'drive',
      value: 0.7,
      time: 12.5
    });
    await node.send('message', {
      type: 'set',
      key: 'drive',
      value: 0.7,
      time: 0.5,
      timeMode: 'relative'
    });

    expect(scheduleEvents).toHaveBeenNthCalledWith(1, {
      type: 'wam-automation',
      time: 12.5,
      data: { id: 'drive', value: 0.7, normalized: false }
    });
    expect(scheduleEvents).toHaveBeenNthCalledWith(2, {
      type: 'wam-automation',
      time: 10.5,
      data: { id: 'drive', value: 0.7, normalized: false }
    });
  });

  it('lists parameter IDs with their labels and current values', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const getParameterValues = vi.fn().mockResolvedValue({
      drive: { value: 0.7 },
      tone: { value: 0.35 }
    });
    attachFakeWam(node, {
      getParameterInfo: vi.fn().mockResolvedValue({
        drive: { label: 'Drive' },
        tone: { label: 'Tone' }
      }),
      getParameterValues
    });

    await expect(node.getParameters()).resolves.toEqual([
      { id: 'drive', label: 'Drive', value: 0.7 },
      { id: 'tone', label: 'Tone', value: 0.35 }
    ]);
    expect(getParameterValues).toHaveBeenCalledWith(false);
  });

  it('loads and saves WAM state through the runtime data binding', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const updates: Record<string, unknown>[] = [];
    const setState = vi.fn();
    const getState = vi.fn().mockResolvedValue({ drive: 0.7 });
    attachFakeWam(node, { setState, getState });
    node.bindRuntimeData({ initialData: {}, update: (update) => updates.push(update) });

    await node.send('message', { type: 'load', state: { drive: 0.35 } });
    await node.send('message', { type: 'save' });

    expect(setState).toHaveBeenCalledWith({ drive: 0.35 });
    expect(updates).toEqual([{ state: { drive: 0.35 } }, { state: { drive: 0.7 } }]);
  });

  it('does not persist state from a WAM that was replaced while its state API was pending', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const updates: Record<string, unknown>[] = [];
    let resolveState: (state: unknown) => void = () => {};
    const pendingState = new Promise<unknown>((resolve) => {
      resolveState = resolve;
    });
    attachFakeWam(node, { getState: () => pendingState });
    node.bindRuntimeData({ initialData: {}, update: (update) => updates.push(update) });

    const save = node.saveState();
    attachFakeWam(node, { getState: vi.fn() });
    resolveState({ drive: 0.7 });
    await save;

    expect(updates).toEqual([]);
  });

  it('does not persist replacement state after the active WAM changes', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const updates: Record<string, unknown>[] = [];
    let resolveSetState: () => void = () => {};
    const pendingSetState = new Promise<void>((resolve) => {
      resolveSetState = resolve;
    });
    attachFakeWam(node, { setState: () => pendingSetState });
    node.bindRuntimeData({ initialData: {}, update: (update) => updates.push(update) });

    const replaceState = (
      node as unknown as { loadState: (state: unknown) => Promise<void> }
    ).loadState({ drive: 0.7 });
    attachFakeWam(node, { setState: vi.fn() });
    resolveSetState();
    await replaceState;

    expect(updates).toEqual([]);
  });

  it('destroys a GUI created after it was unmounted', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const container = { append: vi.fn() } as unknown as HTMLElement;
    const gui = { remove: vi.fn() } as unknown as HTMLElement;
    const destroyGui = vi.fn();
    let resolveGui: (gui: HTMLElement) => void = () => {};
    const pendingGui = new Promise<HTMLElement>((resolve) => {
      resolveGui = resolve;
    });
    (node as unknown as { instance: Record<string, unknown> }).instance = {
      audioNode: {},
      createGui: () => pendingGui,
      destroyGui
    };

    const mount = node.mountGui(container);
    node.unmountGui();
    resolveGui(gui);
    await mount;

    expect(destroyGui).toHaveBeenCalledWith(gui);
    expect(container.append).not.toHaveBeenCalled();
  });

  it('loads a requested URL and controls the host output gain', async () => {
    const inputGain = createFakeGain();
    const outputGain = createFakeGain();
    const node = new WamAudioNode('wam-1', createFakeAudioContext([inputGain, outputGain]));
    const updates: Record<string, unknown>[] = [];
    const setUrl = vi.spyOn(node, 'setUrl').mockResolvedValue();
    node.bindRuntimeData({ initialData: {}, update: (update) => updates.push(update) });
    outputGain.gain.setValueAtTime.mockClear();

    await node.send('message', { type: 'load', url: 'https://example.com/wam/index.js' });
    await node.send('message', { type: 'mute' });
    await node.send('message', { type: 'unmute' });

    expect(setUrl).toHaveBeenCalledWith('https://example.com/wam/index.js');
    expect(outputGain.gain.setValueAtTime).toHaveBeenNthCalledWith(1, 0, 10);
    expect(outputGain.gain.setValueAtTime).toHaveBeenNthCalledWith(2, 1, 10);
    expect(updates).toEqual([{ muted: true }, { muted: false }]);
  });

  it('clears the saved state when loading a different WAM', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const updates: Record<string, unknown>[] = [];
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const load = vi
      .spyOn(node as unknown as { load: (url: string) => Promise<void> }, 'load')
      .mockResolvedValue();
    node.bindRuntimeData({
      initialData: { state: { drive: 0.7 } },
      update: (update) => updates.push(update)
    });

    await node.setUrl('https://example.com/another-wam/index.js');

    expect(updates).toEqual([
      { url: 'https://example.com/another-wam/index.js', state: undefined }
    ]);
    expect(load).toHaveBeenCalledWith('https://example.com/another-wam/index.js');
    debug.mockRestore();
  });

  it('loads a WAM URL with its supplied state', async () => {
    const node = new WamAudioNode('wam-1', createFakeAudioContext());
    const updates: Record<string, unknown>[] = [];
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const load = vi
      .spyOn(node as unknown as { load: (url: string, state?: unknown) => Promise<void> }, 'load')
      .mockResolvedValue();
    node.bindRuntimeData({ initialData: {}, update: (update) => updates.push(update) });

    const state = { drive: 0.7 };
    await node.send('message', {
      type: 'load',
      url: 'https://example.com/wam/index.js',
      state
    });

    expect(updates).toEqual([{ url: 'https://example.com/wam/index.js', state }]);
    expect(load).toHaveBeenCalledWith('https://example.com/wam/index.js', state);
    debug.mockRestore();
  });
});
