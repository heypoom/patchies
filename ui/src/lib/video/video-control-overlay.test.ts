import { describe, expect, it } from 'vitest';

import {
  VIDEO_OVERLAY_IDLE_MS,
  VideoOverlaySeekPlaybackGate,
  VideoControlOverlayVisibility,
  formatVideoOverlayTime,
  getVideoOverlayDisplayTime,
  getVideoOverlayDuration
} from './video-control-overlay';

describe('video control overlay', () => {
  it('formats video times as clock labels', () => {
    expect(formatVideoOverlayTime(6)).toBe('00:06');
    expect(formatVideoOverlayTime(74)).toBe('01:14');
    expect(formatVideoOverlayTime(3671)).toBe('1:01:11');
    expect(formatVideoOverlayTime(Number.NaN)).toBe('00:00');
  });

  it('prefers worker time after MediaBunny starts delivering frames', () => {
    expect(
      getVideoOverlayDisplayTime({ workerTime: 12, elementTime: 3, hasWorkerFrame: true })
    ).toBe(12);
    expect(
      getVideoOverlayDisplayTime({ workerTime: 0, elementTime: 3, hasWorkerFrame: false })
    ).toBe(3);
  });

  it('uses metadata duration before falling back to the native element duration', () => {
    expect(getVideoOverlayDuration({ metadataDuration: 44, elementDuration: 30 })).toBe(44);
    expect(getVideoOverlayDuration({ metadataDuration: undefined, elementDuration: 30 })).toBe(30);
    expect(
      getVideoOverlayDuration({ metadataDuration: Number.NaN, elementDuration: Infinity })
    ).toBe(0);
  });

  it('keeps the overlay visible while there is recent mouse activity', () => {
    const visibility = new VideoControlOverlayVisibility();

    visibility.show(100);

    expect(visibility.visible).toBe(true);
    expect(visibility.shouldHide(100 + VIDEO_OVERLAY_IDLE_MS - 1)).toBe(false);
    expect(visibility.shouldHide(100 + VIDEO_OVERLAY_IDLE_MS)).toBe(true);
  });

  it('does not auto-hide while the seek bar is being dragged', () => {
    const visibility = new VideoControlOverlayVisibility();

    visibility.show(100);
    visibility.startScrubbing();

    expect(visibility.shouldHide(100 + VIDEO_OVERLAY_IDLE_MS)).toBe(false);

    visibility.stopScrubbing(100 + VIDEO_OVERLAY_IDLE_MS);

    expect(visibility.shouldHide(100 + VIDEO_OVERLAY_IDLE_MS * 2)).toBe(true);
  });

  it('resumes playback after overlay scrubbing only when video was playing before', () => {
    const gate = new VideoOverlaySeekPlaybackGate();

    expect(gate.start({ paused: false })).toEqual({ shouldPause: true });
    expect(gate.start({ paused: true })).toEqual({ shouldPause: false });
    expect(gate.stop()).toEqual({ shouldResume: true });

    expect(gate.start({ paused: true })).toEqual({ shouldPause: false });
    expect(gate.stop()).toEqual({ shouldResume: false });
  });
});
