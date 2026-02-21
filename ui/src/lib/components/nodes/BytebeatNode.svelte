<script lang="ts">
  import { Play, Pause, Square, Settings, X } from '@lucide/svelte/icons';
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

  const TYPE_OPTIONS: { label: string; value: BytebeatType }[] = [
    { label: 'Bytebeat', value: 'bytebeat' },
    { label: 'Floatbeat', value: 'floatbeat' },
    { label: 'Signed Bytebeat', value: 'signedBytebeat' }
  ];

  const SYNTAX_OPTIONS: { label: string; value: BytebeatSyntax }[] = [
    { label: 'Infix', value: 'infix' },
    { label: 'Postfix (RPN)', value: 'postfix' },
    { label: 'Glitch', value: 'glitch' },
    { label: 'Function', value: 'function' }
  ];

  const SAMPLE_RATE_OPTIONS = [8000, 11025, 22050, 32000, 44100, 48000];

  interface BytebeatNodeData {
    expr: string;
    isPlaying: boolean;
    type: BytebeatType;
    syntax: BytebeatSyntax;
    sampleRate: number;
    autoEval: boolean;
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

  function togglePlay() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function handleSettingsClick(e: MouseEvent) {
    e.stopPropagation();
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
    }

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
    <div class="flex flex-col gap-2">
      <!-- Floating toolbar -->
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
          <!-- Play/Pause button -->
          <button
            onclick={togglePlay}
            class="cursor-pointer rounded p-1 hover:bg-zinc-700"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {#if isPlaying}
              <Pause class="h-4 w-4 text-zinc-300" />
            {:else}
              <Play class="h-4 w-4 text-zinc-300" />
            {/if}
          </button>

          <!-- Stop button -->
          <button
            onclick={stop}
            class="cursor-pointer rounded p-1 hover:bg-zinc-700"
            title="Stop (reset t=0)"
          >
            <Square class="h-4 w-4 text-zinc-300" />
          </button>
        </div>

        <button
          class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={() => (showSettings = !showSettings)}
          title="Settings"
        >
          <Settings class="h-4 w-4 text-zinc-300" />
        </button>
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
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="relative" onclick={handleSettingsClick}>
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="nodrag w-48 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <div class="space-y-4">
          <!-- Type selector -->
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-2 block text-xs font-medium text-zinc-300">Type</label>
            <select
              value={bytebeatType}
              onchange={(e) => setType(e.currentTarget.value as BytebeatType)}
              class="w-full cursor-pointer rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
            >
              {#each TYPE_OPTIONS as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>

          <!-- Syntax selector -->
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-2 block text-xs font-medium text-zinc-300">Syntax</label>
            <select
              value={syntax}
              onchange={(e) => setSyntax(e.currentTarget.value as BytebeatSyntax)}
              class="w-full cursor-pointer rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
            >
              {#each SYNTAX_OPTIONS as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>

          <!-- Sample rate selector -->
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-2 block text-xs font-medium text-zinc-300">Sample Rate</label>
            <select
              value={sampleRate}
              onchange={(e) => setSampleRate(Number(e.currentTarget.value))}
              class="w-full cursor-pointer rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
            >
              {#each SAMPLE_RATE_OPTIONS as rate}
                <option value={rate}>{rate} Hz</option>
              {/each}
            </select>
          </div>

          <!-- Auto-eval toggle -->
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={autoEval}
              onchange={(e) => setAutoEval(e.currentTarget.checked)}
              class="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-800 text-blue-500"
            />
            <span class="text-xs text-zinc-300">Run on edit</span>
          </label>
        </div>
      </div>
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

  /* Add space after last line so it's not obscured by horizontal scrollbar */
  :global(.bytebeat-node-code-editor .cm-content::after) {
    content: '';
    display: block;
    height: 24px;
  }

  :global(.bytebeat-node-container .expr-preview) {
    overflow-x: hidden;
  }
</style>
