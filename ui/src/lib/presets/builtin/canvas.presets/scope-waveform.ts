export const SCOPE_WAVEFORM_JS = `setPortCount(1, 0)
setTitle('scope.canvas')
setPrimaryButton('settings')

await settings.define([
  { key: 'xScale', type: 'slider', label: 'X Scale', min: 0.5, max: 5, step: 0.1, default: 1 },
  { key: 'yScale', type: 'slider', label: 'Y Scale', min: 0.1, max: 5, step: 0.1, default: 1 },
  { key: 'plotType', type: 'select', label: 'Plot', default: 'line',
    options: ['line', 'point', 'bezier'] },
  { key: 'decay', type: 'slider', label: 'Decay', min: 0.01, max: 1, step: 0.01, default: 1 },
  { key: 'lineWidth', type: 'slider', label: 'Line Width', min: 1, max: 20, step: 1, default: 6 },
  { key: 'foregroundColor', type: 'color', label: 'Foreground', default: '#22c55e' },
  { key: 'backgroundColor', type: 'color', label: 'Background', default: '#080809' },
  { key: 'unipolar', type: 'boolean', label: 'Unipolar', default: false },
])

let xScale = settings.get('xScale')
let yScale = settings.get('yScale')
let plotType = settings.get('plotType')
let decay = settings.get('decay')
let unipolar = settings.get('unipolar')
let lineWidth = settings.get('lineWidth')
let foregroundColor = settings.get('foregroundColor')
let backgroundColor = settings.get('backgroundColor')
let buffer = null

settings.onChange((_, __, all) => {
  xScale = all.xScale
  yScale = all.yScale
  plotType = all.plotType
  decay = all.decay
  unipolar = all.unipolar
  lineWidth = all.lineWidth
  foregroundColor = all.foregroundColor
  backgroundColor = all.backgroundColor
})

recv(m => {
  if (ArrayBuffer.isView(m)) buffer = m
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

  ctx.globalAlpha = decay >= 1 ? 1 : decay
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1

  if (!buffer) {
    requestAnimationFrame(draw)
    return
  }

  const samplesToShow = Math.min(buffer.length, Math.max(1, Math.floor(buffer.length / xScale)))
  const sliceWidth = w / samplesToShow

  ctx.strokeStyle = foregroundColor
  ctx.fillStyle = foregroundColor

  if (plotType === 'line') {
    ctx.lineWidth = lineWidth
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
    const radius = lineWidth
    let x = 0
    for (let i = 0; i < samplesToShow; i++) {
      const y = sampleToY(buffer[i], h)
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      x += sliceWidth
    }
  } else if (plotType === 'bezier') {
    ctx.lineWidth = lineWidth
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
  type: 'canvas' as const,
  data: {
    code: SCOPE_WAVEFORM_JS,
    inletCount: 1,
    outletCount: 0
  }
};
