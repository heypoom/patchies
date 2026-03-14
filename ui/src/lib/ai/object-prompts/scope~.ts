export const scopePrompt = `## scope~ Object Instructions

Oscilloscope display for visualizing audio signals. Renders waveforms or XY (Lissajous) plots on a resizable canvas.

Configuration:
- mode: "waveform" (default) | "xy" — waveform shows a single signal over time; xy plots two signals against each other (Lissajous)
- bufferSize: number of samples to display (default: 512, range: 64–2048)
- xScale: horizontal zoom (default: 1)
- yScale: vertical zoom / amplitude scale (default: 1)
- fps: refresh rate cap in Hz (default: 0 = uncapped)
- plotType: "line" (default) | "point" | "bezier"
- decay: trail persistence 0.01–1, where 1 = no trail (default: 1)
- unipolar: boolean — maps signal range to 0–1 instead of -1–1 (default: false). Useful for envelope followers, RMS levels, or any non-negative signal.

HANDLE IDS (Auto-generated):
- Audio inlet 0: "audio-in-0" (X axis in xy mode, signal input in waveform mode)
- Audio inlet 1: "audio-in-1" (Y axis — only present when mode is "xy")

Example - Basic waveform scope:
\`\`\`json
{
  "type": "scope~",
  "data": {}
}
\`\`\`

Example - XY / Lissajous scope with trail:
\`\`\`json
{
  "type": "scope~",
  "data": {
    "mode": "xy",
    "decay": 0.05,
    "plotType": "point"
  }
}
\`\`\`

Example - Zoomed waveform with larger buffer:
\`\`\`json
{
  "type": "scope~",
  "data": {
    "bufferSize": 1024,
    "xScale": 2,
    "yScale": 1.5,
    "plotType": "bezier"
  }
}
\`\`\``;
