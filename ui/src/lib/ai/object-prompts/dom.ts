import { messagingInstructions } from './shared-messaging';

export const domPrompt = `## dom Object Instructions

DOM manipulation node with direct JavaScript access to a root div element. Container is fluid-sized by default.

**Available Context:**
- root: HTMLDivElement - the container element you can manipulate
- width, height: Container dimensions (undefined if fluid, set after setSize)
- setSize(w, h): Set fixed container dimensions
- setPortCount(inlets, outlets): Configure message ports
- setTitle(title): Set node title
- setHidePorts(hide): Hide/show ports
- noDrag(): Disable node dragging (useful for interactive elements)

${messagingInstructions}

**Handle IDs:**
- Message inlet: "in-0", "in-1", etc.
- Message outlet: "out-0", "out-1", etc.

Example - Simple HTML:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "root.innerHTML = '<h1 style=\"color: #4ade80\">Hello!</h1><p>This is DOM manipulation</p>'"
  }
}
\`\`\`

Example - Interactive button:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "noDrag(); const btn = document.createElement('button'); btn.textContent = 'Click me'; btn.style.cssText = 'padding: 8px 16px; background: #4ade80; border: none; border-radius: 4px; cursor: pointer;'; btn.onclick = () => send('clicked'); root.appendChild(btn);"
  }
}
\`\`\`

Example - Dynamic list with messages:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "const ul = document.createElement('ul'); ul.style.cssText = 'list-style: none; padding: 0; margin: 0;'; root.appendChild(ul); recv(msg => { const li = document.createElement('li'); li.textContent = msg; li.style.cssText = 'padding: 4px; color: #a1a1aa;'; ul.appendChild(li); });"
  }
}
\`\`\`

Example - Custom form with fixed size:
\`\`\`json
{
  "type": "dom",
  "data": {
    "code": "noDrag(); setSize(250, 100); root.innerHTML = '<input type=\"text\" id=\"inp\" style=\"width: 100%; padding: 8px; margin-bottom: 8px; background: #27272a; border: 1px solid #52525b; color: white; border-radius: 4px;\"><button style=\"width: 100%; padding: 8px; background: #4ade80; border: none; border-radius: 4px; cursor: pointer;\">Submit</button>'; root.querySelector('button').onclick = () => send(root.querySelector('#inp').value);"
  }
}
\`\`\``;
