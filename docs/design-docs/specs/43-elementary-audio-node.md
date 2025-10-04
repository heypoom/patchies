# 43. Elementary Audio Node (elem~)

Similar to the [Tone.js node (tone~)](./42-tone-js-node.md), we want to create an `elem~` node that runs `@elemaudio/web-renderer`.

## Examples

Here is an example from the [Elementary Audio website](https://www.elementary.audio/docs/packages/web-renderer):

```ts
import {el} from '@elemaudio/core';
import WebRenderer from '@elemaudio/web-renderer';

const ctx = new AudioContext();
const core = new WebRenderer();

async function main() {
  const node = await core.initialize(ctx, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  node.connect(ctx.destination);

  const stats = await core.render(
    el.cycle(440),
    el.cycle(441)
  );

  console.log(stats);
}
```

In the `elem~` node's code editor, this

```ts
const sineTone = (t) =>
  el.sin(el.mul(2 * Math.PI, t));

async function setup(node, core) {
  let vs = el.sm(el.const({key: 'ex1:mix', value: sliderValue * 4}));
  let gs = el.sm(el.const({key: 'ex1:gain', value: (1.2 - Math.sqrt(sliderValue))}));

  let dry = el.mul(vs, el.cycle(440));
  let wet = el.tanh(dry);

  core.render(
    el.mul(gs, wet),
    el.mul(gs, wet),
  )
}
```

In the `ElementaryAudioManager` class, this template code is used. You can get the `gainNode` from the `AudioSystem`.

We should make sure to keep track of the `core` (WebRenderer) instance, so we can clean it up when the `elem~` node is destroyed.

On audio node creation, we initialize the `WebRenderer` and the node (`AudioWorkletNode`) for Elementary Audio.

```ts
async function main() {
  const core = new WebRenderer();

  // AudioWorkletNode here is the main `node` for AudioSystem.
  // This will let it connect to other audio nodes.
  const node = await core.initialize(AudioSystem.audioContext, {
    // TODO: this will be dynamic and synced with visual inlets/outlets soon.
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  return { core, node }
}
```

It shall provide the following globals into the JS execution context:

- `core`: the WebRenderer instance.
- `node`: the AudioWorkletNode instance.

Please use the `JSRunner.ts` system for code execution, as that will enable features like packages and NPM imports.

This can run on the main thread, as Elementary Audio manages the audio threads for us.

## Visual

The code editing and layout should look the same as the Tone.js node (`tone~`). In fact, feel free to extract it into a common `SimpleDspLayout.svelte` that we can use across both `tone~` and `elem~`. It should support the same message inlet/outlet ports.

## Lazy Loading

Important: lazy load both `@elemaudio/core` and `@elemaudio/web-renderer`, as the package is huge and should not be loaded until needed.
