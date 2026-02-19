<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import CommonExprLayout from './CommonExprLayout.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { UiuaService } from '$lib/uiua/UiuaService';

  const { updateNodeData } = useSvelteFlow();

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr: string; showConsole?: boolean };
    selected: boolean;
  } = $props();

  let isEditing = $state(!data.expr);
  let expr = $state(data.expr || '');
  let inletValues = $state<unknown[]>([]);
  let hasError = $state(false);
  let isLoading = $state(false);
  let layoutRef = $state<CommonExprLayout | null>(null);
  let consoleRef: VirtualConsole | null = $state(null);

  const messageContext = new MessageContext(nodeId);
  const customConsole = createCustomConsole(nodeId);
  const uiuaService = UiuaService.getInstance();

  // Parse $N placeholders to determine inlet count
  const inletCount = $derived.by(() => {
    if (!expr.trim()) return 1;

    const dollarVarPattern = /\$(\d+)/g;
    const matches = [...expr.matchAll(dollarVarPattern)];
    const maxIndex = Math.max(0, ...matches.map((m) => parseInt(m[1])));

    return Math.max(1, Math.min(maxIndex, 9));
  });

  // Handle incoming messages
  // Inlet 0 is hot (triggers output), all other inlets are cold
  const handleMessage: MessageCallbackFn = (message, meta) => {
    const inlet = meta?.inlet ?? 0;
    const nextInletValues = [...inletValues];

    // Handle special messages
    const handled = match(message)
      .with(messages.bang, () => {
        // Bang triggers evaluation without storing a value
        if (inlet === 0) evaluateAndSend(inletValues);

        return true;
      })
      .with(messages.setCode, ({ value }) => {
        // Update expression without triggering evaluation
        expr = value;
        data.expr = value;
        updateNodeData(nodeId, { expr: value });

        return true;
      })
      .otherwise(() => false);

    if (handled) return;

    // Store value for this inlet
    nextInletValues[inlet] = message;
    inletValues = nextInletValues;

    // Only inlet 0 (hot) triggers evaluation
    if (inlet !== 0) return;

    // Evaluate UIUA expression
    evaluateAndSend(nextInletValues);
  };

  async function evaluateAndSend(values: unknown[]) {
    if (!expr.trim()) {
      messageContext.send(values[0] ?? 0);
      return;
    }

    isLoading = true;

    try {
      const result = await uiuaService.evalWithValues(expr, values);

      if (result.success) {
        hasError = false;

        // Try to parse the result as JSON (for arrays/numbers)
        try {
          const parsed = JSON.parse(result.output);
          messageContext.send(parsed);
        } catch {
          // Send as string if not JSON
          messageContext.send(result.output);
        }
      } else {
        hasError = true;
        customConsole.error(result.error);
      }
    } catch (error) {
      hasError = true;
      customConsole.error(error instanceof Error ? error.message : String(error));
    } finally {
      isLoading = false;
    }
  }

  function handleExpressionChange(newExpr: string) {
    data.expr = newExpr;
  }

  async function handleRun() {
    consoleRef?.clearConsole();
    expr = data.expr;

    // Try to format the code
    if (expr.trim()) {
      isLoading = true;

      try {
        const formatResult = await uiuaService.format(expr);

        if (formatResult.success) {
          hasError = false;
          const formatted = formatResult.formatted?.trim();

          if (formatted !== expr) {
            expr = formatted;
            data.expr = formatted;
            updateNodeData(nodeId, { expr: formatted });
          }
        } else {
          hasError = true;
          customConsole.error(formatResult.error);
        }
      } catch (error) {
        hasError = true;
        customConsole.error(error instanceof Error ? error.message : String(error));
      } finally {
        isLoading = false;
      }
    } else {
      hasError = false;
    }

    // Update inlet values array if count changed
    const newInletCount = inletCount;

    if (newInletCount !== inletValues.length) {
      inletValues = new Array(newInletCount).fill(0);
    }

    // Trigger evaluation (simulate bang)
    if (!hasError) {
      evaluateAndSend(inletValues);
    }
  }

  onMount(() => {
    messageContext.queue.addCallback(handleMessage);
    inletValues = new Array(inletCount).fill(0);

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
  {#each Array.from({ length: inletCount }) as _, index}
    <StandardHandle
      port="inlet"
      type="message"
      id={index}
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
  <StandardHandle port="outlet" type="message" title="Result" total={1} index={0} {nodeId} />
{/snippet}

<div class="group relative flex flex-col gap-2">
  <CommonExprLayout
    bind:this={layoutRef}
    {nodeId}
    {data}
    {selected}
    expr={data.expr}
    bind:isEditing
    placeholder="+ $1 $2"
    editorClass="uiua-node-code-editor"
    previewContainerClass="uiua-display"
    language="uiua"
    class={isLoading && !uiuaService.isLoaded ? '!border-zinc-400' : ''}
    onExpressionChange={handleExpressionChange}
    handles={exprHandles}
    outlets={exprOutlets}
    onRun={handleRun}
    exitOnRun={false}
    runOnExit
    {hasError}
  />

  <div class:hidden={!data.showConsole}>
    <VirtualConsole
      bind:this={consoleRef}
      {nodeId}
      placeholder="UIUA errors will appear here."
      shouldAutoShowConsoleOnError
      shouldAutoHideConsoleOnNoError
    />
  </div>
</div>

<style>
  :global(.uiua-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
    font-family: 'Uiua', 'IBM Plex Mono', monospace !important;
  }

  :global(.uiua-display .expr-preview .expr-preview-code) {
    --default-mono-font-family: 'Uiua';
    font-family: 'Uiua', 'IBM Plex Mono', monospace !important;
    line-height: 14px;
  }
</style>
