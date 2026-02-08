[Uxn](https://100r.co/site/uxn.html) is a virtual machine for running small
programs written in [Uxntal](https://wiki.xxiivv.com/site/uxntal.html).
Conforms with the [Varvara](https://wiki.xxiivv.com/site/varvara.html) device
specifications.

![Patchies Uxn node](/content/images/patchies-uxn.png)

## Run Classic Programs

Run programs like [Orca](https://100r.co/site/orca.html) and
[Left](https://100r.co/site/left.html). Play games like
[Oquonie](https://hundredrabbits.itch.io/oquonie) and
[Donsol](https://hundredrabbits.itch.io/donsol).

## Video Chaining

Supports video chaining - connect the video outlet to other visual objects
(e.g. `hydra` and `glsl`) to process the Uxn screen output.

## Controls

- **Load ROM**: Drop a `.rom` file, or use the folder icon
- **Console**: Terminal icon shows program output (also sent as messages)
- **Pause**: Pauses and resumes program execution
- **Keyboard/Mouse**: Click on the canvas to focus it for input

## Write Your Own Programs

![Patchies Uxn Compudanzas](/content/images/patchies-uxn-compudanzas.png)

> Try this patch [in the app](https://patchies.app/?id=z7rtmujmtvbv0e0)!
> Code by [Compudanzas' Uxn tutorial](https://compudanzas.net/uxn_tutorial_day_6.html).

- **Edit Code**: Opens the Uxntal assembly code editor
- **Assemble & Load**: Press `Shift + Enter` to compile and run
- Assembler errors are displayed below the node

## Auto-loading

- If code is provided (no URL/ROM), it's assembled and loaded on mount
- If URL is provided (no code/ROM), the ROM is loaded from the URL on mount

## Resources

- [Uxn documentation](https://wiki.xxiivv.com/site/uxn.html)
- [Uxntal reference](https://wiki.xxiivv.com/site/uxntal_reference.html)
- [100r.co](https://100r.co) - Uxn design principles
- [Awesome Uxn](https://github.com/hundredrabbits/awesome-uxn) - community
  resources

Please consider supporting
[Hundred Rabbits on Patreon](https://www.patreon.com/hundredrabbits)!

## See Also

- [orca](/docs/objects/orca) - Orca livecoding sequencer
