The `swgl` object creates a [SwissGL](https://github.com/google/swissgl) shader. SwissGL is a wrapper for WebGL2 that lets you create shaders and 3D graphics in very few lines of code.

## Getting Started

Use the `render` function with the `glsl` helper:

```javascript
function render({ t }) {
  glsl({
    t,
    Mesh: [10, 10],
    VP: `XY*0.8+sin(t+XY.yx*2.0)*0.2,0,1`,
    FP: `UV,0.5,1`,
  });
}
```

## Available Parameters

The `render` function receives an object with:

- `t` - time in seconds
- `frame` - current frame number

## Limitations

Mouse and camera controls are not yet hooked up to SwissGL in Patchies. Some examples from the SwissGL demo site won't work. PRs are welcome!

## Resources

- [SwissGL GitHub](https://github.com/google/swissgl) - source code
- [SwissGL API docs](https://github.com/google/swissgl/blob/main/docs/API.md) - full reference
- [SwissGL examples](https://google.github.io/swissgl) - interactive demos

## See Also

- [glsl](/docs/objects/glsl) - standard GLSL shaders
- [hydra](/docs/objects/hydra) - live coding visuals
- [p5](/docs/objects/p5) - creative coding with P5.js
