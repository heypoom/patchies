import { describe, expect, it } from 'vitest';

import {
  createGmChannelState,
  getChannelProgram,
  normalizeMidiChannel,
  resolveGmProgramInstrument,
  setChannelProgram
} from './gm-channel-state';

describe('gm channel state', () => {
  it('normalizes missing and invalid MIDI channels to channel 1', () => {
    expect(normalizeMidiChannel(undefined)).toBe(1);
    expect(normalizeMidiChannel(0)).toBe(1);
    expect(normalizeMidiChannel(17)).toBe(16);
    expect(normalizeMidiChannel(2.7)).toBe(3);
  });

  it('keeps independent program state for each 1-based MIDI channel', () => {
    const state = createGmChannelState();

    setChannelProgram(state, 1, 4);
    setChannelProgram(state, 2, 32);

    expect(getChannelProgram(state, 1)).toBe(4);
    expect(getChannelProgram(state, 2)).toBe(32);
    expect(getChannelProgram(state, 3)).toBe(0);
  });

  it('maps built-in soundfont programs through General MIDI names', () => {
    expect(resolveGmProgramInstrument('soundfont', 0, [])).toBe('acoustic_grand_piano');
    expect(resolveGmProgramInstrument('soundfont', 40, [])).toBe('violin');
    expect(resolveGmProgramInstrument('soundfont', 200, [])).toBeNull();
  });

  it('maps soundfont2 programs by parsed instrument order', () => {
    expect(resolveGmProgramInstrument('soundfont2', 1, ['Piano', 'Organ', 'Strings'])).toBe(
      'Organ'
    );
    expect(resolveGmProgramInstrument('soundfont2', 9, ['Piano'])).toBeNull();
  });
});
