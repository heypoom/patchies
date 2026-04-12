# Video Chaining

Visual objects connect together to form a video pipeline — the output of one object feeds into the input of the next, letting you layer, blend, and transform visuals in real time.

![Video chain example](/content/images/patchies-video-chain.png)

In this example, a [hydra](/docs/objects/hydra) object and a [glsl](/docs/objects/glsl) object each produce a pattern. They feed into a third hydra object which subtracts them together using `src(s0).sub(s1).out(o0)`.

This is similar to shader graphs in TouchDesigner, Unity, Blender, and Substance Designer.

## How It Works

Visual objects have **orange** inlets and outlets (circles on the top and bottom of the node):

- **Orange inlet** — accepts a video frame as input
- **Orange outlet** — outputs a video frame to the next object

Connect orange outlet → orange inlet to chain them:

```text
[p5] → [hydra>] → [glsl>] → [bg.out]
```

To hear — er, *see* — anything, connect the final object to `bg.out` or use **Output to Background**.

## Try It

### Exercise — Visual passthrough

1. Create a `p5` object and write something that draws to the canvas
2. Create a `hydra>` preset (`Enter` → search `hydra>`)
3. Connect the orange outlet of `p5` to the orange inlet of `hydra>`
4. Connect `hydra>` to `bg.out` — the p5 sketch appears as the background

### Exercise — Blend two visuals

1. Create two visual objects (e.g. `p5` and `glsl`)
2. Create a `sub.hydra` preset — it has two orange inlets
3. Connect both visual objects to the two inlets of `sub.hydra`
4. Connect `sub.hydra` to `bg.out` — the two visuals are subtracted together

## Getting Started with Presets

The preset library has ready-made building blocks for video chaining. Enable them via the [Preset Packs](/docs/manage-packs) sidebar:

- **`hydra>`, `glsl>`, `regl>`, `swgl>`, `three>`** — pass video through unchanged; the simplest starting point for chaining
- **`diff.hydra`, `add.hydra`, `sub.hydra`** — blend two video inputs with Hydra
- Check the [hydra](/docs/objects/hydra) and [glsl](/docs/objects/glsl) docs for more preset ideas

## Output to Background

Right-click any visual object (or use its **···** menu) and choose **Output to background** to make it the fullscreen output. This overrides any `bg.out` connection.

- Click **Output to background** again on the same object to clear the override
- Switching to a different object replaces the current output — only one at a time
- This is great for live performance; it is not saved across sessions

## Output Resolution

By default, patches render at your screen's native resolution,
including Retina scaling. You can change this with the
**Set Output Size** command (`Cmd+K` → "Set Output Size"):

| Input | What it does |
| --- | --- |
| `screen` | Use your current screen's native resolution |
| `2x` | Multiply your screen size by 2 (or `0.5x`, `1.5x`, etc.) |
| `1920x1080` | Set an explicit resolution |

The resolution you choose is **saved with the patch**.
If you type `screen` on a 1440×900 Retina display, it
saves `2880×1800` — opening the patch on a different screen
keeps that resolution. Type `screen` again to re-adapt to
a new display.

Higher resolutions produce sharper output but use more GPU
memory. Use `0.5x` for better performance on complex patches.

## Wireless Video Routing

Route video across the patch without cables using [`send.vdo <channel>`](/docs/objects/send.vdo) and [`recv.vdo <channel>`](/docs/objects/recv.vdo):

```text
[p5] → [send.vdo main]          [recv.vdo main] → [bg.out]
```

Useful for keeping large patches readable by removing long-distance orange cables.

## Performance

Objects on the [rendering pipeline](/docs/rendering-pipeline) are significantly faster than main-thread objects — they avoid expensive pixel copies between GPU and CPU.

For high-performance video chaining, prefer:

- [canvas](/docs/objects/canvas) over `canvas.dom`
- [three](/docs/objects/three) over `three.dom`
- [textmode](/docs/objects/textmode) over `textmode.dom`

## See Also

- [hydra](/docs/objects/hydra) — Hydra video synthesizer
- [glsl](/docs/objects/glsl) — GLSL shaders
- [canvas](/docs/objects/canvas) — Offscreen canvas (rendering pipeline)
- [send.vdo](/docs/objects/send.vdo) — Send video to a named channel
- [recv.vdo](/docs/objects/recv.vdo) — Receive video from a named channel
- [Audio Chaining](/docs/audio-chaining)
- [Data Types](/docs/data-types)
- [Rendering Pipeline](/docs/rendering-pipeline)
