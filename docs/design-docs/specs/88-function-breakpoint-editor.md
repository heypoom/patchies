# 88. Function Breakpoint Editor

## Overview

A `function` node that provides an interactive breakpoint/curve editor, inspired by Max/MSP's `function` object. Users place breakpoints on a 2D canvas and connect segments with either straight lines or smooth Catmull-Rom curves.

## Node Type

`function` — visual node (not a text object).

## Data Shape

```ts
{
  points: { x: number; y: number }[];  // normalized 0–1, always sorted by x
  mode: 'linear' | 'curve';            // segment interpolation mode
}
```

Default: `points: [{x:0, y:0}, {x:1, y:1}]`, `mode: 'linear'`

## UI / Interaction

- **SVG-based** editor, resizable (default 200×150, min 100×80)
- **Add point**: click/tap on the background SVG area
- **Move point**: drag (pointer capture on point circle)
  - Endpoint x-values (x=0, x=1) are locked; only Y moves
  - Middle points: X clamped between neighbors (±0.001 epsilon), Y clamped 0–1
- **Delete point**: double-click a non-endpoint point
- **Settings panel**: gear icon (appears right of node when selected/hovered)
  - Mode toggle: `linear` / `curve`
  - Reset button (restores two endpoint defaults)
- **Undo/redo**: committed via `useNodeDataTracker` on each add/move/delete/mode-change

## Message API

| Inlet message        | Effect                                                       |
|----------------------|--------------------------------------------------------------|
| `float` (0–1)        | Evaluate the curve at X, send Y from outlet                  |
| `bang`               | Output breakpoints as flat list `[x1, y1, x2, y2, …]`       |
| `[x1, y1, x2, y2…]` | Set all breakpoints from the list (replaces existing points) |
| `reset`              | Reset to default `[{x:0,y:0},{x:1,y:1}]`                    |

Outlet always sends a `number` (float query result) or `number[]` (bang).

## Curve Modes

### Linear
Straight line segments: `M x0,y0 L x1,y1 L x2,y2 …`

### Curve
Catmull-Rom spline (passes through all breakpoints, no overshooting with uniform alpha):
- Convert to cubic bezier per segment:
  - For segment P1→P2 (P0 before, P3 after):
    - CP1 = P1 + (P2 - P0) / 6
    - CP2 = P2 − (P3 - P1) / 6
  - Boundary: P0=P1 for first segment, P3=P2 for last segment
- Output as SVG cubic bezier: `C cp1x,cp1y cp2x,cp2y x2,y2`

## Curve Evaluation (for float queries)

```ts
evaluate(x: number, points: Point[], mode: 'linear' | 'curve'): number
```

- Clamp x to [0,1]
- Find bracketing segment by scanning sorted points
- **Linear**: lerp(y0, y1, t) where t = (x - x0) / (x1 - x0)
- **Curve**: Catmull-Rom evaluation — solve cubic using the same Bezier parameterization

## File Locations

- Component: `ui/src/lib/components/nodes/FunctionNode.svelte`
- Node registry: `ui/src/lib/nodes/node-types.ts`
- Defaults: `ui/src/lib/nodes/defaultNodeData.ts`
- Pack: `ui/src/lib/extensions/object-packs.ts` (starters)
- Description: `ui/src/lib/components/object-browser/get-categorized-objects.ts`
- Docs: `ui/static/content/objects/function.md`
- AI prompts: `ui/src/lib/ai/object-descriptions-types.ts`
