export const LISSAJOUS_JS = `setPortCount(1, 0)
setTitle('lissajous.canvas')
noDrag()

let xScale = 1
let yScale = 1
let plotType = 'line'
let decay = 1
let bufX = null
let bufY = null

recv(m => {
  if (m && typeof m === 'object' && !ArrayBuffer.isView(m)) {
    if ('x' in m && 'y' in m && ArrayBuffer.isView(m.x)) {
      bufX = m.x
      bufY = m.y
    } else {
      if ('xScale' in m) xScale = m.xScale
      if ('yScale' in m) yScale = m.yScale
      if ('plotType' in m) plotType = m.plotType
      if ('decay' in m) decay = m.decay
    }
  }
})

function xyToCanvas(sx, sy, w, h) {
  const nx = Math.max(-1, Math.min(1, sx * xScale))
  const ny = Math.max(-1, Math.min(1, sy * yScale))
  return [((nx + 1) / 2) * w, ((1 - ny) / 2) * h]
}

function draw() {
  const w = width
  const h = height

  if (decay >= 1) {
    ctx.fillStyle = '#080809'
    ctx.fillRect(0, 0, w, h)
  } else {
    ctx.fillStyle = \`rgba(8, 8, 9, \${decay})\`
    ctx.fillRect(0, 0, w, h)
  }

  ctx.strokeStyle = '#27272a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.moveTo(w / 2, 0)
  ctx.lineTo(w / 2, h)
  ctx.stroke()

  if (!bufX || !bufY) {
    requestAnimationFrame(draw)
    return
  }

  const samplesToShow = bufX.length

  ctx.strokeStyle = '#22c55e'
  ctx.fillStyle = '#22c55e'

  if (plotType === 'line') {
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < samplesToShow; i++) {
      const [cx, cy] = xyToCanvas(bufX[i], bufY[i], w, h)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    }
    ctx.stroke()
  } else if (plotType === 'point') {
    const radius = 1.5
    for (let i = 0; i < samplesToShow; i++) {
      const [cx, cy] = xyToCanvas(bufX[i], bufY[i], w, h)
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
    }
  } else if (plotType === 'bezier') {
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (samplesToShow >= 2) {
      const [x0, y0] = xyToCanvas(bufX[0], bufY[0], w, h)
      ctx.moveTo(x0, y0)
      for (let i = 1; i < samplesToShow; i++) {
        const [prevX, prevY] = xyToCanvas(bufX[i - 1], bufY[i - 1], w, h)
        const [currX, currY] = xyToCanvas(bufX[i], bufY[i], w, h)
        const midX = (prevX + currX) / 2
        const midY = (prevY + currY) / 2
        ctx.quadraticCurveTo(prevX, prevY, midX, midY)
      }
      const [lastX, lastY] = xyToCanvas(bufX[samplesToShow - 1], bufY[samplesToShow - 1], w, h)
      ctx.lineTo(lastX, lastY)
      ctx.stroke()
    }
  }

  requestAnimationFrame(draw)
}

draw()`;

export const lissajousPreset = {
  type: 'canvas.dom' as const,
  data: {
    code: LISSAJOUS_JS,
    inletCount: 1,
    outletCount: 0
  }
};
