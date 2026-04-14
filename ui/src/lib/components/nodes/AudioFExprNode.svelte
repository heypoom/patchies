<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import {
    parseInletCount,
    parseFExprSignalInletCount,
    parseMultiOutletExpressions
  } from '$lib/utils/expr-parser';
  import CommonExprLayout from './CommonExprLayout.svelte';
  import { removeExcessAudioOutletEdges } from './outlet-edges';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr: string };
    selected: boolean;
  } = $props();

  let isEditing = $state(!data.expr); // Start in editing mode if no expression
  let inletValues = $state<number[]>([]);

  const messageContext = new MessageContext(nodeId);
  let audioService = AudioService.getInstance();
  let layoutRef = $state<any>();

  const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  // Control inlet count ($1, $2, etc.)
  const controlInletCount = $derived.by(() => {
    if (!data.expr.trim()) return 0;

    return parseInletCount(data.expr.trim());
  });

  // Signal inlet count (x1, x2, s1, s2, etc.)
  const signalInletCount = $derived.by(() => {
    if (!data.expr.trim()) return 1; // Default to 1 signal inlet

    return Math.max(1, parseFExprSignalInletCount(data.expr.trim()));
  });

  // Outlet count from multi-outlet expressions
  const outletCount = $derived.by(() => {
    if (!data.expr.trim()) return 1;

    return parseMultiOutletExpressions(data.expr.trim()).outletCount;
  });

  // Remove stale edges when outlet count decreases
  $effect(() => {
    removeExcessAudioOutletEdges(nodeId, outletCount, getEdges, deleteElements);
  });

  const handleMessage: MessageCallbackFn = (message, meta) => {
    const nextInletValues = [...inletValues];

    match(message)
      .with(P.union(P.number), (value) => {
        if (meta?.inlet === undefined) return;

        nextInletValues[meta.inlet] = value;
        inletValues = nextInletValues;

        updateAudioInletValues(nextInletValues);
      })
      .with(P.string, (newExpr) => {
        updateNodeData(nodeId, { expr: newExpr });
        updateAudioExpression(newExpr);
      });
  };

  const updateAudioExpression = (expression: string) =>
    audioService.send(nodeId, 'expression', expression);

  // Use `Array.from` to avoid sending Svelte proxies
  const updateAudioInletValues = (values: number[]) =>
    audioService.send(nodeId, 'inletValues', Array.from(values));

  function handleExpressionChange(newExpr: string) {
    updateNodeData(nodeId, { expr: newExpr });
  }

  function handleRun() {
    const parsed = parseMultiOutletExpressions(data.expr || '');

    // Send multi-outlet expressions to audio node (triggers worklet recreation if outlet count changed)
    audioService.send(nodeId, 'expressions', {
      assignments: parsed.assignments,
      outletExpressions: parsed.outletExpressions,
      outletCount: parsed.outletCount
    });

    // Update control inlet count when expression changes
    const newControlInletCount = parseInletCount(data.expr || '');

    if (newControlInletCount !== inletValues.length) {
      const prevValues = Array.from(inletValues);

      // Copy old values to the new resized list.
      inletValues = Array.from({ length: newControlInletCount }, (_, i) =>
        i < prevValues.length ? prevValues[i] : 0
      );

      updateAudioInletValues(inletValues);
    }

    // Notify xyflow about handle changes (signal inlets or outlets may have changed)
    updateNodeInternals(nodeId);
  }

  onMount(() => {
    messageContext.queue.addCallback(handleMessage);

    inletValues = new Array(controlInletCount).fill(0);
    audioService.createNode(nodeId, 'fexpr~', [null, data.expr]);
    updateAudioInletValues(inletValues);

    if (isEditing) {
      setTimeout(() => layoutRef?.focus(), 10);
    }
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();

    audioService.removeNodeById(nodeId);
  });
</script>

{#snippet audioHandles()}
  <!-- Total inlets = signal inlets + control inlets -->
  {@const totalInlets = signalInletCount + controlInletCount}

  <!-- Audio signal inputs (x1/s1, x2/s2, etc.) -->
  {#each Array.from({ length: signalInletCount }) as _, index}
    <TypedHandle
      port="inlet"
      spec={{
        handleType: 'audio',
        handleId: signalInletCount === 1 && index === 0 ? undefined : index
      }}
      title={signalInletCount > 1 ? `x${index + 1}` : 'Audio Input'}
      total={totalInlets}
      {index}
      class="top-0"
      {nodeId}
    />
  {/each}

  <!-- Control inlets for $1-$9 variables (only show if there are $ variables) -->
  {#if controlInletCount > 0}
    {#each Array.from({ length: controlInletCount }) as _, index}
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
  {#each Array.from({ length: outletCount }) as _, index}
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
  placeholder="(x1 + x1[-1]) / 2"
  editorClass="audio-fexpr-node-code-editor"
  displayPrefix="fexpr~"
  onExpressionChange={handleExpressionChange}
  handles={audioHandles}
  outlets={audioOutlets}
  onRun={handleRun}
  exitOnRun={false}
  runOnExit
/>

<style>
  :global(.audio-fexpr-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }
</style>
