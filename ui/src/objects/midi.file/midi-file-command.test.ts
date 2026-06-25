import { describe, expect, it } from 'vitest';

import { isMidiFilePlayMessage } from './midi-file-command';

describe('midi.file command messages', () => {
  it('treats standard bang messages as play commands', () => {
    expect(isMidiFilePlayMessage({ type: 'bang' })).toBe(true);
  });
});
