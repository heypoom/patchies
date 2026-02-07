<script lang="ts">
  import { Monitor, Square } from '@lucide/svelte/icons';
  import { onMount, onDestroy } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { shouldShowHandles } from '../../../stores/ui.store';

  let { id: nodeId, selected }: { id: string; selected: boolean } = $props();

  let glSystem = GLSystem.getInstance();
  let messageContext: MessageContext;
  let videoElement = $state<HTMLVideoElement | undefined>();
  let isCapturing = $state(false);
  let errorMessage = $state<string | null>(null);
  let bitmapFrameId: number;

  let resizerCanvas: OffscreenCanvas | null = null;
  let resizerCtx: OffscreenCanvasRenderingContext2D | null = null;

  const [MAX_UPLOAD_WIDTH, MAX_UPLOAD_HEIGHT] = glSystem.outputSize;

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(messages.bang, () => startCapture())
      .otherwise(() => {});
  };

  async function startCapture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      if (videoElement) {
        videoElement.srcObject = stream;
        await videoElement.play();
        isCapturing = true;
        errorMessage = null;

        // Start uploading frames
        bitmapFrameId = requestAnimationFrame(uploadBitmap);

        // Handle stream ending
        stream.getVideoTracks()[0].onended = () => {
          stopCapture();
        };
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to capture screen';
      isCapturing = false;
    }
  }

  async function stopCapture() {
    if (videoElement?.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }

    isCapturing = false;
    if (bitmapFrameId) {
      cancelAnimationFrame(bitmapFrameId);
    }
  }

  async function uploadBitmap() {
    if (videoElement && isCapturing && glSystem.hasOutgoingVideoConnections(nodeId)) {
      // Get video dimensions
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;

      // Check if we need to resize (if video is larger than our max dimensions)
      if (videoWidth > MAX_UPLOAD_WIDTH || videoHeight > MAX_UPLOAD_HEIGHT) {
        // Calculate scale to fit within max dimensions while preserving aspect ratio
        const scale = Math.min(MAX_UPLOAD_WIDTH / videoWidth, MAX_UPLOAD_HEIGHT / videoHeight);
        const scaledWidth = Math.round(videoWidth * scale);
        const scaledHeight = Math.round(videoHeight * scale);

        // Create or resize offscreen canvas if needed
        if (
          !resizerCanvas ||
          resizerCanvas.width !== scaledWidth ||
          resizerCanvas.height !== scaledHeight
        ) {
          resizerCanvas = new OffscreenCanvas(scaledWidth, scaledHeight);
          resizerCtx = resizerCanvas.getContext('2d');
        }

        if (resizerCtx) {
          // Draw scaled video frame to offscreen canvas
          resizerCtx.drawImage(videoElement, 0, 0, scaledWidth, scaledHeight);

          // Create flipped ImageBitmap from the scaled canvas and upload
          const bitmap = await createImageBitmap(resizerCanvas);
          await glSystem.setBitmap(nodeId, bitmap);
        }
      } else {
        // Video is already small enough, upload directly
        await glSystem.setBitmapSource(nodeId, videoElement);
      }
    }

    if (isCapturing) {
      bitmapFrameId = requestAnimationFrame(uploadBitmap);
    }
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    glSystem.upsertNode(nodeId, 'img', {});
  });

  onDestroy(() => {
    stopCapture();
    glSystem.removeNode(nodeId);
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
  });

  const handleCommonClass = $derived.by(() => {
    if (!selected && $shouldShowHandles) {
      return 'z-1';
    }

    return `z-1 ${selected ? '' : 'opacity-40'}`;
  });
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>
        <div class="flex gap-1">
          {#if isCapturing}
            <button
              title="Stop screen capture"
              class="rounded p-1 opacity-100 transition-opacity hover:bg-zinc-700"
              onclick={stopCapture}
            >
              <Square class="h-4 w-4 text-red-500" />
            </button>
          {:else}
            <button
              title="Start screen capture"
              class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={startCapture}
            >
              <Monitor class="h-4 w-4 text-zinc-300" />
            </button>
          {/if}
        </div>
      </div>

      <div class="relative">
        <StandardHandle
          port="inlet"
          type="message"
          total={1}
          index={0}
          class={handleCommonClass}
          {nodeId}
        />

        <div
          class={`rounded-lg border-1 ${selected ? 'object-container-selected' : 'object-container'}`}
        >
          <video
            bind:this={videoElement}
            class="h-32 w-48 rounded object-cover {isCapturing ? '' : 'hidden'}"
            muted
            autoplay
            playsinline
          ></video>
          {#if !isCapturing}
            <div class="flex h-32 w-48 items-center justify-center">
              <div class="flex flex-col items-center gap-2">
                <Monitor class="h-8 w-8 text-zinc-400" />
                <div class="text-xs text-zinc-400">Screen Capture</div>
                {#if errorMessage}
                  <div class="text-xs text-red-400">{errorMessage}</div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <StandardHandle
          port="outlet"
          type="video"
          id="0"
          title="Video output"
          total={1}
          index={0}
          class={handleCommonClass}
          {nodeId}
        />
      </div>
    </div>
  </div>
</div>
