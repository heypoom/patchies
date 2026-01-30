export const HSLA_PICKER_JS = `const [width, height] = [800, 800]

noDrag()
noOutput()
setCanvasSize(width, height)
setPortCount(1, 1)
setTitle("hsla.picker")

let padX = width / 2
let padY = height / 2
let isDragging = false

const lightness = 50
const alpha = 1

recv(m => {
  if (Array.isArray(m)) {
    if (typeof m[0] === 'number') padX = m[0] * width

    // Flip Y for intuitive saturation
    if (typeof m[1] === 'number') padY = (1 - m[1]) * height
  }
})

function draw() {
  // 1. Draw the Hue Gradient (Horizontal)
  const hueGradient = ctx.createLinearGradient(0, 0, width, 0)

  for (let i = 0; i <= 360; i += 30) {
    hueGradient.addColorStop(i / 360, \`hsl(\${i}, 100%, 50%)\`)
  }

  ctx.fillStyle = hueGradient
  ctx.fillRect(0, 0, width, height)

  // 2. Draw the Saturation Overlay (Vertical)
  // We fade from transparent at the top to grey/white at the bottom
  const satGradient = ctx.createLinearGradient(0, 0, 0, height)
  satGradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  satGradient.addColorStop(1, 'rgba(128, 128, 128, 1)')
  ctx.fillStyle = satGradient
  ctx.fillRect(0, 0, width, height)

  // 3. Logic & Calculations
  if (mouse.down) {
    padX = Math.max(0, Math.min(width, mouse.x))
    padY = Math.max(0, Math.min(height, mouse.y))
    isDragging = true
  }

  // Calculate HSL values
  const h = Math.round((padX / width) * 360)
  const s = Math.round(100 - (padY / height) * 100)
  const currentColor = \`hsla(\${h}, \${s}%, \${lightness}%, \${alpha})\`

  // 4. Draw Indicator
  // Draw a shadow/border for the indicator
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(padX, padY, 10, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = currentColor
  ctx.beginPath()
  ctx.arc(padX, padY, 8, 0, Math.PI * 2)
  ctx.fill()

  // 5. Output
  if (mouse.down) {
    send([h, s, lightness, alpha])
  }

  requestAnimationFrame(draw)
}

draw()`;

export const hslaPickerPreset = {
  type: 'canvas.dom' as const,
  data: {
    code: HSLA_PICKER_JS,
    inletCount: 1,
    outletCount: 1
  }
};
