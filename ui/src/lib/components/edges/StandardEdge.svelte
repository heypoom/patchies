<script lang="ts">
  import { getEdgeTypes } from '$lib/utils/get-edge-types';
  import { getBezierPath, BaseEdge, type EdgeProps, useNodesData } from '@xyflow/svelte';
  import { isBackgroundOutputCanvasEnabled } from '../../../stores/canvas.store';
  import { isCablesVisible } from '../../../stores/ui.store';
  import { feedbackEdgeIds } from '../../../stores/renderer.store';
  import { getStandardEdgeClass } from './edge-style';

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
    selected
  }: EdgeProps = $props();

  const type = $derived.by(() => {
    const [sourceData, targetData] = nodesData.current;

    return getEdgeTypes(sourceData, targetData, sourceHandleId ?? null, targetHandleId ?? null);
  });

  const isFeedback = $derived($feedbackEdgeIds.has(id));

  const edgeClass = $derived.by(() => {
    return getStandardEdgeClass({
      type,
      selected: selected === true,
      isBackgroundOutputCanvasEnabled: $isBackgroundOutputCanvasEnabled
    });
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

<BaseEdge
  path={edgePath}
  {markerEnd}
  class={edgeClass}
  style={[$isCablesVisible ? '' : 'display: none', isFeedback ? 'stroke-dasharray: 6 4' : '']
    .filter(Boolean)
    .join('; ')}
/>

<style>
  :global(.svelte-flow__edge-path.edge-selected-glow) {
    filter: drop-shadow(0 0 4px rgb(253 224 71 / 0.9)) drop-shadow(0 0 12px rgb(250 204 21 / 0.7));
  }
</style>
