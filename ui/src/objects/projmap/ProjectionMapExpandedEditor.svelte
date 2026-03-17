<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Plus, Trash2, Shrink } from '@lucide/svelte/icons';
  import type { ProjMapSurface } from './types';

  let {
    surfaces,
    activeSurfaceId,
    outputWidth,
    outputHeight,
    hoverPointIndex,
    hoverSurfaceId,
    draggingPointIndex,
    surfaceColor,
    polyPoints,
    onclose,
    onsurfaceselect,
    onaddsurface,
    ondeletesurface,
    onpointerenter,
    onpointerleave,
    onpointermove,
    onpointerdown,
    onpointerup
  }: {
    surfaces: ProjMapSurface[];
    activeSurfaceId: string | null;
    outputWidth: number;
    outputHeight: number;
    hoverPointIndex: number;
    hoverSurfaceId: string | null;
    draggingPointIndex: number;
    surfaceColor: (i: number) => string;
    polyPoints: (surface: ProjMapSurface, w: number, h: number) => string;
    onclose: () => void;
    onsurfaceselect: (id: string) => void;
    onaddsurface: () => void;
    ondeletesurface: (id: string) => void;
    onpointerenter: () => void;
    onpointerleave: () => void;
    onpointermove: (e: PointerEvent, svg: SVGSVGElement) => void;
    onpointerdown: (e: PointerEvent, svg: SVGSVGElement) => void;
    onpointerup: (e: PointerEvent, svg: SVGSVGElement) => void;
  } = $props();

  let svg = $state<SVGSVGElement | null>(null);

  let activeSurface = $derived(surfaces.find((s) => s.id === activeSurfaceId) ?? null);

  function toDisplay(p: { x: number; y: number }, w: number, h: number) {
    return { x: p.x * w, y: p.y * h };
  }

  function portal(el: HTMLElement) {
    document.body.appendChild(el);
    return {
      destroy() {
        el.remove();
      }
    };
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  use:portal
  class="fixed inset-0 z-[9999] flex flex-col bg-zinc-950"
  role="dialog"
  aria-label="Projection Map Editor"
  onkeydown={(e) => e.key === 'Escape' && onclose()}
>
  <!-- Toolbar -->
  <div class="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-2">
    <span class="font-mono text-sm text-zinc-400">projmap</span>

    <div class="flex flex-1 gap-1 overflow-x-auto">
      {#each surfaces as surface, si (surface.id)}
        <button
          class="cursor-pointer rounded px-2 py-1 font-mono text-sm transition-colors"
          style="color: {surfaceColor(si)}; background: {activeSurfaceId === surface.id
            ? 'rgba(255,255,255,0.1)'
            : 'transparent'};"
          onclick={() => onsurfaceselect(surface.id)}
        >
          surface {si + 1}
        </button>
      {/each}
    </div>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          onclick={() => activeSurfaceId && ondeletesurface(activeSurfaceId)}
          disabled={!activeSurfaceId}
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Delete surface</Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onclick={onaddsurface}
        >
          <Plus class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Add surface</Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onclick={onclose}
        >
          <Shrink class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Close (Escape)</Tooltip.Content>
    </Tooltip.Root>
  </div>

  <!-- Editor area: render preview + 1:1 SVG editor -->
  <div class="relative flex-1 overflow-hidden">
    <!-- Preview bitmap as background reference -->
    <canvas
      width={outputWidth}
      height={outputHeight}
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50"
      style="max-width: 100%; max-height: 100%; object-fit: contain;"
    />

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg
      bind:this={svg}
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      style="cursor: {hoverPointIndex !== -1
        ? 'pointer'
        : 'crosshair'}; width: min(100vw, {outputWidth}px); height: min(calc(100vh - 48px), {outputHeight}px);"
      viewBox="0 0 {outputWidth} {outputHeight}"
      preserveAspectRatio="xMidYMid meet"
      {onpointerenter}
      {onpointerleave}
      onpointermove={(e) => svg && onpointermove(e, svg)}
      onpointerdown={(e) => svg && onpointerdown(e, svg)}
      onpointerup={(e) => svg && onpointerup(e, svg)}
    >
      <!-- Grid -->
      {#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as i (i)}
        <line
          x1={(i / 10) * outputWidth}
          y1="0"
          x2={(i / 10) * outputWidth}
          y2={outputHeight}
          stroke="#27272a"
          stroke-width="1"
        />
        <line
          x1="0"
          y1={(i / 10) * outputHeight}
          x2={outputWidth}
          y2={(i / 10) * outputHeight}
          stroke="#27272a"
          stroke-width="1"
        />
      {/each}

      {#each surfaces as surface, si (surface.id)}
        {@const color = surfaceColor(si)}
        {@const isActive = surface.id === activeSurfaceId}
        {@const alpha = isActive ? 1 : 0.35}

        {#if surface.points.length >= 3}
          <polygon
            points={polyPoints(surface, outputWidth, outputHeight)}
            fill={color}
            fill-opacity={isActive ? 0.18 : 0.07}
            stroke={color}
            stroke-width="2"
            stroke-opacity={alpha}
          />
        {:else if surface.points.length === 2}
          <line
            x1={surface.points[0].x * outputWidth}
            y1={surface.points[0].y * outputHeight}
            x2={surface.points[1].x * outputWidth}
            y2={surface.points[1].y * outputHeight}
            stroke={color}
            stroke-width="2"
            stroke-opacity={alpha}
          />
        {/if}

        {#each surface.points as pt, pi (pi)}
          {@const dp = toDisplay(pt, outputWidth, outputHeight)}
          {@const isHover = hoverSurfaceId === surface.id && hoverPointIndex === pi}
          {@const isDrag = activeSurfaceId === surface.id && draggingPointIndex === pi}
          <circle
            cx={dp.x}
            cy={dp.y}
            r={isDrag ? 11 : isHover ? 10 : 8}
            fill={isDrag ? '#facc15' : isHover ? '#ffffff' : color}
            fill-opacity={alpha}
            stroke="rgba(0,0,0,0.5)"
            stroke-width="1.5"
          />
          <text
            x={dp.x + 13}
            y={dp.y + 4}
            fill={color}
            fill-opacity={alpha}
            font-size="11"
            font-family="monospace"
            style="pointer-events: none; user-select: none;">{pi + 1}</text
          >
        {/each}
      {/each}

      {#if activeSurface?.points.length === 0}
        <text
          x={outputWidth / 2}
          y={outputHeight / 2}
          text-anchor="middle"
          dominant-baseline="middle"
          fill="#52525b"
          font-size="18"
          font-family="sans-serif">Click to add points — Delete / Backspace to remove</text
        >
      {/if}
    </svg>
  </div>
</div>
