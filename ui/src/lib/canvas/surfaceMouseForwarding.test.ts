import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/svelte';

import {
  getSurfaceMouseForwardingKey,
  getSurfaceMouseTargets,
  getSurfaceWheelTargets
} from './surfaceMouseForwarding';

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

  it('disables pointer forwarding when enabled is false', () => {
    expect(getSurfaceMouseTargets(nodes, { enabled: false })).toEqual([]);
  });

  it('disables pointer forwarding when only is an empty list', () => {
    expect(getSurfaceMouseTargets(nodes, { only: [] })).toEqual([]);
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

  it('disables wheel forwarding when enabled is false', () => {
    expect(getSurfaceWheelTargets(nodes, { enabled: false })).toEqual([]);
  });

  it('disables wheel forwarding when only is an empty list', () => {
    expect(getSurfaceWheelTargets(nodes, { only: [] })).toEqual([]);
  });

  it('builds the graph-change key from mouse-aware render nodes only', () => {
    expect(
      getSurfaceMouseForwardingKey([
        ...nodes,
        { id: 'message-1', type: 'message', data: {} },
        { id: 'slider-1', type: 'slider', data: {} }
      ] as Node[])
    ).toBe(
      'three-1:three:|shaderpark-3d-1:shaderpark:3d|shaderpark-flat-1:shaderpark:flat|glsl-1:glsl:'
    );
  });
});
