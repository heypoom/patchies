import { describe, expect, it } from 'vitest';
import { createHydraCookPolicy } from '$workers/rendering/cooking/object-policies/hydra';
import { COOK_TEST_UTILS } from '$workers/rendering/cooking/test-utils';

const { ALWAYS, ON_DEMAND, TIME_DEPENDENT, MOUSE_DEPENDENT, FFT_DEPENDENT } = COOK_TEST_UTILS;

describe('createHydraCookPolicy', () => {
  it('allows static solid hydra code to cook on demand', () => {
    expect(createHydraCookPolicy('solid(1, 0, 0).out()')).toEqual(ON_DEMAND);
  });

  it('allows input-only hydra code to cook on demand', () => {
    expect(createHydraCookPolicy('src(s0).blend(s1).out()')).toEqual(ON_DEMAND);
  });

  it('treats common animated generators as transport-time dependent', () => {
    expect(createHydraCookPolicy('osc(10, 0.1, 1.5).out()')).toMatchObject(TIME_DEPENDENT);
  });

  it('treats Hydra callbacks that read transport time as time dependent', () => {
    expect(createHydraCookPolicy('solid(() => time % 1, 0, 0).out()')).toMatchObject(
      TIME_DEPENDENT
    );

    expect(createHydraCookPolicy('solid(() => clock.time % 1, 0, 0).out()')).toMatchObject(
      TIME_DEPENDENT
    );
  });

  it('detects mouse and fft dependencies', () => {
    expect(createHydraCookPolicy('osc(10).rotate(mouse.x).out()')).toMatchObject(MOUSE_DEPENDENT);

    expect(createHydraCookPolicy("osc(() => fft().getEnergy('bass')).out()")).toMatchObject(
      FFT_DEPENDENT
    );
  });

  it('keeps arbitrary callbacks and custom functions conservative', () => {
    expect(createHydraCookPolicy('osc(() => Math.random()).out()')).toEqual({ mode: 'always' });

    expect(
      createHydraCookPolicy(`
        await setFunction({
          name: 'custom',
          type: 'src',
          glsl: 'return vec4(1.0);'
        })
      `)
    ).toEqual(ALWAYS);
  });

  it('ignores dependencies in comments and strings', () => {
    expect(
      createHydraCookPolicy(`
        // osc(10).out()
        const label = "mouse fft osc"
        solid(1, 0, 0).out()
      `)
    ).toEqual(ON_DEMAND);
  });
});
