Load a SoundFont2 `.sf2` file and play it from Patchies MIDI messages.

Use `soundfont2~` when you have a custom SF2 file hosted at a URL. Set the URL
in the settings panel, then choose the instrument name after the file loads.
Connect the audio outlet to `out~`.

## Settings

Open the settings panel to set:

| Setting | Description |
| -------- | -------- |
| SF2 URL | URL of the `.sf2` file to load |
| Instrument | Instrument name inside the SF2 file |
| Volume / Velocity / Pan | Playback level and stereo placement |
| Default Note | Note used by `bang` or number triggers |

`programChange` messages select by the loaded SF2 instrument order when the file
exposes instrument names.

## Messages

```text
{ type: "noteOn", note: 60, velocity: 100, time: audioTime }
{ type: "noteOff", note: 60, time: audioTime }
{ type: "programChange", program: 0 }
{ type: "bang", value: 1, duration: 0.5 }
```

## See Also

- [soundfont~](/docs/objects/soundfont~) - built-in General MIDI Soundfont
- [midi.file](/docs/objects/midi.file) - play MIDI files as messages
- [out~](/docs/objects/out~) - audio output
