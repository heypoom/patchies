<script lang="ts">
  import { Play, Pause, Square, Settings } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import CommonExprLayout from './CommonExprLayout.svelte';
  import { useAudioOutletWarning } from '$lib/composables/useAudioOutletWarning';
  import { useNodeDataTracker } from '$lib/history';
  import {
    bytebeatMessages,
    type BytebeatType,
    type BytebeatSyntax,
    type BytebeatNode as BytebeatAudioNode
  } from '$lib/audio/v2/nodes/BytebeatNode';
  import BytebeatSettings from '$lib/settings/BytebeatSettings.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let contentContainer: HTMLDivElement | null = null;
  let contentWidth = $state(100);

  interface BytebeatNodeData {
    expr: string;
    isPlaying: boolean;
    type: BytebeatType;
    syntax: BytebeatSyntax;
    sampleRate: number;
    autoEval: boolean;
    syncTransport: boolean;
  }

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: BytebeatNodeData;
    selected: boolean;
  } = $props();

  let isEditing = $state(!data.expr);
  let layoutRef = $state<ReturnType<typeof CommonExprLayout>>();
  let showSettings = $state(false);
  let errorMessage = $state<string | null>(null);

  let messageContext: MessageContext;
  const audioService = AudioService.getInstance();

  const { updateNodeData } = useSvelteFlow();
  const { warnIfNoOutletConnection } = useAudioOutletWarning(nodeId);
  const tracker = useNodeDataTracker(nodeId);

  // Derived values
  const expr = $derived(data.expr ?? '((t >> 10) & 42) * t');
  const isPlaying = $derived(data.isPlaying ?? false);
  const bytebeatType = $derived(data.type ?? 'bytebeat');
  const syntax = $derived(data.syntax ?? 'infix');
  const sampleRate = $derived(data.sampleRate ?? 8000);
  const autoEval = $derived(data.autoEval ?? true);
  const syncTransport = $derived(data.syncTransport ?? false);

  const handleMessage: MessageCallbackFn = async (message) => {
    await match(message)
      .with(bytebeatMessages.play, async () => {
        await play();
      })
      .with(bytebeatMessages.pause, () => {
        pause();
      })
      .with(bytebeatMessages.stop, () => {
        stop();
      })
      .with(bytebeatMessages.bang, async () => {
        await bang();
      })
      .with(bytebeatMessages.setType, async (msg) => {
        await setType(msg.value);
      })
      .with(bytebeatMessages.setSyntax, async (msg) => {
        await setSyntax(msg.value);
      })
      .with(bytebeatMessages.setSampleRate, async (msg) => {
        await setSampleRate(msg.value);
      })
      .otherwise(() => {});
  };

  async function play() {
    warnIfNoOutletConnection();
    await audioService.send(nodeId, 'control', { type: 'play' });
    updateNodeData(nodeId, { isPlaying: true });
  }

  function pause() {
    audioService.send(nodeId, 'control', { type: 'pause' });
    updateNodeData(nodeId, { isPlaying: false });
  }

  function stop() {
    audioService.send(nodeId, 'control', { type: 'stop' });
    updateNodeData(nodeId, { isPlaying: false });
  }

  async function bang() {
    warnIfNoOutletConnection();
    await audioService.send(nodeId, 'control', { type: 'bang' });
    updateNodeData(nodeId, { isPlaying: true });
  }

  async function handleExpressionChange(expr: string) {
    updateNodeData(nodeId, { expr: expr });
    if (autoEval) {
      await audioService.send(nodeId, 'expr', expr);
    }
  }

  async function handleRun() {
    warnIfNoOutletConnection();
    await audioService.send(nodeId, 'expr', expr);
    await play();
  }

  async function setType(type: BytebeatType) {
    const oldType = bytebeatType;
    updateNodeData(nodeId, { type });
    tracker.commit('type', oldType, type);
    await audioService.send(nodeId, 'control', { type: 'setType', value: type });
  }

  async function setSyntax(syn: BytebeatSyntax) {
    const oldSyntax = syntax;
    updateNodeData(nodeId, { syntax: syn });
    tracker.commit('syntax', oldSyntax, syn);
    await audioService.send(nodeId, 'control', { type: 'setSyntax', value: syn });
  }

  async function setSampleRate(rate: number) {
    const oldRate = sampleRate;
    updateNodeData(nodeId, { sampleRate: rate });
    tracker.commit('sampleRate', oldRate, rate);
    await audioService.send(nodeId, 'control', { type: 'setSampleRate', value: rate });
  }

  function setAutoEval(value: boolean) {
    const oldValue = autoEval;
    updateNodeData(nodeId, { autoEval: value });
    tracker.commit('autoEval', oldValue, value);
  }

  function setSyncTransport(value: boolean) {
    const oldValue = syncTransport;
    updateNodeData(nodeId, { syncTransport: value });
    tracker.commit('syncTransport', oldValue, value);

    const bytebeatNode = audioService.getNodeById(nodeId) as BytebeatAudioNode | undefined;
    bytebeatNode?.setSyncTransport(value);
  }

  function togglePlay() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function updateContentWidth() {
    if (!contentContainer) return;
    contentWidth = contentContainer.offsetWidth;
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    audioService.createNode(nodeId, 'bytebeat~', [expr, bytebeatType, syntax, sampleRate]);

    // Set up callbacks for state updates
    const bytebeatNode = audioService.getNodeById(nodeId) as BytebeatAudioNode | undefined;
    if (bytebeatNode) {
      bytebeatNode.onPlayStateChange = (playing: boolean) => {
        updateNodeData(nodeId, { isPlaying: playing });
      };

      bytebeatNode.onError = (error: string | null) => {
        errorMessage = error;
      };

      // Sync initial syncTransport state from node data
      if (syncTransport) {
        bytebeatNode.setSyncTransport(true);
      }
    }

    if (isEditing) {
      setTimeout(() => layoutRef?.focus(), 10);
    }

    updateContentWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateContentWidth();
    });

    if (contentContainer) {
      resizeObserver.observe(contentContainer);
    }

    return () => {
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
    audioService.removeNodeById(nodeId);
  });
</script>

{#snippet bytebeatHandles()}
  <StandardHandle
    port="inlet"
    type="message"
    title="Control messages (play, pause, stop, bang, setType, setSyntax, setSampleRate)"
    {nodeId}
    total={1}
    index={0}
  />
{/snippet}

{#snippet bytebeatOutlets()}
  <StandardHandle port="outlet" type="audio" title="Audio output" {nodeId} total={1} index={0} />
{/snippet}

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2" bind:this={contentContainer}>
      <!-- Floating toolbar -->
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
          {#if !syncTransport}
            <!-- Play/Pause button -->
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button onclick={togglePlay} class="cursor-pointer rounded p-1 hover:bg-zinc-700">
                  {#if isPlaying}
                    <Pause class="h-4 w-4 text-zinc-300" />
                  {:else}
                    <Play class="h-4 w-4 text-zinc-300" />
                  {/if}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>{isPlaying ? 'Pause' : 'Play'}</Tooltip.Content>
            </Tooltip.Root>

            <!-- Stop button -->
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button onclick={stop} class="cursor-pointer rounded p-1 hover:bg-zinc-700">
                  <Square class="h-4 w-4 text-zinc-300" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>Stop (reset t=0)</Tooltip.Content>
            </Tooltip.Root>
          {/if}
        </div>

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={() => (showSettings = !showSettings)}
            >
              <Settings class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Settings</Tooltip.Content>
        </Tooltip.Root>
      </div>

      <div class={['bytebeat-node-container relative']}>
        <CommonExprLayout
          bind:this={layoutRef}
          {nodeId}
          {data}
          {selected}
          {expr}
          bind:isEditing
          placeholder="((t >> 10) & 42) * t"
          editorClass="bytebeat-node-code-editor"
          previewContainerClass="bytebeat-node-preview-container"
          onExpressionChange={handleExpressionChange}
          exitOnRun={false}
          onRun={handleRun}
          hasError={!!errorMessage}
          dataKey="expr"
          handles={bytebeatHandles}
          outlets={bytebeatOutlets}
          lineWrap
        />
      </div>

      <!-- Error message -->
      {#if errorMessage}
        <div class="max-w-[300px] truncate text-xs text-red-400" title={errorMessage}>
          {errorMessage}
        </div>
      {/if}
    </div>
  </div>

  {#if showSettings}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <BytebeatSettings
        {bytebeatType}
        {syntax}
        {sampleRate}
        {autoEval}
        {syncTransport}
        onTypeChange={setType}
        onSyntaxChange={setSyntax}
        onSampleRateChange={setSampleRate}
        onAutoEvalChange={setAutoEval}
        onSyncTransportChange={setSyncTransport}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}
</div>

<style>
  :global(.bytebeat-node-preview-container) {
    width: fit-content;
    max-height: 500px;
    overflow-y: hidden;
  }

  :global(.bytebeat-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }

  :global(.bytebeat-node-container .expr-preview) {
    overflow-x: hidden;
  }
</style>
