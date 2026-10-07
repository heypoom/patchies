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

## Verification

- Exercise enabled-pack loading, concurrent demand, payload publication, and retry after failure.
- Build production and inspect the page's static import graph: Greggman and Butterchurn payloads must be absent, and app bootstrap must depend only on neutral preload helpers rather than CodeMirror.
- Compare the initial JavaScript graph against the October 7 reports. Record remaining eager dependencies separately from improvements.
