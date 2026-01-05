/**
 * Orca Example Patterns
 *
 * Pre-built patterns for quick start
 */

export const ORCA_PATTERNS = {
	hello: `..D8....
......*.
A12....`,

	clock: `..C4....
......*.
A12....`,

	euclidean: `..U24...
......*.
A12....`,

	counter: `..C1....
......*.
I12....`,

	melody: `..D8....
:.35C.*.
A12....`,

	drums: `..D4....
:.10C.*.
A12....
..D2....
:.01C.*.
B12....`,

	random: `..D8....
:R05C.*.
A12....`,

	empty: new Array(65).fill('.').join('')
};

export type PatternKey = keyof typeof ORCA_PATTERNS;
