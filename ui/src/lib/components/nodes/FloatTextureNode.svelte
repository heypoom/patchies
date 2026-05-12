<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import {
    getFloatTextureTextureFormat,
    inferFloatTextureDataFormat,
    isFloatTextureInterleavedSource,
    isFloatTextureSharedSource,
    isFloatTextureSquareSource,
    isFloatTextureWrappedSource,
    packFloatTexture,
    type FloatTextureDataFormat,
    type FloatTextureSource
  } from '$lib/float-texture/pack-float-texture';
  import { FloatTextureFrameUploadScheduler } from '$lib/float-texture/frame-upload-scheduler';
  import { FloatTextureSharedVersionTracker } from '$lib/float-texture/shared-version-tracker';
  import { getFloatTextureValidationErrorMessage } from '$lib/float-texture/validation-error';
  import type { FBOFormat } from '$lib/rendering/types';
  import { logger } from '$lib/utils/logger';

  let {
    id: nodeId,
    data,
    selected,
    class: className = ''
  }: {
    id: string;
    data: {
      dataFormat?: FloatTextureDataFormat;
      textureFormat?: FBOFormat;
    };
    selected: boolean;
    class?: string;
  } = $props();

  let glSystem = GLSystem.getInstance();
  let messageContext: MessageContext;
  let width = $state(0);
  let height = $state(0);
  let hasTexture = $state(false);
  let errorMessage = $state<string | null>(null);
  let lastLoggedErrorMessage: string | null = null;
  let packBuffer: Float32Array | undefined;
  let sharedVersionTracker = new FloatTextureSharedVersionTracker();
  let uploadScheduler = new FloatTextureFrameUploadScheduler<{
    width: number;
    height: number;
    data: Float32Array;
    textureFormat: FBOFormat;
  }>((upload) => {
    glSystem.setFloatTexture(
      nodeId,
      upload.width,
      upload.height,
      upload.data,
      upload.textureFormat
    );
  });

  let dataFormat = $state<FloatTextureDataFormat>(data.dataFormat ?? 'r');

  const containerClass = $derived(
    errorMessage
      ? 'border-red-500/70 bg-red-950/30 shadow-[0_0_12px_rgba(239,68,68,0.18)]'
      : selected
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

    if (isFloatTextureInterleavedSource(message)) {
      return { source: message };
    }

    if (isFloatTextureSharedSource(message)) {
      return { source: message };
    }

    if (isFloatTextureWrappedSource(message) || isFloatTextureSquareSource(message)) {
      return { source: message };
    }

    return null;
  }

  const handleMessage: MessageCallbackFn = (message) => {
    const input = readFloatTextureSource(message);
    if (!input) return;
    if (!sharedVersionTracker.shouldUpload(input.source)) return;

    const resolvedDataFormat = inferFloatTextureDataFormat(input.source);
    const resolvedTextureFormat =
      getFloatTextureTextureFormat(input.source) ?? data.textureFormat ?? 'rgba32f';

    let packed: ReturnType<typeof packFloatTexture>;

    try {
      packed = packFloatTexture(input.source, {
        dataFormat: resolvedDataFormat,
        target: packBuffer
      });
    } catch (error) {
      const message = getFloatTextureValidationErrorMessage(error);

      errorMessage = message;

      if (message !== lastLoggedErrorMessage) {
        logger.nodeError(nodeId, `[float.tex] ${message}`);
        lastLoggedErrorMessage = message;
      }

      return;
    }

    if (
      !isFloatTextureInterleavedSource(input.source) &&
      !isFloatTextureSharedSource(input.source)
    ) {
      packBuffer = packed.data;
    }

    width = packed.width;
    height = packed.height;
    dataFormat = resolvedDataFormat;
    errorMessage = null;
    lastLoggedErrorMessage = null;

    hasTexture = true;

    uploadScheduler.queue({
      width: packed.width,
      height: packed.height,
      data: packed.data,
      textureFormat: resolvedTextureFormat
    });
  };

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    glSystem.upsertNode(nodeId, 'float.tex', {});
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    uploadScheduler.cancel();
    glSystem.removeBitmap(nodeId);
    glSystem.removeNode(nodeId);
  });
</script>

<div class={['relative', className]}>
  <StandardHandle port="inlet" type="message" id="0" total={1} index={0} {nodeId} />

  <div class={['min-w-[132px] rounded-lg border px-3 py-2', containerClass]}>
    <div class="font-mono text-xs text-zinc-200">
      float.tex

      <span class="font-mono text-zinc-500">
        {#if hasTexture}
          {width}x{height}
          {dataFormat}
        {:else}
          0x0 {dataFormat}
        {/if}
      </span>
    </div>

    {#if errorMessage}
      <div class="mt-1 max-w-[220px] font-mono text-[10px] leading-tight break-words text-red-300">
        {errorMessage}
      </div>
    {/if}
  </div>

  <StandardHandle port="outlet" type="video" id="0" total={1} index={0} {nodeId} />
</div>
