<script lang="ts">
  import { onMount } from 'svelte';
  import { NOTE_HEIGHT, RULER_HEIGHT, PIANO_KEY_WIDTH, COLORS } from './types';

  const BLACK_NOTES = new Set([1, 3, 6, 8, 10]);
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let {
    scrollNote = 48,
    visibleNotes = 24,
    activeNotes = new Set<number>(),
    onPreviewNote
  }: {
    scrollNote?: number;
    visibleNotes?: number;
    activeNotes?: Set<number>;
    onPreviewNote?: (note: number) => void;
  } = $props();

  let canvas: HTMLCanvasElement;
  let dpr = 1;

  const canvasHeight = $derived(visibleNotes * NOTE_HEIGHT + RULER_HEIGHT);

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bw = Math.round(PIANO_KEY_WIDTH * dpr);
    const bh = Math.round(canvasHeight * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = PIANO_KEY_WIDTH;
    ctx.clearRect(0, 0, w, canvasHeight);

    // Ruler spacer — matches grid ruler exactly
    ctx.fillStyle = COLORS.ruler;
    ctx.fillRect(0, 0, w, RULER_HEIGHT);
    ctx.fillStyle = COLORS.rulerBorder;
    ctx.fillRect(0, RULER_HEIGHT - 1, w, 1);

    // Keys — white keys full width, black keys at 62% width (real piano look)
    ctx.textBaseline = 'middle';
    for (let i = 0; i < visibleNotes; i++) {
      const note = scrollNote + visibleNotes - 1 - i;
      const y = RULER_HEIGHT + i * NOTE_HEIGHT;
      const black = BLACK_NOTES.has(note % 12);
      const active = activeNotes.has(note);
      const isC = note % 12 === 0;

      if (black) {
        // White background visible on right side of black key rows
        ctx.fillStyle = COLORS.keyWhite;
        ctx.fillRect(0, y, w, NOTE_HEIGHT);
        // Black key: 62% width
        const bkw = Math.round(w * 0.62);
        ctx.fillStyle = active ? COLORS.keyActive : COLORS.keyBlack;
        ctx.fillRect(0, y, bkw, NOTE_HEIGHT);
        // Row border for right (white) portion
        ctx.fillStyle = COLORS.keyBorder;
        ctx.fillRect(bkw, y + NOTE_HEIGHT - 1, w - bkw, 1);
      } else {
        ctx.fillStyle = active ? COLORS.keyActive : COLORS.keyWhite;
        ctx.fillRect(0, y, w, NOTE_HEIGHT);
        // Row border
        ctx.fillStyle = COLORS.keyBorder;
        ctx.fillRect(0, y + NOTE_HEIGHT - 1, w, 1);
        // Label
        const name = isC ? `C${Math.floor(note / 12) - 1}` : NOTE_NAMES[note % 12];
        ctx.font = isC ? 'bold 8px monospace' : '7px monospace';
        ctx.fillStyle = active ? '#fff' : isC ? COLORS.keyCLabel : COLORS.keyLabel;
        const tw = ctx.measureText(name).width;
        ctx.fillText(name, w - tw - 3, y + NOTE_HEIGHT / 2);
      }
    }
  }

  function handleClick(e: MouseEvent) {
    const adjustedY = e.offsetY - RULER_HEIGHT;
    if (adjustedY < 0) return;
    const note = scrollNote + visibleNotes - 1 - Math.floor(adjustedY / NOTE_HEIGHT);
    if (note >= 0 && note <= 127) onPreviewNote?.(note);
  }

  $effect(() => {
    scrollNote;
    visibleNotes;
    activeNotes;
    canvasHeight;
    draw();
  });

  onMount(() => {
    dpr = window.devicePixelRatio || 1;
    draw();
  });
</script>

<canvas
  bind:this={canvas}
  class="block flex-shrink-0 cursor-pointer select-none"
  style="width: {PIANO_KEY_WIDTH}px; height: {canvasHeight}px;"
  onclick={handleClick}
></canvas>
