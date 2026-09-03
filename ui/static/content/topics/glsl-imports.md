# GLSL Imports

Use `#include` to import GLSL functions from NPM packages, Patch files, User files, or URLs. You do not need to copy shader code between nodes.

`#include` works in [glsl](/docs/objects/glsl), [swgl](/docs/objects/swgl), [regl](/docs/objects/regl), and [hydra](/docs/objects/hydra) inside `setFunction`. It also works in [three](/docs/objects/three) through the `await glsl` tagged template.

## How It Works

Before shader compilation, `#include` inserts GLSL source code at the include site. Patchies resolves the path, gets the source, and inserts it.

```glsl
#include <lygia/generative/snoise>

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float n = snoise(vec3(uv * 4.0, iTime));
  fragColor = vec4(vec3(n), 1.0);
}
```

This example gets the `snoise` function from the [lygia](https://lygia.xyz) shader library. Patchies resolves includes automatically.

## Import Sources

You can import GLSL code from four sources:

### NPM Packages

Use angle brackets to import from shader libraries, such as lygia:

```glsl
#include <lygia/generative/snoise>
#include <lygia/lighting/pbr>
#include <lygia/color/space/hsv2rgb>
```

The `.glsl` extension is optional. `<lygia/generative/snoise>` and `<lygia/generative/snoise.glsl>` are equivalent.

### Patch Files

Files under `patch://` are embedded in the current patch. They travel with the patch when you save or share it, and supported GLSL files are editable in the Files sidebar.

Relative GLSL paths start from the `patch://` root when you include them from a node:

```glsl
#include "./utils.glsl"
#include "patch://shaders/palette.glsl"
```

Inside an included Patch file, a relative path starts from that file's folder. The `.glsl` extension is optional.

Create a Patch GLSL file in the sidebar with `Ctrl/Cmd + B > Files`, then use it from any supported shader node.

### User Files

Use double quotes and a `user://` path to import from [Virtual Filesystem](/docs/virtual-filesystem) files:

```glsl
#include "user://my-shaders/utils.glsl"
#include "user://sdf-functions.glsl"
```

User files come from uploads, browser-local storage, or linked folders. They are not embedded as source in the patch and are read-only in the Files sidebar editor. Linked files may need permission again after you reopen the patch.

### URLs

Use double quotes and a complete URL to import GLSL from the web:

```glsl
#include "https://raw.githubusercontent.com/stegu/psrdnoise/main/src/psrdnoise2.glsl"
```

Patchies caches URL imports in memory for the session. It gets each URL once.

## Supported Objects

`#include` works in five visual objects. Most of them preprocess your shaders automatically.

| Object                        | How it works                                               |
| ----------------------------- | ---------------------------------------------------------- |
| [glsl](/docs/objects/glsl)    | Auto-preprocessed before shader compilation               |
| [swgl](/docs/objects/swgl)    | Auto-preprocessed in `FP`, `VP`, and `Inc` fields          |
| [regl](/docs/objects/regl)    | Auto-preprocessed in `frag` and `vert` fields              |
| [hydra](/docs/objects/hydra)  | Auto-preprocessed inside `setFunction` GLSL strings        |
| [three](/docs/objects/three)  | Use `await glsl` tagged template or `processIncludes()`     |

### Hydra Usage

Use `#include` inside `setFunction` to add external GLSL to the Hydra shader pipeline:

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

Three.js nodes cannot preprocess shaders because Patchies does not control `THREE.ShaderMaterial`. Use the `await glsl` tagged template:

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

All JavaScript visual objects provide the `glsl` tag and `processIncludes()` function.

## Try It

### Exercise — Use Lygia Noise in a GLSL Shader

1. Create a `glsl` object (`Enter` > type `glsl`).
2. Paste this code:

```glsl
#include <lygia/generative/snoise>

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float n = snoise(vec3(uv * 5.0, iTime * 0.5));
  fragColor = vec4(vec3(n * 0.5 + 0.5), 1.0);
}
```

3. Connect the object to `bg.out`. You should see animated simplex noise.

### Exercise — Share a Utility Across Nodes

1. Open the sidebar (`Ctrl/Cmd + B > Files`).
2. Create a file named `utils.glsl`.
3. Add this helper function:

```glsl
vec3 palette(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}
```

4. In a `glsl` object, include and use the file:

```glsl
#include "./utils.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(palette(uv.x + iTime * 0.2), 1.0);
}
```

5. Create a second `glsl` object.
6. Include the same file. Both nodes share the function, and saving `utils.glsl` updates both nodes.

## Nested Includes

Included files can contain `#include` directives. Patchies resolves includes up to 32 levels deep. Circular includes produce an error.

## Caching

- **NPM packages:** Patchies gets packages from a CDN and caches them for the session.
- **VFS files:** Patchies reads files again after they change.
- **URLs:** Patchies caches URLs for the session. Reload the page to get them again.

## Licensing: Lygia Shader Library

Lygia uses the [Prosperity License](https://prosperitylicense.com/versions/3.0.0) and the [Lygia Patron License](https://lygia.xyz/license).

Lygia is free for non-commercial use, including personal use and use in non-commercial organizations. For commercial use, purchase a license from Patricio Gonzalez Vivo on [GitHub Sponsors](https://github.com/sponsors/patriciogonzalezvivo).

These requirements do not apply if your shaders do not import Lygia with `#include <lygia/...>`. You can use Patchies without importing Lygia.

## See Also

- [glsl](/docs/objects/glsl) — Create fragment shaders with Shadertoy-compatible uniforms.
- [swgl](/docs/objects/swgl) — Create SwissGL shaders.
- [regl](/docs/objects/regl) — Use WebGL with REGL.
- [three](/docs/objects/three) — Create Three.js scenes.
- [Virtual Filesystem](/docs/virtual-filesystem) — Understand `patch://` and `user://` files.
