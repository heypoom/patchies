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

## Example

```js
// Process incoming audio through a filter
const filter = new Tone.Filter(1000, 'lowpass');
inputNode.connect(filter.input.input);
filter.connect(outputNode);

// Handle incoming messages to change frequency
recv((m) => {
  filter.frequency.value = m;
});

// Cleanup
return {
  cleanup: () => filter.dispose()
};
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
