/**
 * Utility functions for parsing and evaluating mathematical expressions using expr-eval
 */

import { Parser } from 'expr-eval';

/**
 * Parse expression to find $1, $2, etc. and determine inlet count
 */
export function parseInletCount(expression: string): number {
	const dollarVarPattern = /\$(\d+)/g;
	const matches = [...expression.matchAll(dollarVarPattern)];
	const maxVar = Math.max(0, ...matches.map((match) => parseInt(match[1])));

	// At least 1 inlet
	return maxVar > 0 ? maxVar : 1;
}

/**
 * Create evaluation function from expression using expr-eval
 */
export function createExpressionEvaluator(
	expression: string
): ((...args: number[]) => unknown) | null {
	if (!expression.trim()) return null;

	try {
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

		const renamedParam = expression.replace(/\$(\d+)/g, 'x$1');

		const expr = parser.parse(renamedParam);
		const parameterNames = [...Array(9)].map((_, i) => `x${i + 1}`);

		return expr.toJSFunction(parameterNames.join(','));
	} catch (error) {
		if (error instanceof Error) {
			console.error('Failed to create expression evaluator:', error.message);
		}

		return null;
	}
}
