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

function createInstrument(): SmplrInstrument {
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

        const instrument = createInstrument();
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

  it('routes General MIDI channel 10 to the configured drum machine', async () => {
    const drums = createInstrument();
    const soundfont = vi.fn(() => createInstrument());
    const drumMachineCalls: Array<Record<string, unknown>> = [];

    const drumMachine = vi.fn((_context: AudioContext, options: Record<string, unknown>) => {
      void _context;
      drumMachineCalls.push(options);

      return drums;
    });

    const module = {
      Soundfont: soundfont,
      DrumMachine: drumMachine
    } as unknown as SmplrModule;

    const node = new GmAudioNode('gm-1', createFakeAudioContext(), async () => module);

    await node.create([
      {
        source: 'soundfont',
        kit: 'MusyngKite',
        drumInstrument: 'LM-2',
        volume: 100,
        velocity: 100
      }
    ]);
    await node.send('message', { type: 'programChange', program: 8, channel: 10 });
    await node.send('message', { type: 'noteOn', note: 36, velocity: 100, channel: 10 });

    expect(soundfont).not.toHaveBeenCalled();

    expect(drumMachine).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        destination: expect.anything(),
        instrument: 'LM-2'
      })
    );

    expect(drumMachineCalls[0]).toMatchObject({ instrument: 'LM-2' });

    expect(drums.start).toHaveBeenCalledWith({ note: 36, velocity: 100 });

    expect(node.getMonitorSnapshot().channels[9]).toMatchObject({
      channel: 10,
      program: 8,
      instrumentName: '(D) Room',
      status: 'ready'
    });
  });

  it('maps soundfont2 programs by parsed instrument order', async () => {
    const loadInstrument = vi.fn(async () => {});

    const module = {
      Soundfont2: () =>
        ({
          ...createInstrument(),
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

  it('maps SoundFont2 channel 10 programs by drum kit names when available', async () => {
    const loadInstrument = vi.fn(async () => {});

    const module = {
      Soundfont2: () =>
        ({
          ...createInstrument(),
          ready: Promise.resolve(),
          instrumentNames: [
            'Piano',
            'Bright Piano',
            'Electric Piano',
            'Honky Tonk',
            'Electric Piano 1',
            'Electric Piano 2',
            'Harpsichord',
            'Clavinet',
            'Celesta',
            '(D) Room'
          ],
          loadInstrument
        }) satisfies SmplrInstrument
    } as unknown as SmplrModule;

    const node = new GmAudioNode('gm-1', createFakeAudioContext(), async () => module);

    await node.create([
      { source: 'soundfont2', url: 'https://example.test/gm.sf2', volume: 100, velocity: 100 }
    ]);
    await node.send('message', { type: 'programChange', program: 8, channel: 10 });
    await node.send('message', { type: 'noteOn', note: 36, velocity: 100, channel: 10 });

    expect(loadInstrument).toHaveBeenCalledWith('(D) Room');
    expect(loadInstrument).not.toHaveBeenCalledWith('Celesta');
    expect(node.getMonitorSnapshot().channels[9]).toMatchObject({
      channel: 10,
      program: 8,
      instrumentName: '(D) Room',
      status: 'ready'
    });
  });

  it('uses custom MIDI.js soundfont URLs for soundfont source channels', async () => {
    const soundfontCalls: Array<Record<string, unknown>> = [];
    const module = {
      Soundfont: (_context: AudioContext, options: Record<string, unknown>) => {
        soundfontCalls.push(options);
        return createInstrument();
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
    const instrument = createInstrument();
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
      Soundfont: () => createInstrument()
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
    const instruments = new Map<string, SmplrInstrument>();
    const soundfontCalls: Array<Record<string, unknown>> = [];
    const soundfont = vi.fn((_context: AudioContext, options: Record<string, unknown>) => {
      void _context;
      soundfontCalls.push(options);
      return createInstrument();
    });
    const module = { Soundfont: soundfont } as unknown as SmplrModule;
    const node = new GmAudioNode('gm-1', createFakeAudioContext(), async () => module);
    soundfont.mockImplementation((_context: AudioContext, options: Record<string, unknown>) => {
      void _context;
      soundfontCalls.push(options);
      const instrument = createInstrument();
      instruments.set(String(options.instrument), instrument);
      return instrument;
    });

    await node.create([{ source: 'soundfont', kit: 'MusyngKite', volume: 100, velocity: 100 }]);
    await node.send('message', {
      type: 'loaded',
      fileName: 'song.mid',
      durationSeconds: 1,
      trackCount: 1,
      ppq: 480,
      programs: [{ channel: 2, program: 40 }],
      preloadPrograms: [
        { channel: 2, program: 40 },
        { channel: 2, program: 12 },
        { channel: 4, program: 60 }
      ]
    });
    await node.send('message', { type: 'noteOn', note: 64, velocity: 90, channel: 2 });
    await node.send('message', { type: 'programChange', program: 12, channel: 2 });
    await node.send('message', { type: 'noteOn', note: 65, velocity: 90, channel: 2 });

    expect(soundfont).toHaveBeenCalledTimes(3);
    expect(soundfontCalls.map((call) => call.instrument)).toEqual([
      'violin',
      'marimba',
      'french_horn'
    ]);
    expect(instruments.get('violin')?.start).toHaveBeenCalledWith({
      note: 64,
      velocity: 90
    });
    expect(instruments.get('marimba')?.start).toHaveBeenCalledWith({
      note: 65,
      velocity: 90
    });
  });
});
