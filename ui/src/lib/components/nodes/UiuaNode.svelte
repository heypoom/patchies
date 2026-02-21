<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { Settings, Eye, EllipsisVertical } from '@lucide/svelte/icons';
  import * as Popover from '$lib/components/ui/popover';
  import UiuaSettings from '$lib/components/settings/UiuaSettings.svelte';
  import UiuaPreview from '$lib/components/settings/UiuaPreview.svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import CommonExprLayout from './CommonExprLayout.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { UiuaService, type OutputItem } from '$lib/uiua/UiuaService';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { GifPlayer } from '$lib/canvas/GifPlayer';

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  interface UiuaNodeData {
    expr: string;
    showConsole?: boolean;
    enableMessageOutlet?: boolean;
    enableVideoOutlet?: boolean;
    view?: 'settings' | 'preview';
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
  let inletValues = $state<unknown[]>([]);
  let hasError = $state(false);
  let isLoading = $state(false);
  let layoutRef = $state<CommonExprLayout | null>(null);
  let consoleRef: VirtualConsole | null = $state(null);
  let resultStack = $state<OutputItem[]>([]);
  let menuOpen = $state(false);

  // Non-reactive tracking for blob URL cleanup
  let currentBlobUrls: string[] = [];

  // Track blob URLs by index
  let blobUrlMap = $state<Map<number, string>>(new Map());

  // Track measured image dimensions
  let imageDimensions = $state<Map<number, { width: number; height: number }>>(new Map());

  const messageContext = new MessageContext(nodeId);
  const customConsole = createCustomConsole(nodeId);
  const uiuaService = UiuaService.getInstance();
  const glSystem = GLSystem.getInstance();

  // Shared AudioContext for decoding WAV to float array
  let audioContext: AudioContext | null = null;

  function getAudioContext(): AudioContext {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    return audioContext;
  }

  /**
   * Decode WAV Uint8Array to float array using Web Audio API.
   * Returns the first channel's raw samples for use with table/sampler~.
   */
  async function decodeWavToFloats(wavData: Uint8Array): Promise<Float32Array> {
    const ctx = getAudioContext();
    // Need to copy the buffer since decodeAudioData may detach the original
    const buffer = wavData.buffer.slice(
      wavData.byteOffset,
      wavData.byteOffset + wavData.byteLength
    ) as ArrayBuffer;
    const audioBuffer = await ctx.decodeAudioData(buffer);
    // Return first channel's samples
    return audioBuffer.getChannelData(0);
  }

  // Track if we're registered with GLSystem
  let isRegisteredWithGL = false;

  // GIF animation player
  const gifPlayer = new GifPlayer();

  function ensureGLRegistered() {
    if (!isRegisteredWithGL) {
      glSystem.upsertNode(nodeId, 'img', {});
      isRegisteredWithGL = true;
    }
  }

  // Message outlet defaults to true (shown) when undefined
  const messageOutletEnabled = $derived(data.enableMessageOutlet !== false);

  // Dynamic outlet count based on toggles
  const outletCount = $derived((messageOutletEnabled ? 1 : 0) + (data.enableVideoOutlet ? 1 : 0));

  // Create blob URLs and measure dimensions for media items
  $effect(() => {
    // Clean up old URLs
    currentBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    currentBlobUrls = [];

    const newBlobUrlMap = new Map<number, string>();
    const newDimensions = new Map<number, { width: number; height: number }>();

    resultStack.forEach((item, index) => {
      if (item.type === 'image' || item.type === 'gif') {
        const mimeType = item.type === 'image' ? 'image/png' : 'image/gif';
        const blob = new Blob([new Uint8Array(item.data)], { type: mimeType });
        const url = URL.createObjectURL(blob);
        currentBlobUrls.push(url);
        newBlobUrlMap.set(index, url);

        // Measure image dimensions
        const img = new Image();
        const capturedIndex = index;
        img.onload = () => {
          newDimensions.set(capturedIndex, { width: img.naturalWidth, height: img.naturalHeight });
          imageDimensions = new Map(newDimensions);
        };
        img.src = url;
      } else if (item.type === 'audio') {
        const blob = new Blob([new Uint8Array(item.data)], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        currentBlobUrls.push(url);
        newBlobUrlMap.set(index, url);
      }
    });

    blobUrlMap = newBlobUrlMap;
  });

  // Handle GLSystem registration when video outlet is toggled
  $effect(() => {
    if (!data.enableVideoOutlet && isRegisteredWithGL) {
      gifPlayer.stop();
      glSystem.removeNode(nodeId);
      isRegisteredWithGL = false;
    }
  });

  function getBlobUrl(index: number): string | undefined {
    return blobUrlMap.get(index);
  }

  function getImageDimensions(index: number): { width: number; height: number } | undefined {
    return imageDimensions.get(index);
  }

  // Toggle message outlet
  function toggleMessageOutlet() {
    const newValue = !messageOutletEnabled;
    data.enableMessageOutlet = newValue;
    updateNodeData(nodeId, { enableMessageOutlet: newValue });
    updateNodeInternals(nodeId);
  }

  // Toggle video outlet
  function toggleVideoOutlet() {
    const newValue = !data.enableVideoOutlet;
    data.enableVideoOutlet = newValue;
    updateNodeData(nodeId, { enableVideoOutlet: newValue });
    updateNodeInternals(nodeId);
  }

  // Toggle view panel (mutually exclusive)
  function setView(view: 'settings' | 'preview' | undefined) {
    const newValue = data.view === view ? undefined : view;
    data.view = newValue;
    updateNodeData(nodeId, { view: newValue });
  }

  // Parse $N placeholders to determine inlet count (only $1-$9 supported)
  const inletCount = $derived.by(() => {
    const currentExpr = data.expr?.trim() || '';
    if (!currentExpr) return 1;

    // Only match single-digit non-zero references ($1 through $9)
    const dollarVarPattern = /\$([1-9])/g;
    const matches = [...currentExpr.matchAll(dollarVarPattern)];
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
    const currentExpr = data.expr?.trim() || '';

    if (!currentExpr) {
      if (messageOutletEnabled) {
        messageContext.send(values[0] ?? 0);
      }
      return;
    }

    isLoading = true;

    try {
      const result = await uiuaService.evalWithValues(currentExpr, values);

      if (result.success) {
        hasError = false;
        resultStack = result.stack;

        // Send values to message outlet if enabled
        // Audio items are decoded to Float32Array for direct use with table/sampler~
        if (messageOutletEnabled) {
          const values = await Promise.all(
            result.stack.map(async (item) => {
              if (item.type === 'audio') {
                // Decode WAV to float array for universal compatibility
                try {
                  return await decodeWavToFloats(item.data);
                } catch (e) {
                  customConsole.error(`Failed to decode audio: ${e}`);
                  return null;
                }
              }
              return extractTextValue(item);
            })
          );

          // Filter out failed decodes
          const validValues = values.filter((v) => v !== null);

          if (validValues.length === 0) {
            messageContext.send(0);
          } else if (validValues.length === 1) {
            messageContext.send(validValues[0]);
          } else {
            messageContext.send(validValues);
          }
        }

        // Send to video outlet if enabled - use GLSystem for video pipeline
        if (data.enableVideoOutlet) {
          for (const item of result.stack) {
            if (item.type === 'gif') {
              // Use GifPlayer for animated GIF playback
              gifPlayer.play(item.data, (bitmap) => {
                ensureGLRegistered();

                glSystem.setBitmap(nodeId, bitmap);
              });
              break;
            } else if (item.type === 'image') {
              // Static image - just set bitmap once
              gifPlayer.stop();

              const blob = new Blob([item.data as BlobPart], { type: 'image/png' });

              createImageBitmap(blob).then((bitmap) => {
                ensureGLRegistered();

                glSystem.setBitmap(nodeId, bitmap);
              });
              break;
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
    const currentExpr = data.expr?.trim() || '';

    // Try to format the code
    if (currentExpr) {
      isLoading = true;

      try {
        const formatResult = await uiuaService.format(currentExpr);

        if (formatResult.success) {
          hasError = false;
          const formatted = formatResult.formatted?.trim();

          if (formatted && formatted !== currentExpr) {
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
    currentBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    // Clean up GIF playback and GLSystem registration
    gifPlayer.stop();
    if (isRegisteredWithGL) {
      glSystem.removeNode(nodeId);
    }
    // Clean up AudioContext
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
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
  {@const messageIndex = 0}
  {@const videoIndex = messageOutletEnabled ? 1 : 0}

  {#if messageOutletEnabled}
    <StandardHandle
      port="outlet"
      type="message"
      title="Text/arrays/audio samples"
      total={outletCount}
      index={messageIndex}
      {nodeId}
    />
  {/if}
  {#if data.enableVideoOutlet}
    <StandardHandle
      port="outlet"
      type="video"
      title="Video (ImageData)"
      total={outletCount}
      index={videoIndex}
      {nodeId}
    />
  {/if}
{/snippet}

<div class="group relative flex flex-col gap-2 overflow-visible">
  <!-- Overflow menu -->
  {#if !isEditing}
    <div
      class={[
        'absolute -top-7 right-0 z-10 flex gap-1 transition-opacity',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      ]}
    >
      <Popover.Root bind:open={menuOpen}>
        <Popover.Trigger>
          <button class="cursor-pointer rounded p-1 hover:bg-zinc-700" title="More options">
            <EllipsisVertical class="h-4 w-4 text-zinc-300" />
          </button>
        </Popover.Trigger>
        <Popover.Content class="w-32 p-1" align="end">
          <button
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-zinc-700"
            onclick={() => {
              setView('preview');
              menuOpen = false;
            }}
          >
            <Eye class="h-3.5 w-3.5" />
            Preview
            {#if data.view === 'preview'}
              <span class="ml-auto text-blue-400">✓</span>
            {/if}
          </button>
          <button
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-zinc-700"
            onclick={() => {
              setView('settings');
              menuOpen = false;
            }}
          >
            <Settings class="h-3.5 w-3.5" />
            Settings
            {#if data.view === 'settings'}
              <span class="ml-auto text-blue-400">✓</span>
            {/if}
          </button>
        </Popover.Content>
      </Popover.Root>
    </div>
  {/if}

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
    runOnExit={false}
    {hasError}
    dataKey="expr"
    fontSize="14px"
  />

  <div class:hidden={!data.showConsole}>
    <VirtualConsole
      bind:this={consoleRef}
      {nodeId}
      placeholder="Uiua errors will appear here."
      shouldAutoShowConsoleOnError
      shouldAutoHideConsoleOnNoError
    />
  </div>

  <!-- Floating preview panel -->
  {#if data.view === 'preview'}
    <UiuaPreview {resultStack} onRun={handleRun} {getBlobUrl} {getImageDimensions} />
  {/if}

  <!-- Floating settings panel -->
  {#if data.view === 'settings'}
    <UiuaSettings
      {data}
      onClose={() => setView(undefined)}
      onToggleMessage={toggleMessageOutlet}
      onToggleVideo={toggleVideoOutlet}
    />
  {/if}
</div>

<style>
  :global(.uiua-node-code-editor .cm-content) {
    padding: 7px 5px !important;
    font-family: 'Uiua', 'IBM Plex Mono', monospace !important;
  }

  :global(.uiua-display .expr-preview .expr-preview-code) {
    --default-mono-font-family: 'Uiua';
    font-family: 'Uiua', 'IBM Plex Mono', monospace !important;
    font-size: 14px;
    line-height: 1.4; /* Match CodeMirror's default line-height */
  }
</style>
