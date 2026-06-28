import { describe, expect, it, vi } from 'vitest';

import { GmAudioNode } from './GmAudioNode';
import type { SmplrInstrument, SmplrModule } from './descriptors';

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

function createInstrument(name: string): SmplrInstrument {
  return {
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    setCC: vi.fn(),
    setDetune: vi.fn(),
    setReverse: vi.fn(),
    dispose: vi.fn(),
    output: { volume: 100, pan: 0 },
    instrumentNames: ['Piano', 'Organ', 'Strings'],
    loadInstrument: vi.fn(async () => {})
  } satisfies SmplrInstrument & { name?: string };
}

describe('GmAudioNode', () => {
  it('keeps program changes scoped to the addressed MIDI channel', async () => {
    const instruments = new Map<string, SmplrInstrument>();
    const soundfontCalls: Array<Record<string, unknown>> = [];
    const module = {
      Soundfont: (_context: AudioContext, options: Record<string, unknown>) => {
        soundfontCalls.push(options);
        const instrument = createInstrument(String(options.instrument));
        instruments.set(String(options.instrument), instrument);
        return instrument;
      }
    } as unknown as SmplrModule;

    const node = new GmAudioNode('gm-1', createFakeAudioContext(), async () => module);

    await node.create([{ source: 'soundfont', kit: 'MusyngKite', volume: 100, velocity: 100 }]);
    await node.send('message', { type: 'programChange', program: 40, channel: 2 });
    await node.send('message', { type: 'noteOn', note: 64, velocity: 90, channel: 2 });
    await node.send('message', { type: 'noteOn', note: 60, velocity: 100, channel: 1 });

    expect(soundfontCalls.map((call) => call.instrument)).toEqual([
      'violin',
      'acoustic_grand_piano'
    ]);
    expect(instruments.get('violin')?.start).toHaveBeenCalledWith({ note: 64, velocity: 90 });
    expect(instruments.get('acoustic_grand_piano')?.start).toHaveBeenCalledWith({
      note: 60,
      velocity: 100
    });
  });

  it('maps soundfont2 programs by parsed instrument order', async () => {
    const loadInstrument = vi.fn(async () => {});
    const module = {
      Soundfont2: () =>
        ({
          ...createInstrument('sf2'),
          ready: Promise.resolve(),
          instrumentNames: ['Piano', 'Organ', 'Strings'],
          loadInstrument
        }) satisfies SmplrInstrument
    } as unknown as SmplrModule;

    const node = new GmAudioNode('gm-1', createFakeAudioContext(), async () => module);

    await node.create([
      { source: 'soundfont2', url: 'https://example.test/gm.sf2', volume: 100, velocity: 100 }
    ]);
    await node.send('message', { type: 'programChange', program: 1, channel: 3 });
    await node.send('message', { type: 'noteOn', note: 67, velocity: 80, channel: 3 });

    expect(loadInstrument).toHaveBeenCalledWith('Organ');
  });

  it('uses custom MIDI.js soundfont URLs for soundfont source channels', async () => {
    const soundfontCalls: Array<Record<string, unknown>> = [];
    const module = {
      Soundfont: (_context: AudioContext, options: Record<string, unknown>) => {
        soundfontCalls.push(options);
        return createInstrument('custom');
      }
    } as unknown as SmplrModule;

    const node = new GmAudioNode('gm-1', createFakeAudioContext(), async () => module);

    await node.create([
      {
        source: 'soundfont',
        kit: 'Custom',
        instrumentUrl: 'https://example.test/custom-piano-mp3.js',
        volume: 100,
        velocity: 100
      }
    ]);
    await node.send('message', { type: 'programChange', program: 40, channel: 2 });
    await node.send('message', { type: 'noteOn', note: 64, velocity: 90, channel: 2 });

    expect(soundfontCalls[0]).toMatchObject({
      instrumentUrl: 'https://example.test/custom-piano-mp3.js'
    });
    expect(soundfontCalls[0]).not.toHaveProperty('instrument');
    expect(soundfontCalls[0]).not.toHaveProperty('kit');
  });

  it('keeps custom MIDI.js soundfont URLs loaded across program changes', async () => {
    const instrument = createInstrument('custom');
    const soundfont = vi.fn(() => instrument);
    const module = { Soundfont: soundfont } as unknown as SmplrModule;
    const node = new GmAudioNode('gm-1', createFakeAudioContext(), async () => module);

    await node.create([
      {
        source: 'soundfont',
        kit: 'Custom',
        instrumentUrl: 'https://example.test/custom-piano-mp3.js',
        volume: 100,
        velocity: 100
      }
    ]);
    await node.send('message', { type: 'noteOn', note: 60, velocity: 90, channel: 1 });
    await node.send('message', { type: 'programChange', program: 40, channel: 1 });
    await node.send('message', { type: 'noteOn', note: 64, velocity: 90, channel: 1 });

    expect(soundfont).toHaveBeenCalledTimes(1);
    expect(instrument.start).toHaveBeenCalledTimes(2);
  });

  it('publishes channel monitor snapshots for program and note activity', async () => {
    const module = {
      Soundfont: () => createInstrument('soundfont')
    } as unknown as SmplrModule;
    const snapshots: Array<ReturnType<GmAudioNode['getMonitorSnapshot']>> = [];
    const node = new GmAudioNode('gm-1', createFakeAudioContext(), async () => module);
    node.onMonitorChange = (snapshot) => snapshots.push(snapshot);

    await node.create([{ source: 'soundfont', kit: 'MusyngKite', volume: 100, velocity: 100 }]);
    await node.send('message', { type: 'programChange', program: 40, channel: 2 });
    await node.send('message', { type: 'noteOn', note: 64, velocity: 90, channel: 2 });
    await node.send('message', { type: 'noteOff', note: 64, channel: 2 });

    const channel = snapshots.at(-1)?.channels[1];
    expect(channel).toMatchObject({
      channel: 2,
      program: 40,
      instrumentName: 'violin',
      activeNotes: 0,
      status: 'ready',
      lastNote: 64,
      lastVelocity: 90
    });
    expect(channel?.activity).toBeGreaterThan(0);
  });

  it('preloads channel instruments from midi.file loaded program metadata', async () => {
    const soundfont = vi.fn((_context: AudioContext, options: Record<string, unknown>) =>
      createInstrument(String(options.instrument))
    );
    const module = { Soundfont: soundfont } as unknown as SmplrModule;
    const node = new GmAudioNode('gm-1', createFakeAudioContext(), async () => module);

    await node.create([{ source: 'soundfont', kit: 'MusyngKite', volume: 100, velocity: 100 }]);
    await node.send('message', {
      type: 'loaded',
      fileName: 'song.mid',
      durationSeconds: 1,
      trackCount: 1,
      ppq: 480,
      programs: [{ channel: 2, program: 40 }]
    });
    await node.send('message', { type: 'noteOn', note: 64, velocity: 90, channel: 2 });

    expect(soundfont).toHaveBeenCalledTimes(1);
    expect(soundfont.mock.calls[0]?.[1]).toMatchObject({ instrument: 'violin' });
  });
});
