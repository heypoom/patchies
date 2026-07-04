import { describe, expect, it } from 'vitest';

import { detectJavaScriptCookDependencies } from '$workers/rendering/cooking/javascript';

describe('detectJavaScriptCookDependencies', () => {
  it('detects no dependencies for static JavaScript code', () => {
    expect(detectJavaScriptCookDependencies('ctx.fillRect(0, 0, width, height);')).toEqual({});
  });

  it('detects transport time dependencies', () => {
    expect(detectJavaScriptCookDependencies('const phase = time % 1;')).toEqual({
      timeDependent: true
    });

    expect(detectJavaScriptCookDependencies('const phase = clock.time % 1;')).toEqual({
      timeDependent: true
    });
  });

  it('detects mouse and fft dependencies', () => {
    expect(detectJavaScriptCookDependencies('ctx.fillRect(mouse.x, mouse.y, 10, 10);')).toEqual({
      mouseDependent: true
    });

    expect(detectJavaScriptCookDependencies("const bass = fft().getEnergy('bass');")).toEqual({
      fftDependent: true
    });
  });

  it('keeps timers, animation frames, and wall-clock reads conservative', () => {
    expect(detectJavaScriptCookDependencies('requestAnimationFrame(draw);')).toEqual({
      always: true
    });

    expect(detectJavaScriptCookDependencies('setInterval(draw, 1000);')).toEqual({
      always: true
    });

    expect(detectJavaScriptCookDependencies('const value = Math.random();')).toEqual({
      always: true
    });

    expect(detectJavaScriptCookDependencies('const value = Date.now();')).toEqual({
      always: true
    });

    expect(detectJavaScriptCookDependencies('const value = performance.now();')).toEqual({
      always: true
    });
  });

  it('ignores dependencies in comments and strings', () => {
    expect(
      detectJavaScriptCookDependencies(`
        // time clock.time mouse fft() requestAnimationFrame(draw)
        const label = "time mouse fft() requestAnimationFrame";
        ctx.fillRect(0, 0, width, height);
      `)
    ).toEqual({});
  });
});
