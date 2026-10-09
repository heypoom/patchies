[Strudel](https://strudel.cc) is a live coding environment based on TidalCycles.
Create expressive, dynamic music pieces and complex audio patterns.

![Patchies Strudel demo](/content/images/strudel-haunted.webp)

> Try this patch [in the app](/?demo=haunted-lead)!

## Getting Started

- See the [Strudel workshop](https://strudel.cc/workshop/getting-started)
- Check out the [Strudel showcase](https://strudel.cc/intro/showcase)

## Usage

- Use `Ctrl/Cmd + Enter` to re-evaluate the code
- Connect the `out~` object to hear audio output

## Editor Layout

The code editor is placed inline in the patch.

- Select the object and drag the resize handles to change the container size. Code scrolls inside its container.
- Toggle **Resizing** to "off" in settings to lock that size.
- Use **Hide Code** for a compact object that keeps running headlessly. Clicking
  on the code button opens the code in the preferred editor (e.g. inline, sidebar).
- **Keep Editor in Patch** restores the inline editor.
- **Expand Editor** opens the editor in fullscreen.

To update code while it is hidden, connect a `js` object to the message inlet:

```javascript
// Store new code without interrupting the running program.
send({type: 'setCode', value: 's("bd sd")'})

// Run the stored code when you are ready.
send({type: 'bang'})
```

## Runtime

Strudel runs in a separate runtime and does NOT use the
[Patchies JavaScript Runner](/docs/javascript-runner).

- `send` works but has limited use (no event emitters in Strudel)
- `recv` only works with a few functions, e.g. `setcpm`. Try `recv(setcpm)` to
  automate the cpm value.

## Transport Sync

Enable **Sync to transport** in Settings to lock Strudel's playback to
the global [transport](/docs/transport-control). When synced, play/pause and CPM
is controlled by the transport bar instead of per-node controls.

## Multiple Instances

You can create multiple `strudel` objects, but only **one** plays at a time.
Use `bang` or `run` messages to switch playback between them.

## Font Sizes & Font Family

The settings panel lets you set font sizes and font families for the code editor.

- Normal and expanded editors have separate font sizes.
  - Settings edits **Font size** in the normal editor and **Expanded font size** in fullscreen. - Expanded text defaults to 28px and always stays larger than normal text.

## Styling the Container

The settings panel's **Custom Styles** button opens a small CSS editor that lets you style the outer container. Change borders, backgrounds, paddings, backdrop filters and more.

You can also send messages into `strudel` to set font sizes, font families and CSS styles.
Messages and settings edit the same values, so incoming changes appear in the
panel and CSS editor too.

Create a `js` object, connect it to `strudel`, and run:

```javascript
// Normal editor font size
send({type: 'setFontSize', value: 25})

// Expanded editor font size (larger than the normal size)
send({type: 'setExpandedFontSize', value: 40})

// Font family. Use commas to fallback to multiple fonts.
send({
  type: 'setFontFamily',
  value: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace'
})

// Set custom CSS styles for the editor container.
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

Try [funk42 preset by froos](/?demo=funk-42) for a
more complex use of Strudel.

Please consider supporting TidalCycles and Strudel at
[OpenCollective](https://opencollective.com/tidalcycles)!

## See Also

- [orca](/docs/objects/orca) - Orca livecoding sequencer
- [chuck~](/docs/objects/chuck~) - ChucK audio programming
