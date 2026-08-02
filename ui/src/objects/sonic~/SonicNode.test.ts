import { afterEach, describe, expect, it, vi } from 'vitest';

import { JSRunner } from '$lib/js-runner/JSRunner';
import { SuperSonicManager } from '$lib/audio/SuperSonicManager';

import { SonicNode } from './SonicNode';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SonicNode', () => {
  it('clears published message ports when replacement code omits setPortCount', async () => {
    const gainNode = {
      gain: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn()
    } as unknown as GainNode;
    const audioContext = { createGain: () => gainNode } as unknown as AudioContext;
    const executeJavaScript = vi.fn(async (_nodeId, _code, options) => {
      if (executeJavaScript.mock.calls.length === 1) {
        options.setPortCount(2, 1);
      }
    });

    vi.spyOn(JSRunner, 'getInstance').mockReturnValue({
      preprocessCode: vi.fn(async (code: string) => code),
      executeJavaScript,
      destroy: vi.fn()
    } as unknown as JSRunner);
    vi.spyOn(SuperSonicManager, 'getInstance').mockReturnValue({
      ensureSuperSonic: vi.fn(async () => ({
        sonic: { on: vi.fn(), node: gainNode },
        SuperSonic: {},
        sharedInputNode: gainNode
      })),
      allocateBusPair: vi.fn(() => ({ busIndex: 0, outputNode: gainNode }))
    } as unknown as SuperSonicManager);

    const node = new SonicNode('sonic-port-reset-test', audioContext);
    const updates: Record<string, unknown>[] = [];

    node.bindRuntimeData({
      initialData: { code: 'setPortCount(2, 1)' },
      update: (update) => updates.push(update)
    });
    await node.send('code', 'setPortCount(2, 1)');
    await node.send('code', '');
    await node.send('code', 'setPortCount(2, 1)');
    await node.send('code', 'outputNode.gain.value = 0.5');

    expect(updates).toContainEqual({ messageInletCount: 2, messageOutletCount: 1 });
    expect(updates).toContainEqual({ messageInletCount: 0, messageOutletCount: 0 });
  });
});
