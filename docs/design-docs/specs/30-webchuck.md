# 30. WebChucK

Create a `chuck` object for the ChucK programming language.

Here's an example from <https://chuck.cs.princeton.edu/webchuck/docs/classes/Chuck.html>

```ts
import {Chuck} from 'webchuck'

let theChuck

document.getElementById('start').addEventListener('click', async () => {
  if (theChuck === undefined) {
    const chuckUrlPrefix = 'https://chuck.stanford.edu/webchuck/src/'

    theChuck = await Chuck.init([], audioContext, 2, chunkUrlPrefix)
  }

  theChuck.runCode('SinOsc osc => dac; 1::second => now;')
  theChuck.connect(audioContext.destination)
})
```

You can use `AudioSystem.audioContext` to get the audio context. Make sure each audio node has its own `Chuck` instance.

You will need to create a custom expression node `ChunkNode.svelte` as this requires custom syntax. Look at `AudioExprNode.svelte` for reference, you might be able to use the `CommonExprLayout.svelte` there.

Instead of connecting to the audioContext, you can create a gain node and connect to that instead in the `AudioSystem`.

## Replicating WebChuck IDE

We need these capabilities to replicate the WebChuck IDE's features:

- Run button: uses `chuck.runCode`

  - Should use the `onrun` handler (keybind defaults to CMD+Enter)
  - Should have a floating icon
  - also triggerable by `{type: 'run'}` or `{type: 'bang'}`

- Replace button: uses `chuck.replaceCode`

  - Should have a floating icon
  - Should add a custom keybind to CodeMirror for 'CMD+\'
  - also triggerable by `{type: 'replace'}`

- Remove button: uses `chuck.removeLastCode`

  - Should have a floating icon
  - Should add a custom keybind to CodeMirror for 'CMD+Backspace'
  - also triggerable by `{type: 'remove'}`

- A floating settings button and settings panel that allows us to view running shreds and remove them.

  - see `SliderNode.svelte` for design
  - the floating right panel should show: shred id, time, and remove shred button
  - There should be 4 buttons in floating toolbar in total: Run, Replace, Remove and Settings

- We need to track each shred in the AudioSystem, as we can now have multiple shred ids running at once.
