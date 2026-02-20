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
  import { UiuaService, type OutputItem } from '$lib/uiua/UiuaService';

  const { updateNodeData } = useSvelteFlow();

  interface UiuaNodeData {
    expr: string;
    showConsole?: boolean;
    enableAudioOutlet?: boolean;
    enableVideoOutlet?: boolean;
  }

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: UiuaNodeData;
    selected: boolean;
  } = $props();

  let isEditing = $state(!data.expr);
  let expr = $state(data.expr || '');
  let inletValues = $state<unknown[]>([]);
  let hasError = $state(false);
  let isLoading = $state(false);
  let layoutRef = $state<CommonExprLayout | null>(null);
  let consoleRef: VirtualConsole | null = $state(null);
  let resultStack = $state<OutputItem[]>([]);
  let blobUrls = $state<string[]>([]);

  const messageContext = new MessageContext(nodeId);
  const customConsole = createCustomConsole(nodeId);
  const uiuaService = UiuaService.getInstance();

  // Dynamic outlet count based on toggles
  const outletCount = $derived(
    1 + (data.enableAudioOutlet ? 1 : 0) + (data.enableVideoOutlet ? 1 : 0)
  );

  // Create blob URLs for media items - derived from resultStack
  // This creates URLs lazily and tracks them for cleanup
  const mediaBlobUrls = $derived.by(() => {
    // Clean up old URLs first
    blobUrls.forEach((url) => URL.revokeObjectURL(url));

    const urls: Map<number, string> = new Map();
    const newBlobUrls: string[] = [];

    resultStack.forEach((item, index) => {
      if (item.type === 'image') {
        // Copy to ensure proper ArrayBuffer (fixes TypeScript compatibility with serde-wasm-bindgen)
        const blob = new Blob([new Uint8Array(item.data)], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        urls.set(index, url);
        newBlobUrls.push(url);
      } else if (item.type === 'gif') {
        const blob = new Blob([new Uint8Array(item.data)], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        urls.set(index, url);
        newBlobUrls.push(url);
      } else if (item.type === 'audio') {
        const blob = new Blob([new Uint8Array(item.data)], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        urls.set(index, url);
        newBlobUrls.push(url);
      }
    });

    // Store for cleanup (can't mutate blobUrls here, so we'll do it via effect)
    // Actually we need to track these differently
    return { urls, newBlobUrls };
  });

  // Track blob URLs for cleanup via effect
  $effect(() => {
    // Update blobUrls when mediaBlobUrls changes
    blobUrls = mediaBlobUrls.newBlobUrls;
  });

  function getBlobUrl(index: number): string | undefined {
    return mediaBlobUrls.urls.get(index);
  }

  // Toggle audio outlet
  function toggleAudioOutlet() {
    const newValue = !data.enableAudioOutlet;
    data.enableAudioOutlet = newValue;
    updateNodeData(nodeId, { enableAudioOutlet: newValue });
  }

  // Toggle video outlet
  function toggleVideoOutlet() {
    const newValue = !data.enableVideoOutlet;
    data.enableVideoOutlet = newValue;
    updateNodeData(nodeId, { enableVideoOutlet: newValue });
  }

  // Parse $N placeholders to determine inlet count (only $1-$9 supported)
  const inletCount = $derived.by(() => {
    if (!expr.trim()) return 1;

    // Only match single-digit non-zero references ($1 through $9)
    const dollarVarPattern = /\$([1-9])/g;
    const matches = [...expr.matchAll(dollarVarPattern)];
    const maxIndex = Math.max(0, ...matches.map((m) => parseInt(m[1])));

    return Math.max(1, maxIndex);
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

    // Evaluate Uiua expression
    evaluateAndSend(nextInletValues);
  };

  /**
   * Extract text value from an OutputItem
   * Text items return their value, media items return a placeholder/description
   */
  function extractTextValue(item: OutputItem): unknown {
    if (item.type === 'text') {
      // Try to parse as JSON (arrays, numbers)
      try {
        return JSON.parse(item.value);
      } catch {
        return item.value;
      }
    }

    if (item.type === 'svg') {
      return item.svg;
    }

    // Media items - return metadata for now
    // Full media support will output via separate outlets
    const label = 'label' in item ? item.label : undefined;

    return label ?? `[${item.type} data]`;
  }

  async function evaluateAndSend(values: unknown[]) {
    if (!expr.trim()) {
      messageContext.send(values[0] ?? 0);
      return;
    }

    isLoading = true;
    // Blob URLs are cleaned up automatically via the $derived that tracks resultStack

    try {
      const result = await uiuaService.evalWithValues(expr, values);

      if (result.success) {
        hasError = false;
        resultStack = result.stack;

        // Send text values to message outlet (outlet 0)
        const textValues = result.stack.map(extractTextValue);

        if (textValues.length === 0) {
          messageContext.send(0);
        } else if (textValues.length === 1) {
          messageContext.send(textValues[0]);
        } else {
          messageContext.send(textValues);
        }

        // Send to audio outlet if enabled (outlet 1)
        if (data.enableAudioOutlet) {
          for (const item of result.stack) {
            if (item.type === 'audio') {
              messageContext.send(item.data, { to: 1 });
            }
          }
        }

        // Send to video outlet if enabled (outlet 1 or 2 depending on audio)
        if (data.enableVideoOutlet) {
          const videoOutletIndex = data.enableAudioOutlet ? 2 : 1;

          for (const item of result.stack) {
            if (item.type === 'image' || item.type === 'gif') {
              // Decode PNG/GIF to ImageData for video chain compatibility
              const blob = new Blob([item.data], {
                type: item.type === 'image' ? 'image/png' : 'image/gif'
              });

              createImageBitmap(blob).then((bitmap) => {
                const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
                const ctx = canvas.getContext('2d');

                if (ctx) {
                  ctx.drawImage(bitmap, 0, 0);
                  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
                  messageContext.send(imageData, { to: videoOutletIndex });
                }
              });
            }
          }
        }
      } else {
        hasError = true;
        resultStack = result.stack;
        customConsole.error(result.error);
      }
    } catch (error) {
      hasError = true;
      resultStack = [];
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
    // Clean up blob URLs
    blobUrls.forEach((url) => URL.revokeObjectURL(url));
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
  <StandardHandle
    port="outlet"
    type="message"
    title="Text/arrays"
    total={outletCount}
    index={0}
    {nodeId}
  />
  {#if data.enableAudioOutlet}
    <StandardHandle
      port="outlet"
      type="audio"
      title="Audio (WAV)"
      total={outletCount}
      index={1}
      {nodeId}
    />
  {/if}
  {#if data.enableVideoOutlet}
    <StandardHandle
      port="outlet"
      type="video"
      title="Video (ImageData)"
      total={outletCount}
      index={data.enableAudioOutlet ? 2 : 1}
      {nodeId}
    />
  {/if}
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
    dataKey="expr"
  />

  <!-- Media output rendering (always shown when available) -->
  {#if resultStack.some((item) => item.type !== 'text')}
    <div class="max-h-48 overflow-auto rounded bg-zinc-900/50 p-2">
      {#each resultStack as item, index}
        {#if item.type === 'image'}
          <img
            src={getBlobUrl(index)}
            alt={item.label ?? 'Uiua image'}
            class="max-w-full rounded"
          />
        {:else if item.type === 'gif'}
          <img
            src={getBlobUrl(index)}
            alt={item.label ?? 'Uiua animation'}
            class="max-w-full rounded"
          />
        {:else if item.type === 'audio'}
          <audio controls src={getBlobUrl(index)} class="h-8 w-full"></audio>
        {:else if item.type === 'svg'}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="svg-container max-w-full overflow-auto">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html item.svg}
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Outlet toggles (shown when not editing) -->
  {#if !isEditing}
    <div class="flex gap-3 px-2 py-1 text-xs text-zinc-400">
      <label class="flex cursor-pointer items-center gap-1">
        <input
          type="checkbox"
          checked={data.enableAudioOutlet ?? false}
          onchange={toggleAudioOutlet}
          class="h-3 w-3 rounded border-zinc-600"
        />
        Audio out
      </label>
      <label class="flex cursor-pointer items-center gap-1">
        <input
          type="checkbox"
          checked={data.enableVideoOutlet ?? false}
          onchange={toggleVideoOutlet}
          class="h-3 w-3 rounded border-zinc-600"
        />
        Video out
      </label>
    </div>
  {/if}

  <div class:hidden={!data.showConsole}>
    <VirtualConsole
      bind:this={consoleRef}
      {nodeId}
      placeholder="Uiua errors will appear here."
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
    line-height: 17px;
  }
</style>
