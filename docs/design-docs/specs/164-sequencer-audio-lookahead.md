# 164. sequencer audio lookahead

Separate sequencer payload choice from Web Audio lookahead timing.

## Behavior

- Multi-outlet **Output** chooses the payload shape:
  - `bang` sends `{ type: 'bang' }`
  - `value` sends the step velocity number
- **Audio lookahead** is an independent boolean setting:
  - `bang` + lookahead sends `{ type: 'bang', time }`
  - `value` + lookahead sends `{ type: 'set', time, value }`
- Single-outlet mode keeps `index` and `midi`; `midi` adds `time` when audio
  lookahead is enabled.
- `sampler~` accepts timed `bang`, so a sequencer in `bang` + lookahead mode can
  trigger samples directly without a mapper.

## Implementation

- Store lookahead as `audioRate?: boolean` on sequencer node data.
- Keep `outputMode` for payload selection only.
- Drive the lookahead scheduler from `audioRate`, not from `outputMode`.
- Seed the current bar when the auto-clock transport enters `playing`; the
  first bar must emit events instead of waiting for the next beat-0 boundary.
- Convert scheduled transport time to absolute `AudioContext.currentTime`
  coordinates before writing `time` into audio-lookahead payloads.
- Use a shared helper to create sequencer payloads so docs, schemas, and UI
  behavior do not drift.
