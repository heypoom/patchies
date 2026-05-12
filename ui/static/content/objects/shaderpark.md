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

The object has four video inlets. Patchies binds them as sampler uniforms:

- `iChannel0`
- `iChannel1`
- `iChannel2`
- `iChannel3`

You can reference these from GLSL helper functions created with Shader Park's
`glslFunc` or `glslFuncES3` APIs. The connected textures stay in the shared
WebGL render pipeline.

## Notes

`time`, `mouse`, `getSpace()`, `getRayDirection()`, and the standard Shader
Park primitives and material helpers are available. Uniforms created with
`input()` and `input2D()` currently use their generated default values.
