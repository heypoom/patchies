# 96. pads~ Drum Pad Sampler

## Overview

`pads~` is a 16-pad sampler node inspired by the Akai MPC / Ableton Drum Rack. It receives MIDI noteOn/noteOff messages and plays back audio samples assigned to each pad. Pads are triggered by MIDI notes following the standard GM drum map (note 36 = pad 1).

It differs from `sampler~` in that it holds up to 16 independent samples and is optimized for fast sample assignment via drag-and-drop onto individual pads.

---

## Module Location

All object-specific files live together in:

```text
ui/src/objects/pads/
├── constants.ts          # Types, defaults, pad count configs, GM note map
├── schema.ts             # TypeBox message schemas + ts-pattern matchers
├── PadsNode.svelte       # Main resizable node component (pad grid UI)
├── PadCell.svelte        # Individual pad with drag-drop, flash on trigger
├── PadsSettings.svelte   # Settings panel (pad count, polyphony, noteOff mode)
├── PadsAudioNode.ts      # V2 audio node class
└── prompt.ts             # AI object prompt (imported by src/lib/ai/object-prompts/index.ts)
```

Registration in existing files (outside the module):

- `src/lib/audio/v2/nodes/index.ts` — register `PadsAudioNode`
- `src/lib/nodes/node-types.ts` — add `'pads~'`
- `src/lib/nodes/defaultNodeData.ts` — add default node data
- `src/lib/components/object-browser/get-categorized-objects.ts` — add description + category
- `src/lib/extensions/object-packs.ts` — add to Audio pack
- `src/lib/ai/object-descriptions-types.ts` — add to `OBJECT_TYPE_LIST`
- `src/lib/ai/object-prompts/index.ts` — import `prompt` from `$objects/pads/prompt`
- `static/content/objects/pads~.md` — object documentation

---

## Node Data Shape

```typescript
// constants.ts

export type PadCount = 8 | 16
export type NoteOffMode = 'ignore' | 'stop'

export interface PadConfig {
  vfsPath?: string // VFS path to audio sample
  label?: string // Display name (auto-derived from filename if omitted)
}

export interface PadsNodeData {
  padCount: PadCount // 8 or 16 pads (default: 16)
  pads: PadConfig[] // Always length 16; only [0..padCount-1] are active
  maxVoices: number // Max simultaneous voices per pad (1–16, default: 4)
  noteOffMode: NoteOffMode // 'ignore' (one-shot) | 'stop' (gated), default: 'ignore'
}

export const BASE_NOTE = 36 // MIDI note for pad 1 (GM kick)

export const DEFAULT_PADS_NODE_DATA: PadsNodeData = {
  padCount: 16,
  pads: Array.from({length: 16}, () => ({})),
  maxVoices: 4,
  noteOffMode: 'ignore',
}
```

---

## MIDI Mapping

| Pad | MIDI Note | GM Name        |
| --- | --------- | -------------- |
| 1   | 36        | Bass Drum 1    |
| 2   | 37        | Side Stick     |
| 3   | 38        | Acoustic Snare |
| 4   | 39        | Hand Clap      |
| 5   | 40        | Electric Snare |
| 6   | 41        | Low Floor Tom  |
| 7   | 42        | Closed Hi-Hat  |
| 8   | 43        | High Floor Tom |
| 9   | 44        | Pedal Hi-Hat   |
| 10  | 45        | Low Tom        |
| 11  | 46        | Open Hi-Hat    |
| 12  | 47        | Low-Mid Tom    |
| 13  | 48        | Hi-Mid Tom     |
| 14  | 49        | Crash Cymbal 1 |
| 15  | 50        | High Tom       |
| 16  | 51        | Ride Cymbal 1  |

---

## Message Schema

```typescript
// schema.ts — TypeBox schemas + ts-pattern matchers

import {Type} from '@sinclair/typebox'
import {msg, sym} from '$lib/objects/schemas/helpers'
import {schema} from '$lib/objects/schemas/types'

// Inlet: MIDI message (passed from midi.in or other sources)
export const NoteOn = msg('noteOn', {
  note: Type.Number(),
  velocity: Type.Number(),
})
export const NoteOff = msg('noteOff', {
  note: Type.Number(),
  velocity: Type.Number(),
})

// Load a sample into a specific pad slot
export const LoadPad = msg('load', {pad: Type.Number(), src: Type.String()})

export const padsMessages = {
  noteOn: schema(NoteOn),
  noteOff: schema(NoteOff),
  loadPad: schema(LoadPad),
}
```

---

## Inlets & Outlets

| Port   | Type    | Description                                 |
| ------ | ------- | ------------------------------------------- |
| Inlet  | message | MIDI `noteOn`/`noteOff`, or `load` commands |
| Outlet | signal  | Stereo audio mix of all active pad voices   |

---

## PadsAudioNode (Audio V2)

```typescript
// PadsAudioNode.ts

class PadsAudioNode implements AudioNodeV2 {
  static type = 'pads~'

  // Per-pad: loaded AudioBuffer + pool of active source nodes
  private buffers: (AudioBuffer | null)[] = Array(16).fill(null)
  private voices: Map<number, AudioBufferSourceNode[]> = new Map()

  // Shared output gain → outlet
  private outputGain: GainNode

  async loadPad(
    padIndex: number,
    vfsPath: string,
    ctx: AudioContext,
  ): Promise<void>
  // Fetches audio via VFS, decodes, stores in buffers[padIndex]

  triggerOn(
    padIndex: number,
    velocity: number,
    ctx: AudioContext,
    maxVoices: number,
  ): void
  // 1. If buffers[padIndex] is null, return (no sample loaded)
  // 2. Get current voices for pad; if length >= maxVoices, stop oldest
  // 3. Create AudioBufferSourceNode, set buffer, set playbackRate=1
  // 4. Connect: source → outputGain
  // 5. source.start(); track in voices map
  // 6. source.onended: remove from voices map

  triggerOff(padIndex: number): void
  // If noteOffMode === 'stop': ramp gain of all active voices for pad
  // to 0 over 10ms, then stop. Otherwise no-op.

  send(message: unknown): void
  // match(message)
  //   .with(padsMessages.noteOn, ({ note, velocity }) => {
  //     const padIndex = note - BASE_NOTE;
  //     if (padIndex >= 0 && padIndex < padCount) triggerOn(padIndex, velocity, ...)
  //   })
  //   .with(padsMessages.noteOff, ({ note }) => triggerOff(note - BASE_NOTE))
  //   .with(padsMessages.loadPad, ({ pad, src }) => loadPad(pad, src, ...))
  //   .otherwise(() => {})
}
```

**Voice management detail:** When `noteOffMode === 'stop'`, voices are tracked with their own `GainNode` (source → padGain → outputGain) so they can be faded individually without affecting other pads.

---

## PadsNode.svelte (Visual Component)

### Layout

- Uses `NodeResizer` for user-resizable node
- Minimum size: ~240×200 (8-pad), ~240×320 (16-pad)
- Pad grid: 4 columns × 4 rows (16-pad) or 4 columns × 2 rows (8-pad)
- Each pad cell: `PadCell.svelte`
- Gear icon → settings panel (same pattern as `SamplerNode.svelte`)

### PadCell.svelte

Each cell:

- Shows sample label (filename without extension, or empty state hint)
- Highlights briefly (flash animation) when triggered via MIDI noteOn
- Is a drag-drop target accepting:
  - `application/x-vfs-path` — from VFS file browser
  - `application/x-sample-url` — from Samples sidebar
  - File drops (`audio/*`) — from OS file manager
- On drop: calls `updateNodeData` to set `pads[index].vfsPath` and loads buffer into audio node
- Right-click / clear button: remove sample from pad

### Flash on Trigger

The node subscribes to noteOn events from the audio node via a message callback. When pad `i` fires, `PadCell` at index `i` briefly sets an `active` CSS class (e.g., 100ms timeout).

---

## PadsSettings.svelte

Settings exposed in the node settings panel:

| Setting      | Control          | Values                           |
| ------------ | ---------------- | -------------------------------- |
| Pad count    | Segmented toggle | 8 / 16                           |
| Max voices   | Number input     | 1–16 (default 4)                 |
| NoteOff mode | Segmented toggle | One-shot (ignore) / Gated (stop) |

All settings changes use `useNodeDataTracker` for undo/redo support (discrete changes → `tracker.commit()`).

---

## Drag-Drop into Pads

Each `PadCell` handles its own `ondragover` / `ondrop` events, similar to how `SamplerNode.svelte` uses `useVfsMedia()`, but scoped to a single pad slot:

```svelte
<!-- PadCell.svelte -->
function ondrop(event: DragEvent) {
  event.preventDefault();

  const vfsPath = event.dataTransfer?.getData('application/x-vfs-path');
  if (vfsPath) {
    assignSample(padIndex, vfsPath);
    return;
  }

  const sampleData = event.dataTransfer?.getData('application/x-sample-url');
  if (sampleData) {
    const { url } = JSON.parse(sampleData);
    // Register URL in VFS → get vfsPath → assignSample
  }

  const file = event.dataTransfer?.files[0];
  if (file?.type.startsWith('audio/')) {
    // Write to VFS → get vfsPath → assignSample
  }
}
```

`assignSample(padIndex, vfsPath)`:

1. `updateNodeData({ pads: updated })` — persist to node data
2. Send `{ type: 'load', pad: padIndex, src: vfsPath }` to audio node via `audioService.send()`

---

## Future Settings (Not in v1)

The following per-pad settings are planned for future iterations but are out of scope now:

- Offset (start point within sample)
- Playback speed / pitch
- Per-pad volume
- Filter (lowpass/highpass cutoff)
- Drive / saturation
- Loop on/off
- Volume ADSR envelope

---

## Open Questions

- **GM label display**: Should pads show GM drum names (e.g., "Kick", "Snare") when no sample is loaded, as a hint? Or just empty?
- **Pad numbering**: MPC numbers pads bottom-left to top-right (pad 1 = bottom-left). Should we follow this convention or go top-left to bottom-right?
