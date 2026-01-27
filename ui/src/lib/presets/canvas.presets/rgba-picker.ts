export const RGBA_PICKER_JS = `noDrag();
noOutput();
setPortCount(1, 1);
setTitle("rgba.picker");

let padX = width / 2;
let padY = height / 2;

// Constants for the picker
let blue = 128;
let alpha = 255;

// Handle external updates to the picker position
recv((data, meta) => {
  if (Array.isArray(data)) {
    if (typeof data[0] === 'number') padX = data[0] * width;
    // Map 1.0 (top) to padY 0, and 0.0 (bottom) to padY height
    if (typeof data[1] === 'number') padY = (1 - data[1]) * height;
    if (typeof data[2] === 'number') blue = Math.max(0, Math.min(255, data[2]));
    if (typeof data[3] === 'number') alpha = Math.max(0, Math.min(255, data[3]));
  }
});

function draw() {
  // 1. Draw the Base Color Plane
  // Clear with solid black first
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // Fill with the constant Blue component
  ctx.fillStyle = \`rgb(0, 0, \${blue})\`;
  ctx.fillRect(0, 0, width, height);

  // Additive blending to mix Red and Green gradients accurately
  ctx.globalCompositeOperation = 'lighter';

  // Horizontal Red Gradient (0 to 255)
  const redGrad = ctx.createLinearGradient(0, 0, width, 0);
  redGrad.addColorStop(0, 'rgb(0,0,0)');
  redGrad.addColorStop(1, 'rgb(255,0,0)');
  ctx.fillStyle = redGrad;
  ctx.fillRect(0, 0, width, height);

  // Vertical Green Gradient (0 at bottom to 255 at top)
  const greenGrad = ctx.createLinearGradient(0, height, 0, 0);
  greenGrad.addColorStop(0, 'rgb(0,0,0)');
  greenGrad.addColorStop(1, 'rgb(0,255,0)');
  ctx.fillStyle = greenGrad;
  ctx.fillRect(0, 0, width, height);

  // Reset composite operation for UI
  ctx.globalCompositeOperation = 'source-over';

  // 2. Interaction Logic
  if (mouse.down) {
    padX = Math.max(0, Math.min(width, mouse.x));
    padY = Math.max(0, Math.min(height, mouse.y));
  }

  // Calculate actual RGB values from position
  const r = Math.round((padX / width) * 255);
  const g = Math.round(255 - (padY / height) * 255);
  const currentColor = \`rgba(\${r}, \${g}, \${blue}, \${alpha / 255})\`;

  // 3. Draw Indicator/Cursor
  // Outer shadow for visibility
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
    send([r, g, blue, alpha]);
  }

  requestAnimationFrame(draw);
}

draw();`;

export const rgbaPickerPreset = {
	type: 'canvas.dom' as const,
	data: {
		code: RGBA_PICKER_JS,
		inletCount: 1,
		outletCount: 1
	}
};
