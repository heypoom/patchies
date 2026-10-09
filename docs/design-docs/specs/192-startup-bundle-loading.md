# 192. Startup Bundle Loading

## Goal

Reduce initial patcher downloads by keeping optional payloads behind the user actions that need them.

## Loading boundaries

- Keep Vite preload and CommonJS interoperability helpers in a small neutral runtime chunk. Optional library chunks must not become startup dependencies merely because they own shared helpers.
- Use explicit manual chunk membership so dependency closure does not absorb shared runtime modules into optional library chunks. Let CodeMirror language, Vim, and Strudel imports remain independent instead of grouping whole package families together.
- Keep Greggman pack names and size folders in a lightweight generated metadata module. Keep its 504 formula payloads in an independently imported module.
- Load enabled optional preset payloads only while the object browser or object autocomplete is open. Enabling a pack while either surface is open must load its payload. Deduplicate concurrent loads, publish loaded presets into the existing built-in library, and allow retry after import failure.
- Keep preset names, node data, pack enablement, and saved patch representation unchanged. Disabled archive formulas must not download on startup.
- Import Lucide icons individually so development dependency optimization does not include the whole catalogue through the two package barrels.
- Import MediaBunny's decoder library on the first video file or URL load, in both main-thread and worker uses. Keep player creation synchronous so subsequent playback messages still find their player. Ignore a pending decoder import if its player is destroyed or its source is replaced before the import completes.
- Load Spectrum color controls only when a settings picker or inline color widget is opened. Share the loader, show pending/error states, and allow failed downloads to be retried.
- Load the browser Tailwind compiler and its CSS sources only when a DOM/Vue shadow container enables Tailwind. Preserve synchronous container creation and shared compilation. Disabling Tailwind while loading must prevent stale styles and observers from being installed.
- Hide DOM/Vue preview content while enabled Tailwind is initializing, preserving its layout measurements. Reveal it only after the initial utility stylesheet is installed, or immediately when Tailwind is disabled.
- Keep node implementations that register runtime message callbacks synchronous. Defer their editor internals independently; a full node-registry split requires coordinated runtime initialization so startup messages cannot arrive before receivers mount.
- Keep the shared CodeEditor entry lightweight and import its CodeMirror implementation only when rendered. Forward reactive props, value binding, and cursor insertion. Preserve readiness callbacks and undo commits. Build expression keymaps/focus extensions only after the editor opens, so preview-only expression nodes do not import CodeMirror. Cancel delayed editor initialization when the surface is closed before language/Vim loading finishes.
- Keep Patchbay range analysis/tokenization independent of runtime CodeMirror imports; load its completion extensions only when an inline, sidebar, or detached editor opens. Load Assembly editor implementation and Strudel CodeMirror APIs inside their editor lifecycles.

## Verification

- Exercise lazy editor readiness, reactive values, cursor insertion, extension retry, destruction during initialization, Assembly callbacks, and detached undo commits. Verify restored expression previews do not download the editor until opened.
- Exercise color-picker input and download retry, shadow utility updates, and disabling/re-enabling Tailwind during initialization.
- Exercise enabled-pack loading, concurrent demand, payload publication, and retry after failure.
- Build production and inspect the page's static import graph: Greggman and Butterchurn payloads must be absent, and app bootstrap must depend only on neutral preload helpers rather than CodeMirror.
- Compare the initial JavaScript graph against the October 7 reports. Record remaining eager dependencies separately from improvements.
