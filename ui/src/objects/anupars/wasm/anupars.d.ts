/* tslint:disable */
/* eslint-disable */

/**
 * Initialise the application. Call once before anything else.
 * `cols` and `rows` should match your xterm.js terminal dimensions.
 */
export function wasm_init(cols: number, rows: number): void;

/**
 * Load text content into the grid editor (WASM file picker replacement).
 * Call this from JS after reading a file with `showOpenFilePicker`.
 */
export function wasm_load_file(contents: string): void;

/**
 * Returns the ANSI byte-string to write to `terminal.write()`.
 * Call after `wasm_step`.
 */
export function wasm_render(): string;

/**
 * Notify the backend of a terminal resize.
 */
export function wasm_resize(cols: number, rows: number): void;

/**
 * Forward keyboard input from xterm.js `terminal.onData(data => wasm_send_key(data))`.
 * Events are staged and consumed on the next `wasm_step` call.
 */
export function wasm_send_key(key: string): void;

/**
 * Forward a mouse event from the browser.
 * `kind`   – 0 = press, 1 = hold/drag, 2 = release
 * `button` – 0 = left, 1 = middle, 2 = right
 * `col`, `row` – terminal cell coordinates (0-based)
 */
export function wasm_send_mouse(kind: number, button: number, col: number, row: number): void;

/**
 * Set the regex input field and trigger pattern matching.
 * Equivalent to the user typing into the "RGXP" input in the console.
 */
export function wasm_set_input(pattern: string): void;

/**
 * Advance one frame. Call at ~60 fps from `requestAnimationFrame`.
 * `elapsed_ms` - milliseconds since the previous call.
 */
export function wasm_step(elapsed_ms: number): void;

/**
 * Pop one raw MIDI message (3 bytes) from the output queue.
 * Returns `undefined` when the queue is empty.
 * JS: `let msg; while ((msg = wasm_take_midi_message()) !== undefined) midiOut.send(msg);`
 */
export function wasm_take_midi_message(): Uint8Array | undefined;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly wasm_init: (a: number, b: number) => void;
  readonly wasm_load_file: (a: number, b: number) => void;
  readonly wasm_render: (a: number) => void;
  readonly wasm_resize: (a: number, b: number) => void;
  readonly wasm_send_key: (a: number, b: number) => void;
  readonly wasm_send_mouse: (a: number, b: number, c: number, d: number) => void;
  readonly wasm_set_input: (a: number, b: number) => void;
  readonly wasm_step: (a: number) => void;
  readonly wasm_take_midi_message: (a: number) => void;
  readonly __wbindgen_export: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export2: (a: number) => void;
  readonly __wbindgen_export3: (a: number, b: number) => number;
  readonly __wbindgen_export4: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
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
