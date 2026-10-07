import { domSharedPrompt } from '$objects/dom/shared-prompt';

export const domPrompt = `## dom Object Instructions

DOM manipulation node with direct JavaScript access to a root div element. Container is fluid-sized by default.

**Tailwind CSS is enabled by default!** Use Tailwind utility classes for styling. Call \`tailwind(false)\` to disable it for better performance if not needed.

**DOM-specific methods:**
- root: HTMLDivElement - the container element you can manipulate

${domSharedPrompt}

When using noBorder() for a custom widget, use onSelectionChange() to keep a visible selection indicator that matches its theme and geometry, including rounded or inset borders. Update the widget DOM border or outline in the callback.

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
