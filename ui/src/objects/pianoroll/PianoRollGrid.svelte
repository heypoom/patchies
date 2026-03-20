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
    onNoteUpdate,
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
    onNoteUpdate?: (index: number, patch: Partial<PianoRollNote>) => void;
    onScroll?: (delta: number) => void;
  } = $props();

  type DragState =
    | { type: 'drawing'; note: number; startTick: number; currentTick: number; gridTicks: number }
    | {
        type: 'moving';
        index: number;
        origTick: number;
        origNote: number;
        tickOffset: number;
        currentTick: number;
        currentNote: number;
        gridTicks: number;
      }
    | {
        type: 'resizing';
        index: number;
        origDuration: number;
        currentDuration: number;
        gridTicks: number;
      };

  let canvas: HTMLCanvasElement;
  let rafId: number;
  let dpr = 1;
  let hoveredIndex: number | null = null;
  let playheadLeft = 0;
  let dragState: DragState | null = $state(null);
  let cursor = $state('crosshair');

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

    // Notes — skip the actively dragged note (drawn separately as preview)
    const skipIndex =
      dragState?.type === 'moving' || dragState?.type === 'resizing' ? dragState.index : -1;
    ctx.font = '8px monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < notes.length; i++) {
      if (i === skipIndex) continue;
      const note = notes[i];
      if (!isVisible(note.note)) continue;
      const x = noteLeft(note.tick);
      const y = noteTop(note.note);
      const nw = noteWidth(note.durationTicks);
      const nh = NOTE_HEIGHT - 1;
      const hue = (note.note * 8) % 360;
      const alpha = 0.35 + (note.velocity / 127) * 0.65;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = hoveredIndex === i ? `hsl(${hue}, 70%, 72%)` : `hsl(${hue}, 70%, 58%)`;
      ctx.beginPath();
      ctx.roundRect(x, y, nw, nh, 2);
      ctx.fill();
      // Subtle top highlight line
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x + 1, y + 1, Math.max(nw - 2, 1), 1);
      ctx.globalAlpha = 1;
      if (nw > 20) {
        ctx.fillStyle = COLORS.noteText;
        ctx.fillText(noteName(note.note), x + 3, y + nh / 2);
      }
    }

    // Drag preview
    if (dragState) {
      ctx.font = '8px monospace';
      ctx.textBaseline = 'middle';
      if (dragState.type === 'drawing') {
        const { note: noteNum, startTick, currentTick } = dragState;
        if (isVisible(noteNum)) {
          const hue = (noteNum * 8) % 360;
          const x = noteLeft(startTick);
          const y = noteTop(noteNum);
          const nw = noteWidth(Math.max(currentTick - startTick, dragState.gridTicks));
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = `hsl(${hue}, 70%, 72%)`;
          ctx.beginPath();
          ctx.roundRect(x, y, nw, NOTE_HEIGHT - 1, 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else if (dragState.type === 'moving') {
        const { currentTick, currentNote } = dragState;
        const orig = notes[dragState.index];
        if (orig && isVisible(currentNote)) {
          const hue = (currentNote * 8) % 360;
          const x = noteLeft(currentTick);
          const y = noteTop(currentNote);
          const nw = noteWidth(orig.durationTicks);
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = `hsl(${hue}, 70%, 72%)`;
          ctx.beginPath();
          ctx.roundRect(x, y, nw, NOTE_HEIGHT - 1, 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else if (dragState.type === 'resizing') {
        const orig = notes[dragState.index];
        if (orig && isVisible(orig.note)) {
          const hue = (orig.note * 8) % 360;
          const x = noteLeft(orig.tick);
          const y = noteTop(orig.note);
          const nw = noteWidth(dragState.currentDuration);
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = `hsl(${hue}, 70%, 72%)`;
          ctx.beginPath();
          ctx.roundRect(x, y, nw, NOTE_HEIGHT - 1, 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    // Playhead — 2px wide, colored by mode
    if (mode !== 'idle' && mode !== 'armed') {
      ctx.fillStyle = mode === 'recording' ? '#ef4444' : mode === 'looping' ? '#3b82f6' : '#6366f1';
      ctx.fillRect(Math.max(playheadLeft - 1, 0), 0, 2, h);
    }
  }

  // e.offsetX/offsetY give logical CSS pixels relative to the canvas origin,
  // correctly handling scroll offset and flow zoom without any SvelteFlow API.

  const EDGE_HIT_WIDTH = 6;

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

  /** Returns note index if x,y lands on the right resize edge, else -1. */
  function hitTestEdge(x: number, y: number): number {
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      if (!isVisible(note.note)) continue;
      const nx = noteLeft(note.tick);
      const ny = noteTop(note.note);
      const nw = noteWidth(note.durationTicks);
      if (y >= ny && y <= ny + NOTE_HEIGHT - 1 && x >= nx + nw - EDGE_HIT_WIDTH && x <= nx + nw)
        return i;
    }
    return -1;
  }

  function snapTick(rawTick: number, gridTicks: number): number {
    return gridTicks > 0 ? Math.round(rawTick / gridTicks) * gridTicks : Math.floor(rawTick);
  }

  function xToNote(y: number): number {
    return scrollNote + visibleNotes - 1 - Math.floor((y - RULER_HEIGHT) / NOTE_HEIGHT);
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);

    const x = e.offsetX;
    const y = e.offsetY;
    const gridTicks = QUANTIZE_TICKS[quantize] ?? PPQ / 4;

    // Right edge → resize
    const edgeIdx = hitTestEdge(x, y);
    if (edgeIdx >= 0) {
      dragState = {
        type: 'resizing',
        index: edgeIdx,
        origDuration: notes[edgeIdx].durationTicks,
        currentDuration: notes[edgeIdx].durationTicks,
        gridTicks
      };
      cursor = 'ew-resize';
      return;
    }

    // Note body → move
    const bodyIdx = hitTestNote(x, y);
    if (bodyIdx >= 0) {
      const n = notes[bodyIdx];
      const clickTick = (x / zoom) * PPQ;
      dragState = {
        type: 'moving',
        index: bodyIdx,
        origTick: n.tick,
        origNote: n.note,
        tickOffset: clickTick - n.tick,
        currentTick: n.tick,
        currentNote: n.note,
        gridTicks
      };
      cursor = 'grabbing';
      return;
    }

    // Empty space → draw
    if (y < RULER_HEIGHT) return;
    const startTick = Math.max(0, snapTick((x / zoom) * PPQ, gridTicks));
    const noteNum = xToNote(y);
    if (noteNum < 0 || noteNum > 127) return;
    dragState = {
      type: 'drawing',
      note: noteNum,
      startTick,
      currentTick: startTick + gridTicks,
      gridTicks
    };
    cursor = 'crosshair';
  }

  function handlePointerMove(e: PointerEvent) {
    const x = e.offsetX;
    const y = e.offsetY;

    if (!dragState) {
      // Update hover highlight and cursor
      const edgeIdx = hitTestEdge(x, y);
      if (edgeIdx >= 0) {
        cursor = 'ew-resize';
        if (hoveredIndex !== null) {
          hoveredIndex = null;
          draw();
        }
        return;
      }
      const bodyIdx = hitTestNote(x, y);
      const next = bodyIdx >= 0 ? bodyIdx : null;
      cursor = bodyIdx >= 0 ? 'grab' : 'crosshair';
      if (next !== hoveredIndex) {
        hoveredIndex = next;
        draw();
      }
      return;
    }

    const { gridTicks } = dragState;

    if (dragState.type === 'drawing') {
      const rawTick = (x / zoom) * PPQ;
      const snapped = Math.max(snapTick(rawTick, gridTicks), dragState.startTick + gridTicks);
      if (snapped !== dragState.currentTick) {
        dragState = { ...dragState, currentTick: snapped };
      }
    } else if (dragState.type === 'moving') {
      const rawTick = (x / zoom) * PPQ - dragState.tickOffset;
      const newTick = Math.max(0, snapTick(rawTick, gridTicks));
      const newNote = Math.max(0, Math.min(127, xToNote(y)));
      if (newTick !== dragState.currentTick || newNote !== dragState.currentNote) {
        dragState = { ...dragState, currentTick: newTick, currentNote: newNote };
      }
    } else if (dragState.type === 'resizing') {
      const orig = notes[dragState.index];
      const rawDuration = ((x - noteLeft(orig.tick)) / zoom) * PPQ;
      const snapped = Math.max(gridTicks || 1, snapTick(rawDuration, gridTicks));
      if (snapped !== dragState.currentDuration) {
        dragState = { ...dragState, currentDuration: snapped };
      }
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!dragState) return;
    canvas.releasePointerCapture(e.pointerId);

    if (dragState.type === 'drawing' && onNoteAdd) {
      const dur = Math.max(dragState.currentTick - dragState.startTick, dragState.gridTicks);
      onNoteAdd({
        tick: dragState.startTick,
        durationTicks: dur,
        note: dragState.note,
        velocity: 100,
        channel: 1
      });
    } else if (dragState.type === 'moving' && onNoteUpdate) {
      if (
        dragState.currentTick !== dragState.origTick ||
        dragState.currentNote !== dragState.origNote
      ) {
        onNoteUpdate(dragState.index, { tick: dragState.currentTick, note: dragState.currentNote });
      }
    } else if (dragState.type === 'resizing' && onNoteUpdate) {
      if (dragState.currentDuration !== dragState.origDuration) {
        onNoteUpdate(dragState.index, { durationTicks: dragState.currentDuration });
      }
    }

    dragState = null;
    cursor = 'crosshair';
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (dragState) return; // ignore right-click during drag
    const idx = hitTestNote(e.offsetX, e.offsetY);
    if (idx >= 0) onNoteDelete?.(idx);
  }

  let isMouseOver = false;

  function handlePointerEnter() {
    isMouseOver = true;
  }

  function handlePointerLeave() {
    isMouseOver = false;
    if (dragState) return;
    if (hoveredIndex !== null) {
      hoveredIndex = null;
      draw();
    }
    cursor = 'crosshair';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isMouseOver) return;
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;

    // Prevent xyflow from deleting the node while the user is editing notes
    e.stopImmediatePropagation();

    if (hoveredIndex !== null) {
      onNoteDelete?.(hoveredIndex);
      hoveredIndex = null;
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
    window.addEventListener('keydown', handleKeydown, { capture: true });
  });
  onDestroy(() => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', handleKeydown, { capture: true });
  });
</script>

<canvas
  bind:this={canvas}
  class="block select-none"
  style="width: {gridWidth}px; height: {canvasHeight}px; min-width: 100%; cursor: {cursor};"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  oncontextmenu={handleContextMenu}
  onpointerenter={handlePointerEnter}
  onpointerleave={handlePointerLeave}
  onwheel={handleWheel}
></canvas>
