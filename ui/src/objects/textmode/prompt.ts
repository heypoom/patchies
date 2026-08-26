import { fftInstructions } from '$lib/ai/object-prompts/shared-fft';

const textmodeExamples = `## Known-good examples

Use this as the default Textmode pattern:
\`\`\`js
t.setup(() => {
  t.fontSize(32)
  t.frameRate(60)
})

t.draw(() => {
  t.background(0, 0, 0, 0)

  const halfCols = t.grid.cols / 1.95
  const halfRows = t.grid.rows / 1.95

  for (let y = -halfRows; y < halfRows; y++) {
    for (let x = -halfCols; x < halfCols; x++) {
      const distance = Math.sqrt(x * x + y * y)
      const wave = Math.sin(distance * 0.2 - t.frameCount * 0.1)

      t.push()
      t.translate(x, y, 0)
      t.char(wave > 0.5 ? '▓' : wave > 0 ? '▒' : '░')
      t.charColor(0, 150 + wave * 100, 255)
      t.point()
      t.pop()
    }
  }
})
\`\`\`

For a coarser effect, follow the shipped \`animated-wave.tm\` preset: step through the grid, set a character/color, then fill its cell with \`t.rect(step, step)\`. Other available starting points are \`digital-rain.tm\`, \`plasma-field.tm\`, \`rain.tm\`, \`torus.tm\`, and \`fire.tm\`.`;

export const textmodePrompt = `## textmode Object Instructions

Textmode.js ASCII and text-mode graphics in the web-worker render pipeline. Use it for fast visual output that chains efficiently into other video objects.

**Globals:**
- t (also available as tm): the Textmode.js instance
- width, height: output dimensions
- Textmode synth globals: cellColor, char, charColor, gradient, noise, plasma, moire, osc, paint, shape, solid, src, voronoi

**Textmode pattern:**
- Configure the instance once with t.setup(() => { ... }).
- Draw each frame with t.draw(() => { ... }).
- Use t.frameCount for animation and t.grid.cols / t.grid.rows for the character-cell dimensions.
- Use t.push() / t.pop() to isolate transforms and styles.

**textmode-specific methods:**
- setVideoOutput(enabled) - enable or disable video output; enabled by default
- setHidePorts(enabled) - hide or show ports
- noDrag(), noPan(), noWheel(), noInteract() - interaction control

**Plugins:**
- textmode.filters.js and textmode.synth.js are loaded automatically.
- Call t.filter(name, options) inside t.draw() for filters such as brightness, contrast, hueRotate, pixelate, glitch, or bloom.
- The Synth plugin functions are globals: for example, char(osc(2)).charMap('@#%*+=-:. ').

**textmode-specific gotchas:**
- Runs in a web worker: do not use DOM APIs, mouse/keyboard events, images, videos, or custom fonts.
- Use textmode.dom when the sketch needs interactivity, media loading, or custom fonts.
- Smaller font sizes create more character cells and are expensive. Prefer t.fontSize(32) or larger.
- The node is displayed zoomed out on the patch canvas, so use large, high-contrast characters and shapes.

${fftInstructions}

${textmodeExamples}`;

export const textmodeDomPrompt = `## textmode.dom Object Instructions

Textmode.js ASCII and text-mode graphics on the main thread. Use it when the sketch needs mouse, touch, keyboard, image/video loading, or custom fonts.

**Globals:**
- t (also available as tm): the Textmode.js instance
- canvas: the HTML canvas element
- width, height: canvas dimensions
- Textmode synth globals: cellColor, char, charColor, gradient, noise, plasma, moire, osc, paint, shape, solid, src, voronoi

**Textmode pattern:**
- Configure the instance once with t.setup(() => { ... }).
- Draw each frame with t.draw(() => { ... }).
- Use t.frameCount for animation and t.grid.cols / t.grid.rows for the character-cell dimensions.
- Use t.push() / t.pop() to isolate transforms and styles.

**textmode.dom-specific methods:**
- setCanvasSize(width, height) - set the canvas dimensions; use sizes from 800 to 2000 in each dimension
- setVideoOutput(enabled) - enable or disable video output; disabled by default, so enable it only when feeding another video node
- setHidePorts(enabled) - hide or show ports
- noDrag(), noPan(), noWheel(), noInteract() - interaction control
- onKeyDown(callback), onKeyUp(callback) - receive focused keyboard events

**Plugins:**
- textmode.filters.js and textmode.synth.js are loaded automatically.
- Call t.filter(name, options) inside t.draw() for filters such as brightness, contrast, hueRotate, pixelate, glitch, or bloom.
- The Synth plugin functions are globals: for example, char(osc(2)).charMap('@#%*+=-:. ').

**textmode.dom-specific gotchas:**
- This is the interactive variant, but chaining its output is slower because it copies from CPU to GPU. Use textmode for non-interactive video processing.
- Call noDrag() before handling direct pointer interaction so the patch canvas does not drag the node instead.
- Use onKeyDown() and onKeyUp() for keyboard input; their events stay within the focused widget.
- Smaller font sizes create more character cells and are expensive. Prefer t.fontSize(32) or larger.
- Use sparingly: too many textmode.dom nodes can exhaust browser WebGL contexts.

${fftInstructions}

${textmodeExamples}`;
