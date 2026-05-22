import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/svelte';

import { getSurfaceMouseTargets, getSurfaceWheelTargets } from './surfaceMouseForwarding';

describe('surface mouse forwarding', () => {
  const nodes = [
    { id: 'three-1', type: 'three', data: {} },
    { id: 'shaderpark-3d-1', type: 'shaderpark', data: { renderMode: '3d' } },
    { id: 'shaderpark-flat-1', type: 'shaderpark', data: { renderMode: 'flat' } },
    { id: 'glsl-1', type: 'glsl', data: {} }
  ] as Node[];

  it('targets worker Three and Shader Park 3D nodes for surface wheel events', () => {
    expect(getSurfaceWheelTargets(nodes)).toEqual([
      { kind: 'three', nodeId: 'three-1' },
      { kind: 'shaderpark3d', nodeId: 'shaderpark-3d-1' }
    ]);
  });

  it('keeps all mouse-aware render nodes by default', () => {
    expect(getSurfaceMouseTargets(nodes).map((target) => target.nodeId)).toEqual([
      'three-1',
      'shaderpark-3d-1',
      'shaderpark-flat-1',
      'glsl-1'
    ]);
  });

  it('applies whitelist before blacklist when forwarding mouse events', () => {
    expect(
      getSurfaceMouseTargets(nodes, {
        only: ['three-1', 'glsl-1', 'missing-node'],
        except: ['glsl-1']
      })
    ).toEqual([{ kind: 'three', nodeId: 'three-1', type: 'three' }]);
  });

  it('applies forwarding filters to wheel targets too', () => {
    expect(
      getSurfaceWheelTargets(nodes, {
        only: ['three-1', 'shaderpark-3d-1'],
        except: ['three-1']
      })
    ).toEqual([{ kind: 'shaderpark3d', nodeId: 'shaderpark-3d-1' }]);
  });
});
