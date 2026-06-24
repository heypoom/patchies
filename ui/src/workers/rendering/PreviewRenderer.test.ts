import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FBONode } from '$lib/rendering/types';
import { PreviewRenderer } from './PreviewRenderer';
import type { PixelReadbackService } from './PixelReadbackService';
import {
  createMockFramebuffer,
  createMockTexture,
  createMockWebGL2Context
} from '$lib/test-utils/mockWebGL';

describe('PreviewRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('only starts preview reads for fresh enabled nodes during normal scheduling', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);

    const { service, gl } = createPreviewService();
    const renderer = new PreviewRenderer(service);
    const fboNodes = new Map<string, FBONode>([
      ['cached-node', createFboNode('cached-node')],
      ['cooked-node', createFboNode('cooked-node')]
    ]);

    renderer.setPreviewFpsCap(1000);
    renderer.setPreviewEnabled('cooked-node', true);

    renderer.renderPreviewBitmaps(fboNodes, false, new Set(['cooked-node']));

    expect(gl.readPixels).toHaveBeenCalledTimes(1);
  });

  it('starts one read for a newly enabled preview even when the node did not cook this frame', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);

    const { service, gl } = createPreviewService();
    const renderer = new PreviewRenderer(service);
    const fboNodes = new Map<string, FBONode>([['new-node', createFboNode('new-node')]]);

    renderer.setPreviewFpsCap(1000);
    renderer.setPreviewEnabled('new-node', true);

    renderer.renderPreviewBitmaps(fboNodes, false, new Set());

    expect(gl.readPixels).toHaveBeenCalledTimes(1);
  });

  it('keeps a cooked node eligible until its preview read starts', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { service, gl } = createPreviewService();
    const renderer = new PreviewRenderer(service);
    const fboNodes = new Map<string, FBONode>([
      ['stale-node', createFboNode('stale-node')],
      ['fresh-node', createFboNode('fresh-node')]
    ]);

    renderer.setPreviewFpsCap(1000);
    renderer.maxPreviewsPerFrameNoOutput = 2;
    renderer.setPreviewEnabled('stale-node', true);
    renderer.setPreviewEnabled('fresh-node', true);
    renderer.renderPreviewBitmaps(fboNodes, false, new Set());

    gl.clientWaitSync.mockReturnValue(gl.WAIT_FAILED);
    now.mockReturnValue(2000);
    renderer.renderPreviewBitmaps(fboNodes, false, new Set());

    gl.readPixels.mockClear();
    gl.clientWaitSync.mockReset();
    renderer.maxPreviewsPerFrameNoOutput = 1;
    now.mockReturnValue(3000);

    renderer.renderPreviewBitmaps(fboNodes, false, new Set(['fresh-node']));

    expect(gl.readPixels).toHaveBeenCalledTimes(1);
  });
});

function createPreviewService() {
  const gl = createMockWebGL2Context();

  const service = {
    gl,
    ensureIntermediateFboSize: vi.fn(),
    getIntermediateFbo: vi.fn(() => createMockFramebuffer()),
    getPbo: vi.fn(() => ({})),
    returnPbo: vi.fn()
  } as unknown as PixelReadbackService;

  return { service, gl };
}

function createFboNode(id: string): FBONode {
  const texture = createMockTexture(100, 100);

  return {
    id,
    framebuffer: createMockFramebuffer(),
    colorAttachments: [texture],
    texture,
    render: vi.fn(),
    previewSize: [25, 25]
  };
}
