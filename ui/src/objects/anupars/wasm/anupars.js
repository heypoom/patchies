/* @ts-self-types="./anupars.d.ts" */

/**
 * Initialise the application. Call once before anything else.
 * `cols` and `rows` should match your xterm.js terminal dimensions.
 * @param {number} cols
 * @param {number} rows
 */
export function wasm_init(cols, rows) {
  wasm.wasm_init(cols, rows);
}

/**
 * Load text content into the grid editor (WASM file picker replacement).
 * Call this from JS after reading a file with `showOpenFilePicker`.
 * @param {string} contents
 */
export function wasm_load_file(contents) {
  const ptr0 = passStringToWasm0(contents, wasm.__wbindgen_export3, wasm.__wbindgen_export4);
  const len0 = WASM_VECTOR_LEN;
  wasm.wasm_load_file(ptr0, len0);
}

/**
 * Returns the ANSI byte-string to write to `terminal.write()`.
 * Call after `wasm_step`.
 * @returns {string}
 */
export function wasm_render() {
  let deferred1_0;
  let deferred1_1;
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.wasm_render(retptr);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred1_0 = r0;
    deferred1_1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export(deferred1_0, deferred1_1, 1);
  }
}

/**
 * Notify the backend of a terminal resize.
 * @param {number} cols
 * @param {number} rows
 */
export function wasm_resize(cols, rows) {
  wasm.wasm_resize(cols, rows);
}

/**
 * Forward keyboard input from xterm.js `terminal.onData(data => wasm_send_key(data))`.
 * Events are staged and consumed on the next `wasm_step` call.
 * @param {string} key
 */
export function wasm_send_key(key) {
  const ptr0 = passStringToWasm0(key, wasm.__wbindgen_export3, wasm.__wbindgen_export4);
  const len0 = WASM_VECTOR_LEN;
  wasm.wasm_send_key(ptr0, len0);
}

/**
 * Forward a mouse event from the browser.
 * `kind`   – 0 = press, 1 = hold/drag, 2 = release
 * `button` – 0 = left, 1 = middle, 2 = right
 * `col`, `row` – terminal cell coordinates (0-based)
 * @param {number} kind
 * @param {number} button
 * @param {number} col
 * @param {number} row
 */
export function wasm_send_mouse(kind, button, col, row) {
  wasm.wasm_send_mouse(kind, button, col, row);
}

/**
 * Set the regex input field and trigger pattern matching.
 * Equivalent to the user typing into the "RGXP" input in the console.
 * @param {string} pattern
 */
export function wasm_set_input(pattern) {
  const ptr0 = passStringToWasm0(pattern, wasm.__wbindgen_export3, wasm.__wbindgen_export4);
  const len0 = WASM_VECTOR_LEN;
  wasm.wasm_set_input(ptr0, len0);
}

/**
 * Advance one frame. Call at ~60 fps from `requestAnimationFrame`.
 * `elapsed_ms` - milliseconds since the previous call.
 * @param {number} elapsed_ms
 */
export function wasm_step(elapsed_ms) {
  wasm.wasm_step(elapsed_ms);
}

/**
 * Pop one raw MIDI message (3 bytes) from the output queue.
 * Returns `undefined` when the queue is empty.
 * JS: `let msg; while ((msg = wasm_take_midi_message()) !== undefined) midiOut.send(msg);`
 * @returns {Uint8Array | undefined}
 */
export function wasm_take_midi_message() {
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.wasm_take_midi_message(retptr);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    let v1;
    if (r0 !== 0) {
      v1 = getArrayU8FromWasm0(r0, r1).slice();
      wasm.__wbindgen_export(r0, r1 * 1, 1);
    }
    return v1;
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
  }
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg_error_a6fa202b58aa1cd3: function (arg0, arg1) {
      let deferred0_0;
      let deferred0_1;
      try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
      } finally {
        wasm.__wbindgen_export(deferred0_0, deferred0_1, 1);
      }
    },
    __wbg_getRandomValues_3f44b700395062e5: function () {
      return handleError(function (arg0, arg1) {
        globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
      }, arguments);
    },
    __wbg_new_227d7c05414eb861: function () {
      const ret = new Error();
      return addHeapObject(ret);
    },
    __wbg_stack_3b0d974bbf31e44f: function (arg0, arg1) {
      const ret = getObject(arg1).stack;
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export3, wasm.__wbindgen_export4);
      const len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbindgen_object_drop_ref: function (arg0) {
      takeObject(arg0);
    }
  };
  return {
    __proto__: null,
    './anupars_bg.js': import0
  };
}

function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];

  heap[idx] = obj;
  return idx;
}

function dropObject(idx) {
  if (idx < 1028) return;
  heap[idx] = heap_next;
  heap_next = idx;
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
  if (
    cachedDataViewMemory0 === null ||
    cachedDataViewMemory0.buffer.detached === true ||
    (cachedDataViewMemory0.buffer.detached === undefined &&
      cachedDataViewMemory0.buffer !== wasm.memory.buffer)
  ) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function getObject(idx) {
  return heap[idx];
}

function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_export2(addHeapObject(e));
  }
}

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0()
      .subarray(ptr, ptr + buf.length)
      .set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;

  const mem = getUint8ArrayMemory0();

  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7f) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);

    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  wasmModule = module;
  cachedDataViewMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  return wasm;
}

async function __wbg_load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type);

        if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            e
          );
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }

  function expectedResponseType(type) {
    switch (type) {
      case 'basic':
      case 'cors':
      case 'default':
        return true;
    }
    return false;
  }
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn('using deprecated parameters for `initSync()`; pass a single object instead');
    }
  }

  const imports = __wbg_get_imports();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm;

  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        'using deprecated parameters for the initialization function; pass a single object instead'
      );
    }
  }

  if (module_or_path === undefined) {
    module_or_path = new URL('anupars_bg.wasm', import.meta.url);
  }
  const imports = __wbg_get_imports();

  if (
    typeof module_or_path === 'string' ||
    (typeof Request === 'function' && module_or_path instanceof Request) ||
    (typeof URL === 'function' && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path);
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports);

  return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
