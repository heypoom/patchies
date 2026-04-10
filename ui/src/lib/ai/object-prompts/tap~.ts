export const tapTildePrompt = `## tap~ Object Instructions

Headless oscilloscope — captures trigger-synced audio frames and forwards them as messages. Use when you want waveform data to flow into canvas, GLSL, Hydra, or any downstream node.

Unlike scope~ (which renders a built-in display), tap~ has no display. Pair it with scope.canvas (waveform) or scope-xy.canvas (XY) presets, or process the raw buffers yourself.

Inlets:
- inlet 0: audio signal (X axis in XY mode)
- inlet 1: Y axis signal (XY mode only)
- inlet 2: bufferSize (int, 64–2048, default 512)
- inlet 3: mode ("wave" or "xy", default "wave")
- inlet 4: fps (float, 0 = unlimited, default 0)

Output (outlet 0):
- wave mode: Float32Array of audio samples, trigger-synced on rising zero-crossing
- xy mode: { type: "xy", x: Float32Array, y: Float32Array }

Example - Basic waveform tap into scope.canvas:
\`\`\`json
{
  "type": "object",
  "data": { "expr": "tap~", "name": "tap~", "params": [] }
}
\`\`\`

Example - XY mode for Lissajous figures:
\`\`\`json
{
  "type": "object",
  "data": { "expr": "tap~ 512 xy", "name": "tap~", "params": [512, "xy"] }
}
\`\`\`

Example - Throttled capture at 30fps:
\`\`\`json
{
  "type": "object",
  "data": { "expr": "tap~ 512 wave 30", "name": "tap~", "params": [512, "wave", 30] }
}
\`\`\`

Typical patch pattern:
- [osc~ 440] → [tap~] → [scope.canvas]
- [osc~ 440] → [tap~] → [glsl~] (pass buffer as uniform)
- [osc~ 440] + [osc~ 220] → [tap~ 512 xy] → [scope-xy.canvas]`;
