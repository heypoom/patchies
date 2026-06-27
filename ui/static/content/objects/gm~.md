Multi-channel General MIDI sampled instrument for playing MIDI files.

Use `gm~` when a MIDI stream contains multiple channels and `programChange`
messages. It keeps a separate General MIDI program for each channel, creates
the matching sampled instrument when that channel plays, and mixes everything
to one audio outlet.

```text
[midi.file] -> [gm~] -> [out~]
```

The node is also a channel monitor. Each of the 16 cells shows the current
program, resolved instrument name, loading/error state, active note count, and
short activity flashes for incoming MIDI.

## Settings

- **Source** chooses between built-in Soundfont kits and a custom SoundFont2 file
- **Soundfont Kit** chooses the built-in MIDI.js kit when Source is `Soundfont`
- **Instrument URL** loads a MIDI.js soundfont file when Soundfont Kit is `Custom`
- **SF2 URL** loads a `.sf2` file when Source is `Soundfont2`
- **Volume** sets the mixed output volume for all loaded channels
- **Velocity** sets the default velocity when a message omits one

## Messages

`gm~` responds to the same MIDI messages emitted by `midi.file`:

```text
{ type: "programChange", program: 40, channel: 2 }
{ type: "noteOn", note: 64, velocity: 90, channel: 2, time: audioTime }
{ type: "noteOff", note: 64, channel: 2, time: audioTime }
{ type: "controlChange", control: 64, value: 127, channel: 2 }
```

Channels are 1-based. If `channel` is omitted, `gm~` uses channel 1.

For built-in Soundfont mode, `programChange` uses the General MIDI program
list. Program `0` selects `acoustic_grand_piano`, program `40` selects
`violin`, and so on.

When Soundfont Kit is `Custom`, `gm~` passes `Instrument URL` to smplr and uses
that custom sampled instrument for loaded channels. General MIDI program names
are ignored in this mode because the URL chooses the instrument.

For SoundFont2 mode, `programChange` maps the program number to the matching
instrument index reported by the loaded SF2 file.

> **Note**: Channel 10 is preserved as a normal MIDI channel, but `gm~` does
> not yet implement special General MIDI drum-kit note mapping.

## See Also

- [midi.file](/docs/objects/midi.file) - play Standard MIDI files as messages
- [soundfont~](/docs/objects/soundfont~) - single-instrument Soundfont player
- [soundfont2~](/docs/objects/soundfont2~) - single-instrument SF2 player
- [out~](/docs/objects/out~) - audio output
