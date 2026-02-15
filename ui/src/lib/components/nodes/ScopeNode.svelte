<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ChevronRight, RotateCcw, Settings, X } from '@lucide/svelte/icons';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { NodeResizer, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { match } from 'ts-pattern';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { ScopeAudioNode } from '$lib/audio/v2/nodes/ScopeAudioNode';
  import { useNodeDataTracker } from '$lib/history';

  type PlotType = 'line' | 'point' | 'bezier';
  type ScopeMode = 'waveform' | 'xy';

  let node: {
    id: string;
    data: {
      mode?: ScopeMode;
      bufferSize?: number;
      xScale?: number;
      yScale?: number;
      fps?: number;
      plotType?: PlotType;
      decay?: number;
    };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const tracker = useNodeDataTracker(node.id);

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let animationId: number;
  let audioService = AudioService.getInstance();
  let scopeNode: ScopeAudioNode | null = null;

  let showSettings = $state(false);
  let advancedOpen = $state(false);
  let mode = $state<ScopeMode>(node.data.mode ?? 'waveform');
  let bufferSize = $state(node.data.bufferSize ?? 512);
  let xScale = $state(node.data.xScale ?? 1);
  let yScale = $state(node.data.yScale ?? 1);
  let fps = $state(node.data.fps ?? 0);
  let plotType = $state<PlotType>(node.data.plotType ?? 'line');
  let decay = $state(node.data.decay ?? 1);

  const DEFAULT_WIDTH = 200;
  const DEFAULT_HEIGHT = 120;
  const MIN_WIDTH = 100;
  const MIN_HEIGHT = 60;

  const displayWidth = $derived(node.width ?? DEFAULT_WIDTH);
  const displayHeight = $derived(node.height ?? DEFAULT_HEIGHT);
  const inletCount = $derived(mode === 'xy' ? 2 : 1);

  function setupCanvas() {
    if (!canvas) return;
    ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Draw empty state
    ctx.fillStyle = '#080809';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
  }

  $effect(() => {
    // Re-setup canvas when display size changes
    displayWidth;
    displayHeight;
    setupCanvas();
  });

  // Clean up edges when hiding the Y inlet
  let prevInletCount: number | null = null;
  $effect(() => {
    const count = inletCount;
    updateNodeInternals(node.id);

    if (prevInletCount === null) {
      prevInletCount = count;
      return;
    }

    if (count < prevInletCount) {
      const edges = getEdges();
      const staleEdges = edges.filter(
        (e) => e.target === node.id && e.targetHandle === 'audio-in-1'
      );
      if (staleEdges.length > 0) {
        deleteElements({ edges: staleEdges });
      }
    }

    prevInletCount = count;
  });

  function updateScope() {
    if (mode === 'xy' && scopeNode?.latestXY) {
      drawLissajous(scopeNode.latestXY.x, scopeNode.latestXY.y);
    } else if (scopeNode?.latestWaveform) {
      drawWaveform(scopeNode.latestWaveform);
    }

    animationId = requestAnimationFrame(updateScope);
  }

  function sampleToY(sample: number, h: number): number {
    const normalized = Math.max(-1, Math.min(1, sample * yScale));
    return ((1 - normalized) / 2) * h;
  }

  function clearCanvas(w: number, h: number) {
    if (decay >= 1) {
      ctx.fillStyle = '#080809';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = `rgba(8, 8, 9, ${decay})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawWaveform(buffer: Float32Array) {
    if (!ctx) return;

    const w = displayWidth;
    const h = displayHeight;

    clearCanvas(w, h);

    // Center reference line
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Determine how many samples to display based on xScale
    const samplesToShow = Math.max(1, Math.floor(buffer.length / xScale));
    const sliceWidth = w / samplesToShow;

    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = '#22c55e';

    match(plotType)
      .with('line', () => {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let x = 0;
        for (let i = 0; i < samplesToShow; i++) {
          const y = sampleToY(buffer[i], h);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      })
      .with('point', () => {
        const radius = Math.max(1, Math.min(2, sliceWidth * 0.4));
        let x = 0;
        for (let i = 0; i < samplesToShow; i++) {
          const y = sampleToY(buffer[i], h);
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
          x += sliceWidth;
        }
      })
      .with('bezier', () => {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (samplesToShow < 2) return;

        const y0 = sampleToY(buffer[0], h);
        ctx.moveTo(0, y0);

        for (let i = 1; i < samplesToShow; i++) {
          const prevX = (i - 1) * sliceWidth;
          const currX = i * sliceWidth;
          const prevY = sampleToY(buffer[i - 1], h);
          const currY = sampleToY(buffer[i], h);
          const midX = (prevX + currX) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, (prevY + currY) / 2);
        }

        // Final segment to last point
        const lastX = (samplesToShow - 1) * sliceWidth;
        const lastY = sampleToY(buffer[samplesToShow - 1], h);
        ctx.lineTo(lastX, lastY);
        ctx.stroke();
      })
      .exhaustive();
  }

  function drawLissajous(bufX: Float32Array, bufY: Float32Array) {
    if (!ctx) return;

    const w = displayWidth;
    const h = displayHeight;

    clearCanvas(w, h);

    // Crosshairs
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    const samplesToShow = Math.max(1, Math.floor(bufX.length / xScale));

    function xyToCanvas(sx: number, sy: number): [number, number] {
      const nx = Math.max(-1, Math.min(1, sx * yScale));
      const ny = Math.max(-1, Math.min(1, sy * yScale));
      return [((nx + 1) / 2) * w, ((1 - ny) / 2) * h];
    }

    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = '#22c55e';

    match(plotType)
      .with('line', () => {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < samplesToShow; i++) {
          const [cx, cy] = xyToCanvas(bufX[i], bufY[i]);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      })
      .with('point', () => {
        const radius = 1.5;
        for (let i = 0; i < samplesToShow; i++) {
          const [cx, cy] = xyToCanvas(bufX[i], bufY[i]);
          ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        }
      })
      .with('bezier', () => {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (samplesToShow < 2) return;

        const [x0, y0] = xyToCanvas(bufX[0], bufY[0]);
        ctx.moveTo(x0, y0);

        for (let i = 1; i < samplesToShow; i++) {
          const [prevX, prevY] = xyToCanvas(bufX[i - 1], bufY[i - 1]);
          const [currX, currY] = xyToCanvas(bufX[i], bufY[i]);
          const midX = (prevX + currX) / 2;
          const midY = (prevY + currY) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, midY);
        }

        const [lastX, lastY] = xyToCanvas(bufX[samplesToShow - 1], bufY[samplesToShow - 1]);
        ctx.lineTo(lastX, lastY);
        ctx.stroke();
      })
      .exhaustive();
  }

  function handleModeChange(value: ScopeMode) {
    const oldValue = mode;
    mode = value;
    updateNodeData(node.id, { mode: value });
    tracker.commit('mode', oldValue, value);
    scopeNode?.setMode(value);
  }

  const bufferSizeTracker = tracker.track('bufferSize', () => node.data.bufferSize ?? 512);

  function handleBufferSizeChange(value: number) {
    bufferSize = value;
    updateNodeData(node.id, { bufferSize: value });
    scopeNode?.setBufferSize(value);
  }

  const xScaleTracker = tracker.track('xScale', () => node.data.xScale ?? 1);
  const yScaleTracker = tracker.track('yScale', () => node.data.yScale ?? 1);

  function handleXScaleChange(value: number) {
    xScale = value;
    updateNodeData(node.id, { xScale: value });
  }

  function handleYScaleChange(value: number) {
    yScale = value;
    updateNodeData(node.id, { yScale: value });
  }

  const fpsTracker = tracker.track('fps', () => node.data.fps ?? 0);

  function handleFpsChange(value: number) {
    fps = value;
    updateNodeData(node.id, { fps: value });
    scopeNode?.setFps(value);
  }

  function handlePlotTypeChange(value: PlotType) {
    const oldValue = plotType;
    plotType = value;
    updateNodeData(node.id, { plotType: value });
    tracker.commit('plotType', oldValue, value);
  }

  const decayTracker = tracker.track('decay', () => node.data.decay ?? 1);

  function handleDecayChange(value: number) {
    decay = value;
    updateNodeData(node.id, { decay: value });
  }

  function resetSettings() {
    bufferSize = 512;
    xScale = 1;
    yScale = 1;
    fps = 0;
    plotType = 'line';
    decay = 1;
    updateNodeData(node.id, {
      bufferSize: 512,
      xScale: 1,
      yScale: 1,
      fps: 0,
      plotType: 'line',
      decay: 1
    });
    scopeNode?.setBufferSize(512);
    scopeNode?.setFps(0);
  }

  onMount(async () => {
    const audioNode = await audioService.createNode(node.id, 'scope~', []);
    if (audioNode && audioNode instanceof ScopeAudioNode) {
      scopeNode = audioNode;

      if (bufferSize !== 512) {
        scopeNode.setBufferSize(bufferSize);
      }
      if (fps > 0) {
        scopeNode.setFps(fps);
      }
      if (mode !== 'waveform') {
        scopeNode.setMode(mode);
      }
    }

    setupCanvas();
    updateScope();
  });

  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    audioService.removeNodeById(node.id);
  });
</script>

<div class="relative">
  <NodeResizer class="z-1" isVisible={node.selected} minWidth={MIN_WIDTH} minHeight={MIN_HEIGHT} />

  <div class="group relative">
    <!-- Settings button -->
    <div class="absolute -top-7 right-0 z-10 flex gap-x-1">
      <button
        class={[
          'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
          node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        ]}
        onclick={(e) => {
          e.stopPropagation();
          showSettings = !showSettings;
        }}
        title="Settings"
      >
        <Settings class="h-4 w-4 text-zinc-300" />
      </button>
    </div>

    <div class="relative">
      <StandardHandle
        port="inlet"
        type="audio"
        id="0"
        total={inletCount}
        index={0}
        title={mode === 'xy' ? 'X axis' : 'Audio input'}
        class={`${node.selected ? '' : 'opacity-30 group-hover:opacity-100 sm:opacity-0'}`}
        nodeId={node.id}
      />

      {#if mode === 'xy'}
        <StandardHandle
          port="inlet"
          type="audio"
          id="1"
          total={inletCount}
          index={1}
          title="Y axis"
          class={`${node.selected ? '' : 'opacity-30 group-hover:opacity-100 sm:opacity-0'}`}
          nodeId={node.id}
        />
      {/if}

      <canvas
        bind:this={canvas}
        class={[
          'rounded border bg-zinc-900',
          node.selected ? 'object-container-selected' : 'border-zinc-600'
        ]}
        style="width: {displayWidth}px; height: {displayHeight}px;"
      ></canvas>
    </div>
  </div>

  <!-- Settings panel -->
  {#if showSettings}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute top-0 z-20"
      style="left: {displayWidth + 10}px"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button
          onclick={resetSettings}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
          title="Reset to defaults"
        >
          <RotateCcw class="h-4 w-4" />
        </button>
        <button
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="nodrag w-48 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <div class="space-y-4">
          <!-- Buffer Size -->
          <div>
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs font-medium text-zinc-300">Samples</span>
              <span class="text-xs text-zinc-500">{bufferSize}</span>
            </div>

            <input
              type="range"
              min="64"
              max="2048"
              step="1"
              value={bufferSize}
              onpointerdown={bufferSizeTracker.onFocus}
              onpointerup={bufferSizeTracker.onBlur}
              oninput={(e) =>
                handleBufferSizeChange(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-green-500"
            />
          </div>

          <!-- X Scale -->
          <div>
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs font-medium text-zinc-300">X Scale</span>
              <span class="text-xs text-zinc-500">{xScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={xScale}
              onpointerdown={xScaleTracker.onFocus}
              onpointerup={xScaleTracker.onBlur}
              oninput={(e) => handleXScaleChange(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-green-500"
            />
          </div>

          <!-- Y Scale -->
          <div>
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs font-medium text-zinc-300">Y Scale</span>
              <span class="text-xs text-zinc-500">{yScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={yScale}
              onpointerdown={yScaleTracker.onFocus}
              onpointerup={yScaleTracker.onBlur}
              oninput={(e) => handleYScaleChange(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-green-500"
            />
          </div>

          <!-- Advanced accordion -->
          <Collapsible.Root bind:open={advancedOpen}>
            <Collapsible.Trigger
              class="flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
            >
              <ChevronRight class={['h-3 w-3 transition-transform', advancedOpen && 'rotate-90']} />
              <span>Advanced</span>
            </Collapsible.Trigger>

            <Collapsible.Content class="mt-2 space-y-4">
              <!-- Mode -->
              <div>
                <span class="mb-1 block text-xs font-medium text-zinc-300">Mode</span>
                <div class="flex gap-1">
                  {#each ['waveform', 'xy'] as modeOption (modeOption)}
                    <button
                      class={[
                        'flex-1 cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                        mode === modeOption
                          ? 'bg-green-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      ]}
                      onclick={() => handleModeChange(modeOption as ScopeMode)}
                    >
                      {modeOption}
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Plot Type -->
              <div>
                <span class="mb-1 block text-xs font-medium text-zinc-300">Plot</span>
                <div class="flex gap-1">
                  {#each ['line', 'point', 'bezier'] as type (type)}
                    <button
                      class={[
                        'flex-1 cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                        plotType === type
                          ? 'bg-green-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      ]}
                      onclick={() => handlePlotTypeChange(type as PlotType)}
                    >
                      {type}
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Decay -->
              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs font-medium text-zinc-300">Decay</span>
                  <span class="text-xs text-zinc-500"
                    >{decay >= 1 ? 'off' : `${(decay * 100).toFixed(0)}%`}</span
                  >
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={decay}
                  onpointerdown={decayTracker.onFocus}
                  onpointerup={decayTracker.onBlur}
                  oninput={(e) =>
                    handleDecayChange(parseFloat((e.target as HTMLInputElement).value))}
                  class="w-full accent-green-500"
                />
              </div>

              <!-- Refresh Rate -->
              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs font-medium text-zinc-300">Refresh</span>
                  <span class="text-xs text-zinc-500">{fps === 0 ? 'max' : `${fps} fps`}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="1"
                  value={fps}
                  onpointerdown={fpsTracker.onFocus}
                  onpointerup={fpsTracker.onBlur}
                  oninput={(e) => handleFpsChange(parseInt((e.target as HTMLInputElement).value))}
                  class="w-full accent-green-500"
                />
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        </div>
      </div>
    </div>
  {/if}
</div>
