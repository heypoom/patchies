export const KEYBOARD_EXAMPLE_JS = `noDrag()
noOutput()
setPortCount(0, 1)
setTitle("keyboard example")

let pressedKeys = new Set()
let lastKey = ''

// Register keyboard event handlers
onKeyDown((e) => {
  // Add key to pressed keys set
  pressedKeys.add(e.key)
  lastKey = e.key
  
  // Send key event to outlet
  send({ type: 'keydown', key: e.key })
})

onKeyUp((e) => {
  // Remove key from pressed keys set
  pressedKeys.delete(e.key)
  
  // Send key event to outlet
  send({ type: 'keyup', key: e.key })
})

function draw() {
  // Clear background
  ctx.fillStyle = '#18181b'
  ctx.fillRect(0, 0, width, height)
  
  // Draw title
  ctx.fillStyle = '#fff'
  ctx.font = '16px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('Click canvas and press keys', width / 2, 40)
  ctx.fillText('(Delete key won\\'t delete node!)', width / 2, 65)
  
  // Draw last key pressed
  if (lastKey) {
    ctx.fillStyle = '#4ade80'
    ctx.font = '48px monospace'
    ctx.fillText(lastKey, width / 2, 140)
  }
  
  // Draw currently pressed keys
  ctx.fillStyle = '#71717a'
  ctx.font = '14px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('Currently pressed:', 20, height - 60)
  
  const keysArray = Array.from(pressedKeys)
  ctx.fillStyle = '#fff'
  ctx.fillText(keysArray.join(', ') || 'none', 20, height - 35)
  
  // Draw focus hint
  if (document.activeElement !== canvas) {
    ctx.fillStyle = '#f59e0b'
    ctx.textAlign = 'center'
    ctx.fillText('⚠ Click canvas to focus', width / 2, height - 15)
  }
  
  requestAnimationFrame(draw)
}

draw()`;

export const keyboardExamplePreset = {
	type: 'canvas.dom' as const,
	data: {
		code: KEYBOARD_EXAMPLE_JS,
		inletCount: 0,
		outletCount: 1
	}
};
