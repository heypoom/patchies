import { describe, expect, it } from 'vitest';

import { stringifyPatch, type PatchSaveFormat } from './serialize-patch';

describe('stringifyPatch', () => {
  it('omits runtime Float32Array values from object parameters', () => {
    const patch: PatchSaveFormat = {
      name: 'custom distortion',
      version: '16',
      timestamp: 0,
      nodes: [
        {
          id: 'waveshaper',
          type: 'object',
          position: { x: 0, y: 0 },
          data: {
            expr: 'waveshaper~',
            name: 'waveshaper~',
            params: [null, new Float32Array([0.25, 0.5, 0.75]), 'none']
          }
        }
      ],
      edges: []
    };

    const saved = JSON.parse(stringifyPatch(patch)) as PatchSaveFormat;

    expect(saved.nodes[0]?.data).toEqual({
      expr: 'waveshaper~',
      name: 'waveshaper~',
      params: [null, null, 'none']
    });
  });

  it('retains regular number arrays in patch state', () => {
    const patch: PatchSaveFormat = {
      name: 'number list',
      version: '16',
      timestamp: 0,
      nodes: [
        {
          id: 'object',
          type: 'object',
          position: { x: 0, y: 0 },
          data: { params: [[0.25, 0.5, 0.75]] }
        }
      ],
      edges: []
    };

    const saved = JSON.parse(stringifyPatch(patch)) as PatchSaveFormat;

    expect(saved.nodes[0]?.data).toEqual({ params: [[0.25, 0.5, 0.75]] });
  });
});
