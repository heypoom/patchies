export const SCOPE_XY_JS = `setPortCount(1, 0)
setTitle('scope-xy.canvas')

await settings.define([
  { key: 'xScale', type: 'slider', label: 'X Scale', min: 0.1, max: 5, step: 0.1, default: 1 },
  { key: 'yScale', type: 'slider', label: 'Y Scale', min: 0.1, max: 5, step: 0.1, default: 1 },
  { key: 'plotType', type: 'select', label: 'Plot', default: 'line',
    options: ['line', 'point', 'bezier'] },
  { key: 'decay', type: 'slider', label: 'Decay', min: 0.01, max: 1, step: 0.01, default: 1 },
  { key: 'lineWidth', type: 'slider', label: 'Line Width', min: 1, max: 20, step: 1, default: 6 }
])

let xScale = settings.get('xScale')
let yScale = settings.get('yScale')
let plotType = settings.get('plotType')
let decay = settings.get('decay')
let lineWidth = settings.get('lineWidth')
let bufX = null
let bufY = null

settings.onChange((_, __, all) => {
  xScale = all.xScale
  yScale = all.yScale
  plotType = all.plotType
  decay = all.decay
  lineWidth = all.lineWidth
})

recv(m => {
  if (m && typeof m === 'object' && m.type === 'xy' && ArrayBuffer.isView(m.x)) {
    bufX = m.x
    bufY = m.y
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

  if (!bufX || !bufY) {
    requestAnimationFrame(draw)
    return
  }

  const samplesToShow = bufX.length

  ctx.strokeStyle = '#22c55e'
  ctx.fillStyle = '#22c55e'

  if (plotType === 'line') {
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    for (let i = 0; i < samplesToShow; i++) {
      const [cx, cy] = xyToCanvas(bufX[i], bufY[i], w, h)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    }
    ctx.stroke()
  } else if (plotType === 'point') {
    const radius = lineWidth
    for (let i = 0; i < samplesToShow; i++) {
      const [cx, cy] = xyToCanvas(bufX[i], bufY[i], w, h)
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
    }
  } else if (plotType === 'bezier') {
    ctx.lineWidth = lineWidth
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

export const scopeXYPreset = {
  type: 'canvas' as const,
  data: {
    code: SCOPE_XY_JS,
    inletCount: 1,
    outletCount: 0
  }
};
