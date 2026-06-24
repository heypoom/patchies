import { describe, expect, it } from 'vitest';
import { createSwglCookPolicy } from './swgl';
import { COOK_TEST_UTILS } from './test-utils';

const { ON_DEMAND, TIME_DEPENDENT } = COOK_TEST_UTILS;

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

  it('ignores time references in comments', () => {
    expect(
      createSwglCookPolicy(`
        // t should not count here
        /*
          t should not count here either
        */
        const shader = await glsl({ FP: 'color = vec4(1);' });

        function render() {
          shader();
        }
      `)
    ).toEqual(ON_DEMAND);
  });
});
