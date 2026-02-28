<script lang="ts">
  import { Transport } from '$lib/transport';
  import { SchedulerRegistry, type FiredEventRecord } from '$lib/transport/SchedulerRegistry';
  import { getNodeTimelineColor } from '$lib/transport/timeline-colors';
  import { onMount } from 'svelte';
  import { match } from 'ts-pattern';

  interface Props {
    width?: number;
  }

  const { width = 500 }: Props = $props();

  const RULER_HEIGHT = 28;
  const FLASH_DURATION_MS = 300;

  // Scale visible bars with width: ~1 bar per 125px, minimum 4
  const barsVisible = $derived(Math.max(4, Math.floor(width / 125)));
  const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 2;

  let wrapperRef = $state<HTMLDivElement>();
  let canvasRef = $state<HTMLCanvasElement>();

  /** Active flash animations keyed by event id. */
  let activeFlashes = new Map<string, { color: string; x: number; wallTime: number }>();

  /** Hover x position in CSS pixels relative to canvas, or null if not hovering. */
  let hoverX = $state<number | null>(null);

  /** Cached window parameters from the last render frame (for pointer event calculations). */
  let lastWindow = { start: 0, duration: 1 };

  function xToTime(x: number): number {
    const cw = wrapperRef?.clientWidth ?? 1;
    return lastWindow.start + (x / cw) * lastWindow.duration;
  }

  function handlePointerMove(e: PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverX = e.clientX - rect.left;
  }

  function handlePointerLeave() {
    hoverX = null;
  }

  function handleClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    Transport.seek(xToTime(x));
  }

  onMount(() => {
    const registry = SchedulerRegistry.getInstance();

    const interval = setInterval(() => {
      if (!canvasRef || !wrapperRef) return;

      const ctx = canvasRef.getContext('2d');
      if (!ctx) return;

      // Measure actual container width (respects mobile constraints)
      const displayWidth = wrapperRef.clientWidth;
      const w = Math.round(displayWidth * DPR);
      const h = Math.round(RULER_HEIGHT * DPR);

      if (canvasRef.width !== w || canvasRef.height !== h) {
        canvasRef.width = w;
        canvasRef.height = h;
      }

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const cw = displayWidth;
      const ch = RULER_HEIGHT;

      const bpm = Transport.bpm;
      const beatsPerBar = Transport.beatsPerBar;
      const currentTime = Transport.seconds;
      const currentBar = Transport.bar;
      const beatDuration = 60 / bpm;
      const barDuration = beatDuration * beatsPerBar;

      // Window: page in chunks of barsVisible so the playhead sweeps across
      const pageStart = Math.floor(currentBar / barsVisible) * barsVisible;
      const windowStart = pageStart * barDuration;
      const windowDuration = barsVisible * barDuration;
      const windowEnd = windowStart + windowDuration;

      lastWindow = { start: windowStart, duration: windowDuration };

      const timeToX = (t: number) => ((t - windowStart) / windowDuration) * cw;

      // Collect fired events and add to flash map
      const firedByNode = registry.getAllFiredEvents();
      for (const [nodeId, events] of firedByNode) {
        const color = getNodeTimelineColor(nodeId);
        for (const ev of events) {
          const x = timeToX(ev.firedAt);
          activeFlashes.set(`${nodeId}:${ev.id}:${ev.wallTime}`, {
            color,
            x,
            wallTime: ev.wallTime
          });
        }
      }

      // Clear
      ctx.clearRect(0, 0, cw, ch);

      // Draw beat grid
      for (let bar = 0; bar < barsVisible; bar++) {
        for (let beat = 0; beat < beatsPerBar; beat++) {
          const t = windowStart + bar * barDuration + beat * beatDuration;
          const x = timeToX(t);

          ctx.strokeStyle = beat === 0 ? '#52525b' : '#3f3f46';
          ctx.lineWidth = beat === 0 ? 1.5 : 0.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, ch);
          ctx.stroke();
        }

        // Bar number label
        const barX = timeToX(windowStart + bar * barDuration);
        ctx.fillStyle = '#71717a';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText(`${pageStart + bar}`, barX + 3, 10);
      }

      // Draw event markers per-node
      const eventsByNode = registry.getAllEvents();
      const nodeIds = Array.from(eventsByNode.keys());
      const nodeCount = nodeIds.length;

      for (let ni = 0; ni < nodeCount; ni++) {
        const nodeId = nodeIds[ni];
        const events = eventsByNode.get(nodeId)!;
        const color = getNodeTimelineColor(nodeId);

        // Vertically offset each node's markers to avoid overlap
        const yBase = 14 + (ni % 3) * 5;

        for (const event of events) {
          match(event.kind)
            .with('beat', () => {
              // Draw markers at beat positions in each visible bar
              const beats = event.beats;
              for (let bar = 0; bar < barsVisible; bar++) {
                for (let b = 0; b < beatsPerBar; b++) {
                  const shouldDraw = beats === '*' || (Array.isArray(beats) && beats.includes(b));

                  if (shouldDraw) {
                    const t = windowStart + bar * barDuration + b * beatDuration;
                    const x = timeToX(t);
                    drawTriangle(ctx, x, yBase, color);
                  }
                }
              }
            })
            .with('schedule', () => {
              if (
                event.time !== undefined &&
                !event.fired &&
                event.time >= windowStart &&
                event.time <= windowEnd
              ) {
                const x = timeToX(event.time);
                drawScheduleMarker(ctx, x, ch, color);
              }
            })
            .with('every', () => {
              if (event.interval && event.lastFired !== undefined) {
                let t = event.lastFired + event.interval;

                // If lastFired is 0 (never fired), start from windowStart
                if (event.lastFired === 0 && t < windowStart) {
                  const periods = Math.ceil((windowStart - t) / event.interval);
                  t += periods * event.interval;
                }

                while (t <= windowEnd) {
                  if (t >= windowStart) {
                    const x = timeToX(t);
                    drawDiamond(ctx, x, yBase, color);
                  }
                  t += event.interval;
                }
              }
            })
            .exhaustive();
        }
      }

      // Draw flash overlays
      const now = performance.now();
      for (const [key, flash] of activeFlashes) {
        const elapsed = now - flash.wallTime;
        if (elapsed > FLASH_DURATION_MS) {
          activeFlashes.delete(key);
          continue;
        }
        const alpha = 1 - elapsed / FLASH_DURATION_MS;
        drawFlash(ctx, flash.x, ch, flash.color, alpha);
      }

      // Draw hover line
      if (hoverX !== null) {
        ctx.strokeStyle = '#a1a1aa';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, ch);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw playhead
      const playheadX = timeToX(currentTime);
      ctx.strokeStyle = '#fafafa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, ch);
      ctx.stroke();
    }, 1000 / 30);

    return () => clearInterval(interval);
  });

  function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x - 3, y + 3);
    ctx.lineTo(x + 3, y + 3);
    ctx.closePath();
    ctx.fill();
  }

  function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x, y + 3);
    ctx.lineTo(x - 3, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawScheduleMarker(ctx: CanvasRenderingContext2D, x: number, h: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFlash(
    ctx: CanvasRenderingContext2D,
    x: number,
    h: number,
    color: string,
    alpha: number
  ) {
    const gradient = ctx.createRadialGradient(x, h / 2, 0, x, h / 2, 12);
    gradient.addColorStop(
      0,
      `${color}${Math.round(alpha * 0.6 * 255)
        .toString(16)
        .padStart(2, '0')}`
    );
    gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 12, 0, 24, h);
  }
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
  onpointermove={handlePointerMove}
  onpointerleave={handlePointerLeave}
  onclick={handleClick}
>
  <canvas bind:this={canvasRef} class="rounded" style="width: 100%; height: 100%;"></canvas>
</div>
