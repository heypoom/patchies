import { describe, expect, it } from 'vitest';

import { createTextmodeCookPolicy } from '$objects/textmode/cook-policy';
import { COOK_TEST_UTILS } from '$workers/rendering/cooking/test-utils';

const { ON_DEMAND, TIME_DEPENDENT, FRAME_DEPENDENT, FFT_DEPENDENT } = COOK_TEST_UTILS;

describe('createTextmodeCookPolicy', () => {
  it('allows static textmode code to cook on demand', () => {
    expect(
      createTextmodeCookPolicy(`
        t.draw(() => {
          t.background(0);
          t.char('#');
          t.point();
        });
      `)
    ).toEqual(ON_DEMAND);
  });

  it('detects transport clock dependencies', () => {
    expect(createTextmodeCookPolicy('t.draw(() => t.text(clock.time.toFixed(2), 0, 0));')).toEqual(
      TIME_DEPENDENT
    );
  });

  it('detects textmode frame counters and animated synth helpers as frame dependent', () => {
    expect(createTextmodeCookPolicy('t.draw(() => t.filter("hueRotate", t.frameCount));')).toEqual(
      FRAME_DEPENDENT
    );

    expect(createTextmodeCookPolicy('t.layers.base.synth(char(osc(2, -0.1, 0.5)));')).toEqual(
      FRAME_DEPENDENT
    );
  });

  it('detects fft dependencies', () => {
    expect(createTextmodeCookPolicy('t.draw(() => t.text(fft().a[0], 0, 0));')).toEqual(
      FFT_DEPENDENT
    );
  });

  it('ignores dependencies in comments and strings', () => {
    expect(
      createTextmodeCookPolicy(`
        // clock.time t.frameCount osc fft()
        const label = "clock.time t.frameCount osc fft()";
        t.draw(() => t.text(label, 0, 0));
      `)
    ).toEqual(ON_DEMAND);
  });
});
