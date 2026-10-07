export const domPrompt = `## dom Object Instructions

DOM manipulation node with direct JavaScript access to a root div element. Container is fluid-sized by default.

**Tailwind CSS is enabled by default!** Use Tailwind utility classes for styling. Call \`tailwind(false)\` to disable it for better performance if not needed.

**DOM-specific methods:**
- root: HTMLDivElement - the container element you can manipulate
- width, height: Container dimensions (undefined until setSize or setFluidSize)
- setSize(w, h): Set fixed container dimensions
- setFluidSize({ showResizer?, resize?, keepAspectRatio?, initialSize? }): Use a user-resizable container. resize is 'horizontal', 'vertical', or 'both'.
- onResize(({ width, height }) => {}): Run after a fluid container resize.
- htmlCanvas.videoOutput(options): Experimental API that exposes the DOM node as a video source using Chromium's experimental HTML-in-Canvas flag; call htmlCanvas.videoOutput() to match the render output size, htmlCanvas.videoOutput(false) to disable, or htmlCanvas.videoOutput({ size: "free" }) to let the DOM content choose its own source size before Patchies fits it into the render output; mutually exclusive with canvasLayer and glslLayer
- htmlCanvas.canvasLayer(callback): Experimental API that locally post-processes the live DOM interface with a 2D canvas and Chromium's experimental HTML-in-Canvas flag without adding video output; callback receives (ctx, { width, height, displayWidth, displayHeight, pixelRatio, time, delta }); call htmlCanvas.canvasLayer(false) to disable; mutually exclusive with videoOutput and glslLayer
- htmlCanvas.glslLayer(fragmentShader): Experimental API that locally post-processes the live DOM interface with a WebGL2 GLSL ES 3 fragment shader and source sampler; use texture(source, uv), mainImage(out vec4 fragColor, in vec2 fragCoord), source, iResolution, iTime, iTimeDelta, and iFrame; supports #include directives; mutually exclusive with videoOutput and canvasLayer
- setHidePorts(hide): Hide/show ports
- noDrag(), noPan(), noWheel(), noArrowKeyMove(), noInteract() - Interaction control (whole node)
- noArrowKeyMove() disables moving the node with arrow keys, including Shift + arrow keys. noInteract() includes this control.
- noBorder(): Hide Patchies border and selected glow
- onSelectionChange(callback): Calls callback(selected) immediately with current canvas selection, then only when it changes. Returns an unsubscribe function; subscriptions clear on rerun or destruction. Selection is separate from keyboard focus.
- onKeyDown(callback), onKeyUp(callback): Receive native KeyboardEvents while the preview or a control inside it is focused. Registered callbacks stop propagation to editor shortcuts, clear on rerun, and replace previous callbacks of the same kind.
- tailwind(enabled): Enable/disable Tailwind CSS (enabled by default)

When using noBorder() for a custom widget, use onSelectionChange() to keep a visible selection indicator that matches its theme and geometry, including rounded or inset borders. Update the widget DOM border or outline in the callback.

**Responsive sizing and layout:**
- Default to fluid-sized components: call setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } }) unless fixed sizing is explicitly requested or required by the component. Do not combine setFluidSize() with setSize().
- Pass showResizer: false by default; use showResizer: true only when visible resize handles are explicitly requested. Users can enable resizing from the node overflow menu.
- Fill the outer container using full width and height. Set outer padding and margins to zero unless explicitly requested.
- Scale text, controls, hit areas, and spacing with the current container dimensions, not just their positions. Use container-relative CSS units (with a size-query container) or update CSS variables/font size in onResize(). Initialize the layout once too.
- Use LARGE, readable fonts: at least 18px for labels and 24–32px for primary text at the initial size, growing with the UI scale. Avoid tiny fixed pixel sizes or fixed Tailwind text classes that stop text from scaling.
- Make form controls inherit the responsive font size. Use em-based control padding and spacing so the whole UI scales together; internal control padding is allowed, but outer container padding defaults to zero.

**Selective canvas interaction (CSS classes):**
Apply these classes to individual elements to block canvas interactions only for that element:
- "nodrag" — prevent node drag when the user interacts with this element
- "nopan" — prevent canvas pan when the user interacts with this element
- "nowheel" — prevent canvas zoom when scrolling over this element

**Caveats**
- Do NOT use gradient colors in Tailwind classes, like "bg-gradient-to-r from-amber-500 to-orange-400". They are not supported.

**Tips**
- If you use a border, you must use rounded-lg in the outer container, otherwise the border will be cut off.
- For more complex ui, use libraries like htm/preact/standalone: "import { html, render } from 'npm:htm/preact/standalone'", then you can "render(html\`<$\{MyComponent} />\`, root)" and write Preact components with render tagged template literals.

Example - Simple HTML with Tailwind:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } }); Object.assign(root.style, { width: '100%', height: '100%', padding: '0', margin: '0' }); const resizeUI = ({ width, height }) => root.style.fontSize = Math.max(18, 24 * Math.min(width / 400, height / 300)) + 'px'; onResize(resizeUI); resizeUI({ width: Number(width), height: Number(height) }); root.innerHTML = '<h1 class=\\"text-green-400 text-[1.5em] font-bold m-0\\">Hello!</h1><p class=\\"text-zinc-400 m-0\\">This is DOM manipulation</p>'"
  }
}
\`\`\`

Example - Interactive button:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } }); Object.assign(root.style, { width: '100%', height: '100%', padding: '0', margin: '0' }); const resizeUI = ({ width, height }) => root.style.fontSize = Math.max(18, 24 * Math.min(width / 400, height / 300)) + 'px'; onResize(resizeUI); resizeUI({ width: Number(width), height: Number(height) }); noDrag(); root.innerHTML = '<button class=\\"px-[1em] py-[0.5em] text-[1em] bg-green-400 text-black rounded cursor-pointer hover:bg-green-300\\">Click me</button>'; root.querySelector('button').onclick = () => send('clicked');"
  }
}
\`\`\`

Example - Dynamic list with messages:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } }); Object.assign(root.style, { width: '100%', height: '100%', padding: '0', margin: '0' }); const resizeUI = ({ width, height }) => root.style.fontSize = Math.max(18, 24 * Math.min(width / 400, height / 300)) + 'px'; onResize(resizeUI); resizeUI({ width: Number(width), height: Number(height) }); root.innerHTML = '<ul class=\\"w-full h-full list-none p-0 m-0 overflow-auto\\"></ul>'; const ul = root.querySelector('ul'); recv(msg => { const li = document.createElement('li'); li.textContent = msg; li.className = 'py-[0.25em] text-zinc-400'; ul.appendChild(li); });"
  }
}
\`\`\`

Example - Fluid-sized form:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } }); Object.assign(root.style, { width: '100%', height: '100%', padding: '0', margin: '0' }); const resizeUI = ({ width, height }) => root.style.fontSize = Math.max(18, 24 * Math.min(width / 400, height / 300)) + 'px'; onResize(resizeUI); resizeUI({ width: Number(width), height: Number(height) }); noDrag(); root.innerHTML = '<input type=\\"text\\" id=\\"inp\\" class=\\"w-full p-[0.5em] mb-[0.5em] text-[1em] bg-zinc-800 border border-zinc-600 text-white rounded\\"><button class=\\"w-full p-[0.5em] text-[1em] bg-green-400 text-black rounded cursor-pointer\\">Submit</button>'; root.querySelector('button').onclick = () => send(root.querySelector('#inp').value);"
  }
}
\`\`\``;
