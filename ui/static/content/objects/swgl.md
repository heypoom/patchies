The `swgl` object creates a [SwissGL](https://github.com/google/swissgl) shader.

SwissGL is a wrapper for WebGL2 that lets you create shaders and 3D
graphics in very few lines of code.

## Getting Started

Call `glsl()` once during setup to compile your shader, then call the 
returned function inside `render`:

```javascript
const shader = await glsl({
  Clear: 0,
  Mesh: [10, 10],
  VP: `XY*0.8+sin(t+XY.yx*2.0)*0.2,0,1`,
  FP: `UV,0.5,1`,
});

function render({ t }) {
  shader({ t });
}
```

`glsl()` is always async — always `await` it during setup, never inside `render`.

## Available Parameters

The `render` function receives an object with:

- `t` - time in seconds
- `frame` - current frame number

## Float Texture Format

By default, the output texture uses 8-bit RGBA (values clamped to 0–1). For GPGPU or HDR, add a format directive as a comment:

```javascript
// @format rgba32f

const shader = await glsl({
  FP: `vec4(5.0, -2.0, 100.0, 1.0)`,
});

function render({ t }) {
  shader({ t });
}
```

You can also use the JS API: `setTextureFormat('rgba32f')`.

Formats: `rgba8` (default), `rgba16f` (half float), `rgba32f` (full float). See [glsl docs](/docs/objects/glsl#float-texture-format) for details.

## Limitations

Mouse and camera controls are not yet hooked up to SwissGL in Patchies.
Some examples from the SwissGL demo site won't work. PRs are welcome!

## Resources

- [SwissGL GitHub](https://github.com/google/swissgl) - source code
- [SwissGL API docs](https://github.com/google/swissgl/blob/main/docs/API.md) - full reference
- [SwissGL examples](https://google.github.io/swissgl) - interactive demos

## See Also

- [GLSL Imports](/docs/glsl-imports) - import functions from lygia and other GLSL libraries
- [glsl](/docs/objects/glsl) - standard GLSL shaders
- [hydra](/docs/objects/hydra) - live coding visuals
- [p5](/docs/objects/p5) - creative coding with P5.js
