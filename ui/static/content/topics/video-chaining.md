# Video Chaining

You can chain visual objects together to create video effects and compositions, by using the output of a visual object as an input to another.

![Video chain example](/content/images/patchies-video-chain.png)

The above example creates a `hydra` object and a `glsl` object that produces a pattern, and connects them to a `hydra` object that subtracts the two visuals together using `src(s0).sub(s1).out(o0)`.

This is very similar to _shader graphs_ in programs like TouchDesigner, Unity, Blender, Godot and Substance Designer.

## Getting Started

Try out the presets to get started quickly:

- **Pipe presets** (e.g. `pipe.hydra`, `pipe.gl`) simply pass the visual through without any changes. This is the best starting point for chaining.
- **Hydra presets** perform image operations (e.g. `diff.hydra`, `add.hydra`, `sub.hydra`) on two visual inputs.
- Check out the docs of each visual object for more fun presets you can use.

## How Video Chaining Works

- Visual objects have orange inlets and/or outlets (circles on the top and bottom)
  - **Inlets** provide visual input to the object
  - **Outlets** output visual from the object

- In `hydra`, call `setVideoCount(ins = 1, outs = 1)` to specify how many visual inlets and outlets you want

- For `glsl` objects, dynamically create sampler2D uniforms to add video inputs

- Connect the orange outlet of a source object to the orange inlet of a target object
  - Try connecting `p5` → `pipe.hydra` → `pipe.gl` to see visual passthrough in action

## See Also

- [p5](/docs/objects/p5) - P5.js sketches
- [hydra](/docs/objects/hydra) - Hydra video synthesizer
- [glsl](/docs/objects/glsl) - GLSL shaders
- [Audio Chaining](/docs/audio-chaining)
- [Connection Rules](/docs/connection-rules)
