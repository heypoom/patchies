import { describe, expect, it } from 'vitest';
import type regl from 'regl';
import { BaseWorkerRenderer } from './BaseWorkerRenderer';
import type { FBORenderer } from './fboRenderer';

class TestRenderer extends BaseWorkerRenderer {
  constructor(usesVideoCount: boolean) {
    super(
      { code: '', nodeId: 'test-node' },
      {} as regl.Framebuffer2D,
      { outputSize: [1920, 1080], createWorkerClock: () => ({}) } as FBORenderer
    );

    this.usesVideoCount = usesVideoCount;
    this.settingsProxy = { settings: {} } as NonNullable<typeof this.settingsProxy>;
  }

  renderFrame() {}

  async updateCode() {}

  getExtraContext() {
    return this.buildBaseExtraContext();
  }
}

describe('BaseWorkerRenderer', () => {
  it('omits setVideoOutput when video ports are controlled by setVideoCount', () => {
    const renderer = new TestRenderer(true);

    expect(renderer.getExtraContext()).not.toHaveProperty('setVideoOutput');
  });

  it('keeps setVideoOutput for renderers without setVideoCount', () => {
    const renderer = new TestRenderer(false);

    expect(renderer.getExtraContext()).toHaveProperty('setVideoOutput');
  });
});
