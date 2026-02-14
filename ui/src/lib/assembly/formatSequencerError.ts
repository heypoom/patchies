import { match } from 'ts-pattern';
import type { RuntimeError, ParseError, SequencerError } from 'machine';

type RuntimeErrorKey = RuntimeError['type'];
type ParseErrorKey = ParseError['type'];
type SequencerErrorKey = SequencerError['type'];

const RUNTIME_ERROR_KEYS: RuntimeErrorKey[] = [
  'StackUnderflow',
  'StackOverflow',
  'CallStackExceeded',
  'MissingReturnAddress',
  'MissingMessageBody',
  'CannotReadStringFromBytes',
  'CannotLoadFromMemory',
  'CannotDivideByZero',
  'IntegerOverflow',
  'IntegerUnderflow',
  'MissingValueToStore',
  'NotEnoughValues',
  'IndexOutOfBounds'
];

const PARSE_ERROR_KEYS: ParseErrorKey[] = [
  'InvalidString',
  'UndefinedSymbols',
  'InvalidIdentifier',
  'UndefinedInstruction',
  'InvalidLabelDescription',
  'DuplicateLabelDefinition',
  'DuplicateStringDefinition',
  'DuplicateSymbolDefinition',
  'InvalidArgument',
  'InvalidStringValue',
  'InvalidByteValue',
  'InvalidArgToken',
  'CannotPeekAtToken',
  'PeekExceedsSourceLength',
  'InvalidDecimalDigit',
  'InvalidHexDigit',
  'ScannerReachedEndOfLine',
  'EmptyProgram'
];

const SEQ_ERROR_KEYS: SequencerErrorKey[] = [
  'CannotParse',
  'ExecutionFailed',
  'MachineDoesNotExist',
  'ReceiveFailed',
  'MessageNeverReceived',
  'ExecutionCycleExceeded'
];

/**
 * Type guard to check if error has the shape of a RuntimeError
 */
function isRuntimeError(error: unknown): error is RuntimeError {
  if (!error || typeof error !== 'object' || !('type' in error)) return false;

  return RUNTIME_ERROR_KEYS.includes((error as { type: RuntimeErrorKey }).type);
}

/**
 * Type guard to check if error has the shape of a ParseError
 */
function isParseError(error: unknown): error is ParseError {
  if (!error || typeof error !== 'object' || !('type' in error)) return false;

  return PARSE_ERROR_KEYS.includes((error as { type: ParseErrorKey }).type);
}

/**
 * Type guard to check if error has the shape of a SequencerError
 */
function isSequencerError(error: unknown): error is SequencerError {
  if (!error || typeof error !== 'object' || !('type' in error)) return false;

  return SEQ_ERROR_KEYS.includes((error as { type: SequencerErrorKey }).type);
}

/**
 * Format a runtime error to a human-readable message.
 * Uses exhaustive matching for compile-time guarantees.
 */
function formatRuntimeError(error: RuntimeError): string {
  return match(error)
    .with(
      { type: 'StackUnderflow' },
      ({ top, min }) => `Stack underflow: pointer ${top} is below minimum ${min}`
    )
    .with(
      { type: 'StackOverflow' },
      ({ top, max }) => `Stack overflow: pointer ${top} exceeds maximum ${max}`
    )
    .with(
      { type: 'CallStackExceeded' },
      () => 'Call stack exceeded: too many nested function calls'
    )
    .with(
      { type: 'MissingReturnAddress' },
      () => 'Missing return address: cannot return from function'
    )
    .with(
      { type: 'MissingMessageBody' },
      () => 'Missing message body: message data not found in stack'
    )
    .with({ type: 'CannotReadStringFromBytes' }, () => 'Cannot read string: invalid byte sequence')
    .with({ type: 'CannotLoadFromMemory' }, () => 'Cannot load from memory: invalid memory access')
    .with({ type: 'CannotDivideByZero' }, () => 'Division by zero')
    .with({ type: 'IntegerOverflow' }, () => 'Integer overflow: value too large')
    .with({ type: 'IntegerUnderflow' }, () => 'Integer underflow: value too small')
    .with({ type: 'MissingValueToStore' }, () => 'Missing value to store: stack is empty')
    .with(
      { type: 'NotEnoughValues' },
      ({ min, len }) => `Not enough values: need ${min}, have ${len}`
    )
    .with(
      { type: 'IndexOutOfBounds' },
      ({ index, len }) => `Index out of bounds: ${index} >= ${len}`
    )
    .exhaustive();
}

/**
 * Format a parse error to a human-readable message.
 * Uses exhaustive matching for compile-time guarantees.
 */
function formatParseError(error: ParseError): string {
  return match(error)
    .with({ type: 'InvalidString' }, () => 'Invalid string literal')
    .with({ type: 'UndefinedSymbols' }, () => 'Undefined symbol')
    .with({ type: 'InvalidIdentifier' }, () => 'Invalid identifier')
    .with({ type: 'UndefinedInstruction' }, ({ name }) => `Unknown instruction: '${name}'`)
    .with({ type: 'InvalidLabelDescription' }, () => 'Invalid label: should end with ":"')
    .with({ type: 'DuplicateLabelDefinition' }, () => 'Duplicate label definition')
    .with({ type: 'DuplicateStringDefinition' }, () => 'Duplicate string definition')
    .with({ type: 'DuplicateSymbolDefinition' }, () => 'Duplicate symbol definition')
    .with({ type: 'InvalidArgument' }, ({ errors }) => {
      const nested = errors.map(formatParseError).join('; ');
      return `Invalid argument: ${nested}`;
    })
    .with({ type: 'InvalidStringValue' }, () => 'Invalid string value')
    .with({ type: 'InvalidByteValue' }, () => 'Invalid byte value')
    .with({ type: 'InvalidArgToken' }, () => 'Invalid argument token')
    .with({ type: 'CannotPeekAtToken' }, () => 'Cannot peek at token')
    .with({ type: 'PeekExceedsSourceLength' }, () => 'Unexpected end of input')
    .with({ type: 'InvalidDecimalDigit' }, ({ text }) => `Invalid decimal number: '${text}'`)
    .with({ type: 'InvalidHexDigit' }, ({ text }) => `Invalid hex number: '${text}'`)
    .with({ type: 'ScannerReachedEndOfLine' }, () => 'Unterminated string or token')
    .with({ type: 'EmptyProgram' }, () => 'Empty program: no instructions to execute')
    .exhaustive();
}

/**
 * Format a sequencer error to a human-readable message.
 * Uses exhaustive matching for compile-time guarantees.
 */
function formatSequencerErrorTyped(error: SequencerError): string {
  return match(error)
    .with({ type: 'CannotParse' }, ({ error: inner }) => formatParseError(inner))
    .with({ type: 'ExecutionFailed' }, ({ error: inner }) => formatRuntimeError(inner))
    .with({ type: 'MachineDoesNotExist' }, ({ id }) => `Machine ${id} does not exist`)
    .with({ type: 'ReceiveFailed' }, ({ error: inner }) => formatRuntimeError(inner))
    .with(
      { type: 'MessageNeverReceived' },
      () => 'Message never received: machine timed out waiting'
    )
    .with(
      { type: 'ExecutionCycleExceeded' },
      () => 'Execution cycle exceeded: possible infinite loop'
    )
    .exhaustive();
}

/**
 * Format a VASM error to a human-readable message.
 * This is the main entry point - accepts unknown and uses type guards.
 */
export function formatSequencerError(error: unknown): string | null {
  if (isSequencerError(error)) {
    return formatSequencerErrorTyped(error);
  }

  if (isRuntimeError(error)) {
    return formatRuntimeError(error);
  }

  if (isParseError(error)) {
    return formatParseError(error);
  }

  return null;
}
