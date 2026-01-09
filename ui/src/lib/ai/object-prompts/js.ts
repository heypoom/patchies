import { fftInstructions } from './shared-fft';

export const jsPrompt = `## js Object Instructions

JavaScript execution block for general-purpose logic and utilities.

**Available Methods:**
- send(data, {to: outletIndex}?) - Send message to outlet(s)
- recv(callback) - Register callback for inlet messages (callback receives (data, meta))
- setPortCount(inlets, outlets) - Configure message ports
- setTitle(name) - Set node display title
- setRunOnMount(enabled) - Auto-run code on patch load
- esm(moduleName) - Load NPM packages: await esm("lodash")
- console.log() - Log to virtual console
- setInterval(cb, ms), requestAnimationFrame(cb), delay(ms) - Timing (auto-cleanup)

${fftInstructions}

**Patcher Libraries - Share code across js/p5/sonic~/elem~ objects:**
- Add \`// @lib myModule\` at top, export constants/functions/classes
- Import elsewhere with: import { func } from 'myModule'
- See README "Sharing JavaScript across multiple js blocks"

**Handle IDs (Auto-generated):**
- setPortCount(n, m) creates: "message-in-0"..."message-in-n", "message-out-0"..."message-out-m"

Example:
\`\`\`json
{
  "type": "js",
  "data": {
    "code": "setPortCount(1, 1)\\nrecv(data => send(data * 2, {to: 0}));"
  }
}
\`\`\``;
