# 149. Secondary Output Overlays And Input

## Problem

The secondary output route at `/output` is intentionally minimal today. It owns a
single canvas with a `bitmaprenderer` context and paints `ImageBitmap` frames
from the main render pipeline.

That works for bare fullscreen output, but it misses performance-oriented
surfaces that now exist in the main window:

- the detached code editor overlay used for display-first live coding
- the active `surface` overlay canvas
- pointer, wheel, and touch input that should drive an active `surface`

The secondary output window should mirror these surfaces without becoming a
second source of truth for patch state.

## Goals

- Mirror the active detached code editor overlay in `/output`.
- Keep the mirrored code editor display-only. It must not edit code or own a
  CodeMirror instance.
- Mirror the active `surface` overlay as a second bitmap layer above the render
  pipeline bitmap.
- Forward pointer, wheel, and touch input from `/output` back to the main window
  when an active surface wants input.
- Reuse the existing surface input semantics, including touch-to-mouse and
  pinch-to-wheel behavior.
- Keep all graph-aware behavior in the main window.

## Non-Goals

- Do not make the secondary code editor editable.
- Do not run `surface` user code inside `/output`.
- Do not duplicate `GLSystem`, `SurfaceMouseForwarder`, SvelteFlow graph state,
  or JavaScript runner state in the secondary window.
- Do not route surface overlay bitmap mirroring through the render worker.

## Current Architecture

`/output` receives frames from `IpcSystem.sendRenderOutput()`:

```text
render worker output bitmap
  -> GLSystem
  -> IpcSystem.sendRenderOutput(bitmap)
  -> /output bitmaprenderer canvas
```

The output route has no local patch graph, no render system, and no SvelteFlow
context. That boundary should stay intact.

The main window already owns:

- `activeCodeEditorTarget` and node data for detached editor overlays
- `SurfaceOverlay`, including the fullscreen overlay canvas
- `SurfaceNode` callbacks such as `onPointer()`, `onTouch()`, and `onKeyDown()`
- `SurfaceMouseForwarder`, including graph-aware mouse and wheel target lookup

## Design

### 1. Typed secondary-output IPC

Extend `IpcSystem` from a render-output sender into a small typed bridge between
the main window and `/output`.

Main to output:

```ts
type MainToOutputMessage =
  | { type: 'renderOutput'; bitmap: ImageBitmap }
  | { type: 'codeOverlayState'; state: CodeOverlayMirrorState | null }
  | { type: 'surfaceOverlayState'; state: SurfaceOverlayMirrorState | null }
  | { type: 'surfaceOverlayFrame'; bitmap: ImageBitmap };
```

Output to main:

```ts
type OutputToMainMessage =
  | { type: 'outputReady' }
  | { type: 'outputSurfacePointer'; event: SurfacePointerPayload }
  | { type: 'outputSurfaceWheel'; event: SurfaceWheelPayload }
  | { type: 'outputSurfaceTouch'; touches: SurfaceTouchPayload[] }
  | { type: 'outputSurfaceLeave' };
```

The exact types should live near `IpcSystem` so both windows use the same
contract.

### 2. Layered `/output` route

Replace the single output canvas with layered surfaces:

```text
base render canvas       bitmaprenderer, existing render pipeline frames
surface overlay canvas   bitmaprenderer, optional active surface mirror
code overlay DOM         optional display-only code mirror
```

The base render canvas remains the lowest layer and keeps the existing
`object-fit: cover` behavior.

The surface overlay canvas uses the same sizing and cover-fit normalization as
the base canvas so pointer coordinates map consistently to the render output.

The code overlay DOM should visually match `DetachedCodeEditorOverlay.svelte`:

- same translucent background color
- same fullscreen padding and CodeMirror-like typography
- same z-order above output visuals
- no edit cursor, no text input, and no run or close controls in `/output`

The main window remains responsible for closing, running, and editing.

### 3. Display-only code editor mirror

When the main window has an active detached code editor target in overlay mode,
it sends a serializable snapshot to `/output`:

```ts
type CodeOverlayMirrorState = {
  nodeId: string;
  dataKey: string;
  value: string;
  language: string;
  fontSizePx: number;
  transparency: number;
};
```

The mirror should render plain highlighted or preformatted code. It should not
instantiate `CodeEditor.svelte`, because the secondary window is display-only and
does not need CodeMirror state, completions, undo, focus, or keybindings.

For a first pass, preformatted text with the same layout CSS is acceptable.
Syntax highlighting can be added later if it can be done without making the
mirror interactive.

The main window sends `null` when the overlay closes, the target is deleted, or
the target switches to sidebar mode.

### 4. Surface overlay bitmap mirror

When a surface enters fullscreen mode, the main window keeps running that surface
exactly as it does today. The active `SurfaceNode` still switches its drawing
target to `SurfaceOverlay.canvas`, and user code still draws into that
main-window `HTMLCanvasElement`.

To mirror it to `/output`, the main window snapshots the active surface overlay
canvas and transfers the result directly to the output window:

```ts
const bitmap = await createImageBitmap(surfaceOverlay.canvas);

outputWindow.postMessage(
  { type: 'surfaceOverlayFrame', bitmap },
  { transfer: [bitmap], targetOrigin: '*' }
);
```

The output route paints this bitmap into its surface overlay `bitmaprenderer`
canvas.

This path is intentionally direct:

```text
main surface canvas
  -> createImageBitmap(canvas)
  -> postMessage transfer
  -> /output surface overlay canvas
```

It does not pass through the render worker:

```text
not: /output -> main -> surface -> render worker -> /output
```

#### Frame throttling

Surface overlay snapshots should be coalesced:

- at most one `createImageBitmap()` in flight
- at most one surface overlay frame sent per animation frame
- no frame sent when no secondary output window is connected
- no frame sent when no surface is active

`drawMode: 'always'` surfaces can request a mirror frame after each draw loop
tick. `drawMode: 'interact'` and `drawMode: 'manual'` surfaces can request a
mirror frame after `triggerDraw()` or `redraw()`.

If `createImageBitmap()` fails, log a debug warning and disable that one mirror
frame. Cross-origin tainted canvas content is the likely failure case.

### 5. Output surface input forwarding

The output route should only capture input while a mirrored surface is active.
When active, it normalizes local DOM input to the same 0-1 coordinate space used
by `SurfaceListeners`.

The output route sends normalized input payloads back to the opener:

```text
/output pointer, wheel, or touch
  -> normalized output IPC event
  -> main window active SurfaceNode
  -> SurfaceNode dispatchPointer / dispatchWheel / onTouch
  -> SurfaceMouseForwarder
  -> GLSystem mouse or wheel APIs
```

The main window remains canonical for:

- `mouse` state exposed to surface code
- `onPointer()` callbacks
- `onTouch()` callbacks
- forwarded render-node mouse targets
- Hydra global/local mouse scope
- Shader Park and Three wheel behavior

This avoids duplicated graph logic in `/output`.

### 6. Shared surface input normalization

The current `SurfaceListeners` class already handles:

- cover-fit coordinate normalization
- pointer move/down/up
- wheel events
- touch-to-mouse conversion
- delayed first-touch down
- pinch-to-wheel
- ignoring touch-origin `PointerEvent`s

To prevent drift, extract the reusable input logic from `SurfaceListeners` into
a small shared helper that can target either local callbacks or output IPC.

One possible shape:

```ts
type SurfaceInputSink = {
  pointer(event: PointerEvent_): void;
  wheel(event: SurfaceWheelEvent_): void;
  touch(touches: TouchPoint[]): void;
  leave(): void;
};

function attachSurfaceInputListeners(
  canvas: HTMLCanvasElement,
  sink: SurfaceInputSink
): () => void;
```

`SurfaceListeners` can become a thin wrapper around this helper that preserves
existing error handling for user callbacks. `/output` can use the same helper
with a sink that posts normalized IPC messages.

## Ordering

1. Add typed IPC helpers and message definitions.
2. Convert `/output` to layered canvases plus optional display-only code overlay.
3. Mirror detached code editor overlay state from main to output.
4. Mirror active surface overlay bitmap frames from main to output.
5. Forward normalized surface input from output to main.
6. Extract shared surface input listener logic and move both main and output
   input paths onto it.

The input helper extraction can happen before step 5 if that makes testing
cleaner.

## Testing

Unit tests:

- IPC message reducers update output route state correctly.
- Display-only code overlay escapes code text and does not expose editable
  controls.
- Surface input helper preserves existing touch-to-mouse and pinch-to-wheel
  behavior.
- Output-origin surface input messages call the same main-window surface dispatch
  path as local overlay input.

Manual checks:

- Open `/output`, enable background output, and verify the base bitmap still
  renders.
- Open a detached code editor overlay and verify `/output` mirrors it
  display-only.
- Enter surface fullscreen and verify `/output` shows the surface overlay above
  the render output.
- Drag on the output window and verify `surface` `onPointer()` and mouse-aware
  render nodes respond.
- Pinch or wheel on the output window and verify Shader Park or Three zoom
  behavior matches the main surface overlay.
- Close or reload either window and verify `outputReady` reattaches the bridge.

## Risks

- `createImageBitmap(HTMLCanvasElement)` is asynchronous and may copy pixels, so
  unthrottled pointermove mirroring could be expensive.
- Surface overlay mirroring can fail for tainted canvas content.
- Display-only code mirror syntax highlighting can drift from CodeMirror if it
  uses a separate highlighter.
- Two windows can disagree about viewport size. All mirrored layers must use the
  same cover-fit coordinate math as the existing output bitmap path.

## Open Questions

- Should the display-only code mirror include syntax highlighting in the first
  pass, or is matching layout and typography enough?
- Should `/output` show the detached editor mirror only when output target is
  `screen`, or any time an output window is connected?
- Should surface overlay mirroring be disabled automatically for very large
  output sizes if snapshot cost becomes visible?
