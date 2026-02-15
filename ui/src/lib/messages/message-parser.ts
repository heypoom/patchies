import type { FieldMapping } from '$lib/objects/schemas/utils';
import Json5 from 'json5';

/**
 * Splits a string at a delimiter, respecting JSON structure (braces, brackets, quotes).
 * Only delimiters at depth 0 (outside {}, [], and quotes) are treated as separators.
 */
function splitAtTopLevel(text: string, delimiter: ',' | ' '): string[] {
  let braceDepth = 0;
  let bracketDepth = 0;
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let inBacktick = false;

  const segments: string[] = [];
  let currentStart = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Handle escape sequences inside quotes — skip the next character
    if (char === '\\' && (inDoubleQuote || inSingleQuote || inBacktick)) {
      i++;
      continue;
    }

    // Toggle quote states
    if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '`' && !inDoubleQuote && !inSingleQuote) {
      inBacktick = !inBacktick;
      continue;
    }

    const inQuotes = inDoubleQuote || inSingleQuote || inBacktick;
    if (inQuotes) continue;

    // Track nesting depth
    if (char === '{') braceDepth++;
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (char === '[') bracketDepth++;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === delimiter && braceDepth === 0 && bracketDepth === 0) {
      segments.push(text.slice(currentStart, i).trim());
      currentStart = i + 1;
    }
  }

  // Push the final segment
  const lastSegment = text.slice(currentStart).trim();

  if (lastSegment || segments.length === 0) {
    segments.push(lastSegment);
  }

  // Filter out empty segments (from trailing/leading delimiters or consecutive delimiters)
  const filtered = segments.filter((s) => s.length > 0);

  return filtered.length > 0 ? filtered : [''];
}

/**
 * Splits a message string into sequential segments by top-level commas.
 *
 * Examples:
 * - "bang"                          → ["bang"]
 * - "bang, 100"                     → ["bang", "100"]
 * - "{a: 1, b: 2}, bang"           → ["{a: 1, b: 2}", "bang"]
 * - "[1, 2], [3, 4]"              → ["[1, 2]", "[3, 4]"]
 * - '"hello, world", 42'           → ['"hello, world"', "42"]
 */
export const splitSequentialMessages = (text: string): string[] => splitAtTopLevel(text, ',');

/**
 * Splits a string into tokens by top-level spaces.
 * Spaces inside {}, [], and quotes are preserved.
 *
 * Examples:
 * - "1024 2048"                     → ["1024", "2048"]
 * - "1024 bang {type: 'set'}"       → ["1024", "bang", "{type: 'set'}"]
 * - '"hello world" 42'             → ['"hello world"', "42"]
 */
export const splitByTopLevelSpaces = (text: string): string[] => splitAtTopLevel(text, ' ');

/** Parse a value token: try JSON5, fallback to raw string. */
function parseTokenValue(token: string): unknown {
  try {
    return Json5.parse(token);
  } catch {
    return token;
  }
}

/**
 * Separate named (field=value) arguments from positional arguments.
 * A token is named if it has `identifierName=value` format.
 */
export function parseNamedArgs(tokens: string[]): {
  positional: string[];
  named: Record<string, string>;
} {
  const positional: string[] = [];
  const named: Record<string, string> = {};

  for (const token of tokens) {
    const eqIndex = token.indexOf('=');

    if (eqIndex > 0) {
      const key = token.slice(0, eqIndex);

      if (/^[a-zA-Z_]\w*$/.test(key)) {
        named[key] = token.slice(eqIndex + 1);
        continue;
      }
    }

    positional.push(token);
  }

  return { positional, named };
}

/**
 * Try to resolve space-separated tokens as a shorthand message.
 * Returns the resolved message object, or null if no matching schema found.
 *
 * Resolution rules:
 * - First token is the type name, must exist in typeMap
 * - Argument count selects the schema (positional args fill remaining fields)
 * - Named args (field=value) override positional assignments
 * - Rest-args: if last field is Type.String(), extra positional tokens are joined with spaces
 * - No match → returns null (caller falls back to array)
 *
 * Examples:
 *   ['set', '1']           → {type: 'set', value: 1}
 *   ['set', 'foo', '42']   → {type: 'set', key: 'foo', value: 42}
 *   ['set', 'value=1']     → {type: 'set', value: 1}
 *   ['unknownType', '1']   → null
 */
export function tryResolveShorthand(
  tokens: string[],
  typeMap: Map<string, FieldMapping[]>
): Record<string, unknown> | null {
  const [typeName, ...argTokens] = tokens;

  // 0 args → symbol
  if (argTokens.length === 0) {
    // Only resolve symbols for known types (type map lookup)
    return typeMap.has(typeName) ? { type: typeName } : null;
  }

  const { positional, named } = parseNamedArgs(argTokens);

  // All-named args → construct directly, no schema needed.
  // The user explicitly specified every field, so bypass type map filtering.
  if (positional.length === 0 && Object.keys(named).length > 0) {
    const result: Record<string, unknown> = { type: typeName };

    for (const [key, value] of Object.entries(named)) {
      result[key] = parseTokenValue(value);
    }

    return result;
  }

  const mappings = typeMap.get(typeName);
  if (!mappings) return null;

  // Sort by field count ascending for predictable matching
  const sorted = [...mappings].sort((a, b) => a.fields.length - b.fields.length);

  for (const mapping of sorted) {
    // All named keys must exist in this schema's fields
    if (Object.keys(named).some((k) => !mapping.fields.includes(k))) continue;

    const remainingFields = mapping.fields.filter((f) => !(f in named));

    // Exact match: positional count equals remaining fields
    const exactMatch = positional.length === remainingFields.length;

    // Rest-args: last field is String, more positional than remaining, at least 1 remaining
    const lastRemaining = remainingFields[remainingFields.length - 1];
    const isLastSchemaField = lastRemaining === mapping.fields[mapping.fields.length - 1];
    const restMatch =
      mapping.lastFieldIsString &&
      isLastSchemaField &&
      positional.length > remainingFields.length &&
      remainingFields.length > 0;

    if (!exactMatch && !restMatch) continue;

    // Build result
    const result: Record<string, unknown> = { type: typeName };

    if (restMatch) {
      // Assign all remaining fields except the last one normally
      for (let i = 0; i < remainingFields.length - 1; i++) {
        result[remainingFields[i]] = parseTokenValue(positional[i]);
      }

      // Join rest into the last field as string
      result[lastRemaining] = positional.slice(remainingFields.length - 1).join(' ');
    } else {
      for (let i = 0; i < remainingFields.length; i++) {
        result[remainingFields[i]] = parseTokenValue(positional[i]);
      }
    }

    // Apply named args (override positional)
    for (const [key, value] of Object.entries(named)) {
      result[key] = parseTokenValue(value);
    }

    return result;
  }

  return null;
}
