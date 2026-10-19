import { describe, expect, it } from 'vitest';

import { analyzePatchbay } from '$lib/patchbay/patchbay-parser';

import { getPatchbayObjectPorts } from './patchbay-object-ports';

describe('getPatchbayObjectPorts', () => {
  it.each(['textmode', 'textmode.dom'])(
    'resolves %s video outlets in object-to-object routes',
    (type) => {
      const objects = getPatchbayObjectPorts([
        {
          id: 'textmode-10',
          type,
          data: { videoOutletCount: 1 }
        },
        {
          id: 'glsl-11',
          type: 'glsl',
          data: {
            glUniformDefs: [{ name: 'iChannel0', type: 'sampler2D' }]
          }
        }
      ]);

      const result = analyzePatchbay('[Video]\nobj textmode-10 -> obj glsl-11', { objects });

      expect(result.diagnostics).toEqual([]);
      expect(result.videoRoutes).toMatchObject([
        {
          fromEndpoint: { nodeId: 'textmode-10', handle: 'video-out-0' },
          toEndpoint: { nodeId: 'glsl-11', handle: 'video-in-0-iChannel0-sampler2D' }
        }
      ]);
    }
  );

  it('resolves dynamic Hydra video outlet handles from node data', () => {
    const ports = getPatchbayObjectPorts([
      {
        id: 'hydra-39',
        type: 'hydra',
        data: {
          videoInletCount: 2,
          videoOutletCount: 2
        }
      }
    ]);

    expect(ports.get('hydra-39')?.video).toEqual({
      inlets: ['video-in-0', 'video-in-1'],
      outlets: ['video-out-0', 'video-out-1']
    });
  });

  it.each(['hydra', 'textmode', 'textmode.dom'])(
    'defaults %s video outlets to one when node data has no count',
    (type) => {
      const ports = getPatchbayObjectPorts([
        {
          id: 'hydra-39',
          type,
          data: {}
        }
      ]);

      expect(ports.get('hydra-39')?.video?.outlets).toEqual(['video-out-0']);
    }
  );

  it.each(['textmode', 'textmode.dom'])('does not expose disabled %s video output', (type) => {
    const ports = getPatchbayObjectPorts([
      {
        id: 'textmode-10',
        type,
        data: { videoOutletCount: 0 }
      }
    ]);

    expect(ports.get('textmode-10')?.video?.outlets).toEqual([]);
  });
});
