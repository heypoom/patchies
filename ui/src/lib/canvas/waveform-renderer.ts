/**
 * Shared waveform canvas renderer.
 * All functions operate in physical pixel coordinates (no ctx.scale).
 * Call setupDprCanvas() first to configure the canvas for the device pixel ratio.
 */

/** Fraction of the data that is visible (both values in [0, 1]). */
export interface ViewWindow {
  start: number;
  end: number;
}

const FULL_VIEW: ViewWindow = { start: 0, end: 1 };

/** Set canvas physical dimensions for the device pixel ratio, CSS size to logical dimensions. */
export function setupDprCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

/**
 * Draw a filled min/max envelope waveform with orange gradient + glow.
 * Operates in physical pixel space. Pass a ViewWindow to draw only a slice.
 */
export function drawWaveform(
  canvas: HTMLCanvasElement,
  data: Float32Array,
  view: ViewWindow = FULL_VIEW
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const mid = h / 2;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, w, h);

  // Zero line
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();

  if (!data.length) return;

  // Map view window to sample indices
  const dataStart = view.start * data.length;
  const dataEnd = view.end * data.length;
  const dataLen = dataEnd - dataStart;
  const margin = 2; // physical pixels of headroom

  // Build min/max envelope — one entry per physical pixel column
  const maxEnv = new Float32Array(w);
  const minEnv = new Float32Array(w);

  for (let px = 0; px < w; px++) {
    const start = Math.floor(dataStart + (px / w) * dataLen);
    const end = Math.max(start + 1, Math.floor(dataStart + ((px + 1) / w) * dataLen));
    let min = 0,
      max = 0;
    for (let i = start; i < end; i++) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    maxEnv[px] = mid - max * (mid - margin);
    minEnv[px] = mid - min * (mid - margin);
  }

  // Filled polygon: top envelope L→R, bottom envelope R→L
  ctx.beginPath();
  ctx.moveTo(0, maxEnv[0]);
  for (let px = 1; px < w; px++) ctx.lineTo(px, maxEnv[px]);
  for (let px = w - 1; px >= 0; px--) ctx.lineTo(px, minEnv[px]);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(251,146,60,0.75)');
  grad.addColorStop(0.5, 'rgba(249,115,22,1.0)');
  grad.addColorStop(1, 'rgba(251,146,60,0.75)');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(249,115,22,0.4)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
}

/**
 * Draw loop region highlight + start/end markers.
 * loopStart / loopEnd / duration are in the same unit (e.g. seconds or samples).
 * Pass the current ViewWindow so markers are clipped to the visible range.
 */
export function drawLoopOverlay(
  canvas: HTMLCanvasElement,
  duration: number,
  loopStart: number,
  loopEnd: number,
  view: ViewWindow = FULL_VIEW
): void {
  if (loopEnd <= loopStart || duration <= 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const viewSpan = view.end - view.start;

  const loopStartFrac = loopStart / duration;
  const loopEndFrac = loopEnd / duration;

  // Skip if entirely outside the view
  if (loopEndFrac <= view.start || loopStartFrac >= view.end) return;

  const toX = (frac: number) => ((frac - view.start) / viewSpan) * w;

  const startX = Math.max(0, toX(loopStartFrac));
  const endX = Math.min(w, toX(loopEndFrac));

  // Region tint
  ctx.fillStyle = 'rgba(249,115,22,0.12)';
  ctx.fillRect(startX, 0, endX - startX, h);

  // Markers — only draw if they're actually in view
  ctx.strokeStyle = 'rgba(249,115,22,0.7)';
  ctx.lineWidth = window.devicePixelRatio || 1;

  if (loopStartFrac >= view.start) {
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, h);
    ctx.stroke();
  }

  if (loopEndFrac <= view.end) {
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, h);
    ctx.stroke();
  }
}

/**
 * Draw a playback position cursor.
 * progress / duration are in the same unit (e.g. seconds).
 */
export function drawPlaybackHead(
  canvas: HTMLCanvasElement,
  duration: number,
  progress: number,
  view: ViewWindow = FULL_VIEW
): void {
  if (progress <= 0 || duration <= 0) return;

  const progressFrac = progress / duration;
  if (progressFrac < view.start || progressFrac > view.end) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const x = ((progressFrac - view.start) / (view.end - view.start)) * canvas.width;

  ctx.strokeStyle = 'rgba(161,161,170,0.85)';
  ctx.lineWidth = window.devicePixelRatio || 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvas.height);
  ctx.stroke();
}
