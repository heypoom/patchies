<script lang="ts">
  import { Pause, Play, Settings } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import CommonExprLayout from './CommonExprLayout.svelte';
  import { match } from 'ts-pattern';
  import { csoundMessages } from '$lib/objects/schemas';
  import type { CsoundNode } from '$lib/audio/v2/nodes/CsoundNode';
  import { useAudioOutletWarning } from '$lib/composables/useAudioOutletWarning';
  import { useNodeDataTracker } from '$lib/history';
  import TransportSyncSettings from '$lib/components/settings/TransportSyncSettings.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr: string; syncTransport?: boolean };
    selected: boolean;
  } = $props();

  let isEditing = $state(!data.expr);
  let layoutRef = $state<any>();
  let isPlaying = $state(false);
  let showSettings = $state(false);
  let contentContainer: HTMLDivElement | null = null;
  let contentWidth = $state(100);

  let messageContext: MessageContext;
  let audioService = AudioService.getInstance();

  const { updateNodeData } = useSvelteFlow();
  const { warnIfNoAudioConnection } = useAudioOutletWarning(nodeId);
  const tracker = useNodeDataTracker(nodeId);

  const syncTransport = $derived(data.syncTransport ?? false);

  function setSyncTransport(value: boolean) {
    const oldValue = syncTransport;
    updateNodeData(nodeId, { syncTransport: value });
    tracker.commit('syncTransport', oldValue, value);

    const csoundNode = getCsoundNode();
    csoundNode?.setSyncTransport(value);
  }

  function updateContentWidth() {
    if (!contentContainer) return;
    contentWidth = contentContainer.offsetWidth;
  }

  const getCsoundNode = () => audioService.getNodeById(nodeId) as CsoundNode | undefined;

  const handleMessage: MessageCallbackFn = (message, meta) => {
    const csoundNode = getCsoundNode();
    if (!csoundNode) return;

    match(message)
      .with(csoundMessages.bang, () => {
        isPlaying = true;
      })
      .with(csoundMessages.run, () => {
        isPlaying = true;
      })
      .with(csoundMessages.resume, () => {
        isPlaying = true;
      });

    csoundNode.send('messageInlet', { inletIndex: meta.inlet, message, meta });
  };

  const runCsoundCode = (code: string) => {
    const csoundNode = getCsoundNode();
    if (!csoundNode) return;

    warnIfNoAudioConnection();

    csoundNode.resume();
    isPlaying = true;

    csoundNode.send('run', code);
  };

  const handleExpressionChange = (newExpr: string) => updateNodeData(nodeId, { expr: newExpr });

  const handleRun = () => runCsoundCode(data.expr);

  async function handlePlayPause() {
    const csoundNode = getCsoundNode();
    if (!csoundNode) return;

    const isPaused = csoundNode.getIsPaused();

    if (isPaused) {
      await csoundNode.resume();
      isPlaying = true;
    } else {
      await csoundNode.pause();
      isPlaying = false;
    }
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    audioService.createNode(nodeId, 'csound~', [null, data.expr]);

    // Sync initial syncTransport state from node data
    if (syncTransport) {
      getCsoundNode()?.setSyncTransport(true);
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

{#snippet csoundInlets()}
  <StandardHandle port="inlet" type="audio" title="Audio Input" total={2} index={0} {nodeId} />

  <StandardHandle
    port="inlet"
    type="message"
    title="Message Input"
    id={0}
    total={2}
    index={1}
    {nodeId}
  />
{/snippet}

{#snippet csoundOutlets()}
  <StandardHandle port="outlet" type="audio" title="Audio Output" total={1} index={0} {nodeId} />
{/snippet}

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2" bind:this={contentContainer}>
      <!-- Floating toolbar -->
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>

        <div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
          <!-- Play/Pause button (hidden when synced to transport) -->
          {#if !syncTransport}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  onclick={handlePlayPause}
                  class="cursor-pointer rounded p-1 hover:bg-zinc-700"
                >
                  <svelte:component this={isPlaying ? Pause : Play} class="h-4 w-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>{isPlaying ? 'Pause' : 'Play'}</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <!-- Settings button -->
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="cursor-pointer rounded p-1 hover:bg-zinc-700"
                onclick={() => (showSettings = !showSettings)}
              >
                <Settings class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Settings</Tooltip.Content>
          </Tooltip.Root>
        </div>
      </div>

      <div class="csound-node-container relative">
        <CommonExprLayout
          bind:this={layoutRef}
          {nodeId}
          {data}
          {selected}
          expr={data.expr}
          bind:isEditing
          editorClass="csound-node-code-editor"
          previewContainerClass="csound-node-preview-container"
          onExpressionChange={handleExpressionChange}
          exitOnRun={false}
          onRun={handleRun}
          handles={csoundInlets}
          outlets={csoundOutlets}
        />
      </div>
    </div>
  </div>

  <!-- Settings Panel -->
  {#if showSettings}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <TransportSyncSettings
        {syncTransport}
        onSyncTransportChange={setSyncTransport}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}
</div>

<style>
  :global(.csound-node-preview-container) {
    width: fit-content;
    max-height: 500px;
    overflow-y: hidden;
  }

  :global(.csound-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }

  :global(.csound-node-container .expr-preview) {
    overflow-x: hidden;
  }

  :global(.csound-node-container .expr-display),
  :global(.csound-node-container .expr-editor-container) {
    max-width: 600px !important;
  }
</style>
