<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Settings, RotateCcw, Lock, LockOpen } from '@lucide/svelte/icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import { NodeResizer, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { curveMessages } from './schema';
  import { useNodeDataTracker } from '$lib/history';
  import {
    type CurvePoint as Point,
    type CurveMode as Mode,
    CURVE_DEFAULT_POINTS as DEFAULT_POINTS,
    CURVE_DEFAULT_WIDTH as DEFAULT_WIDTH,
    CURVE_DEFAULT_HEIGHT as DEFAULT_HEIGHT,
    CURVE_MIN_WIDTH as MIN_WIDTH,
    CURVE_MIN_HEIGHT as MIN_HEIGHT,
    CURVE_POINT_RADIUS as POINT_RADIUS,
    CURVE_HIT_RADIUS as HIT_RADIUS,
    CURVE_DELETE_RADIUS as DELETE_RADIUS,
    CURVE_DELETE_DX as DELETE_DX,
    CURVE_DELETE_DY as DELETE_DY,
    CURVE_PADDING as PADDING
  } from './constants';
  import { toSvg, fromSvg, buildPath, evaluate, getHoveredIdx } from './utils';
  import CurveSettings from './CurveSettings.svelte';

  let node: {
    id: string;
    data: { points?: Point[]; mode?: Mode; locked?: boolean };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const tracker = useNodeDataTracker(node.id);

  let messageContext: MessageContext;
  let showSettings = $state(false);
  let svgEl: SVGSVGElement;

  const displayWidth = $derived(node.width ?? DEFAULT_WIDTH);
  const displayHeight = $derived(node.height ?? DEFAULT_HEIGHT);
  const points = $derived<Point[]>(node.data.points ?? DEFAULT_POINTS);
  const mode = $derived<Mode>(node.data.mode ?? 'linear');
  const isLocked = $derived(node.data.locked ?? false);

  const innerW = $derived(displayWidth - PADDING * 2);
  const innerH = $derived(displayHeight - PADDING * 2);

  const pathData = $derived(buildPath(mode, points, innerW, innerH));

  // Area fill path: close the curve down to the bottom edge
  const fillPath = $derived.by(() => {
    if (!pathData || points.length < 2) return '';
    const [sx0] = toSvg(points[0], innerW, innerH);
    const [sxN] = toSvg(points[points.length - 1], innerW, innerH);
    const bottom = PADDING + innerH;
    return `M ${sx0},${bottom} ` + pathData.replace(/^M /, 'L ') + ` L ${sxN},${bottom} Z`;
  });

  // Unique IDs for SVG defs (gradient + clip)
  const gradientId = $derived(`cg-${node.id}`);
  const clipId = $derived(`cc-${node.id}`);

  // ── Hover & drag state ────────────────────────────────────────────────────

  let hoveredIdx = $state(-1);
  let dragIndex = $state(-1);
  let dragStartPoints: Point[] = [];
  let isMouseOver = $state(false);

  function getSvgCoords(event: PointerEvent): [number, number] {
    const rect = svgEl.getBoundingClientRect();
    const scaleX = displayWidth / rect.width;
    const scaleY = displayHeight / rect.height;
    return [(event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY];
  }

  // ── Pointer handlers ──────────────────────────────────────────────────────

  function onSvgPointerDown(event: PointerEvent) {
    if (event.button !== 0 || isLocked) return;
    const [sx, sy] = getSvgCoords(event);

    // Skip adding if near an existing point
    if (getHoveredIdx(sx, sy, points, innerW, innerH) !== -1) return;

    const pt = fromSvg(sx, sy, innerW, innerH);
    const newPt: Point = { x: Math.max(0.001, Math.min(0.999, pt.x)), y: pt.y };
    const newPoints = [...points, newPt].sort((a, b) => a.x - b.x);
    updateNodeData(node.id, { points: newPoints });

    const idx = newPoints.findIndex((p) => p === newPt);
    dragIndex = idx;
    hoveredIdx = idx;
    dragStartPoints = newPoints.map((p) => ({ ...p }));
    svgEl.setPointerCapture(event.pointerId);
    event.stopPropagation();
  }

  function onPointPointerDown(event: PointerEvent, index: number) {
    if (event.button !== 0 || isLocked) return;
    dragIndex = index;
    dragStartPoints = points.map((p) => ({ ...p }));
    svgEl.setPointerCapture(event.pointerId);
    event.stopPropagation();
  }

  function onSvgPointerMove(event: PointerEvent) {
    const [sx, sy] = getSvgCoords(event);

    if (dragIndex < 0) {
      hoveredIdx = getHoveredIdx(sx, sy, points, innerW, innerH);
      return;
    }

    const pt = fromSvg(sx, sy, innerW, innerH);
    const n = points.length;
    const isEndpoint = dragIndex === 0 || dragIndex === n - 1;
    const newPoints = points.map((p) => ({ ...p }));

    if (isEndpoint) {
      newPoints[dragIndex] = { x: newPoints[dragIndex].x, y: pt.y };
    } else {
      const xMin = (newPoints[dragIndex - 1]?.x ?? 0) + 0.001;
      const xMax = (newPoints[dragIndex + 1]?.x ?? 1) - 0.001;
      newPoints[dragIndex] = { x: Math.max(xMin, Math.min(xMax, pt.x)), y: pt.y };
    }

    updateNodeData(node.id, { points: newPoints });
  }

  function onSvgPointerUp() {
    if (dragIndex < 0) return;
    tracker.commit('points', dragStartPoints, points);
    dragIndex = -1;
    dragStartPoints = [];
  }

  function onSvgPointerLeave() {
    if (dragIndex < 0) hoveredIdx = -1;
    isMouseOver = false;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function deletePoint(index: number) {
    if (index === 0 || index === points.length - 1) return;
    const oldPoints = points.map((p) => ({ ...p }));
    const newPoints = points.filter((_, i) => i !== index);
    updateNodeData(node.id, { points: newPoints });
    tracker.commit('points', oldPoints, newPoints);
    hoveredIdx = -1;
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  function setMode(newMode: Mode) {
    const oldMode = mode;
    updateNodeData(node.id, { mode: newMode });
    tracker.commit('mode', oldMode, newMode);
  }

  function resetPoints() {
    const oldPoints = points.map((p) => ({ ...p }));
    updateNodeData(node.id, { points: DEFAULT_POINTS });
    tracker.commit('points', oldPoints, DEFAULT_POINTS);
  }

  function toggleLock() {
    const oldLocked = isLocked;
    updateNodeData(node.id, { locked: !oldLocked });
    tracker.commit('locked', oldLocked, !oldLocked);
  }

  // ── Message handling ──────────────────────────────────────────────────────

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(curveMessages.float, (x) => {
        messageContext.send(evaluate(mode, x, points));
      })
      .with(messages.bang, () => {
        messageContext.send(points.flatMap((p) => [p.x, p.y]));
      })
      .with(messages.reset, () => {
        resetPoints();
      })
      .with(curveMessages.list, (arr) => {
        if (arr.length < 4 || arr.length % 2 !== 0) return;
        const newPts: Point[] = [];
        for (let i = 0; i < arr.length; i += 2) {
          newPts.push({
            x: Math.max(0, Math.min(1, arr[i])),
            y: Math.max(0, Math.min(1, arr[i + 1]))
          });
        }
        const sorted = newPts.sort((a, b) => a.x - b.x);
        const oldPoints = points.map((p) => ({ ...p }));
        updateNodeData(node.id, { points: sorted });
        tracker.commit('points', oldPoints, sorted);
      })
      .otherwise(() => {});
  };

  onMount(() => {
    messageContext = new MessageContext(node.id);
    messageContext.queue.addCallback(handleMessage);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'x') {
        // Mouse is over the canvas — intercept to prevent accidental node deletion
        if (isMouseOver) {
          e.stopImmediatePropagation();
          // Delete hovered non-endpoint breakpoint (only when not locked)
          if (!isLocked && hoveredIdx > 0 && hoveredIdx < points.length - 1) {
            deletePoint(hoveredIdx);
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
  });

  $effect(() => {
    displayWidth;
    displayHeight;
    setTimeout(() => updateNodeInternals(), 0);
  });
</script>

<div class="relative">
  <NodeResizer isVisible={node.selected} minWidth={MIN_WIDTH} minHeight={MIN_HEIGHT} />

  <div class="group relative">
    <!-- Title label (safe click target for selecting without entering canvas) -->
    {#if node.selected || isLocked}
      <div
        class="absolute -top-7 left-0 z-10 flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2 py-1"
      >
        <span class="font-mono text-xs font-medium text-zinc-400">curve</span>
        {#if isLocked}
          <Lock class="h-3 w-3 text-zinc-500" />
        {/if}
      </div>
    {/if}

    <!-- Header buttons -->
    <div class="absolute -top-7 right-0 z-10 flex gap-x-1">
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class={[
              'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
              node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            ]}
            onclick={(e) => {
              e.stopPropagation();
              resetPoints();
            }}
          >
            <RotateCcw class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Reset points</Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class={[
              'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
              isLocked ? 'text-white opacity-100' : 'text-zinc-500 hover:text-zinc-300',
              !isLocked && (node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')
            ]}
            onclick={(e) => {
              e.stopPropagation();
              toggleLock();
            }}
          >
            {#if isLocked}
              <Lock class="h-4 w-4" />
            {:else}
              <LockOpen class="h-4 w-4" />
            {/if}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>{isLocked ? 'Unlock curve' : 'Lock curve'}</Tooltip.Content>
      </Tooltip.Root>
      <button
        class={[
          'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
          node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        ]}
        onclick={(e) => {
          e.stopPropagation();
          showSettings = !showSettings;
        }}
      >
        <Settings class="h-4 w-4 text-zinc-300" />
      </button>
    </div>

    <div class="relative">
      <StandardHandle
        port="inlet"
        type="message"
        total={1}
        index={0}
        title="x input (float) or bang / reset / list"
        nodeId={node.id}
      />

      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <svg
            bind:this={svgEl}
            width={displayWidth}
            height={displayHeight}
            class={[
              'nodrag rounded border bg-zinc-950',
              isLocked ? 'cursor-default' : 'cursor-crosshair',
              node.selected ? 'object-container-selected' : 'border-zinc-800'
            ]}
            onpointerenter={() => (isMouseOver = true)}
            onpointerdown={onSvgPointerDown}
            onpointermove={onSvgPointerMove}
            onpointerup={onSvgPointerUp}
            onpointerleave={onSvgPointerLeave}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#4ade80" stop-opacity="0.15" />
                <stop offset="100%" stop-color="#4ade80" stop-opacity="0" />
              </linearGradient>
              <clipPath id={clipId}>
                <rect x={PADDING} y={PADDING} width={innerW} height={innerH} />
              </clipPath>
            </defs>

            <!-- Grid lines -->
            {#each [0.25, 0.5, 0.75] as t}
              <line
                x1={PADDING + t * innerW}
                y1={PADDING}
                x2={PADDING + t * innerW}
                y2={PADDING + innerH}
                stroke="#272729"
                stroke-width="1"
                pointer-events="none"
                opacity={t === 0.5 ? 0.4 : 0.3}
              />

              <line
                x1={PADDING}
                y1={PADDING + (1 - t) * innerH}
                x2={PADDING + innerW}
                y2={PADDING + (1 - t) * innerH}
                stroke={t === 0.5 ? '#3f3f46' : '#272729'}
                opacity={t === 0.5 ? 0.4 : 0.3}
                stroke-width="1"
                pointer-events="none"
              />
            {/each}

            <!-- Area fill -->
            {#if fillPath}
              <path
                d={fillPath}
                fill="url(#{gradientId})"
                stroke="none"
                pointer-events="none"
                clip-path="url(#{clipId})"
              />
            {/if}

            <!-- Curve / line path -->
            {#if pathData}
              <path
                d={pathData}
                fill="none"
                stroke="#4ade80"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                pointer-events="none"
              />
            {/if}

            <!-- Points -->
            {#each points as point, i}
              {@const [sx, sy] = toSvg(point, innerW, innerH)}
              {@const isEndpoint = i === 0 || i === points.length - 1}
              {@const isHovered = hoveredIdx === i}
              {@const isDragging = dragIndex === i}

              <!-- Transparent hit area -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <circle
                cx={sx}
                cy={sy}
                r={HIT_RADIUS}
                fill="transparent"
                pointer-events="all"
                class={isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
                onpointerdown={(e) => onPointPointerDown(e, i)}
              />

              <!-- Visual circle -->
              <circle
                cx={sx}
                cy={sy}
                r={isHovered || isDragging ? POINT_RADIUS + 1 : POINT_RADIUS}
                fill={isDragging || isHovered ? '#4ade80' : '#18181b'}
                stroke={isEndpoint ? '#a1a1aa' : '#4ade80'}
                stroke-width="1.5"
                pointer-events="none"
              />

              <!-- Delete button (non-endpoints, on hover, not locked) -->
              {#if isHovered && !isEndpoint && !isLocked}
                {@const bx = sx + DELETE_DX}
                {@const by = sy + DELETE_DY}
                {@const s = DELETE_RADIUS * 0.45}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <circle
                  cx={bx}
                  cy={by}
                  r={DELETE_RADIUS}
                  fill="#3f3f46"
                  stroke="#71717a"
                  stroke-width="1"
                  class="cursor-pointer"
                  pointer-events="all"
                  onpointerdown={(e) => {
                    e.stopPropagation();
                    deletePoint(i);
                  }}
                />
                <line
                  x1={bx - s}
                  y1={by - s}
                  x2={bx + s}
                  y2={by + s}
                  stroke="white"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  pointer-events="none"
                />
                <line
                  x1={bx + s}
                  y1={by - s}
                  x2={bx - s}
                  y2={by + s}
                  stroke="white"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  pointer-events="none"
                />
              {/if}

              <!-- Coordinate label on hover -->
              {#if isHovered}
                <text
                  x={sx}
                  y={sy + POINT_RADIUS + 13}
                  text-anchor="middle"
                  fill="#a1a1aa"
                  font-size="9"
                  pointer-events="none"
                >
                  ({point.x.toFixed(2)}, {point.y.toFixed(2)})
                </text>
              {/if}
            {/each}
          </svg>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item onclick={toggleLock} class="gap-2">
            {#if isLocked}
              <LockOpen class="h-3.5 w-3.5" />
              Unlock curve
            {:else}
              <Lock class="h-3.5 w-3.5" />
              Lock curve
            {/if}
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item onclick={resetPoints} class="gap-2">
            <RotateCcw class="h-3.5 w-3.5" />
            Reset points
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>

      <StandardHandle
        port="outlet"
        type="message"
        total={1}
        index={0}
        title="y output"
        nodeId={node.id}
      />
    </div>
  </div>

  <!-- Settings panel -->
  {#if showSettings}
    <div class="absolute top-0 z-20" style="left: {displayWidth + 10}px">
      <CurveSettings {mode} onModeChange={setMode} onClose={() => (showSettings = false)} />
    </div>
  {/if}
</div>
