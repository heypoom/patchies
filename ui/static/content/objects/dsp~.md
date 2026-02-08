Dynamic JavaScript DSP processor that wraps an AudioWorkletProcessor.

Try [INFINITELY DESCENDING CHORD PROGRESSION](https://patchies.app/?id=ip0chhw6jzuyo6x)
by @dtinth ([code explanation](https://notes.dt.in.th/InfinitelyDescendingChord)).

## Basic Examples

White noise:

```js
function process(inputs, outputs) {
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.random() * 1 - 1;
    }
  });
}
```

Sine wave at 440Hz:

```js
function process(inputs, outputs) {
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      let t = (currentFrame + i) / sampleRate;
      channel[i] = Math.sin(t * 440 * Math.PI * 2);
    }
  });
}
```

## Available Variables

```js
counter       // increments every process call
sampleRate    // e.g. 48000
currentFrame  // e.g. 7179264
currentTime   // seconds, e.g. 149.584
```

## Dynamic Value Inlets

Use `$1`, `$2`, ... `$9` to create value inlets:

```js
const process = (inputs, outputs) => {
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.random() * $1 - $2;
    }
  });
};
```

## Port Configuration

- `setPortCount(inletCount, outletCount)` - message inlets/outlets
- `setAudioPortCount(inletCount, outletCount)` - audio ports (default: 1 in, 1 out)
- `setTitle(title)` - custom object title
- `setKeepAlive(enabled)` - keep worklet active when disconnected

## Messaging

Use `send` and `recv` for communication. See [Message Passing](/docs/message-passing).

```js
setPortCount(2);

recv((msg, meta) => {
  if (meta.inlet === 0) {
    // do something
  }
});
```

> **Note**: `dsp~` runs in an AudioWorklet without access to `window`, DOM, or
> timing functions. This is necessary for real-time audio (~345 calls/sec).

## Presets

- `snapshot~`: captures incoming audio's first sample
- `bang~`: emits bang on audio threshold

## See Also

- [expr~](/docs/objects/expr~) - expression-based audio DSP
- [tone~](/docs/objects/tone~) - Tone.js synthesis
