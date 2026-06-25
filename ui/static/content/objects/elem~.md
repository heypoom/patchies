Use [Elementary Audio](https://www.elementary.audio) for declarative digital
audio signal processing.

## Context

The `elem~` context provides:

- `el`: the Elementary Audio core library
- `core`: the WebRenderer instance
- `node`: the AudioWorkletNode
- `inputNode`: GainNode for audio input
- `outputNode`: GainNode for audio output
- `noAudioInput()`: hide the blue audio input handle when code does not use incoming audio

## Messaging

Supports [Patchies JavaScript Runner](/docs/javascript-runner) functions
(`send`, `recv`, `setPortCount`, `onCleanup`, etc.).

Call `noAudioInput()` for generators that only synthesize sound or respond to
messages. The internal `inputNode` remains available, but the node does not show
a blue input handle.

## Example

```js
setPortCount(1);
noAudioInput();

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
