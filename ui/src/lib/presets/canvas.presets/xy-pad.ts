export const XY_PAD_JS = `noDrag()
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

export const xyPadPreset = {
	type: 'canvas.dom' as const,
	data: {
		code: XY_PAD_JS,
		inletCount: 1,
		outletCount: 1
	}
};
