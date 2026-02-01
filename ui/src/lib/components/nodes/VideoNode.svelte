<script lang="ts">
  import { Loader, OctagonX, Pause, Play, SkipBack, Upload, Video } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { match, P } from 'ts-pattern';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import { webCodecsEnabled, showVideoStats } from '../../../stores/video.store';
  import { useVfsMedia } from '$lib/vfs';
  import { VfsRelinkOverlay, VfsDropZone } from '$lib/vfs/components';
  import { VideoProfiler, type VideoStats } from '$lib/video';
  import type {
    MediaBunnyMetadataEvent,
    MediaBunnyFirstFrameEvent,
    MediaBunnyEndedEvent,
    MediaBunnyErrorEvent,
    MediaBunnyTimeUpdateEvent
  } from '$lib/eventbus/events';

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
    selected,
    width: nodeWidth,
    height: nodeHeight
  }: {
    id: string;
    data: {
      vfsPath?: string;
      fileName?: string;
      width?: number;
      height?: number;
      loop?: boolean;
    };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNode } = useSvelteFlow();

  let glSystem = GLSystem.getInstance();
  let messageContext: MessageContext;
  let audioService = AudioService.getInstance();

  let videoElement = $state<HTMLVideoElement | undefined>();
  let isVideoLoaded = $state(false);
  let isPaused = $state(true);
  let errorMessage = $state<string | null>(null);
  let bitmapFrameId: number | undefined;
  let videoFrameCallbackId: number | undefined;
  let useVideoFrameCallback = false;
  let lastRecordedMediaTime = -1;

  let resizerCanvas: OffscreenCanvas | null = null;
  let resizerCtx: OffscreenCanvasRenderingContext2D | null = null;

  // MediaBunny player runs in render worker for zero main thread blocking
  let currentFile: File | null = null;
  let currentSourceUrl: string | undefined = undefined; // For URL streaming
  let webCodecsFirstFrameReceived = $state(false);
  let webCodecsTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let workerCurrentTime = 0; // Track time from worker for profiling

  // Canvas preview
  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewBitmapContext: ImageBitmapRenderingContext | null = null;

  // How long to wait for first WebCodecs frame before falling back (ms)
  const WEBCODECS_TIMEOUT_MS = 5000;

  // Video profiling
  let profiler: VideoProfiler | null = null;
  let videoStats = $state<VideoStats | null>(null);
  let statsIntervalId: ReturnType<typeof setInterval> | null = null;

  const [defaultPreviewWidth, defaultPreviewHeight] = glSystem.previewSize;
  const [MAX_UPLOAD_WIDTH, MAX_UPLOAD_HEIGHT] = glSystem.outputSize;

  // Initialize bitmaprenderer context when canvas is bound
  $effect(() => {
    if (previewCanvas && !previewBitmapContext) {
      previewBitmapContext = previewCanvas.getContext('bitmaprenderer');

      if (previewBitmapContext) {
        glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
      }
    }
  });

  // Use VFS media composable for file handling
  const vfsMedia = useVfsMedia({
    nodeId,
    acceptMimePrefix: 'video/',
    onFileLoaded: handleFileLoaded,
    updateNodeData: (newData) => updateNode(nodeId, { data: { ...data, ...newData } }),
    getVfsPath: () => data.vfsPath,
    filePickerAccept: ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
    filePickerDescription: 'Video Files'
  });

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with({ type: 'bang' }, () => restartVideo())
      .with({ type: 'pause' }, () => togglePause())
      .with({ type: 'loop', value: P.optional(P.boolean) }, ({ value }) => {
        const shouldLoop = value ?? true;

        updateNode(nodeId, { data: { ...data, loop: shouldLoop } });

        if (videoElement) {
          videoElement.loop = shouldLoop;
        }

        // Update worker MediaBunny player loop setting
        glSystem.mediaBunnySetLoop(nodeId, shouldLoop);
      })
      .with(P.string, (path) => vfsMedia.loadFromPath(path))
      .with({ type: 'load', url: P.string }, ({ url }) => vfsMedia.loadFromUrl(url))
      .with({ type: 'load', path: P.string }, ({ path }) => vfsMedia.loadFromPath(path))
      .otherwise(() => {});
  };

  /**
   * Called when VFS successfully loads a file.
   * Sets up the video element and updates node data.
   */
  async function handleFileLoaded(file: File, sourceUrl?: string) {
    try {
      if (!videoElement) {
        errorMessage = 'Video element not ready';
        return;
      }

      currentFile = file;
      currentSourceUrl = sourceUrl; // Store for MediaBunny streaming

      const objectUrl = URL.createObjectURL(file);

      videoElement.onloadedmetadata = () => {
        if (videoElement) {
          const videoWidth = videoElement.videoWidth;
          const videoHeight = videoElement.videoHeight;

          // Scale down for preview while maintaining aspect ratio
          const aspectRatio = videoWidth / videoHeight;

          let previewWidth = defaultPreviewWidth;
          let previewHeight = defaultPreviewWidth / aspectRatio;

          if (previewHeight > defaultPreviewHeight) {
            previewHeight = defaultPreviewHeight;
            previewWidth = defaultPreviewHeight * aspectRatio;
          }

          updateNode(nodeId, {
            width: Math.round(previewWidth),
            height: Math.round(previewHeight),
            data: {
              ...data,
              fileName: file.name,
              width: videoWidth,
              height: videoHeight
            }
          });

          isVideoLoaded = true;
          isPaused = true;
          errorMessage = null;

          // Send file to audio system
          audioService.send(nodeId, 'file', file);

          vfsMedia.markLoaded();

          // Initialize profiler
          if (!profiler) {
            profiler = new VideoProfiler(nodeId);
          }

          profiler.reset();
          lastRecordedMediaTime = -1;

          profiler.setMetadata({
            width: videoWidth,
            height: videoHeight,

            // HTMLVideoElement doesn't expose frameRate directly, estimate from common values
            frameRate: 30
          });

          // Use MediaBunny for frame extraction when supported and enabled
          // Check WebCodecs support directly (avoid importing MediaBunnyPlayer to main thread)
          const webCodecsSupported =
            typeof VideoDecoder !== 'undefined' && typeof VideoFrame !== 'undefined';

          if ($webCodecsEnabled && webCodecsSupported) {
            profiler.setPipeline('webcodecs');
            initMediaBunnyPlayer(file, currentSourceUrl);
          } else {
            // Fallback to HTMLVideoElement frame extraction (Firefox or disabled)
            profiler.setPipeline('fallback');
            startFallbackFrameLoop();
          }
        }
      };

      videoElement.onerror = () => {
        errorMessage = 'Failed to load video file';
        isVideoLoaded = false;
      };

      videoElement.src = objectUrl;
      videoElement.load();
    } catch (error) {
      console.error('Failed to load video:', error);

      errorMessage = 'Failed to load video file';
      isVideoLoaded = false;
    }
  }

  /**
   * Fall back from MediaBunny to HTMLVideoElement frame extraction.
   * Called when MediaBunny fails, times out, or encounters an error.
   */
  function fallbackToHTMLVideo(reason: string) {
    console.warn(`[VideoNode] Falling back to HTMLVideoElement: ${reason}`);

    // Clean up worker MediaBunny player
    glSystem.destroyMediaBunnyPlayer(nodeId);

    // Clear timeout if pending
    if (webCodecsTimeoutId !== null) {
      clearTimeout(webCodecsTimeoutId);
      webCodecsTimeoutId = null;
    }

    // Reset state
    webCodecsFirstFrameReceived = false;

    // Disable preview - HTMLVideoElement is visible directly
    glSystem.setPreviewEnabled(nodeId, false);

    // Update profiler to show we're using fallback
    profiler?.setPipeline('fallback');

    // Resume HTMLVideoElement for display if video was playing
    if (videoElement && !isPaused) {
      videoElement.play();
    }

    // Start the HTMLVideoElement frame loop (only if not already running)
    if (!bitmapFrameId && !videoFrameCallbackId) {
      startFallbackFrameLoop();
    }
  }

  /**
   * Initialize MediaBunnyPlayer in the render worker.
   * Sets up a timeout to fall back to HTMLVideoElement if no frames are received.
   * @param file - The video file (used for fallback and HTMLVideoElement)
   * @param sourceUrl - If provided, stream directly from URL instead of loading file blob
   */
  function initMediaBunnyPlayer(file: File, sourceUrl?: string) {
    // Reset state
    webCodecsFirstFrameReceived = false;

    // Set timeout for first frame - if we don't get a frame within WEBCODECS_TIMEOUT_MS, fall back
    if (webCodecsTimeoutId !== null) {
      clearTimeout(webCodecsTimeoutId);
    }
    webCodecsTimeoutId = setTimeout(() => {
      if (!webCodecsFirstFrameReceived) {
        fallbackToHTMLVideo(`No frames received within ${WEBCODECS_TIMEOUT_MS}ms`);
      }

      webCodecsTimeoutId = null;
    }, WEBCODECS_TIMEOUT_MS);

    // Initialize MediaBunny in render worker (no main thread blocking)
    initWorkerMediaBunny(file, sourceUrl);
  }

  /**
   * Initialize MediaBunny in render worker (new, non-blocking approach).
   */
  function initWorkerMediaBunny(file: File, sourceUrl?: string) {
    // Clean up existing player
    glSystem.destroyMediaBunnyPlayer(nodeId);

    // Create player in worker
    glSystem.createMediaBunnyPlayer(nodeId);

    // Enable preview - frames will be sent to bitmaprenderer context
    glSystem.setPreviewEnabled(nodeId, true);

    // Load file or URL
    if (sourceUrl) {
      glSystem.loadMediaBunnyUrl(nodeId, sourceUrl);
    } else {
      glSystem.loadMediaBunnyFile(nodeId, file);
    }

    // Set loop mode
    glSystem.mediaBunnySetLoop(nodeId, data.loop ?? true);
  }

  async function restartVideo() {
    if (!isVideoLoaded) return;

    // Get current time from appropriate source
    const currentTime = workerCurrentTime || videoElement?.currentTime || 0;
    profiler?.markPlaybackStop(currentTime);

    lastRecordedMediaTime = -1;

    // Send bang to audio system to restart audio (sets currentTime to 0 and plays)
    audioService.send(nodeId, 'message', { type: 'bang' });

    // Restart based on current mode
    if (webCodecsFirstFrameReceived) {
      // Worker MediaBunny mode - use atomic restart
      glSystem.mediaBunnyRestart(nodeId);
      isPaused = false;
    } else if (videoElement) {
      // Fallback mode - use HTMLVideoElement
      videoElement.currentTime = 0;

      if (isPaused) {
        videoElement.play();
        isPaused = false;
      }
    }

    // Start new playback tracking from beginning
    profiler?.markPlaybackStart(0);
  }

  function togglePause() {
    if (!isVideoLoaded) return;

    // Get current time from appropriate source
    const currentTime = workerCurrentTime || videoElement?.currentTime || 0;

    if (isPaused) {
      audioService.send(nodeId, 'message', { type: 'play' });

      if (webCodecsFirstFrameReceived) {
        // Worker MediaBunny mode
        glSystem.mediaBunnyPlay(nodeId);
      } else if (videoElement) {
        // Fallback mode - control HTMLVideoElement
        videoElement.play();
      }

      // Mark playback start for accurate drop detection
      profiler?.markPlaybackStart(currentTime);

      isPaused = false;
    } else {
      // Mark playback stop before pausing (calculates drops)
      profiler?.markPlaybackStop(currentTime);

      audioService.send(nodeId, 'message', { type: 'pause' });

      if (webCodecsFirstFrameReceived) {
        // Worker MediaBunny mode
        glSystem.mediaBunnyPause(nodeId);
      } else if (videoElement) {
        // Fallback mode - control HTMLVideoElement
        videoElement.pause();
      }

      isPaused = true;
    }
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
        handleVideoFrame
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

  /**
   * Handle video frame callback - called when a new video frame is presented.
   * This is more efficient than requestAnimationFrame as it syncs with actual video frames.
   */
  async function handleVideoFrame(_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) {
    if (!videoElement || !isVideoLoaded) return;

    // Only record when mediaTime actually changes (deduplicate same-frame callbacks)
    if (metadata.mediaTime !== lastRecordedMediaTime) {
      lastRecordedMediaTime = metadata.mediaTime;
      profiler?.recordFrame(metadata.mediaTime * 1_000_000, metadata.mediaTime);

      // Calculate actual frame rate from metadata (presentedFrames / mediaTime)
      if (metadata.mediaTime > 0.5 && metadata.presentedFrames > 10) {
        const calculatedFps = Math.round(metadata.presentedFrames / metadata.mediaTime);

        profiler?.setMetadata({ frameRate: calculatedFps });
      }
    }

    // Only upload to GL when there are connections and video is playing
    if (!isPaused && glSystem.hasOutgoingVideoConnections(nodeId)) {
      await uploadVideoFrame();
    }

    // Schedule next frame callback
    if (isVideoLoaded) {
      videoFrameCallbackId = (videoElement as HTMLVideoElementWithRVFC).requestVideoFrameCallback(
        handleVideoFrame
      );
    }
  }

  /**
   * Fallback frame handler using requestAnimationFrame.
   * Less efficient as it runs at display refresh rate rather than video frame rate.
   */
  async function uploadBitmapRAF() {
    const videoReady =
      videoElement && videoElement.readyState >= 2 && !videoElement.ended && !videoElement.error;

    // Track frames for profiling - only when currentTime changes (deduplicate)
    if (videoElement && videoReady && isVideoLoaded && !isPaused) {
      const currentMediaTime = videoElement.currentTime;

      if (currentMediaTime !== lastRecordedMediaTime) {
        lastRecordedMediaTime = currentMediaTime;

        profiler?.recordFrame(currentMediaTime * 1_000_000, currentMediaTime);
      }
    }

    // Only upload to GL when there are connections
    if (
      videoElement &&
      videoReady &&
      isVideoLoaded &&
      !isPaused &&
      glSystem.hasOutgoingVideoConnections(nodeId)
    ) {
      await uploadVideoFrame();
    }

    if (isVideoLoaded) {
      bitmapFrameId = requestAnimationFrame(uploadBitmapRAF);
    }
  }

  /**
   * Upload current video frame to the GL system.
   * Shared between requestVideoFrameCallback and requestAnimationFrame paths.
   */
  async function uploadVideoFrame() {
    if (!videoElement) return;

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
        resizerCtx.drawImage(videoElement, 0, 0, scaledWidth, scaledHeight);

        // Create flipped ImageBitmap to match pipeline orientation
        const bitmap = await createImageBitmap(resizerCanvas, { imageOrientation: 'flipY' });
        await glSystem.setPreflippedBitmap(nodeId, bitmap);
      }
    } else {
      // Video is already small enough, upload directly
      await glSystem.setBitmapSource(nodeId, videoElement);
    }
  }

  // Event handlers for worker MediaBunny
  function handleWorkerMetadata(event: MediaBunnyMetadataEvent) {
    if (event.nodeId !== nodeId) return;

    // Cancel timeout - metadata means successful load
    if (webCodecsTimeoutId !== null) {
      clearTimeout(webCodecsTimeoutId);
      webCodecsTimeoutId = null;
    }

    webCodecsFirstFrameReceived = true;

    // Update profiler with actual video metadata
    profiler?.setMetadata({
      frameRate: event.metadata.frameRate,
      duration: event.metadata.duration,
      width: event.metadata.width,
      height: event.metadata.height,
      codec: event.metadata.codec
    });
  }

  function handleWorkerFirstFrame(event: MediaBunnyFirstFrameEvent) {
    if (event.nodeId !== nodeId) return;

    // Cancel timeout
    if (!webCodecsFirstFrameReceived) {
      webCodecsFirstFrameReceived = true;

      if (webCodecsTimeoutId !== null) {
        clearTimeout(webCodecsTimeoutId);
        webCodecsTimeoutId = null;
      }
    }
  }

  function handleWorkerEnded(event: MediaBunnyEndedEvent) {
    if (event.nodeId !== nodeId) return;

    // Mark playback stop
    if (videoElement) {
      profiler?.markPlaybackStop(videoElement.currentTime);
    }

    isPaused = true;

    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  }

  function handleWorkerError(event: MediaBunnyErrorEvent) {
    if (event.nodeId !== nodeId) return;

    fallbackToHTMLVideo(`Worker MediaBunny error: ${event.error}`);
  }

  function handleWorkerTimeUpdate(event: MediaBunnyTimeUpdateEvent) {
    if (event.nodeId !== nodeId) return;

    workerCurrentTime = event.currentTime;
  }

  onMount(async () => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    glSystem.upsertNode(nodeId, 'img', {});

    // Create audio object for video
    audioService.createNode(nodeId, 'soundfile~', []);

    // Initialize profiler
    profiler = new VideoProfiler(nodeId);

    // Listen for worker MediaBunny events
    glSystem.eventBus.addEventListener('mediaBunnyMetadata', handleWorkerMetadata);
    glSystem.eventBus.addEventListener('mediaBunnyFirstFrame', handleWorkerFirstFrame);
    glSystem.eventBus.addEventListener('mediaBunnyEnded', handleWorkerEnded);
    glSystem.eventBus.addEventListener('mediaBunnyError', handleWorkerError);
    glSystem.eventBus.addEventListener('mediaBunnyTimeUpdate', handleWorkerTimeUpdate);

    // Update stats periodically when visible
    statsIntervalId = setInterval(() => {
      if ($showVideoStats && profiler) {
        videoStats = profiler.getStats();
      }
    }, 200);

    // If we have a VFS path, try to load from it
    if (data.vfsPath) {
      await vfsMedia.loadFromVfsPath(data.vfsPath);
    }
  });

  onDestroy(() => {
    // Clean up frame loop (handles both requestVideoFrameCallback and requestAnimationFrame)
    stopFallbackFrameLoop();

    // Clean up WebCodecs timeout
    if (webCodecsTimeoutId !== null) {
      clearTimeout(webCodecsTimeoutId);
      webCodecsTimeoutId = null;
    }

    // Clean up stats interval
    if (statsIntervalId) {
      clearInterval(statsIntervalId);
      statsIntervalId = null;
    }

    // Clean up worker MediaBunny player
    glSystem.destroyMediaBunnyPlayer(nodeId);

    // Remove worker event listeners
    glSystem.eventBus.removeEventListener('mediaBunnyMetadata', handleWorkerMetadata);
    glSystem.eventBus.removeEventListener('mediaBunnyFirstFrame', handleWorkerFirstFrame);
    glSystem.eventBus.removeEventListener('mediaBunnyEnded', handleWorkerEnded);
    glSystem.eventBus.removeEventListener('mediaBunnyError', handleWorkerError);
    glSystem.eventBus.removeEventListener('mediaBunnyTimeUpdate', handleWorkerTimeUpdate);

    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();

    glSystem.removeNode(nodeId);

    audioService.removeNodeById(nodeId);
  });

  const handleCommonClass = $derived.by(() => {
    if (!selected && $shouldShowHandles) {
      return 'z-1 transition-opacity';
    }

    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });
</script>

<div class="relative">
  <NodeResizer class="z-1" isVisible={selected} keepAspectRatio />

  {#if selected}
    <div class="absolute -top-7 z-10 w-fit rounded-lg bg-zinc-900 px-2 py-1">
      <div class="font-mono text-xs font-medium text-zinc-400">video</div>
    </div>
  {/if}

  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>
        <div class="flex gap-1">
          {#if isVideoLoaded}
            <button
              title={isPaused ? 'Play video' : 'Pause video'}
              class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={togglePause}
            >
              <svelte:component this={isPaused ? Play : Pause} class="h-4 w-4 text-zinc-300" />
            </button>
            <button
              title="Restart video"
              class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={restartVideo}
            >
              <SkipBack class="h-4 w-4 text-zinc-300" />
            </button>
            <button
              title="Change video"
              class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={vfsMedia.openFileDialog}
            >
              <Upload class="h-4 w-4 text-zinc-300" />
            </button>
          {/if}
        </div>
      </div>

      <div class="relative">
        <StandardHandle
          port="inlet"
          type="message"
          class={handleCommonClass}
          total={1}
          index={0}
          {nodeId}
        />

        <div
          class={`rounded-lg border-1 ${selected ? 'shadow-glow-md border-zinc-400' : 'hover:shadow-glow-sm'}`}
        >
          {#if !errorMessage}
            <div class="relative">
              <!-- Canvas preview when MediaBunny is active (worker sends frames via bitmaprenderer) -->
              <canvas
                bind:this={previewCanvas}
                width={data.width || defaultPreviewWidth}
                height={data.height || defaultPreviewHeight}
                class="rounded-lg {vfsMedia.hasVfsPath &&
                isVideoLoaded &&
                webCodecsFirstFrameReceived
                  ? ''
                  : 'hidden'}"
                style="width: {nodeWidth || defaultPreviewWidth}px; height: {nodeHeight ||
                  defaultPreviewHeight}px"
                ondragover={vfsMedia.handleDragOver}
                ondragleave={vfsMedia.handleDragLeave}
                ondrop={vfsMedia.handleDrop}
              ></canvas>

              <!-- Video element for fallback (when MediaBunny not active) -->
              <video
                bind:this={videoElement}
                class="rounded-lg object-cover {vfsMedia.hasVfsPath &&
                isVideoLoaded &&
                !webCodecsFirstFrameReceived
                  ? ''
                  : 'hidden'}"
                style="width: {nodeWidth || defaultPreviewWidth}px; height: {nodeHeight ||
                  defaultPreviewHeight}px"
                muted
                loop={data.loop ?? true}
                ondragover={vfsMedia.handleDragOver}
                ondragleave={vfsMedia.handleDragLeave}
                ondrop={vfsMedia.handleDrop}
              ></video>

              <!-- Video stats overlay -->
              {#if $showVideoStats && videoStats && isVideoLoaded}
                <div
                  class="pointer-events-none absolute top-1 left-1 rounded bg-black/70 px-1.5 py-1 font-mono text-[10px] leading-tight text-white"
                >
                  <div
                    class="font-bold {videoStats.pipeline === 'webcodecs'
                      ? 'text-green-400'
                      : 'text-yellow-400'}"
                  >
                    {videoStats.pipeline === 'webcodecs' ? 'MEDIABUNNY' : 'FALLBACK'}
                  </div>
                  <div>{videoStats.fps}/{Math.round(videoStats.targetFps)} FPS</div>
                  <div>Dropped: {videoStats.droppedFrames}</div>
                  <div>{videoStats.width}x{videoStats.height}</div>
                  {#if videoStats.codec !== 'unknown'}
                    <div class="text-zinc-400">{videoStats.codec}</div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}

          {#if vfsMedia.needsFolderRelink || vfsMedia.needsReselect}
            <VfsRelinkOverlay
              needsReselect={vfsMedia.needsReselect}
              needsFolderRelink={vfsMedia.needsFolderRelink}
              linkedFolderName={vfsMedia.linkedFolderName}
              vfsPath={data.vfsPath}
              width={nodeWidth ?? defaultPreviewWidth}
              height={nodeHeight ?? defaultPreviewHeight}
              isDragging={vfsMedia.isDragging}
              onRequestPermission={vfsMedia.requestFilePermission}
              onDragOver={vfsMedia.handleDragOver}
              onDragLeave={vfsMedia.handleDragLeave}
              onDrop={vfsMedia.handleDrop}
            />
          {:else if (vfsMedia.hasVfsPath && !isVideoLoaded) || errorMessage}
            <div
              class="flex flex-col items-center justify-center gap-2 rounded-lg border-1 px-1 py-3
							{vfsMedia.isDragging
                ? 'border-blue-400 bg-blue-50/10'
                : 'border-dashed border-zinc-600 bg-zinc-900'}"
              style="width: {nodeWidth ?? defaultPreviewWidth}px; height: {nodeHeight ??
                defaultPreviewHeight}px"
            >
              <svelte:component
                this={errorMessage ? OctagonX : Loader}
                class={[
                  'h-8 w-8 text-zinc-400',
                  !errorMessage ? 'animate-spin' : 'text-red-400'
                ].join(' ')}
              />

              <div class="px-2 text-center font-mono text-[12px] text-zinc-400">
                {#if errorMessage}
                  <div class="text-xs text-red-400">{errorMessage}</div>
                {:else}
                  <div>loading video file...</div>
                {/if}
              </div>
            </div>
          {:else if !vfsMedia.hasVfsPath}
            <VfsDropZone
              icon={Video}
              fileType="video"
              width={nodeWidth ?? defaultPreviewWidth}
              height={nodeHeight ?? defaultPreviewHeight}
              isDragging={vfsMedia.isDragging}
              onDoubleClick={vfsMedia.openFileDialog}
              onDragOver={vfsMedia.handleDragOver}
              onDragLeave={vfsMedia.handleDragLeave}
              onDrop={vfsMedia.handleDrop}
            />
          {/if}
        </div>

        <StandardHandle
          port="outlet"
          type="video"
          id="0"
          title="Video output"
          total={2}
          index={0}
          class={handleCommonClass}
          {nodeId}
        />

        <StandardHandle
          port="outlet"
          type="audio"
          title="Audio output"
          total={2}
          index={1}
          class={handleCommonClass}
          {nodeId}
        />
      </div>
    </div>
  </div>
</div>

<!-- Hidden file input -->
<input
  bind:this={vfsMedia.fileInputRef}
  type="file"
  accept="video/*"
  onchange={vfsMedia.handleFileSelect}
  class="hidden"
/>
