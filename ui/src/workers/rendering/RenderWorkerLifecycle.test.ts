import { describe, expect, it } from 'vitest';

import { RenderWorkerLifecycle } from './RenderWorkerLifecycle';

describe('RenderWorkerLifecycle', () => {
  it('starts when a graph becomes available after rendering was requested', () => {
    const lifecycle = new RenderWorkerLifecycle();

    lifecycle.requestStart();

    expect(lifecycle.takeStart(false)).toBe(false);
    expect(lifecycle.takeStart(true)).toBe(true);
    expect(lifecycle.isRunning).toBe(true);
  });

  it('cancels a pending start when rendering is stopped before graph construction', () => {
    const lifecycle = new RenderWorkerLifecycle();

    lifecycle.requestStart();
    lifecycle.stop();

    expect(lifecycle.takeStart(true)).toBe(false);
    expect(lifecycle.isRunning).toBe(false);
  });
});
