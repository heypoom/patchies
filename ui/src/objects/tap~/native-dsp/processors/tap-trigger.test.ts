import { describe, expect, test } from 'vitest';

import { shouldStartCapture } from './tap-trigger';

describe('tap~ capture trigger', () => {
  test('waits for a rising zero-crossing when zero-crossing is enabled', () => {
    expect(
      shouldStartCapture({
        zeroCrossing: true,
        prevSample: 0.2,
        sample: 0.3,
        samplesSinceLastSend: 128,
        maxWait: 4096
      })
    ).toBe(false);

    expect(
      shouldStartCapture({
        zeroCrossing: true,
        prevSample: -0.1,
        sample: 0.1,
        samplesSinceLastSend: 128,
        maxWait: 4096
      })
    ).toBe(true);
  });

  test('starts continuously after cooldown when zero-crossing is disabled', () => {
    expect(
      shouldStartCapture({
        zeroCrossing: false,
        prevSample: 0.2,
        sample: 0.3,
        samplesSinceLastSend: 128,
        maxWait: 4096
      })
    ).toBe(true);
  });

  test('still forces capture after max wait when zero-crossing is enabled', () => {
    expect(
      shouldStartCapture({
        zeroCrossing: true,
        prevSample: 0.2,
        sample: 0.3,
        samplesSinceLastSend: 4096,
        maxWait: 4096
      })
    ).toBe(true);
  });
});
