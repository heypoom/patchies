# 165. Smplr Sampled Instruments

## Summary

Add sampled-instrument audio objects powered by `smplr`. These objects consume
Patchies MIDI-style messages and trigger high-quality Web Audio sample playback
without reusing the existing `sampler~` or `sequencer` semantics.

The public object model is several focused objects, backed by one shared smplr
runtime:

- `soundfont~`
- `soundfont2~`
- `piano~`
- `epiano~`
- `drum-machine~`
- `mallet~`
- `mellotron~`
- `versilian~`
- `smolken~`

Each object should be thin. Adding another smplr-backed instrument should mostly
mean adding a descriptor, object docs, AI prompt text, and pack registration.

## Goals

- Accept Patchies standard MIDI messages: `noteOn`, `noteOff`,
  `controlChange`, and `programChange`.
- Accept sampler-like trigger messages where they make sense, especially
  timed `bang` messages from audio-lookahead sequencers.
- Route smplr audio through the existing Audio V2 graph as a normal audio
  source/processor with one message inlet and one signal outlet.
- Use the standard SettingsPanel interface for instrument selection and common
  controls.
- Lazy load `smplr`, `soundfont2`, and other heavy parser/runtime code so the
  base Patchies bundle does not pay the cost until these objects are used.
- Reuse implementation aggressively across all smplr-backed objects.

## Non-goals

- Do not replace `sampler~`. `sampler~` remains Patchies' record/load-one-buffer
  sampler with local buffer and loop-point semantics.
- Do not replace `sequencer`. smplr's own sequencer API can be explored later as
  a separate control object if it offers a useful Patchies-native workflow.
- Do not add a custom instrument authoring UI in v1.
- Do not guarantee offline rendering or WAV export in v1.

## Object Shape

All v1 smplr-backed objects share the same port shape:

| #   | Name    | Type    | Description                       |
| --- | ------- | ------- | --------------------------------- |
| 0   | message | message | MIDI and trigger control messages |

| #   | Name | Type   | Description       |
| --- | ---- | ------ | ----------------- |
| 0   | out  | signal | Instrument output |

The objects belong primarily in the Music and Audio Samples/Buffers packs, with
MIDI discoverability where useful:

- `soundfont~`, `soundfont2~`, and `drum-machine~` should be easy to find from
  MIDI workflows.
- `piano~`, `epiano~`, `mallet~`, `mellotron~`, `versilian~`, and `smolken~`
  should be easy to find from music/instrument workflows.

## Shared Descriptor Architecture

Each object is described by a smplr instrument descriptor. The Svelte component
for each object should be minimal, ideally equivalent to rendering a shared
layout with its descriptor:

```svelte
<SmplrNodeLayout descriptor={soundfontDescriptor} />
```

Descriptors define object-specific data:

```ts
interface SmplrInstrumentDescriptor {
  type: string;
  title: string;
  description: string;
  defaultSettings: Record<string, unknown>;
  settingsSchema: SettingsSchema;
  defaultBangNote: number | string;
  defaultVelocity: number;
  getDisplayName(settings: Record<string, unknown>): string;
  loadInstrument(args: {
    module: SmplrModule;
    context: AudioContext;
    destination: AudioNode;
    settings: Record<string, unknown>;
    onLoadProgress: (progress: SmplrLoadStatus) => void;
  }): Promise<SmplrInstrument>;
  reloadsOnSettings: string[];
  handleProgramChange?: (
    program: number,
    settings: Record<string, unknown>,
  ) => Record<string, unknown> | null;
}
```

> **Note**: This is a simplified view for documentation purposes. For the authoritative descriptor interface, see `ui/src/objects/smplr/descriptors.ts`.

The exact TypeScript names can change, but the boundary should stay the same:
descriptor files know which smplr factory to call, while the shared runtime owns
message handling, scheduling, lifecycle, and output routing.

## Shared Runtime

The shared Audio V2 implementation should:

- create a stable output node immediately so graph connections can be made before
  samples finish loading;
- lazy import `smplr` only when a smplr object is created;
- create the selected smplr instrument with `destination` routed into the
  object's output node;
- expose loading progress and errors to the shared Svelte layout;
- dispose the smplr instance when the Patchies node is destroyed or reloaded;
- guard concurrent reloads so only the latest settings change commits;
- log unsupported or malformed messages through Patchies' existing debug/logging
  path instead of failing silently for non-trivial cases.

The shared Svelte layout should own common display state:

- title and current instrument name;
- load progress;
- load/error state;
- compact status text;
- standard SettingsPanel values and schema;
- standard message and audio handles.

## Lazy Loading

Lazy loading is a core requirement because smplr and sample/parser code may be
large.

- Add `smplr` and `soundfont2` as dependencies, but keep both out of the initial
  application chunk.
- Do not statically import `smplr` from general application entry points.
- Descriptors or runtime should use dynamic `import("smplr")`.
- `soundfont2~` should lazy load the `soundfont2` parser only when loading an
  `.sf2` source:

```ts
const { SoundFont2 } = await import("soundfont2");
```

- The `soundfont2` parser should be isolated behind a small adapter. The current
  package is pre-1.0 and documents `new SoundFont2(new Uint8Array(buffer))`, so
  the adapter gives Patchies one place to adjust if the API changes.
- Instrument names that are available synchronously from smplr helper functions
  can be imported with the smplr chunk. Async catalogs such as Versilian should
  be fetched only when the matching object/settings panel needs them.

## Supported Messages

All smplr-backed objects accept the common message surface:

```ts
number
{ type: 'bang', time?: number, value?: number, offset?: number, duration?: number }
{ type: 'noteOn', note: number | string, velocity?: number, time?: number, duration?: number }
{ type: 'noteOff', note: number | string, time?: number }
{ type: 'controlChange', control: number, value: number }
{ type: 'programChange', program: number }
{ type: 'setGain', value: number }
{ type: 'setDetune', value: number }
{ type: 'setReverse', value: boolean }
{ type: 'stop', time?: number }
```

Message behavior:

- `noteOn` calls `instrument.start({ note, velocity, time, duration })`.
- `noteOn` with velocity `0` behaves like `noteOff` for the same note.
- `noteOff` calls `instrument.stop({ stopId: note, time })`.
- `controlChange` calls `instrument.setCC(control, value)`.
- `programChange` delegates to the descriptor's program-change handler.
- `setGain` maps to `instrument.output.volume` using smplr's MIDI-scale volume
  convention where possible.
- `setDetune` calls `instrument.setDetune(value)`.
- `setReverse` calls `instrument.setReverse(value)`.
- `stop` calls `instrument.stop()` immediately or at the provided time when the
  smplr API supports a scheduled stop target.
- A bare number triggers the descriptor's `defaultBangNote` immediately, mapping
  the number to trigger intensity like `sampler~`.
- `bang` triggers the descriptor's `defaultBangNote`; `time` and `duration` are
  passed through.
- `bang.value` maps to velocity. Values between `0` and `1` are treated like
  normalized sequencer velocity and scaled to `0..127`; values above `1` are
  clamped to MIDI velocity range.
- `bang.offset` is accepted for compatibility with `sampler~`, but smplr's
  public note event does not expose an obvious per-note offset field. In v1,
  ignore it with a debug log unless the selected smplr instrument exposes a
  reliable offset-compatible option.

The message contract intentionally mirrors `sampler~` where practical so
sequencer/audio-lookahead patches can swap between local samples and smplr
instruments with minimal glue.

## Scheduling

Incoming `time` values are absolute `AudioContext.currentTime` timestamps. The
shared runtime passes them directly to smplr `start` and `stop` calls.

This matches existing Patchies scheduled payloads from:

- `sequencer` audio-lookahead output;
- `midi.file` playback output;
- future piano-roll or MIDI-recording objects.

The smplr objects should not own their own musical clock in v1. They are
scheduled by upstream Patchies message producers.

## Settings

Use the standard SettingsPanel schema and persist settings in node data.

Large instrument lists should use a searchable SettingsPanel `combobox` field,
not the chip-style `select` field. `select` remains appropriate for short
closed sets such as `kit`. `soundfont2~` starts with an empty combobox until the
SF2 file exposes instrument names, then the node updates the settings schema to
use those names.

Common fields:

| Setting       | Type    | Notes                                                                     |
| ------------- | ------- | ------------------------------------------------------------------------- |
| `volume`      | slider  | MIDI-scale `0..127`, default `100`                                        |
| `velocity`    | slider  | Default note velocity `0..127`                                            |
| `pan`         | slider  | Stereo pan `-1..1`                                                        |
| `defaultNote` | string  | Note used by `bang` and number input; parse numeric strings as MIDI notes |
| `detune`      | number  | Cents for future notes                                                    |
| `reverse`     | boolean | Reverse future notes when smplr supports it                               |

Descriptor-specific fields:

| Object          | Fields                                     |
| --------------- | ------------------------------------------ |
| `soundfont~`    | `instrument`, `kit`, `loadLoopData`        |
| `soundfont2~`   | `url`, `instrument`                        |
| `piano~`        | `decayTime`; later `notesToLoad` if needed |
| `epiano~`       | `instrument`                               |
| `drum-machine~` | `instrument`                               |
| `mallet~`       | `instrument`                               |
| `mellotron~`    | `instrument`                               |
| `versilian~`    | `instrument`                               |
| `smolken~`      | `instrument`                               |

Settings listed in `reloadsOnSettings` recreate/reload the smplr instrument.
Live settings such as volume, detune, reverse, and pan should update the current
instance where smplr supports mutation without refetching samples.

Any new node option added to component-owned node data must use
`useNodeDataTracker` for undo/redo when it is edited from node UI. SettingsPanel
changes use the existing settings persistence/update flow.

## Program Change Mapping

`programChange` maps to a new instrument selection when the descriptor can
provide a stable ordered program list.

Required v1 mappings:

- `soundfont~`: map General MIDI program numbers to smplr soundfont instrument
  names.
- `soundfont2~`: map program numbers to parsed SF2 presets/instruments where
  the file exposes bank/program metadata. If the parser only exposes an ordered
  instrument list, use that order and document the limitation.

Other objects may opt in only when the mapping is stable and musically clear.
Otherwise, ignore the message with a debug log. Do not invent General MIDI
semantics for non-GM instrument families.

## soundfont2 Parser

`soundfont2~` uses the `soundfont2` package as the SF2 parser. The parser is
lazy loaded and integrated via a closure-based adapter pattern that makes the
implementation API-evolution resistant:

```ts
const { SoundFont2 } = await import("soundfont2");
const instrument = module.Soundfont2(context, {
  ...commonOptions(destination, settings, onLoadProgress),
  url,
  createSoundfont: (data) => new SoundFont2(data)
});
```

Rather than calling `new SoundFont2()` directly in descriptor code, the parser
construction is wrapped in a `createSoundfont` callback passed to
`module.Soundfont2()`. This indirection layer protects against future API
changes in the `soundfont2` package. If the parser shape differs from smplr's
internal expectations, the adapter callback owns that translation.

See `ui/src/objects/smplr/descriptors.ts` for the complete soundfont2~
descriptor implementation.

## Documentation And AI Prompts

Each v1 object needs:

- object schema;
- object browser metadata;
- object docs in `ui/static/content/objects/`;
- AI prompt entry and registration;
- pack registration;
- default node data.

Docs should emphasize the shared MIDI contract and link related objects:

- `midi.in`
- `midi.file`
- `sequencer`
- `sampler~`
- `out~`

The AI prompts should explain that smplr objects are MIDI-consuming instruments,
not custom sample-recording nodes.

## Testing

Unit-test shared behavior through public APIs and observable effects rather than
source-shape assertions.

Focused tests should cover:

- `noteOn` forwards note, velocity, time, and duration to the active instrument;
- velocity `0` note-on becomes note-off;
- `noteOff` calls targeted stop with scheduled time;
- `controlChange` calls `setCC`;
- `programChange` updates settings for `soundfont~` and `soundfont2~` mappings;
- `bang` and number inputs map to descriptor default notes and velocities;
- settings changes reload only when descriptor says they should;
- stale async loads do not replace a newer instrument;
- destroy disposes the active instrument and disconnects output.

Integration/manual checks:

- connect `midi.file -> soundfont~ -> out~`;
- connect `sequencer` in MIDI/audio-lookahead mode to `drum-machine~`;
- use `midi.in` or a virtual MIDI keyboard to play `piano~`;
- load an SF2 URL into `soundfont2~` and switch instruments via settings and
  `programChange`;
- verify the initial app bundle does not include smplr/soundfont2 until a smplr
  object is used.
