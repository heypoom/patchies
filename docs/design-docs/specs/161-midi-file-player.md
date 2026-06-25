# 161. MIDI File Player

## Motivation

Patchies can receive live MIDI with `midi.in` and send MIDI to devices with `midi.out`, but it
cannot play a Standard MIDI File as a patch object. A `midi.file` node should let users drop or
select a `.mid` / `.midi` file, control playback from the canvas, and emit the same Patchies MIDI
messages that other MIDI-aware objects already understand.

## Goals

- Add a `midi.file` node that plays back MIDI files into the message graph.
- Support play, pause, stop, and seek from both node UI controls and incoming control messages.
- Emit standard Patchies MIDI messages: `noteOn`, `noteOff`, `controlChange`, `programChange`,
  `pitchBend`, and additional channel/meta messages where useful.
- Optionally apply the MIDI file's tempo and time signature metadata to the global transport when
  playback starts.
- Support immediate canvas drag/drop for `.mid` and `.midi` files.
- Follow the existing compact MIDI node style and the standard floating settings panel pattern.

## Non-Goals

- No MIDI editing in this node. Piano-roll editing belongs to `pianoroll`.
- No audio synthesis. Users connect `midi.file` to `tone~`, `sonic~`, `midi.out`, `webmidilink`,
  `pads~`, or other MIDI consumers.
- No multi-file playlist behavior in v1.
- No export or recording of MIDI files in v1.

## Node Name

The object name is `midi.file`, matching the existing `midi.in` and `midi.out` naming pattern.

It belongs in the MIDI object pack next to:

- `midi.in`
- `midi.out`
- `webmidilink`
- `mtof`

## Node Data

```typescript
interface MidiFileNodeData {
  fileName?: string;
  vfsPath?: string; // preferred source for local files, URLs, and larger files
  fileData?: string; // optional base64 fallback for inline/imported bytes
  durationSeconds?: number;
  durationTicks?: number;
  ppq?: number;
  trackCount?: number;

  playState: "stopped" | "playing" | "paused";
  positionSeconds: number;
  loop: boolean;

  applyTempoToTransport: boolean;
  applyTimeSignatureToTransport: boolean;
  syncTransport: boolean;
  outputMetaEvents: boolean;
}
```

Defaults:

```typescript
{
  playState: 'stopped',
  positionSeconds: 0,
  loop: false,
  applyTempoToTransport: true,
  applyTimeSignatureToTransport: true,
  syncTransport: false,
  outputMetaEvents: false
}
```

`vfsPath` is the preferred source, matching the `soundfile~` pattern: the VFS can resolve local
files, linked-folder files, and URL-backed files without forcing large bytes into node data.
`fileData` is still accepted for pasted/imported bytes and small self-contained patches. When both
are present, `vfsPath` wins.

## Inlets And Outlets

| #   | Name    | Type    | Description                                      |
| --- | ------- | ------- | ------------------------------------------------ |
| 0   | command | message | Playback, seek, file-load, and settings commands |

| #   | Name | Type    | Description                               |
| --- | ---- | ------- | ----------------------------------------- |
| 0   | out  | message | MIDI channel, playback, and meta messages |

The node has no audio or video ports.

## Playback Messages

Incoming commands:

```typescript
type MidiFileCommand =
  | "bang"
  | "play"
  | "pause"
  | "stop"
  | "https://example.com/file.mid"
  | "http://example.com/file.mid"
  | "user://Samples/file.mid"
  | "obj://midi.file-1/file.mid"
  | ArrayBuffer
  | Uint8Array
  | number[]
  | { type: "play" }
  | { type: "pause" }
  | { type: "stop" }
  | { type: "seek"; seconds: number }
  | { type: "seek"; beats: number }
  | { type: "seek"; ticks: number }
  | { type: "loop"; value?: boolean }
  | {
      type: "set";
      applyTempoToTransport?: boolean;
      applyTimeSignatureToTransport?: boolean;
      syncTransport?: boolean;
      outputMetaEvents?: boolean;
      sendPositionEvents?: boolean;
      loop?: boolean;
    };
```

Behavior:

- `bang` and `play` start playback from the current position.
- `pause` stops scheduling new events but preserves the current position.
- `stop` stops playback, emits note-offs for currently active notes, and resets to `0`.
- `seek` moves the playback cursor and emits note-offs for notes that were active before the seek.
- `loop` toggles or sets looping.
- `set` updates persistent node settings using `useNodeDataTracker`.
- `load` replaces the current file and resets playback. `vfsPath` and `url` loads should route
  through the VFS, while `data` loads may store inline `fileData`.

## Emitted MIDI Messages

`midi.file` emits the existing Patchies MIDI channel message shapes where possible:

```typescript
{ type: 'noteOn', note: number, velocity: number, channel: number }
{ type: 'noteOff', note: number, velocity: number, channel: number }
{ type: 'controlChange', control: number, value: number, channel: number }
{ type: 'programChange', program: number, channel: number }
{ type: 'pitchBend', value: number, channel: number }
```

Additional supported messages:

```typescript
{ type: 'channelPressure', pressure: number, channel: number }
{ type: 'polyPressure', note: number, pressure: number, channel: number }
```

Meta/status messages are emitted from the same outlet. Consumers can discriminate by `type`. The
node emits loaded and ended status events even when `outputMetaEvents` is false, emits `position`
events only when `sendPositionEvents` is true, and emits parsed MIDI meta events only when
`outputMetaEvents` is true:

```typescript
{ type: 'loaded', fileName: string, durationSeconds: number, trackCount: number, ppq: number }
{ type: 'position', seconds: number, progress: number }
{ type: 'ended' }
{ type: 'tempo', bpm: number, tick: number }
{ type: 'timeSignature', numerator: number, denominator: number, tick: number }
{ type: 'keySignature', key: string, tick: number }
{ type: 'trackName', name: string, track: number }
```

## Timing Model

Playback uses parsed MIDI event times, not `setInterval` ticks. The implementation should parse the
file into a flattened event list ordered by absolute time:

```typescript
interface ScheduledMidiFileEvent {
  seconds: number;
  ticks: number;
  track: number;
  message: MidiFileOutputMessage;
}
```

Scheduling should use the same transport-aware clock primitives used by sequencer-style objects
where practical. The scheduler must:

- schedule ahead of the current cursor while playback is running;
- cancel pending callbacks on pause, stop, file reload, seek, and destroy;
- emit all pending note-offs on stop/destroy to prevent stuck notes;
- reschedule remaining events after a seek;
- preserve original MIDI timing even if the global transport BPM changes after playback starts.

## Transport Metadata Setting

Many MIDI files include tempo and time-signature meta events. `midi.file` exposes these settings in
its floating settings panel:

| Setting                  | Default | Behavior                                                 |
| ------------------------ | ------- | -------------------------------------------------------- |
| Apply tempo to transport | on      | On play from `0`, set transport BPM                      |
| Apply time signature     | on      | On play from `0`, set transport time signature           |
| Sync to transport        | off     | Transport play/pause/stop controls playback              |
| Emit meta events         | off     | Send tempo, time-signature, key, and track-name messages |
| Send position events     | off     | Send playback position/progress messages                 |
| Loop                     | off     | Restart at `0` when the file reaches the end             |

Transport application is intentionally explicit:

- The node does not change transport tempo/time-signature merely when a file loads.
- The node applies the first tempo/time-signature at the current cursor when playback starts from
  `0`.
- Later tempo changes inside the MIDI file are emitted as meta events, but do not continuously
  drive global transport in v1. Continuous tempo-map transport sync can be a follow-up feature.
- If the file has no tempo event, use 120 BPM for scheduling but do not overwrite global transport
  BPM.
- If the file has no time signature, use `4/4` for display but do not overwrite global transport
  time signature.

## UI

The unloaded node should visually match `midi.in` / `midi.out`, while the loaded state should behave
like a compact media player:

- Title: `midi.file`
- Main body:
  - no file loaded: prominent "Load MIDI" state
  - file loaded: a compact media-player surface with file name, current position, duration, seek
    rail, and integrated play/pause + stop media controls inside the node body
  - status border: amber for no file, red for parse/playback error, otherwise neutral zinc; playback
    state should be shown by the media controls rather than a bright panel border
- Header controls:
  - settings gear only, so playback does not depend on hard-to-hit floating controls
- Seek affordance:
  - use a keyboard-accessible range input
  - clicking or dragging the rail seeks
  - seeking emits note-offs for active notes before repositioning playback
- Transport controls should feel like media-player glyphs, not separate boxed node action buttons.

Button rules:

- Use lucide icons (`Play`, `Pause`, `Square`, `Settings`, `Upload`, etc.).
- Use shadcn-svelte `Tooltip`, not native `title`.
- Add `cursor-pointer` to all buttons and `disabled:cursor-not-allowed` to disabled buttons.

## Settings Panel

Use the standard floating settings panel style already used by object settings:

- `w-64` panel width unless labels require slightly more space.
- Zinc dark surface, border, compact labels, and small controls.
- Close button in the panel header.
- Settings changes must use `useNodeDataTracker` for undo/redo.

Fields:

- File picker / replace file button.
- Apply tempo to transport toggle.
- Apply time signature toggle.
- Sync to transport toggle.
- Emit meta events toggle.
- Loop toggle.
- Source summary: VFS path, URL, or inline bytes.
- Read-only metadata summary: tracks, duration, PPQ, first tempo, first time signature.

The file picker may live in the settings panel and the empty-node state. Both should call a shared
`loadMidiFile()` function rather than duplicating parsing/persistence logic.

## File Loading

Supported sources:

- File picker on the node.
- Dragging `.mid` or `.midi` files onto the canvas to create a `midi.file` node.
- VFS path from the file browser, linked local folders, or saved local files.
- URL-backed VFS entries for remote MIDI files.
- Incoming bare string URL messages such as `'https://example.com/file.mid'`.
- Incoming bare VFS path messages such as `'user://Samples/file.mid'` or
  `'obj://midi.file-1/file.mid'`.
- Incoming raw MIDI bytes as `ArrayBuffer`, `Uint8Array`, typed arrays, or number arrays.

Implementation should reuse the VFS media loading pattern used by `soundfile~` where practical:

- local file picker/drop stores the file in VFS and writes `vfsPath` to node data;
- URL loads register a URL-backed VFS entry and write `vfsPath` to node data;
- VFS path drops write the dropped path to node data and resolve it through VFS;
- inline `data` loads parse bytes directly and may persist `fileData`.

Canvas drag/drop support is part of v1:

- Add `.mid` and `.midi` MIME/extension handling in VFS path utilities.
- Map MIDI files to `midi.file` in `CanvasDragDropManager`.

## Parser Boundary

Use a small parser adapter rather than binding the component directly to a third-party library.

```typescript
interface ParsedMidiFile {
  name: string;
  ppq: number;
  durationSeconds: number;
  durationTicks: number;
  trackCount: number;
  events: ScheduledMidiFileEvent[];
  tempos: Array<{ tick: number; seconds: number; bpm: number }>;
  timeSignatures: Array<{
    tick: number;
    seconds: number;
    numerator: number;
    denominator: number;
  }>;
}
```

The adapter owns parser-library details and normalizes all messages into Patchies message shapes.
The implementation may use a MIDI parser package such as `@tonejs/midi`, but the spec does not
require component code to depend on that package directly.

## Registration Checklist

Implementation should update:

- `ui/src/objects/midi.file/components/MIDIFileNode.svelte`
- `ui/src/objects/midi.file/midi-file-parser.ts`
- `ui/src/objects/midi.file/midi-file-player.ts`
- `ui/src/objects/midi.file/schema.ts`
- `ui/src/objects/midi.file/prompts.ts`
- `ui/src/lib/nodes/node-types.ts`
- `ui/src/lib/nodes/defaultNodeData.ts`
- `ui/src/lib/extensions/object-packs.ts`
- `ui/src/lib/components/object-browser/get-categorized-objects.ts`
- `ui/src/lib/objects/schemas/index.ts`
- `ui/src/lib/ai/object-descriptions-types.ts`
- `ui/src/lib/ai/object-prompts/index.ts`
- `ui/static/content/objects/midi.file.md`
- `ui/src/lib/vfs/path-utils.ts`
- `ui/src/lib/canvas/CanvasDragDropManager.ts`

## Error Handling

- Invalid or unsupported files show an inline node error and emit
  `{ type: 'error', message: string }` from the output.
- Loading a new file stops the current one and flushes active notes.
- Playback controls are disabled when no valid file is loaded.
- If the browser cannot read the selected file, keep the previous file loaded.

## Testing

Unit tests:

- Parser adapter normalizes notes, CC, program changes, pitch bends, channel pressure, and poly
  pressure into Patchies messages.
- Tempo and time-signature extraction returns first-event metadata for transport application.
- Player schedules events in order from a non-zero seek position.
- Stop/seek/destroy flushes active notes.
- Loop restarts playback and does not duplicate active notes.
- VFS, URL, and inline byte loads all parse into the same normalized file model.

Component tests:

- Empty state opens file picker / settings.
- UI play, pause, stop, and seek call the same playback methods as message commands.
- Settings toggles persist through `updateNodeData` and use undo/redo tracking.
- Dragging `.mid` / `.midi` onto the canvas creates a `midi.file` node with a VFS source.

Manual verification:

- Load a MIDI file and connect `midi.file` to `tone~`; notes play in time.
- Connect `midi.file` to `midi.out`; external hardware receives the file's MIDI events.
- Play, pause, seek, and stop from the node UI.
- Send `play`, `pause`, `seek`, and `stop` messages from another object.
- Enable transport metadata settings and verify playback from `0` applies BPM and time signature.
- Disable transport metadata settings and verify global transport remains unchanged.
- Enable Sync to transport and verify transport play/pause/stop controls the node.
- Stop mid-note and confirm no stuck notes remain.
