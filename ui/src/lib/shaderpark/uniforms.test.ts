import { describe, expect, it } from 'vitest';
import { shaderParkUniformsToDefs } from './uniforms';

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
