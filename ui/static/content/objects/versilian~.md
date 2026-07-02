Versilian Community Sample Library instrument.

Use `versilian~` for orchestral-style sampled instruments from smplr's
Versilian collection. Connect the audio outlet to `out~`.

## Settings

Choose the Versilian instrument in the settings panel, then adjust volume,
velocity, pan, default note, detune, and reverse playback.

## Attribution

Samples are from the
[Versilian Community Sample Library](https://github.com/sgossner/VCSL) by
Versilian Studios LLC. VCSL is a CC0 general-purpose sample library built as a
broader expansion of the VSCO 2 CE sample set. The sounds are public domain and
can be used freely, including in commercial work.

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
