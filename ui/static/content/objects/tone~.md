Use [Tone.js](https://tonejs.github.io/) to create interactive music. Tone.js
provides high-level abstractions for synthesizers, effects, and complex audio
routing.

## Context

The Tone.js context provides:

- `Tone`: the Tone.js library
- `inputNode`: GainNode for receiving audio input
- `outputNode`: GainNode for sending audio output

## Messaging

Supports [Patchies JavaScript Runner](/docs/javascript-runner) functions
(`send`, `recv`, `setPortCount`, `onCleanup`, etc.).

## Cleanup

Tone.js objects assigned to variables (`const`, `let`, `var`) with
`new Tone.XXX(...)` are automatically disposed when the node is
destroyed or code changes. You don't need to handle cleanup for most cases.

Manual cleanup e.g. disconnections is still needed for **non-Tone resources**
such as `inputNode.disconnect(outputNode)`, `Tone.getTransport().stop()`,
or Web Audio API nodes created without `new Tone.`.

Use `return { cleanup: () => { ... } }` or `onCleanup(() => { ... })`
for manual cleanup.

## Examples

### Lowpass filter

```js
const filter = new Tone.Filter(1000, 'lowpass');
inputNode.connect(filter.input.input);
filter.connect(outputNode);

recv((m) => {
  filter.frequency.value = m;
});
```

### Reverb effect

```js
const reverb = new Tone.Reverb({ decay: 2, wet: 0.3 });
inputNode.connect(reverb.input.input);
reverb.connect(outputNode);
reverb.generate();
```

### Passthrough

Passes audio straight through. Needs manual cleanup since
no `new Tone.` objects are created.

```js
inputNode.connect(outputNode);

onCleanup(() => inputNode.disconnect(outputNode));
```

## Presets

- `poly-synth.tone`: Polyphonic synthesizer with chord sequences
- `lowpass.tone`: Low pass filter
- `pipe.tone`: Direct input to output

Please consider supporting
[Yotam Mann on GitHub Sponsors](https://github.com/sponsors/tambien)!

## See Also

- [elem~](/docs/objects/elem~) - Elementary Audio synthesis
- [sonic~](/docs/objects/sonic~) - SuperCollider synthesis
- [dsp~](/docs/objects/dsp~) - JavaScript DSP processor
