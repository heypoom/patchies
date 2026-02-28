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
  'elem~'
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
- setInterval(cb, ms), setTimeout(cb, ms) - Timers with auto-cleanup
- delay(ms) - Promise that resolves after ms (rejects if node stops)
- requestAnimationFrame(cb) - Animation frame with auto-cleanup
- onCleanup(cb) - Register cleanup callback for unmount/re-execution
- await llm(prompt, options?) - Call Gemini API (requires API key in settings)
  * Options: { abortSignal?: AbortSignal }

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
- clock.onBeat(beat, cb, opts?) - fire on beat (number, array, or '*' for all). cb receives (time). Pass { audio: true } for lookahead scheduling
- clock.schedule(time, cb, opts?) - One-shot at seconds or 'bar:beat:sixteenth' notation. Pass { audio: true } for audio-precise timing
- clock.every(interval, cb, opts?) - Repeating at 'bar:beat:sixteenth' interval (e.g. '1:0:0' = every bar). Pass { audio: true } for audio-precise timing
- clock.cancel(id), clock.cancelAll() - Cancel scheduled callbacks
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
