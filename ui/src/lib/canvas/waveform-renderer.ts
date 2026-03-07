/**
 * Shared waveform canvas renderer.
 * All functions operate in physical pixel coordinates (no ctx.scale).
 * Call setupDprCanvas() first to configure the canvas for the device pixel ratio.
 */

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
 * Operates in physical pixel space (canvas.width × canvas.height).
 */
export function drawWaveform(canvas: HTMLCanvasElement, data: Float32Array): void {
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

  // Build min/max envelope — one entry per physical pixel column
  const maxEnv = new Float32Array(w);
  const minEnv = new Float32Array(w);
  const margin = 2; // physical pixels of headroom

  for (let px = 0; px < w; px++) {
    const start = Math.floor((px / w) * data.length);
    const end = Math.max(start + 1, Math.floor(((px + 1) / w) * data.length));
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
 * loopStart / loopEnd / duration are all in the same unit (e.g. seconds).
 */
export function drawLoopOverlay(
  canvas: HTMLCanvasElement,
  duration: number,
  loopStart: number,
  loopEnd: number
): void {
  if (loopEnd <= loopStart || duration <= 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const startX = (loopStart / duration) * w;
  const endX = (loopEnd / duration) * w;

  // Region tint
  ctx.fillStyle = 'rgba(249,115,22,0.12)';
  ctx.fillRect(startX, 0, endX - startX, h);

  // Markers
  ctx.strokeStyle = 'rgba(249,115,22,0.7)';
  ctx.lineWidth = window.devicePixelRatio || 1; // 1 logical pixel

  ctx.beginPath();
  ctx.moveTo(startX, 0);
  ctx.lineTo(startX, h);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, 0);
  ctx.lineTo(endX, h);
  ctx.stroke();
}

/**
 * Draw a playback position cursor.
 * progress / duration are in the same unit (e.g. seconds).
 */
export function drawPlaybackHead(
  canvas: HTMLCanvasElement,
  duration: number,
  progress: number
): void {
  if (progress <= 0 || duration <= 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const x = (progress / duration) * canvas.width;

  ctx.strokeStyle = 'rgba(161,161,170,0.85)';
  ctx.lineWidth = window.devicePixelRatio || 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvas.height);
  ctx.stroke();
}
