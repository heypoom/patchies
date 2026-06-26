import { describe, expect, it } from 'vitest';

import {
  VIDEO_OVERLAY_IDLE_MS,
  VideoOverlayPointerFocusGate,
  VideoOverlaySeekPlaybackGate,
  VideoControlOverlayVisibility,
  formatVideoOverlayTime,
  getRangePointerTime,
  isPendingSeekComplete,
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

  it('keeps an optimistic seek target visible until the worker catches up', () => {
    expect(
      getVideoOverlayDisplayTime({
        workerTime: 5,
        elementTime: 5,
        hasWorkerFrame: true,
        pendingSeekTime: 20
      })
    ).toBe(20);
  });

  it('treats a pending seek as complete only when playback time reaches the target', () => {
    expect(isPendingSeekComplete({ pendingSeekTime: 20, currentTime: 19.95 })).toBe(true);
    expect(isPendingSeekComplete({ pendingSeekTime: 20, currentTime: 5 })).toBe(false);
    expect(isPendingSeekComplete({ pendingSeekTime: null, currentTime: 5 })).toBe(false);
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

  it('skips focus-triggered seek start immediately after pointer seek start', () => {
    const gate = new VideoOverlayPointerFocusGate();

    gate.startPointerSeek();

    expect(gate.shouldStartSeekOnFocus()).toBe(false);

    gate.endPointerSeek();

    expect(gate.shouldStartSeekOnFocus()).toBe(true);
  });

  it('maps a range pointer position to the clicked video time', () => {
    expect(
      getRangePointerTime({
        clientX: 75,
        left: 50,
        width: 100,
        min: 0,
        max: 44
      })
    ).toBe(11);
  });

  it('clamps range pointer seek times to the range bounds', () => {
    expect(
      getRangePointerTime({
        clientX: 10,
        left: 50,
        width: 100,
        min: 2,
        max: 10
      })
    ).toBe(2);
    expect(
      getRangePointerTime({
        clientX: 200,
        left: 50,
        width: 100,
        min: 2,
        max: 10
      })
    ).toBe(10);
  });
});
