# 71. Core DSP Objects

## Motivation

Patchies has ~40 audio objects but is missing fundamental signal-level math and processing objects that are standard in PureData and Max/MSP. The only arithmetic operator is `+~` — there's no way to multiply, subtract, or compare signals at the sample level.

This gap blocks common synthesis patterns:

- **No `*~`** → can't do ring modulation, AM synthesis, or signal-controlled VCAs
- **No `clip~` / `wrap~`** → can't do waveshaping or phase distortion with `phasor~`
- **No `>~` / `<~`** → can't build gates, triggers, or conditional signal routing
- **No `adsr~`** → can't generate sample-accurate envelopes (existing `adsr` is message-rate)
- **No `env~`** → can't follow amplitude for ducking or envelope-controlled effects

This spec adds ~18 new native DSP objects across four categories to reach core Pd/Max parity.

## Overview

All objects use the existing `defineDSP()` / `createWorkletDspNode()` infrastructure from spec 70. Each object = 2 files (processor + node), following the same pattern as `phasor~`, `noise~`, etc.

### Object Summary

| Object | Category | Audio In | Audio Out | Msg In | Msg Out | Description |
|--------|----------|----------|-----------|--------|---------|-------------|
| `*~` | arithmetic | 2 | 1 | — | — | Multiply two signals |
| `-~` | arithmetic | 2 | 1 | — | — | Subtract right from left signal |
| `/~` | arithmetic | 2 | 1 | — | — | Divide left by right signal |
| `min~` | arithmetic | 2 | 1 | — | — | Per-sample minimum |
| `max~` | arithmetic | 2 | 1 | — | — | Per-sample maximum |
| `clip~` | math | 1 | 1 | min, max | — | Clamp signal to range |
| `wrap~` | math | 1 | 1 | — | — | Wrap signal to [0, 1) |
| `abs~` | math | 1 | 1 | — | — | Absolute value |
| `pow~` | math | 1 | 1 | exponent | — | Raise signal to power |
| `>~` | math | 2 | 1 | — | — | Output 1 if left > right, else 0 |
| `<~` | math | 2 | 1 | — | — | Output 1 if left < right, else 0 |
| `adsr~` | envelope | 0 | 1 | trigger, A, D, S, R | — | Sample-accurate ADSR envelope |
| `env~` | envelope | 1 | 0 | — | rms | RMS envelope follower |
| `vline~` | envelope | 0 | 1 | target | — | Sample-accurate scheduled ramps |
| `latch~` | control | 1 | 1 | trigger | — | Sample-and-hold |
| `pink~` | generator | 0 | 1 | — | — | Pink noise (-3dB/octave) |
| `pulse~` | generator | 0 | 1 | freq, width | — | Pulse wave with PWM |
| `comb~` | effect | 1 | 1 | delay, feedback | — | Comb filter |

## Phase 1: Signal Arithmetic

Binary signal operators. All follow the same pattern: two audio inputs, one audio output, sample-by-sample operation. These are the simplest to implement and highest impact.

### `*~` — Multiply

```typescript
// processors/multiply.processor.ts
defineDSP({
  name: '*~',
  audioInlets: 2,
  audioOutlets: 1,
  state: () => ({}),
  process(_state, inputs, outputs) {
    const left = inputs[0][0], right = inputs[1][0], out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      out[i] = left[i] * right[i];
    }
  }
});
```

```typescript
// nodes/multiply.node.ts
export const MultiplyNode = createWorkletDspNode({
  type: '*~',
  group: 'processors',
  description: 'Multiply two audio signals',
  workletUrl,
  audioInlets: 2,
  audioOutlets: 1,
  inlets: [
    { name: 'left', type: 'signal', description: 'Left signal input' },
    { name: 'right', type: 'signal', description: 'Right signal input' }
  ],
  outlets: [{ name: 'out', type: 'signal' }],
  tags: ['audio', 'math', 'multiply', 'ring modulation']
});
```

### `-~` — Subtract

Same binary pattern: `out[i] = left[i] - right[i]`

### `/~` — Divide

Same binary pattern with zero-division protection:

```typescript
process(_state, inputs, outputs) {
  const left = inputs[0][0], right = inputs[1][0], out = outputs[0][0];
  for (let i = 0; i < out.length; i++) {
    out[i] = right[i] === 0 ? 0 : left[i] / right[i];
  }
}
```

### `min~` / `max~` — Signal Min/Max

Binary pattern: `out[i] = Math.min(left[i], right[i])` (or `Math.max`).

### Multichannel note

All arithmetic processors should iterate over channels, not just channel 0. The examples above show single-channel for brevity. Full implementation:

```typescript
process(_state, inputs, outputs) {
  const out = outputs[0];
  const len = out[0].length;
  const channels = out.length;

  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < channels; ch++) {
      out[ch][i] = inputs[0][ch][i] * inputs[1][ch][i];
    }
  }
}
```

## Phase 2: Signal Math

Unary and binary math operations on signals.

### `clip~` — Clamp to Range

Clamps input signal between min and max values. Min/max controllable via message inlets.

```typescript
// processors/clip.processor.ts
defineDSP({
  name: 'clip~',
  audioInlets: 1,
  audioOutlets: 1,
  state: () => ({ min: -1, max: 1 }),

  recv(state, data, inlet) {
    const val = parseFloat(data as string);
    if (isNaN(val)) return;
    if (inlet === 1) state.min = val;
    if (inlet === 2) state.max = val;
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = Math.max(state.min, Math.min(state.max, inputs[0][ch][i]));
      }
    }
  }
});
```

Node inlets: `signal` (audio), `min` (float, default -1), `max` (float, default 1).

### `wrap~` — Wrap to [0, 1)

No inlets beyond audio. Wraps signal to `[0, 1)` range — essential companion to `phasor~` for phase distortion synthesis.

```typescript
process(_state, inputs, outputs) {
  const out = outputs[0];
  const len = out[0].length;
  const channels = out.length;

  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const v = inputs[0][ch][i];
      out[ch][i] = v - Math.floor(v);
    }
  }
}
```

### `abs~` — Absolute Value

No inlets beyond audio. `out[ch][i] = Math.abs(inputs[0][ch][i])`.

### `pow~` — Exponentiation

Raises input signal to a power. Exponent controllable via message inlet (default: 2).

```typescript
state: () => ({ exponent: 2 }),
recv(state, data, inlet) {
  if (inlet === 1) {
    const val = parseFloat(data as string);
    if (!isNaN(val)) state.exponent = val;
  }
},
process(state, inputs, outputs) {
  // out[ch][i] = Math.pow(inputs[0][ch][i], state.exponent)
}
```

Node inlets: `signal` (audio), `exponent` (float, default 2).

### `>~` / `<~` — Signal Comparison

Two audio inputs, one output. Outputs 1.0 or 0.0 per sample.

```typescript
// >~ processor
process(_state, inputs, outputs) {
  // out[ch][i] = inputs[0][ch][i] > inputs[1][ch][i] ? 1 : 0
}
```

Binary audio pattern — same inlet structure as `*~`.

## Phase 3: Envelopes & Control

### `adsr~` — Sample-Accurate ADSR Envelope

Unlike the existing message-rate `adsr` text object, `adsr~` outputs a continuous audio signal. Trigger via message inlet (1 = gate on, 0 = gate off).

```typescript
// processors/adsr.processor.ts
defineDSP({
  name: 'adsr~',
  audioOutlets: 1,

  state: () => ({
    phase: 'idle' as 'idle' | 'attack' | 'decay' | 'sustain' | 'release',
    value: 0,
    attack: 0.01,    // seconds
    decay: 0.1,      // seconds
    sustain: 0.5,    // level 0-1
    release: 0.3,    // seconds
    attackRate: 0,
    decayRate: 0,
    releaseRate: 0
  }),

  recv(state, data, inlet) {
    if (inlet === 0) {
      // Trigger inlet: 1/true = gate on, 0/false = gate off
      const val = typeof data === 'boolean' ? (data ? 1 : 0) : parseFloat(data as string);
      if (val > 0) {
        state.phase = 'attack';
        state.attackRate = (1 - state.value) / Math.max(1, state.attack * sampleRate);
      } else {
        state.phase = 'release';
        state.releaseRate = state.value / Math.max(1, state.release * sampleRate);
      }
      return;
    }
    // Inlets 1-4: attack, decay, sustain, release (in seconds for 1-3, level for sustain)
    const val = parseFloat(data as string);
    if (isNaN(val)) return;
    if (inlet === 1) state.attack = Math.max(0.001, val / 1000);
    if (inlet === 2) state.decay = Math.max(0.001, val / 1000);
    if (inlet === 3) state.sustain = Math.max(0, Math.min(1, val));
    if (inlet === 4) state.release = Math.max(0.001, val / 1000);
  },

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      if (state.phase === 'attack') {
        state.value += state.attackRate;
        if (state.value >= 1) {
          state.value = 1;
          state.phase = 'decay';
          state.decayRate = (1 - state.sustain) / Math.max(1, state.decay * sampleRate);
        }
      } else if (state.phase === 'decay') {
        state.value -= state.decayRate;
        if (state.value <= state.sustain) {
          state.value = state.sustain;
          state.phase = 'sustain';
        }
      } else if (state.phase === 'release') {
        state.value -= state.releaseRate;
        if (state.value <= 0) {
          state.value = 0;
          state.phase = 'idle';
        }
      }

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.value;
      }
    }
  }
});
```

Node inlets: `trigger` (message: 0/1), `attack` (float, ms, default 10), `decay` (float, ms, default 100), `sustain` (float, 0-1, default 0.5), `release` (float, ms, default 300).

### `env~` — RMS Envelope Follower

Takes audio input, outputs RMS amplitude as messages. Window size controllable.

```typescript
// processors/env.processor.ts
defineDSP({
  name: 'env~',
  audioInlets: 1,
  audioOutlets: 0,

  state: () => ({
    windowSize: 1024,
    buffer: new Float32Array(1024),
    writeIndex: 0,
    sumOfSquares: 0,
    samplesUntilOutput: 1024
  }),

  recv(state, data, inlet) {
    if (inlet === 1) {
      const size = parseInt(data as string, 10);
      if (!isNaN(size) && size > 0) {
        state.windowSize = size;
        state.buffer = new Float32Array(size);
        state.writeIndex = 0;
        state.sumOfSquares = 0;
        state.samplesUntilOutput = size;
      }
    }
  },

  process(state, inputs, _outputs, send) {
    const input = inputs[0]?.[0];
    if (!input) return;

    for (let i = 0; i < input.length; i++) {
      const sample = input[i];
      const oldSample = state.buffer[state.writeIndex];

      state.sumOfSquares += sample * sample - oldSample * oldSample;
      state.buffer[state.writeIndex] = sample;
      state.writeIndex = (state.writeIndex + 1) % state.windowSize;

      if (--state.samplesUntilOutput <= 0) {
        const rms = Math.sqrt(Math.max(0, state.sumOfSquares) / state.windowSize);
        send(rms, 0);
        state.samplesUntilOutput = state.windowSize;
      }
    }
  }
});
```

Node inlets: `signal` (audio), `window` (int, default 1024). Outlet: `rms` (message, float).

### `vline~` — Sample-Accurate Scheduled Ramps

Like `line~` but supports a queue of scheduled ramps. Accepts messages of the form `[target, time, delay]` where delay offsets the start within the current block.

```typescript
// processors/vline.processor.ts
defineDSP({
  name: 'vline~',
  audioOutlets: 1,

  state: () => ({
    value: 0,
    segments: [] as { target: number; time: number; delay: number }[],
    currentTarget: 0,
    stepSize: 0,
    samplesRemaining: 0,
    delaySamples: 0
  }),

  recv(state, data) {
    if (Array.isArray(data)) {
      const target = parseFloat(data[0]);
      const time = data.length > 1 ? parseFloat(data[1]) : 0;
      const delay = data.length > 2 ? parseFloat(data[2]) : 0;
      if (!isNaN(target)) {
        state.segments.push({
          target,
          time: Math.max(0, time),
          delay: Math.max(0, delay)
        });
      }
    } else {
      const target = parseFloat(data as string);
      if (!isNaN(target)) {
        state.value = target;
        state.samplesRemaining = 0;
        state.segments.length = 0;
      }
    }
  },

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      // Start queued segments whose delay has elapsed
      if (state.delaySamples > 0) {
        state.delaySamples--;
      } else if (state.samplesRemaining <= 0 && state.segments.length > 0) {
        const seg = state.segments.shift()!;
        const delaySamples = Math.round((seg.delay / 1000) * sampleRate);

        if (delaySamples > 0) {
          state.delaySamples = delaySamples;
        } else {
          state.currentTarget = seg.target;
          if (seg.time <= 0) {
            state.value = seg.target;
            state.samplesRemaining = 0;
          } else {
            const totalSamples = Math.max(1, Math.round((seg.time / 1000) * sampleRate));
            state.stepSize = (seg.target - state.value) / totalSamples;
            state.samplesRemaining = totalSamples;
          }
        }
      }

      if (state.samplesRemaining > 0) {
        state.value += state.stepSize;
        if (--state.samplesRemaining <= 0) {
          state.value = state.currentTarget;
        }
      }

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.value;
      }
    }
  }
});
```

Node inlets: `target` (message: number for immediate, `[target, time_ms]`, or `[target, time_ms, delay_ms]`). Outlet: signal.

### `latch~` — Sample-and-Hold

Holds the current input sample value when triggered. Outputs held value continuously.

```typescript
// processors/latch.processor.ts
defineDSP({
  name: 'latch~',
  audioInlets: 1,
  audioOutlets: 1,
  state: () => ({ held: 0, shouldSample: false }),

  recv(state, data) {
    if (data === 'bang' || (typeof data === 'object' && data !== null && (data as any).type === 'bang')) {
      state.shouldSample = true;
    }
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const input = inputs[0]?.[0];

    if (state.shouldSample && input) {
      state.held = input[0];
      state.shouldSample = false;
    }

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.held;
      }
    }
  }
});
```

Node inlets: `signal` (audio), `trigger` (bang). Outlet: signal.

## Phase 4: Generators & Utilities

### `pink~` — Pink Noise

Pink noise has equal energy per octave (-3dB/octave rolloff). Uses the Voss-McCartney algorithm.

```typescript
// processors/pink.processor.ts
defineDSP({
  name: 'pink~',
  audioOutlets: 1,

  state: () => ({
    b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0
  }),

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;

      // Paul Kellet's refined method
      state.b0 = 0.99886 * state.b0 + white * 0.0555179;
      state.b1 = 0.99332 * state.b1 + white * 0.0750759;
      state.b2 = 0.96900 * state.b2 + white * 0.1538520;
      state.b3 = 0.86650 * state.b3 + white * 0.3104856;
      state.b4 = 0.55000 * state.b4 + white * 0.5329522;
      state.b5 = -0.7616 * state.b5 - white * 0.0168980;

      const pink = state.b0 + state.b1 + state.b2 + state.b3 + state.b4 + state.b5 + state.b6 + white * 0.5362;
      state.b6 = white * 0.115926;

      const sample = pink * 0.11; // normalize to ~[-1, 1]

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = sample;
      }
    }
  }
});
```

No inlets. One signal outlet.

### `pulse~` — Pulse Wave with PWM

Generates a pulse/square wave with variable pulse width. Frequency and width controllable via messages.

```typescript
// processors/pulse.processor.ts
defineDSP({
  name: 'pulse~',
  audioOutlets: 1,
  state: () => ({ phase: 0, frequency: 440, width: 0.5 }),

  recv(state, data, inlet) {
    const val = parseFloat(data as string);
    if (isNaN(val)) return;
    if (inlet === 0) state.frequency = val;
    if (inlet === 1) state.width = Math.max(0, Math.min(1, val));
  },

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const increment = state.frequency / sampleRate;

    for (let i = 0; i < len; i++) {
      const sample = state.phase < state.width ? 1 : -1;
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = sample;
      }
      state.phase += increment;
      if (state.phase >= 1) state.phase -= 1;
      else if (state.phase < 0) state.phase += 1;
    }
  }
});
```

Node inlets: `frequency` (float, Hz, default 440), `width` (float, 0-1, default 0.5). One signal outlet.

### `comb~` — Comb Filter

Feedforward + feedback comb filter. Essential for Karplus-Strong synthesis, flanging, and physical modeling.

```typescript
// processors/comb.processor.ts
defineDSP({
  name: 'comb~',
  audioInlets: 1,
  audioOutlets: 1,

  state: () => ({
    buffer: new Float32Array(48000),  // 1 second at 48kHz
    writeIndex: 0,
    delayMs: 10,
    feedback: 0.7
  }),

  recv(state, data, inlet) {
    const val = parseFloat(data as string);
    if (isNaN(val)) return;
    if (inlet === 1) state.delayMs = Math.max(0.02, val);
    if (inlet === 2) state.feedback = Math.max(-0.999, Math.min(0.999, val));
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const input = inputs[0][0];
    const len = out[0].length;
    const channels = out.length;
    const delaySamples = Math.round((state.delayMs / 1000) * sampleRate);
    const bufLen = state.buffer.length;

    for (let i = 0; i < len; i++) {
      const readIndex = (state.writeIndex - delaySamples + bufLen) % bufLen;
      const delayed = state.buffer[readIndex];
      const inSample = channels > 0 ? input[i] : 0;
      const outSample = inSample + delayed * state.feedback;

      state.buffer[state.writeIndex] = outSample;
      state.writeIndex = (state.writeIndex + 1) % bufLen;

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = outSample;
      }
    }
  }
});
```

Node inlets: `signal` (audio), `delay` (float, ms, default 10), `feedback` (float, -0.999–0.999, default 0.7). One signal outlet.

## File Structure

New files to add (all under `src/lib/audio/native-dsp/`):

```
processors/
  multiply.processor.ts     # *~
  subtract.processor.ts     # -~
  divide.processor.ts       # /~
  min.processor.ts          # min~
  max.processor.ts          # max~
  clip.processor.ts         # clip~
  wrap.processor.ts         # wrap~
  abs.processor.ts          # abs~
  pow.processor.ts          # pow~
  gt.processor.ts           # >~
  lt.processor.ts           # <~
  adsr.processor.ts         # adsr~
  env.processor.ts          # env~
  vline.processor.ts        # vline~
  latch.processor.ts        # latch~
  pink.processor.ts         # pink~
  pulse.processor.ts        # pulse~
  comb.processor.ts         # comb~

nodes/
  multiply.node.ts          # *~
  subtract.node.ts          # -~
  divide.node.ts            # /~
  min.node.ts               # min~
  max.node.ts               # max~
  clip.node.ts              # clip~
  wrap.node.ts              # wrap~
  abs.node.ts               # abs~
  pow.node.ts               # pow~
  gt.node.ts                # >~
  lt.node.ts                # <~
  adsr.node.ts              # adsr~
  env.node.ts               # env~
  vline.node.ts             # vline~
  latch.node.ts             # latch~
  pink.node.ts              # pink~
  pulse.node.ts             # pulse~
  comb.node.ts              # comb~
```

## Registration

For each new node, update these files:

1. **`src/lib/audio/v2/nodes/index.ts`** — add to `AUDIO_NODES` array
2. **`src/lib/objects/schemas/index.ts`** — add to `schemasFromNodes([...], 'audio')` call
3. **`src/lib/extensions/object-packs.ts`** — add to appropriate pack:
   - `*~`, `-~`, `/~`, `min~`, `max~` → Audio pack (alongside `+~`)
   - `clip~`, `wrap~`, `abs~`, `pow~`, `>~`, `<~` → Audio pack
   - `adsr~`, `env~`, `vline~`, `latch~` → Audio pack
   - `pink~`, `pulse~` → Audio pack (alongside `noise~`, `phasor~`)
   - `comb~` → Audio Filters pack (alongside `delay~`, `lowpass~`, etc.)
4. **`static/content/objects/{name}.md`** — help documentation for each object

## Implementation Order

### Phase 1: Signal Arithmetic ✅→[ ]

1. [ ] `*~` — multiply (highest priority — unlocks VCA, ring mod, AM)
2. [ ] `-~` — subtract
3. [ ] `/~` — divide
4. [ ] `min~` — minimum
5. [ ] `max~` — maximum
6. [ ] Register all in index, schemas, packs
7. [ ] Add help docs

### Phase 2: Signal Math [ ]

1. [ ] `clip~` — clamp to range
2. [ ] `wrap~` — wrap to [0, 1)
3. [ ] `abs~` — absolute value
4. [ ] `pow~` — exponentiation
5. [ ] `>~` — greater than
6. [ ] `<~` — less than
7. [ ] Register all in index, schemas, packs
8. [ ] Add help docs

### Phase 3: Envelopes & Control [ ]

1. [ ] `adsr~` — ADSR envelope generator
2. [ ] `env~` — RMS envelope follower
3. [ ] `vline~` — sample-accurate scheduled ramps
4. [ ] `latch~` — sample-and-hold
5. [ ] Register all in index, schemas, packs
6. [ ] Add help docs

### Phase 4: Generators & Utilities [ ]

1. [ ] `pink~` — pink noise
2. [ ] `pulse~` — pulse wave with PWM
3. [ ] `comb~` — comb filter
4. [ ] Register all in index, schemas, packs
5. [ ] Add help docs
