import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

import { ChuckNode } from './ChuckNode';

const mockChuck = vi.hoisted(() => ({
  runCode: vi.fn(),
  now: vi.fn(),
  removeShred: vi.fn(),
  removeLastCode: vi.fn(),
  clearChuckInstance: vi.fn(),
  clearGlobals: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  addEventListener: vi.fn()
}));

const mockChuckInit = vi.hoisted(() => vi.fn());
vi.mock('webchuck', () => ({ Chuck: { init: mockChuckInit } }));

function createAudioContext() {
  const gain = {
    value: 1,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn()
  };
  const outputGain = {
    gain,
    connect: vi.fn(),
    disconnect: vi.fn(),
    channelCount: 2
  };

  return {
    outputGain,
    gain,
    audioContext: {
      currentTime: 10,
      createGain: () => outputGain
    } as unknown as AudioContext
  };
}

describe('ChuckNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockChuckInit.mockResolvedValue(mockChuck);
    mockChuck.runCode.mockResolvedValue(12);
    mockChuck.now.mockResolvedValue(128);
    mockChuck.removeShred.mockResolvedValue(12);
    mockChuck.removeLastCode.mockResolvedValue(12);
  });

  it('rebuilds the ChucK VM when removing a shred', async () => {
    const { audioContext, outputGain } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);

    await node.addShredCode('adc => dac;');

    await node.removeShred(1);

    expect(mockChuck.removeShred).not.toHaveBeenCalled();
    expect(mockChuck.clearChuckInstance).toHaveBeenCalled();
    expect(mockChuck.disconnect).toHaveBeenCalledWith(outputGain);
    expect(get(node.shredsStore)).toEqual([]);
  });

  it('fades the ChucK output around adc remove rebuilds', async () => {
    const { audioContext, gain, outputGain } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);

    await node.addShredCode('adc => dac;');
    await node.removeShred(1);

    expect(mockChuck.disconnect).toHaveBeenCalledWith(outputGain);
    expect(gain.cancelScheduledValues).toHaveBeenCalledWith(10);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(1, 10);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 10);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10.18);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 10.2);
  });

  it('uses native shred removal without fading for non-adc shreds', async () => {
    const { audioContext, gain } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);

    await node.addShredCode('SinOsc s => dac; while (true) 1::second => now;');
    await node.removeShred(1);

    expect(mockChuck.removeShred).toHaveBeenCalledWith(12);
    expect(mockChuck.disconnect).not.toHaveBeenCalled();
    expect(gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(get(node.shredsStore)).toEqual([]);
  });

  it('tracks duplicate ChucK shred IDs as separate Patchies runs', async () => {
    const { audioContext } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);

    mockChuck.runCode.mockResolvedValue(1);

    await node.addShredCode('adc => dac;');
    await node.addShredCode('adc => dac;');
    await node.removeShred(1);

    expect(mockChuck.removeShred).not.toHaveBeenCalled();

    expect(get(node.shredsStore)).toEqual([
      {
        id: 2,
        chuckId: 1,
        time: 128,
        code: 'adc => dac;'
      }
    ]);
  });

  it('reconnects audio input after rebuilding the ChucK VM', async () => {
    const { audioContext } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);
    const sourceAudioNode = { connect: vi.fn() } as unknown as AudioNode;

    node.connectFrom({
      nodeId: 'source-1',
      audioNode: sourceAudioNode
    });

    await node.addShredCode('adc => dac;');
    await node.removeShred(1);

    expect(sourceAudioNode.connect).toHaveBeenCalledTimes(2);
    expect(sourceAudioNode.connect).toHaveBeenCalledWith(mockChuck);
  });

  it('does not reconnect stale audio inputs after they are disconnected', async () => {
    const { audioContext } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);
    const sourceAudioNode = { connect: vi.fn() } as unknown as AudioNode;

    node.connectFrom({
      nodeId: 'source-1',
      audioNode: sourceAudioNode
    });

    await node.addShredCode('adc => dac;');
    node.disconnectInputs();
    await node.removeShred(1);

    expect(sourceAudioNode.connect).toHaveBeenCalledTimes(1);
  });

  it('keeps immediate audio patches alive so they can be removed', async () => {
    const { audioContext } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);

    await node.addShredCode('adc => dac;');

    expect(mockChuck.runCode).toHaveBeenCalledWith(
      expect.stringContaining('while (true) 1::day => now;')
    );
    expect(get(node.shredsStore)[0].code).toBe('adc => dac;');
  });

  it('does not add a keepalive tail when code already advances time', async () => {
    const { audioContext } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);
    const code = 'SinOsc s => dac; while (true) 1::second => now;';

    await node.addShredCode(code);

    expect(mockChuck.runCode).toHaveBeenCalledWith(code);
  });

  it('reports Chuck.init failures through onError', async () => {
    const { audioContext } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);
    const onError = vi.fn();
    const error = new Error('bad wasm');

    node.onError = onError;
    mockChuckInit.mockRejectedValueOnce(error);

    await node.create();

    expect(onError).toHaveBeenCalledWith('bad wasm');
    expect(node.getError()).toBe('bad wasm');
  });

  it('reports processor errors through onError', async () => {
    const { audioContext } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);
    const onError = vi.fn();

    node.onError = onError;
    await node.create();

    const processorErrorHandler = mockChuck.addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'processorerror'
    )?.[1];

    processorErrorHandler?.({ type: 'processorerror' });

    expect(onError).toHaveBeenLastCalledWith('ChucK AudioWorkletProcessor error: processorerror');
    expect(node.getError()).toBe('ChucK AudioWorkletProcessor error: processorerror');
  });

  it('uses native last-shred removal for non-adc shreds', async () => {
    const { audioContext, gain } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);

    await node.addShredCode('SinOsc s => dac; while (true) 1::second => now;');

    await node.removeLastCode();

    expect(mockChuck.removeLastCode).toHaveBeenCalled();
    expect(gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(get(node.shredsStore)).toEqual([]);
  });

  it('rebuilds the ChucK VM when removing the last adc shred', async () => {
    const { audioContext } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);

    await node.addShredCode('adc => dac;');

    await node.removeLastCode();

    expect(mockChuck.removeLastCode).not.toHaveBeenCalled();
    expect(mockChuck.clearChuckInstance).toHaveBeenCalled();
    expect(get(node.shredsStore)).toEqual([]);
  });

  it('clears the ChucK VM when the node is destroyed', async () => {
    const { audioContext, outputGain } = createAudioContext();
    const node = new ChuckNode('chuck-1', audioContext);

    await node.addShredCode('SinOsc s => dac; while (true) 1::second => now;');

    node.destroy();

    expect(mockChuck.clearChuckInstance).toHaveBeenCalled();
    expect(outputGain.disconnect).toHaveBeenCalled();
    expect(get(node.shredsStore)).toEqual([]);
  });
});
