import { describe, expect, it, vi } from 'vitest';

import { FloatTextureFrameUploadScheduler } from './frame-upload-scheduler';

function createManualFrameScheduler() {
  const callbacks: FrameRequestCallback[] = [];

  const schedule = vi.fn((callback: FrameRequestCallback) => {
    callbacks.push(callback);

    return callbacks.length;
  });

  const cancel = vi.fn();

  return { callbacks, schedule, cancel };
}

describe('FloatTextureFrameUploadScheduler', () => {
  it('flushes only the latest queued upload on the next frame', () => {
    const frame = createManualFrameScheduler();
    const flush = vi.fn();
    const scheduler = new FloatTextureFrameUploadScheduler(flush, frame.schedule, frame.cancel);

    scheduler.queue({ width: 5 });
    scheduler.queue({ width: 20 });

    expect(frame.schedule).toHaveBeenCalledTimes(1);
    expect(flush).not.toHaveBeenCalled();

    frame.callbacks[0](0);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith({ width: 20 });
  });

  it('schedules a new frame after the previous upload flushes', () => {
    const frame = createManualFrameScheduler();
    const flush = vi.fn();
    const scheduler = new FloatTextureFrameUploadScheduler(flush, frame.schedule, frame.cancel);

    scheduler.queue({ width: 5 });
    frame.callbacks[0](0);
    scheduler.queue({ width: 20 });

    expect(frame.schedule).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending frame and drops the queued upload', () => {
    const frame = createManualFrameScheduler();
    const flush = vi.fn();
    const scheduler = new FloatTextureFrameUploadScheduler(flush, frame.schedule, frame.cancel);

    scheduler.queue({ width: 5 });
    scheduler.cancel();
    frame.callbacks[0](0);

    expect(frame.cancel).toHaveBeenCalledWith(1);
    expect(flush).not.toHaveBeenCalled();
  });
});
