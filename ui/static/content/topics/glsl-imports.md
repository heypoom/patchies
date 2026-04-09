# GLSL Imports

Import GLSL functions from NPM packages, your files, or URLs using `#include` — no copy-pasting shader code between nodes.

`#include` works across most visual objects: [glsl](/docs/objects/glsl), [swgl](/docs/objects/swgl), [regl](/docs/objects/regl), [hydra](/docs/objects/hydra) (inside `setFunction`), and [three](/docs/objects/three) (via `await glsl` tagged template). Write a utility once, use it everywhere.

---

## How It Works

The `#include` directive inlines GLSL source code at the include site before shader compilation. It works like the C preprocessor: resolve the path, fetch the source, paste it in.

```glsl
#include <lygia/generative/snoise>

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float n = snoise(vec3(uv * 4.0, iTime));
  fragColor = vec4(vec3(n), 1.0);
}
```

This fetches the `snoise` function from the [lygia](https://lygia.xyz) shader library and makes it available in your code. No setup needed — includes are resolved automatically.

---

## Import Sources

There are three ways to import GLSL code:

### NPM Packages

Use angle brackets to import from shader libraries like lygia:

```glsl
#include <lygia/generative/snoise>
#include <lygia/lighting/pbr>
#include <lygia/color/space/hsv2rgb>
```

The `.glsl` extension is optional — `<lygia/generative/snoise>` and `<lygia/generative/snoise.glsl>` are equivalent.

### Your Files

Use double quotes with a `user://` path to import from your [Virtual Filesystem](/docs/virtual-filesystem) files:

```glsl
#include "user://my-shaders/utils.glsl"
#include "user://sdf-functions.glsl"
```

Upload `.glsl` files through the sidebar (`Ctrl/Cmd + B > Files`), then include them in any shader node.

### URLs

Use double quotes with a full URL to import from anywhere on the web:

```glsl
#include "https://raw.githubusercontent.com/stegu/psrdnoise/main/src/psrdnoise2.glsl"
```

URL imports are cached in memory for the session, so they only fetch once.

---

## Supported Objects

`#include` works in five visual objects — most of them auto-preprocess your shaders, so you just write `#include` and it works:

| Object | How it works |
| --- | --- |
| [glsl](/docs/objects/glsl) | Auto-preprocessed before shader compilation |
| [swgl](/docs/objects/swgl) | Auto-preprocessed in `FP`, `VP`, and `Inc` fields |
| [regl](/docs/objects/regl) | Auto-preprocessed in `frag` and `vert` fields |
| [hydra](/docs/objects/hydra) | Auto-preprocessed inside `setFunction` GLSL strings |
| [three](/docs/objects/three) | Use `await glsl` tagged template or `processIncludes()` |

### Hydra Usage

Use `#include` inside `setFunction` to bring external GLSL into Hydra's shader pipeline:

```javascript
osc()
  .setFunction({
    type: "frag",
    glsl: `
      #include <lygia/generative/snoise>

      vec4 myEffect(vec4 color, vec2 uv) {
        float n = snoise(vec3(uv * 4.0, time));
        return vec4(vec3(n), 1.0);
      }
    `,
  })
  .out()
```

### Three.js Usage

Three.js nodes can't auto-preprocess because Patchies doesn't control `THREE.ShaderMaterial`. Use the `await glsl` tagged template instead:

```javascript
const material = new THREE.ShaderMaterial({
  fragmentShader: await glsl`
    #include <lygia/generative/snoise>

    void main() {
      float n = snoise(vec3(vUv * 4.0, time));
      gl_FragColor = vec4(vec3(n), 1.0);
    }
  `,
})
```

The `glsl` tag and `processIncludes()` function are available in all JavaScript-based visual objects.

---

## Try It

### Exercise — Use lygia noise in a GLSL shader

1. Create a `glsl` object (`Enter` > type `glsl`)
2. Paste this code:

```glsl
#include <lygia/generative/snoise>

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float n = snoise(vec3(uv * 5.0, iTime * 0.5));
  fragColor = vec4(vec3(n * 0.5 + 0.5), 1.0);
}
```

3. Connect to `bg.out` — you should see animated simplex noise

### Exercise — Share a utility across nodes

1. Open the sidebar (`Ctrl/Cmd + B > Files`) and create a file called `utils.glsl`
2. Add a helper function:

```glsl
vec3 palette(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}
```

3. In a `glsl` object, include and use it:

```glsl
#include "user://utils.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(palette(uv.x + iTime * 0.2), 1.0);
}
```

4. Create a second `glsl` object and include the same file — both nodes share the function

---

## Nested Includes

Included files can contain their own `#include` directives. Resolution is recursive up to 32 levels deep. Circular includes are detected and produce an error.

---

## Caching

- **NPM packages** are fetched from a CDN and cached for the session
- **VFS files** are re-read when changed, so edits are reflected immediately
- **URLs** are cached for the session (reload the page to re-fetch)

---

## Licensing: Lygia Shader Library

Lygia is dual licensed under the [Prosperity License](https://prosperitylicense.com/versions/3.0.0) and the [Lygia Patron License](https://lygia.xyz/license).

This means that Lygia is free for non-commercial use, i.e. for personal use and usage in non-commercial organizations. For _commercial_ use, please purchase a license from the creator, Patricio Gonzalez Vivo on [GitHub Sponsors](https://github.com/sponsors/patriciogonzalezvivo).

This does NOT apply to you if you do not import the Lygia package by using `#include <lygia/...>` in your shaders. You can still use Patchies and all its features without importing Lygia.

---

## See Also

- [glsl](/docs/objects/glsl) — fragment shaders with Shadertoy-compatible uniforms
- [swgl](/docs/objects/swgl) — SwissGL shaders
- [regl](/docs/objects/regl) — WebGL with REGL
- [three](/docs/objects/three) — Three.js scenes
- [Virtual Filesystem](/docs/virtual-filesystem) — managing files for `user://` imports
