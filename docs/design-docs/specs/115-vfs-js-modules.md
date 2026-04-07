# 115. VFS JavaScript Modules

## Problem

GLSL snippets and Hydra functions live in VFS and are portable via snippet presets (specs 112, 114). JavaScript utilities have no equivalent — they can only be shared via `// @lib` nodes on the canvas, which are patch-local and not portable.

A user who builds JS utilities (camera rigs, geometry builders, math helpers) can't reuse them across patches without copy-pasting code between `// @lib` nodes.

## Solution

Support importing JS modules from VFS files alongside existing `// @lib` nodes. Both resolve through JSRunner's module system.

```javascript
// From a @lib node on the canvas (existing, unchanged)
import { rand } from 'utils';

// From a VFS file (new)
import { orbitCamera } from 'user://lib/camera.js';
```

## Why Keep Both

| | `// @lib` nodes | VFS JS modules |
|---|---|---|
| **Visible on canvas** | Yes — spatial, glanceable | No — lives in file browser |
| **Edit workflow** | Click node, edit in place | Open from VFS sidebar |
| **Portability** | Patch-local only | Portable via snippet presets (spec 114) |
| **Best for** | Patch-specific utils, live iteration | Stable libraries, reusable across patches |

Live coders benefit from `// @lib` — it's on the canvas, editable in the flow of performance. Stable utilities benefit from VFS — portable, invisible, out of the way.

## Implementation

### JSRunner Module Resolution

Extend the Rollup plugin's `resolveId` hook in `JSRunner.ts` to check VFS when a module isn't found in the `modules` Map:

```typescript
resolveId(source) {
  // Existing: check @lib modules
  if (this.modules.has(source)) return source;
  
  // New: check VFS paths
  if (source.startsWith('user://')) return source;
  
  // Existing: check npm: prefix
  if (source.startsWith('npm:')) return source;
  
  return null;
}

load(id) {
  // Existing: load from @lib modules
  if (this.modules.has(id)) return this.modules.get(id);
  
  // New: load from VFS
  if (id.startsWith('user://')) return vfs.readFile(id);
  
  return null;
}
```

VFS modules go through the same Rollup bundling pipeline as `// @lib` modules — tree-shaking, npm import resolution, etc.

### Re-Execution on Change

When a VFS JS file changes, all nodes that import from it should re-execute — same as how `// @lib` changes trigger re-execution of importers. JSRunner needs to track VFS file → importer node dependencies.

### Snippet Preset Integration

VFS JS modules are portable via snippet presets (spec 114). Same flow as GLSL/Hydra snippets:

1. Save `user://lib/camera.js` as a snippet preset
2. Import the preset in another patch → file copied to VFS
3. `import { orbitCamera } from 'user://lib/camera.js'` works

Folder presets work too — save `user://lib/` as a pack, import all JS modules at once.

## Examples

```javascript
// user://lib/camera.js
export function orbitCamera(THREE, camera, t, radius = 5) {
  camera.position.x = Math.cos(t * 0.1) * radius;
  camera.position.z = Math.sin(t * 0.1) * radius;
  camera.position.y = 2 + Math.sin(t * 0.05) * 1.5;
  camera.lookAt(0, 0, 0);
}

export function pulseCamera(camera, energy, baseRadius = 5) {
  const r = baseRadius - energy * 2;
  camera.position.setLength(r);
}
```

```javascript
// user://lib/geo-utils.js
export function scatterOnSurface(positions, normals, indices, count) {
  // ... random point sampling on triangle mesh
  return { positions: new Float32Array(...), normals: new Float32Array(...) };
}
```

Used in any JS-based node:

```javascript
// In a Three.js node
import { orbitCamera, pulseCamera } from 'user://lib/camera.js';

function draw(t) {
  orbitCamera(THREE, camera, t);
  renderer.render(scene, camera);
}
```

## Dependencies

- Extends JSRunner's existing module resolution (Rollup plugin)
- VFS read access from JSRunner (may already exist or need a small bridge)
- Portable via snippet presets (spec 114)
