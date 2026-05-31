import { describe, expect, it } from 'vitest';
import { getNextPeppermintInput } from './input';

describe('getNextPeppermintInput', () => {
  it('captures normal messages as the next input value', () => {
    expect(getNextPeppermintInput('previous', ['alice'])).toEqual(['alice']);
  });

  it('keeps the last captured input when a bang triggers a run', () => {
    expect(getNextPeppermintInput(['alice'], { type: 'bang' })).toEqual(['alice']);
  });
});
