import { describe, expect, it } from 'vitest';

import { createSwglCookPolicy } from '$objects/swgl/cook-policy';
import { COOK_TEST_UTILS } from '$workers/rendering/cooking/test-utils';

const { ON_DEMAND, TIME_DEPENDENT, FFT_DEPENDENT } = COOK_TEST_UTILS;

describe('createSwglCookPolicy', () => {
  it('allows static SwissGL code to cook on demand', () => {
    expect(
      createSwglCookPolicy(`
        const shader = await glsl({ FP: 'color = vec4(1, 0, 0, 1);' });

        function render() {
          shader();
        }
      `)
    ).toEqual(ON_DEMAND);
  });

  it('treats code that passes transport time as time dependent', () => {
    expect(
      createSwglCookPolicy(`
        const shader = await glsl({ FP: 'color = vec4(sin(t), 0, 0, 1);' });

        function render({ t }) {
          shader({ t });
        }
      `)
    ).toEqual(TIME_DEPENDENT);
  });

  it('treats code that reads fft analysis as fft dependent', () => {
    expect(
      createSwglCookPolicy(`
        const shader = await glsl({ FP: 'color = vec4(amp, 0, 0, 1);' });

        function render() {
          shader({ amp: fft().getEnergy('bass') });
        }
      `)
    ).toEqual(FFT_DEPENDENT);
  });

  it('detects combined time and fft dependencies', () => {
    expect(
      createSwglCookPolicy(`
        const shader = await glsl({ FP: 'color = vec4(sin(t) * amp, 0, 0, 1);' });

        function render({ t }) {
          shader({ t, amp: fft().a[0] });
        }
      `)
    ).toEqual({
      mode: 'on-demand',
      timeDependent: true,
      fftDependent: true
    });
  });

  it('ignores dependencies in comments and strings when appropriate', () => {
    expect(
      createSwglCookPolicy(`
        // t and fft() should not count here
        /*
          t and fft() should not count here either
        */
        const label = "fft() should not count here";
        const shader = await glsl({ FP: 'color = vec4(1);' });

        function render() {
          shader();
        }
      `)
    ).toEqual(ON_DEMAND);
  });
});
