export const RGB_PICKER_JS = `const [width, height] = [700, 800]

noDrag();
noOutput();
setCanvasSize(width, height);
setPortCount(1, 1);
setTitle('rgb.picker');

const hueWidth = width;
const hueHeight = 72;
const squareSize = width;
const squareY = 84;
const indicatorRadius = 10;

let padX = squareSize / 2;
let padY = squareY + squareSize / 2;
let hueX = 0;
let dragTarget = null;

const color = {
  h: 0,
  s: 0.5,
  v: 0.5
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getHitTarget(x, y) {
  if (x >= 0 && x <= hueWidth && y >= 0 && y <= hueHeight) return 'hue';
  if (x >= 0 && x <= squareSize && y >= squareY && y <= squareY + squareSize) return 'pad';
  return null;
}

function hsvToRgb(h, s, v) {
  const scaledHue = h * 6;
  const i = Math.floor(scaledHue);
  const f = scaledHue - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  const sector = i % 6;
  if (sector === 0) return { r: v, g: t, b: p };
  if (sector === 1) return { r: q, g: v, b: p };
  if (sector === 2) return { r: p, g: v, b: t };
  if (sector === 3) return { r: p, g: q, b: v };
  if (sector === 4) return { r: t, g: p, b: v };
  return { r: v, g: p, b: q };
}

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    if (max === g) h = (b - r) / delta + 2;
    if (max === b) h = (r - g) / delta + 4;
    h /= 6;
    if (h < 0) h += 1;
  }

  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max
  };
}

function syncControlsFromColor() {
  hueX = color.h * hueWidth;
  padX = color.s * squareSize;
  padY = squareY + (1 - color.v) * squareSize;
}

// Handle external updates to the picker color.
recv((data, meta) => {
  if (Array.isArray(data)) {
    const currentRgb = hsvToRgb(color.h, color.s, color.v);
    const nextRgb = {
      r: typeof data[0] === 'number' ? clamp01(data[0]) : currentRgb.r,
      g: typeof data[1] === 'number' ? clamp01(data[1]) : currentRgb.g,
      b: typeof data[2] === 'number' ? clamp01(data[2]) : currentRgb.b
    };
    const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
    color.h = nextHsv.h;
    color.s = nextHsv.s;
    color.v = nextHsv.v;
    syncControlsFromColor();
  }
});

function draw() {
  // 1. Draw hue strip and saturation/value plane.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const hueGrad = ctx.createLinearGradient(0, 0, hueWidth, 0);
  for (let i = 0; i <= 360; i += 60) {
    hueGrad.addColorStop(i / 360, \`hsl(\${i}, 100%, 50%)\`);
  }
  ctx.fillStyle = hueGrad;
  ctx.fillRect(0, 0, hueWidth, hueHeight);

  const hueRgb = hsvToRgb(color.h, 1, 1);
  ctx.fillStyle = \`rgb(\${Math.round(hueRgb.r * 255)}, \${Math.round(hueRgb.g * 255)}, \${Math.round(hueRgb.b * 255)})\`;
  ctx.fillRect(0, squareY, squareSize, squareSize);

  const saturationGrad = ctx.createLinearGradient(0, 0, squareSize, 0);
  saturationGrad.addColorStop(0, 'rgb(255,255,255)');
  saturationGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = saturationGrad;
  ctx.fillRect(0, squareY, squareSize, squareSize);

  const valueGrad = ctx.createLinearGradient(0, squareY, 0, squareY + squareSize);
  valueGrad.addColorStop(0, 'rgba(0,0,0,0)');
  valueGrad.addColorStop(1, 'rgb(0,0,0)');
  ctx.fillStyle = valueGrad;
  ctx.fillRect(0, squareY, squareSize, squareSize);

  // 2. Interaction Logic
  if (mouse.down) {
    if (!dragTarget) {
      const hitTarget = getHitTarget(mouse.x, mouse.y);
      dragTarget = hitTarget;
    }

    if (dragTarget === 'hue') {
      hueX = Math.max(0, Math.min(hueWidth, mouse.x));
      color.h = clamp01(mouse.x / hueWidth);
    }

    if (dragTarget === 'pad') {
      padX = Math.max(0, Math.min(squareSize, mouse.x));
      padY = Math.max(squareY, Math.min(squareY + squareSize, mouse.y));
      color.s = clamp01(mouse.x / squareSize);
      color.v = clamp01(1 - (mouse.y - squareY) / squareSize);
    }
  } else {
    dragTarget = null;
  }

  const rgb = hsvToRgb(color.h, color.s, color.v);
  const currentColor = \`rgb(\${Math.round(rgb.r * 255)}, \${Math.round(rgb.g * 255)}, \${Math.round(rgb.b * 255)})\`;

  // 3. Draw indicators.
  ctx.beginPath();
  ctx.arc(hueX, hueHeight / 2, indicatorRadius, 0, Math.PI * 2);
  ctx.fillStyle = \`hsl(\${Math.round(color.h * 360)}, 100%, 50%)\`;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(padX, padY, 12, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // White ring
  ctx.beginPath();
  ctx.arc(padX, padY, 10, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Color fill
  ctx.fillStyle = currentColor;
  ctx.beginPath();
  ctx.arc(padX, padY, 8, 0, Math.PI * 2);
  ctx.fill();

  // 4. Output
  if (mouse.down) {
    send([rgb.r, rgb.g, rgb.b]);
  }

  requestAnimationFrame(draw);
}

draw();`;

export const rgbPickerPreset = {
  type: 'canvas.dom' as const,
  data: {
    code: RGB_PICKER_JS,
    inletCount: 1,
    outletCount: 1
  }
};
