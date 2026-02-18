/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_get_port_block: (a: number) => number;
export const __wbg_get_port_port: (a: number) => number;
export const __wbg_port_free: (a: number, b: number) => void;
export const __wbg_set_port_block: (a: number, b: number) => void;
export const __wbg_set_port_port: (a: number, b: number) => void;
export const port_new: (a: number, b: number) => number;
export const __wbg_controller_free: (a: number, b: number) => void;
export const controller_add_machine: (a: number) => [number, number, number];
export const controller_add_machine_with_id: (a: number, b: number) => [number, number, number];
export const controller_clear: (a: number) => void;
export const controller_consume_machine_side_effects: (
  a: number,
  b: number
) => [number, number, number];
export const controller_consume_messages: (a: number, b: number) => [number, number, number];
export const controller_create: () => number;
export const controller_full_serialize_sequencer_state: (a: number) => [number, number, number];
export const controller_get_snapshot: (a: number, b: number) => [number, number, number];
export const controller_inspect_machine: (a: number, b: number) => [number, number, number];
export const controller_is_halted: (a: number) => number;
export const controller_load: (
  a: number,
  b: number,
  c: number,
  d: number
) => [number, number, number];
export const controller_partial_serialize_sequencer_state: (a: number) => [number, number, number];
export const controller_read_code: (a: number, b: number, c: number) => [number, number, number];
export const controller_read_mem: (
  a: number,
  b: number,
  c: number,
  d: number
) => [number, number, number];
export const controller_read_stack: (a: number, b: number, c: number) => [number, number, number];
export const controller_remove_machine: (a: number, b: number) => [number, number, number];
export const controller_reset_machine: (a: number, b: number) => void;
export const controller_send_message_to_machine: (
  a: number,
  b: number,
  c: any
) => [number, number, number];
export const controller_set_mem: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number
) => [number, number, number];
export const controller_statuses: (a: number) => [number, number, number];
export const controller_step_machine: (a: number, b: number, c: number) => [number, number, number];
export const controller_wake: (a: number, b: number) => void;
export const setup_system: () => void;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_export_4: WebAssembly.Table;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
