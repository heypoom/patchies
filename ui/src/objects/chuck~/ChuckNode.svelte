<script lang="ts">
  import { CirclePlus, Delete, Replace, Settings } from '@lucide/svelte/icons';
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { chuckSchema } from '$objects/chuck~/schema';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { chuckMessages } from '$lib/objects/schemas';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import MusicCodeEditor from '$lib/music-code-layout/MusicCodeEditor.svelte';
  import type { MusicCodeLayoutData } from '$lib/music-code-layout/music-code-layout';
  import { keymap } from '@codemirror/view';
  import { Prec } from '@codemirror/state';
  import type { ChuckShred, ChuckNode } from '$objects/chuck~/ChuckNode';
  import { useAudioOutletWarning } from '$lib/composables/useAudioOutletWarning';
  import ChuckSettings from '$objects/chuck~/ChuckSettings.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { hasChuckAdcReference } from '$lib/audio/visible-audio-inputs';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: MusicCodeLayoutData & { expr: string };
    selected: boolean;
  } = $props();

  function getInitialNodeId() {
    return nodeId;
  }

  let layoutRef: MusicCodeEditor | undefined = $state();
  let showSettings = $state(false);
  let expressionInternalsTimeout: ReturnType<typeof setTimeout> | undefined;

  let messageContext: MessageContext;
  let audioService = AudioService.getInstance();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { warnIfNoOutletConnection } = useAudioOutletWarning(getInitialNodeId());

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(chuckMessages.setCode, ({ value }) => {
        handleExpressionChange(value);
      })
      .with(chuckMessages.string, async (nextExpr) => {
        updateNodeData(nodeId, { expr: nextExpr });
        await send('add', nextExpr);
      })
      .with(chuckMessages.replaceCode, async ({ code }) => {
        await send('replace', code);
      })
      .with(chuckMessages.replace, async () => {
        await send('replace', data.expr);
      })
      .with(chuckMessages.bang, async () => {
        await send('replace', data.expr);
      })
      .with(chuckMessages.run, async () => {
        await send('replace', data.expr);
      })
      .with(chuckMessages.expand, () => {
        layoutRef?.openExpandedEditor();
      })
      .with(chuckMessages.collapse, () => {
        layoutRef?.closeExpandedEditor();
      })
      .with(chuckMessages.add, async () => {
        await send('add', data.expr);
      })
      .with(chuckMessages.remove, () => {
        removeChuckCode();
      })
      .with(chuckMessages.stop, () => {
        stopChuck();
      })
      .with(chuckMessages.anyTypeMessage, async ({ type, ...payload }) => {
        await send(type, payload);
      });
  };

  const send = (key: string, msg: unknown) => audioService.send(nodeId, key, msg);

  const removeChuckCode = () => send('remove', null);
  const removeShred = (shredId: number) => send('removeShred', shredId);
  const stopChuck = () => send('clearAll', null);

  // Get running shreds for the settings panel - access the store value
  let shreds = $state<ChuckShred[]>([]);

  // Custom keybinds for ChucK operations
  const chuckKeymaps = [
    Prec.high(
      keymap.of([
        {
          // Cmd + \ = add new shred
          key: 'Mod-\\',
          run: () => {
            handleAddShred();
            return true;
          }
        },
        {
          key: 'Mod-Backspace',
          run: () => {
            removeChuckCode();
            return true;
          }
        }
      ])
    )
  ];

  const handleExpressionChange = (newExpr: string) => {
    updateNodeData(nodeId, { expr: newExpr });

    if (expressionInternalsTimeout) {
      clearTimeout(expressionInternalsTimeout);
    }

    expressionInternalsTimeout = setTimeout(() => {
      expressionInternalsTimeout = undefined;
      updateNodeInternals(nodeId);
    }, 5);
  };

  const handleAddShred = () => {
    warnIfNoOutletConnection();

    send('add', data.expr);
  };

  const handleReplace = () => {
    warnIfNoOutletConnection();

    send('replace', data.expr);
  };

  function subscribeShredsStore() {
    const chuckNode = audioService.getNodeById(nodeId) as ChuckNode | undefined;

    if (chuckNode) {
      const unsubscribe = chuckNode.shredsStore.subscribe((newShreds) => {
        shreds = newShreds;
      });

      return unsubscribe;
    }
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    audioService.createNode(nodeId, 'chuck~');
    const unsubscribeShreds = subscribeShredsStore();

    return () => unsubscribeShreds?.();
  });

  onDestroy(() => {
    if (expressionInternalsTimeout) {
      clearTimeout(expressionInternalsTimeout);
    }

    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();

    audioService.removeNodeById(nodeId);
  });

  const isReplaceDisabled = $derived(!data.expr.trim() || shreds.length === 0);
  const showAudioInput = $derived(hasChuckAdcReference(data.expr ?? ''));
  const inletCount = $derived((showAudioInput ? 1 : 0) + 1);
</script>

{#snippet chuckHandles()}
  {#if showAudioInput}
    <TypedHandle
      port="inlet"
      spec={chuckSchema.inlets[0].handle!}
      title="Audio Input (accessible via adc in ChucK code)"
      total={inletCount}
      index={0}
      {nodeId}
    />
  {/if}

  <!-- Control inlet for messages and code -->
  <TypedHandle
    port="inlet"
    spec={chuckSchema.inlets[1].handle!}
    title="Control Input (code, bang, stop)"
    total={inletCount}
    index={showAudioInput ? 1 : 0}
    {nodeId}
  />
{/snippet}

{#snippet chuckOutlets()}
  <TypedHandle
    port="outlet"
    spec={chuckSchema.outlets[0].handle!}
    title="Audio Output"
    total={2}
    index={0}
    {nodeId}
  />

  <TypedHandle
    port="outlet"
    spec={chuckSchema.outlets[1].handle!}
    title="Message Output"
    total={2}
    index={1}
    {nodeId}
  />
{/snippet}

{#snippet detachedChuckSettings()}
  <ChuckSettings
    {shreds}
    onRemoveShred={removeShred}
    onStopAll={stopChuck}
    showCloseButton={false}
    showHeaderActions={false}
  />
{/snippet}

{#snippet chuckButtons(detached: boolean)}
  <Tooltip.Root>
    <Tooltip.Trigger
      onclick={handleReplace}
      class={[
        'cursor-pointer rounded text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50',
        detached
          ? 'bg-black/35 p-2 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100'
          : 'p-1 hover:bg-zinc-700'
      ]}
      disabled={isReplaceDisabled}
      aria-label="Replace ChucK shred"
    >
      <Replace class="h-4 w-4" />
    </Tooltip.Trigger>
    <Tooltip.Content>Replace (Cmd+Enter)</Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger
      onclick={handleAddShred}
      class={[
        'cursor-pointer rounded text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50',
        detached
          ? 'bg-black/35 p-2 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100'
          : 'p-1 hover:bg-zinc-700'
      ]}
      disabled={!data.expr.trim()}
      aria-label="Add ChucK shred"
    >
      <CirclePlus class="h-4 w-4" />
    </Tooltip.Trigger>
    <Tooltip.Content>Add Shred (Cmd+\)</Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger
      onclick={removeChuckCode}
      class={[
        'cursor-pointer rounded text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50',
        detached
          ? 'bg-black/35 p-2 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100'
          : 'p-1 hover:bg-zinc-700'
      ]}
      disabled={shreds.length === 0}
      aria-label="Remove ChucK shred"
    >
      <Delete class="h-4 w-4" />
    </Tooltip.Trigger>
    <Tooltip.Content>Remove (Cmd+Backspace)</Tooltip.Content>
  </Tooltip.Root>
{/snippet}

{#snippet chuckActions()}
  {@render chuckButtons(false)}
  {#if !data.editorCollapsed}
    <Tooltip.Root>
      <Tooltip.Trigger
        class="cursor-pointer rounded p-1 text-zinc-300 hover:bg-zinc-700"
        aria-label="ChucK settings"
        aria-expanded={showSettings}
        onclick={() => (showSettings = !showSettings)}><Settings class="h-4 w-4" /></Tooltip.Trigger
      >
      <Tooltip.Content>Settings</Tooltip.Content>
    </Tooltip.Root>
  {/if}
{/snippet}

{#snippet detachedChuckActions()}
  {@render chuckButtons(true)}
{/snippet}

{#snippet chuckMenu()}
  {#if data.editorCollapsed}
    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
      onclick={() => (showSettings = !showSettings)}
    >
      <Settings class="h-4 w-4" />Settings
    </button>
  {/if}
{/snippet}

{#snippet chuckSidePanel()}
  {#if showSettings}
    <ChuckSettings
      {shreds}
      onRemoveShred={removeShred}
      onStopAll={stopChuck}
      onClose={() => (showSettings = false)}
    />
  {/if}
{/snippet}

<div class="relative">
  <MusicCodeEditor
    bind:this={layoutRef}
    {nodeId}
    {data}
    {selected}
    sidePanel={chuckSidePanel}
    value={data.expr}
    label="chuck~"
    status={`${shreds.length} ${shreds.length === 1 ? 'shred' : 'shreds'}`}
    placeholder="SinOsc osc => dac; 1::second => now;"
    onchange={handleExpressionChange}
    onrun={handleReplace}
    extraExtensions={chuckKeymaps}
    actions={chuckActions}
    menu={chuckMenu}
    handles={chuckHandles}
    outlets={chuckOutlets}
    detachedActions={detachedChuckActions}
    detachedSettings={detachedChuckSettings}
  />
</div>
