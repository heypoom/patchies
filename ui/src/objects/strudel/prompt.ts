export const strudelPrompt = `## strudel Object Instructions

Strudel live music coding based on TidalCycles.

**CRITICAL RULES:**
1. Use Strudel mini-notation: sound("bd sd, hh*4"), note("<c3 eb3 g3>")
2. MUST connect to out~ to hear audio — strudel has ONLY an audio outlet ("audio-out"), NO message outlets
3. Only ONE strudel plays at a time
4. Use Ctrl/Cmd+Enter in editor to re-evaluate

**Available Methods:**
- setTitle(name) - Set node title
- Standard Strudel: sound(), note(), setcpm(), cpm() for tempo
- All chainable Strudel pattern functions

**Message Passing:**
- recv((data, meta) => {}) - Register inlet callback
  * data: the message payload (use directly, NOT m.data)
  * meta.inlet: inlet index (0, 1, 2, ...)
- setPortCount(inlets, outlets) - Configure number of message ports

**Control Messages Format:**
- Bang is {type: 'bang'}
- Control messages MUST have a 'type' field (e.g. {type: 'bang'}, {type: 'play'})
- Common control messages: bang (most common), clear, reset, start, stop, pause, play, run, toggle

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
