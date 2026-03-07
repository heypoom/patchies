import type { ViewWindow } from './waveform-renderer';

const MIN_SPAN = 0.005; // minimum 0.5% of data visible

/**
 * Zoom state for a waveform canvas.
 * - Scroll wheel: zoom in/out, centered on cursor
 * - Double-click: reset to full view
 */
export function useWaveformZoom() {
  let zoomStart = $state(0);
  let zoomEnd = $state(1);

  const view: ViewWindow = $derived({ start: zoomStart, end: zoomEnd });
  const isZoomed = $derived(zoomStart > 0.0005 || zoomEnd < 0.9995);

  function handleWheel(e: WheelEvent) {
    e.preventDefault();

    const canvas = e.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const cursorFrac = (e.clientX - rect.left) / rect.width;

    const span = zoomEnd - zoomStart;
    const factor = e.deltaY > 0 ? 1.25 : 0.8; // scroll down = zoom out
    const newSpan = Math.min(1, Math.max(MIN_SPAN, span * factor));

    // Keep the data position under the cursor fixed
    const dataAtCursor = zoomStart + cursorFrac * span;
    let newStart = dataAtCursor - cursorFrac * newSpan;
    let newEnd = newStart + newSpan;

    if (newStart < 0) {
      newStart = 0;
      newEnd = newSpan;
    }
    if (newEnd > 1) {
      newEnd = 1;
      newStart = 1 - newSpan;
    }

    zoomStart = Math.max(0, newStart);
    zoomEnd = Math.min(1, newEnd);
  }

  function reset() {
    zoomStart = 0;
    zoomEnd = 1;
  }

  return {
    get view(): ViewWindow {
      return view;
    },
    get isZoomed(): boolean {
      return isZoomed;
    },
    handleWheel,
    reset
  };
}
