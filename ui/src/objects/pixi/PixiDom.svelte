<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import type { Container } from 'pixi.js';
  import {
    NodeResizer,
    NodeResizeControl,
    ResizeControlVariant,
    useSvelteFlow,
    useUpdateNodeInternals
  } from '@xyflow/svelte';

  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
  import { useCappedPreviewSize } from '$lib/canvas/use-capped-preview-size.svelte';
  import { useKeyboardCallbacks } from '$lib/canvas/use-keyboard-callbacks.svelte';
  import { useNodeSetPaused } from '$lib/canvas/use-node-set-paused.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent, PrimaryButton } from '$lib/eventbus/events';
  import { useNodeDataTracker } from '$lib/history';
  import { handleCodeError } from '$lib/js-runner/handleCodeError';
  import { JSRunner } from '$lib/js-runner/JSRunner';
  import { CanvasDomExpandController } from '$lib/canvas/CanvasDomExpandController';
  import { SurfaceOverlay } from '$lib/canvas/SurfaceOverlay';
  import { getBorderResetDataForRun } from '$lib/components/border-chrome';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PIXI_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
  import { SettingsManager, createSettingsAPI } from '$lib/settings';
  import type { SettingsSchema } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { replaceUserTags } from '$lib/runtime/services/graph-tags';
  import { shouldShowHandles } from '../../stores/ui.store';

  import { useFluidCanvas } from '$objects/canvas/useFluidCanvas.svelte';
  import { pixiDomManager } from '$objects/pixi/PixiDomManager';

  import {
    outputHeight as globalOutputHeight,
    outputWidth as globalOutputWidth
  } from '../../stores/renderer.store';

  type ActiveRuntime = {
    code: string;
    draw: ((time: number) => void) | null;
    setDimensions: (width: number, height: number) => void;
  };

  let {
    id: nodeId,
    data,
    selected,
    width: nodeWidth,
    height: nodeHeight
  }: {
    id: string;
    data: {
      title?: string;
      code: string;
      executeCode?: number;
      hidePorts?: boolean;
      fluidCanvasResizerVisible?: boolean;
      noBorder?: boolean;
      paused?: boolean;
      showConsole?: boolean;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
      tags?: string[];
    };
    selected?: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNode, updateNodeData, getNodes } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const glSystem = GLSystem.getInstance();
  const eventBus = PatchiesEventBus.getInstance();
  const jsRunner = JSRunner.getInstance();

  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(initialNodeId(), { settings, settingsSchema: schema }),
    createKVStore(initialNodeId())
  );

  function initialNodeId() {
    return nodeId;
  }

  const customConsole = createCustomConsole(initialNodeId());

  const tracker = $derived.by(() => useNodeDataTracker(nodeId));
  let fluidCanvas = $state.raw<ReturnType<typeof useFluidCanvas>>(undefined!);

  const previewSize = useCappedPreviewSize(
    () => ({ width: outputWidth, height: outputHeight }),
    () => !fluidCanvas.isFluid
  );

  let canvas = $state<HTMLCanvasElement>();
  let consoleRef: VirtualConsole | null = $state(null);
  let entry = $state<Awaited<ReturnType<typeof pixiDomManager.register>>>();
  let activeRuntime: ActiveRuntime | null = null;

  const keyboard = useKeyboardCallbacks({ onError: reportRuntimeError });

  let dragEnabled = $state(true);
  let panEnabled = $state(true);
  let wheelEnabled = $state(true);

  let editorReady = $state(false);
  let videoOutputEnabled = $state(false);
  let isExpanded = $state(false);
  let previousExecuteCode = $state<number | undefined>(undefined);
  let runRevision = 0;
  let destroyed = false;
  let outputWidth = $state($globalOutputWidth);
  let outputHeight = $state($globalOutputHeight);
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);

  let previewWidth = $derived(previewSize.width);
  let previewHeight = $derived(previewSize.height);

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
      run();
    }
  });

  fluidCanvas = useFluidCanvas({
    getNodeId: () => nodeId,
    getData: () => data,
    getNodeSize: () => ({ width: nodeWidth, height: nodeHeight }),
    getPreviewSize: () => ({ width: previewWidth, height: previewHeight }),
    getCanvasSize: () => ({ width: outputWidth, height: outputHeight }),
    setCanvasSize: setCanvasDimensions,
    updateNode,
    updateNodeData,
    commitNodeData: (key, oldValue, newValue) => tracker.commit(key, oldValue, newValue),
    warn: (message) => customConsole.warn(message),
    onResizeCallback(callback) {
      callback({ width: outputWidth, height: outputHeight });
    },
    previewScaleFactor: PREVIEW_SCALE_FACTOR
  });

  const resizeControlsVisible = $derived(
    selected && fluidCanvas.isFluid && fluidCanvas.resizerVisible
  );

  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;
    if (event.messageType === 'error' && event.lineErrors) lineErrors = event.lineErrors;
  }

  function reportRuntimeError(error: unknown) {
    handleCodeError(
      error,
      activeRuntime?.code ?? data.code,
      nodeId,
      customConsole,
      PIXI_WRAPPER_OFFSET
    );
  }

  function setCanvasDimensions({ width, height }: { width: number; height: number }) {
    outputWidth = width;
    outputHeight = height;
    activeRuntime?.setDimensions(width, height);

    pixiDomManager.resize(nodeId, { width, height });
  }

  function setVideoOutputEnabled(enabled: boolean) {
    if (videoOutputEnabled === enabled) return;

    videoOutputEnabled = enabled;
    updateNodeInternals(nodeId);
  }

  function togglePlayback() {
    const wasPaused = !!data.paused;
    const paused = !wasPaused;

    pixiDomManager.setPaused(nodeId, paused);
    updateNodeData(nodeId, { paused });

    eventBus.dispatch({
      type: 'nodeDataCommit',
      nodeId,
      dataKey: 'paused',
      oldValue: wasPaused,
      newValue: paused
    });
  }

  useNodeSetPaused(
    () => nodeId,
    () => !!data.paused,
    togglePlayback
  );

  $effect(() => {
    if (!entry) return;

    pixiDomManager.setPaused(nodeId, !!data.paused);
  });

  async function run() {
    if (!canvas || !entry) return;

    const revision = ++runRevision;
    const sourceCode = data.code;
    let runStage: Container | null = null;

    consoleRef?.clearConsole();
    lineErrors = undefined;

    settingsManager.clearCallbacks();
    keyboard.reset();

    dragEnabled = true;
    panEnabled = true;
    wheelEnabled = true;

    setVideoOutputEnabled(false);
    fluidCanvas.reset();
    updateNodeData(nodeId, getBorderResetDataForRun(data));

    setCanvasDimensions({
      width: $globalOutputWidth,
      height: $globalOutputHeight
    });

    try {
      await pixiDomManager.getApplication();

      const processedCode = await jsRunner.preprocessCode(sourceCode, { nodeId });
      if (processedCode === null || revision !== runRevision) return;

      const PIXI = await pixiDomManager.getPixiRuntime();
      if (revision !== runRevision) return;

      const dimensions = fluidCanvas.getExecutionDimensions(processedCode);

      runStage = new PIXI.Container();

      const code = `var draw;
${processedCode}
return {
  draw: typeof draw === 'function' ? draw : null,
  setDimensions: (nextWidth, nextHeight) => {
    width = nextWidth;
    height = nextHeight;
  }
};`;

      const candidate = await jsRunner.executeJavaScript(nodeId, code, {
        customConsole,
        setTitle: (title: string) => updateNodeData(nodeId, { title }),
        setHidePorts: (hidePorts: boolean) => updateNodeData(nodeId, { hidePorts }),
        setTags(tags: string[]) {
          updateNodeData(nodeId, { tags: replaceUserTags(data.tags, tags) });
        },
        extraContext: {
          settings: createSettingsAPI(settingsManager),
          PIXI,
          renderer: pixiDomManager.getRenderer(),
          stage: runStage,
          canvas,
          width: dimensions.width,
          height: dimensions.height,
          setCanvasSize: fluidCanvas.setFixedCanvasSize,
          setFluidSize: fluidCanvas.setFluidSize,
          onCanvasResize: fluidCanvas.onCanvasResize,
          onKeyDown: keyboard.onKeyDown,
          onKeyUp: keyboard.onKeyUp,
          loadExtensions: pixiDomManager.loadExtensions.bind(pixiDomManager),
          setVideoOutput: (enabled: boolean) => setVideoOutputEnabled(enabled),
          setPrimaryButton: (primaryButton: PrimaryButton) => {
            eventBus.dispatch({
              type: 'nodePrimaryButtonUpdate',
              nodeId,
              primaryButton
            });
          },
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
          noBorder: () => updateNodeData(nodeId, { noBorder: true })
        }
      });

      if (revision !== runRevision) {
        runStage.destroy({ children: true });

        return;
      }

      if (!pixiDomManager.replaceStage(nodeId, runStage)) {
        runStage.destroy({ children: true });

        return;
      }

      runStage = null;

      activeRuntime = {
        code: sourceCode,
        draw:
          typeof (candidate as ActiveRuntime).draw === 'function'
            ? (candidate as ActiveRuntime).draw
            : null,
        setDimensions: (candidate as ActiveRuntime).setDimensions
      };
    } catch (error) {
      runStage?.destroy({ children: true });

      if (revision !== runRevision) return;

      handleCodeError(error, sourceCode, nodeId, customConsole, PIXI_WRAPPER_OFFSET);
    }
  }

  onMount(() => {
    glSystem.upsertNode(nodeId, 'img', {});
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    expandController = new CanvasDomExpandController({
      nodeId,
      getNodes,
      overlay: SurfaceOverlay.getInstance(),
      onActiveChange: (active) => {
        isExpanded = active;
      },
      focusPreview: () => canvas?.focus()
    });

    async function initialize() {
      if (!canvas) return;

      const activeCanvas = canvas;

      const nextEntry = await pixiDomManager.register(
        nodeId,
        activeCanvas,
        { width: outputWidth, height: outputHeight },
        (time) => {
          const runtime = activeRuntime;
          if (!runtime?.draw) return;

          try {
            runtime.draw(time);
          } catch (error) {
            runtime.draw = null;
            reportRuntimeError(error);
          }
        },
        () => {
          if (!glSystem.hasOutgoingVideoConnections(nodeId)) return;

          glSystem.setBitmapSource(nodeId, activeCanvas);
        },
        (error) => {
          reportRuntimeError(error);
        }
      );

      if (destroyed) {
        pixiDomManager.unregister(nodeId);
        return;
      }

      entry = nextEntry;

      if (runRevision === 0) void run();
    }

    const cleanupKeyboard = canvas ? keyboard.attach(canvas) : undefined;

    initialize();

    return () => cleanupKeyboard?.();
  });

  onDestroy(() => {
    destroyed = true;
    runRevision += 1;

    expandController?.exit();
    fluidCanvas.reset();

    pixiDomManager.unregister(nodeId);
    glSystem.removeNode(nodeId);
    jsRunner.destroy(nodeId);
    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
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
    if (!data.hidePorts) return '';

    if (!selected && $shouldShowHandles) {
      return 'z-1 transition-opacity';
    }

    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });
</script>

<div class="relative">
  {#if resizeControlsVisible}
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
    title={data.title ?? 'pixi.dom'}
    objectType="pixi.dom"
    codePlaceholder="Write interactive PixiJS code here..."
    onCodeChange={(code) => updateNodeData(nodeId, { code })}
    {nodeId}
    onrun={run}
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
    hideBorder={resizeControlsVisible}
    displayExtraMenuItems={fluidCanvas.displayExtraMenuItems}
  >
    {#snippet bottomHandle()}
      {#if videoOutputEnabled}
        <TypedHandle
          port="outlet"
          spec={{ handleType: 'video', handleId: '0' }}
          title="Video output"
          total={1}
          index={0}
          class={handleClass}
          {nodeId}
        />
      {/if}
    {/snippet}

    {#snippet codeEditor()}
      <CodeEditor
        value={data.code}
        language="javascript"
        nodeType="pixi.dom"
        placeholder="Write interactive PixiJS code here..."
        class="nodrag h-64 w-full resize-none"
        onrun={run}
        onchange={(code) => updateNodeData(nodeId, { code })}
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
          placeholder="PixiJS output will appear here."
          maxHeight="200px"
        />
      </div>
    {/snippet}
  </CanvasPreviewLayout>
</div>
