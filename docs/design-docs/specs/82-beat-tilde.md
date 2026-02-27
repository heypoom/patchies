# 82. beat~ — Audio-Rate Beat-Synced Phasor

## Overview

`beat~` outputs a continuous 0→1 sawtooth ramp synchronized to the global transport beat. Unlike `phasor~` which uses a frequency in Hz, `beat~` derives its frequency from the transport BPM, giving sample-accurate beat-synced modulation.

## Interface

- **Type**: `beat~`
- **Group**: `sources`
- **Audio inlets**: 0
- **Audio outlets**: 1 (beat phase ramp 0→1)

### Inlets

| Inlet | Name | Type | Description |
|-------|------|------|-------------|
| 0 | multiply | AudioParam (float) | Beat frequency multiplier. Default: 1. `1` = per beat, `2` = per 8th note, `4` = per 16th, `0.25` = per bar (4/4) |

### Outlets

| Outlet | Name | Type | Description |
|--------|------|------|-------------|
| 0 | out | signal | Beat phase ramp (0 to 1) |

## Transport Sync

The processor free-runs at audio rate using `phase += (bpm / 60) * multiply / sampleRate`. The main thread sends transport state updates via `port.postMessage` when state changes:

- **transportStore subscription**: catches BPM, time signature, isPlaying changes
- **4Hz periodic resync**: sends `Transport.seconds` for drift correction and seek handling

### Sync message format

```ts
{
  cmd: 'transport-sync',
  isPlaying: boolean,
  seconds: number,
  bpm: number,
  timeSignature: [numerator: number, denominator: number]
}
```

On receiving a sync message, the processor updates its state and recomputes phase:
```
phase = fract(seconds * (bpm / 60) * currentMultiply)
```

## Infrastructure: `afterCreate` hook

`createWorkletDspNode` gains an optional `afterCreate` lifecycle hook:

```ts
afterCreate?: (audioNode: AudioWorkletNode, audioContext: AudioContext) => (() => void) | void;
```

Called at end of `create()`. Returned cleanup function is called in `destroy()`. This enables transport sync setup without modifying `defineDSP` or `AudioService`.

## Examples

```
beat~ → *~ 0.5 → +~ 0.5 → out~
```
Beat-synced ramp scaled to 0.5–1.0, output as audio.

```
beat~ 4 → snapshot~
```
16th-note phase values at message rate.
