/**
 * Utility functions for parsing and evaluating mathematical expressions using expr-eval
 */

import { Parser } from 'expr-eval';

const MAX_INLETS = 10;
const MAX_SIGNAL_INLETS = 9;

/**
 * Parse expression to find $1, $2, etc. and determine inlet count
 */
export function parseInletCount(expression: string): number {
  const dollarVarPattern = /\$(\d+)/g;
  const matches = [...expression.matchAll(dollarVarPattern)];

  const count = Math.max(0, ...matches.map((match) => parseInt(match[1])));

  return Math.min(count, MAX_INLETS);
}

/**
 * Parse expression to find s1, s2, s3, etc. and determine signal inlet count.
 * Also supports bare `s` which is treated as s1 for backwards compatibility.
 * Returns the number of signal inlets needed (e.g., "s1 + s2" returns 2).
 * Uses 1-indexed naming to match $1, $2, etc. convention.
 */
export function parseSignalInletCount(expression: string): number {
  // Match s1, s2, s3, etc. (but not words like "samples" or "sin")
  // Use word boundary to avoid matching "samples", "sin", etc.
  const signalVarPattern = /\bs(\d+)\b/g;
  const matches = [...expression.matchAll(signalVarPattern)];

  // Also check for bare `s` (backwards compat) - must be standalone, not part of s1, s2, etc.
  // Match `s` that is not followed by a digit
  const hasBareS = /\bs\b(?!\d)/.test(expression);

  if (matches.length === 0 && !hasBareS) return 0;

  // Find the max index used (1-indexed, so s2 means we need 2 inlets)
  const maxIndex = Math.max(0, ...matches.map((match) => parseInt(match[1])));

  // If we have bare `s`, we need at least 1 inlet
  const count = hasBareS ? Math.max(1, maxIndex) : maxIndex;

  return Math.min(count, MAX_SIGNAL_INLETS);
}

const parser = new Parser({
  operators: {
    add: true,
    concatenate: true,
    conditional: true,
    divide: true,
    factorial: true,
    multiply: true,
    power: true,
    remainder: true,
    subtract: true,
    logical: true,
    comparison: true,
    in: true,
    assignment: true
  }
});

export type ExpressionEvaluatorResult =
  | { success: true; fn: (...args: unknown[]) => unknown }
  | { success: false; error: string };

/**
 * Create evaluation function from expression using expr-eval
 */
export function createExpressionEvaluator(expression: string): ExpressionEvaluatorResult {
  if (!expression.trim()) return { success: true, fn: () => 0 };

  try {
    const renamedParam = expression.replace(/\$(\d+)/g, 'x$1');

    const expr = parser.parse(renamedParam);
    const parameterNames = [...Array(9)].map((_, i) => `x${i + 1}`);

    return { success: true, fn: expr.toJSFunction(parameterNames.join(',')) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { success: false, error: message };
  }
}
