export const MOUSE_PAINT_JS = `noDrag()

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

export const paintPreset = {
	type: 'canvas.dom' as const,
	data: {
		code: MOUSE_PAINT_JS,
		inletCount: 1,
		outletCount: 0
	}
};
