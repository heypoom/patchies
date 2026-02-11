Dynamic JavaScript DSP processor that wraps an AudioWorkletProcessor.

Try [INFINITELY DESCENDING CHORD PROGRESSION](/?id=ip0chhw6jzuyo6x&readonly=true)
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

## Multiple Audio Ports

Use `setAudioPortCount(inputs, outputs)` to configure multiple audio ports:

### Multiple Inputs

```js
setAudioPortCount(2, 1);  // 2 inputs, 1 output

function process(inputs, outputs) {
  const in1 = inputs[0][0];  // first input
  const in2 = inputs[1][0];  // second input
  const out = outputs[0][0];

  for (let i = 0; i < out.length; i++) {
    out[i] = (in1[i] + in2[i]) * 0.5;  // mix both inputs
  }
}
```

### Multiple Outputs

```js
setAudioPortCount(1, 2);  // 1 input, 2 outputs

function process(inputs, outputs) {
  const input = inputs[0][0];
  const outL = outputs[0][0];  // first output
  const outR = outputs[1][0];  // second output

  for (let i = 0; i < outL.length; i++) {
    outL[i] = input[i];        // dry signal
    outR[i] = input[i] * 0.5;  // attenuated copy
  }
}
```

### More Examples

```js
// Ring modulation (2 inputs)
out[i] = in1[i] * in2[i];

// Crossfade with $1 control (0-1)
out[i] = in1[i] * (1 - $1) + in2[i] * $1;

// Stereo panner ($1 = 0 left, 1 right)
outL[i] = input[i] * (1 - $1);
outR[i] = input[i] * $1;

// Mid/side encoder (2 in, 2 out)
outL[i] = (in1[i] + in2[i]) * 0.5;  // mid
outR[i] = (in1[i] - in2[i]) * 0.5;  // side
```

> **Tip**: For simple mixing/crossfading, consider [expr~](/docs/objects/expr~)
> which automatically creates inlets when you use `s1`, `s2`, etc.

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

## Recipes

### Wavetable Oscillator (tabread~)

Read from a wavetable at audio rate using a phasor (0-1 ramp) as the index.

> **Tip**: Use the `tabosc~` preset for a ready-to-use wavetable oscillator.

**dsp~ code (phasor + table reader combined):**

```js
setPortCount(1, 0);

let table = new Float32Array(512);
let phase = 0;
const freq = 440;

recv((msg) => {
  table = msg;
});

function process(inputs, outputs) {
  const output = outputs[0][0];

  for (let i = 0; i < output.length; i++) {
    const idx = phase * (table.length - 1);
    output[i] = table[Math.floor(idx)];

    phase += freq / sampleRate;
    if (phase >= 1) phase -= 1;
  }
}
```

Use `$1` for frequency control: `phase += $1 / sampleRate;`

For smoother playback, use linear interpolation:

```js
const i0 = Math.floor(idx);
const frac = idx - i0;
output[i] = table[i0] * (1 - frac) + (table[i0 + 1] ?? table[i0]) * frac;
```

**Generate wavetable in a [js] node:**

```js
// Additive synthesis with harmonics
const size = 2048;
const table = new Float32Array(size);
const harmonics = [1, 0.5, 0.33, 0.25];

for (let i = 0; i < size; i++) {
  for (let h = 0; h < harmonics.length; h++) {
    table[i] += harmonics[h] * Math.sin((i / size) * Math.PI * 2 * (h + 1));
  }
}

send(table);
```

Other waveforms:

```js
// Sine
table[i] = Math.sin((i / size) * Math.PI * 2);

// Sawtooth
table[i] = (i / size) * 2 - 1;

// Square
table[i] = i < size / 2 ? 1 : -1;
```

## Presets

- `bang~`: emits bang on every audio block
- `noise~`: white noise generator
- `snapshot~`: captures incoming audio's first sample on bang
- `tabosc~`: wavetable oscillator (send Float32Array for table, number for freq)

## See Also

- [expr~](/docs/objects/expr~) - expression-based audio DSP
- [tone~](/docs/objects/tone~) - Tone.js synthesis
