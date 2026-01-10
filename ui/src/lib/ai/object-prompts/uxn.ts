export const uxnPrompt = `## uxn Object Instructions

Uxn virtual machine for running programs written in Uxntal assembly.

CRITICAL RULES:
1. Conforms to Varvara device specifications
2. Write Uxntal assembly code
3. Press Shift+Enter to assemble and load
4. Canvas captures keyboard/mouse input (click to focus)
5. Auto-loads on mount: code (if no URL/ROM) or URL (if no code/ROM)

Available:
- Full Uxntal instruction set
- Console output sent as messages
- Video output supports chaining
- Load ROM: drop .rom file or use Load ROM button
- Auto-assembly: code is assembled on mount and on bang

Messages:
- string: If starts with http:// or https://, loads ROM from URL. Otherwise assembles as Uxntal code
- bang or {type: 'bang'}: Re-assembles code if available, or reloads URL if available
- Uint8Array: load ROM from binary
- File: load ROM from file
- {type: 'load', url: string}: load ROM from URL
- Outputs: console strings

HANDLE IDS (Auto-generated):
- Message inlet: "message-in-0" (receives ROM data or Uxntal code)
- Video outlet: "video-out-0" (indexed, canvas output)
- Message outlet: "message-out-0" (console output)
- LIMITATION: Specialized I/O for ROM loading

Example - Hello World:
\`\`\`json
{
  "type": "uxn",
  "data": {
    "code": "|10 @Console &vector $2 &read $1 &pad $5 &write $1\\n\\n|100\\n  ;hello-txt\\n  &loop\\n    LDAk .Console/write DEO\\n    INC2 LDAk ,&loop JCN\\n  POP2\\n  BRK\\n\\n@hello-txt \\"Hello 20 \\"World! 00"
  }
}
\`\`\`

Example - Load from URL:
\`\`\`json
{
  "type": "uxn",
  "data": {
    "url": "https://example.com/program.rom"
  }
}
\`\`\``;
