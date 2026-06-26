<script lang="ts">
  import { NodeResizer } from '@xyflow/svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import {
    GROUP_BORDER_HIT_ZONES,
    getGroupTitleClasses,
    getGroupVisualFrameClasses
  } from '$lib/canvas/group-hit-zones';

  let node: {
    id: string;
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const eventBus = PatchiesEventBus.getInstance();
  const width = $derived(node.width ?? 360);
  const height = $derived(node.height ?? 240);
  const frameStyle = $derived(
    node.width !== undefined && node.height !== undefined
      ? 'width: 100%; height: 100%;'
      : `width: ${width}px; height: ${height}px;`
  );
  const visualFrameClasses = $derived(getGroupVisualFrameClasses(node.selected));

  function handleResizeEnd() {
    eventBus.dispatch({ type: 'visualGroupSyncRequested', groupId: node.id });
  }

  function handleResizeStart() {
    eventBus.dispatch({ type: 'visualGroupResizeStarted', groupId: node.id });
  }
</script>

<div class="pointer-events-none relative" style={frameStyle}>
  <NodeResizer
    class="pointer-events-auto z-1"
    isVisible={node.selected}
    minWidth={160}
    minHeight={120}
    keepAspectRatio={false}
    onResizeStart={handleResizeStart}
    onResizeEnd={handleResizeEnd}
  />

  <div class={getGroupTitleClasses()} aria-label="Select group">
    <div class="font-mono text-xs font-medium text-zinc-400">group</div>
  </div>

  <div class={visualFrameClasses} aria-hidden="true"></div>

  {#each GROUP_BORDER_HIT_ZONES as zone (zone.id)}
    <div class={zone.className} aria-label={zone.ariaLabel}></div>
  {/each}
</div>

<style>
  :global(.svelte-flow__node-group) {
    pointer-events: none !important;
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
    color: inherit !important;
    text-align: initial !important;
  }

  :global(.svelte-flow__node-group.selectable:hover),
  :global(.svelte-flow__node-group.selectable.selected),
  :global(.svelte-flow__node-group.selectable:focus),
  :global(.svelte-flow__node-group.selectable:focus-visible) {
    box-shadow: none !important;
  }
</style>
