import { describe, expect, it } from 'vitest';

import { getPatchbayObjectPorts } from './patchbay-object-ports';

describe('getPatchbayObjectPorts', () => {
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

  it('defaults dynamic visual node video outlets to one when old node data has no count', () => {
    const ports = getPatchbayObjectPorts([
      {
        id: 'hydra-39',
        type: 'hydra',
        data: {}
      }
    ]);

    expect(ports.get('hydra-39')?.video?.outlets).toEqual(['video-out-0']);
  });
});
