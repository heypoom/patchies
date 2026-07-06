import { describe, expect, it } from 'vitest';

import { getVideoNodeDisplaySize } from '$objects/video/video-node-size';

describe('video node display size', () => {
  it('keeps the persisted resized dimensions when they already exist', () => {
    expect(
      getVideoNodeDisplaySize({
        nodeWidth: 320,
        nodeHeight: 180,
        videoWidth: 1280,
        videoHeight: 720,
        previewWidth: 160,
        previewHeight: 120
      })
    ).toEqual({ width: 320, height: 180 });
  });

  it('auto-sizes new video nodes from intrinsic video aspect ratio', () => {
    expect(
      getVideoNodeDisplaySize({
        nodeWidth: undefined,
        nodeHeight: undefined,
        videoWidth: 1280,
        videoHeight: 720,
        previewWidth: 160,
        previewHeight: 120
      })
    ).toEqual({ width: 160, height: 90 });
  });

  it('fits portrait videos within the preview height on first load', () => {
    expect(
      getVideoNodeDisplaySize({
        nodeWidth: undefined,
        nodeHeight: undefined,
        videoWidth: 720,
        videoHeight: 1280,
        previewWidth: 160,
        previewHeight: 120
      })
    ).toEqual({ width: 68, height: 120 });
  });
});
