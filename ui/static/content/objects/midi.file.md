Play Standard MIDI files as Patchies MIDI messages.

## Loading Files

- Click **Load MIDI** or drop a `.mid` / `.midi` file onto the node
- Dropping a MIDI file onto the canvas creates a `midi.file` node
- Send a URL string like `https://example.com/song.mid` to load through VFS
- Send a VFS path string like `user://Samples/song.mid` to load an existing VFS file
- Send raw MIDI bytes as an `ArrayBuffer`, typed array, or number array to load inline data

## Playback

The node supports play, pause, stop, seek, and loop from the UI and from messages.
Stopping always sends note-off messages for active notes so connected synths do not hang.

## Output

Outputs standard Patchies MIDI messages such as `noteOn`, `noteOff`, `controlChange`,
`programChange`, and `pitchBend`. Meta/status messages use the same outlet and can be
distinguished by their `type`.

The `loaded` message includes explicit initial channel programs and all unique
channel/program pairs in the file. `gm~` uses this to preload sampled
instruments before playback begins, including instruments needed by mid-file
program changes.

## Settings

- **Apply tempo to transport** applies the file's initial tempo on playback from the start
- **Apply time signature** applies the file's initial time signature on playback from the start
- **Sync to transport** lets the global transport play, pause, and stop the node
- **Emit meta events** sends `tempo`, `timeSignature`, `keySignature`, and `trackName` messages
- **Send position events** sends playback `position` messages
- **Loop** restarts playback at the end

## Events

Send `{type: 'events'}` to output a plain array of every scheduled MIDI and meta
event in the file. Each item is flattened with `seconds`, `ticks`, and `track`
timing fields plus the standard Patchies MIDI message fields:

```javascript
[
  { seconds: 0, ticks: 0, track: 0, type: 'tempo', bpm: 120, tick: 0 },
  { seconds: 0, ticks: 0, track: 1, type: 'noteOn', note: 60, velocity: 100, channel: 1 }
]
```

Meta events appear in the same array when the MIDI file contains them:

```javascript
[
  { seconds: 0, ticks: 0, track: 0, type: 'tempo', bpm: 120, tick: 0 },
  {
    seconds: 0,
    ticks: 0,
    track: 0,
    type: 'timeSignature',
    numerator: 4,
    denominator: 4,
    tick: 0
  },
  { seconds: 0, ticks: 0, track: 0, type: 'keySignature', key: 'C', tick: 0 },
  { seconds: 0, ticks: 0, track: 1, type: 'trackName', name: 'Piano', track: 1 }
]
```

## See Also

- [gm~](/docs/objects/gm~) - play multi-channel MIDI files with sampled instruments
- [midi.out](/docs/objects/midi.out) - send MIDI messages to hardware
- [tone~](/docs/objects/tone~) - synthesize MIDI messages
- [sonic~](/docs/objects/sonic~) - SuperCollider-based MIDI synth
