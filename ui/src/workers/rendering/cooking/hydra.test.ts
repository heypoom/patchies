import { describe, expect, it } from 'vitest';
import { createHydraCookPolicy } from './hydra';

describe('createHydraCookPolicy', () => {
  it('allows static solid hydra code to cook on demand', () => {
    expect(createHydraCookPolicy('solid(1, 0, 0).out()')).toEqual({ mode: 'on-demand' });
  });

  it('allows input-only hydra code to cook on demand', () => {
    expect(createHydraCookPolicy('src(s0).blend(s1).out()')).toEqual({ mode: 'on-demand' });
  });

  it('treats common animated generators as transport-time dependent', () => {
    expect(createHydraCookPolicy('osc(10, 0.1, 1.5).out()')).toMatchObject({
      mode: 'on-demand',
      timeDependent: true
    });
  });

  it('detects mouse and fft dependencies', () => {
    expect(createHydraCookPolicy('osc(10).rotate(mouse.x).out()')).toMatchObject({
      mouseDependent: true
    });
    expect(createHydraCookPolicy("osc(() => fft().getEnergy('bass')).out()")).toMatchObject({
      fftDependent: true
    });
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
    ).toEqual({ mode: 'always' });
  });

  it('ignores dependencies in comments and strings', () => {
    expect(
      createHydraCookPolicy(`
        // osc(10).out()
        const label = "mouse fft osc"
        solid(1, 0, 0).out()
      `)
    ).toEqual({ mode: 'on-demand' });
  });
});
