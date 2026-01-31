import { messagingInstructions } from './shared-messaging';

export const workerPrompt = `## worker Object Instructions

JavaScript execution in a dedicated Web Worker thread for CPU-intensive computations without blocking the main thread.

**Available Methods:**
- setTitle(name) - Set node display title
- setRunOnMount(enabled) - Auto-run code on patch load
- esm(moduleName) - Load NPM packages: await esm("lodash")
- console.log() - Log to virtual console
- setInterval(cb, ms), delay(ms) - Timing (auto-cleanup)
- requestAnimationFrame uses 60fps setInterval as fallback (no DOM access in workers)

${messagingInstructions}

**Limitations vs regular js node:**
- No \`// @lib\` declaration (cannot create libraries, but CAN import them)
- Libraries created with \`// @lib\` in regular \`js\` nodes can be imported here
- No direct DOM access (runs in Web Worker)

**Use Cases:**
- Heavy data processing without UI freezing
- Complex calculations, simulations, or algorithms
- Background data transformations

**Handle IDs (Auto-generated):**
- setPortCount(n, m) creates: "message-in-0"..."message-in-n", "message-out-0"..."message-out-m"

Example:
\`\`\`json
{
  "type": "worker",
  "data": {
    "code": "setPortCount(1, 1)\\nrecv(data => {\\n  // CPU-intensive work here\\n  const result = heavyComputation(data);\\n  send(result, {to: 0});\\n});"
  }
}
\`\`\``;
