import { describe, expect, it } from 'vitest';

import { getMrtCount } from './fboAllocation';

describe('getMrtCount', () => {
  it.each([
    ['glsl', { mrtCount: 0 }],
    ['swgl', { mrtCount: -1 }],
    ['regl', { videoOutletCount: 0 }],
    ['hydra', { videoOutletCount: -1 }],
    ['shaderpark', { videoOutletCount: 0 }]
  ] as const)('normalizes %s attachment counts to one', (type, data) => {
    expect(getMrtCount({ type, data })).toBe(1);
  });
});
