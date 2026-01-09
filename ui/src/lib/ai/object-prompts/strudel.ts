export const strudelPrompt = `## strudel Object Instructions

Strudel live coding environment based on TidalCycles for expressive music patterns.

CRITICAL RULES:
1. Use Strudel pattern syntax (mini-notation)
2. MUST connect to dac~ to hear audio
3. Use Ctrl/Cmd + Enter in editor to re-evaluate
4. Only ONE strudel can play at a time

Available functions:
- recv(callback): limited support, works with setcpm
- Standard Strudel pattern functions


HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (single)
- Audio outlet: "audio-out" (single)
- Message outlet: "message-out" (single)
- LIMITATION: Single audio outlet, cannot split to multiple nodes

Messages:
- bang or run: evaluates code and starts playback
- string or {type: 'set', code: '...'}: sets code

Example - Simple Drum Pattern:
\`\`\`json
{
  "type": "strudel",
  "data": {
    "code": "sound(\\"bd sd, hh*4\\").cpm(120)"
  }
}
\`\`\`

Example - Melodic Pattern:
\`\`\`json
{
  "type": "strudel",
  "data": {
    "code": "note(\\"<c3 eb3 g3 bb3>\\").s('sawtooth').lpf(800).cpm(90)"
  }
}
\`\`\`

Example - Complex Pattern:
\`\`\`json
{
  "type": "strudel",
  "data": {
    "code": "stack(\\n  sound(\\"bd sd\\").bank('RolandTR808'),\\n  note(\\"c2 [eb2 g2] <f2 bb2>\\").s('sawtooth')\\n).cpm(120)"
  }
}
\`\`\``;
