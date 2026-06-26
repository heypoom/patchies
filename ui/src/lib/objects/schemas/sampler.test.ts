import { describe, expect, it } from 'vitest';
import { match } from 'ts-pattern';

import { samplerMessages } from './sampler';

describe('sampler message matchers', () => {
  it('keeps plain play separate from scheduled play', () => {
    expect(
      match({ type: 'play' })
        .with(samplerMessages.playScheduled, () => 'scheduled')
        .with(samplerMessages.play, () => 'plain')
        .otherwise(() => 'unknown')
    ).toBe('plain');

    expect(
      match({ type: 'play', offset: 0.25 })
        .with(samplerMessages.playScheduled, () => 'scheduled')
        .with(samplerMessages.play, () => 'plain')
        .otherwise(() => 'unknown')
    ).toBe('scheduled');
  });
});
