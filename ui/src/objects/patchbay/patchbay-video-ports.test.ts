import { describe, expect, it } from 'vitest';

import { validateHandle } from '$lib/ai/debug/handle-specs';
import { analyzePatchbay } from '$lib/patchbay/patchbay-parser';

import { getPatchbayObjectPorts } from './patchbay-object-ports';

describe('patchbay visual object ports', () => {
  it.each([
    'pixi',
    'pixi.dom',
    'three',
    'three.dom',
    'canvas',
    'canvas.dom',
    'textmode',
    'textmode.dom',
    'hydra',
    'regl',
    'swgl',
    'shaderpark',
    'p5',
    'surface',
    'img',
    'video',
    'webcam',
    'screen',
    'float.tex',
    'uxn',
    'bchrn',
    'ai.img',
    'vision.segment',
    'recv.vdo',
    'projmap'
  ])('routes %s video output to bg.out using its rendered handle', (type) => {
    const objects = getPatchbayObjectPorts([
      { id: 'source', type, data: { videoOutletCount: 1 } },
      { id: 'output', type: 'bg.out', data: {} }
    ]);

    const result = analyzePatchbay('[Video]\nobj source -> obj output', { objects });

    expect(result.diagnostics).toEqual([]);
    expect(result.videoRoutes).toMatchObject([
      {
        fromEndpoint: { nodeId: 'source', handle: 'video-out-0' },
        toEndpoint: { nodeId: 'output', handle: 'video-in-0' }
      }
    ]);

    expect(objects.get('source')?.video?.outlets).toEqual(['video-out-0']);
  });

  it('resolves dynamic SwissGL video inlets and outlets', () => {
    const objects = getPatchbayObjectPorts([
      {
        id: 'swgl',
        type: 'swgl',
        data: { videoInletCount: 2, videoOutletCount: 2 }
      }
    ]);

    expect(objects.get('swgl')?.video).toEqual({
      inlets: ['video-in-0', 'video-in-1'],
      outlets: ['video-out-0', 'video-out-1']
    });

    expect(validateHandle('swgl', 'video-in-1', 'in')).toBeNull();
    expect(validateHandle('swgl', 'video-out-1', 'out')).toBeNull();
  });

  it('does not expose a disabled surface video outlet', () => {
    const objects = getPatchbayObjectPorts([
      { id: 'surface', type: 'surface', data: { videoOutletCount: 0 } }
    ]);

    expect(objects.get('surface')?.video?.outlets).toEqual([]);
  });

  it('recognizes ai.img image input as video', () => {
    const objects = getPatchbayObjectPorts([{ id: 'image', type: 'ai.img', data: {} }]);

    expect(objects.get('image')?.video?.inlets).toEqual(['video-in-0']);
    expect(objects.get('image')?.audio).toEqual({ inlets: [], outlets: [] });
  });
});
