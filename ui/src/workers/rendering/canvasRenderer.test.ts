import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasRenderer } from './canvasRenderer';

interface PausedRenderer {
  pausedCallback: FrameRequestCallback | null;
  scheduleAnimationFrame(callback: FrameRequestCallback): number;
}

interface ScheduleRenderer {
  scheduleAnimationFrame(callback: FrameRequestCallback): number;
}

describe('CanvasRenderer animation scheduling', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  let pendingFrames: FrameRequestCallback[];

  beforeEach(() => {
    pendingFrames = [];

    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      pendingFrames.push(callback);

      return pendingFrames.length;
    });

    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('does not replay an already completed one-shot RAF callback on resume', () => {
    const renderer = new (CanvasRenderer as unknown as new (
      config: { code: string; nodeId: string },
      framebuffer: unknown,
      renderer: unknown
    ) => CanvasRenderer)(
      { code: '', nodeId: 'canvas-1' },
      {},
      {
        isNodePaused: () => false,
        isNodeCookRequired: () => true,
        drawProfiler: { measure: (_nodeId: string, _category: string, fn: () => void) => fn() }
      }
    );

    const callback = vi.fn();

    (renderer as unknown as PausedRenderer).pausedCallback = callback;
    (renderer as unknown as ScheduleRenderer).scheduleAnimationFrame(callback);

    pendingFrames.shift()?.(16);
    renderer.resumeAnimation();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(pendingFrames).toHaveLength(0);
  });
});
