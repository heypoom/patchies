# Video Chaining

You can chain visual objects together to create video effects and compositions, by using the output of a visual object as an input to another.

![Video chain example](/content/images/patchies-video-chain.png)

The above example creates a [hydra](/docs/objects/hydra) object and a [glsl](/docs/objects/hydra) object that produces a pattern, and connects them to another hydra object which subtracts the two visuals together using `src(s0).sub(s1).out(o0)`.

This is similar to _shader graphs_ in programs like TouchDesigner, Unity, Blender, Godot and Substance Designer.

## Getting Started

Try out the presets to get started. Enable them in the [preset packs](/docs/manage-packs) sidebar menu.

- **Pipe presets** (e.g. `pipe.hydra`, `pipe.gl`) passes the visual through without any changes. This is the best starting point for chaining.
- **Hydra presets** performs image operations (e.g. `diff.hydra`, `add.hydra`, `sub.hydra`) on two visual inputs.
- Check out the docs of [hydra](/docs/objects/hydra) and [glsl](/docs/objects/glsl) for more fun presets you can use.

## How Video Chaining Works

- Visual objects have orange inlets and/or outlets (circles on the top and bottom)
  - **Inlets** provide visual input to the object
  - **Outlets** output visual from the object

- In hydra, call `setVideoCount(ins = 1, outs = 1)` to specify how many visual inlets and outlets you want

- For glsl objects, dynamically create [sampler2D uniforms](https://thebookofshaders.com/glossary/?search=texture2D) to add video inputs

- Connect the orange outlet of a source object to the orange inlet of a target object
  - Try connecting `p5` → `pipe.hydra` → `pipe.gl` to see visual passthrough in action

## Wireless Video Routing

Connect distant visual objects without cables using named channels.

Create [`send.vdo <channel>`](/docs/objects/send.vdo) and [`recv.vdo <channel>`](/docs/objects/recv.vdo) objects anywhere in your patch. Video frames sent to `send.vdo` appear at matching `recv.vdo` outlets:

```text
[p5] → [send.vdo main]     ...     [recv.vdo main] → [bg.out]
```

This is useful for organizing complex video routing or sending video across different parts of a large patch.

## See Also

- [hydra](/docs/objects/hydra) - Hydra video synthesizer
- [glsl](/docs/objects/glsl) - GLSL shaders
- [canvas](/docs/objects/canvas) - HTML5 offscreen canvas
- [send.vdo](/docs/objects/send.vdo) - Send video to named channel
- [recv.vdo](/docs/objects/recv.vdo) - Receive video from named channel
- [Audio Chaining](/docs/audio-chaining)
- [Connection Rules](/docs/connection-rules)
