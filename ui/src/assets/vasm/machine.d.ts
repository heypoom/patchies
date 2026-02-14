/* tslint:disable */
/* eslint-disable */
export function setup_system(): void;
declare namespace Action {
  export type Data = { type: 'Data'; body: number[] };
  export type Read = { type: 'Read'; address: number; count: number };
  export type Write = { type: 'Write'; address: number; data: number[] };
  export type Override = { type: 'Override'; data: number[] };
}

export type Action =
  | { type: 'Data'; body: number[] }
  | { type: 'Read'; address: number; count: number }
  | { type: 'Write'; address: number; data: number[] }
  | { type: 'Override'; data: number[] };

export interface Message {
  action: Action;
  sender: Port;
  recipient: number | undefined;
}

type __SequencerErrorParseError = ParseError;
type __SequencerErrorRuntimeError = RuntimeError;
declare namespace SequencerError {
  export type CannotParse = { type: 'CannotParse'; id: number; error: __SequencerErrorParseError };
  export type ExecutionFailed = {
    type: 'ExecutionFailed';
    id: number;
    error: __SequencerErrorRuntimeError;
  };
  export type MachineDoesNotExist = { type: 'MachineDoesNotExist'; id: number };
  export type ReceiveFailed = { type: 'ReceiveFailed'; error: __SequencerErrorRuntimeError };
  export type MessageNeverReceived = { type: 'MessageNeverReceived'; id: number };
  export type ExecutionCycleExceeded = { type: 'ExecutionCycleExceeded'; id: number };
}

export type SequencerError =
  | { type: 'CannotParse'; id: number; error: ParseError }
  | { type: 'ExecutionFailed'; id: number; error: RuntimeError }
  | { type: 'MachineDoesNotExist'; id: number }
  | { type: 'ReceiveFailed'; error: RuntimeError }
  | { type: 'MessageNeverReceived'; id: number }
  | { type: 'ExecutionCycleExceeded'; id: number };

type __CanvasErrorMessage = Message;
type __CanvasErrorPort = Port;
type __CanvasErrorSequencerError = SequencerError;
declare namespace CanvasError {
  export type CannotWireToItself = { type: 'CannotWireToItself'; port: __CanvasErrorPort };
  export type BlockNotFound = { type: 'BlockNotFound'; id: number };
  export type MachineNotFound = { type: 'MachineNotFound'; id: number };
  export type MachineError = { type: 'MachineError'; cause: __CanvasErrorSequencerError };
  export type DisconnectedPort = { type: 'DisconnectedPort'; port: __CanvasErrorPort };
  export type CannotFindWire = {
    type: 'CannotFindWire';
    src: __CanvasErrorPort;
    dst: __CanvasErrorPort;
  };
  export type BlockIdInUse = { type: 'BlockIdInUse'; id: number };
  export type MissingMessageRecipient = {
    type: 'MissingMessageRecipient';
    message: __CanvasErrorMessage;
  };
}

export type CanvasError =
  | { type: 'CannotWireToItself'; port: Port }
  | { type: 'BlockNotFound'; id: number }
  | { type: 'MachineNotFound'; id: number }
  | { type: 'MachineError'; cause: SequencerError }
  | { type: 'DisconnectedPort'; port: Port }
  | { type: 'CannotFindWire'; src: Port; dst: Port }
  | { type: 'BlockIdInUse'; id: number }
  | { type: 'MissingMessageRecipient'; message: Message };

type __ParseErrorParseError = ParseError;
declare namespace ParseError {
  export type InvalidString = { type: 'InvalidString' };
  export type UndefinedSymbols = { type: 'UndefinedSymbols' };
  export type InvalidIdentifier = { type: 'InvalidIdentifier' };
  export type UndefinedInstruction = { type: 'UndefinedInstruction'; name: string };
  export type InvalidLabelDescription = { type: 'InvalidLabelDescription' };
  export type DuplicateLabelDefinition = { type: 'DuplicateLabelDefinition' };
  export type DuplicateStringDefinition = { type: 'DuplicateStringDefinition' };
  export type DuplicateSymbolDefinition = { type: 'DuplicateSymbolDefinition' };
  export type InvalidArgument = { type: 'InvalidArgument'; errors: __ParseErrorParseError[] };
  export type InvalidStringValue = { type: 'InvalidStringValue' };
  export type InvalidByteValue = { type: 'InvalidByteValue' };
  export type InvalidArgToken = { type: 'InvalidArgToken' };
  export type CannotPeekAtToken = { type: 'CannotPeekAtToken' };
  export type PeekExceedsSourceLength = { type: 'PeekExceedsSourceLength' };
  export type InvalidDecimalDigit = { type: 'InvalidDecimalDigit'; text: string };
  export type InvalidHexDigit = { type: 'InvalidHexDigit'; text: string };
  export type ScannerReachedEndOfLine = { type: 'ScannerReachedEndOfLine' };
  export type EmptyProgram = { type: 'EmptyProgram' };
}

export type ParseError =
  | { type: 'InvalidString' }
  | { type: 'UndefinedSymbols' }
  | { type: 'InvalidIdentifier' }
  | { type: 'UndefinedInstruction'; name: string }
  | { type: 'InvalidLabelDescription' }
  | { type: 'DuplicateLabelDefinition' }
  | { type: 'DuplicateStringDefinition' }
  | { type: 'DuplicateSymbolDefinition' }
  | { type: 'InvalidArgument'; errors: ParseError[] }
  | { type: 'InvalidStringValue' }
  | { type: 'InvalidByteValue' }
  | { type: 'InvalidArgToken' }
  | { type: 'CannotPeekAtToken' }
  | { type: 'PeekExceedsSourceLength' }
  | { type: 'InvalidDecimalDigit'; text: string }
  | { type: 'InvalidHexDigit'; text: string }
  | { type: 'ScannerReachedEndOfLine' }
  | { type: 'EmptyProgram' };

declare namespace Effect {
  export type Print = { type: 'Print'; text: string };
  export type Sleep = { type: 'Sleep'; ms: number };
}

export type Effect = { type: 'Print'; text: string } | { type: 'Sleep'; ms: number };

export type MachineStatus =
  | 'Invalid'
  | 'Loaded'
  | 'Ready'
  | 'Running'
  | 'Awaiting'
  | 'Sleeping'
  | 'Halted'
  | 'Errored';

declare namespace RuntimeError {
  export type StackUnderflow = { type: 'StackUnderflow'; top: number; min: number };
  export type StackOverflow = { type: 'StackOverflow'; top: number; max: number };
  export type CallStackExceeded = { type: 'CallStackExceeded' };
  export type MissingReturnAddress = { type: 'MissingReturnAddress' };
  export type MissingMessageBody = { type: 'MissingMessageBody' };
  export type CannotReadStringFromBytes = { type: 'CannotReadStringFromBytes' };
  export type CannotLoadFromMemory = { type: 'CannotLoadFromMemory' };
  export type CannotDivideByZero = { type: 'CannotDivideByZero' };
  export type IntegerOverflow = { type: 'IntegerOverflow' };
  export type IntegerUnderflow = { type: 'IntegerUnderflow' };
  export type MissingValueToStore = { type: 'MissingValueToStore' };
  export type NotEnoughValues = { type: 'NotEnoughValues'; min: number; len: number };
  export type IndexOutOfBounds = { type: 'IndexOutOfBounds'; index: number; len: number };
}

export type RuntimeError =
  | { type: 'StackUnderflow'; top: number; min: number }
  | { type: 'StackOverflow'; top: number; max: number }
  | { type: 'CallStackExceeded' }
  | { type: 'MissingReturnAddress' }
  | { type: 'MissingMessageBody' }
  | { type: 'CannotReadStringFromBytes' }
  | { type: 'CannotLoadFromMemory' }
  | { type: 'CannotDivideByZero' }
  | { type: 'IntegerOverflow' }
  | { type: 'IntegerUnderflow' }
  | { type: 'MissingValueToStore' }
  | { type: 'NotEnoughValues'; min: number; len: number }
  | { type: 'IndexOutOfBounds'; index: number; len: number };

export class Controller {
  private constructor();
  free(): void;
  static create(): Controller;
  add_machine(): number;
  add_machine_with_id(id: number): any;
  remove_machine(id: number): any;
  load(id: number, source: string): any;
  step_machine(id: number, count: number): any;
  reset_machine(id: number): void;
  statuses(): any;
  is_halted(): boolean;
  inspect_machine(id: number): any;
  read_code(id: number, size: number): any;
  read_mem(id: number, addr: number, size: number): any;
  read_stack(id: number, size: number): any;
  /**
   * Allows the frontend to consume events from the machine.
   */
  consume_machine_side_effects(id: number): any;
  clear(): void;
  /**
   * Serialize the entire sequencer state - very slow!
   * Should only be used for debugging.
   */
  full_serialize_sequencer_state(): any;
  /**
   * Serialize the sequencer state, excluding the buffers.
   */
  partial_serialize_sequencer_state(): any;
  set_mem(id: number, address: number, data: Uint16Array): any;
  wake(machine_id: number): void;
  /**
   * Send a message to a machine's inbox directly
   */
  send_message_to_machine(machine_id: number, message: Message): any;
  /**
   * Consume all outgoing messages from a machine
   */
  consume_messages(machine_id: number): any;
  /**
   * Get a complete snapshot of the machine state in a single call.
   * This batches inspect_machine, consume_side_effects, and consume_messages
   * to reduce WASM↔JS round-trip overhead from 4 calls to 1.
   */
  get_snapshot(id: number): any;
}
export class Port {
  free(): void;
  constructor(block: number, port: number);
  block: number;
  port: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_port_free: (a: number, b: number) => void;
  readonly __wbg_get_port_block: (a: number) => number;
  readonly __wbg_set_port_block: (a: number, b: number) => void;
  readonly __wbg_get_port_port: (a: number) => number;
  readonly __wbg_set_port_port: (a: number, b: number) => void;
  readonly port_new: (a: number, b: number) => number;
  readonly setup_system: () => void;
  readonly __wbg_controller_free: (a: number, b: number) => void;
  readonly controller_create: () => number;
  readonly controller_add_machine: (a: number) => [number, number, number];
  readonly controller_add_machine_with_id: (a: number, b: number) => [number, number, number];
  readonly controller_remove_machine: (a: number, b: number) => [number, number, number];
  readonly controller_load: (
    a: number,
    b: number,
    c: number,
    d: number
  ) => [number, number, number];
  readonly controller_step_machine: (a: number, b: number, c: number) => [number, number, number];
  readonly controller_reset_machine: (a: number, b: number) => void;
  readonly controller_statuses: (a: number) => [number, number, number];
  readonly controller_is_halted: (a: number) => number;
  readonly controller_inspect_machine: (a: number, b: number) => [number, number, number];
  readonly controller_read_code: (a: number, b: number, c: number) => [number, number, number];
  readonly controller_read_mem: (
    a: number,
    b: number,
    c: number,
    d: number
  ) => [number, number, number];
  readonly controller_read_stack: (a: number, b: number, c: number) => [number, number, number];
  readonly controller_consume_machine_side_effects: (
    a: number,
    b: number
  ) => [number, number, number];
  readonly controller_clear: (a: number) => void;
  readonly controller_full_serialize_sequencer_state: (a: number) => [number, number, number];
  readonly controller_partial_serialize_sequencer_state: (a: number) => [number, number, number];
  readonly controller_set_mem: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number
  ) => [number, number, number];
  readonly controller_wake: (a: number, b: number) => void;
  readonly controller_send_message_to_machine: (
    a: number,
    b: number,
    c: any
  ) => [number, number, number];
  readonly controller_consume_messages: (a: number, b: number) => [number, number, number];
  readonly controller_get_snapshot: (a: number, b: number) => [number, number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
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
