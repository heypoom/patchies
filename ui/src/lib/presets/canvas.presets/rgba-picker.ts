export const RGBA_PICKER_JS = `noDrag()
noOutput()
setPortCount(1, 1)
setTitle("rgba.picker")

let padX = width / 2
let padY = height / 2
let isDragging = false

const blue = 128
const alpha = 255

recv(m => {
  if (Array.isArray(m)) {
    if (typeof m[0] === 'number') padX = m[0] * width

    // Flip Y for intuitive green gradient
    if (typeof m[1] === 'number') padY = (1 - m[1]) * height
  }
})

function draw() {
  // 1. Draw the Red Gradient (Horizontal)
  const redGradient = ctx.createLinearGradient(0, 0, width, 0)
  redGradient.addColorStop(0, \`rgb(0, 128, \${blue})\`)
  redGradient.addColorStop(1, \`rgb(255, 128, \${blue})\`)

  ctx.fillStyle = redGradient
  ctx.fillRect(0, 0, width, height)

  // 2. Draw the Green Overlay (Vertical)
  // Fade from green=255 at top to green=0 at bottom
  const greenGradient = ctx.createLinearGradient(0, 0, 0, height)
  greenGradient.addColorStop(0, 'rgba(0, 255, 0, 0.5)')
  greenGradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)')
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = greenGradient
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  // 3. Logic & Calculations
  if (mouse.down) {
    padX = Math.max(0, Math.min(width, mouse.x))
    padY = Math.max(0, Math.min(height, mouse.y))
    isDragging = true
  }

  // Calculate RGB values
  const r = Math.round((padX / width) * 255)
  const g = Math.round(255 - (padY / height) * 255)
  const currentColor = \`rgba(\${r}, \${g}, \${blue}, \${alpha / 255})\`

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
    send([r, g, blue, alpha])
  }

  requestAnimationFrame(draw)
}

draw()`;

export const rgbaPickerPreset = {
	type: 'canvas.dom' as const,
	data: {
		code: RGBA_PICKER_JS,
		inletCount: 1,
		outletCount: 1
	}
};
