General MIDI Soundfont instrument for playing realistic MIDI parts.

Use `soundfont~` when you want a browser-ready sampled instrument that responds
to standard Patchies MIDI messages. Connect `midi.in`, `midi.file`,
`sequencer`, `js`, or `msg` to the message inlet, then connect the audio outlet
to `out~`.

For full Standard MIDI files with multiple channels, use `gm~` instead. It keeps
program changes separate per MIDI channel.

## Settings

Open the settings panel to choose the General MIDI instrument, Soundfont kit,
volume, velocity, pan, default note, detune, and reverse playback.

Choose `Custom` as the kit to reveal `Instrument URL` and load a MIDI.js
soundfont file from a URL. Custom URLs use smplr's `instrumentUrl` option, so
the built-in kit and General MIDI instrument setting are ignored while a custom
URL is active. Use `soundfont2~` instead for `.sf2` files.

`programChange` messages map to the General MIDI instrument list. Program `0`
selects `acoustic_grand_piano`, program `40` selects `violin`, and so on.
Program changes are ignored while `Custom` is selected.

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

- [gm~](/docs/objects/gm~) - multi-channel General MIDI file playback
- [soundfont2~](/docs/objects/soundfont2~) - load custom SF2 files
- [midi.in](/docs/objects/midi.in) - receive MIDI from hardware
- [out~](/docs/objects/out~) - audio output
