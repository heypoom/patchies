export const DRAWING_SURFACE_JS = `noOutput();
setDrawMode('interact');
setMouseForwarding({ enabled: false });

let lastX = 0;
let lastY = 0;
let hue = 0;

onPointer(({ x, y, down, type }) => {
  const curX = x * width;
  const curY = y * height;

  if (type === 'down') {
    lastX = curX;
    lastY = curY;
  }

  if (down && type === 'move') {
    ctx.beginPath();
    ctx.strokeStyle = \`hsl(\${hue}, 80%, 60%)\`;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(curX, curY);
    ctx.stroke();

    hue = (hue + 1) % 360;
  }

  lastX = curX;
  lastY = curY;
});

onKeyDown(e => {
  if (e.key.toLowerCase() === 'c' || e.key === ' ') {
    ctx.clearRect(0, 0, width, height);
  }
});

ctx.clearRect(0, 0, width, height);`;

export const SURFACE_PRESETS = {
  'Drawing Surface': {
    type: 'surface' as const,
    description: 'Interactive rainbow drawing surface',
    data: {
      code: DRAWING_SURFACE_JS,
      inletCount: 1,
      outletCount: 0
    }
  }
};
