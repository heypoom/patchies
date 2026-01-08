export const FRACTAL_TREE_JS = `let stop = 4
let grow = 0.75

recv(m => grow=m)

function draw() {
  ctx.clearRect(0, 0, width, height);
  drawBranch(width / 2, height, 120, -Math.PI / 2);

  requestAnimationFrame(draw);
}

function drawBranch(x, y, length, angle) {
  if (length < stop) return;

  const endX = x + length * Math.cos(angle);
  const endY = y + length * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = length / 10;
  ctx.stroke();

  grow = Math.min(grow, 0.78)

  drawBranch(endX, endY, length * grow, angle - Math.PI / 6);
  drawBranch(endX, endY, length * grow, angle + Math.PI / 6);
}

draw();`;

export const fractalTreePreset = {
	type: 'canvas' as const,
	data: {
		code: FRACTAL_TREE_JS,
		inletCount: 1,
		outletCount: 0
	}
};
