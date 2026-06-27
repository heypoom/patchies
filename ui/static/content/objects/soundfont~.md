General MIDI Soundfont instrument for playing realistic MIDI parts.

Use `soundfont~` when you want a browser-ready sampled instrument that responds
to standard Patchies MIDI messages. Connect `midi.in`, `midi.file`,
`sequencer`, `js`, or `msg` to the message inlet, then connect the audio outlet
to `out~`.

## Settings

Open the settings panel to choose the General MIDI instrument, Soundfont kit,
volume, velocity, pan, default note, detune, and reverse playback.

`programChange` messages map to the General MIDI instrument list. Program `0`
selects `acoustic_grand_piano`, program `40` selects `violin`, and so on.

## Messages

```text
{ type: "noteOn", note: 60, velocity: 100, time: audioTime }
{ type: "noteOff", note: 60, time: audioTime }
{ type: "programChange", program: 40 }
{ type: "controlChange", control: 64, value: 127 }
{ type: "bang", value: 1, time: audioTime, duration: 0.5 }
```

A number triggers the configured default note with that gain multiplier.

## See Also

- [soundfont2~](/docs/objects/soundfont2~) - load custom SF2 files
- [midi.in](/docs/objects/midi.in) - receive MIDI from hardware
- [out~](/docs/objects/out~) - audio output
