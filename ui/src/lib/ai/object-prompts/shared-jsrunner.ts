/**
 * Shared JSRunner instructions for JavaScript-based objects.
 * Used by: js, worker, p5, hydra, canvas, canvas.dom, three, three.dom, dom, vue, sonic~, tone~, elem~
 *
 * These are the common runtime functions available in all JSRunner-enabled nodes.
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
  * Options: { imageNodeId?: string, abortSignal?: AbortSignal }
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
