The `shaderpark` object runs [Shader Park](https://shaderpark.com) code inside
Patchies' render pipeline. It is useful for concise SDF and raymarched
procedural 3D visuals.

## Getting Started

Write Shader Park statements directly in the editor:

```javascript
// @title Noise Sphere

let radius = input(0.7, 0.1, 1.2);
let scale = 2.0;
let s = getSpace();
let n = 0.1 * noise(scale * s + time);
sphere(radius + n);
```

## Settings

Shader Park `input()` calls create persistent numeric settings. `input2D()`
calls create persistent two-axis vector settings.

```javascript
let radius = input(0.35, 0.1, 1.0);
let offset = input2D(0, 0);

displace(offset.x, offset.y, 0);
sphere(radius);
```

The generated message inlets can also receive `run` and `setCode` control
messages, so Shader Park does not expose a separate control inlet.

## Directives

Use comment directives at the top of the code to set Patchies node metadata:

```javascript
// @title Noise Sphere
// @primaryButton settings

let radius = input(0.7, 0.1, 1.2);
sphere(radius);
```

`@primaryButton` accepts `code`, `settings`, or `run`.

## Mouse

Code that references `mouse` or `mouseIntersection()` receives normalized Shader
Park mouse coordinates from the node preview and the shared surface preview.

## Presets

Enable the "Shader Park Visuals" preset pack to use ready-made Shader Park
examples. It includes `Noise Sphere`, `Square Symmetry`, and `Mouse Follower`.


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

## Resources

- [Shader Park](https://shaderpark.com)
- [Shader Park JS reference](https://docs.shaderpark.com/references-js/)
- [Community examples](https://shaderpark.com/explore) - these can be copied into Patchies as-is.
- [About Shader Park](https://shaderpark.com/about)
- [shader-park-core repository](https://github.com/shader-park/shader-park-core)

## Notes

`time`, `mouse`, `getSpace()`, `getRayDirection()`, and the standard Shader
Park primitives and material helpers are available.
