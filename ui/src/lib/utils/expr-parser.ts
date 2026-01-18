/**
 * Utility functions for parsing and evaluating mathematical expressions using expr-eval
 */

import { Parser } from 'expr-eval';

const MAX_INLETS = 10;

/**
 * Parse expression to find $1, $2, etc. and determine inlet count
 */
export function parseInletCount(expression: string): number {
	const dollarVarPattern = /\$(\d+)/g;
	const matches = [...expression.matchAll(dollarVarPattern)];

	const count = Math.max(0, ...matches.map((match) => parseInt(match[1])));

	return Math.min(count, MAX_INLETS);
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
