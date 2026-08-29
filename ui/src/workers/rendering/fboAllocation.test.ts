import { describe, expect, it } from 'vitest';

import { getMrtCount } from './fboAllocation';

describe('getMrtCount', () => {
  const gl = {
    MAX_DRAW_BUFFERS: 0x8824,
    MAX_COLOR_ATTACHMENTS: 0x8cdf,
    getParameter: (parameter: number) => (parameter === 0x8824 ? 4 : 8)
  } as WebGL2RenderingContext;

  it.each([
    ['glsl', { mrtCount: 0 }],
    ['swgl', { mrtCount: -1 }],
    ['regl', { videoOutletCount: 0 }],
    ['hydra', { videoOutletCount: -1 }],
    ['shaderpark', { videoOutletCount: 0 }]
  ] as const)('normalizes %s attachment counts to one', (type, data) => {
    expect(getMrtCount({ type, data }, gl)).toBe(1);
  });

  it('caps the requested count to the lower WebGL2 attachment limit', () => {
    expect(getMrtCount({ type: 'glsl', data: { mrtCount: 12 } }, gl)).toBe(4);
    expect(getMrtCount({ type: 'hydra', data: { videoOutletCount: 12 } }, gl)).toBe(4);
  });
});
