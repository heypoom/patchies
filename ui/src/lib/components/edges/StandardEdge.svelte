<script lang="ts">
  import { getEdgeTypes } from '$lib/utils/get-edge-types';
  import {
    getBezierPath,
    BaseEdge,
    type EdgeProps,
    useEdges,
    EdgeLabel,
    useNodesData
  } from '@xyflow/svelte';
  import { match } from 'ts-pattern';
  import { isBackgroundOutputCanvasEnabled } from '../../../stores/canvas.store';

  let {
    id,
    source,
    target,
    sourceHandleId,
    targetHandleId,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    markerEnd,
    style,
    selectable,
    selected
  }: EdgeProps = $props();

  const type = $derived.by(() => {
    const [sourceData, targetData] = nodesData.current;

    return getEdgeTypes(sourceData, targetData, sourceHandleId ?? null, targetHandleId ?? null);
  });

  const edgeClass = $derived.by(() => {
    const baseClass = match(type)
      .with('audio', () => '!stroke-blue-400')
      .with('video', () => '!stroke-orange-400')
      .with('message', () => '!stroke-zinc-200')
      .exhaustive();

    const deselectedClass = match(type)
      .with('message', () => 'opacity-60')
      .otherwise(() => 'opacity-90');

    const strokeStyle = match([selected, $isBackgroundOutputCanvasEnabled])
      .with([true, true], () => '!stroke-[2px] opacity-100')
      .with([false, true], () => '!stroke-[2px] opacity-80')
      .with([true, false], () => '!stroke-[1.5px]')
      .otherwise(() => '!stroke-[0.7px]');

    return [baseClass, !selected && deselectedClass, strokeStyle];
  });

  const nodesData = useNodesData([source, target]);

  let [edgePath] = $derived(
    getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition
    })
  );
</script>

<BaseEdge path={edgePath} {markerEnd} class={edgeClass} />
