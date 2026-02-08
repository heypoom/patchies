// @ts-nocheck - Auto-generated WASM binding file
let wasm;
export function __wbg_set_wasm(val) {
  wasm = val;
}

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

const lTextDecoder =
  typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}

let WASM_VECTOR_LEN = 0;

const lTextEncoder =
  typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;

const cachedTextEncoder = new lTextEncoder('utf-8');

const encodeString =
  typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
        return cachedTextEncoder.encodeInto(arg, view);
      }
    : function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
          read: arg.length,
          written: buf.length
        };
      };

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
    const ret = encodeString(arg, view);

    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
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

function addToExternrefTable0(obj) {
  const idx = wasm.__externref_table_alloc();
  wasm.__wbindgen_export_4.set(idx, obj);
  return idx;
}

function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    const idx = addToExternrefTable0(e);
    wasm.__wbindgen_exn_store(idx);
  }
}

function isLikeNone(x) {
  return x === undefined || x === null;
}

function debugString(val) {
  // primitive types
  const type = typeof val;
  if (type == 'number' || type == 'boolean' || val == null) {
    return `${val}`;
  }
  if (type == 'string') {
    return `"${val}"`;
  }
  if (type == 'symbol') {
    const description = val.description;
    if (description == null) {
      return 'Symbol';
    } else {
      return `Symbol(${description})`;
    }
  }
  if (type == 'function') {
    const name = val.name;
    if (typeof name == 'string' && name.length > 0) {
      return `Function(${name})`;
    } else {
      return 'Function';
    }
  }
  // objects
  if (Array.isArray(val)) {
    const length = val.length;
    let debug = '[';
    if (length > 0) {
      debug += debugString(val[0]);
    }
    for (let i = 1; i < length; i++) {
      debug += ', ' + debugString(val[i]);
    }
    debug += ']';
    return debug;
  }
  // Test for built-in
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
  let className;
  if (builtInMatches && builtInMatches.length > 1) {
    className = builtInMatches[1];
  } else {
    // Failed to match the standard '[object ClassName]'
    return toString.call(val);
  }
  if (className == 'Object') {
    // we're a user defined class or Object
    // JSON.stringify avoids problems with cycles, and is generally much
    // easier than looping through ownProperties of `val`.
    try {
      return 'Object(' + JSON.stringify(val) + ')';
    } catch (_) {
      return 'Object';
    }
  }
  // errors
  if (val instanceof Error) {
    return `${val.name}: ${val.message}\n${val.stack}`;
  }
  // TODO we could test for more things here, like `Set`s and `Map`s.
  return className;
}

function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_export_4.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}

let cachedUint16ArrayMemory0 = null;

function getUint16ArrayMemory0() {
  if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
    cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
  }
  return cachedUint16ArrayMemory0;
}

function passArray16ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 2, 2) >>> 0;
  getUint16ArrayMemory0().set(arg, ptr / 2);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

export function setup_system() {
  wasm.setup_system();
}

const ControllerFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_controller_free(ptr >>> 0, 1));

export class Controller {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(Controller.prototype);
    obj.__wbg_ptr = ptr;
    ControllerFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ControllerFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_controller_free(ptr, 0);
  }
  /**
   * @returns {Controller}
   */
  static create() {
    const ret = wasm.controller_create();
    return Controller.__wrap(ret);
  }
  /**
   * @returns {number}
   */
  add_machine() {
    const ret = wasm.controller_add_machine(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0];
  }
  /**
   * @param {number} id
   * @returns {any}
   */
  add_machine_with_id(id) {
    const ret = wasm.controller_add_machine_with_id(this.__wbg_ptr, id);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {number} id
   * @returns {any}
   */
  remove_machine(id) {
    const ret = wasm.controller_remove_machine(this.__wbg_ptr, id);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {number} id
   * @param {string} source
   * @returns {any}
   */
  load(id, source) {
    const ptr0 = passStringToWasm0(source, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.controller_load(this.__wbg_ptr, id, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {number} id
   * @param {number} count
   * @returns {any}
   */
  step_machine(id, count) {
    const ret = wasm.controller_step_machine(this.__wbg_ptr, id, count);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {number} id
   */
  reset_machine(id) {
    wasm.controller_reset_machine(this.__wbg_ptr, id);
  }
  /**
   * @returns {any}
   */
  statuses() {
    const ret = wasm.controller_statuses(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @returns {boolean}
   */
  is_halted() {
    const ret = wasm.controller_is_halted(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @param {number} id
   * @returns {any}
   */
  inspect_machine(id) {
    const ret = wasm.controller_inspect_machine(this.__wbg_ptr, id);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {number} id
   * @param {number} size
   * @returns {any}
   */
  read_code(id, size) {
    const ret = wasm.controller_read_code(this.__wbg_ptr, id, size);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {number} id
   * @param {number} addr
   * @param {number} size
   * @returns {any}
   */
  read_mem(id, addr, size) {
    const ret = wasm.controller_read_mem(this.__wbg_ptr, id, addr, size);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {number} id
   * @param {number} size
   * @returns {any}
   */
  read_stack(id, size) {
    const ret = wasm.controller_read_stack(this.__wbg_ptr, id, size);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * Allows the frontend to consume events from the machine.
   * @param {number} id
   * @returns {any}
   */
  consume_machine_side_effects(id) {
    const ret = wasm.controller_consume_machine_side_effects(this.__wbg_ptr, id);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  clear() {
    wasm.controller_clear(this.__wbg_ptr);
  }
  /**
   * Serialize the entire sequencer state - very slow!
   * Should only be used for debugging.
   * @returns {any}
   */
  full_serialize_sequencer_state() {
    const ret = wasm.controller_full_serialize_sequencer_state(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * Serialize the sequencer state, excluding the buffers.
   * @returns {any}
   */
  partial_serialize_sequencer_state() {
    const ret = wasm.controller_partial_serialize_sequencer_state(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {number} id
   * @param {number} address
   * @param {Uint16Array} data
   * @returns {any}
   */
  set_mem(id, address, data) {
    const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.controller_set_mem(this.__wbg_ptr, id, address, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {number} machine_id
   */
  wake(machine_id) {
    wasm.controller_wake(this.__wbg_ptr, machine_id);
  }
  /**
   * Send a message to a machine's inbox directly
   * @param {number} machine_id
   * @param {Message} message
   * @returns {any}
   */
  send_message_to_machine(machine_id, message) {
    const ret = wasm.controller_send_message_to_machine(this.__wbg_ptr, machine_id, message);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * Consume all outgoing messages from a machine
   * @param {number} machine_id
   * @returns {any}
   */
  consume_messages(machine_id) {
    const ret = wasm.controller_consume_messages(this.__wbg_ptr, machine_id);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
}

const PortFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_port_free(ptr >>> 0, 1));

export class Port {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    PortFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_port_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get block() {
    const ret = wasm.__wbg_get_port_block(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {number} arg0
   */
  set block(arg0) {
    wasm.__wbg_set_port_block(this.__wbg_ptr, arg0);
  }
  /**
   * @returns {number}
   */
  get port() {
    const ret = wasm.__wbg_get_port_port(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {number} arg0
   */
  set port(arg0) {
    wasm.__wbg_set_port_port(this.__wbg_ptr, arg0);
  }
  /**
   * @param {number} block
   * @param {number} port
   */
  constructor(block, port) {
    const ret = wasm.port_new(block, port);
    this.__wbg_ptr = ret >>> 0;
    PortFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
}

export function __wbg_Error_0497d5bdba9362e5(arg0, arg1) {
  const ret = Error(getStringFromWasm0(arg0, arg1));
  return ret;
}

export function __wbg_String_eecc4a11987127d6(arg0, arg1) {
  const ret = String(arg1);
  const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}

export function __wbg_buffer_a1a27a0dfa70165d(arg0) {
  const ret = arg0.buffer;
  return ret;
}

export function __wbg_call_fbe8be8bf6436ce5() {
  return handleError(function (arg0, arg1) {
    const ret = arg0.call(arg1);
    return ret;
  }, arguments);
}

export function __wbg_done_4d01f352bade43b7(arg0) {
  const ret = arg0.done;
  return ret;
}

export function __wbg_entries_41651c850143b957(arg0) {
  const ret = Object.entries(arg0);
  return ret;
}

export function __wbg_error_7534b8e9a36f1ab4(arg0, arg1) {
  let deferred0_0;
  let deferred0_1;
  try {
    deferred0_0 = arg0;
    deferred0_1 = arg1;
    console.error(getStringFromWasm0(arg0, arg1));
  } finally {
    wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
  }
}

export function __wbg_get_92470be87867c2e5() {
  return handleError(function (arg0, arg1) {
    const ret = Reflect.get(arg0, arg1);
    return ret;
  }, arguments);
}

export function __wbg_get_a131a44bd1eb6979(arg0, arg1) {
  const ret = arg0[arg1 >>> 0];
  return ret;
}

export function __wbg_getwithrefkey_6550b2c093d2eb18(arg0, arg1) {
  const ret = arg0[arg1];
  return ret;
}

export function __wbg_instanceof_ArrayBuffer_a8b6f580b363f2bc(arg0) {
  let result;
  try {
    result = arg0 instanceof ArrayBuffer;
  } catch (_) {
    result = false;
  }
  const ret = result;
  return ret;
}

export function __wbg_instanceof_Uint8Array_ca460677bc155827(arg0) {
  let result;
  try {
    result = arg0 instanceof Uint8Array;
  } catch (_) {
    result = false;
  }
  const ret = result;
  return ret;
}

export function __wbg_isArray_5f090bed72bd4f89(arg0) {
  const ret = Array.isArray(arg0);
  return ret;
}

export function __wbg_isSafeInteger_90d7c4674047d684(arg0) {
  const ret = Number.isSafeInteger(arg0);
  return ret;
}

export function __wbg_iterator_4068add5b2aef7a6() {
  const ret = Symbol.iterator;
  return ret;
}

export function __wbg_length_ab6d22b5ead75c72(arg0) {
  const ret = arg0.length;
  return ret;
}

export function __wbg_length_f00ec12454a5d9fd(arg0) {
  const ret = arg0.length;
  return ret;
}

export function __wbg_new_07b483f72211fd66() {
  const ret = new Object();
  return ret;
}

export function __wbg_new_58353953ad2097cc() {
  const ret = new Array();
  return ret;
}

export function __wbg_new_8a6f238a6ece86ea() {
  const ret = new Error();
  return ret;
}

export function __wbg_new_a979b4b45bd55c7f() {
  const ret = new Map();
  return ret;
}

export function __wbg_new_e52b3efaaa774f96(arg0) {
  const ret = new Uint8Array(arg0);
  return ret;
}

export function __wbg_next_8bb824d217961b5d(arg0) {
  const ret = arg0.next;
  return ret;
}

export function __wbg_next_e2da48d8fff7439a() {
  return handleError(function (arg0) {
    const ret = arg0.next();
    return ret;
  }, arguments);
}

export function __wbg_set_3f1d0b984ed272ed(arg0, arg1, arg2) {
  arg0[arg1] = arg2;
}

export function __wbg_set_7422acbe992d64ab(arg0, arg1, arg2) {
  arg0[arg1 >>> 0] = arg2;
}

export function __wbg_set_d6bdfd275fb8a4ce(arg0, arg1, arg2) {
  const ret = arg0.set(arg1, arg2);
  return ret;
}

export function __wbg_set_fe4e79d1ed3b0e9b(arg0, arg1, arg2) {
  arg0.set(arg1, arg2 >>> 0);
}

export function __wbg_stack_0ed75d68575b0f3c(arg0, arg1) {
  const ret = arg1.stack;
  const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}

export function __wbg_value_17b896954e14f896(arg0) {
  const ret = arg0.value;
  return ret;
}

export function __wbindgen_bigint_from_i64(arg0) {
  const ret = arg0;
  return ret;
}

export function __wbindgen_bigint_from_u64(arg0) {
  const ret = BigInt.asUintN(64, arg0);
  return ret;
}

export function __wbindgen_bigint_get_as_i64(arg0, arg1) {
  const v = arg1;
  const ret = typeof v === 'bigint' ? v : undefined;
  getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
}

export function __wbindgen_boolean_get(arg0) {
  const v = arg0;
  const ret = typeof v === 'boolean' ? (v ? 1 : 0) : 2;
  return ret;
}

export function __wbindgen_debug_string(arg0, arg1) {
  const ret = debugString(arg1);
  const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}

export function __wbindgen_in(arg0, arg1) {
  const ret = arg0 in arg1;
  return ret;
}

export function __wbindgen_init_externref_table() {
  const table = wasm.__wbindgen_export_4;
  const offset = table.grow(4);
  table.set(0, undefined);
  table.set(offset + 0, undefined);
  table.set(offset + 1, null);
  table.set(offset + 2, true);
  table.set(offset + 3, false);
}

export function __wbindgen_is_bigint(arg0) {
  const ret = typeof arg0 === 'bigint';
  return ret;
}

export function __wbindgen_is_function(arg0) {
  const ret = typeof arg0 === 'function';
  return ret;
}

export function __wbindgen_is_object(arg0) {
  const val = arg0;
  const ret = typeof val === 'object' && val !== null;
  return ret;
}

export function __wbindgen_is_string(arg0) {
  const ret = typeof arg0 === 'string';
  return ret;
}

export function __wbindgen_is_undefined(arg0) {
  const ret = arg0 === undefined;
  return ret;
}

export function __wbindgen_jsval_eq(arg0, arg1) {
  const ret = arg0 === arg1;
  return ret;
}

export function __wbindgen_jsval_loose_eq(arg0, arg1) {
  const ret = arg0 == arg1;
  return ret;
}

export function __wbindgen_memory() {
  const ret = wasm.memory;
  return ret;
}

export function __wbindgen_number_get(arg0, arg1) {
  const obj = arg1;
  const ret = typeof obj === 'number' ? obj : undefined;
  getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
}

export function __wbindgen_number_new(arg0) {
  const ret = arg0;
  return ret;
}

export function __wbindgen_string_get(arg0, arg1) {
  const obj = arg1;
  const ret = typeof obj === 'string' ? obj : undefined;
  var ptr1 = isLikeNone(ret)
    ? 0
    : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  var len1 = WASM_VECTOR_LEN;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}

export function __wbindgen_string_new(arg0, arg1) {
  const ret = getStringFromWasm0(arg0, arg1);
  return ret;
}

export function __wbindgen_throw(arg0, arg1) {
  throw new Error(getStringFromWasm0(arg0, arg1));
}
