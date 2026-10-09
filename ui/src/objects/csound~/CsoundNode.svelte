<script lang="ts">
  import { Link, Pause, Play, RotateCw, Unlink } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { csoundSchema } from '$objects/csound~/schema';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import MusicCodeEditor from '$lib/music-code-layout/MusicCodeEditor.svelte';
  import type { MusicCodeLayoutData } from '$lib/music-code-layout/music-code-layout';
  import { match } from 'ts-pattern';
  import { csoundMessages } from '$lib/objects/schemas';
  import type { CsoundNode } from '$objects/csound~/CsoundNode';
  import { useAudioOutletWarning } from '$lib/composables/useAudioOutletWarning';
  import { useNodeDataTracker } from '$lib/history';
  import * as Popover from '$lib/components/ui/popover';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: MusicCodeLayoutData & { expr: string; syncTransport?: boolean };
    selected: boolean;
  } = $props();

  function getInitialNodeId() {
    return nodeId;
  }

  let layoutRef: MusicCodeEditor | undefined = $state();
  let isPlaying = $state(false);

  let messageContext: MessageContext;
  let audioService = AudioService.getInstance();

  const { updateNodeData } = useSvelteFlow();
  const { warnIfNoAudioConnection } = useAudioOutletWarning(getInitialNodeId());
  const tracker = useNodeDataTracker(getInitialNodeId());

  const syncTransport = $derived(data.syncTransport ?? false);
  const PlaybackIcon = $derived(isPlaying ? Pause : Play);

  function setSyncTransport(value: boolean) {
    const oldValue = syncTransport;
    updateNodeData(nodeId, { syncTransport: value });
    tracker.commit('syncTransport', oldValue, value);

    const csoundNode = getCsoundNode();
    csoundNode?.setSyncTransport(value);
  }

  const getCsoundNode = () => audioService.getNodeById(nodeId) as CsoundNode | undefined;

  const handleMessage: MessageCallbackFn = (message, meta) => {
    const shouldForward = match(message)
      .with(csoundMessages.setCode, ({ value }) => {
        handleExpressionChange(value);
        return false;
      })
      .with(csoundMessages.expand, () => {
        layoutRef?.openExpandedEditor();
        return false;
      })
      .with(csoundMessages.collapse, () => {
        layoutRef?.closeExpandedEditor();
        return false;
      })
      .with(csoundMessages.bang, () => {
        handleRun();
        return false;
      })
      .with(csoundMessages.run, () => {
        handleRun();
        return false;
      })
      .with(csoundMessages.resume, () => {
        isPlaying = true;
        return true;
      })
      .with(csoundMessages.play, () => {
        isPlaying = true;
        return true;
      })
      .with(csoundMessages.pause, () => {
        isPlaying = false;
        return true;
      })
      .with(csoundMessages.stop, () => {
        isPlaying = false;
        return true;
      })
      .otherwise(() => true);

    if (!shouldForward) return;

    const csoundNode = getCsoundNode();
    if (!csoundNode) return;

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

  const handleRun = (code?: string) => runCsoundCode(code ?? data.expr);

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
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();

    audioService.removeNodeById(nodeId);
  });
</script>

{#snippet csoundInlets()}
  <TypedHandle
    port="inlet"
    spec={csoundSchema.inlets[0].handle!}
    title="Audio Input"
    total={2}
    index={0}
    {nodeId}
  />

  <TypedHandle
    port="inlet"
    spec={csoundSchema.inlets[1].handle!}
    title="Message Input"
    total={2}
    index={1}
    {nodeId}
  />
{/snippet}

{#snippet csoundOutlets()}
  <TypedHandle
    port="outlet"
    spec={csoundSchema.outlets[0].handle!}
    title="Audio Output"
    total={1}
    index={0}
    {nodeId}
  />
{/snippet}

{#snippet csoundActions()}
  <Tooltip.Root>
    <Tooltip.Trigger
      onclick={() => handleRun()}
      class="cursor-pointer rounded p-1 hover:bg-zinc-700"
      aria-label="Run Csound code"
    >
      <RotateCw class="h-4 w-4" />
    </Tooltip.Trigger>
    <Tooltip.Content>Run Code (Cmd+Enter)</Tooltip.Content>
  </Tooltip.Root>

  {#if !syncTransport}
    <Tooltip.Root>
      <Tooltip.Trigger
        onclick={handlePlayPause}
        class="cursor-pointer rounded p-1 hover:bg-zinc-700"
        aria-label={isPlaying ? 'Pause Csound' : 'Play Csound'}
      >
        <PlaybackIcon class="h-4 w-4" />
      </Tooltip.Trigger>
      <Tooltip.Content>{isPlaying ? 'Pause' : 'Play'}</Tooltip.Content>
    </Tooltip.Root>
  {/if}
{/snippet}

{#snippet csoundMenu()}
  <Popover.Close
    class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
    onclick={() => setSyncTransport(!syncTransport)}
  >
    {#if syncTransport}<Unlink class="h-4 w-4" />{:else}<Link class="h-4 w-4" />{/if}
    {syncTransport ? 'Unsync from transport' : 'Sync to transport'}
  </Popover.Close>
{/snippet}

<div class="relative">
  <MusicCodeEditor
    bind:this={layoutRef}
    {nodeId}
    {data}
    {selected}
    value={data.expr}
    label="csound~"
    status={isPlaying ? 'playing' : 'paused'}
    onchange={handleExpressionChange}
    onrun={handleRun}
    actions={csoundActions}
    menu={csoundMenu}
    handles={csoundInlets}
    outlets={csoundOutlets}
  />
</div>
