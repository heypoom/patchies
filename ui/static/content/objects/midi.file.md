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

## Settings

- **Apply tempo to transport** applies the file's initial tempo on playback from the start
- **Apply time signature** applies the file's initial time signature on playback from the start
- **Sync to transport** lets the global transport play, pause, and stop the node
- **Emit meta events** sends `tempo`, `timeSignature`, `keySignature`, and `trackName` messages
- **Loop** restarts playback at the end

## See Also

- [midi.out](/docs/objects/midi.out) - send MIDI messages to hardware
- [tone~](/docs/objects/tone~) - synthesize MIDI messages
- [sonic~](/docs/objects/sonic~) - SuperCollider-based MIDI synth
