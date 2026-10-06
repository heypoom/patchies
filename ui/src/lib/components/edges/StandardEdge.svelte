<script lang="ts">
  import { getEdgeTypes } from '$lib/utils/get-edge-types';
  import { getBezierPath, BaseEdge, type EdgeProps, useNodes, useSvelteFlow } from '@xyflow/svelte';
  import { isBackgroundOutputCanvasEnabled } from '../../../stores/canvas.store';
  import { isCablesVisible } from '../../../stores/ui.store';
  import { feedbackEdgeIds } from '../../../stores/renderer.store';
  import { edgeOpacity } from '../../../stores/appearance-settings.store';
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

  const nodes = useNodes();
  const { getNode } = useSvelteFlow();

  const type = $derived.by(() => {
    // Track node replacements while resolving the current endpoints by ID.
    void nodes.current;

    return getEdgeTypes(
      getNode(source),
      getNode(target),
      sourceHandleId ?? null,
      targetHandleId ?? null
    );
  });

  const isFeedback = $derived($feedbackEdgeIds.has(id));

  const edgeClass = $derived.by(() => {
    return getStandardEdgeClass({
      type,
      selected: selected === true,
      isBackgroundOutputCanvasEnabled: $isBackgroundOutputCanvasEnabled
    });
  });

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
  style={[
    $isCablesVisible ? '' : 'display: none',
    `opacity: ${$edgeOpacity / 100}`,
    isFeedback ? 'stroke-dasharray: 6 4' : ''
  ]
    .filter(Boolean)
    .join('; ')}
/>

<style>
  :global(.svelte-flow__edge-path.edge-selected-glow) {
    filter: drop-shadow(0 0 4px rgb(253 224 71 / 0.9)) drop-shadow(0 0 12px rgb(250 204 21 / 0.7));
  }
</style>
