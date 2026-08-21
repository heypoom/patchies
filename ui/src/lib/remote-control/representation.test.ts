import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/svelte';
import {
  applyRepresentationFileWrite,
  buildObjectRepresentations,
  buildPatchRepresentation,
  PATCH_REPRESENTATION_VERSION
} from './representation';

const glslNode: Node = {
  id: 'glsl-24',
  type: 'glsl',
  position: { x: 0, y: 0 },
  data: { code: 'void mainImage() {}' }
};

describe('patch representation', () => {
  it('serializes supported objects without a global object index', () => {
    expect(buildPatchRepresentation('patch-1', [glslNode])).toEqual({
      format: PATCH_REPRESENTATION_VERSION,
      patchId: 'patch-1',
      objects: [
        {
          id: 'glsl-24',
          metadata: {
            format: PATCH_REPRESENTATION_VERSION,
            id: 'glsl-24',
            objectType: 'glsl',
            files: ['shader.frag']
          },
          files: { 'shader.frag': 'void mainImage() {}' }
        }
      ]
    });
  });

  it('maps a GLSL file write to its code field', () => {
    expect(applyRepresentationFileWrite([glslNode], 'glsl-24/shader.frag', 'new code')).toEqual({
      status: 'applied',
      nodeId: 'glsl-24',
      dataKey: 'code',
      oldValue: 'void mainImage() {}',
      newValue: 'new code',
      runDataKey: 'executeCode'
    });
  });

  it('omits unsupported objects from object updates', () => {
    expect(buildObjectRepresentations([{ ...glslNode, type: 'group' }])).toEqual([]);
  });

  it('does not make unsupported paths mutable', () => {
    expect(applyRepresentationFileWrite([glslNode], 'glsl-24/patchies.object.json', '{}')).toEqual({
      status: 'unsupported'
    });
  });
});
