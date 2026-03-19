# 100. Message Tape (`tape`)

## Overview

A single object that records and plays back any message stream in sync with the global transport. Designed with MIDI use cases in mind (recording from `midi-in`, sequencers, `pads~`) but works with any message type.

Events are stored in **ticks** (PPQ = 480), so recordings stay correct if BPM changes between sessions.

---

## Core Data Format

```typescript
interface ClipEvent {
  tick: number // tick offset from clip start (relative, PPQ = 480)
  data: unknown // raw message data, unmodified
}

interface ClipData {
  events: ClipEvent[]
  lengthTicks: number // total clip duration in ticks
  ppq: number // 480 (stored for forward-compat)
}
```

`ticks = seconds × (bpm / 60) × ppq`

---

## `tape` — Message Tape

### Inlets

| #   | Name    | Type    | Description                               |
| --- | ------- | ------- | ----------------------------------------- |
| 0   | input   | message | Messages to record (when armed/recording) |
| 1   | command | message | Control commands (see below)              |

### Outlets

| #   | Name   | Type    | Description                             |
| --- | ------ | ------- | --------------------------------------- |
| 0   | output | message | Messages played back at scheduled times |

### Node Data

```typescript
interface TapeNodeData {
  mode: 'idle' | 'armed' | 'recording' | 'playing' | 'looping'
  loop: boolean
  quantize: 'off' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1bar'
  bars: 0 | 1 | 2 | 4 | 8 | 16 // 0 = manual stop; N = auto-stop after N bars
  clip: ClipData | null // persisted with the patch
}
```

### State Machine

```text
idle ──arm──► armed ──transport play──► recording ──stop/auto──► playing
  ▲                                                                  │
  └──────────────────── clear ───────────────────────────────────────┘

playing ──loop on──► looping ──loop off──► playing
```

- `'arm'` → sets mode to `armed`; recording begins when transport next plays
- `'record'` → begin recording immediately (if transport is already playing)
- `'stop'` → if recording: end recording and start playing; if playing/looping: stop
- `'clear'` → discard clip, return to `idle`
- `'loop'` / `'unloop'` → toggle loop mode during playback

### Recording Behavior

**Record start**: `clipStartTick = Transport.ticks` is captured when recording begins.

**Capturing events**: Each message on inlet 0 while in `recording` mode:

```typescript
let tick = Transport.ticks - clipStartTick
if (quantize !== 'off') tick = snapToGrid(tick, quantize, bpm, ppq)
clip.events.push({tick, data: message.data})
```

**Auto-stop**: If `bars > 0`, recording stops after exactly `bars × beatsPerBar × (ppq × 4/denominator)` ticks. Clip length is set to this value precisely (not trimmed to last event) for clean loops.

**Manual stop**: Sending `'stop'` or stopping the transport ends recording. Clip length = `Transport.ticks - clipStartTick`.

**After recording**: Immediately transitions to `playing` or `looping` (depending on `loop` setting) and begins playback from the start.

### Playback Scheduling

Uses `PollingClockScheduler` (same as the sequencer) via `clock.schedule`. On playback start:

```typescript
// Schedule all events in this loop iteration
for (const event of clip.events) {
  const absTime = playbackStartTime + ticksToSeconds(event.tick, bpm, ppq)
  scheduler.schedule(absTime, () => send(event.data))
}

// Schedule loop re-trigger
if (loop) {
  const loopEndTime =
    playbackStartTime + ticksToSeconds(clip.lengthTicks, bpm, ppq)
  scheduler.schedule(loopEndTime, () => scheduleNextLoop())
}
```

`ticksToSeconds(ticks, bpm, ppq) = ticks / (ppq × bpm / 60)`

If BPM changes, re-schedule all pending events from the current transport position.

### Transport Sync

By default the object follows the global transport:

- Transport play while `armed` → start recording
- Transport stop while `recording` → end recording, begin playing
- Transport stop while `playing`/`looping` → stop playback

### UI

- Status badge: `IDLE` / `ARMED` / `REC ●` (pulsing red) / `PLAYING ▶` / `LOOPING ↻`
- Clip info: `2 bars · 47 events` (shown once clip is recorded)
- Inline buttons: **ARM**, **STOP**, **CLEAR**, **LOOP** toggle
- Settings panel: **Quantize** (dropdown) + **Bars** (dropdown, 0 = manual)

---

## Timing Accuracy

`PollingClockScheduler` fires callbacks on each animation frame (~16ms at 60fps). Playback events fire within ~16ms of their scheduled transport time — sufficient for most MIDI purposes (comparable to USB MIDI jitter), though not sample-accurate.

### Future: MIDI Lookahead Scheduling

For tighter timing with `midi-out`, the player could use `{ audio: true }` and attach `_scheduledTime` to outgoing messages. `midi-out` would then use WebMidi's `time` parameter for hardware-accurate scheduling. Deferred to a later spec.

---

## Typical Patch Examples

**Record MIDI loop and play it back:**

```
[midi-in] → [tape] → [midi-out]
```

**Record and send to a synth:**

```
[midi-in] → [tape] → [synth~]
```

---

## Module Location

```text
ui/src/lib/objects/v2/nodes/TapeObject.ts
ui/src/lib/components/nodes/TapeNode.svelte
```

---

## Registration

- `src/lib/objects/v2/nodes/index.ts` — add to `TEXT_OBJECTS`
- `src/lib/nodes/node-types.ts` — add `'tape'`
- `src/lib/nodes/defaultNodeData.ts` — add defaults
- `src/lib/components/object-browser/get-categorized-objects.ts` — category: **Sequencing**
- `src/lib/extensions/object-packs.ts` — add to Core pack
- `src/lib/ai/object-descriptions-types.ts` — add to `OBJECT_TYPE_LIST`
- `src/lib/ai/object-prompts/index.ts` — register prompt
- `static/content/objects/tape.md` — documentation

---

## Open Questions

1. **Persistence**: `ClipData` is saved in node data and survives page reload. A 2-bar MIDI recording at 16th-note resolution is ~64 events — trivial to serialize.

2. **VFS integration**: Save/load clips to VFS for sharing between patches. Deferred — can be added as `'save'` / `'load'` commands on inlet 1 later.

3. **Overdub**: Merging a new recording into an existing clip. Deferred.

4. **Tempo map**: Assumes constant BPM during playback. BPM changes mid-playback will cause drift. Mitigation: reschedule pending events on BPM change via `PatchiesEventBus`.
