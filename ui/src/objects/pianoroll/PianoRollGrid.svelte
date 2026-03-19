<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Transport } from '$lib/transport';
  import {
    PPQ,
    NOTE_HEIGHT,
    RULER_HEIGHT,
    QUANTIZE_TICKS,
    COLORS,
    type PianoRollNote,
    type PianoRollMode
  } from './types';

  const BLACK_NOTES = new Set([1, 3, 6, 8, 10]);
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function noteName(n: number): string {
    return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
  }

  let {
    notes = [],
    scrollNote = 48,
    visibleNotes = 24,
    zoom = 60,
    lengthBars = 2,
    quantize = '1/16',
    mode = 'idle' as PianoRollMode,
    onNoteAdd,
    onNoteDelete,
    onScroll
  }: {
    notes?: PianoRollNote[];
    scrollNote?: number;
    visibleNotes?: number;
    zoom?: number;
    lengthBars?: number;
    quantize?: string;
    mode?: PianoRollMode;
    onNoteAdd?: (note: PianoRollNote) => void;
    onNoteDelete?: (index: number) => void;
    onScroll?: (delta: number) => void;
  } = $props();

  let canvas: HTMLCanvasElement;
  let rafId: number;
  let dpr = 1;
  let hoveredIndex: number | null = null;
  let playheadLeft = 0;

  const totalBeats = $derived(lengthBars * Transport.beatsPerBar);
  const gridWidth = $derived(Math.max(totalBeats * zoom, 1));
  const gridHeight = $derived(visibleNotes * NOTE_HEIGHT);
  const canvasHeight = $derived(gridHeight + RULER_HEIGHT);

  function noteLeft(tick: number) {
    return (tick / PPQ) * zoom;
  }
  function noteTop(note: number) {
    return RULER_HEIGHT + (scrollNote + visibleNotes - 1 - note) * NOTE_HEIGHT;
  }
  function noteWidth(durationTicks: number) {
    return Math.max((durationTicks / PPQ) * zoom, 4);
  }
  function isVisible(note: number) {
    return note >= scrollNote && note < scrollNote + visibleNotes;
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sync buffer size to logical size × DPR
    const bw = Math.round(gridWidth * dpr);
    const bh = Math.round(canvasHeight * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;

    // Scale once so all drawing uses logical (CSS pixel) coordinates
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = gridWidth;
    const h = canvasHeight;
    ctx.clearRect(0, 0, w, h);

    // Row backgrounds
    for (let i = 0; i < visibleNotes; i++) {
      const note = scrollNote + visibleNotes - 1 - i;
      ctx.fillStyle = BLACK_NOTES.has(note % 12) ? COLORS.bgBlackRow : COLORS.bgWhiteRow;
      ctx.fillRect(0, RULER_HEIGHT + i * NOTE_HEIGHT, w, NOTE_HEIGHT);
    }

    // Subdivision lines
    const gridTicks = QUANTIZE_TICKS[quantize] ?? PPQ / 4;
    const subdivisionsPerBeat = PPQ / gridTicks;
    if (subdivisionsPerBeat > 1) {
      ctx.fillStyle = COLORS.subdivLine;
      for (let b = 0; b < totalBeats; b++) {
        for (let s = 1; s < subdivisionsPerBeat; s++) {
          ctx.fillRect((b + s / subdivisionsPerBeat) * zoom, RULER_HEIGHT, 1, gridHeight);
        }
      }
    }

    // Beat / bar lines
    for (let beat = 0; beat <= totalBeats; beat++) {
      ctx.fillStyle = beat % Transport.beatsPerBar === 0 ? COLORS.barLine : COLORS.beatLine;
      ctx.fillRect(beat * zoom, RULER_HEIGHT, 1, gridHeight);
    }

    // Ruler background + border
    ctx.fillStyle = COLORS.ruler;
    ctx.fillRect(0, 0, w, RULER_HEIGHT);
    ctx.fillStyle = COLORS.rulerBorder;
    ctx.fillRect(0, RULER_HEIGHT - 1, w, 1);

    // Ruler labels + ticks
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';
    for (let bar = 0; bar <= lengthBars; bar++) {
      const x = bar * Transport.beatsPerBar * zoom;
      ctx.fillStyle = COLORS.rulerText;
      ctx.fillText(String(bar + 1), x + 3, RULER_HEIGHT / 2);
      ctx.fillStyle = COLORS.barLine;
      ctx.fillRect(x, RULER_HEIGHT - 6, 1, 6);
    }
    for (let beat = 0; beat <= totalBeats; beat++) {
      if (beat % Transport.beatsPerBar !== 0) {
        ctx.fillStyle = COLORS.beatLine;
        ctx.fillRect(beat * zoom, RULER_HEIGHT - 4, 1, 4);
      }
    }

    // Notes
    ctx.font = '8px monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (!isVisible(note.note)) continue;
      const x = noteLeft(note.tick);
      const y = noteTop(note.note);
      const nw = noteWidth(note.durationTicks);
      const nh = NOTE_HEIGHT - 1;
      const alpha = 0.55 + (note.velocity / 127) * 0.45;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = hoveredIndex === i ? COLORS.noteHover : COLORS.noteBase;
      ctx.beginPath();
      ctx.roundRect(x, y, nw, nh, 2);
      ctx.fill();
      // Subtle top highlight line
      ctx.globalAlpha = alpha * 0.45;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + 1, y + 1, Math.max(nw - 2, 1), 1);
      ctx.globalAlpha = 1;
      if (nw > 20) {
        ctx.fillStyle = COLORS.noteText;
        ctx.fillText(noteName(note.note), x + 3, y + nh / 2);
      }
    }

    // Playhead — 2px wide, bright white
    if (mode !== 'idle' && mode !== 'armed') {
      ctx.fillStyle = COLORS.playhead;
      ctx.fillRect(Math.max(playheadLeft - 1, 0), 0, 2, h);
    }
  }

  // e.offsetX/offsetY give logical CSS pixels relative to the canvas origin,
  // correctly handling scroll offset and flow zoom without any SvelteFlow API.
  function hitTestNote(x: number, y: number): number {
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      if (!isVisible(note.note)) continue;
      const nx = noteLeft(note.tick);
      const ny = noteTop(note.note);
      const nw = noteWidth(note.durationTicks);
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + NOTE_HEIGHT - 1) return i;
    }
    return -1;
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0 || !onNoteAdd) return;
    const x = e.offsetX;
    const adjustedY = e.offsetY - RULER_HEIGHT;
    if (adjustedY < 0) return;
    const gridTicks = QUANTIZE_TICKS[quantize] ?? PPQ / 4;
    const tick = Math.floor(((x / zoom) * PPQ) / gridTicks) * gridTicks;
    const note = scrollNote + visibleNotes - 1 - Math.floor(adjustedY / NOTE_HEIGHT);
    if (note < 0 || note > 127) return;
    onNoteAdd({ tick, durationTicks: gridTicks, note, velocity: 100, channel: 1 });
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    const idx = hitTestNote(e.offsetX, e.offsetY);
    if (idx >= 0) onNoteDelete?.(idx);
  }

  function handleMouseMove(e: MouseEvent) {
    const idx = hitTestNote(e.offsetX, e.offsetY);
    const next = idx >= 0 ? idx : null;
    if (next !== hoveredIndex) {
      hoveredIndex = next;
      draw();
    }
  }

  function handleMouseLeave() {
    if (hoveredIndex !== null) {
      hoveredIndex = null;
      draw();
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    onScroll?.(e.deltaY > 0 ? -2 : 2);
  }

  function loop() {
    const clipLengthTicks = lengthBars * Transport.beatsPerBar * PPQ * (4 / Transport.denominator);
    const relTick = clipLengthTicks > 0 ? Transport.ticks % clipLengthTicks : 0;
    playheadLeft = (relTick / PPQ) * zoom;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  onMount(() => {
    dpr = window.devicePixelRatio || 1;
    rafId = requestAnimationFrame(loop);
  });
  onDestroy(() => cancelAnimationFrame(rafId));
</script>

<canvas
  bind:this={canvas}
  class="block select-none"
  style="width: {gridWidth}px; height: {canvasHeight}px; min-width: 100%; cursor: crosshair;"
  onpointerdown={handlePointerDown}
  oncontextmenu={handleContextMenu}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  onwheel={handleWheel}
></canvas>
