# 111. Shared Resource Pool

## Problem

GL resources (cubemaps, 3D textures, LUTs, models) are created inside individual nodes and can't be shared. If two Three.js nodes need the same environment map, each loads and creates it independently. There's no way to use a cubemap in a GLSL node at all — the FBO pipeline only passes 2D RGBA textures.

Resources that don't fit the "2D texture per frame" model have no place in the current architecture.

## Solution

A named resource pool that holds long-lived GPU resources in the render worker, accessible by any visual node.

## Architecture

```
Main Thread                              Render Worker
┌────────────────────┐                  ┌────────────────────────┐
│ ResourceRegistry   │                  │ ResourcePool           │
│                    │  ──messages──►   │                        │
│ • name → metadata  │                  │ • name → GL resource   │
│ • type, source     │                  │ • renderer wrappers    │
│ • thumbnail        │                  │   (regl, Three, SwGL)  │
│ • saved in patch   │                  │ • refcount (optional)  │
└────────────────────┘                  └────────────────────────┘
```

Main thread owns metadata and persistence. Render worker owns GPU objects.

## Resource Types

| Type | GL Object | Creation | Use Case |
|------|-----------|----------|----------|
| `cubemap` | `textureCube` | 6 faces or equirect HDR | Environment maps, reflections, IBL |
| `texture3d` | `texture3D` | 3D array data or .cube file | Color grading LUTs, volume data, 3D noise |
| `hdr` | `texture2D` (float) | .hdr / .exr file | Environment lighting source |
| `model` | Buffers + metadata | .glb / .gltf | Shared geometry + materials |
| `buffer` | `WebGLBuffer` | TypedArray | Lookup tables, shared vertex data |

## How Resources Are Created

### Loader Nodes

Dedicated node types that load a file and register a resource:

- `res.cubemap` — loads 6 images or equirectangular HDR, registers cubemap
- `res.lut` — loads .cube file or image strip, registers 3D texture
- `res.model` — loads .glb/.gltf, registers model geometry
- `res.hdr` — loads HDR image, registers float texture

Each loader:
1. Accepts file via drag-drop, file picker, or VFS path
2. Sends raw data to render worker
3. Worker creates GL resource, stores in pool under node's resource name
4. Node has a "name" field in settings (defaults to node ID)
5. Resource exists while the loader node exists

Loader nodes have no video outlet. They have a single message outlet that emits the resource name (for programmatic use).

### Code API

Any render-pipeline node can create or access pool resources:

```javascript
// Create (typically in setup, not per-frame)
pool.createCubemap('sky', { faces: [px, nx, py, ny, pz, nz] });
pool.createTexture3D('noise', { data, width, height, depth });

// Access (in render code)
const envMap = pool.get('sky');      // returns renderer-appropriate object
const lut = pool.get('noise');
```

### Asset Panel (future)

UI sidebar for managing resources without nodes. Lower priority — loader nodes cover the same functionality.

## How Nodes Access Resources

### GLSL Nodes — Uniform Binding

The uniform extraction system already detects `samplerCube` and `sampler3D` types but ignores them today. Extend it:

1. Parser sees `uniform samplerCube envMap;`
2. Instead of creating a video inlet, show a **resource picker dropdown** in settings
3. Dropdown lists all pool resources of matching type (cubemaps for samplerCube, 3D textures for sampler3D)
4. At render time, worker binds the selected pool resource as the uniform

No new code API needed for GLSL — the existing uniform system handles it.

For `sampler2D` uniforms, keep the current behavior (video inlet). Only `samplerCube` and `sampler3D` use the pool.

### REGL Nodes — Direct Access

```javascript
const env = getResource('sky');  // returns regl texture (cubemap)
const drawSphere = regl({
  uniforms: { envMap: env },
  // ...
});
```

`getResource(name)` is added to the REGL node context alongside `getTexture(index)`.

### SwissGL Nodes — Sampler Wrapper

```javascript
const env = getResource('sky');  // returns TextureSampler wrapping the cubemap
glsl({ env, FP: `FOut = texture(env, reflect(rd, normal));` });
```

### Three.js Nodes — Three.js Object

```javascript
const envMap = getResource('sky');  // returns THREE.CubeTexture
scene.environment = envMap;
material.envMap = envMap;
```

Internally, `getResource` for Three.js nodes wraps the raw `WebGLTexture` using the same `properties.__webglTexture` trick that `threeRenderer.ts` already uses for input textures (lines 210-251).

### Hydra Nodes

Hydra's transform system doesn't support custom texture types. Pool resources aren't directly accessible from Hydra. Users can work around this by piping a cubemap face through a GLSL node into Hydra as a 2D texture.

## Renderer Wrappers

The pool stores raw `WebGLTexture` / `WebGLBuffer` objects. Each renderer needs a wrapper:

```typescript
class ResourcePool {
  private resources: Map<string, PoolResource> = new Map();
  
  // Lazy wrapper creation per renderer type
  private reglWrappers: Map<string, regl.Texture> = new Map();
  private threeWrappers: Map<string, THREE.Texture> = new Map();
  private swglWrappers: Map<string, TextureSampler> = new Map();
  
  getForRegl(name: string): regl.Texture | null { ... }
  getForThree(name: string): THREE.Texture | null { ... }
  getForSwgl(name: string): TextureSampler | null { ... }
}
```

Node renderers call the appropriate getter. The `getResource(name)` API exposed to user code dispatches to the right wrapper based on which renderer is executing.

## Resource Lifecycle

```
CREATE:   Loader node mounts or code calls pool.create()
          → main thread sends data to worker
          → worker creates GL resource, stores in pool
          → worker sends confirmation + metadata back

UPDATE:   Loader receives new file or code calls pool.update()
          → worker replaces GL resource in-place (same name)
          → wrappers are invalidated and recreated lazily
          → all nodes reading that name see new data next frame

DESTROY:  Loader node is deleted or code calls pool.remove()
          → worker destroys GL resource and all wrappers
          → nodes referencing it get fallback (1x1 black texture)
```

No reference counting. Resource lifetime is tied to the loader node's lifetime (node exists = resource exists). For code-created resources, they persist until explicitly removed or patch unloads.

## Persistence

Patch file stores resource metadata:

```json
{
  "resources": [
    { "name": "sky", "type": "cubemap", "source": "vfs://assets/env.hdr" },
    { "name": "film-lut", "type": "texture3d", "source": "vfs://assets/film.cube" }
  ]
}
```

Source files stored in VFS. On patch load, resources are recreated from source data.

## Cubemap-Specific: Equirectangular → Cubemap Conversion

Users will most commonly have equirectangular HDR images, not 6 separate face images. The loader needs a conversion step:

- Three.js has `PMREMGenerator` for this (generates prefiltered mipmap levels for IBL)
- Run once in the render worker when the resource is created
- Store both the raw cubemap and the PMREM-processed version (for IBL vs sharp reflections)

## 3D Texture: regl Limitation

regl doesn't wrap `texImage3D`. Options:
- Raw WebGL2 calls in the pool (bypass regl for 3D textures)
- Thin wrapper that creates a `WebGLTexture` and exposes it as a regl-compatible object
- SwissGL already handles its own texture types — can access raw GL texture directly

The pool should use raw GL for resource creation and provide renderer-specific wrappers on top.

## Message Protocol (Main ↔ Worker)

```typescript
// Main → Worker
type ResourceMessage =
  | { type: 'createResource'; name: string; resourceType: ResourceType; data: ArrayBuffer | ImageBitmap[] }
  | { type: 'updateResource'; name: string; data: ArrayBuffer | ImageBitmap[] }
  | { type: 'destroyResource'; name: string }
  | { type: 'listResources' }

// Worker → Main
type ResourceResponse =
  | { type: 'resourceCreated'; name: string; metadata: ResourceMetadata }
  | { type: 'resourceDestroyed'; name: string }
  | { type: 'resourceError'; name: string; error: string }
  | { type: 'resourceList'; resources: ResourceMetadata[] }
```

## What This Does NOT Cover

- Animated resources (video textures are already handled by the FBO pipeline)
- Compute buffer sharing (see spec 110 for WebGPU bridge)
- Material definitions as resources (materials are too renderer-specific; use presets)
