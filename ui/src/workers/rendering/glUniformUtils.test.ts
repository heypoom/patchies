import { describe, expect, it } from 'vitest';
import { buildGlslUserParams, defaultUniformValue, isValidUniformData } from './glUniformUtils';
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

describe('defaultUniformValue', () => {
  it('defaults scalar uniform arrays to arrays of scalar defaults', () => {
    expect(defaultUniformValue({ type: 'int', arraySize: 64 })).toEqual(
      Array.from({ length: 64 }, () => 0)
    );
    expect(defaultUniformValue({ type: 'float', arraySize: 3 })).toEqual([0, 0, 0]);
    expect(defaultUniformValue({ type: 'bool', arraySize: 2 })).toEqual([true, true]);
  });
});

describe('isValidUniformData', () => {
  it('accepts correctly sized scalar uniform arrays', () => {
    expect(
      isValidUniformData(
        { type: 'int', arraySize: 64 },
        Array.from({ length: 64 }, (_, index) => index % 2)
      )
    ).toBe(true);
    expect(isValidUniformData({ type: 'float', arraySize: 3 }, [0, 0.5, 1])).toBe(true);
    expect(isValidUniformData({ type: 'bool', arraySize: 2 }, [true, false])).toBe(true);
  });

  it('rejects scalar uniform arrays with the wrong length or element type', () => {
    expect(isValidUniformData({ type: 'int', arraySize: 4 }, [0, 1, 0])).toBe(false);
    expect(isValidUniformData({ type: 'int', arraySize: 2 }, [0, '1'])).toBe(false);
    expect(isValidUniformData({ type: 'bool', arraySize: 2 }, [true, 0])).toBe(false);
  });
});
