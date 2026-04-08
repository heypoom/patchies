# 118. GLSL `#include` Preprocessor

## Problem

Every visual node has its own shader context with its own boilerplate. Common GLSL functions (noise, SDF, lighting, color math) get rewritten from scratch in every node. A live coder writing `sdSphere` for the third time in one session is wasting time on solved problems.

There's also no way to share shader logic across node types. A great SDF function written in a GLSL node can't be used in Three.js ShaderMaterial or SwissGL without copy-pasting and adapting to each node's conventions.

## Solution

A single `#include` directive for importing GLSL code from NPM packages (e.g. [lygia](https://github.com/patriciogonzalezvivo/lygia)), user VFS files, and URLs. Inspired by [GLSL.app](https://glsl.app) and the stack.gl ecosystem, but runtime-agnostic.

No built-in GLSL function library. Patchies leans on established community libraries (lygia, etc.) rather than maintaining its own. No new node types.

## `#include` Preprocessor

### What It Is

A C-style `#include` directive that resolves GLSL source from three sources: NPM packages, user VFS files, and URLs. Inspired by [GLSL.app](https://glsl.app) and the stack.gl ecosystem, but runtime-agnostic.

The preprocessor inlines the resolved source at the `#include` site, then hands the fully resolved GLSL to the shader compiler. Same thing the C preprocessor does, but with HTTP, NPM, and VFS as sources.

### Import Sources

| Syntax                                             | Source           | Resolution                                      |
| -------------------------------------------------- | ---------------- | ----------------------------------------------- |
| `#include <lygia/generative/snoise>`               | NPM package      | Local (installed via `bun add`) or CDN fallback |
| `#include "user://my-shaders/foo.glsl"`            | User's VFS files | Local VFS read                                  |
| `#include "https://raw.githubusercontent.com/..."` | Any URL          | Fetched + cached                                |

**Angle brackets** (`< >`) resolve from NPM packages. Since lygia and similar packages can be installed locally via `bun add lygia`, resolution is file-system based at build time — works offline, no CDN dependency.

**Double quotes** (`" "`) resolve as paths — VFS paths (`user://`) or absolute URLs.

The `.glsl` extension is optional: `#include <lygia/generative/snoise>` and `#include <lygia/generative/snoise.glsl>` are equivalent.

### Resolution & Caching

1. **NPM packages** (`<pkg/path>`): Resolved from `node_modules/` at build time (bundled as raw strings). Works offline after `bun add`. Fallback: fetch from CDN at runtime if not installed.
2. **VFS paths** (`"user://..."`): Read from Patchies' virtual filesystem. Immediate, no network.
3. **URLs** (`"https://..."`): Fetched via `fetch()`, cached in memory. Useful for sharing GLSL code across projects or importing from GitHub.

All resolution is recursive — an included file can contain its own `#include` directives. Circular includes are detected and errored.

### Example

```glsl
#include <lygia/generative/snoise>
#include <lygia/lighting/pbr>
#include <lygia/animation/easing/bounce>
#include "user://my-shaders/crystal-material.glsl"
#include "https://raw.githubusercontent.com/stegu/psrdnoise/main/src/psrdnoise2.glsl"

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float n = snoise(vec3(uv * 4.0, iTime));
    float b = bounce(n);
    vec3 col = pbr(normal, viewDir, lightDir);
    fragColor = vec4(col, 1.0);
}
```

### Per-Node Integration

**GLSL node**: Auto-preprocessed. The preprocessor runs on all user code before shader compilation. Insert resolved includes after `#version 300 es` and precision declaration, before user code.

**SwissGL**: Auto-preprocessed. The `glsl()` wrapper (which Patchies controls) detects `#include` in `FP`, `VP`, and `Inc` fields and resolves them before rendering.

**REGL**: Auto-preprocessed. The tracked `regl()` wrapper (which Patchies controls) detects `#include` in `frag` and `vert` properties and resolves them before creating draw commands.

```javascript
// REGL: just works — no glsl`` needed, the wrapper handles it
const draw = regl({
  frag: `
    #include <lygia/generative/snoise>

    void main() {
      float n = snoise(vec3(vUv * 4.0, time));
      gl_FragColor = vec4(vec3(n), 1.0);
    }
  `,
})
```

**Three.js**: Requires `glsl` tagged template. Unlike REGL and SwissGL, `THREE.ShaderMaterial` is the real Three.js constructor — Patchies doesn't control it and can't intercept shader strings. The `glsl` tag preprocesses the string before Three.js sees it.

```javascript
// Three.js: needs glsl`` because we can't wrap THREE.ShaderMaterial
const material = new THREE.ShaderMaterial({
  fragmentShader: glsl`
    #include <lygia/generative/worley>
    #include <lygia/color/space/hsv2rgb>

    void main() {
      float w = worley(vUv * 8.0);
      gl_FragColor = vec4(hsv2rgb(vec3(w, 0.8, 0.9)), 1.0);
    }
  `,
})
```

**Hydra**: Auto-preprocessed via `setFunction`. Patchies controls the vendored Hydra fork, so we modify `setFunction` to resolve `#include` directives in the `glsl` string before shader compilation. Users can use lygia functions directly in custom Hydra transforms:

```javascript
// In a Hydra node
setFunction({
  name: 'crystalNoise',
  type: 'src',
  inputs: [
    {type: 'float', name: 'scale', default: 4.0},
    {type: 'float', name: 'speed', default: 0.1},
  ],
  glsl: `
    #include <lygia/generative/snoise>

    return vec4(vec3(snoise(vec3(_st * scale, time * speed))), 1.0);
  `,
})

// Then chainable like any Hydra function
crystalNoise(8.0, 0.2).rotate(0.5).out()
```

### `glsl` Tagged Template Literal

The `glsl` tagged template serves two purposes:

1. **Preprocessing** (required for Three.js): Resolves `#include` directives and returns a plain GLSL string with all dependencies inlined. Three.js nodes need this because Patchies can't intercept `THREE.ShaderMaterial`'s constructor.

2. **Syntax highlighting** (all JS nodes): Enables mixed-language highlighting in CodeMirror — GLSL inside the backticks, JS outside. Useful in REGL and SwissGL nodes too, even though preprocessing happens automatically there.

For REGL and SwissGL, `glsl` is a **pass-through** — it returns the string unchanged (the wrapper handles preprocessing). It exists purely for CodeMirror to know "this is GLSL, highlight it."

For Three.js, `glsl` **actually preprocesses** — it resolves `#include` directives and returns the resolved string.

All `#include` resolution happens during `updateCode()` before any shader is compiled. Async fetches (URLs) are resolved before user code executes.

### Summary: Preprocessing by Node Type

| Node type | Who preprocesses                         | `glsl` tag needed?                          |
| --------- | ---------------------------------------- | ------------------------------------------- |
| GLSL      | Node compiler (automatic)                | N/A (not JS)                                |
| SwissGL   | `glsl()` wrapper (automatic)             | Optional (syntax highlighting only)         |
| REGL      | `regl()` wrapper (automatic)             | Optional (syntax highlighting only)         |
| Three.js  | `glsl` tagged template                   | **Required** for `#include` to work         |
| Hydra     | `setFunction` (automatic, vendored fork) | N/A (GLSL is in the `glsl` property string) |

### CodeMirror Integration

**GLSL highlighting in JS nodes**: The `glsl` tagged template literal enables mixed-language syntax highlighting in CodeMirror 6 via nested language parsing. JS code outside the template gets JS highlighting; code inside `` glsl`...` `` gets GLSL highlighting; `#include` directives are highlighted as preprocessor directives.

**Autocomplete**: Add commonly-used lygia function names to `patchies-completions.ts` for autocomplete in GLSL mode. When the user types `snoise`, they see the lygia function with parameter hints.

### File Storage

```
src/lib/glsl-include/
  preprocessor.ts    # resolves #include directives (NPM, VFS, URL)
  cache.ts           # in-memory cache for fetched sources
  tagged-template.ts # glsl tagged template literal implementation
```

NPM packages (lygia etc.) live in `node_modules/` — no Patchies-maintained GLSL code.

## Implementation Priority

1. **`#include` preprocessor** — NPM package resolution (lygia), VFS, URL, with caching
2. **Per-node integration** — run preprocessor in each shader node type's compilation step
3. **`glsl` tagged template literal** — preprocessor for JS-based nodes (REGL, Three.js, SwissGL)
4. **CodeMirror autocomplete** — lygia function names + user effect function names
5. **CodeMirror GLSL highlighting in JS** — mixed-language syntax highlighting for `glsl` tagged templates

## Dependencies

- `#include` preprocessor requires NPM package resolution (lygia installed via `bun add lygia`)
- `glsl` tagged template requires `#include` preprocessor
- CodeMirror GLSL highlighting requires CodeMirror 6 mixed-language parser setup
- CodeMirror completions extend existing `patchies-completions.ts`
