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

/**
 * Parse fexpr~ expression to find x1, x2, s1, s2, etc. and determine signal inlet count.
 * Supports both x and s prefixes (they are aliased in fexpr~).
 * Handles history access syntax like x1[-1], s1[-2].
 * Also supports bare `s` as alias for x1 (backwards compat with expr~).
 * Returns the number of signal inlets needed.
 */
export function parseFExprSignalInletCount(expression: string): number {
  // Match x1, x2, s1, s2, etc. (including with brackets like x1[-1])
  // Use word boundary to avoid matching other words
  const signalVarPattern = /\b([xs])(\d+)\b/g;
  const matches = [...expression.matchAll(signalVarPattern)];

  // Also check for bare `s` (backwards compat) - must be standalone, not part of s1, s2, etc.
  const hasBareS = /\bs\b(?!\d)/.test(expression);

  if (matches.length === 0 && !hasBareS) return 0;

  // Find the max index used (1-indexed, so x2 means we need 2 inlets)
  const maxIndex = Math.max(0, ...matches.map((match) => parseInt(match[2])));

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

// --- Multi-outlet support ---

export interface ParsedExpressions {
  /** All statements in order, including assignments */
  statements: string[];

  /** Assignment statements (variable declarations) */
  assignments: string[];

  /** Non-assignment expressions that create outlets, in order */
  outletExpressions: string[];

  /** Number of outlets (= outletExpressions.length, minimum 1) */
  outletCount: number;
}

/**
 * Check if a statement is a variable assignment (e.g. `a = $1 * 2`).
 * Excludes comparisons: ==, !=, <=, >=, =>
 */
export function isAssignment(statement: string): boolean {
  return /^[a-zA-Z_]\w*\s*=[^=]/.test(statement.trim());
}

/**
 * Split an expression string into individual statements.
 * Splits on both semicolons and newlines, trims whitespace, and filters empty strings.
 */
function splitStatements(expression: string): string[] {
  return expression
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse a multi-outlet expression into assignments and outlet expressions.
 * Statements with `=` (not ==, !=, <=, >=) are variable assignments.
 * Everything else creates an outlet.
 */
export function parseMultiOutletExpressions(expression: string): ParsedExpressions {
  const statements = splitStatements(expression);
  const assignments: string[] = [];
  const outletExpressions: string[] = [];

  for (const stmt of statements) {
    if (isAssignment(stmt)) {
      assignments.push(stmt);
    } else {
      outletExpressions.push(stmt);
    }
  }

  return {
    statements,
    assignments,
    outletExpressions,
    outletCount: Math.max(1, outletExpressions.length)
  };
}

/**
 * Count the number of outlets an expression produces.
 */
export function parseOutletCount(expression: string): number {
  if (!expression.trim()) return 1;
  return parseMultiOutletExpressions(expression).outletCount;
}

export type MultiOutletEvaluatorResult =
  | { success: true; fns: Array<(...args: unknown[]) => unknown>; outletCount: number }
  | { success: false; error: string };

/**
 * Create multiple evaluation functions — one per outlet expression.
 * Assignments are prepended to each outlet expression so variables are in scope.
 */
export function createMultiOutletEvaluator(expression: string): MultiOutletEvaluatorResult {
  if (!expression.trim()) {
    return { success: true, fns: [() => 0], outletCount: 1 };
  }

  const { assignments, outletExpressions, outletCount } = parseMultiOutletExpressions(expression);

  // If no outlet expressions (all assignments), treat last assignment as expression
  const exprs =
    outletExpressions.length > 0 ? outletExpressions : [assignments.pop() ?? '0'].filter(Boolean);

  const parameterNames = [...Array(9)].map((_, i) => `x${i + 1}`);
  const prefix = assignments.length > 0 ? assignments.join(';') + ';' : '';

  try {
    const fns = exprs.map((outletExpr) => {
      const fullExpr = prefix + outletExpr;
      const renamedParam = fullExpr.replace(/\$(\d+)/g, 'x$1');
      const parsed = parser.parse(renamedParam);

      return parsed.toJSFunction(parameterNames.join(',')) as (...args: unknown[]) => unknown;
    });

    return { success: true, fns, outletCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { success: false, error: message };
  }
}
