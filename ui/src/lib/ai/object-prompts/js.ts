export const jsPrompt = `## js Object Instructions

JavaScript code execution block.

Available functions:
- send(data), recv(callback): message passing
- setPortCount(inlets, outlets): set message port counts
- setRunOnMount(enabled): auto-run on load
- console.log(): logging
- fft(): audio analysis
- esm(moduleName): import NPM packages
- setInterval, requestAnimationFrame (auto-cleanup)

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (controlled by setPortCount)
- Message outlet: "message-out" (controlled by setPortCount)
- setPortCount(inlets, outlets) controls handle count
- LIMITATION: Cannot have mixed inlet types (all message or all message)

Example - Random Number Generator:
\`\`\`json
{
  "type": "js",
  "data": {
    "code": "setRunOnMount(true)\\nsetPortCount(0, 1)\\n\\nsetInterval(() => {\\n  send(Math.random());\\n}, 1000);"
  }
}
\`\`\``;
