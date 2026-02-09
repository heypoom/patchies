<script lang="ts">
  import { CirclePlus, Delete, Replace, Settings, Trash, X } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { chuckMessages } from '$lib/objects/schemas';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import CommonExprLayout from './CommonExprLayout.svelte';
  import { keymap } from '@codemirror/view';
  import type { ChuckShred, ChuckNode } from '$lib/audio/v2/nodes/ChuckNode';
  import { useAudioOutletWarning } from '$lib/composables/useAudioOutletWarning';

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

  const handleExpressionChange = (newExpr: string) => updateNodeData(nodeId, { expr: newExpr });

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
    subscribeShredsStore();

    if (isEditing) {
      setTimeout(() => layoutRef?.focus(), 10);
    }
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();

    audioService.removeNodeById(nodeId);
  });

  const isReplaceDisabled = $derived(!data.expr.trim() || shreds.length === 0);
</script>

{#snippet chuckHandles()}
  <!-- Audio input (accessible via adc in ChucK code) -->
  <StandardHandle
    port="inlet"
    type="audio"
    id={0}
    title="Audio Input (accessible via adc in ChucK code)"
    total={2}
    index={0}
    {nodeId}
  />

  <!-- Control inlet for messages and code -->
  <StandardHandle
    port="inlet"
    type="message"
    id={1}
    title="Control Input (code, bang, stop)"
    total={2}
    index={1}
    {nodeId}
  />
{/snippet}

{#snippet chuckOutlets()}
  <StandardHandle port="outlet" type="audio" title="Audio Output" total={2} index={0} {nodeId} />

  <StandardHandle
    port="outlet"
    type="message"
    title="Message Output"
    total={2}
    index={1}
    id={0}
    {nodeId}
  />
{/snippet}

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <!-- Floating toolbar -->
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
          <!-- Replace button -->
          <button
            onclick={handleReplace}
            class="cursor-pointer rounded p-1 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Replace (Cmd+Enter)"
            disabled={isReplaceDisabled}
          >
            <Replace class="h-4 w-4" />
          </button>

          <!-- Add shred button -->
          <button
            onclick={handleAddShred}
            class="cursor-pointer rounded p-1 hover:bg-zinc-700"
            title="Add Shred (Cmd+\)"
            disabled={!data.expr.trim()}
          >
            <CirclePlus class="h-4 w-4" />
          </button>

          <!-- Remove button -->
          <button
            onclick={removeChuckCode}
            class="cursor-pointer rounded p-1 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Remove (Cmd+Backspace)"
            disabled={shreds.length === 0}
          >
            <Delete class="h-4 w-4" />
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
        />

        {@render chuckOutlets()}
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="relative">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button onclick={stopChuck} class="rounded p-1 hover:bg-zinc-700">
          <Trash class="h-4 w-4 text-zinc-300" />
        </button>

        <button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <div class="space-y-4">
          <div>
            {#if shreds.length === 0}
              <div class="text-xs text-zinc-500">No running shreds</div>
            {:else}
              <div class="space-y-2">
                {#each shreds as shred, index (index)}
                  <div class="relative flex items-center justify-between">
                    <div class="flex-1">
                      <div class="font-mono text-xs text-zinc-300">ID: {shred.id}</div>

                      <div class="text-xs text-zinc-500">
                        {shred.time}
                      </div>

                      <div class="mt-1 max-w-48 truncate font-mono text-xs text-zinc-400">
                        {shred.code.slice(0, 30)}
                      </div>
                    </div>

                    <div class="absolute top-0 right-0">
                      <button
                        onclick={() => removeShred(shred.id)}
                        class="ml-2 rounded p-1 hover:bg-zinc-700"
                        title="Remove shred"
                      >
                        <X class="h-3 w-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.chuck-node-preview-container) {
    width: fit-content;
    max-height: 500px;
    overflow-y: hidden;
  }

  :global(.chuck-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }

  :global(.chuck-node-container .expr-preview) {
    overflow-x: hidden;
  }
</style>
