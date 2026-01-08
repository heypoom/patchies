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

const MOUSE_PAINT_JS = `noDrag()

let particles = []

function draw() {
  // Fade effect
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.fillRect(0, 0, width, height)

  // Add particles when mouse is down
  if (mouse.down) {
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: mouse.x + (Math.random() - 0.5) * 20,
        y: mouse.y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1,
        hue: (Date.now() / 20) % 360
      })
    }
  }

  // Draw cursor position
  ctx.strokeStyle = mouse.down ? '#4ade80' : '#71717a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2)
  ctx.stroke()

  // Update and draw particles
  particles = particles.filter(p => {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.2 // gravity
    p.life -= 0.015

    if (p.life <= 0) return false

    const size = p.life * 12
    ctx.fillStyle = \`hsla(\${p.hue}, 70%, 60%, \${p.life})\`
    ctx.beginPath()
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
    ctx.fill()

    return true
  })

  requestAnimationFrame(draw)
}

draw()`;

const XY_PAD_JS = `noDrag()
noOutput()
setPortCount(1, 1)
setTitle("xy.pad")

let padX = width / 2
let padY = height / 2
let isDragging = false

// Receive messages to set position
recv(m => {
  let x, y

  if (Array.isArray(m)) {
    if (typeof m[0] === 'number') x = m[0]
    if (typeof m[1] === 'number') y = m[1]
  } else if (typeof m === 'object') {
    if ('x' in m) x = m.x
    if ('y' in m) y = m.y
   } else return

  if (x !== undefined) {
    padX = x * width
    isDragging = true
  }

  if (y !== undefined) {
    padY = y * height
    isDragging = true
  }

  send([padX / width, padY / height])
})

function draw() {
  ctx.fillStyle = '#18181b'
  ctx.fillRect(0, 0, width, height)

  // Grid
  ctx.strokeStyle = '#27272a'
  ctx.lineWidth = 1

  for (let i = 1; i < 4; i++) {
    const x = (width / 4) * i
    const y = (height / 4) * i
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // Center crosshair
  ctx.strokeStyle = '#3f3f46'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(width / 2 - 10, height / 2)
  ctx.lineTo(width / 2 + 10, height / 2)
  ctx.moveTo(width / 2, height / 2 - 10)
  ctx.lineTo(width / 2, height / 2 + 10)
  ctx.stroke()

  // Update position on drag
  if (mouse.down) {
    padX = mouse.x
    padY = mouse.y
    isDragging = true

    // Send normalized coordinates (0-1)
    send([padX / width, padY / height])
  } else if (isDragging) {
    isDragging = false
  }

  // Draw position indicator
  ctx.fillStyle = mouse.down ? '#4ade80' : '#71717a'
  ctx.beginPath()
  ctx.arc(padX, padY, 12, 0, Math.PI * 2)
  ctx.fill()

  // Draw crosshair on position
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padX - 20, padY)
  ctx.lineTo(padX + 20, padY)
  ctx.moveTo(padX, padY - 20)
  ctx.lineTo(padX, padY + 20)
  ctx.stroke()

  requestAnimationFrame(draw)
}

draw()`;

export const CANVAS_PRESETS = {
	'fft.canvas': {
		type: 'canvas.dom',
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
	},
	'paint.canvas': {
		type: 'canvas.dom',
		data: {
			code: MOUSE_PAINT_JS,
			inletCount: 1,
			outletCount: 0
		}
	},
	'xy-pad.canvas': {
		type: 'canvas.dom',
		data: {
			code: XY_PAD_JS,
			inletCount: 1,
			outletCount: 2
		}
	}
};
