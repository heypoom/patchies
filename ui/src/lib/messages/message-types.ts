/**
 * Message type specifiers for filtering and routing messages.
 *
 * bang: matches { type: 'bang' }
 * symbol: matches objects with a `type` key OR typeof === 'symbol'
 * any: matches anything
 * list: matches arrays (Array.isArray)
 * object: matches plain objects (not arrays, not null)
 * number: matches any finite number
 * integer: matches integers (Number.isInteger && Number.isFinite)
 * float: matches non-integer finite numbers
 */
export type MessageType =
	| 'bang'
	| 'symbol'
	| 'any'
	| 'list'
	| 'object'
	| 'number'
	| 'integer'
	| 'float';

/** Map from abbreviations to full names */
const ABBREVIATION_MAP: Record<string, MessageType> = {
	b: 'bang',
	s: 'symbol',
	a: 'any',
	l: 'list',
	o: 'object',
	n: 'number',
	i: 'integer',
	f: 'float',
	int: 'integer'
};

/** Set of valid message types for quick lookup */
const VALID_TYPES = new Set<MessageType>([
	'bang',
	'symbol',
	'any',
	'list',
	'object',
	'number',
	'integer',
	'float'
]);

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
export function matchesMessageType(type: MessageType, data: unknown): boolean {
	switch (type) {
		case 'bang':
			// Bang: matches { type: 'bang' } or any input (bang is a trigger, not a filter)
			return true;

		case 'symbol':
			// Symbol: objects with `type` key or JS symbols
			if (typeof data === 'symbol') return true;
			if (
				typeof data === 'object' &&
				data !== null &&
				'type' in data &&
				typeof (data as Record<string, unknown>).type === 'string'
			) {
				return true;
			}
			return false;

		case 'any':
			// Any: always matches
			return true;

		case 'list':
			// List: arrays only
			return Array.isArray(data);

		case 'object':
			// Object: plain objects (not arrays, not null)
			return typeof data === 'object' && data !== null && !Array.isArray(data);

		case 'number':
			// Number: any finite number
			return typeof data === 'number' && Number.isFinite(data);

		case 'integer':
			// Integer: integers only
			return typeof data === 'number' && Number.isInteger(data) && Number.isFinite(data);

		case 'float':
			// Float: non-integer finite numbers
			return typeof data === 'number' && !Number.isInteger(data) && Number.isFinite(data);

		default:
			return false;
	}
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
 * Accepts both abbreviations (b, s, a, l, o, n, i, f) and full names (bang, symbol, etc.).
 * Filters out invalid types.
 */
export function parseMessageTypes(params: unknown[]): MessageType[] {
	return params
		.map((p) => normalizeMessageType(String(p)))
		.filter((p): p is MessageType => p !== undefined);
}
