<script lang="ts">
  import { CirclePlus, Delete, Expand, Replace, Settings } from '@lucide/svelte/icons';
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { chuckSchema } from '$lib/objects/schemas/chuck';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { chuckMessages } from '$lib/objects/schemas';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import CommonExprLayout from './CommonExprLayout.svelte';
  import { keymap } from '@codemirror/view';
  import type { ChuckShred, ChuckNode } from '$lib/audio/v2/nodes/ChuckNode';
  import { useAudioOutletWarning } from '$lib/composables/useAudioOutletWarning';
  import ChuckSettings from '$lib/components/settings/ChuckSettings.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { hasChuckAdcReference } from '$lib/audio/visible-audio-inputs';

  let contentContainer: HTMLDivElement | null = null;
  let contentWidth = $state(100);

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr: string };
    selected: boolean;
  } = $props();

  let isEditing = $state(!data.expr);
  let layoutRef = $state<any>();
  let showSettings = $state(false);

  let messageContext: MessageContext;
  let audioService = AudioService.getInstance();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { warnIfNoOutletConnection } = useAudioOutletWarning(nodeId);

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
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
    keymap.of([
      {
        // Cmd + \ = add new shred
        key: 'Cmd-\\',
        run: () => {
          handleAddShred();
          return true;
        }
      }
    ])
  ];

  const handleExpressionChange = (newExpr: string) => {
    updateNodeData(nodeId, { expr: newExpr });
    setTimeout(() => updateNodeInternals(nodeId), 5);
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

  function updateContentWidth() {
    if (!contentContainer) return;
    contentWidth = contentContainer.offsetWidth;
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    audioService.createNode(nodeId, 'chuck~');
    subscribeShredsStore();

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

{#snippet detachedChuckActions()}
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        onclick={handleReplace}
        class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isReplaceDisabled}
        aria-label="Replace ChucK shred"
      >
        <Replace class="h-4 w-4" />
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content>Replace (Cmd+Enter)</Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        onclick={handleAddShred}
        class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!data.expr.trim()}
        aria-label="Add ChucK shred"
      >
        <CirclePlus class="h-4 w-4" />
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content>Add Shred (Cmd+\)</Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        onclick={removeChuckCode}
        class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={shreds.length === 0}
        aria-label="Remove ChucK shred"
      >
        <Delete class="h-4 w-4" />
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content>Remove (Cmd+Backspace)</Tooltip.Content>
  </Tooltip.Root>
{/snippet}

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2" bind:this={contentContainer}>
      <!-- Floating toolbar -->
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="node-floating-controls flex gap-1">
          <!-- Replace button -->
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={handleReplace}
                class="cursor-pointer rounded p-1 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isReplaceDisabled}
              >
                <Replace class="h-4 w-4" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Replace (Cmd+Enter)</Tooltip.Content>
          </Tooltip.Root>

          <!-- Add shred button -->
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={handleAddShred}
                class="cursor-pointer rounded p-1 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!data.expr.trim()}
              >
                <CirclePlus class="h-4 w-4" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Add Shred (Cmd+\)</Tooltip.Content>
          </Tooltip.Root>

          <!-- Remove button -->
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={removeChuckCode}
                class="cursor-pointer rounded p-1 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={shreds.length === 0}
              >
                <Delete class="h-4 w-4" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Remove (Cmd+Backspace)</Tooltip.Content>
          </Tooltip.Root>
        </div>

        <div class="node-floating-controls flex gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={() => layoutRef?.openExpandedEditor()}
                class="cursor-pointer rounded p-1 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!data.expr.trim()}
                aria-label="Expand ChucK editor"
              >
                <Expand class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Expand Editor</Tooltip.Content>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="cursor-pointer rounded p-1 hover:bg-zinc-700"
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

      <div class="chuck-node-container relative">
        {@render chuckHandles()}

        <CommonExprLayout
          bind:this={layoutRef}
          {nodeId}
          {data}
          {selected}
          expr={data.expr}
          bind:isEditing
          placeholder="SinOsc osc => dac; 1::second => now;"
          editorClass="chuck-node-code-editor"
          previewContainerClass="chuck-node-preview-container"
          onExpressionChange={handleExpressionChange}
          extraExtensions={chuckKeymaps}
          exitOnRun={false}
          onRun={handleReplace}
          nodeType="chuck~"
          detachedEditorTitle="chuck~"
          detachedActions={detachedChuckActions}
          detachedSettings={detachedChuckSettings}
        />

        {@render chuckOutlets()}
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <ChuckSettings
        {shreds}
        onRemoveShred={removeShred}
        onStopAll={stopChuck}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}
</div>

<style>
  :global(.chuck-node-preview-container) {
    --patchies-common-expr-padding-x: 0.75rem;
    --patchies-common-expr-padding-y: 0.5rem;
  }

  :global(.chuck-node-code-editor) {
    --patchies-common-expr-padding-x: 0.35rem;
    --patchies-common-expr-padding-y: 0.45rem;
  }

  :global(.chuck-node-preview-container) {
    width: fit-content;
    max-height: 500px;
    overflow-y: hidden;
  }

  :global(.chuck-node-code-editor .cm-content) {
    padding: var(--patchies-common-expr-padding-y) var(--patchies-common-expr-padding-x) !important;
  }

  :global(.chuck-node-container .expr-preview) {
    overflow-x: hidden;
  }
</style>
