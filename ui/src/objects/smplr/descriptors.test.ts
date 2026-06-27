import { describe, expect, it } from 'vitest';

import type { SmplrInstrument, SmplrModule } from './descriptors';
import { SMPLR_OBJECT_TYPES, getSmplrDescriptor, smplrDescriptors } from './descriptors';
import { getGeneralMidiProgramName, getSoundfont2ProgramName } from './programs';

describe('smplr descriptors', () => {
  it('exports descriptors for every v1 object type', () => {
    expect(SMPLR_OBJECT_TYPES).toEqual([
      'soundfont~',
      'soundfont2~',
      'piano~',
      'epiano~',
      'drums~',
      'mallet~',
      'mellotron~',
      'versilian~',
      'smolken~'
    ]);

    expect(Object.keys(smplrDescriptors)).toEqual(SMPLR_OBJECT_TYPES);
  });

  it('maps GM program changes for soundfont~', () => {
    const descriptor = getSmplrDescriptor('soundfont~');

    expect(getGeneralMidiProgramName(0)).toBe('acoustic_grand_piano');
    expect(getGeneralMidiProgramName(40)).toBe('violin');
    expect(descriptor.handleProgramChange?.(40, {})).toEqual({ instrument: 'violin' });
    expect(descriptor.handleProgramChange?.(40, { kit: 'Custom' })).toBeNull();
  });

  it('passes built-in soundfont kits through to smplr', async () => {
    const calls: unknown[] = [];
    const descriptor = getSmplrDescriptor('soundfont~');

    await descriptor.loadInstrument({
      module: createSmplrModuleSpy(calls),
      context: {} as AudioContext,
      destination: {} as AudioNode,
      settings: {
        instrument: 'marimba',
        kit: 'FluidR3_GM',
        instrumentUrl: 'https://example.test/custom.js',
        volume: 100,
        velocity: 100,
        pan: 0,
        loadLoopData: false
      },
      onLoadProgress: () => {}
    });

    expect(calls[0]).toMatchObject({
      instrument: 'marimba',
      kit: 'FluidR3_GM'
    });
    expect(calls[0]).not.toHaveProperty('instrumentUrl');
  });

  it('uses instrumentUrl when soundfont~ kit is Custom', async () => {
    const calls: unknown[] = [];
    const descriptor = getSmplrDescriptor('soundfont~');

    await descriptor.loadInstrument({
      module: createSmplrModuleSpy(calls),
      context: {} as AudioContext,
      destination: {} as AudioNode,
      settings: {
        instrument: 'marimba',
        kit: 'Custom',
        instrumentUrl: 'https://example.test/marimba-mp3.js',
        volume: 100,
        velocity: 100,
        pan: 0,
        loadLoopData: false
      },
      onLoadProgress: () => {}
    });

    expect(calls[0]).toMatchObject({
      instrumentUrl: 'https://example.test/marimba-mp3.js'
    });
    expect(calls[0]).not.toHaveProperty('instrument');
    expect(calls[0]).not.toHaveProperty('kit');
  });

  it('requires an instrumentUrl when soundfont~ kit is Custom', async () => {
    const descriptor = getSmplrDescriptor('soundfont~');

    await expect(
      descriptor.loadInstrument({
        module: createSmplrModuleSpy([]),
        context: {} as AudioContext,
        destination: {} as AudioNode,
        settings: {
          instrument: 'marimba',
          kit: 'Custom',
          instrumentUrl: '',
          volume: 100,
          velocity: 100,
          pan: 0,
          loadLoopData: false
        },
        onLoadProgress: () => {}
      })
    ).rejects.toThrow('Set an Instrument URL when Kit is Custom');
  });

  it('maps soundfont2 program changes from parsed instrument names', () => {
    expect(getSoundfont2ProgramName(2, ['Piano', 'Organ', 'Strings'])).toBe('Strings');

    const descriptor = getSmplrDescriptor('soundfont2~');
    expect(
      descriptor.handleProgramChange?.(1, {
        instrumentNames: ['Piano', 'Organ', 'Strings']
      })
    ).toEqual({ instrument: 'Organ' });
  });

  it('keeps heavyweight runtime loading behind descriptor loader functions', () => {
    for (const descriptor of Object.values(smplrDescriptors)) {
      expect(typeof descriptor.loadInstrument).toBe('function');
    }
  });
});

function createSmplrModuleSpy(calls: unknown[]): SmplrModule {
  const instrument = {
    ready: Promise.resolve(),
    start: () => {},
    stop: () => {},
    setCC: () => {},
    setDetune: () => {},
    setReverse: () => {},
    output: { volume: 100, pan: 0 }
  } satisfies SmplrInstrument;

  return {
    Soundfont: (_context: AudioContext, options: unknown) => {
      calls.push(options);
      return instrument;
    }
  } as unknown as SmplrModule;
}
