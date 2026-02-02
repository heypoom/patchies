<script lang="ts">
  import { Camera, Pause, Play, Square } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import { webCodecsWebcamEnabled, showVideoStats } from '../../../stores/video.store';
  import { WebCodecsCapture, VideoProfiler, type VideoStats } from '$lib/video';

  // Type definitions for requestVideoFrameCallback (not yet in all TypeScript libs)
  interface VideoFrameCallbackMetadata {
    presentationTime: DOMHighResTimeStamp;
    expectedDisplayTime: DOMHighResTimeStamp;
    width: number;
    height: number;
    mediaTime: number;
    presentedFrames: number;
    processingDuration?: number;
    captureTime?: DOMHighResTimeStamp;
    receiveTime?: DOMHighResTimeStamp;
    rtpTimestamp?: number;
  }

  interface HTMLVideoElementWithRVFC extends HTMLVideoElement {
    requestVideoFrameCallback(callback: VideoFrameRequestCallback): number;
    cancelVideoFrameCallback(handle: number): void;
  }

  type VideoFrameRequestCallback = (
    now: DOMHighResTimeStamp,
    metadata: VideoFrameCallbackMetadata
  ) => void;

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { width?: number; height?: number };
    selected: boolean;
  } = $props();

  let glSystem = GLSystem.getInstance();
  let messageContext: MessageContext;
  const { updateNodeData } = useSvelteFlow();
  let videoElement = $state<HTMLVideoElement | undefined>();
  let isCapturing = $state(false);
  let isPaused = $state(false);
  let errorMessage = $state<string | null>(null);
  let bitmapFrameId: number | undefined;
  let videoFrameCallbackId: number | undefined;
  let useVideoFrameCallback = false;

  // WebCodecs support - use when available and enabled
  let webCodecsCapture: WebCodecsCapture | null = null;

  // Track which pipeline is currently in use (set on capture start)
  let currentPipeline = $state<'webcodecs' | 'fallback'>('fallback');

  // Video profiling
  let profiler: VideoProfiler | null = null;
  let videoStats = $state<VideoStats | null>(null);
  let statsIntervalId: ReturnType<typeof setInterval> | null = null;

  const [defaultOutputWidth, defaultOutputHeight] = glSystem.outputSize;
  const [defaultPreviewWidth, defaultPreviewHeight] = glSystem.previewSize;

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with({ type: 'bang' }, () => startCapture())
      .with({ type: 'pause' }, () => togglePause())
      .with({ type: 'size', width: P.number, height: P.number }, ({ width, height }) => {
        updateNodeData(nodeId, { width, height });
      })
      .otherwise(() => {});
  };

  async function startCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: data.width ?? defaultOutputWidth },
          height: { ideal: data.height ?? defaultOutputHeight }
        },
        audio: false
      });

      // Get actual video dimensions from the track
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const actualWidth = settings.width ?? defaultOutputWidth;
      const actualHeight = settings.height ?? defaultOutputHeight;
      const actualFrameRate = settings.frameRate ?? 30;

      // Reset profiler
      profiler?.reset();
      profiler?.setMetadata({
        width: actualWidth,
        height: actualHeight,
        frameRate: actualFrameRate
      });

      if ($webCodecsWebcamEnabled) {
        // Use WebCodecs path for better performance
        currentPipeline = 'webcodecs';
        profiler?.setPipeline('webcodecs');

        webCodecsCapture = new WebCodecsCapture({
          nodeId,
          onFrame: (bitmap) => {
            // Track frame for profiling (use performance.now as timestamp)
            profiler?.recordFrame(performance.now() * 1000);

            if (glSystem.hasOutgoingVideoConnections(nodeId)) {
              // Transfer bitmap to render worker (ownership transferred, worker will close it)
              glSystem.setBitmap(nodeId, bitmap);
            } else {
              // No connections - close bitmap immediately to prevent memory leak
              bitmap.close();
            }
          },
          onError: (err) => {
            errorMessage = err.message;
          }
        });

        await webCodecsCapture.start(stream);

        isCapturing = true;
        errorMessage = null;

        // Still show preview in the video element
        if (videoElement) {
          videoElement.srcObject = stream;

          await videoElement.play();
        }
      } else {
        // Fallback to HTMLVideoElement path (Firefox or disabled)
        currentPipeline = 'fallback';
        profiler?.setPipeline('fallback');

        if (videoElement) {
          videoElement.srcObject = stream;

          await videoElement.play();

          isCapturing = true;
          errorMessage = null;

          // Start the fallback frame loop
          startFallbackFrameLoop();

          // Handle stream ending
          stream.getVideoTracks()[0].onended = () => {
            stopCapture();
          };
        }
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to access webcam';
      isCapturing = false;
    }
  }

  async function stopCapture() {
    // Stop WebCodecs capture if active
    if (webCodecsCapture) {
      webCodecsCapture.stop();
      webCodecsCapture = null;
    }

    if (videoElement?.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }

    isCapturing = false;
    stopFallbackFrameLoop();
  }

  /**
   * Start the fallback frame loop using requestVideoFrameCallback when available,
   * falling back to requestAnimationFrame for browsers that don't support it.
   */
  function startFallbackFrameLoop() {
    // Check if requestVideoFrameCallback is supported
    if (videoElement && 'requestVideoFrameCallback' in videoElement) {
      useVideoFrameCallback = true;

      videoFrameCallbackId = (videoElement as HTMLVideoElementWithRVFC).requestVideoFrameCallback(
        handleFallbackVideoFrame
      );
    } else {
      // Fallback to requestAnimationFrame (older browsers than baseline 2024)
      useVideoFrameCallback = false;
      bitmapFrameId = requestAnimationFrame(uploadBitmapRAF);
    }
  }

  /**
   * Stop the fallback frame loop.
   */
  function stopFallbackFrameLoop() {
    if (useVideoFrameCallback && videoFrameCallbackId !== undefined && videoElement) {
      (videoElement as HTMLVideoElementWithRVFC).cancelVideoFrameCallback(videoFrameCallbackId);
      videoFrameCallbackId = undefined;
    }

    if (bitmapFrameId !== undefined) {
      cancelAnimationFrame(bitmapFrameId);
      bitmapFrameId = undefined;
    }
  }

  function togglePause() {
    if (!isCapturing) return;

    isPaused = !isPaused;

    // Handle WebCodecs pause/resume
    if (webCodecsCapture) {
      if (isPaused) {
        webCodecsCapture.pause();
      } else {
        webCodecsCapture.resume();
      }
    }

    if (videoElement) {
      if (isPaused) {
        videoElement.pause();
      } else {
        videoElement.play();
      }
    }
  }

  /**
   * Handle video frame callback - called when a new video frame is presented.
   * This is more efficient than requestAnimationFrame as it syncs with actual video frames.
   */
  async function handleFallbackVideoFrame(
    _now: DOMHighResTimeStamp,
    metadata: VideoFrameCallbackMetadata
  ) {
    if (!videoElement || !isCapturing) return;

    // Track frames for profiling using mediaTime
    if (!isPaused) {
      profiler?.recordFrame(metadata.mediaTime * 1_000_000, metadata.mediaTime);

      // Calculate actual frame rate from metadata (presentedFrames / mediaTime)
      if (metadata.mediaTime > 0.5 && metadata.presentedFrames > 10) {
        const calculatedFps = Math.round(metadata.presentedFrames / metadata.mediaTime);
        profiler?.setMetadata({ frameRate: calculatedFps });
      }
    }

    // Only upload to GL when there are connections and not paused
    if (!isPaused && glSystem.hasOutgoingVideoConnections(nodeId)) {
      glSystem.setBitmapSource(nodeId, videoElement);
    }

    // Schedule next frame callback
    if (isCapturing) {
      videoFrameCallbackId = (videoElement as HTMLVideoElementWithRVFC).requestVideoFrameCallback(
        handleFallbackVideoFrame
      );
    }
  }

  /**
   * Fallback frame handler using requestAnimationFrame.
   * Less efficient as it runs at display refresh rate rather than video frame rate.
   */
  async function uploadBitmapRAF() {
    // Track frames for profiling even without connections (to measure capture rate)
    if (videoElement && isCapturing && !isPaused) {
      profiler?.recordFrame(performance.now() * 1000);
    }

    // Only upload to GL when there are connections
    if (videoElement && isCapturing && !isPaused && glSystem.hasOutgoingVideoConnections(nodeId)) {
      glSystem.setBitmapSource(nodeId, videoElement);
    }

    if (isCapturing) {
      bitmapFrameId = requestAnimationFrame(uploadBitmapRAF);
    }
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    glSystem.upsertNode(nodeId, 'img', {});

    // Initialize profiler
    profiler = new VideoProfiler(nodeId);

    // Update stats periodically when visible
    statsIntervalId = setInterval(() => {
      if ($showVideoStats && profiler) {
        videoStats = profiler.getStats();
      }
    }, 200);
  });

  onDestroy(() => {
    // Clean up stats interval
    if (statsIntervalId) {
      clearInterval(statsIntervalId);
      statsIntervalId = null;
    }

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

  const canvasWidth = $derived(
    data.width ? data.width / PREVIEW_SCALE_FACTOR : defaultPreviewWidth
  );

  const canvasHeight = $derived(
    data.height ? data.height / PREVIEW_SCALE_FACTOR : defaultPreviewHeight
  );
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>
        <div class="flex gap-1">
          {#if isCapturing}
            <button
              title={isPaused ? 'Resume webcam' : 'Pause webcam'}
              class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={togglePause}
            >
              <svelte:component this={isPaused ? Play : Pause} class="h-4 w-4 text-zinc-300" />
            </button>
            <button
              title="Stop webcam"
              class="rounded p-1 opacity-100 transition-opacity hover:bg-zinc-700"
              onclick={stopCapture}
            >
              <Square class="h-4 w-4 text-red-500" />
            </button>
          {:else}
            <button
              title="Start webcam"
              class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={startCapture}
            >
              <Play class="h-4 w-4 text-zinc-300" />
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
          <div class="relative">
            <video
              bind:this={videoElement}
              class="rounded object-cover {isCapturing ? '' : 'hidden'}"
              muted
              autoplay
              playsinline
              width={data.width ?? defaultOutputWidth}
              height={data.height ?? defaultOutputHeight}
              style={`width: ${canvasWidth}px; height: ${canvasHeight}px;`}
            ></video>

            <!-- Video stats overlay -->
            {#if $showVideoStats && videoStats && isCapturing}
              <div
                class="pointer-events-none absolute top-1 left-1 rounded bg-black/70 px-1.5 py-1 font-mono text-[10px] leading-tight text-white"
              >
                <div
                  class="font-bold {videoStats.pipeline === 'webcodecs'
                    ? 'text-green-400'
                    : 'text-yellow-400'}"
                >
                  {videoStats.pipeline.toUpperCase()}
                </div>
                <div>{videoStats.fps}/{videoStats.targetFps} FPS</div>
                <div>Dropped: {videoStats.droppedFrames}</div>
                <div>{videoStats.width}x{videoStats.height}</div>
              </div>
            {/if}
          </div>

          {#if !isCapturing}
            <div class="flex h-32 w-48 items-center justify-center">
              <div class="flex flex-col items-center gap-2">
                <Camera class="h-8 w-8 text-zinc-400" />

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
