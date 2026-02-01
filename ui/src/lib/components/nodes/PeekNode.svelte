<script lang="ts">
  import { Code, ChevronUp } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import CodeEditor from '../CodeEditor.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { JSRunner } from '$lib/js-runner/JSRunner';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr?: string };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const messageContext = new MessageContext(nodeId);
  const jsRunner = JSRunner.getInstance();

  let showEditor = $state(false);
  let expr = $derived(data.expr || '');
  let latestValue = $state<unknown>(undefined);
  let evaluatedValue = $state<unknown>(undefined);
  let hasError = $state(false);

  // Format value for display
  function formatValue(value: unknown): string {
    if (value === undefined) return '<peek>';

    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    if (value === null) return 'null';

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  const displayValue = $derived.by(() => {
    if (latestValue === undefined) return '<peek>';
    // Show evaluated value if we have an expression, otherwise show raw value
    const valueToShow = expr.trim() ? evaluatedValue : latestValue;
    return formatValue(valueToShow);
  });

  async function evaluate(message: unknown): Promise<unknown> {
    if (!expr.trim()) return message;

    try {
      const code = `return (${expr})`;
      const result = await jsRunner.executeJavaScript(nodeId, code, {
        skipMessageContext: true,
        extraContext: { $1: message }
      });
      hasError = false;
      return result;
    } catch {
      hasError = true;
      return undefined;
    }
  }

  const handleMessage: MessageCallbackFn = async (message) => {
    latestValue = message;
    evaluatedValue = await evaluate(message);
  };

  onMount(() => {
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });

  const containerClass = $derived(
    selected ? 'object-container-selected' : 'object-container-light'
  );
</script>

<div class="group relative">
  <StandardHandle port="inlet" type="message" title="Input" total={1} index={0} {nodeId} />

  <!-- Floating code button -->
  <button
    class="absolute -top-6 right-0 z-10 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
    onclick={() => (showEditor = !showEditor)}
    title="Toggle expression editor"
  >
    <svelte:component this={showEditor ? ChevronUp : Code} class="h-3.5 w-3.5 text-zinc-400" />
  </button>

  <div class="flex flex-col gap-1">
    {#if showEditor}
      <div
        class={[
          'nodrag min-w-[120px] rounded-lg border font-mono text-zinc-200',
          containerClass,
          hasError ? 'border-red-500/50' : ''
        ]}
      >
        <CodeEditor
          value={expr}
          onchange={(value) => updateNodeData(nodeId, { expr: value })}
          onrun={() => {
            // Re-evaluate with current value if we have one
            if (latestValue !== undefined) {
              evaluate(latestValue).then((result) => {
                evaluatedValue = result;
              });
            }
          }}
          language="javascript"
          placeholder="$1.type"
          class="peek-node-code-editor rounded-lg border !border-transparent focus:outline-none"
        />
      </div>
    {/if}

    <div
      class={[
        'nowheel max-w-[300px] min-w-[60px] rounded-lg border px-3 py-2 font-mono text-xs text-zinc-200',
        containerClass
      ]}
    >
      <pre
        class="m-0 max-h-[200px] overflow-auto break-all whitespace-pre-wrap">{displayValue}</pre>
    </div>
  </div>
</div>

<style>
  :global(.peek-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }
</style>
