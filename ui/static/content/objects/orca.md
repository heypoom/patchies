[Orca](https://github.com/hundredrabbits/Orca) is an esoteric programming
language where every character is an operation that runs sequentially every
frame.

![Patchies Orca node](/content/images/patchies-orca.png)

Create procedural sequences with 26 letter operators (A-Z) and special symbols
for MIDI control.

> Try [this demo](/?id=ks1srq082zkp4qb&readonly=true) for a silly little
> procedurally-generated lullaby!

See [the Orca docs](https://github.com/hundredrabbits/Orca/blob/main/README.md)
for how to use it.

## Output

Orca emits standard Patchies MIDI messages (`noteOn`, `noteOff`,
`controlChange`):

- Connect to `midi.out` for hardware MIDI output
- Try the `poly-synth-midi.tone` preset for a polyphonic synth

## Controls

- Click on the canvas and type characters to edit the grid
- **Space**: play/pause
- **Enter** or **Ctrl+F**: advance one frame
- **Ctrl+Shift+R**: reset frame
- **Settings button**: update BPM, font size, grid size
- **`>`**: increase tempo
- **`<`**: decrease tempo

## Attribution

Based on the original Orca by Hundred Rabbits, licensed under
[MIT License](https://github.com/hundredrabbits/Orca/blob/main/LICENSE.md).

Please consider supporting
[Hundred Rabbits on Patreon](https://www.patreon.com/hundredrabbits)!

## See Also

- [strudel](/docs/objects/strudel) - Strudel music environment
- [uxn](/docs/objects/uxn) - Uxn virtual machine
