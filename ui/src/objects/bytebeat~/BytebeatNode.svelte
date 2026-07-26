<script lang="ts">
  import { Expand, Play, Pause, Square, Settings } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { match } from 'ts-pattern';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { getPatchRuntime, getPatchRuntimeViewRevisionTracker } from '$lib/runtime';
  import CommonExprLayout from '$objects/expression/CommonExprLayout.svelte';
  import { useAudioOutletWarning } from '$lib/composables/useAudioOutletWarning';
  import { useNodeDataTracker } from '$lib/history';
  import {
    bytebeatMessages,
    BytebeatNode as BytebeatAudioNode,
    type BytebeatType,
    type BytebeatSyntax
  } from '$objects/bytebeat~/BytebeatNode';
  import BytebeatSettings from '$objects/bytebeat~/BytebeatSettings.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let contentContainer: HTMLDivElement | null = null;
  let contentWidth = $state(100);

  interface BytebeatNodeData {
    expr: string;
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

  function getInitialNodeId() {
    return nodeId;
  }

  function getInitialIsEditing() {
    return !data.expr;
  }

  let isEditing = $state(getInitialIsEditing());
  let layoutRef = $state<ReturnType<typeof CommonExprLayout>>();
  let showSettings = $state(false);
  let errorMessage = $state<string | null>(null);

  const audioService = AudioService.getInstance();
  const patchRuntime = getPatchRuntime();
  const runtimeViewRevisionTracker = getPatchRuntimeViewRevisionTracker();
  let attachedRuntimeNode: BytebeatAudioNode | null = null;

  const { updateNodeData } = useSvelteFlow();
  const { warnIfNoOutletConnection } = useAudioOutletWarning(getInitialNodeId());
  const tracker = useNodeDataTracker(getInitialNodeId());

  // Derived values
  const expr = $derived(data.expr ?? '((t >> 10) & 42) * t');
  let isPlaying = $state(false);
  const bytebeatType = $derived(data.type ?? 'bytebeat');
  const syntax = $derived(data.syntax ?? 'infix');
  const sampleRate = $derived(data.sampleRate ?? 8000);
  const autoEval = $derived(data.autoEval ?? true);
  const syncTransport = $derived(data.syncTransport ?? false);

  const handleRuntimeMessage = (message: unknown) => {
    match(message)
      .with(bytebeatMessages.expand, () => {
        layoutRef?.openExpandedEditor();
      })
      .with(bytebeatMessages.collapse, () => {
        layoutRef?.closeExpandedEditor();
      })
      .otherwise(() => {});
  };

  function detachRuntimeNode() {
    if (!attachedRuntimeNode) return;

    attachedRuntimeNode.onPlayStateChange = () => {};
    attachedRuntimeNode.onError = () => {};
    attachedRuntimeNode = null;
  }

  $effect(() => {
    runtimeViewRevisionTracker?.trackObjectViewRevision(nodeId);

    const runtimeNode = audioService.getNodeById(nodeId);
    const bytebeatNode = runtimeNode instanceof BytebeatAudioNode ? runtimeNode : null;
    if (bytebeatNode === attachedRuntimeNode) return;

    detachRuntimeNode();
    if (!bytebeatNode) return;

    attachedRuntimeNode = bytebeatNode;
    isPlaying = bytebeatNode.getIsPlaying();
    bytebeatNode.onPlayStateChange = (playing) => {
      isPlaying = playing;
    };
    bytebeatNode.onError = (error) => {
      errorMessage = error;
    };
  });

  $effect(() => patchRuntime?.subscribeObjectMessages(nodeId, handleRuntimeMessage) ?? undefined);

  async function play() {
    warnIfNoOutletConnection();
    await audioService.send(nodeId, 'control', { type: 'play' });
    isPlaying = true;
  }

  function pause() {
    audioService.send(nodeId, 'control', { type: 'pause' });
    isPlaying = false;
  }

  function stop() {
    audioService.send(nodeId, 'control', { type: 'stop' });
    isPlaying = false;
  }

  async function bang() {
    warnIfNoOutletConnection();
    await audioService.send(nodeId, 'control', { type: 'bang' });
    isPlaying = true;
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
    detachRuntimeNode();
  });
</script>

{#snippet bytebeatHandles()}
  <TypedHandle
    port="inlet"
    spec={{ handleType: 'message' }}
    title="Control messages (play, pause, stop, bang, setType, setSyntax, setSampleRate)"
    {nodeId}
    total={1}
    index={0}
  />
{/snippet}

{#snippet bytebeatOutlets()}
  <TypedHandle
    port="outlet"
    spec={{ handleType: 'audio' }}
    title="Audio output"
    {nodeId}
    total={1}
    index={0}
  />
{/snippet}

{#snippet detachedBytebeatSettings()}
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
    onClose={() => {}}
    showCloseButton={false}
  />
{/snippet}

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2" bind:this={contentContainer}>
      <!-- Floating toolbar -->
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="node-floating-controls flex gap-1">
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

        <div class="node-floating-controls flex gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={() => layoutRef?.openExpandedEditor()}
                class="node-floating-button disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!expr.trim()}
                aria-label="Expand bytebeat editor"
              >
                <Expand class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Expand Editor</Tooltip.Content>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="node-floating-button"
                onclick={() => (showSettings = !showSettings)}
                type="button"
                aria-label={showSettings ? 'Close settings' : 'Open settings'}
                aria-pressed={showSettings}
              >
                <Settings class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Settings</Tooltip.Content>
          </Tooltip.Root>
        </div>
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
          nodeType="bytebeat~"
          detachedEditorTitle="bytebeat~"
          detachedSettings={detachedBytebeatSettings}
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
