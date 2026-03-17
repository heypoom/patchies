<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals, NodeResizer } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import {
    Expand,
    Shrink,
    Plus,
    Trash2,
    Monitor,
    MonitorOff,
    CircleHelp
  } from '@lucide/svelte/icons';
  import { overrideOutputNodeId } from '../../stores/renderer.store';
  import { isSidebarOpen, sidebarView } from '../../stores/ui.store';
  import { helpViewStore } from '../../stores/help-view.store';
  import type { ProjMapSurface, ProjMapPoint } from './types';
  import {
    PROJMAP_VIDEO_INLET_COUNT,
    SURFACE_COLORS,
    DEFAULT_PROJMAP_NODE_DATA
  } from './constants';

  let node: {
    id: string;
    data: { surfaces?: ProjMapSurface[] };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const glSystem = GLSystem.getInstance();

  const [outputWidth, outputHeight] = glSystem.outputSize;
  const outputAspect = outputWidth / outputHeight;

  const MIN_W = 160;
  const MIN_H = Math.round(MIN_W / outputAspect);

  // ── Dimensions ────────────────────────────────────────────────────────────

  // Node resizer drives width; height is locked to output aspect ratio
  let displayWidth = $derived(node.width ?? 400);
  let displayHeight = $derived(Math.round(displayWidth / outputAspect));

  $effect(() => {
    void displayWidth;

    setTimeout(() => updateNodeInternals(node.id), 0);
  });

  // ── State ─────────────────────────────────────────────────────────────────

  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewBitmapContext: ImageBitmapRenderingContext;

  let surfaces = $derived<ProjMapSurface[]>(
    node.data.surfaces ?? DEFAULT_PROJMAP_NODE_DATA.surfaces
  );
  let activeSurfaceId = $state<string | null>(null);

  let draggingPointIndex = $state(-1);
  let hoverPointIndex = $state(-1);
  let hoverSurfaceId = $state<string | null>(null);
  let isMouseOverEditor = $state(false);

  let expanded = $state(false);

  // ── Portal action — teleports a node to document.body so position:fixed ──
  // ── works correctly even inside xyflow's CSS-transformed node container ──
  function portal(el: HTMLElement) {
    document.body.appendChild(el);
    return {
      destroy() {
        el.remove();
      }
    };
  }

  let editorSvg = $state<SVGSVGElement | null>(null);
  let expandSvg = $state<SVGSVGElement | null>(null);

  // ── Derived helpers ───────────────────────────────────────────────────────

  let activeSurface = $derived(surfaces.find((s) => s.id === activeSurfaceId) ?? null);

  function surfaceColor(index: number) {
    return SURFACE_COLORS[index % SURFACE_COLORS.length];
  }

  // ── Normalize / denormalize ───────────────────────────────────────────────

  function toDisplay(p: ProjMapPoint, w: number, h: number) {
    return { x: p.x * w, y: p.y * h };
  }

  function toNorm(x: number, y: number, w: number, h: number): ProjMapPoint {
    return {
      x: Math.max(0, Math.min(1, x / w)),
      y: Math.max(0, Math.min(1, y / h))
    };
  }

  // ── Surface mutations ─────────────────────────────────────────────────────

  function addSurface() {
    const id = crypto.randomUUID();
    const updated: ProjMapSurface[] = [...surfaces, { id, points: [] }];
    commit(updated);
    activeSurfaceId = id;
  }

  function deleteSurface(id: string) {
    const updated = surfaces.filter((s) => s.id !== id);
    commit(updated);
    if (activeSurfaceId === id) {
      activeSurfaceId = updated.length > 0 ? updated[updated.length - 1].id : null;
    }
  }

  function addPoint(surfaceId: string, p: ProjMapPoint) {
    const updated = surfaces.map((s) =>
      s.id === surfaceId ? { ...s, points: [...s.points, p] } : s
    );
    commit(updated);
  }

  function movePoint(surfaceId: string, index: number, p: ProjMapPoint) {
    const updated = surfaces.map((s) =>
      s.id === surfaceId ? { ...s, points: s.points.map((pt, i) => (i === index ? p : pt)) } : s
    );
    commit(updated);
  }

  function deleteHoveredPoint() {
    if (hoverSurfaceId !== null && hoverPointIndex !== -1) {
      const updated = surfaces.map((s) =>
        s.id === hoverSurfaceId
          ? { ...s, points: s.points.filter((_, i) => i !== hoverPointIndex) }
          : s
      );
      commit(updated);
      hoverSurfaceId = null;
      hoverPointIndex = -1;
    }
  }

  function commit(updated: ProjMapSurface[]) {
    updateNodeData(node.id, { surfaces: updated });
    glSystem.updateProjectionMap(node.id, updated);
  }

  // ── Pointer interaction ───────────────────────────────────────────────────

  const POINT_RADIUS = 7;
  const POINT_HIT = POINT_RADIUS + 6;

  function getSVGPoint(e: PointerEvent, el: SVGSVGElement) {
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function getEditorSize(el: SVGSVGElement) {
    const rect = el.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  function findPointAt(x: number, y: number, el: SVGSVGElement) {
    const { w, h } = getEditorSize(el);
    for (const surface of surfaces) {
      for (let i = 0; i < surface.points.length; i++) {
        const dp = toDisplay(surface.points[i], w, h);
        if (Math.hypot(x - dp.x, y - dp.y) < POINT_HIT) {
          return { surfaceId: surface.id, index: i };
        }
      }
    }
    return null;
  }

  function onPointermove(e: PointerEvent, el: SVGSVGElement) {
    const { x, y } = getSVGPoint(e, el);
    const { w, h } = getEditorSize(el);
    const hit = findPointAt(x, y, el);
    hoverSurfaceId = hit?.surfaceId ?? null;
    hoverPointIndex = hit?.index ?? -1;

    if (draggingPointIndex !== -1 && activeSurfaceId) {
      movePoint(activeSurfaceId, draggingPointIndex, toNorm(x, y, w, h));
    }
  }

  function onPointerdown(e: PointerEvent, el: SVGSVGElement) {
    if (e.button !== 0) return;
    const { x, y } = getSVGPoint(e, el);
    const { w, h } = getEditorSize(el);
    const hit = findPointAt(x, y, el);

    if (hit) {
      activeSurfaceId = hit.surfaceId;
      draggingPointIndex = hit.index;
      el.setPointerCapture(e.pointerId);
    } else if (activeSurfaceId) {
      addPoint(activeSurfaceId, toNorm(x, y, w, h));
      // New point is last — index is current length before add (will be length after)
      draggingPointIndex = activeSurface?.points.length ?? 0;
      el.setPointerCapture(e.pointerId);
    }
  }

  function onPointerup(e: PointerEvent, el: SVGSVGElement) {
    el.releasePointerCapture(e.pointerId);
    draggingPointIndex = -1;
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (!isMouseOverEditor) return;
    // Always stop propagation when mouse is inside the editor —
    // prevents xyflow from deleting the node while the user is editing points.
    e.stopImmediatePropagation();
    if (hoverSurfaceId !== null && hoverPointIndex !== -1) {
      deleteHoveredPoint();
    }
  }

  // ── Background output ─────────────────────────────────────────────────────

  let isOutputOverride = $derived($overrideOutputNodeId === node.id);

  function toggleBgOutput() {
    const next = isOutputOverride ? null : node.id;
    overrideOutputNodeId.set(next);
    glSystem.setOverrideOutputNode(next);
  }

  function openHelp() {
    helpViewStore.setLastViewed({ type: 'object', object: 'projmap' });
    sidebarView.set('help');
    isSidebarOpen.set(true);
  }

  // ── SVG helpers ───────────────────────────────────────────────────────────

  function polyPoints(surface: ProjMapSurface, w: number, h: number): string {
    return surface.points.map((p) => `${p.x * w},${p.y * h}`).join(' ');
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onMount(() => {
    if (previewCanvas) {
      previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
    }
    glSystem.previewCanvasContexts[node.id] = previewBitmapContext;
    glSystem.upsertNode(node.id, 'projmap', { surfaces });
    setTimeout(() => glSystem.setPreviewEnabled(node.id, true), 50);

    if (surfaces.length === 0) {
      addSurface();
    } else {
      activeSurfaceId = surfaces[surfaces.length - 1].id;
    }

    window.addEventListener('keydown', onKeydown, { capture: true });
  });

  onDestroy(() => {
    glSystem?.removeNode(node.id);
    window.removeEventListener('keydown', onKeydown, { capture: true });
  });

  $effect(() => {
    glSystem.upsertNode(node.id, 'projmap', { surfaces });
  });
</script>

<!-- ── Node ────────────────────────────────────────────────────────────────── -->
<div class="relative">
  <NodeResizer
    isVisible={node.selected && draggingPointIndex < 0}
    minWidth={MIN_W}
    minHeight={MIN_H}
    keepAspectRatio
  />

  <div class="group relative">
    <!-- Hover bridge so group-hover stays active between title and body -->
    <div class="absolute inset-x-0 -top-7 h-7" />

    <!-- Title -->
    <div
      class={[
        'absolute -top-7 left-0 z-10 flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2 py-1 transition-opacity',
        node.selected
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
      ]}
    >
      <span class="font-mono text-xs font-medium text-zinc-400">projmap</span>
    </div>

    <!-- Header buttons (top-right) -->
    <div class="absolute -top-7 right-0 z-10 flex gap-x-1">
      <!-- Surface tabs + texture selector -->
      {#each surfaces as surface, si (surface.id)}
        <button
          class={[
            'cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs transition-opacity',
            node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          ]}
          style="color: {surfaceColor(si)}; background: {activeSurfaceId === surface.id
            ? 'rgba(255,255,255,0.12)'
            : 'transparent'};"
          onclick={(e) => {
            e.stopPropagation();
            activeSurfaceId = surface.id;
          }}
        >
          {si + 1}
        </button>
      {/each}

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class={[
              'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
              node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            ]}
            onclick={(e) => {
              e.stopPropagation();
              addSurface();
            }}
          >
            <Plus class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Add surface</Tooltip.Content>
      </Tooltip.Root>

      {#if activeSurfaceId}
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class={[
                'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
                node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              ]}
              onclick={(e) => {
                e.stopPropagation();
                if (activeSurfaceId) deleteSurface(activeSurfaceId);
              }}
            >
              <Trash2 class="h-4 w-4 text-zinc-400 hover:text-red-400" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Delete surface</Tooltip.Content>
        </Tooltip.Root>
      {/if}

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class={[
              'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
              node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            ]}
            onclick={(e) => {
              e.stopPropagation();
              expanded = true;
            }}
          >
            <Expand class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Expand editor (1:1)</Tooltip.Content>
      </Tooltip.Root>
    </div>

    <!-- Canvas + SVG overlay -->
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div class="relative" style="width: {displayWidth}px; height: {displayHeight}px;">
          <!-- Inlets -->
          {#each Array.from({ length: PROJMAP_VIDEO_INLET_COUNT }) as _, i (i)}
            <TypedHandle
              port="inlet"
              spec={{ handleType: 'video', handleId: i.toString() }}
              title={`Video ${i}`}
              total={PROJMAP_VIDEO_INLET_COUNT}
              index={i}
              nodeId={node.id}
            />
          {/each}

          <!-- Render preview -->
          <canvas
            bind:this={previewCanvas}
            width={outputWidth}
            height={outputHeight}
            class="absolute inset-0 h-full w-full rounded"
          />

          <!-- SVG editor overlay -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <svg
            bind:this={editorSvg}
            class="nodrag nopan absolute inset-0 h-full w-full cursor-crosshair rounded"
            onpointerenter={() => (isMouseOverEditor = true)}
            onpointerleave={() => (isMouseOverEditor = false)}
            onpointermove={(e) => editorSvg && onPointermove(e, editorSvg)}
            onpointerdown={(e) => editorSvg && onPointerdown(e, editorSvg)}
            onpointerup={(e) => editorSvg && onPointerup(e, editorSvg)}
          >
            {#each surfaces as surface, si (surface.id)}
              {@const color = surfaceColor(si)}
              {@const isActive = surface.id === activeSurfaceId}
              {@const alpha = isActive ? 1 : 0.3}

              {#if surface.points.length >= 3}
                <polygon
                  points={polyPoints(surface, displayWidth, displayHeight)}
                  fill={color}
                  fill-opacity={0.12 * (isActive ? 2 : 1)}
                  stroke={color}
                  stroke-width="1.5"
                  stroke-opacity={alpha}
                />
              {:else if surface.points.length === 2}
                <line
                  x1={surface.points[0].x * displayWidth}
                  y1={surface.points[0].y * displayHeight}
                  x2={surface.points[1].x * displayWidth}
                  y2={surface.points[1].y * displayHeight}
                  stroke={color}
                  stroke-width="1.5"
                  stroke-opacity={alpha}
                />
              {/if}

              {#each surface.points as pt, pi (pi)}
                {@const dp = toDisplay(pt, displayWidth, displayHeight)}
                {@const isHover = hoverSurfaceId === surface.id && hoverPointIndex === pi}
                {@const isDrag = activeSurfaceId === surface.id && draggingPointIndex === pi}
                <circle
                  cx={dp.x}
                  cy={dp.y}
                  r={isDrag ? POINT_RADIUS + 2 : POINT_RADIUS}
                  fill={isDrag ? '#facc15' : isHover ? '#ffffff' : color}
                  fill-opacity={alpha}
                  stroke="rgba(0,0,0,0.5)"
                  stroke-width="1"
                />
                <text
                  x={dp.x}
                  y={dp.y}
                  text-anchor="middle"
                  dominant-baseline="middle"
                  fill="rgba(0,0,0,0.7)"
                  font-size="8"
                  style="pointer-events: none; user-select: none;">{pi + 1}</text
                >
              {/each}
            {/each}

            {#if surfaces.length === 0 || (activeSurface && activeSurface.points.length === 0)}
              <text
                x={displayWidth / 2}
                y={displayHeight / 2}
                text-anchor="middle"
                dominant-baseline="middle"
                fill="#52525b"
                font-size="12"
                font-family="sans-serif">Click to add points</text
              >
            {/if}
          </svg>

          <!-- Outlet -->
          <TypedHandle
            port="outlet"
            spec={{ handleType: 'video', handleId: '0' }}
            title="Video Out"
            total={1}
            index={0}
            nodeId={node.id}
          />
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Content>
        <ContextMenu.Item onclick={toggleBgOutput}>
          {#if isOutputOverride}
            <MonitorOff class="mr-2 h-4 w-4 text-orange-400" />
            Remove background output
          {:else}
            <Monitor class="mr-2 h-4 w-4" />
            Output to background
          {/if}
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onclick={openHelp}>
          <CircleHelp class="mr-2 h-4 w-4" />
          Help
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  </div>
</div>

<!-- ── Expand overlay (fixed, outside node boundary) ─────────────────────── -->
{#if expanded}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    use:portal
    class="fixed inset-0 z-[9999] flex flex-col bg-zinc-950"
    role="dialog"
    aria-label="Projection Map Editor"
    onkeydown={(e) => e.key === 'Escape' && (expanded = false)}
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
            onclick={() => (activeSurfaceId = surface.id)}
          >
            surface {si + 1}
          </button>
        {/each}
      </div>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            onclick={() => activeSurfaceId && deleteSurface(activeSurfaceId)}
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
            onclick={addSurface}
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
            onclick={() => (expanded = false)}
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
        bind:this={expandSvg}
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair"
        style="width: min(100vw, {outputWidth}px); height: min(calc(100vh - 48px), {outputHeight}px);"
        viewBox="0 0 {outputWidth} {outputHeight}"
        preserveAspectRatio="xMidYMid meet"
        onpointerenter={() => (isMouseOverEditor = true)}
        onpointerleave={() => (isMouseOverEditor = false)}
        onpointermove={(e) => expandSvg && onPointermove(e, expandSvg)}
        onpointerdown={(e) => expandSvg && onPointerdown(e, expandSvg)}
        onpointerup={(e) => expandSvg && onPointerup(e, expandSvg)}
      >
        <!-- Grid -->
        {#each Array.from({ length: 10 }) as _, i (i)}
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
              font-family="monospace">{pi}</text
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
{/if}
