export const pianoRollPrompt = `## pianoroll Object Instructions

A resizable MIDI clip recorder and player with a piano roll visualization.

INLETS:
- Inlet 0 (MIDI): Receives MIDI messages to record: { type: "noteOn", note: 60, velocity: 100, channel: 1 } or { type: "noteOff", ... }
- Inlet 1 (command): Control commands: "arm" | "record" | "stop" | "clear" | "loop" | "unloop"

OUTLET:
- Outlet 0: Outputs MIDI noteOn/noteOff messages during playback

HANDLE IDs:
- Inlet 0: "in-0"
- Inlet 1: "in-1"
- Outlet 0: "out-0"

TYPICAL USAGE:
{ "from": "midi.in", "outlet": 0 } → { "to": "pianoroll", "inlet": 0 }
{ "from": "pianoroll", "outlet": 0 } → { "to": "midi.out", "inlet": 0 }

WORKFLOW:
1. Connect midi.in to pianoroll inlet 0
2. Send "arm" to inlet 1 (or click ARM button)
3. Press play on transport — recording starts
4. Press stop (or set bars=2 for auto-stop) — playback begins automatically
5. Connect outlet 0 to synth or midi.out

SETTINGS: Loop (on/off), Quantize (1/16 etc), Bars (auto-stop length), Sync to Transport
`;
