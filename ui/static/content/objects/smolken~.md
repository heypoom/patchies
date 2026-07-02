Smolken double bass sampled instrument.

Use `smolken~` for plucked, bowed, or switched double bass articulations driven
by MIDI note messages. Connect the audio outlet to `out~`.

## Settings

Choose the bass articulation in the settings panel, then adjust volume,
velocity, pan, default note, detune, and reverse playback.

## Messages

```text
{ type: "noteOn", note: 43, velocity: 100 }
{ type: "noteOff", note: 43 }
{ type: "bang", value: 1, duration: 0.6 }
```

## See Also

- [mellotron~](/docs/objects/mellotron~) - Mellotron archive samples
- [soundfont~](/docs/objects/soundfont~) - General MIDI instrument set
- [out~](/docs/objects/out~) - audio output
