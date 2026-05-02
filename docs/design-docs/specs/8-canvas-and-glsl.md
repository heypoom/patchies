# 8. Canvas and GLSL objects

Let's add two objects that should be almost identical to the `p5` component:

- `canvas` - A JavaScript canvas that can be used to draw graphics using the HTML5 Canvas API. Expose the `CanvasRenderingContext2D` as `canvas` variable.
- `glsl` - A WebGL canvas that can be used to draw graphics using GLSL shaders. Accepts a GLSL shader code with pre-defined uniforms same as ShaderToy.
  - It should expose the same uniforms as ShaderToy for maximum compatibility, such as `iResolution`, `iTime`, `iMouse`, etc.
  - Per the [Visual Chaining](7-visual-chaining.md) spec, we should eventually allow `glsl` to be used as a source for other blocks (e.g. `p5`, `hydra`) and vice versa.
  - Custom `sampler2D` uniforms create video inlets at their position in the full uniform list. Texture binding must use that same full uniform index, so sampler uniforms work whether they are declared before or after numeric uniforms.
