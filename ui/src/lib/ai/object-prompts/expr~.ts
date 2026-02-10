export const exprTildePrompt = `## expr~ Object Instructions

Audio-rate mathematical expression evaluator. Process audio signals with math expressions!

CRITICAL RULES:
1. Runs at AUDIO RATE (48kHz) - processes every audio sample
2. Use $1-$9 for control-rate inlets (receives messages)
3. Always needs audio input - use sig~ for constant signals
4. MUST connect to compressor~ or limiter~ - can create LOUD spikes!

Available variables:
- s: current sample value (-1 to 1)
- i: current sample index in buffer (0 to bufferSize)
- t: current time in seconds (float)
- channel: current channel index (0 or 1 for stereo)
- bufferSize: audio buffer size (usually 128)
- samples: array of all samples in current channel
- input: first input audio signal
- inputs: array of all connected input audio signals
- $1 to $9: control-rate inlet values

Available functions (same as expr):
- Arithmetic: +, -, *, /, ^, %
- Trigonometry: sin(), cos(), tan(), etc.
- Math: sqrt(), abs(), ceil(), floor(), round(), log(), exp()
- Logic: ==, !=, <, >, <=, >=, and, or, not
- Conditionals: condition ? true_val : false_val
- Constants: PI, E
- random(): white noise
- phasor(freq): phase accumulator (0-1 ramp) for click-free variable-frequency oscillators

IMPORTANT - phasor vs t:
- Use t for FIXED frequencies: sin(t * 440 * PI * 2)
- Use phasor($1) for VARIABLE frequencies: sin(phasor($1) * PI * 2)
- Why? Changing $1 in sin(t * $1) causes phase jumps (clicks). phasor() accumulates phase smoothly.

Example - Pass Through:
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "s"
  }
}
\`\`\`

Example - Fixed Frequency Oscillator:
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "sin(t * 440 * PI * 2)"
  }
}
\`\`\`

Example - Variable Frequency Oscillator (click-free):
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "sin(phasor($1) * PI * 2)"
  }
}
\`\`\`

Example - Gain Control:
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "s * $1"
  }
}
\`\`\`

Example - Distortion (squaring):
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "s ^ 2"
  }
}
\`\`\`

Example - White Noise:
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "random()"
  }
}
\`\`\`

Example - FM Synthesis (requires audio input):
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "sin(t * 440 * PI * 2 + s * $1)"
  }
}
\`\`\`

HANDLE IDS (Auto-generated):
- Audio inlet: "audio-in" (single)
- Audio outlet: "audio-out" (single)
- Message inlets: "message-in-0", "message-in-1", ... (for $1, $2, $3, etc.)
- LIMITATION: Single audio I/O, multiple message inlets

WARNING: Always use compressor~ after expr~ to prevent dangerous audio spikes!`;
