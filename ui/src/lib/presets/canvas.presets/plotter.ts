export const PLOTTER_JS = `let values = []

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

export const plotterPreset = {
	type: 'canvas' as const,
	data: {
		code: PLOTTER_JS,
		inletCount: 1,
		outletCount: 0
	}
};
