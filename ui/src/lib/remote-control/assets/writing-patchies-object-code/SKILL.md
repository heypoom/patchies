---
name: writing-patchies-object-code
description: Write or debug Patchies object code in a Remote Control mount, including JavaScript, visual shaders, audio code, and shared patch modules. Use when editing files under objects/ or patch/ for a live Patchies patch.
---

# Writing Patchies Object Code

## Locate the live source

The mount root is three directories above this skill. Resolve all links below
relative to this file, not the terminal's current directory.

- [objects/](../../../objects/) contains the represented source of existing canvas
  objects, grouped by object ID. Inspect the target folder and its current code
  before editing; preserve the object's identity and existing behavior outside
  the requested change.
- [patch/](../../../patch/) mirrors `patch://`. For example, `patch/lib/math.js`
  is `patch://lib/math.js` inside Patchies. Edit existing shared modules and text
  files here; they are embedded in the patch, not Node.js files on the host.
- [references/](../../../references/) contains the documentation and prompts for
  this running version of Patchies. Search filenames, then read the relevant
  files rather than loading the whole directory.

This mount syncs saves to existing files only. Ask the user to create missing
objects, connections, or Patch files in the browser first. Local creation,
deletion, and rename do not perform those operations on the patch. `user://`
assets and the graph's wiring are not exposed by this mount. When connections
or runtime errors matter, request that context unless a separately available
tool can inspect it. Questions and explanations alone do not require edits.

## Read the object's contract, then edit

1. Identify the target object's type and read its file in
   [prompts/](../../../references/prompts/) and its human-facing page in
   [docs/objects/](../../../references/docs/objects/). Match by type slug, such
   as `hydra.md`, `p5.md`, or `glsl.md`; operators use `add`, `sub`, `mul`, and
   `div`. If no prompt exists, use the object page and report missing API context.
2. Follow the topic pointers below for the APIs the change uses. Confirm that
   the target supports them: an expression evaluator is not a full JSRunner,
   and a worker-based visual object does not have the same APIs as a DOM object.
3. Edit source code in the existing file's language, not the JSON object-data
   envelope shown in some generation prompts. Use the mounted docs for API
   signatures and available capabilities; the embedded assistant's tool names
   are not commands available through this mount.
4. Save the requested changes. Patchies must stay open; object saves may execute
   immediately and affect live audio or visuals. Writes use VFS undo history.
   Check available runtime feedback, or ask the user to test in Patchies and
   share errors. A successful local write or syntax check alone does not prove
   runtime success. Report what changed and what was actually verified.

## Day-to-day JavaScript and patch files

Read the relevant pages before using these features:

- [JavaScript runner](../../../references/docs/topics/javascript-runner.md):
  supported objects, message APIs, timers, top-level await, and cleanup on rerun.
- [Message passing](../../../references/docs/topics/message-passing.md): message
  shapes, inlet/outlet routing, and named channels.
- [Object settings](../../../references/docs/topics/object-settings.md): define
  artist-facing parameters, read values, and respond to setting changes.
- [JS integrations](../../../references/docs/topics/js-integrations.md): VFS,
  audio analysis, clock, AI, presentation, and other runtime integrations.
- [JS modules](../../../references/docs/topics/js-modules.md): npm imports and
  reusable `patch://` modules. Canvas object scripts are not importable modules.
- [Virtual filesystem](../../../references/docs/topics/virtual-filesystem.md):
  resolve assets and embedded files. Use explicit `patch://` paths when needed;
  relative JavaScript VFS paths and GLSL includes have different defaults.
- [Data storage](../../../references/docs/topics/data-storage.md): persistent
  node-scoped and shared key-value data; this is separate from mounted files.

## Visual work

- [Video chaining](../../../references/docs/topics/video-chaining.md): texture
  inputs, composition, sizing, and output routing.
- [Rendering pipeline](../../../references/docs/topics/rendering-pipeline.md):
  worker versus main-thread execution and rendering performance constraints.
- [GLSL imports](../../../references/docs/topics/glsl-imports.md): shader
  includes, shared `patch://` helpers, supported objects, and import resolution.

## Audio and timing work

- [Audio chaining](../../../references/docs/topics/audio-chaining.md): audio
  signal paths and outputs; distinguish audio cables from control messages.
- [Clock API](../../../references/docs/topics/clock-api.md): beat synchronization,
  scheduling, subdivisions, and choosing timing APIs for audio versus visuals.
- [Transport control](../../../references/docs/topics/transport-control.md):
  playback state, tempo, seeking, and how objects follow transport.
- [Audio reactivity](../../../references/docs/topics/audio-reactivity.md): FFT
  and frequency-band analysis for audio-driven visuals, including shader inputs.
- [Parameter automation](../../../references/docs/topics/parameter-automation.md):
  supported parameter messages, ramps, triggers, release, and compatible nodes.
