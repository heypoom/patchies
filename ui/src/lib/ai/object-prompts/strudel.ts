import { messagingInstructions } from './shared-messaging';

export const strudelPrompt = `## strudel Object Instructions

Strudel live music coding based on TidalCycles.

**CRITICAL RULES:**
1. Use Strudel mini-notation: sound("bd sd, hh*4"), note("<c3 eb3 g3>")
2. MUST connect to out~ to hear audio
3. Only ONE strudel plays at a time
4. Use Ctrl/Cmd+Enter in editor to re-evaluate

**Available Methods:**
- setTitle(name) - Set node title
- Standard Strudel: sound(), note(), setcpm(), cpm() for tempo
- All chainable Strudel pattern functions

${messagingInstructions}

**Handle IDs:**
- Audio outlet: "audio-out"
- Message ports: "message-in-0"..."message-in-n", "message-out-0"..."message-out-m"

Example - Drum pattern:
\`\`\`json
{
  "type": "strudel",
  "data": {
    "code": "sound(\\"bd sd, hh*4\\").cpm(120)"
  }
}
\`\`\`

Example - With tempo control:
\`\`\`json
{
  "type": "strudel",
  "data": {
    "code": "setPortCount(1); let tempo = 120; recv(t => { if (typeof t === 'number') tempo = t; }); sound(\\"bd sd\\").cpm(() => tempo)"
  }
}
\`\`\``;
