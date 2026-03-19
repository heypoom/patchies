# 101. Piano Roll (`pianoroll`)

## Overview

A resizable MIDI clip sequencer with an inline piano roll visualization. Records MIDI messages (noteOn/noteOff) from upstream nodes, displays them as a note grid, allows editing, and plays back in sync with the global transport.

Unlike the generic `tape` object, `pianoroll` is MIDI-specific: notes have pitch, velocity, duration, and channel — all editable visually.

---

## Core Data Format

```typescript
interface PianoRollNote {
  tick: number // start tick (relative to clip start, PPQ = 480)
  durationTicks: number // note duration in ticks
  note: number // MIDI note number 0–127
  velocity: number // 0–127
  channel: number // 1–16
}

interface PianoRollNodeData {
  notes: PianoRollNote[]
  lengthBars: number // clip length in bars (1, 2, 4, 8, 16)
  loop: boolean
  syncToTransport: boolean // default: true
  quantize: 'off' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' // snap on record + edit
  // View state (not musically significant)
  scrollNote: number // lowest visible MIDI note (default: 48 = C3)
  zoom: number // pixels per beat (default: 60)
}
```

---

## Inlets & Outlets

### Inlets

| #   | Name    | Type    | Description                                                |
| --- | ------- | ------- | ---------------------------------------------------------- |
| 0   | midi    | message | MIDI messages to record (`noteOn` / `noteOff`)             |
| 1   | command | message | `'arm'` \| `'stop'` \| `'clear'` \| `'loop'` \| `'unloop'` |

### Outlets

| #   | Name | Type    | Description                                        |
| --- | ---- | ------- | -------------------------------------------------- |
| 0   | midi | message | MIDI `noteOn` / `noteOff` messages during playback |

---

## State Machine

```text
idle ──arm──► armed ──transport play──► recording ──stop/auto──► playing
  ▲                                                                  │
  └─────────────────────── clear ────────────────────────────────────┘

playing ──loop on──► looping ──loop off──► playing
```

Commands:

- `'arm'` — arm for recording; starts when transport plays (or immediately if already playing). Re-arming with existing notes overwrites on next record.
- `'stop'` — end recording / stop playback → `idle`
- `'clear'` — discard all notes → `idle`
- `'loop'` / `'unloop'` — toggle loop

---

## Recording

When in `recording` mode, incoming messages on inlet 0 are processed:

```typescript
// noteOn → open a pending note
if (msg.type === 'noteOn' && msg.velocity > 0) {
  pending.set(msg.note, {
    tick: Transport.ticks - clipStartTick,
    velocity: msg.velocity,
    channel: msg.channel,
  })
}

// noteOff (or noteOn with velocity 0) → close and commit
if (msg.type === 'noteOff' || (msg.type === 'noteOn' && msg.velocity === 0)) {
  const start = pending.get(msg.note)
  if (start) {
    let tick = start.tick
    let durationTicks = Transport.ticks - clipStartTick - tick
    if (quantize !== 'off') tick = snapToGrid(tick, quantize, ppq)
    notes.push({
      tick,
      durationTicks,
      note: msg.note,
      velocity: start.velocity,
      channel: start.channel,
    })
    pending.delete(msg.note)
  }
}
```

**Auto-stop**: After `lengthBars` bars, recording ends and transitions to playing/looping. Any still-open notes are closed at the clip boundary.

**Transport stop**: Ends recording, returns to `idle`. Notes captured so far are kept.

---

## Playback

On each loop start, all notes in the clip are scheduled via `clock.schedule`:

```typescript
for (const note of notes) {
  const onTime = loopStartTime + ticksToSeconds(note.tick, bpm, ppq)
  const offTime =
    loopStartTime + ticksToSeconds(note.tick + note.durationTicks, bpm, ppq)

  scheduler.schedule(onTime, () =>
    send({
      type: 'noteOn',
      note: note.note,
      velocity: note.velocity,
      channel: note.channel,
    }),
  )
  scheduler.schedule(offTime, () =>
    send({
      type: 'noteOff',
      note: note.note,
      velocity: 0,
      channel: note.channel,
    }),
  )
}
```

If BPM changes, reschedule all pending events from the current transport position.

---

## Piano Roll UI

The node is resizable (`NodeResizer`). Default size: **360 × 200px**. Minimum: **240 × 120px**.

### Layout

```
┌──────────────────────────────────────────────────────┐
│ [ARM] [STOP] [CLEAR]  ↻ LOOP  REC● 2 bars · 12 notes │  ← header
├────┬─────────────────────────────────────────────────┤
│    │  |  bar 1  |  bar 2  |  bar 3  |  bar 4  |      │  ← time ruler
│ C5 ├─────────────────────────────────────────────────┤
│ B4 │          █████                                  │
│ A4 │  ████                    ███                    │  ← note grid
│ G4 │        ██████████                               │
│ F4 │                               ████████          │
│ E4 ├─────────────────────────────────────────────────┤
│    │                    ▲ playhead                   │  ← transport position
└────┴─────────────────────────────────────────────────┘
```

### Piano Keys (left column, ~20px wide)

- Shows note names for C notes (C2, C3, C4…)
- Black/white key coloring
- Scroll vertically to change visible pitch range
- Clicking a key sends a preview noteOn (for audition)

### Note Grid

- Notes rendered as filled rectangles; width = duration, vertical position = pitch
- **Velocity** encoded as note opacity (low velocity = more transparent)
- **Active bar subdivisions** shown as faint vertical lines (beat + subdivisions based on quantize setting)
- Playhead: thin vertical line tracking `Transport.ticks` position

### Interactions

| Action                   | Result                                                        |
| ------------------------ | ------------------------------------------------------------- |
| Click empty cell         | Create note at quantized position (default duration = 1 beat) |
| Drag new note right      | Set duration while creating                                   |
| Click existing note      | Select note                                                   |
| Drag selected note       | Move (pitch + time)                                           |
| Drag right edge of note  | Resize duration                                               |
| Right-click / Delete key | Delete note                                                   |
| Scroll wheel vertical    | Scroll pitch range                                            |
| Scroll wheel horizontal  | Scroll time                                                   |
| Ctrl/Cmd + scroll        | Zoom (pixels per beat)                                        |

All edits snap to the `quantize` setting if enabled.

### Color

Notes use the standard message/zinc color scheme. Velocity expressed via opacity only (simpler than a full velocity lane for now).

---

## Transport Sync

When `syncToTransport = true` (default):

- Transport play while `armed` → start recording
- Transport stop while `recording` → end recording, keep notes, return to `idle`
- Transport stop while `playing`/`looping` → return to `idle`

When `syncToTransport = false`:

- Arm starts recording immediately
- Playback runs freely

---

## Module Location

All implementation files live together in one directory:

```text
ui/src/objects/pianoroll/
├── types.ts              # PianoRollNote, PianoRollNodeData interfaces
├── schema.ts             # TypeBox message schemas + ts-pattern matchers
├── PianoRollNode.svelte  # resizable node component (piano roll UI)
├── PianoRollKeys.svelte  # left-side piano keyboard column
├── PianoRollGrid.svelte  # note grid + playhead canvas
├── PianoRollObject.ts    # V2 object class (recording + playback logic)
└── prompt.ts             # AI object prompt
```

The only file outside this directory is the documentation:

```text
ui/static/content/objects/pianoroll.md
```

## Registration

Imports from `$objects/pianoroll/` added to existing files:

- `src/lib/objects/v2/nodes/index.ts` — import + add `PianoRollObject` to `TEXT_OBJECTS`
- `src/lib/nodes/node-types.ts` — add `'pianoroll'`
- `src/lib/nodes/defaultNodeData.ts` — add defaults
- `src/lib/components/object-browser/get-categorized-objects.ts` — category: **Sequencing**
- `src/lib/extensions/object-packs.ts` — add to Core pack
- `src/lib/ai/object-descriptions-types.ts` — add to `OBJECT_TYPE_LIST`
- `src/lib/ai/object-prompts/index.ts` — import `prompt` from `$objects/pianoroll/prompt`

---

## Open Questions

1. **Velocity editing**: For v1, velocity is shown as opacity only. A future velocity lane below the grid (like Ableton) would allow editing individual note velocities.

2. **Multi-channel display**: For v1, all channels share the same note grid but are color-coded per channel. Filtering by channel is deferred.

3. **Note preview on draw**: When clicking to create a note, should it send a live `noteOn` out of outlet 0 immediately (so the user hears the note they're drawing)? Probably yes — makes the tool feel responsive.

## Deferred

- Velocity lane for per-note velocity editing
- Multi-channel color coding
- Automation lanes (pitch bend, CC)
- Copy/paste notes
- Select-all + transpose
