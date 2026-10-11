# 30. WebChucK

Create a `chuck` object for the ChucK programming language.

Here's an example from <https://chuck.cs.princeton.edu/webchuck/docs/classes/Chuck.html>

```ts
import { Chuck } from "webchuck";

let theChuck;

document.getElementById("start").addEventListener("click", async () => {
  if (theChuck === undefined) {
    const chuckUrlPrefix = "https://chuck.stanford.edu/webchuck/src/";

    theChuck = await Chuck.init([], audioContext, 2, chunkUrlPrefix);
  }

  theChuck.runCode("SinOsc osc => dac; 1::second => now;");
  theChuck.connect(audioContext.destination);
});
```

You can use `AudioSystem.audioContext` to get the audio context. Make sure each audio node has its own `Chuck` instance.

You will need to create a custom expression node `ChunkNode.svelte` as this requires custom syntax. Look at `AudioExprNode.svelte` for reference, you might be able to use the `CommonExprLayout.svelte` there.

Instead of connecting to the audioContext, you can create a gain node and connect to that instead in the `AudioSystem`.

## Replicating WebChuck IDE

We need these capabilities to replicate the WebChuck IDE's features:

- Run button: uses `chuck.runCode`
  - Should use the `onrun` handler (keybind defaults to CMD+Enter)
  - Should have a floating icon
  - also triggerable by `run` or `bang`

- Replace button: uses `chuck.replaceCode`
  - Should have a floating icon
  - Should add a custom keybind to CodeMirror for 'CMD+\'
  - also triggerable by `replace`

- Remove button: uses `chuck.removeLastCode`
  - Should have a floating icon
  - Should add a custom keybind to CodeMirror for 'CMD+Backspace'
  - also triggerable by `remove`

- A floating settings button and settings panel that allows us to view running shreds and remove them.
  - see `SliderNode.svelte` for design
  - the floating right panel should show: shred id, time, and remove shred button
  - There should be 4 buttons in floating toolbar in total: Run, Replace, Remove and Settings

- We need to track each shred in the AudioSystem, as we can now have multiple shred ids running at once.

## Editor appearance

ChucK settings use **Shreds** and **Styles** tabs, following the `wam~` settings layout. **Shreds** is selected whenever the settings panel opens and shows running shreds and removal controls first. **Styles** contains font size, font family, and Custom Styles. Both inline and expanded panels support keyboard tab navigation.

`chuck~` shares Strudel's editor appearance settings and messages:

- Font size controls normal text; expanded font size controls expanded text separately.
- Both default to the global editor settings. Expanded text is at least one pixel larger than normal text.
- Font family defaults to the global editor font family.
- Custom Styles opens a CSS editor whose container declarations apply live to the inline, inspected, and expanded editor containers.
- `setFontSize`, `setExpandedFontSize`, `setFontFamily`, and `setStyles` update the same saved node fields as the settings UI. Appearance messages do not reach WebChucK.
- Settings edits participate in undo/redo. Closing the CSS dialog with Escape leaves the expanded editor open.

Share the appearance data contract, size resolution, message schemas and handling, settings fields, and styles dialog outside the object modules so more editors can adopt them. Strudel retains its existing data fields and behavior.
