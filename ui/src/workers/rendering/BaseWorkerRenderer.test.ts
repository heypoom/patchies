import { afterEach, describe, expect, it, vi } from 'vitest';
import type regl from 'regl';

import { BaseWorkerRenderer } from './BaseWorkerRenderer';
import type { FBORenderer } from './fboRenderer';

import { PollingClockScheduler } from '../../lib/transport/ClockScheduler';

class TestRenderer extends BaseWorkerRenderer {
  constructor(usesVideoCount: boolean) {
    super(
      { code: '', nodeId: 'test-node' },
      {} as regl.Framebuffer2D,
      {
        outputSize: [1920, 1080],
        clockScheduler: new PollingClockScheduler(),
        transportState: null,
        lastTime: 0
      } as FBORenderer
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
  afterEach(() => vi.unstubAllGlobals());

  it('sends arrow-key movement and bundled interaction updates from user APIs', () => {
    const postMessage = vi.fn();
    vi.stubGlobal('self', { postMessage });
    const context = new TestRenderer(false).getExtraContext();

    (context.noArrowKeyMove as () => void)();
    (context.noInteract as () => void)();

    expect(postMessage).toHaveBeenNthCalledWith(1, {
      type: 'setInteraction',
      nodeId: 'test-node',
      mode: 'arrowKeyMove',
      enabled: false
    });

    expect(postMessage).toHaveBeenNthCalledWith(2, {
      type: 'setInteraction',
      nodeId: 'test-node',
      mode: 'interact',
      enabled: false
    });
  });

  it('omits setVideoOutput when video ports are controlled by setVideoCount', () => {
    const renderer = new TestRenderer(true);

    expect(renderer.getExtraContext()).not.toHaveProperty('setVideoOutput');
  });

  it('keeps setVideoOutput for renderers without setVideoCount', () => {
    const renderer = new TestRenderer(false);

    expect(renderer.getExtraContext()).toHaveProperty('setVideoOutput');
  });
});
