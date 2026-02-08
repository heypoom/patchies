<script lang="ts">
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { onDestroy, onMount } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

  let node: {
    id: string;
    data: { channel?: string };
    selected: boolean;
  } = $props();

  const { updateNode } = useSvelteFlow();
  let glSystem = GLSystem.getInstance();
  let messageContext: MessageContext;

  let isEditing = $state(false);
  let inputElement = $state<HTMLInputElement>();
  let nodeElement = $state<HTMLDivElement>();
  let editValue = $state('');

  let channel = $derived(node.data.channel ?? 'foo');

  const handleMessage: MessageCallbackFn = (m, { inlet }) => {
    // Channel inlet (inlet 0) - accepts string to change channel
    if (inlet === 0 && typeof m === 'string' && m.trim()) {
      updateNode(node.id, { data: { ...node.data, channel: m.trim() } });
    }
  };

  function enterEditingMode() {
    editValue = channel;
    isEditing = true;
    setTimeout(() => inputElement?.focus(), 10);
  }

  function exitEditingMode(save: boolean = true) {
    isEditing = false;

    if (save && editValue.trim()) {
      updateNode(node.id, { data: { ...node.data, channel: editValue.trim() } });
    }

    setTimeout(() => nodeElement?.focus(), 0);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      exitEditingMode(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      exitEditingMode(false);
    }
  }

  function handleBlur() {
    setTimeout(() => exitEditingMode(true), 100);
  }

  const containerClass = $derived(
    node.selected
      ? 'border-zinc-400 bg-zinc-800/80 shadow-glow-md'
      : 'border-zinc-700 bg-zinc-900/80 hover:shadow-glow-sm'
  );

  onMount(() => {
    messageContext = new MessageContext(node.id);
    messageContext.queue.addCallback(handleMessage);
    glSystem.upsertNode(node.id, 'recv.vdo', { channel });
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    glSystem.removeNode(node.id);
  });

  // Update GLSystem when channel changes
  $effect(() => {
    glSystem.upsertNode(node.id, 'recv.vdo', { channel });
  });
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="relative">
        <StandardHandle
          port="inlet"
          type="message"
          id={0}
          title="Channel name"
          total={1}
          index={0}
          class="top-0"
          nodeId={node.id}
        />

        <div class="relative">
          {#if isEditing}
            <div class={['w-fit rounded-lg border', containerClass]}>
              <input
                bind:this={inputElement}
                bind:value={editValue}
                onblur={handleBlur}
                onkeydown={handleKeydown}
                placeholder="channel"
                class="nodrag bg-transparent px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none"
              />
            </div>
          {:else}
            <div
              bind:this={nodeElement}
              class={['w-full cursor-pointer rounded-lg border px-3 py-2', containerClass]}
              ondblclick={enterEditingMode}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && enterEditingMode()}
            >
              <div class="flex items-center gap-1.5 font-mono text-xs">
                <span class="text-zinc-200">recv.vdo</span>
                <span class="text-zinc-400">{channel}</span>
              </div>
            </div>
          {/if}
        </div>

        <StandardHandle
          port="outlet"
          type="video"
          id={0}
          title="Video output"
          total={1}
          index={0}
          class="bottom-0"
          nodeId={node.id}
        />
      </div>
    </div>
  </div>
</div>
