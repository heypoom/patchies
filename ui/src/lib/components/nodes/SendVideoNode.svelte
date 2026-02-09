<script lang="ts">
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import ObjectCommonLayout from './ObjectCommonLayout.svelte';
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

  let channel = $derived(node.data.channel ?? 'foo');

  const handleMessage: MessageCallbackFn = (m, { inlet }) => {
    // Channel inlet (inlet 1) - accepts string to change channel
    if (inlet === 1 && typeof m === 'string' && m.trim()) {
      updateNode(node.id, { data: { ...node.data, channel: m.trim() } });
    }
  };

  function handleChannelChange(newChannel: string) {
    updateNode(node.id, { data: { ...node.data, channel: newChannel } });
  }

  onMount(() => {
    messageContext = new MessageContext(node.id);
    messageContext.queue.addCallback(handleMessage);
    glSystem.upsertNode(node.id, 'send.vdo', { channel });
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    glSystem.removeNode(node.id);
  });

  // Update GLSystem when channel changes
  $effect(() => {
    glSystem.upsertNode(node.id, 'send.vdo', { channel });
  });
</script>

<ObjectCommonLayout
  nodeLabel="send.vdo"
  {channel}
  selected={node.selected}
  onChannelChange={handleChannelChange}
>
  {#snippet inlets()}
    <StandardHandle
      port="inlet"
      type="video"
      id={0}
      title="Video input"
      total={2}
      index={0}
      class="top-0"
      nodeId={node.id}
    />
    <StandardHandle
      port="inlet"
      type="message"
      id={1}
      title="Channel name"
      total={2}
      index={1}
      class="top-0"
      nodeId={node.id}
    />
  {/snippet}
</ObjectCommonLayout>
