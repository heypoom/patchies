<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals, useViewport } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { P5Manager } from '$lib/p5/P5Manager';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import ObjectPreviewLayout from '$lib/components/ObjectPreviewLayout.svelte';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { handleCodeError } from '$lib/js-runner/handleCodeError';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';
  import { parseCanvasDimensions, shouldResetP5CanvasSize } from '$lib/p5/component-helpers';
  import { createP5SurfaceMode } from '$lib/p5/use-p5-surface-mode.svelte';
  import { P5_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
  import { SettingsManager, createSettingsAPI } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import type { SettingsSchema } from '$lib/settings';

  let consoleRef: VirtualConsole | null = $state(null);

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title?: string;
      code: string;
      inletCount?: number;
      outletCount?: number;
      hidePorts?: boolean;
      executeCode?: number;
      paused?: boolean;
      showConsole?: boolean;
      surfaceMode?: boolean;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
    };
    selected: boolean;
  } = $props();

  const { getNodes, updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const viewport = useViewport();

  // Settings manager — persists across code re-runs
  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(nodeId, { settings, settingsSchema: schema }),
    createKVStore(nodeId)
  );
  const settingsAPI = createSettingsAPI(settingsManager);

  let containerElement: HTMLDivElement;
  let measureElement: HTMLDivElement;
  let p5Manager: P5Manager | null = null;
  let glSystem = GLSystem.getInstance();
  let messageContext: MessageContext;
  let enableDrag = $state(true);
  let enablePan = $state(true);
  let enableWheel = $state(true);
  let videoOutputEnabled = $state(true);
  let errorMessage = $state<string | null>(null);
  let editorReady = $state(false);

  let previewContainerWidth = $state(0);
  const code = $derived(data.code || '');
  let inletCount = $derived(data.inletCount ?? 1);
  let outletCount = $derived(data.outletCount ?? 1);
  let previousExecuteCode = $state<number | undefined>(undefined);

  // Local state for pre-parsed canvas dimensions (not persisted)
  // These prevent layout shift by setting min-width/height before P5.js loads
  let preloadCanvasWidth = $state<number | undefined>(0);
  let preloadCanvasHeight = $state<number | undefined>(0);
  let clearDimensionsTimeout: ReturnType<typeof setTimeout> | null = null;
  let preservedFrameCanvas: HTMLCanvasElement | null = null;

  const surfaceMode = createP5SurfaceMode({
    nodeId,
    getNodes,
    getGlSystem: () => glSystem,
    getP5Manager: () => p5Manager,
    getPreviewContainer: () => containerElement ?? null,
    isSurfaceModeEnabled: () => data.surfaceMode,
    measureWidth,
    updateSketch: () => void updateSketch()
  });

  function setCanvasDimensionsFromCode(nextCode = code) {
    const dimensions = parseCanvasDimensions(nextCode);
    if (dimensions) {
      preloadCanvasWidth = dimensions.width;
      preloadCanvasHeight = dimensions.height;
    }
  }

  function clearCanvasDimensions() {
    preloadCanvasWidth = undefined;
    preloadCanvasHeight = undefined;
  }

  function cancelScheduledDimensionsClear() {
    if (clearDimensionsTimeout) {
      clearTimeout(clearDimensionsTimeout);

      clearDimensionsTimeout = null;
    }
  }

  function scheduleDimensionsClear(nextCode = code) {
    cancelScheduledDimensionsClear();

    if (!shouldResetP5CanvasSize(nextCode)) return;

    clearDimensionsTimeout = setTimeout(() => {
      if (!errorMessage) {
        clearCanvasDimensions();
      }

      clearDimensionsTimeout = null;
    }, 150);
  }

  function clearPreservedFrameCanvas() {
    preservedFrameCanvas?.remove();
    preservedFrameCanvas = null;
  }

  function preserveFrameCanvas({
    canvas,
    displayWidth,
    displayHeight
  }: {
    canvas: HTMLCanvasElement;
    displayWidth: number;
    displayHeight: number;
  }) {
    if (!containerElement) return;

    clearPreservedFrameCanvas();
    canvas.classList.add('patchies-p5-preserved-frame');

    Object.assign(canvas.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${displayWidth}px`,
      height: `${displayHeight}px`,
      margin: '0',
      pointerEvents: 'none',
      zIndex: '1'
    });

    containerElement.appendChild(canvas);
    preservedFrameCanvas = canvas;
  }

  // Create custom console for routing output to VirtualConsole
  const customConsole = createCustomConsole(nodeId);

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

  // Watch for executeCode timestamp changes and re-run when it changes
  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      updateSketch();
    }
  });

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    p5Manager = new P5Manager(nodeId, containerElement, viewport);
    glSystem.upsertNode(nodeId, 'img', {});

    // Listen for console output events to capture lineErrors
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    // Pre-parse createCanvas() dimensions before P5.js loads
    // This prevents layout shift by setting correct size immediately
    if (code) {
      setCanvasDimensionsFromCode();
    }

    updateSketch({ onMount: true });
    measureWidth(1000);
  });

  onDestroy(() => {
    clearPreservedFrameCanvas();
    surfaceMode.cleanup();
    p5Manager?.destroy();
    glSystem.removeNode(nodeId);
    messageContext?.destroy();
    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
  });

  const setPortCount = (inletCount = 1, outletCount = 1) => {
    updateNodeData(nodeId, { inletCount, outletCount });
    updateNodeInternals(nodeId);
  };

  function setVideoOutputEnabled(enabled: boolean) {
    if (videoOutputEnabled === enabled) return;

    videoOutputEnabled = enabled;
    updateNodeInternals(nodeId);
  }

  function togglePlayback() {
    const p5 = p5Manager?.p5;
    if (!p5) return;

    const wasPaused = !!data.paused;

    if (wasPaused) {
      // Unpause the sketch by restarting the animation loop
      p5.loop();
      updateNodeData(nodeId, { paused: false });
    } else {
      // Pause the sketch by stopping the animation loop
      p5.noLoop();
      updateNodeData(nodeId, { paused: true });
    }

    eventBus.dispatch({
      type: 'nodeDataCommit',
      nodeId,
      dataKey: 'paused',
      oldValue: wasPaused,
      newValue: !wasPaused
    });
  }

  // Handle runtime errors (from draw(), setup(), etc.)
  function handleRuntimeError(error: Error, nextCode = code) {
    cancelScheduledDimensionsClear();
    errorMessage = error.message;
    handleCodeError(error, nextCode, nodeId, customConsole, P5_WRAPPER_OFFSET);
    setCanvasDimensionsFromCode(nextCode);
  }

  function handleCodeChange(newCode: string) {
    updateNodeData(nodeId, { code: newCode });
  }

  type UpdateSketchOptions = { onMount?: boolean };

  async function updateSketch(input: string | UpdateSketchOptions = {}) {
    const nextCode = typeof input === 'string' ? input : code;
    const onMount = typeof input === 'string' ? false : (input.onMount ?? false);

    // re-enable interactions on update. noDrag()/noPan()/noWheel() must be called on setup().
    enableDrag = true;
    enablePan = true;
    enableWheel = true;
    let nextVideoOutputEnabled = true;
    let nextSurfaceModeEnabled = false;

    // Clear previous error state at the start of each run
    // If an error occurs during updateCode, it will be set again
    errorMessage = null;

    // Clear previous console output and error highlighting
    consoleRef?.clearConsole();
    lineErrors = undefined;

    setPortCount(1, 1);

    if (p5Manager && messageContext) {
      try {
        settingsManager.clearCallbacks();
        p5Manager.shouldSendBitmap = true;
        surfaceMode.setMouseForwarding();

        await p5Manager.updateCode({
          code: nextCode,
          messageContext: {
            ...messageContext.getContext(),
            noDrag: () => {
              enableDrag = false;
            },
            noPan: () => {
              enablePan = false;
            },
            noWheel: () => {
              enableWheel = false;
            },
            noInteract: () => {
              enableDrag = false;
              enablePan = false;
              enableWheel = false;
            },
            noOutput: () => {
              nextVideoOutputEnabled = false;
              setVideoOutputEnabled(false);
            },
            setPortCount,
            setTitle: (title: string) => {
              updateNodeData(nodeId, { title });
            }
          },
          setHidePorts: (hide: boolean) => {
            updateNodeData(nodeId, { hidePorts: hide });
          },
          settings: settingsAPI,
          pauseOnMount: onMount && !!data.paused,
          useViewportMouseScale: !surfaceMode.isExpanded,
          customConsole,
          onRuntimeError: (error) => handleRuntimeError(error, nextCode),
          onPreserveFrame: surfaceMode.isExpanded ? undefined : preserveFrameCanvas,
          onFrameReady: () => {
            clearPreservedFrameCanvas();
            setVideoOutputEnabled(nextVideoOutputEnabled);
          },
          getSurfaceCanvasSize: surfaceMode.getCanvasSize,
          onSurfaceModeChange: (enabled) => {
            nextSurfaceModeEnabled = enabled;

            if (enabled) {
              nextVideoOutputEnabled = false;
              setVideoOutputEnabled(false);
            }
          },
          onSurfaceCanvasCreated: surfaceMode.styleCanvas,
          onSurfaceFrame: surfaceMode.requestMirrorFrame,
          onSurfacePointer: surfaceMode.forwardPointer,
          onSurfaceWheel: surfaceMode.forwardWheel,
          hideExitButton: surfaceMode.hideExitButton,
          setMouseForwarding: surfaceMode.setMouseForwarding,
          expandSurface: surfaceMode.enter,
          collapseSurface: surfaceMode.exit
        });

        p5Manager.shouldSendBitmap = !nextSurfaceModeEnabled;

        if (data.surfaceMode !== nextSurfaceModeEnabled) {
          updateNodeData(nodeId, { surfaceMode: nextSurfaceModeEnabled });
        }

        if (!nextSurfaceModeEnabled && surfaceMode.isExpanded) {
          surfaceMode.exit();
        }

        measureWidth(100);

        // Schedule dimension cleanup only if no error occurred during updateCode
        if (!errorMessage) {
          scheduleDimensionsClear(nextCode);
        }
      } catch (error) {
        cancelScheduledDimensionsClear();
        errorMessage = error instanceof Error ? error.message : String(error);
        handleCodeError(error, nextCode, nodeId, customConsole);
        setCanvasDimensionsFromCode(nextCode);
      }
    }
  }

  function measureWidth(timeout: number) {
    setTimeout(() => {
      if (measureElement) {
        previewContainerWidth = Math.max(measureElement.clientWidth, containerElement.clientWidth);
      }
    }, timeout);
  }

  const handleClass = $derived.by(() => {
    if (!data.hidePorts) return '';

    if (!selected && $shouldShowHandles) {
      return 'z-1 transition-opacity';
    }

    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });
</script>

<ObjectPreviewLayout
  title={data.title ?? 'p5'}
  objectType="p5"
  {nodeId}
  onCodeChange={handleCodeChange}
  onrun={updateSketch}
  previewWidth={previewContainerWidth}
  showPauseButton
  paused={data.paused}
  onPlaybackToggle={togglePlayback}
  {editorReady}
  settingsSchema={data.settingsSchema}
  settingsValues={data.settings ?? {}}
  onSettingsValueChange={(key, value) => settingsManager.setValue(key, value)}
  onSettingsRevertAll={() => settingsManager.revertAll()}
  displayExtraMenuItems={surfaceMode.menuItems}
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

  {#snippet preview()}
    <div class="relative" bind:this={measureElement}>
      <div
        bind:this={containerElement}
        class={[
          'rounded-md border bg-transparent',
          'relative overflow-hidden',
          enableDrag && enablePan && enableWheel
            ? 'cursor-grab'
            : [
                'cursor-default',
                !enableDrag && 'nodrag',
                !enablePan && 'nopan',
                !enableWheel && 'nowheel'
              ],
          errorMessage
            ? 'border-red-500 [&>canvas]:rounded-[7px]'
            : selected
              ? 'shadow-glow-md border-zinc-200 [&>canvas]:rounded-[7px]'
              : 'hover:shadow-glow-sm border-transparent [&>canvas]:rounded-md'
        ]}
        style={preloadCanvasWidth && preloadCanvasHeight
          ? `min-width: ${preloadCanvasWidth}px; min-height: ${preloadCanvasHeight}px;`
          : ''}
      ></div>
    </div>
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
      value={code}
      onchange={handleCodeChange}
      language="javascript"
      nodeType="p5"
      placeholder="Write your p5.js code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={updateSketch}
      onready={() => (editorReady = true)}
      {lineErrors}
      {nodeId}
    />
  {/snippet}

  {#snippet console()}
    <!-- Always render VirtualConsole so it receives events even when hidden -->
    <div class="mt-3" class:hidden={!data.showConsole}>
      <VirtualConsole bind:this={consoleRef} {nodeId} onrun={updateSketch} />
    </div>
  {/snippet}
</ObjectPreviewLayout>
