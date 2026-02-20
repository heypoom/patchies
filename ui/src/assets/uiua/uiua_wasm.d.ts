/* tslint:disable */
/* eslint-disable */
/**
 * Format Uiua code using the built-in formatter
 *
 * Converts keyboard prefixes (like `\\`) to Unicode glyphs (like `⇌`)
 */
export function format_uiua(code: string): any;
/**
 * Get the Uiua version string
 */
export function uiua_version(): string;
/**
 * Evaluate Uiua code and return native JS objects with media detection
 *
 * Returns an EvalResult with:
 * - `success`: whether evaluation succeeded
 * - `error`: error message if failed
 * - `stack`: array of OutputItems (text, audio, image, gif, svg)
 * - `formatted`: auto-formatted version of the code
 */
export function eval_uiua(code: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly eval_uiua: (a: number, b: number) => any;
  readonly format_uiua: (a: number, b: number) => any;
  readonly uiua_version: () => [number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>
): Promise<InitOutput>;
