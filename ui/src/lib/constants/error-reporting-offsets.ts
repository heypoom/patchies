/**
 * Wrapper offset constants for JavaScript error line number adjustment.
 *
 * When using `new Function()` or JSRunner to execute user code, the browser
 * reports error line numbers that include wrapper code. The `parseJSError()`
 * function in `js-error-parser.ts` already subtracts 6 lines (JSRunner's preamble).
 *
 * These offsets are passed as `additionalOffset` to adjust for node-specific wrappers:
 * - Positive values: subtract MORE lines (wrapper adds lines before user code)
 * - Negative values: subtract FEWER lines (no JSRunner wrapper, or smaller wrapper)
 *
 * Formula: adjustedLine = reportedLine - 6 (JSRunner preamble) - additionalOffset
 */

/**
 * P5CanvasNode: P5Manager wraps user code in executeUserCode's codeWithWrapper template.
 * Adds 6 extra lines beyond JSRunner's preamble.
 */
export const P5_WRAPPER_OFFSET = 6;

/**
 * Canvas worker: Uses JSRunner.executeJavaScript with additional context.
 * Adds 2 extra lines.
 */
export const CANVAS_WRAPPER_OFFSET = 2;

/**
 * Canvas DOM worker: Uses JSRunner.executeJavaScript with additional context.
 * Adds 2 extra lines.
 */
export const CANVAS_DOM_WRAPPER_OFFSET = 0;

/**
 * ToneNode: Uses custom wrapper with fewer lines than JSRunner's preamble.
 */
export const TONE_WRAPPER_OFFSET = 0;

/**
 * ElementaryNode: Uses JSRunner with additional wrapper lines.
 */
export const ELEM_WRAPPER_OFFSET = 0;

/**
 * SonicNode: Uses JSRunner with additional wrapper lines.
 */
export const SONIC_WRAPPER_OFFSET = 0;

/**
 * DSP AudioWorklet: Uses `new Function()` with wrapper lines before user code.
 */
export const DSP_WRAPPER_OFFSET = -2;

/**
 * HydraRenderer: Uses `new Function()` with wrapper lines before user code.
 * Since Hydra doesn't use JSRunner (which has 6-line preamble), parseJSError
 * subtracts 6 by default. Hydra's wrapper has exactly 6 lines before user code:
 *
 * Wrapper template (6 lines before user code):
 * - Line 1: (empty - newline after backtick)
 * - Line 2: let time = performance.now()
 * - Line 3: (empty line)
 * - Line 4: with (context) {
 * - Line 5: var recv = onMessage;
 * - Line 6: (empty line)
 * - Line 7+: ${code} (user code)
 *
 * So we need 0 additional offset (6 - 6 = 0).
 */
export const HYDRA_WRAPPER_OFFSET = 2;

export const THREE_DOM_WRAPPER_OFFSET = 5;

export const DOM_WRAPPER_OFFSET = 2;

export const VUE_WRAPPER_OFFSET = 2;

export const THREE_WRAPPER_OFFSET = 6;
