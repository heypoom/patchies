<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Settings, X } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { ScopeAudioNode } from '$lib/audio/v2/nodes/ScopeAudioNode';
  import { useNodeDataTracker } from '$lib/history';

  let node: {
    id: string;
    data: {
      bufferSize?: number;
      xScale?: number;
      yScale?: number;
      fps?: number;
    };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const tracker = useNodeDataTracker(node.id);

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let animationId: number;
  let audioService = AudioService.getInstance();
  let scopeNode: ScopeAudioNode | null = null;

  let showSettings = $state(false);
  let bufferSize = $state(node.data.bufferSize ?? 512);
  let xScale = $state(node.data.xScale ?? 1);
  let yScale = $state(node.data.yScale ?? 1);
  let fps = $state(node.data.fps ?? 0);

  const DEFAULT_WIDTH = 200;
  const DEFAULT_HEIGHT = 120;
  const MIN_WIDTH = 100;
  const MIN_HEIGHT = 60;

  const displayWidth = $derived(node.width ?? DEFAULT_WIDTH);
  const displayHeight = $derived(node.height ?? DEFAULT_HEIGHT);

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

  function updateScope() {
    if (scopeNode?.latestBuffer) {
      drawWaveform(scopeNode.latestBuffer);
    }

    animationId = requestAnimationFrame(updateScope);
  }

  function drawWaveform(buffer: Float32Array) {
    if (!ctx) return;

    const w = displayWidth;
    const h = displayHeight;

    // Clear canvas
    ctx.fillStyle = '#080809';
    ctx.fillRect(0, 0, w, h);

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

    // Draw waveform
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let x = 0;
    for (let i = 0; i < samplesToShow; i++) {
      const sample = buffer[i] * yScale;
      // Map sample [-1, 1] to canvas y [h, 0], clamped
      const normalized = Math.max(-1, Math.min(1, sample));
      const y = ((1 - normalized) / 2) * h;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
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
        total={1}
        index={0}
        title="Audio input"
        class={`${node.selected ? '' : 'opacity-30 group-hover:opacity-100 sm:opacity-0'}`}
        nodeId={node.id}
      />

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
              max="4096"
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
        </div>
      </div>
    </div>
  {/if}
</div>
