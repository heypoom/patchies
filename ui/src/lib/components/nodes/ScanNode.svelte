<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { Terminal } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import CommonExprLayout from './CommonExprLayout.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { JSRunner } from '$lib/js-runner/JSRunner';
  import { handleCodeError } from '$lib/js-runner/handleCodeError';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr: string; showConsole?: boolean; initialValue?: unknown };
    selected: boolean;
  } = $props();

  let isEditing = $state(!data.expr);
  let expr = $state(data.expr || '');
  let hasError = $state(false);
  let layoutRef = $state<CommonExprLayout | null>(null);
  let consoleRef: VirtualConsole | null = $state(null);

  // Accumulator state - persists between messages
  let accumulator = $state<unknown>(data.initialValue ?? 0);
  let hasReceivedFirstValue = $state(false);

  const { updateNodeData } = useSvelteFlow();
  const messageContext = new MessageContext(nodeId);
  const customConsole = createCustomConsole(nodeId);
  const jsRunner = JSRunner.getInstance();

  function toggleConsole() {
    data.showConsole = !data.showConsole;
    updateNodeData(nodeId, { showConsole: data.showConsole });
  }

  /**
   * Evaluate the reduce expression
   * $1 = accumulator, $2 = new input value
   */
  async function evaluate(
    input: unknown
  ): Promise<{ success: true; result: unknown } | { success: false }> {
    if (!expr.trim()) {
      // No expression - just return the input
      return { success: true, result: input };
    }

    const code = `return (${expr})`;

    try {
      const extraContext: Record<string, unknown> = {
        $1: accumulator,
        $2: input
      };

      const result = await jsRunner.executeJavaScript(nodeId, code, {
        customConsole,
        skipMessageContext: true,
        extraContext
      });

      hasError = false;
      return { success: true, result };
    } catch (error) {
      hasError = true;
      handleCodeError(error, code, nodeId, customConsole);
      return { success: false };
    }
  }

  const handleMessage: MessageCallbackFn = (message, meta) => {
    const inlet = meta?.inlet ?? 0;

    // Inlet 1: reset accumulator
    if (inlet === 1) {
      match(message)
        .with({ type: 'bang' }, () => {
          // Reset to initial value
          accumulator = data.initialValue ?? 0;
          hasReceivedFirstValue = false;
        })
        .otherwise((value) => {
          // Set accumulator to specific value
          accumulator = value;
          hasReceivedFirstValue = true;
        });
      return;
    }

    // Inlet 0: process input
    const inputValue = match(message)
      .with({ type: 'bang' }, () => accumulator) // bang re-sends current accumulator
      .otherwise((value) => value);

    // First value initializes the accumulator if no initial value set
    if (!hasReceivedFirstValue && data.initialValue === undefined) {
      accumulator = inputValue;
      hasReceivedFirstValue = true;
      messageContext.send(accumulator);
      return;
    }

    hasReceivedFirstValue = true;

    evaluate(inputValue).then((evalResult) => {
      if (evalResult.success) {
        accumulator = evalResult.result;
        messageContext.send(accumulator);
      }
    });
  };

  function handleExpressionChange(newExpr: string) {
    data.expr = newExpr;
  }

  function handleRun() {
    consoleRef?.clearConsole();
    expr = data.expr;

    if (expr.trim()) {
      const code = `return (${expr})`;
      try {
        new Function('$1', '$2', code);
        hasError = false;
      } catch (error) {
        hasError = true;
        handleCodeError(error, code, nodeId, customConsole);
      }
    } else {
      hasError = false;
    }
  }

  onMount(() => {
    messageContext.queue.addCallback(handleMessage);

    if (isEditing) {
      setTimeout(() => layoutRef?.focus(), 10);
    }
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });
</script>

{#snippet handles()}
  <StandardHandle
    port="inlet"
    type="message"
    id={0}
    title="Input ($2)"
    total={2}
    index={0}
    class="top-0"
    {nodeId}
  />
  <StandardHandle
    port="inlet"
    type="message"
    id={1}
    title="Reset/Set accumulator"
    total={2}
    index={1}
    class="top-0"
    {nodeId}
  />
{/snippet}

{#snippet outlets()}
  <StandardHandle port="outlet" type="message" title="Accumulator" total={1} index={0} {nodeId} />
{/snippet}

<div class="group relative flex flex-col gap-2">
  <div class="relative">
    <button
      class="absolute -top-6 right-0 z-10 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
      onclick={toggleConsole}
      title="Toggle console"
    >
      <Terminal class="h-3.5 w-3.5 text-zinc-400" />
    </button>

    <CommonExprLayout
      bind:this={layoutRef}
      {nodeId}
      {data}
      {selected}
      expr={data.expr}
      bind:isEditing
      placeholder="$1 + $2"
      displayPrefix="scan"
      editorClass="scan-node-code-editor"
      onExpressionChange={handleExpressionChange}
      {handles}
      {outlets}
      onRun={handleRun}
      exitOnRun={false}
      runOnExit
      {hasError}
    />
  </div>

  <div class:hidden={!data.showConsole}>
    <VirtualConsole
      bind:this={consoleRef}
      {nodeId}
      placeholder="Errors will appear here."
      shouldAutoShowConsoleOnError
      shouldAutoHideConsoleOnNoError
    />
  </div>
</div>

<style>
  :global(.scan-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }
</style>
