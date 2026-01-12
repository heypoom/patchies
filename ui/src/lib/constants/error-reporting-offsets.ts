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
 * CanvasDom: Uses `new Function()` with just `"use strict";\n` prefix (1 line).
 * Since parseJSError subtracts 6 by default, we need -3 to only subtract 3 lines total.
 */
export const CANVAS_DOM_WRAPPER_OFFSET = -3;

/**
 * ToneNode: Uses custom wrapper with fewer lines than JSRunner's preamble.
 */
export const TONE_WRAPPER_OFFSET = -2;

/**
 * ElementaryNode: Uses JSRunner with additional wrapper lines.
 */
export const ELEM_WRAPPER_OFFSET = 2;

/**
 * SonicNode: Uses JSRunner with additional wrapper lines.
 */
export const SONIC_WRAPPER_OFFSET = 2;
