# 163. sampler~ scheduled playback

Allow `sampler~` to play buffers at a target Web Audio time by accepting timed
`bang` messages and optional `time`, `offset`, and `duration` fields on the
`play` message:

```ts
{ type: 'bang', time?: number }
{ type: 'play', time?: number, offset?: number, duration?: number }
```

## Behavior

- Bare `{ type: 'bang' }` and `{ type: 'play' }` keep the current behavior.
- `time` is an absolute `AudioContext.currentTime` timestamp, matching
  scheduled messages emitted by audio-mode sequencers.
- `offset` is the position in the sample buffer to start playback from, in
  seconds.
- `duration` is the amount of source-buffer audio to play, in seconds.
- Missing `offset`/`duration` fall back to the sampler's configured start/end
  points.
- Negative values are ignored instead of being passed to Web Audio, because
  `AudioBufferSourceNode.start()` throws for negative time parameters.

## Implementation

- Update the V2 `SamplerNode` bang/play handler to read the optional fields and
  pass them to `AudioBufferSourceNode.start(time, offset, duration)`.
- Update the manual sampler schema and object documentation to expose the new
  message shape.
- Add a focused unit test for scheduled playback parameters.
