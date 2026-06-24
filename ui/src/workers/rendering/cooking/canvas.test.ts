import { describe, expect, it } from 'vitest';

import { createCanvasCookPolicy } from './canvas';
import { COOK_TEST_UTILS } from './test-utils';

const { ALWAYS, ON_DEMAND, TIME_DEPENDENT, MOUSE_DEPENDENT, FFT_DEPENDENT } = COOK_TEST_UTILS;

describe('createCanvasCookPolicy', () => {
  it('allows static canvas code to cook on demand', () => {
    expect(createCanvasCookPolicy('ctx.fillRect(0, 0, width, height);')).toEqual(ON_DEMAND);
  });

  it('detects transport time dependencies', () => {
    expect(createCanvasCookPolicy('ctx.fillText(clock.time.toFixed(2), 0, 20);')).toEqual(
      TIME_DEPENDENT
    );
  });

  it('detects mouse and fft dependencies', () => {
    expect(createCanvasCookPolicy('ctx.fillRect(mouse.x, mouse.y, 10, 10);')).toEqual(
      MOUSE_DEPENDENT
    );

    expect(createCanvasCookPolicy("const bass = fft().getEnergy('bass');")).toEqual(FFT_DEPENDENT);
  });

  it('keeps explicit animation loops conservative', () => {
    expect(
      createCanvasCookPolicy(`
        function draw() {
          ctx.clearRect(0, 0, width, height);
          requestAnimationFrame(draw);
        }

        draw();
      `)
    ).toEqual(ALWAYS);
  });

  it('ignores dependencies in comments and strings', () => {
    expect(
      createCanvasCookPolicy(`
        // clock.time mouse fft() requestAnimationFrame(draw)
        const label = "clock.time mouse fft() requestAnimationFrame";
        ctx.fillRect(0, 0, width, height);
      `)
    ).toEqual(ON_DEMAND);
  });
});
