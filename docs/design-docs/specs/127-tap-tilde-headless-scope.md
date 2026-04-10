# 127. tap~ — Headless Oscilloscope

## Overview

`scope~` is a self-contained visual node — its canvas renders on the main thread
for responsiveness, but it has no outlet. This makes it impossible to route waveform
data into video nodes (GLSL, Hydra, Three.js, etc.) or do any downstream processing.

`tap~` solves this by separating the DSP from the display. It reuses the same
`scope.processor` worklet with the same trigger logic (rising zero-crossing, maxWait
fallback), but instead of rendering, it forwards each captured buffer as a message on
its outlet. Users pair it with canvas presets or any other downstream node.

The existing `scope~` visual node is **unchanged**.

---

## tap~ Object

### Inlets

| # | Name | Type | Description |
|---|------|------|-------------|
| 0 | `in` | signal | Audio input (or X axis in XY mode) |
| 1 | `y` | signal | Y axis signal (XY mode only, visible when mode = xy) |

### Outlets

| # | Name | Type | Description |
|---|------|------|-------------|
| 0 | `out` | message | Waveform buffer or XY pair, emitted each captured frame |

### Output message format

**Waveform mode:**
```
Float32Array  (length = bufferSize)
```

**XY mode:**
```
{ x: Float32Array, y: Float32Array }  (each length = bufferSize)
```

The buffer is trigger-synced (rising zero-crossing on the X channel) — the same
guarantee as `scope~`.

### Settings (same as scope~)

Exposed via the same `ScopeSettings.svelte` panel:

| Setting | Range | Default | Notes |
|---------|-------|---------|-------|
| Samples (bufferSize) | 64–2048 | 512 | Controls buffer length sent per frame |
| Mode | waveform / xy | waveform | Switches inlet count and output shape |
| Refresh (fps) | 0–120 | 0 (max) | Throttles how often the worklet sends |

X Scale, Y Scale, Plot Type, Decay, and Unipolar are **not** settings of `tap~` —
they are rendering concerns owned by whichever canvas preset receives the data.

The settings panel reuses `ScopeSettings.svelte` with only the relevant controls shown
(Samples, Mode, Refresh + the Advanced accordion for Mode). X/Y scale, plot type,
decay, and unipolar are hidden.

---

## Canvas Presets

Two canvas presets ship alongside `tap~`. They are standalone visualizers that
accept the buffer messages from `tap~` and render them.

### scope.canvas

Renders a triggered waveform. Equivalent to `scope~` in waveform mode.

**Inlets (via `recv`):**

| Message | Type | Description |
|---------|------|-------------|
| buffer | `Float32Array` | Waveform data from `tap~` |
| xScale | number | Horizontal zoom (default 1) |
| yScale | number | Vertical zoom (default 1) |
| plotType | `'line'`\|`'point'`\|`'bezier'` | Drawing style (default `'line'`) |
| decay | number 0.01–1 | Phosphor persistence (1 = off, default 1) |
| unipolar | boolean | Map range to 0–1 instead of -1–1 (default false) |

Parameters arrive as keyed messages: `{ xScale: 2 }`, `{ plotType: 'bezier' }`, etc.
The waveform buffer is detected by `ArrayBuffer.isView(m)`.

**No outlets.**

Drawing code is lifted directly from `ScopeNode.svelte:148–217` (`drawWaveform`).

### lissajous.canvas

Renders an XY/Lissajous plot. Equivalent to `scope~` in XY mode.

**Inlets (via `recv`):**

| Message | Type | Description |
|---------|------|-------------|
| data | `{ x: Float32Array, y: Float32Array }` | XY pair from `tap~` in XY mode |
| xScale | number | Horizontal zoom (default 1) |
| yScale | number | Vertical zoom (default 1) |
| plotType | `'line'`\|`'point'`\|`'bezier'` | Drawing style (default `'line'`) |
| decay | number 0.01–1 | Phosphor persistence (default 1) |

Drawing code is lifted directly from `ScopeNode.svelte:219–287` (`drawLissajous`).

---

## Architecture

### The bridge problem

`ScopeAudioNode` stores `latestWaveform` / `latestXY` for polling by the Svelte
component. `tap~` needs the opposite: push each buffer through the **message system**
as soon as the worklet sends it.

`tap~` is implemented as a **text object** (`TextObjectV2`) that owns its own
`AudioWorkletNode` internally — it does not go through `AudioService.createNode()`.
Instead, on `create()`:

1. Ensures the `scope~` worklet module is loaded (reuse `ScopeAudioNode`'s module
   registration to avoid double-loading the same worklet).
2. Creates an `AudioWorkletNode` directly on the `AudioContext`.
3. Sets `port.onmessage` to call `this.context.send(msg)` for each buffer received.

This mirrors how `ScopeAudioNode` works but routes output to the message system
instead of storing it.

### Audio connections

Because `tap~` is a text object, `AudioService` won't wire up its audio connections
automatically. It needs to implement `connectFrom()` (same logic as `ScopeAudioNode`)
and register itself so the audio routing system can find its `AudioWorkletNode`.

Pattern to follow: examine how hybrid audio/message nodes are handled in the codebase
(e.g. `snapshot~`). If no clean pattern exists yet, `tap~` may need to expose its
`audioNode` reference and hook into `AudioService` manually.

> **Open question for implementation:** confirm the exact mechanism by which a text
> object can participate in audio graph routing. This may require a small addition to
> AudioService or a new interface.

---

## Files to Create

```
ui/src/lib/audio/v2/nodes/TapAudioNode.ts          # AudioNodeV2 with message forwarding
ui/src/lib/objects/v2/nodes/TapTildeObject.ts       # TextObjectV2 wrapper (owns audio node)
ui/src/lib/presets/builtin/canvas.presets/scope.ts  # scope.canvas preset
ui/src/lib/presets/builtin/canvas.presets/lissajous.ts  # lissajous.canvas preset
ui/static/content/objects/tap~.md                   # Object documentation
```

## Files to Modify

```
ui/src/lib/audio/v2/nodes/index.ts                  # Register TapAudioNode
ui/src/lib/objects/v2/nodes/index.ts                # Register TapTildeObject
ui/src/lib/extensions/object-packs.ts               # Add tap~ to Audio pack
ui/src/lib/presets/builtin/canvas.presets/index.ts  # Export scope.canvas + lissajous.canvas
ui/src/lib/extensions/preset-packs.ts               # Add presets to pack
ui/src/lib/components/settings/ScopeSettings.svelte # Add props to hide irrelevant controls
```

---

## Example Patch

```
[osc~ 440] → [tap~] → [scope.canvas]   # basic waveform display via video
                     → [glsl~]          # route waveform into GLSL shader as uniform
```

```
[osc~ 440] ─┐
[osc~ 220] ─┘ [tap~ mode=xy] → [lissajous.canvas]
```

---

## Out of Scope

- `tap~` does not render anything itself — no canvas, no display.
- The canvas presets do not emit data — they are sinks.
- `scope~` (visual) is unchanged.
- No changes to `scope.processor.ts` — it is shared as-is.
