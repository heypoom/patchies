[Anupars](https://github.com/karnpapon/anupars) is a roguelike terminal-based
musical sequencer by [@karnpapon](https://github.com/karnpapon), driven by
regular expressions (RegExp), designed for resource-constrained
devices and performance-oriented workflows.

Type a regex pattern, and every cell in the grid that matches will
trigger MIDI notes as the playhead steps through them.

## Output

Anupars emits standard Patchies MIDI messages (`noteOn`, `noteOff`,
`controlChange`):

- Connect to `midi.out` for hardware MIDI output
- Try the `poly-synth-midi.tone` preset for a polyphonic synth

## Fullscreen

Use the **Expand** button to move the Anupars terminal into a fullscreen editor.
The same live terminal is moved out of the canvas editor, so playback, the
playhead, and your edits continue without interruption.

Press **Esc** or the close button to return to the canvas.

## Controls

All input is handled by the embedded terminal:

- **Space**: play/pause
- **Esc**: toggle between regex input and grid editor
- **h/j/k/l**: move playhead (vim-style)
- **H/J/K/L**: resize playhead area
- **>/<**: increase/decrease BPM
- **Number keys (0-7)**: grid splits
- **=/-**: cycle root note up/down
- **Expand button**: open the fullscreen editor

## Modes

Toggle modes with `Ctrl` + letter:

- **Ctrl+a**: arpeggiator (step only through regex matches)
- **Ctrl+s**: sweep mode
- **Ctrl+o**: drone mode
- **Ctrl+u**: accumulation mode
- **Ctrl+e**: event operator mode
- **Ctrl+y**: dynamic note length
- **Ctrl+z**: freeze playhead

## Scales

16 built-in scales including chromatic, major, minor, pentatonic, blues, whole
tone, diminished, and Thai 7-TET. Cycle through them with **Shift++** /
**Shift+\_**.

## See Also

- [orca](/docs/objects/orca) — Orca livecoding sequencer
- [strudel](/docs/objects/strudel) — Strudel music environment
