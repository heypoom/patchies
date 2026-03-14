export const padsPrompt = `## pads~ Object Instructions

A 16-pad drum sampler triggered by MIDI noteOn/noteOff messages.
Follows the GM drum map: note 36 = pad 1 (kick), note 37 = pad 2 (side stick), ... note 51 = pad 16 (ride).

HANDLE IDS:
- Message inlet: "message-in" (receives MIDI messages)
- Audio outlet: "audio-out" (stereo mix of all pads)

MIDI INPUT FORMAT:
- { type: "noteOn", note: 36, velocity: 100 } — trigger pad 1
- { type: "noteOff", note: 36, velocity: 0 } — release pad 1 (only relevant in gated mode)

TYPICAL PATCH: midi.in → pads~ → out~

LOAD MESSAGE (to assign a sample via message):
- { type: "load", pad: 0, src: "user://Samples/kick.wav" }

DATA FORMAT:
{
  "type": "pads~"
}

Note: samples are assigned by drag-dropping audio files onto each pad in the UI.
The AI cannot pre-load samples into pads.`;
