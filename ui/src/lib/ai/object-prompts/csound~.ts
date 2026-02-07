export const csoundPrompt = `## csound~ Object Instructions

Csound sound and music computing system.

CRITICAL RULES:
1. Write Csound orchestra and score code
2. WARNING: Only ONE csound~ per patch (known bug)
3. MUST connect to out~ for audio output
4. Use instr/endin blocks for instruments

Messages:
- bang: resume or re-eval code
- play/pause/stop/reset: playback control
- {type: 'setChannel', channel: 'name', value: number}: set control channel
- {type: 'noteOn', note: 60, velocity: 127}: MIDI note on
- {type: 'noteOff', note: 60}: MIDI note off
- {type: 'readScore', value: 'i1 0 1'}: send score
- {type: 'eval', code: '...'}: evaluate code

HANDLE IDS (Auto-generated):
- Audio inlet: "audio-in-0" (indexed)
- Message inlet: "message-in-1" (indexed)
- Audio outlet: "audio-out-0" (single)
- LIMITATION: Multiple inlets but single audio outlet

Example - Simple Sine:
\`\`\`json
{
  "type": "csound~",
  "data": {
    "code": "instr 1\\n  asig oscili 0.5, 440\\n  out asig\\nendin\\nschedule(1, 0, 10)"
  }
}
\`\`\`

Example - FM Synth:
\`\`\`json
{
  "type": "csound~",
  "data": {
    "code": "instr 1\\n  ifreq = p4\\n  amod oscili 200, ifreq*2\\n  acar oscili 0.5, ifreq + amod\\n  out acar\\nendin\\nschedule(1, 0, 2, 440)"
  }
}
\`\`\``;
