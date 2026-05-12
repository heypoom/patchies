import { describe, expect, it } from 'vitest';
import { extractShaderParkVideoUniformIndices, shaderParkUniformsToDefs } from './uniforms';

describe('shaderParkUniformsToDefs', () => {
  it('preserves input2D defaults and bounds as vec2 arrays', () => {
    expect(
      shaderParkUniformsToDefs([
        {
          name: 'offset',
          type: 'vec2',
          value: { x: 0.25, y: -0.5 },
          min: { x: -1, y: -1 },
          max: { x: 1, y: 1 }
        }
      ])
    ).toEqual([
      {
        name: 'offset',
        type: 'vec2',
        default: [0.25, -0.5],
        min: [-1, -1],
        max: [1, 1],
        description: 'offset'
      }
    ]);
  });
});

describe('extractShaderParkVideoUniformIndices', () => {
  it('returns only referenced iChannel sampler indexes', () => {
    expect(
      extractShaderParkVideoUniformIndices(`
        let p = texture2D(iChannel2, vec2(0.5));
        // iChannel0 should not count from comments
        color(p.rgb);
      `)
    ).toEqual([2]);
  });

  it('dedupes and sorts referenced video uniforms', () => {
    expect(
      extractShaderParkVideoUniformIndices(`
        color(texture2D(iChannel3, vec2(0.5)).rgb + texture2D(iChannel1, vec2(0.25)).rgb);
        let again = iChannel3;
      `)
    ).toEqual([1, 3]);
  });
});
