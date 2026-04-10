export const SCOPE_WAVEFORM_JS = `setPortCount(1, 0)
setTitle('scope.canvas')
noDrag()

let xScale = 1
let yScale = 1
let plotType = 'line'
let decay = 1
let unipolar = false
let buffer = null

recv(m => {
  if (ArrayBuffer.isView(m)) {
    buffer = m
  } else if (m && typeof m === 'object') {
    if ('xScale' in m) xScale = m.xScale
    if ('yScale' in m) yScale = m.yScale
    if ('plotType' in m) plotType = m.plotType
    if ('decay' in m) decay = m.decay
    if ('unipolar' in m) unipolar = m.unipolar
  }
})

function sampleToY(sample, h) {
  if (unipolar) {
    const normalized = Math.max(0, Math.min(1, sample * yScale))
    return (1 - normalized) * h
  }
  const normalized = Math.max(-1, Math.min(1, sample * yScale))
  return ((1 - normalized) / 2) * h
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
  const refY = unipolar ? h - 0.5 : h / 2
  ctx.moveTo(0, refY)
  ctx.lineTo(w, refY)
  ctx.stroke()

  if (!buffer) {
    requestAnimationFrame(draw)
    return
  }

  const samplesToShow = Math.max(1, Math.floor(buffer.length / xScale))
  const sliceWidth = w / samplesToShow

  ctx.strokeStyle = '#22c55e'
  ctx.fillStyle = '#22c55e'

  if (plotType === 'line') {
    ctx.lineWidth = 1.5
    ctx.beginPath()
    let x = 0
    for (let i = 0; i < samplesToShow; i++) {
      const y = sampleToY(buffer[i], h)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.stroke()
  } else if (plotType === 'point') {
    const radius = Math.max(1, Math.min(2, sliceWidth * 0.4))
    let x = 0
    for (let i = 0; i < samplesToShow; i++) {
      const y = sampleToY(buffer[i], h)
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      x += sliceWidth
    }
  } else if (plotType === 'bezier') {
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (samplesToShow >= 2) {
      const y0 = sampleToY(buffer[0], h)
      ctx.moveTo(0, y0)
      for (let i = 1; i < samplesToShow; i++) {
        const prevX = (i - 1) * sliceWidth
        const currX = i * sliceWidth
        const prevY = sampleToY(buffer[i - 1], h)
        const currY = sampleToY(buffer[i], h)
        const midX = (prevX + currX) / 2
        ctx.quadraticCurveTo(prevX, prevY, midX, (prevY + currY) / 2)
      }
      const lastX = (samplesToShow - 1) * sliceWidth
      const lastY = sampleToY(buffer[samplesToShow - 1], h)
      ctx.lineTo(lastX, lastY)
      ctx.stroke()
    }
  }

  requestAnimationFrame(draw)
}

draw()`;

export const scopeWaveformPreset = {
  type: 'canvas.dom' as const,
  data: {
    code: SCOPE_WAVEFORM_JS,
    inletCount: 1,
    outletCount: 0
  }
};
