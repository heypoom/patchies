# 100. Sequencer Single Outlet Mode

## Summary

Add an `outletMode` setting to the sequencer node: **multi** (default, current behavior — one outlet per track) or **single** (one outlet, structured messages).

## Motivation

Connecting a sequencer to `pads~` currently requires N wires (one per track). A single-outlet mode lets users wire one connection and route by track index. This also enables MIDI-style output for external devices.

## Design

### New node data field

```ts
outletMode?: 'multi' | 'single';  // default: 'multi'
```

### Output modes per outlet mode

**Multi outlet** (`outletMode: 'multi'`, default): existing behavior unchanged.
- bang: `{type: 'bang'}`
- value: velocity number (0–1)
- audio: `{type: 'set', time, value}`

**Single outlet** (`outletMode: 'single'`): new output format, one outlet.
- **index**: sends track index as a number (0–N)
- **midi**: sends `{type: 'noteOn', note: BASE_NOTE + trackIndex, index: trackIndex, velocity: 0–127}`
- **audio**: sends `{type: 'noteOn', note: BASE_NOTE + trackIndex, index: trackIndex, velocity: 0–127, time}`

`note` uses GM drum mapping (BASE_NOTE = 36, same as pads~). `velocity` is standard MIDI 0–127 (converted from internal 0–1). `index` is the raw track index.

The `outputMode` field changes meaning based on `outletMode`:
- When `multi`: `'bang' | 'value' | 'audio'` (existing)
- When `single`: `'index' | 'midi' | 'audio'`

When switching `outletMode`, `outputMode` resets to the first option of the new mode (multi→bang, single→index).

### Handles

- **multi**: N outlets (current behavior, `StandardHandle` per track)
- **single**: 1 outlet (`StandardHandle`, id=0, title="out")

### Settings UI

In `SequencerSettings`, add an "Outlet" toggle (multi/single) below the "Velocity lane" checkbox. The "Output" section updates its buttons to match the active outlet mode's options.

### Schema updates

Add new outlet message schemas and a `setOutletMode` message to the sequencer schema.

### Message: setOutletMode

```ts
{type: 'setOutletMode', value: 'multi' | 'single'}
```

## Behavior

When a step fires in single-outlet mode, for each active track at that step, a message is sent on outlet 0:

```ts
// index mode
fireAtStep(step, time) → send(trackIndex, { to: 0 })

// midi mode  
fireAtStep(step, time) → send({type: 'noteOn', note: BASE_NOTE + trackIndex, index: trackIndex, velocity: round(v * 127)}, { to: 0 })

// audio mode
fireAtStep(step, time) → send({type: 'noteOn', note: BASE_NOTE + trackIndex, index: trackIndex, velocity: round(v * 127), time}, { to: 0 })
```

Multiple tracks active on the same step = multiple messages sent on the same outlet in sequence.

## Files to modify

1. `src/lib/nodes/sequencer-constants.ts` — no changes needed
2. `src/lib/components/nodes/SequencerNode.svelte` — outletMode state, fireAtStep logic, handle rendering
3. `src/lib/components/settings/SequencerSettings.svelte` — outlet mode toggle, dynamic output modes
4. `src/lib/objects/schemas/sequencer.ts` — new schemas, updated outlet docs
