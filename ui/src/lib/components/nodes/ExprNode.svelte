<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import {
    parseInletCount,
    createMultiOutletEvaluator,
    parseOutletCount,
    type MultiOutletEvaluatorResult
  } from '$lib/utils/expr-parser';
  import CommonExprLayout from './CommonExprLayout.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr: string; showConsole?: boolean };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  let isEditing = $state(!data.expr); // Start in editing mode if no expression
  let expr = $state(data.expr || ''); // Active expression being evaluated

  // Doesn't have to only be numbers! Could be arrays and objects!
  let inletValues = $state<unknown[]>([]);

  let layoutRef = $state<any>();
  let consoleRef: VirtualConsole | null = $state(null);
  let evalResult = $state<MultiOutletEvaluatorResult>({
    success: true,
    fns: [() => 0],
    outletCount: 1
  });

  const messageContext = new MessageContext(nodeId);
  const customConsole = createCustomConsole(nodeId);

  const inletCount = $derived.by(() => {
    if (!expr.trim()) return 1;

    return Math.max(1, parseInletCount(expr.trim()));
  });

  const outletCount = $derived(parseOutletCount(expr));

  // Update eval result when expression changes
  $effect(() => {
    evalResult = createMultiOutletEvaluator(expr);
  });

  // Handle incoming messages
  // Inlet 0 is hot (triggers output), all other inlets are cold (only store values)
  const handleMessage: MessageCallbackFn = (message, meta) => {
    const inlet = meta?.inlet ?? 0;
    const nextInletValues = [...inletValues];

    // Store value for this inlet
    match(message)
      .with(messages.bang, () => {})
      .otherwise((value) => {
        nextInletValues[inlet] = value;
        inletValues = nextInletValues;
      });

    // Only inlet 0 (hot) triggers output
    if (inlet !== 0) return;

    // Evaluate each outlet expression and send results
    if (evalResult.success) {
      try {
        const args = [...Array(9)].map((_, i) => nextInletValues[i] ?? 0);

        for (let i = 0; i < evalResult.fns.length; i++) {
          const result = evalResult.fns[i](...args);
          messageContext.send(result, { to: i });
        }
      } catch (error) {
        customConsole.error(error instanceof Error ? error.message : String(error));
      }
    }
  };

  function handleExpressionChange(newExpr: string) {
    // Just update data, don't re-evaluate yet
    data.expr = newExpr;
  }

  function handleRun() {
    // Clear previous errors
    consoleRef?.clearConsole();

    // Update active expression when SHIFT+ENTER is pressed
    expr = data.expr;

    // Re-evaluate and log any errors
    const result = createMultiOutletEvaluator(expr);
    evalResult = result;

    if (!result.success) {
      customConsole.error(result.error);
    }

    // Update inlet count when expression changes
    const newInletCount = parseInletCount(data.expr || '');

    if (newInletCount !== inletValues.length) {
      inletValues = new Array(newInletCount).fill(0);
    }
  }

  onMount(() => {
    messageContext.queue.addCallback(handleMessage);

    // Initialize inlet values array
    inletValues = new Array(inletCount).fill(0);

    // Focus editor if starting in editing mode
    if (isEditing) {
      setTimeout(() => layoutRef?.focus(), 10);
    }
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });
</script>

{#snippet exprHandles()}
  <!-- Dynamic inlets based on expression -->
  {#each Array.from({ length: inletCount }) as _, index}
    <TypedHandle
      port="inlet"
      spec={{ handleType: 'message', handleId: index }}
      title={index === 0 ? `$${index + 1} (hot)` : `$${index + 1} (cold)`}
      total={inletCount}
      {index}
      class="top-0"
      {nodeId}
      isHot={index === 0}
    />
  {/each}
{/snippet}

{#snippet exprOutlets()}
  {#each Array.from({ length: outletCount }) as _, index}
    <TypedHandle
      port="outlet"
      spec={{ handleType: 'message', handleId: index }}
      title={outletCount > 1 ? `Result ${index + 1}` : 'Result'}
      total={outletCount}
      {index}
      {nodeId}
    />
  {/each}
{/snippet}

<div class="group relative flex flex-col gap-2">
  <CommonExprLayout
    bind:this={layoutRef}
    {nodeId}
    {data}
    {selected}
    expr={data.expr}
    bind:isEditing
    placeholder="$1 + 2"
    displayPrefix="expr"
    editorClass="expr-node-code-editor"
    onExpressionChange={handleExpressionChange}
    handles={exprHandles}
    outlets={exprOutlets}
    onRun={handleRun}
    exitOnRun={false}
    runOnExit
    hasError={!evalResult.success}
  />

  <div class:hidden={!data.showConsole}>
    <VirtualConsole
      bind:this={consoleRef}
      {nodeId}
      placeholder="Expression errors will appear here."
      shouldAutoShowConsoleOnError
      shouldAutoHideConsoleOnNoError
    />
  </div>
</div>

<style>
  :global(.expr-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }
</style>
