import { describe, expect, it } from 'vitest';
import { usesHydraDatamosh } from './hydraRenderer';

describe('usesHydraDatamosh', () => {
  it('detects code that calls datamosh', () => {
    expect(usesHydraDatamosh('src(datamosh(s0, { speed: 10 })).out()')).toBe(true);
  });

  it('does not match ordinary hydra code', () => {
    expect(usesHydraDatamosh('osc(10, 0.1, 1.5).out()')).toBe(false);
  });
});
