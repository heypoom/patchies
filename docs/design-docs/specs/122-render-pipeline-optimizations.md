# 122. Render Pipeline Optimizations

Epic spec for performance optimizations inspired by TouchDesigner's cooking model. These are independent improvements that can be implemented incrementally. Each addresses a different bottleneck.

## Context

Today, every visual node re-renders at full resolution every frame, regardless of whether anything changed. Previews render for all visible nodes. All FBOs are RGBA (4 channels). These defaults are correct for simplicity but leave significant performance on the table.

A moderately complex patch (10-20 nodes) runs comfortably at 60fps on an M1 Pro. These optimizations extend that to 30-50+ nodes, or allow heavier shaders per node at the same frame rate.

## 1. Per-Node Resolution

### Problem

A noise generator at 1080p produces 2 million pixels per frame. The noise is smooth and low-frequency — 256×256 looks identical when upscaled by bilinear filtering. But it costs the same as the final output node.

### Solution

A `resolution` setting per node: `full`, `1/2`, `1/4`, or a fixed size (`256`, `512`, `1024`). The FBO is created at that size. Downstream nodes read it via `texture(iChannel0, uv)` — WebGL's bilinear sampling upscales automatically, no extra code needed.

### Settings UI

Add a "Resolution" dropdown to the node settings panel for all visual nodes. Default: `full` (current behavior, no change).

| Setting | FBO size (at 1080p output) | Pixel count | Relative cost |
|---|---|---|---|
| Full | 1920×1080 | 2.07M | 1× |
| 1/2 | 960×540 | 0.52M | 0.25× |
| 1/4 | 480×270 | 0.13M | 0.06× |
| 256 | 256×256 | 0.07M | 0.03× |
| 512 | 512×512 | 0.26M | 0.13× |

### Implementation

In `fboRenderer.ts`, read the resolution setting from node data when creating FBOs:

```typescript
const [width, height] = match(node.data.resolution ?? 'full')
  .with('full', () => [outputWidth, outputHeight])
  .with('1/2', () => [outputWidth / 2, outputHeight / 2])
  .with('1/4', () => [outputWidth / 4, outputHeight / 4])
  .with(P.number, (size) => [size, size])
  .exhaustive();
```

FBO fingerprint must include resolution so FBOs are recreated when it changes.

## 2. Cook-on-Demand Caching

### Problem

Every node re-renders every frame. A static noise generator with fixed parameters renders identical pixels 60 times per second. In a typical patch, 30-50% of nodes have no time-dependent inputs and could be skipped.

### Solution

Track whether a node's inputs changed since last frame. If nothing changed, skip the render — serve the cached FBO.

### What "changed" means

A node needs to re-render if ANY of these are true:
- A uniform value changed (slider moved, message received)
- An input FBO was rewritten this frame (upstream node re-rendered)
- The shader uses time-dependent builtins (`iTime`, `iFrame`, `iTimeDelta`)
- The node receives mouse input (`iMouse` active)
- The node uses FFT data

If none are true, the FBO from last frame is still valid. Skip the render.

### Time-Dependence Detection

Statically detect whether a shader uses time builtins by scanning the source for `iTime`, `iFrame`, `iTimeDelta`, or `time`. Mark the node as `alwaysCook = true`. Nodes without time references are candidates for caching.

For JS-based nodes (REGL, Three.js, SwissGL), assume `alwaysCook = true` by default — JS code can access time in ways that aren't statically detectable. Users can override with a `// @static` hint or a settings toggle.

### Dirty Propagation

When a node re-renders, mark all downstream nodes as dirty. When a node is clean (no changes) and all upstream nodes are clean, skip it.

```typescript
// In the render loop
for (const nodeId of sortedNodes) {
  if (!isDirty(nodeId)) continue;  // skip — cached FBO is valid
  renderNode(nodeId);
  markDownstreamDirty(nodeId);
}
```

### Implementation

Add to `fboRenderer.ts`:
- `dirtyFlags: Map<string, boolean>` — per-node dirty state
- `uniformVersions: Map<string, number>` — track uniform changes
- `timeDependent: Set<string>` — nodes that use time builtins
- At frame start: mark time-dependent nodes dirty, clear others
- On uniform change: mark node + downstream dirty
- On render: only render dirty nodes

## 3. Texture Channel Format

### Problem

Every FBO is RGBA (4 channels). A grayscale noise generator writes the same value to all 4 channels — 4× the bandwidth for 1 channel of useful data.

### Solution

Per-node channel format setting. Default: `rgba` (current behavior). Users can reduce to `r`, `rg`, or `rgb` as an optimization when their patch starts to lag.

| Format | Channels | Bandwidth (1080p) | Use case |
|---|---|---|---|
| `rgba` | 4 | ~8 MB/frame | Default. Color + alpha. |
| `rgb` | 3 | ~6 MB/frame | Color without alpha |
| `rg` | 2 | ~4 MB/frame | Two-channel data (e.g. UV displacement) |
| `r` | 1 | ~2 MB/frame | Grayscale, height maps, masks |

### Downstream Compatibility — Auto-Swizzle

Without correction, reading an R-format texture returns `vec4(r, 0, 0, 1)` — a red image, not grayscale. Users would need to manually write `vec4(val.r, val.r, val.r, 1.0)` everywhere. That's a footgun.

Fix: when binding a reduced-channel texture to a downstream node's input, apply WebGL2 texture swizzle parameters so it reads naturally:

```typescript
// For R-format textures: broadcast R to all channels
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_SWIZZLE_G, gl.RED);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_SWIZZLE_B, gl.RED);
// Result: texture() returns vec4(r, r, r, 1) — grayscale as expected

// For RG-format textures: R and G pass through, B = 0, A = 1
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_SWIZZLE_B, gl.ZERO);
// Result: texture() returns vec4(r, g, 0, 1)

// For RGB-format textures: A = 1 (already the default)
// Result: texture() returns vec4(r, g, b, 1)
```

This is set once when binding the texture in `fboRenderer.ts`'s texture routing. The format optimization becomes invisible to the user — downstream nodes read the texture normally without knowing it's a reduced format. No shader changes, no user-facing behavior difference.

### Settings UI

Add a "Channels" dropdown to node settings, next to the resolution and FBO format (spec 112) dropdowns. Default: `rgba`. This is an advanced optimization — don't promote it in the UI. It's there for users who need it.

Combined with spec 112, the full FBO format options are:

```
Channels:  rgba | rgb | rg | r
Precision: uint8 | float16 | float32
```

## 4. Preview Optimizations

### Problem

Every visible node renders a preview by reading back pixels from the FBO via PixelReadbackService. This is a GPU→CPU transfer — expensive and serialized. At high zoom levels with many small nodes visible, most previews are barely perceptible but still cost readback time.

### 4a. Zoom-Based Preview LOD

Reduce or skip previews based on canvas zoom level:

| Zoom level | Preview behavior |
|---|---|
| > 80% (few nodes visible, large) | Full preview at full FBO resolution |
| 40-80% (moderate view) | Half-res preview readback |
| < 40% (zoomed out, many nodes) | Skip preview — show last captured thumbnail or nothing |

The FBO pipeline runs at full resolution regardless — only the preview readback changes.

### 4b. Global Preview Toggle

A keyboard shortcut (e.g. `Shift+P`) or toolbar button to disable ALL node previews. During live performance, the audience sees the output — node previews are for the coder's reference. Turning them off saves all readback overhead.

### 4c. Selective Preview

Only render previews for:
- The currently selected node
- The output node (`bg.out`)
- Nodes explicitly pinned by the user

All other nodes show a static placeholder. Click a node to see its live preview.

### 4d. Preview Frame Rate Reduction

Decouple preview readback from the render loop. The FBO pipeline runs at 60fps. Preview readback runs at a lower rate:

| Context | Preview FPS |
|---|---|
| Selected node | 60 (full rate) |
| Visible nodes | 15-30 |
| Off-screen nodes | 0 (already culled) |

### Implementation

Most of these are changes to `GLSystem.ts` and the preview rendering path, not the core render loop:
- Zoom-based: read zoom level from the xyflow viewport, adjust `setPreviewEnabled` and readback resolution
- Global toggle: `GLSystem.setAllPreviewsEnabled(false)`
- Selective: `setPreviewEnabled` only for selected + output nodes
- Frame rate: add a frame counter to `PixelReadbackService`, skip readbacks based on target FPS

## Priority

| Optimization | Impact | Effort | Do when |
|---|---|---|---|
| Preview toggle (4b) | Quick win | Tiny | Now — one shortcut binding |
| Preview zoom LOD (4a) | Moderate | Small | Soon — extends existing culling |
| Per-node resolution (1) | Large for heavy nodes | Small | Phase 2 — alongside 105/106 FBO changes |
| Cook-on-demand caching (2) | Large for static-heavy patches | Medium | Phase 2 — biggest architectural change |
| Preview frame rate (4d) | Moderate | Small | Phase 2 |
| Selective preview (4c) | Moderate | Small | Phase 3 — needs UX design for pinning |
| Channel format (3) | Small-moderate | Small | Phase 3 — advanced optimization, low priority |

## Dependencies

- Per-node resolution and channel format modify FBO creation — coordinate with specs 105 (MRT) and 106 (float FBOs) to avoid conflicting changes
- Cook-on-demand caching requires spec 107 (render graph diffing) as a foundation — diffing tracks what changed, caching decides whether to re-render
- Preview optimizations are independent of all other specs
