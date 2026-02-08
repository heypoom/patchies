Use [Elementary Audio](https://www.elementary.audio) for declarative digital
audio signal processing.

## Context

The `elem~` context provides:

- `el`: the Elementary Audio core library
- `core`: the WebRenderer instance
- `node`: the AudioWorkletNode
- `inputNode`: GainNode for audio input
- `outputNode`: GainNode for audio output

## Messaging

Supports [Patchies JavaScript Runner](/docs/javascript-runner) functions
(`send`, `recv`, `setPortCount`, `onCleanup`, etc.).

## Example

```js
setPortCount(1);

let [rate, setRate] = core.createRef('const', { value: 440 }, []);

recv((freq) => setRate({ value: freq }));

// Try el.train and el.cycle too
core.render(el.phasor(rate), el.phasor(rate));
```

Please consider supporting
[Nick Thompson on GitHub Sponsors](https://github.com/sponsors/nick-thompson)!

## See Also

- [tone~](/docs/objects/tone~) - Tone.js synthesis
- [sonic~](/docs/objects/sonic~) - SuperCollider synthesis
- [dsp~](/docs/objects/dsp~) - JavaScript DSP processor
