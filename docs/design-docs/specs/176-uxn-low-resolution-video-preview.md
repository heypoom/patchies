# 176. Uxn Low-Resolution Video Preview

## Problem

Each Uxn node with an outgoing video connection creates and transfers a full-resolution `ImageBitmap` from its screen canvas on every animation frame. Patches that chain many Uxn nodes therefore spend substantial CPU, GPU, and transfer bandwidth on video data that is commonly viewed only as small node previews.

## Design

Uxn adds a persisted **Low Video Resolution** toggle in its overflow menu. When enabled, Uxn downsizes the bitmap it sends to the render worker with the shared `capPreviewSize()` rule: it fits within the same 252×164 maximum box used by visual-node previews and preserves the Uxn screen's aspect ratio. Pixelated scaling preserves Uxn's intended crisp pixels.

The Uxn screen uses the shared visual-preview height (164 px) in the editor while its canvas backing buffer remains at the program-selected native resolution. Its width derives from the ROM's native aspect ratio, so there are no black bars, cropping, or stretching. A `ResizeObserver` refreshes React Flow's node bounds when a ROM changes screen dimensions. Keyboard and mouse interaction, screen rendering, and programs that change their screen size are unaffected. The image supplied through the Uxn video outlet uses the same reduced dimensions, so downstream video processing and previews trade sharpness for performance.

The setting defaults to off to preserve existing patches. It is persisted in node data and participates in undo/redo.

## Files Affected

| File | Change |
| --- | --- |
| `ui/src/objects/uxn/UxnNode.svelte` | Persist the setting and resize outgoing bitmap frames |
| `ui/src/objects/uxn/uxn/UxnFullLayout.svelte` | Expose the menu toggle |
| `ui/src/objects/default-node-data.ts` | Set the default |
| `ui/static/content/objects/uxn.md` | Document the performance control |
