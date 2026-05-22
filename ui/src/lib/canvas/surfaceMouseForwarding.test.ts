import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/svelte';

import { getSurfaceWheelTargets } from './surfaceMouseForwarding';

describe('surface mouse forwarding', () => {
  it('targets worker Three and Shader Park 3D nodes for surface wheel events', () => {
    const nodes = [
      { id: 'three-1', type: 'three', data: {} },
      { id: 'shaderpark-3d-1', type: 'shaderpark', data: { renderMode: '3d' } },
      { id: 'shaderpark-flat-1', type: 'shaderpark', data: { renderMode: 'flat' } },
      { id: 'glsl-1', type: 'glsl', data: {} }
    ] as Node[];

    expect(getSurfaceWheelTargets(nodes)).toEqual([
      { kind: 'three', nodeId: 'three-1' },
      { kind: 'shaderpark3d', nodeId: 'shaderpark-3d-1' }
    ]);
  });
});
