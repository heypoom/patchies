export const chuckPrompt = `## chuck~ Object Instructions

ChucK audio programming language for real-time sound synthesis.

CRITICAL RULES:
1. Write ChucK code for algorithmic composition
2. Use Ctrl/Cmd + Enter to replace most recent shred
3. Use Ctrl/Cmd + \\ to add new shred
4. Use Ctrl/Cmd + Backspace to remove shred
5. MUST connect to out~ for audio output

Available:
- Full ChucK language
- Runs via WebChucK in browser
- Multiple concurrent shreds
- Real-time synthesis

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (single)
- Audio outlet: "audio-out" (single)
- LIMITATION: Single audio outlet only

Example - Sine Wave:
\`\`\`json
{
  "type": "chuck~",
  "data": {
    "code": "SinOsc s => dac;\\n440 => s.freq;\\n0.5 => s.gain;\\nwhile(true) { 1::second => now; }"
  }
}
\`\`\`

Example - FM Synth:
\`\`\`json
{
  "type": "chuck~",
  "data": {
    "code": "SinOsc mod => SinOsc car => dac;\\n2 => mod.sync;\\n200 => mod.freq;\\n440 => car.freq;\\nwhile(true) {\\n  Math.random2f(100,500) => mod.freq;\\n  200::ms => now;\\n}"
  }
}
\`\`\``;
