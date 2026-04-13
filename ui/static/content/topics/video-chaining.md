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

## Output Screen

Open a separate browser window that displays your visual output fullscreen — perfect for projectors, second monitors, or showing visuals to an audience.

Open it from the command palette: `Cmd+K` → "Open Output Screen".

The output screen stays connected even if you reload either window. Reload the output
screen and it reconnects automatically. Reload the main patch and the output
screen re-connects within a second.

### Exercise — Dual-screen setup

1. Open the output screen (`Cmd+K` → "Open Output Screen")
2. Create a `hydra` object and write a pattern
3. Right-click the hydra object → **Output to background**
4. Drag the output window to a second monitor or projector — your audience sees clean visuals while you keep editing.

## Output Resolution

By default, patches render at 1280×720. You can change this with
**Set Output Size** (`Cmd+K` → "Set Output Size"):

| Input        | What it does                                               |
| ------------ | ---------------------------------------------------------- |
| `1920x1080`  | Set an explicit resolution                                 |
| `720p`       | 1280×720                                                   |
| `1080p`      | 1920×1080                                                  |
| `2k`         | 2560×1440                                                  |
| `4k`         | 3840×2160                                                  |
| `screen`     | Match your current browser window size (without DPR)       |
| `retina`     | Match your window size × device pixel ratio                |
| `2x`         | Multiply your window size by 2 (or `0.5x`, `1.5x`, etc.)   |
| `clear`      | Reset to the default 1280×720                              |

The resolution you choose is **saved with the patch** —
opening it on a different screen keeps that resolution.

Higher resolutions produce sharper output but use more GPU
memory. Use `0.5x` or `screen` for better performance on
complex patches.

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
