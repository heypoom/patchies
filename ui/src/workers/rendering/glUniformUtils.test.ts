import { describe, expect, it } from 'vitest';
import { buildGlslUserParams } from './glUniformUtils';
import type { GLUniformDef } from '../../types/uniform-config';

describe('buildGlslUserParams', () => {
  it('binds sampler2D textures by full uniform index', () => {
    const texture = { label: 'connected texture' };
    const fallbackTexture = { label: 'fallback texture' };
    const uniformDefs: GLUniformDef[] = [
      { name: 'a', type: 'float' },
      { name: 'b', type: 'float' },
      { name: 'c', type: 'float' },
      { name: 'd', type: 'float' },
      { name: 'e', type: 'sampler2D' }
    ];

    const params = buildGlslUserParams({
      uniformDefs,
      uniformData: new Map([
        ['a', 1],
        ['b', 2],
        ['c', 3],
        ['d', 4]
      ]),
      inputTextureMap: new Map([[4, texture]]),
      fallbackTexture
    });

    expect(params).toEqual([1, 2, 3, 4, texture]);
  });

  it('falls back when a sampler2D uniform inlet is not connected', () => {
    const fallbackTexture = { label: 'fallback texture' };

    const params = buildGlslUserParams({
      uniformDefs: [{ name: 'image', type: 'sampler2D' }],
      uniformData: new Map(),
      inputTextureMap: new Map(),
      fallbackTexture
    });

    expect(params).toEqual([fallbackTexture]);
  });
});
