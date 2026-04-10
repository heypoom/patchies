<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { JSRunner } from '$lib/js-runner/JSRunner';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { SurfaceOverlay } from '$lib/canvas/SurfaceOverlay';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { handleCodeError } from '$lib/js-runner/handleCodeError';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';
  import { CANVAS_DOM_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
  import { profiler } from '$lib/profiler';

  // Error reporting offset reuse (surface is structurally identical to canvas.dom)
  const SURFACE_WRAPPER_OFFSET = CANVAS_DOM_WRAPPER_OFFSET;

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title: string;
      code: string;
      inletCount?: number;
      outletCount?: number;
      hidePorts?: boolean;
      executeCode?: number;
      showConsole?: boolean;
      paused?: boolean;
    };
    selected?: boolean;
  } = $props();

  let consoleRef: VirtualConsole | null = $state(null);
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);

  const eventBus = PatchiesEventBus.getInstance();

  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;
    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  const customConsole = createCustomConsole(nodeId);
  const jsRunner = JSRunner.getInstance();
  const glSystem = GLSystem.getInstance();

  // The inline preview canvas (always in the node, shown in preview mode)
  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewCtx: CanvasRenderingContext2D | null = null;

  let dragEnabled = $state(false);
  let panEnabled = $state(true);
  let wheelEnabled = $state(true);
  let videoOutputEnabled = $state(true);
  let editorReady = $state(false);
  let animationFrameId: number | null = null;
  let pausedCallback: FrameRequestCallback | null = null;

  // Whether the overlay is currently fullscreen
  let isFullscreen = $state(false);

  // Which canvas is currently active (preview inline canvas OR overlay canvas)
  let activeCanvas: HTMLCanvasElement | null = null;
  let activeCtx: CanvasRenderingContext2D | null = null;

  // Thumbnail copy loop frame id
  let thumbnailFrameId: number | null = null;

  // Draw mode: 'always' | 'interact' | 'manual'
  type DrawMode = 'always' | 'interact' | 'manual';
  let drawMode: DrawMode = 'always';

  // User-registered callbacks
  let pointerCallback:
    | ((e: {
        x: number;
        y: number;
        pressure: number;
        buttons: number;
        down: boolean;
        type: string;
      }) => void)
    | null = null;
  let touchCallback:
    | ((touches: { x: number; y: number; pressure: number; id: number }[]) => void)
    | null = null;
  let keyboardCallbacks: {
    onKeyDown?: (event: KeyboardEvent) => void;
    onKeyUp?: (event: KeyboardEvent) => void;
  } = {};

  // Mouse state (normalized 0–1)
  let mouse = $state({ x: 0, y: 0, down: false, buttons: 0 });

  const { updateNodeData, getNodes } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  let inletCount = $derived(data.inletCount ?? 1);
  let outletCount = $derived(data.outletCount ?? 0);
  let previousExecuteCode = $state<number | undefined>(undefined);

  // Canvas dimensions = always window dimensions
  let outputWidth = $state(window.innerWidth);
  let outputHeight = $state(window.innerHeight);
  let previewWidth = $derived(outputWidth / PREVIEW_SCALE_FACTOR);
  let previewHeight = $derived(outputHeight / PREVIEW_SCALE_FACTOR);

  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      runCode();
    }
  });

  const setPortCount = (newInletCount = 1, newOutletCount = 0) => {
    updateNodeData(nodeId, { inletCount: newInletCount, outletCount: newOutletCount });
    updateNodeInternals(nodeId);
  };

  const setCodeAndUpdate = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });
    setTimeout(() => runCode());
  };

  const handleMessage: MessageCallbackFn = (message, _meta) => {
    try {
      match(message)
        .with(messages.setCode, ({ value }) => setCodeAndUpdate(value))
        .with(messages.run, () => runCode())
        .otherwise((msg: unknown) => {
          const m = msg as Record<string, unknown>;
          // bang or { type: 'activate' } → go fullscreen
          if (msg === 'bang' || m?.type === 'activate') {
            enterFullscreen();
          }
          // { type: 'exit' } → exit fullscreen
          if (m?.type === 'exit') {
            exitSurface();
          }
        });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  // ── Pointer helpers ──────────────────────────────────────────────────────

  function normalizePointer(clientX: number, clientY: number, sourceCanvas: HTMLCanvasElement) {
    const rect = sourceCanvas.getBoundingClientRect();
    // Map to normalized 0–1 in fullscreen space
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  }

  function dispatchPointer(x: number, y: number, buttons: number, type: string) {
    const down = buttons > 0;
    mouse.x = x;
    mouse.y = y;
    mouse.buttons = buttons;
    mouse.down = down;

    const event = { x, y, pressure: 0, buttons, down, type };

    // Fire user callback
    if (pointerCallback) {
      try {
        pointerCallback(event);
      } catch (err) {
        handleCodeError(err, data.code, nodeId, customConsole, SURFACE_WRAPPER_OFFSET);
      }
    }

    // Send to pointer outlet (outlet index after video outlet)
    const pointerOutletIdx = videoOutputEnabled ? 1 : 0;
    jsRunner.getMessageContext(nodeId).send(pointerOutletIdx, event);

    if (drawMode === 'interact') {
      triggerDraw();
    }
  }

  function setupPointerListeners(canvas: HTMLCanvasElement): () => void {
    const onPointerMove = (e: PointerEvent) => {
      const { x, y } = normalizePointer(e.clientX, e.clientY, canvas);
      dispatchPointer(x, y, e.buttons, 'move');
    };
    const onPointerDown = (e: PointerEvent) => {
      const { x, y } = normalizePointer(e.clientX, e.clientY, canvas);
      dispatchPointer(x, y, e.buttons || 1, 'down');
    };
    const onPointerUp = (e: PointerEvent) => {
      const { x, y } = normalizePointer(e.clientX, e.clientY, canvas);
      dispatchPointer(x, y, 0, 'up');
    };
    const onPointerLeave = () => {
      mouse.down = false;
      mouse.buttons = 0;
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }

  // ── Draw mode & rAF ──────────────────────────────────────────────────────

  function triggerDraw() {
    if (drawMode !== 'manual') return;
    // In manual mode, redraw() calls here; nothing else needed
    if (pausedCallback) {
      pausedCallback(performance.now());
      sendBitmap();
    }
  }

  // ── Bitmap output ────────────────────────────────────────────────────────

  async function sendBitmap() {
    if (!activeCanvas) return;
    if (!videoOutputEnabled) return;
    if (!glSystem.hasOutgoingVideoConnections(nodeId)) return;
    await glSystem.setBitmapSource(nodeId, activeCanvas);
  }

  // ── Thumbnail copy ───────────────────────────────────────────────────────

  function startThumbnailLoop() {
    if (thumbnailFrameId !== null) return;

    function copyFrame() {
      if (isFullscreen || !previewCanvas || !previewCtx || !activeCanvas) {
        thumbnailFrameId = null;
        return;
      }
      previewCtx.drawImage(activeCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
      thumbnailFrameId = requestAnimationFrame(copyFrame);
    }

    thumbnailFrameId = requestAnimationFrame(copyFrame);
  }

  function stopThumbnailLoop() {
    if (thumbnailFrameId !== null) {
      cancelAnimationFrame(thumbnailFrameId);
      thumbnailFrameId = null;
    }
  }

  // ── Fullscreen activation ────────────────────────────────────────────────

  let cleanupPreviewListeners: (() => void) | null = null;
  let cleanupOverlayListeners: (() => void) | null = null;

  function enterFullscreen() {
    if (isFullscreen) return;
    isFullscreen = true;

    const overlay = SurfaceOverlay.getInstance();
    const nodes = getNodes().map((n) => ({ id: n.id, type: n.type }));

    overlay.activate(nodeId, nodes, () => exitSurface());

    // Switch active canvas to overlay
    activeCanvas = overlay.canvas;
    activeCtx = overlay.ctx;

    // Swap pointer listeners
    cleanupPreviewListeners?.();
    cleanupPreviewListeners = null;
    cleanupOverlayListeners = setupPointerListeners(overlay.canvas);

    // Stop thumbnail loop (XYFlow is hidden anyway)
    stopThumbnailLoop();

    // Re-run code with overlay canvas
    runCode();
  }

  function exitSurface() {
    if (!isFullscreen) return;
    isFullscreen = false;

    SurfaceOverlay.getInstance().deactivate(nodeId);

    // Switch active canvas back to preview
    if (previewCanvas) {
      activeCanvas = previewCanvas;
      activeCtx = previewCtx;
    }

    // Swap pointer listeners
    cleanupOverlayListeners?.();
    cleanupOverlayListeners = null;
    if (previewCanvas) {
      cleanupPreviewListeners = setupPointerListeners(previewCanvas);
    }

    // Re-run code with preview canvas
    runCode();

    // Restart thumbnail loop (now drawing overlay → preview thumbnail)
    startThumbnailLoop();
  }

  // ── Canvas setup ─────────────────────────────────────────────────────────

  function setupPreviewCanvas() {
    if (!previewCanvas) return;

    previewCanvas.width = outputWidth;
    previewCanvas.height = outputHeight;
    previewCanvas.style.width = `${previewWidth}px`;
    previewCanvas.style.height = `${previewHeight}px`;

    previewCtx = previewCanvas.getContext('2d');
    activeCanvas = previewCanvas;
    activeCtx = previewCtx;
  }

  function togglePlayback() {
    if (data.paused) {
      updateNodeData(nodeId, { paused: false });
      if (pausedCallback) {
        animationFrameId = requestAnimationFrame((time) => {
          pausedCallback!(time);
          sendBitmap();
        });
      }
    } else {
      updateNodeData(nodeId, { paused: true });
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
  }

  // ── Code execution ───────────────────────────────────────────────────────

  async function runCode() {
    if (!activeCanvas || !activeCtx) return;

    consoleRef?.clearConsole();
    lineErrors = undefined;

    dragEnabled = false;
    panEnabled = true;
    wheelEnabled = true;
    videoOutputEnabled = true;
    drawMode = 'always';
    pointerCallback = null;
    touchCallback = null;
    keyboardCallbacks = {};

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    const canvas = activeCanvas;
    const ctx = activeCtx;

    try {
      const processedCode = await jsRunner.preprocessCode(data.code, { nodeId });
      if (processedCode === null) return;

      await jsRunner.executeJavaScript(nodeId, processedCode, {
        customConsole,
        setPortCount,
        setTitle: (title: string) => updateNodeData(nodeId, { title }),
        setHidePorts: (hidePorts: boolean) => updateNodeData(nodeId, { hidePorts }),
        extraContext: {
          canvas,
          ctx,
          get width() {
            return outputWidth;
          },
          get height() {
            return outputHeight;
          },
          mouse,

          // Draw mode
          setDrawMode: (mode: DrawMode) => {
            drawMode = mode;
          },
          redraw: () => {
            if (pausedCallback) {
              pausedCallback(performance.now());
              sendBitmap();
            }
          },

          // Surface activation
          activate: () => enterFullscreen(),
          deactivate: () => exitSurface(),

          // Browser fullscreen (separate from surface activation)
          goFullscreen: () => document.documentElement.requestFullscreen?.(),
          exitFullscreen: () => document.exitFullscreen?.(),

          // Interaction callbacks
          onPointer: (cb: typeof pointerCallback) => {
            pointerCallback = cb;
          },
          onTouch: (cb: typeof touchCallback) => {
            touchCallback = cb;
          },
          onKeyDown: (callback: (event: KeyboardEvent) => void) => {
            keyboardCallbacks.onKeyDown = callback;
          },
          onKeyUp: (callback: (event: KeyboardEvent) => void) => {
            keyboardCallbacks.onKeyUp = callback;
          },

          // Interaction flags (for the node itself)
          noDrag: () => {
            dragEnabled = false;
          },
          noPan: () => {
            panEnabled = false;
          },
          noWheel: () => {
            wheelEnabled = false;
          },
          noInteract: () => {
            dragEnabled = false;
            panEnabled = false;
            wheelEnabled = false;
          },
          noOutput: () => {
            videoOutputEnabled = false;
            updateNodeInternals(nodeId);
          },

          // rAF override — respects draw mode and paused state
          requestAnimationFrame: (callback: FrameRequestCallback) => {
            pausedCallback = callback;

            if (data.paused || drawMode === 'manual') {
              return -1;
            }

            animationFrameId = requestAnimationFrame((time) => {
              profiler.measure(nodeId, 'draw', () => {
                callback(time);
                sendBitmap();
              });
            });
            return animationFrameId;
          },
          cancelAnimationFrame: (id: number) => {
            cancelAnimationFrame(id);
            if (animationFrameId === id) animationFrameId = null;
          }
        }
      });
    } catch (error) {
      handleCodeError(error, data.code, nodeId, customConsole, SURFACE_WRAPPER_OFFSET);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  function handleWindowResize() {
    outputWidth = window.innerWidth;
    outputHeight = window.innerHeight;

    // Resize preview canvas to new dimensions
    if (previewCanvas) {
      previewCanvas.width = outputWidth;
      previewCanvas.height = outputHeight;
      previewCanvas.style.width = `${outputWidth / PREVIEW_SCALE_FACTOR}px`;
      previewCanvas.style.height = `${outputHeight / PREVIEW_SCALE_FACTOR}px`;
    }

    // Re-run code so user code sees new width/height
    runCode();
  }

  onMount(() => {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    glSystem.upsertNode(nodeId, 'img', {});

    setupPreviewCanvas();

    if (previewCanvas) {
      cleanupPreviewListeners = setupPointerListeners(previewCanvas);
    }

    window.addEventListener('resize', handleWindowResize);

    setTimeout(() => {
      runCode();
      startThumbnailLoop();
    }, 50);
  });

  onDestroy(() => {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    stopThumbnailLoop();
    cleanupPreviewListeners?.();
    cleanupOverlayListeners?.();

    window.removeEventListener('resize', handleWindowResize);

    // Deactivate overlay if this node was active
    if (isFullscreen) SurfaceOverlay.getInstance().deactivate(nodeId);

    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
    glSystem?.removeNode(nodeId);
    jsRunner.destroy(nodeId);
  });

  const handleClass = $derived.by(() => {
    if (!data.hidePorts) return '';
    if (!selected && $shouldShowHandles) return 'z-1 transition-opacity';
    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });
</script>

<CanvasPreviewLayout
  title={data.title ?? 'surface'}
  objectType="surface"
  {nodeId}
  onrun={runCode}
  onPlaybackToggle={togglePlayback}
  paused={data.paused}
  showPauseButton={true}
  bind:previewCanvas
  nodrag={!dragEnabled}
  nopan={!panEnabled}
  nowheel={!wheelEnabled}
  tabindex={0}
  width={outputWidth}
  height={outputHeight}
  style={`width: ${previewWidth}px; height: ${previewHeight}px;`}
  {selected}
  {editorReady}
  hasError={lineErrors !== undefined}
>
  {#snippet topHandle()}
    <!-- Go Live button -->
    <button
      class="absolute top-1 right-1 z-10 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {isFullscreen
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}"
      onclick={() => (isFullscreen ? exitSurface() : enterFullscreen())}
    >
      {isFullscreen ? 'Exit' : 'Go Live'}
    </button>

    {#each Array.from({ length: inletCount }) as _, index (index)}
      <TypedHandle
        port="inlet"
        spec={{ handleId: index }}
        title={`Inlet ${index}`}
        total={inletCount}
        {index}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet bottomHandle()}
    {#if videoOutputEnabled}
      <TypedHandle
        port="outlet"
        spec={{ handleType: 'video', handleId: '0' }}
        title="Video output"
        total={outletCount + 2}
        index={0}
        class={handleClass}
        {nodeId}
      />
    {/if}

    <!-- pointer outlet -->
    <TypedHandle
      port="outlet"
      spec={{ handleId: videoOutputEnabled ? 1 : 0 }}
      title="Pointer events"
      total={videoOutputEnabled ? outletCount + 2 : outletCount + 1}
      index={videoOutputEnabled ? 1 : 0}
      class={handleClass}
      {nodeId}
    />

    {#each Array.from({ length: outletCount }) as _, index (index)}
      <TypedHandle
        port="outlet"
        spec={{ handleId: index + (videoOutputEnabled ? 2 : 1) }}
        title={`Outlet ${index}`}
        total={videoOutputEnabled ? outletCount + 2 : outletCount + 1}
        index={index + (videoOutputEnabled ? 2 : 1)}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet codeEditor()}
    <CodeEditor
      value={data.code}
      language="javascript"
      nodeType="surface"
      placeholder="Write your surface interaction code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={runCode}
      onchange={(newCode) => {
        updateNodeData(nodeId, { code: newCode });
      }}
      onready={() => (editorReady = true)}
      {lineErrors}
      {nodeId}
    />
  {/snippet}

  {#snippet console()}
    <div class="mt-3 w-full" class:hidden={!data.showConsole}>
      <VirtualConsole
        bind:this={consoleRef}
        {nodeId}
        placeholder="Surface errors will appear here."
        maxHeight="200px"
      />
    </div>
  {/snippet}
</CanvasPreviewLayout>
