<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals, NodeResizer } from '@xyflow/svelte';
  import { useNodeDataTracker } from '$lib/history';
  import { onMount, onDestroy } from 'svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import ProjectionMapOverflowMenu from './ProjectionMapOverflowMenu.svelte';
  import { MousePointer2, Pen } from '@lucide/svelte/icons';
  import ProjectionMapExpandedEditor from './ProjectionMapExpandedEditor.svelte';
  import ProjectionMapContextMenu from './ProjectionMapContextMenu.svelte';
  import { overrideOutputNodeId } from '../../stores/renderer.store';
  import { isSidebarOpen, sidebarView } from '../../stores/ui.store';
  import { helpViewStore } from '../../stores/help-view.store';
  import type { ProjMapSurface, ProjMapPoint } from './types';
  import { DEFAULT_PROJMAP_NODE_DATA } from './constants';
  import {
    surfaceColor,
    toDisplay,
    toNorm,
    polyPoints,
    findInsertionIndex,
    pointInPolygon
  } from './utils';

  let node: {
    id: string;
    data: { surfaces?: ProjMapSurface[] };
    selected: boolean;
    width?: number;
  } = $props();

  const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const glSystem = GLSystem.getInstance();
  const tracker = useNodeDataTracker(node.id);

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
    void surfaces.length;

    setTimeout(() => updateNodeInternals(node.id), 0);
  });

  // ── State ─────────────────────────────────────────────────────────────────

  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewBitmapContext: ImageBitmapRenderingContext;

  let surfaces = $derived<ProjMapSurface[]>(
    node.data.surfaces ?? DEFAULT_PROJMAP_NODE_DATA.surfaces
  );

  let activeSurfaceId = $state<string | null>(null);

  type EditMode = 'add' | 'move';
  let editMode = $state<EditMode>('add');

  let draggingPointIndex = $state(-1);
  let surfacesBeforeDrag: ProjMapSurface[] = [];

  // move-mode drag state
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPoints: ProjMapPoint[] = [];
  let isDraggingSurface = $state(false);

  let hoverPointIndex = $state(-1);
  let hoverSurfaceId = $state<string | null>(null);
  let hoverInactiveSurface = $state(false);
  let hoverActiveSurface = $state(false);
  let isMouseOverEditor = $state(false);
  let contextMenuSurfaceId = $state<string | null>(null);

  let svgCursor = $derived(
    isDraggingSurface
      ? 'grabbing'
      : editMode === 'move'
        ? hoverActiveSurface || hoverInactiveSurface
          ? 'pointer'
          : 'default'
        : hoverPointIndex !== -1 || hoverInactiveSurface
          ? 'pointer'
          : 'crosshair'
  );

  let expanded = $state(false);

  let editorSvg = $state<SVGSVGElement | null>(null);

  // ── Derived helpers ───────────────────────────────────────────────────────

  let activeSurface = $derived(surfaces.find((s) => s.id === activeSurfaceId) ?? null);

  // ── Surface mutations ─────────────────────────────────────────────────────

  function removeInvalidEdges(validCount: number) {
    const invalid = getEdges().filter((edge) => {
      if (edge.target !== node.id) return false;

      const match = edge.targetHandle?.match(/^video-in-(\d+)$/);

      return match ? parseInt(match[1]) >= validCount : false;
    });

    if (invalid.length > 0) deleteElements({ edges: invalid });
  }

  function addSurface() {
    const old = surfaces;

    const id = crypto.randomUUID();
    const updated: ProjMapSurface[] = [...surfaces, { id, points: [] }];

    applyUpdate(updated);
    tracker.commit('surfaces', old, updated);

    activeSurfaceId = id;
  }

  function deleteSurface(id: string) {
    const old = surfaces;

    let updated: ProjMapSurface[];

    if (surfaces.length <= 1) {
      // Wipe points but keep the surface
      updated = surfaces.map((s) => (s.id === id ? { ...s, points: [] } : s));
    } else {
      updated = surfaces.filter((s) => s.id !== id);

      if (activeSurfaceId === id) {
        activeSurfaceId = updated[updated.length - 1].id;
      }

      removeInvalidEdges(updated.length);
    }

    applyUpdate(updated);
    tracker.commit('surfaces', old, updated);
  }

  function addPoint(surfaceId: string, p: ProjMapPoint, insertAt?: number) {
    const old = surfaces;

    const updated = surfaces.map((s) => {
      if (s.id !== surfaceId) return s;

      const points =
        insertAt !== undefined
          ? [...s.points.slice(0, insertAt), p, ...s.points.slice(insertAt)]
          : [...s.points, p];

      return { ...s, points };
    });

    applyUpdate(updated);
    tracker.commit('surfaces', old, updated);
  }

  const DRAG_RENDER_INTERVAL = 1000 / 15; // ~15fps during drag
  let lastDragRenderTime = 0;

  function movePoint(surfaceId: string, index: number, p: ProjMapPoint) {
    const updated = surfaces.map((s) =>
      s.id === surfaceId ? { ...s, points: s.points.map((pt, i) => (i === index ? p : pt)) } : s
    );

    updateNodeData(node.id, { surfaces: updated });

    const now = performance.now();

    if (now - lastDragRenderTime >= DRAG_RENDER_INTERVAL) {
      lastDragRenderTime = now;

      glSystem.updateProjectionMap(node.id, updated);
    }
  }

  function deleteHoveredPoint() {
    if (hoverSurfaceId !== null && hoverPointIndex !== -1) {
      const old = surfaces;

      const updated = surfaces.map((s) =>
        s.id === hoverSurfaceId
          ? { ...s, points: s.points.filter((_, i) => i !== hoverPointIndex) }
          : s
      );

      applyUpdate(updated);
      tracker.commit('surfaces', old, updated);

      hoverSurfaceId = null;
      hoverPointIndex = -1;
    }
  }

  function applyUpdate(updated: ProjMapSurface[]) {
    updateNodeData(node.id, { surfaces: updated });

    glSystem.updateProjectionMap(node.id, updated);
  }

  function moveSurface(surfaceId: string, dx: number, dy: number, basePoints: ProjMapPoint[]) {
    const updated = surfaces.map((s) => {
      if (s.id !== surfaceId) return s;

      return {
        ...s,
        points: basePoints.map((p) =>
          toNorm(p.x * displayWidth + dx, p.y * displayHeight + dy, displayWidth, displayHeight)
        )
      };
    });

    updateNodeData(node.id, { surfaces: updated });

    const now = performance.now();

    if (now - lastDragRenderTime >= DRAG_RENDER_INTERVAL) {
      lastDragRenderTime = now;

      glSystem.updateProjectionMap(node.id, updated);
    }
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

  function onPointerMove(e: PointerEvent, el: SVGSVGElement) {
    const { x, y } = getSVGPoint(e, el);
    const { w, h } = getEditorSize(el);
    const hit = editMode === 'add' ? findPointAt(x, y, el) : null;

    hoverSurfaceId = hit?.surfaceId ?? null;
    hoverPointIndex = hit?.index ?? -1;

    hoverInactiveSurface =
      !hit &&
      surfaces.some((s) => s.id !== activeSurfaceId && pointInPolygon(x, y, s.points, w, h));

    hoverActiveSurface =
      editMode === 'move' && !!(activeSurface && pointInPolygon(x, y, activeSurface.points, w, h));

    if (editMode === 'add' && draggingPointIndex !== -1 && activeSurfaceId) {
      movePoint(activeSurfaceId, draggingPointIndex, toNorm(x, y, w, h));
    } else if (editMode === 'move' && isDraggingSurface && activeSurfaceId) {
      moveSurface(activeSurfaceId, x - dragStartX, y - dragStartY, dragStartPoints);
    }
  }

  function onPointerDown(e: PointerEvent, el: SVGSVGElement) {
    if (e.button !== 0) return;

    const { x, y } = getSVGPoint(e, el);
    const { w, h } = getEditorSize(el);

    if (editMode === 'move') {
      // In move mode: click any surface (active or not) to select + start dragging it
      const target = surfaces.find((s) => pointInPolygon(x, y, s.points, w, h)) ?? null;
      if (!target) return;

      activeSurfaceId = target.id;

      dragStartX = x;
      dragStartY = y;
      dragStartPoints = target.points.map((p) => ({ ...p }));

      surfacesBeforeDrag = surfaces;
      isDraggingSurface = true;

      el.setPointerCapture(e.pointerId);
      return;
    }

    // add mode
    const hit = findPointAt(x, y, el);

    if (hit) {
      activeSurfaceId = hit.surfaceId;
      draggingPointIndex = hit.index;
      surfacesBeforeDrag = surfaces;

      el.setPointerCapture(e.pointerId);
    } else {
      const hitSurface = surfaces.find(
        (s) => s.id !== activeSurfaceId && pointInPolygon(x, y, s.points, w, h)
      );

      if (hitSurface) {
        activeSurfaceId = hitSurface.id;
        return;
      }

      if (!activeSurfaceId) return;

      const insertAt = activeSurface
        ? findInsertionIndex(x, y, activeSurface.points, w, h)
        : undefined;

      addPoint(activeSurfaceId, toNorm(x, y, w, h), insertAt);

      draggingPointIndex = insertAt ?? activeSurface?.points.length ?? 0;
      surfacesBeforeDrag = surfaces;

      el.setPointerCapture(e.pointerId);
    }
  }

  function onPointerup(e: PointerEvent, el: SVGSVGElement) {
    el.releasePointerCapture(e.pointerId);

    if (isDraggingSurface) {
      isDraggingSurface = false;
      tracker.commit('surfaces', surfacesBeforeDrag, surfaces);

      surfacesBeforeDrag = [];
      glSystem.updateProjectionMap(node.id, surfaces);

      return;
    }

    if (draggingPointIndex !== -1 && surfacesBeforeDrag.length > 0) {
      tracker.commit('surfaces', surfacesBeforeDrag, surfaces);
      surfacesBeforeDrag = [];

      glSystem.updateProjectionMap(node.id, surfaces);
    }

    draggingPointIndex = -1;
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  function onKeydown(e: KeyboardEvent) {
    if (!isMouseOverEditor) return;

    if (e.key === 'm') {
      editMode = editMode === 'add' ? 'move' : 'add';
      return;
    }

    if (e.key !== 'Delete' && e.key !== 'Backspace') return;

    // Always stop propagation when mouse is inside the editor —
    // prevents xyflow from deleting the node while the user is editing points.
    e.stopImmediatePropagation();

    if (editMode === 'move' && (hoverActiveSurface || isDraggingSurface) && activeSurfaceId) {
      deleteSurface(activeSurfaceId);
    } else if (hoverSurfaceId !== null && hoverPointIndex !== -1) {
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
    if (draggingPointIndex !== -1) return;

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
    <div class="absolute inset-x-0 -top-7 h-7"></div>

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
              editMode = editMode === 'add' ? 'move' : 'add';
            }}
          >
            {#if editMode === 'add'}
              <Pen class="h-4 w-4 text-zinc-300" />
            {:else}
              <MousePointer2 class="h-4 w-4 text-blue-400" />
            {/if}
          </button>
        </Tooltip.Trigger>

        <Tooltip.Content
          >{editMode === 'add' ? 'Switch to move mode' : 'Switch to add mode'} (M)</Tooltip.Content
        >
      </Tooltip.Root>

      <ProjectionMapOverflowMenu
        selected={node.selected}
        {activeSurfaceId}
        onexpand={() => (expanded = true)}
        onaddsurface={addSurface}
        ondeletesurface={() => activeSurfaceId && deleteSurface(activeSurfaceId)}
      />
    </div>

    <!-- Canvas + SVG overlay -->
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div class="relative" style="width: {displayWidth}px; height: {displayHeight}px;">
          <!-- Inlets -->
          {#each { length: surfaces.length }, i (i)}
            <TypedHandle
              port="inlet"
              spec={{ handleType: 'video', handleId: i.toString() }}
              title={`Video ${i + 1}`}
              total={surfaces.length}
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
          ></canvas>

          <!-- SVG editor overlay -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <svg
            bind:this={editorSvg}
            class="nodrag nopan absolute inset-0 h-full w-full rounded"
            style="cursor: {svgCursor};"
            onpointerenter={() => (isMouseOverEditor = true)}
            onpointerleave={() => (isMouseOverEditor = false)}
            onpointermove={(e) => editorSvg && onPointerMove(e, editorSvg)}
            onpointerdown={(e) => editorSvg && onPointerDown(e, editorSvg)}
            onpointerup={(e) => editorSvg && onPointerup(e, editorSvg)}
            oncontextmenu={(e) => {
              if (!editorSvg) return;

              const rect = editorSvg.getBoundingClientRect();

              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;

              contextMenuSurfaceId =
                surfaces.find((s) => pointInPolygon(x, y, s.points, rect.width, rect.height))?.id ??
                null;
            }}
          >
            {#each surfaces as surface, si (surface.id)}
              {@const color = surfaceColor(si)}
              {@const isActive = surface.id === activeSurfaceId}
              {@const alpha = isActive ? 1 : 0.35}

              {#if surface.points.length >= 3}
                <polygon
                  points={polyPoints(surface, displayWidth, displayHeight)}
                  fill={color}
                  fill-opacity={isActive ? 0.18 : 0.07}
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
                  r={isDrag ? 9 : isHover ? 8 : 6}
                  fill={isDrag ? '#facc15' : isHover ? '#ffffff' : color}
                  fill-opacity={alpha}
                  stroke="rgba(0,0,0,0.5)"
                  stroke-width="1.5"
                />

                <text
                  x={dp.x + 9}
                  y={dp.y + 3}
                  fill={color}
                  fill-opacity={alpha}
                  font-size="9"
                  font-family="monospace"
                  style="pointer-events: none; user-select: none;">{pi + 1}</text
                >
              {/each}
            {/each}

            {#if activeSurface?.points.length === 0}
              <text
                x={displayWidth / 2}
                y={displayHeight / 2}
                text-anchor="middle"
                dominant-baseline="middle"
                fill="#52525b"
                font-size="11"
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

      <ProjectionMapContextMenu
        {surfaces}
        {activeSurfaceId}
        {contextMenuSurfaceId}
        {editMode}
        {isOutputOverride}
        onexpand={() => (expanded = true)}
        onaddsurface={addSurface}
        ondeletesurface={deleteSurface}
        ontogglemode={() => (editMode = editMode === 'add' ? 'move' : 'add')}
        ontoggleoutput={toggleBgOutput}
        onopenhelp={openHelp}
      />
    </ContextMenu.Root>
  </div>
</div>

{#if expanded}
  <ProjectionMapExpandedEditor
    {surfaces}
    {activeSurfaceId}
    {outputWidth}
    {outputHeight}
    {hoverPointIndex}
    {hoverSurfaceId}
    {hoverInactiveSurface}
    {hoverActiveSurface}
    {draggingPointIndex}
    {editMode}
    {isDraggingSurface}
    onclose={() => (expanded = false)}
    onsurfaceselect={(id) => (activeSurfaceId = id)}
    onaddsurface={addSurface}
    ondeletesurface={deleteSurface}
    ontogglemode={() => (editMode = editMode === 'add' ? 'move' : 'add')}
    onpointerenter={() => (isMouseOverEditor = true)}
    onpointerleave={() => (isMouseOverEditor = false)}
    onpointermove={onPointerMove}
    onpointerdown={onPointerDown}
    onpointerup={onPointerup}
  />
{/if}
