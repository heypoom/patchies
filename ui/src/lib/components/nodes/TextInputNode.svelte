<script lang="ts">
  import { GripHorizontal, Lock, LockOpen, Play } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow, useStore, useEdges } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { textboxSchema } from '$lib/objects/schemas/textbox';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas/common';
  import { useNodeDataTracker } from '$lib/history';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import { checkMessageConnections } from '$lib/composables/checkHandleConnections';
  import * as Tooltip from '$lib/components/ui/tooltip';
  const HIDDEN_HANDLE_CLASS = 'opacity-30 group-hover:opacity-100 sm:opacity-0';

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
  const edges = useEdges();

  // Check if handles have connections (for smart auto mode)
  const connections = $derived(checkMessageConnections(edges.current, node.id));

  const messageContext = new MessageContext(node.id);

  const tracker = useNodeDataTracker(node.id);
  const textTracker = tracker.track('text', () => node.data.text ?? '');

  let textareaElement: HTMLTextAreaElement;

  const text = $derived(node.data.text || '');
  const width = $derived(node.width ?? defaultWidth);
  const height = $derived(node.height ?? defaultHeight);
  const isLocked = $derived((node.data.locked ?? false) || !store.nodesDraggable);

  // Show inlet/outlet when connected (smart auto mode), not locked, or easy connect enabled
  const showInlet = $derived(connections.hasInlet || !isLocked || $shouldShowHandles);
  const showOutlet = $derived(connections.hasOutlet || !isLocked || $shouldShowHandles);

  const handleInletClass = $derived(
    node.selected || $shouldShowHandles || connections.hasInlet ? '' : HIDDEN_HANDLE_CLASS
  );

  const handleOutletClass = $derived(
    node.selected || $shouldShowHandles || connections.hasOutlet ? '' : HIDDEN_HANDLE_CLASS
  );

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
        <div
          class={[
            'cursor-move rounded px-1 py-1 transition-opacity hover:bg-zinc-700/50',
            node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          ]}
          title="Drag to move"
        >
          <GripHorizontal class="h-4 w-4 text-zinc-500" />
        </div>
      {:else}
        <div></div>
      {/if}

      <div
        class={[
          'flex gap-1 transition-opacity group-hover:opacity-100 sm:opacity-0',
          node.selected && 'opacity-100'
        ]}
      >
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={() => {
                const oldLocked = node.data.locked ?? false;
                updateNodeData(node.id, { ...node.data, locked: !oldLocked });
                tracker.commit('locked', oldLocked, !oldLocked);
              }}
              class={[
                'h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 hover:bg-zinc-700',
                'text-zinc-300'
              ]}
            >
              {#if node.data.locked}
                <Lock class="h-4 w-4" />
              {:else}
                <LockOpen class="h-4 w-4" />
              {/if}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>{node.data.locked ? 'Unlock' : 'Lock'}</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={sendText}
              class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
            >
              <Play class="h-4 w-4" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Send (or Shift + Enter)</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </div>

    <div class="relative">
      {#if showInlet}
        <TypedHandle
          port="inlet"
          spec={textboxSchema.inlets[0].handle!}
          total={1}
          index={0}
          class={handleInletClass}
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

      {#if showOutlet}
        <TypedHandle
          port="outlet"
          spec={textboxSchema.outlets[0].handle!}
          total={1}
          index={0}
          class={handleOutletClass}
          nodeId={node.id}
        />
      {/if}
    </div>
  </div>
</div>
