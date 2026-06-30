# 163. sampler~ scheduled playback

Allow `sampler~` to play buffers at a target Web Audio time by accepting
`bang` messages with optional playback fields:

```ts
{ type: 'bang', time?: number, offset?: number, duration?: number, value?: number }
{ type: 'noteOn', note: number, velocity: number, time?: number }
{ type: 'noteOff', note: number, time?: number }
{ type: 'setGain', value: number }
{ type: 'setNoteOffMode', value: 'one-shot' | 'held' }
number // play immediately with gain multiplier
```

## Behavior

- Bare `{ type: 'bang' }` keeps the current one-shot playback behavior.
- Bare non-negative numbers trigger playback with per-voice gain: `0` is silent,
  `1` is normal amplitude, and `2` is twice the amplitude.
- `noteOn` triggers pitched playback. Note `60` plays the sample at original
  pitch; each semitone maps to `2 ** ((note - 60) / 12)` playback rate.
- `noteOn.velocity` maps to gain as `velocity / 127`.
- The default note-off mode is `one-shot`: `noteOff` is ignored, and velocity
  `0` note-on messages do not trigger playback.
- In `held` mode, `noteOff` stops active voices for the matching note and
  velocity `0` behaves like `noteOff`.
- `noteOffMode?: 'one-shot' | 'held'` is persisted as node data and can be set
  from the sampler settings UI or with `setNoteOffMode`.
- `time` is an absolute `AudioContext.currentTime` timestamp, matching
  scheduled messages emitted by audio-mode sequencers.
- The sampler node's visual playback head starts from the V2 audio node's
  playback-start callback, not from component-side message receipt. Timed
  `bang` and MIDI `noteOn` messages therefore update the visual at the same
  scheduled audio-clock time used by `AudioBufferSourceNode.start(time)`.
- In held note-off mode, stopped note voices notify the UI so the visual
  playback head can stop when the voice is stopped.
- `offset` is the position in the sample buffer to start playback from, in
  seconds.
- `duration` is the amount of source-buffer audio to play, in seconds.
- `value` is a per-playback amplitude multiplier. This lets sequencer value
  output drive sampler velocity without a mapper.
- `sampler~` does not treat `set` messages as triggers; `set` remains reserved
  for value-setting semantics.
- `setGain` sets the sampler's built-in output gain. It scales all playback
  voices after per-trigger gain, number gain, and MIDI velocity gain.
- Missing `offset`/`duration` fall back to the sampler's configured start/end
  points. Missing `value` uses normal amplitude.
- Negative values are ignored instead of being passed to Web Audio, because
  `AudioBufferSourceNode.start()` throws for negative time parameters.

## Implementation

- Update the V2 `SamplerNode` bang handler to read the optional fields and
  pass them to `AudioBufferSourceNode.start(time, offset, duration)`.
- Route each playback through a per-voice gain node so number-triggered playback
  can scale amplitude without changing other active voices.
- Update the manual sampler schema and object documentation to expose the new
  message shape.
- Add a focused unit test for scheduled playback parameters.
