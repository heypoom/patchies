import { Transport } from '$lib/transport';

import { SchedulerRegistry } from '$lib/transport/SchedulerRegistry';
import { getNodeTimelineColor } from '$lib/transport/timeline-colors';
import { match } from 'ts-pattern';
import { RULER_FLASH_DURATION_MS, RULER_HEIGHT } from './constants';

type DrawEventMarkerParams = {
  ctx: CanvasRenderingContext2D;
  windowStart: number;
  windowEnd: number;
  barDuration: number;
  beatDuration: number;
  barsVisible: number;
  canvasHeight: number;
  timeToX: (t: number) => number;
};

type EventDrawContext = DrawEventMarkerParams & { color: string; yBase: number };

export class TimelineRulerRenderer {
  private activeFlashes = new Map<string, { color: string; x: number; wallTime: number }>();
  private _lastWindow = { start: 0, duration: 1 };
  private readonly DPR: number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly wrapper: HTMLElement
  ) {
    this.DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 2;
  }

  get lastWindow() {
    return this._lastWindow;
  }

  xToTime(x: number): number {
    const cw = this.wrapper.clientWidth ?? 1;

    return this._lastWindow.start + (x / cw) * this._lastWindow.duration;
  }

  render(barsVisible: number, hoverX: number | null, isDragging: boolean): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const displayWidth = this.wrapper.clientWidth;
    const w = Math.round(displayWidth * this.DPR);
    const h = Math.round(RULER_HEIGHT * this.DPR);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

    const canvasWidth = displayWidth;
    const canvasHeight = RULER_HEIGHT;

    const beatDuration = (60 / Transport.bpm) * (4 / Transport.denominator);
    const barDuration = beatDuration * Transport.beatsPerBar;

    const pageStart = Math.floor(Transport.bar / barsVisible) * barsVisible;
    const windowStart = pageStart * barDuration;
    const windowDuration = barsVisible * barDuration;
    const windowEnd = windowStart + windowDuration;

    if (!isDragging) {
      this._lastWindow = { start: windowStart, duration: windowDuration };
    }

    const timeToX = (t: number) => ((t - windowStart) / windowDuration) * canvasWidth;

    // Collect fired events and add to flash map
    const registry = SchedulerRegistry.getInstance();
    const firedByNode = registry.getAllFiredEvents();

    for (const [nodeId, events] of firedByNode) {
      const color = getNodeTimelineColor(nodeId);

      for (const ev of events) {
        const x = timeToX(ev.firedAt);

        this.activeFlashes.set(`${nodeId}:${ev.id}:${ev.wallTime}`, {
          color,
          x,
          wallTime: ev.wallTime
        });
      }
    }

    // Clear
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw beat grid
    for (let bar = 0; bar < barsVisible; bar++) {
      for (let beat = 0; beat < Transport.beatsPerBar; beat++) {
        const t = windowStart + bar * barDuration + beat * beatDuration;
        const x = timeToX(t);

        ctx.strokeStyle = beat === 0 ? '#52525b' : '#3f3f46';
        ctx.lineWidth = beat === 0 ? 1.5 : 0.5;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }

      // Bar number label
      const barX = timeToX(windowStart + bar * barDuration);

      ctx.fillStyle = '#71717a';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(`${pageStart + bar}`, barX + 3, 10);
    }

    // Draw event markers per-node
    this.drawEventMarkers(registry, {
      ctx,
      barsVisible,
      windowStart,
      windowEnd,
      barDuration,
      beatDuration,
      canvasHeight,
      timeToX
    });

    // Draw flash overlays
    const now = performance.now();

    for (const [key, flash] of this.activeFlashes) {
      const elapsed = now - flash.wallTime;

      if (elapsed > RULER_FLASH_DURATION_MS) {
        this.activeFlashes.delete(key);
        continue;
      }

      const alpha = 1 - elapsed / RULER_FLASH_DURATION_MS;
      this.drawFlash(ctx, flash.x, canvasHeight, flash.color, alpha);
    }

    // Draw hover line
    if (hoverX !== null) {
      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, canvasHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw playhead
    const playheadX = timeToX(Transport.seconds);

    ctx.strokeStyle = '#fafafa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvasHeight);
    ctx.stroke();
  }

  private drawEventMarkers(registry: SchedulerRegistry, params: DrawEventMarkerParams): void {
    const eventsByNode = registry.getAllEvents();
    const nodeIds = Array.from(eventsByNode.keys());

    for (let nodeIndex = 0; nodeIndex < nodeIds.length; nodeIndex++) {
      const nodeId = nodeIds[nodeIndex];
      const events = eventsByNode.get(nodeId)!;

      const drawCtx: EventDrawContext = {
        ...params,
        color: getNodeTimelineColor(nodeId),
        yBase: 14 + (nodeIndex % 3) * 5
      };

      for (const event of events) {
        match(event.kind)
          .with('beat', () => this.drawBeatEvent(event.beats, drawCtx))
          .with('schedule', () => this.drawScheduleEvent(event.time, event.fired, drawCtx))
          .with('every', () => this.drawEveryEvent(event.interval, drawCtx))
          .exhaustive();
      }
    }
  }

  private drawBeatEvent(beats: number[] | '*' | undefined, ctx: EventDrawContext): void {
    for (let bar = 0; bar < ctx.barsVisible; bar++) {
      for (let beat = 0; beat < Transport.beatsPerBar; beat++) {
        const shouldDraw = beats === '*' || (Array.isArray(beats) && beats.includes(beat));

        if (shouldDraw) {
          this.drawTriangle(
            ctx.ctx,
            ctx.timeToX(ctx.windowStart + bar * ctx.barDuration + beat * ctx.beatDuration),
            ctx.yBase,
            ctx.color
          );
        }
      }
    }
  }

  private drawScheduleEvent(
    time: number | undefined,
    fired: boolean | undefined,
    ctx: EventDrawContext
  ): void {
    if (time !== undefined && !fired && time >= ctx.windowStart && time <= ctx.windowEnd) {
      const x = ctx.timeToX(time);

      ctx.ctx.strokeStyle = ctx.color;
      ctx.ctx.lineWidth = 1.5;

      ctx.ctx.setLineDash([3, 3]);
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(x, 0);
      ctx.ctx.lineTo(x, ctx.canvasHeight);
      ctx.ctx.stroke();
      ctx.ctx.setLineDash([]);
    }
  }

  private drawEveryEvent(interval: number | undefined, ctx: EventDrawContext): void {
    if (!interval) return;

    // Anchor to absolute time (multiples of interval from 0)
    // so markers don't shift when lastFired changes during scrubbing
    let t = Math.ceil(ctx.windowStart / interval) * interval;

    while (t <= ctx.windowEnd) {
      if (t >= ctx.windowStart && t > Transport.seconds) {
        this.drawDiamond(ctx.ctx, ctx.timeToX(t), ctx.yBase, ctx.color);
      }

      t += interval;
    }
  }

  private drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x - 3, y + 3);
    ctx.lineTo(x + 3, y + 3);
    ctx.closePath();
    ctx.fill();
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x, y + 3);
    ctx.lineTo(x - 3, y);
    ctx.closePath();
    ctx.fill();
  }

  private drawFlash(
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
}
