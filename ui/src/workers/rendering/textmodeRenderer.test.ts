import { afterEach, describe, expect, it, vi } from 'vitest';

describe('TextmodeRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('limits synchronous redraws to the target frame rate', async () => {
    const redraw = vi.fn();
    const refresh = vi.fn();
    const now = vi.spyOn(performance, 'now');

    vi.stubGlobal('self', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    });

    const { TextmodeRenderer } = await import('./textmodeRenderer');

    const renderer = Object.create(TextmodeRenderer.prototype) as {
      tm: { redraw: () => void; targetFrameRate: () => number } | null;
      renderer: { regl: { _refresh: () => void } };
      renderFrame: () => void;
    };

    renderer.tm = { redraw, targetFrameRate: () => 20 };
    renderer.renderer = { regl: { _refresh: refresh } };

    now.mockReturnValueOnce(0).mockReturnValueOnce(8).mockReturnValueOnce(50);

    renderer.renderFrame();
    renderer.renderFrame();
    renderer.renderFrame();

    expect(redraw).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
