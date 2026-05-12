<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import {
    inferFloatTextureDataFormat,
    packFloatTexture,
    type FloatTextureDataFormat,
    type FloatTextureSource
  } from '$lib/float-texture/pack-float-texture';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      dataFormat?: FloatTextureDataFormat;
    };
    selected: boolean;
  } = $props();

  let glSystem = GLSystem.getInstance();
  let messageContext: MessageContext;
  let width = $state(0);
  let height = $state(0);
  let channelCount = $state(0);
  let hasTexture = $state(false);

  let dataFormat = $state<FloatTextureDataFormat>(data.dataFormat ?? 'r');
  const containerClass = $derived(
    selected
      ? 'border-zinc-400/80 bg-zinc-900/90 shadow-glow-md'
      : 'border-zinc-700 bg-zinc-900/80 hover:shadow-glow-sm'
  );

  function isFloatChannelArray(value: unknown): value is Float32Array[] {
    return Array.isArray(value) && value.every((channel) => channel instanceof Float32Array);
  }

  function readFloatTextureSource(message: unknown): {
    source: FloatTextureSource;
  } | null {
    if (message instanceof Float32Array) {
      return { source: message };
    }

    if (isFloatChannelArray(message)) {
      return { source: message };
    }

    return null;
  }

  const handleMessage: MessageCallbackFn = (message) => {
    const input = readFloatTextureSource(message);
    if (!input) return;

    const resolvedDataFormat = inferFloatTextureDataFormat(input.source);
    const packed = packFloatTexture(input.source, { dataFormat: resolvedDataFormat });

    width = packed.width;
    height = packed.height;
    channelCount = input.source instanceof Float32Array ? 1 : input.source.length;
    dataFormat = resolvedDataFormat;
    hasTexture = true;

    glSystem.setFloatTexture(nodeId, packed.width, packed.height, packed.data);
  };

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    glSystem.upsertNode(nodeId, 'float.tex', {});
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    glSystem.removeBitmap(nodeId);
    glSystem.removeNode(nodeId);
  });

  $effect(() => {
    glSystem.upsertNode(nodeId, 'float.tex', {});
  });
</script>

<div class="relative">
  <StandardHandle
    port="inlet"
    type="message"
    id="0"
    title="Float32Array or Float32Array[] input"
    total={1}
    index={0}
    {nodeId}
  />

  <div class={['min-w-[132px] rounded-lg border px-3 py-2', containerClass]}>
    <div class="font-mono text-xs text-zinc-200">
      float.tex

      <span class="font-mono text-zinc-500">
        {#if hasTexture}
          {width}x{height} {dataFormat}
        {:else}
          0x0 {dataFormat}
        {/if}
      </span>
    </div>
  </div>

  <StandardHandle
    port="outlet"
    type="video"
    id="0"
    title="Float texture output"
    total={1}
    index={0}
    {nodeId}
  />
</div>
