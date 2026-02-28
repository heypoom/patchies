# 87. Seq Step Sequencer

## Overview

A DAW-style multi-track step sequencer (drum machine) driven by the global transport clock. Multiple instrument tracks share a step grid. Each track has its own outlet, so output can be wired directly to sounds without needing a `route` node.

## Concept

N tracks, each with 16 (configurable) steps. All tracks share the same clock — one bar divided into `steps` equal parts. When step `s` fires, every track with `stepOn[s] = true` sends a message on its own outlet. Supports swing, audio-rate scheduling, and per-step values (velocity).

## Node Data

```typescript
{
  steps: 16,             // Steps per track: 4 | 8 | 12 | 16 | 24 | 32
  tracks: TrackData[],   // Array of tracks (default: 4)
  swing: 0,              // Swing 0–100 (delays odd steps by 0–50% of stepInterval)
  audioRate: false,      // Lookahead scheduling — output is { time, value }
}

interface TrackData {
  name: string;          // Label shown on left side of row (e.g. 'KICK')
  color: string;         // Hex color for step buttons
  stepOn: boolean[];     // Per-step on/off, length = steps
  stepValues: number[];  // Per-step velocity 0.0–1.0, length = steps (default 1.0)
}
```

**Default tracks (4):**

| Name | Color |
|------|-------|
| KICK | `#e57373` (red) |
| SNARE | `#64b5f6` (blue) |
| CHH | `#ffd54f` (yellow) |
| OHH | `#b39ddb` (purple) |

**Step count resize**: First N steps preserved when shrinking; new steps default to off/1.0 when expanding. Applied to all tracks.

## Outlets

**Dynamic**: N outlets — one per track. Outlet `i` fires when track `i` has an active step at the current position.

| Index | When | Data (normal) | Data (audio rate) |
|-------|------|---------------|-------------------|
| 0 | Track 0 active step | `number` (value 0–1) | `{time: number, value: number}` |
| 1 | Track 1 active step | `number` (value 0–1) | `{time: number, value: number}` |
| … | … | … | … |
| N-1 | Track N-1 active step | `number` (value 0–1) | `{time: number, value: number}` |

Handle IDs: `out-0`, `out-1`, … `out-{N-1}` (via StandardHandle with `id={trackIndex}`).

Sending: `messageContext.send(value, { to: trackIndex })` or `messageContext.send({ time, value }, { to: trackIndex })`.

When a step is off, no message is sent on that outlet for that step.

## Scheduling Architecture

One `LookaheadClockScheduler` drives all tracks:

1. Subscribe: `scheduler.every("0:${beatsPerBar/steps}:0", callback, { audio: true })`
2. In each callback, compute step index from transport time (stateless):

   ```
   stepInterval = (60/bpm) * (beatsPerBar/numSteps)
   barDuration  = (60/bpm) * beatsPerBar
   posInBar     = time % barDuration
   stepIndex    = floor(posInBar / stepInterval) % numSteps
   ```

3. Apply swing for odd steps: one-shot `schedule(time + swingOffset)` where
   `swingOffset = (swing/100) * 0.5 * stepInterval`
4. At fire time, iterate tracks: for each track `t`, if `stepOn[stepIndex]` fire outlet `t`
5. Re-subscribe when `steps` count or time signature (`beatsPerBar`) changes
6. Visual cursor: poll `Transport.ticks` at 30fps

## Output Format

| audioRate | Outlet sends |
|-----------|-------------|
| false | `number` (stepValues[stepIndex], default 1.0) |
| true | `{time: number, value: number}` |

Always a value — there's no bang-only mode. The value is always present.

## UI

```
┌─────────────────────────────────────────────────────┐
│  KICK  [■][ ][ ][ ][■][ ][ ][ ][■][ ][ ][ ][■][ ][■][ ] │
│ SNARE  [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ] │
│   CHH  [■][■][■][■][■][■][■][■][■][■][■][■][■][■][■][■] │
│   OHH  [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ] │
└─────────────────────────────────────────────────────┘
  ○      ○      ○      ○    ← outlets (one per track)
```

- **Track row**: label (left) + 16 step buttons
- **Step button**: colored when on, dark when off; outlined when it's the current step
- **Visual cursor**: the current step column is highlighted across all rows simultaneously
- **Outlets**: one per track, evenly spaced at the bottom; `useUpdateNodeInternals()` called after track count changes
- **Settings panel** (gear icon → floating panel):
  - Step count: segmented buttons `4 / 8 / 12 / 16 / 24 / 32`
  - Swing: slider 0–100%
  - Audio Rate: toggle
  - Track management: add track (+ button), per-track: edit name, color picker, delete

## Undo/Redo

- `tracker.commit('tracks', oldTracks, newTracks)` — step toggle, track add/remove, rename, color
- `tracker.track('swing', ...)` + `onPointerDown/Up` — swing slider

## Files

- `ui/src/lib/components/nodes/SequencerNode.svelte` — visual node
- `ui/src/lib/nodes/node-types.ts` — registration
- `ui/src/lib/nodes/defaultNodeData.ts` — default data
- `ui/src/lib/extensions/object-packs.ts` — add to Control pack
- `ui/src/lib/ai/object-descriptions-types.ts` — AI type list
- `ui/src/lib/ai/object-prompts/seq.ts` — AI prompt
- `ui/src/lib/ai/object-prompts/index.ts` — register prompt
