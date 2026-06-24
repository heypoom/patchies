import { describe, expect, it } from 'vitest';

import { createReglCookPolicy } from './regl';
import { COOK_TEST_UTILS } from './test-utils';

const { ON_DEMAND, TIME_DEPENDENT, MOUSE_DEPENDENT, FFT_DEPENDENT } = COOK_TEST_UTILS;

describe('createReglCookPolicy', () => {
  it('allows static regl render functions to cook on demand', () => {
    expect(
      createReglCookPolicy(`
        const draw = regl({ count: 3 });

        function render(time) {
          draw();
        }
      `)
    ).toEqual(ON_DEMAND);
  });

  it('detects transport time when render uses the time argument', () => {
    expect(
      createReglCookPolicy(`
        const draw = regl({ count: 3 });

        function render(time) {
          draw({ time });
        }
      `)
    ).toEqual(TIME_DEPENDENT);
  });

  it('detects mouse and fft dependencies', () => {
    expect(createReglCookPolicy('function render() { draw({ x: mouse.x }); }')).toEqual(
      MOUSE_DEPENDENT
    );

    expect(createReglCookPolicy('function render() { draw({ amp: fft().a[0] }); }')).toEqual(
      FFT_DEPENDENT
    );
  });
});
