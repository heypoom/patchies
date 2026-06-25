Use [Elementary Audio](https://www.elementary.audio) for declarative digital
audio signal processing.

## Context

The `elem~` context provides:

- `el`: the Elementary Audio core library
- `core`: the WebRenderer instance
- `node`: the AudioWorkletNode
- `inputNode`: GainNode for audio input
- `outputNode`: GainNode for audio output
- `showAudioInput()`: show the blue audio input handle when automatic detection misses your input usage

## Messaging

Supports [Patchies JavaScript Runner](/docs/javascript-runner) functions
(`send`, `recv`, `setPortCount`, `onCleanup`, etc.).

`elem~` hides its audio input handle by default. It automatically shows the
handle when your code references `inputNode` or `el.in(...)`; call
`showAudioInput()` only when your input routing happens indirectly through
another helper.

## Example

```js
setPortCount(1);

let [rate, setRate] = core.createRef('const', { value: 440 }, []);

recv((freq) => setRate({ value: freq }));

// Try el.train and el.cycle too
core.render(el.phasor(rate), el.phasor(rate));
```

### Manual audio input handle

Use `showAudioInput()` when you want to force the audio input handle to appear.
This is most useful when incoming audio is routed through shared setup code and
automatic detection misses it.

```js
showAudioInput();

const graph = el.in({ channel: 0 });
core.render(el.mul(graph, 0.5), outputNode);
```

Please consider supporting
[Nick Thompson on GitHub Sponsors](https://github.com/sponsors/nick-thompson)!

## See Also

- [tone~](/docs/objects/tone~) - Tone.js synthesis
- [sonic~](/docs/objects/sonic~) - SuperCollider synthesis
- [dsp~](/docs/objects/dsp~) - JavaScript DSP processor
