<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    NodeResizer,
    NodeResizeControl,
    ResizeControlVariant,
    useSvelteFlow
  } from '@xyflow/svelte';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { capPreviewSize, PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
  import { useNodeSetPaused } from '$lib/canvas/use-node-set-paused.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import { useNodeDataTracker } from '$lib/history';
  import { useFluidCanvas } from '$objects/canvas/useFluidCanvas.svelte';
  import { pixiDomManager } from '$objects/pixi/PixiDomManager';
  import {
    outputHeight as globalOutputHeight,
    outputWidth as globalOutputWidth
  } from '../../stores/renderer.store';

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
      fluidCanvasResizerVisible?: boolean;
      paused?: boolean;
    };
    selected?: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNode, updateNodeData } = useSvelteFlow();
  const glSystem = GLSystem.getInstance();
  const eventBus = PatchiesEventBus.getInstance();
  const tracker = $derived.by(() => useNodeDataTracker(nodeId));
  let canvas = $state<HTMLCanvasElement>();
  let entry = $state<Awaited<ReturnType<typeof pixiDomManager.register>>>();
  let draw: ((time: number) => void) | null = null;
  let editorReady = $state(false);
  let runRevision = 0;
  let destroyed = false;
  let outputWidth = $state($globalOutputWidth);
  let outputHeight = $state($globalOutputHeight);
  const previewSize = $derived.by(() =>
    capPreviewSize(outputWidth / PREVIEW_SCALE_FACTOR, outputHeight / PREVIEW_SCALE_FACTOR)
  );
  let previewWidth = $derived(previewSize[0]);
  let previewHeight = $derived(previewSize[1]);

  const fluidCanvas = useFluidCanvas({
    getNodeId: () => nodeId,
    getData: () => data,
    getNodeSize: () => ({ width: nodeWidth, height: nodeHeight }),
    getPreviewSize: () => ({ width: previewWidth, height: previewHeight }),
    getCanvasSize: () => ({ width: outputWidth, height: outputHeight }),
    setCanvasSize: setCanvasDimensions,
    updateNode,
    updateNodeData,
    commitNodeData: (key, oldValue, newValue) => tracker.commit(key, oldValue, newValue),
    warn: (message) => console.warn(`[pixi.dom] ${message}`),
    onResizeCallback(callback) {
      callback({ width: outputWidth, height: outputHeight });
    },
    previewScaleFactor: PREVIEW_SCALE_FACTOR
  });

  const resizeControlsVisible = $derived(
    selected && fluidCanvas.isFluid && fluidCanvas.resizerVisible
  );

  function setCanvasDimensions({ width, height }: { width: number; height: number }) {
    outputWidth = width;
    outputHeight = height;

    pixiDomManager.resize(nodeId, { width, height });
  }

  function clearStage() {
    entry?.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
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
    pixiDomManager.setPaused(nodeId, !!data.paused);
  });

  async function run() {
    if (!canvas || !entry) return;

    const revision = ++runRevision;

    draw = null;
    fluidCanvas.reset();
    setCanvasDimensions({ width: $globalOutputWidth, height: $globalOutputHeight });

    try {
      const app = await pixiDomManager.getApplication();
      const PIXI = await import('pixi.js');

      if (revision !== runRevision) return;

      clearStage();

      const dimensions = fluidCanvas.getExecutionDimensions(data.code);
      const execute = new Function(
        'PIXI',
        'renderer',
        'stage',
        'canvas',
        'width',
        'height',
        'setCanvasSize',
        'setFluidSize',
        'onCanvasResize',
        `${data.code}\nreturn typeof draw === 'function' ? draw : null;`
      );
      const candidate = execute(
        PIXI,
        app.renderer,
        entry.stage,
        canvas,
        dimensions.width,
        dimensions.height,
        fluidCanvas.setFixedCanvasSize,
        fluidCanvas.setFluidSize,
        fluidCanvas.onCanvasResize
      );

      if (revision !== runRevision) return;

      draw = typeof candidate === 'function' ? candidate : null;
    } catch (error) {
      if (revision !== runRevision) return;

      console.error('[pixi.dom] code error', error);
    }
  }

  onMount(() => {
    glSystem.upsertNode(nodeId, 'img', {});

    async function initialize() {
      if (!canvas) return;

      const activeCanvas = canvas;
      const nextEntry = await pixiDomManager.register(
        nodeId,
        activeCanvas,
        { width: outputWidth, height: outputHeight },
        (time) => {
          try {
            draw?.(time);
          } catch (error) {
            draw = null;
            console.error('[pixi.dom] draw error', error);
          }
        },
        () => {
          if (!glSystem.hasOutgoingVideoConnections(nodeId)) return;

          void glSystem.setBitmapSource(nodeId, activeCanvas);
        }
      );

      if (destroyed) {
        pixiDomManager.unregister(nodeId);
        return;
      }

      entry = nextEntry;

      if (runRevision === 0) void run();
    }

    void initialize();
  });

  onDestroy(() => {
    destroyed = true;
    runRevision += 1;
    fluidCanvas.reset();

    pixiDomManager.unregister(nodeId);
    glSystem.removeNode(nodeId);
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
    style={`width: ${previewWidth}px; height: ${previewHeight}px;`}
    {selected}
    {editorReady}
    hideBorder={resizeControlsVisible}
    displayExtraMenuItems={fluidCanvas.displayExtraMenuItems}
  >
    {#snippet topHandle()}
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'message', handleId: '0' }}
        title="Control messages"
        total={1}
        index={0}
        {nodeId}
      />
    {/snippet}

    {#snippet bottomHandle()}
      <TypedHandle
        port="outlet"
        spec={{ handleType: 'video', handleId: '0' }}
        title="Video output"
        total={1}
        index={0}
        {nodeId}
      />
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
        {nodeId}
      />
    {/snippet}
  </CanvasPreviewLayout>
</div>
