import { describe, expect, it } from 'vitest';

import { LatestVideoSeek } from '$objects/video/latest-video-seek';

describe('LatestVideoSeek', () => {
  it('invalidates older seek generations when a newer time is requested', () => {
    const seek = new LatestVideoSeek();

    const first = seek.request(1);
    const second = seek.request(2);

    expect(seek.isLatest(first)).toBe(false);
    expect(seek.isLatest(second)).toBe(true);
    expect(seek.currentGeneration).toBe(second);
    expect(seek.currentTargetTime).toBe(2);
  });

  it('coalesces native video seeks to one in flight plus the latest pending time', () => {
    const seek = new LatestVideoSeek();

    expect(seek.requestNativeSeek(1)).toEqual({ generation: 1, shouldStartSeek: true });
    expect(seek.requestNativeSeek(2)).toEqual({ generation: 2, shouldStartSeek: false });
    expect(seek.requestNativeSeek(3)).toEqual({ generation: 3, shouldStartSeek: false });
    expect(seek.isNativeSeekInFlight).toBe(true);

    expect(seek.completeNativeSeek(1)).toEqual({ shouldStartNextSeek: true, targetTime: 3 });
    expect(seek.isNativeSeekInFlight).toBe(true);

    expect(seek.completeNativeSeek(3)).toEqual({ shouldStartNextSeek: false, targetTime: 3 });
    expect(seek.isNativeSeekInFlight).toBe(false);
  });
});
