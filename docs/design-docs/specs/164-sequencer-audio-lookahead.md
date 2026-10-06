# 164. sequencer audio lookahead

Separate sequencer payload choice from Web Audio lookahead timing.

## Behavior

- Multi-outlet **Output** chooses the payload shape:
  - `bang` sends `{ type: 'bang' }`
  - `value` sends the step velocity number
- **Audio lookahead** is an independent boolean setting:
  - `bang` + lookahead sends `{ type: 'bang', time }`
  - `value` + lookahead sends `{ type: 'bang', time, value }`
- Single-outlet mode keeps `index` and `midi`; with audio lookahead enabled,
  `index` sends `{ type: 'bang', index, value, time }` and `midi` sends
  `{ type: 'noteOn', note, index, velocity, time }`.
- `sampler~` accepts timed `bang` with optional `value`, so sequencer
  bang/value lookahead modes can trigger samples directly without a mapper.
- Pausing preserves the transport position. Resuming skips completed steps
  and waits for the next pending step, including any swing offset.
- Steps already emitted through audio lookahead must not emit again on resume.
  No new steps emit while paused. Stopping resets completion tracking so
  playback from zero fires the first step again.

## Implementation

- Store lookahead as `audioRate?: boolean` on sequencer node data.
- Keep `outputMode` for payload selection only.
- Drive the lookahead scheduler from `audioRate`, not from `outputMode`.
- Seed the current pattern when the auto-clock transport enters `playing`,
  excluding past and already-emitted steps on resume. Playback from zero
  must emit the first step even if the scheduler observes it slightly late.
- Convert scheduled transport time to absolute `AudioContext.currentTime`
  coordinates before writing `time` into audio-lookahead payloads.
- Use a shared helper to create sequencer payloads so docs, schemas, and UI
  behavior do not drift.
