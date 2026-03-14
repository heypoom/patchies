16-pad drum sampler triggered by MIDI noteOn/noteOff messages. Follows the
standard GM drum map — note 36 triggers pad 1 (kick), note 37 triggers pad 2
(side stick), and so on up to note 51 (pad 16, ride cymbal).

## Loading Samples

Drag audio files directly onto individual pads from:

- The **VFS browser** (any file in your virtual filesystem)
- The **Samples sidebar** (freesound.org and other sample libraries)
- Your **OS file manager** (drag a file from Finder/Explorer)

Right-click a pad to clear its sample.

## MIDI Input

Connect a `midi.in` node to the message inlet. The node responds to standard
MIDI noteOn/noteOff messages:

```text
{ type: "noteOn",  note: 36, velocity: 100 }  →  triggers pad 1
{ type: "noteOff", note: 36, velocity: 0   }  →  releases pad 1 (gated mode)
```

## Settings

Open the settings panel (gear icon) to configure:

| Setting | Description |
|---|---|
| **Pad Count** | 8 or 16 pads |
| **Max Voices / Pad** | How many simultaneous voices per pad before the oldest is cut (1–16) |
| **NoteOff Behavior** | **One-shot** — sample plays to end regardless of noteOff. **Gated** — sample fades out on noteOff. |

## Load Message

Samples can also be assigned programmatically:

```text
{ type: "load", pad: 0, src: "user://Samples/kick.wav" }
```

## See Also

- [sampler~](/docs/objects/sampler~) — single-sample player with loop points and recording
- [soundfile~](/docs/objects/soundfile~) — audio file playback
- [midi.in](/docs/objects/midi.in) — MIDI input source
