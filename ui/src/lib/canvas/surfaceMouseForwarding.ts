import { match } from 'ts-pattern';
import type { Node } from '@xyflow/svelte';

const SHADERTOY_TYPES = new Set(['glsl', 'swgl', 'regl']);
const SIMPLE_TYPES = new Set(['hydra', 'canvas', 'textmode', 'shaderpark']);

export type SurfaceMouseForwardingRules = {
  enabled?: boolean;
  only?: readonly string[];
  except?: readonly string[];
};

export type SurfaceMouseTarget =
  | { kind: 'three'; nodeId: string; type: string }
  | { kind: 'shadertoy'; nodeId: string; type: string }
  | { kind: 'simple'; nodeId: string; type: string };

export type SurfaceWheelTarget =
  | { kind: 'three'; nodeId: string }
  | { kind: 'shaderpark3d'; nodeId: string };

function matchesForwardingRules(nodeId: string, rules?: SurfaceMouseForwardingRules): boolean {
  if (rules?.enabled === false) return false;

  const only = rules?.only ?? [];
  const except = rules?.except ?? [];

  if (rules?.only !== undefined && !only.includes(nodeId)) return false;

  return !except.includes(nodeId);
}

export const isSurfaceMouseForwardingNode = (node: Node): boolean =>
  match(node.type)
    .with('three', () => true)
    .when(
      (type) => SHADERTOY_TYPES.has(type ?? ''),
      () => true
    )
    .when(
      (type) => SIMPLE_TYPES.has(type ?? ''),
      () => true
    )
    .otherwise(() => false);

export const getSurfaceMouseForwardingKey = (nodes: Node[]): string =>
  nodes
    .filter(isSurfaceMouseForwardingNode)
    .map((node) => `${node.id}:${node.type ?? ''}:${String(node.data?.renderMode ?? '')}`)
    .join('|');

export const getSurfaceMouseTargets = (
  nodes: Node[],
  rules?: SurfaceMouseForwardingRules
): SurfaceMouseTarget[] =>
  nodes.flatMap((node) => {
    if (!matchesForwardingRules(node.id, rules)) return [];

    return match({ type: node.type, renderMode: node.data?.renderMode })
      .with({ type: 'three' }, (): SurfaceMouseTarget[] => [
        { kind: 'three', nodeId: node.id, type: 'three' }
      ])
      .with({ type: 'shaderpark', renderMode: '3d' }, (): SurfaceMouseTarget[] => [
        { kind: 'shadertoy', nodeId: node.id, type: 'shaderpark' }
      ])
      .when(
        ({ type }) => SHADERTOY_TYPES.has(type ?? ''),
        ({ type }): SurfaceMouseTarget[] => [
          { kind: 'shadertoy', nodeId: node.id, type: type ?? '' }
        ]
      )
      .when(
        ({ type }) => SIMPLE_TYPES.has(type ?? ''),
        ({ type }): SurfaceMouseTarget[] => [{ kind: 'simple', nodeId: node.id, type: type ?? '' }]
      )
      .otherwise((): SurfaceMouseTarget[] => []);
  });

export const getSurfaceWheelTargets = (
  nodes: Node[],
  rules?: SurfaceMouseForwardingRules
): SurfaceWheelTarget[] =>
  nodes.flatMap((node) => {
    if (!matchesForwardingRules(node.id, rules)) return [];

    return match({ type: node.type, renderMode: node.data?.renderMode })
      .with({ type: 'three' }, (): SurfaceWheelTarget[] => [{ kind: 'three', nodeId: node.id }])
      .with({ type: 'shaderpark', renderMode: '3d' }, (): SurfaceWheelTarget[] => [
        { kind: 'shaderpark3d', nodeId: node.id }
      ])
      .otherwise((): SurfaceWheelTarget[] => []);
  });
