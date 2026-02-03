import { match, P } from 'ts-pattern';

/**
 * Message type specifiers for filtering and routing messages.
 *
 * bang: matches { type: 'bang' }
 * symbol: matches strings, JS symbols, or objects with a `type` key (Max convention)
 * any: matches anything
 * list: matches arrays (Array.isArray)
 * object: matches plain objects (not arrays, not null)
 * number/float: matches any number
 * integer: matches integers only
 * null: matches null
 */
export type MessageType =
  | 'bang'
  | 'symbol'
  | 'string'
  | 'any'
  | 'list'
  | 'object'
  | 'number'
  | 'float'
  | 'integer'
  | 'null';

/** Map from abbreviations to full names */
const ABBREVIATION_MAP: Record<string, MessageType> = {
  b: 'bang',
  s: 'symbol',
  a: 'any',
  l: 'list',
  o: 'object',
  n: 'number',
  f: 'float',
  i: 'integer',
  t: 'string',
  text: 'string',
  str: 'string'
};

/** All valid message type full names */
const ALL_MESSAGE_TYPES: MessageType[] = [
  'bang',
  'symbol',
  'string',
  'any',
  'list',
  'object',
  'number',
  'float',
  'integer',
  'null'
];

/** Set of valid message types for quick lookup */
const VALID_TYPES = new Set<MessageType>(ALL_MESSAGE_TYPES);

/** Get the full name for a message type (identity function since types are now full names) */
export const getMessageTypeName = (type: MessageType): string => type;

/**
 * Check if a string is a valid message type specifier (abbreviation or full name).
 */
export function isValidMessageType(type: string): boolean {
  const lower = type.toLowerCase();

  return VALID_TYPES.has(lower as MessageType) || lower in ABBREVIATION_MAP;
}

/**
 * Normalize a type specifier to its full name form.
 */
export function normalizeMessageType(type: string): MessageType | undefined {
  const lower = type.toLowerCase();

  // Check if it's already a full name
  if (VALID_TYPES.has(lower as MessageType)) {
    return lower as MessageType;
  }

  // Check if it's an abbreviation
  return ABBREVIATION_MAP[lower];
}

/**
 * Check if a value matches a message type specifier.
 */
export function matchesMessageType(type: MessageType, value: unknown): boolean {
  return match(type)
    .with('bang', () => true)
    .with('any', () => true)
    .with(P.union('number', 'float'), () => typeof value === 'number')
    .with('symbol', () => {
      // strings and JS symbols (Max convention: symbol = all text data)
      if (typeof value === 'string' || typeof value === 'symbol') return true;

      // also match objects with a `type` key (typed messages)
      return (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        typeof (value as Record<string, unknown>).type === 'string'
      );
    })
    .with('string', () => typeof value === 'string')
    .with('list', () => Array.isArray(value))
    .with('object', () => typeof value === 'object' && value !== null && !Array.isArray(value))
    .with('integer', () => typeof value === 'number' && Number.isInteger(value))
    .with('null', () => value === null)
    .exhaustive();
}

/**
 * Get the output value for a message type specifier.
 * For 'bang', always returns { type: 'bang' }.
 * For other types, returns the input if it matches, undefined otherwise.
 */
export function getTypedOutput(type: MessageType, data: unknown): unknown {
  if (type === 'bang') {
    // Bang: always send bang regardless of input
    return { type: 'bang' };
  }

  // For other types, pass through if matches
  if (matchesMessageType(type, data)) {
    return data;
  }

  return undefined;
}

/**
 * Parse a list of type specifier strings into MessageType array.
 * Accepts both abbreviations (e.g. b, s) and full names (e.g. bang, symbol).
 * Filters out invalid types.
 */
export const parseMessageTypes = (params: unknown[]): MessageType[] =>
  params
    .map((p) => normalizeMessageType(String(p)))
    .filter((p): p is MessageType => p !== undefined);
