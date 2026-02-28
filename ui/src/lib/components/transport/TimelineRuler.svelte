<script lang="ts">
  import { Transport } from '$lib/transport';
  import { onMount } from 'svelte';
  import { MIN_RULER_WIDTH, RULER_HEIGHT } from './constants';
  import { TimelineRulerRenderer } from './TimelineRulerRenderer';

  interface Props {
    width?: number;
  }

  const { width = MIN_RULER_WIDTH }: Props = $props();

  // Scale visible bars with width: ~1 bar per 125px, minimum 4
  const barsVisible = $derived(Math.max(4, Math.floor(width / 125)));

  let wrapperRef = $state<HTMLDivElement>();
  let canvasRef = $state<HTMLCanvasElement>();
  let hoverX = $state<number | null>(null);
  let isDragging = $state(false);
  let renderer: TimelineRulerRenderer | null = null;

  function handlePointerDown(e: PointerEvent) {
    isDragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    seekFromEvent(e);
  }

  function handlePointerMove(e: PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverX = e.clientX - rect.left;

    if (isDragging) seekFromEvent(e);
  }

  function handlePointerUp() {
    isDragging = false;
  }

  function handlePointerLeave() {
    hoverX = null;
  }

  function seekFromEvent(e: PointerEvent) {
    if (!renderer) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const t = renderer.xToTime(x);
    const maxTime = renderer.lastWindow.start + renderer.lastWindow.duration - 0.001;

    Transport.seek(Math.max(0, Math.min(t, maxTime)));
  }

  onMount(() => {
    renderer = new TimelineRulerRenderer(canvasRef!, wrapperRef!);

    const interval = setInterval(() => {
      if (!canvasRef || !wrapperRef) return;

      renderer!.render(barsVisible, hoverX, isDragging);
    }, 1000 / 30);

    return () => clearInterval(interval);
  });
</script>

<div
  bind:this={wrapperRef}
  style="width: {width}px; max-width: 100%; height: {RULER_HEIGHT}px;"
  class="cursor-pointer"
  role="slider"
  tabindex="0"
  aria-label="Timeline seek"
  aria-valuemin={0}
  aria-valuenow={Transport.seconds}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointerleave={handlePointerLeave}
>
  <canvas bind:this={canvasRef} class="rounded" style="width: 100%; height: 100%;"></canvas>
</div>
