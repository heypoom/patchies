The `shaderpark` object runs Shader Park/Sculpt code inside Patchies' render
pipeline. It is useful for concise SDF and raymarched procedural 3D visuals.

## Getting Started

Write Shader Park statements directly in the editor:

```javascript
sphere(0.35);
color(vec3(0.2, 0.6, 1.0));
shine(0.6);
rotateY(time * 0.5);
```

The object compiles that code to GLSL with `shader-park-core`, then renders it
into the node's FBO. It does not create a separate canvas or render loop.

## Video Chaining

The object shows video inlets only for sampler uniforms referenced in the code.
Patchies binds these names to upstream textures:

- `iChannel0`
- `iChannel1`
- `iChannel2`
- `iChannel3`

You can reference these from GLSL helper functions created with Shader Park's
`glslFunc` or `glslFuncES3` APIs. The connected textures stay in the shared
WebGL render pipeline.

## Settings

Shader Park `input()` calls create persistent numeric settings. `input2D()`
calls create persistent two-axis vector settings.

```javascript
let radius = input(0.35, 0.1, 1.0);
let offset = input2D(0, 0);

sphere(radius);
move(offset.x, offset.y, 0);
```

The generated message inlets can also receive `run` and `setCode` control
messages, so Shader Park does not expose a separate control inlet.

## Mouse

Code that references `mouse` or `mouseIntersection()` receives normalized Shader
Park mouse coordinates from the node preview and the shared surface preview.

## Resources

- [Shader Park](https://shaderpark.com)
- [Shader Park JS reference](https://docs.shaderpark.com/references-js/)
- [Community examples](https://shaderpark.com/explore) - these can be copied into Patchies as-is.
- [About Shader Park](https://shaderpark.com/about)
- [shader-park-core repository](https://github.com/shader-park/shader-park-core)

## Notes

`time`, `mouse`, `getSpace()`, `getRayDirection()`, and the standard Shader
Park primitives and material helpers are available.
