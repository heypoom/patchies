# 100. HTML-in-Canvas DOM Prototype

**Status**: Prototype

---

## Overview

This prototype explores whether Chromium's experimental HTML-in-Canvas API can turn Patchies `dom` nodes into optional video sources while keeping their main-thread DOM interactivity.

The first pass proved the `dom` path is feasible. The shared HTML-in-Canvas plumbing should now live in a small library so `dom` and `vue` can use the same capture, sizing, video registration, and worker-transfer behavior.

---

## Goals

- Add an opt-in `htmlCanvas.videoOutput()` API to the `dom` and `vue` objects.
- Add independent `htmlCanvas.canvasLayer()` and `htmlCanvas.glslLayer()` APIs to the `dom` and `vue` objects for local main-thread post-processing that does not register video output.
- Preserve existing `dom` and `vue` behavior unless the user opts in.
- Share HTML-in-Canvas lifecycle code between objects instead of duplicating it.
- Render the DOM root into a `layoutsubtree` canvas with `drawElementImage()`.
- Capture the DOM root as a transferable `ElementImage` and draw it in the render worker.
- Surface whether the current browser supports the experimental API.

---

## Non-Goals

- No compatibility fallback that emulates HTML-in-Canvas with `html2canvas` or SVG.

---

## Proposed Runtime Shape

When `htmlCanvas.videoOutput()` is called, the node registers as an external `img` video source, shows a video outlet, and wraps the user root in a `<canvas layoutsubtree>`. `htmlCanvas.videoOutput()` uses the current Patchies render output size by default, `htmlCanvas.videoOutput(false)` disables the output, and `htmlCanvas.videoOutput({ size: "free" })` lets the DOM content choose its own source size before Patchies fits it into the render output.

The user's root element must be a direct child of the canvas because `drawElementImage()` and `captureElementImage()` require that relationship. The canvas `paint` handler draws the root, applies the returned transform to the root for hit testing and accessibility alignment, captures the root as an `ElementImage`, and transfers that snapshot to the render worker. The worker draws the snapshot into an `OffscreenCanvas`, converts it to an `ImageBitmap`, and reuses the existing external texture upload path.

Browsers without `layoutsubtree`, `requestPaint()`, `captureElementImage()`, and `drawElementImage()` support should log a clear warning and leave the node usable as a normal DOM interface.

`dom` and `vue` should each keep ownership of their own code execution lifecycle. The shared library should only own HTML-in-Canvas concerns: API option parsing, support checks, size resolution, canvas paint setup, ElementImage capture, GL video source registration, and cleanup.

`htmlCanvas.canvasLayer(callback)` is independent from `htmlCanvas.videoOutput()`. It uses a local `<canvas layoutsubtree>` to draw the live DOM/Vue root with `drawElementImage()`, then runs the callback on the main thread with the same 2D canvas context plus `{ width, height, displayWidth, displayHeight, pixelRatio, time, delta }`. It should size from the live node surface, not from Patchies' render output size, and it should never register with the render worker or add a video outlet. `htmlCanvas.canvasLayer(false)` disables the local postprocess layer.

`htmlCanvas.glslLayer(fragmentShader)` uses the WebGL HTML-in-Canvas path from the WICG proposal. It creates a WebGL context on the local `layoutsubtree` canvas, uploads the live DOM/Vue root into `sampler2D source` via `texElementImage2D()`, and draws a fullscreen fragment shader using `mainImage(out vec4 fragColor, in vec2 fragCoord)`. `htmlCanvas.canvasLayer()` and `htmlCanvas.glslLayer()` are mutually exclusive because a canvas can only have one context type.

---

## Open Questions

- Does the current Chromium implementation reliably paint Shadow DOM content when the direct child is a shadow host?
- Should this become an option on `dom`/`vue`, or separate `dom.video`/`vue.video` objects?
- Does the worker-side `OffscreenCanvasRenderingContext2D.drawElementImage()` path avoid the expensive `createImageBitmap(canvas)` cost enough to justify making this a supported feature?
