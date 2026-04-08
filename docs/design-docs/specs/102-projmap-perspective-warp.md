# 102. Projmap Perspective Warp

Add per-surface perspective warping to the projection mapping node. Each surface can operate in **warp** mode (default, 4-corner quad with perspective distortion) or **mask** mode (existing freeform polygon clipping).

## Current State

- Surfaces are arbitrary N-point polygons rendered via Three.js `ShapeGeometry`
- UV mapping is 1:1 (`uv = position + 0.5`) — texture is clipped, not warped
- Editor supports freeform point add/move/delete

## Design

### Data Model

Add `mode` field to `ProjMapSurface`:

```typescript
export type ProjMapSurfaceMode = 'warp' | 'mask'

export interface ProjMapSurface {
  id: string
  mode: ProjMapSurfaceMode // default: 'warp'
  points: ProjMapPoint[] // warp: exactly 4 corners (TL, TR, BR, BL); mask: N points
}
```

- New surfaces default to `mode: 'warp'` with 4 corners forming a centered rectangle
- Existing surfaces without `mode` field default to `'mask'` for backward compatibility
- Corner order for warp: top-left, top-right, bottom-right, bottom-left

### Renderer Changes (`ProjectionMapRenderer.ts`)

`buildSurfaceMesh()` branches on `surface.mode`:

**Mask mode** — existing `ShapeGeometry` path (unchanged).

**Warp mode** — subdivided `PlaneGeometry` with bilinear vertex interpolation:

1. Create `PlaneGeometry(1, 1, subdivisions, subdivisions)` (e.g., 20×20)
2. For each vertex at parametric `(u, v)` in `[0,1]²`:
   - Bilinearly interpolate position from 4 corners:

     ```text
     x = (1-u)(1-v)*c0 + u*(1-v)*c1 + u*v*c2 + (1-u)*v*c3
     ```

   - Set vertex position to interpolated screen coordinate
   - UV stays at `(u, v)` — texture maps uniformly across the warped quad
3. Use `MeshBasicMaterial` with the input texture (same as mask)

This gives visually correct perspective distortion with enough subdivisions. No custom shaders needed.

### Editor Changes

**Warp mode:**

- Surface starts with 4 corners pre-placed (centered rectangle with margin)
- No add/delete points — only drag the 4 corners
- Corner labels: TL, TR, BR, BL (or 1-4)
- Edit modes: only "move" makes sense (no "add" mode for warp surfaces)

**Mask mode:**

- Unchanged from current behavior (freeform add/move/delete)

**Mode toggle:**

- Per-surface toggle in context menu and overflow menu: "Switch to warp/mask mode"
- Switching warp→mask: keep the 4 points as the polygon
- Switching mask→warp: take bounding box corners of existing polygon (or first 4 points if exactly 4)

### UI Indicators

- Warp surfaces show corner handles as squares (vs circles for mask points)
- Different label style: "TL TR BR BL" vs numeric "1 2 3 4"

## Implementation Plan

### Step 1: Data model + defaults

- Add `ProjMapSurfaceMode` type and `mode` field to `ProjMapSurface`
- Update `addSurface()` to create warp surfaces with 4 default corners
- Backward compat: surfaces without `mode` → `'mask'`

### Step 2: Renderer — warp mesh

- Add `buildWarpMesh()` method to `ProjectionMapRenderer`
- Branch in `buildSurfaceMesh()` on `surface.mode`
- Bilinear interpolation for subdivided plane vertices

### Step 3: Editor — warp corner dragging

- In warp mode: skip add-point logic, only allow corner dragging
- Constrain to exactly 4 points (no add/delete)
- Update SVG rendering for square corner handles

### Step 4: Mode toggle UI

- Add toggle to context menu and overflow menu
- Handle mode switching with point conversion logic

### Step 5: Expanded editor

- Same warp/mask branching for the expanded editor SVG

## Files to Modify

1. `ui/src/objects/projmap/types.ts` — add mode type
2. `ui/src/objects/projmap/ProjectionMapRenderer.ts` — add `buildWarpMesh()`
3. `ui/src/objects/projmap/ProjectionMapNode.svelte` — warp editor behavior + mode toggle
4. `ui/src/objects/projmap/ProjectionMapExpandedEditor.svelte` — same warp rendering
5. `ui/src/objects/projmap/ProjectionMapContextMenu.svelte` — mode toggle item
6. `ui/src/objects/projmap/ProjectionMapOverflowMenu.svelte` — mode toggle item
7. `ui/src/objects/projmap/constants.ts` — default warp corners
