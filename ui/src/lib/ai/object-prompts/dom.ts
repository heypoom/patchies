import { messagingInstructions } from './shared-messaging';

export const domPrompt = `## dom Object Instructions

DOM manipulation node with direct JavaScript access to a root div element. Container is fluid-sized by default.

**Tailwind CSS is enabled by default!** Use Tailwind utility classes for styling. Call \`tailwind(false)\` to disable it for better performance if not needed.

**Available Context:**
- root: HTMLDivElement - the container element you can manipulate
- width, height: Container dimensions (undefined if fluid, set after setSize)
- setSize(w, h): Set fixed container dimensions
- setPortCount(inlets, outlets): Configure message ports
- setTitle(title): Set node title
- setHidePorts(hide): Hide/show ports
- noDrag(): Disable node dragging (useful for interactive elements)
- tailwind(enabled): Enable/disable Tailwind CSS (enabled by default)

${messagingInstructions}

**Handle IDs:**
- Message inlet: "in-0", "in-1", etc.
- Message outlet: "out-0", "out-1", etc.

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
    "code": "root.innerHTML = '<h1 class=\"text-green-400 text-2xl font-bold\">Hello!</h1><p class=\"text-zinc-400\">This is DOM manipulation</p>'"
  }
}
\`\`\`

Example - Interactive button:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "noDrag(); root.innerHTML = '<button class=\"px-4 py-2 bg-green-400 text-black rounded cursor-pointer hover:bg-green-300\">Click me</button>'; root.querySelector('button').onclick = () => send('clicked');"
  }
}
\`\`\`

Example - Dynamic list with messages:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "root.innerHTML = '<ul class=\"list-none p-0 m-0\"></ul>'; const ul = root.querySelector('ul'); recv(msg => { const li = document.createElement('li'); li.textContent = msg; li.className = 'p-1 text-zinc-400'; ul.appendChild(li); });"
  }
}
\`\`\`

Example - Custom form with fixed size:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "noDrag(); setSize(250, 100); root.innerHTML = '<input type=\"text\" id=\"inp\" class=\"w-full p-2 mb-2 bg-zinc-800 border border-zinc-600 text-white rounded\"><button class=\"w-full p-2 bg-green-400 text-black rounded cursor-pointer\">Submit</button>'; root.querySelector('button').onclick = () => send(root.querySelector('#inp').value);"
  }
}
\`\`\``;
