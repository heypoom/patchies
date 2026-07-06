export const bytebeatPrompt = `## bytebeat~ Object Instructions

Bytebeat algorithmic synthesis using mathematical expressions on time counter t.

CRITICAL RULES:
1. Write expressions using t (time counter that increments each sample)
2. Classic bytebeat output is 0-255 (wraps automatically)
3. Use floatbeat type for -1.0 to 1.0 output (Math.sin, etc.)
4. Lower sample rates = crunchier sound (8000 Hz is classic)
5. MUST connect to out~ for audio output

Data Structure:
- expr: JavaScript expression using t
- isPlaying: boolean (playback state)
- type: "bytebeat" | "floatbeat" | "signedBytebeat"
- syntax: "infix" | "postfix" | "glitch" | "function"
- sampleRate: number (8000, 11025, 22050, 32000, 44100, 48000)
- autoEval: boolean (default true, evaluates expression as you type; false requires Shift+Enter)

Example - Classic Bytebeat:
\`\`\`json
{
  "type": "bytebeat~",
  "data": {
    "expr": "((t >> 10) & 42) * t",
    "type": "bytebeat",
    "syntax": "infix",
    "sampleRate": 8000,
    "isPlaying": false
  }
}
\`\`\`

Example - Sierpinski Harmony:
\`\`\`json
{
  "type": "bytebeat~",
  "data": {
    "expr": "t & t >> 8",
    "type": "bytebeat",
    "syntax": "infix",
    "sampleRate": 8000,
    "isPlaying": false
  }
}
\`\`\`

Example - Floatbeat Sine:
\`\`\`json
{
  "type": "bytebeat~",
  "data": {
    "expr": "Math.sin(t / 10) * 0.5",
    "type": "floatbeat",
    "syntax": "infix",
    "sampleRate": 44100,
    "isPlaying": false
  }
}
\`\`\`

Control Messages:
- {type: 'play'} - Start playback
- {type: 'pause'} - Pause (keeps t position)
- {type: 'stop'} - Stop and reset t=0
- {type: 'bang'} - Evaluate and play
- {type: 'setType', value: 'floatbeat'} - Change type
- {type: 'setSyntax', value: 'postfix'} - Change syntax
- {type: 'setSampleRate', value: 11025} - Change sample rate`;
