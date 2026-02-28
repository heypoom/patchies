[Strudel](https://strudel.cc) is a live coding environment based on TidalCycles.
Create expressive, dynamic music pieces and complex audio patterns.

![Patchies Strudel demo](/content/images/strudel-haunted.webp)

> Try this patch [in the app](/?id=2ou2y708kz9n3g4)!

## Getting Started

- See the [Strudel workshop](https://strudel.cc/workshop/getting-started)
- Check out the [Strudel showcase](https://strudel.cc/intro/showcase)

## Usage

- Use `Ctrl/Cmd + Enter` to re-evaluate the code
- Connect the `out~` object to hear audio output

## Runtime

Strudel runs in a separate runtime and does NOT use the
[Patchies JavaScript Runner](/docs/javascript-runner).

- `send` works but has limited use (no event emitters in Strudel)
- `recv` only works with a few functions, e.g. `setcpm`. Try `recv(setcpm)` to
  automate the cpm value.

## Transport Sync

Enable **Sync to transport** in settings to lock Strudel's playback to the
global [transport](/docs/transport-control). When synced, play/pause is
controlled by the transport bar instead of per-node controls.

## Multiple Instances

You can create multiple `strudel` objects, but only **one** plays at a time.
Use `bang` or `run` messages to switch playback between them.

## Examples

Try [funk42 preset by froos](/?id=zntnikb36c47eaw) for a
more complex use of Strudel.

Please consider supporting TidalCycles and Strudel at
[OpenCollective](https://opencollective.com/tidalcycles)!

## See Also

- [orca](/docs/objects/orca) - Orca livecoding sequencer
- [chuck~](/docs/objects/chuck~) - ChucK audio programming
