Versilian Community Sample Library instrument.

Use `versilian~` for orchestral-style sampled instruments from smplr's
Versilian collection. Connect the audio outlet to `out~`.

## Settings

Choose the Versilian instrument in the settings panel, then adjust volume,
velocity, pan, default note, detune, and reverse playback.

## Messages

```text
{ type: "noteOn", note: 67, velocity: 100 }
{ type: "noteOff", note: 67 }
{ type: "bang", value: 1, duration: 0.75 }
```

## See Also

- [mellotron~](/docs/objects/mellotron~) - Mellotron archive samples
- [soundfont~](/docs/objects/soundfont~) - General MIDI instrument set
- [out~](/docs/objects/out~) - audio output
