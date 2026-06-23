# 127. tap~ — Headless Oscilloscope

## Overview

`scope~` is a self-contained visual node — its canvas renders on the main thread
for responsiveness, but it has no outlet. This makes it impossible to route waveform
data into video nodes (GLSL, Hydra, Three.js, etc.) or do any downstream processing.

`tap~` solves this by separating the DSP from the display. It captures audio
frames in a native DSP worklet and forwards each captured buffer as a message on
its outlet. Users pair it with canvas presets or any other downstream node.

The existing `scope~` visual node is **unchanged**.

---

## tap~ Object

### Inlets

| #   | Name | Type   | Description                                          |
| --- | ---- | ------ | ---------------------------------------------------- |
| 0   | `in` | signal | Audio input (or X axis in XY mode)                   |
| 1   | `y`  | signal | Y axis signal (XY mode only, visible when mode = xy) |

### Outlets

| #   | Name  | Type    | Description                                             |
| --- | ----- | ------- | ------------------------------------------------------- |
| 0   | `out` | message | Waveform buffer or XY pair, emitted each captured frame |

### Output message format

**Waveform mode:**

```
Float32Array  (length = bufferSize)
```

**XY mode:**

```
{ x: Float32Array, y: Float32Array }  (each length = bufferSize)
```

When zero-crossing detection is enabled, the buffer is trigger-synced (rising
zero-crossing on the X channel) with the same stability as `scope~`. When it is
disabled, `tap~` continuously captures frames as soon as the FPS limit allows.

### Settings

Exposed via the `TapSettings.svelte` panel:

| Setting              | Range     | Default | Notes                                            |
| -------------------- | --------- | ------- | ------------------------------------------------ |
| Samples (bufferSize) | 64–2048   | 512     | Controls buffer length sent per frame            |
| Mode                 | wave / xy | wave    | Switches inlet count and output shape            |
| FPS Limit (fps)      | 0–120     | 0 (max) | Throttles how often the worklet captures         |
| Zero Crossing        | on / off  | on      | Starts captures on rising zero-crossings when on |

X Scale, Y Scale, Plot Type, Decay, and Unipolar are **not** settings of `tap~` —
they are rendering concerns owned by whichever canvas preset receives the data.

The node UI itself stays compact and displays only the object name and sample
count, for example `tap~ 512`. Mode and FPS are configured from settings, not
shown on the node face.

---

## Canvas Presets

Two canvas presets ship alongside `tap~`. They are standalone visualizers that
accept the buffer messages from `tap~` and render them.

### scope.canvas

Renders a triggered waveform. Equivalent to `scope~` in waveform mode.

**Input (via `recv`):**

The waveform buffer is detected by `ArrayBuffer.isView(m)` and expects a
`Float32Array` from `tap~`.

**Settings:**

| Setting         | Type                            | Description                                      |
| --------------- | ------------------------------- | ------------------------------------------------ |
| xScale          | number                          | Horizontal zoom (default 1)                      |
| yScale          | number                          | Vertical zoom (default 1)                        |
| plotType        | `'line'`\|`'point'`\|`'bezier'` | Drawing style (default `'line'`)                 |
| decay           | number 0.01–1                   | Phosphor persistence (1 = off, default 1)        |
| unipolar        | boolean                         | Map range to 0–1 instead of -1–1 (default false) |
| foregroundColor | CSS color                       | Waveform color (default `#22c55e`)               |
| backgroundColor | CSS color                       | Clear/fade color (default `#080809`)             |

**No outlets.**

Drawing code is lifted directly from `ScopeNode.svelte:148–217` (`drawWaveform`).

### scope-xy.canvas

Renders an XY/Lissajous plot. Equivalent to `scope~` in XY mode.

**Input (via `recv`):**

The XY data expects a `{ type: 'xy', x: Float32Array, y: Float32Array }` message
from `tap~` in XY mode.

**Settings:**

| Setting         | Type                            | Description                          |
| --------------- | ------------------------------- | ------------------------------------ |
| xScale          | number                          | Horizontal zoom (default 1)          |
| yScale          | number                          | Vertical zoom (default 1)            |
| plotType        | `'line'`\|`'point'`\|`'bezier'` | Drawing style (default `'line'`)     |
| decay           | number 0.01–1                   | Phosphor persistence (default 1)     |
| foregroundColor | CSS color                       | Plot color (default `#22c55e`)       |
| backgroundColor | CSS color                       | Clear/fade color (default `#080809`) |

Drawing code is lifted directly from `ScopeNode.svelte:219–287` (`drawLissajous`).

---

## Architecture

### The bridge problem

`ScopeAudioNode` stores `latestWaveform` / `latestXY` for polling by the Svelte
component. `tap~` needs the opposite: push each buffer through the **message system**
as soon as the worklet sends it.

`tap~` is implemented as a dedicated Svelte node component backed by the native
DSP audio node registered with `AudioService`. The component owns the compact UI
and settings panel, while the native DSP worklet captures buffers and forwards
them through `MessageSystem`.

### Audio connections

Because `tap~` is a dedicated node type, `AudioService` wires its audio inlets the
same way it wires other native DSP nodes. The processor has two audio inputs and
one message outlet.

---

## Files to Create

```
ui/src/lib/presets/builtin/canvas.presets/scope.ts  # scope.canvas preset
ui/src/lib/presets/builtin/canvas.presets/lissajous.ts  # scope-xy.canvas preset
ui/static/content/objects/tap~.md                   # Object documentation
```

## Files to Modify

```
ui/src/lib/components/nodes/TapTildeNode.svelte     # Compact UI node
ui/src/lib/components/settings/TapSettings.svelte   # tap~ settings panel
ui/src/lib/audio/native-dsp/nodes/tap.node.ts       # Native DSP node metadata
ui/src/lib/audio/native-dsp/processors/tap.processor.ts # Capture processor
ui/src/lib/extensions/object-packs.ts               # Add tap~ to Audio pack
ui/src/lib/presets/builtin/canvas.presets/index.ts  # Export scope.canvas + scope-xy.canvas
ui/src/lib/extensions/preset-packs.ts               # Add presets to pack
ui/src/lib/migration/migrations                     # Migrate old text-object tap~
```

---

## Example Patch

```
[osc~ 440] → [tap~] → [scope.canvas]   # basic waveform display via video
                     → [glsl~]          # route waveform into GLSL shader as uniform
```

```
[osc~ 440] ─┐
[osc~ 220] ─┘ [tap~ mode=xy] → [scope-xy.canvas]
```

---

## Out of Scope

- `tap~` does not render waveforms itself — no canvas, no display.
- The canvas presets do not emit data — they are sinks.
- `scope~` (visual) is unchanged.
- No changes to `scope.processor.ts` — it is shared as-is.
