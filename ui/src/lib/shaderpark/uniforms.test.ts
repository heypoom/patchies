import { describe, expect, it } from 'vitest';
import {
  detectShaderParkPrimaryButton,
  extractShaderParkVideoUniformIndices,
  parseShaderParkTitle,
  shaderParkUniformsToDefs,
  usesShaderParkMouse
} from './uniforms';

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

describe('usesShaderParkMouse', () => {
  it('detects direct mouse usage', () => {
    expect(usesShaderParkMouse('color(vec3(mouse.x, mouse.y, 0.0));')).toBe(true);
  });

  it('detects mouseIntersection usage', () => {
    expect(usesShaderParkMouse('let p = mouseIntersection(); sphere(length(p) * 0.1);')).toBe(true);
  });

  it('ignores mouse references in comments', () => {
    expect(
      usesShaderParkMouse(`
        // mouse should not count here
        /*
          mouseIntersection should not count either
        */
        sphere(0.35);
      `)
    ).toBe(false);
  });
});

describe('parseShaderParkTitle', () => {
  it('parses the first @title directive', () => {
    expect(parseShaderParkTitle('// @title Noise Sphere\nsphere(0.7);')).toBe('Noise Sphere');
  });

  it('ignores @title directives inside block comments', () => {
    expect(parseShaderParkTitle('/*\n// @title Hidden\n*/\nsphere(0.7);')).toBeUndefined();
  });
});

describe('detectShaderParkPrimaryButton', () => {
  it('parses supported @primaryButton directives', () => {
    expect(detectShaderParkPrimaryButton('// @primaryButton settings\nsphere(0.7);')).toBe(
      'settings'
    );
  });

  it('falls back to code for missing or unsupported directives', () => {
    expect(detectShaderParkPrimaryButton('sphere(0.7);')).toBe('code');
    expect(detectShaderParkPrimaryButton('// @primaryButton nope\nsphere(0.7);')).toBe('code');
  });
});
