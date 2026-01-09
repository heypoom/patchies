export const hydraPrompt = `## hydra Object Instructions

Live coding video synthesis. Use Hydra's chainable functions.

Available functions:
- setVideoCount(inlets, outlets): set video port counts (default 1, 1)
- src(s0), src(s1): access video inputs
- out(o0): set output
- fft(): audio reactivity

Example - Video Mixer:
\`\`\`json
{
  "type": "hydra",
  "data": {
    "code": "setVideoCount(2, 1)\\n\\nsrc(s0)\\n  .blend(src(s1), 0.5)\\n  .out(o0)"
  }
}
\`\`\``;
