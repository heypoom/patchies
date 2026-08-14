<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { onMount } from 'svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import {
    parseInletCount,
    parseSignalInletCount,
    parseMultiOutletExpressions
  } from '$lib/utils/expr-parser';
  import CommonExprLayout from '$objects/expression/CommonExprLayout.svelte';
  import { removeExcessAudioOutletEdges } from '$objects/object-layout/outlet-edges';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr: string };
    selected: boolean;
  } = $props();

  function getInitialIsEditing() {
    return !data.expr;
  }

  let isEditing = $state(getInitialIsEditing()); // Start in editing mode if no expression
  let audioService = AudioService.getInstance();
  let layoutRef = $state<any>();

  const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  // Control inlet count ($1, $2, etc.)
  const controlInletCount = $derived.by(() => {
    if (!data.expr.trim()) return 0;

    return parseInletCount(data.expr.trim());
  });

  // Signal inlet count (s1, s2, etc. or bare `s`)
  const signalInletCount = $derived.by(() => {
    if (!data.expr.trim()) return 1; // Default to 1 signal inlet

    return Math.max(1, parseSignalInletCount(data.expr.trim()));
  });

  // Outlet count from multi-outlet expressions
  const outletCount = $derived.by(() => {
    if (!data.expr.trim()) return 1;

    return parseMultiOutletExpressions(data.expr.trim()).outletCount;
  });

  // Remove stale edges when outlet count decreases
  $effect(() => {
    removeExcessAudioOutletEdges(nodeId, outletCount, getEdges, deleteElements);
    signalInletCount;
    controlInletCount;
    updateNodeInternals(nodeId);
  });

  function handleExpressionChange(newExpr: string) {
    updateNodeData(nodeId, { expr: newExpr });
  }

  function handleRun(expression = data.expr) {
    const parsed = parseMultiOutletExpressions(expression || '');

    // Send multi-outlet expressions to audio node (triggers worklet recreation if outlet count changed)
    audioService.send(nodeId, 'expressions', {
      assignments: parsed.assignments,
      outletExpressions: parsed.outletExpressions,
      outletCount: parsed.outletCount
    });
  }

  onMount(() => {
    if (isEditing) {
      setTimeout(() => layoutRef?.focus(), 10);
    }
  });
</script>

{#snippet audioHandles()}
  <!-- Total inlets = signal inlets + control inlets -->
  {@const totalInlets = signalInletCount + controlInletCount}

  <!-- Audio signal inputs (s1, s2, etc. - 1-indexed to match $1, $2) -->
  {#each Array.from({ length: signalInletCount }) as _, index (index)}
    <TypedHandle
      port="inlet"
      spec={{
        handleType: 'audio',
        handleId: signalInletCount === 1 && index === 0 ? undefined : index
      }}
      title={signalInletCount > 1 ? `s${index + 1}` : 'Audio Input'}
      total={totalInlets}
      {index}
      class="top-0"
      {nodeId}
    />
  {/each}

  <!-- Control inlets for $1-$9 variables (only show if there are $ variables) -->
  {#if controlInletCount > 0}
    {#each Array.from({ length: controlInletCount }) as _, index (index)}
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'message', handleId: index }}
        title={`$${index + 1}`}
        total={totalInlets}
        index={signalInletCount + index}
        class="top-0"
        {nodeId}
      />
    {/each}
  {/if}
{/snippet}

{#snippet audioOutlets()}
  {#each Array.from({ length: outletCount }) as _, index (index)}
    <TypedHandle
      port="outlet"
      spec={{ handleType: 'audio', handleId: index }}
      title={outletCount > 1 ? `Out ${index + 1}` : 'Audio Output'}
      total={outletCount}
      {index}
      {nodeId}
    />
  {/each}
{/snippet}

<CommonExprLayout
  bind:this={layoutRef}
  {nodeId}
  {data}
  {selected}
  expr={data.expr}
  bind:isEditing
  placeholder="s * 0.5"
  editorClass="audio-expr-node-code-editor"
  displayPrefix="expr~"
  onExpressionChange={handleExpressionChange}
  handles={audioHandles}
  outlets={audioOutlets}
  onRun={handleRun}
  persistOnInput={false}
  exitOnRun={false}
  runOnExit
/>

<style>
  :global(.audio-expr-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }
</style>
