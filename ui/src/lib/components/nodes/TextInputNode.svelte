<script lang="ts">
  import { Lock, LockOpen, Play } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow, useStore } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas/common';
  import { useNodeDataTracker } from '$lib/history';
  import { shouldShowHandles } from '../../../stores/ui.store';

  let node: {
    id: string;
    data: { text: string; locked?: boolean };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const [defaultWidth, defaultHeight] = [240, 96];

  const { updateNodeData } = useSvelteFlow();
  const store = useStore();

  const messageContext = new MessageContext(node.id);

  const tracker = useNodeDataTracker(node.id);
  const textTracker = tracker.track('text', () => node.data.text ?? '');

  let textareaElement: HTMLTextAreaElement;

  const text = $derived(node.data.text || '');
  const width = $derived(node.width ?? defaultWidth);
  const height = $derived(node.height ?? defaultHeight);
  const isLocked = $derived((node.data.locked ?? false) || !store.nodesDraggable);
  const showHandles = $derived(!isLocked || $shouldShowHandles);
  const handleClass = $derived.by(() => {
    if (node.selected || $shouldShowHandles) return '';
    return 'opacity-30 group-hover:opacity-100 sm:opacity-0';
  });
  const setText = (text: string) => updateNodeData(node.id, { text });

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(P.string, (text) => {
        setText(text);
      })
      .with(messages.bang, () => {
        messageContext.send(text);
      })
      .with(messages.clear, () => {
        setText('');
      });
  };

  onMount(() => {
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });

  function handleTextChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    setText(target.value);
  }

  function sendText() {
    messageContext.send(text);
  }
</script>

<div class={['group relative font-mono', isLocked && 'nodrag']}>
  <NodeResizer class="z-1" isVisible={node.selected && !isLocked} minWidth={120} minHeight={32} />

  <div class="flex flex-col gap-2">
    <!-- Floating Header -->
    <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
      {#if !isLocked}
        <div class="z-10 rounded-lg bg-transparent px-2 py-1">
          <div class="font-mono text-xs font-medium text-zinc-400">textbox</div>
        </div>
      {:else}
        <div></div>
      {/if}

      <div class="flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0">
        <button
          onclick={() => {
            const oldLocked = node.data.locked ?? false;
            updateNodeData(node.id, { ...node.data, locked: !oldLocked });
            tracker.commit('locked', oldLocked, !oldLocked);
          }}
          class={[
            'h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 hover:bg-zinc-700',
            node.data.locked ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          ]}
          title={node.data.locked ? 'Unlock' : 'Lock'}
        >
          {#if node.data.locked}
            <Lock class="h-4 w-4" />
          {:else}
            <LockOpen class="h-4 w-4" />
          {/if}
        </button>

        <button
          onclick={sendText}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
          title="Send (or Shift + Enter)"
        >
          <Play class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="relative">
      {#if showHandles}
        <StandardHandle
          port="inlet"
          type="message"
          total={1}
          index={0}
          class={handleClass}
          nodeId={node.id}
        />
      {/if}

      <!-- Text Input -->
      <textarea
        bind:this={textareaElement}
        value={text}
        oninput={handleTextChange}
        onfocus={textTracker.onFocus}
        onblur={textTracker.onBlur}
        placeholder="Enter text here..."
        style="width: {width}px; height: {height}px;"
        class={[
          'focus:outline-one nodrag block resize-none rounded border bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-400 outline-none focus:bg-zinc-800',
          node.selected
            ? isLocked
              ? 'border-blue-500'
              : 'border-transparent'
            : 'border-zinc-600 focus:border-zinc-500'
        ]}
        onkeydown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();

            sendText();
          }
        }}
      ></textarea>

      {#if showHandles}
        <StandardHandle
          port="outlet"
          type="message"
          total={1}
          index={0}
          class={`!bottom-0.5 ${handleClass}`}
          nodeId={node.id}
        />
      {/if}
    </div>
  </div>
</div>
