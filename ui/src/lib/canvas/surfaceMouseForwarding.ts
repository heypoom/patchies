import { match } from 'ts-pattern';
import type { Node } from '@xyflow/svelte';

export type SurfaceWheelTarget =
  | { kind: 'three'; nodeId: string }
  | { kind: 'shaderpark3d'; nodeId: string };

export function getSurfaceWheelTargets(nodes: Node[]): SurfaceWheelTarget[] {
  return nodes.flatMap((node) =>
    match({ type: node.type, renderMode: node.data?.renderMode })
      .with({ type: 'three' }, (): SurfaceWheelTarget[] => [{ kind: 'three', nodeId: node.id }])
      .with({ type: 'shaderpark', renderMode: '3d' }, (): SurfaceWheelTarget[] => [
        { kind: 'shaderpark3d', nodeId: node.id }
      ])
      .otherwise((): SurfaceWheelTarget[] => [])
  );
}
