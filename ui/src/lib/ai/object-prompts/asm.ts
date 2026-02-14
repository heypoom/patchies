export const asmPrompt = `## asm Object Instructions

Virtual stack machine assembly interpreter inspired by TIS-100 and Shenzhen I/O.

CRITICAL RULES:
1. All instructions are LOWERCASE
2. Stack effects shown as ( before -- after ) where rightmost is top
3. Labels end with colon: \`label_name:\`
4. Use \\n for newlines in JSON code strings

HANDLE IDS:
- Inlets: "in-0", "in-1", etc. (configurable count, default 1)
- Outlets: "message-out-0", "message-out-1", "message-out-2" (configurable count, default 3)
- Send numbers/arrays to inlet, receive via \`receive\` instruction
- Output via \`send <port> <count>\` instruction

INSTRUCTIONS (all lowercase):

Stack: push <n>, pop, dup, swap, over, rotate, nip, tuck, pick <n>
Arithmetic: add, sub, mul, div, mod, inc, dec
Comparison: equal, not_equal, less_than, less_than_or_equal, greater_than, greater_than_or_equal
Bitwise: and, or, xor, not, left_shift, right_shift
Control: jump <label>, jump_zero <label>, jump_not_zero <label>, call <label>, return, halt
Memory: load <addr>, store <addr>, read <n>, write <n>
I/O: send <port> <count>, receive, print
Timing: sleep_tick <n>, sleep_ms <n>

MEMORY LAYOUT (8KB total, 4096 u16 cells):
- Code: 0x000-0x1FF (512 cells, ~250 instructions)
- Data: 0x200-0x2FF (256 cells, .string/.value constants)
- Call Stack: 0x300-0x33F (64 cells, ~32 call depth)
- RAM: 0x340-0xFFF (3264 cells, data stack + user memory)
- External: 0x1000-0xFFFF (61440 cells, routed to asm.mem objects)

IMPORTANT: Use HIGH addresses (0xF00+) for load/store to avoid colliding with the data stack which grows UP from 0x340.

I/O PATTERN:
- \`receive\` waits for input, pushes value onto stack
- \`send <port> <count>\` pops count values and sends to outlet port (0-3)
- Machine auto-wakes when data arrives (reactive dataflow)

Example - Echo (receive and send back):
\`\`\`json
{
  "type": "asm",
  "data": {
    "code": "loop:\\nreceive\\nsend 0 1\\njump loop"
  }
}
\`\`\`

Example - Accumulator (running sum):
\`\`\`json
{
  "type": "asm",
  "data": {
    "code": "loop:\\nreceive\\nload 100\\nadd\\ndup\\nstore 100\\nsend 0 1\\njump loop"
  }
}
\`\`\`

Example - Double input:
\`\`\`json
{
  "type": "asm",
  "data": {
    "code": "loop:\\nreceive\\npush 2\\nmul\\nsend 0 1\\njump loop"
  }
}
\`\`\`

INPUT MESSAGES:
- number or number[]: data for \`receive\` instruction
- "bang", "step": step one instruction
- "play", "pause", "toggle": control auto-clocking
- "reset", "run": reset/reload program

OUTPUT MESSAGES:
- number or number[] from \`send\` instruction`;
