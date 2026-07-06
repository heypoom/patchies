<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { MeterAudioNode } from '$objects/meter~/MeterAudioNode';
  import { useEdges } from '@xyflow/svelte';
  import {
    checkAudioConnections,
    getAudioInletConnectionKey
  } from '$lib/composables/checkHandleConnections';
  import { shouldShowHandles } from '../../stores/ui.store';
  import {
    amplitudeToMeterPosition,
    updateMeterChannels,
    type MeterChannelState
  } from '$lib/audio/meter-utils';

  const HIDDEN_HANDLE_CLASS = 'opacity-30 group-hover:opacity-100 sm:opacity-0';

  let node: {
    id: string;
    data: { smoothing?: number; peakHold?: boolean };
    selected: boolean;
  } = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let animationId: number;
  let audioService = AudioService.getInstance();

  const edges = useEdges();
  const connections = $derived(checkAudioConnections(edges.current, node.id));
  const audioInletConnectionKey = $derived(getAudioInletConnectionKey(edges.current, node.id));

  // Meter state
  let meterChannels = $state<MeterChannelState[]>([{ level: 0, peak: 0, peakHoldTime: 0 }]);
  let previousAudioInletConnectionKey: string | null = null;

  // Configuration
  const smoothing = $derived(node.data.smoothing ?? 0.8);
  const peakHold = $derived(node.data.peakHold ?? true);

  const CANVAS_HEIGHT = 100;
  const BAR_WIDTH = 12;
  const BAR_GAP = 2;
  const TICK_WIDTH = 2;
  const HORIZONTAL_PADDING = 2;

  const channelCount = $derived(Math.max(1, meterChannels.length));

  const canvasWidth = $derived(
    TICK_WIDTH * 2 +
      HORIZONTAL_PADDING * 2 +
      channelCount * BAR_WIDTH +
      Math.max(0, channelCount - 1) * BAR_GAP
  );

  function getCanvasPixelRatio() {
    return Math.max(1, window.devicePixelRatio || 1);
  }

  function ensureCanvasSize() {
    const pixelRatio = getCanvasPixelRatio();
    const backingWidth = Math.round(canvasWidth * pixelRatio);
    const backingHeight = Math.round(CANVAS_HEIGHT * pixelRatio);

    if (canvas.width !== backingWidth) {
      canvas.width = backingWidth;
    }

    if (canvas.height !== backingHeight) {
      canvas.height = backingHeight;
    }

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function updateMeter() {
    const audioNodeById = audioService.getNodeById(node.id);

    if (audioNodeById instanceof MeterAudioNode) {
      meterChannels = updateMeterChannels({
        previous: meterChannels,
        levels: audioNodeById.latestLevels,
        smoothing,
        peakHold,
        now: Date.now()
      });
    }

    drawMeter();
    animationId = requestAnimationFrame(updateMeter);
  }

  function drawMeter() {
    if (!ctx) return;

    ensureCanvasSize();

    // Clear canvas
    ctx.fillStyle = '#080809';
    ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT);

    drawBarMeter();
  }

  function drawBarMeter() {
    const gradient = ctx.createLinearGradient(0, CANVAS_HEIGHT, 0, 0);
    gradient.addColorStop(0, '#22c55e'); // Green at bottom
    gradient.addColorStop(0.7, '#eab308'); // Yellow at middle
    gradient.addColorStop(1, '#ef4444'); // Red at top

    meterChannels.forEach((channel, index) => {
      const x = TICK_WIDTH + HORIZONTAL_PADDING + index * (BAR_WIDTH + BAR_GAP);
      const levelHeight = Math.round(amplitudeToMeterPosition(channel.level) * CANVAS_HEIGHT);
      const peakHeight = Math.round(amplitudeToMeterPosition(channel.peak) * CANVAS_HEIGHT);

      ctx.fillStyle = gradient;
      ctx.fillRect(x, CANVAS_HEIGHT - levelHeight, BAR_WIDTH, levelHeight);

      if (peakHold && channel.peak > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 2, CANVAS_HEIGHT - peakHeight - 1, BAR_WIDTH + 4, 2);
      }
    });

    ctx.fillStyle = '#52525b';

    for (let i = 0; i <= 10; i++) {
      const y = (i / 10) * CANVAS_HEIGHT;

      ctx.fillRect(0, CANVAS_HEIGHT - y, 3, 1);
      ctx.fillRect(canvasWidth - TICK_WIDTH, CANVAS_HEIGHT - y, TICK_WIDTH, 1);
    }
  }

  $effect(() => {
    const connectionKey = audioInletConnectionKey;

    if (previousAudioInletConnectionKey === null) {
      previousAudioInletConnectionKey = connectionKey;
      return;
    }

    if (connectionKey === previousAudioInletConnectionKey) return;

    meterChannels = [{ level: 0, peak: 0, peakHoldTime: 0 }];

    const audioNodeById = audioService.getNodeById(node.id);
    if (audioNodeById instanceof MeterAudioNode) {
      audioNodeById.latestLevels = [0];
    }

    previousAudioInletConnectionKey = connectionKey;
  });

  onMount(() => {
    audioService.createNode(node.id, 'meter~');

    if (canvas) {
      ctx = canvas.getContext('2d')!;

      updateMeter();
    }
  });

  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    // Clean up meter~ node
    audioService.removeNodeById(node.id);
  });

  const handleInletClass = $derived(
    node.selected || $shouldShowHandles || connections.hasInlet ? '' : HIDDEN_HANDLE_CLASS
  );
</script>

<div class="group relative">
  <div class="relative">
    <TypedHandle
      port="inlet"
      spec={{ handleType: 'audio' }}
      total={1}
      index={0}
      title="Audio input"
      class={handleInletClass}
      nodeId={node.id}
    />

    <canvas
      bind:this={canvas}
      class={[
        'rounded border bg-zinc-900',
        node.selected ? 'object-container-selected' : 'border-zinc-600'
      ]}
      style="width: {canvasWidth}px; height: {CANVAS_HEIGHT}px;"
    ></canvas>
  </div>
</div>
