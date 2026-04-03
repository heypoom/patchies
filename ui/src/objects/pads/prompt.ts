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
- pad is zero-based (0–15 for 16 pads, 0–7 for 8 pads)

PRE-LOADING SAMPLES:
The _initialUrls field can pre-load samples, but it is ONLY set externally by the chat tool
via the insert data passthrough. Do NOT generate _initialUrls yourself — you do not have
access to valid sample URLs. Just create the pads~ with basic settings and let the chat
tool handle sample URLs.

NODE DATA SCHEMA:
{
  padCount: 8 | 16,             // number of pads (default 16)
  maxVoices: number,            // polyphony per pad (default 4)
  noteOffMode: 'ignore'|'stop', // what happens on noteOff (default 'ignore')
  showGmLabels: boolean,        // show GM drum names (default true)
  showWaveform: boolean,        // show waveform display (default true)
}

DATA FORMAT EXAMPLE:
{
  "type": "pads~",
  "data": {}
}`;
