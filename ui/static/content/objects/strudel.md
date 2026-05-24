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

Enable **Sync to transport** in the overflow menu to lock Strudel's playback to
the global [transport](/docs/transport-control). When synced, play/pause and CPM
is controlled by the transport bar instead of per-node controls.

## Multiple Instances

You can create multiple `strudel` objects, but only **one** plays at a time.
Use `bang` or `run` messages to switch playback between them.

## Styling The Editor

Send style messages into a `strudel` object to tune its editor for live coding.
This is useful when the editor is expanded over the background output.

Create a `js` object, connect it to `strudel`, and run:

```javascript
send({
  type: 'setFontFamily',
  value: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace'
})

send({
  type: 'setFontSize',
  value: 25
})

send({
  type: 'setStyles',
  value: {
    container: `
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(10px);
      padding: 20px 10px;
      border: none;
    `
  }
})
```

## Examples

Try [funk42 preset by froos](/?id=zntnikb36c47eaw) for a
more complex use of Strudel.

Please consider supporting TidalCycles and Strudel at
[OpenCollective](https://opencollective.com/tidalcycles)!

## See Also

- [orca](/docs/objects/orca) - Orca livecoding sequencer
- [chuck~](/docs/objects/chuck~) - ChucK audio programming
