<script lang="ts">
  import {
    NodeResizer,
    NodeResizeControl,
    ResizeControlVariant,
    useSvelteFlow,
    useUpdateNodeInternals
  } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { JSRunner } from '$lib/js-runner/JSRunner';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { shouldShowHandles } from '../../stores/ui.store';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { handleCodeError } from '$lib/js-runner/handleCodeError';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent, PrimaryButton } from '$lib/eventbus/events';
  import { useNodeSetPaused } from '$lib/canvas/use-node-set-paused.svelte';
  import { CANVAS_DOM_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
  import { profiler } from '$lib/profiler';
  import { SettingsManager, createSettingsAPI } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import type { SettingsSchema } from '$lib/settings';
  import { resetCanvasSize } from '$objects/dom/runtime-size';
  import { getBorderResetDataForRun } from '$lib/components/border-chrome';
  import { useNodeDataTracker } from '$lib/history';
  import { useFluidCanvas } from './useFluidCanvas.svelte';
  import { SurfaceOverlay } from '$lib/canvas/SurfaceOverlay';
  import { CanvasDomExpandController } from '$lib/canvas/CanvasDomExpandController';
  import { getUserTags } from '$lib/runtime/services/graph-tags';

  let {
    id: nodeId,
    data,
    selected,
    width,
    height
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
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
      noBorder?: boolean;
      fluidCanvasResizerVisible?: boolean;
    };
    selected?: boolean;
    width?: number;
    height?: number;
  } = $props();

  function initialNodeId() {
    return nodeId;
  }

  let consoleRef: VirtualConsole | null = $state(null);

  // Track error line numbers for code highlighting
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);
  const eventBus = PatchiesEventBus.getInstance();

  // Listen for console output events to capture lineErrors
  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    // If this error has lineErrors, update state for code highlighting
    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  // Create custom console for routing output to VirtualConsole
  const customConsole = createCustomConsole(initialNodeId());

  const jsRunner = JSRunner.getInstance();
  let glSystem = GLSystem.getInstance();
  let canvas = $state<HTMLCanvasElement | undefined>();
  let ctx: CanvasRenderingContext2D | null = null;
  let dragEnabled = $state(true);
  let panEnabled = $state(true);
  let wheelEnabled = $state(true);
  let videoOutputEnabled = $state(true);
  let editorReady = $state(false);
  let animationFrameId: number | null = null;
  let pausedCallback: FrameRequestCallback | null = null;
  const { updateNode, updateNodeData, getNodes } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const tracker = $derived.by(() => useNodeDataTracker(nodeId));

  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(initialNodeId(), { settings, settingsSchema: schema }),
    createKVStore(initialNodeId())
  );

  const [defaultOutputWidth, defaultOutputHeight] = DEFAULT_OUTPUT_SIZE;

  let outputWidth = $state(defaultOutputWidth);
  let outputHeight = $state(defaultOutputHeight);
  let previewWidth = $derived(outputWidth / PREVIEW_SCALE_FACTOR);
  let previewHeight = $derived(outputHeight / PREVIEW_SCALE_FACTOR);

  let inletCount = $derived(data.inletCount ?? 1);
  let outletCount = $derived(data.outletCount ?? 0);

  let isExpanded = $state(false);
  let previousExecuteCode = $state<number | undefined>(undefined);

  let expandController: CanvasDomExpandController | null = null;

  const expandedPreviewPortalTarget = $derived(
    isExpanded && typeof document !== 'undefined' ? SurfaceOverlay.getInstance().customHost : null
  );

  const canvasDisplayStyle = $derived(
    isExpanded
      ? 'width:auto;height:auto;max-width:100vw;max-height:100vh;'
      : `width: ${previewWidth}px; height: ${previewHeight}px;`
  );

  // Watch for executeCode timestamp changes and re-run when it changes
  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      runCode();
    }
  });

  const fluidCanvas = useFluidCanvas({
    getNodeId: () => nodeId,
    getData: () => data,
    getNodeSize: () => ({ width, height }),
    getPreviewSize: () => ({ width: previewWidth, height: previewHeight }),
    getCanvasSize: () => ({ width: outputWidth, height: outputHeight }),
    setCanvasSize: ({ width, height }) => setCanvasDimensions(width, height),
    updateNode,
    updateNodeData,
    commitNodeData: (key, oldValue, newValue) => tracker.commit(key, oldValue, newValue),
    warn: (message) => customConsole.warn(message),
    previewScaleFactor: PREVIEW_SCALE_FACTOR,

    onResizeCallback(callback) {
      try {
        callback({ width: outputWidth, height: outputHeight });
        sendBitmap();
      } catch (error) {
        handleCodeError(error, data.code, nodeId, customConsole, CANVAS_DOM_WRAPPER_OFFSET);
      }
    }
  });

  // Mouse state - coordinates scaled to canvas resolution
  let mouse = $state({
    x: 0,
    y: 0,
    down: false,
    buttons: 0
  });

  // Keyboard state and user callbacks
  let keyboardCallbacks = $state<{
    onKeyDown?: (event: KeyboardEvent) => void;
    onKeyUp?: (event: KeyboardEvent) => void;
  }>({});

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
        .with(messages.setCode, ({ value }) => {
          setCodeAndUpdate(value);
        })
        .with(messages.run, () => {
          runCode();
        })
        .otherwise(() => {
          // Messages are delivered via recv() callback set by user code
        });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  function setupMouseListeners() {
    if (!canvas) return;

    const updateMousePosition = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect();
      // Scale mouse coordinates to canvas resolution (outputWidth × outputHeight)
      mouse.x = ((e.clientX - rect.left) / rect.width) * outputWidth;
      mouse.y = ((e.clientY - rect.top) / rect.height) * outputHeight;
      mouse.buttons = e.buttons;
    };

    const updateTouchPosition = (e: TouchEvent, useChangedTouches = false) => {
      // Use changedTouches for touchend/touchcancel, touches for touchstart/touchmove
      const touchList = useChangedTouches ? e.changedTouches : e.touches;
      if (touchList.length === 0) return;

      const touch = touchList[0];
      const rect = canvas!.getBoundingClientRect();

      // Scale touch coordinates to canvas resolution (outputWidth × outputHeight)
      mouse.x = ((touch.clientX - rect.left) / rect.width) * outputWidth;
      mouse.y = ((touch.clientY - rect.top) / rect.height) * outputHeight;

      // Set buttons to 1 (primary button) for touch events
      mouse.buttons = 1;
    };

    const onMouseMove = (e: MouseEvent) => {
      updateMousePosition(e);
    };

    const onMouseDown = (e: MouseEvent) => {
      updateMousePosition(e);
      mouse.down = true;
    };

    const onMouseUp = (e: MouseEvent) => {
      updateMousePosition(e);
      mouse.down = false;
    };

    const onMouseLeave = () => {
      mouse.down = false;
      mouse.buttons = 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // Prevent mouse events from firing
      updateTouchPosition(e);
      mouse.down = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Prevent scrolling
      updateTouchPosition(e);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      updateTouchPosition(e, true); // Use changedTouches for final position
      mouse.down = false;
      mouse.buttons = 0;
    };

    const onTouchCancel = (e: TouchEvent) => {
      e.preventDefault();
      updateTouchPosition(e, true); // Use changedTouches for final position
      mouse.down = false;
      mouse.buttons = 0;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchCancel, { passive: false });

    return () => {
      canvas?.removeEventListener('mousemove', onMouseMove);
      canvas?.removeEventListener('mousedown', onMouseDown);
      canvas?.removeEventListener('mouseup', onMouseUp);
      canvas?.removeEventListener('mouseleave', onMouseLeave);
      canvas?.removeEventListener('touchstart', onTouchStart);
      canvas?.removeEventListener('touchmove', onTouchMove);
      canvas?.removeEventListener('touchend', onTouchEnd);
      canvas?.removeEventListener('touchcancel', onTouchCancel);
    };
  }

  function setupKeyboardListeners() {
    if (!canvas) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (keyboardCallbacks.onKeyDown) {
        // Stop propagation for all keyboard events to prevent leaking to xyflow
        e.stopPropagation();

        try {
          keyboardCallbacks.onKeyDown(e);
        } catch (error) {
          handleCodeError(error, data.code, nodeId, customConsole, CANVAS_DOM_WRAPPER_OFFSET);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keyboardCallbacks.onKeyUp) {
        // Stop propagation for all keyboard events to prevent leaking to xyflow
        e.stopPropagation();

        try {
          keyboardCallbacks.onKeyUp(e);
        } catch (error) {
          handleCodeError(error, data.code, nodeId, customConsole, CANVAS_DOM_WRAPPER_OFFSET);
        }
      }
    };

    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('keyup', onKeyUp);

    return () => {
      canvas?.removeEventListener('keydown', onKeyDown);
      canvas?.removeEventListener('keyup', onKeyUp);
    };
  }

  function setupCanvas() {
    if (!canvas) return;

    // Set canvas to full output resolution (same as worker canvas)
    // This matches the behavior of the worker-based canvas node
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    applyCanvasDisplaySize();

    ctx = canvas.getContext('2d');
  }

  function setCanvasDimensions(width: number, height: number) {
    if (!canvas) return;

    outputWidth = width;
    outputHeight = height;

    // CanvasDom owns bitmap dimensions. Reactive canvas width/height attributes would clear draws.
    canvas.width = width;
    canvas.height = height;

    applyCanvasDisplaySize(width, height);
  }

  function applyCanvasDisplaySize(width = outputWidth, height = outputHeight) {
    if (!canvas) return;

    if (isExpanded) {
      Object.assign(canvas.style, {
        width: 'auto',
        height: 'auto',
        maxWidth: '100vw',
        maxHeight: '100vh'
      });
      return;
    }

    Object.assign(canvas.style, {
      width: `${width / PREVIEW_SCALE_FACTOR}px`,
      height: `${height / PREVIEW_SCALE_FACTOR}px`,
      maxWidth: '',
      maxHeight: ''
    });
  }

  $effect(() => {
    isExpanded;
    applyCanvasDisplaySize();
  });

  async function sendBitmap() {
    if (!canvas) return;
    if (!glSystem.hasOutgoingVideoConnections(nodeId)) return;

    await glSystem.setBitmapSource(nodeId, canvas);
  }

  function togglePlayback() {
    const wasPaused = !!data.paused;

    if (wasPaused) {
      // Unpause - restart the animation loop with stored callback
      updateNodeData(nodeId, { paused: false });

      if (pausedCallback) {
        animationFrameId = requestAnimationFrame((time) => {
          pausedCallback!(time);
          sendBitmap();
        });
      }
    } else {
      // Pause - cancel animation frame
      updateNodeData(nodeId, { paused: true });

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }

    eventBus.dispatch({
      type: 'nodeDataCommit',
      nodeId,
      dataKey: 'paused',
      oldValue: wasPaused,
      newValue: !wasPaused
    });
  }

  useNodeSetPaused(
    () => nodeId,
    () => !!data.paused,
    togglePlayback
  );

  async function runCode() {
    if (!canvas || !ctx) return;

    // Clear console and error highlighting on re-run
    consoleRef?.clearConsole();
    lineErrors = undefined;

    // Reset interaction state and video output state
    dragEnabled = true;
    panEnabled = true;
    wheelEnabled = true;
    videoOutputEnabled = true;
    fluidCanvas.reset();

    updateNodeData(nodeId, getBorderResetDataForRun(data));

    const resetSize = resetCanvasSize(canvas, DEFAULT_OUTPUT_SIZE);

    outputWidth = resetSize.width;
    outputHeight = resetSize.height;

    // Clear keyboard callbacks when code is re-run
    keyboardCallbacks = {};
    settingsManager.clearCallbacks();

    // Clear any previous animation frame
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    try {
      // Preprocess code for module support
      const processedCode = await jsRunner.preprocessCode(data.code, { nodeId });

      // If preprocessCode returns null, it means it's a library definition
      if (processedCode === null) {
        return;
      }

      const dimensions = fluidCanvas.getExecutionDimensions(processedCode);

      await jsRunner.executeJavaScript(nodeId, processedCode, {
        customConsole,
        setPortCount,
        setTitle: (title: string) => updateNodeData(nodeId, { title }),
        setHidePorts: (hidePorts: boolean) => updateNodeData(nodeId, { hidePorts }),
        setTags(tags: string[]) {
          updateNodeData(nodeId, { tags: getUserTags(tags) });
        },
        extraContext: {
          settings: createSettingsAPI(settingsManager),
          canvas,
          ctx,
          width: dimensions.width,
          height: dimensions.height,
          mouse,
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
          noBorder: () => {
            updateNodeData(nodeId, { noBorder: true });
          },
          noOutput: () => {
            videoOutputEnabled = false;
            updateNodeInternals(nodeId);
          },
          setCanvasSize: fluidCanvas.setFixedCanvasSize,
          setFluidSize: fluidCanvas.setFluidSize,
          onCanvasResize: fluidCanvas.onCanvasResize,
          setPrimaryButton: (primaryButton: PrimaryButton) => {
            eventBus.dispatch({
              type: 'nodePrimaryButtonUpdate',
              nodeId,
              primaryButton
            });
          },
          onKeyDown: (callback: (event: KeyboardEvent) => void) => {
            keyboardCallbacks.onKeyDown = callback;
          },
          onKeyUp: (callback: (event: KeyboardEvent) => void) => {
            keyboardCallbacks.onKeyUp = callback;
          },
          // Override JSRunner's requestAnimationFrame to also send bitmap
          requestAnimationFrame: (callback: FrameRequestCallback) => {
            // Store callback for restart after unpause
            pausedCallback = callback;

            // Don't schedule if paused
            if (data.paused) {
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
            if (animationFrameId === id) {
              animationFrameId = null;
            }
          }
        }
      });

      if (!fluidCanvas.isFluid && (width !== undefined || height !== undefined)) {
        updateNode(nodeId, { width: undefined, height: undefined });
      }
    } catch (error) {
      handleCodeError(error, data.code, nodeId, customConsole, CANVAS_DOM_WRAPPER_OFFSET);
    }
  }

  onMount(() => {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    // Listen for console output events to capture lineErrors
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    // Register with GLSystem for video output
    glSystem.upsertNode(nodeId, 'img', {});

    setupCanvas();

    expandController = new CanvasDomExpandController({
      nodeId,
      getNodes,
      overlay: SurfaceOverlay.getInstance(),
      onActiveChange: (active) => {
        isExpanded = active;
      },
      focusPreview: () => canvas?.focus()
    });

    const cleanupMouse = setupMouseListeners();
    const cleanupKeyboard = setupKeyboardListeners();
    setTimeout(() => {
      runCode();
    }, 50);

    return () => {
      cleanupMouse?.();
      cleanupKeyboard?.();
    };
  });

  onDestroy(() => {
    expandController?.exit();
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    fluidCanvas.reset();
    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
    glSystem?.removeNode(nodeId);
    jsRunner.destroy(nodeId);
  });

  function toggleExpandedCanvas() {
    if (!expandController) return;

    if (expandController.isActive) {
      expandController.exit();
    } else {
      expandController.enter();
    }
  }

  const handleClass = $derived.by(() => {
    // only apply the custom handles if setHidePorts(true) is set
    if (!data.hidePorts) return '';

    if (!selected && $shouldShowHandles) {
      return 'z-1 transition-opacity';
    }

    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });
</script>

<div class="relative">
  {#if selected && fluidCanvas.isFluid && fluidCanvas.resizerVisible}
    {#if fluidCanvas.resizeAxis === 'both' || fluidCanvas.keepAspectRatio}
      <NodeResizer
        class="z-1"
        minWidth={100}
        minHeight={80}
        keepAspectRatio={fluidCanvas.keepAspectRatio}
        onResize={fluidCanvas.handleResize}
      />
    {:else}
      {#each fluidCanvas.resizeControlPositions as position (position)}
        <NodeResizeControl
          class="z-1"
          {position}
          variant={ResizeControlVariant.Line}
          minWidth={100}
          minHeight={80}
          onResize={fluidCanvas.handleResize}
        />
      {/each}
    {/if}
  {/if}

  <CanvasPreviewLayout
    title={data.title ?? 'canvas.dom'}
    objectType="canvas.dom"
    codePlaceholder="Write your Canvas API code here..."
    onCodeChange={(newCode) => updateNodeData(nodeId, { code: newCode })}
    {nodeId}
    onrun={runCode}
    onPlaybackToggle={togglePlayback}
    paused={data.paused}
    showPauseButton={true}
    bind:previewCanvas={canvas}
    nodrag={!dragEnabled}
    nopan={!panEnabled}
    nowheel={!wheelEnabled}
    tabindex={0}
    style={canvasDisplayStyle}
    onCustomExpandToggle={toggleExpandedCanvas}
    customExpanded={isExpanded}
    previewPortalTarget={expandedPreviewPortalTarget}
    {selected}
    {editorReady}
    hasError={lineErrors !== undefined}
    settingsSchema={data.settingsSchema}
    settingsValues={data.settings ?? {}}
    onSettingsValueChange={(key, value) => settingsManager.setValue(key, value)}
    onSettingsRevertAll={() => settingsManager.revertAll()}
    noBorder={data.noBorder}
    displayExtraMenuItems={fluidCanvas.displayExtraMenuItems}
  >
    {#snippet topHandle()}
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
          total={outletCount + 1}
          index={0}
          class={handleClass}
          {nodeId}
        />
      {/if}

      {#each Array.from({ length: outletCount }) as _, index (index)}
        <TypedHandle
          port="outlet"
          spec={{ handleId: index }}
          title={`Outlet ${index}`}
          total={videoOutputEnabled ? outletCount + 1 : outletCount}
          index={videoOutputEnabled ? index + 1 : index}
          class={handleClass}
          {nodeId}
        />
      {/each}
    {/snippet}

    {#snippet codeEditor()}
      <CodeEditor
        value={data.code}
        language="javascript"
        nodeType="canvas.dom"
        placeholder="Write your Canvas API code here..."
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
      <!-- Always render VirtualConsole so it receives events even when hidden -->
      <div class="mt-3 w-full" class:hidden={!data.showConsole}>
        <VirtualConsole
          bind:this={consoleRef}
          {nodeId}
          placeholder="Canvas errors will appear here."
          maxHeight="200px"
        />
      </div>
    {/snippet}
  </CanvasPreviewLayout>
</div>
