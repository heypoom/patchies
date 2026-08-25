# Shared Pixi DOM Renderer

## Objective

Replace the per-node `pixi.dom` WebGL application with a shared Pixi
multi-view renderer so a patch can contain many interactive Pixi DOM nodes
without exhausting the browser's WebGL-context limit.

## Key Challenges & Solutions

- Pixi multi-view renders through one off-DOM WebGL canvas, then copies each
  frame into a node canvas. Transparent pixels otherwise preserve the previous
  2D canvas contents. Clear the node canvas before every render.
- Pixi's native event system has one current root target. Route every native
  canvas event through the shared system while temporarily selecting that
  entry's stage and canvas for hit testing and coordinate conversion.
- A node rerun must preserve the shared renderer. Clear only the rerun node's
  stage children before evaluating new code.

## What Could Be Better

- The event routing uses Pixi renderer internals because Pixi 8.10 does not
  expose per-view event roots as a public multi-view API. It needs manual
  testing with at least two clickable nodes before treating it as settled.
- The manager stays alive after its last node is removed. Add an idle teardown
  policy only if retained GPU resources become measurable.

## Action Items

- Independent hover and click behavior was verified across two `pixi.dom`
  nodes. Verify drag and wheel behavior before expanding the interaction API.
- Measure frame time with many active DOM nodes and decide whether inactive
  nodes should skip rendering.
