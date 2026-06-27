import { describe, expect, it, vi } from 'vitest';

import { SmplrInstrumentAudioNode } from './SmplrInstrumentAudioNode';
import type { SmplrInstrument, SmplrInstrumentDescriptor } from './descriptors';

function createFakeGain() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn()
  } as unknown as GainNode;
}

function createFakeAudioContext(gains: GainNode[] = [createFakeGain()]) {
  let gainIndex = 0;
  return {
    createGain: () => gains[gainIndex++] ?? createFakeGain()
  } as unknown as AudioContext;
}

function createInstrument() {
  return {
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    setCC: vi.fn(),
    setDetune: vi.fn(),
    setReverse: vi.fn(),
    dispose: vi.fn(),
    output: { volume: 100, pan: 0 }
  } satisfies SmplrInstrument;
}

function createDescriptor(
  loadInstrument: SmplrInstrumentDescriptor['loadInstrument']
): SmplrInstrumentDescriptor {
  return {
    type: 'soundfont~',
    title: 'soundfont~',
    description: 'test descriptor',
    defaultSettings: { instrument: 'piano', volume: 100, velocity: 100, defaultNote: '60' },
    settingsSchema: [],
    reloadsOnSettings: ['instrument'],
    defaultBangNote: '60',
    defaultVelocity: 100,
    getDisplayName: (settings) => String(settings.instrument ?? 'piano'),
    loadInstrument
  };
}

describe('SmplrInstrumentAudioNode', () => {
  it('creates a stable output before the instrument loads', () => {
    const gain = createFakeGain();
    const node = new SmplrInstrumentAudioNode(
      'smplr-1',
      createFakeAudioContext([gain]),
      createDescriptor(async () => createInstrument())
    );

    expect(node.audioNode).toBe(gain);
  });

  it('forwards normalized start stop cc and live settings to the instrument', async () => {
    const instrument = createInstrument();
    const node = new SmplrInstrumentAudioNode(
      'smplr-1',
      createFakeAudioContext(),
      createDescriptor(async () => instrument)
    );

    await node.create([{ instrument: 'piano', volume: 100, velocity: 100, defaultNote: '60' }]);
    node.send('message', { type: 'noteOn', note: 64, velocity: 88, time: 12.5 });
    node.send('message', { type: 'noteOff', note: 64, time: 13 });
    node.send('message', { type: 'controlChange', control: 64, value: 127 });
    node.send('message', { type: 'setGain', value: 72 });
    node.send('message', { type: 'setDetune', value: 12 });
    node.send('message', { type: 'setReverse', value: true });

    expect(instrument.start).toHaveBeenCalledWith({ note: 64, velocity: 88, time: 12.5 });
    expect(instrument.stop).toHaveBeenCalledWith({ stopId: 64, time: 13 });
    expect(instrument.setCC).toHaveBeenCalledWith(64, 127);
    expect(instrument.output.volume).toBe(72);
    expect(instrument.setDetune).toHaveBeenCalledWith(12);
    expect(instrument.setReverse).toHaveBeenCalledWith(true);
  });

  it('reloads only for descriptor reload settings', async () => {
    const first = createInstrument();
    const second = createInstrument();
    const load = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const node = new SmplrInstrumentAudioNode(
      'smplr-1',
      createFakeAudioContext(),
      createDescriptor(load)
    );

    await node.create([{ instrument: 'piano', volume: 100, velocity: 100, defaultNote: '60' }]);
    await node.send('settings', {
      instrument: 'piano',
      volume: 80,
      velocity: 100,
      defaultNote: '60'
    });
    await node.send('settings', {
      instrument: 'organ',
      volume: 80,
      velocity: 100,
      defaultNote: '60'
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(first.dispose).toHaveBeenCalledTimes(1);
  });

  it('ignores stale async loads when a newer load wins', async () => {
    const first = createInstrument();
    const second = createInstrument();
    let resolveFirst: (value: SmplrInstrument) => void = () => {};
    const load = vi
      .fn()
      .mockReturnValueOnce(new Promise<SmplrInstrument>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(second);

    const node = new SmplrInstrumentAudioNode(
      'smplr-1',
      createFakeAudioContext(),
      createDescriptor(load)
    );

    const firstLoad = node.create([{ instrument: 'piano', volume: 100, velocity: 100 }]);
    const secondLoad = node.send('settings', { instrument: 'organ', volume: 100, velocity: 100 });
    resolveFirst(first);

    await Promise.all([firstLoad, secondLoad]);

    expect(node.instrument).toBe(second);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).not.toHaveBeenCalled();
  });

  it('disposes the active instrument on destroy', async () => {
    const instrument = createInstrument();
    const node = new SmplrInstrumentAudioNode(
      'smplr-1',
      createFakeAudioContext(),
      createDescriptor(async () => instrument)
    );

    await node.create([{ instrument: 'piano', volume: 100, velocity: 100 }]);
    node.destroy();

    expect(instrument.dispose).toHaveBeenCalledTimes(1);
    expect(node.audioNode?.disconnect).toHaveBeenCalledTimes(1);
  });
});
