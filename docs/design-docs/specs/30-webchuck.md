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
