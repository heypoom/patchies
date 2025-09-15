export const FFT_JS = `const cutoff = 2.5

function draw() {
  ctx.clearRect(0, 0, width, height)

  const waveform = fft().a
  const spectrum = fft({ type: 'freq' }).a

  if (!waveform || !spectrum) {
    requestAnimationFrame(draw)
    return
  }

  const sl = spectrum.length / cutoff
  const barWidth = width / sl;
  
  for (let i = 0; i < sl; i++) {
    const x = (i / sl) * width

    const barHeight = map(spectrum[i], 0, 255, 0, height);
    
    ctx.fillStyle = \`rgb(255, \${spectrum[i]}, 100)\`
    ctx.fillRect(x, height - barHeight, barWidth, barHeight)
  }

  ctx.strokeStyle = 'white'
  ctx.lineWidth = 4;
  ctx.beginPath()
  
  for (let i = 0; i < waveform.length; i++) {
    const x = (i / waveform.length) * width
    const y = map(waveform[i], 0, 256, 0, height);
    
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  
  ctx.stroke()
  requestAnimationFrame(draw)
}

const map = (value, start1, stop1, start2, stop2) =>
  start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1))

draw()`;

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

const PLOTTER_JS = `let values = []

const maxX = width / 8
const padding = 80

const offset = 1
const scale = 127.5

recv(m => {
  if (typeof m === 'object' && m.type === 'bang') {
    values = [];
    return
  }
  
  values.push((m + offset) * scale);
  
  if (values.length > maxX) {
    values = values.slice(-maxX)
  }
});

function draw() {
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 4
  ctx.clearRect(0, 0, width, height)
  ctx.beginPath()

  const effectiveHeight = height - (padding * 2)

  values.forEach((value, i) => {
    const x = (i / maxX) * width
    const y = effectiveHeight - (value / 255) *
      effectiveHeight + padding

    ctx.lineTo(x, y)
  })

  ctx.stroke()
  requestAnimationFrame(draw)
}

requestAnimationFrame(draw)`;

export const CANVAS_PRESETS = {
	'fft.canvas': {
		type: 'canvas',
		data: {
			code: FFT_JS,
			inletCount: 1,
			outletCount: 0
		}
	},
	'fractal-tree.canvas': {
		type: 'canvas',
		data: {
			code: FRACTAL_TREE_JS,
			inletCount: 1,
			outletCount: 0
		}
	},
	'plotter.canvas': {
		type: 'canvas',
		data: {
			code: PLOTTER_JS,
			inletCount: 1,
			outletCount: 0
		}
	}
};
