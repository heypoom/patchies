/**
 * List of object types that use JSRunner and have common runtime functions.
 * Used to inject jsRunnerInstructions once at the call site instead of in each object prompt.
 */
export const JS_ENABLED_OBJECTS = new Set([
  'js',
  'worker',
  'p5',
  'hydra',
  'canvas',
  'canvas.dom',
  'three',
  'three.dom',
  'dom',
  'vue',
  'sonic~',
  'tone~',
  'elem~',
  'textmode',
  'textmode.dom'
]);

/**
 * Shared JSRunner instructions for JavaScript-based objects.
 * These are the common runtime functions available in all JSRunner-enabled nodes.
 *
 * NOTE: This is injected ONCE at the resolver call site, not in individual object prompts,
 * to avoid duplication when multiple JS-enabled objects are used together.
 */
export const jsRunnerInstructions = `
**Common Runtime Functions:**
- console.log() - Log to virtual console (not browser console)
- setTitle(title) - Set node display title
- focusObjects(options) - Pan and zoom the canvas using fitView options, e.g. { nodes: [{ id: 'node-1' }], duration: 800, padding: 0.3 }
- setBackgroundOutput(id) - Set a node as the background visual output by ID, or null to clear
- pauseObject(id) - Pause a node by ID (works on visual nodes, MediaPipe, and any node that supports pausing)
- unpauseObject(id) - Unpause a node by ID
- setInterval(cb, ms), setTimeout(cb, ms) - Timers with auto-cleanup
- delay(ms) - Promise that resolves after ms (rejects if node stops)
- requestAnimationFrame(cb) - Animation frame with auto-cleanup
- onCleanup(cb) - Register cleanup callback for unmount/re-execution
- await llm(prompt, options?) - Call the configured AI provider (requires API key in settings)
  * Options: { model?: string, abortSignal?: AbortSignal, imageNodeId?: string }

**Message Passing (wired ports):**
- send(data, {to: outletIndex}?) - Send to outlet (omit {to} to send to all outlets)
- recv((data, meta) => {}) - Register inlet callback (data: payload; meta.inlet: inlet index)
- setPortCount(inlets, outlets) - Configure number of message ports
- Bang is {type: 'bang'}; control messages MUST have a 'type' field
- Common MIDI messages:
  - {type: 'noteOn', note, velocity, channel}
  - {type: 'noteOff', note, velocity, channel}
  - {type: 'controlChange', control, value, channel}
  - note and velocity is between 0-127

**Named Channels (wireless messaging):**
- send(data, { to: 'name' }) - Broadcast to all listeners on channel (string 'to' = channel)
- recv(cb, { from: 'name' }) - Receive from channel (cb receives data, meta with source/channel)
- Works with visual send/recv objects on same channel

**Clock (beat-synced timing from global transport):**
- clock.time - time in seconds
- clock.beat - beat in measure (0 to beatsPerBar-1)
- clock.phase - position within current beat (0.0 to 1.0)
- clock.bpm - tempo in BPM
- clock.bar - 0-indexed bar
- clock.beatsPerBar - beats per bar (numerator)
- clock.timeSignature - [numerator, denominator] tuple (e.g. [4, 4], [6, 8])
- clock.subdiv(n) - subdivision index (0 to n-1) within beat (per-node, polyrhythm-safe)
- clock.subdivPhase(n) - progress within current subdivision (0.0 to 1.0)
- clock.play(), clock.pause(), clock.stop() - transport control
- clock.setBpm(bpm), clock.setTimeSignature(num, denom), clock.seek(seconds)
- clock.onBeat(beat, cb, opts?) - fire on beat (number, array, or '*' for all). cb receives (time). Pass { audio: true } for lookahead scheduling.
- clock.schedule(time, cb, opts?) - One-shot at seconds or 'bar:beat:sixteenth' notation. Pass { audio: true } for audio-precise timing
- clock.every(interval, cb, opts?) - Repeating at 'bar:beat:sixteenth' interval
  - e.g. '1:0:0' = every bar, '0:1:0' = every beat
  - Pass { audio: true } for audio-precise timing
- clock.cancel(id), clock.cancelAll() - Cancel scheduled callbacks
- clock.setTimelineStyle({ color?, visible? }) - Customize this node's appearance in the timeline (color: CSS color string, visible: false to hide)
- For full clock docs call get_doc_content({ kind: 'topic', slug: 'clock-api' })

**Persistent Storage (kv):**
- await kv.set(key, value), await kv.get(key), await kv.delete(key) - simple key-value storage
- await kv.store(namespace).set/get/delete - namespaced store
- For full kv docs call get_doc_content({ kind: 'topic', slug: 'data-storage' })

**User-defined Settings:**
- only add a few settings by default where it makes sense.
  - tell the user in the response what settings they have and how to show it i.e. in the overflow menu > "Show settings"
  - do NOT add too much settings, 1 - 3 is enough. users can always ask to add more in a follow-up.
- await settings.define([...schema]) - expose a settings panel on the node (gear icon appears)
  - on hydra/swgl/p5, don't await - just settings.define is enough
- settings.get(key) - read current value (sync, after define resolves)
- settings.getAll() - all values as object
- settings.set(key, value) - programmatically update a setting from code (persists + fires onChange)
  - useful for updating sliders/toggles from recv() messages or clock callbacks
- settings.onChange((key, value, all) => {}) - react to value changes (from UI or settings.set)
- settings.clear() - reset all settings to defaults and clear persisted values
- Each field: { key, label, type, default?, persistence?: 'node'|'kv'|'none', ...type-specific }
- Schema field types: slider, number, boolean, string, select, color
- slider: requires min, max. Add step for float precision (e.g. step: 0.01 for 2 decimal places; omitting step defaults to integer steps)
- For full settings docs call get_doc_content({ kind: 'topic', slug: 'object-settings' })
`.trim();

/**
 * Instructions for objects that support esm() for loading NPM packages.
 * Used by: js, worker, p5
 */
export const esmInstructions = `
- esm(moduleName) - Load NPM packages: await esm("lodash")
`.trim();

/**
 * Instructions for objects that support setRunOnMount.
 * Used by: js, worker
 */
export const runOnMountInstructions = `
- setRunOnMount(enabled) - Auto-run code on patch load
`.trim();

/**
 * Instructions for objects that support patcher libraries.
 * Used by: js, p5, sonic~, elem~
 */
export const patcherLibraryInstructions = `
**Patcher Libraries - Share code across js/p5/sonic~/elem~ objects:**
- Add \`// @lib myModule\` at top, export constants/functions/classes
- Import elsewhere with: import { func } from 'myModule'
`.trim();
