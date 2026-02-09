<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { Terminal } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas/common';
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
    data: { expr: string; showConsole?: boolean };
    selected: boolean;
  } = $props();

  let isEditing = $state(false);
  let expr = $state(data.expr || '');
  let hasError = $state(false);
  let layoutRef = $state<CommonExprLayout | null>(null);
  let consoleRef: VirtualConsole | null = $state(null);

  // Track the last value for comparison
  let lastValue = $state<unknown>(undefined);
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
   * Evaluate the comparator expression
   * $1 = previous value, $2 = current value
   * Returns true if values are considered equal (should skip)
   */
  async function isEqual(previous: unknown, current: unknown): Promise<boolean> {
    if (!expr.trim()) {
      // No expression - use strict equality
      return previous === current;
    }

    const code = `return (${expr})`;

    try {
      const extraContext: Record<string, unknown> = {
        $1: previous,
        $2: current
      };

      const result = await jsRunner.executeJavaScript(nodeId, code, {
        customConsole,
        skipMessageContext: true,
        extraContext
      });

      hasError = false;
      return Boolean(result);
    } catch (error) {
      hasError = true;
      handleCodeError(error, code, nodeId, customConsole);
      return false; // On error, let the value through
    }
  }

  const handleMessage: MessageCallbackFn = (message, meta) => {
    const inlet = meta?.inlet ?? 0;

    // Inlet 1: reset state
    if (inlet === 1) {
      match(message)
        .with(messages.bang, () => {
          lastValue = undefined;
          hasReceivedFirstValue = false;
        })
        .otherwise(() => {
          // Any value resets
          lastValue = undefined;
          hasReceivedFirstValue = false;
        });
      return;
    }

    // Inlet 0: process input
    const currentValue = match(message)
      .with(messages.bang, () => lastValue) // bang re-sends last value if any
      .otherwise((value) => value);

    // Handle bang when no value yet
    if (
      message &&
      typeof message === 'object' &&
      'type' in message &&
      message.type === 'bang' &&
      !hasReceivedFirstValue
    ) {
      return; // Nothing to re-send
    }

    // First value always passes through
    if (!hasReceivedFirstValue) {
      hasReceivedFirstValue = true;
      lastValue = currentValue;
      messageContext.send(currentValue);
      return;
    }

    // Compare with last value
    isEqual(lastValue, currentValue).then((equal) => {
      if (!equal) {
        lastValue = currentValue;
        messageContext.send(currentValue);
      }
      // If equal, skip (don't send)
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
    title="Reset"
    total={2}
    index={1}
    class="top-0"
    {nodeId}
  />
{/snippet}

{#snippet outlets()}
  <StandardHandle
    port="outlet"
    type="message"
    title="Output (unique)"
    total={1}
    index={0}
    {nodeId}
  />
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
      placeholder="$1 === $2"
      displayPrefix="uniq"
      editorClass="uniq-node-code-editor"
      onExpressionChange={handleExpressionChange}
      {handles}
      {outlets}
      onRun={handleRun}
      exitOnRun={false}
      runOnExit
      {hasError}
      allowEmptyExpr
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
  :global(.uniq-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }
</style>
