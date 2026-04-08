# 115. Geometry as a Wire Type

## Problem

Every 3D scene lives inside a single Three.js code block. You can't wire a mesh from one node into another node's scene. There's no way to compose 3D scenes visually — no separate "generate geometry" → "transform" → "render" chain.

The only data crossing wires today is 2D RGBA textures (video) and messages. Geometry, vertex buffers, and scene objects are trapped inside individual nodes.

## Design: Messages with Auto-Caching Inlets

Geometry uses the existing **message infrastructure** for transport, with one addition: **geometry inlets auto-cache the last received geometry message**. Consumer nodes read from the cache whenever they need it.

```
Producer:  node mounts → compute geometry → send({ type: 'geometry', ... })
           parameter changes → recompute → send again

Consumer:  geometry inlet receives message → auto-caches it
           render loop reads from cache via getGeometry(inletIndex)
```

This means:
- **No new evaluation model** — messages handle delivery, inlets handle persistence
- **No GeometryStore** — the inlet itself is the cache
- **Any node can produce geometry** — anything that can `send()` can output geometry
- **Ordering is natural** — consumer has no geometry until first message arrives (same as video showing black before upstream renders). When producer mounts and sends, consumer picks it up.
- **No missed messages** — the cache always holds the latest value

### Why This Works (and why pure messages without caching don't)

Pure push-based messages have timing problems — consumer mounts before producer, misses the initial send, needs replay protocols. But messages + auto-caching on the inlet solves this: the value persists at the inlet once received. The consumer doesn't need to be listening at the exact moment the producer sends — it reads from the cache whenever it renders.

This gives us pull-like semantics (read when needed) with push-based transport (send on change). The inlet cache bridges the gap.

## Data Types

### GeometryData

```typescript
interface GeometryAttribute {
  data: Float32Array | Int32Array | Uint32Array;
  itemSize: number;          // 1=scalar, 2=vec2, 3=vec3, 4=vec4
  domain: 'point' | 'face';  // what each element corresponds to
}

interface GeometryData {
  type: 'geometry';            // message type tag
  vertexCount: number;
  indices?: Uint32Array;
  topology: 'triangles' | 'lines' | 'points';
  attributes: Record<string, GeometryAttribute>;
  bounds?: { min: [number, number, number]; max: [number, number, number] };
}
```

`position`, `normal`, `uv`, `color` are conventionally-named attributes — not special fields. Any node can attach arbitrary per-vertex or per-face data (velocity, temperature, age, density, selection masks) by adding named attributes.

**Convention**: Standard attribute names for interop:

| Name | Item Size | Domain | Description |
|------|-----------|--------|-------------|
| `position` | 3 | point | Vertex positions (required) |
| `normal` | 3 | point | Vertex normals |
| `uv` | 2 | point | Texture coordinates |
| `color` | 4 | point | Vertex colors (RGBA) |
| `velocity` | 3 | point | Per-vertex velocity (particles/sim) |
| `age` | 1 | point | Per-vertex age (particles) |
| `selection` | 1 | point | Boolean mask (0 or 1) for selective operations |

Nodes that produce/consume geometry should use these names when applicable so they interoperate. Custom attributes use any other name.

### InstancedGeometryData

```typescript
interface InstancedGeometryData {
  type: 'geometry';
  kind: 'instanced';
  base: Omit<GeometryData, 'type'>;     // the mesh to instance
  count: number;                          // number of instances
  instanceAttributes: Record<string, GeometryAttribute>;  // per-instance data
}
```

Required instance attributes:
- `position` (vec3) — instance positions

Optional:
- `rotation` (vec4, quaternion) — per-instance rotation
- `scale` (vec3 or scalar) — per-instance scale
- Any custom attribute (color, age, etc.)

**Union type**:

```typescript
type GeometryPayload = GeometryData | InstancedGeometryData;
```

Consumer nodes check `kind` to determine how to render. `GeometryData` has implicit `kind: 'mesh'`.

## Geometry Handle Type

Add `geometry` as a handle type alongside `video`, `audio`, `message`.

**Handle colors**: Green (video=orange, audio=blue, message=gray, geometry=green)

The handle type provides:
- **Visual distinction** — green wires say "this is geometry" at a glance
- **Connection validation** — prevent wiring geometry into a node that expects a string or bang
- **Auto-caching behavior** — geometry inlets store the last received geometry message; regular message inlets don't

Under the hood, geometry edges use the message transport. The handle type is metadata that enables caching and validation.

## Producing Geometry

**Any node that can `send()` can produce geometry.** No special node type required.

### From a `js` / `worker` node

```javascript
// Build a displaced sphere
const count = 1000;
const positions = new Float32Array(count * 3);
const normals = new Float32Array(count * 3);
const velocities = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
  const theta = Math.acos(2 * Math.random() - 1);
  const phi = Math.random() * Math.PI * 2;
  const r = 1 + noise3D(theta, phi, time) * 0.3;

  positions[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
  positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
  positions[i * 3 + 2] = r * Math.cos(theta);
  // ... normals, velocities
}

send({
  type: 'geometry',
  vertexCount: count,
  topology: 'points',
  attributes: {
    position: { data: positions, itemSize: 3, domain: 'point' },
    normal:   { data: normals,   itemSize: 3, domain: 'point' },
    velocity: { data: velocities, itemSize: 3, domain: 'point' },
  }
});
```

### From a `geo.*` preset

`geo.box`, `geo.sphere`, etc. are `js` node presets — not dedicated node types. They use the settings API for parameter sliders and `settings.onChange` to auto-send on parameter change. No custom Svelte component needed.

### Transforming geometry

A transform node has both a geometry inlet and a geometry outlet. It reads from the inlet cache, transforms, and sends the result:

```javascript
// geo.transform node (or a js node doing the same thing)
onMessage((msg) => {
  if (msg.type !== 'geometry') return;

  const pos = msg.attributes.position.data;
  const out = new Float32Array(pos.length);

  for (let i = 0; i < msg.vertexCount; i++) {
    // displace along normals using noise
    const n = msg.attributes.normal.data;
    const d = noise3D(pos[i*3], pos[i*3+1], pos[i*3+2]) * 0.2;
    out[i*3]     = pos[i*3]     + n[i*3]     * d;
    out[i*3 + 1] = pos[i*3 + 1] + n[i*3 + 1] * d;
    out[i*3 + 2] = pos[i*3 + 2] + n[i*3 + 2] * d;
  }

  send({
    ...msg,
    attributes: {
      ...msg.attributes,
      position: { data: out, itemSize: 3, domain: 'point' },
    }
  });
});
```

## Consuming Geometry

### `getGeometry(inletIndex)` API

Render nodes (Three.js, REGL, etc.) read from the geometry inlet cache:

```javascript
// In a Three.js node
const geo = getGeometry(0);  // returns THREE.BufferGeometry from cached inlet data
if (geo) {
  const mesh = new THREE.Mesh(geo, material);
  scene.add(mesh);
}
```

`getGeometry(index)` reads the cached `GeometryPayload` from the inlet, converts to the renderer's native format:
- **Three.js**: `THREE.BufferGeometry` (or `THREE.InstancedMesh` for instanced data)
- **REGL**: `{ attributes, elements, instances }` for draw commands
- **GLSL/SwissGL**: vertex buffers for custom draw calls

The conversion result is cached and only rebuilt when a new geometry message arrives at the inlet.

### Transfer to render worker

When a Three.js or REGL node (running in the render worker) needs geometry:
1. Main thread receives geometry message at the inlet cache
2. TypedArrays are transferred to the render worker (transferable, zero-copy)
3. Worker builds GPU buffers from the TypedArrays
4. Subsequent frames reuse GPU buffers until a new geometry message arrives

## Instancing

A `geo.instance` node takes a base geometry + point cloud and outputs `InstancedGeometryData`:

```
[geo.tree]    ──geometry──► [geo.instance] ──geometry──► [render]
[geo.scatter] ──geometry──┘
```

The scatter node outputs a point cloud (topology: `'points'`, with `position` + optional `rotation`, `scale` attributes). The instance node reads those points and produces instanced geometry.

**Three.js mapping**: `InstancedGeometryData` → `THREE.InstancedMesh` + `THREE.InstancedBufferAttribute`

**REGL/GLSL mapping**: Instanced draw calls with per-instance attribute buffers. REGL supports `instances` property natively.

## Staged Approach

### Stage 1: Texture-Encoded Geometry (builds on specs 105+106)

Encode geometry as float textures — position, normal, UV maps. No new wire type needed. A GLSL or SwissGL node outputs float32 textures (spec 112) via MRT (spec 111), and a downstream Three.js node reads them as vertex data.

**What it covers**: Point clouds, particle systems, displacement-driven meshes — anything where vertex count maps to pixel count.

**How it works**:
- Generator node outputs via MRT: position texture (rgba32f) + normal texture (rgba32f) + UV texture (rgba16f)
- Three.js render node reads input textures, creates `DataTexture`, samples in vertex shader or builds `BufferGeometry` from pixel readback
- Convention: texture width × height = vertex count. Row-major layout.

**Limitations**: No index buffers (no shared vertices), no topology (triangles must be implicit), texture size limits cap vertex count.

### Stage 2: Geometry Handle + Auto-Caching Inlets

The core of this spec. Add the geometry handle type, auto-caching inlets, and `getGeometry()` API.

### Stage 3: Geometry Presets

All geometry operators are **`js` node presets**, not dedicated node types. They use the settings API for parameter sliders and `settings.onChange` + `onMessage` to re-send when parameters or upstream geometry changes.

**Common pattern for geometry operator presets:**

```javascript
let cachedInput = null;

onMessage((msg) => {
  if (msg.type === 'geometry') {
    cachedInput = msg;
    reprocess();
  }
});

settings.onChange(() => {
  if (cachedInput) reprocess();
});

function reprocess() {
  // transform, merge, subdivide, etc.
  send(processedGeometry);
}
```

**Generators** (no geometry inlet, output only):
- `geo.box`, `geo.sphere`, `geo.plane`, `geo.torus` — parameter sliders via settings API, send on mount + change
- `geo.import` — loads .glb/.obj via VFS, sends geometry
- Any `js`/`worker` node can also produce geometry

**Transforms** (geometry in → geometry out):
- `geo.transform` — translate/rotate/scale
- `geo.merge` — concatenate multiple geometries (multiple geometry inlets)
- `geo.subdivide` — subdivision surface (wraps a library)
- `geo.extrude` — extrude 2D path to 3D

**Instancing**:
- `geo.instance` — takes base geometry + point cloud, outputs instanced geometry
- `geo.scatter` — distributes points on a surface

**Consumers**:
- Three.js / REGL nodes with geometry inlets — call `getGeometry()` to read cached geometry

If a specific operator later needs custom UI beyond settings sliders (e.g. a visual path editor for extrude), promote that one to a dedicated node type. Until then, presets cover everything.

### Rendering Geometry

No dedicated render node needed. A Three.js preset ("geometry viewer" or "3D preview") handles this in ~20 lines:

```javascript
const { Scene, PerspectiveCamera, Mesh, MeshNormalMaterial,
        DirectionalLight, AmbientLight } = THREE;

const scene = new Scene();
const camera = new PerspectiveCamera(45, width / height, 0.1, 100);
camera.position.set(0, 2, 5);
scene.add(new DirectionalLight(0xffffff, 1.5));
scene.add(new AmbientLight(0x404040));

const material = new MeshNormalMaterial();
let mesh;

function draw(t) {
  const geo = getGeometry(0);
  if (geo && (!mesh || mesh.geometry !== geo)) {
    if (mesh) scene.remove(mesh);
    mesh = new Mesh(geo, material);
    scene.add(mesh);
  }
  renderer.render(scene, camera);
}
```

Wire geometry in, see it rendered. The preset outputs video into the FBO pipeline like any other Three.js node — downstream post-processing, feedback, compositing all work.

Users fork the preset for more control: swap in a PBR material with `@slot` textures (spec 118), add orbit controls, use an environment cubemap from the resource pool (spec 117), accept multiple geometry inlets for scene composition. It's just a Three.js node.

## What This Does NOT Cover

- Material as a wire type (too renderer-specific — use messages or presets)
- Scene graph hierarchy (parent-child transforms — flatten to world space on the wire)
- Per-element field evaluation (Blender's lazy per-vertex expression graphs — use `js`/`worker` nodes for per-vertex logic instead)
- Edge domain (per-edge attributes and operations — defer to v2)
- Curves as a geometry primitive (bezier/NURBS — defer to v2)
- Animation/skinning (complex, defer to later)

## Dependencies

- Stage 1 requires: spec 111 (MRT), spec 112 (float FBOs)
- Stage 2-3 are independent of the FBO pipeline
