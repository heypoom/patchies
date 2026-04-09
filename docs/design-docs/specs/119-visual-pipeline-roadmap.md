# 119. Visual Pipeline Roadmap

## Vision

Build a **code-oriented TouchDesigner** that runs in a browser. Patchies combines visual wiring for composition with code for logic, backed by community GLSL libraries (lygia) so users never write boilerplate. The result: a creative visual programming environment where live coders can build audio-reactive 3D scenes with PBR materials, GPGPU particle systems, multi-pass feedback effects, and instanced geometry — all shareable as a URL.

### What Patchies Becomes After This Roadmap

**For live coders**: `#include <lygia/generative/snoise>` and you have noise. Wire a feedback loop visually. Drag a material preset from VFS. Ask the AI to generate a raymarcher. Swap materials mid-performance by reconnecting one wire.

**For creative coders**: A Substance Designer-like texture pipeline (procedural generators → effects → material slots → lit 3D preview) that runs in real-time, not as a bake step. Every "material output" is a live video signal you can feed into feedback loops, composite with Hydra, or project onto geometry.

**For generative artists**: GPU particle systems spanning multiple nodes (float FBOs + feedback). Geometry composition (scatter points → instance meshes → render with shared environment map). Post-processing chains where each step is a separate, rewirable node.

### Design Principles

**Code over nodes for logic.** Patchies users write code — that's the strength, not a limitation. Don't build a visual shader graph compiler (Unity/Unreal style). Instead, make code more powerful: `#include` for library access, `glsl` tagged templates for syntax highlighting, AI for code generation, presets for common patterns.

**Nodes for composition.** Wiring is for connecting stages: generators → effects → materials → renders → post-processing → output. Each node is a self-contained program. The graph is the architecture; the code is the implementation.

**Lean on community libraries.** Don't maintain a Patchies GLSL library. lygia has hundreds of battle-tested functions for noise, SDF, lighting, color, math. Point users there, add UX niceties (autocomplete, `#include` preprocessing), and ship example presets that demonstrate the patterns.

**Everything is opt-in.** No performance degradation for existing patches. Float FBOs, MRT, feedback, geometry — all additive. A patch that doesn't use these features runs exactly the same as today.

**Presets over node types.** Geometry operators, material previews, post-processing effects — implement as `js`/`three` presets, not dedicated Svelte components. New node types only when custom UI is truly needed (curve editors, pad grids, etc.).

### Comparison to Industry Tools

| Capability                  | TouchDesigner     | Substance Designer  | Patchies (after roadmap)                           |
| --------------------------- | ----------------- | ------------------- | -------------------------------------------------- |
| Texture processing pipeline | TOP network       | Node graph          | Video pipeline (existing + MRT + float + feedback) |
| Shader code                 | GLSL TOP (clunky) | Pixel Processor     | GLSL/SwissGL/REGL nodes + `#include` lygia         |
| Materials                   | MAT operators     | Material outputs    | `@slot` metadata + material presets                |
| Geometry composition        | SOP network       | N/A                 | Geometry handles + `geo.*` presets                 |
| Instancing                  | Instance SOP      | N/A                 | `geo.instance` + `InstancedGeometryData`           |
| GPGPU / particles           | Compute TOP       | N/A                 | Float FBO feedback + wgpu.compute bridge           |
| Environment lighting        | Environment Light | 3D viewport         | Resource pool cubemaps + Three.js presets          |
| Feedback / temporal         | Feedback TOP      | N/A                 | Graph-level feedback loops                         |
| Audio reactivity            | CHOP → TOP        | N/A                 | fft~ + env~ + messages (existing)                  |
| Code generation             | N/A               | N/A                 | AI generates GLSL/Three.js with `#include` lygia   |
| Sharing                     | Export .toe file  | Export .sbs file    | Share as URL                                       |
| Cost                        | $2,200 license    | $20/mo subscription | Free, open source, runs in a browser               |

## Specs

| Spec                                        | Title                         | Summary                                                                    |
| ------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| [111](111-multi-render-target.md)           | Multi-Render-Target           | Multiple video outlets per node via MRT color attachments ✓                |
| [112](112-float-fbo-format.md)              | Float FBO Format              | Per-node `rgba16f`/`rgba32f` for GPGPU and HDR                             |
| [113](113-graph-level-feedback.md)          | Graph-Level Feedback          | Back-edges with 1-frame delay, double-buffered FBOs ✓                      |
| [114](114-visual-convenience-presets.md)    | Convenience Presets           | Procedural generators, post-processing, PBR, simulation presets            |
| [115](115-geometry-wire-type.md)            | Geometry Wire Type            | Geometry handle with auto-caching inlets, attributes, instancing           |
| [116](116-webgpu-render-bridge.md)          | WebGPU Render Bridge          | ImageBitmap + SharedArrayBuffer paths from compute to FBO pipeline         |
| [117](117-shared-resource-pool.md)          | Shared Resource Pool          | Named cubemaps, 3D textures, LUTs accessible by any node                   |
| [118](118-glsl-include-preprocessor.md)     | GLSL `#include` Preprocessor  | `#include` preprocessor for lygia, VFS, and URL sources ✓                  |
| [123](123-shader-effect-format.md)          | Shader Effect Format          | Effect metadata, drag-drop scaffolding, material system, Hydra integration |
| [120](120-snippet-presets.md)               | Snippet Presets               | Cross-patch portability for GLSL/Hydra/JS snippets via preset system       |
| [121](121-vfs-js-modules.md)                | VFS JavaScript Modules        | Import JS modules from VFS files alongside `// @lib` nodes                 |
| [122](122-render-pipeline-optimizations.md) | Render Pipeline Optimizations | Per-node resolution, cook-on-demand caching, channel formats, preview LOD  |

## Dependency Graph

```
Independent (no deps):     111, 112, 113, 117, 118, 123, 115 (Stage 2-3)

114 presets (some) ←── 111 (channel-split needs MRT)
114 presets (some) ←── 112 (particle-sim needs float)
114 presets (some) ←── 113 (blur needs feedback)
115 Stage 1        ←── 111 + 112 (texture-encoded geometry)
116 Bridge 2       ←── 112 (float data from compute)
```

```
                    ┌─────────┐
                    │   118   │  #include Preprocessor
                    │ no deps │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │   123   │  Shader Effect Format
                    │ dep: 118│
                    └─────────┘

┌─────────┐         ┌─────────┐         ┌─────────┐
│   111   │         │   112   │         │   113   │
│   MRT   │         │Float FBO│         │Feedback │
│ no deps │         │ no deps │         │ no deps │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │    ┌──────────────┼───────────────────┘
     │    │              │
     ▼    ▼              ▼
┌─────────────┐   ┌───────────┐
│     114     │   │    115    │
│   Presets   │   │ Geometry  │
│ some need   │   │ Stage 1:  │
│ 111/112/113 │   │ 111 + 112 │
└─────────────┘   │ Stage 2-3:│
                  │  no deps  │
                  └───────────┘

┌─────────┐         ┌─────────┐
│   116   │         │   117   │
│  WebGPU │         │Resource │
│ Bridge  │         │  Pool   │
│ B2: 112 │         │ no deps │
└─────────┘         └─────────┘
```

## Implementation Order

### Phase 1 — Immediate (live coding essentials) ✓ DONE

1. **[118](118-glsl-include-preprocessor.md) `#include` preprocessor** ✓ — `#include <lygia/generative/snoise>` in any shader node. Biggest quality-of-life win for live coders. No pipeline changes, no architectural risk. Includes the `glsl` tagged template literal for JS-based nodes.
2. **[113](113-graph-level-feedback.md) Feedback Loops** ✓ — Multi-node feedback chains for trails, accumulation, reaction-diffusion. Transformative for live visual workflows.

### Phase 2 — Foundations (richer textures)

3. **[111](111-multi-render-target.md) MRT** ✓ and **[112](112-float-fbo-format.md) Float FBO** — Can be built in parallel. These are the foundation that makes later specs (presets, geometry, compute bridge) much more powerful.
4. **[114](114-visual-convenience-presets.md) Presets** — Ship independent presets first (noise generators, post-processing, color grading). Add MRT/float/feedback-dependent presets as those land. Presets use `#include <lygia/...>` internally.

### Phase 3 — Expansion (new data types)

5. **[115](115-geometry-wire-type.md) Geometry** (Stage 2-3) — Geometry handle type, auto-caching inlets, `geo.*` presets (not dedicated node types). No pipeline deps.
6. **[117](117-shared-resource-pool.md) Resource Pool** — Cubemaps, LUTs, 3D textures. Important for production quality and PBR workflows.
7. **[116](116-webgpu-render-bridge.md) WebGPU Bridge** (Bridge 1) — ImageBitmap path from compute to FBO pipeline. No deps.

### Phase 4 — Full picture

8. **[115](115-geometry-wire-type.md) Geometry** (Stage 1) — Texture-encoded geometry via MRT + float FBOs. Requires 111 + 112.
9. **[116](116-webgpu-render-bridge.md) WebGPU Bridge** (Bridge 2) — SharedArrayBuffer fast path. Benefits from 112.
10. Remaining **[114](114-visual-convenience-presets.md) presets** that depend on MRT, float FBOs, or feedback.
11. **[123](123-shader-effect-format.md) Shader Effect Format** — Effect metadata, drag-drop scaffolding, `@slot` metadata, material presets, material preview Three.js preset, `@hydra` directive. Benefits from 111 (MRT for multi-channel material output) and 117 (resource pool for environment maps). Depends on 118.
12. **[120](120-snippet-presets.md) Snippet Presets** — Cross-patch portability for GLSL/Hydra snippets. Depends on 118 and 123.

## What This Unlocks at Each Phase

### After Phase 1

Live coders can `#include <lygia/generative/snoise>` and immediately have noise, SDF, lighting functions. Multi-node feedback chains enable trails, accumulation, and reaction-diffusion as visual wiring. This alone transforms the live coding experience.

### After Phase 2

Patchies matches TouchDesigner's TOP network — multi-pass processing, float precision, GPGPU within the texture pipeline. A single GLSL node can output albedo + normal + roughness via MRT. Substance Designer-like procedural texture workflows become possible.

### After Phase 3

3D scene composition via geometry handles — scatter instances, import models, transform meshes, render with shared cubemaps. Patchies now covers TD's SOP + TOP + MAT workflows. Audio-reactive 3D generative scenes with instanced geometry, PBR materials, and temporal post-processing — all in a browser.

### After Phase 4

The full picture. GPU particle systems with millions of points via texture-encoded geometry. WebGPU compute results visualized in the FBO pipeline. Hot-swappable materials with standardized slots. Everything from the crystal cave example works as described.

## Key Design Decisions Made

These decisions were made during the spec process and should be preserved:

- **No built-in GLSL library.** Use lygia and community libraries via `#include`. Patchies maintains the preprocessor, not the functions.
- **No `#use` directive.** `#include` is the single import mechanism for all GLSL sources (NPM, VFS, URL).
- **No dedicated geometry node types.** `geo.sphere`, `geo.transform` etc. are `js` node presets using the settings API. Promote to dedicated types only if custom UI is needed.
- **No dedicated render node type.** Geometry visualization is a Three.js preset (~20 lines). Fork it for custom materials, cameras, lighting.
- **No shader graph compiler.** Patchies is code-first. Visual wiring composes stages; code implements logic. Don't build Unity Shader Graph.
- **Geometry uses messages with auto-caching inlets.** Not a custom store or evaluation model. Push-based transport, pull-like semantics via inlet cache.
- **Materials are GLSL functions with `@slot` metadata.** Not a material graph. Hot-swappable because all PBR materials share standard slot names.
- **Effects are VFS files with optional metadata.** Drag-drop onto canvas scaffolds a GLSL node. Drag-drop onto existing node inserts `#include`. No `glsl.fn` node type.
- **Float FBOs and MRT are per-node opt-in.** No global pipeline changes. Existing patches are unaffected.
