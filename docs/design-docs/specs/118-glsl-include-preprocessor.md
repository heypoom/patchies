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

## Implementation Plan

Scope: core preprocessor + per-node integration + `glsl` tagged template. No CodeMirror changes.

### Architecture Overview

The preprocessor runs **in the render worker** (OffscreenCanvas worker), since that's where all shader compilation happens. VFS resolution uses the existing `createWorkerGetVfsUrl` pattern (posts message to main thread, awaits response). NPM packages are bundled at build time via Vite's `?raw` import or a custom resolver. URL fetches use `fetch()` directly from the worker.

Key constraint: the GLSL node compiles shaders in `fboRenderer.ts` (worker), while JS-based nodes (SwissGL, REGL, Three.js, Hydra) execute user JavaScript that contains shader strings — the `glsl` tagged template handles preprocessing for those.

### Step 1: Core Preprocessor (`src/lib/glsl-include/preprocessor.ts`)

Create `ui/src/lib/glsl-include/preprocessor.ts` with:

```typescript
export async function processIncludes(
  source: string,
  resolver: IncludeResolver,
  seen?: Set<string>,
): Promise<string>
```

**Parsing logic:**

- Regex: `/#include\s+(?:<([^>]+)>|"([^"]+)")/g`
- Angle brackets (`<pkg/path>`) → NPM resolution
- Double quotes with `user://` prefix → VFS resolution
- Double quotes with `https://` prefix → URL resolution

**Recursive resolution** with circular detection via `seen` Set of resolved paths. Error on cycles.

**`.glsl` extension auto-append:** If path has no extension, append `.glsl` before resolving.

**`IncludeResolver` interface:**

```typescript
interface IncludeResolver {
  resolveNpm(packagePath: string): Promise<string>
  resolveVfs(vfsPath: string): Promise<string>
  resolveUrl(url: string): Promise<string>
}
```

### Step 2: In-Memory Cache (`src/lib/glsl-include/cache.ts`)

Create `ui/src/lib/glsl-include/cache.ts`:

- Simple `Map<string, string>` cache keyed by resolved path
- URL fetches are cached permanently (cleared on page reload)
- NPM/VFS reads can also be cached but with invalidation on code update
- Wrap the resolver to check cache first:

```typescript
export function createCachedResolver(base: IncludeResolver): IncludeResolver
```

### Step 3: NPM Package Resolution

NPM packages like lygia live in `node_modules/`. Since the preprocessor runs in a worker (no filesystem access), two strategies:

**Strategy A — Vite virtual module (recommended):** Create a Vite plugin or use `import.meta.glob` to bundle lygia GLSL files at build time. Expose them via a lookup map importable in the worker.

**Strategy B — CDN fallback:** For packages not bundled, fetch from `https://lygia.xyz/` or `https://cdn.jsdelivr.net/npm/lygia@latest/` at runtime. Cache results.

**Concrete plan:** Use `import.meta.glob('/node_modules/lygia/**/*.glsl', { as: 'raw', eager: false })` in a resolver module. This gives us lazy-loaded, build-time bundled access to all lygia GLSL files. Fallback to CDN fetch if glob miss (package not installed).

File: `ui/src/lib/glsl-include/npm-resolver.ts`

### Step 4: VFS Resolution in Worker

Reuse the existing `createWorkerGetVfsUrl` pattern from `vfsWorkerUtils.ts`, but instead of getting a blob URL, we need the **text content** of the GLSL file.

Add a new worker message type: `resolveVfsText` → main thread reads VFS file as text → responds with `vfsTextResolved`.

File: `ui/src/lib/glsl-include/vfs-resolver.ts` (worker-side helper) + handler in `GLSystem.ts` (main thread).

### Step 5: GLSL Node Integration

**File:** `ui/src/workers/rendering/fboRenderer.ts`, method `createGlslRenderer()` (line 699)

Currently at line 728:

```typescript
code: node.data.code,
```

Change to:

```typescript
code: await processIncludes(node.data.code, workerResolver),
```

The `createGlslRenderer` method needs to become `async` (or the include processing happens before it's called). Since `processIncludes` is async (URL fetches), the render graph build step must await it.

**Preamble line adjustment:** After include resolution, the resolved code may have more lines than the original. The `PREAMBLE_LINES` constant in `shadertoy-draw.ts` stays the same (it counts the wrapper lines, not user code). But line error mapping from resolved-code lines back to original user-code lines needs a source map or offset tracking. **Phase 1: no line mapping for included code** — errors in included files show as-is.

### Step 6: `glsl` Tagged Template (`src/lib/glsl-include/tagged-template.ts`)

For JS-based nodes (Three.js requires it, SwissGL/REGL optional):

```typescript
export function createGlslTag(resolver: IncludeResolver): GlslTag {
  return async function glsl(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<string> {
    const raw = String.raw(strings, ...values)
    return processIncludes(raw, resolver)
  }
}
```

**Exposed to user code** via `extraContext` in `BaseWorkerRenderer.buildBaseExtraContext()`:

```typescript
glsl: createGlslTag(workerResolver),
```

Since it returns a Promise, Three.js users write:

```javascript
const material = new THREE.ShaderMaterial({
  fragmentShader: await glsl`#include <lygia/generative/snoise> ...`,
})
```

### Step 7: SwissGL Integration

**File:** `ui/src/workers/rendering/swglRenderer.ts`, method `updateCode()` (line 170)

The `wrappedGlsl` function at line 177 intercepts all SwissGL draw calls. Modify it to preprocess `#include` in `FP`, `VP`, and `Inc` fields:

```typescript
const wrappedGlsl = async (shaderConfig: any, targetConfig = {}) => {
  // Preprocess #include in shader fields
  if (shaderConfig.FP)
    shaderConfig = {
      ...shaderConfig,
      FP: await processIncludes(shaderConfig.FP, resolver),
    }
  if (shaderConfig.VP)
    shaderConfig = {
      ...shaderConfig,
      VP: await processIncludes(shaderConfig.VP, resolver),
    }
  if (typeof shaderConfig.Inc === 'string')
    shaderConfig = {
      ...shaderConfig,
      Inc: await processIncludes(shaderConfig.Inc, resolver),
    }
  return this.glsl(shaderConfig, {...targetConfig, ...this.swglTarget})
}
```

**Caveat:** SwissGL's `glsl()` is synchronous. Making it async changes the user API. Alternative: preprocess ALL shader strings in user code **before execution** (scan the JS code string for GLSL literals). But that's fragile. Better approach: make the wrapped glsl async and document it. Users already use `await` for other APIs.

### Step 8: REGL Integration

**File:** `ui/src/workers/rendering/reglRenderer.ts`, `createTrackedRegl()` (line 15)

Intercept `regl({frag, vert, ...})` calls in the proxy's `apply` trap (line 22-26):

```typescript
apply(target, thisArg, args) {
  const config = args[0];
  if (config?.frag) config.frag = await processIncludes(config.frag, resolver);
  if (config?.vert) config.vert = await processIncludes(config.vert, resolver);
  const cmd = Reflect.apply(target, thisArg, args);
  tracked.push(cmd);
  return cmd;
}
```

**Problem:** Proxy apply is synchronous. Need to make `createTrackedRegl` return an async-aware proxy, or preprocess at a higher level. Best approach: preprocess in `updateCode()` by scanning the wrapped code string, or provide `processIncludes` as a utility in extraContext and let users call it explicitly for REGL (since REGL's wrapper already handles resource tracking).

**Simpler approach for REGL:** Add `processIncludes` to `extraContext` and document that REGL users can use `glsl` tag or call it manually. The `glsl` tagged template from Step 6 handles this.

### Step 9: Hydra Integration

**File:** `ui/src/workers/rendering/hydraRenderer.ts`, `updateCode()` (line 141)

Hydra's shader strings live inside `setFunction()` calls and in the transform definitions. Since `setFunction` is not yet exposed to user code (documented but not implemented), the Hydra integration has two parts:

1. **Built-in transforms:** No change needed (they don't use `#include`)
2. **Future `setFunction` support:** When `setFunction` is exposed, preprocess the `glsl` property before registering the transform. This is deferred until `setFunction` is implemented.

For now, expose the `glsl` tagged template in Hydra's extraContext so users can use it for any string preprocessing.

### Step 10: Worker Resolver Wiring

Create `ui/src/lib/glsl-include/worker-resolver.ts`:

```typescript
export function createWorkerResolver(nodeId: string): IncludeResolver {
  return {
    resolveNpm: async (path) => {
      /* import from bundled glob map or CDN fetch */
    },
    resolveVfs: async (path) => {
      /* post message to main thread, await text response */
    },
    resolveUrl: async (url) => {
      /* fetch(url).then(r => r.text()) */
    },
  }
}
```

Instantiated in each renderer's `updateCode()` or in `BaseWorkerRenderer`.

### Files to Create

| File                                         | Purpose                                      |
| -------------------------------------------- | -------------------------------------------- |
| `ui/src/lib/glsl-include/preprocessor.ts`    | Core `#include` parser + recursive resolver  |
| `ui/src/lib/glsl-include/cache.ts`           | In-memory cache for resolved sources         |
| `ui/src/lib/glsl-include/npm-resolver.ts`    | NPM package resolution (glob + CDN fallback) |
| `ui/src/lib/glsl-include/vfs-resolver.ts`    | VFS text resolution from worker              |
| `ui/src/lib/glsl-include/worker-resolver.ts` | Combines all resolvers for worker context    |
| `ui/src/lib/glsl-include/tagged-template.ts` | `glsl` tagged template literal               |
| `ui/src/lib/glsl-include/index.ts`           | Public exports                               |

### Files to Modify

| File                                             | Change                                                        |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `ui/src/workers/rendering/fboRenderer.ts`        | Preprocess GLSL node code before `createShaderToyDrawCommand` |
| `ui/src/workers/rendering/BaseWorkerRenderer.ts` | Add `glsl` tag + `processIncludes` to `buildBaseExtraContext` |
| `ui/src/workers/rendering/swglRenderer.ts`       | Preprocess `FP`/`VP`/`Inc` in wrapped `glsl()`                |
| `ui/src/workers/rendering/reglRenderer.ts`       | Expose `glsl` tag (preprocessing via tagged template)         |
| `ui/src/workers/rendering/threeRenderer.ts`      | Expose `glsl` tag (required for Three.js `#include`)          |
| `ui/src/workers/rendering/hydraRenderer.ts`      | Expose `glsl` tag in extraContext                             |
| `ui/src/workers/rendering/vfsWorkerUtils.ts`     | Add `resolveVfsText` message type for GLSL content            |
| `ui/src/lib/canvas/GLSystem.ts`                  | Handle `resolveVfsText` worker message on main thread         |

### Implementation Order

1. `preprocessor.ts` + `cache.ts` — core logic, testable in isolation
2. `npm-resolver.ts` — install `lygia` via `bun add lygia`, set up `import.meta.glob`
3. `vfs-resolver.ts` + GLSystem handler — VFS text resolution from worker
4. `worker-resolver.ts` + `index.ts` — wire up combined resolver
5. `fboRenderer.ts` — GLSL node integration (first visible result)
6. `tagged-template.ts` — `glsl` tagged template
7. `BaseWorkerRenderer.ts` — expose `glsl` + `processIncludes` to all JS nodes
8. `swglRenderer.ts` — SwissGL `FP`/`VP` auto-preprocessing
9. Remaining renderers — REGL, Three.js, Hydra get `glsl` tag via base context
