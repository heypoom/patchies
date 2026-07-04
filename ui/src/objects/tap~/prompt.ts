export const tapTildePrompt = `## tap~ Object Instructions

Headless oscilloscope — captures audio frames and forwards them as messages. Use when you want waveform data to flow into canvas, GLSL, Hydra, or any downstream node.

Unlike scope~ (which renders a built-in display), tap~ has no display. Pair it with scope.canvas (waveform) or scope-xy.canvas (XY) presets, or process the raw buffers yourself.

Node format:
- Create tap~ as a dedicated node: "type": "tap~"
- Do NOT create tap~ as a generic "object" node
- Do NOT use text-object fields like expr, name, or params
- Store settings directly in data: bufferSize, mode, fps, zeroCrossing

Inlets:
- inlet 0: audio signal (X axis in XY mode)
- inlet 1: Y axis signal (XY mode only)
- inlet 2: message control inlet

Output (outlet 0):
- wave mode: Float32Array of audio samples
- xy mode: { type: "xy", x: Float32Array, y: Float32Array }

Settings:
- bufferSize: 64–2048, default 512
- mode: "wave" or "xy", default "wave"
- fps: 0–120, default 0 (unlimited)
- zeroCrossing: boolean, default true. Set false for continuous monitoring without scope-style trigger locking.

Control messages:
- { type: "setMode", value: "wave" | "xy" }
- { type: "setFpsLimit", value: number } (clamped to 0–120)
- { type: "setZeroCrossing", value: boolean }
- { type: "setSamples", value: number } (rounded and clamped to 64–2048)

Default data:
\`\`\`json
{
  "bufferSize": 512,
  "mode": "wave",
  "fps": 0,
  "zeroCrossing": true
}
\`\`\`

Example - Basic waveform tap into scope.canvas:
\`\`\`json
{
  "type": "tap~",
  "data": { "bufferSize": 512, "mode": "wave", "fps": 0, "zeroCrossing": true }
}
\`\`\`

Example - XY mode for Lissajous figures:
\`\`\`json
{
  "type": "tap~",
  "data": { "bufferSize": 512, "mode": "xy", "fps": 0, "zeroCrossing": true }
}
\`\`\`

Example - Continuous monitoring at 30fps:
\`\`\`json
{
  "type": "tap~",
  "data": { "bufferSize": 512, "mode": "wave", "fps": 30, "zeroCrossing": false }
}
\`\`\`

Typical patch pattern:
- [osc~ 440] → [tap~] → [scope.canvas]
- [osc~ 440] → [tap~] → [glsl~] (pass buffer as uniform)
- [osc~ 440] + [osc~ 220] → [tap~] with mode "xy" → [scope-xy.canvas]`;
