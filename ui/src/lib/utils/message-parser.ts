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
 *   "bang"                          → ["bang"]
 *   "bang, 100"                     → ["bang", "100"]
 *   "{a: 1, b: 2}, bang"           → ["{a: 1, b: 2}", "bang"]
 *   "[1, 2], [3, 4]"              → ["[1, 2]", "[3, 4]"]
 *   '"hello, world", 42'           → ['"hello, world"', "42"]
 */
export function splitSequentialMessages(text: string): string[] {
  return splitAtTopLevel(text, ',');
}

/**
 * Splits a string into tokens by top-level spaces.
 * Spaces inside {}, [], and quotes are preserved.
 *
 * Examples:
 *   "1024 2048"                     → ["1024", "2048"]
 *   "1024 bang {type: 'set'}"       → ["1024", "bang", "{type: 'set'}"]
 *   '"hello world" 42'             → ['"hello world"', "42"]
 */
export function splitByTopLevelSpaces(text: string): string[] {
  return splitAtTopLevel(text, ' ');
}
