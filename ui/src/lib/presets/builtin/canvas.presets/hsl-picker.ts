export const HSL_PICKER_JS = `const [width, height] = [700, 800]

noDrag();
noOutput();
setCanvasSize(width, height);
setPortCount(1, 1);
setTitle('HSL Picker');

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
  l: 0.5
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getHitTarget(x, y) {
  if (x >= 0 && x <= hueWidth && y >= 0 && y <= hueHeight) return 'hue';
  if (x >= 0 && x <= squareSize && y >= squareY && y <= squareY + squareSize) return 'pad';
  return null;
}

function syncControlsFromColor() {
  hueX = color.h * hueWidth;
  padX = color.s * squareSize;
  padY = squareY + (1 - color.l) * squareSize;
}

recv(m => {
  if (Array.isArray(m)) {
    if (typeof m[0] === 'number') color.h = clamp01(m[0]);
    if (typeof m[1] === 'number') color.s = clamp01(m[1]);
    if (typeof m[2] === 'number') color.l = clamp01(m[2]);
    syncControlsFromColor();
  }
});

function draw() {
  // 1. Draw hue strip and saturation/lightness plane.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const hueGradient = ctx.createLinearGradient(0, 0, hueWidth, 0);
  for (let i = 0; i <= 360; i += 60) {
    hueGradient.addColorStop(i / 360, \`hsl(\${i}, 100%, 50%)\`);
  }
  ctx.fillStyle = hueGradient;
  ctx.fillRect(0, 0, hueWidth, hueHeight);

  const hueDegrees = Math.round(color.h * 360);
  ctx.fillStyle = \`hsl(\${hueDegrees}, 100%, 50%)\`;
  ctx.fillRect(0, squareY, squareSize, squareSize);

  const saturationGradient = ctx.createLinearGradient(0, 0, squareSize, 0);
  saturationGradient.addColorStop(0, 'rgb(128,128,128)');
  saturationGradient.addColorStop(1, 'rgba(128,128,128,0)');
  ctx.fillStyle = saturationGradient;
  ctx.fillRect(0, squareY, squareSize, squareSize);

  const lightnessGradient = ctx.createLinearGradient(0, squareY, 0, squareY + squareSize);
  lightnessGradient.addColorStop(0, 'rgba(255,255,255,1)');
  lightnessGradient.addColorStop(0.5, 'rgba(255,255,255,0)');
  lightnessGradient.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = lightnessGradient;
  ctx.fillRect(0, squareY, squareSize, squareSize);

  const currentColor = \`hsl(\${hueDegrees}, \${Math.round(color.s * 100)}%, \${Math.round(color.l * 100)}%)\`;

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
      color.l = clamp01(1 - (mouse.y - squareY) / squareSize);
    }

  } else {
    dragTarget = null;
  }

  // 3. Draw indicators.
  ctx.beginPath();
  ctx.arc(hueX, hueHeight / 2, indicatorRadius, 0, Math.PI * 2);
  ctx.fillStyle = \`hsl(\${hueDegrees}, 100%, 50%)\`;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(padX, padY, 12, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(padX, padY, 10, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = currentColor;
  ctx.beginPath();
  ctx.arc(padX, padY, 8, 0, Math.PI * 2);
  ctx.fill();

  // 4. Output
  if (mouse.down) {
    send([color.h, color.s, color.l]);
  }

  requestAnimationFrame(draw);
}

draw()`;

export const hslPickerPreset = {
  type: 'canvas.dom' as const,
  data: {
    code: HSL_PICKER_JS,
    inletCount: 1,
    outletCount: 1
  }
};
