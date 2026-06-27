import { describe, expect, it } from 'vitest';

import { SMPLR_OBJECT_TYPES, getSmplrDescriptor, smplrDescriptors } from './descriptors';
import { getGeneralMidiProgramName, getSoundfont2ProgramName } from './programs';

describe('smplr descriptors', () => {
  it('exports descriptors for every v1 object type', () => {
    expect(SMPLR_OBJECT_TYPES).toEqual([
      'soundfont~',
      'soundfont2~',
      'piano~',
      'epiano~',
      'drum-machine~',
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
