<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { parseInletCount, parseSignalInletCount } from '$lib/utils/expr-parser';
  import CommonExprLayout from './CommonExprLayout.svelte';

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

  const { updateNodeData } = useSvelteFlow();
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
    updateAudioExpression(data.expr);

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

    // Notify xyflow about handle changes (signal inlets may have changed)
    updateNodeInternals(nodeId);
  }

  onMount(() => {
    messageContext.queue.addCallback(handleMessage);

    inletValues = new Array(controlInletCount).fill(0);
    audioService.createNode(nodeId, 'expr~', [null, data.expr]);
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

  <!-- Audio signal inputs (s1, s2, etc. - 1-indexed to match $1, $2) -->
  {#each Array.from({ length: signalInletCount }) as _, index}
    <StandardHandle
      port="inlet"
      type="audio"
      id={signalInletCount === 1 && index === 0 ? undefined : index}
      title={signalInletCount > 1 ? `s${index + 1}` : 'Audio Input'}
      total={totalInlets}
      {index}
      class="top-0"
      {nodeId}
    />
  {/each}

  <!-- Control inlets for $1-$9 variables (only show if there are $ variables) -->
  {#if controlInletCount > 0}
    {#each Array.from({ length: controlInletCount }) as _, index}
      <StandardHandle
        port="inlet"
        type="message"
        id={index}
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
  <!-- Audio output -->
  <StandardHandle
    port="outlet"
    type="audio"
    id="audio-out"
    title="Audio Output"
    total={1}
    index={0}
    {nodeId}
  />
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
  exitOnRun={false}
  runOnExit
/>

<style>
  :global(.audio-expr-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }
</style>
